import React, { useEffect, useState } from "react";
import { api } from "../api";
import { ArrowRight, FileText } from "lucide-react";
import { Button, Field, Skeleton, StatusChip, STATUS, REVIEW } from "./ui.jsx";

const ACCESS_CHIP = {
  restricted: "bg-error-container text-on-error-container",
  confidential: "bg-goldenrod-container text-on-goldenrod",
  team: "bg-surface-container text-on-surface-variant",
  public: "bg-tertiary-fixed text-on-tertiary-fixed",
};

const STEPS = [
  {
    n: 1,
    title: "Inspect",
    body: "Every claim is checked against its exact source quote, or the code that computed it.",
    link: "Check the claims",
    tab: "review",
  },
  {
    n: 2,
    title: "Sign off",
    body: "A person approves, corrects or rejects each claim before it can reach anyone else.",
    link: "Open the queue",
    tab: "review",
  },
  {
    n: 3,
    title: "Receive",
    body: "The newcomer gets a plan limited to their role, and signs for receipt.",
    link: "See the handover",
    tab: "handover",
  },
];

const num = (v) => (Number.isFinite(v) ? v : 0);

export default function HomePage({
  project,
  stats,
  onResetSample,
  onStartDemo,
  onDerive,
  onExtract,
  setActiveTab,
  isLoading,
  actionStatus,
}) {
  // A real manifest line for the specimen: the first AI-extracted claim whose quote matched.
  const [example, setExample] = useState(null);
  useEffect(() => {
    let live = true;
    api
      .getClaims({ projectId: 1, role: "lead" })
      .then((list) => {
        if (!live || !Array.isArray(list)) return;
        const hit = list.find((c) => !c.withheld && c.kind === "interpreted" && c.status === "verified" && c.evidence?.[0]?.quote)
          || list.find((c) => !c.withheld && c.evidence?.[0]?.quote);
        setExample(hit || null);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const hasStats = !!stats;
  const total = num(stats?.total);
  const review = stats?.by_review || {};
  const byStatus = stats?.by_status || {};
  const sources = Array.isArray(project?.sources) ? project.sources : [];
  const sourceCount = project?.source_count ?? (project ? sources.length : null);

  const order = ["approved", "corrected", "rejected", "pending"];
  const counts = order.map((k) => num(review[k]));
  const decided = counts[0] + counts[1] + counts[2];
  const shown = Math.max(total, counts.reduce((a, b) => a + b, 0));
  const ticks = [];
  order.forEach((k, i) => {
    for (let j = 0; j < counts[i]; j++) ticks.push(REVIEW[k].tick);
  });
  while (ticks.length < shown) ticks.push(REVIEW.pending.tick);

  const handleStart = async () => {
    if (isLoading) return;
    try {
      if (onStartDemo) await onStartDemo();
      else setActiveTab("review");
    } catch (err) {
      console.error("Failed to start the demo", err);
      setActiveTab("review");
    }
  };

  return (
    <div className="flex flex-col w-full gap-14 lg:gap-16 pb-8">
      {/* Opening */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center pt-2 lg:pt-6">
        <div className="lg:col-span-7 flex flex-col gap-5 min-w-0">
          <h1 className="text-[34px] leading-[1.1] sm:text-[44px] font-bold tracking-tight text-on-surface text-balance">
            When someone leaves, their knowledge ships with a receipt.
          </h1>
          <p className="text-[16px] leading-7 text-on-surface-variant max-w-[56ch]">
            Backstop turns {project?.leaver_name || "a departing engineer"}'s project activity into a list of
            claims. Each claim shows the exact quote or the code behind it, a lead approves it, and the
            newcomer receives only what their role allows.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button id="btn-try-demo" variant="primary" size="lg" onClick={handleStart} disabled={isLoading}>
              {isLoading ? "Loading…" : "Check the claims"}
              {!isLoading && <ArrowRight size={18} aria-hidden="true" />}
            </Button>
            <Button variant="outline" size="lg" onClick={() => setActiveTab("handover")}>
              See the handover
            </Button>
          </div>
          <p className="text-[12px] text-on-surface-variant" role="status">
            {actionStatus || "Runs on synthetic sample data. Automated checks assist; a person decides."}
          </p>
        </div>

        {/* Specimen consignment note */}
        <div className="lg:col-span-5 min-w-0">
          <div className="panel p-3 sm:p-4 flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[15px] font-bold text-on-surface truncate">Handover consignment note</h2>
              <span className="field-label shrink-0">Specimen</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Consignor">
                {project ? (
                  <p className="text-[14px] font-semibold text-on-surface truncate">{project.leaver_name || "—"}</p>
                ) : (
                  <Skeleton className="h-5 w-20" />
                )}
              </Field>
              <Field label="Consignee">
                <p className="text-[14px] font-semibold text-on-surface truncate">New developer</p>
              </Field>
            </div>
            <Field label="Contents">
              {hasStats && project ? (
                <p className="text-[14px] font-semibold text-on-surface tnum">
                  {total} claims from {sourceCount ?? "—"} sources
                </p>
              ) : (
                <Skeleton className="h-5 w-48" />
              )}
            </Field>
            <Field label="Manifest tally">
              {hasStats && shown > 0 ? (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-px h-7" role="img" aria-label={`${decided} of ${shown} lines checked`}>
                    {ticks.map((cls, i) => (
                      <span key={i} className={`flex-1 min-w-0 rounded-[1px] ${cls}`} />
                    ))}
                  </div>
                  <p className="text-[13px] text-on-surface-variant">
                    <span className="font-bold text-on-surface tnum">{decided}</span> of{" "}
                    <span className="tnum">{shown}</span> lines checked
                  </p>
                </div>
              ) : hasStats ? (
                <p className="text-[13px] text-on-surface-variant">No lines on the manifest yet.</p>
              ) : (
                <Skeleton className="h-10 w-full" />
              )}
            </Field>
            <Field
              label="Example line"
              aside={
                example ? (
                  <a
                    href={`#/review/${example.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveTab("review", example.id);
                    }}
                    className="font-mono text-[12px] font-semibold text-primary hover:underline"
                  >
                    Line #{example.id}
                  </a>
                ) : null
              }
            >
              {example ? (
                <div className="flex flex-col items-start gap-2">
                  <StatusChip status={example.status} size="sm" />
                  <p className="text-[14px] leading-5 font-semibold text-on-surface line-clamp-2">{example.text}</p>
                  <p className="font-mono text-[12px] leading-5 text-on-surface bg-surface-container-low self-stretch px-2 py-1.5 rounded-[2px] break-words">
                    <mark className="bg-canary text-on-canary rounded-[1px] px-px">{example.evidence[0].quote}</mark>
                  </p>
                </div>
              ) : (
                <Skeleton className="h-16 w-full" />
              )}
            </Field>
          </div>
        </div>
      </section>

      {/* GitHub import box (owned by the backtest branch) mounts here */}

      {/* Journey */}
      <section aria-labelledby="journey-h">
        <h2 id="journey-h" className="text-[22px] leading-7 font-bold text-on-surface mb-4">
          How the consignment works
        </h2>
        <ol className="grid grid-cols-1 md:grid-cols-3 border-y border-outline-variant md:divide-x divide-y md:divide-y-0 divide-outline-variant">
          {STEPS.map((s, i) => (
            <li key={s.n} className="relative flex flex-col gap-2 py-5 md:px-5 md:first:pl-0 md:last:pr-0">
              <div className="flex items-center gap-3">
                <span className="tnum text-[13px] font-bold text-on-primary bg-ink px-1.5 py-0.5 rounded-[2px]">
                  {s.n}
                </span>
                <h3 className="text-[17px] font-bold text-on-surface">{s.title}</h3>
                {i < STEPS.length - 1 && (
                  <ArrowRight size={16} aria-hidden="true" className="hidden md:block ml-auto text-outline" />
                )}
              </div>
              <p className="text-[14px] leading-6 text-on-surface-variant max-w-[40ch]">{s.body}</p>
              <button
                type="button"
                onClick={() => setActiveTab(s.tab)}
                className="self-start inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline cursor-pointer"
              >
                {s.link}
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      </section>

      {/* Legend */}
      <section aria-labelledby="trust-h">
        <h2 id="trust-h" className="text-[22px] leading-7 font-bold text-on-surface mb-4">
          What makes a claim trustworthy
        </h2>
        <p className="text-[14px] leading-6 text-on-surface-variant max-w-[64ch] mb-4">
          Automated checks compare each claim with its source and give it one of four statuses. The status
          tells the reviewer how much to read before approving.
        </p>
        <div className="panel overflow-hidden">
          <div className="hidden sm:grid grid-cols-[180px_1fr_72px] gap-4 px-4 py-2 bg-surface-container-low border-b border-outline-variant">
            <span className="field-label">Status</span>
            <span className="field-label">What it means</span>
            <span className="field-label text-right">Claims</span>
          </div>
          <ul className="divide-y divide-outline-variant">
            {["verified", "inferred", "conflicting", "missing"].map((k) => (
              <li
                key={k}
                className="grid grid-cols-[1fr_auto] sm:grid-cols-[180px_1fr_72px] gap-x-4 gap-y-1.5 px-4 py-3 items-start"
              >
                <div className="sm:self-center">
                  <StatusChip status={k} />
                </div>
                <p className="text-[14px] leading-6 text-on-surface-variant order-3 sm:order-none col-span-2 sm:col-span-1">
                  {STATUS[k].help}
                </p>
                <p className="tnum text-[15px] font-bold text-on-surface text-right sm:self-center">
                  {hasStats ? num(byStatus[k]) : "—"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Sources */}
      <section aria-labelledby="sources-h">
        <h2 id="sources-h" className="text-[22px] leading-7 font-bold text-on-surface mb-4">
          Sources on the manifest{project ? ` (${sources.length})` : ""}
        </h2>
        {!project ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : sources.length === 0 ? (
          <div className="panel p-5 flex flex-col items-start gap-3">
            <p className="text-[14px] text-on-surface-variant">
              No sources are loaded, so there is nothing to check yet.
            </p>
            <Button variant="outline" onClick={onResetSample} disabled={isLoading}>
              Reload the sample
            </Button>
          </div>
        ) : (
          <ul className="panel divide-y divide-outline-variant">
            {sources.map((src) => (
              <li key={src.id ?? src.name} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="flex items-center gap-2 min-w-0">
                  <FileText size={15} aria-hidden="true" className="text-outline shrink-0" />
                  <span className="font-mono text-[13px] text-on-surface truncate" title={src.name}>
                    {src.name || "—"}
                  </span>
                </span>
                <span
                  className={`shrink-0 px-1.5 py-px rounded-[2px] text-[11px] leading-4 font-semibold uppercase ${
                    ACCESS_CHIP[src.access_level] || ACCESS_CHIP.team
                  }`}
                >
                  {src.access_level || "team"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Behind the scenes */}
      <section className="border-t border-outline-variant pt-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <p className="text-[13px] text-on-surface-variant max-w-[60ch]">
          Behind the scenes: re-run extraction to rebuild the claims from the sources, or the derivations to
          recompute the figures from code.
        </p>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={onDerive} disabled={isLoading || !onDerive}>
            Re-run derivations
          </Button>
          <Button variant="outline" size="sm" onClick={onExtract} disabled={isLoading || !onExtract}>
            Re-run extraction
          </Button>
        </div>
      </section>
    </div>
  );
}
