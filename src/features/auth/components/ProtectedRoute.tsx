import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

interface RouteProps {
  children: ReactNode;
}

// Standard protected route — blocks unauthenticated users, redirects pending to /pending-access
export const ProtectedRoute = ({ children }: RouteProps) => {
  const { user, profile, isLoading, isAdmin } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-hero text-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If profile loaded and status is pending, redirect to waiting page
  if (profile && profile.status === 'pending') {
    if (location.pathname !== '/pending-access') {
      return <Navigate to="/pending-access" replace />;
    }
  }

  // If profile loaded and status is rejected
  if (profile && profile.status === 'rejected') {
    if (location.pathname !== '/pending-access') {
      return <Navigate to="/pending-access" replace />;
    }
  }

  if (isAdmin && location.pathname === '/dashboard') {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
};

// Admin-only route
export const AdminRoute = ({ children }: RouteProps) => {
  const { user, isAdmin, isLoading, profile } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-hero text-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (profile && profile.status !== 'approved') {
    return <Navigate to="/pending-access" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// Organizer-only route (Admins also allowed)
export const OrganizerRoute = ({ children }: RouteProps) => {
  const { user, isAdmin, isOrganizer, isLoading, profile } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-hero text-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (profile && profile.status !== 'approved') {
    return <Navigate to="/pending-access" replace />;
  }

  if (!isAdmin && !isOrganizer) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
