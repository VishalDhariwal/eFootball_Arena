/**
 * region-config.ts — eFootball Full Time stats screen region definitions.
 *
 * All coordinates are expressed as FRACTIONS (0.0–1.0) of the image dimensions.
 * This makes every region resolution-independent, working correctly at any
 * landscape mobile / tablet resolution (720p, 1080p, 1440p, etc.).
 *
 * Calibrated from the reference eFootball Full Time stats screenshot (16:9 landscape).
 *
 * ──────────────────────────────────────────────────────────────────────────────
 *   HOW TO RECALIBRATE
 *   If the eFootball UI changes, open a reference screenshot in an image editor,
 *   measure the pixel bounding box of each stat's number, then divide by the
 *   image dimensions to get the new fractions.
 * ──────────────────────────────────────────────────────────────────────────────
 */

export interface Region {
  /** Left edge as a fraction of image width (0–1) */
  x: number;
  /** Top edge as a fraction of image height (0–1) */
  y: number;
  /** Width as a fraction of image width (0–1) */
  w: number;
  /** Height as a fraction of image height (0–1) */
  h: number;
}

/**
 * Ordered list of stat keys — MUST match the on-screen top-to-bottom order.
 * Never change the order; it documents the fixed screen layout.
 */
export const STAT_KEYS = [
  'score',
  'possession',
  'shots',
  'shotsOnTarget',
  'fouls',
  'offsides',
  'cornerKicks',
  'freeKicks',
  'passes',
  'successfulPasses',
  'crosses',
  'interceptions',
  'tackles',
  'saves',
] as const;

export type StatKey = typeof STAT_KEYS[number];

/**
 * The 28 numeric regions on the eFootball Full Time stats screen.
 *
 * Naming convention: `<statKey>_left` and `<statKey>_right`
 * where left = player 1 (left team) and right = player 2 (right team).
 *
 * Layout notes (from reference screenshot):
 *  - Score digits live in the yellow header bar at the top (~8-17% y)
 *  - Stats table spans: x ≈ 26%–74%, y ≈ 18%–97%
 *  - Left value column:  x ≈ 27%–40%  (values are bold, centred in cell)
 *  - Right value column: x ≈ 58%–72%
 *  - Each row is ≈ 6% of image height
 *  - Possession shows "46%" — the % sign falls within the region; the recogniser
 *    filters it by confidence (% doesn't match any digit template well)
 */
export const REGIONS: Record<string, Region> = {

  // ── Score (inside the yellow header bar) ─────────────────────────────────
  score_left:  { x: 0.418, y: 0.080, w: 0.052, h: 0.090 },
  score_right: { x: 0.470, y: 0.080, w: 0.052, h: 0.090 },

  // ── Row 1 – Possession (values include '%', filtered downstream) ──────────
  possession_left:         { x: 0.268, y: 0.190, w: 0.135, h: 0.058 },
  possession_right:        { x: 0.580, y: 0.190, w: 0.135, h: 0.058 },

  // ── Row 2 – Total Shots ───────────────────────────────────────────────────
  shots_left:              { x: 0.268, y: 0.248, w: 0.135, h: 0.058 },
  shots_right:             { x: 0.580, y: 0.248, w: 0.135, h: 0.058 },

  // ── Row 3 – Shots on Target ───────────────────────────────────────────────
  shotsOnTarget_left:      { x: 0.268, y: 0.306, w: 0.135, h: 0.058 },
  shotsOnTarget_right:     { x: 0.580, y: 0.306, w: 0.135, h: 0.058 },

  // ── Row 4 – Fouls ─────────────────────────────────────────────────────────
  fouls_left:              { x: 0.268, y: 0.364, w: 0.135, h: 0.058 },
  fouls_right:             { x: 0.580, y: 0.364, w: 0.135, h: 0.058 },

  // ── Row 5 – Offsides ──────────────────────────────────────────────────────
  offsides_left:           { x: 0.268, y: 0.422, w: 0.135, h: 0.058 },
  offsides_right:          { x: 0.580, y: 0.422, w: 0.135, h: 0.058 },

  // ── Row 6 – Corner Kicks ──────────────────────────────────────────────────
  cornerKicks_left:        { x: 0.268, y: 0.480, w: 0.135, h: 0.058 },
  cornerKicks_right:       { x: 0.580, y: 0.480, w: 0.135, h: 0.058 },

  // ── Row 7 – Free Kicks ────────────────────────────────────────────────────
  freeKicks_left:          { x: 0.268, y: 0.538, w: 0.135, h: 0.058 },
  freeKicks_right:         { x: 0.580, y: 0.538, w: 0.135, h: 0.058 },

  // ── Row 8 – Passes (can be 3 digits, e.g. 113 / 165) ─────────────────────
  passes_left:             { x: 0.268, y: 0.596, w: 0.135, h: 0.058 },
  passes_right:            { x: 0.580, y: 0.596, w: 0.135, h: 0.058 },

  // ── Row 9 – Successful Passes ─────────────────────────────────────────────
  successfulPasses_left:   { x: 0.268, y: 0.654, w: 0.135, h: 0.058 },
  successfulPasses_right:  { x: 0.580, y: 0.654, w: 0.135, h: 0.058 },

  // ── Row 10 – Crosses ──────────────────────────────────────────────────────
  crosses_left:            { x: 0.268, y: 0.712, w: 0.135, h: 0.058 },
  crosses_right:           { x: 0.580, y: 0.712, w: 0.135, h: 0.058 },

  // ── Row 11 – Interceptions ────────────────────────────────────────────────
  interceptions_left:      { x: 0.268, y: 0.770, w: 0.135, h: 0.058 },
  interceptions_right:     { x: 0.580, y: 0.770, w: 0.135, h: 0.058 },

  // ── Row 12 – Tackles ──────────────────────────────────────────────────────
  tackles_left:            { x: 0.268, y: 0.828, w: 0.135, h: 0.058 },
  tackles_right:           { x: 0.580, y: 0.828, w: 0.135, h: 0.058 },

  // ── Row 13 – Saves ────────────────────────────────────────────────────────
  saves_left:              { x: 0.268, y: 0.878, w: 0.135, h: 0.058 },
  saves_right:             { x: 0.580, y: 0.878, w: 0.135, h: 0.058 },
};
