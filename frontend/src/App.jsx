import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import StepBar from "./components/StepBar";
import HomePage from "./components/HomePage";
import ReviewQueuePage from "./components/ReviewQueuePage";
import HandoverPage from "./components/HandoverPage";
import BacktestPage from "./components/BacktestPage";
import { api } from "./api";

export default function App() {
  const [activeTab, setActiveTab] = useState("home");
  // role is now only used by HandoverPage (via its own inline selector) and stats
  const [role, setRole] = useState("lead");

  const [project, setProject]       = useState(null);
  const [stats, setStats]           = useState(null);
  const [isLoading, setIsLoading]   = useState(false);
  const [actionStatus, setActionStatus] = useState(null);

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

  useEffect(() => { loadInitialData(); }, []);

  const handleResetSample = async () => {
    setIsLoading(true);
    setActionStatus("Loading sample data, running checks…");
    try {
      const result = await api.resetSample();
      await loadInitialData();
      setActionStatus(
        `Ready! ${result.derived_claims} derived + ${result.extracted_claims} extracted claims.`
      );
      setTimeout(() => setActionStatus(null), 5000);
    } catch (err) {
      alert("Reset failed: " + err.message);
      setActionStatus(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDerive = async () => {
    setIsLoading(true);
    setActionStatus("Running plain-code derivation…");
    try {
      const result = await api.deriveClaims(1);
      await loadInitialData();
      setActionStatus(`Derivation complete — ${result.claims_created} claims.`);
      setTimeout(() => setActionStatus(null), 4000);
    } catch (err) {
      alert("Derivation failed: " + err.message);
      setActionStatus(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExtract = async () => {
    setIsLoading(true);
    setActionStatus("Running LLM extraction…");
    try {
      const result = await api.extractClaims(1);
      await loadInitialData();
      setActionStatus(`Extraction complete — verified: ${result.verified}, inferred: ${result.inferred}.`);
      setTimeout(() => setActionStatus(null), 4000);
    } catch (err) {
      alert("Extraction failed: " + err.message);
      setActionStatus(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 font-sans flex flex-col antialiased">
      {/* Top bar — logo + reload, NO role dropdown */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onResetSample={handleResetSample}
        isResetting={isLoading}
      />

      {/* 4-step guide bar */}
      <StepBar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Page content */}
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
            stats={stats}
            onRefreshStats={loadInitialData}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === "handover" && (
          <HandoverPage
            role={role}
            setRole={setRole}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === "backtest" && <BacktestPage setActiveTab={setActiveTab} />}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-5 no-print">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
          <span>Backstop · Hackathon Handover Ledger</span>
          <span>Source-cited claims · plain-code derivations · pre-LLM masking</span>
        </div>
      </footer>
    </div>
  );
}
