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
    <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30] flex flex-col antialiased">
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
      </main>

      {/* Engineering-Grade Footer */}
      <footer className="border-t border-[#e2e8f0] bg-white py-4 text-xs text-[#737686] no-print mt-auto shadow-[0_-1px_4px_rgba(11,28,48,0.02)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
            <span className="font-bold text-[#0b1c30]">Backstop</span>
            <span className="text-[#c3c6d7]">•</span>
            <span>Deterministic Developer Handover Ledger</span>
            <span className="text-[#c3c6d7]">•</span>
            <span>Source-cited Claims · Plain-Code Derivations · Pre-LLM Masking</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] text-[#737686]">SHA256:VERIFIED_LEDGER</span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#006243] text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#007d57]"></span>
              Operational
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
