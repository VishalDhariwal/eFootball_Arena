/**
 * types.ts — shared data types for the vision pipeline.
 *
 * Kept in a separate file to prevent circular import chains between
 * extractor.ts, validator.ts, and mapper.ts.
 */

export interface StatPair {
  left:  number;
  right: number;
}

export interface RawStats {
  score:            StatPair;
  possession:       StatPair;
  shots:            StatPair;
  shotsOnTarget:    StatPair;
  fouls:            StatPair;
  offsides:         StatPair;
  cornerKicks:      StatPair;
  freeKicks:        StatPair;
  passes:           StatPair;
  successfulPasses: StatPair;
  crosses:          StatPair;
  interceptions:    StatPair;
  tackles:          StatPair;
  saves:            StatPair;
}
