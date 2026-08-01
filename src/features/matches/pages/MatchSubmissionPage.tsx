import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Target, ArrowLeft, Upload, Shield, CheckCircle, AlertTriangle,
  ImageIcon, Eye, Flag, Clock, Swords
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/features/auth/hooks/useAuth";
import {
  useMatch, useSubmitScore, useUploadScreenshot, useRaiseDispute
} from "@/features/matches/hooks/useMatches";

// ── Screenshot viewer modal ──────────────────────────────────────────────────
const ScreenshotModal = ({
  url, onClose
}: { url: string; onClose: () => void }) => (
  <motion.div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    onClick={onClose}
  >
    <motion.div
      initial={{ scale: 0.92, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.92, opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="relative max-w-3xl w-full"
      onClick={(e) => e.stopPropagation()}
    >
      <img
        src={url}
        alt="Match screenshot"
        className="w-full rounded-xl border border-border shadow-2xl"
      />
      <button
        onClick={onClose}
        className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg transition-colors"
      >
        ×
      </button>
    </motion.div>
  </motion.div>
);

// ── Submission card ──────────────────────────────────────────────────────────
const SubmissionCard = ({
  label,
  playerName,
  scoreReported,
  screenshotUrl,
  isYou,
}: {
  label: string;
  playerName: string;
  scoreReported: string;
  screenshotUrl?: string | null;
  isYou: boolean;
}) => {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className={`rounded-xl border p-4 space-y-3 ${isYou
        ? 'bg-primary/5 border-primary/20'
        : 'bg-orange-500/5 border-orange-500/20'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide ${isYou ? 'text-primary' : 'text-orange-400'}`}>
              {label}
            </p>
            <p className="text-sm font-medium text-foreground mt-0.5">{playerName}</p>
          </div>
          <div className={`text-2xl font-bold font-mono ${isYou ? 'text-primary' : 'text-orange-400'}`}>
            {scoreReported}
          </div>
        </div>

        {screenshotUrl ? (
          <button
            onClick={() => setShowModal(true)}
            className="w-full group relative rounded-lg overflow-hidden border border-border hover:border-primary/40 transition-colors"
          >
            <img
              src={screenshotUrl}
              alt="Screenshot"
              className="w-full h-28 object-cover object-top"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-sm font-medium">
              <Eye className="w-4 h-4" /> View Full
            </div>
          </button>
        ) : (
          <div className="h-16 rounded-lg bg-muted/30 border border-border flex items-center justify-center gap-2 text-muted-foreground text-xs">
            <ImageIcon className="w-4 h-4" /> No screenshot
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && screenshotUrl && (
          <ScreenshotModal url={screenshotUrl} onClose={() => setShowModal(false)} />
        )}
      </AnimatePresence>
    </>
  );
};

// ── Main Page ────────────────────────────────────────────────────────────────
const MatchSubmissionPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: match, isLoading } = useMatch(id || "");
  const submitScore = useSubmitScore();
  const uploadScreenshot = useUploadScreenshot();
  const raiseDispute = useRaiseDispute();

  // Realtime updates
  useEffect(() => {
    if (!match?.id) return;
    const channel = supabase
      .channel(`match-updates-${match.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'matches',
        filter: `id=eq.${match.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["match", match.id] });
        queryClient.invalidateQueries({ queryKey: ["player_matches"] });
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'match_submissions',
        filter: `match_id=eq.${match.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["match", match.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [match?.id, queryClient]);

  const [yourScore, setYourScore] = useState("");
  const [opponentScore, setOpponentScore] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [showObjectionConfirm, setShowObjectionConfirm] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { toast.error("File size must be under 5MB"); return; }
      setScreenshot(file);
      setScreenshotPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !match) return;
    if (!screenshot) { toast.error("Screenshot proof is required"); return; }
    if (yourScore === "" || opponentScore === "") { toast.error("Please enter both scores"); return; }

    try {
      toast.loading("Uploading screenshot...");
      const publicUrl = await uploadScreenshot.mutateAsync({ file: screenshot, matchId: match.id, userId: user.id });
      toast.dismiss();
      toast.loading("Submitting score...");

      let finalScoreString = "";
      if (user.id === match.player1_id) {
        finalScoreString = `${yourScore}-${opponentScore}`;
      } else if (user.id === match.player2_id) {
        finalScoreString = `${opponentScore}-${yourScore}`;
      } else {
        throw new Error("You are not a participant in this match.");
      }

      await submitScore.mutateAsync({
        match_id: match.id,
        player_id: user.id,
        score_reported: finalScoreString,
        screenshot_path: publicUrl,
      });

      toast.dismiss();
      toast.success("Score submitted!");
      queryClient.invalidateQueries({ queryKey: ["match", match.id] });
    } catch (error: any) {
      toast.dismiss();
      toast.error("Failed to submit: " + error.message);
    }
  };

  const handleRaiseObjection = async () => {
    if (!match) return;
    try {
      await raiseDispute.mutateAsync({ matchId: match.id });
      setShowObjectionConfirm(false);
      toast.success("Objection raised! The organizer will review the match.");
    } catch (error: any) {
      toast.error("Failed to raise objection: " + error.message);
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
  if (!match) return <div className="text-center py-20 text-white">Match not found</div>;

  const isDisputed = match.status === 'disputed';
  const isVerified = match.status === 'verified';
  const acceptableStatuses = ['scheduled', 'live', 'waiting_submission', 'disputed'];
  if (!acceptableStatuses.includes(match.status)) {
    return <div className="text-center py-20 text-white">This match is not accepting submissions (Status: {match.status})</div>;
  }

  const isP1 = user?.id === match.player1_id;
  const mySubmission = (match.match_submissions as any[])?.find((s: any) => s.player_id === user?.id);
  const opponentId = isP1 ? match.player2_id : match.player1_id;
  const opponentSubmission = (match.match_submissions as any[])?.find((s: any) => s.player_id === opponentId);
  const opponentProfile = isP1 ? (match.player2 as any) : (match.player1 as any);
  const myProfile = isP1 ? (match.player1 as any) : (match.player2 as any);

  // Format score for display: always P1-P2, but we show from viewer's perspective
  const formatMyScore = (scoreStr: string) => {
    if (!scoreStr) return "-";
    const [p1, p2] = scoreStr.split('-').map(Number);
    return isP1 ? `${p1} – ${p2}` : `${p2} – ${p1}`;
  };

  const hasSubmitted = !!mySubmission;
  const opponentHasSubmitted = !!opponentSubmission;
  const canObjectToOpponent = hasSubmitted && opponentHasSubmitted && !isDisputed;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Button variant="ghost" size="sm" className="mb-6 text-muted-foreground" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Swords className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Match Result</h1>
              <p className="text-xs text-muted-foreground">{(match as any).tournament?.name}</p>
            </div>
          </div>

          {/* Disputed banner */}
          {isDisputed && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 flex items-start gap-3 bg-red-500/10 border border-red-500/25 rounded-xl p-4"
            >
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-400">Objection Raised</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  This match is now under review. The organizer will verify both screenshots and decide the result.
                </p>
              </div>
            </motion.div>
          )}

          {/* Both submissions view — shown when at least one has submitted */}
          {(hasSubmitted || opponentHasSubmitted) && (
            <Card className="bg-card border-border mb-5">
              <CardContent className="p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary" />
                  Submitted Results
                </h2>
                <div className="space-y-3">
                  {hasSubmitted && (
                    <SubmissionCard
                      label="Your Submission"
                      playerName={myProfile?.display_name || "You"}
                      scoreReported={formatMyScore(mySubmission.score_reported)}
                      screenshotUrl={mySubmission.screenshot_path}
                      isYou={true}
                    />
                  )}

                  {opponentHasSubmitted ? (
                    <SubmissionCard
                      label="Opponent's Submission"
                      playerName={opponentProfile?.display_name || "Opponent"}
                      scoreReported={formatMyScore(opponentSubmission.score_reported)}
                      screenshotUrl={opponentSubmission.screenshot_path}
                      isYou={false}
                    />
                  ) : (
                    <div className="rounded-xl border border-border bg-muted/20 p-4 flex items-center gap-3">
                      <Clock className="w-5 h-5 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Waiting for {opponentProfile?.display_name || "opponent"} to submit
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-0.5">
                          The result will be auto-verified once both sides submit.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Objection CTA */}
                {canObjectToOpponent && !isDisputed && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 pt-4 border-t border-border"
                  >
                    {!showObjectionConfirm ? (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-start gap-2">
                          <Flag className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-muted-foreground">
                            Disagree with opponent's submission? Raise an objection for organizer review.
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 border-orange-500/30 text-orange-400 hover:bg-orange-500/10 hover:border-orange-500/50"
                          onClick={() => setShowObjectionConfirm(true)}
                        >
                          <Flag className="w-3.5 h-3.5 mr-1.5" />
                          Raise Objection
                        </Button>
                      </div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-orange-500/10 border border-orange-500/25 rounded-xl p-4"
                      >
                        <p className="text-sm font-semibold text-orange-400 mb-1 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4" /> Confirm Objection
                        </p>
                        <p className="text-xs text-muted-foreground mb-4">
                          This will flag the match as disputed. The organizer will review both screenshots and manually decide the winner. Are you sure?
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-orange-500 hover:bg-orange-600 text-white flex-1"
                            disabled={raiseDispute.isPending}
                            onClick={handleRaiseObjection}
                          >
                            {raiseDispute.isPending ? "Raising..." : "Yes, Raise Objection"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowObjectionConfirm(false)}
                            disabled={raiseDispute.isPending}
                          >
                            Cancel
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Submission form — only shown if user hasn't submitted yet */}
          {!hasSubmitted && !isDisputed && (
            <Card className="bg-card border-border">
              <CardContent className="p-5">
                <h2 className="text-sm font-semibold mb-1 flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" /> Submit Your Score
                </h2>
                <p className="text-xs text-muted-foreground mb-5">
                  Upload your match screenshot and report the score.
                </p>

                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-5 flex items-start gap-2.5">
                  <Shield className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-primary">Auto-verification: </span>
                    If both players report the same score, the result is confirmed automatically. Mismatches are flagged.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Scores */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="yourScore" className="text-xs">Your Score</Label>
                      <Input
                        id="yourScore" type="number" min="0"
                        value={yourScore} onChange={(e) => setYourScore(e.target.value)}
                        required className="text-center text-xl font-bold h-12"
                      />
                      <p className="text-xs text-center text-muted-foreground">You</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="opponentScore" className="text-xs">Opponent's Score</Label>
                      <Input
                        id="opponentScore" type="number" min="0"
                        value={opponentScore} onChange={(e) => setOpponentScore(e.target.value)}
                        required className="text-center text-xl font-bold h-12"
                      />
                      <p className="text-xs text-center text-muted-foreground">
                        {opponentProfile?.display_name || "Opponent"}
                      </p>
                    </div>
                  </div>

                  {/* Screenshot upload */}
                  <div className="space-y-2">
                    <Label className="text-xs">Screenshot Proof <span className="text-destructive">*</span></Label>
                    <div
                      className="border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
                      onClick={() => document.getElementById("screenshot")?.click()}
                    >
                      {screenshotPreview ? (
                        <div className="space-y-2">
                          <img
                            src={screenshotPreview}
                            alt="Preview"
                            className="w-full h-36 object-cover object-top rounded-lg"
                          />
                          <p className="text-xs text-muted-foreground">{screenshot?.name}</p>
                        </div>
                      ) : (
                        <div className="py-4 space-y-2">
                          <Upload className="w-8 h-8 mx-auto text-muted-foreground/50" />
                          <p className="text-sm text-muted-foreground">Click to upload screenshot</p>
                          <p className="text-xs text-muted-foreground/60">Max 5MB · PNG, JPG, WebP</p>
                        </div>
                      )}
                    </div>
                    <input
                      id="screenshot" type="file" accept="image/*"
                      onChange={handleFileChange} className="hidden"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 font-medium"
                    disabled={submitScore.isPending || uploadScreenshot.isPending}
                  >
                    {submitScore.isPending || uploadScreenshot.isPending ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Processing...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" /> Submit Score
                      </span>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Already submitted — waiting for opponent */}
          {hasSubmitted && !opponentHasSubmitted && !isDisputed && (
            <Card className="bg-card border-border">
              <CardContent className="p-5 text-center">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-6 h-6 text-primary" />
                </div>
                <p className="font-semibold mb-1">Score Submitted</p>
                <p className="text-sm text-muted-foreground">
                  Waiting for <span className="text-foreground font-medium">{opponentProfile?.display_name || "your opponent"}</span> to submit their score.
                </p>
                <p className="text-xs text-muted-foreground/70 mt-2">
                  This page will update automatically when they submit.
                </p>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default MatchSubmissionPage;
