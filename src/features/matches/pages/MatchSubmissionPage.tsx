import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, ArrowLeft, Upload, Shield } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useMatch, useSubmitScore, useUploadScreenshot } from "@/features/matches/hooks/useMatches";

const MatchSubmissionPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const { data: match, isLoading } = useMatch(id || "");
  const submitScore = useSubmitScore();
  const uploadScreenshot = useUploadScreenshot();

  useEffect(() => {
    if (!match?.id) return;
    
    const channel = supabase
      .channel(`match-updates-${match.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${match.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["match", match.id] });
          queryClient.invalidateQueries({ queryKey: ["player_matches"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [match?.id, queryClient]);

  const [yourScore, setYourScore] = useState("");
  const [opponentScore, setOpponentScore] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !match) return;
    
    if (!screenshot) {
      toast.error("Screenshot proof is required");
      return;
    }
    
    if (yourScore === "" || opponentScore === "") {
      toast.error("Please enter both scores");
      return;
    }

    try {
      toast.loading("Uploading screenshot...");
      const publicUrl = await uploadScreenshot.mutateAsync({
        file: screenshot,
        matchId: match.id,
        userId: user.id
      });
      
      toast.dismiss();
      toast.loading("Submitting score...");
      
      // Ensure format is ALWAYS P1_SCORE-P2_SCORE
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
      toast.success("Score submitted! Verification pending.");
      navigate("/dashboard");
    } catch (error: any) {
      toast.dismiss();
      toast.error("Failed to submit score: " + error.message);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be under 5MB");
        return;
      }
      setScreenshot(file);
    }
  };

  if (isLoading) return <div className="text-center py-20 text-white">Loading match details...</div>;
  if (!match) return <div className="text-center py-20 text-white">Match not found</div>;
  if (match.status !== 'scheduled' && match.status !== 'live' && match.status !== 'waiting_submission') {
     return <div className="text-center py-20 text-white">This match is not accepting submissions (Status: {match.status})</div>;
  }

  // Determine opponent name
  const opponentName = user?.id === match.player1_id 
    ? match.player2?.display_name 
    : match.player1?.display_name;

  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Button variant="ghost" className="mb-6" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-8 bg-card border-border shadow-elevated">
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-primary/10 p-4 rounded-full">
                <Target className="w-10 h-10 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-display font-bold">Report Match Score</h1>
                <p className="text-muted-foreground">{match.tournament?.name}</p>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6 flex items-start gap-3">
              <Shield className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-primary mb-1">Auto-Verification Active</p>
                <p className="text-muted-foreground">
                  Your opponent must also submit their score. If both scores match, the result is verified automatically. Mismatches will be flagged as disputed.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="yourScore">Your Score</Label>
                  <Input
                    id="yourScore"
                    type="number"
                    min="0"
                    value={yourScore}
                    onChange={(e) => setYourScore(e.target.value)}
                    required
                    className="text-center text-2xl font-display font-bold"
                  />
                  <p className="text-xs text-center text-muted-foreground">You</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="opponentScore">Opponent's Score</Label>
                  <Input
                    id="opponentScore"
                    type="number"
                    min="0"
                    value={opponentScore}
                    onChange={(e) => setOpponentScore(e.target.value)}
                    required
                    className="text-center text-2xl font-display font-bold"
                  />
                  <p className="text-xs text-center text-muted-foreground">{opponentName || "Opponent"}</p>
                </div>
              </div>

              <div>
                <Label htmlFor="screenshot">Screenshot Proof (Required)</Label>
                <div className="mt-1">
                  <div className="flex items-center gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full relative overflow-hidden"
                      onClick={() => document.getElementById("screenshot")?.click()}
                    >
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        {screenshot ? screenshot.name : "Upload Screenshot"}
                      </>
                    </Button>
                    <input
                      id="screenshot"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Max size: 5MB. Will automatically extract advanced stats (Possession, Shots, Passes).
                  </p>
                </div>
              </div>



              <div className="pt-4 space-y-3">
                <Button
                  type="submit"
                  className="w-full shadow-glow-primary"
                  size="lg"
                  disabled={submitScore.isPending || uploadScreenshot.isPending}
                >
                  <Target className="w-4 h-4 mr-2" />
                  {submitScore.isPending || uploadScreenshot.isPending ? "Processing..." : "Submit Score"}
                </Button>
              </div>
            </form>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};
export default MatchSubmissionPage;
