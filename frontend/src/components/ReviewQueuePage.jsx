import React, { useState, useEffect } from "react";
import {
  CheckCircle, AlertCircle, HelpCircle, Shield, Edit3, XCircle,
  Check, Search, History, FileCode, ChevronRight, Sparkles, Lock,
  Flame, AlertTriangle, ChevronDown, ChevronUp, ArrowRight,
} from "lucide-react";
import { api } from "../api";

// ── Status chip with tooltip ────────────────────────────────────────────────
const STATUS_META = {
  verified: {
    color: "bg-emerald-100 text-emerald-900 border-emerald-300",
    icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />,
    tip: "Verified: Quote found verbatim in source file and confirmed by an independent verification check.",
  },
  inferred: {
    color: "bg-amber-100 text-amber-900 border-amber-300",
    icon: <AlertCircle className="w-3.5 h-3.5 text-amber-600" />,
    tip: "Inferred: Quote found in source, but support check only partially agreed. Treat with caution.",
  },
  conflicting: {
    color: "bg-rose-100 text-rose-900 border-rose-300",
    icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />,
    tip: "Conflicting: Two sources disagree on this topic. Both citations are preserved.",
  },
  missing: {
    color: "bg-gray-100 text-gray-800 border-gray-300",
    icon: <HelpCircle className="w-3.5 h-3.5 text-gray-500" />,
    tip: "Missing evidence: No direct source quote could be verified. Phrased as a question for the leaver.",
  },
};

function StatusChip({ status }) {
  const m = STATUS_META[status] || STATUS_META.missing;
  const label = status === "missing" ? "Missing evidence" : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span
      title={m.tip}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border cursor-help transition-all hover:scale-105 ${m.color}`}
    >
      {m.icon} {label}
    </span>
  );
}

function ReviewStateBadge({ state }) {
  const map = {
    approved:  "bg-emerald-50 text-emerald-700 border-emerald-200",
    corrected: "bg-sky-50 text-sky-700 border-sky-200",
    rejected:  "bg-rose-50 text-rose-700 border-rose-200",
    pending:   "bg-amber-50 text-amber-700 border-amber-200",
  };
  const cls = map[state] || map.pending;
  return (
    <span className={`px-2 py-0.5 rounded text-[11px] font-bold border uppercase tracking-wider ${cls}`}>
      {state || "pending"}
    </span>
  );
}

function AccessBadge({ level }) {
  const map = {
    confidential: "bg-purple-100 text-purple-900 border-purple-300",
    restricted:   "bg-amber-100 text-amber-900 border-amber-300",
    team:         "bg-blue-100 text-blue-900 border-blue-200",
    public:       "bg-gray-100 text-gray-700 border-gray-200",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[11px] font-bold border uppercase tracking-wider ${map[level] || map.public}`}>
      {level || "public"}
    </span>
  );
}

function HelpPanel({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-2xl bg-white shadow-xs overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-[15px] font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-indigo-600" />
          What am I looking at?
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="px-5 pb-5 text-[15px] text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
          {children}
        </div>
      )}
    </div>
  );
}

export default function ReviewQueuePage({ stats, onRefreshStats, setActiveTab }) {
  const role = "lead"; // Check-claims page is always "Reviewer (lead)"

  const [claims, setClaims]           = useState([]);
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState(null);

  const [statusFilter, setStatusFilter]           = useState("all");
  const [typeFilter, setTypeFilter]               = useState("all");
  const [reviewStateFilter, setReviewStateFilter] = useState("all");
  const [searchTerm, setSearchTerm]               = useState("");

  const [selectedClaim, setSelectedClaim]   = useState(null);
  const [claimContext, setClaimContext]      = useState(null);
  const [claimVersions, setClaimVersions]   = useState([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason]       = useState("");
  const [editModalOpen, setEditModalOpen]     = useState(false);
  const [editText, setEditText]               = useState("");
  const [editNote, setEditNote]               = useState("");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState(null);
  const [isBulkApproving, setIsBulkApproving] = useState(false);

  const loadClaims = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getClaims({ projectId: 1, role, status: statusFilter, type: typeFilter, reviewState: reviewStateFilter });
      setClaims(data || []);
      if (data && data.length > 0 && !selectedClaim) selectClaim(data[0]);
      else if (selectedClaim) {
        const updated = data.find((c) => c.id === selectedClaim.id);
        if (updated) setSelectedClaim(updated);
      }
    } catch (err) {
      setError(err.message || "Failed to load claims");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadClaims(); }, [role, statusFilter, typeFilter, reviewStateFilter]);

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
    } finally {
      setIsDetailLoading(false);
    }
  };

  const toast = (msg) => { setActionSuccessMessage(msg); setTimeout(() => setActionSuccessMessage(null), 4000); };

  const handleApprove = async () => {
    if (!selectedClaim) return;
    setIsSubmittingAction(true);
    try {
      await api.approveClaim(selectedClaim.id, { role, note: "Approved by Reviewer (lead)" });
      toast(`Claim #${selectedClaim.id} approved!`);
      await loadClaims(); onRefreshStats();
      const vers = await api.getClaimVersions(selectedClaim.id).catch(() => []);
      setClaimVersions(vers);
    } catch (err) { alert("Approve failed: " + err.message); }
    finally { setIsSubmittingAction(false); }
  };

  const handleRejectConfirm = async () => {
    if (!selectedClaim || !rejectReason.trim()) return;
    setIsSubmittingAction(true);
    try {
      await api.rejectClaim(selectedClaim.id, { role, reason: rejectReason.trim() });
      setRejectModalOpen(false); setRejectReason("");
      toast(`Claim #${selectedClaim.id} rejected.`);
      await loadClaims(); onRefreshStats();
    } catch (err) { alert("Reject failed: " + err.message); }
    finally { setIsSubmittingAction(false); }
  };

  const handleEditConfirm = async () => {
    if (!selectedClaim || !editText.trim()) return;
    setIsSubmittingAction(true);
    try {
      await api.editClaim(selectedClaim.id, { role, correctedText: editText.trim(), note: editNote.trim() || undefined });
      setEditModalOpen(false);
      toast(`Claim #${selectedClaim.id} corrected (new version saved).`);
      await loadClaims(); onRefreshStats();
      const vers = await api.getClaimVersions(selectedClaim.id).catch(() => []);
      setClaimVersions(vers);
    } catch (err) { alert("Edit failed: " + err.message); }
    finally { setIsSubmittingAction(false); }
  };

  const handleBulkApproveVerified = async () => {
    if (!window.confirm("Approve all Verified claims? Conflicting and Missing claims will be skipped.")) return;
    setIsBulkApproving(true);
    try {
      const result = await api.bulkApproveVerified({ projectId: 1, role });
      const count = result?.approved_count ?? 0;
      toast(`Bulk approved ${count} Verified claim${count !== 1 ? "s" : ""} (Conflicting & Missing skipped).`);
      await loadClaims(); onRefreshStats();
    } catch (err) { alert("Bulk approve failed: " + err.message); }
    finally { setIsBulkApproving(false); }
  };

  const filteredClaims = claims.filter((c) => {
    if (!searchTerm.trim()) return true;
    const t = searchTerm.toLowerCase();
    return (c.text?.toLowerCase().includes(t) || c.type?.toLowerCase().includes(t) || c.status?.toLowerCase().includes(t));
  });

  const verifiedCount   = stats?.status_breakdown?.verified ?? 0;
  const approvedCount   = stats?.approved_count ?? 0;
  const pendingApproval = claims.filter((c) => c.status === "verified" && c.review_state === "pending").length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-4">

      {/* Page heading with NEXT STEP main button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">Check the claims</h1>
          <p className="text-[15px] text-gray-600 mt-1">
            Simulated role: <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200">Reviewer (lead)</span>. Inspect source quotes before approving claims into the handover dossier.
          </p>
        </div>

        {/* ONE OBVIOUS MAIN BUTTON FOR NEXT STEP */}
        <button
          onClick={() => setActiveTab?.("handover")}
          className="flex items-center gap-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl text-[15px] shadow-sm hover:shadow-md transition-all transform active:scale-95 cursor-pointer shrink-0"
        >
          <span>Next: Handover for the new person</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {actionSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-950 text-[15px] font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          {actionSuccessMessage}
        </div>
      )}

      {/* Collapsible Help Panel */}
      <HelpPanel>
        <p>
          This ledger holds every claim extracted from git history and meeting notes, sorted by risk score.
          You can inspect exact source quotes and approve claims so they are included in the final handover plan.
        </p>
      </HelpPanel>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total claims", value: stats?.total_claims ?? claims.length, color: "text-gray-900" },
          { label: "Verified claims", value: verifiedCount, color: "text-emerald-700" },
          { label: "Approved claims", value: approvedCount, color: "text-indigo-700" },
          { label: "Rejection rate", value: `${stats?.rejection_rate_percent ?? 0}%`, color: "text-rose-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-black mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Bulk approve demo shortcut */}
      {pendingApproval > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-[15px] text-indigo-900 leading-normal">
            <strong>{pendingApproval} Verified claims</strong> are waiting for approval. Approve all at once for demo speed, or review individually below.
          </p>
          <button
            onClick={handleBulkApproveVerified}
            disabled={isBulkApproving}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50 shrink-0"
          >
            <Check className="w-4 h-4" />
            {isBulkApproving ? "Approving..." : `Approve all ${pendingApproval} Verified`}
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-sm">
          {["all", "verified", "inferred", "conflicting", "missing"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg font-semibold capitalize transition-all cursor-pointer ${
                statusFilter === st ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {st === "missing" ? "Missing evidence" : st}
            </button>
          ))}
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="text-sm font-semibold bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
        >
          <option value="all">All types</option>
          {["owner","decision","blocker","risk","dependency","open_question","next_action","contact"].map((t) => (
            <option key={t} value={t}>{t.replace("_", " ")}</option>
          ))}
        </select>

        <select
          value={reviewStateFilter}
          onChange={(e) => setReviewStateFilter(e.target.value)}
          className="text-sm font-semibold bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
        >
          <option value="all">All review states</option>
          {["pending","approved","corrected","rejected"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <div className="relative ml-auto w-full sm:w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search claims or quotes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Split layout: Claims List + Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Claims List */}
        <div className="lg:col-span-5 space-y-2.5">
          <div className="flex items-center justify-between text-sm text-gray-500 px-1 font-medium">
            <span>Showing {filteredClaims.length} claims</span>
            <span className="flex items-center gap-1 text-gray-400 text-xs">
              <Flame className="w-3.5 h-3.5 text-amber-500" /> Ordered by risk score
            </span>
          </div>

          {isLoading ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-gray-200">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent" />
              <p className="mt-3 text-sm text-gray-500 font-medium">Loading claims ledger...</p>
            </div>
          ) : error ? (
            <div className="bg-rose-50 border border-rose-200 p-6 rounded-2xl text-[15px] text-rose-800 text-center space-y-2">
              <p className="font-semibold">Could not load claims</p>
              <p className="text-xs">{error}</p>
              <button onClick={loadClaims} className="text-indigo-600 font-bold hover:underline text-sm cursor-pointer">Retry</button>
            </div>
          ) : filteredClaims.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-gray-200 space-y-4">
              <p className="text-[15px] font-semibold text-gray-700">No claims match the selected filters.</p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => { setStatusFilter("all"); setTypeFilter("all"); setReviewStateFilter("all"); setSearchTerm(""); }}
                  className="text-sm text-indigo-600 font-bold hover:underline cursor-pointer"
                >
                  Clear all filters
                </button>
                <span className="text-gray-300">·</span>
                <button
                  onClick={() => setActiveTab?.("handover")}
                  className="inline-flex items-center gap-1.5 bg-indigo-600 text-white text-sm font-bold px-4 py-2 rounded-xl cursor-pointer hover:bg-indigo-700 transition-colors"
                >
                  Go to Step 3: Handover →
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[720px] overflow-y-auto pr-1">
              {filteredClaims.map((claim) => {
                const isSelected = selectedClaim?.id === claim.id;
                if (claim.withheld) {
                  return (
                    <div key={claim.id} className="p-4 rounded-xl border border-dashed border-gray-300 bg-gray-50">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-semibold text-gray-500">Hidden: you don't have access</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Requires {claim.access_level} access — ask your lead</p>
                    </div>
                  );
                }
                return (
                  <div
                    key={claim.id}
                    onClick={() => selectClaim(claim)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-indigo-50/60 border-indigo-500 ring-2 ring-indigo-200 shadow-sm"
                        : "bg-white border-gray-200 hover:border-indigo-300 hover:shadow-xs"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <StatusChip status={claim.status} />
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                        claim.kind === "derived" ? "bg-blue-100 text-blue-800 border-blue-200" : "bg-purple-100 text-purple-800 border-purple-200"
                      }`}>{claim.kind}</span>
                      <span className="text-[11px] font-bold text-gray-500 uppercase px-1.5 py-0.5 rounded bg-gray-100">{claim.type}</span>
                      <span className="ml-auto"><ReviewStateBadge state={claim.review_state} /></span>
                    </div>

                    <p className="text-[15px] font-semibold text-gray-900 leading-snug">{claim.text}</p>

                    {claim.evidence?.[0]?.quote && (
                      <p className="mt-2 text-xs text-gray-600 italic bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 line-clamp-1">
                        "{claim.evidence[0].quote}"
                      </p>
                    )}

                    <div className="mt-2.5 flex items-center justify-between text-xs text-gray-400">
                      <span>#{claim.id} · v{claim.current_version}</span>
                      <span className="text-indigo-600 font-semibold flex items-center gap-0.5">
                        Inspect quote <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-7">
          {selectedClaim && !selectedClaim.withheld ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-6 sticky top-28">
              {/* Header + Review Actions */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-gray-100 pb-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap text-xs text-gray-400 font-medium">
                    <span>Claim #{selectedClaim.id} · v{selectedClaim.current_version}</span>
                    <AccessBadge level={selectedClaim.access_level} />
                    <ReviewStateBadge state={selectedClaim.review_state} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 leading-snug">{selectedClaim.text}</h3>
                  <div className="pt-0.5">
                    <StatusChip status={selectedClaim.status} />
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleApprove}
                    disabled={isSubmittingAction || selectedClaim.review_state === "approved"}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    <Check className="w-4 h-4" /> Approve
                  </button>
                  <button
                    onClick={() => { setEditText(selectedClaim.text); setEditNote(""); setEditModalOpen(true); }}
                    disabled={isSubmittingAction}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" /> Edit
                  </button>
                  <button
                    onClick={() => { setRejectReason(""); setRejectModalOpen(true); }}
                    disabled={isSubmittingAction || selectedClaim.review_state === "rejected"}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>

              {/* Verification checks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between text-sm font-bold text-gray-700 mb-1">
                    <span className="flex items-center gap-1.5"><FileCode className="w-4 h-4 text-indigo-600" /> 1. Substring check</span>
                    {claimContext?.quote_found_in_original
                      ? <span className="text-emerald-700 text-xs font-black bg-emerald-100 px-2 py-0.5 rounded">Exact match</span>
                      : <span className="text-gray-500 text-xs font-semibold bg-gray-200 px-2 py-0.5 rounded">
                          {selectedClaim.kind === "derived" ? "Derived by code" : "No match"}
                        </span>
                    }
                  </div>
                  <p className="text-xs text-gray-500">Character-by-character search against unredacted source file.</p>
                </div>
                <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between text-sm font-bold text-gray-700 mb-1">
                    <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-purple-600" /> 2. Support check</span>
                    <span className="text-indigo-800 text-xs font-bold bg-indigo-100 px-2 py-0.5 rounded capitalize">
                      {selectedClaim.status} ({Math.round(selectedClaim.confidence * 100)}%)
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">Independent claim corroboration check.</p>
                </div>
              </div>

              {/* Source quote highlighted */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-bold text-gray-800">
                  <span className="flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-amber-500" /> Exact quote in source chunk</span>
                  {claimContext && (
                    <span className="text-xs text-gray-500 font-mono">
                      {claimContext.source_name} · chunk #{claimContext.chunk_id}
                    </span>
                  )}
                </div>
                {isDetailLoading ? (
                  <div className="p-8 bg-gray-50 rounded-xl border border-gray-200 text-center">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent" />
                  </div>
                ) : claimContext?.original_text ? (
                  <div className="p-4 bg-slate-900 text-slate-100 rounded-xl font-mono text-sm leading-relaxed overflow-x-auto max-h-56 border border-slate-800">
                    {claimContext.quote && claimContext.original_text.includes(claimContext.quote) ? (() => {
                      const q = claimContext.quote;
                      const i = claimContext.original_text.indexOf(q);
                      return (
                        <span>
                          {claimContext.original_text.slice(0, i)}
                          <mark className="bg-amber-400 text-slate-950 px-1 py-0.5 rounded font-bold">{q}</mark>
                          {claimContext.original_text.slice(i + q.length)}
                        </span>
                      );
                    })() : <span>{claimContext.original_text}</span>}
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-500 italic">
                    {selectedClaim.kind === "derived"
                      ? "Derived by plain Python code from git logs without an LLM."
                      : "Source chunk preview not available."}
                  </div>
                )}
              </div>

              {/* Version history */}
              <div className="space-y-2 pt-3 border-t border-gray-100">
                <p className="flex items-center gap-1.5 text-sm font-bold text-gray-700">
                  <History className="w-4 h-4 text-gray-400" /> Version history
                </p>
                {claimVersions.length === 0
                  ? <p className="text-xs text-gray-400 italic">Version 1 (Initial extraction). No edits yet.</p>
                  : (
                    <div className="space-y-2 max-h-36 overflow-y-auto">
                      {claimVersions.map((v) => (
                        <div key={v.id} className="p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm space-y-1">
                          <div className="flex items-center justify-between text-xs text-gray-400">
                            <span className="font-bold text-gray-700">v{v.version_number}</span>
                            <span>{new Date(v.created_at).toLocaleString()}</span>
                          </div>
                          <p className="text-gray-800 font-medium text-xs">{v.text}</p>
                          {v.edit_note && <p className="text-[11px] text-indigo-600 italic">Note: {v.edit_note}</p>}
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-4">
              <Shield className="w-10 h-10 mx-auto text-gray-300" />
              <div>
                <h4 className="text-base font-bold text-gray-700">Select a claim to review</h4>
                <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
                  Click any claim on the left to inspect its substring quote, review check results, or approve it.
                </p>
              </div>
              <button
                onClick={() => setActiveTab?.("handover")}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[15px] font-bold px-6 py-3 rounded-xl cursor-pointer transition-colors shadow-xs"
              >
                Next: Handover for the new person <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Reject modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-200">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-base">
              <AlertCircle className="w-5 h-5" /> Reject Claim #{selectedClaim?.id}
            </div>
            <p className="text-sm text-gray-600">The rejection reason is permanently stored in the audit log.</p>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Reason *</label>
              <textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Outdated information or disputed by lead."
                className="w-full text-sm p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setRejectModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer">Cancel</button>
              <button onClick={handleRejectConfirm} disabled={!rejectReason.trim() || isSubmittingAction}
                className="px-4 py-2 text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl disabled:opacity-40 cursor-pointer">
                Confirm rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-gray-200">
            <div className="flex items-center gap-2 text-indigo-700 font-bold text-base">
              <Edit3 className="w-5 h-5" /> Correct Claim #{selectedClaim?.id}
            </div>
            <p className="text-sm text-gray-600">Editing saves an updated version and logs the change in the audit trail.</p>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Corrected text *</label>
              <textarea rows={3} value={editText} onChange={(e) => setEditText(e.target.value)}
                className="w-full text-sm p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Edit note (optional)</label>
              <input type="text" value={editNote} onChange={(e) => setEditNote(e.target.value)}
                placeholder="e.g. Clarified the exact service name"
                className="w-full text-sm p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer">Cancel</button>
              <button onClick={handleEditConfirm} disabled={!editText.trim() || isSubmittingAction}
                className="px-4 py-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl disabled:opacity-40 cursor-pointer">
                Save correction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
