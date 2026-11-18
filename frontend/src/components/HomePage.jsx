import React, { useEffect, useState } from "react";
import { api } from "../api";
import { ArrowRight, FileText } from "lucide-react";
import { Button, Skeleton, StatusChip, STATUS, REVIEW, humanize } from "./ui.jsx";
import Readiness from "./Readiness";
import SpecimenStack from "./SpecimenStack";
import GithubImportPanel from "./GithubImportPanel";

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
    title: "Ask",
    body: "Whatever the records could not settle becomes a question for the person leaving. Their answers are checked like any claim.",
    link: "See the questions",
    tab: "debrief",
  },
  {
    n: 4,
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
  // Real claims for the specimen stack: a spread of kinds and statuses.
  const [specimens, setSpecimens] = useState([]);
  const [allClaims, setAllClaims] = useState([]);
  useEffect(() => {
    let live = true;
    api
      .getClaims({ projectId: 1, role: "lead" })
      .then((list) => {
        if (!live || !Array.isArray(list)) return;
        setAllClaims(list);
        const seen = list.filter((c) => !c.withheld);
        const pick = [];
        const add = (c) => c && !pick.some((p) => p.id === c.id) && pick.push(c);
        add(seen.find((c) => c.kind === "interpreted" && c.status === "verified" && c.type === "blocker" && c.evidence?.[0]?.quote));
        add(seen.find((c) => c.kind === "derived" && c.type === "risk"));
        add(seen.find((c) => c.kind === "interpreted" && c.status === "verified" && c.type === "decision" && c.evidence?.[0]?.quote));
        add(seen.find((c) => c.status === "conflicting"));
        add(seen.find((c) => c.kind === "interpreted" && c.status === "verified" && c.type === "owner" && c.evidence?.[0]?.quote));
        setSpecimens(pick);
        pick.forEach((c) =>
          api
            .getClaimContext(c.id)
            .then((ctx) => {
              const src = ctx?.contexts?.[0]?.source_name;
              if (live && src) setSpecimens((xs) => xs.map((x) => (x.id === c.id ? { ...x, sourceName: src } : x)));
            })
            .catch(() => {})
        );
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [stats]);

  const [readiness, setReadiness] = useState(null);
  const [openQuestions, setOpenQuestions] = useState(null);
  useEffect(() => {
    let live = true;
    api
      .getDebrief({ role: "lead" })
      .then((d) => {
        if (!live) return;
        setReadiness(d?.readiness || null);
        setOpenQuestions(Array.isArray(d?.questions) ? d.questions.filter((q) => !q.answered).length : null);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [stats]);

  const hasStats = !!stats;
  const total = num(stats?.total);
  const review = stats?.by_review || {};
  const byStatus = stats?.by_status || {};
  const sources = Array.isArray(project?.sources) ? project.sources : [];

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
    <div className="flex flex-col w-full gap-16 lg:gap-20 pb-8">
      {/* Opening: the claim, mounted like a specimen with its label */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-10 xl:gap-14 items-center pt-2 lg:pt-6">
        <div className="xl:col-span-6 flex flex-col gap-6 min-w-0">
          <h1 className="text-[36px] leading-[1.05] sm:text-[52px] font-bold tracking-[-0.03em] text-on-surface text-balance">
            When someone leaves, keep what they knew, with the proof attached.
          </h1>
          <p className="text-[17px] leading-7 text-on-surface-variant max-w-[54ch]">
            Backstop reads {project?.leaver_name || "a departing engineer"}'s commits, issues, notes, tasks and chat, and turns them into claims.
            Each claim carries the exact quote or the code behind it. A lead stamps it, the gaps become questions to ask before the last day,
            and the newcomer receives only what their role allows.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button id="btn-try-demo" variant="primary" size="lg" onClick={handleStart} disabled={isLoading}>
              {isLoading ? "Loading…" : "Check the claims"}
              {!isLoading && <ArrowRight size={18} aria-hidden="true" />}
            </Button>
            <Button variant="outline" size="lg" onClick={() => setActiveTab("debrief")}>
              See the debrief questions
            </Button>
          </div>
          <p className="text-[13px] text-on-surface-variant" role="status">
            {actionStatus?.text || actionStatus || "Runs on synthetic sample data. Automated checks assist; a person decides."}
          </p>
        </div>

        {/* Specimen stack: the focal moment */}
        <div className="xl:col-span-6 min-w-0 pt-6 xl:pt-0 pr-10 sm:pr-14">
          {specimens.length ? (
            <SpecimenStack claims={specimens} onOpen={(id) => setActiveTab("review", id)} />
          ) : (
            <div className="h-[400px] rounded-[12px] border border-outline-variant bg-surface-container-lowest p-8 flex flex-col gap-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-12 w-3/4" />
            </div>
          )}
        </div>
      </section>

      {/* The whole collection at a glance */}
      <section aria-labelledby="index-h" className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h2 id="index-h" className="text-[15px] font-semibold text-on-surface">Sheet index</h2>
            {hasStats && (
              <p className="text-[13px] text-on-surface-variant">
                <span className="font-mono tnum text-on-surface font-bold">{decided}</span> of <span className="font-mono tnum">{shown}</span> claims stamped by a person
              </p>
            )}
          </div>
          {hasStats && shown > 0 ? (
            <div className="grid gap-[3px]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(14px, 1fr))" }} aria-label={`${decided} of ${shown} claims checked by a person. Each mark opens its claim.`}>
              {(allClaims.length ? allClaims : ticks.map((cls, i) => ({ id: `t${i}`, cls }))).map((c, i) => {
                const cls = c.cls || REVIEW[c.review_state]?.tick || REVIEW.pending.tick;
                const flag = !c.cls && c.review_state === "pending" && ["conflicting", "missing", "inferred"].includes(c.status);
                const label = c.cls ? "" : c.withheld ? `Claim #${c.id}: withheld` : `Claim #${c.id}: ${REVIEW[c.review_state]?.label}. ${c.text}`;
                return c.cls ? (
                  <span key={c.id} className={`tick-in aspect-[3/4] rounded-[2px] ${cls}`} style={{ animationDelay: `${Math.min(i * 7, 700)}ms` }} />
                ) : (
                  <button
                    key={c.id}
                    type="button"
                    title={label}
                    aria-label={label}
                    onClick={() => setActiveTab("review", c.id)}
                    className={`tick tick-in relative aspect-[3/4] rounded-[2px] cursor-pointer ${cls}`}
                    style={{ animationDelay: `${Math.min(i * 7, 700)}ms` }}
                  >
                    {flag && <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1/3 rounded-t-[2px] ${STATUS[c.status].dot}`} />}
                  </button>
                );
              })}
            </div>
          ) : hasStats ? (
            <p className="text-[13px] text-on-surface-variant">No claims yet. Reload the sample to start.</p>
          ) : (
            <Skeleton className="h-16 w-full" />
          )}
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-on-surface-variant" aria-label="Legend">
            {order.map((k, i) => (
              <li key={k} className="flex items-center gap-1.5">
                <span aria-hidden="true" className={`w-2.5 h-3 rounded-[2px] ${REVIEW[k].tick}`} />
                {REVIEW[k].label} <span className="font-mono tnum text-on-surface">{counts[i]}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="lg:col-span-5">
          {readiness ? <Readiness readiness={readiness} compact /> : <Skeleton className="h-16 w-full" />}
          {readiness && (
            <button
              type="button"
              onClick={() => setActiveTab("debrief")}
              className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline cursor-pointer"
            >
              {openQuestions != null ? `${openQuestions} questions to ask ${project?.leaver_name || "them"} before they go` : "Open the debrief questions"}
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </section>

      {/* Try the risk ranking on a real public repository. */}
      <GithubImportPanel title="Try it on a real repository" />

      {/* Journey */}
      <section aria-labelledby="journey-h">
        <h2 id="journey-h" className="text-[24px] leading-8 font-bold tracking-[-0.015em] text-on-surface mb-5">
          How a handover works
        </h2>
        <ol className="flex flex-col max-w-[880px]">
          {STEPS.map((s) => (
            <li key={s.n} className="grid grid-cols-[2rem_7rem_1fr] sm:grid-cols-[2rem_9rem_1fr_auto] gap-x-4 gap-y-1 items-baseline py-3 border-t border-outline-variant last:border-b">
              <span className="font-mono tnum text-[13px] text-outline">{s.n}</span>
              <h3 className="text-[16px] font-semibold text-on-surface">{s.title}</h3>
              <p className="text-[14px] leading-6 text-on-surface-variant">{s.body}</p>
              <button
                type="button"
                onClick={() => setActiveTab(s.tab)}
                className="col-start-3 sm:col-start-auto justify-self-start inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline cursor-pointer whitespace-nowrap"
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
        <h2 id="trust-h" className="text-[24px] leading-8 font-bold tracking-[-0.015em] text-on-surface mb-4">
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
        <h2 id="sources-h" className="text-[24px] leading-8 font-bold tracking-[-0.015em] text-on-surface mb-4">
          Where the claims come from{project ? ` (${sources.length})` : ""}
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
                  className={`shrink-0 px-2 py-px rounded-full text-[11.5px] leading-4 font-medium ${
                    ACCESS_CHIP[src.access_level] || ACCESS_CHIP.team
                  }`}
                >
                  {humanize(src.access_level || "team")}
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
