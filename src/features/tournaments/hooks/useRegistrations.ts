import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/supabase";

// All registrations for a tournament (for organizer view)
export const useRegistrations = (tournamentId: string) => {
  return useQuery({
    queryKey: ["registrations", tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registrations")
        .select("*, user:user_id(display_name, player_id, game_id, email, phone_number, is_champion, champion_season)")
        .eq("tournament_id", tournamentId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!tournamentId,
  });
};

// Admin-level registrations query — includes all payment fields across all tournaments
export const useAdminRegistrations = (filter: 'pending' | 'approved' | 'rejected' | 'all' = 'all') => {
  return useQuery({
    queryKey: ["admin-registrations", filter],
    queryFn: async () => {
      let query = supabase
        .from("registrations")
        .select(`
          *,
          user:user_id(display_name, player_id, game_id, email, phone_number, is_champion, champion_season),
          tournament:tournament_id(name, entry_fee, status)
        `)
        .not("payment_screenshot_url", "is", null)
        .order("payment_submitted_at", { ascending: false });

      if (filter !== 'all') {
        query = query.eq("registration_status", filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
};

// Admin-level refund requests query
export const useAdminRefundRequests = (filter: 'pending' | 'approved' | 'rejected' | 'completed' | 'all' = 'all') => {
  return useQuery({
    queryKey: ["admin-refund-requests", filter],
    queryFn: async () => {
      let query = supabase
        .from("registrations")
        .select(`
          *,
          user:user_id(display_name, player_id, game_id, email, phone_number),
          tournament:tournament_id(name, entry_fee, status)
        `)
        .eq("refund_requested", true)
        .order("refund_requested_at", { ascending: false });

      if (filter !== 'all') {
        query = query.eq("refund_status", filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
};

// Admin-level prize claims query
export const useAdminPrizeClaims = (filter: 'requested' | 'paid' | 'all' = 'all') => {
  return useQuery({
    queryKey: ["admin-prize-claims", filter],
    queryFn: async () => {
      let query = supabase
        .from("registrations")
        .select(`
          *,
          user:user_id(display_name, player_id, game_id, email, phone_number),
          tournament:tournament_id(name, prize_first, prize_second)
        `)
        .in("prize_status", ["requested", "paid"])
        .order("prize_requested_at", { ascending: false });

      if (filter !== 'all') {
        query = query.eq("prize_status", filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
};

// User's own registration in a tournament
export const useUserRegistration = (tournamentId: string, userId: string | undefined) => {
  return useQuery({
    queryKey: ["registration", tournamentId, userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("registrations")
        .select("*")
        .eq("tournament_id", tournamentId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!tournamentId && !!userId,
  });
};

// Register for a tournament — status starts as 'pending' (no payment yet)
export const useRegisterForTournament = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tournamentId, userId }: { tournamentId: string; userId: string }) => {
      const { data, error } = await supabase
        .from("registrations")
        .upsert({
          tournament_id: tournamentId,
          user_id: userId,
          registration_status: 'pending',
          payment_status: 'pending',
        }, { onConflict: 'tournament_id,user_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["registrations", variables.tournamentId] });
      queryClient.invalidateQueries({ queryKey: ["registration", variables.tournamentId, variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["my-tournaments", variables.userId] });
    },
  });
};

// Submit payment: upload screenshot to storage, then call RPC to update DB
export const useSubmitPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tournamentId,
      userId,
      file,
      transactionId,
    }: {
      tournamentId: string;
      userId: string;
      file: File;
      transactionId?: string;
    }) => {
      // 1. Upload screenshot to Supabase Storage
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const timestamp = Date.now();
      const storagePath = `${tournamentId}/${userId}/${timestamp}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // 2. Get the public URL
      const { data: urlData } = supabase.storage
        .from("payment-proofs")
        .getPublicUrl(storagePath);

      const screenshotUrl = urlData.publicUrl;

      // 3. Call RPC to update registration row atomically
      const { data, error: rpcError } = await supabase.rpc("rpc_submit_payment", {
        p_tournament_id: tournamentId,
        p_user_id: userId,
        p_screenshot_url: screenshotUrl,
        p_transaction_id: transactionId || null,
      });

      if (rpcError) throw rpcError;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["registration", variables.tournamentId, variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["registrations", variables.tournamentId] });
      queryClient.invalidateQueries({ queryKey: ["my-tournaments", variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["admin-registrations"] });
    },
  });
};

// Update registration status (approve/reject) — used by organizer/admin
export const useUpdateRegistrationStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ registrationId, status }: { registrationId: string; status: string }) => {
      const { data, error } = await supabase.rpc("rpc_update_registration_status", {
        p_registration_id: registrationId,
        p_status: status
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registrations"] });
      queryClient.invalidateQueries({ queryKey: ["admin-registrations"] });
    },
  });
};

// Request a refund (player action)
export const useRequestRefund = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      registrationId,
      upiId,
      phone,
      reason,
    }: {
      registrationId: string;
      upiId?: string;
      phone?: string;
      reason?: string;
    }) => {
      const { data, error } = await supabase.rpc("rpc_request_refund", {
        p_registration_id: registrationId,
        p_upi_id: upiId || null,
        p_phone: phone || null,
        p_reason: reason || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["registration"] });
      queryClient.invalidateQueries({ queryKey: ["admin-registrations"] });
    },
  });
};

// Update refund status (admin action)
export const useUpdateRefundStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ registrationId, status }: { registrationId: string; status: string }) => {
      const { data, error } = await supabase.rpc("rpc_update_refund_status", {
        p_registration_id: registrationId,
        p_status: status,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-registrations"] });
      queryClient.invalidateQueries({ queryKey: ["my-tournaments"] });
    },
  });
};

// Tournaments a user is enrolled in (any registration status)
export const useUserTournaments = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["my-tournaments", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("registrations")
        .select(`
          id,
          registration_status,
          payment_screenshot_url,
          payment_submitted_at,
          transaction_id,
          refund_requested,
          refund_status,
          refund_requested_at,
          refund_processed_at,
          created_at,
          tournament:tournament_id(
            id, name, description, status, format, max_players, start_date, winner_id, entry_fee
          )
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
};

// Team/player stats for a specific tournament (for the records table)
export const useTournamentTeamStats = (tournamentId: string) => {
  return useQuery({
    queryKey: ["tournament-team-stats", tournamentId],
    queryFn: async () => {
      const { data: statsData, error: statsError } = await supabase
        .from("tournament_stats")
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("wins", { ascending: false });

      if (statsError) throw statsError;
      
      if (!statsData || statsData.length === 0) return [];
      
      const userIds = statsData.map(s => s.user_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, display_name, player_id, avatar_url")
        .in("id", userIds);
        
      const data = statsData.map(stat => ({
        ...stat,
        user: profilesData?.find(p => p.id === stat.user_id)
      }));

      // Calculate points: Win = 3, Draw = 1, Loss = 0
      return data?.map((row, idx) => ({
        ...row,
        losses: row.matches_played - row.wins,
        points: row.wins * 3,
        rank: idx + 1,
      })) || [];
    },
    enabled: !!tournamentId,
  });
};

// Request a prize (player action)
export const useRequestPrize = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      registrationId,
      upiId,
      phone,
      type,
    }: {
      registrationId: string;
      upiId?: string;
      phone?: string;
      type: 'winner' | 'runner_up';
    }) => {
      const { data, error } = await supabase.rpc("rpc_request_prize", {
        p_registration_id: registrationId,
        p_upi_id: upiId || null,
        p_phone: phone || null,
        p_type: type,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["registration"] });
      queryClient.invalidateQueries({ queryKey: ["admin-registrations"] });
      queryClient.invalidateQueries({ queryKey: ["registrations"] });
    },
  });
};

// Update prize status (admin action)
export const useUpdatePrizeStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ registrationId, status }: { registrationId: string; status: string }) => {
      const { data, error } = await supabase.rpc("rpc_update_prize_status", {
        p_registration_id: registrationId,
        p_status: status,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-registrations"] });
      queryClient.invalidateQueries({ queryKey: ["registrations"] });
      queryClient.invalidateQueries({ queryKey: ["my-tournaments"] });
    },
  });
};
