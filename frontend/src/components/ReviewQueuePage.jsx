import React, { useState, useEffect } from "react";
import {
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Clock,
  Shield,
  Edit3,
  XCircle,
  Check,
  Search,
  Filter,
  History,
  FileCode,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Lock,
  ArrowUpDown,
  Flame,
  AlertTriangle,
} from "lucide-react";
import { api } from "../api";

export default function ReviewQueuePage({ role, stats, onRefreshStats }) {
  const [claims, setClaims] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [reviewStateFilter, setReviewStateFilter] = useState("all");
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
        reviewState: reviewStateFilter,
      });
      setClaims(data || []);
      if (data && data.length > 0 && !selectedClaim) {
        selectClaim(data[0]);
      } else if (selectedClaim) {
        // Refresh selected claim if it exists in the updated list
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
  }, [role, statusFilter, typeFilter, reviewStateFilter]);

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
      // Reload detail
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
      // Reload detail context and versions
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

  // Helper chips styling
  const getStatusBadge = (status) => {
    switch (status) {
      case "verified":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
            Verified
          </span>
        );
      case "inferred":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-[#fffbeb] text-[#d97706] border border-[#fde68a]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d97706]" />
            Inferred
          </span>
        );
      case "conflicting":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-[#fef2f2] text-[#dc2626] border border-[#fecaca]">
            <AlertTriangle className="w-3 h-3 text-[#dc2626]" />
            Conflicting
          </span>
        );
      case "missing":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-[#f1f5f9] text-[#64748b] border border-[#e2e8f0]">
            <HelpCircle className="w-3 h-3 text-[#64748b]" />
            Missing evidence
          </span>
        );
    }
  };

  const getReviewStateBadge = (state) => {
    switch (state) {
      case "approved":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0] uppercase tracking-wider">Approved</span>;
      case "corrected":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#f0f9ff] text-[#0284c7] border border-[#bae6fd] uppercase tracking-wider">Corrected</span>;
      case "rejected":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#fef2f2] text-[#dc2626] border border-[#fecaca] uppercase tracking-wider">Rejected</span>;
      case "pending":
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#fffbeb] text-[#b45309] border border-[#fde68a] uppercase tracking-wider">Pending Review</span>;
    }
  };

  const getAccessBadge = (level) => {
    switch (level) {
      case "confidential":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#faf5ff] text-[#6b21a8] border border-[#e9d5ff] uppercase tracking-wider">Confidential</span>;
      case "restricted":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#fffbeb] text-[#92400e] border border-[#fde68a] uppercase tracking-wider">Restricted</span>;
      case "team":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#eff6ff] text-[#1e40af] border border-[#bfdbfe] uppercase tracking-wider">Team</span>;
      case "public":
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#f8fafc] text-[#475569] border border-[#e2e8f0] uppercase tracking-wider">Public</span>;
    }
  };

  // Filtered by search
  const filteredClaims = claims.filter((c) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (c.text && c.text.toLowerCase().includes(term)) ||
      (c.type && c.type.toLowerCase().includes(term)) ||
      (c.status && c.status.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* Header & Stats Bar */}
      <div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded bg-[#dbe1ff] text-[#00174b] font-mono text-[10px] font-bold uppercase tracking-wider">
                Auditable Ledger
              </span>
              <span className="text-xs text-[#737686]">Step 2 of 4</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#0b1c30] tracking-tight">Human Review Queue</h1>
            <p className="text-xs md:text-sm text-[#434655] mt-1">
              Ledger of claims extracted from team activity. Verify source citations before promoting claims to the Handover Dossier.
            </p>
          </div>
          {actionSuccessMessage && (
            <div className="bg-[#ecfdf5] border border-[#a7f3d0] text-[#065f46] text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-2 shadow-2xs animate-fade-in">
              <Check className="w-4 h-4 text-[#059669]" />
              {actionSuccessMessage}
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
          <div className="bg-white p-3.5 rounded-xl border border-[#e2e8f0] shadow-2xs">
            <span className="text-[11px] font-bold text-[#737686] uppercase tracking-wider">Total Claims</span>
            <div className="text-2xl font-black text-[#0b1c30] mt-0.5">{stats?.total_claims ?? claims.length}</div>
            <span className="text-[10px] text-[#737686]">Risk-ordered ledger</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-[#e2e8f0] shadow-2xs">
            <span className="text-[11px] font-bold text-[#059669] uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" /> Verified
            </span>
            <div className="text-2xl font-black text-[#059669] mt-0.5">
              {stats?.status_breakdown?.verified ?? 0}
            </div>
            <span className="text-[10px] text-[#059669]/70">Substring cited</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-[#e2e8f0] shadow-2xs">
            <span className="text-[11px] font-bold text-[#d97706] uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d97706]" /> Inferred
            </span>
            <div className="text-2xl font-black text-[#d97706] mt-0.5">
              {stats?.status_breakdown?.inferred ?? 0}
            </div>
            <span className="text-[10px] text-[#d97706]/70">Partially supported</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-[#e2e8f0] shadow-2xs">
            <span className="text-[11px] font-bold text-[#dc2626] uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#dc2626]" /> Conflicting
            </span>
            <div className="text-2xl font-black text-[#dc2626] mt-0.5">
              {stats?.status_breakdown?.conflicting ?? 0}
            </div>
            <span className="text-[10px] text-[#dc2626]/70">Disagreement flagged</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-[#e2e8f0] shadow-2xs">
            <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#64748b]" /> Missing
            </span>
            <div className="text-2xl font-black text-[#64748b] mt-0.5">
              {stats?.status_breakdown?.missing ?? 0}
            </div>
            <span className="text-[10px] text-[#64748b]/70">Needs leaver debrief</span>
          </div>

          <div className="bg-[#ecfdf5]/40 p-3.5 rounded-xl border border-[#a7f3d0] shadow-2xs">
            <span className="text-[11px] font-bold text-[#065f46] uppercase tracking-wider">Approved</span>
            <div className="text-2xl font-black text-[#059669] mt-0.5">{stats?.approved_count ?? 0}</div>
            <span className="text-[10px] text-[#065f46]/80">Rejection: {stats?.rejection_rate_percent ?? 0}%</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-[#e2e8f0] shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter */}
          <div className="flex items-center gap-1 bg-[#f1f5f9] p-1 rounded-lg text-xs">
            {["all", "verified", "inferred", "conflicting", "missing"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md font-semibold capitalize transition-all cursor-pointer ${
                  statusFilter === st
                    ? "bg-white text-[#004ac6] shadow-2xs border border-[#cbd5e1]/60"
                    : "text-[#475569] hover:text-[#0b1c30]"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs font-semibold bg-[#f8f9ff] border border-[#e2e8f0] rounded-lg px-2.5 py-1.5 text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#004ac6] cursor-pointer"
          >
            <option value="all">All Types</option>
            <option value="owner">Owner</option>
            <option value="decision">Decision</option>
            <option value="blocker">Blocker</option>
            <option value="risk">Risk</option>
            <option value="dependency">Dependency</option>
            <option value="open_question">Open Question</option>
            <option value="next_action">Next Action</option>
            <option value="contact">Contact</option>
          </select>

          {/* Review state filter */}
          <select
            value={reviewStateFilter}
            onChange={(e) => setReviewStateFilter(e.target.value)}
            className="text-xs font-semibold bg-[#f8f9ff] border border-[#e2e8f0] rounded-lg px-2.5 py-1.5 text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#004ac6] cursor-pointer"
          >
            <option value="all">All Review States</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="corrected">Corrected</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Search & Bulk Action */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-[#737686] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search claims or quotes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-[#f8f9ff] border border-[#e2e8f0] rounded-lg text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#004ac6]"
            />
          </div>

          {/* Bulk Approve Demo Shortcut */}
          {(role === "lead" || role === "admin") && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkApproveVerified}
                disabled={isBulkApproving}
                title="Approves only Verified claims. Conflicting and Missing are always skipped."
                className="flex items-center gap-1.5 text-xs font-bold bg-[#ecfdf5] hover:bg-[#d1fae5] text-[#065f46] border border-[#a7f3d0] px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-2xs disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5 text-[#059669]" />
                {isBulkApproving ? "Approving..." : "✓ Approve all Verified"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Split Layout: Claims List (Left) + Detail Panel (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Claims List Column */}
        <div className="lg:col-span-5 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-[#737686] px-1 font-medium">
            <span>Showing {filteredClaims.length} candidate records</span>
            <span className="flex items-center gap-1 font-mono text-[11px] text-[#004ac6] bg-[#dbe1ff] px-2 py-0.5 rounded font-semibold">
              <Flame className="w-3 h-3 text-[#004ac6]" />
              Ordered by Risk (Kar-Score)
            </span>
          </div>

          {isLoading ? (
            <div className="bg-white p-12 text-center rounded-xl border border-[#e2e8f0]">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-[#004ac6] border-t-transparent" />
              <p className="mt-2 text-xs font-semibold text-[#434655]">Loading claims ledger...</p>
            </div>
          ) : filteredClaims.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-xl border border-[#e2e8f0] space-y-3">
              <p className="text-sm font-semibold text-[#0b1c30]">No claims match the selected filters.</p>
              <button
                onClick={() => {
                  setStatusFilter("all");
                  setTypeFilter("all");
                  setReviewStateFilter("all");
                  setSearchTerm("");
                }}
                className="text-xs text-[#004ac6] font-bold hover:underline cursor-pointer"
              >
                Reset all filters
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[780px] overflow-y-auto pr-1">
              {filteredClaims.map((claim) => {
                const isSelected = selectedClaim?.id === claim.id;

                if (claim.withheld) {
                  return (
                    <div
                      key={claim.id}
                      className="p-3.5 rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8f9ff] text-[#64748b] opacity-80"
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-[#475569]">
                          <Lock className="w-3.5 h-3.5 text-[#d97706]" />
                          Claim #{claim.id} Withheld
                        </span>
                        {getAccessBadge(claim.access_level)}
                      </div>
                      <p className="text-xs text-[#64748b] mt-1">
                        Requires {claim.access_level} access — request from lead
                      </p>
                    </div>
                  );
                }

                return (
                  <div
                    key={claim.id}
                    onClick={() => selectClaim(claim)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer text-left relative ${
                      isSelected
                        ? "bg-[#eff4ff]/40 border-[#004ac6] ring-2 ring-[#004ac6] shadow-xs"
                        : "bg-white border-[#e2e8f0] hover:border-[#cbd5e1] hover:shadow-2xs"
                    }`}
                  >
                    {/* Header Chips */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {getStatusBadge(claim.status)}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            claim.kind === "derived"
                              ? "bg-[#e2dfff] text-[#0f0069] border border-[#c3c0ff]"
                              : "bg-[#f5f3ff] text-[#7c3aed] border border-[#ddd6fe]"
                          }`}
                        >
                          {claim.kind}
                        </span>
                        <span className="text-[10px] font-bold text-[#475569] uppercase px-1.5 py-0.5 rounded bg-[#f1f5f9] border border-[#e2e8f0]">
                          {claim.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {getAccessBadge(claim.access_level)}
                        {getReviewStateBadge(claim.review_state)}
                      </div>
                    </div>

                    {/* Claim Text */}
                    <h4 className="text-xs font-bold text-[#0b1c30] leading-snug line-clamp-2">
                      {claim.text}
                    </h4>

                    {/* Source citation snippet */}
                    {claim.evidence && claim.evidence.length > 0 && claim.evidence[0].quote && (
                      <div className="mt-2 text-[11px] text-[#434655] italic bg-[#f8f9ff] px-2.5 py-1.5 rounded border border-[#e2e8f0] line-clamp-1 font-mono">
                        "{claim.evidence[0].quote}"
                      </div>
                    )}

                    <div className="mt-2.5 flex items-center justify-between text-[10px] text-[#737686]">
                      <span className="font-mono">Claim #{claim.id} · v{claim.current_version}</span>
                      <span className="font-semibold text-[#004ac6] hover:underline flex items-center gap-0.5">
                        Inspect citation <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail Panel Column */}
        <div className="lg:col-span-7">
          {selectedClaim && !selectedClaim.withheld ? (
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-xs space-y-5 sticky top-24">
              {/* Detail Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#f1f5f9] pb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-bold font-mono text-[#737686] uppercase tracking-wider">
                      Claim #{selectedClaim.id} · Version {selectedClaim.current_version}
                    </span>
                    {getAccessBadge(selectedClaim.access_level)}
                    {getReviewStateBadge(selectedClaim.review_state)}
                  </div>
                  <h3 className="text-base font-bold text-[#0b1c30] leading-snug">
                    {selectedClaim.text}
                  </h3>
                </div>

                {/* Review Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleApprove}
                    disabled={isSubmittingAction || selectedClaim.review_state === "approved"}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#059669] hover:bg-[#047857] text-white shadow-2xs transition-colors disabled:opacity-40 cursor-pointer"
                    title="Approve for inclusion in the handover dossier"
                  >
                    <Check className="w-3.5 h-3.5 text-white" />
                    Approve
                  </button>

                  <button
                    onClick={() => {
                      setEditText(selectedClaim.text);
                      setEditNote("");
                      setEditModalOpen(true);
                    }}
                    disabled={isSubmittingAction}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-[#f8f9ff] text-[#0b1c30] border border-[#e2e8f0] transition-colors disabled:opacity-40 cursor-pointer shadow-2xs"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[#004ac6]" />
                    Edit
                  </button>

                  <button
                    onClick={() => {
                      setRejectReason("");
                      setRejectModalOpen(true);
                    }}
                    disabled={isSubmittingAction || selectedClaim.review_state === "rejected"}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#fef2f2] hover:bg-[#fee2e2] text-[#dc2626] border border-[#fecaca] transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5 text-[#dc2626]" />
                    Reject
                  </button>
                </div>
              </div>

              {/* Verification & Substring Status Checks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-[#f8f9ff] rounded-xl border border-[#e2e8f0]">
                  <div className="flex items-center justify-between text-xs font-bold text-[#0b1c30]">
                    <span className="flex items-center gap-1.5">
                      <FileCode className="w-4 h-4 text-[#004ac6]" />
                      1. Substring Quote Check
                    </span>
                    {claimContext?.quote_found_in_original ? (
                      <span className="text-[#059669] font-bold text-[11px] bg-[#ecfdf5] border border-[#a7f3d0] px-2 py-0.5 rounded">
                        PASSED (Exact)
                      </span>
                    ) : (
                      <span className="text-[#64748b] font-semibold text-[11px] bg-[#f1f5f9] border border-[#e2e8f0] px-2 py-0.5 rounded">
                        {selectedClaim.kind === "derived" ? "Deterministic AST" : "No citation match"}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#737686] mt-1">
                    Normalized character-by-character search against original unredacted file.
                  </p>
                </div>

                <div className="p-3.5 bg-[#f8f9ff] rounded-xl border border-[#e2e8f0]">
                  <div className="flex items-center justify-between text-xs font-bold text-[#0b1c30]">
                    <span className="flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-[#4b41e1]" />
                      2. Support Check Status
                    </span>
                    <span className="text-[#004ac6] font-bold text-[11px] bg-[#e5eeff] border border-[#dce9ff] px-2 py-0.5 rounded capitalize">
                      {selectedClaim.status} ({Math.round(selectedClaim.confidence * 100)}%)
                    </span>
                  </div>
                  <p className="text-[11px] text-[#737686] mt-1">
                    Corroborated by independent claim verification audit.
                  </p>
                </div>
              </div>

              {/* Exact Source Citation & Highlighting Context */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#0b1c30]">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#d97706]" />
                    Exact Quote Highlighted in Source Chunk
                  </span>
                  {claimContext && (
                    <span className="text-[11px] text-[#737686] font-mono">
                      {claimContext.source_name} (Chunk #{claimContext.chunk_id}, L{claimContext.line_start}-{claimContext.line_end})
                    </span>
                  )}
                </div>

                {isDetailLoading ? (
                  <div className="p-8 bg-[#f8f9ff] rounded-xl border border-[#e2e8f0] text-center">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[#004ac6] border-t-transparent" />
                  </div>
                ) : claimContext && claimContext.original_text ? (
                  <div className="p-4 bg-[#0b1c30] text-[#eaf1ff] rounded-xl font-mono text-xs leading-relaxed overflow-x-auto max-h-64 border border-[#213145]">
                    {/* Render with quote highlighted */}
                    {claimContext.quote && claimContext.original_text.includes(claimContext.quote) ? (
                      (() => {
                        const quote = claimContext.quote;
                        const idx = claimContext.original_text.indexOf(quote);
                        const before = claimContext.original_text.slice(0, idx);
                        const after = claimContext.original_text.slice(idx + quote.length);
                        return (
                          <span>
                            <span>{before}</span>
                            <mark className="bg-[#facc15] text-[#0b1c30] px-1 py-0.5 rounded font-semibold font-mono">
                              {quote}
                            </mark>
                            <span>{after}</span>
                          </span>
                        );
                      })()
                    ) : (
                      <span>{claimContext.original_text}</span>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-[#f8f9ff] rounded-xl border border-[#e2e8f0] text-xs text-[#737686] italic">
                    {selectedClaim.kind === "derived"
                      ? "Derived mathematically by plain Python code from git commit logs. Direct commit chunks stored as evidence."
                      : "Source chunk context not available."}
                  </div>
                )}
              </div>

              {/* Evidence Array Breakdown */}
              {selectedClaim.evidence && selectedClaim.evidence.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-[#0b1c30]">All Evidence Citations ({selectedClaim.evidence.length})</div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {selectedClaim.evidence.map((ev, i) => (
                      <div key={i} className="text-[11px] bg-[#f8f9ff] p-2.5 rounded-lg border border-[#e2e8f0] text-[#0b1c30] font-mono">
                        {ev.quote ? (
                          <div className="text-[#004ac6] font-semibold mb-1">"{ev.quote}"</div>
                        ) : null}
                        <div className="text-[10px] text-[#737686]">
                          Source #{ev.source_id} · Chunk #{ev.chunk_id} · Lines {ev.line_start}-{ev.line_end}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Version History Audit Trail */}
              <div className="space-y-2 pt-3 border-t border-[#f1f5f9]">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#0b1c30]">
                  <History className="w-4 h-4 text-[#737686]" />
                  Version History &amp; Audit Trail
                </div>

                {claimVersions.length === 0 ? (
                  <p className="text-xs text-[#737686] italic">Version 1 (Initial extraction). No edits recorded.</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {claimVersions.map((v) => (
                      <div key={v.id} className="p-2.5 bg-[#f8f9ff] rounded-lg border border-[#e2e8f0] text-xs space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-[#0b1c30]">Version {v.version_number}</span>
                          <span className="text-[#737686]">{new Date(v.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-[#334155] text-[11px] font-medium">{v.text}</p>
                        {v.edit_note && (
                          <p className="text-[10px] text-[#004ac6] italic">Note: {v.edit_note}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-12 text-center text-[#737686] space-y-2">
              <Shield className="w-10 h-10 mx-auto text-[#cbd5e1]" />
              <h4 className="text-sm font-bold text-[#0b1c30]">Select a claim to inspect citation details</h4>
              <p className="text-xs max-w-sm mx-auto text-[#737686]">
                Inspect character-by-character substring quotes, verify corroborating evidence, and approve or reject claims.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Reject Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 bg-[#0b1c30]/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-[#cbd5e1]">
            <div className="flex items-center gap-2 text-[#ba1a1a] font-bold text-base">
              <AlertCircle className="w-5 h-5" />
              Reject Claim #{selectedClaim?.id}
            </div>
            <p className="text-xs text-[#434655]">
              Rejections require an explicit reason for the audit log. The claim will be excluded from all handovers.
            </p>
            <div>
              <label className="block text-xs font-semibold text-[#0b1c30] mb-1">Rejection Reason *</label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Outdated information, disputed by lead, or unsupported speculation."
                className="w-full text-xs p-2.5 bg-[#f8f9ff] border border-[#e2e8f0] rounded-lg focus:ring-2 focus:ring-[#ba1a1a] focus:outline-none text-[#0b1c30]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-[#434655] hover:bg-[#f1f5f9] rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={!rejectReason.trim() || isSubmittingAction}
                className="px-4 py-1.5 text-xs font-bold bg-[#ba1a1a] hover:bg-[#93000a] text-white rounded-lg disabled:opacity-40 shadow-2xs cursor-pointer"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-[#0b1c30]/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-[#cbd5e1]">
            <div className="flex items-center gap-2 text-[#004ac6] font-bold text-base">
              <Edit3 className="w-5 h-5" />
              Correct Claim #{selectedClaim?.id}
            </div>
            <p className="text-xs text-[#434655]">
              Editing increments the claim version and changes review state to <strong>corrected</strong>. An audit log record will be permanently saved.
            </p>
            <div>
              <label className="block text-xs font-semibold text-[#0b1c30] mb-1">Corrected Text *</label>
              <textarea
                rows={3}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full text-xs p-2.5 bg-[#f8f9ff] border border-[#e2e8f0] rounded-lg focus:ring-2 focus:ring-[#004ac6] focus:outline-none text-[#0b1c30]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0b1c30] mb-1">Edit Note / Explanation</label>
              <input
                type="text"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="e.g. Clarified the exact service endpoint"
                className="w-full text-xs p-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-lg focus:ring-2 focus:ring-[#004ac6] focus:outline-none text-[#0b1c30]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-[#434655] hover:bg-[#f1f5f9] rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleEditConfirm}
                disabled={!editText.trim() || isSubmittingAction}
                className="px-4 py-1.5 text-xs font-bold bg-[#004ac6] hover:bg-[#003ea8] text-white rounded-lg disabled:opacity-40 shadow-2xs cursor-pointer"
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

