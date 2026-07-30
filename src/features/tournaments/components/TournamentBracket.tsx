import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useRounds, useMatches, useUpdateMatchSchedule, useResolveDispute, useForceResolveMatch } from "@/features/matches/hooks/useMatches";
import { useTournament } from "@/features/tournaments/hooks/useTournaments";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Users, Trophy, Settings, Upload, CheckCircle, XCircle, Shield } from "lucide-react";
import { supabase } from "@/services/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { extractStatsWithOCR } from "@/lib/ocr";

export const TournamentBracket = ({ tournamentId }: { tournamentId: string }) => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { data: tournament } = useTournament(tournamentId);
  const { data: rounds, isLoading: isRoundsLoading } = useRounds(tournamentId);
  const { data: matches, isLoading: isMatchesLoading } = useMatches(tournamentId);
  const updateSchedule = useUpdateMatchSchedule();
  const resolveDispute = useResolveDispute();
  const forceResolveMatch = useForceResolveMatch();
  const queryClient = useQueryClient();

  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [scheduledTime, setScheduledTime] = useState("");
  const [deadline, setDeadline] = useState("");
  const [extractingSubId, setExtractingSubId] = useState<string | null>(null);
  const [savingSubId, setSavingSubId] = useState<string | null>(null);
  // editableStats: { [subId]: { p1: StatFields, p2: StatFields } }
  const [editableStats, setEditableStats] = useState<Record<string, { p1: Record<string, number>, p2: Record<string, number> }>>({});

  const isOrganizer = user?.id === tournament?.organizer_id || isAdmin;

  useEffect(() => {
    const channel = supabase
      .channel(`bracket-updates-${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["matches", tournamentId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId, queryClient]);

  if (isRoundsLoading || isMatchesLoading) {
    return <div className="text-center py-10 text-muted-foreground">Loading fixtures...</div>;
  }

  if (!rounds || rounds.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-border rounded-lg bg-card/50">
        <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground text-lg">Fixtures have not been generated yet.</p>
        <p className="text-sm text-muted-foreground/70">Registration is likely still open.</p>
      </div>
    );
  }

  const matchesByRound = rounds.map(round => ({
    ...round,
    matches: matches?.filter(m => m.round_id === round.id).sort((a, b) => {
      const posA = a.brackets?.[0]?.position || 0;
      const posB = b.brackets?.[0]?.position || 0;
      if (posA !== posB) return posA - posB;
      return a.id.localeCompare(b.id);
    }) || []
  }));

  const sortedRounds = [...matchesByRound].sort((a, b) => a.order_index - b.order_index);
  const totalRounds = sortedRounds.length;

  const sideRounds = sortedRounds.slice(0, totalRounds - 1);
  const finalRound = sortedRounds[totalRounds - 1];

  const handleMatchClick = (match: any) => {
    if (!isOrganizer) return;
    setSelectedMatch(match);
    if (match.scheduled_time) {
      setScheduledTime(new Date(match.scheduled_time).toISOString().slice(0, 16));
    } else {
      setScheduledTime("");
    }
    if (match.deadline) {
      setDeadline(new Date(match.deadline).toISOString().slice(0, 16));
    } else {
      setDeadline("");
    }
  };

  const handleSaveSchedule = () => {
    if (!selectedMatch) return;
    if (!deadline) {
      toast.error("Please set a Deadline.");
      return;
    }

    updateSchedule.mutate({
      matchId: selectedMatch.id,
      scheduledTime: selectedMatch.scheduled_time || new Date().toISOString(),
      deadline: new Date(deadline).toISOString()
    }, {
      onSuccess: () => {
        toast.success("Match schedule updated!");
        setSelectedMatch(null);
      },
      onError: (err: any) => toast.error("Failed to update schedule: " + err.message)
    });
  };

  const deleteScreenshots = async (match: any) => {
    if (!match || !match.match_submissions) return;
    const pathsToDelete = match.match_submissions
      .filter((s: any) => s.screenshot_path)
      .map((s: any) => {
         const url = s.screenshot_path;
         const matchStr = 'match_screenshots/';
         const idx = url.indexOf(matchStr);
         return idx !== -1 ? url.substring(idx + matchStr.length) : null;
      })
      .filter(Boolean);
    
    if (pathsToDelete.length > 0) {
      await supabase.storage.from('match_screenshots').remove(pathsToDelete);
    }
  };

  const handleResolveDispute = (matchId: string, winnerId: string) => {
    resolveDispute.mutate({ matchId, winnerId }, {
      onSuccess: () => {
        deleteScreenshots(selectedMatch);
        toast.success("Dispute resolved! Bracket updated.");
        setSelectedMatch(null);
      },
      onError: (err: any) => toast.error("Failed to resolve dispute: " + err.message)
    });
  };

  const handleForceResolve = (matchId: string, submissionId: string) => {
    forceResolveMatch.mutate({ matchId, submissionId }, {
      onSuccess: () => {
        deleteScreenshots(selectedMatch);
        toast.success("Match resolved successfully based on submission!");
        setSelectedMatch(null);
      },
      onError: (err: any) => toast.error("Failed to force resolve: " + err.message)
    });
  };

  const buildFields = (ps: any): Record<string, number> => ({
    goals: ps.goals || 0,
    possession: ps.possession || 0,
    shots: ps.shots || 0,
    shots_on_target: ps.shots_on_target || 0,
    passes: ps.passes || 0,
    passes_completed: ps.passes_completed || 0,
    tackles: ps.tackles || 0,
    fouls: ps.fouls || 0,
    interceptions: ps.interceptions || 0,
    saves: ps.saves || 0,
    corners: ps.corners || 0,
    offsides: ps.offsides || 0,
    free_kicks: ps.free_kicks || 0,
    crosses: ps.crosses || 0,
  });

  const handleManualStats = (sub: any) => {
    if (!selectedMatch) return;
    setEditableStats(prev => ({
      ...prev,
      [sub.id]: {
        p1: buildFields({}),
        p2: buildFields({}),
      }
    }));
  };

  const handleExtractStats = async (sub: any) => {
    if (!sub.screenshot_path) {
      toast.error("No screenshot to extract stats from.");
      return;
    }
    if (!selectedMatch) return;

    setExtractingSubId(sub.id);
    toast.info("Running OCR on screenshot...");

    try {
      const resp = await fetch(sub.screenshot_path);
      const blob = await resp.blob();
      const file = new File([blob], "screenshot.png", { type: blob.type });
      const extracted = await extractStatsWithOCR(file);



      const isP1Submission = sub.player_id === selectedMatch.player1_id;

      setEditableStats(prev => ({
        ...prev,
        [sub.id]: {
          p1: buildFields(isP1Submission ? extracted.player1Stats : extracted.player2Stats),
          p2: buildFields(isP1Submission ? extracted.player2Stats : extracted.player1Stats),
        }
      }));

      toast.success("Stats extracted! Review and edit before saving.");
    } catch (err: any) {
      toast.error("OCR extraction failed: " + (err.message || "Unknown error"));
    } finally {
      setExtractingSubId(null);
    }
  };

  const handleSaveStats = async (sub: any) => {
    if (!selectedMatch) return;
    const es = editableStats[sub.id];
    if (!es) return;

    setSavingSubId(sub.id);
    try {
      const detailedStats = [
        { match_id: selectedMatch.id, player_id: selectedMatch.player1_id, isP1: true, ...es.p1 },
        { match_id: selectedMatch.id, player_id: selectedMatch.player2_id, isP1: false, ...es.p2 },
      ];

      await Promise.all(detailedStats.map(async (stats) => {
        const { error } = await supabase.rpc("rpc_upsert_detailed_stats", {
          p_match_id: stats.match_id,
          p_player_id: stats.player_id,
          p_goals_scored: stats.goals || 0,
          p_goals_conceded: stats.isP1 ? (es.p2.goals || 0) : (es.p1.goals || 0),
          p_possession: stats.possession || 0,
          p_shots: stats.shots || 0,
          p_shots_on_target: stats.shots_on_target || 0,
          p_passes: stats.passes || 0,
          p_pass_accuracy: stats.passes > 0 ? Math.round((stats.passes_completed / stats.passes) * 100) : 0,
          p_interceptions: stats.interceptions || 0,
          p_tackles: stats.tackles || 0,
          p_saves: stats.saves || 0,
          p_fouls: stats.fouls || 0
        });
        if (error) throw error;
      }));

      queryClient.invalidateQueries({ queryKey: ["matches"] });
      // Clear the editable state for this submission
      setEditableStats(prev => { const n = { ...prev }; delete n[sub.id]; return n; });
      toast.success("Stats saved to database!");
    } catch (err: any) {
      toast.error("Failed to save stats: " + (err.message || "Unknown error"));
    } finally {
      setSavingSubId(null);
    }
  };

  const renderMatchCard = (match: any) => {
    const isClickable = isOrganizer;

    if (match.status === 'walkover') {
      const advancer = match.player1?.display_name || match.player2?.display_name || "TBD";
      return (
        <div className="w-[240px] flex items-center justify-center relative z-10 h-[72px]">
          <div className="w-full h-[2px] bg-border absolute"></div>
          <div className="bg-card/50 border border-border/50 px-4 py-1.5 rounded-full text-xs text-muted-foreground relative z-10 shadow-sm flex items-center gap-2">
            <span className="font-bold text-foreground">{advancer}</span>
            <span className="opacity-70">Advanced (Bye)</span>
          </div>
        </div>
      );
    }

    return (
      <Card
        onClick={() => handleMatchClick(match)}
        className={`relative z-10 w-[240px] bg-card border-border shadow-sm overflow-hidden 
          ${isClickable ? 'cursor-pointer hover:border-primary/50 transition-colors' : ''}`}
      >
        <div className="flex flex-col text-sm">
          <div className={`flex justify-between items-center px-3 py-2 border-b border-border/50 ${match.winner_id === match.player1_id ? 'bg-primary/10' : ''}`}>
            <div className="flex items-center gap-2 overflow-hidden">
              <div className={`w-1.5 h-6 rounded-full ${match.winner_id === match.player1_id ? 'bg-primary' : 'bg-muted'}`}></div>
              <span className={`truncate font-medium ${match.winner_id === match.player1_id ? 'text-primary' : 'text-foreground'}`}>
                {match.player1?.display_name || "TBD"}
              </span>
            </div>
            {match.winner_id === match.player1_id && <Trophy className="w-3 h-3 text-primary ml-2 flex-shrink-0" />}
          </div>

          <div className={`flex justify-between items-center px-3 py-2 ${match.winner_id === match.player2_id ? 'bg-primary/10' : ''}`}>
            <div className="flex items-center gap-2 overflow-hidden">
              <div className={`w-1.5 h-6 rounded-full ${match.winner_id === match.player2_id ? 'bg-primary' : 'bg-muted'}`}></div>
              <span className={`truncate font-medium ${match.winner_id === match.player2_id ? 'text-primary' : 'text-foreground'}`}>
                {match.player2?.display_name || "TBD"}
              </span>
            </div>
            {match.winner_id === match.player2_id && <Trophy className="w-3 h-3 text-primary ml-2 flex-shrink-0" />}
          </div>
        </div>

        <div className="bg-muted/30 px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex justify-between items-center">
          <div className="flex flex-col gap-0.5">
            <span>
              {match.scheduled_time
                ? new Intl.DateTimeFormat('default', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(match.scheduled_time))
                : "TBD"}
            </span>
            {match.deadline && (
               <span className="text-[9px] text-muted-foreground/80 lowercase tracking-normal font-medium mt-0.5">dl: {new Intl.DateTimeFormat('default', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(match.deadline))}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Status label — show "Lost" if current user is eliminated */}
            {(() => {
              const isEliminated = match.status === 'verified' && match.winner_id && match.winner_id !== user?.id && (user?.id === match.player1_id || user?.id === match.player2_id);
              if (isEliminated) return <span className="text-red-400 flex items-center gap-1"><XCircle className="w-3 h-3" /> Lost</span>;
              if (match.status === 'verified') return <span className="text-green-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Done</span>;
              if (match.status === 'disputed') return <span className="text-yellow-400">Disputed</span>;
              if (match.status === 'waiting_submission') return <span className="text-blue-400">Waiting</span>;
              if (match.status === 'live') return <span className="text-secondary animate-pulse">Live</span>;
              return <span>{match.status}</span>;
            })()}
            {isClickable && <Settings className="w-3 h-3 opacity-50 hover:text-primary transition-colors" />}

            {/* Submit Match Result Button (Only for players who haven't submitted yet) */}
            {(user?.id === match.player1_id || user?.id === match.player2_id) &&
              (match.status === 'scheduled' || match.status === 'live' || match.status === 'waiting_submission') &&
              (!match.match_submissions?.some((s: any) => s.player_id === user?.id)) && (
                <Button
                  size="sm"
                  variant="default"
                  className="h-6 text-[10px] px-2 bg-primary/20 hover:bg-primary/40 text-primary border border-primary/50"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/matches/${match.id}/submit`);
                  }}
                >
                  <Upload className="w-3 h-3 mr-1" />
                  Submit
                </Button>
              )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="relative overflow-x-auto pb-12 pt-4 hide-scrollbar">
      <div className="flex justify-start items-start min-w-max px-4 mx-auto">
        {sortedRounds.map((round, roundIndex) => {
          const isFinalRound = roundIndex === sortedRounds.length - 1;
          const baseSlotHeight = 140;
          const slotHeight = baseSlotHeight * Math.pow(2, roundIndex);

          return (
            <div key={round.id} className="relative flex flex-col w-[260px] mr-12">
              <h3 className={`text-sm uppercase tracking-wider font-bold text-center mb-6 h-6 ${isFinalRound ? 'text-secondary' : 'text-muted-foreground'}`}>
                {round.name}
              </h3>
              <div className="flex flex-col relative">
                {round.matches.map((match: any, matchIndex: number) => {
                  const isTopMatchInPair = matchIndex % 2 === 0;
                  return (
                    <div key={match.id} className="relative flex items-center justify-center" style={{ height: `${slotHeight}px` }}>
                      {/* Line coming from previous round */}
                      {roundIndex > 0 && (
                        <div className="absolute left-[-24px] w-[24px] h-[2px] bg-border top-1/2 -translate-y-1/2"></div>
                      )}

                      {/* Lines branching to next round (only if not the final round) */}
                      {!isFinalRound && (
                        <>
                          <div className="absolute right-[-24px] w-[24px] h-[2px] bg-border top-1/2 -translate-y-1/2 z-0"></div>
                          <div
                            className={`absolute right-[-24px] w-[2px] bg-border z-0 ${isTopMatchInPair
                                ? 'top-1/2 h-[50%]'
                                : 'bottom-1/2 h-[50%]'
                              }`}
                          ></div>
                        </>
                      )}

                      {renderMatchCard(match)}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!selectedMatch} onOpenChange={(open) => !open && setSelectedMatch(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Match Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="text-sm bg-muted/30 p-3 rounded-lg flex justify-between items-center font-bold">
              <span>{selectedMatch?.player1?.display_name || 'TBD'}</span>
              <span className="text-muted-foreground">VS</span>
              <span>{selectedMatch?.player2?.display_name || 'TBD'}</span>
            </div>

            {/* Admin: Always show Declare Winner section (even with no submissions) */}
            {isOrganizer && selectedMatch?.status !== 'verified' && selectedMatch?.player1_id && selectedMatch?.player2_id && (
              <div className="space-y-3 border-t border-border pt-4">
                <h4 className="font-bold flex items-center gap-2 text-yellow-400">
                  <Shield className="w-4 h-4" /> Admin: Declare Winner
                </h4>
                <p className="text-xs text-muted-foreground">Manually declare a winner without requiring submissions.</p>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    className="w-full bg-primary/20 hover:bg-primary/40 border border-primary/50 text-primary"
                    onClick={() => handleResolveDispute(selectedMatch.id, selectedMatch.player1_id)}
                    disabled={resolveDispute.isPending || forceResolveMatch.isPending}
                  >
                    <Trophy className="w-4 h-4 mr-2" />
                    {selectedMatch?.player1?.display_name || 'Player 1'} Wins
                  </Button>
                  <Button
                    className="w-full bg-primary/20 hover:bg-primary/40 border border-primary/50 text-primary"
                    onClick={() => handleResolveDispute(selectedMatch.id, selectedMatch.player2_id)}
                    disabled={resolveDispute.isPending || forceResolveMatch.isPending}
                  >
                    <Trophy className="w-4 h-4 mr-2" />
                    {selectedMatch?.player2?.display_name || 'Player 2'} Wins
                  </Button>
                </div>
              </div>
            )}

            {/* Submissions Section */}
            {selectedMatch?.match_submissions && selectedMatch.match_submissions.length > 0 && (
              <div className="space-y-4 border-t border-border pt-4">
                <h4 className="font-bold flex items-center gap-2">
                  <Upload className="w-4 h-4 text-primary" /> Player Submissions
                </h4>
                <div className="grid md:grid-cols-2 gap-4">
                  {selectedMatch.match_submissions.map((sub: any) => {
                    const isPlayer1Submission = sub.player_id === selectedMatch.player1_id;
                    const player = isPlayer1Submission ? selectedMatch.player1 : selectedMatch.player2;
                    const stats = selectedMatch.match_detailed_stats?.find((st: any) => st.player_id === sub.player_id);

                    // score_reported is always stored as "P1Score-P2Score"
                    // Show from this player's perspective: their score first
                    const rawScore = sub.score_reported || "";
                    const parts = rawScore.split("-");
                    const p1Score = parts[0] || "?";
                    const p2Score = parts[1] || "?";
                    const displayScore = isPlayer1Submission ? `${p1Score} - ${p2Score}` : `${p2Score} - ${p1Score}`;
                    const displaySubLabel = isPlayer1Submission
                      ? `${selectedMatch.player1?.display_name || 'P1'} ${p1Score} – ${p2Score} ${selectedMatch.player2?.display_name || 'P2'}`
                      : `${selectedMatch.player2?.display_name || 'P2'} ${p2Score} – ${p1Score} ${selectedMatch.player1?.display_name || 'P1'}`;

                    return (
                      <div key={sub.id} className="bg-muted/10 p-4 rounded-lg border border-border space-y-4 shadow-sm">
                        <p className="font-bold text-sm text-primary">{player?.display_name || 'Unknown'}'s Submission</p>
                        <div className="text-xs text-muted-foreground text-center">{displaySubLabel}</div>

                        <div className="bg-background rounded-md p-3 text-center text-xl font-display font-bold border border-primary/20 shadow-glow-primary">
                          {displayScore}
                        </div>

                        {sub.screenshot_path && (
                          <div>
                            <div className="rounded-lg overflow-hidden border border-border bg-black/50 aspect-video flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                              onClick={() => window.open(sub.screenshot_path, '_blank')}>
                              <img src={sub.screenshot_path} alt="Screenshot" className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" />
                            </div>
                            {isOrganizer && (
                              <div className="flex flex-col gap-2 mt-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full text-xs border-border hover:border-primary/50 hover:text-primary"
                                  onClick={() => handleExtractStats(sub)}
                                  disabled={extractingSubId === sub.id}
                                >
                                  {extractingSubId === sub.id ? (
                                    <span className="flex items-center gap-2"><span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" /> Extracting...</span>
                                  ) : (
                                    <span className="flex items-center gap-2"><Upload className="w-3 h-3" /> Extract Stats from Image</span>
                                  )}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full text-xs border-border hover:border-primary/50 hover:text-primary"
                                  onClick={() => handleManualStats(sub)}
                                >
                                  Enter Stats Manually
                                </Button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Editable extracted stats panel (shown after extraction) */}
                        {isOrganizer && editableStats[sub.id] && (() => {
                          const es = editableStats[sub.id];
                          const isP1 = sub.player_id === selectedMatch.player1_id;
                          const myFields = isP1 ? es.p1 : es.p2;
                          const oppFields = isP1 ? es.p2 : es.p1;
                          const myKey = isP1 ? 'p1' : 'p2';
                          const oppKey = isP1 ? 'p2' : 'p1';
                          const STAT_LABELS = [
                            ['goals', 'Goals'], ['possession', 'Possession %'], ['shots', 'Shots'],
                            ['shots_on_target', 'Shots on Target'], ['passes', 'Total Passes'],
                            ['passes_completed', 'Successful Passes'], ['tackles', 'Tackles'],
                            ['interceptions', 'Interceptions'], ['fouls', 'Fouls'],
                            ['saves', 'Saves'], ['corners', 'Corners']
                          ];
                          return (
                            <div className="bg-background border border-primary/30 rounded-lg p-3 space-y-3">
                              <p className="text-xs font-bold text-primary uppercase tracking-wider">Review Extracted Stats</p>
                              <div className="grid grid-cols-2 gap-x-4">
                                <p className="text-xs font-bold text-center text-white mb-1">{selectedMatch.player1?.display_name}</p>
                                <p className="text-xs font-bold text-center text-white mb-1">{selectedMatch.player2?.display_name}</p>
                              </div>
                              {STAT_LABELS.map(([key, label]) => (
                                <div key={key} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
                                  <input
                                    type="number" min="0"
                                    value={es.p1[key] ?? 0}
                                    onChange={e => setEditableStats(prev => ({ ...prev, [sub.id]: { ...prev[sub.id], p1: { ...prev[sub.id].p1, [key]: Number(e.target.value) } } }))}
                                    className="w-full bg-muted border border-border rounded px-2 py-1 text-center text-white"
                                  />
                                  <span className="text-muted-foreground text-center whitespace-nowrap">{label}</span>
                                  <input
                                    type="number" min="0"
                                    value={es.p2[key] ?? 0}
                                    onChange={e => setEditableStats(prev => ({ ...prev, [sub.id]: { ...prev[sub.id], p2: { ...prev[sub.id].p2, [key]: Number(e.target.value) } } }))}
                                    className="w-full bg-muted border border-border rounded px-2 py-1 text-center text-white"
                                  />
                                </div>
                              ))}
                              <Button
                                className="w-full bg-green-600 hover:bg-green-700 text-white mt-2"
                                size="sm"
                                onClick={() => handleSaveStats(sub)}
                                disabled={savingSubId === sub.id}
                              >
                                {savingSubId === sub.id ? 'Saving...' : '✓ Save Stats to Database'}
                              </Button>
                            </div>
                          );
                        })()}

                        {/* Already saved stats display */}
                        {stats && !editableStats[sub.id] && (
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs bg-background p-3 rounded-md border border-border">
                            <div className="text-muted-foreground">Goals</div><div className="text-right font-bold text-white">{stats.goals}</div>
                            <div className="text-muted-foreground">Possession</div><div className="text-right font-bold text-white">{stats.possession}%</div>
                            <div className="text-muted-foreground">Shots</div><div className="text-right font-bold text-white">{stats.shots}</div>
                            <div className="text-muted-foreground">Passes</div><div className="text-right font-bold text-white">{stats.passes}</div>
                          </div>
                        )}

                        {/* Force Accept from single submission */}
                        {isOrganizer && selectedMatch.status !== 'verified' && selectedMatch.match_submissions.length === 1 && (
                          <div className="pt-2">
                            <Button
                              variant="outline"
                              className="w-full text-primary border-primary hover:bg-primary/10"
                              onClick={() => handleForceResolve(selectedMatch.id, sub.id)}
                              disabled={resolveDispute.isPending || forceResolveMatch.isPending}
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Force Accept This Submission
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Schedule Section */}
            <div className="space-y-4 border-t border-border pt-4">
              <h4 className="font-bold flex items-center gap-2">
                <Settings className="w-4 h-4 text-muted-foreground" /> Schedule Settings
              </h4>
              <div className="grid md:grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>Match Deadline (Timeout)</Label>
                  <Input
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedMatch(null)}>Cancel</Button>
            <Button onClick={handleSaveSchedule} disabled={updateSchedule.isPending}>
              {updateSchedule.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
