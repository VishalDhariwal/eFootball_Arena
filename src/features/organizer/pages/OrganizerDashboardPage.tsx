import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Plus, Settings, Users, AlertTriangle, Trophy, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useTournamentsByOrganizer, useOrganizerAnalytics } from "@/features/tournaments/hooks/useTournaments";

export const OrganizerDashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: tournaments, isLoading } = useTournamentsByOrganizer(user?.id);
  const { data: analytics, isLoading: isAnalyticsLoading } = useOrganizerAnalytics(user?.id);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-display font-bold">Organizer Dashboard</h1>
          <p className="text-muted-foreground">Manage your tournaments</p>
        </div>
        <Button onClick={() => navigate("/organizer/tournaments/new")} className="shadow-glow-primary">
          <Plus className="w-4 h-4 mr-2" />
          Create Tournament
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-gradient-card border-border">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm mb-1">Total Tournaments</p>
              <p className="text-4xl font-display font-bold">
                {isAnalyticsLoading ? "-" : analytics?.totalTournaments || 0}
              </p>
            </div>
            <Trophy className="w-10 h-10 text-primary opacity-50" />
          </CardContent>
        </Card>
        
        <Card className={`bg-gradient-card ${analytics?.disputedMatches ? 'border-destructive/50 shadow-glow-sm border-2' : 'border-border'}`}>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm mb-1">Active Disputes</p>
              <p className={`text-4xl font-display font-bold ${analytics?.disputedMatches ? 'text-destructive' : ''}`}>
                {isAnalyticsLoading ? "-" : analytics?.disputedMatches || 0}
              </p>
            </div>
            <AlertTriangle className={`w-10 h-10 opacity-50 ${analytics?.disputedMatches ? 'text-destructive' : 'text-primary'}`} />
          </CardContent>
        </Card>
      </div>

      <h2 className="text-2xl font-display font-bold mb-4">Your Tournaments</h2>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading tournaments...</div>
      ) : tournaments?.length === 0 ? (
        <Card className="bg-card border-border text-center py-12">
          <CardContent>
            <p className="text-muted-foreground mb-4">You haven't created any tournaments yet.</p>
            <Button onClick={() => navigate("/organizer/tournaments/new")} variant="outline">
              Create your first tournament
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments?.map((tournament) => {
            const hasDisputes = analytics?.actionRequiredTournaments.includes(tournament.id);
            
            return (
              <motion.div
                key={tournament.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className={`bg-card border-border hover:border-primary/50 transition-all ${hasDisputes ? 'border-destructive/50' : ''}`}>
                  <CardHeader>
                    <CardTitle className="text-xl font-display truncate flex justify-between items-center">
                      {tournament.name}
                      {hasDisputes && <AlertTriangle className="w-5 h-5 text-destructive animate-pulse" title="Disputes require attention" />}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mb-4 text-sm text-muted-foreground">
                      <p>Status: <span className="text-foreground capitalize">{tournament.status}</span></p>
                      <p>Format: <span className="text-foreground capitalize">{tournament.format.replace('_', ' ')}</span></p>
                      <p>Players: <span className="text-foreground">{tournament.registrations?.[0]?.count || 0} / {tournament.max_players || '∞'}</span></p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        className="flex-1" 
                        variant={hasDisputes ? "destructive" : "default"}
                        onClick={() => navigate(`/organizer/tournaments/${tournament.id}`)}
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Manage
                      </Button>
                      <Button 
                        className="flex-1" 
                        variant="outline"
                        onClick={() => navigate(`/tournaments/${tournament.id}`)}
                      >
                        <Users className="w-4 h-4 mr-2" />
                        View Public
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OrganizerDashboardPage;
