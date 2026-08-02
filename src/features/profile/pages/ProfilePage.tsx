import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { User, Shield, Star, Check, CheckCircle2, XCircle, Loader2, AtSign } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useProfile, useUpdateProfile, useAvatars, useUserChampionSeasons } from "@/features/auth/hooks/useProfile";
import { useParams } from "react-router-dom";
import { Trophy } from "lucide-react";
import { ChampionName } from "@/components/ui/champion-name";
import { supabase } from "@/services/supabase";

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
const RESERVED_USERNAMES = ['messi', 'ronaldo', 'cr7', 'neymar', 'mbappe', 'pele', 'maradona', 'admin', 'administrator', 'system', 'support', 'root', 'moderator'];

const profileSchema = z.object({
  username: z.string().regex(USERNAME_REGEX, "3–20 chars: letters, numbers, underscores only"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

const rankInfo = (r: number) => {
  if (r >= 1900) return { label: 'Elite', color: 'text-purple-400' };
  if (r >= 1700) return { label: 'Champion', color: 'text-red-400' };
  if (r >= 1500) return { label: 'Diamond', color: 'text-blue-400' };
  if (r >= 1300) return { label: 'Platinum', color: 'text-cyan-400' };
  if (r >= 1100) return { label: 'Gold', color: 'text-yellow-400' };
  if (r >= 900)  return { label: 'Silver', color: 'text-slate-300' };
  return { label: 'Bronze', color: 'text-orange-600' };
};

export const ProfilePage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  
  // If we have an id in the URL, view that user. Otherwise view our own profile.
  const isViewingOther = !!id && id !== user?.id;
  const targetUserId = isViewingOther ? id : user?.id;

  const { data: profile, isLoading } = useProfile(targetUserId);
  const { data: avatars, isLoading: isAvatarsLoading } = useAvatars();
  const { data: championSeasons } = useUserChampionSeasons(targetUserId);
  const updateProfile = useUpdateProfile();

  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { username: "" },
  });

  const watchUsername = watch("username");

  useEffect(() => {
    if (profile) {
      reset({ username: profile.username || profile.display_name || "" });
      if (profile.avatar_id && !selectedAvatarId) {
        setSelectedAvatarId(profile.avatar_id);
      }
    }
  }, [profile, reset]);

  useEffect(() => {
    if (isViewingOther) return;

    if (!watchUsername) {
      setUsernameStatus('idle');
      return;
    }
    
    // If it's the user's current username, it's valid and available
    if (profile && (watchUsername === profile.username || watchUsername === profile.display_name)) {
      setUsernameStatus('available');
      return;
    }

    if (!USERNAME_REGEX.test(watchUsername)) {
      setUsernameStatus('invalid');
      return;
    }

    if (RESERVED_USERNAMES.includes(watchUsername.toLowerCase())) {
      setUsernameStatus('taken');
      return;
    }

    setUsernameStatus('checking');
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', watchUsername)
        .neq('id', user.id)
        .maybeSingle();
      setUsernameStatus(data ? 'taken' : 'available');
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [watchUsername, profile, user, isViewingOther]);

  const onSubmit = (data: ProfileFormValues) => {
    if (!user) return;
    if (usernameStatus === 'taken' || usernameStatus === 'invalid' || usernameStatus === 'checking') {
      toast.error("Please pick a valid and available username");
      return;
    }
    updateProfile.mutate(
      { userId: user.id, updates: { username: data.username, display_name: data.username, avatar_id: selectedAvatarId } },
      {
        onSuccess: () => toast.success("Profile saved"),
        onError: (err) => { toast.error("Failed to save profile"); console.error(err); },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const rating = profile?.elo_rating || 1000;
  const rank = rankInfo(rating);
  const activeAvatarUrl = avatars?.find(a => a.id === selectedAvatarId)?.image_url
    || (profile as any)?.avatar?.image_url;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-muted border border-border flex items-center justify-center overflow-hidden shrink-0">
              {activeAvatarUrl ? (
                <img src={activeAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <ChampionName 
                  name={profile?.display_name || 'Unknown Player'}
                  isChampion={profile?.is_champion}
                  season={profile?.champion_season || undefined}
                  className="text-lg font-semibold text-foreground"
                />
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{profile?.player_id}</span>
                <span className="text-muted-foreground text-xs">·</span>
                <Star className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{rating} AR</span>
                <span className="text-muted-foreground text-xs">·</span>
                <span className={`text-xs font-semibold ${rank.color}`}>{rank.label}</span>
              </div>
            </div>
          </div>

          {/* Achievements Section */}
          {(championSeasons && championSeasons.length > 0) && (
            <div className="bg-gradient-to-br from-yellow-500/10 to-amber-500/5 border border-yellow-500/20 rounded-2xl p-6 shadow-lg mb-6">
              <h2 className="text-sm font-semibold text-yellow-500 mb-4 flex items-center gap-2 uppercase tracking-widest">
                <Trophy className="w-4 h-4" /> Achievements
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {championSeasons.map((season) => (
                  <div key={season.id} className="bg-black/40 border border-yellow-500/20 rounded-xl p-4 flex items-center gap-4">
                    <div className="bg-yellow-500/20 p-2 rounded-lg shrink-0">
                      <Trophy className="w-6 h-6 text-yellow-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-lg">Season Champion</h3>
                      <p className="text-yellow-500/80 text-sm font-medium">{season.season_name}</p>
                      <div className="flex gap-4 mt-2">
                        <div className="text-xs text-muted-foreground">
                          <span className="text-white font-medium">{season.final_ar}</span> Rating
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <span className="text-white font-medium">{season.total_wins}</span> Wins
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Edit Card - Only show if it's our own profile */}
          {!isViewingOther && (
            <div className="bg-card border border-border rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
              <h2 className="text-sm font-semibold text-foreground mb-5">Edit Profile</h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Username */}
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-sm font-medium">Username</Label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="username"
                    placeholder="your_username"
                    {...register("username")}
                    className="h-10 bg-background border-border pl-9 pr-9"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <AnimatePresence mode="wait">
                      {usernameStatus !== 'idle' && (
                        <motion.div
                          key={usernameStatus}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.15 }}
                        >
                          {usernameStatus === 'checking' && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />}
                          {usernameStatus === 'available' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                          {usernameStatus === 'taken' && <XCircle className="w-4 h-4 text-destructive" />}
                          {usernameStatus === 'invalid' && <XCircle className="w-4 h-4 text-orange-400" />}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                <AnimatePresence mode="wait">
                  {usernameStatus !== 'idle' && (
                    <motion.div
                      key={usernameStatus}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      {usernameStatus === 'available' && <p className="text-xs text-green-500 mt-1">Username is available</p>}
                      {usernameStatus === 'taken' && <p className="text-xs text-destructive mt-1">Username is already taken</p>}
                      {usernameStatus === 'invalid' && <p className="text-xs text-orange-400 mt-1">3–20 chars: letters, numbers, underscores only</p>}
                    </motion.div>
                  )}
                </AnimatePresence>
                {errors.username && usernameStatus === 'idle' && (
                  <p className="text-xs text-destructive mt-1">{errors.username.message}</p>
                )}
              </div>

              {/* Avatar Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Avatar</Label>
                {isAvatarsLoading ? (
                  <p className="text-xs text-muted-foreground">Loading avatars...</p>
                ) : avatars && avatars.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedAvatarId(null)}
                      title="Remove Avatar"
                      className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 transition-all duration-150 flex items-center justify-center bg-muted focus:outline-none ${
                        selectedAvatarId === null
                          ? 'border-primary shadow-[0_0_0_2px_hsl(var(--primary)/0.2)]'
                          : 'border-border hover:border-muted-foreground'
                      }`}
                    >
                      <User className="w-5 h-5 text-muted-foreground" />
                      {selectedAvatarId === null && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </button>
                    {avatars.map(avatar => {
                      const isSelected = selectedAvatarId === avatar.id;
                      return (
                        <button
                          key={avatar.id}
                          type="button"
                          onClick={() => setSelectedAvatarId(avatar.id)}
                          title={avatar.name}
                          className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 transition-all duration-150 focus:outline-none ${
                            isSelected
                              ? 'border-primary shadow-[0_0_0_2px_hsl(var(--primary)/0.2)]'
                              : 'border-border hover:border-muted-foreground'
                          }`}
                        >
                          <img src={avatar.image_url} alt={avatar.name} className="w-full h-full object-cover" />
                          {isSelected && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No avatars available yet. Add images in Supabase.</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-10 font-medium"
                disabled={updateProfile.isPending}
              >
                {updateProfile.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </span>
                ) : "Save Changes"}
              </Button>
            </form>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};
export default ProfilePage;
