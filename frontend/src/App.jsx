import React, { useState, useEffect } from "react";
import Navbar, { ROLES } from "./components/Navbar";
import HomePage from "./components/HomePage";
import ReviewQueuePage from "./components/ReviewQueuePage";
import HandoverPage from "./components/HandoverPage";
import BacktestPage from "./components/BacktestPage";
import { api } from "./api";

export default function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [role, setRole] = useState("incoming_dev");

  // Project and Stats states
  const [project, setProject] = useState(null);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState(null);

  // Initial load
  const loadInitialData = async () => {
    try {
      const [projData, statsData] = await Promise.all([
        api.getProject(1).catch(() => null),
        api.getClaimStats({ projectId: 1, role }).catch(() => null),
      ]);
      setProject(projData);
      setStats(statsData);
    } catch (err) {
      console.error("Initial load failed", err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [role]);

  // Handler: Full reset & re-generation
  const handleResetSample = async () => {
    setIsLoading(true);
    setActionStatus("Resetting database, ingesting sample data, and compiling verified claims...");
    try {
      const result = await api.resetSample();
      await loadInitialData();
      setActionStatus(`Sample project successfully reloaded! Derived: ${result.derived_claims}, LLM Extracted: ${result.extracted_claims}.`);
      setTimeout(() => setActionStatus(null), 5000);
    } catch (err) {
      alert("Reset failed: " + err.message);
      setActionStatus(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Handler: Re-run deterministic derivations
  const handleDerive = async () => {
    setIsLoading(true);
    setActionStatus("Executing deterministic Python derivations from git logs and tasks...");
    try {
      const result = await api.deriveClaims(1);
      await loadInitialData();
      setActionStatus(`Plain-code derivation complete! Created ${result.claims_created} verified claims.`);
      setTimeout(() => setActionStatus(null), 5000);
    } catch (err) {
      alert("Derivation failed: " + err.message);
      setActionStatus(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Handler: Re-run LLM extraction
  const handleExtract = async () => {
    setIsLoading(true);
    setActionStatus("Running LLM extraction with substring quote checks and support validation...");
    try {
      const result = await api.extractClaims(1);
      await loadInitialData();
      setActionStatus(`LLM extraction complete! Verified: ${result.verified}, Inferred: ${result.inferred}, Rejected: ${result.rejected_by_quote_check + result.rejected_by_support_check}.`);
      setTimeout(() => setActionStatus(null), 5000);
    } catch (err) {
      alert("Extraction failed: " + err.message);
      setActionStatus(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background font-body-md text-on-surface flex flex-col antialiased">
      {/* Top Navbar & Step Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        role={role}
        setRole={setRole}
        onResetSample={handleResetSample}
        isResetting={isLoading}
      />

      {/* Main Page Content */}
      <main className="w-full flex-1 pt-[104px] bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-[calc(100vh-168px)]">
          {activeTab === "home" && (
            <HomePage
              project={project}
              stats={stats}
              onResetSample={handleResetSample}
              onDerive={handleDerive}
              onExtract={handleExtract}
              setActiveTab={setActiveTab}
              isLoading={isLoading}
              actionStatus={actionStatus}
            />
          )}

          {activeTab === "review" && (
            <ReviewQueuePage
              role={role}
              stats={stats}
              onRefreshStats={loadInitialData}
            />
          )}

          {activeTab === "handover" && (
            <HandoverPage
              role={role}
              setRole={setRole}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === "backtest" && <BacktestPage />}
        </div>
      </main>

      {/* Engineering-Grade Footer */}
      <footer className="w-full bg-surface-container-lowest shadow-[0_-1px_6px_rgba(0,0,0,0.03)] py-space-md border-t border-surface-container no-print mt-auto">
        <div className="max-w-7xl mx-auto px-gutter flex flex-col sm:flex-row items-center justify-between gap-space-sm text-center sm:text-left">
          <div className="flex items-center gap-space-sm flex-wrap justify-center sm:justify-start">
            <span className="font-label-md text-label-md text-on-surface font-bold">Backstop</span>
            <span className="text-outline-variant">•</span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Deterministic Developer Handover Ledger. Dual-track verification with plain-code derivations and strict verbatim quotes.
            </span>
          </div>
          <div className="flex items-center gap-space-md shrink-0">
            <span className="font-code-sm text-code-sm text-outline">SHA256:VERIFIED_LEDGER</span>
            <span className="font-label-sm text-label-sm text-tertiary flex items-center gap-1 font-semibold">
              <span className="w-2 h-2 rounded-full bg-tertiary"></span>Operational
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
