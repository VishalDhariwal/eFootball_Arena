import { motion } from "framer-motion";
import { Trophy, Star, Shield, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useLatestChampion, useAvatars } from "@/features/auth/hooks/useProfile";
import { User } from "lucide-react";

export function ChampionHeroCard() {
  const { data: champion, isLoading } = useLatestChampion();
  const { data: avatars } = useAvatars();
  const navigate = useNavigate();

  if (isLoading || !champion) return null;

  // We assume champion.profile exists because it's a join.
  const profile = Array.isArray(champion.profile) ? champion.profile[0] : champion.profile;
  const displayName = profile?.display_name || "Unknown Player";
  const avatarId = profile?.avatar_id;
  const avatarUrl = avatars?.find(a => a.id === avatarId)?.image_url;

  // Win rate calculation
  const totalMatches = champion.matches_played || 0;
  const wins = champion.total_wins || 0;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-12 relative group"
    >
      {/* Background Glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 via-amber-500/20 to-yellow-500/20 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity" />
      
      <div className="relative bg-gradient-to-br from-gray-900 via-gray-900 to-amber-950 border border-yellow-500/30 rounded-2xl p-1 shadow-2xl overflow-hidden">
        
        {/* Shimmer Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-500/10 to-transparent -translate-x-full animate-[shimmer_3s_infinite]" />

        <div className="bg-gray-950/50 rounded-xl p-6 sm:p-8 backdrop-blur-sm border border-yellow-500/10">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-500/20 p-2 rounded-lg border border-yellow-500/30">
                <Trophy className="w-5 h-5 text-yellow-500" />
              </div>
              <h2 className="text-xl font-display font-bold text-yellow-500 tracking-wide uppercase">
                Previous Season Champion
              </h2>
            </div>
            <Button 
              variant="outline" 
              onClick={() => navigate('/hall-of-champions')}
              className="hidden sm:flex border-yellow-500/30 hover:bg-yellow-500/10 text-yellow-500"
            >
              View Hall of Champions
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row gap-8 items-center sm:items-stretch">
            {/* Avatar Section */}
            <div className="shrink-0 relative">
              <div className="absolute inset-0 bg-yellow-500/20 rounded-full blur-md" />
              <div className="relative w-32 h-32 rounded-full border-4 border-yellow-500/50 flex items-center justify-center overflow-hidden bg-muted">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-16 h-16 text-muted-foreground" />
                )}
              </div>
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-yellow-950 font-bold px-3 py-1 rounded-full text-sm flex items-center gap-1 shadow-lg whitespace-nowrap">
                <span>👑</span> Champion
              </div>
            </div>

            {/* Content Section */}
            <div className="flex-1 text-center sm:text-left flex flex-col justify-center">
              <h3 className="text-4xl font-display font-bold text-white mb-2 flex items-center justify-center sm:justify-start gap-3">
                {displayName}
              </h3>
              <p className="text-yellow-500/80 font-medium mb-6">
                Season Champion • {champion.season_name}
              </p>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-black/40 rounded-lg p-3 border border-white/5 flex flex-col items-center sm:items-start">
                  <div className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Star className="w-3 h-3 text-primary" /> Rating
                  </div>
                  <div className="text-2xl font-bold text-white">{champion.final_ar}</div>
                </div>
                
                <div className="bg-black/40 rounded-lg p-3 border border-white/5 flex flex-col items-center sm:items-start">
                  <div className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-green-500" /> Wins
                  </div>
                  <div className="text-2xl font-bold text-white">{wins}</div>
                </div>

                <div className="bg-black/40 rounded-lg p-3 border border-white/5 flex flex-col items-center sm:items-start">
                  <div className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-blue-500" /> Matches
                  </div>
                  <div className="text-2xl font-bold text-white">{totalMatches}</div>
                </div>

                <div className="bg-black/40 rounded-lg p-3 border border-white/5 flex flex-col items-center sm:items-start">
                  <div className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Target className="w-3 h-3 text-red-500" /> Win Rate
                  </div>
                  <div className="text-2xl font-bold text-white">{winRate}%</div>
                </div>
              </div>

              <Button 
                variant="outline" 
                onClick={() => navigate('/hall-of-champions')}
                className="w-full mt-6 sm:hidden border-yellow-500/30 hover:bg-yellow-500/10 text-yellow-500"
              >
                View Hall of Champions
              </Button>
            </div>
          </div>

        </div>
      </div>
    </motion.div>
  );
}
