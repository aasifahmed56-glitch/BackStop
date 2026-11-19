import React, { useEffect, useState } from "react";
import { api, formatErrorMessage } from "../api";
import { Button } from "./ui";

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

const fmt = (n) => (typeof n === "number" ? n.toLocaleString("en-GB") : n);
const pct = (x) => (x === null || x === undefined ? "n/a" : `${Math.round(x * 100)}%`);

const card = "panel p-4 sm:p-5 flex flex-col gap-4 min-w-0";
const h2 = "text-[22px] leading-[28px] font-bold text-on-surface";
const h3 = "text-[17px] leading-6 font-bold text-on-surface";
const body = "text-[14px] leading-[22px] text-on-surface-variant max-w-[65ch]";
const th = "py-2 px-3 font-semibold text-left text-on-surface sticky left-0 bg-surface-container-lowest";
const thHead = "py-2 px-3 text-left field-label";
const thHeadFirst = `${thHead} sticky left-0 bg-surface-container-low`;
const td = "py-2 px-3 align-top tnum text-on-surface";

function Stat({ label, value, note }) {
  return (
    <div className="border-t border-outline-variant pt-2 pb-1">
      <p className="field-label">{label}</p>
      <p className="tnum text-[26px] leading-[34px] font-bold text-on-surface mt-1">{value}</p>
      {note && <p className="text-[12.5px] leading-5 text-on-surface-variant">{note}</p>}
    </div>
  );
}

function Table({ caption, children }) {
  return (
    <div className="overflow-x-auto border-y border-outline-variant">
      <table className="w-full text-left text-[13.5px] leading-5">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

function EvalSummary({ title, ev }) {
  if (!ev) return null;
  const aiNotRun = ev.ai_check_ran === false && ev.ai_check_not_run === ev.pairs;
  const usesAi = ev.ai_check_ran !== undefined || ev.ai_check_not_run > 0;
  return (
    <div className="flex flex-col gap-2">
      <h3 className={h3}>{title}</h3>
      <p className={body}>{ev.system}</p>
      <div className={`grid grid-cols-1 gap-3 ${usesAi ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {aiNotRun ? (
          <>
            <Stat label="Bad claims caught" value="Not run" note="The AI check had no verdicts to count" />
            <Stat label="Correct claims wrongly rejected" value="Not run" note="The AI check had no verdicts to count" />
          </>
        ) : (
          <>
            <Stat label="Bad claims caught" value={pct(ev.catch_rate)} note={`${fmt(ev.caught)} of ${fmt(ev.bad_pairs)}`} />
            <Stat label="Correct claims wrongly rejected" value={pct(ev.false_reject_rate)} note={`${fmt(ev.falsely_rejected)} of ${fmt(ev.correct_pairs)}`} />
          </>
        )}
        {usesAi && (
          <Stat label="AI check did not run" value={`${fmt(ev.ai_check_not_run)} of ${fmt(ev.pairs)}`} note="Never counted as caught" />
        )}
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
        <tr className="bg-surface-container-low border-b border-outline-variant">
          <th scope="col" className={thHeadFirst}>Category</th>
          {VERDICTS.map((v) => (
            <th key={v} scope="col" className={thHead}>Verdict: {v}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {cats.map((c) => (
          <tr key={c} className="border-b border-outline-variant last:border-b-0">
            <th scope="row" className={th}>{CATEGORY_LABELS[c] || c}</th>
            {VERDICTS.map((v) => (
              <td key={v} className={td}>{fmt(ev.confusion_matrix[c][v])}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

const REPLAY_ROWS = [
  ["tripwires", "Tripwires"],
  ["baseline_leaver_owned_module", "Baseline: leaver-owned modules"],
];

function ReplayTable({ datasets }) {
  return (
    <Table caption="Tripwire replay, same-file results">
      <thead>
        <tr className="bg-surface-container-low border-b border-outline-variant">
          <th scope="col" className={thHeadFirst}>Dataset</th>
          <th scope="col" className={thHead}>Method</th>
          <th scope="col" className={thHead}>Flagged</th>
          <th scope="col" className={thHead}>Later problematic</th>
          <th scope="col" className={thHead}>Precision</th>
          <th scope="col" className={thHead}>Recall</th>
        </tr>
      </thead>
      <tbody>
        {datasets.flatMap((d, i) => {
          const r = d.results?.same_file || {};
          const name = d.dataset?.label || `Dataset ${i + 1}`;
          return REPLAY_ROWS.filter(([k]) => r[k]).map(([k, label], j) => (
            <tr key={`${i}-${k}`} className="border-b border-outline-variant last:border-b-0">
              {j === 0 && (
                <th scope="rowgroup" rowSpan={REPLAY_ROWS.filter(([kk]) => r[kk]).length} className={`${th} align-top`}>
                  {name}
                  <span className="block text-[12px] font-normal text-on-surface-variant">
                    {fmt(d.proposed_changes)} later commits, base rate {pct(r.base_rate)}
                  </span>
                </th>
              )}
              <td className={td}>{label}</td>
              <td className={td}>{fmt(r[k].flagged)} of {fmt(d.proposed_changes)}</td>
              <td className={td}>{fmt(r.problematic)}</td>
              <td className={td}>{r.problematic ? pct(r[k].precision) : "n/a"}</td>
              <td className={td}>{pct(r[k].recall)}</td>
            </tr>
          ));
        })}
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
    return <p role="status" className="text-[14px] text-on-surface-variant">Loading the saved trust results…</p>;
  }
  if (error) {
    return (
      <div role="alert" className="panel max-w-xl mx-auto mt-10 p-5 flex flex-col items-start gap-3">
        <p className="text-[14px] text-on-surface">The trust report could not load: {error}</p>
        <Button onClick={load}>Try again</Button>
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
    <div className="flex flex-col w-full gap-5 min-w-0">
      <header className="flex flex-col gap-1">
        <h1 className="text-[26px] leading-[34px] font-bold tracking-[-0.015em] text-on-surface">Trust report</h1>
        <p className={body}>
          Saved results of two tests: an attack run that tries to read or change claims a role should not reach, and an
          evaluation of how often the support check catches deliberately wrong claims. These are tested cases on synthetic
          data, not a guarantee.
        </p>
      </header>

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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Stat label="Attacks run" value={fmt(now?.attacks_run ?? "n/a")} note={`${fmt(now?.endpoints_covered ?? "?")} endpoints`} />
              <Stat label="Blocked" value={fmt(now?.blocked ?? "n/a")} />
              <Stat label="Leaked" value={fmt(now?.leaked ?? "n/a")} note={before ? `Before the fixes: ${fmt(before.leaked)} of ${fmt(before.attacks_run)} attacks leaked (an earlier, smaller attack set)` : undefined} />
            </div>

            {leak.found_before_fixes?.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className={h3}>Leaks found on the old code, and their fixes</h3>
                <Table caption="Leaks found before the fixes">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant">
                      <th scope="col" className={thHeadFirst}>Endpoint</th>
                      <th scope="col" className={thHead}>Failed attacks</th>
                      <th scope="col" className={thHead}>What was exposed</th>
                      <th scope="col" className={thHead}>Fix</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leak.found_before_fixes.map((f) => {
                      const fix = (leak.fixes || []).find((x) => x.endpoints.includes(f.endpoint));
                      return (
                        <tr key={f.endpoint} className="border-b border-outline-variant last:border-b-0">
                          <th scope="row" className={`${th} font-mono text-[12.5px] font-normal whitespace-nowrap`}>{f.endpoint}</th>
                          <td className={td}>{fmt(f.count)}</td>
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
              <div role="alert" className="border-t-2 border-error pt-3 text-error font-semibold">
                Still leaking: {leak.still_leaking.map((f) => `${f.endpoint} (${f.count})`).join(", ")}
              </div>
            )}
          </>
        )}
      </section>

      {/* Support evaluation */}
      <section className={card} aria-labelledby="support-heading">
        {se.available && !se.after?.ai_check_ran && (
          <p role="note" className="max-w-[65ch] border-t-2 border-goldenrod pt-3 text-on-surface text-[13.5px] leading-[21px]">
            The AI support check has not been run on these pairs yet: no API key was available, so every AI verdict is
            "unchecked". In the app an unchecked claim is never shown as Verified. The numbers below for the detail
            check are real; the AI numbers still need a run with a key.
          </p>
        )}
        <h2 id="support-heading" className={h2}>Support-check evaluation</h2>
        {!se.available ? (
          <p className={body}>No saved evaluation yet. Run <code>python scripts/run_support_eval.py</code> in backend/.</p>
        ) : (
          <>
            <p className={body}>
              {fmt(se.after.pairs)} hand-labelled claim and quote pairs from the sample: {fmt(se.after.correct_pairs)} correct and{" "}
              {fmt(se.after.bad_pairs)} deliberately wrong (unrelated, opposite, overstated, with an invented detail, or partly
              supported). A wrong claim counts as caught when the verdict is "no" or "partly", so it is not shown as Verified.
            </p>
            <EvalSummary title="Before: AI support check" ev={se.before} />
            <EvalSummary title="After: AI support check plus detail check" ev={se.after} />
            <EvalSummary title="Detail check on its own" ev={alone} />

            <div className="flex flex-col gap-2">
              <h3 className={h3}>Detail check by category</h3>
              <ConfusionMatrix ev={alone} caption="Detail check verdicts by category" />
            </div>
            <div className="flex flex-col gap-2">
              <h3 className={h3}>After: verdicts by category</h3>
              <ConfusionMatrix ev={se.after} caption="Combined verdicts by category" />
            </div>

            {effect && (
              <div className="flex flex-col gap-2">
                <h3 className={h3}>Effect on the sample project</h3>
                <p className={body}>
                  With saved AI answers only (no key), the detail check downgraded {fmt(effect.downgraded_by_detail_check)} of the{" "}
                  {fmt(effect.verified + effect.downgraded_by_detail_check)} claims the support check marked as supported.{" "}
                  {fmt(effect.ai_answers_missing_from_cache)} saved AI answers were missing.
                </p>
              </div>
            )}

            {se.after.misses?.length > 0 && (
              <details className="flex flex-col gap-2">
                <summary className={`${h3} cursor-pointer rounded-[2px]`}>
                  Wrong claims that were not caught ({fmt(se.after.misses.length)})
                </summary>
                <Table caption="Missed wrong claims">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant">
                      <th scope="col" className={thHeadFirst}>Category</th>
                      <th scope="col" className={thHead}>Claim</th>
                      <th scope="col" className={thHead}>Quote</th>
                      <th scope="col" className={thHead}>Verdict</th>
                    </tr>
                  </thead>
                  <tbody>
                    {se.after.misses.map((m) => (
                      <tr key={m.id} className="border-b border-outline-variant last:border-b-0">
                        <th scope="row" className={th}>{CATEGORY_LABELS[m.category] || m.category}</th>
                        <td className={td}>{m.claim}</td>
                        <td className={`${td} font-mono text-[12.5px]`}>{m.quote}</td>
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

      {replay?.datasets?.length > 0 && (
        <section className={card} aria-labelledby="replay-heading">
          <h2 id="replay-heading" className={h2}>Tripwire replay</h2>
          <p className={body}>
            Tripwires were built from history before a cutoff, then every later commit was checked as if it were a proposed
            change. A commit counts as later problematic if it was reverted or a fix touched the same files within{" "}
            {replay.rules?.fix_days ?? 30} days. No AI is used.
          </p>
          <ReplayTable datasets={replay.datasets} />
        </section>
      )}

      <section className={card} aria-labelledby="limits-heading">
        <h2 id="limits-heading" className={h2}>Limitations</h2>
        <ul className="list-disc pl-5 flex flex-col gap-1 text-[14px] leading-[22px] text-on-surface max-w-[65ch]">
          {(data?.limitations || []).map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
