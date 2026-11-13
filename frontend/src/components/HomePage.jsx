import React, { useState } from "react";

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
  const [filterWarningsOnly, setFilterWarningsOnly] = useState(false);

  const derivedCount = stats?.kind_breakdown?.derived ?? 14;
  const interpretedCount = stats?.kind_breakdown?.interpreted ?? 28;
  const totalClaims = stats?.total_claims ?? (derivedCount + interpretedCount);
  const approvedCount = stats?.approved_count ?? 0;
  const approvedPercent = totalClaims > 0 ? Math.round((approvedCount / totalClaims) * 100) : 0;
  const sourcesCount = stats?.sources_count ?? 16;
  const chunksCount = stats?.chunks_count ?? 426;

  return (
    <div className="flex flex-col w-full">
      {/* Top Notification & Calibration Banner */}
      <div className="w-full bg-surface-container-low rounded-xl px-space-md py-space-sm mb-space-lg flex flex-col sm:flex-row items-center justify-between gap-space-sm shadow-sm border border-surface-container">
        <div className="flex items-center gap-space-sm">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-secondary-fixed text-on-secondary-fixed shrink-0">
            <span className="material-symbols-outlined text-[14px]">info</span>
          </span>
          <span className="font-label-md text-label-md text-on-surface-variant">
            Synthetic demonstration data. All sample records represent a fictional campus ticketing repository.
          </span>
        </div>
        <div className="flex items-center gap-space-sm text-outline font-code-sm text-code-sm shrink-0">
          <span>HASH: 8f4c2e99</span>
          <span className="text-outline-variant">•</span>
          <span className="text-tertiary font-label-sm text-label-sm flex items-center gap-1 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span>
            {isLoading ? "Pipeline Active" : "Ledger Idle"}
          </span>
        </div>
      </div>

      {/* Header & Primary Strategic Callouts */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-lg pb-space-xl">
        <div className="space-y-space-xs max-w-3xl">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-code-sm text-code-sm uppercase tracking-wider font-semibold">
              Ledger Pipeline v2.4
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
              Stage: Ingestion & Verification
            </span>
          </div>
          <h1 className="font-display-lg text-display-lg text-on-surface tracking-tight">Workspace Overview</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            Ingest team artifacts to distill unstructured commits, issues, and notes into an auditable handover ledger.
          </p>
        </div>

        {/* Quick Workflow Action Controls */}
        <div className="flex flex-wrap items-center gap-space-sm shrink-0">
          <button
            id="btn-load-workspace"
            onClick={onResetSample}
            disabled={isLoading}
            className="px-space-lg py-2.5 rounded-lg bg-primary-container text-on-primary font-headline-sm text-headline-sm shadow-sm hover:bg-primary transition-all flex items-center gap-2 active:scale-[0.98] cursor-pointer disabled:opacity-50"
            type="button"
          >
            <span className={`material-symbols-outlined text-[20px] ${isLoading ? "animate-spin" : ""}`}>
              {isLoading ? "refresh" : "play_circle"}
            </span>
            <span>{isLoading ? "Re-running Extraction..." : "Load Sample Workspace"}</span>
          </button>
          <button
            onClick={() => setActiveTab("review")}
            className="px-space-md py-2.5 rounded-lg bg-surface-container-lowest text-on-surface font-headline-sm text-headline-sm shadow-sm hover:bg-surface-container-low transition-all flex items-center gap-2 cursor-pointer border border-surface-container"
            type="button"
          >
            <span className="material-symbols-outlined text-secondary text-[20px]">fact_check</span>
            <span>View Review Queue ({totalClaims} Claims)</span>
          </button>
        </div>
      </div>

      {/* Action status toast banner */}
      {actionStatus && (
        <div className="mb-space-lg p-space-sm rounded-lg bg-surface-container text-on-surface font-label-md text-label-md flex items-center gap-2 shadow-xs border border-primary/20">
          <span className="material-symbols-outlined text-primary text-[18px]">info</span>
          <span>{actionStatus}</span>
        </div>
      )}

      {/* Active Project Master Ledger Card */}
      <section className="w-full bg-surface-container-lowest rounded-xl shadow-sm p-space-lg mb-space-2xl relative overflow-hidden border border-surface-container">
        {/* Subtle Watermark Graphic */}
        <div className="absolute -right-8 -bottom-8 pointer-events-none opacity-5">
          <span className="material-symbols-outlined text-[220px] text-primary">account_tree</span>
        </div>

        {/* Card Top Identity Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-space-md mb-space-lg bg-surface-container-low/50 -mx-space-lg -mt-space-lg px-space-lg py-space-md border-b border-surface-container/60">
          <div className="flex items-center gap-space-md">
            <div className="w-12 h-12 rounded-xl bg-primary-fixed flex items-center justify-center text-primary font-headline-lg text-headline-lg shadow-sm">
              <span className="material-symbols-outlined text-[28px]">domain_verification</span>
            </div>
            <div>
              <div className="flex items-center gap-space-sm flex-wrap">
                <h2 className="font-headline-lg text-headline-lg text-on-surface">
                  {project?.name || "Campus Event App"}
                </h2>
                <span className="px-2 py-0.5 rounded bg-tertiary/10 text-tertiary font-label-sm text-label-sm font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>Active Handover Target
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Repository UID:{" "}
                <code className="font-code-sm text-code-sm bg-surface-container px-1 py-0.5 rounded text-on-surface">
                  gh/campus-events/core-ticketing
                </code>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-space-xl mt-space-md md:mt-0">
            <div className="text-left md:text-right">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline block">
                Departing Lead
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface flex items-center md:justify-end gap-1.5 font-semibold">
                <span className="w-2 h-2 rounded-full bg-secondary"></span>Riya (Staff Software Engineer)
              </span>
            </div>
            <div className="text-left md:text-right">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline block">
                Cutoff Date
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface flex items-center md:justify-end gap-1 font-semibold">
                <span className="material-symbols-outlined text-[16px] text-primary">event_busy</span>2026-03-15
              </span>
            </div>
          </div>
        </div>

        {/* Core Metrics Dashboard Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md mb-space-lg">
          {/* Metric 1: Ingested Sources */}
          <div className="bg-surface-container-low rounded-xl p-space-md flex flex-col justify-between border border-surface-container/60">
            <div>
              <div className="flex items-center justify-between mb-space-xs">
                <span className="font-label-sm text-label-sm uppercase font-semibold text-on-surface-variant">
                  Raw Artifacts
                </span>
                <span className="material-symbols-outlined text-outline text-[18px]">folder_zip</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-display-lg text-display-lg text-on-surface">{sourcesCount}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Sources Bound</span>
              </div>
            </div>
            <div className="mt-space-md pt-space-xs bg-surface-container-lowest/60 rounded px-2 py-1.5">
              <span className="font-code-sm text-code-sm text-outline truncate block">
                git_log.txt, issues.json, notes/*.md, tasks.csv
              </span>
            </div>
          </div>

          {/* Metric 2: Indexed Chunks */}
          <div className="bg-surface-container-low rounded-xl p-space-md flex flex-col justify-between border border-surface-container/60">
            <div>
              <div className="flex items-center justify-between mb-space-xs">
                <span className="font-label-sm text-label-sm uppercase font-semibold text-on-surface-variant">
                  Chunk Density
                </span>
                <span className="material-symbols-outlined text-outline text-[18px]">data_array</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-display-lg text-display-lg text-on-surface">{chunksCount}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Indexed Chunks</span>
              </div>
            </div>
            <div className="mt-space-md flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm">
              <span>Pre-Masking Redactions</span>
              <span className="font-code-sm text-code-sm font-semibold text-tertiary">38 Secrets Removed</span>
            </div>
          </div>

          {/* Metric 3: Extracted Claims Split */}
          <div className="bg-surface-container-low rounded-xl p-space-md flex flex-col justify-between border border-surface-container/60">
            <div>
              <div className="flex items-center justify-between mb-space-xs">
                <span className="font-label-sm text-label-sm uppercase font-semibold text-on-surface-variant">
                  Claims Extracted
                </span>
                <span className="material-symbols-outlined text-primary text-[18px]">analytics</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-display-lg text-display-lg text-on-surface">{totalClaims}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Total Claims</span>
              </div>
            </div>
            <div className="mt-space-md flex flex-col gap-1 font-label-sm text-label-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-on-surface-variant">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                  {derivedCount} Derived (Python AST)
                </span>
                <span className="font-code-sm text-code-sm text-outline">
                  {totalClaims > 0 ? Math.round((derivedCount / totalClaims) * 100) : 33}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-on-surface-variant">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                  {interpretedCount} Interpreted (LLM)
                </span>
                <span className="font-code-sm text-code-sm text-outline">
                  {totalClaims > 0 ? Math.round((interpretedCount / totalClaims) * 100) : 67}%
                </span>
              </div>
            </div>
          </div>

          {/* Metric 4: Ledger Status */}
          <div className="bg-surface-container-low rounded-xl p-space-md flex flex-col justify-between border border-surface-container/60">
            <div>
              <div className="flex items-center justify-between mb-space-xs">
                <span className="font-label-sm text-label-sm uppercase font-semibold text-on-surface-variant">
                  Ledger State
                </span>
                <span className="material-symbols-outlined text-tertiary text-[18px]">gavel</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-display-lg text-display-lg text-on-surface">{approvedCount}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Approved Claims</span>
              </div>
            </div>
            <div className="mt-space-md">
              <div className="w-full bg-surface-container rounded-full h-2 overflow-hidden mb-1.5">
                <div
                  className="bg-secondary h-full rounded-full transition-all duration-500"
                  style={{ width: `${approvedPercent}%` }}
                ></div>
              </div>
              <span className="font-label-sm text-label-sm text-on-surface-variant block">
                {approvedCount === 0 ? "Pending peer verification" : `${approvedPercent}% peer verified`}
              </span>
            </div>
          </div>
        </div>

        {/* Active Ingestion Trace Preview Strip */}
        <div className="bg-surface-container-low/40 rounded-xl p-space-md flex flex-col lg:flex-row lg:items-center justify-between gap-space-md border border-surface-container">
          <div className="flex items-center gap-space-md min-w-0">
            <span className="material-symbols-outlined text-secondary text-[24px] shrink-0">schema</span>
            <div className="min-w-0">
              <p className="font-headline-sm text-headline-sm text-on-surface truncate font-semibold">
                Dual-Track Ledger Engine Status
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                All {totalClaims} claims verified against repository state. 14 deterministic git code-ownership proofs matched directly.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2.5 py-1 rounded bg-surface-container text-on-surface font-code-sm text-code-sm font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-tertiary"></span>AST Cache Primed
            </span>
            <span className="px-2.5 py-1 rounded bg-surface-container text-on-surface font-code-sm text-code-sm font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-secondary"></span>Strict Substring Enforced
            </span>
          </div>
        </div>
      </section>

      {/* Section 2: Methodology Architecture Cards */}
      <section className="w-full mb-space-2xl">
        <div className="flex items-center justify-between mb-space-lg">
          <div>
            <h3 className="font-headline-lg text-headline-lg text-on-surface">Methodology & Operational Pipeline</h3>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Deterministic verification ensures auditability without hallucinated context.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-on-surface-variant font-label-md text-label-md">
            <span className="material-symbols-outlined text-[18px]">verified_user</span>
            <span>Standard Audit Pipeline RFC-094</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">
          {/* Methodology Card 1 */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col justify-between hover:shadow-md transition-all border border-surface-container">
            <div>
              <div className="flex items-center justify-between mb-space-md">
                <span className="w-9 h-9 rounded-lg bg-surface-container-low text-primary flex items-center justify-center font-headline-sm text-headline-sm font-bold">
                  01
                </span>
                <span className="material-symbols-outlined text-outline text-[22px]">enhanced_encryption</span>
              </div>
              <h4 className="font-headline-md text-headline-md text-on-surface mb-space-xs font-semibold">
                1. Ingest & Pre-LLM Masking
              </h4>
              <p className="font-body-md text-body-md text-on-surface-variant mb-space-md">
                Secrets, API keys, credentials, and PII are redacted before touching any prompt or cache.
              </p>
            </div>
            <div className="bg-surface-container-low rounded-lg p-space-sm space-y-space-xs border border-surface-container/60">
              <div className="flex items-center justify-between font-label-sm text-label-sm">
                <span className="text-on-surface-variant">Regex Redaction Engine</span>
                <span className="font-code-sm text-code-sm text-tertiary font-semibold">Active</span>
              </div>
              <div className="font-code-sm text-code-sm text-outline truncate bg-surface-container-lowest px-2 py-1 rounded">
                API_KEY=******** [TOKEN_REDACTED]
              </div>
            </div>
          </div>

          {/* Methodology Card 2 */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col justify-between hover:shadow-md transition-all border border-surface-container">
            <div>
              <div className="flex items-center justify-between mb-space-md">
                <span className="w-9 h-9 rounded-lg bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center font-headline-sm text-headline-sm font-bold">
                  02
                </span>
                <span className="material-symbols-outlined text-secondary text-[22px]">mediation</span>
              </div>
              <h4 className="font-headline-md text-headline-md text-on-surface mb-space-xs font-semibold">
                2. Dual-Track Derivation & Verification
              </h4>
              <p className="font-body-md text-body-md text-on-surface-variant mb-space-md">
                Code ownership and sole-knowledge risks are calculated by deterministic Python. Qualitative claims require verbatim substring match.
              </p>
            </div>
            <div className="bg-surface-container-low rounded-lg p-space-sm space-y-space-xs border border-surface-container/60">
              <div className="flex items-center justify-between font-label-sm text-label-sm">
                <span className="text-on-surface-variant">Verification Modes</span>
                <span className="font-code-sm text-code-sm text-secondary font-semibold">Dual Trace</span>
              </div>
              <div className="font-code-sm text-code-sm text-outline truncate bg-surface-container-lowest px-2 py-1 rounded">
                AST Blame (14) + Substring Match (28)
              </div>
            </div>
          </div>

          {/* Methodology Card 3 */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col justify-between hover:shadow-md transition-all border border-surface-container">
            <div>
              <div className="flex items-center justify-between mb-space-md">
                <span className="w-9 h-9 rounded-lg bg-surface-container-low text-tertiary flex items-center justify-center font-headline-sm text-headline-sm font-bold">
                  03
                </span>
                <span className="material-symbols-outlined text-outline text-[22px]">approval_delegation</span>
              </div>
              <h4 className="font-headline-md text-headline-md text-on-surface mb-space-xs font-semibold">
                3. Human Review & Phased Handover
              </h4>
              <p className="font-body-md text-body-md text-on-surface-variant mb-space-md">
                Leads review and verify claims before compiling into Day 1, Week 1, and Month 1 role-gated dossiers.
              </p>
            </div>
            <div className="bg-surface-container-low rounded-lg p-space-sm space-y-space-xs border border-surface-container/60">
              <div className="flex items-center justify-between font-label-sm text-label-sm">
                <span className="text-on-surface-variant">Handover Phasing</span>
                <span className="font-code-sm text-code-sm text-primary font-semibold">3 Dossiers</span>
              </div>
              <div className="font-code-sm text-code-sm text-outline truncate bg-surface-container-lowest px-2 py-1 rounded">
                Targeting: Onboarding, Architecture, SRE
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Demonstration Sandbox Log Panel */}
      <section className="w-full bg-surface-container-lowest rounded-xl shadow-sm p-space-lg border border-surface-container">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-space-md mb-space-md border-b border-surface-container/60">
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-primary text-[20px]">terminal</span>
            <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Extraction Ledger Engine Trace
            </h4>
          </div>
          <div className="flex items-center gap-space-sm">
            <span className="font-code-sm text-code-sm text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
              Worker #1: python_ast_evaluator.py
            </span>
            <button
              id="btn-toggle-log"
              type="button"
              onClick={() => setFilterWarningsOnly(!filterWarningsOnly)}
              className="font-label-md text-label-md text-primary hover:underline cursor-pointer"
            >
              {filterWarningsOnly ? "Show All Events" : "Filter Warnings"}
            </button>
          </div>
        </div>

        {/* Terminal-like High Contrast Output Container */}
        <div className="w-full bg-surface-container-low rounded-xl p-space-md font-code-sm text-code-sm text-on-surface-variant space-y-2 max-h-56 overflow-y-auto border border-surface-container">
          <div className="flex items-start gap-space-sm">
            <span className="text-outline">10:42:01.012</span>
            <span className="text-tertiary font-bold">[INIT]</span>
            <span>
              Mounted virtual workspace for <code>gh/campus-events/core-ticketing</code>
            </span>
          </div>
          <div className="flex items-start gap-space-sm">
            <span className="text-outline">10:42:01.184</span>
            <span className="text-tertiary font-bold">[MASK]</span>
            <span>Inspected 16 artifacts. 38 secrets redacted via entropy/regex analyzer. 0 plaintext leaks.</span>
          </div>
          <div className="flex items-start gap-space-sm">
            <span className="text-outline">10:42:02.409</span>
            <span className="text-secondary font-bold">[DERIVATION]</span>
            <span>Python git blame analysis extracted 14 ownership metrics (100% deterministic, SHA256 verified).</span>
          </div>
          <div className="flex items-start gap-space-sm">
            <span className="text-outline">10:42:04.912</span>
            <span className="text-primary font-bold">[INTERPRET]</span>
            <span>LLM semantic extractor created 28 qualitative claims; all 28 passed verbatim substring verification.</span>
          </div>
          <div className="flex items-start gap-space-sm">
            <span className="text-outline">10:42:05.004</span>
            <span className="text-tertiary font-bold">[READY]</span>
            <span className="text-on-surface font-medium">
              Ready for lead approval. 42 unverified claims awaiting triage in Review Queue.
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
