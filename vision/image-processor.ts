/**
 * image-processor.ts — browser-native image loading, cropping, and binarization.
 *
 * All operations use the Canvas 2D API. No external dependencies.
 */

import type { Region } from './region-config';

// ──────────────────────────────────────────────────────────────────────────────
// Image loading
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Loads a File or Blob into an HTMLImageElement.
 * The object URL is revoked after the image loads to prevent memory leaks.
 */
export function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.src = url;
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Region cropping
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Crops a percentage-based region from an image, scales it up if it is
 * below `minHeight` pixels tall (ensures adequate pixel density for segmentation),
 * and returns the resulting ImageData.
 */
export function cropRegion(
  img: HTMLImageElement,
  region: Region,
  minHeight = 28,
): ImageData {
  const srcX = Math.floor(img.naturalWidth  * region.x);
  const srcY = Math.floor(img.naturalHeight * region.y);
  const srcW = Math.ceil (img.naturalWidth  * region.w);
  const srcH = Math.ceil (img.naturalHeight * region.h);

  // Scale up if the crop is too small
  const scale = srcH < minHeight ? minHeight / srcH : 1;
  const dstW  = Math.max(1, Math.round(srcW * scale));
  const dstH  = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width  = dstW;
  canvas.height = dstH;
  const ctx = canvas.getContext('2d')!;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, dstW, dstH);

  return ctx.getImageData(0, 0, dstW, dstH);
}

// ──────────────────────────────────────────────────────────────────────────────
// Grayscale conversion
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Converts RGBA ImageData to a grayscale Uint8Array (one value per pixel, 0–255).
 * Uses the perceptual luminance formula: Y = 0.299R + 0.587G + 0.114B.
 */
export function toGrayscale(imageData: ImageData): Uint8Array {
  const { data, width, height } = imageData;
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    const p = i << 2; // i * 4
    gray[i] = Math.round(0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]);
  }
  return gray;
}

// ──────────────────────────────────────────────────────────────────────────────
// Otsu threshold computation
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Computes the optimal binarisation threshold using Otsu's method.
 * Minimises intra-class variance → maximises inter-class variance.
 * Falls back to 128 for nearly uniform images.
 */
export function otsuThreshold(gray: Uint8Array): number {
  const hist = new Int32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;

  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];

  let sumB = 0, wB = 0, maxVar = 0, threshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;

    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const variance = wB * wF * (mB - mF) ** 2;

    if (variance > maxVar) {
      maxVar = variance;
      threshold = t;
    }
  }
  return threshold;
}

// ──────────────────────────────────────────────────────────────────────────────
// Binarisation
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Converts a grayscale array to a binary Uint8Array.
 * 1 = foreground (digit pixel)  0 = background
 *
 * eFootball uses WHITE digits on a DARK background, so pixels at or above the
 * threshold are foreground.
 *
 * If the resulting binary image is more than 60% foreground the image is likely
 * inverted (e.g. a very bright screenshot). In that case the binary is flipped.
 */
export function toBinary(gray: Uint8Array, threshold?: number): Uint8Array {
  const t   = threshold ?? otsuThreshold(gray);
  const bin = new Uint8Array(gray.length);
  let white = 0;

  for (let i = 0; i < gray.length; i++) {
    bin[i] = gray[i] >= t ? 1 : 0;
    white += bin[i];
  }

  // Auto-invert if image seems to have dark-on-light rendering
  if (white > gray.length * 0.60) {
    for (let i = 0; i < bin.length; i++) bin[i] ^= 1;
  }

  return bin;
}
