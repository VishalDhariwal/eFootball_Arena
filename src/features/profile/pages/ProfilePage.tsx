import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { User, Shield, Star, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useProfile, useUpdateProfile, useAvatars } from "@/features/auth/hooks/useProfile";

const profileSchema = z.object({
  displayName: z.string().min(2, "Display name must be at least 2 characters"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

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
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile(user?.id);
  const { data: avatars, isLoading: isAvatarsLoading } = useAvatars();
  const updateProfile = useUpdateProfile();

  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName: "" },
  });

  useEffect(() => {
    if (profile) {
      reset({ displayName: profile.display_name || "" });
      if (profile.avatar_id && !selectedAvatarId) {
        setSelectedAvatarId(profile.avatar_id);
      }
    }
  }, [profile, reset]);

  const onSubmit = (data: ProfileFormValues) => {
    if (!user) return;
    updateProfile.mutate(
      { userId: user.id, updates: { display_name: data.displayName, avatar_id: selectedAvatarId } },
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
              <h1 className="text-lg font-semibold text-foreground">{profile?.display_name || 'My Profile'}</h1>
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

          {/* Edit Card */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
            <h2 className="text-sm font-semibold text-foreground mb-5">Edit Profile</h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Display Name */}
              <div className="space-y-1.5">
                <Label htmlFor="displayName" className="text-sm font-medium">Display Name</Label>
                <Input
                  id="displayName"
                  placeholder="Your display name"
                  {...register("displayName")}
                  className="h-10 bg-background border-border"
                />
                {errors.displayName && (
                  <p className="text-xs text-destructive mt-1">{errors.displayName.message}</p>
                )}
              </div>

              {/* Avatar Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Avatar</Label>
                {isAvatarsLoading ? (
                  <p className="text-xs text-muted-foreground">Loading avatars...</p>
                ) : avatars && avatars.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
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
        </motion.div>
      </div>
    </div>
  );
};
export default ProfilePage;
