import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, Users, Zap, Shield, Target, Award } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/services/supabase";

const Index = () => {
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ["landing-stats"],
    queryFn: async () => {
      const [profiles, tournaments, matches] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('tournaments').select('*', { count: 'exact', head: true }).neq('status', 'completed'),
        supabase.from('matches').select('*', { count: 'exact', head: true }).in('status', ['completed', 'verified'])
      ]);

      return {
        players: profiles.count || 0,
        tournaments: tournaments.count || 0,
        matches: matches.count || 0
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const features = [
    {
      icon: Trophy,
      title: "Tournament Fixtures",
      description: "Automated fixture generation with real-time updates",
    },
    {
      icon: Shield,
      title: "Anti-Cheat System",
      description: "Dual verification and screenshot proof required",
    },
    {
      icon: Zap,
      title: "Live Scoring",
      description: "Real-time match updates and score tracking",
    },
    {
      icon: Users,
      title: "Player Management",
      description: "Unique player IDs and secure authentication",
    },
    {
      icon: Target,
      title: "Match Reporting",
      description: "Both players report scores with proof verification",
    },
    {
      icon: Award,
      title: "Leaderboards",
      description: "Track rankings and tournament statistics",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-8">
        <nav className="flex justify-between items-center mb-16">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2"
          >
            <Trophy className="w-8 h-8 text-primary" />
            <span className="text-2xl font-display font-bold">eFootball Arena</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex gap-4"
          >
            <Button variant="ghost" onClick={() => navigate("/login")}>
              Sign In
            </Button>
            <Button variant="default" onClick={() => navigate("/register")}>
              Register
            </Button>
          </motion.div>
        </nav>

        <div className="text-center max-w-5xl mx-auto mb-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-6xl md:text-8xl font-display font-bold mb-6 bg-gradient-to-r from-primary via-primary-glow to-secondary bg-clip-text text-transparent">
              Compete in Elite Tournaments
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
              Join the ultimate eFootball Mobile competitive platform. Secure match reporting,
              live fixtures, and anti-cheat protection.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Button
                size="lg"
                className="text-lg h-14 px-8 shadow-glow-primary hover:shadow-glow-primary transition-all"
                onClick={() => navigate("/register")}
              >
                Join Tournament
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg h-14 px-8"
                onClick={() => navigate("/tournaments")}
              >
                View Fixtures
              </Button>
            </div>
          </motion.div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
            >
              <Card className="p-6 bg-card hover:bg-card-glow transition-all duration-300 border-border hover:border-primary/50 hover:shadow-glow-primary group cursor-pointer">
                <feature.icon className="w-12 h-12 text-primary mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="text-xl font-display font-bold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Stats Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-gradient-card border border-border rounded-2xl p-8 md:p-12 shadow-card"
        >
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-5xl font-display font-bold text-primary mb-2">
                {stats ? stats.players.toLocaleString() : "..."}
              </div>
              <div className="text-muted-foreground">Active Players</div>
            </div>
            <div>
              <div className="text-5xl font-display font-bold text-secondary mb-2">
                {stats ? stats.tournaments.toLocaleString() : "..."}
              </div>
              <div className="text-muted-foreground">Live Tournaments</div>
            </div>
            <div>
              <div className="text-5xl font-display font-bold text-primary mb-2">
                {stats ? stats.matches.toLocaleString() : "..."}
              </div>
              <div className="text-muted-foreground">Matches Played</div>
            </div>
          </div>
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-20 mb-8"
        >
          <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">
            Ready to Dominate?
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Create your account, get your unique player ID, and start competing in professional
            eFootball tournaments today.
          </p>
          <Button
            size="lg"
            className="text-lg h-14 px-12 bg-gradient-secondary hover:opacity-90 transition-all shadow-glow-secondary"
            onClick={() => navigate("/register")}
          >
            Get Started Now
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default Index;
