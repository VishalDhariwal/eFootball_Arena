import { usePlayerAttributeRatings } from "@/features/stats/hooks/usePlayerAttributeRatings";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/components/ui/card";
import { Target, Activity, Shield, Crosshair, AlertTriangle, PlayCircle } from "lucide-react";
import { motion } from "framer-motion";

export const PlayerPerformance = ({ userId }: { userId: string | undefined }) => {
  const { data: ratings, isLoading } = usePlayerAttributeRatings(userId);

  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground animate-pulse">
        Loading player performance ratings...
      </div>
    );
  }

  // If no ratings yet, display default empty state
  if (!ratings) {
    return (
      <Card className="p-12 bg-gradient-card border-border flex flex-col items-center justify-center text-center">
        <Target className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
        <h3 className="text-xl font-display font-bold text-muted-foreground mb-2">No Performance Data</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Play and submit match statistics to generate your unique eFootball player profile and global ratings.
        </p>
      </Card>
    );
  }

  // Placement Matches (Hidden Ratings)
  if (ratings.rating_confidence === 'Low') {
    return (
      <Card className="p-12 bg-gradient-card border-border relative overflow-hidden flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <Shield className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-3xl font-display font-black tracking-tight mb-2 uppercase">Placement Matches</h3>
        <p className="text-muted-foreground max-w-md mb-6">
          Your eFootball rating is currently being calibrated. Complete 5 matches to reveal your Overall Rating, Play Style, and Attribute Radar.
        </p>
        <div className="bg-background/50 border border-border/50 rounded-xl px-6 py-3 font-bold text-lg text-primary tracking-widest shadow-inner">
          TBD (Needs 5 Matches)
        </div>
      </Card>
    );
  }

  const radarData = [
    { subject: 'Shooting', A: ratings.shooting_score, fullMark: 100 },
    { subject: 'Passing', A: ratings.passing_score, fullMark: 100 },
    { subject: 'Possession', A: ratings.possession_score, fullMark: 100 },
    { subject: 'Defending', A: ratings.defending_score, fullMark: 100 },
    { subject: 'Finishing', A: ratings.finishing_score, fullMark: 100 },
    { subject: 'Discipline', A: ratings.discipline_score, fullMark: 100 },
  ];

  const getTier = (score: number) => {
    if (score >= 95) return { name: "Legendary", color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/20" };
    if (score >= 90) return { name: "Elite", color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" };
    if (score >= 80) return { name: "Excellent", color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20" };
    if (score >= 70) return { name: "Good", color: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/20" };
    if (score >= 60) return { name: "Average", color: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/20" };
    return { name: "Needs Improvement", color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20" };
  };

  const attributesList = [
    { key: "Shooting", icon: Target, score: ratings.shooting_score },
    { key: "Passing", icon: Activity, score: ratings.passing_score },
    { key: "Possession", icon: PlayCircle, score: ratings.possession_score },
    { key: "Defending", icon: Shield, score: ratings.defending_score },
    { key: "Finishing", icon: Crosshair, score: ratings.finishing_score },
    { key: "Discipline", icon: AlertTriangle, score: ratings.discipline_score },
  ];

  // Derive strongest/weakest from the precomputed scores
  const sortedAttributes = [...attributesList].sort((a, b) => b.score - a.score);
  const strongest = sortedAttributes[0].key;
  const weakest = sortedAttributes[sortedAttributes.length - 1].key;

  return (
    <div className="space-y-6">
      {/* Player Performance Header & Radar */}
      <Card className="p-6 bg-gradient-card border-border relative overflow-hidden">

        <div className="flex flex-col md:flex-row items-center justify-between gap-8">

          <div className="w-full md:w-1/3 flex flex-col justify-center space-y-6">
            <div>
              <h2 className="text-3xl font-display font-black tracking-tight mb-1 uppercase text-primary">Global Ratings</h2>
              {/* <p className="text-muted-foreground text-sm">Compared to global player distribution</p> */}
            </div>

            <div className="flex gap-4">
              <div className="bg-background/50 border border-border/50 rounded-xl p-4 flex-1 text-center shadow-inner">
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-1">Overall Rating</p>
                <p className={`text-4xl font-display font-black ${getTier(ratings.overall_rating).color}`}>{ratings.overall_rating}</p>
              </div>
            </div>

            <div className="space-y-3">

              <div className="flex justify-between items-center border-b border-border/40 pb-2">
                <span className="text-sm text-muted-foreground">Play Style</span>
                <span className="font-bold text-sm text-right">{ratings.play_style}</span>
              </div>
              <div className="flex justify-between items-center border-b border-border/40 pb-2">
                <span className="text-sm text-muted-foreground">Strongest</span>
                <span className="font-bold text-sm text-green-400">{strongest}</span>
              </div>
              <div className="flex justify-between items-center pb-1">
                <span className="text-sm text-muted-foreground">Weakest</span>
                <span className="font-bold text-sm text-red-400">{weakest}</span>
              </div>
            </div>
          </div>

          <div className="w-full md:w-2/3 h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                <PolarGrid gridType="polygon" stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 'bold' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  name="Player"
                  dataKey="A"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="rgba(59, 130, 246, 0.4)"
                  fillOpacity={1}
                  dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: '#fff', stroke: '#3b82f6', strokeWidth: 2 }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(10, 15, 30, 0.9)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* Attribute Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {attributesList.map((attr, idx) => {
          const tier = getTier(attr.score);
          const Icon = attr.icon;
          return (
            <motion.div
              key={attr.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card className={`p-4 ${tier.bg} border ${tier.border} hover:bg-background/80 transition-all cursor-pointer h-full flex flex-col justify-between group`}>
                <div className="flex justify-between items-start mb-3">
                  <Icon className={`w-5 h-5 ${tier.color} group-hover:scale-110 transition-transform`} />
                  <span className={`text-2xl font-display font-black ${tier.color} leading-none`}>{attr.score}</span>
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-wide">{attr.key}</h3>
                  <p className={`text-[10px] uppercase font-bold tracking-widest mt-1 opacity-80 ${tier.color}`}>{tier.name}</p>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
