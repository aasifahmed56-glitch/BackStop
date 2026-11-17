import React, { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import Navbar, { NAV_ITEMS } from "./components/Navbar";
import HomePage from "./components/HomePage";
import ReviewQueuePage from "./components/ReviewQueuePage";
import HandoverPage from "./components/HandoverPage";
import BacktestPage from "./components/BacktestPage";
import TrustReportPage from "./components/TrustReportPage";
import { Button, Dialog } from "./components/ui";
import { api, formatErrorMessage } from "./api";

const TABS = NAV_ITEMS.map((n) => n.id);
const LEGACY = { home: "overview" };

// Route lives in the hash so refresh, back/forward and shared links all land on the same screen.
function parseHash() {
  const raw = (window.location.hash || "").replace(/^#\/?/, "");
  const [first, second] = raw.split("/");
  const tab = TABS.includes(LEGACY[first] || first) ? LEGACY[first] || first : "overview";
  const claimId = tab === "review" && /^\d+$/.test(second || "") ? Number(second) : null;
  return { tab, claimId };
}

const ROLE_KEY = "backstop.role";
const readRole = () => {
  try {
    const r = window.localStorage.getItem(ROLE_KEY);
    return ["incoming_dev", "incoming_pm", "lead"].includes(r) ? r : "incoming_dev";
  } catch {
    return "incoming_dev";
  }
};

export default function App() {
  const [route, setRoute] = useState(parseHash);
  const activeTab = route.tab;
  const [role, setRoleState] = useState(readRole);

  const [project, setProject] = useState(null);
  const [stats, setStats] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  // Bumped after a reset so open pages remount and refetch instead of showing stale claims.
  const [dataVersion, setDataVersion] = useState(0);

  const setRole = (r) => {
    setRoleState(r);
    try {
      window.localStorage.setItem(ROLE_KEY, r);
    } catch {
      /* storage blocked: role still works for this visit */
    }
  };

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = useCallback((tab, claimId) => {
    const next = `#/${tab}${claimId ? `/${claimId}` : ""}`;
    if (window.location.hash !== next) window.location.hash = next;
    else setRoute(parseHash());
    if (!claimId) window.scrollTo({ top: 0 });
  }, []);

  // Selecting a claim updates the address without adding a history entry per click.
  const replaceClaimInHash = useCallback((claimId) => {
    const next = `#/review${claimId ? `/${claimId}` : ""}`;
    if (window.location.hash !== next) window.history.replaceState(null, "", next);
  }, []);

  const flash = useCallback((status, ms = 5000) => {
    setActionStatus(status);
    if (ms) setTimeout(() => setActionStatus((cur) => (cur === status ? null : cur)), ms);
  }, []);

  const loadInitialData = useCallback(async () => {
    const [projRes, statsRes] = await Promise.allSettled([
      api.getProject(1),
      api.getClaimStats({ projectId: 1, role: "lead" }),
    ]);
    setProject(projRes.status === "fulfilled" ? projRes.value : null);
    setStats(statsRes.status === "fulfilled" ? statsRes.value : null);
    setLoadError(
      projRes.status === "rejected" && statsRes.status === "rejected"
        ? formatErrorMessage(statsRes.reason)
        : null
    );
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Keyboard: number keys switch steps, ? opens the shortcut sheet. Ignored while typing.
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (document.querySelector("dialog[open]")) return;
      if (e.key === "?") {
        e.preventDefault();
        setShowShortcuts(true);
      } else if (/^[1-9]$/.test(e.key) && Number(e.key) <= TABS.length) {
        navigate(TABS[Number(e.key) - 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  const reviewedCount =
    (stats?.by_review?.approved ?? 0) + (stats?.by_review?.corrected ?? 0) + (stats?.by_review?.rejected ?? 0);

  const doReset = async () => {
    setConfirmReset(false);
    if (isLoading) return;
    setIsLoading(true);
    setActionStatus({ tone: "info", text: "Reloading the sample project…" });
    try {
      const result = await api.resetSample();
      await loadInitialData();
      setDataVersion((v) => v + 1);
      const kinds = result?.claims_by_kind || {};
      const failed = result?.extract_stats?.failed_sources || [];
      flash(
        failed.length
          ? { tone: "warn", text: `Sample reloaded. ${failed.length} source${failed.length === 1 ? "" : "s"} could not be analysed: ${failed.map((f) => f.source).join(", ")}.` }
          : { tone: "ok", text: `Sample reloaded: ${kinds.total ?? 0} claims (${kinds.derived ?? 0} from code, ${kinds.interpreted ?? 0} extracted).` },
        6000
      );
    } catch (err) {
      setActionStatus({ tone: "error", text: "Reset failed: " + formatErrorMessage(err) });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSample = () => {
    if (isLoading) return;
    if (reviewedCount > 0) setConfirmReset(true);
    else doReset();
  };

  // The demo button never wipes review work: the sample is seeded on startup,
  // so it only resets when the project is missing.
  const handleStartDemo = async () => {
    if (!stats?.total) await doReset();
    navigate("review");
  };

  const handleDerive = async () => {
    setIsLoading(true);
    setActionStatus({ tone: "info", text: "Running derivations from git history and tasks…" });
    try {
      const result = await api.deriveClaims(1);
      await loadInitialData();
      setDataVersion((v) => v + 1);
      flash({ tone: "ok", text: `Derivation complete: ${result?.claims_created ?? 0} claims from code.` });
    } catch (err) {
      setActionStatus({ tone: "error", text: "Derivation failed: " + formatErrorMessage(err) });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExtract = async () => {
    setIsLoading(true);
    setActionStatus({ tone: "info", text: "Running extraction with quote and support checks…" });
    try {
      const result = await api.extractClaims(1);
      await loadInitialData();
      setDataVersion((v) => v + 1);
      const st = result?.stats || {};
      const failed = st.failed_sources || [];
      flash({
        tone: failed.length ? "warn" : "ok",
        text: `Extraction complete: ${st.verified ?? 0} quote-matched, ${st.inferred ?? 0} inferred, ${(st.rejected_by_quote_check ?? 0) + (st.rejected_by_support_check ?? 0)} rejected${failed.length ? `, ${failed.length} sources failed` : ""}.`,
      });
    } catch (err) {
      setActionStatus({ tone: "error", text: "Extraction failed: " + formatErrorMessage(err) });
    } finally {
      setIsLoading(false);
    }
  };

  const progress = stats ? { done: reviewedCount, total: stats.total ?? 0 } : null;

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col antialiased">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:bg-canary focus:text-on-canary focus:font-semibold">
        Skip to content
      </a>
      <Navbar
        activeTab={activeTab}
        onNavigate={navigate}
        onResetSample={handleResetSample}
        isResetting={isLoading}
        project={project}
        progress={progress}
        onShowShortcuts={() => setShowShortcuts(true)}
      />

      <main id="main" className="w-full flex-1">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {loadError && (
            <div role="alert" className="mb-6 panel border-error/40 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[14px]">
                <strong>The server did not answer.</strong>{" "}
                <span className="text-on-surface-variant">It may be waking up; this can take up to a minute on the free host. ({loadError})</span>
              </p>
              <Button size="sm" onClick={loadInitialData}>Try again</Button>
            </div>
          )}

          {activeTab === "overview" && (
            <HomePage
              project={project}
              stats={stats}
              onResetSample={handleResetSample}
              onStartDemo={handleStartDemo}
              onDerive={handleDerive}
              onExtract={handleExtract}
              setActiveTab={navigate}
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
              initialClaimId={route.claimId}
              onSelectClaimId={replaceClaimInHash}
              setActiveTab={navigate}
            />
          )}

          {activeTab === "handover" && (
            <HandoverPage key={`handover-${dataVersion}`} role={role} setRole={setRole} setActiveTab={navigate} />
          )}

          {activeTab === "backtest" && <BacktestPage onOpenTrust={() => navigate("trust")} />}
          {activeTab === "trust" && <TrustReportPage />}
        </div>
      </main>

      {actionStatus && (
        <div
          role={actionStatus.tone === "error" ? "alert" : "status"}
          aria-live="polite"
          className={`rise-in no-print fixed bottom-4 right-4 left-4 sm:left-auto z-50 sm:max-w-md flex items-start gap-3 pl-4 pr-2 py-3 rounded-[4px] border shadow-[0_12px_32px_-12px_rgb(14_47_54/0.5)] text-[14px] leading-5 ${
            actionStatus.tone === "error"
              ? "bg-error-container text-on-error-container border-error/40"
              : actionStatus.tone === "warn"
              ? "bg-goldenrod-container text-on-goldenrod border-goldenrod/40"
              : "bg-ink text-on-ink border-ink"
          }`}
        >
          <span className="flex-1 pt-0.5">{actionStatus.text}</span>
          <button type="button" onClick={() => setActionStatus(null)} aria-label="Dismiss" className="p-1 rounded-[2px] opacity-75 hover:opacity-100 cursor-pointer">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reload the sample project?"
        description={`This clears ${reviewedCount} review decision${reviewedCount === 1 ? "" : "s"} (approvals, corrections and rejections). It cannot be undone.`}
        footer={
          <>
            <Button onClick={() => setConfirmReset(false)}>Keep my work</Button>
            <Button variant="danger" onClick={doReset}>Reload and clear</Button>
          </>
        }
      >
        <p className="text-[14px] text-on-surface-variant">The 99 sample claims are rebuilt from the five synthetic sources.</p>
      </Dialog>

      <Dialog open={showShortcuts} onClose={() => setShowShortcuts(false)} title="Keyboard shortcuts" width="max-w-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-[14px]">
          {[
            ["1 – 4", "Go to a step"],
            ["J / K", "Next / previous claim"],
            ["A", "Approve the open claim"],
            ["E", "Correct the open claim"],
            ["R", "Reject the open claim"],
            ["/", "Search claims"],
            ["?", "Show this sheet"],
          ].map(([k, v]) => (
            <React.Fragment key={k}>
              <dt><span className="kbd">{k}</span></dt>
              <dd className="text-on-surface-variant">{v}</dd>
            </React.Fragment>
          ))}
        </dl>
      </Dialog>

      <footer className="no-print mt-auto bg-ink text-on-ink-muted">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row gap-2 sm:items-center justify-between text-[13px]">
          <p>
            <span className="font-bold text-on-ink">Backstop</span> · Automated checks find the evidence. A person approves every claim.
          </p>
          <p>Synthetic sample data. Roles are simulated; there is no sign-in.</p>
        </div>
      </footer>
    </div>
  );
}
