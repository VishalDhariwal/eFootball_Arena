import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/services/supabase";

// Aggregated detailed stats per player across all their matches
export const usePlayerDetailedStats = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["player-detailed-stats", userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from("match_detailed_stats")
        .select("*")
        .eq("player_id", userId);

      if (error) throw error;
      if (!data || data.length === 0) return null;

      // Aggregate across all matches
      const totals = data.reduce(
        (acc, row) => ({
          matches: acc.matches + 1,
          goals: acc.goals + (row.goals_scored || 0),
          goals_conceded: acc.goals_conceded + (row.goals_conceded || 0),
          total_possession: acc.total_possession + (row.possession || 0),
          shots: acc.shots + (row.shots || 0),
          shots_on_target: acc.shots_on_target + (row.shots_on_target || 0),
          passes: acc.passes + (row.passes || 0),
          passes_completed: acc.passes_completed + Math.round(((row.pass_accuracy || 0) * (row.passes || 0)) / 100),
          tackles: acc.tackles + (row.tackles || 0),
          fouls: acc.fouls + (row.fouls || 0),
          interceptions: acc.interceptions + (row.interceptions || 0),
          saves: acc.saves + (row.saves || 0),
          corners: acc.corners + (row.corners || 0),
        }),
        {
          matches: 0,
          goals: 0,
          goals_conceded: 0,
          total_possession: 0,
          shots: 0,
          shots_on_target: 0,
          passes: 0,
          passes_completed: 0,
          tackles: 0,
          fouls: 0,
          interceptions: 0,
          saves: 0,
          corners: 0,
        }
      );

      const n = totals.matches || 1;

      return {
        matchesWithDetailedStats: totals.matches,
        totalGoals: totals.goals,
        totalGoalsConceded: totals.goals_conceded,
        avgPossession: Math.round(totals.total_possession / n),
        totalShots: totals.shots,
        totalShotsOnTarget: totals.shots_on_target,
        shotAccuracy: totals.shots > 0 ? Math.round((totals.shots_on_target / totals.shots) * 100) : 0,
        totalPasses: totals.passes,
        totalPassesCompleted: totals.passes_completed,
        passAccuracy: totals.passes > 0 ? Math.round((totals.passes_completed / totals.passes) * 100) : 0,
        totalTackles: totals.tackles,
        totalFouls: totals.fouls,
        totalInterceptions: totals.interceptions,
        totalSaves: totals.saves,
        totalCorners: totals.corners,
      };
    },
    enabled: !!userId,
  });
};

// Match-level detailed stats (recent matches with full breakdown)
export const useRecentDetailedStats = (userId: string | undefined, limit = 10) => {
  return useQuery({
    queryKey: ["recent-detailed-stats", userId, limit],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("match_detailed_stats")
        .select(`
          *,
          match:match_id(
            id, status, winner_id, player1_id, player2_id,
            tournament:tournament_id(name),
            player1:player1_id(display_name),
            player2:player2_id(display_name)
          )
        `)
        .eq("player_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });
};
