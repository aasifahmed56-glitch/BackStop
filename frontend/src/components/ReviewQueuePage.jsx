import React, { useState, useEffect } from "react";
import { api, formatErrorMessage } from "../api";

const humanizeType = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, ' ') : '');


const STATUS_HELP = {
  verified: "Quote matched: the quote exists word for word in the source, and the claim is supported by it (or was calculated by code).",
  inferred: "Inferred: the quote exists, but it only partly supports the claim, or the support check could not run. Read it before approving.",
  conflicting: "Conflicting: two sources disagree. Decide which one is current before approving.",
  missing: "Missing evidence: the records do not say who owns this or why it was decided. Ask the person leaving.",
};

const STATUS_STYLE = {
  verified: { label: "Quote matched", icon: "check_circle", chip: "bg-tertiary-fixed text-on-tertiary-fixed" },
  inferred: { label: "Inferred", icon: "help", chip: "bg-surface-container-high text-on-surface" },
  conflicting: { label: "Conflicting", icon: "error", chip: "bg-error-container text-on-error-container" },
  missing: { label: "Missing evidence", icon: "report", chip: "bg-surface-container-highest text-on-surface-variant" },
};

const isSeeded = (claim) => (claim?.evidence || []).some((ev) => ev.origin === "seeded");

const kindLabel = (claim) => {
  if (isSeeded(claim)) return "Seeded fixture";
  return claim.kind === "derived" ? "Derived" : "Interpreted";
};

const kindHelp = (claim) => {
  if (isSeeded(claim)) return "Hand-written demo claim for the synthetic sample. Its quote is checked, but no AI produced it.";
  if (claim.kind === "derived") return "Calculated by plain code from git history, tasks or notes. No AI involved.";
  return "Extracted by an AI model, then checked: the quote must exist in the source and support the claim.";
};

export default function ReviewQueuePage({ role, stats, onRefreshStats }) {
  const [claims, setClaims] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Selected claim for detail panel
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [claimContext, setClaimContext] = useState(null);
  const [claimVersions, setClaimVersions] = useState([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // Modals / Action States
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editText, setEditText] = useState("");
  const [editNote, setEditNote] = useState("");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [copiedQuote, setCopiedQuote] = useState(false);

  const [isBulkApproving, setIsBulkApproving] = useState(false);

  // Load claims
  const loadClaims = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getClaims({
        projectId: 1,
        role: "lead",
        status: statusFilter,
        type: typeFilter,
      });
      setClaims(data || []);
      if (data && data.length > 0 && !selectedClaim) {
        selectClaim(data[0]);
      } else if (selectedClaim) {
        const updated = data.find((c) => c.id === selectedClaim.id);
        if (updated) setSelectedClaim(updated);
      }
    } catch (err) {
      setError(err.message || "Failed to load claims");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!rejectModalOpen && !editModalOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setRejectModalOpen(false);
        setEditModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rejectModalOpen, editModalOpen]);

  useEffect(() => {
    loadClaims();
  }, [statusFilter, typeFilter]);

  // Load context and versions when a claim is selected
  const selectClaim = async (claim, { reveal = false } = {}) => {
    setSelectedClaim(claim);
    // On narrow screens the detail panel sits below the list: bring it into view.
    if (reveal && window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() =>
        document.getElementById("inspect-claim-header")?.scrollIntoView({ behavior: "smooth", block: "start" })
      );
    }
    setClaimContext(null);
    setClaimVersions([]);
    if (claim.withheld) return;

    setIsDetailLoading(true);
    try {
      const [ctx, vers] = await Promise.all([
        api.getClaimContext(claim.id).catch(() => null),
        api.getClaimVersions(claim.id).catch(() => null),
      ]);
      setClaimContext(ctx);
      setClaimVersions(vers?.versions || []);
    } catch (err) {
      console.error("Failed to load claim detail context", err);
    } finally {
      setIsDetailLoading(false);
    }
  };

  // Actions: Approve
  const handleApprove = async () => {
    if (!selectedClaim) return;
    setIsSubmittingAction(true);
    try {
      let note = "Approved via Review Queue UI";
      if (selectedClaim.status === "conflicting") {
        const answer = window.prompt("This claim is Conflicting. Which source is current, and why? (required)");
        if (!answer || !answer.trim()) {
          setIsSubmittingAction(false);
          return;
        }
        note = `Conflict resolved: ${answer.trim()}`;
      }
      await api.approveClaim(selectedClaim.id, { role: "lead", note });
      setActionSuccessMessage(`Claim #${selectedClaim.id} approved!`);
      setTimeout(() => setActionSuccessMessage(null), 3500);
      await loadClaims();
      if (onRefreshStats) onRefreshStats();
      const vers = await api.getClaimVersions(selectedClaim.id).catch(() => null);
      if (vers?.versions) setClaimVersions(vers.versions);
    } catch (err) {
      setActionError("Approve failed: " + formatErrorMessage(err));
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Actions: Reject
  const handleRejectConfirm = async () => {
    if (!selectedClaim || !rejectReason.trim()) return;
    setIsSubmittingAction(true);
    try {
      await api.rejectClaim(selectedClaim.id, { role: "lead", reason: rejectReason.trim() });
      setRejectModalOpen(false);
      setRejectReason("");
      setActionSuccessMessage(`Claim #${selectedClaim.id} rejected.`);
      setTimeout(() => setActionSuccessMessage(null), 3500);
      await loadClaims();
      if (onRefreshStats) onRefreshStats();
    } catch (err) {
      setActionError("Reject failed: " + formatErrorMessage(err));
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Actions: Edit
  const handleEditConfirm = async () => {
    if (!selectedClaim || !editText.trim()) return;
    setIsSubmittingAction(true);
    try {
      await api.editClaim(selectedClaim.id, {
        role: "lead",
        correctedText: editText.trim(),
        note: editNote.trim() || undefined,
      });
      setEditModalOpen(false);
      setActionSuccessMessage(`Claim #${selectedClaim.id} corrected (Version incremented).`);
      setTimeout(() => setActionSuccessMessage(null), 3500);
      await loadClaims();
      if (onRefreshStats) onRefreshStats();
      const vers = await api.getClaimVersions(selectedClaim.id).catch(() => null);
      if (vers?.versions) setClaimVersions(vers.versions);
    } catch (err) {
      setActionError("Edit failed: " + formatErrorMessage(err));
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Actions: Bulk Approve Verified (demo shortcut)
  const handleBulkApproveVerified = async () => {
    if (!window.confirm("Approve all quote-matched claims? Conflicting, Inferred and Missing claims are skipped and need one-by-one review.")) return;
    setIsBulkApproving(true);
    try {
      await api.bulkApproveVerified({ projectId: 1, role: "lead" });
      setActionSuccessMessage("All verified claims approved for handover!");
      setTimeout(() => setActionSuccessMessage(null), 4000);
      await loadClaims();
      if (onRefreshStats) onRefreshStats();
    } catch (err) {
      setActionError("Bulk approve failed: " + formatErrorMessage(err));
    } finally {
      setIsBulkApproving(false);
    }
  };

  // Copy Quote Handler
  const handleCopyQuote = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedQuote(true);
    setTimeout(() => setCopiedQuote(false), 2000);
  };

  // Derived counts for filters
  const derivedCount = claims.filter((c) => c.kind === "derived").length;
  const interpretedCount = claims.filter((c) => c.kind === "interpreted").length;

  // Filtered claims list
  const filteredClaims = claims.filter((claim) => {
    if (kindFilter !== "all" && claim.kind !== kindFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const text = (claim.text || "").toLowerCase();
      const id = String(claim.id);
      if (!text.includes(q) && !id.includes(q)) return false;
    }
    return true;
  });

  const totalCount = stats?.total ?? claims.length;
  const verifiedCount = stats?.by_status?.verified ?? claims.filter((c) => c.status === "verified").length;
  const inferredCount = stats?.by_status?.inferred ?? claims.filter((c) => c.status === "inferred").length;
  const conflictingCount = stats?.by_status?.conflicting ?? claims.filter((c) => c.status === "conflicting").length;
  const missingCount = stats?.by_status?.missing ?? claims.filter((c) => c.status === "missing").length;

  const currentContext = claimContext?.contexts?.[0];
  const currentQuote = currentContext?.quote || selectedClaim?.evidence?.[0]?.quote || "";
  const currentChunkText = currentContext?.chunk_text || "";

  // Highlight quote inside source chunk text
  const renderHighlightedChunk = (text, quote) => {
    if (!text) return null;
    if (!quote) return <span>{text}</span>;
    const idx = text.indexOf(quote);
    if (idx === -1) return <span>{text}</span>;
    const before = text.slice(0, idx);
    const matched = text.slice(idx, idx + quote.length);
    const after = text.slice(idx + quote.length);
    return (
      <span>
        {before}
        <mark className="bg-primary-fixed text-on-primary-fixed font-semibold px-0.5 rounded">{matched}</mark>
        {after}
      </span>
    );
  };

  return (
    <div className="flex flex-col w-full gap-space-lg">
      {/* Header & Primary Queue Action Toolbar */}
      <div className="flex flex-col gap-space-md mb-space-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold">Claim Review Queue</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-0.5 max-w-3xl">
              Audit and approve candidate claims before compiling the handover dossier.
            </p>
          </div>

          {/* Mass Action Button */}
          <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
            <button
              id="approve-all-btn"
              onClick={handleBulkApproveVerified}
              disabled={isBulkApproving}
              className="px-space-md py-2 bg-primary hover:bg-primary-container text-on-primary rounded-lg font-headline-sm text-headline-sm transition-all shadow-sm flex items-center justify-center gap-space-sm cursor-pointer disabled:opacity-50"
            >
              <span aria-hidden="true" className={`material-symbols-outlined text-[18px] ${isBulkApproving ? "animate-spin" : ""}`}>
                {isBulkApproving ? "refresh" : "done_all"}
              </span>
              <span>{isBulkApproving ? "Approving…" : `Approve all quote-matched (${verifiedCount})`}</span>
            </button>
            <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
              <span aria-hidden="true" className="material-symbols-outlined text-[14px] text-error">gavel</span>
              <span>Conflicting and Missing claims require manual review</span>
            </span>
          </div>
        </div>

        {/* Action error message */}
        {actionError && (
          <div role="alert" className="p-space-sm rounded-lg bg-error-container text-on-error-container font-label-md text-label-md flex items-start gap-2 border border-error/30">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">error</span>
            <span className="flex-1">{actionError}</span>
            <button type="button" onClick={() => setActionError(null)} className="underline underline-offset-2 shrink-0">Dismiss</button>
          </div>
        )}

        {/* Action success message */}
        {actionSuccessMessage && (
          <div className="p-space-sm rounded-lg bg-surface-container text-on-surface font-label-md text-label-md flex items-center gap-2 shadow-xs border border-tertiary">
            <span aria-hidden="true" className="material-symbols-outlined text-tertiary text-[18px]">check_circle</span>
            <span>{actionSuccessMessage}</span>
          </div>
        )}

        {/* Filter Tooling Ribbon */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md border border-surface-container">
          <div className="flex flex-wrap items-center gap-y-3 gap-x-6">
            {/* Status Filters */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mr-1 font-semibold">
                Status:
              </span>
              <button
                onClick={() => setStatusFilter("all")}
                className={`filter-status-chip px-2.5 py-1 rounded-lg font-label-md text-label-md transition-colors cursor-pointer ${
                  statusFilter === "all"
                    ? "bg-surface-container text-on-surface font-bold"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                All ({totalCount})
              </button>
              <button
                onClick={() => setStatusFilter("verified")}
                title={STATUS_HELP.verified}
                className={`filter-status-chip px-2.5 py-1 rounded-lg font-label-md text-label-md transition-colors flex items-center gap-1 cursor-pointer ${
                  statusFilter === "verified"
                    ? "bg-tertiary-fixed text-on-tertiary-fixed font-bold"
                    : "bg-surface-container-low text-tertiary hover:bg-surface-container"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>Quote matched ({verifiedCount})
              </button>
              <button
                onClick={() => setStatusFilter("inferred")}
                title={STATUS_HELP.inferred}
                className={`filter-status-chip px-2.5 py-1 rounded-lg font-label-md text-label-md transition-colors flex items-center gap-1 cursor-pointer ${
                  statusFilter === "inferred"
                    ? "bg-surface-container-high text-on-surface font-bold"
                    : "bg-surface-container-low text-on-surface hover:bg-surface-container"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-outline"></span>Inferred ({inferredCount})
              </button>
              <button
                onClick={() => setStatusFilter("conflicting")}
                title={STATUS_HELP.conflicting}
                className={`filter-status-chip px-2.5 py-1 rounded-lg font-label-md text-label-md transition-colors flex items-center gap-1 cursor-pointer ${
                  statusFilter === "conflicting"
                    ? "bg-error-container text-on-error-container font-bold"
                    : "bg-surface-container-low text-error hover:bg-surface-container"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-error"></span>Conflicting ({conflictingCount})
              </button>
              <button
                onClick={() => setStatusFilter("missing")}
                title={STATUS_HELP.missing}
                className={`filter-status-chip px-2.5 py-1 rounded-lg font-label-md text-label-md transition-colors flex items-center gap-1 cursor-pointer ${
                  statusFilter === "missing"
                    ? "bg-surface-container-high text-outline font-bold"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-outline-variant"></span>Missing ({missingCount})
              </button>
            </div>

            <div className="h-4 w-px bg-surface-container hidden lg:block"></div>

            {/* Kind Filters */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mr-1 font-semibold">
                Derivation:
              </span>
              <button
                onClick={() => setKindFilter("all")}
                className={`filter-kind-chip px-2.5 py-1 rounded-lg font-label-md text-label-md cursor-pointer ${
                  kindFilter === "all" ? "bg-surface-container text-on-surface font-bold" : "bg-surface-container-low text-on-surface-variant"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setKindFilter("derived")}
                className={`filter-kind-chip px-2.5 py-1 rounded-lg font-label-md text-label-md cursor-pointer ${
                  kindFilter === "derived" ? "bg-secondary-fixed text-on-secondary-fixed font-bold" : "bg-surface-container-low text-on-surface"
                }`}
              >
                Derived ({derivedCount})
              </button>
              <button
                onClick={() => setKindFilter("interpreted")}
                className={`filter-kind-chip px-2.5 py-1 rounded-lg font-label-md text-label-md cursor-pointer ${
                  kindFilter === "interpreted" ? "bg-secondary-fixed text-on-secondary-fixed font-bold" : "bg-surface-container-low text-on-surface"
                }`}
              >
                Interpreted ({interpretedCount})
              </button>
            </div>

            <div className="h-4 w-px bg-surface-container hidden xl:block"></div>

            {/* Type Filters */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mr-1 font-semibold">
                Type:
              </span>
              {["all", "ownership", "decision", "blocker", "risk", "dependency"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-2 py-0.5 rounded font-label-sm text-label-sm cursor-pointer capitalize ${
                    typeFilter === t
                      ? "bg-surface-container text-primary font-bold"
                      : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                  }`}
                >
                  {t === "all" ? "All" : t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
        {/* Left Column: Claims Ledger List (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-space-md">
          {/* Sorting & Ledger Header */}
          <div className="flex items-center justify-between px-space-xs">
            <div className="flex items-center gap-space-sm">
              <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Candidate Records
              </span>
              <span className="px-2 py-0.5 bg-surface-container font-code-sm text-code-sm rounded text-primary">
                Sorted by Risk Priority
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                Showing {filteredClaims.length} of {claims.length}
              </span>
            </div>
          </div>

          {/* Ledger Cards Container */}
          <div className="flex flex-col gap-space-sm lg:max-h-[calc(100vh-176px)] lg:overflow-y-auto pr-2" id="claims-ledger-container">
            {isLoading ? (
              <div className="p-space-xl text-center bg-surface-container-lowest rounded-xl border border-surface-container">
                <span aria-hidden="true" className="material-symbols-outlined text-[28px] text-primary animate-spin">refresh</span>
                <p className="font-label-md text-label-md text-on-surface-variant mt-2">Loading candidate claims...</p>
              </div>
            ) : filteredClaims.length === 0 ? (
              <div className="p-space-xl text-center bg-surface-container-lowest rounded-xl border border-surface-container">
                <p className="font-label-md text-label-md text-on-surface-variant">No claims match the selected filters.</p>
              </div>
            ) : (
              filteredClaims.map((claim) => {
                const isSelected = selectedClaim?.id === claim.id;

                return (
                  <div
                    key={claim.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    onClick={() => selectClaim(claim, { reveal: true })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        selectClaim(claim, { reveal: true });
                      }
                    }}
                    className={`claim-row group p-space-md rounded-xl transition-all cursor-pointer relative ${
                      isSelected
                        ? "bg-surface-container-lowest shadow-sm ring-2 ring-primary bg-surface-container-low"
                        : "bg-surface-container-lowest shadow-sm hover:shadow-md border border-surface-container"
                    } ${claim.withheld ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-space-sm mb-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* Status Chip */}
                        {claim.status === "verified" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-label-sm text-label-sm bg-tertiary-fixed text-on-tertiary-fixed font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>Quote matched
                          </span>
                        )}
                        {claim.status === "inferred" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-label-sm text-label-sm bg-surface-container-high text-on-surface-variant font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-outline"></span>Inferred
                          </span>
                        )}
                        {claim.status === "conflicting" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-label-sm text-label-sm bg-error-container text-on-error-container font-semibold">
                            <span aria-hidden="true" className="material-symbols-outlined text-[12px]">error</span>Conflicting
                          </span>
                        )}
                        {claim.status === "missing" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-label-sm text-label-sm bg-surface-container-high text-outline font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-outline-variant"></span>Missing Evidence
                          </span>
                        )}

                        {/* Kind Chip */}
                        <span
                          title={kindHelp(claim)}
                          className={`inline-flex items-center px-2 py-0.5 rounded-md font-label-sm text-label-sm font-semibold ${
                            isSeeded(claim) ? "bg-tertiary-fixed text-on-tertiary-fixed" : "bg-secondary-fixed text-on-secondary-fixed"
                          }`}
                        >
                          {kindLabel(claim)}
                        </span>

                        {/* Type Chip */}
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md font-label-sm text-label-sm bg-surface-container text-on-surface-variant capitalize">
                          {humanizeType(claim.type)}
                        </span>
                      </div>

                      {/* Review State */}
                      <span className="font-code-sm text-code-sm text-outline capitalize">
                        {claim.review_state}
                      </span>
                    </div>

                    {/* Claim Title with Line Clamp and Ellipsis */}
                    <div
                      className="font-headline-sm text-headline-sm text-on-surface mb-2 font-semibold line-clamp-2 break-words"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={`Claim #${claim.id}: ${claim.text}`}
                    >
                      Claim #{claim.id}: {claim.withheld
                        ? "Withheld due to role restrictions (" + (claim.access_level || "Restricted") + ")"
                        : claim.text}
                    </div>

                    {/* Metadata Footer */}
                    <div className="flex items-center justify-between text-on-surface-variant pt-2 border-t border-surface-container/60">
                      <div className="flex items-center gap-space-md font-label-sm text-label-sm">
                        <span className="flex items-center gap-1">
                          <span aria-hidden="true" className="material-symbols-outlined text-[14px]">lock</span>
                          {claim.access_level}
                        </span>
                        <span className="text-outline-variant">•</span>
                        <span className="font-code-sm text-code-sm">
                          v{claim.current_version}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {isSelected ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container font-label-sm text-label-sm text-primary font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>Active Inspection
                          </span>
                        ) : claim.review_state === "approved" ? (
                          <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-tertiary font-semibold">
                            <span aria-hidden="true" className="material-symbols-outlined text-[14px]">check_circle</span>Approved
                          </span>
                        ) : claim.review_state === "rejected" ? (
                          <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-error font-semibold">
                            Rejected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
                            Pending Review
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Detail & Verification Drawer (5 cols) */}
        <div className="lg:col-span-5 lg:sticky lg:top-[112px] lg:max-h-[calc(100vh-124px)] flex flex-col">
          {selectedClaim ? (
            <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container flex flex-col max-h-[calc(100vh-124px)] overflow-hidden">
              {/* Scrollable Inspection Content */}
              <div className="p-space-lg overflow-y-auto flex-1 flex flex-col gap-space-lg">
                {/* Header & Target Claim */}
                <div className="flex items-start justify-between gap-space-md">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        title={STATUS_HELP[selectedClaim.status]}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-label-sm text-label-sm font-semibold ${STATUS_STYLE[selectedClaim.status]?.chip || "bg-surface-container-high text-on-surface"}`}
                      >
                        <span className="material-symbols-outlined text-[14px]" aria-hidden="true">{STATUS_STYLE[selectedClaim.status]?.icon || "help"}</span>
                        {STATUS_STYLE[selectedClaim.status]?.label || selectedClaim.status}
                      </span>
                    </div>
                    <h2 className="font-headline-md text-headline-md text-on-surface font-semibold break-words" id="inspect-claim-header">
                      Claim #{selectedClaim.id}: {selectedClaim.text}
                    </h2>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0">
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                      {STATUS_STYLE[selectedClaim.status]?.icon || "help"}
                    </span>
                  </div>
                </div>

                {/* Scope & Access Level */}
                <div className="p-space-sm bg-surface-container-low rounded-lg flex items-center justify-between font-label-sm text-label-sm border border-surface-container/60">
                  <div className="flex items-center gap-space-sm">
                    <span className="text-on-surface-variant">Claim Type:</span>
                    <span className="font-code-sm text-code-sm text-primary font-semibold capitalize">
                      {humanizeType(selectedClaim.type)}
                    </span>
                  </div>
                  <div className="flex items-center gap-space-sm">
                    <span className="text-on-surface-variant">Access Tier:</span>
                    <span className="font-label-md text-label-md text-on-surface font-semibold capitalize">
                      {selectedClaim.access_level}
                    </span>
                  </div>
                </div>

                {/* Full Statement */}
                <div className="flex flex-col gap-1.5">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                    Full Claim Text
                  </span>
                  <div className="p-space-md bg-surface-container-low rounded-xl border border-surface-container/60 font-body-md text-body-md text-on-surface leading-relaxed break-words">
                    {selectedClaim.text}
                  </div>
                </div>

                {/* Verbatim Quote & Source Chunk OR Derived Message */}
                {selectedClaim.kind === "derived" && (selectedClaim.evidence || []).length > 1 && selectedClaim.status === "conflicting" ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 font-headline-sm text-headline-sm text-on-surface font-semibold">
                      <span className="material-symbols-outlined text-error text-[20px]" aria-hidden="true">compare_arrows</span>
                      <span>Two sources disagree</span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Found by code comparing dated plans across notes, chat and issues. Both quotes are exact text from the sources.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
                      {selectedClaim.evidence.map((ev, i) => (
                        <figure key={i} className="p-space-sm rounded-xl border border-outline-variant bg-surface-container-lowest">
                          <figcaption className="font-label-sm text-label-sm text-outline mb-1">
                            {i === 0 ? "Earlier plan" : "Later change"} · {ev.source_name || `source ${ev.source_id}`}
                          </figcaption>
                          <blockquote className="font-body-sm text-body-sm text-on-surface">“{ev.quote}”</blockquote>
                        </figure>
                      ))}
                    </div>
                  </div>
                ) : selectedClaim.kind === "derived" ? (
                  <div className="p-space-md bg-surface-container-low rounded-xl border border-surface-container/60 space-y-2">
                    <div className="flex items-center gap-2 font-headline-sm text-headline-sm text-on-surface font-semibold">
                      <span aria-hidden="true" className="material-symbols-outlined text-secondary text-[20px]">code</span>
                      <span>Derived from Git History</span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Calculated by code from git history; no quote check
                    </p>
                    <p className="font-label-sm text-label-sm text-outline">
                      {selectedClaim.type === "blocker"
                        ? "Found by code reading the task export: the owner field is empty."
                        : "Ownership and commit concentration metrics are derived by Python scripts inspecting commit author ratios and timestamps."}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-space-sm">
                    <div className="flex items-center justify-between font-label-sm text-label-sm">
                      <span className="text-on-surface-variant flex items-center gap-1 font-semibold">
                        <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-primary">format_quote</span>
                        Exact Source Substring Quote
                      </span>
                      <span className="font-code-sm text-code-sm text-outline flex items-center gap-1">
                        <span aria-hidden="true" className="material-symbols-outlined text-[12px]">link</span>
                        {currentContext?.source_name || "Source document"}
                      </span>
                    </div>
                    <div className="p-space-md bg-surface-container-low rounded-xl relative group border border-surface-container/60">
                      <div className="absolute top-2 right-2">
                        <button
                          onClick={() => handleCopyQuote(currentQuote)}
                          className="p-1 rounded hover:bg-surface-container text-on-surface-variant text-[14px] cursor-pointer"
                          title="Copy exact raw quote"
                        >
                          <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
                            {copiedQuote ? "check" : "content_copy"}
                          </span>
                        </button>
                      </div>
                      <p className="font-code-sm text-code-sm text-on-surface leading-relaxed pr-6 bg-surface-variant/40 p-2 rounded">
                        “{currentQuote || "No quote recorded"}”
                      </p>
                    </div>

                    {/* Highlighted Chunk */}
                    {currentChunkText && (
                      <div className="flex flex-col gap-1">
                        <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">
                          Source Chunk Context ({currentContext?.source_name})
                        </span>
                        <div className="p-space-sm bg-surface-container-low rounded-lg font-code-sm text-code-sm text-on-surface-variant leading-relaxed max-h-40 overflow-y-auto border border-surface-container/60">
                          {renderHighlightedChunk(currentChunkText, currentQuote)}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Actual Stored Check Results */}
                <div className="flex flex-col gap-space-sm">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                    Stored Verification Check Results
                  </span>
                  <div className="p-space-sm bg-surface-container rounded-lg flex items-center justify-between border border-surface-container/60">
                    <div className="flex items-center gap-space-sm">
                      <div className="w-6 h-6 rounded-full bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-center shrink-0">
                        <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
                          {selectedClaim.status === "verified" ? "done" : "info"}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-headline-sm text-headline-sm text-on-surface text-[14px] font-semibold capitalize">
                          Check Status: {selectedClaim.status}
                        </span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant text-[12px]">
                          {selectedClaim.kind === "derived"
                            ? "Calculated by code from git history; no quote check"
                            : selectedClaim.status === "verified"
                            ? "Substring quote check passed verbatim in source chunk."
                            : selectedClaim.status === "conflicting"
                            ? "Discrepancy identified across source artifacts."
                            : selectedClaim.status === "missing"
                            ? "Evidence or field missing in source artifact."
                            : "Inferred statement without exact substring anchor."}
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface font-code-sm text-code-sm font-bold uppercase">
                      {selectedClaim.status}
                    </span>
                  </div>
                </div>

                {/* Version History & Audit Trail */}
                {claimVersions.length > 0 && (
                  <div className="flex flex-col gap-space-xs pt-2 border-t border-surface-container/60">
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                      Version Audit Trail ({claimVersions.length})
                    </span>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {claimVersions.map((v) => (
                        <div
                          key={v.version}
                          className="p-2 rounded bg-surface-container-low text-xs border border-surface-container/60 flex items-start justify-between"
                        >
                          <div>
                            <span className="font-bold text-on-surface">v{v.version}</span>
                            <span className="text-on-surface-variant ml-2">{v.change_note || "Initial version"}</span>
                          </div>
                          <span className="text-outline font-code-sm text-[11px]">{v.changed_by}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sticky Action Footer Inside Detail Panel */}
              <div className="p-space-md bg-surface-container-lowest border-t border-surface-container sticky bottom-0 z-10 shrink-0 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
                <div className="flex items-center justify-between gap-space-sm">
                  <button
                    id="btn-approve"
                    onClick={handleApprove}
                    disabled={isSubmittingAction || selectedClaim.review_state === "approved"}
                    className="flex-1 py-2.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-headline-sm text-headline-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-[18px]">check_circle</span>
                    <span>{selectedClaim.review_state === "approved" ? "Approved" : "Approve Claim"}</span>
                  </button>
                  <button
                    id="btn-reject"
                    onClick={() => {
                      setRejectReason("");
                      setRejectModalOpen(true);
                    }}
                    disabled={isSubmittingAction}
                    className="px-space-md py-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-error font-headline-sm text-headline-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-[18px]">cancel</span>
                    <span>Reject</span>
                  </button>
                  <button
                    id="btn-edit"
                    onClick={() => {
                      setEditText(selectedClaim.text || "");
                      setEditNote("");
                      setEditModalOpen(true);
                    }}
                    disabled={isSubmittingAction}
                    className="px-space-md py-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-headline-sm text-headline-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-[18px]">edit</span>
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-space-xl text-center bg-surface-container-lowest rounded-xl border border-surface-container">
              <span aria-hidden="true" className="material-symbols-outlined text-[32px] text-outline">touch_app</span>
              <p className="font-headline-sm text-headline-sm text-on-surface mt-2 font-semibold">
                Select a Claim to Inspect
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                Click any candidate claim from the ledger on the left to verify its source chunk and approve it.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Reject Modal */}
      {rejectModalOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-surface-container-lowest rounded-xl shadow-lg border border-surface-container max-w-md w-full p-6 space-y-4">
            <h3 className="font-headline-md text-headline-md text-on-surface font-bold">Reject Claim</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Rejections require an explicit rationale logged in the audit log.
            </p>
            <textarea
              className="w-full h-24 p-2.5 rounded-lg border border-surface-container bg-surface-container-low text-on-surface font-body-sm focus:outline-primary"
              placeholder="Provide a mandatory reason for rejecting this claim..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRejectModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-surface-container text-on-surface text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={!rejectReason.trim() || isSubmittingAction}
                className="px-4 py-2 rounded-lg bg-error text-on-error text-sm font-semibold cursor-pointer disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModalOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-surface-container-lowest rounded-xl shadow-lg border border-surface-container max-w-lg w-full p-6 space-y-4">
            <h3 className="font-headline-md text-headline-md text-on-surface font-bold">Correct Claim Statement</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Editing increments the claim version and marks review state as corrected.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-on-surface-variant block">Corrected Claim Text</label>
              <textarea
                className="w-full h-28 p-2.5 rounded-lg border border-surface-container bg-surface-container-low text-on-surface font-body-sm focus:outline-primary"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-on-surface-variant block">Change Rationale / Note</label>
              <input
                type="text"
                className="w-full p-2.5 rounded-lg border border-surface-container bg-surface-container-low text-on-surface font-body-sm focus:outline-primary"
                placeholder="Optional correction note..."
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-surface-container text-on-surface text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleEditConfirm}
                disabled={!editText.trim() || isSubmittingAction}
                className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold cursor-pointer disabled:opacity-50"
              >
                Save Correction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
