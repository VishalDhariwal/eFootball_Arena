import { createContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/services/supabase";

export type UserRole = 'player' | 'organizer' | 'admin' | null;

export interface UserProfile {
  id: string;
  display_name: string;
  username: string | null;   // set for new username-based accounts; null for old email accounts
  avatar_url: string | null;
  game_id: string | null;
  player_id: string;
  status: 'pending' | 'approved' | 'rejected';
  elo_rating: number;
  total_goals_scored: number;
  total_goals_conceded: number;
  created_at: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  role: UserRole;
  isAdmin: boolean;
  isOrganizer: boolean;
  isLoading: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  role: null,
  isAdmin: false,
  isOrganizer: false,
  isLoading: true,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfileAndRole = async (userId: string) => {
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      setProfile(profileData as UserProfile | null);

      // Fetch role via user_roles → roles join
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role:role_id(name)")
        .eq("user_id", userId)
        .maybeSingle();

      const roleName = (roleData?.role as any)?.name as UserRole || null;
      setRole(roleName);
    } catch (err) {
      console.error("Failed to fetch profile/role:", err);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfileAndRole(session.user.id);
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfileAndRole(session.user.id);
      } else {
        setProfile(null);
        setRole(null);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const isAdmin = role === 'admin';
  const isOrganizer = role === 'organizer' || role === 'admin';

  return (
    <AuthContext.Provider value={{ session, user, profile, role, isAdmin, isOrganizer, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};
