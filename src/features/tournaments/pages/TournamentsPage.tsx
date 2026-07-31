import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trophy, Users, Search, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTournaments } from "@/features/tournaments/hooks/useTournaments";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useRegistrations } from "@/features/tournaments/hooks/useRegistrations";

const statusConfig: Record<string, { label: string; className: string }> = {
  live: { label: 'Live', className: 'bg-green-500/10 text-green-500 border border-green-500/20' },
  upcoming: { label: 'Upcoming', className: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
  completed: { label: 'Completed', className: 'bg-muted text-muted-foreground border border-border' },
};

const TournamentsPage = () => {
  const navigate = useNavigate();
  const { data: tournaments, isLoading } = useTournaments();
  const { user } = useAuth();
  const { data: userRegistrations } = useRegistrations(user?.id);
  const [searchQuery, setSearchQuery] = useState("");
  const [sizeFilter, setSizeFilter] = useState("all");

  const filteredTournaments = tournaments?.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSize = sizeFilter === "all" || t.max_players?.toString() === sizeFilter;
    return matchesSearch && matchesSize;
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tournaments</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Find and join active eFootball tournaments</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <select
              value={sizeFilter}
              onChange={(e) => setSizeFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-muted-foreground"
            >
              <option value="all">Any Size</option>
              <option value="2">2 Players</option>
              <option value="4">4 Players</option>
              <option value="8">8 Players</option>
              <option value="16">16 Players</option>
              <option value="32">32 Players</option>
              {/* <option value="64">64 Players</option> */}
            </select>
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-card border-border text-sm"
              />
            </div>
          </div>
        </motion.div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-sm">Loading tournaments...</p>
            </div>
          </div>
        ) : filteredTournaments?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-2">
            <Trophy className="w-10 h-10 opacity-20" />
            <p className="text-sm">No tournaments found</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="divide-y divide-border">
              {filteredTournaments?.map((tournament, index) => {
                const status = statusConfig[tournament.status] ?? statusConfig.completed;
                const playerCount = tournament.registrations?.filter((r: any) => r.registration_status !== 'rejected').length || 0;
                return (
                  <motion.div
                    key={tournament.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: index * 0.04 }}
                    className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/tournaments/${tournament.id}`)}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-muted border border-border flex items-center justify-center shrink-0">
                        <Trophy className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{tournament.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Users className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {playerCount} / {tournament.max_players || '∞'} players
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md hidden sm:inline-flex ${status.className}`}>
                        {status.label}
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TournamentsPage;
