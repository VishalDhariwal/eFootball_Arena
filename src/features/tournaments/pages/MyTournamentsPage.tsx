import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trophy, Calendar, Users, Activity, Layers, ChevronRight, Search, ShieldAlert, Clock, IndianRupee, CheckCircle, XCircle, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useUserTournaments, useRequestRefund } from "@/features/tournaments/hooks/useRegistrations";
import { RefundRequestModal } from "@/features/tournaments/components/RefundRequestModal";
import { toast } from "sonner";

// Payment-aware status config
const getRegStatusConfig = (reg: any) => {
  const status = reg.registration_status;
  const hasPayment = !!reg.payment_screenshot_url;
  const entryFee = Number((reg.tournament as any)?.entry_fee || 0);
  const isPaid = entryFee > 0;

  if (status === 'approved') return { label: 'Enrolled', color: 'text-green-500', bg: 'bg-green-500/10 border-green-500/20', icon: CheckCircle };
  if (status === 'rejected') return { label: 'Rejected', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20', icon: XCircle };
  if (status === 'pending' && hasPayment) return { label: 'Payment Under Review', color: 'text-yellow-500', bg: 'bg-yellow-500/10 border-yellow-500/20', icon: Clock };
  if (status === 'pending' && isPaid && !hasPayment) return { label: 'Payment Required', color: 'text-orange-500', bg: 'bg-orange-500/10 border-orange-500/20', icon: IndianRupee };
  return { label: 'Pending', color: 'text-yellow-500', bg: 'bg-yellow-500/10 border-yellow-500/20', icon: Clock };
};

const tournamentStatusConfig: Record<string, { label: string; color: string; pulse?: boolean }> = {
  upcoming: { label: 'Upcoming', color: 'text-blue-400' },
  registration: { label: 'Registration Open', color: 'text-primary' },
  live: { label: 'Live Now', color: 'text-green-400', pulse: true },
  completed: { label: 'Completed', color: 'text-muted-foreground' },
};

export const MyTournamentsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: myTournaments, isLoading } = useUserTournaments(user?.id);
  const [activeTab, setActiveTab] = useState("active");
  const requestRefund = useRequestRefund();

  // Refund Modal State
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [selectedRegForRefund, setSelectedRegForRefund] = useState<any>(null);

  // Filtering
  const activeTournaments = myTournaments?.filter(t => {
    const status = (t.tournament as any)?.status;
    return (status === 'live' || status === 'upcoming' || status === 'registration') && t.registration_status !== 'rejected';
  }) || [];

  const completedTournaments = myTournaments?.filter(t =>
    (t.tournament as any)?.status === 'completed'
  ) || [];

  const titlesWon = completedTournaments.filter(t => (t.tournament as any)?.winner_id === user?.id).length;

  const TournamentCard = ({ reg, variant = 'default' }: { reg: any; variant?: 'live' | 'default' | 'completed' }) => {
    const t = reg.tournament;
    const regStatus = getRegStatusConfig(reg);
    const tStatus = tournamentStatusConfig[t?.status] || { label: t?.status, color: 'text-white' };
    const isChampion = t?.status === 'completed' && t?.winner_id === user?.id;
    const needsPayment = reg.registration_status === 'pending' && !reg.payment_screenshot_url && Number(t?.entry_fee || 0) > 0;
    
    // Refund Eligibility
    const hasRefundRequested = reg.refund_requested;
    const canRequestRefund = !hasRefundRequested && 
                             (reg.registration_status === 'pending' || reg.registration_status === 'approved') && 
                             (t?.status === 'upcoming' || t?.status === 'registration') &&
                             !!reg.payment_screenshot_url; // Only allow refunds if they actually paid/submitted

    const RegStatusIcon = regStatus.icon;

    const handleClick = () => navigate(`/tournaments/${t?.id}`);
    const handlePay = (e: React.MouseEvent) => {
      e.stopPropagation();
      navigate(`/tournaments/${t?.id}/pay`);
    };
    const handleRefundClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedRegForRefund(reg);
      setRefundModalOpen(true);
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.01 }}
        transition={{ duration: 0.2 }}
      >
        <Card
          className={`relative overflow-hidden group cursor-pointer transition-all border-border/50 hover:border-primary/50 bg-gradient-to-r from-card to-card/50 shadow-sm hover:shadow-primary/5
            ${variant === 'completed' ? 'opacity-80 hover:opacity-100' : ''}`}
          onClick={handleClick}
        >
          {/* Subtle Accent Line */}
          <div className={`absolute left-0 top-0 bottom-0 w-1 ${
            isChampion ? 'bg-yellow-500' : 
            t?.status === 'live' ? 'bg-green-500' : 'bg-primary/50'
          }`} />

          <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ml-1">
            
            {/* Left Side: Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                {/* Registration Status */}
                <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded border ${regStatus.bg} ${regStatus.color}`}>
                  <RegStatusIcon className="w-2.5 h-2.5" />
                  {regStatus.label}
                </span>
                
                {/* Tournament Status */}
                <span className={`flex items-center gap-1.5 text-xs font-medium ${tStatus.color}`}>
                  {tStatus.pulse && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
                  {tStatus.label}
                </span>

                {/* Champion Badge */}
                {isChampion && (
                  <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 shadow-[0_0_10px_rgba(234,179,8,0.2)]">
                    <Trophy className="w-3 h-3" /> Champion
                  </span>
                )}
              </div>

              {/* Title */}
              <h3 className="text-xl font-display font-bold truncate group-hover:text-primary transition-colors">
                {t?.name || 'Unknown Tournament'}
              </h3>

              {/* Metadata row */}
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1 font-medium text-foreground/80 bg-white/5 px-2 py-1 rounded capitalize">
                  {t?.format?.replace('_', ' ')}
                </span>
                {t?.max_teams && (
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    {t?.registered_teams || 0}/{t.max_teams} Teams
                  </span>
                )}
                {t?.start_date && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(t.start_date).toLocaleDateString('default', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            </div>

            {/* Right Side: CTA */}
            <div className="flex flex-col sm:items-end justify-center gap-2 shrink-0 sm:border-l sm:border-border/50 sm:pl-4 pt-3 sm:pt-0 border-t border-border/50 sm:border-t-0">
              {hasRefundRequested ? (
                <div className="text-right">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    {reg.refund_status === 'pending' && <Clock className="w-3 h-3" />}
                    {reg.refund_status === 'approved' && <CheckCircle className="w-3 h-3" />}
                    {reg.refund_status === 'completed' && <CheckCircle className="w-3 h-3" />}
                    {reg.refund_status === 'rejected' && <XCircle className="w-3 h-3 text-red-500" />}
                    Refund {reg.refund_status}
                  </span>
                  {reg.refund_status === 'pending' && (
                    <p className="text-[10px] text-muted-foreground mt-1">Waiting for admin</p>
                  )}
                </div>
              ) : needsPayment ? (
                <Button
                  size="sm"
                  className="h-8 text-xs bg-orange-500 hover:bg-orange-400 text-white"
                  onClick={handlePay}
                >
                  <IndianRupee className="w-3 h-3 mr-1" /> Pay Entry Fee
                </Button>
              ) : canRequestRefund ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-400 hover:border-yellow-500/50"
                  onClick={handleRefundClick}
                >
                  <RotateCcw className="w-3 h-3 mr-1.5" /> Request Refund
                </Button>
              ) : (
                <span className="text-sm font-bold text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                  Open <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              )}
            </div>

          </div>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-display font-bold mb-2">My Tournaments</h1>
            <p className="text-muted-foreground text-sm">Manage your competitive career and active registrations.</p>
          </div>
          <Button onClick={() => navigate('/tournaments')} className="shadow-glow-primary shrink-0">
            <Search className="w-4 h-4 mr-2" /> Find Tournaments
          </Button>
        </div>

        {/* KPI Dashboard */}
        {!isLoading && myTournaments && myTournaments.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
            <Card className="bg-card/40 border-border/40 p-4 flex items-center gap-4">
              <div className="bg-primary/10 p-3 rounded-lg">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Active</p>
                <p className="text-2xl font-display font-bold text-primary">{activeTournaments.length}</p>
              </div>
            </Card>
            
            <Card className="bg-card/40 border-border/40 p-4 flex items-center gap-4">
              <div className="bg-white/5 p-3 rounded-lg">
                <Layers className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Total Joined</p>
                <p className="text-2xl font-display font-bold">{activeTournaments.length + completedTournaments.length}</p>
              </div>
            </Card>
            
            <Card className="bg-card/40 border-border/40 p-4 flex items-center gap-4">
              <div className="bg-yellow-500/10 p-3 rounded-lg">
                <Trophy className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Titles Won</p>
                <p className="text-2xl font-display font-bold text-yellow-500">{titlesWon}</p>
              </div>
            </Card>
          </div>
        )}

        {/* Content Area */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Card key={i} className="p-5 bg-card border-border animate-pulse h-28" />
            ))}
          </div>
        ) : !myTournaments || myTournaments.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-12 text-center bg-card border-border flex flex-col items-center">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                <ShieldAlert className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-2xl font-display font-bold mb-2">No Tournaments Yet</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                You haven't joined any tournaments. Browse the active events and register to start your competitive journey.
              </p>
              <Button onClick={() => navigate('/tournaments')} className="shadow-glow-primary">
                Browse Tournaments
              </Button>
            </Card>
          </motion.div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center justify-between mb-6">
              <TabsList className="bg-card/50 border border-border/50 p-1 rounded-full h-auto">
                <TabsTrigger 
                  value="active" 
                  className="rounded-full px-6 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
                >
                  Active ({activeTournaments.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="completed" 
                  className="rounded-full px-6 py-2 text-sm font-medium data-[state=active]:bg-white/10 data-[state=active]:text-white transition-all"
                >
                  Completed ({completedTournaments.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="active" className="m-0 space-y-3">
              {activeTournaments.length > 0 ? (
                activeTournaments.map(reg => (
                  <TournamentCard 
                    key={reg.id} 
                    reg={reg} 
                    variant={(reg.tournament as any)?.status === 'live' ? 'live' : 'default'} 
                  />
                ))
              ) : (
                <div className="text-center py-12 text-muted-foreground bg-card/20 rounded-xl border border-dashed border-border">
                  You have no active tournaments.
                </div>
              )}
            </TabsContent>

            <TabsContent value="completed" className="m-0 space-y-3">
              {completedTournaments.length > 0 ? (
                completedTournaments.map(reg => (
                  <TournamentCard 
                    key={reg.id} 
                    reg={reg} 
                    variant="completed" 
                  />
                ))
              ) : (
                <div className="text-center py-12 text-muted-foreground bg-card/20 rounded-xl border border-dashed border-border">
                  You haven't completed any tournaments yet.
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      <RefundRequestModal
        isOpen={refundModalOpen}
        onClose={() => {
          setRefundModalOpen(false);
          setSelectedRegForRefund(null);
        }}
        tournamentName={selectedRegForRefund?.tournament?.name || ""}
        isSubmitting={requestRefund.isPending}
        onSubmit={async (data) => {
          await requestRefund.mutateAsync({
            registrationId: selectedRegForRefund.id,
            upiId: data.upiId,
            phone: data.phone,
            reason: data.reason,
          });
          toast.success("Refund request submitted successfully.");
          setRefundModalOpen(false);
          setSelectedRegForRefund(null);
        }}
      />
    </div>
  );
};

export default MyTournamentsPage;
