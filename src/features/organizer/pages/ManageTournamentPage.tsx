import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  ArrowLeft, Check, X, Play, AlertTriangle, Users, Trophy,
  Shuffle, RotateCcw, Trash2, CheckCircle2, XCircle, Zap, RotateCcw as RevertIcon
} from "lucide-react";
import { useTournament, useGenerateManualBracket, useRevertTournament, useUpdateTournament } from "@/features/tournaments/hooks/useTournaments";
import { useRegistrations, useUpdateRegistrationStatus } from "@/features/tournaments/hooks/useRegistrations";
import { useDisputedMatches, useResolveDispute } from "@/features/matches/hooks/useMatches";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TournamentBracket } from "@/features/tournaments/components/TournamentBracket";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Mail, Phone, Gamepad2, Hash, Edit } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Bracket Utilities ────────────────────────────────────────────────────────
const BYE_ID = "__BYE__";

const nextPowerOfTwo = (n: number): number => {
  let p = 1;
  while (p < n) p *= 2;
  return p;
};

interface PlayerSlot {
  id: string; // player user_id or BYE_ID
  name: string;
}

interface Fixture {
  p1: PlayerSlot | null;
  p2: PlayerSlot | null;
}

/** Builds the default fixture list: players distributed, BYEs filling the rest */
const buildDefaultFixtures = (players: PlayerSlot[]): Fixture[] => {
  const n = players.length;
  const bracketSize = nextPowerOfTwo(n);
  const numMatches = bracketSize / 2;
  const numByes = bracketSize - n;

  // Interleave players and BYEs for a nice spread
  const slots: PlayerSlot[] = [];
  let byesLeft = numByes;
  let playerIdx = 0;
  while (slots.length < bracketSize) {
    if (playerIdx < players.length) {
      slots.push(players[playerIdx++]);
    }
    if (byesLeft > 0 && slots.length < bracketSize) {
      slots.push({ id: BYE_ID, name: "BYE" });
      byesLeft--;
    }
  }

  const fixtures: Fixture[] = [];
  for (let i = 0; i < numMatches; i++) {
    fixtures.push({ p1: slots[i * 2] || null, p2: slots[i * 2 + 1] || null });
  }
  return fixtures;
};

/** Shuffles player positions (not BYE positions) keeping BYE count same */
const randomizeFixtures = (fixtures: Fixture[], players: PlayerSlot[]): Fixture[] => {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  return buildDefaultFixtures(shuffled);
};

// ─── Validation ───────────────────────────────────────────────────────────────
interface ValidationResult {
  passed: boolean;
  checks: { label: string; ok: boolean }[];
}

const validateFixtures = (
  fixtures: Fixture[],
  players: PlayerSlot[],
  requiredByes: number
): ValidationResult => {
  const allSlots: (PlayerSlot | null)[] = fixtures.flatMap(f => [f.p1, f.p2]);
  const assignedPlayers = allSlots.filter(s => s && s.id !== BYE_ID) as PlayerSlot[];
  const assignedByes = allSlots.filter(s => s?.id === BYE_ID).length;
  const emptySlots = allSlots.filter(s => s === null).length;

  const playerIds = assignedPlayers.map(p => p.id);
  const duplicateIds = playerIds.filter((id, idx) => playerIds.indexOf(id) !== idx);
  const missingPlayers = players.filter(p => !playerIds.includes(p.id));
  const samePlayerInMatch = fixtures.some(f => f.p1 && f.p2 && f.p1.id === f.p2.id && f.p1.id !== BYE_ID);

  const checks = [
    { label: "Every player assigned exactly once", ok: missingPlayers.length === 0 && duplicateIds.length === 0 },
    { label: "No duplicate players", ok: duplicateIds.length === 0 },
    { label: `Correct number of BYEs (${requiredByes})`, ok: assignedByes === requiredByes },
    { label: "No empty slots", ok: emptySlots === 0 },
    { label: "No match contains the same player twice", ok: !samePlayerInMatch },
  ];

  return { passed: checks.every(c => c.ok), checks };
};

// ─── Match Card Component ─────────────────────────────────────────────────────
const FixtureMatchCard = ({
  matchIndex,
  fixture,
  allFixtures,
  players,
  requiredByes,
  onSlotChange,
}: {
  matchIndex: number;
  fixture: Fixture;
  allFixtures: Fixture[];
  players: PlayerSlot[];
  requiredByes: number;
  /** Called with (matchIndex, slotIdx 0=p1/1=p2, new PlayerSlot|null) */
  onSlotChange: (matchIdx: number, slotIdx: 0 | 1, newSlot: PlayerSlot | null) => void;
}) => {
  const allSlots = allFixtures.flatMap((f, fi) => [
    { slot: f.p1, matchIdx: fi, slotIdx: 0 as 0 | 1 },
    { slot: f.p2, matchIdx: fi, slotIdx: 1 as 0 | 1 },
  ]);

  const usedByes = allSlots.filter(s => s.slot?.id === BYE_ID).length;
  const canAddMoreByes = usedByes < requiredByes;

  const renderSelect = (
    currentSlot: PlayerSlot | null,
    slotIdx: 0 | 1
  ) => {
    return (
      <div>
        <select
          className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors"
          value={currentSlot?.id || ""}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "") {
              onSlotChange(matchIndex, slotIdx, null);
            } else if (val === BYE_ID) {
              onSlotChange(matchIndex, slotIdx, { id: BYE_ID, name: "BYE" });
            } else {
              const player = players.find(p => p.id === val);
              if (player) onSlotChange(matchIndex, slotIdx, player);
            }
          }}
        >
          <option value="">— Select Player —</option>
          {/* BYE option always visible; parent enforces the count limit via swap logic */}
          {(canAddMoreByes || currentSlot?.id === BYE_ID) && (
            <option value={BYE_ID}>BYE</option>
          )}
          {/* Show ALL players — selecting one that's elsewhere triggers a swap in the parent */}
          {players.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
      <h4 className="text-xs font-bold text-primary mb-3 text-center uppercase tracking-wider">
        Match {matchIndex + 1}
      </h4>
      <div className="space-y-3">
        {renderSelect(fixture.p1, 0)}
        <div className="text-center text-xs text-muted-foreground font-bold">VS</div>
        {renderSelect(fixture.p2, 1)}
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export const ManageTournamentPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: tournament, isLoading: isTournamentLoading } = useTournament(id || "");
  const { data: registrations, isLoading: isRegLoading } = useRegistrations(id || "");
  const { data: disputedMatches } = useDisputedMatches(id || "");
  const updateStatus = useUpdateRegistrationStatus();
  const generateManualBracket = useGenerateManualBracket();
  const resolveDispute = useResolveDispute();
  const revertTournament = useRevertTournament();
  const updateTournament = useUpdateTournament();
  const { isAdmin } = useAuth();

  const approvedCount = registrations?.filter(r => r.registration_status === 'approved').length || 0;
  const pendingCount = registrations?.filter(r => r.registration_status === 'pending').length || 0;

  const [isManualMode, setIsManualMode] = useState(false);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [defaultFixtures, setDefaultFixtures] = useState<Fixture[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: "",
    description: "",
    max_players: 8,
    start_date: "",
  });

  const handleOpenEdit = () => {
    if (tournament) {
      setEditFormData({
        name: tournament.name || "",
        description: tournament.description || "",
        max_players: tournament.max_players || 8,
        start_date: tournament.start_date ? new Date(tournament.start_date).toISOString().slice(0, 16) : "",
      });
      setIsEditDialogOpen(true);
    }
  };

  const handleSaveEdit = () => {
    updateTournament.mutate({
      id: id!,
      name: editFormData.name,
      description: editFormData.description,
      max_players: editFormData.max_players,
      start_date: editFormData.start_date ? new Date(editFormData.start_date).toISOString() : null,
    }, {
      onSuccess: () => {
        toast.success("Tournament details updated!");
        setIsEditDialogOpen(false);
      },
      onError: (err: any) => toast.error("Failed to update: " + err.message)
    });
  };

  // Compute derived values
  const approvedPlayers = useMemo((): PlayerSlot[] =>
    (registrations?.filter(r => r.registration_status === 'approved') || []).map(r => ({
      id: r.user_id,
      name: (r.user as any)?.display_name || "Unknown",
    })),
    [registrations]
  );

  const bracketSize = useMemo(() => nextPowerOfTwo(Math.max(approvedPlayers.length, 2)), [approvedPlayers]);
  const requiredByes = useMemo(() => bracketSize - approvedPlayers.length, [bracketSize, approvedPlayers]);

  const validation = useMemo(
    () => validateFixtures(fixtures, approvedPlayers, requiredByes),
    [fixtures, approvedPlayers, requiredByes]
  );

  const handleOpenManualFixtures = () => {
    if (approvedPlayers.length < 2) {
      toast.error("You need at least 2 approved players to kick off.");
      return;
    }
    const generated = buildDefaultFixtures(approvedPlayers);
    setDefaultFixtures(generated);
    setFixtures(generated);
    setIsManualMode(true);
  };

  const handleRandomize = () => {
    setFixtures(randomizeFixtures(fixtures, approvedPlayers));
  };

  const handleReset = () => {
    setFixtures(defaultFixtures.map(f => ({ ...f })));
    toast.info("Fixtures reset to generated defaults.");
  };

  const handleClear = () => {
    const numMatches = bracketSize / 2;
    setFixtures(Array.from({ length: numMatches }, () => ({ p1: null, p2: null })));
    toast.info("Fixtures cleared.");
  };

  /**
   * Handles a single slot change with SMART SWAP:
   * If the incoming player is already assigned somewhere else,
   * move the displaced slot's occupant to the vacated position.
   */
  const handleSlotChange = (matchIdx: number, slotIdx: 0 | 1, newSlot: PlayerSlot | null) => {
    setFixtures(prev => {
      const next = prev.map(f => ({ ...f })); // shallow clone each fixture

      // Current value being replaced
      const oldSlot = slotIdx === 0 ? next[matchIdx].p1 : next[matchIdx].p2;

      // Find if the incoming slot is already placed elsewhere
      let foundMatchIdx = -1;
      let foundSlotIdx: 0 | 1 = 0;
      if (newSlot) {
        for (let mi = 0; mi < next.length; mi++) {
          if (mi === matchIdx) continue;
          if (next[mi].p1?.id === newSlot.id) { foundMatchIdx = mi; foundSlotIdx = 0; break; }
          if (next[mi].p2?.id === newSlot.id) { foundMatchIdx = mi; foundSlotIdx = 1; break; }
        }
        // Also check the OTHER slot within the SAME match
        const sameMatchOther = slotIdx === 0 ? next[matchIdx].p2 : next[matchIdx].p1;
        if (sameMatchOther?.id === newSlot.id) {
          // Swap within same match
          if (slotIdx === 0) { next[matchIdx].p1 = newSlot; next[matchIdx].p2 = oldSlot; }
          else { next[matchIdx].p2 = newSlot; next[matchIdx].p1 = oldSlot; }
          return next;
        }
      }

      // Perform the swap across fixtures
      if (foundMatchIdx !== -1) {
        // Put oldSlot into the spot where newSlot was
        if (foundSlotIdx === 0) next[foundMatchIdx].p1 = oldSlot;
        else next[foundMatchIdx].p2 = oldSlot;
      }

      // Place newSlot in the target position
      if (slotIdx === 0) next[matchIdx].p1 = newSlot;
      else next[matchIdx].p2 = newSlot;

      return next;
    });
  };

  const handleConfirmStart = () => {
    if (!validation.passed) {
      toast.error("Please fix all validation errors before starting.");
      return;
    }

    // Build flat player array for the RPC (null = BYE)
    const playerSlots: (string | null)[] = fixtures.flatMap(f => [
      f.p1?.id === BYE_ID ? null : (f.p1?.id || null),
      f.p2?.id === BYE_ID ? null : (f.p2?.id || null),
    ]);

    generateManualBracket.mutate({
      tournamentId: id!,
      startTime: new Date().toISOString(),
      roundDuration: 60,
      players: playerSlots,
    }, {
      onSuccess: () => {
        toast.success("Tournament kicked off with manual fixtures!");
        setIsManualMode(false);
      },
      onError: (err: any) => toast.error("Failed to generate bracket: " + err.message),
    });
  };

  const handleUpdateStatus = (registrationId: string, newStatus: string) => {
    updateStatus.mutate({ registrationId, status: newStatus }, {
      onSuccess: () => toast.success(`Player ${newStatus}`),
      onError: () => toast.error("Failed to update status"),
    });
  };

  const handleResolveDispute = (matchId: string, winnerId: string) => {
    resolveDispute.mutate({ matchId, winnerId }, {
      onSuccess: () => toast.success("Dispute resolved! Fixtures updated."),
      onError: (err: any) => toast.error("Failed to resolve dispute: " + err.message),
    });
  };

  const handleRevertTournament = () => {
    if (confirm("Are you sure you want to revert this tournament? This will PERMANENTLY DELETE all matches, fixtures, stats, and submissions for this tournament!")) {
      revertTournament.mutate({ tournamentId: id! }, {
        onSuccess: () => toast.success("Tournament successfully reverted to registration phase!"),
        onError: (err: any) => toast.error("Failed to revert: " + err.message),
      });
    }
  };

  if (isTournamentLoading || isRegLoading) {
    return <div className="text-center py-20 text-white">Loading...</div>;
  }
  if (!tournament) {
    return <div className="text-center py-20 text-white">Tournament not found</div>;
  }

  const regStatusColor = (status: string) => {
    if (status === 'approved') return 'bg-green-500/15 text-green-400 border-green-500/30';
    if (status === 'rejected') return 'bg-red-500/15 text-red-400 border-red-500/30';
    return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Button variant="ghost" className="mb-6" onClick={() => navigate("/organizer")}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </Button>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-4xl font-display font-bold">{tournament.name}</h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="px-2 py-1 rounded-full text-xs font-medium capitalize bg-primary/15 text-primary">
                {tournament.status}
              </span>
              <span className="text-sm text-muted-foreground capitalize">{tournament.format?.replace('_', ' ')}</span>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex gap-4">
              <div className="text-center p-3 bg-green-500/10 rounded-xl border border-green-500/20">
                <p className="text-2xl font-display font-bold text-green-400">{approvedCount}</p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
              <div className="text-center p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                <p className="text-2xl font-display font-bold text-yellow-400">{pendingCount}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div className="text-center p-3 bg-card rounded-xl border border-border">
                <p className="text-2xl font-display font-bold">{registrations?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
            {tournament.status === 'live' && (
              <Button 
                variant="destructive" 
                className="w-full shadow-glow-primary bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500 hover:text-white"
                onClick={handleRevertTournament}
                disabled={revertTournament.isPending}
              >
                <RevertIcon className="w-4 h-4 mr-2" />
                {revertTournament.isPending ? "Reverting..." : "Revert Tournament Kickoff"}
              </Button>
            )}
            <Button variant="outline" className="w-full bg-card hover:bg-muted" onClick={handleOpenEdit}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Details
            </Button>
          </div>
        </div>

        {/* Kick Off Card */}
        {tournament.status !== 'live' && tournament.status !== 'completed' && !isManualMode && (
          <Card className="bg-card border-primary/30 shadow-glow-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="w-5 h-5 text-primary" />
                Kick Off Tournament
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    You have <strong className="text-green-400">{approvedCount} approved players</strong>.
                    {approvedCount >= 2 && (
                      <span className="text-muted-foreground">
                        {" "}Fixtures size will be <strong className="text-primary">{nextPowerOfTwo(approvedCount)}</strong> with{" "}
                        <strong className="text-secondary">{nextPowerOfTwo(approvedCount) - approvedCount} BYE(s)</strong>.
                      </span>
                    )}
                  </p>
                  {approvedCount < 2 && (
                    <p className="text-xs text-yellow-400 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Need at least 2 approved players to kick off.
                    </p>
                  )}
                </div>
                <Button
                  className="shadow-glow-primary flex-shrink-0"
                  onClick={handleOpenManualFixtures}
                  disabled={approvedCount < 2}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Set Manual Fixtures
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Manual Fixtures Builder ── */}
        {isManualMode && tournament.status !== 'live' && tournament.status !== 'completed' && (
          <Card className="bg-card border-primary/50 shadow-glow-primary">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-primary" />
                    Manual Fixtures — Round 1
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {approvedPlayers.length} players · Fixtures size {bracketSize} · {requiredByes} BYE{requiredByes !== 1 ? "s" : ""} required
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIsManualMode(false)}>Cancel</Button>
              </div>

              {/* Utility Buttons */}
              <div className="flex flex-wrap gap-2 mt-4">
                <Button size="sm" variant="outline" onClick={handleOpenManualFixtures} className="gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> Generate
                </Button>
                <Button size="sm" variant="outline" onClick={handleRandomize} className="gap-1.5">
                  <Shuffle className="w-3.5 h-3.5" /> Randomize
                </Button>
                <Button size="sm" variant="outline" onClick={handleReset} className="gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5" /> Reset
                </Button>
                <Button size="sm" variant="outline" onClick={handleClear} className="gap-1.5 text-red-400 border-red-500/30 hover:bg-red-500/10">
                  <Trash2 className="w-3.5 h-3.5" /> Clear
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Match Cards Grid */}
              <div className="grid md:grid-cols-2 gap-6">
                {fixtures.map((fixture, matchIndex) => (
                  <FixtureMatchCard
                    key={matchIndex}
                    matchIndex={matchIndex}
                    fixture={fixture}
                    allFixtures={fixtures}
                    players={approvedPlayers}
                    requiredByes={requiredByes}
                    onSlotChange={handleSlotChange}
                  />
                ))}
              </div>

              {/* Validation Summary */}
              <div className={`rounded-lg border p-4 ${validation.passed ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                  {validation.passed
                    ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                    : <XCircle className="w-4 h-4 text-red-400" />}
                  <span className={validation.passed ? 'text-green-400' : 'text-red-400'}>
                    {validation.passed ? "Fixtures are valid — ready to start!" : "Fix the following issues:"}
                  </span>
                </h4>
                <ul className="space-y-1.5">
                  {validation.checks.map((check, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs">
                      {check.ok
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                        : <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                      <span className={check.ok ? 'text-muted-foreground' : 'text-red-300'}>{check.label}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Confirm Button */}
              <Button
                className="w-full shadow-glow-primary"
                size="lg"
                onClick={handleConfirmStart}
                disabled={!validation.passed || generateManualBracket.isPending}
              >
                <Play className="w-4 h-4 mr-2" />
                {generateManualBracket.isPending ? "Starting Tournament..." : "Confirm & Start Tournament"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Fixtures */}
        {(tournament.status === 'live' || tournament.status === 'completed') && (
          <div className="mt-12">
            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-2xl font-display font-bold mb-4">Tournament Fixtures</h2>
            </div>
            <div className="bg-card border border-border shadow-elevated rounded-lg p-4 overflow-hidden">
              <TournamentBracket tournamentId={id!} />
            </div>
          </div>
        )}

        {/* Disputed Matches */}
        {disputedMatches && disputedMatches.length > 0 && (
          <Card className="bg-destructive/10 border-destructive shadow-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Action Required: Disputed Matches ({disputedMatches.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {disputedMatches.map((match) => (
                  <div key={match.id} className="bg-card border border-border p-4 rounded-lg">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold">{match.round?.name}</h3>
                        <p className="text-sm text-muted-foreground">Match ID: {match.id}</p>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <p className="font-semibold text-primary">{match.player1?.display_name || 'TBD'}</p>
                        {match.submissions?.find((s: any) => s.player_id === match.player1_id) && (
                          <div className="bg-primary/5 p-3 rounded">
                            <p className="text-sm">Score: <strong>{match.submissions.find((s: any) => s.player_id === match.player1_id).score_reported}</strong></p>
                          </div>
                        )}
                        <Button size="sm" onClick={() => handleResolveDispute(match.id, match.player1_id)} disabled={resolveDispute.isPending || !match.player1_id} className="w-full">
                          Declare {match.player1?.display_name || 'Player 1'} Winner
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <p className="font-semibold text-secondary">{match.player2?.display_name || 'TBD'}</p>
                        {match.submissions?.find((s: any) => s.player_id === match.player2_id) && (
                          <div className="bg-secondary/5 p-3 rounded">
                            <p className="text-sm">Score: <strong>{match.submissions.find((s: any) => s.player_id === match.player2_id).score_reported}</strong></p>
                          </div>
                        )}
                        <Button size="sm" variant="secondary" onClick={() => handleResolveDispute(match.id, match.player2_id)} disabled={resolveDispute.isPending || !match.player2_id} className="w-full">
                          Declare {match.player2?.display_name || 'Player 2'} Winner
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Player Registrations Table */}
        <Card className="bg-card border-border shadow-elevated overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-secondary" />
              Player Registrations
              {pendingCount > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-400 font-medium">
                  {pendingCount} pending
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {registrations?.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No players have registered yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead>Game ID</TableHead>
                      <TableHead>Player ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...registrations].sort((a, b) => {
                      const order = { pending: 0, approved: 1, rejected: 2 };
                      return (order[a.registration_status as keyof typeof order] ?? 1) - (order[b.registration_status as keyof typeof order] ?? 1);
                    }).map((reg) => (
                      <TableRow 
                        key={reg.id} 
                        className={`${reg.registration_status === 'pending' ? 'bg-yellow-500/5' : ''} ${isAdmin ? 'cursor-pointer hover:bg-white/5 transition-colors' : ''}`}
                        onClick={() => isAdmin && setSelectedUser(reg.user)}
                      >
                        <TableCell className="font-medium text-white">{(reg.user as any)?.display_name || "Unknown"}</TableCell>
                        <TableCell className="text-muted-foreground">{(reg.user as any)?.game_id || '—'}</TableCell>
                        <TableCell className="text-muted-foreground font-mono">{(reg.user as any)?.player_id || '—'}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize border ${regStatusColor(reg.registration_status)}`}>
                            {reg.registration_status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {reg.registration_status !== 'approved' && tournament.status !== 'live' && (
                                <Button
                                size="sm" variant="outline"
                                className="border-green-500/50 text-green-400 hover:bg-green-500 hover:text-white"
                                onClick={(e) => { e.stopPropagation(); handleUpdateStatus(reg.id, 'approved'); }}
                                disabled={updateStatus.isPending}
                              >
                                <Check className="w-4 h-4 mr-1" /> Approve
                              </Button>
                            )}
                            {reg.registration_status !== 'rejected' && tournament.status !== 'live' && (
                              <Button
                                size="sm" variant="outline"
                                className="border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white"
                                onClick={(e) => { e.stopPropagation(); handleUpdateStatus(reg.id, 'rejected'); }}
                                disabled={updateStatus.isPending}
                              >
                                <X className="w-4 h-4 mr-1" /> Reject
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* User Details Dialog (Admin Only) */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4 border-b border-border pb-4">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary font-display text-2xl font-bold">
                  {selectedUser.display_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-bold">{selectedUser.display_name}</h3>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email Address</p>
                    <p className="font-medium">{selectedUser.email || '—'}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Phone Number</p>
                    <p className="font-medium">{selectedUser.phone_number || '—'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
                    <Hash className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Player ID</p>
                      <p className="font-mono text-sm">{selectedUser.player_id || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
                    <Gamepad2 className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Game ID</p>
                      <p className="font-mono text-sm">{selectedUser.game_id || '—'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setSelectedUser(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Tournament Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md bg-card border border-border">
          <DialogHeader>
            <DialogTitle>Edit Tournament Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input 
                value={editFormData.name}
                onChange={e => setEditFormData({...editFormData, name: e.target.value})}
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <textarea 
                className="w-full min-h-[100px] bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-white"
                value={editFormData.description}
                onChange={e => setEditFormData({...editFormData, description: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Max Players (Team Size)</Label>
              <select 
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-white"
                value={editFormData.max_players}
                onChange={e => setEditFormData({...editFormData, max_players: parseInt(e.target.value)})}
              >
                <option value={2}>2 Players</option>
                <option value={4}>4 Players</option>
                <option value={8}>8 Players</option>
                <option value={16}>16 Players</option>
                <option value={32}>32 Players</option>
                <option value={64}>64 Players</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Schedule Date</Label>
              <Input 
                type="datetime-local"
                value={editFormData.start_date}
                onChange={e => setEditFormData({...editFormData, start_date: e.target.value})}
                className="bg-background border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={updateTournament.isPending}>
              {updateTournament.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageTournamentPage;
