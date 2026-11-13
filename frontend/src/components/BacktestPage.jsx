import React, { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
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
  Radar,
  FileCheck2,
} from "lucide-react";
import { api } from "../api";

function HelpPanel({ children }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="border border-[#e2e8f0] rounded-xl bg-white overflow-hidden shadow-2xs">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-[#434655] hover:text-[#0b1c30] hover:bg-[#f8f9ff] transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-1.5 font-bold text-[#004ac6]">
          <HelpCircle className="w-3.5 h-3.5 text-[#004ac6]" />
          What am I looking at? (Backtest Methodology)
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-[#737686]" /> : <ChevronDown className="w-4 h-4 text-[#737686]" />}
      </button>
      {open && (
        <div className="px-4 pb-4 text-xs text-[#434655] leading-relaxed border-t border-[#f1f5f9] pt-3 bg-[#f8f9ff]">
          {children}
        </div>
      )}
    </div>
  );
}

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
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-[#dbe1ff] text-[#00174b] font-mono text-[10px] font-bold uppercase tracking-wider">
              Empirical Validation
            </span>
            <span className="text-xs text-[#737686]">Step 4 of 4</span>
          </div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[#004ac6]" />
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#0b1c30] tracking-tight">
              Did it work? (Empirical Backtest Benchmark)
            </h1>
          </div>
          <p className="text-xs md:text-sm text-[#434655] mt-1">
            Backstop's risk rankings vs. raw commit counts — measured against post-departure ground truth.
          </p>
        </div>

        <button
          onClick={loadBacktest}
          disabled={isLoading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold bg-white hover:bg-[#f8f9ff] text-[#0b1c30] border border-[#e2e8f0] shadow-2xs transition-colors cursor-pointer self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#004ac6] ${isLoading ? "animate-spin" : ""}`} />
          Re-run Backtest
        </button>
      </div>

      {/* Mandatory Synthetic Disclaimer Banner */}
      <div className="p-4 bg-[#eff4ff] border border-[#dce9ff] rounded-xl flex items-start gap-3.5 text-xs text-[#0b1c30] shadow-2xs">
        <Info className="w-5 h-5 text-[#004ac6] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold text-[#004ac6] text-xs uppercase tracking-wider font-mono">
            Synthetic Demonstration
          </div>
          <p className="text-[#0b1c30] leading-relaxed font-semibold">
            Synthetic demonstration. Scores are on data we generated and are not real-world results.
          </p>
          <p className="text-[#434655] leading-relaxed text-[11px]">
            Ground truth (<code className="bg-white px-1 py-0.5 rounded border border-[#dce9ff] font-mono text-[#004ac6]">ground_truth.json</code>)
            contains historical modules taken over after the cutoff date by teammates new to them, plus modules with subsequent reverts or reopened architectural decisions. <strong>The AI is never shown this ground truth file.</strong>
          </p>
        </div>
      </div>

      <HelpPanel>
        <p>
          Backstop re-runs its risk-scoring engine using only data before the departure date, then compares ranked modules
          to a hidden ground_truth.json the AI never sees. <strong>Precision@k</strong> = what fraction of top-k predictions were real problems.
          <strong>Recall@k</strong> = what fraction of all real problems were caught in the top k.
        </p>
        <p className="mt-2 text-[#737686]">
          This is a tiny synthetic dataset of 7 modules; 4 of 7 are positives. High recall is expected by chance. Results are a demonstration only.
        </p>
      </HelpPanel>

      {isLoading ? (
        <div className="p-16 bg-white rounded-xl border border-[#e2e8f0] text-center space-y-3">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-[#004ac6] border-t-transparent" />
          <p className="text-xs font-semibold text-[#434655]">Re-running derived risk algorithms &amp; evaluating rankings...</p>
        </div>
      ) : backtestData ? (
        <div className="space-y-6">
          {/* Top Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-[#e2e8f0] shadow-2xs space-y-2">
              <span className="text-[11px] font-bold text-[#737686] uppercase tracking-wider font-mono">Evaluation Cutoff Date</span>
              <div className="text-2xl font-black text-[#0b1c30] font-mono">{backtestData.cutoff_date || "2026-03-15"}</div>
              <p className="text-xs text-[#737686] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#059669]"></span>
                Zero data after this date was evaluated
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-[#e2e8f0] shadow-2xs space-y-2">
              <span className="text-[11px] font-bold text-[#004ac6] uppercase tracking-wider font-mono">Ground Truth Troubled Modules</span>
              <div className="text-2xl font-black text-[#004ac6]">{backtestData.ground_truth_modules?.length || 4} modules</div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {backtestData.ground_truth_modules?.map((m) => (
                  <span key={m} className="px-2 py-0.5 bg-[#fef2f2] border border-[#fecaca] text-[#dc2626] rounded text-[10px] font-bold font-mono">
                    {m}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-[#e2e8f0] shadow-2xs space-y-2">
              <span className="text-[11px] font-bold text-[#059669] uppercase tracking-wider font-mono">Backstop Top-Ranked Modules</span>
              <div className="text-2xl font-black text-[#059669]">
                {backtestData.backstop?.metrics?.["precision@4"] === backtestData.baseline?.metrics?.["precision@4"]
                  ? "Equal P@4 with baseline"
                  : backtestData.backstop?.metrics?.["precision@4"] != null
                  ? `P@4: ${(backtestData.backstop.metrics["precision@4"] * 100).toFixed(0)}%`
                  : "See table →"}
              </div>
              <p className="text-xs text-[#059669]/90">Same hits at k=1..4; Backstop ranks deploy first, baseline ranks it third</p>
            </div>
          </div>

          {/* Simple Visual Bar Chart: Backstop vs Baseline */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#f1f5f9] pb-4">
              <div>
                <h3 className="text-lg font-bold text-[#0b1c30] tracking-tight flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-[#004ac6]" />
                  Benchmark Bar Chart: Backstop vs Baseline
                </h3>
                <p className="text-xs text-[#737686] mt-0.5">
                  Visual comparison of Precision@k and Recall@k for k = 1..5.
                </p>
              </div>

              <div className="flex items-center gap-1 bg-[#f1f5f9] p-1 rounded-lg text-xs font-semibold">
                <button
                  onClick={() => setActiveMetricTab("precision")}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    activeMetricTab === "precision"
                      ? "bg-white text-[#004ac6] font-bold shadow-2xs border border-[#cbd5e1]/60"
                      : "text-[#737686] hover:text-[#0b1c30]"
                  }`}
                >
                  Precision@k
                </button>
                <button
                  onClick={() => setActiveMetricTab("recall")}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    activeMetricTab === "recall"
                      ? "bg-white text-[#004ac6] font-bold shadow-2xs border border-[#cbd5e1]/60"
                      : "text-[#737686] hover:text-[#0b1c30]"
                  }`}
                >
                  Recall@k
                </button>
              </div>
            </div>

            {/* Bars container */}
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((k) => {
                const bstopMetric = backtestData.backstop?.metrics?.[k - 1] || {};
                const baseMetric = backtestData.baseline?.metrics?.[k - 1] || {};

                const valBstop = activeMetricTab === "precision" ? bstopMetric.precision || 0 : bstopMetric.recall || 0;
                const valBase = activeMetricTab === "precision" ? baseMetric.precision || 0 : baseMetric.recall || 0;

                const pctBstop = Math.round(valBstop * 100);
                const pctBase = Math.round(valBase * 100);

                return (
                  <div key={k} className="p-3.5 rounded-lg bg-[#f8f9ff] border border-[#e2e8f0]/80 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-[#0b1c30]">
                      <span className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded bg-white border border-[#e2e8f0] flex items-center justify-center font-mono text-[11px] font-bold text-[#0b1c30] shadow-2xs">
                          k={k}
                        </span>
                        <span>Top {k} module{k > 1 ? "s" : ""}</span>
                      </span>
                      <div className="flex items-center gap-4 text-xs font-mono">
                        <span className="text-[#004ac6] font-bold">Backstop: {pctBstop}%</span>
                        <span className="text-[#64748b]">Baseline: {pctBase}%</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      {/* Backstop bar */}
                      <div className="w-full bg-[#e2e8f0] rounded-full h-2.5 overflow-hidden flex">
                        <div
                          className="bg-[#004ac6] h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(pctBstop, 5)}%` }}
                        />
                      </div>
                      {/* Baseline bar */}
                      <div className="w-full bg-[#e2e8f0] rounded-full h-2.5 overflow-hidden flex">
                        <div
                          className="bg-[#94a3b8] h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(pctBase, 5)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center justify-center gap-6 text-xs text-[#434655] pt-3 border-t border-[#f1f5f9]">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded bg-[#004ac6]" />
                  <span className="font-bold text-[#0b1c30]">Backstop (Knowledge Risk Score)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded bg-[#94a3b8]" />
                  <span className="font-semibold text-[#64748b]">Baseline (Raw Commit Count)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Side-by-Side Metrics Table for k=1..5 */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-lg font-bold text-[#0b1c30] tracking-tight">
                Side-by-Side Metric Comparison Table (k = 1..5)
              </h3>
              <p className="text-xs text-[#737686] mt-0.5">
                Detailed comparison of precision@k, recall@k, and exact hits/misses for each ranking cutoff.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-[#e2e8f0] rounded-lg overflow-hidden">
                <thead className="bg-[#f8f9ff] text-[#475569] text-[10px] font-bold uppercase tracking-wider border-b border-[#e2e8f0]">
                  <tr>
                    <th className="py-3 px-3">k</th>
                    <th className="py-3 px-3 text-[#004ac6] bg-[#eff4ff]/50">Backstop Top-k</th>
                    <th className="py-3 px-3 text-[#004ac6] bg-[#eff4ff]/50">Backstop Prec@k</th>
                    <th className="py-3 px-3 text-[#004ac6] bg-[#eff4ff]/50">Backstop Rec@k</th>
                    <th className="py-3 px-3 text-[#475569] bg-[#f8fafc]">Baseline Top-k</th>
                    <th className="py-3 px-3 text-[#475569] bg-[#f8fafc]">Baseline Prec@k</th>
                    <th className="py-3 px-3 text-[#475569] bg-[#f8fafc]">Baseline Rec@k</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {[1, 2, 3, 4, 5].map((k) => {
                    const bstop = backtestData.backstop?.metrics?.[k - 1] || {};
                    const base = backtestData.baseline?.metrics?.[k - 1] || {};

                    return (
                      <tr key={k} className="hover:bg-[#f8f9ff]/70 transition-colors">
                        <td className="py-3 px-3 font-bold font-mono text-[#0b1c30]">k = {k}</td>
                        {/* Backstop Top-k */}
                        <td className="py-3 px-3 bg-[#eff4ff]/20 font-mono text-[11px]">
                          <div className="flex flex-wrap gap-1">
                            {bstop.top_k?.map((mod) => (
                              <span
                                key={mod}
                                className={`px-1.5 py-0.5 rounded ${
                                  bstop.hits?.includes(mod)
                                    ? "bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0] font-bold"
                                    : "bg-[#f1f5f9] text-[#64748b]"
                                }`}
                              >
                                {mod}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-3 bg-[#eff4ff]/20 font-mono font-bold text-[#004ac6]">
                          {bstop.precision} ({Math.round(bstop.precision * 100)}%)
                        </td>
                        <td className="py-3 px-3 bg-[#eff4ff]/20 font-mono font-bold text-[#004ac6]">
                          {bstop.recall} ({Math.round(bstop.recall * 100)}%)
                        </td>

                        {/* Baseline Top-k */}
                        <td className="py-3 px-3 bg-[#f8fafc]/50 font-mono text-[11px]">
                          <div className="flex flex-wrap gap-1">
                            {base.top_k?.map((mod) => (
                              <span
                                key={mod}
                                className={`px-1.5 py-0.5 rounded ${
                                  base.hits?.includes(mod)
                                    ? "bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0] font-bold"
                                    : "bg-[#f1f5f9] text-[#64748b]"
                                }`}
                              >
                                {mod}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-3 bg-[#f8fafc]/50 font-mono font-bold text-[#475569]">
                          {base.precision} ({Math.round(base.precision * 100)}%)
                        </td>
                        <td className="py-3 px-3 bg-[#f8fafc]/50 font-mono font-bold text-[#475569]">
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
              <div className="p-4 bg-[#eff4ff]/50 rounded-xl border border-[#dce9ff] space-y-2">
                <span className="text-xs font-bold text-[#004ac6] uppercase font-mono">Backstop Hits &amp; Misses (at k=4)</span>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 text-[#065f46]">
                    <Check className="w-4 h-4 text-[#059669] shrink-0" />
                    <span><strong>Hits (4/4):</strong> deploy, payments, auth, notifications</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#737686]">
                    <span className="w-4 text-center">—</span>
                    <span><strong>Misses (0):</strong> None. Perfect recall at k=4.</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-[#f8f9ff] rounded-xl border border-[#e2e8f0] space-y-2">
                <span className="text-xs font-bold text-[#0b1c30] uppercase font-mono">What the Rankings Show</span>
                <p className="text-xs text-[#434655] leading-relaxed">
                  Same hits at k=1..4; Backstop ranks <em>deploy</em> first, baseline ranks it third.
                  Both reach 100% recall at k=4. The score formula (leaver share × staleness × 1/others)
                  shifts ordering but does not change the total number of hits on this dataset.
                </p>
              </div>
            </div>
          </div>

          {/* Limitations Note */}
          <div className="p-4 bg-[#fffbeb] rounded-xl border border-[#fde68a] flex gap-3 items-start">
            <span className="text-[#d97706] mt-0.5 shrink-0">⚠️</span>
            <p className="text-xs text-[#92400e] leading-relaxed">
              <strong>Limitations:</strong> Tiny synthetic dataset of 7 modules; 4 of 7 (57%) are positives, so high recall is expected by chance.
              These results are a <strong>demonstration only</strong> and do not reflect real-world performance.
              If Backstop and the baseline produce equal precision/recall at a given k, that is noted plainly above.
            </p>
          </div>

          {/* Module Rankings Detail */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-xs space-y-4">
            <h3 className="text-lg font-bold text-[#0b1c30] tracking-tight">
              Underlying Module Rankings &amp; Feature Weights
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Backstop Ranking */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-[#004ac6] uppercase flex items-center justify-between font-mono">
                  <span>Backstop Ranking (Knowledge at Risk)</span>
                  <span className="text-[10px] text-[#737686]">Score = Share × Staleness × 1/Others</span>
                </div>
                <div className="space-y-1.5">
                  {backtestData.backstop?.ranking?.map((r) => (
                    <div
                      key={r.module}
                      className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                        r.is_troubled
                          ? "bg-[#ecfdf5]/70 border-[#a7f3d0] text-[#065f46] font-medium"
                          : "bg-[#f8f9ff] border-[#e2e8f0] text-[#475569]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 font-bold font-mono text-[#737686]">#{r.rank}</span>
                        <span className="font-mono font-bold text-[#0b1c30]">{r.module}/</span>
                        {r.is_troubled && (
                          <span className="px-1.5 py-0.2 bg-[#fef2f2] text-[#dc2626] border border-[#fecaca] text-[10px] rounded font-bold">
                            Troubled in GT
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] font-mono">
                        <span className="text-[#004ac6] font-bold">Score: {r.score}</span>
                        <span className="text-[#737686]">{r.leaver_commits}/{r.total_commits} commits</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Baseline Ranking */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-[#475569] uppercase flex items-center justify-between font-mono">
                  <span>Baseline Ranking (Raw Commit Count)</span>
                  <span className="text-[10px] text-[#737686]">Sorted solely by leaver commit count</span>
                </div>
                <div className="space-y-1.5">
                  {backtestData.baseline?.ranking?.map((r) => (
                    <div
                      key={r.module}
                      className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                        r.is_troubled
                          ? "bg-[#f8fafc] border-[#e2e8f0] text-[#0b1c30]"
                          : "bg-[#f8f9ff] border-[#e2e8f0] text-[#737686]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 font-bold font-mono text-[#737686]">#{r.rank}</span>
                        <span className="font-mono font-bold text-[#0b1c30]">{r.module}/</span>
                        {r.is_troubled && (
                          <span className="px-1.5 py-0.2 bg-[#fef2f2] text-[#dc2626] border border-[#fecaca] text-[10px] rounded font-bold">
                            Troubled in GT
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono font-bold text-[#475569]">
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
        <div className="p-12 bg-white rounded-xl border border-[#e2e8f0] text-center space-y-2 text-[#737686]">
          <HelpCircle className="w-8 h-8 mx-auto text-[#cbd5e1]" />
          <h4 className="font-bold text-[#0b1c30]">No Backtest Data Available</h4>
          <p className="text-xs">Ensure sample git log is loaded and departure cutoff date is configured.</p>
        </div>
      )}
    </div>
  );
}
