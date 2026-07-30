/**
 * digit-recognizer.ts — Euclidean distance template matching for digit recognition.
 *
 * Pipeline per region:
 *  ImageData
 *    → grayscale
 *    → Otsu threshold → binary
 *    → column histogram → char slices
 *    → per-slice: extract + normalize + zone density → Euclidean match
 *    → filter weak matches → assemble numeric string → parse integer
 */

import {
  computeZoneDensity,
  getTemplates,
  ZONE_COUNT,
  TEMPLATE_W,
  TEMPLATE_H,
} from './templates';
import { toGrayscale, toBinary, otsuThreshold } from './image-processor';
import {
  columnHistogram,
  findCharSlices,
  extractAndNormalize,
  filterSpuriousSlices,
} from './char-segmenter';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface CharMatch {
  digit:      string;
  confidence: number;
}

export interface RegionResult {
  /** Parsed integer value (0 if recognition fails) */
  value:      number;
  /** Raw concatenation of recognised digit characters */
  rawText:    string;
  /** Minimum confidence across all recognised characters in the region */
  confidence: number;
  /** Per-character matches (useful for debugging) */
  chars:      CharMatch[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Distance helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Worst-case Euclidean distance for ZONE_COUNT-dimensional unit vectors */
const MAX_DIST = Math.sqrt(ZONE_COUNT); // ≈ 4.47

function euclidean(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

// ──────────────────────────────────────────────────────────────────────────────
// Single vector classification
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Classifies a zone density vector against all stored digit templates.
 * Returns the best-matching digit and its confidence [0, 1].
 */
export function classifyVector(vec: Float32Array): CharMatch {
  const templates  = getTemplates();
  let bestDigit    = '0';
  let bestDist     = Infinity;

  for (const [digit, refVecs] of templates) {
    for (const ref of refVecs) {
      const d = euclidean(vec, ref);
      if (d < bestDist) {
        bestDist  = d;
        bestDigit = digit;
      }
    }
  }

  return {
    digit:      bestDigit,
    confidence: Math.max(0, 1 - bestDist / MAX_DIST),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Full region recognition
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Minimum confidence for a character to be included in the output.
 * Characters below this threshold are treated as noise / non-digit symbols (e.g. %).
 */
const MIN_CHAR_CONFIDENCE = 0.38;

/**
 * Recognises all digits in a cropped region's ImageData.
 *
 * Steps:
 *  1. Grayscale → Otsu threshold → binary
 *  2. Column histogram → char slices (gap between digits)
 *  3. Filter spurious narrow slices
 *  4. Normalise each slice → zone density → classify
 *  5. Discard low-confidence characters (catches % signs and noise)
 *  6. Assemble integer value
 */
export function recognizeRegion(imageData: ImageData): RegionResult {
  const { width, height } = imageData;

  // ── 1. Binarise ────────────────────────────────────────────────────────────
  const gray      = toGrayscale(imageData);
  const threshold = otsuThreshold(gray);
  const binary    = toBinary(gray, threshold);

  // ── 2. Segment ─────────────────────────────────────────────────────────────
  const hist   = columnHistogram(binary, width, height);
  const rawSlices = findCharSlices(hist, height, 1);
  const slices = filterSpuriousSlices(rawSlices, height);

  if (slices.length === 0) {
    return { value: 0, rawText: '', confidence: 0, chars: [] };
  }

  // ── 3. Classify each slice ─────────────────────────────────────────────────
  const allChars: CharMatch[] = [];

  for (const slice of slices) {
    const norm = extractAndNormalize(binary, width, height, slice, TEMPLATE_W, TEMPLATE_H);
    const vec  = computeZoneDensity(norm, TEMPLATE_W, TEMPLATE_H);
    allChars.push(classifyVector(vec));
  }

  // ── 4. Filter low-confidence (non-digit) characters ────────────────────────
  const digits = allChars.filter(c => c.confidence >= MIN_CHAR_CONFIDENCE);

  if (digits.length === 0) {
    return { value: 0, rawText: '', confidence: 0, chars: allChars };
  }

  // ── 5. Assemble result ─────────────────────────────────────────────────────
  const rawText   = digits.map(c => c.digit).join('');
  const value     = parseInt(rawText, 10);
  const confidence = Math.min(...digits.map(c => c.confidence));

  return {
    value:      isNaN(value) ? 0 : value,
    rawText,
    confidence,
    chars:      allChars,
  };
}
