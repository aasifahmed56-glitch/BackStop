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
} from "lucide-react";
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

  const getMetricCard = (title, metric, desc) => {
    if (!metric) return null;
    const f1 = metric.f1 !== undefined ? metric.f1 : metric.score !== undefined ? metric.score : 0;
    const f1Percent = Math.round(f1 * 100);

    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">{title}</span>
          <span
            className={`px-2 py-0.5 rounded text-xs font-bold ${
              f1Percent >= 80
                ? "bg-emerald-100 text-emerald-800"
                : f1Percent >= 50
                ? "bg-amber-100 text-amber-800"
                : "bg-rose-100 text-rose-800"
            }`}
          >
            F1: {f1}
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <div className="text-3xl font-black text-gray-900">{f1Percent}%</div>
          <span className="text-xs text-gray-400">match rate</span>
        </div>

        <p className="text-[11px] text-gray-500 leading-snug">{desc}</p>

        {metric.precision !== undefined && (
          <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500 font-mono">
            <span>Precision: {metric.precision}</span>
            <span>Recall: {metric.recall}</span>
          </div>
        )}

        {/* Hits & Misses */}
        {metric.hits && metric.hits.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-emerald-700 uppercase">Hits:</span>
            <div className="flex flex-wrap gap-1">
              {metric.hits.map((h, i) => (
                <span key={i} className="text-[10px] bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200">
                  {h}
                </span>
              ))}
            </div>
          </div>
        )}

        {metric.misses && metric.misses.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-rose-700 uppercase">Misses:</span>
            <div className="flex flex-wrap gap-1">
              {metric.misses.map((m, i) => (
                <span key={i} className="text-[10px] bg-rose-50 text-rose-800 px-1.5 py-0.5 rounded border border-rose-200">
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">
              Handover Backtest Benchmark
            </h1>
          </div>
          <p className="text-xs md:text-sm text-gray-500 mt-1">
            Empirical evaluation against synthetic post-departure ground truth to quantify coverage and prevent hallucinations.
          </p>
        </div>

        <button
          onClick={loadBacktest}
          disabled={isLoading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 shadow-2xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Re-score Backtest
        </button>
      </div>

      {/* Ground Truth Banner */}
      <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-start gap-3 text-xs text-indigo-950">
        <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold">Air-Gapped Ground Truth Evaluation:</span>
          <p className="text-indigo-900 leading-relaxed">
            The reference dataset (<code className="bg-indigo-100 text-indigo-950 px-1 py-0.5 rounded font-mono">backend/data/sample/ground_truth.json</code>)
            contains the true historical events after Riya's departure date. <strong>This file is never passed to any LLM</strong>; it is exclusively used here to compute mathematical precision, recall, and F1 metrics.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-16 bg-white rounded-2xl border border-gray-200 text-center space-y-3">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent" />
          <p className="text-xs font-semibold text-gray-600">Scoring handover against ground truth...</p>
        </div>
      ) : backtestData ? (
        <div className="space-y-6">
          {/* Overall Score Card */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-6 sm:p-8 shadow-md border border-indigo-900 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="space-y-2">
              <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                Benchmark Result
              </span>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                Overall Transition Readiness Score
              </h2>
              <p className="text-xs text-indigo-200 max-w-lg">
                Harmonic mean across sole-knowledge risks, critical architectural decisions, key handover contacts, and open blockers.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-xs border border-white/20 p-5 rounded-2xl text-center shrink-0 min-w-[140px]">
              <span className="text-xs font-semibold text-indigo-200 uppercase">Composite F1</span>
              <div className="text-4xl font-black text-amber-300 mt-1">
                {Math.round((backtestData.overall_f1 || 0) * 100)}%
              </div>
              <span className="text-[10px] text-indigo-200">F1: {backtestData.overall_f1}</span>
            </div>
          </div>

          {/* Detailed Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getMetricCard(
              "Sole Knowledge Modules",
              backtestData.scores?.sole_knowledge_modules,
              "Flagged modules where leaver was sole/dominant author (auth, deploy, payments)."
            )}
            {getMetricCard(
              "Key Decisions",
              backtestData.scores?.key_decisions,
              "Identified architectural commitments (e.g. JWT auth, Postgres migration)."
            )}
            {getMetricCard(
              "Critical Contacts",
              backtestData.scores?.critical_contacts,
              "Ranked team collaborators recommended for cross-functional onboarding."
            )}
            {getMetricCard(
              "Open Risks & Blockers",
              backtestData.scores?.open_risks,
              "Unresolved technical debts and payment webhook tripwires flagged."
            )}
            {getMetricCard(
              "False Positive Avoidance",
              backtestData.scores?.modules_should_not_flag,
              "Ensures well-shared modules (web-ui, docs) were not incorrectly marked sole knowledge."
            )}
          </div>
        </div>
      ) : (
        <div className="p-12 bg-white rounded-2xl border border-gray-200 text-center space-y-2 text-gray-500">
          <HelpCircle className="w-8 h-8 mx-auto text-gray-400" />
          <h4 className="font-bold text-gray-800">No Backtest Data</h4>
          <p className="text-xs">Ensure sample data is loaded and claims have been derived or approved.</p>
        </div>
      )}
    </div>
  );
}
