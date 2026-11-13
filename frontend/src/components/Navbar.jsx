import React, { useState } from "react";
import { ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";

export default function Navbar({ activeTab, setActiveTab, onResetSample, isResetting }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-30 shadow-sm no-print">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <button
          onClick={() => setActiveTab("home")}
          className="flex items-center gap-2.5 cursor-pointer shrink-0"
        >
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span className="text-lg font-black text-gray-900 tracking-tight">Backstop</span>
          <span className="hidden sm:inline text-xs font-semibold text-gray-400">· Handover Ledger</span>
        </button>

        {/* Synthetic-data notice — calm, small */}
        <p className="hidden md:block text-xs text-gray-400 italic truncate">
          Synthetic data · simulated roles · no login required
        </p>

        {/* Reset button */}
        <button
          onClick={onResetSample}
          disabled={isResetting}
          className="shrink-0 text-xs font-semibold text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          title="Reload all sample data from scratch"
        >
          {isResetting ? "Reloading…" : "↺ Reload sample"}
        </button>
      </div>
    </header>
  );
}
