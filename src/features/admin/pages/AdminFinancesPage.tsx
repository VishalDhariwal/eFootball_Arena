import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, RefreshCw, IndianRupee, Clock, CheckCircle } from "lucide-react";
import AdminPaymentReviewPage from "./AdminPaymentReviewPage";
import AdminRefundReviewPage from "./AdminRefundReviewPage";
import AdminPrizeReviewPage from "./AdminPrizeReviewPage";

type Tab = "payments" | "refunds" | "prizes";

export const AdminFinancesPage = () => {
  const [activeTab, setActiveTab] = useState<Tab>("payments");

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "payments", label: "Registration Payments", icon: CreditCard },
    { id: "refunds", label: "Refund Requests", icon: RefreshCw },
    { id: "prizes", label: "Prize Claims", icon: IndianRupee },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-white mb-2">Global Finances</h1>
        <p className="text-muted-foreground">
          Manage platform-wide registration payments, refunds, and prize payouts from one place.
        </p>
      </motion.div>

      {/* ── Main Tab Bar ────────────────────────────────────────────── */}
      <div className="flex overflow-x-auto gap-2 mb-8 pb-2 hide-scrollbar border-b border-border">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-t-xl text-sm font-medium transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                isActive
                  ? "border-primary text-white bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Content Area ─────────────────────────────────────────────── */}
      <div className="min-h-[500px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "payments" && <AdminPaymentReviewPage />}
            {activeTab === "refunds" && <AdminRefundReviewPage />}
            {activeTab === "prizes" && <AdminPrizeReviewPage />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AdminFinancesPage;
