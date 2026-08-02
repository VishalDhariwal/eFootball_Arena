import { useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft, Copy, CheckCircle, Upload, X, Download,
  IndianRupee, QrCode, Clock, AlertCircle, FileImage, Loader2
} from "lucide-react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useTournament } from "@/features/tournaments/hooks/useTournaments";
import {
  useUserRegistration,
  useRegisterForTournament,
  useSubmitPayment,
} from "@/features/tournaments/hooks/useRegistrations";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────
const UPI_ID = "irajput6265-4@oksbi";
const QR_CODE_PATH = "/payment-qr.png";
const MAX_FILE_SIZE_MB = 5;
const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
const ACCEPTED_EXTENSIONS = ".jpg,.jpeg,.png,.pdf";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatINR = (amount: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount);

// ─── Sub-components ───────────────────────────────────────────────────────────

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 ${
        copied
          ? "bg-green-500/20 border-green-500/40 text-green-400"
          : "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
      }`}
    >
      {copied ? (
        <><CheckCircle className="w-3.5 h-3.5" /> Copied!</>
      ) : (
        <><Copy className="w-3.5 h-3.5" /> Copy</>
      )}
    </button>
  );
};

// ─── Success Screen ───────────────────────────────────────────────────────────
const SuccessScreen = ({
  tournamentName,
  onGoBack,
}: {
  tournamentName: string;
  onGoBack: () => void;
}) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.4, ease: "easeOut" }}
    className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4"
  >
    {/* Animated success ring */}
    <div className="relative mb-6">
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.5, type: "spring", stiffness: 200 }}
        className="w-24 h-24 rounded-full bg-green-500/15 border-2 border-green-500/30 flex items-center justify-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, duration: 0.3, type: "spring" }}
        >
          <CheckCircle className="w-12 h-12 text-green-400" />
        </motion.div>
      </motion.div>
      {/* Ripple rings */}
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-green-500/20"
        animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
      />
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-green-500/10"
        animate={{ scale: [1, 1.8], opacity: [0.3, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, delay: 0.8 }}
      />
    </div>

    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      <h2 className="text-2xl font-bold text-white mb-2">Payment Submitted!</h2>
      <p className="text-muted-foreground mb-1">
        Your payment proof for <span className="text-white font-medium">{tournamentName}</span> has been received.
      </p>
      <p className="text-sm text-muted-foreground mb-6">
        Your registration is awaiting administrator approval. You will receive access to the tournament once approved.
      </p>

      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-8 text-left max-w-sm mx-auto">
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-yellow-400 mb-0.5">Pending Review</p>
            <p className="text-xs text-muted-foreground">
              The admin will review your payment screenshot and approve your registration shortly.
            </p>
          </div>
        </div>
      </div>

      <Button onClick={onGoBack} variant="outline" className="gap-2">
        <ArrowLeft className="w-4 h-4" /> Back to Tournament
      </Button>
    </motion.div>
  </motion.div>
);

// ─── Already Submitted Screen ─────────────────────────────────────────────────
const AlreadySubmittedScreen = ({
  tournamentName,
  submittedAt,
  onGoBack,
}: {
  tournamentName: string;
  submittedAt?: string;
  onGoBack: () => void;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4"
  >
    <div className="w-20 h-20 rounded-full bg-yellow-500/15 border-2 border-yellow-500/30 flex items-center justify-center mb-5">
      <Clock className="w-10 h-10 text-yellow-400" />
    </div>
    <h2 className="text-xl font-bold text-white mb-2">Payment Under Review</h2>
    <p className="text-muted-foreground mb-1">
      You already submitted payment for <span className="text-white font-medium">{tournamentName}</span>.
    </p>
    {submittedAt && (
      <p className="text-xs text-muted-foreground mb-6">
        Submitted on {new Date(submittedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
      </p>
    )}
    <p className="text-sm text-muted-foreground mb-8 max-w-xs">
      The admin is reviewing your payment screenshot. You'll be notified once approved.
    </p>
    <Button onClick={onGoBack} variant="outline" className="gap-2">
      <ArrowLeft className="w-4 h-4" /> Back to Tournament
    </Button>
  </motion.div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
export const TournamentPaymentPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: tournament, isLoading: isTournamentLoading } = useTournament(id || "");
  const { data: registration, refetch: refetchReg } = useUserRegistration(id || "", user?.id);
  const registerMutation = useRegisterForTournament();
  const submitPayment = useSubmitPayment();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const entryFee = Number(tournament?.entry_fee || 0);

  const handleGoBack = () => navigate(`/tournaments/${id}`);

  // ── File handling ─────────────────────────────────────────────────────────
  const validateAndSetFile = useCallback((file: File) => {
    setFileError(null);
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setFileError("Invalid file type. Please upload a JPG, PNG, or PDF.");
      return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setFileError(`File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }
    setSelectedFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null); // PDF — no preview
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSetFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndSetFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => setDragActive(false);

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── QR Download ───────────────────────────────────────────────────────────
  const handleDownloadQR = () => {
    const link = document.createElement("a");
    link.href = QR_CODE_PATH;
    link.download = "football-arena-payment-qr.png";
    link.click();
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!user || !id) return;
    if (!selectedFile) { toast.error("Please upload your payment screenshot."); return; }

    try {
      // If no registration exists yet, create one first
      if (!registration) {
        await registerMutation.mutateAsync({ tournamentId: id, userId: user.id });
      }

      await submitPayment.mutateAsync({
        tournamentId: id,
        userId: user.id,
        file: selectedFile,
        transactionId: transactionId.trim() || undefined,
      });

      await refetchReg();
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit payment. Please try again.");
    }
  };

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!user) {
    navigate("/login");
    return null;
  }

  if (isTournamentLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
        Tournament not found.
      </div>
    );
  }

  // If approved — go back to tournament
  if (registration?.registration_status === "approved") {
    navigate(`/tournaments/${id}`);
    return null;
  }

  // Show success screen after fresh submit
  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 max-w-2xl py-8">
          <SuccessScreen tournamentName={tournament.name} onGoBack={handleGoBack} />
        </div>
      </div>
    );
  }

  // Already submitted — show waiting screen
  const alreadySubmitted =
    registration?.registration_status === "pending" &&
    registration?.payment_screenshot_url;

  if (alreadySubmitted) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 max-w-2xl py-8">
          <AlreadySubmittedScreen
            tournamentName={tournament.name}
            submittedAt={registration?.payment_submitted_at}
            onGoBack={handleGoBack}
          />
        </div>
      </div>
    );
  }

  const isSubmitting = submitPayment.isPending || registerMutation.isPending;

  return (
    <div className="min-h-screen bg-background">
      {/* ── Top nav bar ─────────────────────────────────────────────── */}
      <div className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 py-2.5">
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={handleGoBack}>
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> {tournament.name}
            </Button>
            <span className="text-muted-foreground/40 text-xs">/</span>
            <span className="text-xs font-medium text-foreground">Payment</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          {/* ── Header ──────────────────────────────────────────────── */}
          <div className="text-center pb-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-primary text-xs font-semibold mb-4">
              <IndianRupee className="w-3 h-3" /> Entry Payment
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">{tournament.name}</h1>
            <div className="flex items-center justify-center gap-1.5 text-2xl font-bold text-primary">
              <IndianRupee className="w-6 h-6" />
              {formatINR(entryFee)}
              <span className="text-sm text-muted-foreground font-normal ml-1">entry fee</span>
            </div>
          </div>

          {/* ── QR Code card ─────────────────────────────────────────── */}
          <Card className="bg-card border-border overflow-hidden">
            <CardContent className="p-0">
              {/* Header row */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm">Scan & Pay</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary hover:text-white transition-colors"
                  onClick={handleDownloadQR}
                >
                  <Download className="w-3.5 h-3.5" /> Download QR
                </Button>
              </div>

              <div className="p-6 flex flex-col sm:flex-row items-center gap-6">
                {/* QR Code image */}
                <div className="shrink-0">
                  <div className="relative group">
                    <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl opacity-0 group-hover:opacity-60 transition-opacity duration-500" />
                    <div className="relative bg-white rounded-2xl p-3 shadow-lg border border-white/20">
                      <img
                        src={QR_CODE_PATH}
                        alt="Payment QR Code"
                        className="w-44 h-44 object-contain rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                {/* Payment details */}
                <div className="flex-1 w-full space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wider">UPI ID</p>
                    <div className="flex items-center gap-2 bg-muted/40 border border-border rounded-xl px-4 py-3">
                      <span className="font-mono text-sm text-white font-semibold flex-1 select-all">
                        {UPI_ID}
                      </span>
                      <CopyButton text={UPI_ID} />
                    </div>
                  </div>

                  <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 space-y-2">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Instructions</p>
                    <ol className="space-y-1.5">
                      {[
                        `Open any UPI app (GPay, PhonePe, Paytm, etc.)`,
                        `Scan the QR code or enter the UPI ID manually`,
                        `Pay exactly ₹${formatINR(entryFee)}`,
                        `Take a screenshot of the confirmation`,
                        `Upload the screenshot below`,
                      ].map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <span className="shrink-0 w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center mt-0.5">
                            {i + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Upload card ───────────────────────────────────────────── */}
          <Card className="bg-card border-border">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Upload className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-sm">Upload Payment Proof</h2>
                <span className="text-xs text-red-400 font-medium">*required</span>
              </div>

              <AnimatePresence mode="wait">
                {!selectedFile ? (
                  <motion.div
                    key="dropzone"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {/* Drop zone */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                        dragActive
                          ? "border-primary bg-primary/10 scale-[1.01]"
                          : "border-border hover:border-primary/50 hover:bg-primary/5"
                      }`}
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                          dragActive ? "bg-primary/20" : "bg-muted/50"
                        }`}>
                          <FileImage className={`w-6 h-6 ${dragActive ? "text-primary" : "text-muted-foreground"}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white mb-0.5">
                            {dragActive ? "Drop it here!" : "Click or drag & drop"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            JPG, PNG, PDF · Max {MAX_FILE_SIZE_MB}MB
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs mt-1 border-primary/30 text-primary hover:bg-primary hover:text-white"
                          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                        >
                          Browse Files
                        </Button>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={ACCEPTED_EXTENSIONS}
                        onChange={handleFileChange}
                        className="hidden"
                        id="payment-screenshot-input"
                      />
                    </div>

                    {fileError && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs"
                      >
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {fileError}
                      </motion.div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="relative"
                  >
                    <div className="border border-green-500/30 bg-green-500/5 rounded-xl p-4 flex items-center gap-4">
                      {filePreview ? (
                        <img
                          src={filePreview}
                          alt="Payment screenshot preview"
                          className="w-16 h-16 object-cover rounded-lg border border-border shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-muted/50 border border-border flex items-center justify-center shrink-0">
                          <FileImage className="w-7 h-7 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                        <div className="flex items-center gap-1 mt-1.5">
                          <CheckCircle className="w-3 h-3 text-green-400" />
                          <span className="text-xs text-green-400 font-medium">Ready to submit</span>
                        </div>
                      </div>
                      <button
                        onClick={handleRemoveFile}
                        className="shrink-0 w-7 h-7 rounded-full bg-muted/50 hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Transaction ID */}
              <div>
                <label htmlFor="transaction-id" className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Transaction ID / UTR Number <span className="text-muted-foreground/60">(optional)</span>
                </label>
                <input
                  id="transaction-id"
                  type="text"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="e.g. 123456789012"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Found in your UPI app's transaction history.
                </p>
              </div>

              {/* Submit button */}
              <Button
                id="submit-payment-btn"
                className="w-full h-11 text-sm font-semibold shadow-glow-primary"
                onClick={handleSubmit}
                disabled={!selectedFile || isSubmitting}
              >
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>
                ) : (
                  <><CheckCircle className="w-4 h-4 mr-2" /> Submit Payment Proof</>
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                After submitting, an admin will review your screenshot and approve your registration.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default TournamentPaymentPage;
