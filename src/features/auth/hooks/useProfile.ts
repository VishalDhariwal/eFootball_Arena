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
        .upsert({ id: userId, ...updates })
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
      return data;
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
