import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Trophy, Target, Shield, Users, BarChart3 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useTournament } from "@/features/tournaments/hooks/useTournaments";
import { useTournamentTeamStats } from "@/features/tournaments/hooks/useRegistrations";
import { useAuth } from "@/features/auth/hooks/useAuth";

const rankColors = [
  { bg: 'from-yellow-500/20 to-yellow-500/5', border: 'border-yellow-500/40', text: 'text-yellow-400', badge: 'bg-yellow-500' },
  { bg: 'from-gray-400/20 to-gray-400/5', border: 'border-gray-400/40', text: 'text-gray-300', badge: 'bg-gray-400' },
  { bg: 'from-amber-600/20 to-amber-600/5', border: 'border-amber-600/40', text: 'text-amber-500', badge: 'bg-amber-600' },
];

const TournamentStatsPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const { data: tournament, isLoading: isTLoading } = useTournament(id || "");
  const { data: stats, isLoading: isStatsLoading } = useTournamentTeamStats(id || "");

  if (isTLoading || isStatsLoading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading tournament stats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="container mx-auto px-4 py-8">
        {/* Back */}
        <Button variant="ghost" className="mb-6" onClick={() => navigate('/my-tournaments')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to My Tournaments
        </Button>

        {/* Tournament Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Tournament Records</p>
              <h1 className="text-3xl font-display font-bold">{tournament?.name}</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-primary/15 text-primary capitalize">
              {tournament?.status}
            </span>
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-secondary/15 text-secondary capitalize">
              {tournament?.format?.replace('_', ' ')}
            </span>
          </div>
        </motion.div>

        {/* No stats */}
        {!stats || stats.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card className="p-12 text-center bg-card border-border">
              <BarChart3 className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-30" />
              <h3 className="text-2xl font-display font-bold mb-2">No Match Stats Yet</h3>
              <p className="text-muted-foreground">Match results need to be played and verified to populate this table.</p>
            </Card>
          </motion.div>
        ) : (
          <>
            {/* Top 3 Podium */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              {stats.slice(0, 3).map((team, i) => {
                const isCurrentUser = team.user_id === user?.id;
                const rc = rankColors[i] || rankColors[2];
                return (
                  <motion.div
                    key={team.user_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <Card className={`p-4 bg-gradient-to-b ${rc.bg} border ${rc.border} text-center relative overflow-hidden ${i === 0 ? 'scale-105' : ''}`}>
                      {/* Rank badge */}
                      <div className={`w-8 h-8 rounded-full ${rc.badge} flex items-center justify-center mx-auto mb-3 font-bold text-sm text-black`}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                      </div>
                      <p className={`text-sm font-bold truncate ${isCurrentUser ? 'text-primary' : 'text-white'}`}>
                        {team.user?.display_name || 'Unknown'}
                        {isCurrentUser && ' (You)'}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div>
                          <p className={`text-xl font-display font-bold ${rc.text}`}>{team.points}</p>
                          <p className="text-xs text-muted-foreground">PTS</p>
                        </div>
                        <div>
                          <p className="text-xl font-display font-bold">{team.wins}</p>
                          <p className="text-xs text-muted-foreground">W</p>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {/* Full Records Table — styled like image 2 */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="overflow-hidden bg-card border-border shadow-elevated">
                {/* Table Header */}
                <div className="bg-gradient-to-r from-primary/10 to-secondary/10 border-b border-border px-4 py-3 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-display font-bold uppercase tracking-wide">Team Records Table</h2>
                </div>

                {/* Column Headers */}
                <div className="grid grid-cols-8 gap-2 px-4 py-2.5 border-b border-border/50 text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  <div className="col-span-1 text-center">Rank</div>
                  <div className="col-span-3">Team</div>
                  <div className="text-center">Games</div>
                  <div className="text-center">Wins</div>
                  <div className="text-center">Losses</div>
                  <div className="text-center font-bold text-primary">Points</div>
                </div>

                {/* Rows */}
                <div className="divide-y divide-border/30">
                  {stats.map((team, idx) => {
                    const isCurrentUser = team.user_id === user?.id;
                    return (
                      <motion.div
                        key={team.user_id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + idx * 0.05 }}
                        className={`grid grid-cols-8 gap-2 px-4 py-3.5 items-center transition-colors ${
                          isCurrentUser ? 'bg-primary/8 border-l-2 border-l-primary' : 'hover:bg-white/2'
                        } ${idx === 0 ? 'bg-yellow-500/5' : ''}`}
                      >
                        {/* Rank */}
                        <div className="col-span-1 text-center">
                          {idx === 0 ? (
                            <span className="text-xl">🥇</span>
                          ) : idx === 1 ? (
                            <span className="text-xl">🥈</span>
                          ) : idx === 2 ? (
                            <span className="text-xl">🥉</span>
                          ) : (
                            <span className={`text-lg font-display font-bold ${isCurrentUser ? 'text-primary' : 'text-muted-foreground'}`}>
                              #{team.rank}
                            </span>
                          )}
                        </div>

                        {/* Team name */}
                        <div className="col-span-3">
                          <p className={`font-semibold truncate ${isCurrentUser ? 'text-primary' : 'text-white'}`}>
                            {team.user?.display_name || 'Unknown'}
                            {isCurrentUser && <span className="ml-1 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">You</span>}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Target className="w-3 h-3" /> {team.goals_scored}G
                            </span>
                            <span className="flex items-center gap-1">
                              <Shield className="w-3 h-3" /> {team.goals_conceded}GA
                            </span>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="text-center">
                          <span className="text-lg font-display font-bold">{team.matches_played}</span>
                          <p className="text-xs text-muted-foreground">Games</p>
                        </div>
                        <div className="text-center">
                          <span className="text-lg font-display font-bold text-green-400">{team.wins}</span>
                          <p className="text-xs text-muted-foreground">Wins</p>
                        </div>
                        <div className="text-center">
                          <span className="text-lg font-display font-bold text-red-400">{team.losses}</span>
                          <p className="text-xs text-muted-foreground">Losses</p>
                        </div>
                        <div className="text-center">
                          <span className="text-2xl font-display font-bold text-primary">{team.points}</span>
                          <p className="text-xs text-muted-foreground">Points</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-border bg-muted/5 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {stats.length} players</span>
                  <span>Win = 3pts • Loss = 0pts</span>
                </div>
              </Card>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
};

export default TournamentStatsPage;
