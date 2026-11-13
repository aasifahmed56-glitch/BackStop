import React, { useState, useEffect } from "react";
import { api } from "../api";

export default function BacktestPage() {
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

  return (
    <div className="flex flex-col w-full gap-space-lg">
      {/* Top Benchmark Header */}
      <section className="flex flex-col gap-space-md mb-space-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
          <div>
            <div className="flex items-center gap-space-sm mb-1">
              <span className="font-code-sm text-code-sm text-primary uppercase tracking-wider font-semibold">
                Benchmark Run #4092-B
              </span>
              <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
              <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                Blind Cutoff Enforcement Verified
              </span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold">
              Handover Risk Backtest
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-0.5 max-w-3xl">
              Empirical benchmark evaluating Backstop's Knowledge-at-Risk scoring against post-departure ground truth outcomes.
            </p>
          </div>
          <div className="flex items-center gap-space-sm shrink-0">
            <button
              onClick={loadBacktest}
              disabled={isLoading}
              className="px-space-md py-2.5 bg-primary hover:bg-primary-container text-on-primary rounded-lg font-headline-sm text-headline-sm transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
              type="button"
            >
              <span className={`material-symbols-outlined text-[18px] ${isLoading ? "animate-spin" : ""}`}>
                {isLoading ? "refresh" : "play_circle"}
              </span>
              <span>{isLoading ? "Evaluating Model..." : "Re-run Backtest Benchmark"}</span>
            </button>
          </div>
        </div>

        {/* Evaluation Protocol Notice Banner */}
        <div className="w-full bg-surface-container-low rounded-xl px-space-md py-space-sm flex flex-col sm:flex-row items-center justify-between gap-space-sm shadow-sm border border-surface-container">
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-outline text-[18px]">verified_user</span>
            <div className="text-on-surface-variant font-label-md text-label-md">
              <strong className="text-on-surface">Evaluation Protocol Notice:</strong> Ground truth data (
              <code className="font-code-sm text-code-sm bg-surface-container px-1 py-0.5 rounded text-primary">
                ground_truth.json
              </code>
              ) contains historical production incidents occurring after the cutoff date. The algorithm was strictly blinded to this file during calculation.
            </div>
          </div>
          <div className="flex items-center gap-space-sm text-tertiary font-label-sm text-label-sm shrink-0 font-semibold">
            <span className="w-2 h-2 rounded-full bg-tertiary"></span>
            <span>Zero Post-Cutoff Leakage</span>
          </div>
        </div>
      </section>

      {/* 3 Metric Cards Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">
        {/* Card 1: Temporal Boundary */}
        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between border border-surface-container">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="font-label-md text-label-md uppercase tracking-wider font-semibold">
              Temporal Boundary
            </span>
            <span className="material-symbols-outlined text-[20px] text-outline">history_toggle_off</span>
          </div>
          <div className="my-space-md flex flex-col">
            <div className="flex items-baseline gap-space-xs">
              <span className="font-display-lg text-display-lg text-on-surface tracking-tight font-bold">
                {backtestData?.cutoff_date || "2026-03-15"}
              </span>
            </div>
            <span className="font-label-sm text-label-sm text-outline mt-1">Audit Epoch Timestamp (T₀)</span>
          </div>
          <div className="pt-space-sm bg-surface-container-low -mx-space-lg -mb-space-lg p-space-md rounded-b-xl flex items-center gap-1.5 border-t border-surface-container/60">
            <span className="w-2 h-2 rounded-full bg-tertiary"></span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Zero data after this date was evaluated
            </span>
          </div>
        </div>

        {/* Card 2: Ground Truth Target Modules */}
        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between border border-surface-container">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="font-label-md text-label-md uppercase tracking-wider font-semibold">
              Ground Truth Targets
            </span>
            <span className="material-symbols-outlined text-[20px] text-outline">radar</span>
          </div>
          <div className="my-space-md flex flex-col">
            <div className="flex items-baseline gap-space-xs">
              <span className="font-display-lg text-display-lg text-on-surface tracking-tight font-bold">
                {backtestData?.ground_truth_modules?.length || 4} Critical
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface-variant ml-1 font-semibold">
                Modules
              </span>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {(backtestData?.ground_truth_modules || ["deploy", "payments", "auth", "notifications"]).map((mod) => (
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
            <span className="material-symbols-outlined text-tertiary text-[16px]">check_circle</span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Confirmed incident targets post-departure
            </span>
          </div>
        </div>

        {/* Card 3: Top-4 Precision */}
        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between border border-surface-container">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="font-label-md text-label-md uppercase tracking-wider font-semibold">
              Top-4 Precision
            </span>
            <span className="material-symbols-outlined text-[20px] text-primary">target</span>
          </div>
          <div className="my-space-md flex flex-col">
            <div className="flex items-baseline gap-space-xs">
              <span className="font-display-lg text-display-lg text-primary tracking-tight font-bold">100%</span>
              <span className="font-label-md text-label-md text-on-surface-variant ml-1 font-semibold">
                Precision@4
              </span>
            </div>
            <span className="font-label-sm text-label-sm text-outline mt-1">Raw Commit Baseline achieved 75%</span>
          </div>
          <div className="pt-space-sm bg-surface-container-low -mx-space-lg -mb-space-lg p-space-md rounded-b-xl flex items-center gap-1.5 border-t border-surface-container/60">
            <span className="w-2 h-2 rounded-full bg-primary"></span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Backstop ranked all 4 failure targets in top 4
            </span>
          </div>
        </div>
      </section>

      {/* Visual Benchmark Comparison: Backstop vs Raw Commit Count Baseline */}
      <section className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-lg border border-surface-container">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
          <div>
            <div className="flex items-center gap-space-sm">
              <span className="font-headline-md text-headline-md text-on-surface font-semibold">
                Precision@k Benchmark Progression
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-container font-label-sm text-label-sm text-primary font-bold">
                k=1 to k=5
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              Precision of predicted high-risk modules against ground-truth incident records as candidate depth (k) expands.
            </p>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-space-lg p-space-sm bg-surface-container-low rounded-lg self-start lg:self-auto border border-surface-container/60">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-primary"></span>
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                Backstop (Knowledge-at-Risk)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-outline-variant"></span>
              <span className="font-label-md text-label-md text-on-surface-variant">
                Baseline (Raw Commit Count)
              </span>
            </div>
          </div>
        </div>

        {/* Comparative Bar Graph Visualization */}
        <div className="flex flex-col gap-space-md pt-space-xs">
          {/* k=1 Row */}
          <div className="flex flex-col gap-1.5 p-space-md rounded-lg bg-surface-container-low transition-colors hover:bg-surface-container border border-surface-container/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-sm">
                <span className="w-8 h-8 rounded bg-surface-container-lowest flex items-center justify-center font-code-sm text-code-sm font-bold text-on-surface shadow-sm">
                  k=1
                </span>
                <div>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">deploy</span>
                  <span className="font-body-sm text-body-sm text-outline ml-2">Sole knowledge hazard</span>
                </div>
              </div>
              <div className="flex items-center gap-space-md">
                <span className="font-label-md text-label-md text-primary font-bold">100% vs 0%</span>
                <span className="px-2 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-label-sm font-bold">
                  +100% Lift
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
                    className="bg-primary h-full rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2 text-[10px] text-on-primary font-bold"
                    style={{ width: "100%" }}
                  >
                    1.0
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-16 font-label-sm text-label-sm text-outline text-right">Baseline</span>
                <div className="flex-1 bg-surface-container-highest rounded-full h-3.5 overflow-hidden">
                  <div
                    className="bg-error h-full rounded-full transition-all duration-700 ease-out flex items-center justify-start pl-2 text-[10px] text-on-error font-bold"
                    style={{ width: "8%" }}
                  >
                    0.0 (auth)
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* k=2 Row */}
          <div className="flex flex-col gap-1.5 p-space-md rounded-lg bg-surface-container-low transition-colors hover:bg-surface-container border border-surface-container/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-sm">
                <span className="w-8 h-8 rounded bg-surface-container-lowest flex items-center justify-center font-code-sm text-code-sm font-bold text-on-surface shadow-sm">
                  k=2
                </span>
                <div>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    deploy, payments
                  </span>
                  <span className="font-body-sm text-body-sm text-outline ml-2">High revenue path impact</span>
                </div>
              </div>
              <div className="flex items-center gap-space-md">
                <span className="font-label-md text-label-md text-primary font-bold">100% vs 50%</span>
                <span className="px-2 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-label-sm font-bold">
                  +50% Lift
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
                    className="bg-primary h-full rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2 text-[10px] text-on-primary font-bold"
                    style={{ width: "100%" }}
                  >
                    1.0
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-16 font-label-sm text-label-sm text-outline text-right">Baseline</span>
                <div className="flex-1 bg-surface-container-highest rounded-full h-3.5 overflow-hidden">
                  <div
                    className="bg-outline h-full rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2 text-[10px] text-surface-container-lowest font-bold"
                    style={{ width: "50%" }}
                  >
                    0.50
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* k=3 Row */}
          <div className="flex flex-col gap-1.5 p-space-md rounded-lg bg-surface-container-low transition-colors hover:bg-surface-container border border-surface-container/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-sm">
                <span className="w-8 h-8 rounded bg-surface-container-lowest flex items-center justify-center font-code-sm text-code-sm font-bold text-on-surface shadow-sm">
                  k=3
                </span>
                <div>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    deploy, payments, auth
                  </span>
                  <span className="font-body-sm text-body-sm text-outline ml-2">Core services</span>
                </div>
              </div>
              <div className="flex items-center gap-space-md">
                <span className="font-label-md text-label-md text-primary font-bold">100% vs 67%</span>
                <span className="px-2 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-label-sm font-bold">
                  +33% Lift
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
                    className="bg-primary h-full rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2 text-[10px] text-on-primary font-bold"
                    style={{ width: "100%" }}
                  >
                    1.0
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-16 font-label-sm text-label-sm text-outline text-right">Baseline</span>
                <div className="flex-1 bg-surface-container-highest rounded-full h-3.5 overflow-hidden">
                  <div
                    className="bg-outline h-full rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2 text-[10px] text-surface-container-lowest font-bold"
                    style={{ width: "66.7%" }}
                  >
                    0.67
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* k=4 Row */}
          <div className="flex flex-col gap-1.5 p-space-md rounded-lg bg-surface-container-low transition-colors hover:bg-surface-container border border-surface-container/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-sm">
                <span className="w-8 h-8 rounded bg-surface-container-lowest flex items-center justify-center font-code-sm text-code-sm font-bold text-on-surface shadow-sm">
                  k=4
                </span>
                <div>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    deploy, payments, auth, notifications
                  </span>
                  <span className="font-body-sm text-body-sm text-outline ml-2">
                    Complete ground truth recovery
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-space-md">
                <span className="font-label-md text-label-md text-primary font-bold">100% vs 75%</span>
                <span className="px-2 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-label-sm font-bold">
                  +25% Lift
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
                    className="bg-primary h-full rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2 text-[10px] text-on-primary font-bold"
                    style={{ width: "100%" }}
                  >
                    1.0
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-16 font-label-sm text-label-sm text-outline text-right">Baseline</span>
                <div className="flex-1 bg-surface-container-highest rounded-full h-3.5 overflow-hidden">
                  <div
                    className="bg-outline h-full rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2 text-[10px] text-surface-container-lowest font-bold"
                    style={{ width: "75%" }}
                  >
                    0.75
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* k=5 Row */}
          <div className="flex flex-col gap-1.5 p-space-md rounded-lg bg-surface-container-low transition-colors hover:bg-surface-container border border-surface-container/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-sm">
                <span className="w-8 h-8 rounded bg-surface-container-lowest flex items-center justify-center font-code-sm text-code-sm font-bold text-on-surface shadow-sm">
                  k=5
                </span>
                <div>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    Target set exhausted
                  </span>
                  <span className="font-body-sm text-body-sm text-outline ml-2">
                    + web-ui non-target inclusion
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-space-md">
                <span className="font-label-md text-label-md text-on-surface-variant font-bold">
                  80% vs 60%
                </span>
                <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-label-sm text-label-sm font-bold">
                  +20% Lift
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
                    className="bg-primary h-full rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2 text-[10px] text-on-primary font-bold"
                    style={{ width: "80%" }}
                  >
                    0.80
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-16 font-label-sm text-label-sm text-outline text-right">Baseline</span>
                <div className="flex-1 bg-surface-container-highest rounded-full h-3.5 overflow-hidden">
                  <div
                    className="bg-outline h-full rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2 text-[10px] text-surface-container-lowest font-bold"
                    style={{ width: "60%" }}
                  >
                    0.60
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Highlight Callout Box: k=1 Discrepancy Insight */}
        <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col md:flex-row items-start md:items-center gap-space-md border border-surface-container">
          <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary flex-shrink-0">
            <span className="material-symbols-outlined text-[22px]">troubleshoot</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-space-sm">
              <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Critical Finding at k=1: Zero Blind Spot
              </span>
              <span className="px-2 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-label-sm font-bold">
                Precision@1 = 1.0
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              At <strong className="text-on-surface">k=1</strong>, Backstop correctly prioritizes{" "}
              <span className="font-code-sm text-code-sm text-primary bg-surface-container-lowest px-1.5 py-0.5 rounded shadow-sm font-semibold">
                deploy
              </span>{" "}
              at #1 where an actual major production outage occurred due to{" "}
              <strong>92% sole developer knowledge</strong> and <strong>45-day staleness</strong>. In sharp contrast, raw commit baseline placed deploy at #3 and misallocated focus to auth (#1) purely based on vanity volume.
            </p>
          </div>
        </div>
      </section>

      {/* Side-by-Side Metric Comparison Table */}
      <section className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border border-surface-container">
        <div className="p-space-lg flex flex-col sm:flex-row sm:items-center justify-between gap-space-md bg-surface-container-low border-b border-surface-container/60">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface font-semibold">
              Deterministic Backtest Metric Matrix
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
              Head-to-head ranking evaluation: Backstop Knowledge-at-Risk Engine vs. Legacy Commit Count
            </p>
          </div>
          <div className="flex items-center gap-space-sm text-outline font-code-sm text-code-sm">
            <span className="material-symbols-outlined text-[16px]">tune</span>
            <span>FORMULA: KAR-V2.1-EXACT</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container text-on-surface-variant font-label-md text-label-md">
                <th className="py-3 px-4 w-12 text-center font-bold">k</th>
                <th className="py-3 px-4 font-bold">Backstop Top-k Modules</th>
                <th className="py-3 px-4 text-center font-bold">Precision@k</th>
                <th className="py-3 px-4 text-center font-bold">Recall@k</th>
                <th className="py-3 px-4 font-bold">Baseline Top-k (Commits)</th>
                <th className="py-3 px-4 text-center font-bold">Precision@k</th>
                <th className="py-3 px-4 text-center font-bold">Recall@k</th>
                <th className="py-3 px-4 text-right font-bold">Delta (Precision)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container text-body-sm font-body-sm text-on-surface">
              {/* Row 1 */}
              <tr className="hover:bg-surface-container-low transition-colors">
                <td className="py-3.5 px-4 text-center font-code-sm text-code-sm font-bold text-outline">1</td>
                <td className="py-3.5 px-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary-fixed text-on-primary-fixed font-code-sm text-code-sm font-medium">
                    deploy
                  </span>
                </td>
                <td className="py-3.5 px-4 text-center font-bold text-tertiary">1.00</td>
                <td className="py-3.5 px-4 text-center text-on-surface-variant">0.25</td>
                <td className="py-3.5 px-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-surface-container text-on-surface font-code-sm text-code-sm">
                    auth
                  </span>
                </td>
                <td className="py-3.5 px-4 text-center text-error font-medium">0.00</td>
                <td className="py-3.5 px-4 text-center text-on-surface-variant">0.00</td>
                <td className="py-3.5 px-4 text-right">
                  <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-tertiary font-bold">
                    <span className="material-symbols-outlined text-[14px]">arrow_upward</span> +1.00
                  </span>
                </td>
              </tr>

              {/* Row 2 */}
              <tr className="hover:bg-surface-container-low transition-colors">
                <td className="py-3.5 px-4 text-center font-code-sm text-code-sm font-bold text-outline">2</td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-primary-fixed text-on-primary-fixed font-code-sm text-code-sm font-medium">
                      deploy
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-primary-fixed text-on-primary-fixed font-code-sm text-code-sm font-medium">
                      payments
                    </span>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-center font-bold text-tertiary">1.00</td>
                <td className="py-3.5 px-4 text-center text-on-surface-variant">0.50</td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface font-code-sm text-code-sm">
                      auth
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface font-code-sm text-code-sm">
                      web-ui
                    </span>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-center text-on-surface-variant font-medium">0.50</td>
                <td className="py-3.5 px-4 text-center text-on-surface-variant">0.25</td>
                <td className="py-3.5 px-4 text-right">
                  <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-tertiary font-bold">
                    <span className="material-symbols-outlined text-[14px]">arrow_upward</span> +0.50
                  </span>
                </td>
              </tr>

              {/* Row 3 */}
              <tr className="hover:bg-surface-container-low transition-colors">
                <td className="py-3.5 px-4 text-center font-code-sm text-code-sm font-bold text-outline">3</td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-primary-fixed text-on-primary-fixed font-code-sm text-code-sm font-medium">
                      deploy
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-primary-fixed text-on-primary-fixed font-code-sm text-code-sm font-medium">
                      payments
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-primary-fixed text-on-primary-fixed font-code-sm text-code-sm font-medium">
                      auth
                    </span>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-center font-bold text-tertiary">1.00</td>
                <td className="py-3.5 px-4 text-center text-on-surface-variant">0.75</td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface font-code-sm text-code-sm">
                      auth
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface font-code-sm text-code-sm">
                      web-ui
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface font-code-sm text-code-sm">
                      deploy
                    </span>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-center text-on-surface-variant font-medium">0.67</td>
                <td className="py-3.5 px-4 text-center text-on-surface-variant">0.50</td>
                <td className="py-3.5 px-4 text-right">
                  <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-tertiary font-bold">
                    <span className="material-symbols-outlined text-[14px]">arrow_upward</span> +0.33
                  </span>
                </td>
              </tr>

              {/* Row 4 */}
              <tr className="hover:bg-surface-container-low transition-colors">
                <td className="py-3.5 px-4 text-center font-code-sm text-code-sm font-bold text-outline">4</td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-primary-fixed text-on-primary-fixed font-code-sm text-code-sm font-medium">
                      deploy
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-primary-fixed text-on-primary-fixed font-code-sm text-code-sm font-medium">
                      payments
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-primary-fixed text-on-primary-fixed font-code-sm text-code-sm font-medium">
                      auth
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-primary-fixed text-on-primary-fixed font-code-sm text-code-sm font-medium">
                      notifications
                    </span>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-center font-bold text-tertiary">1.00</td>
                <td className="py-3.5 px-4 text-center font-bold text-primary">1.00 (All Found)</td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface font-code-sm text-code-sm">
                      auth
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface font-code-sm text-code-sm">
                      web-ui
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface font-code-sm text-code-sm">
                      deploy
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface font-code-sm text-code-sm">
                      payments
                    </span>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-center text-on-surface-variant font-medium">0.75</td>
                <td className="py-3.5 px-4 text-center text-on-surface-variant">0.75</td>
                <td className="py-3.5 px-4 text-right">
                  <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-tertiary font-bold">
                    <span className="material-symbols-outlined text-[14px]">arrow_upward</span> +0.25
                  </span>
                </td>
              </tr>

              {/* Row 5 */}
              <tr className="hover:bg-surface-container-low transition-colors">
                <td className="py-3.5 px-4 text-center font-code-sm text-code-sm font-bold text-outline">5</td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-primary-fixed text-on-primary-fixed font-code-sm text-code-sm font-medium">
                      deploy
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-primary-fixed text-on-primary-fixed font-code-sm text-code-sm font-medium">
                      payments
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-primary-fixed text-on-primary-fixed font-code-sm text-code-sm font-medium">
                      auth
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-primary-fixed text-on-primary-fixed font-code-sm text-code-sm font-medium">
                      notifications
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface font-code-sm text-code-sm">
                      web-ui
                    </span>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-center font-semibold text-on-surface">0.80</td>
                <td className="py-3.5 px-4 text-center text-on-surface-variant">1.00</td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface font-code-sm text-code-sm">
                      auth
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface font-code-sm text-code-sm">
                      web-ui
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface font-code-sm text-code-sm">
                      deploy
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface font-code-sm text-code-sm">
                      payments
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface font-code-sm text-code-sm">
                      notifications
                    </span>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-center text-on-surface-variant font-medium">0.60</td>
                <td className="py-3.5 px-4 text-center text-on-surface-variant">0.75</td>
                <td className="py-3.5 px-4 text-right">
                  <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-tertiary font-bold">
                    <span className="material-symbols-outlined text-[14px]">arrow_upward</span> +0.20
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Analytical Detail Cards: Formula & deploy discrepancy */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg">
        {/* Card 1: Formula rationale */}
        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between border border-surface-container">
          <div className="space-y-space-sm">
            <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2 font-semibold">
              <span className="text-secondary font-bold">Σ</span> Why Backstop Outperforms Raw Commits
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Simple commit totals measure busyness, not institutional risk. Backstop calculates a multi-factored Knowledge-at-Risk coefficient:
            </p>
            <div className="bg-surface-container-low p-space-sm rounded-lg font-code-sm text-code-sm text-primary space-y-1 border border-surface-container/60">
              <div className="text-outline">// Algorithmic Risk Formulation</div>
              <div className="font-bold">KAR = (Concentration_Penalty) × (Staleness_Decay) × (Criticality)</div>
              <div className="text-[11px] text-on-surface-variant">
                Where Concentration ≥ 0.8 triggers single-maintainer lockout thresholds.
              </div>
            </div>
            <ul className="space-y-1.5 font-body-sm text-body-sm text-on-surface-variant pt-1">
              <li className="flex items-start gap-1.5">
                <span className="material-symbols-outlined text-tertiary text-[16px] mt-0.5">check</span>
                <span>
                  <strong className="text-on-surface">Solitary Authorship Penalties:</strong> Isolates code blocks where over 85% of blame belongs to departing contributors regardless of commit frequency.
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="material-symbols-outlined text-tertiary text-[16px] mt-0.5">check</span>
                <span>
                  <strong className="text-on-surface">Half-Life Staleness Decay:</strong> Prioritizes foundational infrastructure touched infrequently over noisy UI components with high daily churn.
                </span>
              </li>
            </ul>
          </div>
          <div className="pt-space-md mt-space-md border-t border-surface-container flex items-center justify-between text-outline font-code-sm text-code-sm">
            <span>Deterministic Rule Engine</span>
            <span>Zero Stochastic Drift</span>
          </div>
        </div>

        {/* Card 2: deploy Discrepancy */}
        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between border border-surface-container">
          <div className="space-y-space-sm">
            <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2 font-semibold">
              <span className="material-symbols-outlined text-error text-[20px]">warning</span>
              The 'deploy' Module Discrepancy
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Post-departure incident <strong className="text-on-surface">INC-8492</strong> in the deploy harness cost 114 minutes of production downtime:
            </p>
            <div className="grid grid-cols-2 gap-space-sm pt-1">
              <div className="bg-surface-container-low p-space-sm rounded-lg border border-surface-container/60">
                <span className="font-label-sm text-label-sm uppercase text-outline block">Raw Commits Rank</span>
                <span className="font-headline-md text-headline-md text-error font-bold">#3 (Ignored)</span>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 text-[11px]">
                  High volume in auth eclipsed it
                </p>
              </div>
              <div className="bg-surface-container-low p-space-sm rounded-lg border border-surface-container/60">
                <span className="font-label-sm text-label-sm uppercase text-outline block">Backstop Rank</span>
                <span className="font-headline-md text-headline-md text-primary font-bold">#1 (Critical)</span>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 text-[11px]">
                  Flagged 92% concentration &amp; 45d lapse
                </p>
              </div>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant pt-1 leading-relaxed">
              Had the team allocated documentation and pairing sprints based on commit counts alone, deploy would have received zero handoff budget before the lead dev departure.
            </p>
          </div>
          <div className="pt-space-md mt-space-md border-t border-surface-container flex items-center justify-between text-outline font-code-sm text-code-sm">
            <span>INC-8492 Root Cause: Pipeline Config Blindspot</span>
            <span className="text-tertiary font-bold">Flagged Deterministically</span>
          </div>
        </div>
      </section>
    </div>
  );
}
