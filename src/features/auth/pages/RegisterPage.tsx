import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Clock, CheckCircle2, Shield, Swords, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/services/supabase";
import { countryCodes } from "@/lib/countryCodes";

type Step = 'form' | 'success';

const RegisterPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('form');
  const [playerName, setPlayerName] = useState('');
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    countryCode: "+91",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setIsLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            phone: `${formData.countryCode} ${formData.phone}`,
          },
        },
      });
      if (signUpError) { toast.error(signUpError.message); return; }
      setPlayerName(formData.fullName);
      setStep('success');
      await supabase.auth.signOut();
    } catch {
      toast.error("An unexpected error occurred during registration");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <AnimatePresence mode="wait">
        {step === 'form' ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-sm"
          >
            {/* Logo */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 mb-4">
                <Swords className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Create Account</h1>
              <p className="text-sm text-muted-foreground mt-1">Request access to compete</p>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.4),0_4px_16px_rgba(0,0,0,0.2)]">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Your full name"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                    disabled={isLoading}
                    className="h-10 bg-background border-border"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    disabled={isLoading}
                    className="h-10 bg-background border-border"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-sm font-medium">Phone Number</Label>
                  <div className="flex gap-2">
                    <select
                      className="h-10 w-28 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                      value={formData.countryCode}
                      onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}
                      disabled={isLoading}
                    >
                      <option value="+91">🇮🇳 +91</option>
                      {countryCodes.filter(c => c.code !== "+91").map((c, idx) => (
                        <option key={idx} value={c.code}>{c.label}</option>
                      ))}
                    </select>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="99999 00000"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/[^0-9]/g, '') })}
                      required
                      disabled={isLoading}
                      className="flex-1 h-10 bg-background border-border"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Min. 6 characters"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    disabled={isLoading}
                    className="h-10 bg-background border-border"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Re-enter password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                    disabled={isLoading}
                    className="h-10 bg-background border-border"
                  />
                </div>

                <Button type="submit" className="w-full h-10 font-medium mt-2" disabled={isLoading}>
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <UserPlus className="w-4 h-4" />
                      Request Access
                    </span>
                  )}
                </Button>
              </form>

              <div className="mt-4 pt-4 border-t border-border text-center">
                <p className="text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/login")}
                    className="text-primary hover:text-primary/80 font-medium transition-colors"
                  >
                    Sign in
                  </button>
                </p>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-sm"
          >
            <div className="bg-card border border-border rounded-2xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.4),0_4px_16px_rgba(0,0,0,0.2)] text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 mb-6">
                <Shield className="w-6 h-6 text-primary" />
              </div>

              <h1 className="text-xl font-bold mb-1">Request Submitted</h1>
              <p className="text-sm text-muted-foreground mb-6">
                <span className="text-foreground font-medium">{playerName}</span>, your account is pending admin approval.
              </p>

              <div className="bg-background border border-border rounded-xl p-4 mb-6 text-left space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">Account created successfully</p>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">Verification email sent. Please check your inbox to confirm.</p>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">Awaiting admin approval before you can log in</p>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">Typically approved within 24 hours</p>
                </div>
              </div>

              <Button className="w-full h-10 font-medium" onClick={() => navigate("/login")}>
                Go to Sign In
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RegisterPage;
