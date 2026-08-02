import { ReactNode, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, Home, Trophy, User, BarChart3, Calendar, Shield, LayoutDashboard, Menu, Bell, IndianRupee, Crown, HelpCircle } from "lucide-react";
import { supabase } from "@/services/supabase";
import { toast } from "sonner";
import { NotificationsPopover } from "@/features/notifications/components/NotificationsPopover";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MessageCircle } from "lucide-react";

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
    `inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 ${
      isActive(path)
        ? 'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:text-foreground hover:bg-white/4'
    }`;

  const playerLinks = [
    { to: '/dashboard', icon: Home, label: 'Dashboard' },
    { to: '/tournaments', icon: Trophy, label: 'Tournaments' },
    { to: '/my-tournaments', icon: Calendar, label: 'My Tournaments' },
    { to: '/stats', icon: BarChart3, label: 'Stats' },
    { to: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
  ];

  const adminLinks = [
    { to: '/admin', icon: LayoutDashboard, label: 'Overview' },
    { to: '/admin/users', icon: User, label: 'Users' },
    { to: '/admin/tournaments', icon: Trophy, label: 'Tournaments' },
    { to: '/admin/finances', icon: IndianRupee, label: 'Finances' },
    { to: '/organizer', icon: Shield, label: 'Organizer' },
  ];

  const activeLinks = isAdmin ? adminLinks : playerLinks;

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="h-14 border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-full flex items-center justify-between gap-4">
          
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-6">
            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden h-8 w-8">
                  <Menu className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 bg-background border-r border-border">
                <div className="p-4 border-b border-border">
                  <Link
                    to={isAdmin ? "/admin" : "/dashboard"}
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-base font-semibold text-foreground"
                  >
                    eFootball <span className="text-primary">Arena</span>
                  </Link>
                </div>
                <div className="flex flex-col gap-0.5 p-3">
                  {activeLinks.map(link => (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={navLinkClass(link.to)}
                    >
                      <link.icon className="w-4 h-4" />
                      {link.label}
                    </Link>
                  ))}
                  {!isAdmin && isOrganizer && (
                    <Link
                      to="/organizer"
                      onClick={() => setMobileMenuOpen(false)}
                      className={navLinkClass('/organizer')}
                    >
                      <Shield className="w-4 h-4" />
                      Host Tournament
                    </Link>
                  )}
                  <Dialog>
                    <DialogTrigger asChild>
                      <button
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-green-500 hover:bg-green-500/10 transition-colors w-full text-left"
                      >
                        <HelpCircle className="w-4 h-4" />
                        Help & Support
                      </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md w-[90vw] mx-auto rounded-xl">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                          <HelpCircle className="w-5 h-5 text-green-500" />
                          Help & Support
                        </DialogTitle>
                      </DialogHeader>
                      <div className="py-6 text-center space-y-4">
                        <p className="text-muted-foreground">
                          Need assistance with your account, a tournament, or payments?
                        </p>
                        <Button asChild className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white" size="lg">
                          <a href="https://wa.me/918930099250" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                            <MessageCircle className="w-5 h-5" />
                            Contact Admin via WhatsApp
                          </a>
                        </Button>
                        <p className="text-xs text-muted-foreground mt-4">
                          Helpline No: 8930099250
                        </p>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <div className="border-t border-border mt-2 pt-2">
                    <button
                      onClick={handleLogout}
                      className="inline-flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/4 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {/* Logo */}
            <Link
              to={isAdmin ? "/admin" : "/dashboard"}
              className="text-base font-semibold text-foreground tracking-tight"
            >
              eFootball <span className="text-primary">Arena</span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-0.5">
              {activeLinks.map(link => (
                <Link key={link.to} to={link.to} className={navLinkClass(link.to)}>
                  <link.icon className="w-4 h-4" />
                  {link.label}
                </Link>
              ))}
              {!isAdmin && isOrganizer && (
                <Link to="/organizer" className={navLinkClass('/organizer')}>
                  <Shield className="w-4 h-4" />
                  Host
                </Link>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1">
            <Dialog>
              <DialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-muted-foreground hover:text-green-500 hover:bg-green-500/10 transition-colors" 
                  title="Help & Support"
                >
                  <HelpCircle className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-xl">
                    <HelpCircle className="w-5 h-5 text-green-500" />
                    Help & Support
                  </DialogTitle>
                </DialogHeader>
                <div className="py-6 text-center space-y-4">
                  <p className="text-muted-foreground">
                    Need assistance with your account, a tournament, or payments?
                  </p>
                  <Button asChild className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white" size="lg">
                    <a href="https://wa.me/918930099250" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                      <MessageCircle className="w-5 h-5" />
                      Contact Admin via WhatsApp
                    </a>
                  </Button>
                  <p className="text-xs text-muted-foreground mt-4">
                    Helpline No: 8930099250
                  </p>
                </div>
              </DialogContent>
            </Dialog>
            <NotificationsPopover />
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link to="/profile">
                <User className="w-4 h-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hidden md:flex"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 text-muted-foreground" />
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
