import { cn } from "@/lib/utils";

interface ChampionNameProps {
  name: string;
  isChampion?: boolean;
  season?: string;
  className?: string;
}

export function ChampionName({ name, isChampion, season, className }: ChampionNameProps) {
  if (!isChampion) {
    return <span className={className}>{name}</span>;
  }

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <span 
        className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-yellow-200 to-amber-500"
        title={season ? `Season Champion: ${season}` : "Season Champion"}
      >
        {name}
      </span>
      <span 
        className="text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)] cursor-help"
        title={season ? `Season Champion: ${season}` : "Season Champion"}
      >
        👑
      </span>
    </div>
  );
}
