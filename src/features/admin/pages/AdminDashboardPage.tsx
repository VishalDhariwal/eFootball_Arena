import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Users, Trophy, Target, AlertTriangle, ShieldAlert, Clock, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAdminStats, useGlobalDisputes } from "@/features/admin/hooks/useAdmin";
import { useResolveDispute } from "@/features/matches/hooks/useMatches";
import { toast } from "sonner";

export const AdminDashboardPage = () => {
  const navigate = useNavigate();
  const { data: stats, isLoading: isStatsLoading } = useAdminStats();
  const { data: disputes, isLoading: isDisputesLoading } = useGlobalDisputes();
  const resolveDispute = useResolveDispute();

  const handleResolveDispute = (matchId: string, winnerId: string) => {
    resolveDispute.mutate({ matchId, winnerId }, {
      onSuccess: () => toast.success("Dispute resolved! Bracket updated."),
      onError: (err: any) => toast.error("Failed to resolve dispute: " + err.message)
    });
  };

  const summaryCards = [
    {
      label: "Total Users",
      value: stats?.totalUsers,
      icon: Users,
      color: "text-primary",
      bg: "bg-primary/10",
      action: () => navigate('/admin/users'),
    },
    {
      label: "Pending Join Requests",
      value: stats?.pendingJoinRequests,
      icon: Clock,
      color: "text-yellow-400",
      bg: "bg-yellow-500/10",
      urgent: (stats?.pendingJoinRequests || 0) > 0,
      action: () => navigate('/admin/tournaments'),
    },
    {
      label: "Pending Refund Requests",
      value: stats?.pendingRefundRequests,
      icon: Clock,
      color: "text-orange-400",
      bg: "bg-orange-500/10",
      urgent: (stats?.pendingRefundRequests || 0) > 0,
      action: () => navigate('/admin/finances'),
    },
    {
      label: "Approved Registrations",
      value: stats?.approvedRegistrations,
      icon: Users,
      color: "text-green-400",
      bg: "bg-green-500/10",
      action: () => navigate('/admin/tournaments'),
    },
    {
      label: "Total Registrations",
      value: stats?.totalRegistrations,
      icon: Target,
      color: "text-primary",
      bg: "bg-primary/10",
      action: () => navigate('/admin/tournaments'),
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8">
          <h1 className="text-4xl font-display font-bold text-primary">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Platform-wide overview and management</p>
        </div>

        {/* Summary Stats */}
        <div className="grid md:grid-cols-4 gap-5 mb-8">
          {summaryCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <Card
                className={`p-5 bg-gradient-card border-border transition-all cursor-pointer hover:border-primary/40 ${card.urgent ? 'border-yellow-500/40 shadow-[0_0_15px_rgba(234,179,8,0.1)]' : ''}`}
                onClick={card.action}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{card.label}</p>
                    <p className={`text-4xl font-display font-bold ${card.urgent ? 'text-yellow-400' : ''}`}>
                      {isStatsLoading ? "-" : card.value}
                    </p>
                    {card.urgent && (
                      <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Action required
                      </p>
                    )}
                  </div>
                  <div className={`p-3 rounded-xl ${card.bg}`}>
                    <card.icon className={`w-6 h-6 ${card.color}`} />
                  </div>
                </div>
                {card.action && (
                  <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground hover:text-primary transition-colors">
                    <span>View details</span>
                    <ChevronRight className="w-3 h-3" />
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <Card
            className="p-5 bg-gradient-card border-border hover:border-primary/40 transition-all cursor-pointer group"
            onClick={() => navigate('/admin/users')}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-500/10 rounded-xl">
                <Users className="w-6 h-6 text-yellow-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-white group-hover:text-primary transition-colors">Manage Users</h3>
                <p className="text-sm text-muted-foreground">Approve or reject player access requests</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </Card>

          <Card
            className="p-5 bg-gradient-card border-border hover:border-secondary/40 transition-all cursor-pointer group"
            onClick={() => navigate('/admin/tournaments')}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-secondary/10 rounded-xl">
                <Trophy className="w-6 h-6 text-secondary" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-white group-hover:text-secondary transition-colors">Manage Tournaments</h3>
                <p className="text-sm text-muted-foreground">View and manage all platform tournaments</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-secondary transition-colors" />
            </div>
          </Card>
        </div>

        {/* Global Dispute Queue */}
        {disputes && disputes.length > 0 && (
          <Card className="bg-destructive/10 border-destructive shadow-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="w-5 h-5" />
                Global Dispute Queue ({disputes.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {disputes.map((match) => (
                  <div key={match.id} className="bg-card border border-border p-4 rounded-lg">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-lg">{(match.tournament as any)?.name}</h3>
                        <p className="text-sm text-muted-foreground">Round: {(match.round as any)?.name} | Match ID: {match.id}</p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <p className="font-semibold text-primary">{(match.player1 as any)?.display_name || 'TBD'}</p>
                        {match.submissions?.find((s: any) => s.player_id === match.player1_id) ? (
                          <div className="bg-primary/5 p-3 rounded">
                            <p className="text-sm">Score: <strong>{match.submissions.find((s: any) => s.player_id === match.player1_id).score_reported}</strong></p>
                            <a href={match.submissions.find((s: any) => s.player_id === match.player1_id).screenshot_path} target="_blank" rel="noreferrer" className="text-xs text-primary underline">View Screenshot</a>
                          </div>
                        ) : <p className="text-sm text-muted-foreground">No submission</p>}
                        <Button size="sm" onClick={() => handleResolveDispute(match.id, match.player1_id)} disabled={resolveDispute.isPending || !match.player1_id} className="w-full">
                          Declare {(match.player1 as any)?.display_name || 'Player 1'} Winner
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <p className="font-semibold text-secondary">{(match.player2 as any)?.display_name || 'TBD'}</p>
                        {match.submissions?.find((s: any) => s.player_id === match.player2_id) ? (
                          <div className="bg-secondary/5 p-3 rounded">
                            <p className="text-sm">Score: <strong>{match.submissions.find((s: any) => s.player_id === match.player2_id).score_reported}</strong></p>
                            <a href={match.submissions.find((s: any) => s.player_id === match.player2_id).screenshot_path} target="_blank" rel="noreferrer" className="text-xs text-secondary underline">View Screenshot</a>
                          </div>
                        ) : <p className="text-sm text-muted-foreground">No submission</p>}
                        <Button size="sm" variant="secondary" onClick={() => handleResolveDispute(match.id, match.player2_id)} disabled={resolveDispute.isPending || !match.player2_id} className="w-full">
                          Declare {(match.player2 as any)?.display_name || 'Player 2'} Winner
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  );
};

export default AdminDashboardPage;
