import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle, XCircle, Eye, Download, Clock, IndianRupee,
  X, User, Hash, Mail, Calendar, CreditCard, ImageOff, RefreshCw,
  Phone, AlertCircle
} from "lucide-react";
import { useAdminRefundRequests, useUpdateRefundStatus } from "@/features/tournaments/hooks/useRegistrations";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatINR = (amount: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount);

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

// ─── Screenshot Lightbox (reused from Payment Review) ─────────────────────────
const ScreenshotLightbox = ({
  url,
  playerName,
  onClose,
}: {
  url: string;
  playerName: string;
  onClose: () => void;
}) => {
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
              <a
                href={url}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </a>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-muted/50 hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="p-4 max-h-[70vh] overflow-auto flex items-center justify-center bg-muted/20">
            {isPdf ? (
              <div className="text-center py-8">
                <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground mb-4">PDF document</p>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <Eye className="w-4 h-4" /> Open PDF
                </a>
              </div>
            ) : (
              <img
                src={url}
                alt={`Payment proof - ${playerName}`}
                className="max-w-full max-h-[60vh] object-contain rounded-lg"
              />
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ─── Status Badge ─────────────────────────────────────────────────────────────
const RefundStatusBadge = ({ status }: { status: string }) => {
  const configs: Record<string, { icon: any; label: string; className: string }> = {
    pending: {
      icon: Clock,
      label: "Pending",
      className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    },
    approved: {
      icon: CheckCircle,
      label: "Approved (Not Paid)",
      className: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    },
    completed: {
      icon: CheckCircle,
      label: "Refunded",
      className: "bg-green-500/15 text-green-400 border-green-500/30",
    },
    rejected: {
      icon: XCircle,
      label: "Rejected",
      className: "bg-red-500/15 text-red-400 border-red-500/30",
    },
  };
  const cfg = configs[status] || configs.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.className}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
};

// ─── Refund Request Card ──────────────────────────────────────────────────────
const RefundRequestCard = ({
  reg,
  onViewScreenshot,
  onUpdateStatus,
  isUpdating,
}: {
  reg: any;
  onViewScreenshot: (url: string, name: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  isUpdating: boolean;
}) => {
  const user = reg.user as any;
  const tournament = reg.tournament as any;
  const isPending = reg.refund_status === "pending";
  const isApproved = reg.refund_status === "approved";
  const screenshotUrl = reg.payment_screenshot_url;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-card border rounded-xl overflow-hidden transition-colors ${
        isPending ? "border-orange-500/20" : "border-border"
      }`}
    >
      {/* Top accent bar for pending */}
      {isPending && (
        <div className="h-0.5 bg-gradient-to-r from-orange-500/60 via-orange-400/40 to-transparent" />
      )}
      {isApproved && (
        <div className="h-0.5 bg-gradient-to-r from-blue-500/60 via-blue-400/40 to-transparent" />
      )}

      <div className="p-5">
        {/* Player + Status row */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-primary">
                {(user?.display_name || "?")[0].toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-white text-sm truncate">{user?.display_name || "Unknown"}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                <Hash className="w-2.5 h-2.5 shrink-0" />
                {user?.player_id || "—"}
              </p>
            </div>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            <RefundStatusBadge status={reg.refund_status} />
            <span className="text-[10px] text-muted-foreground font-mono">
              Reg: {reg.registration_status}
            </span>
          </div>
        </div>

        {/* Refund Details Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
          <div className="bg-muted/30 rounded-lg p-2.5 space-y-0.5 col-span-2">
            <p className="text-muted-foreground/70 uppercase tracking-wide text-[10px] font-medium">Tournament</p>
            <div className="flex items-center justify-between">
              <p className="text-white font-medium truncate">{tournament?.name || "—"}</p>
              <p className="text-primary font-bold flex items-center gap-0.5">
                <IndianRupee className="w-3 h-3" />
                {formatINR(Number(tournament?.entry_fee || 0))}
              </p>
            </div>
          </div>
          
          <div className="bg-muted/30 rounded-lg p-2.5 space-y-0.5">
            <p className="text-muted-foreground/70 uppercase tracking-wide text-[10px] font-medium">Payout UPI ID</p>
            <p className="text-white font-medium truncate flex items-center gap-1.5">
              <IndianRupee className="w-3 h-3 text-muted-foreground shrink-0" />
              {reg.refund_upi_id || "—"}
            </p>
          </div>
          <div className="bg-muted/30 rounded-lg p-2.5 space-y-0.5">
            <p className="text-muted-foreground/70 uppercase tracking-wide text-[10px] font-medium">Payout Phone</p>
            <p className="text-white font-medium truncate flex items-center gap-1.5">
              <Phone className="w-3 h-3 text-muted-foreground shrink-0" />
              {reg.refund_phone || "—"}
            </p>
          </div>

          {reg.refund_reason && (
            <div className="bg-muted/30 rounded-lg p-2.5 space-y-0.5 col-span-2 border border-red-500/10">
              <p className="text-muted-foreground/70 uppercase tracking-wide text-[10px] font-medium flex items-center gap-1 text-red-400/80">
                <AlertCircle className="w-3 h-3" /> Reason provided
              </p>
              <p className="text-white italic">"{reg.refund_reason}"</p>
            </div>
          )}

          {reg.refund_requested_at && (
            <div className="bg-muted/30 rounded-lg p-2.5 space-y-0.5 col-span-2">
              <p className="text-muted-foreground/70 uppercase tracking-wide text-[10px] font-medium">Requested At</p>
              <p className="text-white flex items-center gap-1">
                <Calendar className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                {formatDate(reg.refund_requested_at)}
              </p>
            </div>
          )}
        </div>

        {/* Screenshot preview row */}
        <div className="flex items-center gap-3 mb-4">
          <div className="text-xs text-muted-foreground font-medium">Original Payment:</div>
          {screenshotUrl ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onViewScreenshot(screenshotUrl, user?.display_name || "Player")}
                className="relative group"
              >
                <img
                  src={screenshotUrl}
                  alt="Payment proof thumbnail"
                  className="w-12 h-12 object-cover rounded-lg border border-border group-hover:border-primary/50 transition-colors"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <div className="absolute inset-0 rounded-lg bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Eye className="w-4 h-4 text-white" />
                </div>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
              <ImageOff className="w-3.5 h-3.5" />
              No screenshot
            </div>
          )}
        </div>

        {/* Action buttons */}
        {(isPending || isApproved) && (
          <div className="flex flex-col sm:flex-row gap-2">
            {isPending && (
              <Button
                className="flex-1 h-9 text-xs bg-blue-600 hover:bg-blue-500 text-white shadow-none"
                onClick={() => onUpdateStatus(reg.id, "approved")}
                disabled={isUpdating}
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Approve Refund
              </Button>
            )}
            {isApproved && (
              <Button
                className="flex-1 h-9 text-xs bg-green-600 hover:bg-green-500 text-white border-green-500/50 shadow-none"
                onClick={() => onUpdateStatus(reg.id, "completed")}
                disabled={isUpdating}
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Mark as Paid
              </Button>
            )}
            {isPending && (
              <Button
                variant="outline"
                className="sm:w-24 h-9 text-xs border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50"
                onClick={() => onUpdateStatus(reg.id, "rejected")}
                disabled={isUpdating}
              >
                <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reject
              </Button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const AdminRefundReviewPage = () => {
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "completed" | "all">("pending");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxName, setLightboxName] = useState<string>("");

  const { data: requests, isLoading, refetch } = useAdminRefundRequests(filter);
  const updateStatus = useUpdateRefundStatus();

  const handleUpdateStatus = (id: string, status: string) => {
    updateStatus.mutate(
      { registrationId: id, status },
      {
        onSuccess: () => {
          if (status === 'approved') toast.success("Refund approved. Please transfer funds and mark as Paid.");
          if (status === 'completed') toast.success("Refund marked as Completed.");
          if (status === 'rejected') toast.error("Refund rejected.", { icon: "❌" });
        },
        onError: (err: any) => toast.error(`Failed to update status: ${err.message}`),
      }
    );
  };

  const pendingCount = requests?.filter((r) => r.refund_status === "pending").length ?? 0;

  const filterOptions: { value: typeof filter; label: string }[] = [
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "completed", label: "Completed" },
    { value: "rejected", label: "Rejected" },
    { value: "all", label: "All" },
  ];

  return (
    <>
      {lightboxUrl && (
        <ScreenshotLightbox
          url={lightboxUrl}
          playerName={lightboxName}
          onClose={() => setLightboxUrl(null)}
        />
      )}

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        {/* ── Header ───────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-xl font-bold text-white">Refund Management</h2>
              <p className="text-sm text-muted-foreground">
                Review and process refund requests from players
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <span className="px-3 py-1 bg-orange-500/15 text-orange-400 border border-orange-500/30 rounded-full text-xs font-semibold">
                {pendingCount} pending
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => refetch()}
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
          </div>
        </div>

        {/* ── Filter tabs ───────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-1 bg-muted/30 border border-border p-1 rounded-xl mb-6 w-fit">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                filter === opt.value
                  ? "bg-card text-white shadow-sm border border-border"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* ── Content ───────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : !requests || requests.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-16 text-center">
              <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
              <p className="text-base font-semibold text-white mb-1">No refund requests</p>
              <p className="text-sm text-muted-foreground">
                {filter === "pending"
                  ? "All refund requests have been processed."
                  : "No requests match this filter."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            {requests.map((reg: any) => (
              <RefundRequestCard
                key={reg.id}
                reg={reg}
                onViewScreenshot={(url, name) => {
                  setLightboxUrl(url);
                  setLightboxName(name);
                }}
                onUpdateStatus={handleUpdateStatus}
                isUpdating={updateStatus.isPending}
              />
            ))}
          </div>
        )}
      </motion.div>
    </>
  );
};

export default AdminRefundReviewPage;
