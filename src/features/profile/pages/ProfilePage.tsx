import { useEffect } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { User, Shield, Star, Trophy, Medal, Crown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useProfile, useUpdateProfile, useUserAchievements } from "@/features/auth/hooks/useProfile";

const profileSchema = z.object({
  displayName: z.string().min(2, "Display name must be at least 2 characters"),
  gameId: z.string().min(2, "Game ID must be at least 2 characters"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export const ProfilePage = () => {
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile(user?.id);
  const { data: achievements, isLoading: isAchievementsLoading } = useUserAchievements(user?.id);
  const updateProfile = useUpdateProfile();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: "",
      gameId: "",
    },
  });

  useEffect(() => {
    if (profile) {
      reset({
        displayName: profile.display_name || "",
        gameId: profile.game_id || "",
      });
    }
  }, [profile, reset]);

  const onSubmit = (data: ProfileFormValues) => {
    if (!user) return;
    
    updateProfile.mutate({
      userId: user.id,
      updates: {
        display_name: data.displayName,
        game_id: data.gameId,
      },
    }, {
      onSuccess: () => {
        toast.success("Profile updated successfully");
      },
      onError: (error) => {
        toast.error("Failed to update profile");
        console.error(error);
      }
    });
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'trophy': return <Trophy className="w-8 h-8 text-yellow-500" />;
      case 'medal': return <Medal className="w-8 h-8 text-gray-300" />;
      case 'crown': return <Crown className="w-8 h-8 text-yellow-600" />;
      default: return <Star className="w-8 h-8 text-primary" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-hero">
        <p className="text-white">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto space-y-8"
      >
        <div className="flex items-center gap-4 mb-8">
          <div className="bg-primary/10 p-4 rounded-full">
            <User className="w-12 h-12 text-primary" />
          </div>
          <div>
            <h1 className="text-4xl font-display font-bold">{profile?.display_name || 'My Profile'}</h1>
            <p className="text-muted-foreground flex items-center gap-2 mt-1">
              <Shield className="w-4 h-4 text-primary" />
              Unique Player ID: {profile?.player_id}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <p className="text-primary font-bold flex items-center gap-2">
                <Star className="w-4 h-4" />
                Arena Rating (AR): {profile?.elo_rating || 1000}
              </p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest ${
                (profile?.elo_rating || 1000) >= 1900 ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                (profile?.elo_rating || 1000) >= 1700 ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                (profile?.elo_rating || 1000) >= 1500 ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                (profile?.elo_rating || 1000) >= 1300 ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                (profile?.elo_rating || 1000) >= 1100 ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' :
                (profile?.elo_rating || 1000) >= 900 ? 'bg-gray-400/20 text-gray-300 border border-gray-400/30' :
                'bg-orange-700/20 text-orange-600 border border-orange-700/30'
              }`}>
                {(profile?.elo_rating || 1000) >= 1900 ? 'Elite' :
                 (profile?.elo_rating || 1000) >= 1700 ? 'Champion' :
                 (profile?.elo_rating || 1000) >= 1500 ? 'Diamond' :
                 (profile?.elo_rating || 1000) >= 1300 ? 'Platinum' :
                 (profile?.elo_rating || 1000) >= 1100 ? 'Gold' :
                 (profile?.elo_rating || 1000) >= 900 ? 'Silver' : 'Bronze'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <Card className="bg-card border-border shadow-elevated">
            <CardHeader>
              <CardTitle>Edit Profile Info</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    placeholder="Enter your display name"
                    {...register("displayName")}
                  />
                  {errors.displayName && (
                    <p className="text-sm text-destructive">{errors.displayName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gameId">eFootball Game ID</Label>
                  <Input
                    id="gameId"
                    placeholder="Enter your in-game ID"
                    {...register("gameId")}
                  />
                  {errors.gameId && (
                    <p className="text-sm text-destructive">{errors.gameId.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full shadow-glow-primary"
                  disabled={updateProfile.isPending}
                >
                  {updateProfile.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-card border-border shadow-elevated">
            <CardHeader>
              <CardTitle>Trophy Cabinet</CardTitle>
            </CardHeader>
            <CardContent>
              {isAchievementsLoading ? (
                <p className="text-muted-foreground text-center">Loading achievements...</p>
              ) : !achievements || achievements.length === 0 ? (
                <div className="text-center py-8">
                  <Trophy className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-muted-foreground">No achievements unlocked yet.</p>
                  <p className="text-sm text-muted-foreground/70">Win matches to unlock trophies!</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {achievements.map((ua) => (
                    <div key={ua.id} className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center hover:bg-primary/10 transition-colors">
                      <div className="flex justify-center mb-2">
                        {getIcon(ua.achievement?.icon_name || "")}
                      </div>
                      <h4 className="font-bold text-sm">{ua.achievement?.name}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{ua.achievement?.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </div>
  );
};

export default ProfilePage;
