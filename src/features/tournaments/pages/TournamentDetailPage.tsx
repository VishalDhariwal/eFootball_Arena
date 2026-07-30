import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Trophy, ArrowLeft, Users, User, CheckCircle, Clock, XCircle, Settings,
  Swords, LayoutGrid, ChevronRight, Target, Calendar,
  Shield, FileText, Flag, Star, Medal
} from "lucide-react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useTournament, useFinishTournament } from "@/features/tournaments/hooks/useTournaments";
import { useUserRegistration, useRegisterForTournament, useRegistrations } from "@/features/tournaments/hooks/useRegistrations";
import { useMatches, useTournamentLeaderboard } from "@/features/matches/hooks/useMatches";
import { useAvatars } from "@/features/auth/hooks/useProfile";
import { toast } from "sonner";
import { TournamentBracket } from "@/features/tournaments/components/TournamentBracket";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// ─── Tab types ────────────────────────────────────────────────────────────────
type Tab = 'overview' | 'matches' | 'fixtures' | 'players' | 'leaderboard' | 'rules';

// ─── Leaderboard sub-component (logic unchanged) ─────────────────────────────
const TournamentLeaderboard = ({
  tournamentId,
  registrations
}: {
  tournamentId: string;
  registrations: any[] | undefined;
}) => {
  const { data: stats, isLoading } = useTournamentLeaderboard(tournamentId);
  const { data: avatars } = useAvatars();

  if (isLoading) return <div className="text-center p-8 text-muted-foreground">Loading leaderboard...</div>;

  const approvedRegs = registrations?.filter(r => r.registration_status === 'approved') || [];

  const combinedStats = approvedRegs.map(reg => {
    const userStat = stats?.find(s => s.user_id === reg.user_id);
    return {
      user_id: reg.user_id,
      user: reg.user,
      goals_scored: userStat?.goals_scored || 0,
      goals_conceded: userStat?.goals_conceded || 0,
      wins: userStat?.wins || 0,
      matches_played: userStat?.matches_played || 0,
    };
  });

  const sortedStats = combinedStats.sort((a, b) => {
    const gdA = a.goals_scored - a.goals_conceded;
    const gdB = b.goals_scored - b.goals_conceded;
    if (gdA === gdB) return b.goals_scored - a.goals_scored;
    return gdB - gdA;
  });

  if (sortedStats.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
        <p className="font-medium">No stats yet</p>
        <p className="text-sm mt-1">Stats populate as matches are verified.</p>
      </div>
    );
  }

  return (
    <Card className="bg-card border-border overflow-hidden">
      <Table className="min-w-[500px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 text-center">#</TableHead>
            <TableHead>Player</TableHead>
            <TableHead className="text-center">P</TableHead>
            <TableHead className="text-center">W</TableHead>
            <TableHead className="text-center">GF</TableHead>
            <TableHead className="text-center">GA</TableHead>
            <TableHead className="text-center font-bold">GD</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedStats.map((stat, index) => {
            const gf = stat.goals_scored || 0;
            const ga = stat.goals_conceded || 0;
            const gd = gf - ga;
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;
            return (
              <TableRow key={stat.user_id} className={index === 0 ? 'bg-yellow-500/5' : ''}>
                <TableCell className="text-center font-medium text-muted-foreground">
                  {medal || index + 1}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center overflow-hidden shrink-0">
                      {(() => {
                        const avatarId = (stat.user as any)?.avatar_id;
                        const url = avatars?.find(a => a.id === avatarId)?.image_url;
                        return url ? (
                          <img src={url} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-4 h-4 text-muted-foreground" />
                        );
                      })()}
                    </div>
                    <div>
                      <div className="font-bold text-white">{(stat.user as any)?.display_name || "Unknown"}</div>
                      <div className="text-xs text-muted-foreground font-mono">{(stat.user as any)?.player_id}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center">{stat.matches_played || 0}</TableCell>
                <TableCell className="text-center text-green-400 font-bold">{stat.wins || 0}</TableCell>
                <TableCell className="text-center">{gf}</TableCell>
                <TableCell className="text-center">{ga}</TableCell>
                <TableCell className={`text-center font-bold ${gd > 0 ? 'text-green-400' : gd < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                  {gd > 0 ? `+${gd}` : gd}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
};

// ─── Registration Status Badge (logic unchanged) ──────────────────────────────
const RegBadge = ({ status }: { status: string | undefined }) => {
  if (!status) return null;
  if (status === 'approved') return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-500/15 text-green-400 border border-green-500/30 rounded-full text-sm font-medium">
      <CheckCircle className="w-3.5 h-3.5" /> Enrolled
    </span>
  );
  if (status === 'pending') return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 rounded-full text-sm font-medium">
      <Clock className="w-3.5 h-3.5" /> Pending Approval
    </span>
  );
  if (status === 'rejected') return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-500/15 text-red-400 border border-red-500/30 rounded-full text-sm font-medium">
      <XCircle className="w-3.5 h-3.5" /> Rejected
    </span>
  );
  return null;
};

// ─── Match status label helper ────────────────────────────────────────────────
const matchStatusLabel = (status: string) => {
  const map: Record<string, { label: string; color: string }> = {
    scheduled: { label: 'Scheduled', color: 'text-blue-400 bg-blue-500/10' },
    live: { label: 'Live', color: 'text-green-400 bg-green-500/10' },
    waiting_submission: { label: 'Awaiting Result', color: 'text-yellow-400 bg-yellow-500/10' },
    verified: { label: 'Done', color: 'text-muted-foreground bg-muted/20' },
    disputed: { label: 'Disputed', color: 'text-red-400 bg-red-500/10' },
    walkover: { label: 'Walkover', color: 'text-muted-foreground bg-muted/20' },
  };
  return map[status] || { label: status, color: 'text-muted-foreground bg-muted/20' };
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export const TournamentDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const { data: tournament, isLoading } = useTournament(id || "");
  const { data: registration, refetch: refetchReg } = useUserRegistration(id || "", user?.id);
  const { data: allRegistrations, isLoading: isRegLoading } = useRegistrations(id || "");
  const { data: allMatches } = useMatches(id || "");
  const registerMutation = useRegisterForTournament();

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as Tab) || 'overview';
  const setActiveTab = (tab: Tab) => setSearchParams({ tab });

  const approvedCount = allRegistrations?.filter(r => r.registration_status === 'approved').length || 0;
  const canManage = user?.id === tournament?.organizer_id || isAdmin;
  const regStatus = registration?.registration_status;
  const isApprovedPlayer = regStatus === 'approved';

  // Player's own matches in this tournament
  const myMatches = allMatches?.filter(m =>
    m.player1_id === user?.id || m.player2_id === user?.id
  ) || [];

  // Derive tournament winner: winner of the final verified match
  // The final match in a single elimination bracket is the one with no next_match_id
  const finalMatch = allMatches?.find((m: any) => 
    (m.status === 'verified' || m.status === 'walkover') && 
    m.winner_id && 
    m.brackets?.length > 0 && 
    m.brackets[0].next_match_id === null
  );

  // Resolve winner profile from match data
  const tournamentWinnerProfile = finalMatch
    ? (finalMatch.winner_id === finalMatch.player1_id
        ? (finalMatch.player1 as any)
        : (finalMatch.player2 as any))
    : null;

  // Auto-finish: if a winner exists and tournament is still live, mark it completed
  const finishTournament = useFinishTournament();
  useEffect(() => {
    if (
      tournament &&
      tournament.status === 'live' &&
      tournamentWinnerProfile &&
      !finishTournament.isPending &&
      !finishTournament.isSuccess
    ) {
      finishTournament.mutate({ tournamentId: tournament.id });
    }
  }, [tournament?.id, tournament?.status, tournamentWinnerProfile?.display_name]);

  const handleRegister = () => {
    if (!user) { toast.error("Please login to register"); navigate("/login"); return; }
    registerMutation.mutate({ tournamentId: id!, userId: user.id }, {
      onSuccess: () => { toast.success("Registration request sent! Waiting for organizer approval."); refetchReg(); },
      onError: (err) => toast.error("Failed to register. " + err.message)
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!tournament) {
    return <div className="flex items-center justify-center h-screen bg-background"><p className="text-muted-foreground">Tournament not found</p></div>;
  }

  // isFinished: true the moment we detect a winner — even before DB status propagates.
  // This ensures the UI instantly shows Finished without waiting for the DB round-trip.
  const isFinished = tournament.status === 'completed' || !!tournamentWinnerProfile;

  // ── Tabs configuration ──────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string; icon: React.ElementType; show?: boolean }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'matches', label: 'My Matches', icon: Swords, show: !isFinished && tournament.status === 'live' && (isApprovedPlayer || canManage) },
    { id: 'fixtures', label: 'Fixtures', icon: Trophy, show: tournament.status !== 'upcoming' && tournament.status !== 'registration' },
    { id: 'players', label: 'Players', icon: Users },
    { id: 'leaderboard', label: 'Leaderboard', icon: Target },
    { id: 'rules', label: 'Rules', icon: FileText },
  ].filter(t => t.show !== false);

  // If current active tab got filtered out, fall back to overview
  const activeTabValid = tabs.some(t => t.id === activeTab);

  return (
    <div className="min-h-screen bg-background">
      {/* ── Back button ──────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-background sticky top-0 z-10">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 py-2.5">
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => navigate("/tournaments")}>
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Tournaments
            </Button>
            <span className="text-muted-foreground/40 text-xs">/</span>
            <span className="text-xs font-medium text-foreground truncate">{tournament.name}</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-7xl">

        {/* ── Tournament Header ─────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="mb-6">
          <Card className="bg-card border-border">
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-semibold capitalize border ${
                      isFinished
                        ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                        : tournament.status === 'live'
                          ? 'bg-green-500/10 text-green-500 border-green-500/20'
                          : 'bg-primary/10 text-primary border-primary/20'
                    }`}>
                      {isFinished ? 'Completed' : tournament.status}
                    </span>
                    <span className="px-2 py-0.5 bg-muted border border-border rounded-md text-xs font-medium text-muted-foreground capitalize">
                      {tournament.format?.replace('_', ' ')}
                    </span>
                    {!isFinished && tournament.status === 'live' && (
                      <span className="flex items-center gap-1.5 text-xs text-green-500 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live now
                      </span>
                    )}
                    {tournamentWinnerProfile && (
                      <span className="flex items-center gap-1.5 px-2 py-0.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-md text-xs font-semibold">
                        <Trophy className="w-3 h-3" /> {tournamentWinnerProfile.display_name}
                      </span>
                    )}
                    {registration && !isFinished && <RegBadge status={regStatus} />}
                  </div>

                  <h1 className="text-xl sm:text-2xl font-bold mb-3 leading-tight">{tournament.name}</h1>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      <span className="text-green-500 font-medium">{approvedCount}</span>
                      <span>/ {tournament.max_players || '∞'} players</span>
                    </span>
                    {tournament.start_date && (
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(tournament.start_date).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end sm:shrink-0">
                  {canManage && (
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => navigate(`/organizer/tournaments/${tournament.id}`)}>
                      <Settings className="w-3.5 h-3.5 mr-1.5" /> Manage
                    </Button>
                  )}
                  {!canManage && !registration && user && !isFinished && tournament.status !== 'live' && (
                    <Button size="sm" className="h-8 text-xs" onClick={handleRegister} disabled={registerMutation.isPending}>
                      {registerMutation.isPending ? "Sending..." : "Request to Join"}
                    </Button>
                  )}
                  {!user && !isFinished && (
                    <Button size="sm" className="h-8 text-xs" onClick={() => navigate("/login")}>Login to Join</Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Tab Bar ───────────────────────────────────────────────────── */}
        <div className="mb-6 border-b border-border">
          <div className="flex overflow-x-auto gap-0 -mb-px hide-scrollbar">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id && activeTabValid;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 shrink-0 ${
                    isActive
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Tab Content ───────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >

            {/* ── OVERVIEW ─────────────────────────────────────────────── */}
            {activeTab === 'overview' && (
              <div className="grid md:grid-cols-3 gap-6">
                {/* Main: description */}
                <div className="md:col-span-2 space-y-5">
                  {/* Winner Banner */}
                  {tournamentWinnerProfile && (
                    <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
                        <Trophy className="w-4 h-4 text-yellow-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Champion</p>
                        <p className="text-sm font-bold text-yellow-400 truncate">{tournamentWinnerProfile.display_name}</p>
                        {tournamentWinnerProfile.player_id && (
                          <p className="text-xs text-muted-foreground font-mono">{tournamentWinnerProfile.player_id}</p>
                        )}
                      </div>
                    </div>
                  )}

                  <Card className="bg-card border-border">
                    <CardContent className="p-5">
                      <h2 className="text-base font-bold mb-3 flex items-center gap-2">
                        <Flag className="w-4 h-4 text-primary" /> About
                      </h2>
                      <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed text-sm">
                        {tournament.description || "No description provided."}
                      </p>
                    </CardContent>
                  </Card>

                  {tournament.start_date && (
                    <Card className="bg-card border-border">
                      <CardContent className="p-5">
                        <h2 className="text-base font-bold mb-3 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-primary" /> Schedule
                        </h2>
                        <div className="space-y-2 text-sm">
                          {tournament.start_date && (
                            <div className="flex justify-between text-muted-foreground">
                              <span>Start Date</span>
                              <span className="text-white font-medium">
                                {new Date(tournament.start_date).toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>
                          )}
                          {tournament.end_date && (
                            <div className="flex justify-between text-muted-foreground">
                              <span>End Date</span>
                              <span className="text-white font-medium">
                                {new Date(tournament.end_date).toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Sidebar: registration */}
                <div className="space-y-4">
                  <Card className="bg-card border-border">
                    <CardContent className="p-5">
                      <h2 className="text-base font-bold mb-4">Registration</h2>
                      <div className="space-y-3 text-sm mb-5">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Status</span>
                          <span className={`font-medium capitalize ${isFinished ? 'text-yellow-400' : 'text-white'}`}>
                            {isFinished ? '🏁 Finished' : tournament.status}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Players</span>
                          <span className="text-white font-medium">
                            <span className="text-green-400">{approvedCount}</span> / {tournament.max_players || '∞'}
                          </span>
                        </div>

                      </div>

                      {/* Registration CTA */}
                      {isFinished ? (
                        <div className="bg-yellow-500/8 border border-yellow-500/20 rounded-lg p-3 text-center">
                          <Trophy className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
                          <p className="font-bold text-yellow-400 text-sm">Tournament Ended</p>
                          <p className="text-xs text-muted-foreground mt-0.5">This tournament has concluded.</p>
                        </div>
                      ) : canManage ? (
                        <div className="text-center py-3 bg-muted/30 rounded-lg text-xs text-muted-foreground border border-border">
                          <Shield className="w-4 h-4 mx-auto mb-1 opacity-50" />
                          Organizer — cannot register as player
                        </div>
                      ) : !user ? (
                        <Button className="w-full shadow-glow-primary" onClick={() => navigate("/login")}>Login to Register</Button>
                      ) : registration ? (
                        <div className="text-center">
                          {regStatus === 'approved' && (
                            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                              <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-1" />
                              <p className="font-bold text-green-400 text-sm">Approved & Enrolled</p>
                              <p className="text-xs text-muted-foreground mt-0.5">You're in the tournament!</p>
                            </div>
                          )}
                          {regStatus === 'pending' && (
                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                              <Clock className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
                              <p className="font-bold text-yellow-400 text-sm">Request Sent</p>
                              <p className="text-xs text-muted-foreground mt-0.5">Awaiting organizer approval.</p>
                            </div>
                          )}
                          {regStatus === 'rejected' && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                              <XCircle className="w-6 h-6 text-red-400 mx-auto mb-1" />
                              <p className="font-bold text-red-400 text-sm">Request Rejected</p>
                              <p className="text-xs text-muted-foreground mt-0.5">Contact the organizer.</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <Button
                          className="w-full shadow-glow-primary"
                          onClick={handleRegister}
                          disabled={registerMutation.isPending || tournament.status === 'completed' || tournament.status === 'live'}
                        >
                          {registerMutation.isPending ? "Sending..." : "Request to Join"}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* ── MY MATCHES ───────────────────────────────────────────── */}
            {activeTab === 'matches' && (
              <div className="space-y-4">
                {myMatches.length === 0 ? (
                  <Card className="p-10 text-center bg-card border-border">
                    <Swords className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-20" />
                    <p className="font-medium text-white mb-1">No matches yet</p>
                    <p className="text-sm text-muted-foreground">Your matches will appear here when the fixtures are set.</p>
                  </Card>
                ) : (
                  myMatches.map(match => {
                    const isP1 = match.player1_id === user?.id;
                    const opponent = isP1 ? match.player2 : match.player1;
                    const st = matchStatusLabel(match.status);
                    const canSubmit = ['scheduled', 'live', 'waiting_submission', 'disputed'].includes(match.status);

                    return (
                      <Card key={match.id} className="bg-card border-border hover:border-primary/30 transition-all">
                        <CardContent className="p-4 sm:p-5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>
                                  {st.label}
                                </span>
                              </div>
                              <p className="text-base font-display font-semibold">
                                vs <span className="text-primary">{(opponent as any)?.display_name || "TBD"}</span>
                              </p>
                              {match.scheduled_time && (
                                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {new Intl.DateTimeFormat('default', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(match.scheduled_time))}
                                </p>
                              )}
                              {match.deadline && (
                                <p className="text-xs text-yellow-500/80 mt-0.5 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Deadline: {new Intl.DateTimeFormat('default', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(match.deadline))}
                                </p>
                              )}
                              {match.status === 'verified' && match.winner_id && (
                                <p className={`text-xs mt-1 font-medium ${match.winner_id === user?.id ? 'text-green-400' : 'text-red-400'}`}>
                                  {match.winner_id === user?.id ? '🏆 Victory' : '💀 Defeat'}
                                </p>
                              )}
                            </div>
                            <div className="shrink-0">
                              {canSubmit ? (
                                match.match_submissions?.some((sub: any) => sub.player_id === user?.id) ? (
                                  <Button size="sm" variant="outline" disabled className="text-muted-foreground border-border/50">
                                    <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                                    Submitted
                                  </Button>
                                ) : (
                                  <Button size="sm" onClick={() => navigate(`/matches/${match.id}/submit`)}>
                                    <Target className="w-3.5 h-3.5 mr-1.5" />
                                    Submit Score
                                  </Button>
                                )
                              ) : match.status === 'verified' ? (
                                <Button size="sm" variant="ghost" disabled>
                                  <CheckCircle className="w-3.5 h-3.5 mr-1.5 text-green-400" /> Done
                                </Button>
                              ) : (
                                <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setActiveTab('fixtures')}>
                                  View Fixtures <ChevronRight className="w-3.5 h-3.5 ml-1" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            )}

            {/* ── FIXTURES ─────────────────────────────────────────────── */}
            {activeTab === 'fixtures' && (
              <div className="space-y-4">
                {/* Winner banner inside fixtures if completed */}
                {tournamentWinnerProfile && (
                  <div className="relative overflow-hidden rounded-xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500/15 via-yellow-400/5 to-transparent p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-yellow-500/20 border-2 border-yellow-500/40 flex items-center justify-center shrink-0">
                        <Medal className="w-5 h-5 text-yellow-400" />
                      </div>
                      <div>
                        <p className="text-xs text-yellow-500/80 font-medium uppercase tracking-wider">Tournament Champion</p>
                        <p className="text-base font-display font-bold text-yellow-300">🏆 {tournamentWinnerProfile.display_name}</p>
                      </div>
                    </div>
                  </div>
                )}
                {tournament.status === 'upcoming' || tournament.status === 'registration' ? (
                  <Card className="p-10 text-center bg-card border-border">
                    <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-20" />
                    <p className="font-medium text-white mb-1">Fixtures not yet available</p>
                    <p className="text-sm text-muted-foreground">The fixtures will be generated when the tournament starts.</p>
                  </Card>
                ) : (
                  <TournamentBracket tournamentId={tournament.id} />
                )}
              </div>
            )}

            {/* ── PLAYERS ──────────────────────────────────────────────── */}
            {activeTab === 'players' && (
              <Card className="bg-card border-border overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <h2 className="font-bold flex items-center gap-2">
                    <Users className="w-4 h-4 text-secondary" /> Approved Players
                  </h2>
                  <span className="text-sm text-muted-foreground">{approvedCount} enrolled</span>
                </div>
                {isRegLoading ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">Loading players...</div>
                ) : approvedCount === 0 ? (
                  <div className="p-10 text-center">
                    <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-20" />
                    <p className="text-sm text-muted-foreground">No approved players yet.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-border/50">
                    {allRegistrations!
                      .filter(r => r.registration_status === 'approved')
                      .map((reg, idx) => (
                        <li key={reg.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/2 transition-colors">
                          <span className="text-xs text-muted-foreground w-5 text-center shrink-0">{idx + 1}</span>
                          <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary">
                              {((reg.user as any)?.display_name || '?')[0].toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-white truncate">{(reg.user as any)?.display_name || "Unknown"}</p>
                          </div>
                          <span className="text-xs text-muted-foreground bg-muted/30 px-2 py-0.5 rounded font-mono shrink-0">
                            {(reg.user as any)?.player_id}
                          </span>
                        </li>
                      ))}
                  </ul>
                )}
              </Card>
            )}

            {/* ── LEADERBOARD ───────────────────────────────────────────── */}
            {activeTab === 'leaderboard' && (
              <div>
                <TournamentLeaderboard tournamentId={tournament.id} registrations={allRegistrations} />
              </div>
            )}

            {/* ── RULES ────────────────────────────────────────────────── */}
            {activeTab === 'rules' && (
              <div className="grid md:grid-cols-2 gap-5">
                {[
                  {
                    icon: Swords,
                    title: "Match Rules",
                    items: [
                      "Both players must submit their score with a screenshot.",
                      "Scores must be submitted within the match deadline.",
                      "Only eFootball match result screenshots are accepted.",
                      "Scores are verified automatically when both submissions match.",
                    ]
                  },
                  {
                    icon: Trophy,
                    title: "Tournament Rules",
                    items: [
                      "Single-elimination format — one loss and you're out.",
                      "Players must be registered and approved to participate.",
                      "Organizer decisions on disputes are final.",
                      "Unsportsmanlike conduct may result in disqualification.",
                    ]
                  },
                  {
                    icon: Clock,
                    title: "Walkover Rules",
                    items: [
                      "If a player fails to submit by the deadline, they forfeit.",
                      "Organizer can declare a walkover for non-responsive players.",
                      "Walkovers count as a loss for the forfeiting player.",
                    ]
                  },
                  {
                    icon: Shield,
                    title: "Dispute Resolution",
                    items: [
                      "If scores don't match, the match enters a disputed state.",
                      "The organizer reviews both submissions and screenshots.",
                      "Organizer can manually declare the winner.",
                      "False reporting may result in disqualification.",
                    ]
                  },
                ].map(section => {
                  const Icon = section.icon;
                  return (
                    <Card key={section.title} className="bg-card border-border">
                      <CardContent className="p-5">
                        <h3 className="font-bold mb-3 flex items-center gap-2">
                          <Icon className="w-4 h-4 text-primary" /> {section.title}
                        </h3>
                        <ul className="space-y-2">
                          {section.items.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <span className="text-primary mt-0.5 shrink-0">•</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TournamentDetailPage;
