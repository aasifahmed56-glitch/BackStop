import React, { useState, useEffect } from "react";
import { api } from "../api";
import RealBacktestView from "./RealBacktestView";
import GithubImportPanel from "./GithubImportPanel";

const DATASET_KEY = "backstop.backtestDataset";

export default function BacktestPage() {
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

  const bMetrics = backtestData?.backstop?.metrics || [];
  const baseMetrics = backtestData?.baseline?.metrics || [];
  const groundTruth = backtestData?.ground_truth_modules || ["auth", "deploy", "notifications", "payments"];
  const allModules = backtestData?.all_modules || [];

  return (
    <div className="flex flex-col w-full gap-space-lg">
      {/* Top Benchmark Header */}
      <section className="flex flex-col gap-space-md mb-space-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold">
              Handover Risk Backtest
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-0.5 max-w-3xl">
              Benchmark evaluating Backstop's Knowledge-at-Risk scoring against post-departure ground truth outcomes.
            </p>
          </div>
          <div className="flex items-center gap-space-sm shrink-0">
            {error && (
              <p role="alert" className="font-body-sm text-body-sm text-on-error-container bg-error-container rounded-lg px-3 py-2">
                Backtest could not load: {error}
              </p>
            )}
            <button
              onClick={loadBacktest}
              disabled={isLoading}
              className="px-space-md py-2.5 bg-primary hover:bg-primary-container text-on-primary rounded-lg font-headline-sm text-headline-sm transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
              type="button"
            >
              <span aria-hidden="true" className={`material-symbols-outlined text-[18px] ${isLoading ? "animate-spin" : ""}`}>
                {isLoading ? "refresh" : "play_circle"}
              </span>
              <span>{isLoading ? "Evaluating..." : "Re-run Backtest Benchmark"}</span>
            </button>
          </div>
        </div>

        {/* Limitations and Protocol Banner */}
        <div className="w-full bg-surface-container-low rounded-xl px-space-md py-space-sm flex flex-col sm:flex-row items-center justify-between gap-space-sm shadow-sm border border-surface-container">
          <div className="flex items-center gap-space-sm">
            <span aria-hidden="true" className="material-symbols-outlined text-outline text-[18px]">info</span>
            <div className="text-on-surface-variant font-label-md text-label-md">
              <strong className="text-on-surface">Limitations Note:</strong> Tiny synthetic dataset, 4 of 7 modules are positives, demonstration only. The algorithm evaluated repository artifacts up to the cutoff date.
            </div>
          </div>
          <div className="flex items-center gap-space-sm text-tertiary font-label-sm text-label-sm shrink-0 font-semibold">
            <span className="w-2 h-2 rounded-full bg-tertiary"></span>
            <span>Cutoff Enforced</span>
          </div>
        </div>
      </section>

      {/* 3 Metric Cards Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">
        {/* Card 1: Cutoff Date */}
        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between border border-surface-container">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="font-label-md text-label-md uppercase tracking-wider font-semibold">
              Cutoff Date
            </span>
            <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-outline">history_toggle_off</span>
          </div>
          <div className="my-space-md flex flex-col">
            <div className="flex items-baseline gap-space-xs">
              <span className="font-display-lg text-display-lg text-on-surface tracking-tight font-bold">
                {backtestData?.cutoff_date ?? "—"}
              </span>
            </div>
            <span className="font-label-sm text-label-sm text-outline mt-1">Audit Cutoff Date</span>
          </div>
          <div className="pt-space-sm bg-surface-container-low -mx-space-lg -mb-space-lg p-space-md rounded-b-xl flex items-center gap-1.5 border-t border-surface-container/60">
            <span className="w-2 h-2 rounded-full bg-tertiary"></span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Evaluated strictly prior to cutoff
            </span>
          </div>
        </div>

        {/* Card 2: Ground Truth Target Modules */}
        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between border border-surface-container">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="font-label-md text-label-md uppercase tracking-wider font-semibold">
              Ground Truth Targets
            </span>
            <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-outline">radar</span>
          </div>
          <div className="my-space-md flex flex-col">
            <div className="flex items-baseline gap-space-xs">
              <span className="font-display-lg text-display-lg text-on-surface tracking-tight font-bold">
                {groundTruth.length} of {allModules.length || 7}
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface-variant ml-1 font-semibold">
                Modules Troubled
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
          <div className="pt-space-sm bg-surface-container-low -mx-space-lg -mb-space-lg p-space-md rounded-b-xl flex items-center gap-1.5 border-t border-surface-container/60">
            <span aria-hidden="true" className="material-symbols-outlined text-tertiary text-[16px]">check_circle</span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Post-departure troubled modules in ground truth
            </span>
          </div>
        </div>

        {/* Card 3: Overall F1 Score */}
        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between border border-surface-container">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="font-label-md text-label-md uppercase tracking-wider font-semibold">
              Overall Benchmark F1
            </span>
            <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-primary">target</span>
          </div>
          <div className="my-space-md flex flex-col">
            <div className="flex items-baseline gap-space-xs">
              <span className="font-display-lg text-display-lg text-on-surface tracking-tight font-bold">
                {typeof backtestData?.overall_f1 === "number" ? backtestData.overall_f1.toFixed(3) : "—"}
              </span>
              <span className="font-headline-sm text-headline-sm text-tertiary ml-1 font-semibold">
                Score
              </span>
            </div>
            <span className="font-label-sm text-label-sm text-outline mt-1">Synthetic benchmark outcome</span>
          </div>
          <div className="pt-space-sm bg-surface-container-low -mx-space-lg -mb-space-lg p-space-md rounded-b-xl flex items-center gap-1.5 border-t border-surface-container/60">
            <span aria-hidden="true" className="material-symbols-outlined text-tertiary text-[16px]">verified</span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Backstop's ranking only; compare with the baseline below
            </span>
          </div>
        </div>
      </section>

      {/* Dynamic Precision@k Comparison Chart */}
      <section className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-container flex flex-col gap-space-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-space-sm border-b border-surface-container/60">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface font-semibold">
              Precision@k Comparison by Cutoff
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Comparing Backstop ranking vs commit-count baseline across top-k module cuts.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-primary"></span>
              <span>Backstop</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-outline"></span>
              <span>Raw Commit Baseline</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-space-md">
          {bMetrics.map((b) => {
            const base = baseMetrics.find((m) => m.k === b.k) || b;
            const isTie = b.precision === base.precision;
            const bPct = Math.round(b.precision * 100);
            const basePct = Math.round(base.precision * 100);

            return (
              <div
                key={b.k}
                className="flex flex-col gap-1.5 p-space-md rounded-lg bg-surface-container-low transition-colors hover:bg-surface-container border border-surface-container/60"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-space-sm">
                    <span className="w-8 h-8 rounded bg-surface-container-lowest flex items-center justify-center font-code-sm text-code-sm font-bold text-on-surface shadow-sm">
                      k={b.k}
                    </span>
                    <div>
                      <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                        Top {b.k} {b.k === 1 ? "Module" : "Modules"}
                      </span>
                      <span className="font-body-sm text-body-sm text-outline ml-2">
                        Backstop: {b.top_k.join(", ")} | Baseline: {base.top_k.join(", ")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-space-md">
                    <span className="font-label-md text-label-md text-on-surface-variant font-bold">
                      {bPct}% vs {basePct}%
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded font-label-sm text-label-sm font-bold ${
                        isTie
                          ? "bg-surface-container text-on-surface-variant"
                          : b.precision > base.precision
                          ? "bg-tertiary-fixed text-on-tertiary-fixed"
                          : "bg-surface-container text-outline"
                      }`}
                    >
                      {isTie ? "Tied" : b.precision > base.precision ? `+${bPct - basePct}%` : `${bPct - basePct}%`}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center gap-3">
                    <span className="w-16 font-label-sm text-label-sm text-on-surface-variant text-right font-medium">
                      Backstop
                    </span>
                    <div className="flex-1 bg-surface-container-highest rounded-full h-3.5 overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2 text-[11px] text-on-primary font-bold"
                        style={{ width: `${bPct}%` }}
                      >
                        {b.precision.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-16 font-label-sm text-label-sm text-outline text-right">Baseline</span>
                    <div className="flex-1 bg-surface-container-highest rounded-full h-3.5 overflow-hidden">
                      <div
                        className="bg-outline h-full rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2 text-[11px] text-surface-container-lowest font-bold"
                        style={{ width: `${basePct}%` }}
                      >
                        {base.precision.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Note on Ties */}
        <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col md:flex-row items-start md:items-center gap-space-md border border-surface-container">
          <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary flex-shrink-0">
            <span aria-hidden="true" className="material-symbols-outlined text-[22px]">balance</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-space-sm">
              <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Evaluation Observation: Equal Precision on Synthetic Dataset
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-label-sm text-label-sm font-bold">
                Tied Across k=1..5
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              On this synthetic dataset, 4 of the 7 modules are ground-truth troubled modules. Backstop and the raw commit baseline tie on precision and recall across all evaluated k values. The key distinction is module ranking order: Backstop ranks <code className="font-code-sm text-primary">deploy</code> as #1 due to sole-author commit concentration (92.9%), whereas the commit baseline ranks <code className="font-code-sm text-outline">auth</code> as #1 due to higher overall commit volume.
            </p>
          </div>
        </div>
      </section>

      {/* Side-by-Side Metric Comparison Table */}
      <section className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border border-surface-container">
        <div className="p-space-lg flex flex-col sm:flex-row sm:items-center justify-between gap-space-md bg-surface-container-low border-b border-surface-container/60">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface font-semibold">
              Backtest Metric Matrix
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
              Head-to-head comparison: Backstop vs. Raw Commit Count
            </p>
          </div>
          <div className="flex items-center gap-space-sm text-outline font-code-sm text-code-sm">
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">tune</span>
            <span>DATASET: SYNTHETIC (4/7 POSITIVES)</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container text-on-surface-variant font-label-md text-label-md">
                <th className="py-3 px-4 w-12 text-center font-bold">k</th>
                <th className="py-3 px-4 font-bold">Backstop Top-k</th>
                <th className="py-3 px-4 text-center font-bold">Precision@k</th>
                <th className="py-3 px-4 text-center font-bold">Recall@k</th>
                <th className="py-3 px-4 font-bold">Baseline Top-k</th>
                <th className="py-3 px-4 text-center font-bold">Precision@k</th>
                <th className="py-3 px-4 text-center font-bold">Recall@k</th>
                <th className="py-3 px-4 text-right font-bold">Precision Delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container text-body-sm font-body-sm text-on-surface">
              {bMetrics.map((b) => {
                const base = baseMetrics.find((m) => m.k === b.k) || b;
                const delta = b.precision - base.precision;

                return (
                  <tr key={b.k} className="hover:bg-surface-container-low transition-colors">
                    <td className="py-3.5 px-4 text-center font-code-sm text-code-sm font-bold text-outline">{b.k}</td>
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
                    <td className="py-3.5 px-4 text-center font-bold text-tertiary">{b.precision.toFixed(2)}</td>
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
                        <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-tertiary font-bold">
                          +{delta.toFixed(2)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-error font-bold">
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
        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between border border-surface-container">
          <div className="space-y-space-sm">
            <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2 font-semibold">
              <span aria-hidden="true" className="material-symbols-outlined text-secondary text-[20px]">calculate</span>
              Ranking Criteria: Knowledge-at-Risk Scoring
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Raw commit volume reflects past churn rather than institutional risk. Backstop weights contributor concentration and recent activity:
            </p>
            <ul className="space-y-2 font-body-sm text-body-sm text-on-surface-variant pt-1">
              <li className="flex items-start gap-1.5">
                <span aria-hidden="true" className="material-symbols-outlined text-tertiary text-[16px] mt-0.5">check</span>
                <span>
                  <strong className="text-on-surface">Contributor Concentration:</strong> Prioritizes modules where a high percentage of commits were authored by the departing contributor.
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <span aria-hidden="true" className="material-symbols-outlined text-tertiary text-[16px] mt-0.5">check</span>
                <span>
                  <strong className="text-on-surface">Human Verification:</strong> A person approves every claim before it reaches the handover.
                </span>
              </li>
            </ul>
          </div>
          <div className="pt-space-md mt-space-md border-t border-surface-container flex items-center justify-between text-outline font-code-sm text-code-sm">
            <span>Rule-based Scoring</span>
            <span>Human In The Loop</span>
          </div>
        </div>

        {/* Card 2: deploy vs auth module prioritization */}
        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between border border-surface-container">
          <div className="space-y-space-sm">
            <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2 font-semibold">
              <span aria-hidden="true" className="material-symbols-outlined text-outline text-[20px]">swap_vert</span>
              Module Prioritization: deploy vs auth
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Different ranking mechanisms produce different priorities:
            </p>
            <div className="grid grid-cols-2 gap-space-sm pt-1">
              <div className="bg-surface-container-low p-space-sm rounded-lg border border-surface-container/60">
                <span className="font-label-sm text-label-sm uppercase text-outline block">Raw Commits Rank #1</span>
                <span className="font-headline-md text-headline-md text-on-surface font-bold">auth</span>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 text-[11px]">
                  35 of 41 commits by leaver (highest raw volume)
                </p>
              </div>
              <div className="bg-surface-container-low p-space-sm rounded-lg border border-surface-container/60">
                <span className="font-label-sm text-label-sm uppercase text-outline block">Backstop Rank #1</span>
                <span className="font-headline-md text-headline-md text-primary font-bold">deploy</span>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 text-[11px]">
                  13 of 14 commits by leaver (92.9% concentration)
                </p>
              </div>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant pt-1 leading-relaxed">
              Both modules are in the ground-truth troubled set, so precision is equal (1.00) at k=1, but the ranking reflects distinct prioritization strategies.
            </p>
          </div>
          <div className="pt-space-md mt-space-md border-t border-surface-container flex items-center justify-between text-outline font-code-sm text-code-sm">
            <span>Synthetic Demonstration</span>
            <span className="text-on-surface-variant">4 of 7 positives</span>
          </div>
        </div>
      </section>
    </div>
  );
}
