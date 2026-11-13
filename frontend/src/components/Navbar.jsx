import React from "react";
import { ShieldCheck, BookOpen, UserCheck, BarChart3, Lock, Users, Terminal } from "lucide-react";

export const ROLES = [
  { id: "incoming_dev", label: "Incoming Dev", access: "Team Level", desc: "Sees dev owners, decisions, risks, dependencies, contacts" },
  { id: "incoming_pm", label: "Incoming PM", access: "Team Level", desc: "Sees PM owners, questions, blockers, risks, next actions" },
  { id: "lead", label: "Team Lead", access: "Restricted Level", desc: "Can review/approve/edit claims; sees restricted notes" },
  { id: "admin", label: "System Admin", access: "Confidential Level", desc: "Unrestricted access including confidential executive data" },
];

export default function Navbar({ activeTab, setActiveTab, role, setRole, onResetSample, isResetting }) {
  const currentRoleObj = ROLES.find((r) => r.id === role) || ROLES[0];

  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-30 shadow-xs no-print">
      {/* Simulation Banner */}
      <div className="bg-amber-500 text-amber-950 px-4 py-1.5 text-xs font-semibold flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2 max-w-5xl mx-auto w-full">
          <span className="bg-amber-900 text-amber-100 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
            Hackathon Demo
          </span>
          <span>
            <strong>Simulated Roles:</strong> All data is synthetic. Authentication is simulated via the role switcher below. Permission checks are enforced strictly before LLM & view rendering.
          </span>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab("home")}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 flex items-center justify-center text-white shadow-sm ring-2 ring-indigo-100">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-gray-900 tracking-tight">Backstop</span>
                <span className="text-[11px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200 uppercase tracking-wider">
                  Handover Ledger
                </span>
              </div>
              <p className="text-[11px] text-gray-500 font-medium">Verified, permission-aware team transitions</p>
            </div>
          </div>

          {/* Nav Tabs */}
          <nav className="hidden md:flex items-center space-x-1">
            {[
              { id: "home", label: "Overview & Setup", icon: Terminal },
              { id: "review", label: "Review Queue", icon: ShieldCheck },
              { id: "handover", label: "Handover Dossier", icon: BookOpen },
              { id: "backtest", label: "Backtest Benchmark", icon: BarChart3 },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700 shadow-xs"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-indigo-600" : "text-gray-400"}`} />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Role Switcher & Sample Quick Reload */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                <Users className="w-3.5 h-3.5 text-gray-400" />
                <span>Simulated Role:</span>
              </div>
              <div className="relative inline-block text-left mt-0.5">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="bg-gray-50 hover:bg-gray-100 border border-gray-300 text-gray-900 text-xs font-semibold rounded-lg px-2.5 py-1.5 pr-7 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
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

            <button
              onClick={onResetSample}
              disabled={isResetting}
              className="text-xs font-medium text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50"
              title="Reset sample project database and re-derive claims"
            >
              {isResetting ? "Resetting..." : "Reset Sample"}
            </button>
          </div>
        </div>

        {/* Mobile Nav Tabs */}
        <div className="flex md:hidden overflow-x-auto py-2 border-t border-gray-100 gap-2">
          {[
            { id: "home", label: "Setup" },
            { id: "review", label: "Review" },
            { id: "handover", label: "Handover" },
            { id: "backtest", label: "Backtest" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold shrink-0 ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
