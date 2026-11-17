import React, { useEffect, useState } from "react";
import { api, formatErrorMessage } from "../api";

// Reads only the saved results served by /api/trust/report. Nothing here runs a live check.

const CATEGORY_LABELS = {
  correct: "Correct",
  unrelated: "Unrelated",
  opposite: "Opposite meaning",
  overstated: "Overstated",
  invented_detail: "Invented detail",
  partly: "Partly supported",
};
const VERDICTS = ["yes", "partly", "no", "unchecked"];

const pct = (x) => (x === null || x === undefined ? "n/a" : `${Math.round(x * 100)}%`);

const card = "bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-container flex flex-col gap-space-md";
const h2 = "font-headline-md text-headline-md text-on-surface font-semibold";
const h3 = "font-label-lg text-label-lg text-on-surface font-semibold";
const body = "font-body-md text-body-md text-on-surface-variant";
const th = "py-2 px-3 font-bold text-left";
const td = "py-2 px-3 align-top";

function Stat({ label, value, note }) {
  return (
    <div className="rounded-lg border border-surface-container bg-surface-container-low p-space-md">
      <p className="font-label-md text-label-md text-on-surface-variant">{label}</p>
      <p className="font-headline-md text-headline-md text-on-surface font-bold">{value}</p>
      {note && <p className="font-body-sm text-body-sm text-on-surface-variant">{note}</p>}
    </div>
  );
}

function Table({ caption, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left font-body-sm text-body-sm">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

function EvalSummary({ title, ev }) {
  if (!ev) return null;
  return (
    <div className="flex flex-col gap-space-sm">
      <h3 className={h3}>{title}</h3>
      <p className={body}>{ev.system}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
        <Stat label="Bad claims caught" value={`${ev.caught} of ${ev.bad_pairs}`} note={pct(ev.catch_rate)} />
        <Stat label="Correct claims wrongly rejected" value={`${ev.falsely_rejected} of ${ev.correct_pairs}`} note={pct(ev.false_reject_rate)} />
        <Stat label="AI check did not run" value={`${ev.ai_check_not_run} of ${ev.pairs}`} note="Never counted as caught" />
      </div>
    </div>
  );
}

function ConfusionMatrix({ ev, caption }) {
  if (!ev?.confusion_matrix) return null;
  const cats = Object.keys(ev.confusion_matrix);
  return (
    <Table caption={caption}>
      <thead>
        <tr className="border-b border-surface-container">
          <th scope="col" className={th}>Category</th>
          {VERDICTS.map((v) => (
            <th key={v} scope="col" className={th}>Verdict: {v}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {cats.map((c) => (
          <tr key={c} className="border-b border-surface-container">
            <th scope="row" className={th}>{CATEGORY_LABELS[c] || c}</th>
            {VERDICTS.map((v) => (
              <td key={v} className={td}>{ev.confusion_matrix[c][v]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export default function TrustReportPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.getTrustReport());
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return <p role="status" className={body}>Loading the saved trust results…</p>;
  }
  if (error) {
    return (
      <div role="alert" className="rounded-xl bg-error-container text-on-error-container p-space-md flex flex-wrap items-center gap-space-md">
        <span>The trust report could not load: {error}</span>
        <button onClick={load} className="px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface font-label-md text-label-md focus-visible:ring-2 focus-visible:ring-primary">
          Try again
        </button>
      </div>
    );
  }

  const leak = data?.leak || {};
  const now = leak.now;
  const before = leak.before_fixes;
  const se = data?.support_eval || {};
  const effect = se.effect_on_sample_claims;
  const alone = se.detail_check_alone;
  const replay = data?.tripwire_replay;

  return (
    <div className="flex flex-col w-full gap-space-lg">
      <section className="flex flex-col gap-space-sm">
        <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold">Trust report</h1>
        <p className={`${body} max-w-3xl`}>
          Saved results of two tests: an attack run that tries to read or change claims a role should not reach, and an
          evaluation of how often the support check catches deliberately wrong claims. These are tested cases on synthetic
          data, not a guarantee.
        </p>
      </section>

      {/* Leak harness */}
      <section className={card} aria-labelledby="leak-heading">
        <h2 id="leak-heading" className={h2}>Leak attacks</h2>
        {!leak.available ? (
          <p className={body}>No saved leak run yet. Run <code>python -m tests.trust.leak_harness</code> in backend/.</p>
        ) : (
          <>
            <p className={body}>
              Every API route was called as each role, as admin (to check the test can see leaks), and with an unknown,
              empty, missing or tampered role, including direct ids of restricted and confidential claims. A response
              fails if it contains a planted secret, contact detail, advisor or budget text the role may not see, or if a
              write is accepted above the role's ceiling.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
              <Stat label="Attacks run" value={now?.attacks_run ?? "n/a"} note={`${now?.endpoints_covered ?? "?"} endpoints`} />
              <Stat label="Blocked" value={now?.blocked ?? "n/a"} />
              <Stat label="Leaked" value={now?.leaked ?? "n/a"} note={before ? `Before the fixes: ${before.leaked} of ${before.attacks_run}` : undefined} />
            </div>

            {leak.found_before_fixes?.length > 0 && (
              <div className="flex flex-col gap-space-sm">
                <h3 className={h3}>Leaks found on the old code, and their fixes</h3>
                <Table caption="Leaks found before the fixes">
                  <thead>
                    <tr className="border-b border-surface-container">
                      <th scope="col" className={th}>Endpoint</th>
                      <th scope="col" className={th}>Failed attacks</th>
                      <th scope="col" className={th}>What was exposed</th>
                      <th scope="col" className={th}>Fix</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leak.found_before_fixes.map((f) => {
                      const fix = (leak.fixes || []).find((x) => x.endpoints.includes(f.endpoint));
                      return (
                        <tr key={f.endpoint} className="border-b border-surface-container">
                          <th scope="row" className={`${th} font-code-sm text-code-sm`}>{f.endpoint}</th>
                          <td className={td}>{f.count}</td>
                          <td className={td}>{f.exposed.join(", ")}</td>
                          <td className={td}>{fix ? fix.fix : "See docs/TRUST_REPORT.md"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            )}
            {leak.still_leaking?.length > 0 && (
              <div role="alert" className="rounded-lg bg-error-container text-on-error-container p-space-md">
                Still leaking: {leak.still_leaking.map((f) => `${f.endpoint} (${f.count})`).join(", ")}
              </div>
            )}
          </>
        )}
      </section>

      {/* Support evaluation */}
      <section className={card} aria-labelledby="support-heading">
        <h2 id="support-heading" className={h2}>Support-check evaluation</h2>
        {!se.available ? (
          <p className={body}>No saved evaluation yet. Run <code>python scripts/run_support_eval.py</code> in backend/.</p>
        ) : (
          <>
            <p className={body}>
              {se.after.pairs} hand-labelled claim and quote pairs from the sample: {se.after.correct_pairs} correct and{" "}
              {se.after.bad_pairs} deliberately wrong (unrelated, opposite, overstated, with an invented detail, or partly
              supported). A wrong claim counts as caught when the verdict is "no" or "partly", so it is not shown as Verified.
            </p>
            {!se.after.ai_check_ran && (
              <p role="note" className="rounded-lg border border-outline-variant bg-surface-container-low p-space-md font-body-sm text-body-sm text-on-surface">
                The AI support check has not been run on these pairs yet: no API key was available, so every AI verdict is
                "unchecked". In the app an unchecked claim is never shown as Verified. The numbers below for the detail
                check are real; the AI numbers still need a run with a key.
              </p>
            )}
            <EvalSummary title="Before: AI support check" ev={se.before} />
            <EvalSummary title="After: AI support check plus detail check" ev={se.after} />
            <EvalSummary title="Detail check on its own" ev={alone} />

            <div className="flex flex-col gap-space-sm">
              <h3 className={h3}>Detail check by category</h3>
              <ConfusionMatrix ev={alone} caption="Detail check verdicts by category" />
            </div>
            <div className="flex flex-col gap-space-sm">
              <h3 className={h3}>After: verdicts by category</h3>
              <ConfusionMatrix ev={se.after} caption="Combined verdicts by category" />
            </div>

            {effect && (
              <div className="flex flex-col gap-space-sm">
                <h3 className={h3}>Effect on the sample project</h3>
                <p className={body}>
                  With saved AI answers only (no key), the detail check downgraded {effect.downgraded_by_detail_check} of the{" "}
                  {effect.verified + effect.downgraded_by_detail_check} claims the support check marked as supported.{" "}
                  {effect.ai_answers_missing_from_cache} saved AI answers were missing.
                </p>
              </div>
            )}

            {se.after.misses?.length > 0 && (
              <details className="flex flex-col gap-space-sm">
                <summary className={`${h3} cursor-pointer focus-visible:ring-2 focus-visible:ring-primary rounded`}>
                  Wrong claims that were not caught ({se.after.misses.length})
                </summary>
                <Table caption="Missed wrong claims">
                  <thead>
                    <tr className="border-b border-surface-container">
                      <th scope="col" className={th}>Category</th>
                      <th scope="col" className={th}>Claim</th>
                      <th scope="col" className={th}>Quote</th>
                      <th scope="col" className={th}>Verdict</th>
                    </tr>
                  </thead>
                  <tbody>
                    {se.after.misses.map((m) => (
                      <tr key={m.id} className="border-b border-surface-container">
                        <th scope="row" className={th}>{CATEGORY_LABELS[m.category] || m.category}</th>
                        <td className={td}>{m.claim}</td>
                        <td className={td}>{m.quote}</td>
                        <td className={td}>{m.verdict}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </details>
            )}
          </>
        )}
      </section>

      {replay && (
        <section className={card} aria-labelledby="replay-heading">
          <h2 id="replay-heading" className={h2}>Tripwire replay</h2>
          <p className={body}>Saved replay of tripwire warnings against later history (same-file results).</p>
          <ul className="list-disc pl-5 font-body-sm text-body-sm text-on-surface">
            {(replay.datasets || []).map((d, i) => (
              <li key={d.name || i}>
                <strong>{d.name || d.label || `Dataset ${i + 1}`}</strong>:{" "}
                {Object.entries(d.results?.same_file || {})
                  .filter(([, v]) => typeof v === "number" || typeof v === "string")
                  .map(([k, v]) => `${k.replace(/_/g, " ")} ${typeof v === "number" && v <= 1 && v > 0 && !Number.isInteger(v) ? pct(v) : v}`)
                  .join(", ")}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={card} aria-labelledby="limits-heading">
        <h2 id="limits-heading" className={h2}>Limitations</h2>
        <ul className="list-disc pl-5 flex flex-col gap-1 font-body-md text-body-md text-on-surface">
          {(data?.limitations || []).map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
