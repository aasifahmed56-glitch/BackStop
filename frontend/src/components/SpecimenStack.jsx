import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { StatusChip, humanize } from "./ui";

const reduceMotion = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

/* The Overview's focal moment: real claims mounted as a fanned stack of specimen
   sheets. The front sheet is inspected, a violet determination slip is stamped on
   it, then it is filed to the back and the next sheet comes forward. It pauses on
   hover, focus, when offscreen or hidden, and never auto-plays with reduced motion.
   Nothing here approves anything: it only shows what a person does on the queue. */
export default function SpecimenStack({ claims, onOpen }) {
  const [front, setFront] = useState(0);
  const [stamped, setStamped] = useState(false);
  const [paused, setPaused] = useState(reduceMotion);
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(true);
  const ref = useRef(null);
  const n = claims.length;

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const running = !paused && !hovered && visible && n > 1;

  // Two beats per sheet: stamp it, then file it to the back.
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(
      () => {
        if (!stamped) setStamped(true);
        else {
          setStamped(false);
          setFront((f) => (f + 1) % n);
        }
      },
      stamped ? 1500 : 2600
    );
    return () => clearTimeout(t);
  }, [running, stamped, n]);

  const go = (d) => {
    setStamped(false);
    setFront((f) => (f + d + n) % n);
  };

  if (!n) return null;
  const order = Array.from({ length: n }, (_, i) => (front + i) % n);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <div
        className="relative h-[420px] sm:h-[400px]"
        role="region"
        aria-roledescription="carousel"
        aria-label="Claims from the sample, one at a time"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(1);
          if (e.key === "ArrowLeft") go(-1);
        }}
      >
        {order
          .map((idx, depth) => ({ c: claims[idx], depth, idx }))
          .reverse()
          .map(({ c, depth, idx }) => {
            const isFront = depth === 0;
            const d = Math.min(depth, 3);
            const style = {
              transform: `translate(${d * 18}px, ${d * -14}px) rotate(${d * 2.2}deg) scale(${1 - d * 0.035})`,
              zIndex: 10 - depth,
              opacity: depth > 2 ? 0 : 1,
              filter: d ? `saturate(${1 - d * 0.25})` : "none",
            };
            return (
              <article
                key={c.id}
                aria-hidden={!isFront}
                style={style}
                className={`specimen absolute inset-0 bg-surface-container-lowest rounded-[12px] border border-outline-variant px-6 sm:px-9 pt-8 pb-6 flex flex-col ${
                  isFront ? "" : "cursor-pointer hover:border-outline"
                }`}
                onClick={() => !isFront && go(depth)}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusChip status={c.status} size="sm" />
                  <span className="text-[12.5px] text-on-surface-variant">
                    {c.kind === "derived" ? "Calculated by code" : c.kind === "debrief" ? "Told in the debrief" : "Extracted, then quote-checked"}
                  </span>
                </div>
                <p className="mt-5 text-[21px] sm:text-[25px] leading-[1.25] font-semibold tracking-[-0.015em] text-on-surface text-balance line-clamp-4">{c.text}</p>
                {c.evidence?.[0]?.quote && (
                  <p className="mt-4 font-mono text-[13.5px] leading-6 text-on-surface-variant line-clamp-3">
                    <span aria-hidden="true">“</span>
                    <mark className={`quote-mark text-on-surface px-0.5 rounded-[2px] ${isFront ? "is-on" : ""}`}>{c.evidence[0].quote}</mark>
                    <span aria-hidden="true">”</span>
                  </p>
                )}
                <div className="mt-auto pt-6 flex items-end justify-between gap-4 flex-wrap">
                  {isFront ? (
                    <button
                      type="button"
                      onClick={() => onOpen(c.id)}
                      className="text-[13px] font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      Inspect claim #{c.id} <ArrowRight size={14} aria-hidden="true" />
                    </button>
                  ) : (
                    <span />
                  )}
                  <dl className="font-mono text-[12px] leading-[18px] text-on-surface border border-on-surface/70 rounded-[3px] px-3 py-2 grid grid-cols-[auto_1fr] gap-x-3 min-w-[210px]">
                    <dt className="text-on-surface-variant">Source</dt>
                    <dd className="truncate max-w-[14rem]">{c.sourceName || humanize(c.type)}</dd>
                    <dt className="text-on-surface-variant">Claim</dt>
                    <dd>
                      #{c.id} · v{c.current_version || 1}
                    </dd>
                    <dt className="text-on-surface-variant">Access</dt>
                    <dd>{humanize(c.access_level)}</dd>
                  </dl>
                </div>
                {isFront && stamped && (
                  <div className="slip slip-drop absolute -top-5 right-5 px-3 py-2 text-[12.5px] leading-[18px]" aria-hidden="true">
                    <p className="font-mono">
                      <span className="font-bold">det.</span> Lead · checked
                    </p>
                    <p className="font-semibold text-[13px]">Quote holds</p>
                  </div>
                )}
                {idx === front && <span className="sr-only">Sheet {front + 1} of {n}</span>}
              </article>
            );
          })}
      </div>

      <div className="mt-5 flex items-center gap-3 no-print">
        <button type="button" onClick={() => go(-1)} aria-label="Previous claim" className="w-8 h-8 inline-flex items-center justify-center rounded-full border border-outline-variant hover:border-outline bg-surface-container-lowest cursor-pointer">
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {claims.map((c, i) => (
            <span key={c.id} className={`h-1.5 rounded-full transition-all duration-300 ${i === front ? "w-6 bg-stamp" : "w-1.5 bg-outline-variant"}`} />
          ))}
        </div>
        <button type="button" onClick={() => go(1)} aria-label="Next claim" className="w-8 h-8 inline-flex items-center justify-center rounded-full border border-outline-variant hover:border-outline bg-surface-container-lowest cursor-pointer">
          <ChevronRight size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
          className="ml-1 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-on-surface-variant hover:text-on-surface cursor-pointer"
        >
          {paused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}
          {paused ? "Play" : "Pause"}
        </button>
        <span className="ml-auto text-[12.5px] text-on-surface-variant hidden sm:inline">Real claims from the sample. Click a sheet behind to bring it forward.</span>
      </div>
    </div>
  );
}
