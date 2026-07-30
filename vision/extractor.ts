/**
 * extractor.ts — main orchestration pipeline for eFootball stats extraction.
 *
 * Flow:
 *   File
 *    → loadImage
 *    → for each of 28 regions: cropRegion → recognizeRegion → StatPair
 *    → validateStats
 *    → ExtractionResult (with confidence + manual-review flag)
 *
 * The public entry point is `extractStats(file)`.
 * For compatibility with TournamentBracket.tsx, use `extractStatsAsMatchStats(file)`
 * which returns ExtractedMatchStats directly.
 */

import { REGIONS, STAT_KEYS }   from './region-config';
import { loadImage, cropRegion } from './image-processor';
import { recognizeRegion }       from './digit-recognizer';
import { validateStats }         from './validator';
import { rawToExtractedMatchStats } from './mapper';
import type { RawStats, StatPair }  from './types';
import type { ExtractedMatchStats } from '@/lib/gemini';

// ──────────────────────────────────────────────────────────────────────────────
// Result type
// ──────────────────────────────────────────────────────────────────────────────

export interface ExtractionResult extends RawStats {
  /** Average confidence across all 28 recognised regions (0–1) */
  confidence: number;
  /** True if confidence < threshold OR any validation rule fails */
  needs_manual_review: boolean;
  /** Human-readable list of failed validation rules */
  validation_issues: string[];
  /** Per-region confidence scores (key = region name, e.g. "shots_left") */
  region_confidences: Record<string, number>;
}

// ──────────────────────────────────────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────────────────────────────────────

/** Below this overall confidence the result is flagged for manual review. */
const CONFIDENCE_THRESHOLD = 0.65;

// ──────────────────────────────────────────────────────────────────────────────
// Main pipeline
// ──────────────────────────────────────────────────────────────────────────────

export async function extractStats(file: File | Blob): Promise<ExtractionResult> {
  // 1. Load image into HTMLImageElement
  const img = await loadImage(file);

  const raw: Partial<RawStats>        = {};
  const regionConf: Record<string, number> = {};
  let totalConf  = 0;
  let regionCnt  = 0;

  // 2. Process each stat: crop left + right region, recognise, build StatPair
  for (const statKey of STAT_KEYS) {
    const lKey = `${statKey}_left`;
    const rKey = `${statKey}_right`;

    let leftConf  = 0;
    let rightConf = 0;
    let leftVal   = 0;
    let rightVal  = 0;

    const lRegion = REGIONS[lKey];
    const rRegion = REGIONS[rKey];

    if (lRegion) {
      const imageData = cropRegion(img, lRegion);
      const result    = recognizeRegion(imageData);
      leftVal  = result.value;
      leftConf = result.confidence;
      console.debug(`[Vision] ${lKey}: "${result.rawText}" → ${result.value} (conf ${leftConf.toFixed(2)})`);
    }

    if (rRegion) {
      const imageData = cropRegion(img, rRegion);
      const result    = recognizeRegion(imageData);
      rightVal  = result.value;
      rightConf = result.confidence;
      console.debug(`[Vision] ${rKey}: "${result.rawText}" → ${result.value} (conf ${rightConf.toFixed(2)})`);
    }

    (raw as RawStats)[statKey] = { left: leftVal, right: rightVal } satisfies StatPair;
    regionConf[lKey] = leftConf;
    regionConf[rKey] = rightConf;
    totalConf  += leftConf + rightConf;
    regionCnt  += 2;
  }

  const finalRaw = raw as RawStats;

  // 3. Overall confidence
  const overallConf = regionCnt > 0 ? totalConf / regionCnt : 0;

  // 4. Validate extracted values
  const { valid, issues } = validateStats(finalRaw);

  // 5. Manual review flag
  const needsReview = overallConf < CONFIDENCE_THRESHOLD || !valid;

  if (needsReview) {
    console.warn('[Vision] Manual review required. Confidence:', overallConf.toFixed(2), '| Issues:', issues);
  }

  return {
    ...finalRaw,
    confidence:          overallConf,
    needs_manual_review: needsReview,
    validation_issues:   issues,
    region_confidences:  regionConf,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Compatibility shim for TournamentBracket.tsx
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Extracts stats and maps to ExtractedMatchStats.
 * Keeps the same interface expected by TournamentBracket.tsx.
 */
export async function extractStatsAsMatchStats(file: File | Blob): Promise<ExtractedMatchStats> {
  const result = await extractStats(file);
  return rawToExtractedMatchStats(result);
}
