import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Trophy, ArrowLeft, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTournaments } from "@/features/tournaments/hooks/useTournaments";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useRegistrations } from "@/features/tournaments/hooks/useRegistrations";

const TournamentsPage = () => {
  const navigate = useNavigate();
  const { data: tournaments, isLoading } = useTournaments();
  const { user } = useAuth();
  const { data: userRegistrations } = useRegistrations(user?.id);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTournaments = tournaments?.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 p-4 rounded-full">
                <Trophy className="w-12 h-12 text-primary" />
              </div>
              <div>
                <h1 className="text-4xl font-display font-bold">Live Tournaments</h1>
                {/* <p className="text-muted-foreground mt-1 text-sm md:text-base">Find and join active eFootball tournaments</p> */}
              </div>
            </div>
            <div className="w-full md:w-64">
              <Input
                type="text"
                placeholder="Search tournaments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-card border-border"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading tournaments...</div>
          ) : filteredTournaments?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No tournaments found.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredTournaments?.map((tournament, index) => (
                <motion.div
                  key={tournament.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card
                    className="p-6 bg-gradient-card border-border hover:border-primary/50 transition-all group cursor-pointer h-full flex flex-col"
                    onClick={() => navigate(`/tournaments/${tournament.id}`)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <span
                          className={`text-xs px-3 py-1 rounded-full capitalize ${tournament.status === "live"
                              ? "bg-success/20 text-success"
                              : tournament.status === "upcoming"
                                ? "bg-secondary/20 text-secondary"
                                : "bg-muted text-muted-foreground"
                            }`}
                        >
                          {tournament.status}
                        </span>
                      </div>
                      <Trophy className="w-6 h-6 text-primary group-hover:scale-110 transition-transform" />
                    </div>

                    <h3 className="text-xl font-display font-bold mb-4 group-hover:text-primary transition-colors line-clamp-2">
                      {tournament.name}
                    </h3>

                    <div className="space-y-2 mb-6 flex-grow">
                      <div className="flex items-center gap-2 text-muted-foreground mb-4">
                        <Users className="w-4 h-4" />
                        <span>{tournament.registrations?.[0]?.count || 0} / {tournament.max_players || '∞'} Players</span>
                      </div>
                    </div>

                    <Button variant="default" className="w-full mt-auto">
                      View Details
                    </Button>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default TournamentsPage;
