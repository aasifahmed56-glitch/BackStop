import React, { useEffect, useRef, useState } from "react";

/* Count from the last shown value to the new one; instant with reduced motion. */
function useCountUp(target, ms = 900) {
  const [v, setV] = useState(0);
  const last = useRef(0);
  useEffect(() => {
    let reduce = false;
    try {
      reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      /* no matchMedia */
    }
    let raf;
    const start = performance.now();
    const from = reduce ? target : last.current;
    const tick = (t) => {
      const k = reduce ? 1 : Math.min(1, (t - start) / ms);
      const e = 1 - Math.pow(1 - k, 4);
      const val = Math.round(from + (target - from) * e);
      last.current = val;
      setV(val);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

const VERDICT = {
  ready: { label: "Ready to hand over", tone: "text-stamp" },
  in_progress: { label: "In progress", tone: "text-on-surface" },
  not_ready: { label: "Not ready yet", tone: "text-error" },
  empty: { label: "Nothing to check yet", tone: "text-on-surface-variant" },
};

/* Handover readiness: one weighted bar, each segment is a checklist part whose
   width is its weight and whose violet fill is how much of it a person has done. */
export default function Readiness({ readiness, compact = false }) {
  if (!readiness) return null;
  return <ReadinessView readiness={readiness} compact={compact} />;
}

function ReadinessView({ readiness, compact }) {
  const { score, verdict, parts = [] } = readiness;
  const v = VERDICT[verdict] || VERDICT.in_progress;
  // With nothing to check, every part is vacuously complete; show no score rather than a misleading one.
  const isEmpty = verdict === "empty";
  const shownScore = useCountUp(score ?? 0);
  // Bars start empty and grow to their value once, so the reading is seen being taken.
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(r);
  }, []);
  return (
    <section aria-labelledby="readiness-h" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <h2 id="readiness-h" className="text-[15px] font-semibold text-on-surface">
          Handover readiness
        </h2>
        <p className="text-[14px]">
          {isEmpty ? (
            <span className="font-mono text-[22px] font-bold text-outline">–</span>
          ) : (
            <>
              <span className="font-mono tnum text-[22px] font-bold text-on-surface" aria-hidden="true">{shownScore}</span>
              <span className="sr-only">{score}</span>
              <span className="text-on-surface-variant"> / 100</span>
            </>
          )}
          <span className="text-on-surface-variant"> · </span>
          <span className={`font-semibold ${v.tone}`}>{v.label}</span>
        </p>
      </div>
      <div
        className="flex h-3 gap-[3px]"
        role="img"
        aria-label={isEmpty ? "Readiness: nothing to check yet." : `Readiness ${score} out of 100. ${parts.map((p) => `${p.label}: ${p.done} of ${p.total}`).join(". ")}.`}
      >
        {parts.map((p) => (
          <span key={p.key} className="relative h-full rounded-[2px] bg-surface-container-high overflow-hidden" style={{ flexGrow: p.weight, flexBasis: 0 }}>
            <span
              className="absolute inset-y-0 left-0 bg-stamp transition-[width] duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{ width: grown && !isEmpty ? `${Math.round((p.fraction ?? 0) * 100)}%` : "0%" }}
            />
          </span>
        ))}
      </div>
      {!compact && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-[13px]">
          {parts.map((p) => (
            <li key={p.key} className="flex items-baseline justify-between gap-3 border-b border-outline-variant/70 py-1.5">
              <span className="text-on-surface-variant">
                {p.label} <span className="text-outline">· counts {p.weight}×</span>
              </span>
              <span className="font-mono tnum text-on-surface">
                {p.done}/{p.total}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!compact && (
        <p className="text-[12.5px] text-on-surface-variant max-w-[70ch]">
          A checklist score from plain counts, not a prediction. Each part counts what a person has decided; the newcomer's signature is the last part.
        </p>
      )}
    </section>
  );
}
