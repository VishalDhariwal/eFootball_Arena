import { useAuth } from "@/features/auth/hooks/useAuth";
import { PlayerPerformance } from "@/features/stats/components/PlayerPerformance";

const GlobalRatingsPage = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="container mx-auto px-4 py-8">
        <PlayerPerformance userId={user?.id} />
      </div>
    </div>
  );
};

export default GlobalRatingsPage;
