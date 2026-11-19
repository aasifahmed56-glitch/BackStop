import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Check, X, PencilLine, Search, Copy, Link2, Lock, Code2, ArrowLeftRight, ChevronDown, CheckCheck, RotateCw, History,
} from "lucide-react";
import { api, formatErrorMessage } from "../api";
import { STATUS, REVIEW, humanize, StatusChip, Field, Button, Dialog, TextArea, TextInput, TallyStrip, Skeleton, Slip, AccessChip } from "./ui";

const isSeeded = (claim) => (claim?.evidence || []).some((ev) => ev.origin === "seeded");
const kindLabel = (claim) => (isSeeded(claim) ? "Seeded fixture" : claim.kind === "derived" ? "Calculated by code" : claim.kind === "debrief" ? "Told in the debrief" : claim.kind === "rule" ? "Found by keyword rule" : "Extracted by AI");
const kindHelp = (claim) => {
  if (isSeeded(claim)) return "Hand-written demo claim for the synthetic sample. Its quote is checked, but no AI produced it.";
  if (claim.kind === "derived") return "Calculated by plain code from git history, tasks or notes. No AI involved.";
  if (claim.kind === "rule") return "A published keyword rule matched this sentence in the records. The quote is the sentence word for word; decide whether it is still true and matters.";
  if (claim.kind === "debrief") return "Said by the person leaving in the debrief and typed in by the lead. The quote is their words; check it before approving.";
  return "Extracted by an AI model, then checked: the quote must exist in the source and support the claim.";
};

const REVIEW_FILTERS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Not checked" },
  { id: "decided", label: "Decided" },
];

function ReviewMark({ state }) {
  const r = REVIEW[state] || REVIEW.pending;
  const Icon = state === "approved" ? Check : state === "rejected" ? X : state === "corrected" ? PencilLine : null;
  return (
    <span className={`inline-flex items-center gap-1 text-[12px] font-semibold whitespace-nowrap ${r.text}`}>
      {Icon ? <Icon size={13} strokeWidth={2.5} aria-hidden="true" /> : <span aria-hidden="true" className="w-2 h-2 rounded-full border-[1.5px] border-current" />}
      {r.label}
    </span>
  );
}

/* Source excerpt with a line-number gutter; the quote is highlighted canary where it sits. */
function SourceExcerpt({ text, quote, lineStart }) {
  const lines = (text || "").split("\n");
  const idx = quote ? text.indexOf(quote) : -1;
  const starts = lines.reduce((acc, l, i) => (i === 0 ? [0] : [...acc, acc[i - 1] + lines[i - 1].length + 1]), []);
  return (
    <div className="font-mono text-[12.5px] leading-[20px] bg-surface-container-low border-y border-outline-variant py-2 pr-3 max-h-56 overflow-auto">
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((line, i) => {
            const start = starts[i];
            const end = start + line.length;
            let content = line || " ";
            if (idx !== -1 && idx < end && idx + quote.length > start) {
              const a = Math.max(idx, start) - start;
              const b = Math.min(idx + quote.length, end) - start;
              content = (
                <>
                  {line.slice(0, a)}
                  <mark className="bg-canary text-on-canary rounded-[1px] px-px">{line.slice(a, b)}</mark>
                  {line.slice(b)}
                </>
              );
            }
            return (
              <tr key={i}>
                <td className="select-none text-right align-top pl-2 pr-3 text-outline tnum border-r border-outline-variant w-10">
                  {(lineStart || 1) + i}
                </td>
                <td className="pl-3 pr-3 whitespace-pre-wrap break-words text-on-surface">{content}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ReviewQueuePage({ onRefreshStats, initialClaimId, onSelectClaimId, leaverName, setActiveTab }) {
  const projectLeaver = leaverName || "the person leaving";
  const [claims, setClaims] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [statusFilter, setStatusFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [selectedId, setSelectedId] = useState(initialClaimId ?? null);
  const [claimContext, setClaimContext] = useState(null);
  const [, setClaimVersions] = useState([]);
  const [claimLogs, setClaimLogs] = useState([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const [dialog, setDialog] = useState(null); // "reject" | "edit" | "conflict" | "bulk"
  const [rejectReason, setRejectReason] = useState("");
  const [editText, setEditText] = useState("");
  const [editNote, setEditNote] = useState("");
  const [conflictNote, setConflictNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [copied, setCopied] = useState(null);

  const searchRef = useRef(null);
  const detailReq = useRef(0);
  const listRef = useRef(null);

  const flash = (n, ms = 3500) => {
    setNotice(n);
    if (ms) setTimeout(() => setNotice((cur) => (cur === n ? null : cur)), ms);
  };

  const loadClaims = useCallback(async () => {
    setError(null);
    try {
      const data = await api.getClaims({ role: "lead" });
      setClaims(Array.isArray(data) ? data : []);
      return Array.isArray(data) ? data : [];
    } catch (err) {
      setError(formatErrorMessage(err));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClaims();
  }, [loadClaims]);

  const selectedClaim = useMemo(() => claims.find((c) => c.id === selectedId) || null, [claims, selectedId]);

  const loadDetail = useCallback(async (claim) => {
    const req = ++detailReq.current;
    setClaimContext(null);
    setClaimVersions([]);
    setClaimLogs([]);
    if (!claim || claim.withheld) {
      setIsDetailLoading(false);
      return;
    }
    setIsDetailLoading(true);
    const [ctx, vers] = await Promise.all([
      api.getClaimContext(claim.id).catch(() => null),
      api.getClaimVersions(claim.id).catch(() => null),
    ]);
    if (req !== detailReq.current) return; // a newer selection won
    setClaimContext(ctx);
    setClaimVersions(vers?.versions || []);
    setClaimLogs(vers?.audit_logs || []);
    setIsDetailLoading(false);
  }, []);

  const typeOptions = useMemo(() => [...new Set(claims.map((c) => c.type).filter(Boolean))].sort(), [claims]);

  const filteredClaims = useMemo(() => {
    const q = searchTerm.trim().toLowerCase().replace(/^#/, "");
    return claims.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (kindFilter !== "all" && c.kind !== kindFilter) return false;
      if (typeFilter !== "all" && c.type !== typeFilter) return false;
      if (reviewFilter === "pending" && c.review_state !== "pending") return false;
      if (reviewFilter === "decided" && c.review_state === "pending") return false;
      if (q) {
        const hay = `${c.id} ${c.text || ""} ${c.type || ""} ${(c.evidence || []).map((e) => e.quote).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [claims, statusFilter, kindFilter, typeFilter, reviewFilter, searchTerm]);

  const filtersActive = statusFilter !== "all" || kindFilter !== "all" || typeFilter !== "all" || reviewFilter !== "all" || searchTerm;
  const clearFilters = () => {
    setStatusFilter("all");
    setKindFilter("all");
    setTypeFilter("all");
    setReviewFilter("all");
    setSearchTerm("");
  };

  const select = useCallback(
    (claim, { reveal = false } = {}) => {
      if (!claim) return;
      setSelectedId(claim.id);
      onSelectClaimId?.(claim.id);
      loadDetail(claim);
      requestAnimationFrame(() => {
        document.getElementById(`claim-row-${claim.id}`)?.scrollIntoView({ block: "nearest" });
        if (reveal && window.matchMedia("(max-width: 1023px)").matches) {
          document.getElementById("inspect-claim-header")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    },
    [loadDetail, onSelectClaimId]
  );

  // First load: open the claim in the address, else the first one.
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current || !claims.length) return;
    didInit.current = true;
    const fromHash = initialClaimId ? claims.find((c) => c.id === initialClaimId) : null;
    if (initialClaimId && !fromHash) flash({ tone: "warn", text: `Claim #${initialClaimId} does not exist. Showing the first claim instead.` }, 5000);
    select(fromHash || claims[0]);
  }, [claims, initialClaimId, select]);

  const step = useCallback(
    (dir) => {
      if (!filteredClaims.length) return;
      const i = filteredClaims.findIndex((c) => c.id === selectedId);
      const next = i === -1 ? filteredClaims[0] : filteredClaims[Math.min(filteredClaims.length - 1, Math.max(0, i + dir))];
      select(next);
    },
    [filteredClaims, selectedId, select]
  );

  const nextUnchecked = (list, fromId) => {
    const i = list.findIndex((c) => c.id === fromId);
    const after = list.slice(i + 1).concat(list.slice(0, Math.max(0, i)));
    return after.find((c) => c.review_state === "pending" && c.id !== fromId) || null;
  };

  const afterDecision = async (claimId, message, { advance = false } = {}) => {
    // Pick the next line from the order the reviewer was looking at, before the list re-sorts.
    const candidate = advance ? nextUnchecked(filteredClaims, claimId) : null;
    const fresh = await loadClaims();
    onRefreshStats?.();
    flash({ tone: "ok", text: message });
    if (!fresh) return;
    const next = candidate ? fresh.find((c) => c.id === candidate.id && c.review_state === "pending") : null;
    if (next) {
      select(next);
      requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById("inspect-claim-header")?.focus({ preventScroll: true })));
    }
    else {
      const vers = await api.getClaimVersions(claimId).catch(() => null);
      setClaimVersions(vers?.versions || []);
      setClaimLogs(vers?.audit_logs || []);
    }
  };

  const runApprove = async (note) => {
    if (!selectedClaim || busy) return;
    const id = selectedClaim.id;
    setBusy(true);
    try {
      await api.approveClaim(id, { role: "lead", note });
      setDialog(null);
      await afterDecision(id, `Claim #${id} approved.`, { advance: true });
    } catch (err) {
      flash({ tone: "error", text: "Approve failed: " + formatErrorMessage(err) }, 0);
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = () => {
    if (!selectedClaim || busy || selectedClaim.withheld) return;
    if (selectedClaim.review_state === "approved") return;
    if (selectedClaim.status === "conflicting") {
      setConflictNote("");
      setDialog("conflict");
      return;
    }
    runApprove("Approved in the review queue");
  };

  const openReject = () => {
    if (!selectedClaim || busy || selectedClaim.withheld) return;
    setRejectReason("");
    setDialog("reject");
  };
  const openEdit = () => {
    if (!selectedClaim || busy || selectedClaim.withheld) return;
    setEditText(selectedClaim.text || "");
    setEditNote("");
    setDialog("edit");
  };

  const handleRejectConfirm = async () => {
    const reason = rejectReason.trim();
    if (!selectedClaim || !reason || busy) return;
    const id = selectedClaim.id;
    setBusy(true);
    try {
      await api.rejectClaim(id, { role: "lead", reason });
      setDialog(null);
      await afterDecision(id, `Claim #${id} rejected.`, { advance: true });
    } catch (err) {
      flash({ tone: "error", text: "Reject failed: " + formatErrorMessage(err) }, 0);
    } finally {
      setBusy(false);
    }
  };

  const editUnchanged = selectedClaim && editText.trim() === (selectedClaim.text || "").trim();
  const handleEditConfirm = async () => {
    if (!selectedClaim || !editText.trim() || editUnchanged || busy) return;
    const id = selectedClaim.id;
    setBusy(true);
    try {
      await api.editClaim(id, { role: "lead", correctedText: editText.trim(), note: editNote.trim() || undefined });
      setDialog(null);
      await afterDecision(id, `Claim #${id} corrected. A new version was recorded.`);
    } catch (err) {
      flash({ tone: "error", text: "Correction failed: " + formatErrorMessage(err) }, 0);
    } finally {
      setBusy(false);
    }
  };

  const pendingVerified = claims.filter((c) => c.status === "verified" && c.review_state === "pending").length;
  const handleBulk = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api.bulkApproveVerified({ role: "lead" });
      setDialog(null);
      const n = res?.approved ?? res?.count ?? pendingVerified;
      await loadClaims();
      onRefreshStats?.();
      flash({ tone: "ok", text: `${n} quote-matched claim${n === 1 ? "" : "s"} approved. Conflicting, inferred and missing claims still need a person.` }, 5000);
    } catch (err) {
      flash({ tone: "error", text: "Bulk approve failed: " + formatErrorMessage(err) }, 0);
    } finally {
      setBusy(false);
    }
  };

  const copy = async (what, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      flash({ tone: "warn", text: "Copy is blocked in this browser. Select the text and copy it by hand." });
    }
  };

  // Keyboard: J/K move, A/E/R act, / searches. Off while typing or while a dialog is open.
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) {
        if (e.key === "Escape" && t === searchRef.current) t.blur();
        return;
      }
      if (document.querySelector("dialog[open]")) return;
      const k = e.key.toLowerCase();
      const inList = !!(t && t.closest && t.closest("#claims-ledger-container"));
      if (k === "j" || (e.key === "ArrowDown" && inList)) { e.preventDefault(); step(1); }
      else if (k === "k" || (e.key === "ArrowUp" && inList)) { e.preventDefault(); step(-1); }
      else if (k === "a") { e.preventDefault(); handleApprove(); }
      else if (k === "r") { e.preventDefault(); openReject(); }
      else if (k === "e") { e.preventDefault(); openEdit(); }
      else if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const count = (key, val) => claims.filter((c) => c[key] === val).length;
  const contexts = claimContext?.contexts || [];

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading claims">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-10 w-full" />
        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 flex flex-col gap-2">{Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-20" />)}</div>
          <Skeleton className="lg:col-span-7 h-[480px]" />
        </div>
      </div>
    );
  }

  if (error && !claims.length) {
    return (
      <div role="alert" className="panel max-w-xl mx-auto mt-10 p-6 flex flex-col gap-3">
        <h1 className="text-[20px] font-bold">The claims could not be loaded</h1>
        <p className="text-[14px] text-on-surface-variant">{error}. The server may still be waking up.</p>
        <div><Button variant="primary" onClick={() => { setIsLoading(true); loadClaims(); }}><RotateCw size={15} aria-hidden="true" />Try again</Button></div>
      </div>
    );
  }

  if (!claims.length) {
    return (
      <div className="panel max-w-xl mx-auto mt-10 p-6 flex flex-col gap-3">
        <h1 className="text-[20px] font-bold">No claims to check yet</h1>
        <p className="text-[14px] text-on-surface-variant">
          Add records to this project and build claims on the Records page. For the sample, use <strong>Reset sample</strong> in the More menu in the top bar.
        </p>
        <Button variant="primary" className="self-start" onClick={() => setActiveTab?.("records")}>
          Go to records
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-[26px] sm:text-[28px] leading-tight font-extrabold tracking-[-0.015em]">Check the claims</h1>
          <p className="text-[15px] leading-6 text-on-surface-variant mt-1.5">
            Each claim is something Backstop believes {projectLeaver} knew. Read its proof, then approve, correct or reject it. Only approved claims reach the handover.
          </p>
        </div>
        <div className="flex flex-col items-start lg:items-end gap-1.5 shrink-0">
          <Button id="approve-all-btn" variant="outline" onClick={() => setDialog("bulk")} disabled={busy || pendingVerified === 0}>
            <CheckCheck size={16} aria-hidden="true" />
            {pendingVerified === 0 ? "All quote-matched claims approved" : `Approve all quote-matched (${pendingVerified})`}
          </Button>
          <span className="text-[12px] text-on-surface-variant">Conflicting, inferred and missing claims always need a person.</span>
        </div>
      </div>

      {/* Signature: the manifest tally */}
      <div className="panel px-4 py-3">
        <TallyStrip claims={claims} selectedId={selectedId} onSelect={(c) => select(c, { reveal: true })} />
      </div>

      {notice && (
        <div
          role={notice.tone === "error" ? "alert" : "status"}
          className={`rise-in flex items-start gap-2 px-3 py-2 rounded-[3px] border text-[14px] ${
            notice.tone === "error"
              ? "bg-error-container text-on-error-container border-error/40"
              : notice.tone === "warn"
              ? "bg-goldenrod-container text-on-goldenrod border-goldenrod/40"
              : "bg-tertiary-fixed text-on-tertiary-fixed border-tertiary/30"
          }`}
        >
          <span className="flex-1">{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="p-0.5 cursor-pointer opacity-75 hover:opacity-100">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col xl:flex-row xl:items-center gap-3">
        <label className="relative flex-1 min-w-0 xl:max-w-sm">
          <span className="sr-only">Search claims</span>
          <Search size={16} aria-hidden="true" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-outline" />
          <input
            ref={searchRef}
            type="search"
            value={searchTerm}
            maxLength={120}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search text, quote or #id"
            className="w-full h-9 pl-8 pr-9 rounded-[3px] border border-outline-variant bg-surface-container-lowest text-[14px] placeholder:text-outline"
          />
          <span className="kbd absolute right-2 top-1/2 -translate-y-1/2 text-outline pointer-events-none hidden sm:inline-flex">/</span>
        </label>

        <div role="group" aria-label="Filter by check status" className="flex flex-wrap gap-1">
          {[["all", "All", claims.length], ...["verified", "inferred", "conflicting", "missing"].map((k) => [k, STATUS[k].short, count("status", k)])].map(([id, label, n]) => {
            const on = statusFilter === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                title={STATUS[id]?.help}
                onClick={() => setStatusFilter(id)}
                className={`h-9 inline-flex items-center gap-1.5 px-2.5 rounded-[3px] border text-[13px] font-semibold cursor-pointer transition-colors ${
                  on ? "bg-secondary text-on-secondary border-secondary" : "bg-surface-container-lowest border-outline-variant text-on-surface hover:border-outline"
                }`}
              >
                {id !== "all" && <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${STATUS[id].dot}`} />}
                {label}
                <span className={`tnum text-[12px] ${on ? "text-on-ink-muted" : "text-on-surface-variant"}`}>{n}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {[
            ["Review", reviewFilter, setReviewFilter, REVIEW_FILTERS.map((r) => [r.id, r.label])],
            ["Source", kindFilter, setKindFilter, [["all", "Any source"], ["derived", "Calculated by code"], ["interpreted", "Extracted by AI"], ["rule", "Keyword rule"], ["debrief", "Debrief"]]],
            ["Type", typeFilter, setTypeFilter, [["all", "Any type"], ...typeOptions.map((t) => [t, humanize(t)])]],
          ].map(([label, value, set, opts]) => (
            <label key={label} className="relative min-w-0 flex-1 basis-28 sm:flex-none sm:basis-auto">
              <span className="sr-only">{label}</span>
              <select
                value={value}
                onChange={(e) => set(e.target.value)}
                className={`appearance-none w-full h-9 min-h-9 pl-2.5 pr-8 rounded-[3px] border text-[13px] font-semibold cursor-pointer ${
                  value !== "all" ? "border-outline bg-surface-container text-on-surface" : "border-outline-variant bg-surface-container-lowest"
                }`}
              >
                {opts.map(([v, l]) => <option key={v} value={v}>{label === "Review" && v === "all" ? "Any review state" : l}</option>)}
              </select>
              <ChevronDown size={14} aria-hidden="true" className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant" />
            </label>
          ))}
          {filtersActive && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>
          )}
        </div>
      </div>

      {/* Manifest + inspection */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Manifest list */}
        <section aria-label="Claims" className="lg:col-span-5 panel overflow-hidden lg:sticky lg:top-[72px]">
          <div className="flex items-center justify-between px-3 py-2 border-b border-outline-variant bg-surface-container-low">
            <h2 className="field-label">Highest risk first</h2>
            <span className="text-[12px] text-on-surface-variant tnum" aria-live="polite">
              {filteredClaims.length === claims.length ? `${claims.length} claims` : `${filteredClaims.length} of ${claims.length}`}
            </span>
          </div>
          <ol ref={listRef} className="max-h-[60vh] lg:max-h-[calc(100vh-260px)] overflow-y-auto divide-y divide-outline-variant/70" id="claims-ledger-container">
            {filteredClaims.length === 0 ? (
              <li className="px-4 py-10 text-center flex flex-col items-center gap-3">
                <p className="text-[14px] text-on-surface-variant">No claims match these filters.</p>
                <Button size="sm" onClick={clearFilters}>Clear filters</Button>
              </li>
            ) : (
              filteredClaims.map((claim) => {
                const sel = claim.id === selectedId;
                return (
                  <li key={claim.id}>
                    <button
                      id={`claim-row-${claim.id}`}
                      type="button"
                      aria-current={sel ? "true" : undefined}
                      onClick={() => select(claim, { reveal: true })}
                      className={`claim-row w-full text-left grid grid-cols-[2.75rem_1fr] gap-x-2 px-3 py-2.5 cursor-pointer transition-colors duration-150 focus-visible:outline-offset-[-2px] ${
                        sel ? "bg-canary-container" : "hover:bg-surface-container-low"
                      } ${claim.review_state !== "pending" && !sel ? "text-on-surface-variant" : ""}`}
                    >
                      <span className={`font-mono text-[12px] tnum pt-0.5 ${sel ? "text-on-canary font-bold" : "text-outline"}`}>#{claim.id}</span>
                      <span className="min-w-0 flex flex-col gap-1.5">
                        <span className="flex items-center justify-between gap-2">
                          <StatusChip status={claim.withheld ? "withheld" : claim.status} size="sm" />
                          <ReviewMark state={claim.review_state} />
                        </span>
                        <span className={`text-[14px] leading-5 line-clamp-2 break-words ${claim.review_state === "pending" || sel ? "text-on-surface" : ""}`}>
                          {claim.withheld ? `Locked: needs ${claim.access_level} access` : claim.text}
                        </span>
                        <span className="text-[12px] text-on-surface-variant flex items-center gap-1.5 flex-wrap">
                          <span>{humanize(claim.type)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{claim.kind === "derived" ? "Code" : claim.kind === "debrief" ? "Debrief" : claim.kind === "rule" ? "Rule" : "AI"}</span>
                          {claim.access_level !== "team" && claim.access_level !== "public" && (
                            <>
                              <span aria-hidden="true">·</span>
                              <AccessChip level={claim.access_level} />
                            </>
                          )}
                          {claim.current_version > 1 && <span className="font-mono">v{claim.current_version}</span>}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ol>
        </section>

        {/* Inspection form */}
        <section aria-label="Inspect claim" className="lg:col-span-7 panel flex flex-col min-w-0">
          {!selectedClaim ? (
            <div className="p-8 text-center text-[14px] text-on-surface-variant">Pick a line on the left to inspect its proof.</div>
          ) : (
            <>
              <div className="px-5 pt-4 pb-4 border-b border-outline-variant flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[13px] font-bold text-on-surface-variant tnum">Claim #{selectedClaim.id}</span>
                    <StatusChip status={selectedClaim.withheld ? "withheld" : selectedClaim.status} />
                    <ReviewMark state={selectedClaim.review_state} />
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => copy("link", window.location.href)} title="Copy a link to this claim">
                      {copied === "link" ? <Check size={14} aria-hidden="true" /> : <Link2 size={14} aria-hidden="true" />}
                      {copied === "link" ? "Copied" : "Link"}
                    </Button>
                    <span role="status" className="sr-only">{copied === "link" ? "Link copied" : ""}</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-4 items-start">
                <h2 id="inspect-claim-header" tabIndex={-1} className="text-[19px] sm:text-[20px] leading-7 font-bold break-words scroll-mt-24">
                  {selectedClaim.withheld ? `Locked: needs ${selectedClaim.access_level} access` : selectedClaim.text}
                </h2>
                {/* Collection label: typed, hairline, lower right of the specimen heading */}
                <div className="flex xl:justify-end">
                  <dl className="font-mono text-[12px] leading-[18px] text-on-surface border-t border-on-surface/70 pt-2 grid grid-cols-[auto_1fr] gap-x-3 min-w-[230px] max-w-full">
                    <dt className="text-on-surface-variant">Claim</dt>
                    <dd className="tnum">#{selectedClaim.id} · v{selectedClaim.current_version}</dd>
                    <dt className="text-on-surface-variant">Type</dt>
                    <dd>{humanize(selectedClaim.type)}</dd>
                    <dt className="text-on-surface-variant">Found by</dt>
                    <dd title={kindHelp(selectedClaim)} className="truncate">{kindLabel(selectedClaim)}</dd>
                    <dt className="text-on-surface-variant">Access</dt>
                    <dd>{humanize(selectedClaim.access_level)}</dd>
                  </dl>
                </div>
                </div>
              </div>

              <div className="px-5 py-4 flex flex-col gap-4">
                {/* Determinations: one stamped slip per human decision, newest on top. */}
                {(() => {
                  const fmt = (t) => {
                    const d = t ? new Date(t) : null;
                    return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : null;
                  };
                  const ACTION = { review_approved: "approved", review_corrected: "corrected", review_rejected: "rejected", review_bulk_approved: "approved" };
                  const slips = claimLogs
                    .filter((l) => ACTION[l.action] || /approv|correct|reject/.test(l.action || ""))
                    .map((l, i) => ({
                      version: i,
                      review_state: ACTION[l.action] || (/reject/.test(l.action) ? "rejected" : /correct/.test(l.action) ? "corrected" : "approved"),
                      changed_by: l.actor_role,
                      changed_at: l.created_at,
                      change_note: l.detail,
                    }));
                  return (
                    <Field
                      label={`Determinations · ${slips.length}`}
                      aside={<History size={14} className="text-on-surface-variant" aria-hidden="true" />}
                    >
                      {slips.length === 0 ? (
                        <p className="text-[13px] text-on-surface-variant">No one has decided on this claim yet. Your decision is stamped here.</p>
                      ) : (
                        <ol className="flex flex-col gap-2">
                          {slips.map((v, i) => (
                            <li key={`${v.version}-${v.review_state}-${i}`} style={{ marginLeft: `${Math.min(i, 3) * 10}px` }}>
                              <Slip
                                who={humanize(v.changed_by || "lead")}
                                when={fmt(v.changed_at)}
                                what={REVIEW[v.review_state]?.label || humanize(v.review_state)}
                                note={v.change_note}
                                className={i > 0 ? "opacity-70" : ""}
                              />
                            </li>
                          ))}
                        </ol>
                      )}
                    </Field>
                  );
                })()}
                {/* Evidence */}
                {selectedClaim.withheld ? (
                  <Field label="Evidence">
                    <p className="text-[14px] text-on-surface-variant flex items-center gap-2"><Lock size={14} aria-hidden="true" />The source needs higher access than this view has.</p>
                  </Field>
                ) : isDetailLoading ? (
                  <Field label="Evidence"><Skeleton className="h-28" /></Field>
                ) : selectedClaim.status === "conflicting" && contexts.length > 1 ? (
                  <Field label="Evidence · two sources disagree" aside={<ArrowLeftRight size={14} className="text-error" aria-hidden="true" />}>
                    <p className="text-[13px] text-on-surface-variant mb-3">Both quotes are exact text from the sources. Decide which one is current before approving.</p>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                      {contexts.map((ctx, i) => (
                        <figure key={ctx.chunk_id ?? i} className="flex flex-col gap-1.5 min-w-0">
                          <figcaption className="text-[12px] text-on-surface-variant flex items-center justify-between gap-2">
                            <span className="font-semibold text-on-surface">{i === 0 ? "Earlier" : "Later"}</span>
                            <span className="font-mono truncate">{ctx.source_name}{ctx.timestamp ? ` · ${String(ctx.timestamp).slice(0, 10)}` : ""}</span>
                          </figcaption>
                          <SourceExcerpt text={ctx.chunk_text} quote={ctx.quote} lineStart={selectedClaim.evidence?.[i]?.line_start} />
                        </figure>
                      ))}
                    </div>
                  </Field>
                ) : contexts.length > 0 ? (
                  contexts.map((ctx, i) => (
                    <Field
                      key={ctx.chunk_id ?? i}
                      label={selectedClaim.kind === "derived" ? "Evidence · the record code read" : "Evidence · exact quote in its source"}
                      aside={
                        <>
                        <button
                          type="button"
                          onClick={() => copy(`q${i}`, ctx.quote || "")}
                          className="inline-flex items-center gap-1 text-[12px] font-semibold text-on-surface-variant hover:text-on-surface cursor-pointer rounded-[2px] px-1"
                        >
                          {copied === `q${i}` ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                          {copied === `q${i}` ? "Copied" : "Copy quote"}
                        </button>
                        <span role="status" className="sr-only">{copied === `q${i}` ? "Quote copied" : ""}</span>
                        </>
                      }
                    >
                      <p className="text-[12px] text-on-surface-variant mb-2 flex flex-wrap gap-x-3">
                        <span className="font-mono text-on-surface">{ctx.source_name}</span>
                        {ctx.author && <span>by {ctx.author}</span>}
                        {ctx.timestamp && <span>{String(ctx.timestamp).slice(0, 10)}</span>}
                        <AccessChip level={ctx.access_level} />
                      </p>
                      <SourceExcerpt text={ctx.chunk_text || ctx.quote || ""} quote={ctx.quote} lineStart={selectedClaim.evidence?.[i]?.line_start} />
                    </Field>
                  ))
                ) : selectedClaim.kind === "derived" ? (
                  <Field label="Evidence · calculated by code" aside={<Code2 size={14} className="text-on-surface-variant" aria-hidden="true" />}>
                    <p className="text-[14px] leading-6">
                      {selectedClaim.type === "blocker"
                        ? "Plain code read the task export and found the owner field empty."
                        : "Plain code counted commit authors per module in the git history. No AI and no quote check are involved."}
                    </p>
                    {(selectedClaim.evidence || []).map((ev, i) => ev.quote && (
                      <p key={i} className="mt-2 font-mono text-[12.5px] border-t border-outline-variant pt-2 break-words">{ev.quote}</p>
                    ))}
                  </Field>
                ) : (
                  <Field label="Evidence">
                    <p className="text-[14px] text-on-surface-variant">No source excerpt is stored for this claim. Treat it as unproven.</p>
                  </Field>
                )}

                {/* Checks */}
                <Field label="Checks">
                  <ul className="flex flex-col gap-2 text-[14px]">
                    <li className="flex items-start gap-2">
                      <StatusChip status={selectedClaim.withheld ? "withheld" : selectedClaim.status} size="sm" />
                      <span className="text-on-surface-variant">{STATUS[selectedClaim.withheld ? "withheld" : selectedClaim.status]?.help}</span>
                    </li>
                    <li className="flex items-start gap-2 text-on-surface-variant">
                      <span className="field-label pt-0.5 w-20 shrink-0">Found by</span>
                      <span>{kindHelp(selectedClaim)}</span>
                    </li>
                    {selectedClaim.kind === "interpreted" && typeof selectedClaim.confidence === "number" && (
                      <li className="flex items-start gap-2 text-on-surface-variant">
                        <span className="field-label pt-0.5 w-20 shrink-0">Support</span>
                        <span className="tnum">{Math.round(selectedClaim.confidence * 100)}% from the support check</span>
                      </li>
                    )}
                  </ul>
                </Field>

              </div>

              {/* Decision bar */}
              <div className="sticky bottom-0 mt-auto px-3 sm:px-5 py-3 border-t border-outline-variant bg-surface-container-lowest flex items-center gap-2">
                <Button
                  id="btn-approve"
                  variant="stamp"
                  onClick={handleApprove}
                  disabled={busy || selectedClaim.withheld || selectedClaim.review_state === "approved"}
                  className="flex-1 sm:flex-none px-2.5 sm:px-3.5"
                >
                  <Check size={16} strokeWidth={2.5} aria-hidden="true" />
                  {selectedClaim.review_state === "approved" ? "Approved" : busy ? "Saving…" : "Approve"}
                  <span className="kbd hidden sm:inline-flex ml-1">A</span>
                </Button>
                <Button id="btn-edit" onClick={openEdit} disabled={busy || selectedClaim.withheld}>
                  <PencilLine size={15} aria-hidden="true" />Correct<span className="kbd hidden sm:inline-flex ml-1">E</span>
                </Button>
                <Button id="btn-reject" variant="danger" onClick={openReject} disabled={busy || selectedClaim.withheld || selectedClaim.review_state === "rejected"}>
                  <X size={15} aria-hidden="true" />{selectedClaim.review_state === "rejected" ? "Rejected" : "Reject"}<span className="kbd hidden sm:inline-flex ml-1">R</span>
                </Button>
                <span className="ml-auto hidden md:flex items-center gap-1.5 text-[12px] text-on-surface-variant">
                  <span className="kbd">J</span><span className="kbd">K</span> next / previous
                </span>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Dialogs */}
      <Dialog
        open={dialog === "reject"}
        onClose={() => setDialog(null)}
        title={`Reject claim #${selectedClaim?.id ?? ""}`}
        description="The reason is saved in the claim's history and the claim stays out of the handover."
        footer={
          <>
            <Button onClick={() => setDialog(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleRejectConfirm} disabled={!rejectReason.trim() || busy}>{busy ? "Rejecting…" : "Reject claim"}</Button>
          </>
        }
      >
        <TextArea
          id="reject-reason"
          label="Why is it wrong?"
          autoFocus
          maxLength={500}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="e.g. Kabir took over payments in January; this is out of date."
          hint={`Required. ${rejectReason.length}/500`}
        />
      </Dialog>

      <Dialog
        open={dialog === "edit"}
        onClose={() => setDialog(null)}
        width="max-w-lg"
        title={`Correct claim #${selectedClaim?.id ?? ""}`}
        description="Saving records a new version. The original text stays in the history."
        footer={
          <>
            <Button onClick={() => setDialog(null)}>Cancel</Button>
            <Button variant="stamp" onClick={handleEditConfirm} disabled={!editText.trim() || editUnchanged || busy}>{busy ? "Saving…" : "Save correction"}</Button>
          </>
        }
      >
        <TextArea id="edit-text" label="Corrected claim" autoFocus maxLength={1000} value={editText} onChange={(e) => setEditText(e.target.value)} hint={editUnchanged ? "Change the text to save a correction." : `${editText.length}/1000`} />
        <TextInput id="edit-note" label="What changed (optional)" maxLength={200} value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="e.g. Owner confirmed in Slack" />
      </Dialog>

      <Dialog
        open={dialog === "conflict"}
        onClose={() => setDialog(null)}
        title="Which source is current?"
        description="This claim is conflicting. Say which source wins and why; the answer is saved with the approval."
        footer={
          <>
            <Button onClick={() => setDialog(null)}>Cancel</Button>
            <Button variant="stamp" onClick={() => runApprove(`Conflict resolved: ${conflictNote.trim()}`)} disabled={!conflictNote.trim() || busy}>{busy ? "Approving…" : "Approve with this answer"}</Button>
          </>
        }
      >
        <TextArea id="conflict-note" label="Resolution" autoFocus maxLength={500} value={conflictNote} onChange={(e) => setConflictNote(e.target.value)} placeholder="e.g. Meeting 07 is later: the migration is postponed." hint="Required." />
      </Dialog>

      <Dialog
        open={dialog === "bulk"}
        onClose={() => setDialog(null)}
        title={`Approve ${pendingVerified} quote-matched claim${pendingVerified === 1 ? "" : "s"}?`}
        description="Only claims whose quote was found word for word are approved. Conflicting, inferred and missing claims are skipped and stay in the queue for a person."
        footer={
          <>
            <Button onClick={() => setDialog(null)}>Cancel</Button>
            <Button variant="stamp" onClick={handleBulk} disabled={busy}>{busy ? "Approving…" : "Approve them"}</Button>
          </>
        }
      >
        <p className="text-[14px] text-on-surface-variant">You can still correct or reject any of them afterwards.</p>
      </Dialog>
    </div>
  );
}
