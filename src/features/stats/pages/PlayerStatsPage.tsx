import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import {
  BarChart3, Target, Shield, Zap, Crosshair, Flag,
  TrendingUp, Activity, Star
} from "lucide-react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { usePlayerDetailedStats } from "@/features/stats/hooks/usePlayerDetailedStats";
import { usePlayerStats } from "@/features/matches/hooks/useMatches";
import { useProfile } from "@/features/auth/hooks/useProfile";

const StatCard = ({ label, value, sub, icon: Icon, color = "primary", delay = 0 }: {
  label: string;
  value: string | number;
  sub?: string;
  icon: any;
  color?: string;
  delay?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
  >
    <Card className="p-5 bg-gradient-card border-border hover:border-primary/30 transition-all group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
          <p className="text-3xl font-display font-bold">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={`p-3 rounded-xl bg-${color}/10 group-hover:bg-${color}/20 transition-colors`}>
          <Icon className={`w-6 h-6 text-${color}`} />
        </div>
      </div>
    </Card>
  </motion.div>
);

const ProgressBar = ({ label, value, max, color = "#3b82f6" }: { label: string; value: number; max: number; color?: string }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-bold">{value}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
    </div>
  );
};

const AccuracyRing = ({ label, value }: { label: string; value: number }) => {
  const r = 40;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
          <motion.circle
            cx="50" cy="50" r={r}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-display font-bold">{value}%</span>
        </div>
      </div>
      <span className="text-sm text-muted-foreground text-center">{label}</span>
    </div>
  );
};

const PlayerStatsPage = () => {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const { data: matchStats } = usePlayerStats(user?.id);
  const { data: detailed } = usePlayerDetailedStats(user?.id);

  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-5">
          <div className="flex items-center gap-3 mb-1.5">
            <div className="p-2 bg-primary/10 rounded-xl">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-3xl font-display font-bold">My Stats</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-1">
            {profile?.display_name} • <span className="font-mono text-primary">{profile?.player_id}</span>
          </p>
        </motion.div>

        {/* ELO + Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <StatCard label="Arena Rating (AR)" value={profile?.elo_rating || 1000} icon={Star} color="primary" delay={0} />
          <StatCard label="Matches Played" value={matchStats?.matchesPlayed || 0} icon={Activity} delay={0.05} />
          <StatCard label="Wins" value={matchStats?.wins || 0} icon={TrendingUp} color="success" delay={0.1} />
          <StatCard label="Win Rate" value={`${matchStats?.winRate || 0}%`} icon={Zap} color="secondary" delay={0.15} />
        </div>

        {/* Goals */}
        <div className="grid md:grid-cols-2 gap-3 mb-5">
          <StatCard label="Goals Scored" value={detailed ? detailed.totalGoals : (profile?.total_goals_scored || 0)} sub="across all matches" icon={Target} color="primary" delay={0.2} />
          <StatCard label="Goals Conceded" value={detailed ? detailed.totalGoalsConceded : (profile?.total_goals_conceded || 0)} sub="across all matches" icon={Shield} color="destructive" delay={0.25} />
        </div>

        {!detailed ? (
          <Card className="p-10 text-center bg-card border-border">
            <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="text-xl font-display font-bold mb-2">No Detailed Stats Yet</h3>
            <p className="text-muted-foreground">Submit match results with screenshots to track advanced statistics like possession, shots, and more.</p>
          </Card>
        ) : (
          <>
            {/* Accuracy Rings */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="p-5 bg-gradient-card border-border mb-5">
                <h2 className="text-base font-display font-bold mb-5 flex items-center gap-2">
                  <Crosshair className="w-4 h-4 text-primary" /> Accuracy Overview
                </h2>
                <div className="flex justify-around flex-wrap gap-4">
                  <AccuracyRing label="Avg Possession" value={detailed.avgPossession} />
                  <AccuracyRing label="Shot Accuracy" value={detailed.shotAccuracy} />
                  <AccuracyRing label="Pass Accuracy" value={detailed.passAccuracy} />
                </div>
              </Card>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
};

export default PlayerStatsPage;
