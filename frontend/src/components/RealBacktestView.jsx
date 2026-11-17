import React, { useEffect, useState } from "react";
import { api } from "../api";

const RANKINGS = [
  { id: "backstop", label: "Backstop risk score" },
  { id: "commit_count", label: "Leaver's commit count" },
  { id: "commit_share", label: "Leaver's commit share" },
];

const pct = (x) => `${Math.round((x ?? 0) * 100)}%`;

export default function RealBacktestView({ name }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
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
    return <p className="font-body-md text-body-md text-on-surface-variant py-space-lg">Loading the saved result…</p>;
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
  const at = (rk, k) => r.metrics[rk].find((m) => m.k === k);
  const best = RANKINGS.reduce((a, b) => (at(b.id, 5).precision > at(a.id, 5).precision ? b : a));

  return (
    <div className="flex flex-col gap-space-lg">
      <section className="bg-surface-container-lowest rounded-xl p-space-lg border border-surface-container flex flex-col gap-space-md">
        <h2 className="font-headline-md text-headline-md text-on-surface font-semibold">
          {ds.name}: a real public project
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md font-body-sm text-body-sm">
          <div>
            <dt className="text-on-surface-variant">Repository</dt>
            <dd><a className="text-primary underline underline-offset-2 break-all" href={ds.repository_url} target="_blank" rel="noreferrer">{ds.repository_url.replace("https://", "")}</a> ({ds.licence} licence)</dd>
          </div>
          <div>
            <dt className="text-on-surface-variant">Leaver and cutoff</dt>
            <dd className="text-on-surface">{ds.leaver}, last commit {ds.departure_date}</dd>
          </div>
          <div>
            <dt className="text-on-surface-variant">How we know they left</dt>
            <dd>{ds.departure_evidence ? <a className="text-primary underline underline-offset-2" href={ds.departure_evidence} target="_blank" rel="noreferrer">Public announcement</a> : "Commit record only"}</dd>
          </div>
          <div>
            <dt className="text-on-surface-variant">Data</dt>
            <dd className="text-on-surface tabular-nums">{ds.commit_count.toLocaleString()} commits, {ds.contributor_count} contributors (pseudonymised)</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl p-space-lg bg-surface-container-low border border-surface-container">
        <h2 className="font-headline-md text-headline-md text-on-surface font-semibold">What happened</h2>
        <p className="font-body-md text-body-md text-on-surface mt-2 max-w-3xl">
          {r.positive_count} of the {r.modules_ranked} modules the leaver worked on ran into trouble in the {method.window_days} days after the cutoff.
          {" "}In the top 5, Backstop found {at("backstop", 5).hit_count}, the leaver&apos;s commit count found {at("commit_count", 5).hit_count}
          {" "}and the commit share found {at("commit_share", 5).hit_count}. A random order would find about {Math.round(r.chance_precision * 5)}.
        </p>
        {best.id !== "backstop" && (
          <p className="font-body-md text-body-md text-on-surface mt-2 max-w-3xl">
            <strong>Backstop did worse than the simple baseline here.</strong> Its score favours small modules with few other
            contributors. In a busy open-source project, trouble showed up in the large, active modules instead, which the commit
            count ranks first. The control dates below show the same pattern, so this ground truth mostly tracks how busy a module is.
          </p>
        )}
      </section>

      <section className="bg-surface-container-lowest rounded-xl border border-surface-container overflow-hidden">
        <h2 className="font-headline-md text-headline-md text-on-surface font-semibold p-space-lg pb-space-sm">Precision and recall at the real departure</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-body-sm text-body-sm tabular-nums">
            <caption className="sr-only">Precision and recall for k from 1 to 5, for each ranking</caption>
            <thead>
              <tr className="bg-surface-container text-on-surface-variant">
                <th scope="col" className="py-2.5 px-4">Ranking</th>
                {[1, 2, 3, 4, 5].map((k) => (
                  <th scope="col" key={k} className="py-2.5 px-4 text-center">Top {k}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container text-on-surface">
              {RANKINGS.map((rk) => (
                <tr key={rk.id}>
                  <th scope="row" className="py-3 px-4 font-semibold">{rk.label}</th>
                  {r.metrics[rk.id].map((m) => (
                    <td key={m.k} className="py-3 px-4 text-center">
                      {pct(m.precision)} <span className="text-on-surface-variant">/ {pct(m.recall)}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant px-space-lg py-space-sm">Each cell: precision / recall. Random order averages {pct(r.chance_precision)} precision.</p>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-space-md">
        {RANKINGS.map((rk) => (
          <div key={rk.id} className="bg-surface-container-lowest rounded-xl p-space-md border border-surface-container">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">{rk.label}: top 5</h3>
            <ol className="mt-2 flex flex-col gap-1 font-body-sm text-body-sm">
              {r.rankings[rk.id].slice(0, 5).map((row, i) => (
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
                <th scope="col" className="py-2.5 px-4">Cutoff</th>
                <th scope="col" className="py-2.5 px-4 text-center">Modules with trouble</th>
                {RANKINGS.map((rk) => (
                  <th scope="col" key={rk.id} className="py-2.5 px-4 text-center">{rk.label}, top 5 precision</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container text-on-surface">
              <tr className="bg-surface-container-low">
                <th scope="row" className="py-3 px-4 font-semibold">{r.cutoff} (real departure)</th>
                <td className="py-3 px-4 text-center">{r.positive_count} of {r.modules_ranked}</td>
                {RANKINGS.map((rk) => <td key={rk.id} className="py-3 px-4 text-center">{pct(at(rk.id, 5).precision)}</td>)}
              </tr>
              {controls.map((c) => (
                <tr key={c.cutoff}>
                  <th scope="row" className="py-3 px-4 font-normal">{c.cutoff} ({c.months_before} months earlier)</th>
                  <td className="py-3 px-4 text-center">{c.positive_count} of {c.modules_ranked}</td>
                  {RANKINGS.map((rk) => (
                    <td key={rk.id} className="py-3 px-4 text-center">{pct(c.metrics[rk.id].find((m) => m.k === 5).precision)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl p-space-lg bg-surface-container-low border border-surface-container font-body-sm text-body-sm text-on-surface-variant">
        <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">How this was measured, and its limits</h2>
        <p className="mt-2 max-w-3xl">
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
