import React, { useEffect, useRef, useState } from "react";
import { api, canReview } from "../api";
import { ArrowRight, Check, FileText } from "lucide-react";
import { Button, Skeleton, STATUS, REVIEW, humanize } from "./ui.jsx";
import Readiness from "./Readiness";
import SpecimenStack from "./SpecimenStack";
import GithubImportPanel from "./GithubImportPanel";

const ACCESS_CHIP = {
  restricted: "bg-error-container text-on-error-container",
  confidential: "bg-goldenrod-container text-on-goldenrod",
  team: "bg-surface-container text-on-surface-variant",
  public: "bg-tertiary-fixed text-on-tertiary-fixed",
};


const num = (v) => (Number.isFinite(v) ? v : 0);

const TILE = {
  verified: "bg-tertiary-fixed",
  inferred: "bg-goldenrod-container",
  conflicting: "bg-error-container",
  missing: "bg-surface-container-high",
};

/* Adds .is-in once the row is on screen, so its tiles settle in. Content is visible without JS. */
function useReveal() {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, inView];
}

function FeatureRow({ title, body, action, visual, flip = false }) {
  const [ref, inView] = useReveal();
  return (
    <section ref={ref} className={`reveal grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center ${inView ? "is-in" : ""}`}>
      <div className={`min-w-0 ${flip ? "lg:order-2" : ""}`}>{visual}</div>
      <div className={`flex flex-col gap-4 max-w-[460px] ${flip ? "lg:order-1" : ""}`}>
        <h2 className="text-[30px] sm:text-[38px] leading-[1.08] font-bold tracking-[-0.03em] text-on-surface text-balance">{title}</h2>
        <p className="text-[15.5px] leading-7 text-on-surface-variant max-w-[65ch]">{body}</p>
        {action && (
          <button type="button" onClick={action[1]} className="self-start inline-flex items-center gap-1 text-[14px] font-semibold text-primary hover:underline cursor-pointer">
            {action[0]} <ArrowRight size={15} aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
}

function whenLeaving(iso) {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  const days = Math.round((d - new Date(new Date().toDateString())) / 86400000);
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  if (days > 1) return `Their last day is ${date}, in ${days} days.`;
  if (days === 1) return `Their last day is tomorrow, ${date}.`;
  if (days === 0) return `Today, ${date}, is their last day.`;
  return `They left on ${date}.`;
}

/* A new project with nothing in it: the overview becomes the three steps that fill it. */
function FirstRun({ project, sourceCount, setActiveTab }) {
  const steps = [
    {
      title: "Add their records",
      body: "Paste or upload a git log, notes, issues, tasks or chat, or import a public GitHub history.",
      done: sourceCount > 0,
      state: sourceCount ? `${sourceCount} added` : null,
      action: ["Add records", () => setActiveTab("records")],
    },
    {
      title: "Build the claims",
      body: "Code ranks who owns what; keyword rules or the AI extractor read the rest. Every claim quotes its source.",
      done: false,
      action: sourceCount ? ["Build claims", () => setActiveTab("records")] : null,
    },
    {
      title: "Check, ask, hand over",
      body: "Stamp each claim, ask the debrief questions before the last day, and give the newcomer what their role may read.",
      done: false,
    },
  ];
  const next = steps.findIndex((s) => !s.done);
  return (
    <div className="flex flex-col gap-10 max-w-[880px] pt-2 lg:pt-6">
      <header className="flex flex-col gap-4">
        <h1 className="text-[36px] leading-[1.05] sm:text-[52px] font-bold tracking-[-0.03em] text-balance">
          Start {project?.leaver_name || "their"}'s handover.
        </h1>
        <p className="text-[17px] leading-7 text-on-surface-variant max-w-[56ch]">
          {whenLeaving(project?.departure_date)} {project?.name} has no claims yet. Three steps get it to a handover a newcomer can sign for.
        </p>
      </header>
      <ol className="flex flex-col">
        {steps.map((s, i) => {
          const current = i === next;
          return (
            <li key={s.title} className={`grid grid-cols-[40px_1fr] sm:grid-cols-[48px_1fr_auto] gap-x-4 gap-y-3 py-6 border-t border-outline-variant items-start ${current ? "" : "opacity-70"}`}>
              <span
                aria-hidden="true"
                className={`w-9 h-9 rounded-full inline-flex items-center justify-center font-mono tnum text-[14px] ${
                  s.done ? "bg-stamp text-white" : current ? "border-2 border-on-surface text-on-surface" : "border border-outline-variant text-on-surface-variant"
                }`}
              >
                {s.done ? <Check size={16} strokeWidth={2.5} /> : i + 1}
              </span>
              <div className="min-w-0">
                <h2 className="text-[20px] font-bold tracking-[-0.01em]">
                  {s.title}
                  {s.state && <span className="ml-2 text-[13px] font-medium text-stamp">{s.state}</span>}
                  <span className="sr-only">{s.done ? " (done)" : current ? " (next)" : ""}</span>
                </h2>
                <p className="text-[14.5px] leading-6 text-on-surface-variant mt-1 max-w-[58ch]">{s.body}</p>
              </div>
              {s.action && (
                <Button className="col-start-2 sm:col-start-3 justify-self-start" variant={current ? "primary" : "outline"} onClick={s.action[1]}>
                  {s.action[0]} <ArrowRight size={15} aria-hidden="true" />
                </Button>
              )}
            </li>
          );
        })}
      </ol>
      <p className="text-[13px] text-on-surface-variant max-w-[65ch] border-t border-outline-variant pt-5">
        Want to see a finished handover first?{" "}
        <a href="#/projects" className="font-semibold text-primary hover:underline underline-offset-2">Open the synthetic sample</a> from the project list.
      </p>
    </div>
  );
}

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
  const isSample = !project || project.name === "Campus Event App";
  const isReviewer = canReview();
  // Real claims for the specimen stack: a spread of kinds and statuses.
  const [specimens, setSpecimens] = useState([]);
  const [allClaims, setAllClaims] = useState([]);
  useEffect(() => {
    let live = true;
    api
      .getClaims({ role: "lead" })
      .then((list) => {
        if (!live || !Array.isArray(list)) return;
        setAllClaims(list);
        const seen = list.filter((c) => !c.withheld);
        const pick = [];
        const add = (c) => c && !pick.some((p) => p.id === c.id) && pick.push(c);
        add(seen.find((c) => ["interpreted", "rule"].includes(c.kind) && ["verified", "inferred"].includes(c.status) && c.type === "blocker" && c.evidence?.[0]?.quote));
        add(seen.find((c) => c.kind === "derived" && c.type === "risk"));
        add(seen.find((c) => ["interpreted", "rule"].includes(c.kind) && ["verified", "inferred"].includes(c.status) && c.type === "decision" && c.evidence?.[0]?.quote));
        add(seen.find((c) => c.status === "conflicting"));
        add(seen.find((c) => ["interpreted", "rule"].includes(c.kind) && ["verified", "inferred"].includes(c.status) && c.type === "owner" && c.evidence?.[0]?.quote));
        // Small projects: fill the stack with any claim that carries a quote.
        seen.filter((c) => c.evidence?.[0]?.quote).forEach((c) => pick.length < 5 && add(c));
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
  const [topQuestions, setTopQuestions] = useState([]);
  useEffect(() => {
    let live = true;
    api
      .getDebrief({ role: "lead" })
      .then((d) => {
        if (!live) return;
        setReadiness(d?.readiness || null);
        setOpenQuestions(Array.isArray(d?.questions) ? d.questions.filter((q) => !q.answered).length : null);
        setTopQuestions(Array.isArray(d?.questions) ? d.questions.filter((q) => !q.answered).slice(0, 3) : []);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [stats]);

  const hasStats = !!stats;
  const RANK = { public: 0, team: 1, restricted: 2, confidential: 3 };
  const countFor = (ceil) => {
    const visible = allClaims.filter((c) => (RANK[c.access_level] ?? 3) <= ceil).length;
    return { visible, locked: allClaims.length - visible };
  };
  const roleCounts = { team: countFor(1), restricted: countFor(2) };
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

  if (!isSample && hasStats && total === 0) {
    return <FirstRun project={project} sourceCount={sources.length} setActiveTab={setActiveTab} />;
  }

  return (
    <div className="flex flex-col w-full gap-24 lg:gap-32 pb-8 overflow-x-clip">
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
            {isReviewer ? (
              <>
                <Button id="btn-try-demo" variant="primary" size="lg" onClick={handleStart} disabled={isLoading}>
                  {isLoading ? "Loading…" : "Check the claims"}
                  {!isLoading && <ArrowRight size={18} aria-hidden="true" />}
                </Button>
                <Button variant="outline" size="lg" onClick={() => setActiveTab("debrief")}>
                  See the debrief questions
                </Button>
              </>
            ) : (
              <Button id="btn-try-demo" variant="primary" size="lg" onClick={() => setActiveTab("handover")}>
                Open my handover <ArrowRight size={18} aria-hidden="true" />
              </Button>
            )}
          </div>
          <p className="text-[13px] text-on-surface-variant max-w-[65ch]" role="status">
            {actionStatus?.text || actionStatus || (isSample ? "Runs on synthetic sample data. " : "") + "Automated checks assist; a person decides."}
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
              <p className="text-[13px] text-on-surface-variant max-w-[65ch]">
                <span className="font-mono tnum text-on-surface font-bold">{decided}</span> of <span className="font-mono tnum">{shown}</span> claims stamped by a person
              </p>
            )}
          </div>
          {hasStats && shown > 0 ? (
            <div role="group" className="grid gap-[3px]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(16px, 1fr))" }} aria-label={`${decided} of ${shown} claims checked by a person. Each mark opens its claim; the same claims are listed on Check the claims.`}>
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
                    tabIndex={-1}
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
            <p className="text-[13px] text-on-surface-variant max-w-[65ch]">No claims yet. Add records and build claims to start.</p>
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
          {readiness && isReviewer && (
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

      {/* Feature rows: one visual, one sentence, alternating sides */}
      <FeatureRow
        title="Every claim shows its proof."
        body="Automated checks compare each claim with its source word for word, and sort it into one of four states. The state tells the reviewer how much to read before stamping."
        action={isReviewer ? ["Check the claims", () => setActiveTab("review")] : null}
        visual={
          <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-[420px]">
            {["verified", "inferred", "conflicting", "missing"].map((k, i) => (
              <button
                key={k}
                type="button"
                onClick={() => setActiveTab("review")}
                title={STATUS[k].help}
                className={`tile group relative aspect-square rounded-[22px] p-4 sm:p-5 flex flex-col justify-end text-left cursor-pointer ${TILE[k]}`}
                style={{ "--d": `${i * 80}ms` }}
              >
                <span className="absolute top-3 right-3 sm:top-4 sm:right-4 min-w-8 h-8 px-2 rounded-full bg-on-surface text-surface-container-lowest font-mono tnum text-[14px] font-bold inline-flex items-center justify-center">
                  {hasStats ? num(byStatus[k]) : "·"}
                </span>
                <span className="text-[16px] sm:text-[17px] font-semibold text-on-surface">{STATUS[k].label}</span>
                <span className="text-[12.5px] leading-[17px] text-on-surface-variant line-clamp-2">{STATUS[k].help}</span>
              </button>
            ))}
          </div>
        }
      />

      <FeatureRow
        flip
        title="Gaps become questions, while there is still time."
        body={`What the records could not settle turns into a question for ${project?.leaver_name || "the person leaving"}. Type their answer in and it becomes a claim with its own quote, checked like any other.`}
        action={isReviewer ? ["See the debrief questions", () => setActiveTab("debrief")] : null}
        visual={
          <div className="relative h-[300px] max-w-[460px]">
            {(topQuestions.length ? topQuestions : [null, null, null]).map((q, i) => (
              <div
                key={q?.claim_id ?? i}
                className="tile absolute bg-surface-container-lowest rounded-[18px] px-5 py-4 w-[88%] border border-outline-variant"
                style={{ top: `${i * 84}px`, left: `${i * 6}%`, zIndex: 3 - i, "--d": `${i * 90}ms` }}
              >
                {q ? (
                  <>
                    <p className="text-[12px] text-on-surface-variant flex items-center gap-1.5">
                      <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${q.priority === "high" ? "bg-error" : q.priority === "medium" ? "bg-goldenrod" : "bg-outline"}`} />
                      {q.reason}
                    </p>
                    <p className="text-[14.5px] leading-5 font-semibold text-on-surface line-clamp-2 mt-1">{q.question}</p>
                  </>
                ) : (
                  <Skeleton className="h-10 w-full" />
                )}
              </div>
            ))}
          </div>
        }
      />

      <FeatureRow
        title="Each role sees only what it may."
        body="The newcomer's handover is built from approved claims, filtered by role on the server. What a role may not read is shown as a locked line that says it exists, never what it says."
        action={["Open the handover", () => setActiveTab("handover")]}
        visual={
          <div className="flex flex-col gap-3 max-w-[440px]">
            {[
              ["New developer", "Team level", roleCounts.team],
              ["Lead", "Restricted level", roleCounts.restricted],
            ].map(([who, lvl, c], i) => (
              <div key={who} className="tile rounded-[18px] bg-surface-container-lowest border border-outline-variant px-5 py-4 flex items-center gap-4" style={{ "--d": `${i * 90}ms` }}>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold">{who}</p>
                  <p className="text-[12.5px] text-on-surface-variant">{lvl}</p>
                </div>
                <p className="text-right">
                  <span className="font-mono tnum text-[22px] font-bold">{allClaims.length ? c.visible : "·"}</span>
                  <span className="block text-[12px] text-on-surface-variant">{allClaims.length ? `${c.locked} locked` : ""}</span>
                </p>
              </div>
            ))}
            <p className="text-[12.5px] text-on-surface-variant px-1">Claims each role can read, out of {allClaims.length || "all"} in this project.</p>
          </div>
        }
      />

      {/* Sources, as a quiet list of names */}
      <section aria-labelledby="sources-h" className="flex flex-col gap-4">
        <h2 id="sources-h" className="text-[28px] sm:text-[34px] leading-[1.1] font-bold tracking-[-0.025em]">
          Where the claims come from.
        </h2>
        <p className="text-[15px] leading-6 text-on-surface-variant max-w-[60ch]">
          {project ? `${sources.length} ${isSample ? "synthetic " : ""}record${sources.length === 1 ? "" : "s"}: commits, issues, notes, tasks and chat.` : "Loading the sources…"} Secrets and contact details are masked before anything is analysed.
        </p>
        {project && sources.length === 0 ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-[14px] text-on-surface-variant">No sources are loaded, so there is nothing to check yet.</p>
            {isSample ? (
              <Button variant="outline" onClick={onResetSample} disabled={isLoading}>Reload the sample</Button>
            ) : (
              <Button variant="primary" onClick={() => setActiveTab("records")}>Add records</Button>
            )}
          </div>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {(project ? sources : []).map((src) => (
              <li key={src.id ?? src.name} className="inline-flex items-center gap-2 h-9 pl-3 pr-2 rounded-full bg-surface-container-lowest border border-outline-variant">
                <FileText size={14} aria-hidden="true" className="text-outline" />
                <span className="font-mono text-[13px]">{src.name}</span>
                <span className={`px-2 py-px rounded-full text-[11.5px] leading-4 font-medium ${ACCESS_CHIP[src.access_level] || ACCESS_CHIP.team}`}>
                  {humanize(src.access_level || "team")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Try the risk ranking on a real public repository (the sample's showcase; projects import on Records). */}
      {isSample && <GithubImportPanel title="Try it on a real repository" />}

      {/* Behind the scenes */}
      {isSample && isReviewer && <section className="border-t border-outline-variant pt-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
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
      </section>}
    </div>
  );
}
