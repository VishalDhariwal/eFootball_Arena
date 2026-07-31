import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Trophy, Play, Eye, Users, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/services/supabase";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const useAllAdminTournaments = () => useQuery({
  queryKey: ['admin-all-tournaments'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('tournaments')
      .select(`
        *,
        organizer:organizer_id(display_name),
        registrations(count)
      `)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
});

const statusConfig: Record<string, { label: string; color: string }> = {
  upcoming: { label: 'Upcoming', color: 'bg-blue-500/15 text-blue-400' },
  registration: { label: 'Registration', color: 'bg-primary/15 text-primary' },
  live: { label: 'Live', color: 'bg-green-500/15 text-green-400' },
  completed: { label: 'Completed', color: 'bg-muted text-muted-foreground' },
};

const AdminTournamentsPage = () => {
  const navigate = useNavigate();
  const { data: tournaments, isLoading } = useAllAdminTournaments();

  const counts = {
    live: tournaments?.filter(t => t.status === 'live').length || 0,
    upcoming: tournaments?.filter(t => t.status === 'upcoming' || t.status === 'registration').length || 0,
    completed: tournaments?.filter(t => t.status === 'completed').length || 0,
  };

  const [filter, setFilter] = useState<'active' | 'completed'>('active');

  const filteredTournaments = tournaments?.filter(t => {
    if (filter === 'active') return t.status !== 'completed';
    if (filter === 'completed') return t.status === 'completed';
    return true;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary/10 rounded-xl">
                <Trophy className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <h1 className="text-4xl font-display font-bold">All Tournaments</h1>
                <p className="text-muted-foreground">Platform-wide tournament management</p>
              </div>
            </div>
            <Button onClick={() => navigate('/organizer/tournaments/new')} className="shadow-glow-primary">
              <Trophy className="w-4 h-4 mr-2" /> Create Tournament
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Live Tournaments', value: counts.live, icon: Play, color: 'text-green-400' },
            { label: 'Upcoming / Open', value: counts.upcoming, icon: Trophy, color: 'text-primary' },
            { label: 'Completed', value: counts.completed, icon: BarChart3, color: 'text-muted-foreground' },
          ].map(item => (
            <Card key={item.label} className="p-4 bg-gradient-card border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-3xl font-display font-bold mt-1">{item.value}</p>
                </div>
                <item.icon className={`w-8 h-8 ${item.color} opacity-60`} />
              </div>
            </Card>
          ))}
        </div>

        {/* Tournaments table */}
        <Card className="overflow-hidden bg-card border-border shadow-elevated">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" /> All Platform Tournaments
            </CardTitle>
            <div className="flex gap-2 bg-muted/50 p-1 rounded-lg border border-border">
              <Button 
                variant={filter === 'active' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => setFilter('active')}
                className={filter === 'active' ? 'shadow-sm' : ''}
              >
                Active
              </Button>
              <Button 
                variant={filter === 'completed' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => setFilter('completed')}
                className={filter === 'completed' ? 'shadow-sm' : ''}
              >
                Completed
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading tournaments...</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tournament</TableHead>
                      <TableHead>Organizer</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Players</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTournaments?.map((t) => {
                      const sc = statusConfig[t.status] || { label: t.status, color: 'bg-muted text-muted-foreground' };
                      return (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium text-white">{t.name}</TableCell>
                          <TableCell className="text-muted-foreground">{(t.organizer as any)?.display_name || 'Unknown'}</TableCell>
                          <TableCell className="text-muted-foreground capitalize">{t.format?.replace('_', ' ')}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 text-muted-foreground" />
                              <span>{(t.registrations as any)?.[0]?.count || 0} / {t.max_players || '∞'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                              {sc.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/tournaments/${t.id}`)}
                              >
                                <Eye className="w-3.5 h-3.5 mr-1" /> View
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-primary/50 text-primary hover:bg-primary hover:text-white"
                                onClick={() => navigate(`/organizer/tournaments/${t.id}`)}
                              >
                                <Play className="w-3.5 h-3.5 mr-1" /> Manage
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default AdminTournamentsPage;
