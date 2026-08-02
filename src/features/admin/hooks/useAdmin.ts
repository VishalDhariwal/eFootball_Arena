import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/services/supabase";

export const useAdminStats = () => {
  return useQuery({
    queryKey: ["admin_stats"],
    queryFn: async () => {
      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: 'exact', head: true });

      const { count: pendingUsers } = await supabase
        .from("profiles")
        .select("*", { count: 'exact', head: true })
        .eq("status", "pending");
        
      const { count: totalTournaments } = await supabase
        .from("tournaments")
        .select("*", { count: 'exact', head: true });
        
      const { count: totalMatches } = await supabase
        .from("matches")
        .select("*", { count: 'exact', head: true })
        .in("status", ["verified", "completed"]);

      const { count: pendingJoinRequests } = await supabase
        .from("registrations")
        .select("*", { count: 'exact', head: true })
        .eq("registration_status", "pending")
        .not("payment_screenshot_url", "is", null);

      const { count: pendingRefundRequests } = await supabase
        .from("registrations")
        .select("*", { count: 'exact', head: true })
        .eq("refund_status", "pending");

      const { count: approvedRegistrations } = await supabase
        .from("registrations")
        .select("*", { count: 'exact', head: true })
        .eq("registration_status", "approved");

      const { count: totalRegistrations } = await supabase
        .from("registrations")
        .select("*", { count: 'exact', head: true });

      return {
        totalUsers: totalUsers || 0,
        pendingUsers: pendingUsers || 0,
        totalTournaments: totalTournaments || 0,
        totalMatches: totalMatches || 0,
        pendingJoinRequests: pendingJoinRequests || 0,
        pendingRefundRequests: pendingRefundRequests || 0,
        approvedRegistrations: approvedRegistrations || 0,
        totalRegistrations: totalRegistrations || 0,
      };
    },
  });
};

export const useAllTournaments = () => {
  return useQuery({
    queryKey: ["admin_all_tournaments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("*, organizer:organizer_id(display_name)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
};

export const useGlobalDisputes = () => {
  return useQuery({
    queryKey: ["admin_global_disputes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*, player1:player1_id(*), player2:player2_id(*), round:round_id(*), tournament:tournament_id(*)")
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
  });
};
