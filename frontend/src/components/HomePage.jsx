import React from "react";

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
  const totalClaims = stats?.total ?? 0;
  const approvedCount = stats?.by_review?.approved ?? 0;
  const approvedPercent = totalClaims > 0 ? Math.round((approvedCount / totalClaims) * 100) : 0;
  const verifiedCount = stats?.by_status?.verified ?? 0;
  const pendingCount = stats?.by_review?.pending ?? 0;
  const sourcesCount = project?.source_count ?? 16;
  const chunksCount = project?.chunk_count ?? 426;
  const sources = project?.sources || [];

  return (
    <div className="flex flex-col w-full">
      {/* Top Notification & Calibration Banner */}
      <div className="w-full bg-surface-container-low rounded-xl px-space-md py-space-sm mb-space-lg flex flex-col sm:flex-row items-center justify-between gap-space-sm shadow-sm border border-surface-container">
        <div className="flex items-center gap-space-sm">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-secondary-fixed text-on-secondary-fixed shrink-0">
            <span className="material-symbols-outlined text-[14px]">info</span>
          </span>
          <span className="font-label-md text-label-md text-on-surface-variant">
            Synthetic demonstration data. Automated checks reduce errors and a human approves.
          </span>
        </div>
        <div className="flex items-center gap-space-sm text-outline font-code-sm text-code-sm shrink-0">
          <span>Audit Ledger</span>
          <span className="text-outline-variant">•</span>
          <span className="text-tertiary font-label-sm text-label-sm flex items-center gap-1 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span>
            {isLoading ? "Pipeline Active" : "Ledger Ready"}
          </span>
        </div>
      </div>

      {/* Header & Primary Strategic Callouts */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-lg pb-space-xl">
        <div className="space-y-space-xs max-w-3xl">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-code-sm text-code-sm uppercase tracking-wider font-semibold">
              Ledger Pipeline
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
                Target Project ID:{" "}
                <code className="font-code-sm text-code-sm bg-surface-container px-1 py-0.5 rounded text-on-surface">
                  project-{project?.id || 1}
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
                <span className="w-2 h-2 rounded-full bg-secondary"></span>{project?.leaver_name || "Departing Lead"}
              </span>
            </div>
            <div className="text-left md:text-right">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline block">
                Cutoff Date
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface flex items-center md:justify-end gap-1 font-semibold">
                <span className="material-symbols-outlined text-[16px] text-primary">event_busy</span>{project?.departure_date || "—"}
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
                <span className="material-symbols-outlined text-outline text-[18px]">folder</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-display-lg text-display-lg text-on-surface">{sourcesCount}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Sources Bound</span>
              </div>
            </div>
            <div className="mt-space-md pt-space-xs bg-surface-container-lowest/60 rounded px-2 py-1.5">
              <span className="font-code-sm text-code-sm text-outline truncate block">
                {sources.length > 0 ? sources.slice(0, 4).map((s) => s.name).join(", ") : "git_log.txt, issues.json, tasks.csv"}
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
              <span>Secret Redaction</span>
              <span className="font-code-sm text-code-sm font-semibold text-tertiary">Active</span>
            </div>
          </div>

          {/* Metric 3: Claims Breakdown */}
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
                  Verified: {verifiedCount}
                </span>
                <span className="font-code-sm text-code-sm text-outline">
                  {totalClaims > 0 ? Math.round((verifiedCount / totalClaims) * 100) : 0}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-on-surface-variant">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                  Pending Review: {pendingCount}
                </span>
                <span className="font-code-sm text-code-sm text-outline">
                  {totalClaims > 0 ? Math.round((pendingCount / totalClaims) * 100) : 0}%
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
                {approvedCount === 0 ? "Pending human review" : `${approvedPercent}% approved by reviewer`}
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
                Dual-Track Pipeline Status
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                {totalClaims} claims generated from repository artifacts. Automated checks reduce errors and a human approves.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2.5 py-1 rounded bg-surface-container text-on-surface font-code-sm text-code-sm font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-tertiary"></span>Analysis Cache Ready
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
              Dual-track verification ensures auditability without ungrounded context.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-on-surface-variant font-label-md text-label-md">
            <span className="material-symbols-outlined text-[18px]">verified_user</span>
            <span>Standard Review Pipeline</span>
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
                Credentials redacted before ingestion
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
                Code ownership and sole-knowledge risks are calculated by Python scripts from git history. Qualitative claims require verbatim substring match.
              </p>
            </div>
            <div className="bg-surface-container-low rounded-lg p-space-sm space-y-space-xs border border-surface-container/60">
              <div className="flex items-center justify-between font-label-sm text-label-sm">
                <span className="text-on-surface-variant">Verification Modes</span>
                <span className="font-code-sm text-code-sm text-secondary font-semibold">Dual Trace</span>
              </div>
              <div className="font-code-sm text-code-sm text-outline truncate bg-surface-container-lowest px-2 py-1 rounded">
                Code Ownership + Substring Match
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
                <span className="font-code-sm text-code-sm text-primary font-semibold">3 Horizons</span>
              </div>
              <div className="font-code-sm text-code-sm text-outline truncate bg-surface-container-lowest px-2 py-1 rounded">
                Day 1, Week 1, Month 1
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ingested Sources Section from Backend */}
      <section className="w-full bg-surface-container-lowest rounded-xl shadow-sm p-space-lg border border-surface-container">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-space-md mb-space-md border-b border-surface-container/60">
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-primary text-[20px]">folder_open</span>
            <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Ingested Repository Artifacts ({sources.length})
            </h4>
          </div>
          <span className="font-label-md text-label-md text-on-surface-variant">
            {chunksCount} indexed chunks across all sources
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-sm">
          {sources.map((src) => (
            <div
              key={src.id}
              className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container/60 flex items-center justify-between"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="material-symbols-outlined text-[18px] text-outline">description</span>
                <span className="font-code-sm text-code-sm text-on-surface truncate font-medium">{src.name}</span>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-surface-container text-on-surface-variant">
                {src.access_level}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
