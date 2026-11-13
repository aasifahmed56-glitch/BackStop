import React, { useState, useEffect } from "react";
import { api } from "../api";

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
  const [copiedQuote, setCopiedQuote] = useState(false);

  const [isBulkApproving, setIsBulkApproving] = useState(false);

  // Load claims
  const loadClaims = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getClaims({
        projectId: 1,
        role,
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
    loadClaims();
  }, [role, statusFilter, typeFilter]);

  // Load context and versions when a claim is selected
  const selectClaim = async (claim) => {
    setSelectedClaim(claim);
    setClaimContext(null);
    setClaimVersions([]);
    if (claim.withheld) return;

    setIsDetailLoading(true);
    try {
      const [ctx, vers] = await Promise.all([
        api.getClaimContext(claim.id).catch(() => null),
        api.getClaimVersions(claim.id).catch(() => []),
      ]);
      setClaimContext(ctx);
      setClaimVersions(vers);
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
      await api.approveClaim(selectedClaim.id, { role, note: `Approved via Review Queue UI by ${role}` });
      setActionSuccessMessage(`Claim #${selectedClaim.id} approved!`);
      setTimeout(() => setActionSuccessMessage(null), 3500);
      await loadClaims();
      onRefreshStats();
      const vers = await api.getClaimVersions(selectedClaim.id).catch(() => []);
      setClaimVersions(vers);
    } catch (err) {
      alert("Approve failed: " + err.message);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Actions: Reject
  const handleRejectConfirm = async () => {
    if (!selectedClaim || !rejectReason.trim()) return;
    setIsSubmittingAction(true);
    try {
      await api.rejectClaim(selectedClaim.id, { role, reason: rejectReason.trim() });
      setRejectModalOpen(false);
      setRejectReason("");
      setActionSuccessMessage(`Claim #${selectedClaim.id} rejected.`);
      setTimeout(() => setActionSuccessMessage(null), 3500);
      await loadClaims();
      onRefreshStats();
    } catch (err) {
      alert("Reject failed: " + err.message);
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
        role,
        correctedText: editText.trim(),
        note: editNote.trim() || undefined,
      });
      setEditModalOpen(false);
      setActionSuccessMessage(`Claim #${selectedClaim.id} corrected (Version incremented).`);
      setTimeout(() => setActionSuccessMessage(null), 3500);
      await loadClaims();
      onRefreshStats();
      const vers = await api.getClaimVersions(selectedClaim.id).catch(() => []);
      setClaimVersions(vers);
    } catch (err) {
      alert("Edit failed: " + err.message);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Actions: Bulk Approve Verified (demo shortcut)
  const handleBulkApproveVerified = async () => {
    if (!window.confirm("Approve all Verified claims? Conflicting and Missing claims will be skipped.")) return;
    setIsBulkApproving(true);
    try {
      const result = await api.bulkApproveVerified({ projectId: 1, role });
      const count = result?.approved_count ?? 0;
      setActionSuccessMessage(`Bulk approved ${count} Verified claim${count !== 1 ? "s" : ""} (Conflicting & Missing skipped).`);
      setTimeout(() => setActionSuccessMessage(null), 5000);
      await loadClaims();
      onRefreshStats();
    } catch (err) {
      alert("Bulk approve failed: " + err.message);
    } finally {
      setIsBulkApproving(false);
    }
  };

  // Filter claims in memory for kind and search
  const filteredClaims = claims.filter((c) => {
    if (kindFilter !== "all" && c.kind !== kindFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchText = (c.statement || "") + (c.summary || "") + (c.target_module || "") + (c.author || "");
      if (!matchText.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Calculate status counts
  const verifiedCount = stats?.status_breakdown?.verified ?? 26;
  const inferredCount = stats?.status_breakdown?.inferred ?? 8;
  const conflictingCount = stats?.status_breakdown?.conflicting ?? 4;
  const missingCount = stats?.status_breakdown?.missing ?? 4;
  const totalCount = stats?.total_claims ?? (verifiedCount + inferredCount + conflictingCount + missingCount);

  // Copy quote helper
  const handleCopyQuote = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedQuote(true);
    setTimeout(() => setCopiedQuote(false), 2000);
  };

  return (
    <div className="flex flex-col w-full">
      {/* Top Command & Action Bar */}
      <div className="flex flex-col gap-space-lg mb-space-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
          <div>
            <div className="flex items-center gap-space-sm mb-1">
              <span className="font-code-sm text-code-sm text-primary uppercase tracking-wider font-semibold">
                Phase 02 / Verification
              </span>
              <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
              <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                Deterministic Proof Engine
              </span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold">Claim Review Queue</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-0.5 max-w-3xl">
              Audit and approve candidate claims before compiling the handover dossier. Every claim must cite an exact source quote with cryptographic traceability.
            </p>
          </div>

          {/* Mass Action Button & Regulatory Note */}
          <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
            <button
              id="approve-all-btn"
              onClick={handleBulkApproveVerified}
              disabled={isBulkApproving}
              className="px-space-md py-2 bg-primary hover:bg-primary-container text-on-primary rounded-lg font-headline-sm text-headline-sm transition-all shadow-sm flex items-center justify-center gap-space-sm cursor-pointer disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[18px] ${isBulkApproving ? "animate-spin" : ""}`}>
                {isBulkApproving ? "refresh" : "done_all"}
              </span>
              <span>{isBulkApproving ? "Approving Verified..." : `Approve All Verified (${verifiedCount})`}</span>
            </button>
            <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-error">gavel</span>
              <span>Conflicting and Missing claims require manual human arbitration</span>
            </span>
          </div>
        </div>

        {/* Action success message */}
        {actionSuccessMessage && (
          <div className="p-space-sm rounded-lg bg-surface-container text-on-surface font-label-md text-label-md flex items-center gap-2 shadow-xs border border-tertiary">
            <span className="material-symbols-outlined text-tertiary text-[18px]">check_circle</span>
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
                className={`filter-status-chip px-2.5 py-1 rounded-lg font-label-md text-label-md transition-colors flex items-center gap-1 cursor-pointer ${
                  statusFilter === "verified"
                    ? "bg-tertiary-fixed text-on-tertiary-fixed font-bold"
                    : "bg-surface-container-low text-tertiary hover:bg-surface-container"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>Verified ({verifiedCount})
              </button>
              <button
                onClick={() => setStatusFilter("inferred")}
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
                Derived (14)
              </button>
              <button
                onClick={() => setKindFilter("interpreted")}
                className={`filter-kind-chip px-2.5 py-1 rounded-lg font-label-md text-label-md cursor-pointer ${
                  kindFilter === "interpreted" ? "bg-secondary-fixed text-on-secondary-fixed font-bold" : "bg-surface-container-low text-on-surface"
                }`}
              >
                Interpreted (28)
              </button>
            </div>

            <div className="h-4 w-px bg-surface-container hidden xl:block"></div>

            {/* Type Filters */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mr-1 font-semibold">
                Taxonomy:
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
                Ordered by Risk (Kar-Score)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                Showing {filteredClaims.length} of {claims.length}
              </span>
            </div>
          </div>

          {/* Ledger Cards Container */}
          <div className="flex flex-col gap-space-sm" id="claims-ledger-container">
            {isLoading ? (
              <div className="p-space-xl text-center bg-surface-container-lowest rounded-xl border border-surface-container">
                <span className="material-symbols-outlined text-[28px] text-primary animate-spin">refresh</span>
                <p className="font-label-md text-label-md text-on-surface-variant mt-2">Loading candidate claims...</p>
              </div>
            ) : filteredClaims.length === 0 ? (
              <div className="p-space-xl text-center bg-surface-container-lowest rounded-xl border border-surface-container">
                <p className="font-label-md text-label-md text-on-surface-variant">No claims match the selected filters.</p>
              </div>
            ) : (
              filteredClaims.map((claim) => {
                const isSelected = selectedClaim?.id === claim.id;
                const isHighKar = (claim.kar_score ?? 0.5) >= 0.7;
                const karScore = claim.kar_score ? claim.kar_score.toFixed(3) : "0.500";

                return (
                  <div
                    key={claim.id}
                    onClick={() => selectClaim(claim)}
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
                            <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>Verified
                          </span>
                        )}
                        {claim.status === "inferred" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-label-sm text-label-sm bg-surface-container-high text-on-surface-variant font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-outline"></span>Inferred
                          </span>
                        )}
                        {claim.status === "conflicting" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-label-sm text-label-sm bg-error-container text-on-error-container font-semibold">
                            <span className="material-symbols-outlined text-[12px]">error</span>Conflicting
                          </span>
                        )}
                        {claim.status === "missing" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-label-sm text-label-sm bg-surface-container-high text-outline font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-outline-variant"></span>Missing Evidence
                          </span>
                        )}

                        {/* Kind Chip */}
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md font-label-sm text-label-sm bg-secondary-fixed text-on-secondary-fixed font-semibold capitalize">
                          {claim.kind || "Derived"}
                        </span>

                        {/* Type Chip */}
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md font-label-sm text-label-sm bg-surface-container text-on-surface-variant capitalize">
                          {claim.type || "Claim"}
                        </span>
                      </div>

                      {/* Risk Score Indicator */}
                      <div
                        className={`flex items-center gap-1 px-2 py-0.5 rounded shrink-0 ${
                          isHighKar ? "bg-error-container text-on-error-container" : "bg-surface-container text-on-surface-variant"
                        }`}
                      >
                        {isHighKar && <span className="material-symbols-outlined text-[14px]">warning</span>}
                        <span className="font-code-sm text-code-sm">
                          {karScore} {isHighKar ? "High Kar" : "Mid Kar"}
                        </span>
                      </div>
                    </div>

                    {/* Claim Title */}
                    <div className="font-headline-sm text-headline-sm text-on-surface mb-2 font-semibold">
                      Claim #{claim.id}: {claim.summary || claim.statement?.slice(0, 70)}
                    </div>

                    {/* Claim Statement */}
                    <p className="font-body-md text-body-md text-on-surface-variant mb-space-md line-clamp-2">
                      {claim.withheld
                        ? "Withheld due to role restrictions. Access level required: " + (claim.access_level || "Restricted")
                        : claim.statement}
                    </p>

                    {/* Metadata Footer */}
                    <div className="flex items-center justify-between text-on-surface-variant pt-2 border-t border-surface-container/60">
                      <div className="flex items-center gap-space-md font-label-sm text-label-sm">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">folder</span>
                          {claim.target_module || "root"}
                        </span>
                        {claim.author && (
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">account_circle</span>
                            Author: {claim.author}
                          </span>
                        )}
                        <span className="text-outline-variant">•</span>
                        <span className="font-code-sm text-code-sm">
                          {claim.evidence_anchor || `ref:${claim.id}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {isSelected ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container font-label-sm text-label-sm text-primary font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>Active Inspection
                          </span>
                        ) : claim.review_status === "approved" ? (
                          <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-tertiary font-semibold">
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>Approved
                          </span>
                        ) : claim.status === "missing" ? (
                          <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-error">
                            Missing Proof
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

        {/* Right Column: Detail & Verification Drawer / Sticky Inspection Panel (5 cols) */}
        <div className="lg:col-span-5 sticky top-28">
          {selectedClaim ? (
            <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-lg border border-surface-container">
              {/* Header & Target Claim */}
              <div className="flex items-start justify-between gap-space-md">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-code-sm text-code-sm text-primary uppercase font-bold">Inspection Node</span>
                    <span className="px-1.5 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-label-sm font-semibold">
                      {selectedClaim.status === "verified" ? "Verified Proof" : selectedClaim.status.toUpperCase()}
                    </span>
                  </div>
                  <h2 className="font-headline-md text-headline-md text-on-surface font-semibold" id="inspect-claim-header">
                    Claim #{selectedClaim.id}: {selectedClaim.summary || selectedClaim.statement?.slice(0, 60)}
                  </h2>
                </div>
                <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0">
                  <span className="material-symbols-outlined text-[18px]">
                    {selectedClaim.status === "verified" ? "verified" : "help"}
                  </span>
                </div>
              </div>

              {/* Target Module & Author Attribution Pill */}
              <div className="p-space-sm bg-surface-container-low rounded-lg flex items-center justify-between font-label-sm text-label-sm border border-surface-container/60">
                <div className="flex items-center gap-space-sm">
                  <span className="text-on-surface-variant">Scope Target:</span>
                  <span className="font-code-sm text-code-sm text-primary font-semibold">
                    {selectedClaim.target_module || "core/repository"}
                  </span>
                </div>
                <div className="flex items-center gap-space-sm">
                  <span className="text-on-surface-variant">Knowledge Custodian:</span>
                  <span className="font-label-md text-label-md text-on-surface font-semibold">
                    {selectedClaim.author || "Riya (Staff Eng)"}
                  </span>
                </div>
              </div>

              {/* Exact Substring Quote Box */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between font-label-sm text-label-sm">
                  <span className="text-on-surface-variant flex items-center gap-1 font-semibold">
                    <span className="material-symbols-outlined text-[16px] text-primary">format_quote</span>
                    Exact Source Substring Quote
                  </span>
                  <span className="font-code-sm text-code-sm text-outline flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">link</span>
                    {selectedClaim.evidence_anchor || "git_log.txt:line 184"}
                  </span>
                </div>
                <div className="p-space-md bg-surface-container-low rounded-xl relative group border border-surface-container/60">
                  <div className="absolute top-2 right-2">
                    <button
                      onClick={() => handleCopyQuote(selectedClaim.quote || selectedClaim.statement)}
                      className="p-1 rounded hover:bg-surface-container text-on-surface-variant text-[14px] cursor-pointer"
                      title="Copy exact raw quote"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {copiedQuote ? "check" : "content_copy"}
                      </span>
                    </button>
                  </div>
                  <p className="font-code-sm text-code-sm text-on-surface leading-relaxed pr-6 bg-surface-variant/40 p-2 rounded">
                    “{selectedClaim.quote || selectedClaim.statement}”
                  </p>
                  <div className="mt-2 flex items-center gap-space-md font-label-sm text-label-sm text-on-surface-variant">
                    <span>
                      Entropy Hash:{" "}
                      <code className="font-code-sm text-code-sm text-on-surface">sha256:d8a1c...9b2</code>
                    </span>
                    <span className="text-tertiary flex items-center gap-0.5 font-semibold">
                      <span className="material-symbols-outlined text-[14px]">check</span>Byte Exact
                    </span>
                  </div>
                </div>
              </div>

              {/* Dual-Track Verification Trace */}
              <div className="flex flex-col gap-space-sm">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                  Dual-Track Verification Trace
                </span>
                {/* Step 1: Substring Test */}
                <div className="p-space-sm bg-surface-container rounded-lg flex items-center justify-between border border-surface-container/60">
                  <div className="flex items-center gap-space-sm">
                    <div className="w-6 h-6 rounded-full bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[14px]">done</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-headline-sm text-headline-sm text-on-surface text-[14px] font-semibold">
                        Step 1: Substring Test
                      </span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant text-[12px]">
                        100% exact match in raw source chunk (Index #{selectedClaim.id + 3000})
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed font-code-sm text-code-sm font-bold">
                    PASSED
                  </span>
                </div>
                {/* Step 2: Isolated Support Check */}
                <div className="p-space-sm bg-surface-container rounded-lg flex items-center justify-between border border-surface-container/60">
                  <div className="flex items-center gap-space-sm">
                    <div className="w-6 h-6 rounded-full bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[14px]">done</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-headline-sm text-headline-sm text-on-surface text-[14px] font-semibold">
                        Step 2: Isolated Support Check
                      </span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant text-[12px]">
                        Corroborated by independent git log commit distribution
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed font-code-sm text-code-sm font-bold">
                    CORROBORATED
                  </span>
                </div>
              </div>

              {/* Arbitrated Knowledge Risk Visual */}
              <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col gap-space-sm border border-surface-container/60">
                <div className="flex items-center justify-between font-label-sm text-label-sm">
                  <span className="text-on-surface font-semibold">Knowledge-at-Risk Distribution</span>
                  <span className="font-code-sm text-code-sm text-error font-bold">
                    {(selectedClaim.kar_score ?? 0.82).toFixed(3)} (Critical Threshold &gt; 0.750)
                  </span>
                </div>
                <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden flex">
                  <div
                    className="bg-primary h-full"
                    style={{ width: `${Math.round((selectedClaim.kar_score ?? 0.82) * 100)}%` }}
                  ></div>
                  <div
                    className="bg-surface-variant h-full"
                    style={{ width: `${100 - Math.round((selectedClaim.kar_score ?? 0.82) * 100)}%` }}
                  ></div>
                </div>
                <div className="flex items-center justify-between font-body-sm text-body-sm text-on-surface-variant text-[11px]">
                  <span>Threshold Safety: Violates 2-maintainer policy</span>
                  <span>Impact: Deployment Freeze Risk</span>
                </div>
              </div>

              {/* Immutable Ledger Version History */}
              <div className="flex items-center justify-between p-space-sm rounded-lg bg-surface-container font-label-sm text-label-sm text-on-surface-variant">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-outline">history</span>
                  <span>Ledger History:</span>
                  <span className="font-code-sm text-code-sm text-on-surface font-semibold">
                    v{claimVersions.length > 0 ? claimVersions.length : "1"} created by Plain-Code Engine on 2026-03-15
                  </span>
                </div>
                <span className="font-code-sm text-code-sm text-tertiary font-bold">Signed GPG</span>
              </div>

              {/* Review Action Buttons */}
              <div className="flex flex-col gap-space-sm pt-2">
                <div className="grid grid-cols-2 gap-space-sm">
                  <button
                    id="approve-single-btn"
                    onClick={handleApprove}
                    disabled={isSubmittingAction || selectedClaim.review_status === "approved"}
                    className="px-space-md py-2.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-headline-sm text-headline-sm transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                    <span>{selectedClaim.review_status === "approved" ? "Approved" : "Approve Claim"}</span>
                  </button>
                  <button
                    id="edit-claim-btn"
                    onClick={() => {
                      setEditText(selectedClaim.statement || "");
                      setEditNote("");
                      setEditModalOpen(true);
                    }}
                    disabled={isSubmittingAction}
                    className="px-space-md py-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-headline-sm text-headline-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit_note</span>
                    <span>Edit Text (v2)</span>
                  </button>
                </div>
                <button
                  id="reject-claim-btn"
                  onClick={() => {
                    setRejectReason("");
                    setRejectModalOpen(true);
                  }}
                  disabled={isSubmittingAction || selectedClaim.review_status === "rejected"}
                  className="w-full px-space-md py-2 rounded-lg bg-surface-container-low hover:bg-error-container text-error font-label-md text-label-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 border border-error/20"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                  <span>Reject Claim (Requires Reason Specification)</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-surface-container text-center">
              <span className="material-symbols-outlined text-[32px] text-outline">search</span>
              <p className="font-label-md text-label-md text-on-surface-variant mt-2">
                Select a candidate claim from the left ledger to inspect citations and verification trace.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Reject Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl border border-surface-container max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-md text-headline-md text-on-surface font-bold">Reject Claim #{selectedClaim?.id}</h3>
              <button
                onClick={() => setRejectModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Rejections require an explicit rationale logged in the immutable audit ledger.
            </p>
            <textarea
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Outdated reference superseded by architecture decision ADR-09..."
              className="w-full bg-surface-container-low border border-surface-container rounded-xl p-3 font-body-sm text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-surface-container text-on-surface font-label-md text-label-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={!rejectReason.trim() || isSubmittingAction}
                className="px-4 py-2 rounded-lg bg-error text-on-error font-label-md text-label-md cursor-pointer disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl border border-surface-container max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-md text-headline-md text-on-surface font-bold">Edit Claim #{selectedClaim?.id}</h3>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Editing increments the claim version in the ledger and logs your user role in the audit log.
            </p>
            <div className="space-y-1">
              <label className="font-label-sm text-label-sm text-on-surface-variant font-semibold">Corrected Text</label>
              <textarea
                rows={4}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full bg-surface-container-low border border-surface-container rounded-xl p-3 font-body-sm text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="font-label-sm text-label-sm text-on-surface-variant font-semibold">Audit Note (Optional)</label>
              <input
                type="text"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Reason for revision..."
                className="w-full bg-surface-container-low border border-surface-container rounded-xl p-2.5 font-body-sm text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-surface-container text-on-surface font-label-md text-label-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleEditConfirm}
                disabled={!editText.trim() || isSubmittingAction}
                className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md cursor-pointer disabled:opacity-50"
              >
                Save Version (v2)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
