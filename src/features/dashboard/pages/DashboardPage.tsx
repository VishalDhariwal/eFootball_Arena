import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Trophy, Target, User, Clock, Star,
  Swords, History, Edit2, ChevronRight, Calendar
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useProfile, useAvatars } from "@/features/auth/hooks/useProfile";
import { usePlayerMatches, usePlayerStats } from "@/features/matches/hooks/useMatches";
import { useUserTournaments } from "@/features/tournaments/hooks/useRegistrations";

const fade = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } };

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile, isLoading: isProfileLoading } = useProfile(user?.id);
  const { data: avatars } = useAvatars();
  const { data: matches } = usePlayerMatches(user?.id);
  const { data: statsData } = usePlayerStats(user?.id);
  const { data: tournaments } = useUserTournaments(user?.id);

  const upcomingMatches = matches?.filter(m => ['scheduled', 'live', 'waiting_submission', 'disputed'].includes(m.status)) || [];
  const recentActivity = statsData?.history?.slice(0, 10) || [];

  const activeAvatarUrl = avatars?.find(a => a.id === (profile as any)?.avatar_id)?.image_url;

  const rankLabel = (r: number) => {
    if (r >= 1900) return { label: 'Elite', color: 'text-purple-400' };
    if (r >= 1700) return { label: 'Champion', color: 'text-red-400' };
    if (r >= 1500) return { label: 'Diamond', color: 'text-blue-400' };
    if (r >= 1300) return { label: 'Platinum', color: 'text-cyan-400' };
    if (r >= 1100) return { label: 'Gold', color: 'text-yellow-400' };
    if (r >= 900) return { label: 'Silver', color: 'text-slate-300' };
    return { label: 'Bronze', color: 'text-orange-600' };
  };

  const rating = profile?.elo_rating || 1000;
  const rank = rankLabel(rating);

  if (isProfileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const card = "bg-card border border-border rounded-2xl";

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">

        {/* Player Banner */}
        <motion.div {...fade} transition={{ duration: 0.2 }}>
          <div className={`${card} p-6 flex items-center justify-between gap-4`}>
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-14 h-14 rounded-xl bg-muted border border-border flex items-center justify-center overflow-hidden shrink-0">
                {activeAvatarUrl ? (
                  <img src={activeAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              {/* Info */}
              <div>
                <h1 className="text-lg font-semibold text-foreground">{profile?.display_name || "Player"}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-xs font-semibold ${rank.color}`}>{rank.label}</span>
                  <span className="text-muted-foreground text-xs">·</span>
                  <span className="text-xs text-muted-foreground">{rating} AR</span>
                  <span className="text-muted-foreground text-xs">·</span>
                  <span className="text-xs text-muted-foreground">{profile?.player_id || "—"}</span>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 h-8 text-xs"
              onClick={() => navigate('/profile')}
            >
              <Edit2 className="w-3.5 h-3.5 mr-1.5" />
              Edit Profile
            </Button>
          </div>
        </motion.div>

        {/* KPI Row */}
        <motion.div {...fade} transition={{ duration: 0.2, delay: 0.05 }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Arena Rating', value: rating, icon: Star },
              { label: 'Wins', value: statsData?.wins || 0, icon: Trophy },
              { label: 'Matches', value: statsData?.matchesPlayed || 0, icon: Swords },
              { label: 'Win Rate', value: `${statsData?.winRate || 0}%`, icon: Target },
            ].map((stat, i) => (
              <Card key={i} className={`${card} p-4 flex flex-col gap-3 hover:border-primary/30 transition-colors duration-200`}>
                <stat.icon className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold text-foreground tabular-nums">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                </div>
              </Card>
            ))}
          </div>
        </motion.div>

        {/* Two Column: Upcoming + Recent */}
        <div className="grid lg:grid-cols-2 gap-6">

          {/* Upcoming Matches */}
          <motion.div {...fade} transition={{ duration: 0.2, delay: 0.1 }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Upcoming Matches</h2>
              <span className="text-xs text-muted-foreground">{upcomingMatches.length} pending</span>
            </div>
            <div className={`${card} overflow-hidden`}>
              {upcomingMatches.length > 0 ? (
                <div className="divide-y divide-border overflow-y-auto max-h-[360px] hide-scrollbar">
                  {upcomingMatches.map(match => {
                    const opponentName = user?.id === match.player1_id
                      ? (match.player2 as any)?.display_name
                      : (match.player1 as any)?.display_name;
                    const deadline = match.deadline || match.scheduled_time;
                    return (
                      <div key={match.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                            <Swords className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              vs <span className="text-primary">{opponentName || 'TBD'}</span>
                            </p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {(match as any).tournament?.name || 'Tournament'}
                              {(match as any).round?.name ? ` • ${(match as any).round.name}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-2">
                          {deadline && (
                            <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {new Intl.DateTimeFormat('default', { month: 'short', day: 'numeric' }).format(new Date(deadline))}
                            </div>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => navigate(`/tournaments/${(match as any).tournament?.id}?tab=matches`)}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-[200px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Calendar className="w-8 h-8 opacity-20" />
                  <p className="text-sm">No upcoming matches</p>
                  <Button size="sm" variant="outline" className="mt-1 h-8 text-xs" onClick={() => navigate("/tournaments")}>
                    Browse Tournaments
                  </Button>
                </div>
              )}
            </div>
          </motion.div>

          {/* Recent Matches */}
          <motion.div {...fade} transition={{ duration: 0.2, delay: 0.15 }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Recent Matches</h2>
              <span className="text-xs text-muted-foreground">{recentActivity.length} played</span>
            </div>
            <div className={`${card} overflow-hidden`}>
              {recentActivity.length > 0 ? (
                <div className="divide-y divide-border overflow-y-auto max-h-[360px] hide-scrollbar">
                  {recentActivity.map((match: any) => {
                    const isWinner = match.winner_id === user?.id;
                    const opponentName = user?.id === match.player1_id ? match.player2?.display_name : match.player1?.display_name;
                    const myRatingHistory = (match.rating_history || []).filter((h: any) => h.player_id === user?.id);
                    let ratingChange = myRatingHistory.length > 0
                      ? myRatingHistory.reduce((sum: number, h: any) => sum + h.elo_change, 0)
                      : (isWinner ? 15 : (match.winner_id ? -10 : 0));
                    const isPositive = ratingChange > 0;

                    return (
                      <div key={match.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                            isWinner
                              ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                              : 'bg-red-500/10 text-red-500 border border-red-500/20'
                          }`}>
                            {isWinner ? 'W' : 'L'}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">vs {opponentName || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{match.tournament?.name || 'Tournament'}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className={`text-sm font-semibold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                            {isPositive ? '+' : ''}{ratingChange}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {match.scheduled_time
                              ? new Intl.DateTimeFormat('default', { month: 'short', day: 'numeric' }).format(new Date(match.scheduled_time))
                              : '—'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-[200px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <History className="w-8 h-8 opacity-20" />
                  <p className="text-sm">No matches played yet</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
