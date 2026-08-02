import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/layouts/AppLayout";
import { PublicLayout } from "./components/layouts/PublicLayout";
import { AuthProvider } from "./features/auth/components/AuthProvider";
import { ProtectedRoute, AdminRoute, OrganizerRoute } from "./features/auth/components/ProtectedRoute";

// Public pages
const LandingPage = lazy(() => import("./app/pages/LandingPage"));
const RegisterPage = lazy(() => import("./features/auth/pages/RegisterPage"));
const LoginPage = lazy(() => import("./features/auth/pages/LoginPage"));
const NotFoundPage = lazy(() => import("./app/pages/NotFoundPage"));
const PendingAccessPage = lazy(() => import("./features/auth/pages/PendingAccessPage"));

// User pages
const DashboardPage = lazy(() => import("./features/dashboard/pages/DashboardPage"));
const ProfilePage = lazy(() => import("./features/profile/pages/ProfilePage"));
const TournamentsPage = lazy(() => import("./features/tournaments/pages/TournamentsPage"));
const TournamentDetailPage = lazy(() => import("./features/tournaments/pages/TournamentDetailPage"));
const TournamentPaymentPage = lazy(() => import("./features/tournaments/pages/TournamentPaymentPage"));
const MyTournamentsPage = lazy(() => import("./features/tournaments/pages/MyTournamentsPage"));
const TournamentStatsPage = lazy(() => import("./features/tournaments/pages/TournamentStatsPage"));
const PlayerStatsPage = lazy(() => import("./features/stats/pages/PlayerStatsPage"));
const MatchSubmissionPage = lazy(() => import("./features/matches/pages/MatchSubmissionPage"));
const LeaderboardPage = lazy(() => import("./features/dashboard/pages/LeaderboardPage"));

// Organizer pages
const OrganizerDashboardPage = lazy(() => import("./features/organizer/pages/OrganizerDashboardPage"));
const CreateTournamentPage = lazy(() => import("./features/organizer/pages/CreateTournamentPage"));
const ManageTournamentPage = lazy(() => import("./features/organizer/pages/ManageTournamentPage"));

// Admin pages
const AdminDashboardPage = lazy(() => import("./features/admin/pages/AdminDashboardPage"));
const AdminUsersPage = lazy(() => import("./features/admin/pages/AdminUsersPage"));
const AdminTournamentsPage = lazy(() => import("./features/admin/pages/AdminTournamentsPage"));
const AdminFinancesPage = lazy(() => import("./features/admin/pages/AdminFinancesPage"));

const queryClient = new QueryClient();

const LoadingFallback = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-hero text-white gap-4">
    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    <p className="text-muted-foreground text-sm">Loading...</p>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<PublicLayout><LandingPage /></PublicLayout>} />
              <Route path="/register" element={<PublicLayout><RegisterPage /></PublicLayout>} />
              <Route path="/login" element={<PublicLayout><LoginPage /></PublicLayout>} />

              {/* Pending access - user is logged in but not yet approved */}
              <Route path="/pending-access" element={<ProtectedRoute><PendingAccessPage /></ProtectedRoute>} />

              {/* User routes */}
              <Route path="/dashboard" element={<ProtectedRoute><AppLayout><DashboardPage /></AppLayout></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><AppLayout><ProfilePage /></AppLayout></ProtectedRoute>} />
              <Route path="/profile/:id" element={<ProtectedRoute><AppLayout><ProfilePage /></AppLayout></ProtectedRoute>} />
              <Route path="/stats" element={<ProtectedRoute><AppLayout><PlayerStatsPage /></AppLayout></ProtectedRoute>} />
              <Route path="/tournaments" element={<ProtectedRoute><AppLayout><TournamentsPage /></AppLayout></ProtectedRoute>} />
              <Route path="/tournaments/:id" element={<ProtectedRoute><AppLayout><TournamentDetailPage /></AppLayout></ProtectedRoute>} />
              <Route path="/tournaments/:id/pay" element={<ProtectedRoute><AppLayout><TournamentPaymentPage /></AppLayout></ProtectedRoute>} />
              <Route path="/my-tournaments" element={<ProtectedRoute><AppLayout><MyTournamentsPage /></AppLayout></ProtectedRoute>} />
              <Route path="/my-tournaments/:id/stats" element={<ProtectedRoute><AppLayout><TournamentStatsPage /></AppLayout></ProtectedRoute>} />
              <Route path="/leaderboard" element={<ProtectedRoute><AppLayout><LeaderboardPage /></AppLayout></ProtectedRoute>} />
              <Route path="/matches/:id/submit" element={<ProtectedRoute><AppLayout><MatchSubmissionPage /></AppLayout></ProtectedRoute>} />

              {/* Legacy route redirect - /brackets → /tournaments */}
              <Route path="/brackets" element={<ProtectedRoute><AppLayout><TournamentsPage /></AppLayout></ProtectedRoute>} />

              {/* Organizer routes */}
              <Route path="/organizer" element={<OrganizerRoute><AppLayout><OrganizerDashboardPage /></AppLayout></OrganizerRoute>} />
              <Route path="/organizer/tournaments/new" element={<OrganizerRoute><AppLayout><CreateTournamentPage /></AppLayout></OrganizerRoute>} />
              <Route path="/organizer/tournaments/:id" element={<OrganizerRoute><AppLayout><ManageTournamentPage /></AppLayout></OrganizerRoute>} />

              {/* Admin routes - AdminRoute guard */}
              <Route path="/admin" element={<AdminRoute><AppLayout><AdminDashboardPage /></AppLayout></AdminRoute>} />
              <Route path="/admin/users" element={<AdminRoute><AppLayout><AdminUsersPage /></AppLayout></AdminRoute>} />
              <Route path="/admin/tournaments" element={<AdminRoute><AppLayout><AdminTournamentsPage /></AppLayout></AdminRoute>} />
              <Route path="/admin/finances" element={<AdminRoute><AppLayout><AdminFinancesPage /></AppLayout></AdminRoute>} />

              {/* 404 */}
              <Route path="*" element={<PublicLayout><NotFoundPage /></PublicLayout>} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
