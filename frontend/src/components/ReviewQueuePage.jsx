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
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200"><CheckCircle className="w-3 h-3 text-emerald-600" /> Verified</span>;
      case "inferred":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200"><AlertCircle className="w-3 h-3 text-amber-600" /> Inferred</span>;
      case "conflicting":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200"><AlertTriangle className="w-3 h-3 text-rose-600" /> Conflicting</span>;
      case "missing":
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300"><HelpCircle className="w-3 h-3 text-gray-500" /> Missing evidence</span>;
    }
  };

  const getReviewStateBadge = (state) => {
    switch (state) {
      case "approved":
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wide">Approved</span>;
      case "corrected":
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200 uppercase tracking-wide">Corrected</span>;
      case "rejected":
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wide">Rejected</span>;
      case "pending":
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wide">Pending Review</span>;
    }
  };

  const getAccessBadge = (level) => {
    switch (level) {
      case "confidential":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300 uppercase">Confidential</span>;
      case "restricted":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 uppercase">Restricted</span>;
      case "team":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-200 uppercase">Team</span>;
      case "public":
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200 uppercase">Public</span>;
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
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">Human Review Queue</h1>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              Ledger of claims extracted from team activity. Verify source citations before promoting claims to the Handover Dossier.
            </p>
          </div>
          {actionSuccessMessage && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-2 animate-fade-in">
              <Check className="w-4 h-4 text-emerald-600" />
              {actionSuccessMessage}
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total Claims</span>
            <div className="text-2xl font-black text-gray-900 mt-0.5">{stats?.total_claims ?? claims.length}</div>
            <span className="text-[10px] text-gray-400">Risk-ordered ledger</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
            <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Verified
            </span>
            <div className="text-2xl font-black text-emerald-700 mt-0.5">
              {stats?.status_breakdown?.verified ?? 0}
            </div>
            <span className="text-[10px] text-emerald-600/70">Substring cited</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
            <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Inferred
            </span>
            <div className="text-2xl font-black text-amber-700 mt-0.5">
              {stats?.status_breakdown?.inferred ?? 0}
            </div>
            <span className="text-[10px] text-amber-600/70">Partially supported</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
            <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500" /> Conflicting
            </span>
            <div className="text-2xl font-black text-rose-700 mt-0.5">
              {stats?.status_breakdown?.conflicting ?? 0}
            </div>
            <span className="text-[10px] text-rose-600/70">Disagreement flagged</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-400" /> Missing
            </span>
            <div className="text-2xl font-black text-gray-700 mt-0.5">
              {stats?.status_breakdown?.missing ?? 0}
            </div>
            <span className="text-[10px] text-gray-500/70">Needs leaver debrief</span>
          </div>

          <div className="bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-200 shadow-2xs">
            <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider">Approved</span>
            <div className="text-2xl font-black text-indigo-900 mt-0.5">{stats?.approved_count ?? 0}</div>
            <span className="text-[10px] text-indigo-600">Rejection: {stats?.rejection_rate_percent ?? 0}%</span>
          </div>
        </div>

      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg text-xs">
            {["all", "verified", "inferred", "conflicting", "missing"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md font-semibold capitalize transition-all cursor-pointer ${
                  statusFilter === st
                    ? "bg-white text-gray-900 shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
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
            className="text-xs font-semibold bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
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
            className="text-xs font-semibold bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="all">All Review States</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="corrected">Corrected</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search claims or quotes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Bulk Approve Demo Shortcut */}
        {(role === "lead" || role === "admin") && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkApproveVerified}
              disabled={isBulkApproving}
              title="Approves only Verified claims. Conflicting and Missing are always skipped."
              className="flex items-center gap-1.5 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              {isBulkApproving ? "Approving..." : "✓ Approve all Verified"}
            </button>
            <span className="text-[10px] text-gray-400 hidden sm:block">Demo shortcut · skips Conflicting &amp; Missing</span>
          </div>
        )}
      </div>

      {/* Main Split Layout: Claims List (Left) + Detail Panel (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Claims List Column */}
        <div className="lg:col-span-5 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-gray-500 px-1 font-medium">
            <span>Showing {filteredClaims.length} claims</span>
            <span className="flex items-center gap-1 text-gray-400">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              Prioritized by Risk Score
            </span>
          </div>

          {isLoading ? (
            <div className="bg-white p-12 text-center rounded-xl border border-gray-200">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent" />
              <p className="mt-2 text-xs font-semibold text-gray-600">Loading claims ledger...</p>
            </div>
          ) : filteredClaims.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-xl border border-gray-200 space-y-3">
              <p className="text-sm font-semibold text-gray-700">No claims match the selected filters.</p>
              <button
                onClick={() => {
                  setStatusFilter("all");
                  setTypeFilter("all");
                  setReviewStateFilter("all");
                  setSearchTerm("");
                }}
                className="text-xs text-indigo-600 font-bold hover:underline"
              >
                Reset all filters
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[750px] overflow-y-auto pr-1">
              {filteredClaims.map((claim) => {
                const isSelected = selectedClaim?.id === claim.id;

                if (claim.withheld) {
                  return (
                    <div
                      key={claim.id}
                      className="p-3.5 rounded-xl border border-dashed border-gray-300 bg-gray-50 text-gray-500 opacity-75"
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-gray-600">
                          <Lock className="w-3.5 h-3.5 text-amber-600" />
                          Claim #{claim.id} Withheld
                        </span>
                        {getAccessBadge(claim.access_level)}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Requires {claim.access_level} access — request from lead</p>
                    </div>
                  );
                }

                return (
                  <div
                    key={claim.id}
                    onClick={() => selectClaim(claim)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer text-left relative ${
                      isSelected
                        ? "bg-indigo-50/50 border-indigo-500 shadow-sm ring-1 ring-indigo-500"
                        : "bg-white border-gray-200 hover:border-indigo-300 hover:shadow-2xs"
                    }`}
                  >
                    {/* Header Chips */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {getStatusBadge(claim.status)}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            claim.kind === "derived"
                              ? "bg-blue-100 text-blue-800 border border-blue-200"
                              : "bg-purple-100 text-purple-800 border border-purple-200"
                          }`}
                        >
                          {claim.kind}
                        </span>
                        <span className="text-[10px] font-bold text-gray-500 uppercase px-1.5 py-0.5 rounded bg-gray-100">
                          {claim.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {getAccessBadge(claim.access_level)}
                        {getReviewStateBadge(claim.review_state)}
                      </div>
                    </div>

                    {/* Claim Text */}
                    <h4 className="text-xs font-semibold text-gray-900 leading-snug line-clamp-2">
                      {claim.text}
                    </h4>

                    {/* Source citation snippet */}
                    {claim.evidence && claim.evidence.length > 0 && claim.evidence[0].quote && (
                      <div className="mt-2 text-[11px] text-gray-500 italic bg-gray-50 px-2.5 py-1.5 rounded border border-gray-100 line-clamp-1">
                        "{claim.evidence[0].quote}"
                      </div>
                    )}

                    <div className="mt-2.5 flex items-center justify-between text-[10px] text-gray-400">
                      <span>Claim #{claim.id} · v{claim.current_version}</span>
                      <span className="font-medium text-indigo-600 hover:underline flex items-center gap-0.5">
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
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6 sticky top-24">
              {/* Detail Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Claim #{selectedClaim.id} · Version {selectedClaim.current_version}
                    </span>
                    {getAccessBadge(selectedClaim.access_level)}
                    {getReviewStateBadge(selectedClaim.review_state)}
                  </div>
                  <h3 className="text-base font-bold text-gray-900 leading-snug">
                    {selectedClaim.text}
                  </h3>
                </div>

                {/* Review Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleApprove}
                    disabled={isSubmittingAction || selectedClaim.review_state === "approved"}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors disabled:opacity-40 cursor-pointer"
                    title="Approve for inclusion in the handover dossier"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Approve
                  </button>

                  <button
                    onClick={() => {
                      setEditText(selectedClaim.text);
                      setEditNote("");
                      setEditModalOpen(true);
                    }}
                    disabled={isSubmittingAction}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit
                  </button>

                  <button
                    onClick={() => {
                      setRejectReason("");
                      setRejectModalOpen(true);
                    }}
                    disabled={isSubmittingAction || selectedClaim.review_state === "rejected"}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Reject
                  </button>
                </div>
              </div>

              {/* Verification & Substring Status Checks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                    <span className="flex items-center gap-1.5">
                      <FileCode className="w-4 h-4 text-indigo-600" />
                      1. Substring Quote Check
                    </span>
                    {claimContext?.quote_found_in_original ? (
                      <span className="text-emerald-700 font-black text-[11px] bg-emerald-100 px-2 py-0.5 rounded">
                        PASSED (Exact)
                      </span>
                    ) : (
                      <span className="text-gray-500 font-semibold text-[11px] bg-gray-200 px-2 py-0.5 rounded">
                        {selectedClaim.kind === "derived" ? "Deterministic" : "No citation match"}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Normalized character-by-character search against original unredacted file.
                  </p>
                </div>

                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                    <span className="flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-purple-600" />
                      2. Support Check Status
                    </span>
                    <span className="text-indigo-800 font-bold text-[11px] bg-indigo-100 px-2 py-0.5 rounded capitalize">
                      {selectedClaim.status} ({Math.round(selectedClaim.confidence * 100)}%)
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Corroborated by independent claim verification audit.
                  </p>
                </div>
              </div>

              {/* Exact Source Citation & Highlighting Context */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-gray-800">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Exact Quote Highlighted in Source Chunk
                  </span>
                  {claimContext && (
                    <span className="text-[11px] text-gray-500 font-mono">
                      {claimContext.source_name} (Chunk #{claimContext.chunk_id}, L{claimContext.line_start}-{claimContext.line_end})
                    </span>
                  )}
                </div>

                {isDetailLoading ? (
                  <div className="p-8 bg-gray-50 rounded-xl border border-gray-200 text-center">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent" />
                  </div>
                ) : claimContext && claimContext.original_text ? (
                  <div className="p-4 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs leading-relaxed overflow-x-auto max-h-64 border border-slate-800">
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
                            <mark className="bg-amber-400 text-slate-950 px-1 py-0.5 rounded font-bold">
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
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-500 italic">
                    {selectedClaim.kind === "derived"
                      ? "Derived mathematically by plain python code from git commit logs. Direct commit chunks stored as evidence."
                      : "Source chunk context not available."}
                  </div>
                )}
              </div>

              {/* Evidence Array Breakdown */}
              {selectedClaim.evidence && selectedClaim.evidence.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-gray-700">All Evidence Citations ({selectedClaim.evidence.length})</div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {selectedClaim.evidence.map((ev, i) => (
                      <div key={i} className="text-[11px] bg-gray-50 p-2.5 rounded-lg border border-gray-200 text-gray-700 font-mono">
                        {ev.quote ? (
                          <div className="text-indigo-900 font-semibold mb-1">"{ev.quote}"</div>
                        ) : null}
                        <div className="text-[10px] text-gray-400">
                          Source #{ev.source_id} · Chunk #{ev.chunk_id} · Lines {ev.line_start}-{ev.line_end}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Version History Audit Trail */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
                  <History className="w-4 h-4 text-gray-500" />
                  Version History & Audit Trail
                </div>

                {claimVersions.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Version 1 (Initial extraction). No edits recorded.</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {claimVersions.map((v) => (
                      <div key={v.id} className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 text-xs space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-gray-700">Version {v.version_number}</span>
                          <span className="text-gray-400">{new Date(v.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-gray-800 text-[11px] font-medium">{v.text}</p>
                        {v.edit_note && (
                          <p className="text-[10px] text-indigo-600 italic">Note: {v.edit_note}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400 space-y-2">
              <Shield className="w-10 h-10 mx-auto text-gray-300" />
              <h4 className="text-sm font-bold text-gray-700">Select a claim to inspect citation details</h4>
              <p className="text-xs max-w-sm mx-auto text-gray-400">
                Inspect character-by-character substring quotes, verify corroborating evidence, and approve or reject claims.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Reject Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-200">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-base">
              <AlertCircle className="w-5 h-5" />
              Reject Claim #{selectedClaim?.id}
            </div>
            <p className="text-xs text-gray-600">
              Rejections require an explicit reason for the audit log. The claim will be excluded from all handovers.
            </p>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Rejection Reason *</label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Outdated information, disputed by lead, or unsupported speculation."
                className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={!rejectReason.trim() || isSubmittingAction}
                className="px-4 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg disabled:opacity-40 shadow-xs cursor-pointer"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-gray-200">
            <div className="flex items-center gap-2 text-indigo-700 font-bold text-base">
              <Edit3 className="w-5 h-5" />
              Correct Claim #{selectedClaim?.id}
            </div>
            <p className="text-xs text-gray-600">
              Editing increments the claim version and changes review state to <strong>corrected</strong>. An audit log record will be permanently saved.
            </p>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Corrected Text *</label>
              <textarea
                rows={3}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Edit Note / Explanation</label>
              <input
                type="text"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="e.g. Clarified the exact service endpoint"
                className="w-full text-xs p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleEditConfirm}
                disabled={!editText.trim() || isSubmittingAction}
                className="px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-40 shadow-xs cursor-pointer"
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

