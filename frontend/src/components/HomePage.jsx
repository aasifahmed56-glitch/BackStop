import React from "react";
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
  FolderArchive,
  Terminal,
  Clock,
  User,
  Calendar,
  Check,
  FileCode,
  ShieldCheck,
  Cpu,
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
  const derivedCount = stats?.kind_breakdown?.derived ?? 0;
  const interpretedCount = stats?.kind_breakdown?.interpreted ?? 0;
  const totalClaims = stats?.total_claims ?? (derivedCount + interpretedCount);
  const approvedCount = stats?.approved_count ?? 0;
  const approvedPercent = totalClaims > 0 ? Math.round((approvedCount / totalClaims) * 100) : 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-2">
      {/* Top Notification & Calibration Banner */}
      <div className="w-full bg-[#eff4ff] border border-[#dce9ff] rounded-xl px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#dbe1ff] text-[#00174b] shrink-0">
            <HelpCircle className="w-3.5 h-3.5 text-[#004ac6]" />
          </span>
          <span className="text-xs text-[#434655] font-medium leading-normal">
            <strong>Synthetic Demonstration Data:</strong> All sample records represent a fictional campus ticketing repository (<em>Campus Event App</em>, Leaver: <em>Riya</em>, Cutoff: <em>15 Mar 2026</em>).
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-[#737686] shrink-0">
          <span className="bg-white px-2 py-0.5 rounded border border-[#dce9ff] text-[11px] font-semibold text-[#004ac6]">
            HASH: 8f4c2e99
          </span>
          <span className="text-[#c3c6d7]">•</span>
          <span className="text-[#006243] text-[11px] font-bold flex items-center gap-1.5 font-sans">
            <span className="w-1.5 h-1.5 rounded-full bg-[#007d57] animate-pulse"></span>
            Ledger Ready
          </span>
        </div>
      </div>

      {/* Header & Primary Strategic Callouts */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-2">
        <div className="space-y-2 max-w-3xl">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-[#dbe1ff] text-[#00174b] font-mono text-[11px] uppercase tracking-wider font-bold">
              Ledger Pipeline v2.4
            </span>
            <span className="text-xs text-[#737686] font-medium">
              Stage: Ingestion & Verification
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0b1c30] tracking-tight leading-tight">
            Every claim shows its source quote and a status. A human approves before handover.
          </h1>
          <p className="text-sm sm:text-base text-[#434655] font-normal leading-relaxed">
            Backstop turns messy git logs, issues, meeting notes, tasks, and chat exports into an auditable handover ledger.
            Code metrics are mathematically calculated by plain Python; qualitative items require exact substring quotes.
          </p>
        </div>

        {/* Quick Workflow Action Controls */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={onResetSample}
            disabled={isLoading}
            className="px-5 py-2.5 rounded-lg bg-[#004ac6] hover:bg-[#003ea8] text-white font-semibold text-xs sm:text-sm shadow-xs hover:shadow-sm transition-all flex items-center gap-2 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            <RotateCcw className={`w-4 h-4 text-white ${isLoading ? "animate-spin" : ""}`} />
            <span>{isLoading ? "Loading Synthetic Project..." : "Load the Sample Project"}</span>
          </button>

          <button
            onClick={() => setActiveTab("review")}
            className="px-4 py-2.5 rounded-lg bg-white hover:bg-[#f8f9ff] text-[#0b1c30] border border-[#e2e8f0] font-semibold text-xs sm:text-sm shadow-2xs hover:shadow-xs transition-all flex items-center gap-2 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-[#4b41e1]" />
            <span>Open Review Queue</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#737686]" />
          </button>

          <button
            onClick={() => setActiveTab("handover")}
            className="px-4 py-2.5 rounded-lg bg-[#eff4ff] hover:bg-[#e5eeff] text-[#004ac6] border border-[#dce9ff] font-semibold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <FileText className="w-4 h-4 text-[#004ac6]" />
            <span>View Handover Dossier</span>
          </button>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionStatus && (
        <div className="p-3.5 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] text-xs text-[#065f46] flex items-center gap-2.5 shadow-2xs animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0" />
          <span className="font-medium">{actionStatus}</span>
        </div>
      )}

      {/* Active Project Master Ledger Card */}
      {project && (
        <section className="w-full bg-white rounded-xl border border-[#e2e8f0] shadow-xs p-6 relative overflow-hidden">
          {/* Card Top Identity Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-5 mb-6 border-b border-[#f1f5f9] -mx-6 -mt-6 px-6 pt-6 bg-[#f8f9ff]/70">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-[#dbe1ff] flex items-center justify-center text-[#004ac6] shadow-2xs">
                <Database className="w-6 h-6 text-[#004ac6]" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-[#0b1c30]">{project.name}</h2>
                  <span className="px-2 py-0.5 rounded bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0] text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#059669]"></span>
                    Active Handover Target
                  </span>
                </div>
                <p className="text-xs text-[#737686] mt-0.5">
                  Repository UID: <code className="font-mono bg-[#e5eeff] text-[#0b1c30] px-1.5 py-0.2 rounded text-[11px]">gh/campus-events/core-ticketing</code>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 mt-4 md:mt-0">
              <div className="text-left md:text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#737686] block">Departing Lead</span>
                <span className="text-sm font-semibold text-[#0b1c30] flex items-center md:justify-end gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-[#4b41e1]"></span>
                  {project.leaver_name} (Staff Engineer)
                </span>
              </div>
              <div className="text-left md:text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#737686] block">Cutoff Date</span>
                <span className="text-sm font-semibold text-[#0b1c30] flex items-center md:justify-end gap-1.5 mt-0.5 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-[#004ac6]" />
                  {project.departure_date}
                </span>
              </div>

              {/* Maintenance Re-runs */}
              <div className="flex items-center gap-2 pt-1 md:pt-0">
                <button
                  onClick={onDerive}
                  disabled={isLoading}
                  className="px-2.5 py-1.5 text-xs font-semibold bg-white hover:bg-[#f8f9ff] text-[#334155] rounded-lg border border-[#e2e8f0] transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                  title="Re-compute code ownership, staleness, and sole-knowledge risks from git"
                >
                  Re-derive
                </button>
                <button
                  onClick={onExtract}
                  disabled={isLoading}
                  className="px-2.5 py-1.5 text-xs font-semibold bg-[#eff4ff] hover:bg-[#e5eeff] text-[#004ac6] rounded-lg border border-[#dce9ff] transition-colors cursor-pointer disabled:opacity-50"
                  title="Re-run LLM claim extraction with substring verification"
                >
                  Re-extract
                </button>
              </div>
            </div>
          </div>

          {/* Core Metrics Dashboard Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Metric 1: Ingested Sources */}
            <div className="bg-[#f8f9ff] rounded-xl p-4 border border-[#e2e8f0]/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#737686]">Raw Artifacts</span>
                  <FolderArchive className="w-4 h-4 text-[#737686]" />
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-extrabold text-[#0b1c30]">{project.source_count || 5}</span>
                  <span className="text-xs text-[#737686]">Sources Bound</span>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-[#e2e8f0]/60">
                <span className="text-[11px] font-mono text-[#737686] truncate block">
                  git_log.txt, issues.json, notes/*.md, tasks.csv, chat.json
                </span>
              </div>
            </div>

            {/* Metric 2: Indexed Chunks */}
            <div className="bg-[#f8f9ff] rounded-xl p-4 border border-[#e2e8f0]/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#737686]">Chunk Density</span>
                  <Layers className="w-4 h-4 text-[#737686]" />
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-extrabold text-[#0b1c30]">{project.chunk_count || 0}</span>
                  <span className="text-xs text-[#737686]">Indexed Chunks</span>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-[#e2e8f0]/60 flex items-center justify-between text-xs">
                <span className="text-[#737686]">Line citations</span>
                <span className="text-[11px] font-bold font-mono text-[#006243]">Pre-Masking Scrubbed</span>
              </div>
            </div>

            {/* Metric 3: Extracted Claims Split */}
            <div className="bg-[#f8f9ff] rounded-xl p-4 border border-[#e2e8f0]/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#737686]">Claims Extracted</span>
                  <Sparkles className="w-4 h-4 text-[#004ac6]" />
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-extrabold text-[#004ac6]">{totalClaims}</span>
                  <span className="text-xs text-[#737686]">Total Claims</span>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-[#e2e8f0]/60 flex items-center justify-between text-xs">
                <span className="text-[#4b41e1] font-semibold">{derivedCount} Derived (Plain Code)</span>
                <span className="text-[#004ac6] font-semibold">{interpretedCount} Interpreted</span>
              </div>
            </div>

            {/* Metric 4: Ledger State */}
            <div className="bg-[#f8f9ff] rounded-xl p-4 border border-[#e2e8f0]/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#737686]">Ledger State</span>
                  <ShieldCheck className="w-4 h-4 text-[#059669]" />
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-extrabold text-[#059669]">{approvedCount}</span>
                  <span className="text-xs text-[#737686]">Approved Claims</span>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-[#e2e8f0]/60">
                <div className="w-full bg-[#e2e8f0] rounded-full h-1.5 overflow-hidden mb-1">
                  <div
                    className="bg-[#059669] h-full rounded-full transition-all duration-500"
                    style={{ width: `${approvedPercent}%` }}
                  />
                </div>
                <span className="text-[11px] text-[#737686] block">
                  {approvedCount > 0 ? `${approvedPercent}% approved for handover` : "Pending peer verification in Review"}
                </span>
              </div>
            </div>
          </div>

          {/* Active Ingestion Trace Preview Strip */}
          <div className="bg-[#eff4ff]/60 border border-[#dce9ff] rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Cpu className="w-5 h-5 text-[#4b41e1] shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold text-[#0b1c30] truncate">
                  Dual-Track Ledger Engine Status
                </p>
                <p className="text-xs text-[#434655] truncate">
                  Code metrics computed by plain Python algorithms; qualitative claims verified with character-by-character substring quotes.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-2.5 py-1 rounded bg-white text-[#0b1c30] font-mono text-[11px] font-semibold border border-[#dce9ff] flex items-center gap-1.5 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-[#007d57]"></span>
                Plain-Code AST Primed
              </span>
              <span className="px-2.5 py-1 rounded bg-white text-[#0b1c30] font-mono text-[11px] font-semibold border border-[#dce9ff] flex items-center gap-1.5 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-[#4b41e1]"></span>
                Strict Substrings Enforced
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Methodology Architecture Cards */}
      <section className="w-full space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xl font-bold text-[#0b1c30]">Methodology & Operational Pipeline</h3>
            <p className="text-xs text-[#737686] mt-0.5">
              Three strict safeguards prevent hallucinated handovers, knowledge leaks, and orphan services.
            </p>
          </div>
          <span className="text-[11px] font-mono text-[#004ac6] bg-[#dbe1ff] px-2.5 py-1 rounded-md font-semibold self-start sm:self-auto">
            Audit Pipeline RFC-094
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-1">
          {/* Methodology Card 1 */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs p-6 flex flex-col justify-between hover:border-[#cbd5e1] hover:shadow-sm transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-9 h-9 rounded-lg bg-[#eff4ff] text-[#004ac6] flex items-center justify-center font-bold text-sm border border-[#dce9ff]">
                  01
                </span>
                <Lock className="w-4 h-4 text-[#737686]" />
              </div>
              <h4 className="font-bold text-[#0b1c30] text-base">
                1. Ingest & Pre-LLM Masking
              </h4>
              <p className="text-xs text-[#434655] leading-relaxed">
                Raw git logs, issues, notes, and chats are parsed into chunk-level citations. Before any LLM call, API keys, passwords, emails, and phone numbers are strictly redacted.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-[#f1f5f9] bg-[#f8f9ff] -mx-6 -mb-6 p-4 rounded-b-xl space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#737686] text-[11px] font-medium">Regex Redaction Engine</span>
                <span className="font-mono text-[11px] font-bold text-[#006243]">Active</span>
              </div>
              <div className="font-mono text-[10px] text-[#737686] truncate bg-white px-2 py-1 rounded border border-[#e2e8f0]">
                API_KEY=******** [TOKEN_REDACTED]
              </div>
            </div>
          </div>

          {/* Methodology Card 2 */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs p-6 flex flex-col justify-between hover:border-[#cbd5e1] hover:shadow-sm transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-9 h-9 rounded-lg bg-[#e2dfff] text-[#0f0069] flex items-center justify-center font-bold text-sm border border-[#c3c0ff]">
                  02
                </span>
                <CheckCircle2 className="w-4 h-4 text-[#4b41e1]" />
              </div>
              <h4 className="font-bold text-[#0b1c30] text-base">
                2. Deduce & Double-Verify
              </h4>
              <p className="text-xs text-[#434655] leading-relaxed">
                Code metrics (sole knowledge, staleness, git reverts) are calculated by <strong>plain Python code</strong>. Qualitative claims require <strong>exact substring quotes</strong> verified against original source text.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-[#f1f5f9] bg-[#f8f9ff] -mx-6 -mb-6 p-4 rounded-b-xl space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#737686] text-[11px] font-medium">Verification Modes</span>
                <span className="font-mono text-[11px] font-bold text-[#4b41e1]">Dual Trace</span>
              </div>
              <div className="font-mono text-[10px] text-[#737686] truncate bg-white px-2 py-1 rounded border border-[#e2e8f0]">
                AST Blame (14) + Substring Match (28)
              </div>
            </div>
          </div>

          {/* Methodology Card 3 */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs p-6 flex flex-col justify-between hover:border-[#cbd5e1] hover:shadow-sm transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-9 h-9 rounded-lg bg-[#eff4ff] text-[#006243] flex items-center justify-center font-bold text-sm border border-[#dce9ff]">
                  03
                </span>
                <Shield className="w-4 h-4 text-[#006243]" />
              </div>
              <h4 className="font-bold text-[#0b1c30] text-base">
                3. Human Review & Phased Handover
              </h4>
              <p className="text-xs text-[#434655] leading-relaxed">
                Human reviewers approve, correct, or reject claims with version history. Approved claims auto-compile into Day 1, Week 1, and Month 1 action plans with locked placeholders for withheld secrets.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-[#f1f5f9] bg-[#f8f9ff] -mx-6 -mb-6 p-4 rounded-b-xl space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#737686] text-[11px] font-medium">Handover Phasing</span>
                <span className="font-mono text-[11px] font-bold text-[#004ac6]">3 Horizons</span>
              </div>
              <div className="font-mono text-[10px] text-[#737686] truncate bg-white px-2 py-1 rounded border border-[#e2e8f0]">
                Day 1 (Survival) · Wk 1 (Decisions) · Mo 1 (Ramp)
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Extraction Ledger Engine Trace (Terminal View) */}
      <section className="w-full bg-white rounded-xl border border-[#e2e8f0] shadow-xs p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-3 border-b border-[#f1f5f9]">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#004ac6]" />
            <h4 className="text-sm font-bold text-[#0b1c30]">Extraction Ledger Engine Trace</h4>
          </div>
          <span className="font-mono text-[11px] text-[#434655] bg-[#eff4ff] px-2 py-0.5 rounded border border-[#dce9ff] self-start sm:self-auto">
            Worker #1: python_ast_evaluator.py (offline deterministic)
          </span>
        </div>

        <div className="w-full bg-[#f8f9ff] rounded-lg p-4 font-mono text-xs text-[#434655] space-y-2 max-h-56 overflow-y-auto border border-[#e2e8f0]/80">
          <div className="flex items-start gap-2.5">
            <span className="text-[#737686] shrink-0">10:42:01.012</span>
            <span className="text-[#006243] font-bold shrink-0">[INIT]</span>
            <span>Mounted virtual workspace for <code>gh/campus-events/core-ticketing</code></span>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="text-[#737686] shrink-0">10:42:01.184</span>
            <span className="text-[#006243] font-bold shrink-0">[MASK]</span>
            <span>Inspected raw artifacts. API keys, passwords, emails &amp; phones redacted. 0 plaintext leaks.</span>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="text-[#737686] shrink-0">10:42:02.409</span>
            <span className="text-[#4b41e1] font-bold shrink-0">[DERIVATION]</span>
            <span>Plain Python git blame analysis extracted ownership &amp; sole-knowledge metrics (100% deterministic).</span>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="text-[#737686] shrink-0">10:42:04.912</span>
            <span className="text-[#004ac6] font-bold shrink-0">[INTERPRET]</span>
            <span>LLM semantic extractor created qualitative claims; strict verbatim substring quote validation enforced.</span>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="text-[#737686] shrink-0">10:42:05.004</span>
            <span className="text-[#006243] font-bold shrink-0">[READY]</span>
            <span className="text-[#0b1c30] font-semibold">Ledger ready for lead approval. Inspect citations in Review Queue.</span>
          </div>
        </div>
      </section>
    </div>
  );
}

