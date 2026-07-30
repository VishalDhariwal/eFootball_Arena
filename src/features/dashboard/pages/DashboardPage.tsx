import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Trophy, Target, FileText, User, Clock, Star, 
  Swords, Calendar, History, Shield, Play 
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useProfile } from "@/features/auth/hooks/useProfile";
import { usePlayerMatches, usePlayerStats } from "@/features/matches/hooks/useMatches";
import { useUserTournaments } from "@/features/tournaments/hooks/useRegistrations";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile, isLoading: isProfileLoading } = useProfile(user?.id);
  const { data: matches, isLoading: isMatchesLoading } = usePlayerMatches(user?.id);
  const { data: statsData, isLoading: isStatsLoading } = usePlayerStats(user?.id);
  const { data: tournaments, isLoading: isTournamentsLoading } = useUserTournaments(user?.id);

  // Upcoming matches logic
  const upcomingMatches = matches?.filter(m => ['scheduled', 'live', 'waiting_submission', 'disputed'].includes(m.status)) || [];

  // Recent activity logic
  const recentActivity = statsData?.history?.slice(0, 5) || [];
  
  // Tournament summary logic
  const activeTournaments = tournaments?.filter(t => t.tournament?.status !== 'completed').slice(0, 3) || [];

  if (isProfileLoading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
        <p className="text-muted-foreground font-medium animate-pulse">Loading Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero pb-20">
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
        
        {/* 1. Welcome Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
             <User className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-white leading-tight">
              {profile?.display_name || "Player"}
            </h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
              <span className="font-mono bg-white/5 px-2 py-0.5 rounded text-xs tracking-widest uppercase">ID: {profile?.player_id || "N/A"}</span>
              <span className="flex items-center gap-1 text-primary font-medium">
                <Star className="w-3.5 h-3.5" /> AR {profile?.elo_rating || 1000}
              </span>
            </div>
          </div>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          <div className="md:col-span-2 space-y-8">
            
            {/* 2. Upcoming Matches Section */}
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-display font-bold text-white">Upcoming Matches</h3>
              </div>
              
              {upcomingMatches.length > 0 ? (
                <div className="flex flex-col overflow-y-auto gap-4 pr-2 max-h-[500px] hide-scrollbar">
                  {upcomingMatches.map(match => {
                    const opponent = user?.id === match.player1_id ? (match.player2 as any)?.display_name : (match.player1 as any)?.display_name;
                    return (
                      <Card key={match.id} className="p-8 bg-gradient-card border-border overflow-hidden relative group shrink-0">
                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative z-10 flex flex-col h-full justify-between gap-6">
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <span className="bg-primary/20 text-primary text-[10px] px-2.5 py-1 rounded font-bold uppercase tracking-widest">
                                Match
                              </span>
                              <span className="text-sm text-muted-foreground truncate max-w-[200px]" title={(match as any).tournament?.name}>
                                {(match as any).tournament?.name} · {(match as any).round?.name}
                              </span>
                            </div>
                            <h2 className="text-3xl font-display font-bold mb-2 text-white">
                              vs {opponent || "TBD"}
                            </h2>
                            {(match.deadline || match.scheduled_time) && (
                              <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
                                <Clock className="w-4 h-4" />
                                Due: {new Intl.DateTimeFormat('default', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(match.deadline || match.scheduled_time))}
                              </div>
                            )}
                          </div>
                          <Button 
                            size="lg" 
                            className="w-full shadow-glow-primary shrink-0 text-base mt-auto"
                            onClick={() => navigate(`/tournaments/${(match as any).tournament?.id}?tab=matches`)}
                          >
                            <Swords className="w-4 h-4 mr-2" />
                            View Match
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="p-8 bg-gradient-card border-border overflow-hidden relative">
                  <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
                    <div>
                      <h2 className="text-2xl font-display font-bold mb-2 text-white">No Upcoming Matches</h2>
                      <p className="text-muted-foreground">Ready for your next challenge? Join a tournament to start playing.</p>
                    </div>
                    <Button size="lg" className="w-full md:w-auto shadow-glow-primary shrink-0" onClick={() => navigate("/tournaments")}>
                      <Trophy className="w-4 h-4 mr-2" />
                      Find Tournament
                    </Button>
                  </div>
                </Card>
              )}
            </motion.div>

            {/* 3. Tournament Summary */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-display font-bold text-white">Active Tournaments</h3>
                {activeTournaments.length > 0 && (
                  <Button variant="link" className="text-primary p-0 h-auto font-medium" onClick={() => navigate("/my-tournaments")}>
                    View All
                  </Button>
                )}
              </div>
              
              {!activeTournaments.length ? (
                <Card className="p-8 bg-card/50 border-border border-dashed text-center">
                  <Trophy className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-20" />
                  <p className="text-muted-foreground text-sm">You are not participating in any active tournaments.</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {activeTournaments.map(t => (
                    <Card key={t.id} className="p-4 bg-card border-border hover:border-primary/40 transition-colors flex items-center justify-between cursor-pointer group" onClick={() => navigate(`/tournaments/${t.tournament?.id}`)}>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded bg-primary/10 flex items-center justify-center shrink-0">
                          <Trophy className="w-5 h-5 text-primary opacity-80" />
                        </div>
                        <div>
                          <p className="font-bold text-base text-white group-hover:text-primary transition-colors">{t.tournament?.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 capitalize flex items-center gap-1.5">
                            <span className={t.registration_status === 'approved' ? 'text-green-400' : 'text-yellow-400'}>
                              {t.registration_status}
                            </span>
                            <span>·</span>
                            {t.tournament?.status}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground group-hover:text-white">
                        <Play className="w-4 h-4" />
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </motion.div>

          </div>

          <div className="space-y-8">
            


            {/* 5. Player Stats */}
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
              <Card className="p-6 bg-card border-border">
                <h3 className="text-xs font-bold text-muted-foreground mb-5 uppercase tracking-widest">Career Stats</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-end border-b border-border/50 pb-3">
                    <span className="text-sm text-muted-foreground">Arena Rating</span>
                    <span className="text-xl font-display font-bold text-primary">{profile?.elo_rating || 1000}</span>
                  </div>
                  <div className="flex justify-between items-end border-b border-border/50 pb-3">
                    <span className="text-sm text-muted-foreground">Matches Played</span>
                    <span className="text-xl font-display font-bold text-white">{statsData?.matchesPlayed || 0}</span>
                  </div>
                  <div className="flex justify-between items-end border-b border-border/50 pb-3">
                    <span className="text-sm text-muted-foreground">Wins</span>
                    <span className="text-xl font-display font-bold text-white">{statsData?.wins || 0}</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-sm text-muted-foreground">Win Rate</span>
                    <span className="text-xl font-display font-bold text-white">{statsData?.winRate || "0"}%</span>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* 4. Recent Activity */}
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}>
              <Card className="p-6 bg-card border-border">
                <h3 className="text-xs font-bold text-muted-foreground mb-5 uppercase tracking-widest">Recent Activity</h3>
                {!recentActivity.length ? (
                  <div className="text-center py-6">
                    <p className="text-xs text-muted-foreground">No recent activity.</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {recentActivity.map((match: any, index: number) => {
                      const isWinner = match.winner_id === user?.id;
                      const opponentName = user?.id === match.player1_id
                        ? match.player2?.display_name
                        : match.player1?.display_name;

                      return (
                        <div key={match.id} className="flex gap-4 relative">
                          {index !== recentActivity.length - 1 && (
                            <div className="absolute left-1.5 top-6 bottom-[-20px] w-px bg-border" />
                          )}
                          <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 z-10 ${isWinner ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`} />
                          <div>
                            <p className="text-sm font-bold text-white">
                              {isWinner ? 'Match Won' : 'Match Lost'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              vs {opponentName || "Unknown"} · {(match as any).tournament?.name || "Tournament"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </motion.div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
