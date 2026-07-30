/**
 * char-segmenter.ts — column projection based character segmentation.
 *
 * Algorithm:
 *  1. Build a vertical histogram: for each column x, count white pixels.
 *  2. Find runs of "active" columns (column histogram ≥ minActivity threshold).
 *  3. Gaps between runs = character boundaries.
 *  4. Each character slice is extracted and scaled to TEMPLATE_W × TEMPLATE_H.
 *
 * No external dependencies — operates on raw Uint8Array binary images.
 */

export interface CharSlice {
  /** Inclusive start column index */
  start: number;
  /** Exclusive end column index */
  end: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Column histogram
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Counts the number of foreground (1) pixels in each column.
 * Returns an array of length `width`.
 */
export function columnHistogram(
  binary: Uint8Array,
  width:  number,
  height: number,
): number[] {
  const hist = new Array<number>(width).fill(0);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      hist[x] += binary[row + x];
    }
  }
  return hist;
}

// ──────────────────────────────────────────────────────────────────────────────
// Slice detection
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Finds character slices in a column histogram.
 *
 * @param histogram  Column histogram from `columnHistogram`.
 * @param height     Image height — used to set the minimum-activity threshold.
 * @param minGap     Minimum consecutive inactive columns to count as a separator.
 *
 * A column is considered "active" (part of a character) if its histogram value
 * is at least `ceil(height × 0.08)` — this filters out anti-aliasing noise while
 * preserving genuine digit pixels.
 */
export function findCharSlices(
  histogram: number[],
  height:    number,
  minGap = 1,
): CharSlice[] {
  const minActivity = Math.max(1, Math.ceil(height * 0.08));
  const slices: CharSlice[] = [];
  let inChar   = false;
  let start    = 0;
  let gapCount = 0;

  for (let x = 0; x < histogram.length; x++) {
    const active = histogram[x] >= minActivity;

    if (active) {
      if (!inChar) {
        inChar   = true;
        start    = x;
        gapCount = 0;
      } else {
        gapCount = 0; // reset gap counter when we see more active pixels
      }
    } else {
      if (inChar) {
        gapCount++;
        if (gapCount >= minGap) {
          slices.push({ start, end: x - gapCount + 1 });
          inChar   = false;
          gapCount = 0;
        }
      }
    }
  }

  // Close a slice that runs to the image edge
  if (inChar) slices.push({ start, end: histogram.length });

  return slices;
}

// ──────────────────────────────────────────────────────────────────────────────
// Character extraction and normalisation
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Extracts a character slice from a binary image and scales it to
 * `targetW × targetH` using nearest-neighbour sampling.
 *
 * Returns a Uint8Array of length `targetW * targetH` (binary: 0 or 1).
 */
export function extractAndNormalize(
  binary:   Uint8Array,
  srcWidth: number,
  srcHeight: number,
  slice:    CharSlice,
  targetW = 20,
  targetH = 30,
): Uint8Array {
  const sliceW = slice.end - slice.start;
  if (sliceW <= 0) return new Uint8Array(targetW * targetH);

  const out = new Uint8Array(targetW * targetH);

  for (let ty = 0; ty < targetH; ty++) {
    const sy = Math.min(srcHeight - 1, Math.floor((ty / targetH) * srcHeight));
    for (let tx = 0; tx < targetW; tx++) {
      const sx = slice.start + Math.min(sliceW - 1, Math.floor((tx / targetW) * sliceW));
      out[ty * targetW + tx] = binary[sy * srcWidth + sx];
    }
  }

  return out;
}

// ──────────────────────────────────────────────────────────────────────────────
// Noise filtering helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Filters out slices that are implausibly narrow (likely noise columns).
 * A valid digit slice should be at least `minWidthFraction` of the image height.
 */
export function filterSpuriousSlices(
  slices:    CharSlice[],
  imgHeight: number,
  minWidthFraction = 0.12,
): CharSlice[] {
  const minW = Math.max(2, Math.ceil(imgHeight * minWidthFraction));
  return slices.filter(s => (s.end - s.start) >= minW);
}
