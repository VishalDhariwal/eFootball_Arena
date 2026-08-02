import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, Clock } from "lucide-react";

export function SeasonCountdown() {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number } | null>(null);
  const [seasonName, setSeasonName] = useState("");

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      
      // Determine current season name (e.g. Season 2026-08)
      const currentYear = now.getFullYear();
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      setSeasonName(`Season ${currentYear}-${currentMonth}`);

      // Calculate next month's 1st day at midnight
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const diffMs = nextMonth.getTime() - now.getTime();

      if (diffMs > 0) {
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diffMs / 1000 / 60) % 60);
        setTimeLeft({ days, hours, minutes });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  if (!timeLeft) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-sm font-medium text-amber-500/90 mt-3 flex items-center justify-center gap-2"
    >
      <Clock className="w-4 h-4" />
      <span>
        {seasonName} Ends in: {timeLeft.days} Days {timeLeft.hours} Hours
      </span>
    </motion.div>
  );
}
