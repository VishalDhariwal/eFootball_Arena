import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/services/supabase";

export interface PlayerAttributeRatings {
  player_id: string;
  shooting_score: number;
  passing_score: number;
  possession_score: number;
  defending_score: number;
  finishing_score: number;
  discipline_score: number;
  overall_rating: number;
  play_style: string;
  rating_confidence: string;
  updated_at: string;
}

export const usePlayerAttributeRatings = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["player-attribute-ratings", userId],
    queryFn: async (): Promise<PlayerAttributeRatings | null> => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from("player_attribute_ratings")
        .select("*")
        .eq("player_id", userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }
      return data;
    },
    enabled: !!userId,
  });
};
