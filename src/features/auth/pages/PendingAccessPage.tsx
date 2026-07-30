import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shield, Clock, LogOut, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/services/supabase";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/hooks/useAuth";

const PendingAccessPage = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out");
    navigate("/login");
  };

  const isRejected = profile?.status === 'rejected';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-sm text-center"
      >
        <Card className="p-8 bg-card border-border">
          {/* Icon */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className={`w-28 h-28 rounded-full flex items-center justify-center ${isRejected ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                {isRejected ? (
                  <AlertTriangle className="w-14 h-14 text-destructive" />
                ) : (
                  <Shield className="w-14 h-14 text-primary" />
                )}
              </div>
              {!isRejected && (
                <div className="absolute -bottom-1 -right-1 w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center shadow-lg">
                  <Clock className="w-5 h-5 text-black" />
                </div>
              )}
            </div>
          </div>

          {isRejected ? (
            <>
              <h1 className="text-3xl font-display font-bold mb-3 text-destructive">
                Access Denied
              </h1>
              <p className="text-muted-foreground mb-6">
                Your access request has been <strong className="text-destructive">rejected</strong> by an administrator. If you believe this is a mistake, please contact us.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-display font-bold mb-3">
                Awaiting Approval
              </h1>
              <p className="text-muted-foreground mb-6">
                Welcome, <strong className="text-white">{profile?.display_name || 'Player'}</strong>! Your access request is being reviewed by an administrator.
              </p>
            </>
          )}

          {!isRejected && (
            <div className="bg-gradient-to-br from-primary/5 to-secondary/5 border border-primary/20 rounded-xl p-6 mb-8 text-left space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-bold text-sm">1</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Request Submitted</p>
                  <p className="text-xs text-muted-foreground">Your profile has been created</p>
                </div>
              </div>

              <div className="w-px h-6 bg-border ml-4" />

              <div className="flex items-center gap-3 opacity-60">
                <div className="w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-yellow-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Admin Review</p>
                  <p className="text-xs text-muted-foreground">Pending — typically within 24 hours</p>
                </div>
              </div>

              <div className="w-px h-6 bg-border ml-4" />

              <div className="flex items-center gap-3 opacity-40">
                <div className="w-8 h-8 bg-success/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-success font-bold text-sm">3</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Access Granted</p>
                  <p className="text-xs text-muted-foreground">You can join tournaments and compete</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-6">
            Your Player ID: <span className="text-primary font-mono">{profile?.player_id || '---'}</span>
          </p>
        </Card>
      </motion.div>
    </div>
  );
};

export default PendingAccessPage;
