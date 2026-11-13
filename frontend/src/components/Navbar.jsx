import React from "react";
import { ShieldCheck, BookOpen, BarChart3, Users, RotateCcw, FileText, CheckCircle2 } from "lucide-react";

export const ROLES = [
  { id: "incoming_dev", label: "Incoming Dev", access: "Team Level", desc: "Sees dev owners, decisions, risks, dependencies, contacts" },
  { id: "incoming_pm", label: "Incoming PM", access: "Team Level", desc: "Sees PM owners, questions, blockers, risks, next actions" },
  { id: "lead", label: "Team Lead", access: "Restricted Level", desc: "Can review/approve/edit claims; sees restricted notes" },
  { id: "admin", label: "System Admin", access: "Confidential Level", desc: "Unrestricted access including confidential executive data" },
];

export default function Navbar({ activeTab, setActiveTab, role, setRole, onResetSample, isResetting }) {
  const currentRoleObj = ROLES.find((r) => r.id === role) || ROLES[0];

  const NAV_ITEMS = [
    { id: "home", step: "1", label: "Overview", icon: FileText },
    { id: "review", step: "2", label: "Review Queue", icon: ShieldCheck },
    { id: "handover", step: "3", label: "Handover Dossier", icon: BookOpen },
    { id: "backtest", step: "4", label: "Backtest", icon: BarChart3 },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#e2e8f0] shadow-[0_1px_4px_rgba(11,28,48,0.03)] no-print">
      {/* Top Sandbox Playground Ribbon */}
      <div className="w-full bg-[#eff4ff] border-b border-[#dce9ff]/70 px-4 sm:px-6 lg:px-8 py-1.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-2 py-0.5 rounded bg-white text-[#434655] font-mono text-[10px] font-bold border border-[#c3c6d7] tracking-wider uppercase shrink-0 shadow-2xs">
              Sandbox Playground
            </span>
            <span className="text-[#434655] truncate text-[11px] sm:text-xs">
              Synthetic demonstration data. Roles simulated for hackathon evaluation — permissions enforced strictly before rendering.
            </span>
          </div>
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#006243] text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#007d57] animate-pulse"></span>
              Deterministic Ledger Active
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo & Product Identity */}
          <div
            className="flex items-center gap-3 cursor-pointer shrink-0 select-none"
            onClick={() => setActiveTab("home")}
          >
            <div className="w-9 h-9 rounded-xl bg-[#4b41e1] flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-[#0b1c30] tracking-tight">Backstop</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#e5eeff] text-[#004ac6] border border-[#dce9ff] uppercase tracking-wider">
                  Handover Ledger
                </span>
              </div>
              <span className="text-[11px] text-[#737686] hidden sm:block">
                Verified, permission-aware team transitions
              </span>
            </div>
          </div>

          {/* Numbered Step Navigation Bar */}
          <nav className="hidden md:flex items-center gap-1 p-1 bg-[#f1f5f9] border border-[#e2e8f0] rounded-xl">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? "bg-white text-[#004ac6] shadow-xs border border-[#cbd5e1]/80"
                      : "text-[#475569] hover:text-[#0b1c30] hover:bg-[#e2e8f0]/60"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded text-[10px] flex items-center justify-center font-bold ${
                      isActive ? "bg-[#e5eeff] text-[#004ac6]" : "bg-white/80 text-[#64748b]"
                    }`}
                  >
                    {item.step}
                  </span>
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-[#004ac6]" : "text-[#64748b]"}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right: Simulated Role Switcher & Reset Control */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Role Switcher Pill */}
            <div className="flex items-center gap-1.5 bg-[#f8f9ff] border border-[#e2e8f0] rounded-lg px-2.5 py-1">
              <Users className="w-3.5 h-3.5 text-[#004ac6] shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#737686] leading-none">
                  Simulated Role
                </span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-[#0b1c30] focus:outline-none cursor-pointer pr-1 pt-0.5"
                  title={currentRoleObj.desc}
                >
                  {ROLES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label} ({r.access})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Reset Sample Button */}
            <button
              onClick={onResetSample}
              disabled={isResetting}
              className="flex items-center gap-1.5 text-xs font-semibold bg-white hover:bg-[#f8f9ff] text-[#334155] hover:text-[#0b1c30] border border-[#e2e8f0] hover:border-[#cbd5e1] rounded-lg px-2.5 py-1.5 transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
              title="Reset sample project database, derive metrics, and load extractions"
            >
              <RotateCcw className={`w-3.5 h-3.5 text-[#004ac6] ${isResetting ? "animate-spin" : ""}`} />
              <span className="hidden lg:inline">{isResetting ? "Resetting..." : "Reset Sample"}</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="flex md:hidden overflow-x-auto py-2 border-t border-[#f1f5f9] gap-1.5 no-scrollbar">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 cursor-pointer ${
                  isActive
                    ? "bg-[#004ac6] text-white shadow-xs"
                    : "bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0]"
                }`}
              >
                <span className="font-mono text-[10px] opacity-80">{item.step}.</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}

