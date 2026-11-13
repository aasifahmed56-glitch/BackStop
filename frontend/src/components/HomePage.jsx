import React, { useState } from "react";
import {
  FileText,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Database,
  Lock,
  GitCommit,
  Layers,
  HelpCircle,
} from "lucide-react";

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
    <div className="space-y-10 max-w-6xl mx-auto py-2">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white p-8 md:p-12 shadow-xl border border-indigo-700/40">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-xs font-semibold uppercase tracking-wider backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
            Deterministic & LLM-Powered Transition System
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
            Zero-Guesswork Team Handover. Verified Claim by Claim.
          </h1>
          <p className="text-base md:text-lg text-indigo-100 font-normal leading-relaxed">
            Backstop turns messy git logs, issues, meeting notes, tasks, and chat exports into an auditable ledger of claims.
            Every item is either mathematically computed by plain code or strictly cited from exact source quotes.
          </p>

          <div className="pt-4 flex flex-wrap items-center gap-4">
            <button
              onClick={onResetSample}
              disabled={isLoading}
              className="flex items-center gap-2.5 bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold px-6 py-3.5 rounded-xl shadow-lg hover:shadow-xl transition-all transform active:scale-95 disabled:opacity-50 cursor-pointer text-sm md:text-base"
            >
              <RotateCcw className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`} />
              {isLoading ? "Loading Synthetic Project..." : "Load the Sample Project"}
            </button>

            <button
              onClick={() => setActiveTab("review")}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold px-5 py-3.5 rounded-xl transition-all text-sm cursor-pointer backdrop-blur-xs"
            >
              Open Review Queue
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => setActiveTab("handover")}
              className="flex items-center gap-2 bg-indigo-600/50 hover:bg-indigo-600/70 text-indigo-100 border border-indigo-400/30 font-semibold px-5 py-3.5 rounded-xl transition-all text-sm cursor-pointer backdrop-blur-xs"
            >
              View Handover Dossier
            </button>
          </div>

          {actionStatus && (
            <div className="mt-4 p-3 rounded-lg bg-indigo-950/70 border border-indigo-500/40 text-xs text-indigo-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{actionStatus}</span>
            </div>
          )}
        </div>

        {/* Ambient background decoration */}
        <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Synthetic Data & Simulation Callout */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3.5 text-blue-900 text-sm shadow-2xs">
        <HelpCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-blue-950">Fictional Data & Simulated Role-Based Access</h4>
          <p className="mt-0.5 text-blue-800 leading-normal text-xs md:text-sm">
            All people, code commits, issues, and notes in this demo are 100% synthetic (Project: <em>Campus Event App</em>, Leaver: <em>Riya</em>, Cutoff: <em>15 Mar 2026</em>).
            There is no external login system. Use the simulated role switcher in the top bar to inspect how Backstop automatically redacts restricted information for <code className="bg-blue-100 text-blue-900 px-1 py-0.5 rounded">incoming_dev</code> and <code className="bg-blue-100 text-blue-900 px-1 py-0.5 rounded">incoming_pm</code> while providing complete clarity to <code className="bg-blue-100 text-blue-900 px-1 py-0.5 rounded">lead</code> and <code className="bg-blue-100 text-blue-900 px-1 py-0.5 rounded">admin</code>.
          </p>
        </div>
      </div>

      {/* Live Sample Project Stats */}
      {project && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Active Workspace</div>
              <h2 className="text-xl font-black text-gray-900">{project.name}</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Departing Teammate: <strong className="text-gray-800">{project.leaver_name}</strong> · Cutoff Date: <strong className="text-gray-800">{project.departure_date}</strong>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onDerive}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg border border-gray-300 transition-colors cursor-pointer"
              >
                Re-run Plain Derivation
              </button>
              <button
                onClick={onExtract}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
              >
                Re-run LLM Extraction
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <span className="text-xs font-medium text-gray-500">Ingested Sources</span>
              <div className="text-xl font-black text-gray-900 mt-1">{project.source_count || 5}</div>
              <span className="text-[11px] text-gray-400">git, issues, notes, tasks, chat</span>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <span className="text-xs font-medium text-gray-500">Indexed Chunks</span>
              <div className="text-xl font-black text-gray-900 mt-1">{project.chunk_count || 0}</div>
              <span className="text-[11px] text-gray-400">line-numbered citations</span>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <span className="text-xs font-medium text-gray-500">Total Claims in Ledger</span>
              <div className="text-xl font-black text-indigo-600 mt-1">{stats?.total_claims || 0}</div>
              <span className="text-[11px] text-gray-400">
                {stats?.kind_breakdown?.derived || 0} derived · {stats?.kind_breakdown?.interpreted || 0} interpreted
              </span>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <span className="text-xs font-medium text-gray-500">Approved for Handover</span>
              <div className="text-xl font-black text-emerald-600 mt-1">{stats?.approved_count || 0}</div>
              <span className="text-[11px] text-gray-400">ready in Day 1 / Week 1 / Month 1</span>
            </div>
          </div>
        </div>
      )}

      {/* 3-Step Guided Architecture */}
      <div className="space-y-4">
        <div className="text-center max-w-xl mx-auto">
          <h3 className="text-xl font-bold text-gray-900">How Backstop Guarantees Handover Integrity</h3>
          <p className="text-xs text-gray-500 mt-1">
            Three strict safeguards prevent hallucinated handovers, knowledge leaks, and orphan services.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {/* Step 1 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs flex flex-col justify-between hover:border-indigo-300 transition-all">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-sm">
                1
              </div>
              <h4 className="font-bold text-gray-900 text-base">Ingest & Mask Secrets</h4>
              <p className="text-xs text-gray-600 leading-relaxed">
                Raw git logs, issues, notes, and chats are parsed into chunk-level citations. Before any LLM call, API keys, passwords, emails, and phone numbers are strictly redacted.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-indigo-600 font-semibold flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Pre-LLM privacy barrier
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs flex flex-col justify-between hover:border-indigo-300 transition-all">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-sm">
                2
              </div>
              <h4 className="font-bold text-gray-900 text-base">Deduce & Double-Verify</h4>
              <p className="text-xs text-gray-600 leading-relaxed">
                Code metrics (sole knowledge, staleness, git reverts) are calculated by <strong>plain Python code</strong>. LLM items require <strong>exact substring quotes</strong> verified against original source text and corroborated by support checks.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-indigo-600 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Zero guesses tolerated
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs flex flex-col justify-between hover:border-indigo-300 transition-all">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-sm">
                3
              </div>
              <h4 className="font-bold text-gray-900 text-base">Human Review & Phased Plan</h4>
              <p className="text-xs text-gray-600 leading-relaxed">
                Human reviewers approve, correct, or reject claims with version history. Approved claims auto-compile into Day 1, Week 1, and Month 1 action plans with locked placeholders for withheld secrets.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-indigo-600 font-semibold flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Permission-aware output
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

