import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckCircle, XCircle, Eye, Download, Clock, IndianRupee,
  X, User, Hash, Mail, Calendar, CreditCard, ImageOff, RefreshCw
} from "lucide-react";
import { useAdminRegistrations, useUpdateRegistrationStatus } from "@/features/tournaments/hooks/useRegistrations";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatINR = (amount: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount);

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

// ─── Screenshot Lightbox ──────────────────────────────────────────────────────
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
          {/* Header */}
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
          {/* Content */}
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
const StatusBadge = ({ status }: { status: string }) => {
  const configs: Record<string, { icon: any; label: string; className: string }> = {
    pending: {
      icon: Clock,
      label: "Pending",
      className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    },
    approved: {
      icon: CheckCircle,
      label: "Approved",
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

// ─── Payment Registration Card (Mobile-friendly) ──────────────────────────────
const RegistrationCard = ({
  reg,
  onViewScreenshot,
  onApprove,
  onReject,
  isUpdating,
}: {
  reg: any;
  onViewScreenshot: (url: string, name: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isUpdating: boolean;
}) => {
  const user = reg.user as any;
  const tournament = reg.tournament as any;
  const isPending = reg.registration_status === "pending";
  const screenshotUrl = reg.payment_screenshot_url;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-card border rounded-xl overflow-hidden transition-colors ${
        isPending ? "border-yellow-500/20" : "border-border"
      }`}
    >
      {/* Top accent bar for pending */}
      {isPending && (
        <div className="h-0.5 bg-gradient-to-r from-yellow-500/60 via-yellow-400/40 to-transparent" />
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
          <div className="shrink-0 flex flex-col items-end gap-2">
            <StatusBadge status={reg.registration_status} />
            {reg.refund_requested && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-yellow-500/10 text-yellow-500 border border-yellow-500/30">
                Refund {reg.refund_status}
              </span>
            )}
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
          <div className="bg-muted/30 rounded-lg p-2.5 space-y-0.5">
            <p className="text-muted-foreground/70 uppercase tracking-wide text-[10px] font-medium">Tournament</p>
            <p className="text-white font-medium truncate">{tournament?.name || "—"}</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-2.5 space-y-0.5">
            <p className="text-muted-foreground/70 uppercase tracking-wide text-[10px] font-medium">Entry Fee</p>
            <p className="text-primary font-bold flex items-center gap-0.5">
              <IndianRupee className="w-3 h-3" />
              {formatINR(Number(tournament?.entry_fee || 0))}
            </p>
          </div>
          {user?.email && (
            <div className="bg-muted/30 rounded-lg p-2.5 space-y-0.5 col-span-2">
              <p className="text-muted-foreground/70 uppercase tracking-wide text-[10px] font-medium">Email</p>
              <p className="text-white truncate flex items-center gap-1">
                <Mail className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                {user.email}
              </p>
            </div>
          )}
          {reg.transaction_id && (
            <div className="bg-muted/30 rounded-lg p-2.5 space-y-0.5 col-span-2">
              <p className="text-muted-foreground/70 uppercase tracking-wide text-[10px] font-medium">Transaction ID / UTR</p>
              <p className="text-white font-mono">{reg.transaction_id}</p>
            </div>
          )}
          {reg.payment_submitted_at && (
            <div className="bg-muted/30 rounded-lg p-2.5 space-y-0.5 col-span-2">
              <p className="text-muted-foreground/70 uppercase tracking-wide text-[10px] font-medium">Submitted At</p>
              <p className="text-white flex items-center gap-1">
                <Calendar className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                {formatDate(reg.payment_submitted_at)}
              </p>
            </div>
          )}
        </div>

        {/* Screenshot preview row */}
        <div className="flex items-center gap-3 mb-4">
          <div className="text-xs text-muted-foreground font-medium">Screenshot:</div>
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
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary hover:text-white transition-colors"
                onClick={() => onViewScreenshot(screenshotUrl, user?.display_name || "Player")}
              >
                <Eye className="w-3.5 h-3.5" /> View Full
              </Button>
              <a
                href={screenshotUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center h-8 gap-1.5 px-2.5 text-xs border border-border rounded-md text-muted-foreground hover:text-white hover:border-white/30 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
              <ImageOff className="w-3.5 h-3.5" />
              No screenshot
            </div>
          )}
        </div>

        {/* Action buttons */}
        {isPending && (
          <div className="flex gap-2">
            <Button
              id={`approve-btn-${reg.id}`}
              className="flex-1 h-9 text-xs bg-green-600 hover:bg-green-500 text-white border-green-500/50 shadow-none"
              onClick={() => onApprove(reg.id)}
              disabled={isUpdating}
            >
              <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Approve
            </Button>
            <Button
              id={`reject-btn-${reg.id}`}
              variant="outline"
              className="flex-1 h-9 text-xs border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50"
              onClick={() => onReject(reg.id)}
              disabled={isUpdating}
            >
              <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reject
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const AdminPaymentReviewPage = () => {
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxName, setLightboxName] = useState<string>("");

  const { data: registrations, isLoading, refetch } = useAdminRegistrations(filter);
  const updateStatus = useUpdateRegistrationStatus();

  const handleApprove = (id: string) => {
    updateStatus.mutate(
      { registrationId: id, status: "approved" },
      {
        onSuccess: () => toast.success("Registration approved! Player is now enrolled."),
        onError: (err: any) => toast.error("Failed to approve: " + err.message),
      }
    );
  };

  const handleReject = (id: string) => {
    updateStatus.mutate(
      { registrationId: id, status: "rejected" },
      {
        onSuccess: () => toast.error("Registration rejected.", { icon: "❌" }),
        onError: (err: any) => toast.error("Failed to reject: " + err.message),
      }
    );
  };

  const pendingCount = registrations?.filter((r) => r.registration_status === "pending").length ?? 0;

  const filterOptions: { value: typeof filter; label: string }[] = [
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
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
              <h2 className="text-xl font-bold text-white">Payment Proofs</h2>
              <p className="text-sm text-muted-foreground">
                Review player payment screenshots and approve/reject registrations
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <span className="px-3 py-1 bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 rounded-full text-xs font-semibold">
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
        <div className="flex gap-1 bg-muted/30 border border-border p-1 rounded-xl mb-6 w-fit">
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
        ) : !registrations || registrations.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-16 text-center">
              <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
              <p className="text-base font-semibold text-white mb-1">No payment submissions</p>
              <p className="text-sm text-muted-foreground">
                {filter === "pending"
                  ? "All payments have been reviewed."
                  : "No registrations match this filter."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            {registrations.map((reg: any) => (
              <RegistrationCard
                key={reg.id}
                reg={reg}
                onViewScreenshot={(url, name) => {
                  setLightboxUrl(url);
                  setLightboxName(name);
                }}
                onApprove={handleApprove}
                onReject={handleReject}
                isUpdating={updateStatus.isPending}
              />
            ))}
          </div>
        )}
      </motion.div>
    </>
  );
};

export default AdminPaymentReviewPage;
