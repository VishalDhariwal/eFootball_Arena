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
      const { data, error } = await supabase
        .from("vw_global_leaderboard")
        .select("*")
        .order("arena_rating", { ascending: false })
        .limit(100);

      if (error) throw error;
      
      if (!data || data.length === 0) return [];
      
      const playerIds = data.map(p => p.player_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, avatar_id")
        .in("id", playerIds);
        
      return data.map(player => {
        const profile = profiles?.find(p => p.id === player.player_id);
        return {
          ...player,
          avatar_id: profile?.avatar_id
        };
      });
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
