import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle, XCircle, Eye, Download, Clock, IndianRupee,
  X, User, Hash, Mail, CreditCard, RefreshCw, AlertTriangle, Trophy, Medal
} from "lucide-react";
import { useUpdateRegistrationStatus, useUpdateRefundStatus, useUpdatePrizeStatus } from "@/features/tournaments/hooks/useRegistrations";
import { useMatches } from "@/features/matches/hooks/useMatches";
import { supabase } from "@/services/supabase";
import { toast } from "sonner";

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

const StatusBadge = ({ status }: { status: string }) => {
  if (status === 'approved') return <span className="px-2 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full text-xs font-semibold">Approved</span>;
  if (status === 'rejected') return <span className="px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-xs font-semibold">Rejected</span>;
  return <span className="px-2 py-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-full text-xs font-semibold flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</span>;
};

const RefundStatusBadge = ({ status }: { status: string }) => {
  if (status === 'completed') return <span className="px-2 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full text-xs font-semibold">Refunded</span>;
  if (status === 'rejected') return <span className="px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-xs font-semibold">Rejected</span>;
  if (status === 'approved') return <span className="px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-xs font-semibold">Approved (Pending Transfer)</span>;
  return <span className="px-2 py-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-full text-xs font-semibold flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</span>;
};

const PrizeStatusBadge = ({ status }: { status: string }) => {
  if (status === 'paid') return <span className="px-2 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full text-xs font-semibold flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Paid</span>;
  if (status === 'requested') return <span className="px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-xs font-semibold flex items-center gap-1"><Clock className="w-3 h-3" /> Requested</span>;
  return <span className="px-2 py-1 bg-slate-500/10 text-slate-400 border border-slate-500/20 rounded-full text-xs font-semibold">Not Requested</span>;
};

const ScreenshotLightbox = ({ url, playerName, onClose }: { url: string, playerName: string, onClose: () => void }) => {
  const isPdf = url.toLowerCase().includes(".pdf");

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="relative max-w-2xl w-full bg-card border border-border rounded-2xl overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <div>
              <p className="text-sm font-semibold text-white">Payment Screenshot</p>
              <p className="text-xs text-muted-foreground">{playerName}</p>
            </div>
            <div className="flex items-center gap-2">
              <a href={url} download target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg transition-colors">
                <Download className="w-3.5 h-3.5" /> Download
              </a>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted/50 hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="p-4 max-h-[70vh] overflow-auto flex items-center justify-center bg-muted/20">
            {isPdf ? (
              <div className="text-center py-8">
                <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground mb-4">PDF document</p>
                <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                  <Eye className="w-4 h-4" /> Open PDF
                </a>
              </div>
            ) : (
              <img src={url} alt="Payment proof" className="max-w-full max-h-[60vh] object-contain rounded-lg" />
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export const OrganizerPaymentsTab = ({ tournamentId, registrations }: { tournamentId: string, registrations: any[] }) => {
  const [selectedImage, setSelectedImage] = useState<{ url: string; playerName: string } | null>(null);
  const updateRegStatus = useUpdateRegistrationStatus();
  const updateRefundStatus = useUpdateRefundStatus();
  const updatePrizeStatus = useUpdatePrizeStatus();

  // Find winner and runner-up dynamically so we can list them even if they haven't requested yet
  const { data: allMatches } = useMatches(tournamentId);
  const finalMatch = allMatches?.find((m: any) => 
    (m.status === 'verified' || m.status === 'walkover') && 
    m.winner_id && 
    m.brackets?.length > 0 && 
    m.brackets[0].next_match_id === null
  );
  
  const winnerId = finalMatch?.winner_id;
  const runnerUpId = finalMatch 
    ? (finalMatch.winner_id === finalMatch.player1_id ? finalMatch.player2_id : finalMatch.player1_id)
    : null;

  // Filter lists
  const paymentRegs = registrations?.filter(r => !!r.payment_screenshot_url) || [];
  const refundRegs = registrations?.filter(r => !!r.refund_requested) || [];
  const prizeRegs = registrations?.filter(r => 
    r.prize_status === 'requested' || 
    r.prize_status === 'paid' ||
    (winnerId && r.user_id === winnerId) ||
    (runnerUpId && r.user_id === runnerUpId)
  ).map(r => {
    let prize_type = r.prize_type;
    if (winnerId && r.user_id === winnerId) prize_type = 'winner';
    if (runnerUpId && r.user_id === runnerUpId) prize_type = 'runner_up';
    return { ...r, prize_type };
  }) || [];

  const handleUpdateRegStatus = (id: string, status: string) => {
    updateRegStatus.mutate({ registrationId: id, status }, {
      onSuccess: () => toast.success(`Registration ${status}`),
      onError: (err: any) => toast.error("Error: " + err.message)
    });
  };

  const handleUpdateRefundStatus = (id: string, status: string) => {
    updateRefundStatus.mutate({ registrationId: id, status }, {
      onSuccess: () => toast.success(`Refund status updated to ${status}`),
      onError: (err: any) => toast.error("Error: " + err.message)
    });
  };

  const handleUpdatePrizeStatus = async (id: string, status: string, prize_type?: string) => {
    if (status === 'paid' && prize_type) {
      await supabase.from('registrations').update({ prize_type }).eq('id', id);
    }
    updatePrizeStatus.mutate({ registrationId: id, status }, {
      onSuccess: () => toast.success(`Prize status updated to ${status}`),
      onError: (err: any) => toast.error("Error: " + err.message)
    });
  };

  return (
    <div className="space-y-8">
      {selectedImage && (
        <ScreenshotLightbox
          url={selectedImage.url}
          playerName={selectedImage.playerName}
          onClose={() => setSelectedImage(null)}
        />
      )}

      {/* PAYMENTS SECTION */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <IndianRupee className="w-5 h-5 text-primary" /> Payment Proofs
          </h2>
          <p className="text-sm text-muted-foreground">Approve or reject uploaded payment screenshots.</p>
        </div>

        {paymentRegs.length === 0 ? (
          <div className="p-8 text-center bg-card border border-border rounded-lg shadow-elevated">
            <p className="text-muted-foreground">No payment proofs uploaded yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {paymentRegs.map((reg) => (
              <Card key={reg.id} className="bg-card border-border shadow-elevated overflow-hidden">
                <CardContent className="p-0">
                  <div className="p-4 border-b border-border bg-muted/10">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <User className="w-4 h-4 text-primary" />
                          <span className="font-bold text-white text-lg">{(reg.user as any)?.display_name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> {(reg.user as any)?.player_id}</span>
                          <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {(reg.user as any)?.email}</span>
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-2">
                        <StatusBadge status={reg.registration_status} />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Submitted:</span>
                      <span className="text-white font-medium">{formatDate(reg.payment_submitted_at)}</span>
                    </div>
                    {reg.transaction_id && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Transaction ID:</span>
                        <span className="text-white font-mono bg-muted/40 px-2 py-0.5 rounded">{reg.transaction_id}</span>
                      </div>
                    )}
                    
                    <div className="pt-2 border-t border-border flex items-center gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 bg-primary/5 hover:bg-primary/10 border-primary/30 text-primary"
                        onClick={() => setSelectedImage({ url: reg.payment_screenshot_url, playerName: (reg.user as any)?.display_name || "Player" })}
                      >
                        <Eye className="w-4 h-4 mr-2" /> View Proof
                      </Button>
                      
                      {reg.registration_status === 'pending' && (
                        <>
                          <Button
                            variant="outline"
                            className="w-10 p-0 border-green-500/50 text-green-400 hover:bg-green-500 hover:text-white"
                            onClick={() => handleUpdateRegStatus(reg.id, 'approved')}
                            title="Approve"
                            disabled={updateRegStatus.isPending}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            className="w-10 p-0 border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white"
                            onClick={() => handleUpdateRegStatus(reg.id, 'rejected')}
                            title="Reject"
                            disabled={updateRegStatus.isPending}
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* REFUNDS SECTION */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-secondary" /> Refund Requests
          </h2>
          <p className="text-sm text-muted-foreground">Manage refund requests from players.</p>
        </div>

        {refundRegs.length === 0 ? (
          <div className="p-8 text-center bg-card border border-border rounded-lg shadow-elevated">
            <p className="text-muted-foreground">No refund requests at this time.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {refundRegs.map((reg) => (
              <Card key={reg.id} className="bg-card border-border shadow-elevated overflow-hidden">
                <CardContent className="p-0">
                  <div className="p-4 border-b border-border bg-muted/10">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <User className="w-4 h-4 text-primary" />
                          <span className="font-bold text-white text-lg">{(reg.user as any)?.display_name}</span>
                        </div>
                      </div>
                      <div className="shrink-0">
                        <RefundStatusBadge status={reg.refund_status} />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Requested:</span>
                      <span className="text-white font-medium">{formatDate(reg.refund_requested_at)}</span>
                    </div>

                    <div className="bg-muted/30 p-3 rounded-lg border border-border space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Refund Details</p>
                      {reg.refund_upi_id && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">UPI ID:</span>
                          <span className="font-mono text-white select-all">{reg.refund_upi_id}</span>
                        </div>
                      )}
                      {reg.refund_phone && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Phone:</span>
                          <span className="font-mono text-white select-all">{reg.refund_phone}</span>
                        </div>
                      )}
                    </div>
                    
                    {reg.refund_reason && (
                      <div className="bg-secondary/10 border border-secondary/20 p-3 rounded-lg">
                        <p className="text-xs font-semibold text-secondary mb-1">Reason for Refund</p>
                        <p className="text-sm text-white/90 italic">"{reg.refund_reason}"</p>
                      </div>
                    )}

                    <div className="pt-2 border-t border-border flex flex-wrap gap-2">
                      {reg.refund_status === 'pending' && (
                        <>
                          <Button
                            variant="outline"
                            className="flex-1 bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30 text-blue-400"
                            onClick={() => handleUpdateRefundStatus(reg.id, 'approved')}
                            disabled={updateRefundStatus.isPending}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" /> Approve
                          </Button>
                          <Button
                            variant="outline"
                            className="w-12 p-0 border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white"
                            onClick={() => handleUpdateRefundStatus(reg.id, 'rejected')}
                            title="Reject"
                            disabled={updateRefundStatus.isPending}
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      
                      {reg.refund_status === 'approved' && (
                        <Button
                          variant="outline"
                          className="w-full bg-green-500/10 hover:bg-green-500/20 border-green-500/30 text-green-400"
                          onClick={() => handleUpdateRefundStatus(reg.id, 'completed')}
                          disabled={updateRefundStatus.isPending}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" /> Mark as Refunded (Completed)
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* PRIZE CLAIMS SECTION */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" /> Prize Claims
          </h2>
          <p className="text-sm text-muted-foreground">Manage prize money requests from winners.</p>
        </div>

        {prizeRegs.length === 0 ? (
          <div className="p-8 text-center bg-card border border-border rounded-lg shadow-elevated">
            <p className="text-muted-foreground">No prize claims requested yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {prizeRegs.map((reg) => (
              <Card key={reg.id} className={`bg-card border shadow-elevated overflow-hidden ${
                reg.prize_type === 'winner' ? 'border-yellow-500/20' : 'border-slate-500/20'
              }`}>
                <CardContent className="p-0">
                  <div className={`p-4 border-b border-border ${
                    reg.prize_type === 'winner' ? 'bg-yellow-500/5' : 'bg-slate-500/5'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {reg.prize_type === 'winner' ? (
                            <Trophy className="w-4 h-4 text-yellow-500" />
                          ) : (
                            <Medal className="w-4 h-4 text-slate-400" />
                          )}
                          <span className="font-bold text-white text-lg">{(reg.user as any)?.display_name}</span>
                        </div>
                        <div className="text-xs font-medium uppercase tracking-wider mt-1">
                          {reg.prize_type === 'winner' ? (
                            <span className="text-yellow-500">Champion Prize</span>
                          ) : (
                            <span className="text-slate-400">Runner Up Prize</span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0">
                        <PrizeStatusBadge status={reg.prize_status} />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Requested:</span>
                      <span className="text-white font-medium">{formatDate(reg.prize_requested_at)}</span>
                    </div>

                    <div className="bg-muted/30 p-3 rounded-lg border border-border space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payment Details</p>
                      {reg.prize_upi_id && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">UPI ID:</span>
                          <span className="font-mono text-white select-all">{reg.prize_upi_id}</span>
                        </div>
                      )}
                      {reg.prize_phone && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Phone:</span>
                          <span className="font-mono text-white select-all">{reg.prize_phone}</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-border flex flex-wrap gap-2">
                      {reg.prize_status !== 'paid' && (
                        <Button
                          variant="outline"
                          className="w-full bg-green-500/10 hover:bg-green-500/20 border-green-500/30 text-green-400"
                          onClick={() => handleUpdatePrizeStatus(reg.id, 'paid', reg.prize_type)}
                          disabled={updatePrizeStatus.isPending}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" /> Mark as Paid
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
