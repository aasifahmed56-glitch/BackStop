import React, { useEffect, useRef, useState } from "react";
import { api } from "../api";

const RANKINGS = [
  { id: "backstop", label: "Backstop risk score" },
  { id: "backstop_v2", label: "Score v2 (candidate)" },
  { id: "commit_count", label: "Leaver's commit count" },
  { id: "commit_share", label: "Leaver's commit share" },
];

const pct = (x) => `${Math.round((x ?? 0) * 100)}%`;
const n = (x) => (typeof x === "number" ? x.toLocaleString("en-GB") : x);

// Neutral categorical set, distinct in lightness and hue, each at least 3:1 on white.
const CHART_COLORS = {
  backstop: "var(--color-ink)",
  backstop_v2: "var(--color-stamp)",
  commit_count: "var(--color-goldenrod)",
  commit_share: "var(--color-outline)",
};

const stickyHead = "sticky left-0 bg-surface-container";

function splitFirstSpace(text) {
  const i = text.indexOf(" ");
  return i < 0 ? [text, ""] : [text.slice(0, i), text.slice(i + 1)];
}

function HitsChart({ groups, rankings, topN }) {
  const wrapRef = useRef(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => setW(Math.max(320, Math.floor(el.clientWidth)));
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 272, L = 44, R = 8, T = 16, B = 196;
  const y = (v) => B - ((B - T) * v) / topN;
  const gw = (W - L - R) / groups.length;
  const bw = Math.max(8, Math.min(28, (gw - 12) / rankings.length - 3));
  const gap = 3;
  const ticks = Array.from({ length: topN + 1 }, (_, i) => i);
  return (
    <figure className="flex flex-col gap-space-sm">
      <div ref={wrapRef} className="w-full">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block max-w-full" role="img"
          aria-label={`Troubled modules found in the top ${topN}, for each ranking at each cutoff. Dashed lines mark what a random order would find.`}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--color-outline-variant)" strokeWidth="1" />
              <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="12" fill="var(--color-on-surface-variant)">{v}</text>
            </g>
          ))}
          <text transform={`translate(12 ${(T + B) / 2}) rotate(-90)`} textAnchor="middle" fontSize="12" fill="var(--color-on-surface-variant)">
            Troubled modules found (of {topN})
          </text>
          {groups.map((g, i) => {
            const cx = L + gw * i + gw / 2;
            const start = cx - (rankings.length * (bw + gap) - gap) / 2;
            const [sub1, sub2] = splitFirstSpace(g.sub);
            return (
              <g key={g.label}>
                {g.positives === 0 ? (
                  <text textAnchor="middle" fontSize="11" fill="var(--color-on-surface-variant)">
                    <tspan x={cx} y={B - 40}>No troubled</tspan>
                    <tspan x={cx} y={B - 26}>modules</tspan>
                  </text>
                ) : (
                  <>
                    {rankings.map((rk, j) => {
                      const v = g.hits[rk.id];
                      const x = start + j * (bw + gap);
                      return (
                        <g key={rk.id}>
                          {v > 0 && <rect x={x} y={y(v)} width={bw} height={B - y(v)} rx="2" fill={CHART_COLORS[rk.id]} />}
                          <text x={x + bw / 2} y={y(v) - 5} textAnchor="middle" fontSize="11" fill="var(--color-on-surface)">{v}</text>
                        </g>
                      );
                    })}
                    {typeof g.chanceHits === "number" && (
                      <line x1={cx - gw / 2 + 4} x2={cx + gw / 2 - 4} y1={y(g.chanceHits)} y2={y(g.chanceHits)} stroke="var(--color-on-surface)" strokeWidth="1.25" strokeDasharray="4 3" />
                    )}
                  </>
                )}
                <text textAnchor="middle" fontSize="11" fill="var(--color-on-surface)">
                  <tspan x={cx} y={B + 18}>{g.label}</tspan>
                </text>
                <text textAnchor="middle" fontSize="11" fill="var(--color-on-surface-variant)">
                  <tspan x={cx} y={B + 33}>{sub1}</tspan>
                  {sub2 && <tspan x={cx} y={B + 46}>{sub2}</tspan>}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="flex flex-wrap gap-x-space-md gap-y-1 font-body-sm text-body-sm text-on-surface-variant">
        {rankings.map((rk) => (
          <span key={rk.id} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: CHART_COLORS[rk.id] }} />
            {rk.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <svg aria-hidden="true" width="18" height="4" className="shrink-0"><line x1="0" x2="18" y1="2" y2="2" stroke="var(--color-on-surface)" strokeWidth="1.5" strokeDasharray="4 3" /></svg>
          Random order (expected)
        </span>
      </figcaption>
    </figure>
  );
}

export default function RealBacktestView({ name, preloaded = null }) {
  const [data, setData] = useState(preloaded);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(!preloaded);

  const load = async () => {
    if (preloaded) return;
    setLoading(true);
    setError(null);
    try {
      setData(await api.getRealBacktest(name));
    } catch (err) {
      setError(err.message || "Could not load the saved result.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  if (loading) {
    return <p role="status" className="font-body-md text-body-md text-on-surface-variant py-space-lg">Loading the saved result…</p>;
  }
  if (error || !data) {
    return (
      <div role="alert" className="rounded-xl bg-error-container text-on-error-container p-space-md flex flex-wrap items-center gap-space-md">
        <span>The saved result for this project could not load: {error}</span>
        <button type="button" onClick={load} className="px-3 py-1.5 rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md cursor-pointer">
          Try again
        </button>
      </div>
    );
  }

  const { dataset: ds, result: r, controls, method, limitations } = data;
  const topN = Math.max(1, Math.min(5, r.modules_ranked));
  const fewModules = r.modules_ranked < 5;
  const cols = Array.from({ length: topN }, (_, i) => i + 1);
  const atN = (metrics, rk) => metrics[rk].find((m) => m.k === topN) || metrics[rk][metrics[rk].length - 1];
  const baselineBest = Math.max(atN(r.metrics, "commit_count").precision, atN(r.metrics, "commit_share").precision);
  const backstopWorse = r.positive_count > 0 && atN(r.metrics, "backstop").precision < baselineBest;
  const hitsN = (metrics) => Object.fromEntries(RANKINGS.map((rk) => [rk.id, atN(metrics, rk.id).hit_count]));
  const mkGroup = (label, sub, src) => ({
    label,
    sub,
    positives: src.positive_count,
    hits: hitsN(src.metrics),
    chanceHits: src.positive_count > 0 ? src.chance_precision * topN : null,
  });
  const groups = [
    mkGroup(r.cutoff, "real departure", r),
    ...controls.map((c) => mkGroup(c.cutoff, `${c.months_before} months earlier`, c)),
  ];
  const found = (rk) => atN(r.metrics, rk).hit_count;
  const prCell = (m, positives) => (positives === 0 ? "n/a" : pct(m.precision));
  const chanceHits = Math.round(r.chance_precision * topN);

  return (
    <div className="flex flex-col gap-space-lg">
      <section className="bg-surface-container-lowest rounded-xl p-space-lg border border-surface-container flex flex-col gap-space-md">
        <h2 className="font-headline-md text-headline-md text-on-surface font-semibold">
          {ds.name}: {preloaded ? "your import" : "a real public project"}
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md font-body-sm text-body-sm">
          <div>
            <dt className="text-on-surface-variant">Repository</dt>
            <dd><a className="text-primary underline underline-offset-2 break-all" href={ds.repository_url} target="_blank" rel="noreferrer">{ds.repository_url.replace("https://", "")}</a> ({ds.licence === "not checked" ? "licence not checked" : `${ds.licence} licence`})</dd>
          </div>
          <div>
            <dt className="text-on-surface-variant">Leaver and cutoff</dt>
            <dd className="text-on-surface">{ds.leaver}, last commit {ds.departure_date}</dd>
          </div>
          <div>
            <dt className="text-on-surface-variant">How we know they left</dt>
            <dd>{ds.departure_evidence ? <a className="text-primary underline underline-offset-2" href={ds.departure_evidence} target="_blank" rel="noreferrer">Public announcement</a> : preloaded ? `Your date; leaver = ${ds.leaver_chosen}` : "Commit record only"}</dd>
          </div>
          <div>
            <dt className="text-on-surface-variant">Data</dt>
            <dd className="text-on-surface tabular-nums">{n(ds.commit_count)} commits, {n(ds.contributor_count)} contributors (pseudonymised)</dd>
          </div>
        </dl>
        {ds.low_confidence && (
          <p role="note" className="rounded-[3px] border border-outline-variant bg-surface-container-low px-3 py-2 text-[13.5px] text-on-surface-variant max-w-[75ch]">
            Low confidence: only {n(ds.commits_before_date)} commit{ds.commits_before_date === 1 ? "" : "s"} before the date. The result still runs, but read it as a starting point and check it with the team.
          </p>
        )}
      </section>

      <section className="rounded-xl p-space-lg bg-surface-container-low border border-surface-container">
        <h2 className="font-headline-md text-headline-md text-on-surface font-semibold">What happened</h2>
        <p className="font-body-md text-body-md text-on-surface mt-2 max-w-[65ch]">
          {n(r.positive_count)} of the {n(r.modules_ranked)} modules the leaver worked on ran into trouble in the {method.window_days} days after the cutoff.
          {r.positive_count > 0 && (
            <>
              {" "}In the top {topN}, Backstop found {found("backstop")}, the candidate score v2 found {found("backstop_v2")}, the leaver&apos;s commit count found {found("commit_count")}
              {" "}and the commit share found {found("commit_share")}. A random order would find about {chanceHits}.
            </>
          )}
        </p>
        {fewModules && (
          <p className="font-body-md text-body-md text-on-surface mt-2 max-w-[65ch]">
            Only {n(r.modules_ranked)} {r.modules_ranked === 1 ? "module was" : "modules were"} ranked, so the top {topN} is every module and the rankings cannot be told apart. Read this result as a description, not a comparison.
          </p>
        )}
        {backstopWorse && (
          <p className="font-body-md text-body-md text-on-surface mt-2 max-w-[65ch]">
            <strong>Backstop did worse than the simple baseline here.</strong> Its score favours small modules with few other
            contributors. In a busy open-source project, trouble showed up in the large, active modules instead, which the commit
            count ranks first. The control dates below show the same pattern, so this ground truth mostly tracks how busy a module is.
          </p>
        )}
      </section>

      <section className="bg-surface-container-lowest rounded-xl p-space-lg border border-surface-container flex flex-col gap-space-md">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface font-semibold">Troubled modules found in the top {topN}</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1 max-w-[65ch]">
            The real departure and {controls.length === 1 ? "one earlier control date" : `${controls.length} earlier control dates`}. Score v2 weights the leaver&apos;s share by how many commits they made
            (share × √commits) instead of dividing by the number of other contributors. It was chosen after seeing this project&apos;s
            result, so these numbers are in-sample and v2 is not yet used for claims.
          </p>
        </div>
        <HitsChart groups={groups} rankings={RANKINGS} topN={topN} />
      </section>

      <section className="bg-surface-container-lowest rounded-xl border border-surface-container overflow-hidden">
        <h2 className="font-headline-md text-headline-md text-on-surface font-semibold p-space-lg pb-space-sm">Precision and recall at the real departure</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-body-sm text-body-sm tabular-nums">
            <caption className="sr-only">Precision and recall for k from 1 to {topN}, for each ranking</caption>
            <thead>
              <tr className="bg-surface-container text-on-surface-variant">
                <th scope="col" className={`py-2.5 px-4 ${stickyHead}`}>Ranking</th>
                {cols.map((k) => (
                  <th scope="col" key={k} className="py-2.5 px-4 text-center">Top {k}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container text-on-surface">
              {RANKINGS.map((rk) => (
                <tr key={rk.id}>
                  <th scope="row" className="py-3 px-4 font-semibold sticky left-0 bg-surface-container-lowest">{rk.label}</th>
                  {r.metrics[rk.id].filter((m) => m.k <= topN).map((m) => (
                    <td key={m.k} className="py-3 px-4 text-center">
                      {prCell(m, r.positive_count)} <span className="text-on-surface-variant">/ {r.positive_count === 0 ? "n/a" : pct(m.recall)}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant px-space-lg py-space-sm">Each cell: precision / recall. {r.positive_count > 0 ? `Random order averages ${pct(r.chance_precision)} precision.` : "No module had trouble, so precision and recall are not defined."}</p>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md">
        {RANKINGS.map((rk) => (
          <div key={rk.id} className="bg-surface-container-lowest rounded-xl p-space-md border border-surface-container">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">{rk.label}: top {topN}</h3>
            <ol className="mt-2 flex flex-col gap-1 font-body-sm text-body-sm">
              {r.rankings[rk.id].slice(0, topN).map((row, i) => (
                <li key={row.module} className="flex items-center justify-between gap-2">
                  <span><span className="text-on-surface-variant tabular-nums">{i + 1}.</span> <code className="font-code-sm text-code-sm">{row.module}</code></span>
                  <span className={row.is_positive ? "text-tertiary font-semibold" : "text-on-surface-variant"}>
                    {row.is_positive ? "Had trouble" : "No trouble"}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </section>

      <section className="bg-surface-container-lowest rounded-xl border border-surface-container overflow-hidden">
        <h2 className="font-headline-md text-headline-md text-on-surface font-semibold p-space-lg pb-space-sm">Control dates (the leaver had not left yet)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-body-sm text-body-sm tabular-nums">
            <thead>
              <tr className="bg-surface-container text-on-surface-variant">
                <th scope="col" className={`py-2.5 px-4 ${stickyHead}`}>Cutoff</th>
                <th scope="col" className="py-2.5 px-4 text-center">Modules with trouble</th>
                {RANKINGS.map((rk) => (
                  <th scope="col" key={rk.id} className="py-2.5 px-4 text-center">{rk.label}, top {topN} precision</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container text-on-surface">
              <tr className="bg-surface-container-low">
                <th scope="row" className="py-3 px-4 font-semibold sticky left-0 bg-surface-container-low">{r.cutoff} (real departure)</th>
                <td className="py-3 px-4 text-center">{n(r.positive_count)} of {n(r.modules_ranked)}</td>
                {RANKINGS.map((rk) => <td key={rk.id} className="py-3 px-4 text-center">{prCell(atN(r.metrics, rk.id), r.positive_count)}</td>)}
              </tr>
              {controls.map((c) => (
                <tr key={c.cutoff}>
                  <th scope="row" className="py-3 px-4 font-normal sticky left-0 bg-surface-container-lowest">{c.cutoff} ({c.months_before} months earlier)</th>
                  <td className="py-3 px-4 text-center">{n(c.positive_count)} of {n(c.modules_ranked)}</td>
                  {RANKINGS.map((rk) => (
                    <td key={rk.id} className="py-3 px-4 text-center">{prCell(atN(c.metrics, rk.id), c.positive_count)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl p-space-lg bg-surface-container-low border border-surface-container font-body-sm text-body-sm text-on-surface-variant">
        <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">How this was measured, and its limits</h2>
        <p className="mt-2 max-w-[65ch]">
          A module counts as having trouble when, within {method.window_days} days after the cutoff, at least {method.min_new_author_commits} commits came from people
          new to it and at least one commit mentions a fix or revert. The rankings only see commits up to the cutoff. These rules were fixed before the result was computed.
        </p>
        <ul className="mt-2 list-disc pl-5 flex flex-col gap-1">
          {limitations.map((l) => <li key={l}>{l}</li>)}
        </ul>
        <a className="inline-block mt-3 text-primary underline underline-offset-2" href={method.url} target="_blank" rel="noreferrer">Read the full method</a>
      </section>
    </div>
  );
}
