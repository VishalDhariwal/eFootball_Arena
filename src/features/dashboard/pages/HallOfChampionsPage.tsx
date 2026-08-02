import { motion } from "framer-motion";
import { Trophy, Star, Shield, Target, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useHallOfChampions, useAvatars } from "@/features/auth/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";

export const HallOfChampionsPage = () => {
  const { data: champions, isLoading } = useHallOfChampions();
  const { data: avatars } = useAvatars();
  const navigate = useNavigate();

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="text-center mb-16 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-yellow-500/10 blur-[100px] rounded-full pointer-events-none" />
        
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="inline-block bg-gradient-to-br from-yellow-500/20 to-amber-500/5 p-4 rounded-full mb-6 border border-yellow-500/30">
          <Trophy className="w-16 h-16 text-yellow-500" />
        </motion.div>
        
        <h1 className="text-5xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-yellow-200 to-amber-500 mb-4">
          Hall of Champions
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Immortalizing the greatest players in Football Arena history. 
          Winning a season etches your name here permanently.
        </p>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Loading Champions...</div>
      ) : champions?.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 bg-black/20 rounded-xl border border-white/5">
          <Trophy className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p>No champions have been crowned yet.</p>
        </div>
      ) : (
        <div className="space-y-12">
          
          {/* Featured Cards for recent champions */}
          <div className="grid md:grid-cols-2 gap-6">
            {champions?.slice(0, 2).map((champion, i) => {
              const profile = Array.isArray(champion.profile) ? champion.profile[0] : champion.profile;
              const displayName = profile?.display_name || "Unknown Player";
              const avatarId = profile?.avatar_id;
              const avatarUrl = avatars?.find(a => a.id === avatarId)?.image_url;
              const winRate = champion.matches_played ? Math.round((champion.total_wins / champion.matches_played) * 100) : 0;

              return (
                <motion.div 
                  key={champion.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="relative group cursor-pointer"
                  onClick={() => navigate(`/profile/${champion.player_id}`)}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-50 transition-opacity" />
                  
                  <div className="relative bg-gradient-to-br from-gray-900 to-black border border-yellow-500/30 hover:border-yellow-500/50 transition-colors rounded-2xl p-6 shadow-2xl">
                    <div className="flex items-center gap-6 mb-6">
                      <div className="relative">
                        <div className="w-20 h-20 rounded-full border-2 border-yellow-500/50 flex items-center justify-center overflow-hidden bg-muted">
                          {avatarUrl ? (
                            <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-10 h-10 text-muted-foreground" />
                          )}
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-yellow-950 p-1 rounded-full shadow-lg">
                          <Trophy className="w-4 h-4" />
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="text-2xl font-display font-bold text-white flex items-center gap-2">
                          <span>👑</span> {displayName}
                        </h3>
                        <p className="text-yellow-500 font-medium">Season Champion • {champion.season_name}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-black/40 rounded-lg p-3 border border-white/5">
                        <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Star className="w-3 h-3 text-primary" /> Rating
                        </div>
                        <div className="text-xl font-bold text-white">{champion.final_ar}</div>
                      </div>
                      <div className="bg-black/40 rounded-lg p-3 border border-white/5">
                        <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Target className="w-3 h-3 text-red-500" /> Win Rate
                        </div>
                        <div className="text-xl font-bold text-white">{winRate}%</div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Table for all champions */}
          {champions && champions.length > 2 && (
            <Card className="bg-card border-border shadow-elevated">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Season</TableHead>
                      <TableHead>Champion</TableHead>
                      <TableHead className="text-right">Final Rating</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {champions.slice(2).map((champion) => {
                      const profile = Array.isArray(champion.profile) ? champion.profile[0] : champion.profile;
                      const displayName = profile?.display_name || "Unknown Player";
                      
                      return (
                        <TableRow 
                          key={champion.id}
                          className="hover:bg-primary/5 cursor-pointer"
                          onClick={() => navigate(`/profile/${champion.player_id}`)}
                        >
                          <TableCell className="font-medium text-muted-foreground">{champion.season_name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 font-bold text-lg">
                              <span>👑</span> {displayName}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-1 bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded font-bold border border-yellow-500/20">
                              <Star className="w-3 h-3" />
                              {champion.final_ar}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

        </div>
      )}
    </div>
  );
};

export default HallOfChampionsPage;
