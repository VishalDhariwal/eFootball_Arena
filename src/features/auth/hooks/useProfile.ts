import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/supabase";

export const useProfile = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      if (!userId) throw new Error("No user ID");
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: any }) => {
      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["profile", variables.userId] });
    },
  });
};

export const useLeaderboard = () => {
  return useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      // Bypass vw_global_leaderboard to ensure we dynamically count matches
      // and include players who played matches but didn't submit detailed stats.
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, display_name, player_id, elo_rating, avatar_id")
        .order("elo_rating", { ascending: false });

      if (error) throw error;
      if (!profiles || profiles.length === 0) return [];

      const { data: matches } = await supabase
        .from("matches")
        .select("player1_id, player2_id, winner_id")
        .in("status", ["verified", "completed"]);

      const { data: archives } = await supabase
        .from("season_archives")
        .select("player_id, season_name")
        .eq("global_rank", 1);

      const leaderboard = profiles.map(p => {
        const pMatches = matches?.filter(m => m.player1_id === p.id || m.player2_id === p.id) || [];
        const wins = pMatches.filter(m => m.winner_id === p.id).length;

        return {
          player_id: p.id,
          display_name: p.display_name,
          unique_player_id: p.player_id,
          arena_rating: p.elo_rating,
          total_matches: pMatches.length,
          total_wins: wins,
          is_previous_champion: archives?.some(a => a.player_id === p.id) || false,
          champion_season: archives?.find(a => a.player_id === p.id)?.season_name || null,
          avatar_id: p.avatar_id
        };
      })
        .filter(p => p.total_matches >= 1) // Must have played at least 1 match
        .sort((a, b) => b.arena_rating - a.arena_rating)
        .slice(0, 100);

      return leaderboard;
    },
  });
};

export const useUserAchievements = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["achievements", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("user_achievements")
        .select("*, achievement:achievement_id(*)")
        .eq("user_id", userId)
        .order("unlocked_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
};

export const useAvatars = () => {
  return useQuery({
    queryKey: ["avatars"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_avatars")
        .select("*")
        .order("created_at", { ascending: true });

      // If the table doesn't exist yet, return empty array gracefully
      if (error) return [];
      return data ?? [];
    },
  });
};

export const useLatestChampion = () => {
  return useQuery({
    queryKey: ["latest-champion"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("season_archives")
        .select("*, profile:profiles(display_name, avatar_id)")
        .eq("global_rank", 1)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== "PGRST116") throw error; // Ignore not found
      return data || null;
    }
  });
};

export const useHallOfChampions = () => {
  return useQuery({
    queryKey: ["hall-of-champions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("season_archives")
        .select("*, profile:profiles(display_name, avatar_id)")
        .eq("global_rank", 1)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });
};

export const useUserChampionSeasons = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["champion-seasons", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("season_archives")
        .select("*")
        .eq("player_id", userId)
        .eq("global_rank", 1)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });
};

