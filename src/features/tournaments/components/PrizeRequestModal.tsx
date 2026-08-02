import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertCircle, IndianRupee, Phone, CheckCircle, Loader2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PrizeRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { upiId?: string; phone?: string }) => Promise<void>;
  isSubmitting: boolean;
  tournamentName: string;
  prizeAmount: number;
  prizeType: 'winner' | 'runner_up';
}

export const PrizeRequestModal = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  tournamentName,
  prizeAmount,
  prizeType,
}: PrizeRequestModalProps) => {
  const [upiId, setUpiId] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUpi = upiId.trim();
    const cleanPhone = phone.trim();

    if (!cleanUpi && !cleanPhone) {
      setError("Please provide either a UPI ID or a Phone Number.");
      return;
    }

    if (cleanPhone && !/^\d{10}$/.test(cleanPhone)) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }

    try {
      await onSubmit({ upiId: cleanUpi, phone: cleanPhone });
      setUpiId("");
      setPhone("");
    } catch (err: any) {
      setError(err.message || "Failed to submit prize request.");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl pointer-events-auto overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-yellow-500/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Claim Your Prize</h3>
                    <p className="text-xs text-yellow-400 mt-0.5">
                      {prizeType === 'winner' ? 'Champion' : 'Runner Up'} • ₹{prizeAmount}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-muted/50 hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 overflow-y-auto">
                <p className="text-sm text-muted-foreground mb-4">
                  Congratulations on your placement in <strong className="text-white">{tournamentName}</strong>! 
                  Please provide the payment details where you'd like to receive your prize money.
                  <strong className="text-white block mt-1"> Either UPI ID or Phone Number is required.</strong>
                </p>

                <form id="prize-form" onSubmit={handleSubmit} className="space-y-4">
                  {/* UPI ID */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <IndianRupee className="w-3.5 h-3.5" /> UPI ID
                    </label>
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => {
                        setUpiId(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="e.g. name@oksbi"
                      className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-yellow-500 transition-colors"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-px bg-border flex-1" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">OR</span>
                    <div className="h-px bg-border flex-1" />
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" /> Phone Number (GPay/PhonePe)
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="e.g. 9876543210"
                      maxLength={10}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-yellow-500 transition-colors"
                    />
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <p>{error}</p>
                    </motion.div>
                  )}
                </form>
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-border bg-muted/10 flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  form="prize-form" 
                  className="bg-yellow-500 hover:bg-yellow-400 text-black shadow-glow-primary font-semibold"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>
                  ) : (
                    <><CheckCircle className="w-4 h-4 mr-2" /> Request ₹{prizeAmount}</>
                  )}
                </Button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
