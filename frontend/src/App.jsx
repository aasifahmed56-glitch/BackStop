import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import HomePage from "./components/HomePage";
import ReviewQueuePage from "./components/ReviewQueuePage";
import HandoverPage from "./components/HandoverPage";
import BacktestPage from "./components/BacktestPage";
import TrustReportPage from "./components/TrustReportPage";
import { api, formatErrorMessage } from "./api";

export default function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [role, setRole] = useState("incoming_dev");

  // Project and Stats states
  const [project, setProject] = useState(null);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState(null);
  // Bumped after a reset so open pages remount and refetch instead of showing stale claims.
  const [dataVersion, setDataVersion] = useState(0);

  // Initial load
  const loadInitialData = async () => {
    try {
      const [projData, statsData] = await Promise.all([
        api.getProject(1).catch(() => null),
        api.getClaimStats({ projectId: 1, role: "lead" }).catch(() => null),
      ]);
      setProject(projData);
      setStats(statsData);
    } catch (err) {
      console.error("Initial load failed", err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Handler: Full reset & re-generation
  const reviewedCount = (stats?.by_review?.approved ?? 0) + (stats?.by_review?.corrected ?? 0) + (stats?.by_review?.rejected ?? 0);

  const handleResetSample = async () => {
    if (reviewedCount > 0) {
      const ok = window.confirm(
        `Reset the sample project? This clears ${reviewedCount} review decision${reviewedCount === 1 ? "" : "s"} (approvals, edits and rejections).`
      );
      if (!ok) return;
    }
    setIsLoading(true);
    setActionStatus({ tone: "info", text: "Resetting the sample project…" });
    try {
      const result = await api.resetSample();
      await loadInitialData();
      setDataVersion((v) => v + 1);
      const kinds = result?.claims_by_kind || {};
      const failed = result?.extract_stats?.failed_sources || [];
      setActionStatus(
        failed.length
          ? { tone: "warn", text: `Sample reset. ${failed.length} source${failed.length === 1 ? "" : "s"} could not be analysed: ${failed.map((f) => f.source).join(", ")}.` }
          : { tone: "ok", text: `Sample reset: ${kinds.total ?? 0} claims (${kinds.derived ?? 0} from code, ${kinds.interpreted ?? 0} extracted).` }
      );
      setTimeout(() => setActionStatus(null), 6000);
    } catch (err) {
      setActionStatus({ tone: "error", text: "Reset failed: " + formatErrorMessage(err) });
    } finally {
      setIsLoading(false);
    }
  };

  // The demo button never wipes review work: the sample is seeded on startup,
  // so it only resets when the project is missing.
  const handleStartDemo = async () => {
    if (!stats?.total) {
      await handleResetSample();
    }
    setActiveTab("review");
  };

  // Handler: Re-run derivations
  const handleDerive = async () => {
    setIsLoading(true);
    setActionStatus({ tone: "info", text: "Running derivations from git history and tasks…" });
    try {
      const result = await api.deriveClaims(1);
      await loadInitialData();
      setActionStatus({ tone: "ok", text: `Derivation complete: ${result.claims_created} claims from code.` });
      setTimeout(() => setActionStatus(null), 5000);
    } catch (err) {
      setActionStatus({ tone: "error", text: "Derivation failed: " + formatErrorMessage(err) });
    } finally {
      setIsLoading(false);
    }
  };

  // Handler: Re-run extraction
  const handleExtract = async () => {
    setIsLoading(true);
    setActionStatus({ tone: "info", text: "Running extraction with quote and support checks…" });
    try {
      const result = await api.extractClaims(1);
      await loadInitialData();
      const st = result?.stats || {};
      setActionStatus({ tone: (st.failed_sources || []).length ? "warn" : "ok", text: `Extraction complete: ${st.verified ?? 0} quote-matched, ${st.inferred ?? 0} inferred, ${(st.rejected_by_quote_check ?? 0) + (st.rejected_by_support_check ?? 0)} rejected${(st.failed_sources || []).length ? `, ${st.failed_sources.length} sources failed` : ""}.` });
      setTimeout(() => setActionStatus(null), 5000);
    } catch (err) {
      setActionStatus({ tone: "error", text: "Extraction failed: " + formatErrorMessage(err) });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background font-body-md text-on-surface flex flex-col antialiased">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onResetSample={handleResetSample}
        isResetting={isLoading}
      />

      {/* Main Page Content */}
      <main className="w-full flex-1 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-[calc(100vh-168px)]">
          {activeTab === "home" && (
            <HomePage
              project={project}
              stats={stats}
              onResetSample={handleResetSample}
              onStartDemo={handleStartDemo}
              onDerive={handleDerive}
              onExtract={handleExtract}
              setActiveTab={setActiveTab}
              isLoading={isLoading}
              actionStatus={actionStatus}
            />
          )}

          {activeTab === "review" && (
            <ReviewQueuePage
              key={`review-${dataVersion}`}
              role="lead"
              stats={stats}
              onRefreshStats={loadInitialData}
            />
          )}

          {activeTab === "handover" && (
            <HandoverPage
              key={`handover-${dataVersion}`}
              role={role}
              setRole={setRole}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === "backtest" && <BacktestPage onOpenTrust={() => setActiveTab("trust")} />}
          {activeTab === "trust" && <TrustReportPage />}
        </div>
      </main>

      {/* Global action feedback, visible on every page */}
      {actionStatus && (
        <div
          role={actionStatus.tone === "error" ? "alert" : "status"}
          aria-live="polite"
          className={`no-print fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-2rem)] sm:max-w-xl flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border font-body-sm text-body-sm ${
            actionStatus.tone === "error"
              ? "bg-error-container text-on-error-container border-error/30"
              : actionStatus.tone === "warn"
              ? "bg-surface-container-highest text-on-surface border-outline-variant"
              : "bg-inverse-surface text-inverse-on-surface border-transparent"
          }`}
        >
          <span className="flex-1">{actionStatus.text}</span>
          <button
            type="button"
            onClick={() => setActionStatus(null)}
            className="shrink-0 font-label-md text-label-md underline underline-offset-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Application Footer */}
      <footer className="w-full bg-surface-container-lowest shadow-[0_-1px_6px_rgba(0,0,0,0.03)] py-space-md border-t border-surface-container no-print mt-auto">
        <div className="max-w-7xl mx-auto px-gutter flex flex-col sm:flex-row items-center justify-between gap-space-sm text-center sm:text-left">
          <div className="flex items-center gap-space-sm flex-wrap justify-center sm:justify-start">
            <span className="font-label-md text-label-md text-on-surface font-bold">Backstop</span>
            <span className="text-outline-variant">•</span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Developer Handover Assistant. Automated checks find the evidence; a person approves every claim.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
