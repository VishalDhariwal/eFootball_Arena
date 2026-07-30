import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/supabase";

export const useRounds = (tournamentId: string) => {
  return useQuery({
    queryKey: ["rounds", tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rounds")
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("order_index", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!tournamentId,
  });
};

export const useMatches = (tournamentId: string) => {
  return useQuery({
    queryKey: ["matches", tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*, player1:player1_id(*), player2:player2_id(*), match_submissions(*), match_detailed_stats(*), brackets!brackets_match_id_fkey(position, next_match_id)")
        .eq("tournament_id", tournamentId)
        .order("scheduled_time", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!tournamentId,
  });
};

export const useMatch = (matchId: string) => {
  return useQuery({
    queryKey: ["match", matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*, player1:player1_id(*), player2:player2_id(*), tournament:tournament_id(*)")
        .eq("id", matchId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!matchId,
  });
};

export const useUploadScreenshot = () => {
  return useMutation({
    mutationFn: async ({ file, matchId, userId }: { file: File; matchId: string; userId: string }) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${matchId}/${userId}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('match_screenshots')
        .upload(fileName, file);

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from('match_screenshots')
        .getPublicUrl(fileName);

      return publicUrlData.publicUrl;
    }
  });
};

export const useSubmitScore = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (submission: { match_id: string, player_id: string, score_reported: string, screenshot_path: string, detailed_stats?: any[] }) => {
      const { data, error } = await supabase
        .from("match_submissions")
        .insert({
          match_id: submission.match_id,
          player_id: submission.player_id,
          score_reported: submission.score_reported,
          screenshot_path: submission.screenshot_path
        })
        .select()
        .single();

      if (error) throw error;

      // Insert detailed stats if provided
      if (submission.detailed_stats && submission.detailed_stats.length > 0) {
        // Detailed stats are now handled via RPC for strict backend validation
        await Promise.all(submission.detailed_stats.map(stats =>
          supabase.rpc("rpc_upsert_detailed_stats", {
            p_match_id: stats.match_id,
            p_player_id: stats.player_id,
            p_goals_scored: stats.goals_scored,
            p_goals_conceded: stats.goals_conceded,
            p_possession: stats.possession,
            p_shots: stats.shots,
            p_shots_on_target: stats.shots_on_target,
            p_passes: stats.passes,
            p_pass_accuracy: stats.pass_accuracy,
            p_interceptions: stats.interceptions,
            p_tackles: stats.tackles,
            p_saves: stats.saves,
            p_fouls: stats.fouls,
            p_yellow_cards: stats.yellow_cards,
            p_red_cards: stats.red_cards
          })
        ));
      }

      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      queryClient.invalidateQueries({ queryKey: ["match", variables.match_id] });
      queryClient.invalidateQueries({ queryKey: ["player_matches"] });
    },
  });
};

export const usePlayerMatches = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["player_matches", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("matches")
        .select("*, player1:player1_id(*), player2:player2_id(*), tournament:tournament_id(*), round:round_id(*)")
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
        .in("status", ["scheduled", "live", "waiting_submission", "disputed"])
        .order("scheduled_time", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
};

export const useDisputedMatches = (tournamentId: string) => {
  return useQuery({
    queryKey: ["disputed_matches", tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*, player1:player1_id(*), player2:player2_id(*), round:round_id(*)")
        .eq("tournament_id", tournamentId)
        .eq("status", "disputed")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const matchIds = data.map(m => m.id);
        const { data: submissions } = await supabase
          .from("match_submissions")
          .select("*")
          .in("match_id", matchIds);

        return data.map(match => ({
          ...match,
          submissions: submissions?.filter(s => s.match_id === match.id) || []
        }));
      }

      return [];
    },
    enabled: !!tournamentId,
  });
};

export const useResolveDispute = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ matchId, winnerId }: { matchId: string; winnerId: string }) => {
      const { error } = await supabase.rpc("resolve_dispute", {
        p_match_id: matchId,
        p_winner_id: winnerId
      });

      if (error) throw error;
      return true;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      queryClient.invalidateQueries({ queryKey: ["disputed_matches"] });
      queryClient.invalidateQueries({ queryKey: ["match", variables.matchId] });
    },
  });
};

export const usePlayerStats = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["player_stats", userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from("matches")
        .select("id, status, winner_id, scheduled_time, player1_id, player2_id, player1:player1_id(display_name), player2:player2_id(display_name), tournament:tournament_id(name)")
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
        .in("status", ["verified", "completed"])
        .order("scheduled_time", { ascending: false });

      if (error) throw error;

      const matchesPlayed = data.length;
      const wins = data.filter(m => m.winner_id === userId).length;
      const winRate = matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0;

      return {
        matchesPlayed,
        wins,
        winRate,
        history: data
      };
    },
    enabled: !!userId,
  });
};

export const useTournamentStats = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["tournament_stats", userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from("tournament_stats")
        .select("*, tournament:tournament_id(name)")
        .eq("user_id", userId);

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
};

export const useTournamentLeaderboard = (tournamentId: string | undefined) => {
  return useQuery({
    queryKey: ["tournament_leaderboard", tournamentId],
    queryFn: async () => {
      if (!tournamentId) return null;

      const { data, error } = await supabase
        .from("tournament_stats")
        .select("*")
        .eq("tournament_id", tournamentId);

      if (error) throw error;
      return data;
    },
    enabled: !!tournamentId,
  });
};

export const useUpdateMatchSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ matchId, scheduledTime, deadline }: { matchId: string, scheduledTime: string, deadline: string }) => {
      const { data, error } = await supabase.rpc("rpc_update_match_schedule", {
        p_match_id: matchId,
        p_scheduled_time: scheduledTime,
        p_deadline: deadline
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["matches", variables.matchId] }); // Usually would pass tournamentId but invalidate all matches or specific match works
      // Best to invalidate everything match related to be safe
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      queryClient.invalidateQueries({ queryKey: ["match"] });
      queryClient.invalidateQueries({ queryKey: ["tournament_leaderboard"] });
    },
  });
};

export const useForceResolveMatch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ matchId, submissionId }: { matchId: string, submissionId: string }) => {
      const { data, error } = await supabase.rpc('force_resolve_match', {
        p_match_id: matchId,
        p_submission_id: submissionId
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      queryClient.invalidateQueries({ queryKey: ["match"] });
      queryClient.invalidateQueries({ queryKey: ["tournament_leaderboard"] });
    },
  });
};
