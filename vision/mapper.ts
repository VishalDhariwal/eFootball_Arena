/**
 * mapper.ts — maps internal RawStats to ExtractedMatchStats (gemini.ts type).
 *
 * The ExtractedMatchStats type is used by the rest of the application
 * (TournamentBracket.tsx etc.) and must not change.
 */

import type { ExtractedMatchStats } from '@/lib/gemini';
import type { RawStats } from './types';

export function rawToExtractedMatchStats(raw: RawStats): ExtractedMatchStats {
  return {
    player1Stats: {
      goals:            raw.score.left,
      possession:       raw.possession.left,
      shots:            raw.shots.left,
      shots_on_target:  raw.shotsOnTarget.left,
      fouls:            raw.fouls.left,
      offsides:         raw.offsides.left,
      corners:          raw.cornerKicks.left,
      free_kicks:       raw.freeKicks.left,
      passes:           raw.passes.left,
      passes_completed: raw.successfulPasses.left,
      crosses:          raw.crosses.left,
      interceptions:    raw.interceptions.left,
      tackles:          raw.tackles.left,
      saves:            raw.saves.left,
    },
    player2Stats: {
      goals:            raw.score.right,
      possession:       raw.possession.right,
      shots:            raw.shots.right,
      shots_on_target:  raw.shotsOnTarget.right,
      fouls:            raw.fouls.right,
      offsides:         raw.offsides.right,
      corners:          raw.cornerKicks.right,
      free_kicks:       raw.freeKicks.right,
      passes:           raw.passes.right,
      passes_completed: raw.successfulPasses.right,
      crosses:          raw.crosses.right,
      interceptions:    raw.interceptions.right,
      tackles:          raw.tackles.right,
      saves:            raw.saves.right,
    },
  };
}
