import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Swords, AtSign, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/services/supabase";

const Login = () => {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let emailToUse: string;

      const isEmail = identifier.includes('@') && !identifier.endsWith('@arena.internal');

      if (isEmail) {
        // Old account: user typed a real email — use it directly
        emailToUse = identifier.trim();
      } else {
        // New account: user typed a username or player_id
        // Resolve to the internal auth email via the RPC
        const { data: resolvedEmail, error: rpcError } = await supabase
          .rpc('get_email_by_identifier', { p_identifier: identifier.trim() });

        if (rpcError || !resolvedEmail) {
          toast.error('No account found with that username or Player ID');
          return;
        }
        emailToUse = resolvedEmail as string;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password,
      });

      if (error) {
        // Surface a clean message for wrong password / user not found
        if (error.message.toLowerCase().includes('invalid login credentials') ||
            error.message.toLowerCase().includes('invalid credentials')) {
          toast.error('Incorrect password. Please try again.');
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success('Signed in');

      // Resolve role to decide where to navigate
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role:role_id(name)')
        .eq('user_id', data.user?.id)
        .maybeSingle();

      const roleName = (roleData?.role as any)?.name;
      navigate(roleName === 'admin' ? '/admin' : '/dashboard', { replace: true });
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 mb-4">
            <Swords className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">eFootball Arena</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.4),0_4px_16px_rgba(0,0,0,0.2)]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="identifier" className="text-sm font-medium">
                Username / Player ID / Email
              </Label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="identifier"
                  type="text"
                  placeholder="username, PLR-XXXX, or email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="username"
                  className="h-10 bg-background border-border pl-9 focus-visible:ring-primary/30"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                  className="h-10 bg-background border-border pl-9 focus-visible:ring-primary/30"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-10 font-medium mt-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  Sign in
                </span>
              )}
            </Button>
          </form>

          <div className="mt-4 pt-4 border-t border-border text-center">
            <p className="text-sm text-muted-foreground">
              No account?{" "}
              <button
                type="button"
                onClick={() => navigate("/register")}
                className="text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Register
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
