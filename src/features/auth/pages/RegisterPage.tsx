import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trophy, ArrowLeft, UserPlus, Clock, CheckCircle2, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/services/supabase";

type Step = 'form' | 'success';

const RegisterPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('form');
  const [playerName, setPlayerName] = useState('');
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
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

            phone: formData.phone,
          },
        },
      });

      if (signUpError) {
        toast.error(signUpError.message);
        return;
      }

      // Profile is created by trigger with status='pending'
      setPlayerName(formData.fullName);
      setStep('success');

      // Sign out immediately so they can't bypass the pending screen
      await supabase.auth.signOut();

    } catch (err) {
      toast.error("An unexpected error occurred during registration");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <AnimatePresence mode="wait">
        {step === 'form' ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md"
          >
            <Button
              variant="ghost"
              className="mb-6"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>

            <Card className="p-8 bg-card border-border shadow-elevated">
              <div className="flex items-center justify-center mb-6">
                <div className="bg-primary/10 p-4 rounded-full">
                  <Trophy className="w-12 h-12 text-primary" />
                </div>
              </div>

              <h1 className="text-3xl font-display font-bold text-center mb-2">
                Join the Arena
              </h1>
              <p className="text-center text-muted-foreground mb-8">
                Submit your access request to compete
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Enter your full name"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                    className="mt-1"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="mt-1"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+91 99999 00000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                    className="mt-1"
                    disabled={isLoading}
                  />
                </div>


                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Create a strong password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    className="mt-1"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Re-enter your password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                    className="mt-1"
                    disabled={isLoading}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full shadow-glow-primary"
                  size="lg"
                  disabled={isLoading}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  {isLoading ? "Submitting Request..." : "Request Access"}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/login")}
                    className="text-primary hover:underline"
                  >
                    Sign in here
                  </button>
                </p>
              </div>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md text-center"
          >
            <Card className="p-10 bg-card border-border shadow-elevated">
              {/* Icon */}
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
                    <Shield className="w-12 h-12 text-primary" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                    <Clock className="w-4 h-4 text-black" />
                  </div>
                </div>
              </div>

              <h1 className="text-3xl font-display font-bold mb-3">
                Request Sent!
              </h1>
              <p className="text-xl text-primary font-semibold mb-4">{playerName}</p>

              <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 mb-6 text-left space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">Your account has been created and is <strong className="text-white">pending admin approval</strong>.</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">Once approved, you'll be able to log in and join tournaments.</p>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">Approval is typically done within 24 hours.</p>
                </div>
              </div>

              <Button
                className="w-full shadow-glow-primary"
                onClick={() => navigate("/login")}
              >
                Go to Login
              </Button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RegisterPage;
