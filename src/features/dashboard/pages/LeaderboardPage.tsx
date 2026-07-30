import { motion } from "framer-motion";
import { Trophy, Medal, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLeaderboard, useAvatars } from "@/features/auth/hooks/useProfile";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { User, Target } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";

export const LeaderboardPage = () => {
  const { data: leaderboard, isLoading } = useLeaderboard();
  const { data: avatars } = useAvatars();
  const { user } = useAuth();
  const myRowRef = useRef<HTMLTableRowElement>(null);

  const scrollToMe = () => {
    if (myRowRef.current) {
      myRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="text-center mb-12">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="inline-block bg-primary/20 p-4 rounded-full mb-4">
          <Trophy className="w-12 h-12 text-primary" />
        </motion.div>
        <h1 className="text-4xl font-display font-bold">Global Leaderboard</h1>
        <p className="text-muted-foreground mt-2">The top eFootball players on the platform</p>
        
        {user && leaderboard?.some(p => p.player_id === user.id) && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={scrollToMe}
            className="mt-6 gap-2 border-primary/20 hover:bg-primary/10 text-primary"
          >
            <Target className="w-4 h-4" /> Find Me
          </Button>
        )}
      </div>

      <Card className="bg-card border-border shadow-elevated">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24 text-center">Rank</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="text-right">Arena Rating</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    Loading rankings...
                  </TableCell>
                </TableRow>
              ) : leaderboard?.map((player, index) => {
                const isMe = player.player_id === user?.id;
                return (
                <TableRow 
                  key={player.player_id} 
                  ref={isMe ? myRowRef : null}
                  className={`transition-colors group ${isMe ? 'bg-primary/20 border-l-2 border-l-primary hover:bg-primary/30' : 'hover:bg-primary/5'}`}
                >
                  <TableCell className="text-center font-display font-bold text-xl">
                    {index === 0 && <span className="text-yellow-500 flex items-center justify-center gap-1">1 <Trophy className="w-4 h-4" /></span>}
                    {index === 1 && <span className="text-gray-300 flex items-center justify-center gap-1">2 <Medal className="w-4 h-4" /></span>}
                    {index === 2 && <span className="text-amber-700 flex items-center justify-center gap-1">3 <Medal className="w-4 h-4" /></span>}
                    {index > 2 && <span className="text-muted-foreground group-hover:text-white transition-colors">{index + 1}</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center overflow-hidden shrink-0">
                        {(() => {
                          const url = avatars?.find(a => a.id === player.avatar_id)?.image_url;
                          return url ? (
                            <img src={url} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-5 h-5 text-muted-foreground" />
                          );
                        })()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg">{player.display_name || "Unknown Player"}</span>
                          {player.is_previous_champion && (
                            <span className="bg-yellow-500/20 text-yellow-500 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-widest border border-yellow-500/30" title={`Champion: ${player.champion_season}`}>
                              Prev Champ
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full font-bold">
                      <Star className="w-4 h-4" />
                      {player.arena_rating || 1000}
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default LeaderboardPage;
