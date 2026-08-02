import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChampionBadgeProps {
  isChampion?: boolean;
  season?: string;
  rating?: number;
  className?: string;
  showCrownOnly?: boolean;
}

export function ChampionBadge({ isChampion, season, rating, className, showCrownOnly = false }: ChampionBadgeProps) {
  if (!isChampion) return null;

  if (showCrownOnly) {
    return (
      <span 
        className={cn("text-yellow-500", className)}
        title={season ? `Season Champion: ${season}` : "Season Champion"}
      >
        👑
      </span>
    );
  }

  return (
    <div 
      className={cn(
        "group relative inline-flex items-center gap-1.5",
        "bg-gradient-to-r from-yellow-500/10 to-amber-500/10",
        "border border-yellow-500/30 rounded-full",
        "px-2.5 py-0.5 text-xs font-bold tracking-wide uppercase text-yellow-500 shadow-sm transition-all hover:border-yellow-500/50 hover:from-yellow-500/20 hover:to-amber-500/20 cursor-help",
        className
      )}
    >
      <span>👑</span>
      <span>Season Champion</span>

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
        <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-xl p-3 text-sm font-normal normal-case tracking-normal">
          <div className="font-bold text-yellow-500 flex items-center gap-2 mb-1">
            <span>👑</span> Season Champion
          </div>
          {season && (
            <div className="text-muted-foreground flex items-center justify-between text-xs mt-2">
              <span>Season:</span>
              <span className="text-foreground font-medium">{season}</span>
            </div>
          )}
          {rating && (
            <div className="text-muted-foreground flex items-center justify-between text-xs mt-1">
              <span>Rating:</span>
              <span className="text-foreground font-medium">{rating}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
