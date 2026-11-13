import React, { useState } from "react";
import {
  ArrowRight, CheckCircle2, ChevronDown, ChevronUp,
  RotateCcw, HelpCircle,
} from "lucide-react";

function HelpPanel({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-2xl bg-white shadow-xs overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-[15px] font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-indigo-600" />
          What am I looking at?
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="px-5 pb-5 text-[15px] text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
          {children}
        </div>
      )}
    </div>
  );
}

export default function HomePage({
  project,
  stats,
  onResetSample,
  onDerive,
  onExtract,
  setActiveTab,
  isLoading,
  actionStatus,
}) {
  return (
    <div className="max-w-3xl mx-auto space-y-8 py-6">

      {/* Hero */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl md:text-5xl font-black text-gray-900 tracking-tight leading-tight">
          Team handover, with proof.
        </h1>
        <p className="text-lg text-gray-600 leading-relaxed max-w-xl mx-auto">
          Backstop turns messy git logs, issues, and notes into an auditable handover document where every claim is backed by an exact quote and approved by a human.
        </p>

        {/* Big primary button */}
        <div className="pt-3">
          <button
            onClick={async () => {
              await onResetSample();
              setActiveTab("review");
            }}
            disabled={isLoading}
            className="inline-flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all transform active:scale-95 disabled:opacity-60 cursor-pointer text-base"
          >
            <RotateCcw className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`} />
            {isLoading ? "Loading sample project..." : "Start the 2-minute demo"}
            {!isLoading && <ArrowRight className="w-5 h-5" />}
          </button>
          <p className="text-xs text-gray-400 mt-2">
            Loads sample data, runs verification checks, and opens Step 2 (Check claims).
          </p>
        </div>

        {actionStatus && (
          <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-2.5 rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {actionStatus}
          </div>
        )}
      </div>

      {/* Try this - 4-step card */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <h2 className="font-bold text-gray-900 text-base">Try this - 4 steps, 2 minutes</h2>
        </div>
        <ol className="divide-y divide-gray-100">
          {[
            {
              n: 1,
              label: "Load sample data",
              sub: "Click the big button above. Backstop ingests 5 synthetic sources, masks sensitive tokens, and compiles verifiable claims.",
            },
            {
              n: 2,
              label: "Check the claims",
              sub: "Inspect claims with exact source quotes. Use 'Approve all Verified' as a demo shortcut or review one-by-one.",
            },
            {
              n: 3,
              label: "View the handover",
              sub: "Switch roles between New developer, New project manager, and Lead to observe permission-gated sections.",
            },
            {
              n: 4,
              label: "Did it work? (test)",
              sub: "Evaluate Backstop's risk rankings against unassisted post-departure ground truth metrics.",
            },
          ].map((step) => (
            <li key={step.n} className="flex items-start gap-4 px-6 py-4">
              <span className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-sm shrink-0 mt-0.5">
                {step.n}
              </span>
              <div>
                <p className="font-semibold text-gray-900 text-[15px]">{step.label}</p>
                <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{step.sub}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Next step prompt if already loaded */}
      {project && stats?.total_claims > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-bold text-emerald-900 text-[15px]">
              Sample project already loaded ({stats.total_claims} claims ready)
            </p>
            <p className="text-xs text-emerald-700 mt-0.5">
              {stats.approved_count ?? 0} approved · {stats.status_breakdown?.verified ?? 0} verified · Departing: {project.leaver_name}
            </p>
          </div>
          <button
            onClick={() => setActiveTab("review")}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors cursor-pointer shrink-0 shadow-xs"
          >
            Go to Step 2: Check claims
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Synthetic data notice, shortened */}
      <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-center leading-relaxed">
        <strong>Synthetic demonstration:</strong> All projects, people, git logs, and notes are fictional. Roles are simulated in-browser.
      </div>

      {/* Collapsible Help Panel */}
      <HelpPanel>
        <p>
          Backstop uses deterministic code analysis on git history to derive ownership, staleness, and reverts, combined with strict LLM quotation checks for decisions and risks.
          Every item requires character-by-character proof from source files before a human reviewer can approve it for handover.
        </p>
      </HelpPanel>

      {/* Advanced: re-run individual steps */}
      {project && (
        <details className="text-xs text-gray-400">
          <summary className="cursor-pointer hover:text-gray-600 font-semibold select-none">
            Advanced options
          </summary>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={onDerive}
              disabled={isLoading}
              className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 rounded-lg border border-gray-300 font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              Re-run plain code derivation
            </button>
            <button
              onClick={onExtract}
              disabled={isLoading}
              className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 rounded-lg border border-gray-300 font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              Re-run LLM extraction
            </button>
          </div>
        </details>
      )}
    </div>
  );
}
