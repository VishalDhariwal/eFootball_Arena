import { ReactNode, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, Home, Trophy, User, BarChart3, Calendar, Shield, LayoutDashboard, Menu } from "lucide-react";
import { supabase } from "@/services/supabase";
import { toast } from "sonner";
import { NotificationsPopover } from "@/features/notifications/components/NotificationsPopover";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, isOrganizer } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Logged out successfully");
      navigate("/login");
    } catch (error) {
      toast.error("Error logging out");
    }
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const navLinkClass = (path: string) =>
    `inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive(path)
        ? 'bg-primary/15 text-primary'
        : 'text-muted-foreground hover:text-white hover:bg-white/5'
    }`;

  return (
    <div className="min-h-screen bg-gradient-hero">
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4 md:gap-6">
            
            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden shrink-0 -ml-2">
                  <Menu className="w-5 h-5 text-white" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0 bg-background/95 backdrop-blur-xl border-r border-white/10">
                <div className="p-4 border-b border-white/10">
                  <Link to={isAdmin ? "/admin" : "/dashboard"} onClick={() => setMobileMenuOpen(false)} className="text-xl font-display font-bold text-primary flex items-center gap-2">
                    <span className="text-white">eFootball</span> Arena
                  </Link>
                </div>
                <div className="flex flex-col gap-1 p-4 overflow-y-auto">
                  {!isAdmin && (
                    <>
                      <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)} className={navLinkClass('/dashboard')}>
                        <Home className="w-4 h-4" /> Dashboard
                      </Link>
                      <Link to="/tournaments" onClick={() => setMobileMenuOpen(false)} className={navLinkClass('/tournaments')}>
                        <Trophy className="w-4 h-4" /> Tournaments
                      </Link>
                      <Link to="/my-tournaments" onClick={() => setMobileMenuOpen(false)} className={navLinkClass('/my-tournaments')}>
                        <Calendar className="w-4 h-4" /> My Tournaments
                      </Link>
                      <Link to="/stats" onClick={() => setMobileMenuOpen(false)} className={navLinkClass('/stats')}>
                        <BarChart3 className="w-4 h-4" /> My Stats
                      </Link>
                      <Link to="/leaderboard" onClick={() => setMobileMenuOpen(false)} className={navLinkClass('/leaderboard')}>
                        <Trophy className="w-4 h-4" /> Leaderboard
                      </Link>
                      {isOrganizer && (
                        <Link to="/organizer" onClick={() => setMobileMenuOpen(false)} className={`${navLinkClass('/organizer')} text-secondary hover:text-secondary`}>
                          <Shield className="w-4 h-4" /> Host Tournament
                        </Link>
                      )}
                    </>
                  )}
                  {isAdmin && (
                    <>
                      <Link to="/admin" onClick={() => setMobileMenuOpen(false)} className={navLinkClass('/admin')}>
                        <LayoutDashboard className="w-4 h-4" /> Overview
                      </Link>
                      <Link to="/admin/users" onClick={() => setMobileMenuOpen(false)} className={navLinkClass('/admin/users')}>
                        <User className="w-4 h-4" /> Users
                      </Link>
                      <Link to="/admin/tournaments" onClick={() => setMobileMenuOpen(false)} className={navLinkClass('/admin/tournaments')}>
                        <Trophy className="w-4 h-4" /> Tournaments
                      </Link>
                      <Link to="/organizer" onClick={() => setMobileMenuOpen(false)} className={navLinkClass('/organizer')}>
                        <Shield className="w-4 h-4" /> Organizer
                      </Link>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>

            <Link to={isAdmin ? "/admin" : "/dashboard"} className="text-xl font-display font-bold text-primary flex items-center gap-2">
              <span className="text-white">eFootball</span> Arena
            </Link>

            {/* User Navigation Desktop */}
            {!isAdmin && (
              <div className="hidden md:flex gap-1 items-center">
                <Link to="/dashboard" className={navLinkClass('/dashboard')}>
                  <Home className="w-4 h-4" /> Dashboard
                </Link>
                <Link to="/tournaments" className={navLinkClass('/tournaments')}>
                  <Trophy className="w-4 h-4" /> Tournaments
                </Link>
                <Link to="/my-tournaments" className={navLinkClass('/my-tournaments')}>
                  <Calendar className="w-4 h-4" /> My Tournaments
                </Link>
                <Link to="/stats" className={navLinkClass('/stats')}>
                  <BarChart3 className="w-4 h-4" /> My Stats
                </Link>
                <Link to="/leaderboard" className={navLinkClass('/leaderboard')}>
                  <Trophy className="w-4 h-4" /> Leaderboard
                </Link>
                {isOrganizer && (
                  <Link to="/organizer" className={`${navLinkClass('/organizer')} text-secondary hover:text-secondary`}>
                    <Shield className="w-4 h-4" /> Host Tournament
                  </Link>
                )}
              </div>
            )}

            {/* Admin Navigation */}
            {isAdmin && (
              <div className="hidden md:flex gap-1 items-center">
                <Link to="/admin" className={navLinkClass('/admin')}>
                  <LayoutDashboard className="w-4 h-4" /> Overview
                </Link>
                <Link to="/admin/users" className={navLinkClass('/admin/users')}>
                  <User className="w-4 h-4" /> Users
                </Link>
                <Link to="/admin/tournaments" className={navLinkClass('/admin/tournaments')}>
                  <Trophy className="w-4 h-4" /> Tournaments
                </Link>
                <Link to="/organizer" className={navLinkClass('/organizer')}>
                  <Shield className="w-4 h-4" /> Organizer
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <NotificationsPopover />
            <Button variant="ghost" size="icon" asChild>
              <Link to="/profile"><User className="w-5 h-5" /></Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="w-5 h-5 text-muted-foreground hover:text-white" />
            </Button>
          </div>
        </div>
      </nav>
      <main>
        {children}
      </main>
    </div>
  );
};
