import React, { useState, useEffect } from "react";
import { ArrowUpDown, Calculator, Check, History, Info, PlayCircle, Radar, RefreshCw, SlidersHorizontal, Target } from "lucide-react";
import { api } from "../api";
import RealBacktestView from "./RealBacktestView";
import GithubImportPanel from "./GithubImportPanel";

const DATASET_KEY = "backstop.backtestDataset";

export default function BacktestPage({ onOpenTrust }) {
  const [datasets, setDatasets] = useState([{ id: "sample", label: "Synthetic sample", kind: "synthetic" }]);
  const [dataset, setDataset] = useState(() => {
    try {
      return localStorage.getItem(DATASET_KEY) || "sample";
    } catch {
      return "sample";
    }
  });

  useEffect(() => {
    api.getBacktestDatasets().then((d) => Array.isArray(d) && d.length && setDatasets(d)).catch(() => {});
  }, []);

  const choose = (id) => {
    setDataset(id);
    try {
      localStorage.setItem(DATASET_KEY, id);
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <div className="flex flex-col w-full gap-space-lg">
      <fieldset className="flex flex-wrap items-center gap-space-sm">
        <legend className="sr-only">Choose a dataset</legend>
        <span className="font-label-md text-label-md text-on-surface-variant mr-1">Dataset</span>
        {datasets.map((d) => (
          <label
            key={d.id}
            className={`cursor-pointer px-3 py-1.5 rounded-lg border font-label-md text-label-md has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${
              dataset === d.id ? "bg-primary text-on-primary border-primary" : "bg-surface-container-lowest text-on-surface border-outline-variant"
            }`}
          >
            <input type="radio" name="dataset" value={d.id} checked={dataset === d.id} onChange={() => choose(d.id)} className="sr-only" />
            {d.label}
          </label>
        ))}
        <label
          className={`cursor-pointer px-3 py-1.5 rounded-lg border font-label-md text-label-md has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${
            dataset === "import" ? "bg-primary text-on-primary border-primary" : "bg-surface-container-lowest text-on-surface border-outline-variant"
          }`}
        >
          <input type="radio" name="dataset" value="import" checked={dataset === "import"} onChange={() => choose("import")} className="sr-only" />
          Analyse a GitHub repository
        </label>
      </fieldset>
      {onOpenTrust && (
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Did it work? The backtest checks the risk ranking. For leak attacks and how often wrong claims are caught, see the{" "}
          <button onClick={onOpenTrust} className="underline text-primary font-semibold focus-visible:ring-2 focus-visible:ring-primary rounded">
            Trust report
          </button>
          .
        </p>
      )}
      {dataset === "import" ? (
        <GithubImportPanel />
      ) : dataset === "sample" || !datasets.some((d) => d.id === dataset) ? (
        <SampleBacktest />
      ) : (
        <RealBacktestView name={dataset} />
      )}
    </div>
  );
}

const f1Of = (p, r) => (p + r > 0 ? (2 * p * r) / (p + r) : 0);
const meanF1 = (metrics) => (metrics.length ? metrics.reduce((t, m) => t + f1Of(m.precision, m.recall), 0) / metrics.length : null);
const fmtN = (x) => x.toLocaleString("en-GB");

function SampleBacktest() {
  const [backtestData, setBacktestData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadBacktest = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getBacktest(1);
      setBacktestData(data);
    } catch (err) {
      setError(err.message || "Failed to load backtest data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBacktest();
  }, []);

  if (!backtestData && error) {
    return (
      <div role="alert" className="panel p-space-lg flex flex-col items-start gap-space-sm max-w-xl">
        <h1 className="font-headline-md text-headline-md text-on-surface font-semibold">The sample backtest could not load</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{error}</p>
        <button
          type="button"
          onClick={loadBacktest}
          className="px-space-md py-2 bg-primary hover:bg-primary-container text-on-primary rounded-lg font-label-md text-label-md cursor-pointer"
        >
          Try again
        </button>
      </div>
    );
  }
  if (!backtestData) {
    return (
      <p role="status" aria-live="polite" className="font-body-md text-body-md text-on-surface-variant py-space-lg">
        Evaluating the sample backtest…
      </p>
    );
  }

  const bMetrics = backtestData.backstop?.metrics || [];
  const baseMetrics = backtestData.baseline?.metrics || [];
  const groundTruth = backtestData.ground_truth_modules || [];
  const allModules = backtestData.all_modules || [];
  const moduleTotal = allModules.length;
  const positivesText = moduleTotal ? `${groundTruth.length} of ${moduleTotal}` : `${groundTruth.length}`;

  const pairs = bMetrics.map((b) => ({ b, base: baseMetrics.find((m) => m.k === b.k) || b }));
  const same = (b, base) => b.precision === base.precision && b.recall === base.recall;
  const allTied = pairs.length > 0 && pairs.every(({ b, base }) => same(b, base));
  const differing = pairs.filter(({ b, base }) => !same(b, base)).map(({ b }) => b.k);
  const kRange = pairs.length ? `k=${pairs[0].b.k} to ${pairs[pairs.length - 1].b.k}` : "";
  const tieText = allTied
    ? `Backstop and the commit-count baseline tie on precision and recall at every k (${kRange}). Only the order of the modules differs.`
    : `Backstop and the baseline differ at k=${differing.join(", ")} and tie at the other cutoffs.`;

  const f1Backstop = typeof backtestData.overall_f1 === "number" ? backtestData.overall_f1 : meanF1(bMetrics);
  const f1Base = meanF1(baseMetrics);

  const bTop = backtestData.backstop?.ranking?.[0];
  const baseTop = backtestData.baseline?.ranking?.[0];
  const share = (row) => (row && row.total_commits ? `${((row.leaver_commits / row.total_commits) * 100).toFixed(1)}%` : null);
  const k1 = pairs.find(({ b }) => b.k === 1);

  const stickyCell = "sticky left-0 bg-surface-container-lowest";

  return (
    <div className="flex flex-col w-full gap-space-lg">
      {/* Top Benchmark Header */}
      <section className="flex flex-col gap-space-md mb-space-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold">
              Handover risk backtest
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-0.5 max-w-3xl">
              Benchmark evaluating Backstop's Knowledge-at-Risk scoring against post-departure ground truth outcomes.
            </p>
          </div>
          <div className="flex items-center gap-space-sm shrink-0">
            {error && (
              <p role="alert" className="font-body-sm text-body-sm text-on-error-container bg-error-container rounded-lg px-3 py-2">
                Backtest could not refresh: {error}
              </p>
            )}
            <button
              onClick={loadBacktest}
              disabled={isLoading}
              className="px-space-md py-2.5 bg-primary hover:bg-primary-container text-on-primary rounded-lg font-headline-sm text-headline-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              type="button"
            >
              {isLoading ? <RefreshCw size={18} aria-hidden="true" className="shrink-0 animate-spin motion-reduce:animate-none" /> : <PlayCircle size={18} aria-hidden="true" className="shrink-0" />}
              <span>{isLoading ? "Evaluating..." : "Re-run the backtest"}</span>
            </button>
            <span role="status" aria-live="polite" className="sr-only">{isLoading ? "Evaluating the backtest" : ""}</span>
          </div>
        </div>

        {/* Limitations and Protocol Banner */}
        <div className="w-full bg-surface-container-low rounded-xl px-space-md py-space-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-sm border border-outline-variant">
          <div className="flex items-center gap-space-sm">
            <Info size={18} aria-hidden="true" className="shrink-0 text-outline" />
            <div className="text-on-surface-variant font-label-md text-label-md">
              <strong className="text-on-surface">Limitations:</strong> Tiny synthetic dataset, {positivesText} modules are positives, demonstration only. The algorithm evaluated repository artifacts up to the cutoff date.
            </div>
          </div>
          <span className="text-on-surface-variant font-label-sm text-label-sm shrink-0 font-semibold">Cutoff enforced</span>
        </div>
      </section>

      {/* 3 Metric Cards Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">
        {/* Card 1: Cutoff Date */}
        <div className="bg-surface-container-lowest rounded-xl p-space-lg flex flex-col justify-between border border-outline-variant">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="font-label-md text-label-md font-semibold">
              Cutoff date
            </span>
            <History size={20} aria-hidden="true" className="shrink-0 text-outline" />
          </div>
          <div className="my-space-md flex flex-col">
            <div className="flex items-baseline gap-space-xs">
              <span className="font-display-lg text-display-lg text-on-surface tracking-tight font-bold">
                {backtestData.cutoff_date ?? "—"}
              </span>
            </div>
            <span className="font-label-sm text-label-sm text-outline mt-1">Audit cutoff date</span>
          </div>
          <div className="pt-space-md border-t border-outline-variant">
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Evaluated strictly prior to cutoff
            </span>
          </div>
        </div>

        {/* Card 2: Ground Truth Target Modules */}
        <div className="bg-surface-container-lowest rounded-xl p-space-lg flex flex-col justify-between border border-outline-variant">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="font-label-md text-label-md font-semibold">
              Ground truth targets
            </span>
            <Radar size={20} aria-hidden="true" className="shrink-0 text-outline" />
          </div>
          <div className="my-space-md flex flex-col">
            <div className="flex items-baseline gap-space-xs">
              <span className="font-display-lg text-display-lg text-on-surface tracking-tight font-bold">
                {positivesText}
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface-variant ml-1 font-semibold">
                modules troubled
              </span>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {groundTruth.map((mod) => (
                <span
                  key={mod}
                  className="px-2 py-0.5 rounded bg-surface-container font-code-sm text-code-sm text-on-surface font-semibold"
                >
                  {mod}
                </span>
              ))}
            </div>
          </div>
          <div className="pt-space-md border-t border-outline-variant">
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Post-departure troubled modules in ground truth
            </span>
          </div>
        </div>

        {/* Card 3: Overall F1 Score */}
        <div className="bg-surface-container-lowest rounded-xl p-space-lg flex flex-col justify-between border border-outline-variant">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="font-label-md text-label-md font-semibold">
              Benchmark F1
            </span>
            <Target size={20} aria-hidden="true" className="shrink-0 text-primary" />
          </div>
          <div className="my-space-md flex flex-col">
            <div className="flex items-baseline gap-space-xs">
              <span className="font-display-lg text-display-lg text-on-surface tracking-tight font-bold tabular-nums">
                {typeof f1Backstop === "number" ? f1Backstop.toFixed(3) : "—"}
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface-variant ml-1 font-semibold">
                Backstop
              </span>
            </div>
            <span className="font-label-sm text-label-sm text-on-surface-variant mt-1 tabular-nums">
              Mean of F1 over {kRange || "the cutoffs"}{typeof f1Base === "number" ? `; commit-count baseline ${f1Base.toFixed(3)}` : ""}
            </span>
          </div>
          <div className="pt-space-md border-t border-outline-variant">
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              {allTied ? "Same as the baseline: the sample cannot separate them" : "Compare with the baseline in the table below"}
            </span>
          </div>
        </div>
      </section>

      {/* Side-by-Side Metric Comparison Table */}
      <section className="bg-surface-container-lowest rounded-xl overflow-hidden border border-outline-variant">
        <div className="p-space-lg flex flex-col sm:flex-row sm:items-center justify-between gap-space-md bg-surface-container-low border-b border-surface-container/60">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface font-semibold">
              Backtest metric matrix
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 max-w-[65ch]">
              Backstop vs the raw commit count. {tieText}
            </p>
          </div>
          <div className="flex items-center gap-space-sm text-outline font-code-sm text-code-sm">
            <SlidersHorizontal size={16} aria-hidden="true" className="shrink-0" />
            <span>Synthetic dataset, {positivesText} positives</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left tabular-nums">
            <caption className="sr-only">Backstop and baseline top-k modules, precision and recall for each k</caption>
            <thead>
              <tr className="bg-surface-container text-on-surface-variant font-label-md text-label-md">
                <th scope="col" className="py-3 px-4 w-12 text-center font-bold sticky left-0 bg-surface-container">k</th>
                <th scope="col" className="py-3 px-4 font-bold">Backstop top-k</th>
                <th scope="col" className="py-3 px-4 text-center font-bold">Precision@k</th>
                <th scope="col" className="py-3 px-4 text-center font-bold">Recall@k</th>
                <th scope="col" className="py-3 px-4 font-bold">Baseline top-k</th>
                <th scope="col" className="py-3 px-4 text-center font-bold">Precision@k</th>
                <th scope="col" className="py-3 px-4 text-center font-bold">Recall@k</th>
                <th scope="col" className="py-3 px-4 text-right font-bold">Precision delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container text-body-sm font-body-sm text-on-surface">
              {pairs.map(({ b, base }) => {
                const delta = b.precision - base.precision;

                return (
                  <tr key={b.k} className="hover:bg-surface-container-low transition-colors">
                    <th scope="row" className={`py-3.5 px-4 text-center font-code-sm text-code-sm font-bold text-on-surface-variant ${stickyCell}`}>{b.k}</th>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {b.top_k.map((mod) => (
                          <span
                            key={mod}
                            className="px-2 py-0.5 rounded-md bg-primary-fixed text-on-primary-fixed font-code-sm text-code-sm font-medium"
                          >
                            {mod}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-on-surface">{b.precision.toFixed(2)}</td>
                    <td className="py-3.5 px-4 text-center text-on-surface-variant">{b.recall.toFixed(2)}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {base.top_k.map((mod) => (
                          <span
                            key={mod}
                            className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface font-code-sm text-code-sm"
                          >
                            {mod}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center font-medium text-on-surface-variant">
                      {base.precision.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-center text-on-surface-variant">{base.recall.toFixed(2)}</td>
                    <td className="py-3.5 px-4 text-right">
                      {delta === 0 ? (
                        <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                          Tied (0.00)
                        </span>
                      ) : delta > 0 ? (
                        <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-on-surface font-bold">
                          +{delta.toFixed(2)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-on-surface font-bold">
                          {delta.toFixed(2)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Analytical Rationale Cards */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg">
        {/* Card 1: Risk Formulation */}
        <div className="bg-surface-container-lowest rounded-xl p-space-lg flex flex-col justify-between border border-outline-variant">
          <div className="space-y-space-sm">
            <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2 font-semibold">
              <Calculator size={20} aria-hidden="true" className="shrink-0 text-secondary" />
              Ranking criteria: Knowledge-at-Risk scoring
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant max-w-[65ch]">
              Raw commit volume reflects past churn rather than institutional risk. Backstop weights contributor concentration and recent activity:
            </p>
            <ul className="space-y-2 font-body-sm text-body-sm text-on-surface-variant pt-1">
              <li className="flex items-start gap-1.5">
                <Check size={16} aria-hidden="true" className="shrink-0 text-tertiary mt-0.5" />
                <span>
                  <strong className="text-on-surface">Contributor concentration:</strong> Prioritizes modules where a high percentage of commits were authored by the departing contributor.
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <Check size={16} aria-hidden="true" className="shrink-0 text-tertiary mt-0.5" />
                <span>
                  <strong className="text-on-surface">Human verification:</strong> A person approves every claim before it reaches the handover.
                </span>
              </li>
            </ul>
          </div>
          <div className="pt-space-md mt-space-md border-t border-surface-container flex items-center justify-between text-outline font-code-sm text-code-sm">
            <span>Rule-based scoring</span>
            <span>Human in the loop</span>
          </div>
        </div>

        {/* Card 2: top-ranked module under each ranking */}
        {bTop && baseTop && (
          <div className="bg-surface-container-lowest rounded-xl p-space-lg flex flex-col justify-between border border-outline-variant">
            <div className="space-y-space-sm">
              <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2 font-semibold">
                <ArrowUpDown size={20} aria-hidden="true" className="shrink-0 text-outline" />
                {bTop.module === baseTop.module ? `Both rankings put ${bTop.module} first` : `Module priority: ${bTop.module} vs ${baseTop.module}`}
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Different ranking mechanisms can produce different priorities:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm pt-1">
                <div className="border-t border-outline-variant pt-space-sm">
                  <span className="font-label-sm text-label-sm text-on-surface-variant block">Raw commits rank #1</span>
                  <span className="font-headline-md text-headline-md text-on-surface font-bold">{baseTop.module}</span>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 tabular-nums">
                    {fmtN(baseTop.leaver_commits)} of {fmtN(baseTop.total_commits)} commits by the leaver{share(baseTop) ? ` (${share(baseTop)})` : ""}
                  </p>
                </div>
                <div className="border-t border-outline-variant pt-space-sm">
                  <span className="font-label-sm text-label-sm text-on-surface-variant block">Backstop rank #1</span>
                  <span className="font-headline-md text-headline-md text-on-surface font-bold">{bTop.module}</span>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 tabular-nums">
                    {fmtN(bTop.leaver_commits)} of {fmtN(bTop.total_commits)} commits by the leaver{share(bTop) ? ` (${share(bTop)} concentration)` : ""}
                  </p>
                </div>
              </div>
              {k1 && (
                <p className="font-body-sm text-body-sm text-on-surface-variant pt-1 leading-relaxed max-w-[65ch]">
                  {bTop.is_troubled && baseTop.is_troubled
                    ? `Both modules are in the ground-truth troubled set, so precision at k=1 is ${k1.b.precision.toFixed(2)} for Backstop and ${k1.base.precision.toFixed(2)} for the baseline, but the ranking reflects different prioritization.`
                    : `At k=1, precision is ${k1.b.precision.toFixed(2)} for Backstop and ${k1.base.precision.toFixed(2)} for the baseline.`}
                </p>
              )}
            </div>
            <div className="pt-space-md mt-space-md border-t border-surface-container flex items-center justify-between text-outline font-code-sm text-code-sm">
              <span>Synthetic demonstration</span>
              <span className="text-on-surface-variant">{positivesText} positives</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
