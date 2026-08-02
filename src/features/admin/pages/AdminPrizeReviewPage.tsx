import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle, XCircle, Eye, Download, Clock, IndianRupee,
  X, User, Hash, Mail, Calendar, CreditCard, ImageOff, RefreshCw,
  Phone, Trophy, Medal
} from "lucide-react";
import { useAdminPrizeClaims, useUpdatePrizeStatus } from "@/features/tournaments/hooks/useRegistrations";
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
const PrizeStatusBadge = ({ status }: { status: string }) => {
  const configs: Record<string, { icon: any; label: string; className: string }> = {
    requested: {
      icon: Clock,
      label: "Requested",
      className: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    },
    paid: {
      icon: CheckCircle,
      label: "Paid",
      className: "bg-green-500/15 text-green-400 border-green-500/30",
    },
  };
  const cfg = configs[status] || configs.requested;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.className}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
};

// ─── Prize Request Card ──────────────────────────────────────────────────────
const PrizeRequestCard = ({
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
  const user = reg.user;
  const tournament = reg.tournament;
  const isRequested = reg.prize_status === "requested";
  const isPaid = reg.prize_status === "paid";
  const screenshotUrl = reg.payment_screenshot_url;
  
  const prizeAmount = reg.prize_type === "winner" ? tournament?.prize_first : tournament?.prize_second;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-card border rounded-xl overflow-hidden transition-colors ${
        isRequested ? "border-yellow-500/20" : "border-border"
      }`}
    >
      {/* Top accent bar for requested */}
      {isRequested && (
        <div className={`h-0.5 bg-gradient-to-r ${reg.prize_type === "winner" ? "from-yellow-500/60 via-yellow-400/40" : "from-slate-500/60 via-slate-400/40"} to-transparent`} />
      )}
      {isPaid && (
        <div className="h-0.5 bg-gradient-to-r from-green-500/60 via-green-400/40 to-transparent" />
      )}

      <div className="p-5">
        {/* Player + Status row */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${
              reg.prize_type === 'winner' ? 'bg-yellow-500/15 border-yellow-500/20 text-yellow-500' : 'bg-slate-500/15 border-slate-500/20 text-slate-400'
            }`}>
              {reg.prize_type === 'winner' ? <Trophy className="w-4 h-4" /> : <Medal className="w-4 h-4" />}
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
            <PrizeStatusBadge status={reg.prize_status} />
          </div>
        </div>

        {/* Prize Details Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
          <div className="bg-muted/30 rounded-lg p-2.5 space-y-0.5 col-span-2">
            <p className="text-muted-foreground/70 uppercase tracking-wide text-[10px] font-medium">Tournament</p>
            <div className="flex items-center justify-between">
              <p className="text-white font-medium truncate">{tournament?.name || "—"}</p>
              <p className={`font-bold flex items-center gap-0.5 ${reg.prize_type === 'winner' ? 'text-yellow-400' : 'text-slate-300'}`}>
                <IndianRupee className="w-3 h-3" />
                {formatINR(Number(prizeAmount || 0))}
              </p>
            </div>
          </div>
          
          <div className="bg-muted/30 rounded-lg p-2.5 space-y-0.5">
            <p className="text-muted-foreground/70 uppercase tracking-wide text-[10px] font-medium">Payout UPI ID</p>
            <p className="text-white font-medium truncate flex items-center gap-1.5">
              <IndianRupee className="w-3 h-3 text-muted-foreground shrink-0" />
              {reg.prize_upi_id || "—"}
            </p>
          </div>
          <div className="bg-muted/30 rounded-lg p-2.5 space-y-0.5">
            <p className="text-muted-foreground/70 uppercase tracking-wide text-[10px] font-medium">Payout Phone</p>
            <p className="text-white font-medium truncate flex items-center gap-1.5">
              <Phone className="w-3 h-3 text-muted-foreground shrink-0" />
              {reg.prize_phone || "—"}
            </p>
          </div>

          {reg.prize_requested_at && (
            <div className="bg-muted/30 rounded-lg p-2.5 space-y-0.5 col-span-2">
              <p className="text-muted-foreground/70 uppercase tracking-wide text-[10px] font-medium">Requested At</p>
              <p className="text-white flex items-center gap-1">
                <Calendar className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                {formatDate(reg.prize_requested_at)}
              </p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        {isRequested && (
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              className="flex-1 h-9 text-xs bg-green-600 hover:bg-green-500 text-white border-green-500/50 shadow-none"
              onClick={() => onUpdateStatus(reg.id, "paid")}
              disabled={isUpdating}
            >
              <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Mark as Paid
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const AdminPrizeReviewPage = () => {
  const [filter, setFilter] = useState<"requested" | "paid" | "all">("requested");
  const { data: requests, isLoading, refetch } = useAdminPrizeClaims(filter);
  const updateStatus = useUpdatePrizeStatus();

  // Lightbox state
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxName, setLightboxName] = useState("");

  const handleUpdateStatus = (id: string, status: string) => {
    updateStatus.mutate(
      { registrationId: id, status },
      {
        onSuccess: () => toast.success(`Prize claim marked as ${status}`),
        onError: (err: any) => toast.error("Error: " + err.message),
      }
    );
  };

  const pendingCount = requests?.filter((r) => r.prize_status === "requested").length ?? 0;

  const filterOptions: { value: typeof filter; label: string }[] = [
    { value: "requested", label: "Requested" },
    { value: "paid", label: "Paid" },
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
              <h2 className="text-xl font-bold text-white">Prize Money Claims</h2>
              <p className="text-sm text-muted-foreground">
                Review and payout prize money claims from tournament winners
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
              <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
              <p className="text-base font-semibold text-white mb-1">No prize claims</p>
              <p className="text-sm text-muted-foreground">
                {filter === "requested"
                  ? "All prize claims have been paid out."
                  : "No claims match this filter."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            {requests.map((reg: any) => (
              <PrizeRequestCard
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

export default AdminPrizeReviewPage;
