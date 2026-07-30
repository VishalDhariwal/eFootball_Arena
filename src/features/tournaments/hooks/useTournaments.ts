import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/supabase";

export const useTournaments = () => {
  return useQuery({
    queryKey: ["tournaments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("*, registrations(count)")
        .neq("status", "completed")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
};

export const useTournamentsByOrganizer = (organizerId: string | undefined) => {
  return useQuery({
    queryKey: ["tournaments", "organizer", organizerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("*, registrations(count)")
        .eq("organizer_id", organizerId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!organizerId,
  });
};

export const useTournament = (id: string) => {
  return useQuery({
    queryKey: ["tournament", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
};

export const useCreateTournament = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tournament: any) => {
      const { data, error } = await supabase
        .from("tournaments")
        .insert(tournament)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
    },
  });
};

export const useGenerateBracket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tournamentId, startTime, roundDuration }: { tournamentId: string, startTime: string, roundDuration: number }) => {
      // Workaround: RPC requires status to be 'registration'
      await supabase.rpc("rpc_update_tournament_status", {
        p_tournament_id: tournamentId,
        p_status: "registration"
      });

      const { data, error } = await supabase.rpc('generate_single_elimination_bracket', {
        p_tournament_id: tournamentId,
        p_start_time: startTime,
        p_round_duration_minutes: roundDuration
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tournament", variables.tournamentId] });
      queryClient.invalidateQueries({ queryKey: ["matches", variables.tournamentId] });
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
    },
  });
};

export const useGenerateManualBracket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      tournamentId, 
      startTime, 
      roundDuration,
      players 
    }: { 
      tournamentId: string, 
      startTime: string, 
      roundDuration: number,
      players: (string | null)[] 
    }) => {
      // Workaround: RPC requires status to be 'registration'
      await supabase.rpc("rpc_update_tournament_status", {
        p_tournament_id: tournamentId,
        p_status: "registration"
      });

      const { data, error } = await supabase.rpc('generate_manual_bracket', {
        p_tournament_id: tournamentId,
        p_start_time: startTime,
        p_round_duration_minutes: roundDuration,
        p_players: players
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tournament", variables.tournamentId] });
      queryClient.invalidateQueries({ queryKey: ["matches", variables.tournamentId] });
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
    },
  });
};

export const useRevertTournament = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tournamentId }: { tournamentId: string }) => {
      const { data, error } = await supabase.rpc('revert_tournament', {
        p_tournament_id: tournamentId
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tournament", variables.tournamentId] });
      queryClient.invalidateQueries({ queryKey: ["matches", variables.tournamentId] });
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
    },
  });
};

export const useFinishTournament = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tournamentId }: { tournamentId: string }) => {
      const { data, error } = await supabase.rpc("rpc_update_tournament_status", {
        p_tournament_id: tournamentId,
        p_status: "completed"
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tournament", variables.tournamentId] });
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
    },
  });
};

export const useOrganizerAnalytics = (organizerId: string | undefined) => {
  return useQuery({
    queryKey: ["organizer_analytics", organizerId],
    queryFn: async () => {
      if (!organizerId) return null;
      
      const { data: tournaments, error: tError } = await supabase
        .from("tournaments")
        .select("id")
        .eq("organizer_id", organizerId);
        
      if (tError) throw tError;
      if (!tournaments || tournaments.length === 0) {
        return { totalTournaments: 0, pendingRegistrations: 0, disputedMatches: 0, actionRequiredTournaments: [] };
      }
      
      const tIds = tournaments.map(t => t.id);
      
      const { count: pendingRegistrations } = await supabase
        .from("registrations")
        .select("*", { count: 'exact', head: true })
        .in("tournament_id", tIds)
        .eq("payment_status", "pending");
        
      const { data: disputedMatches, count: disputedCount } = await supabase
        .from("matches")
        .select("tournament_id", { count: 'exact' })
        .in("tournament_id", tIds)
        .eq("status", "disputed");
        
      const actionRequiredTournaments = [...new Set(disputedMatches?.map(m => m.tournament_id) || [])];

      return {
        totalTournaments: tournaments.length,
        pendingRegistrations: pendingRegistrations || 0,
        disputedMatches: disputedCount || 0,
        actionRequiredTournaments
      };
    },
    enabled: !!organizerId,
  });
};
