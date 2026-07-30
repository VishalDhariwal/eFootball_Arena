/**
 * templates.ts — zone density feature computation and digit template management.
 *
 * ── How templates work ───────────────────────────────────────────────────────
 * Each character image (normalised to TEMPLATE_W × TEMPLATE_H) is divided into
 * a ZONE_COLS × ZONE_ROWS grid (default 4 × 5 = 20 zones).
 * For each zone the "density" = white pixels / total pixels is computed.
 * This produces a 20-element Float32Array — the zone density feature vector.
 *
 * ── Initial bootstrap ────────────────────────────────────────────────────────
 * On first use, each digit 0–9 is rendered onto a Canvas with a bold sans-serif
 * font and the zone density vector is computed. These vectors are stored in
 * localStorage so the template matching is consistent across sessions.
 *
 * ── Calibration ──────────────────────────────────────────────────────────────
 * After the admin confirms a correct extraction, `addCalibratedTemplate()` can
 * store an additional reference vector derived from real game pixels. Calibrated
 * templates override bootstrap ones and significantly improve accuracy.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

/** Width (px) of the normalised character canvas */
export const TEMPLATE_W = 20;
/** Height (px) of the normalised character canvas */
export const TEMPLATE_H = 30;
/** Number of zone columns */
export const ZONE_COLS  = 4;
/** Number of zone rows */
export const ZONE_ROWS  = 5;
/** Total zones per character (ZONE_COLS × ZONE_ROWS) */
export const ZONE_COUNT = ZONE_COLS * ZONE_ROWS; // 20

/** All recognisable digit characters */
export const DIGITS = ['0','1','2','3','4','5','6','7','8','9'] as const;
export type  Digit  = typeof DIGITS[number];

const LS_KEY = 'efootball_vision_templates_v1';

// ──────────────────────────────────────────────────────────────────────────────
// Zone density feature extraction
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Divides a binary image (width × height) into ZONE_COLS × ZONE_ROWS zones
 * and computes the fraction of foreground (1) pixels in each zone.
 *
 * Returns a Float32Array of length ZONE_COUNT where each element ∈ [0, 1].
 */
export function computeZoneDensity(
  binary: Uint8Array,
  width:  number,
  height: number,
): Float32Array {
  const vec   = new Float32Array(ZONE_COUNT);
  const zoneW = width  / ZONE_COLS;
  const zoneH = height / ZONE_ROWS;

  for (let r = 0; r < ZONE_ROWS; r++) {
    const y0 = Math.floor(r       * zoneH);
    const y1 = Math.floor((r + 1) * zoneH);
    for (let c = 0; c < ZONE_COLS; c++) {
      const x0 = Math.floor(c       * zoneW);
      const x1 = Math.floor((c + 1) * zoneW);

      let white = 0;
      let total = 0;
      for (let y = y0; y < y1; y++) {
        const rowBase = y * width;
        for (let x = x0; x < x1; x++) {
          white += binary[rowBase + x];
          total++;
        }
      }
      vec[r * ZONE_COLS + c] = total > 0 ? white / total : 0;
    }
  }
  return vec;
}

// ──────────────────────────────────────────────────────────────────────────────
// Canvas-based bootstrap template generation
// ──────────────────────────────────────────────────────────────────────────────

/** Renders a single character onto a TEMPLATE_W × TEMPLATE_H Canvas and returns
 *  its binary image (1 = foreground). Uses a bold, condensed sans-serif font. */
function renderDigit(char: string): Uint8Array {
  const canvas = document.createElement('canvas');
  canvas.width  = TEMPLATE_W;
  canvas.height = TEMPLATE_H;
  const ctx = canvas.getContext('2d')!;

  // Black background
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, TEMPLATE_W, TEMPLATE_H);

  // White digit — fill the cell as tightly as possible
  ctx.fillStyle    = '#fff';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  // Try fonts from most to least eFootball-like
  const fontSize = TEMPLATE_H - 2;
  ctx.font = `bold ${fontSize}px 'Arial Black', 'Impact', 'Arial', sans-serif`;
  ctx.fillText(char, TEMPLATE_W / 2, TEMPLATE_H / 2);

  const { data } = ctx.getImageData(0, 0, TEMPLATE_W, TEMPLATE_H);
  const bin = new Uint8Array(TEMPLATE_W * TEMPLATE_H);
  for (let i = 0; i < bin.length; i++) bin[i] = data[i << 2] > 64 ? 1 : 0;
  return bin;
}

/** Builds the full default template map by rendering each digit 0–9. */
function buildDefaultTemplates(): Map<string, Float32Array[]> {
  const map = new Map<string, Float32Array[]>();
  for (const d of DIGITS) {
    const bin = renderDigit(d);
    map.set(d, [computeZoneDensity(bin, TEMPLATE_W, TEMPLATE_H)]);
  }
  return map;
}

// ──────────────────────────────────────────────────────────────────────────────
// LocalStorage serialisation / deserialisation
// ──────────────────────────────────────────────────────────────────────────────

function serialize(map: Map<string, Float32Array[]>): string {
  const obj: Record<string, number[][]> = {};
  for (const [k, vecs] of map) obj[k] = vecs.map(v => Array.from(v));
  return JSON.stringify(obj);
}

function deserialize(json: string): Map<string, Float32Array[]> | null {
  try {
    const obj = JSON.parse(json) as Record<string, number[][]>;
    const map = new Map<string, Float32Array[]>();
    for (const [k, vecs] of Object.entries(obj)) {
      if (DIGITS.includes(k as Digit)) {
        map.set(k, vecs.map(a => new Float32Array(a)));
      }
    }
    return map.size > 0 ? map : null;
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Singleton (lazy-initialised)
// ──────────────────────────────────────────────────────────────────────────────

let _templates: Map<string, Float32Array[]> | null = null;

/**
 * Returns the active template map.
 * Priority: calibrated (localStorage) → Canvas-rendered defaults.
 */
export function getTemplates(): Map<string, Float32Array[]> {
  if (_templates) return _templates;

  // Attempt to load cached templates
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const loaded = deserialize(raw);
      if (loaded) {
        _templates = loaded;
        console.debug('[Vision] Loaded calibrated templates from localStorage');
        return _templates;
      }
    }
  } catch { /* localStorage unavailable */ }

  // Fall back to Canvas-rendered templates
  _templates = buildDefaultTemplates();
  console.debug('[Vision] Using Canvas-rendered bootstrap templates');
  return _templates;
}

// ──────────────────────────────────────────────────────────────────────────────
// Calibration API
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Adds a calibrated zone density vector for a digit.
 * Calibrated templates are stored first and take priority over defaults.
 * Persists to localStorage for future sessions.
 *
 * Call this after confirming correct extraction from a real game screenshot.
 */
export function addCalibratedTemplate(digit: Digit, vec: Float32Array): void {
  const map      = getTemplates();
  const existing = map.get(digit) ?? [];
  // Keep at most 3 variants; newest first
  map.set(digit, [vec, ...existing].slice(0, 3));

  try {
    localStorage.setItem(LS_KEY, serialize(map));
  } catch { /* ignore if storage is full */ }
}

/**
 * Wipes all calibrated templates and reverts to Canvas-rendered defaults.
 * Useful if calibration produced bad vectors.
 */
export function resetToDefaultTemplates(): void {
  _templates = buildDefaultTemplates();
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
  console.debug('[Vision] Templates reset to defaults');
}
