import React from "react";

export default function HomePage({
  project,
  stats,
  onResetSample,
  setActiveTab,
  isLoading,
  actionStatus,
}) {
  const totalClaims = stats?.total ?? 0;
  const approvedCount = stats?.by_review?.approved ?? 0;
  const approvedPercent = totalClaims > 0 ? Math.round((approvedCount / totalClaims) * 100) : 0;
  const pendingCount = stats?.by_review?.pending ?? 0;
  const sourcesCount = project?.source_count ?? 16;
  const sources = project?.sources || [];

  const handleTryDemo = async () => {
    if (isLoading) return;
    try {
      if (onResetSample) {
        await onResetSample();
      }
      setActiveTab("review");
    } catch (err) {
      console.error("Failed to load sample demo", err);
      setActiveTab("review");
    }
  };

  return (
    <div className="flex flex-col w-full gap-space-xl">
      {/* Short Synthetic Data Note */}
      <div className="w-full bg-surface-container-low rounded-xl px-space-md py-space-sm flex flex-col sm:flex-row items-center justify-between gap-space-sm shadow-xs border border-surface-container">
        <div className="flex items-center gap-space-sm">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-secondary-fixed text-on-secondary-fixed shrink-0">
            <span className="material-symbols-outlined text-[14px]">info</span>
          </span>
          <span className="font-label-md text-label-md text-on-surface-variant">
            Synthetic demonstration data. Automated checks reduce errors and a human approves.
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-tertiary font-label-sm text-label-sm font-semibold shrink-0">
          <span className="w-2 h-2 rounded-full bg-tertiary"></span>
          <span>{isLoading ? "Loading sample..." : "Demo Ready"}</span>
        </div>
      </div>

      {/* Hero Section: 10-Second Value Proposition */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-xl py-space-md">
        <div className="space-y-space-md max-w-2xl">
          <h1 className="font-display-lg text-display-lg sm:text-4xl text-on-surface tracking-tight font-bold">
            When someone leaves your team, their knowledge shouldn't.
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed">
            Backstop captures critical project knowledge, decisions, and system ownership from your tools before engineers move on. Built for small software teams, it turns scattered team activity into a verified, role-based handover plan in minutes.
          </p>
          <div className="pt-space-xs">
            {/* ONE Primary Button */}
            <button
              id="btn-try-demo"
              onClick={handleTryDemo}
              disabled={isLoading}
              className="px-space-xl py-3.5 rounded-xl bg-primary text-on-primary font-headline-sm text-headline-sm shadow-md hover:bg-primary/90 transition-all flex items-center gap-2.5 active:scale-[0.98] cursor-pointer disabled:opacity-50"
              type="button"
            >
              <span className={`material-symbols-outlined text-[22px] ${isLoading ? "animate-spin" : ""}`}>
                {isLoading ? "refresh" : "play_circle"}
              </span>
              <span>{isLoading ? "Loading demo workspace..." : "Try the 2-minute demo"}</span>
            </button>
          </div>
        </div>

        {/* Small "Example Story" Card */}
        <div className="w-full lg:max-w-md bg-surface-container-lowest rounded-2xl p-space-lg border border-surface-container shadow-sm flex flex-col gap-space-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-1 rounded-md bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm font-bold uppercase tracking-wider">
              Example story
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1 font-medium">
              <span className="w-2 h-2 rounded-full bg-secondary"></span>
              Departing Nov 15
            </span>
          </div>

          <div className="pt-space-xs">
            <p className="font-headline-sm text-headline-sm text-on-surface font-semibold leading-snug">
              “Riya is leaving. The new developer needs to know what only she knew.”
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 leading-relaxed">
              Riya built the core campus event ticketing service. Before her last day, Backstop surfaces the components only she worked on, links every decision to real discussion threads, and drafts an onboarding plan so the next developer isn't stuck guessing.
            </p>
          </div>

          <div className="pt-space-xs mt-space-xs border-t border-surface-container/60 flex items-center justify-between text-on-surface-variant font-body-sm text-body-sm">
            <span className="font-medium text-on-surface">Campus Event App</span>
            <span>Riya &rarr; New Developer</span>
          </div>
        </div>
      </div>

      {/* Action status toast banner */}
      {actionStatus && (
        <div className="p-space-sm rounded-lg bg-surface-container text-on-surface font-label-md text-label-md flex items-center gap-2 shadow-xs border border-primary/20">
          <span className="material-symbols-outlined text-primary text-[18px]">info</span>
          <span>{actionStatus}</span>
        </div>
      )}

      {/* "How it works" Strip: 3 Short Steps in Plain Words */}
      <section className="w-full space-y-space-md">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">How it works</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Three simple steps to keep your team's knowledge safe and actionable.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
          {/* Step 1 */}
          <div className="bg-surface-container-lowest rounded-xl p-space-lg border border-surface-container shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-space-sm">
                <span className="w-8 h-8 rounded-lg bg-primary-fixed text-on-primary-fixed flex items-center justify-center font-bold text-sm">
                  1
                </span>
                <span className="material-symbols-outlined text-outline text-[22px]">inbox</span>
              </div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold mb-space-xs">
                1. We read the team's activity.
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                We gather commits, issues, pull requests, and documentation into a single searchable workspace so no vital context is forgotten.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-surface-container-lowest rounded-xl p-space-lg border border-surface-container shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-space-sm">
                <span className="w-8 h-8 rounded-lg bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center font-bold text-sm">
                  2
                </span>
                <span className="material-symbols-outlined text-secondary text-[22px]">fact_check</span>
              </div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold mb-space-xs">
                2. Every claim shows its source; a person approves.
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                Every finding quotes the exact line or message it came from. A teammate reviews and confirms each item before it enters the plan.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-surface-container-lowest rounded-xl p-space-lg border border-surface-container shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-space-sm">
                <span className="w-8 h-8 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center font-bold text-sm">
                  3
                </span>
                <span className="material-symbols-outlined text-tertiary text-[22px]">assignment_turned_in</span>
              </div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold mb-space-xs">
                3. The new person gets a plan, limited to what they may see.
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                Incoming developers or project managers receive tailored Day 1, Week 1, and Month 1 checklists with access strictly matched to their role.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Sample Handover Summary Card */}
      <section className="w-full bg-surface-container-lowest rounded-xl shadow-xs p-space-lg border border-surface-container">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-space-md mb-space-md border-b border-surface-container/60 gap-space-sm">
          <div className="flex items-center gap-space-md">
            <div className="w-11 h-11 rounded-xl bg-primary-fixed flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[24px]">folder_shared</span>
            </div>
            <div>
              <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">
                {project?.name || "Campus Event App"} Handover Workspace
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Departing engineer: <strong className="text-on-surface">{project?.leaver_name || "Riya"}</strong> &bull; Cutoff date: {project?.departure_date || "Nov 15, 2026"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-space-md">
            <span className="px-3 py-1 rounded-full bg-tertiary/10 text-tertiary font-label-sm text-label-sm font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-tertiary"></span>
              Demo Project Active
            </span>
          </div>
        </div>

        {/* High-level metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-md mb-space-lg">
          <div className="bg-surface-container-low rounded-xl p-space-md border border-surface-container/60">
            <span className="font-label-sm text-label-sm uppercase font-semibold text-on-surface-variant block mb-1">
              Team Sources
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display-lg text-display-lg text-on-surface font-bold">{sourcesCount}</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">files analyzed</span>
            </div>
          </div>

          <div className="bg-surface-container-low rounded-xl p-space-md border border-surface-container/60">
            <span className="font-label-sm text-label-sm uppercase font-semibold text-on-surface-variant block mb-1">
              Claims Found
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display-lg text-display-lg text-on-surface font-bold">{totalClaims}</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">facts captured</span>
            </div>
          </div>

          <div className="bg-surface-container-low rounded-xl p-space-md border border-surface-container/60">
            <span className="font-label-sm text-label-sm uppercase font-semibold text-on-surface-variant block mb-1">
              Approved
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display-lg text-display-lg text-secondary font-bold">{approvedCount}</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">by reviewer</span>
            </div>
          </div>

          <div className="bg-surface-container-low rounded-xl p-space-md border border-surface-container/60">
            <span className="font-label-sm text-label-sm uppercase font-semibold text-on-surface-variant block mb-1">
              Pending Review
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display-lg text-display-lg text-primary font-bold">{pendingCount}</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">to check</span>
            </div>
          </div>
        </div>

        {/* Team Activity Sources list */}
        <div>
          <h4 className="font-label-md text-label-md uppercase tracking-wider font-semibold text-on-surface-variant mb-space-sm">
            Ingested Team Activity Files ({sources.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-sm">
            {sources.map((src) => (
              <div
                key={src.id}
                className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container/60 flex items-center justify-between"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="material-symbols-outlined text-[18px] text-outline">description</span>
                  <span className="font-body-sm text-body-sm text-on-surface truncate font-medium">{src.name}</span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-surface-container text-on-surface-variant">
                  {src.access_level}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
