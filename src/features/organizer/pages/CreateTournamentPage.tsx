import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Trophy, Calendar, Users, IndianRupee, Medal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useCreateTournament } from "@/features/tournaments/hooks/useTournaments";

const tournamentSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().optional(),
  format: z.string().min(1, "Format is required"),
  max_players: z.coerce.number().min(2, "Must have at least 2 players").optional(),
  start_date: z.string().optional(),
  entry_fee: z.coerce.number().min(0).optional(),
  prize_first: z.coerce.number().min(0).optional(),
  prize_second: z.coerce.number().min(0).optional(),
  whatsapp_group_link: z.union([z.string().url("Must be a valid URL"), z.literal("")]).optional(),
});

type TournamentFormValues = z.infer<typeof tournamentSchema>;

export const CreateTournamentPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const createTournament = useCreateTournament();

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<TournamentFormValues>({
    resolver: zodResolver(tournamentSchema),
    defaultValues: {
      name: "",
      description: "",
      format: "single_elimination",
      whatsapp_group_link: "",
    },
  });

  const onSubmit = (data: TournamentFormValues) => {
    if (!user) return;

    createTournament.mutate({
      ...data,
      entry_fee: data.entry_fee ?? 0,
      prize_first: data.prize_first ?? null,
      prize_second: data.prize_second ?? null,
      organizer_id: user.id,
      status: 'upcoming',
    }, {
      onSuccess: () => {
        toast.success("Tournament created successfully!");
        navigate("/organizer");
      },
      onError: (error: any) => {
        toast.error(`Failed to create tournament: ${error.message || "Unknown error"}`);
        console.error(error);
      }
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto"
      >
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate("/organizer")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <Card className="bg-card border-border shadow-elevated">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-3 rounded-full">
                <Trophy className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">Create New Tournament</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Set entry fee &amp; prizes — players request access, you approve</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Tournament Name *</Label>
                <Input id="name" {...register("name")} placeholder="e.g. Summer Championship 2024" />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" {...register("description")} placeholder="Brief details about the tournament" />
              </div>

              {/* Format & Max Players */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="format">Format *</Label>
                  <Select onValueChange={(val) => setValue("format", val)} defaultValue="single_elimination">
                    <SelectTrigger>
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single_elimination">Single Elimination</SelectItem>
                      <SelectItem value="double_elimination">Double Elimination</SelectItem>
                      <SelectItem value="round_robin">Round Robin</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.format && <p className="text-sm text-destructive">{errors.format.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_players">
                    <Users className="inline w-3.5 h-3.5 mr-1" />
                    Max Players
                  </Label>
                  <Input id="max_players" type="number" {...register("max_players")} placeholder="Leave blank for unlimited" />
                  {errors.max_players && <p className="text-sm text-destructive">{errors.max_players.message}</p>}
                </div>
              </div>

              {/* Start Date */}
              <div className="space-y-2">
                <Label htmlFor="start_date">
                  <Calendar className="inline w-3.5 h-3.5 mr-1" />
                  Start Date
                </Label>
                <Input id="start_date" type="datetime-local" {...register("start_date")} />
              </div>

              {/* Entry Fee & Prizes */}
              <div className="border-t border-border pt-5">
                <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                  <IndianRupee className="w-3.5 h-3.5 text-primary" />
                  Entry Fee &amp; Prizes
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="entry_fee" className="text-xs text-muted-foreground">
                      Entry Fee (₹)
                    </Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        id="entry_fee"
                        type="number"
                        min="0"
                        step="1"
                        {...register("entry_fee")}
                        placeholder="0 = Free"
                        className="pl-8"
                      />
                    </div>
                    {errors.entry_fee && <p className="text-xs text-destructive">{errors.entry_fee.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="prize_first" className="text-xs text-muted-foreground">
                      <Medal className="inline w-3 h-3 mr-1 text-yellow-400" />
                      1st Prize (₹) — Optional
                    </Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        id="prize_first"
                        type="number"
                        min="0"
                        step="1"
                        {...register("prize_first")}
                        placeholder="e.g. 500"
                        className="pl-8"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="prize_second" className="text-xs text-muted-foreground">
                      <Medal className="inline w-3 h-3 mr-1 text-slate-400" />
                      2nd Prize (₹) — Optional
                    </Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        id="prize_second"
                        type="number"
                        min="0"
                        step="1"
                        {...register("prize_second")}
                        placeholder="e.g. 250"
                        className="pl-8"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* WhatsApp Link */}
              <div className="space-y-2 pt-2">
                <Label htmlFor="whatsapp_group_link">WhatsApp Group Link (Optional)</Label>
                <Input 
                  id="whatsapp_group_link" 
                  {...register("whatsapp_group_link")} 
                  placeholder="https://chat.whatsapp.com/..." 
                />
                <p className="text-xs text-muted-foreground">This link will only be visible to players whose registration is approved.</p>
                {errors.whatsapp_group_link && <p className="text-sm text-destructive">{errors.whatsapp_group_link.message}</p>}
              </div>

              {/* Info Banner */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm text-muted-foreground">
                <p className="font-medium text-primary mb-1">📋 Registration Flow</p>
                <p>Players will submit a join request. You can approve or reject them from the Manage page before kicking off the tournament.</p>
              </div>

              <Button
                type="submit"
                className="w-full shadow-glow-primary"
                size="lg"
                disabled={createTournament.isPending}
              >
                {createTournament.isPending ? "Creating..." : "Create Tournament"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default CreateTournamentPage;
