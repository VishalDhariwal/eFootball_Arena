/**
 * validator.ts — eFootball match statistics business rule validation.
 *
 * Each rule returns null on success or a descriptive string on failure.
 * The validateStats function collects all failures and returns them as a list.
 */

import type { RawStats } from './types';

export interface ValidationResult {
  valid:  boolean;
  issues: string[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Rule definitions
// ──────────────────────────────────────────────────────────────────────────────

type Rule = (s: RawStats) => string | null; // null = pass

const RULES: Rule[] = [

  // ── Possession must sum to 100 (±1 for rounding) ──────────────────────────
  (s) => {
    const sum = s.possession.left + s.possession.right;
    return Math.abs(sum - 100) <= 1
      ? null
      : `Possession sums to ${sum} (expected 100)`;
  },

  // ── Possession values must be in range [1, 99] ────────────────────────────
  (s) => s.possession.left  >= 1 && s.possession.left  <= 99 ? null
       : `Left possession (${s.possession.left}) is out of range 1–99`,
  (s) => s.possession.right >= 1 && s.possession.right <= 99 ? null
       : `Right possession (${s.possession.right}) is out of range 1–99`,

  // ── Shots on target cannot exceed total shots ─────────────────────────────
  (s) => s.shotsOnTarget.left  <= s.shots.left  ? null
       : `Left shots on target (${s.shotsOnTarget.left}) > shots (${s.shots.left})`,
  (s) => s.shotsOnTarget.right <= s.shots.right ? null
       : `Right shots on target (${s.shotsOnTarget.right}) > shots (${s.shots.right})`,

  // ── Successful passes cannot exceed total passes ──────────────────────────
  (s) => s.successfulPasses.left  <= s.passes.left  ? null
       : `Left successful passes (${s.successfulPasses.left}) > passes (${s.passes.left})`,
  (s) => s.successfulPasses.right <= s.passes.right ? null
       : `Right successful passes (${s.successfulPasses.right}) > passes (${s.passes.right})`,

  // ── No negative values ────────────────────────────────────────────────────
  ...(Object.keys({
    score: 0, possession: 0, shots: 0, shotsOnTarget: 0,
    fouls: 0, offsides: 0, cornerKicks: 0, freeKicks: 0,
    passes: 0, successfulPasses: 0, crosses: 0,
    interceptions: 0, tackles: 0, saves: 0,
  } as Record<keyof RawStats, number>) as Array<keyof RawStats>).flatMap(
    (key): Rule[] => [
      (s) => s[key].left  >= 0 ? null : `${key}.left is negative (${s[key].left})`,
      (s) => s[key].right >= 0 ? null : `${key}.right is negative (${s[key].right})`,
    ]
  ),

  // ── Sanity bounds ─────────────────────────────────────────────────────────
  (s) => s.shots.left  < 80 ? null : `Left total shots (${s.shots.left}) is unrealistically high`,
  (s) => s.shots.right < 80 ? null : `Right total shots (${s.shots.right}) is unrealistically high`,

  (s) => s.passes.left  < 1500 ? null : `Left passes (${s.passes.left}) is unrealistically high`,
  (s) => s.passes.right < 1500 ? null : `Right passes (${s.passes.right}) is unrealistically high`,

  (s) => s.score.left  < 30 ? null : `Left score (${s.score.left}) is unrealistically high`,
  (s) => s.score.right < 30 ? null : `Right score (${s.score.right}) is unrealistically high`,
];

// ──────────────────────────────────────────────────────────────────────────────
// Validator
// ──────────────────────────────────────────────────────────────────────────────

export function validateStats(stats: RawStats): ValidationResult {
  const issues: string[] = [];
  for (const rule of RULES) {
    const issue = rule(stats);
    if (issue) issues.push(issue);
  }
  return { valid: issues.length === 0, issues };
}
