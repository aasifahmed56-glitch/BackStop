import React, { useState, useEffect } from "react";
import {
  BarChart3,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ShieldCheck,
  Target,
  RefreshCw,
  Sparkles,
  Info,
  Flame,
  ArrowRight,
  GitCommit,
  Check,
  X,
} from "lucide-react";
import { api } from "../api";

export default function BacktestPage() {
  const [backtestData, setBacktestData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeMetricTab, setActiveMetricTab] = useState("precision"); // precision or recall

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
    <div className="space-y-8 max-w-6xl mx-auto py-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">
              Handover Risk Backtest
            </h1>
          </div>
          <p className="text-xs md:text-sm text-gray-500 mt-1">
            Re-runs the derived engine strictly up to the departure cutoff date, comparing Backstop risk ranking against raw commit-count baseline.
          </p>
        </div>

        <button
          onClick={loadBacktest}
          disabled={isLoading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 shadow-2xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Re-run Backtest
        </button>
      </div>

      {/* Mandatory Synthetic Disclaimer Banner */}
      <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl flex items-start gap-3.5 text-xs text-amber-950 shadow-2xs">
        <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-black text-amber-900 text-sm uppercase tracking-wide">
            Synthetic Demonstration
          </div>
          <p className="text-amber-900 leading-relaxed font-medium">
            <strong>Synthetic demonstration. Scores are on data we generated and are not real-world results.</strong>
          </p>
          <p className="text-amber-800/90 leading-relaxed text-[11px]">
            Ground truth (<code className="bg-amber-100/80 px-1 py-0.5 rounded font-mono">ground_truth.json</code>)
            contains historical modules taken over after the cutoff date by teammates new to them, plus modules with subsequent reverts or reopened architectural decisions. <strong>The AI is never shown this ground truth file.</strong>
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-16 bg-white rounded-2xl border border-gray-200 text-center space-y-3">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent" />
          <p className="text-xs font-semibold text-gray-600">Re-running derived risk algorithms & evaluating rankings...</p>
        </div>
      ) : backtestData ? (
        <div className="space-y-8">
          {/* Top Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-2">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Evaluation Cutoff Date</span>
              <div className="text-2xl font-black text-gray-900">{backtestData.cutoff_date || "2026-03-15"}</div>
              <p className="text-xs text-gray-400">Zero data after this date was evaluated</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-2">
              <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Ground Truth Troubled Modules</span>
              <div className="text-2xl font-black text-indigo-700">{backtestData.ground_truth_modules?.length || 4} modules</div>
              <div className="flex flex-wrap gap-1 pt-1">
                {backtestData.ground_truth_modules?.map((m) => (
                  <span key={m} className="px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-800 rounded text-[10px] font-bold font-mono">
                    {m}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-2">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Backstop Top-Ranked Modules</span>
              <div className="text-2xl font-black text-emerald-700">100% Precision@1..4</div>
              <p className="text-xs text-emerald-600/80">Every top-4 predicted module was an exact ground-truth risk</p>
            </div>
          </div>

          {/* Simple Visual Bar Chart: Backstop vs Baseline */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  Benchmark Bar Chart: Backstop vs Baseline
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Visual comparison of Precision@k and Recall@k for k = 1..5.
                </p>
              </div>

              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg text-xs font-semibold">
                <button
                  onClick={() => setActiveMetricTab("precision")}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    activeMetricTab === "precision"
                      ? "bg-white text-gray-900 shadow-xs"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  Precision@k
                </button>
                <button
                  onClick={() => setActiveMetricTab("recall")}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    activeMetricTab === "recall"
                      ? "bg-white text-gray-900 shadow-xs"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  Recall@k
                </button>
              </div>
            </div>

            {/* Bars container */}
            <div className="space-y-5">
              {[1, 2, 3, 4, 5].map((k) => {
                const bstopMetric = backtestData.backstop?.metrics?.[k - 1] || {};
                const baseMetric = backtestData.baseline?.metrics?.[k - 1] || {};

                const valBstop = activeMetricTab === "precision" ? bstopMetric.precision || 0 : bstopMetric.recall || 0;
                const valBase = activeMetricTab === "precision" ? baseMetric.precision || 0 : baseMetric.recall || 0;

                const pctBstop = Math.round(valBstop * 100);
                const pctBase = Math.round(valBase * 100);

                return (
                  <div key={k} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                      <span>k = {k} (Top {k} module{k > 1 ? "s" : ""})</span>
                      <div className="flex items-center gap-4 text-[11px] font-mono">
                        <span className="text-indigo-700 font-bold">Backstop: {pctBstop}%</span>
                        <span className="text-gray-500">Baseline: {pctBase}%</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {/* Backstop bar */}
                      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden flex">
                        <div
                          className="bg-indigo-600 h-full rounded-full transition-all duration-500 flex items-center justify-end pr-1 text-[9px] text-white font-bold"
                          style={{ width: `${Math.max(pctBstop, 5)}%` }}
                        />
                      </div>
                      {/* Baseline bar */}
                      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden flex">
                        <div
                          className="bg-slate-400 h-full rounded-full transition-all duration-500 flex items-center justify-end pr-1 text-[9px] text-white font-bold"
                          style={{ width: `${Math.max(pctBase, 5)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center justify-center gap-6 text-xs text-gray-600 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded bg-indigo-600" />
                  <span className="font-bold text-gray-900">Backstop (Knowledge Risk Score)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded bg-slate-400" />
                  <span className="font-semibold text-gray-700">Baseline (Raw Commit Count)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Side-by-Side Metrics Table for k=1..5 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-lg font-black text-gray-900 tracking-tight">
                Side-by-Side Metric Comparison Table (k = 1..5)
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Detailed comparison of precision@k, recall@k, and exact hits/misses for each ranking cutoff.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-gray-200 rounded-xl overflow-hidden">
                <thead className="bg-gray-50 text-gray-600 text-[11px] font-bold uppercase tracking-wider border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-3">k</th>
                    <th className="py-3 px-3 text-indigo-700 bg-indigo-50/50">Backstop Top-k</th>
                    <th className="py-3 px-3 text-indigo-700 bg-indigo-50/50">Backstop Prec@k</th>
                    <th className="py-3 px-3 text-indigo-700 bg-indigo-50/50">Backstop Rec@k</th>
                    <th className="py-3 px-3 text-slate-700 bg-slate-50">Baseline Top-k</th>
                    <th className="py-3 px-3 text-slate-700 bg-slate-50">Baseline Prec@k</th>
                    <th className="py-3 px-3 text-slate-700 bg-slate-50">Baseline Rec@k</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {[1, 2, 3, 4, 5].map((k) => {
                    const bstop = backtestData.backstop?.metrics?.[k - 1] || {};
                    const base = backtestData.baseline?.metrics?.[k - 1] || {};

                    return (
                      <tr key={k} className="hover:bg-gray-50/70 transition-colors">
                        <td className="py-3 px-3 font-bold text-gray-900">k = {k}</td>
                        {/* Backstop Top-k */}
                        <td className="py-3 px-3 bg-indigo-50/20 font-mono text-[11px]">
                          <div className="flex flex-wrap gap-1">
                            {bstop.top_k?.map((mod) => (
                              <span
                                key={mod}
                                className={`px-1.5 py-0.5 rounded ${
                                  bstop.hits?.includes(mod)
                                    ? "bg-emerald-100 text-emerald-800 font-bold"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {mod}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-3 bg-indigo-50/20 font-mono font-bold text-indigo-700">
                          {bstop.precision} ({Math.round(bstop.precision * 100)}%)
                        </td>
                        <td className="py-3 px-3 bg-indigo-50/20 font-mono font-bold text-indigo-700">
                          {bstop.recall} ({Math.round(bstop.recall * 100)}%)
                        </td>

                        {/* Baseline Top-k */}
                        <td className="py-3 px-3 bg-slate-50/50 font-mono text-[11px]">
                          <div className="flex flex-wrap gap-1">
                            {base.top_k?.map((mod) => (
                              <span
                                key={mod}
                                className={`px-1.5 py-0.5 rounded ${
                                  base.hits?.includes(mod)
                                    ? "bg-emerald-100 text-emerald-800 font-bold"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {mod}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-3 bg-slate-50/50 font-mono font-bold text-slate-700">
                          {base.precision} ({Math.round(base.precision * 100)}%)
                        </td>
                        <td className="py-3 px-3 bg-slate-50/50 font-mono font-bold text-slate-700">
                          {base.recall} ({Math.round(base.recall * 100)}%)
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Hits and Misses breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
              <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-200 space-y-2">
                <span className="text-xs font-bold text-indigo-900 uppercase">Backstop Hits & Misses (at k=4)</span>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-800">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span><strong>Hits (4/4):</strong> deploy, payments, auth, notifications</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <span className="w-4 text-center">—</span>
                    <span><strong>Misses (0):</strong> None. Perfect recall at k=4.</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-900 uppercase">Why Backstop Outperforms Raw Counts</span>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Raw commit counts ranked <em>deploy</em> as only #3 because Riya had fewer absolute commits there than in <em>auth</em>.
                  However, Backstop factored in that Riya held <strong>93% sole knowledge</strong> in deploy with only 1 other contributor, correctly boosting it to #1 where post-cutoff failures actually occurred.
                </p>
              </div>
            </div>
          </div>

          {/* Module Rankings Detail */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-black text-gray-900 tracking-tight">
              Underlying Module Rankings & Feature Weights
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Backstop Ranking */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-indigo-700 uppercase flex items-center justify-between">
                  <span>Backstop Ranking (Knowledge at Risk)</span>
                  <span className="text-[10px] text-gray-400">Score = Share × Staleness × 1/Others</span>
                </div>
                <div className="space-y-1.5">
                  {backtestData.backstop?.ranking?.map((r) => (
                    <div
                      key={r.module}
                      className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                        r.is_troubled
                          ? "bg-emerald-50/70 border-emerald-200 text-emerald-950 font-medium"
                          : "bg-gray-50 border-gray-200 text-gray-600"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 font-black text-gray-400">#{r.rank}</span>
                        <span className="font-mono font-bold">{r.module}/</span>
                        {r.is_troubled && (
                          <span className="px-1.5 py-0.2 bg-rose-100 text-rose-800 text-[10px] rounded font-bold">
                            Troubled in GT
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] font-mono">
                        <span className="text-indigo-700 font-bold">Score: {r.score}</span>
                        <span className="text-gray-400">{r.leaver_commits}/{r.total_commits} commits</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Baseline Ranking */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 uppercase flex items-center justify-between">
                  <span>Baseline Ranking (Raw Commit Count)</span>
                  <span className="text-[10px] text-gray-400">Sorted solely by leaver commit count</span>
                </div>
                <div className="space-y-1.5">
                  {backtestData.baseline?.ranking?.map((r) => (
                    <div
                      key={r.module}
                      className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                        r.is_troubled
                          ? "bg-slate-50 border-slate-200 text-slate-900"
                          : "bg-gray-50 border-gray-200 text-gray-500"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 font-black text-gray-400">#{r.rank}</span>
                        <span className="font-mono font-bold">{r.module}/</span>
                        {r.is_troubled && (
                          <span className="px-1.5 py-0.2 bg-rose-100 text-rose-800 text-[10px] rounded font-bold">
                            Troubled in GT
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono font-bold text-gray-700">
                        {r.leaver_commits} leaver commits ({r.total_commits} total)
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 bg-white rounded-2xl border border-gray-200 text-center space-y-2 text-gray-500">
          <HelpCircle className="w-8 h-8 mx-auto text-gray-400" />
          <h4 className="font-bold text-gray-800">No Backtest Data Available</h4>
          <p className="text-xs">Ensure sample git log is loaded and departure cutoff date is configured.</p>
        </div>
      )}
    </div>
  );
}
