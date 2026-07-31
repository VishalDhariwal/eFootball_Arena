import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, Users, Zap, Shield, Target, Award, Globe, Coins, CalendarDays, Activity, ShieldCheck } from "lucide-react";
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

  const infoCards = [
    { icon: CalendarDays, text: "Coming Soon: Official League Matches", color: "text-blue-400" },
    { icon: Activity, text: "Dynamic Real-Time Elo Rating System", color: "text-green-400" },
    { icon: ShieldCheck, text: "Strict Anti-Cheat & Proof Verification", color: "text-purple-400" },
    { icon: Coins, text: "Monthly Leaderboard Rewards", color: "text-yellow-400" },
    { icon: Globe, text: "Climb the Global Player Leaderboards", color: "text-cyan-400" },
  ];

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-6">
        <nav className="flex justify-between items-center mb-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2"
          >
            <span className="text-2xl font-display font-bold tracking-tight leading-none flex flex-col">
              <span>eFootball</span>
              <span className="text-primary">Arena</span>
            </span>
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

        {/* Scrolling Info Cards Marquee - MOVED BELOW NAVBAR */}
        <div className="relative w-full overflow-hidden mb-12 py-4">
          <div className="absolute left-0 top-0 bottom-0 w-16 md:w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none"></div>
          <div className="absolute right-0 top-0 bottom-0 w-16 md:w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none"></div>
          
          <div className="flex w-max animate-marquee gap-6">
            {[...infoCards, ...infoCards, ...infoCards, ...infoCards].map((card, i) => (
              <Card key={i} className="flex-shrink-0 flex items-center gap-3 py-3 px-6 bg-card/60 backdrop-blur-sm border-border rounded-full shadow-sm hover:border-primary/50 transition-all cursor-default">
                <card.icon className={`w-5 h-5 ${card.color}`} />
                <span className="text-sm font-medium whitespace-nowrap text-foreground">{card.text}</span>
              </Card>
            ))}
          </div>
        </div>

        <div className="text-center max-w-5xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl md:text-8xl font-display font-bold mb-6 text-foreground">
              Compete in Elite Tournaments
            </h1>
            <p className="text-lg md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
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
              <div className="text-5xl font-display font-bold text-primary mb-2">
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
