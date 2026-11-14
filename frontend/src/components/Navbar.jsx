import React from "react";

export const ROLES = [
  { id: "incoming_dev", label: "New developer", access: "Team Level", desc: "Sees dev owners, decisions, risks, dependencies, contacts" },
  { id: "incoming_pm", label: "New project manager", access: "Team Level", desc: "Sees PM owners, questions, blockers, risks, next actions" },
  { id: "lead", label: "Lead", access: "Restricted Level", desc: "Can review/approve/edit claims; sees restricted notes" },
];

export default function Navbar({ activeTab, setActiveTab, onResetSample, isResetting }) {
  const NAV_ITEMS = [
    { id: "home", label: "1. Overview" },
    { id: "review", label: "2. Review Queue" },
    { id: "handover", label: "3. Handover Dossier" },
    { id: "backtest", label: "4. Backtest" },
  ];

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-surface-container-lowest no-print">
      {/* Top Sandbox Playground Ribbon */}
      <div className="w-full bg-surface-container-low px-gutter py-1 flex items-center justify-between shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-sm">
            <span className="px-space-sm py-0.5 rounded bg-surface-container-lowest text-on-surface-variant font-code-sm text-code-sm border border-outline-variant/40">
              SANDBOX PLAYGROUND
            </span>
            <span className="font-label-md text-label-md text-on-surface-variant hidden sm:inline">
              Synthetic demonstration data. Automated checks reduce errors and a human approves.
            </span>
            <span className="font-label-md text-label-md text-on-surface-variant sm:hidden">
              Synthetic demonstration data.
            </span>
          </div>
          <div className="flex items-center gap-space-sm shrink-0">
            <span className="flex items-center gap-1 font-label-sm text-label-sm text-tertiary">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span>
              Automated Checks Active
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <header className="w-full h-16 bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="max-w-7xl mx-auto h-full px-gutter flex items-center justify-between gap-space-md">
          {/* Brand Identity */}
          <div className="flex items-center gap-space-md">
            <button
              onClick={() => setActiveTab("home")}
              className="flex items-center gap-space-sm text-left cursor-pointer"
            >
              <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
                <span className="material-symbols-outlined text-on-secondary text-[20px]">security</span>
              </div>
              <div className="flex flex-col">
                <span className="font-headline-sm text-headline-sm text-on-surface leading-none font-bold">Backstop</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant leading-none mt-1">Handover Ledger</span>
              </div>
            </button>
            <span className="hidden lg:inline-flex items-center px-space-sm py-0.5 rounded-full bg-surface-container font-label-sm text-label-sm text-primary font-medium">
              Audit & Handover Assistant
            </span>
          </div>

          {/* Segmented Step Navigation */}
          <nav className="hidden md:flex items-center gap-space-xs p-1 bg-surface-container-low rounded-xl">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`px-space-md py-1.5 transition-colors cursor-pointer rounded-lg text-xs font-semibold ${
                    isActive
                      ? "bg-secondary-fixed text-on-secondary-fixed shadow-xs font-bold"
                      : "font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right Controls: Reset Sample Data */}
          <div className="flex items-center gap-space-md">
            <button
              onClick={onResetSample}
              disabled={isResetting}
              className="px-space-md py-1.5 rounded-lg bg-surface-container-low font-label-md text-label-md text-on-surface hover:bg-surface-container transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              type="button"
              title="Reset sample project database and re-derive claims"
            >
              <span className={`material-symbols-outlined text-[16px] ${isResetting ? "animate-spin" : ""}`}>
                restart_alt
              </span>
              <span className="hidden sm:inline">{isResetting ? "Resetting..." : "Reset Sample Data"}</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="flex md:hidden overflow-x-auto px-4 py-1.5 border-t border-surface-container bg-surface-container-lowest gap-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold shrink-0 cursor-pointer ${
                activeTab === item.id
                  ? "bg-secondary-fixed text-on-secondary-fixed"
                  : "text-on-surface-variant hover:bg-surface-container-low"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>
    </div>
  );
}
