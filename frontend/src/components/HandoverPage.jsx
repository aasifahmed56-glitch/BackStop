import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Lock, Printer, PenLine, ClipboardCheck, SearchX, Search } from "lucide-react";
import { api, formatErrorMessage } from "../api";
import { ROLES } from "./Navbar";
import { Button, Field, Dialog, TextInput, Skeleton, humanize, consignmentNo } from "./ui";

const PHASES = [
  { key: "day_1", name: "Day 1", purpose: "Blockers and critical dependencies.", empty: "Nothing approved for Day 1 in this view." },
  { key: "week_1", name: "Week 1", purpose: "Key decisions and architecture context.", empty: "Nothing approved for Week 1 in this view." },
  { key: "month_1", name: "Month 1", purpose: "Long-term ownership and upkeep.", empty: "Nothing approved for Month 1 in this view." },
];

const TypeChip = ({ type }) => (
  <span className="inline-block rounded-[2px] bg-surface-container px-1.5 py-px text-[11px] leading-4 font-semibold text-on-surface whitespace-nowrap">
    {humanize(type)}
  </span>
);

const AccessChip = ({ level }) =>
  level === "restricted" ? (
    <span className="inline-block rounded-[2px] bg-error-container px-1.5 py-px font-mono text-[11px] leading-4 font-semibold text-on-error-container">
      restricted
    </span>
  ) : (
    <span className="font-mono text-[11px] leading-4 text-on-surface-variant">{level || "team"}</span>
  );

function formatWhen(value) {
  const d = value ? new Date(value) : new Date();
  const ok = !Number.isNaN(d.getTime());
  const dt = ok ? d : new Date();
  return dt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function LoadingDocument() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading handover">
      <div className="panel grid grid-cols-2 lg:grid-cols-6 gap-px bg-outline-variant overflow-hidden">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-surface-container-lowest p-3 flex flex-col gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-28" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="panel p-3 flex flex-col gap-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ))}
      </div>
      <div className="panel p-3 flex flex-col gap-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  );
}

// Plan titles arrive as "[TYPE] text...."; the type already has its own chip.
const cleanTitle = (t) => String(t || "").replace(/^\[[A-Z_ ]+\]\s*/, "").replace(/\.{2,}$/, "…").trim();

export default function HandoverPage({ role, setRole, setActiveTab }) {
  const [handoverData, setHandoverData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("");

  const [ackModalOpen, setAckModalOpen] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [ackNote, setAckNote] = useState("");
  const [isSubmittingAck, setIsSubmittingAck] = useState(false);
  const [ackSuccess, setAckSuccess] = useState(null);
  const [ackError, setAckError] = useState(null);

  const requestId = useRef(0);
  const submitting = useRef(false);

  const loadHandover = useCallback(async () => {
    const myId = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getHandover({ projectId: 1, role });
      if (myId !== requestId.current) return;
      setHandoverData(data);
    } catch (err) {
      if (myId !== requestId.current) return;
      setError(formatErrorMessage(err) || "Failed to load handover");
    } finally {
      if (myId === requestId.current) setIsLoading(false);
    }
  }, [role]);

  useEffect(() => {
    loadHandover();
    return () => {
      requestId.current += 1;
    };
  }, [loadHandover]);

  const currentRoleObj = ROLES.find((r) => r.id === role) || ROLES[0];
  const approvedClaims = useMemo(() => handoverData?.claims || [], [handoverData]);
  const plan = handoverData?.plan || {};
  const hasApprovedClaims = approvedClaims.length > 0;
  const visibleCount = handoverData?.claims_visible ?? approvedClaims.filter((c) => !c.withheld).length;
  const withheldCount = handoverData?.claims_withheld ?? 0;
  const project = handoverData?.project || {};
  const roleSections = handoverData?.role_sections || {};
  const canSign = hasApprovedClaims && visibleCount > 0;
  const [expanded, setExpanded] = useState({});
  const toggle = (k) => setExpanded((e) => ({ ...e, [k]: !e[k] }));
  const CAP = 5;
  const shown = (k, list) => (expanded[k] ? list : list.slice(0, CAP));
  const MoreButton = ({ k, total, cap = CAP }) =>
    total > cap ? (
      <button
        type="button"
        onClick={() => toggle(k)}
        aria-expanded={!!expanded[k]}
        className="no-print w-full px-3 py-2 text-left text-[13px] font-semibold text-primary hover:bg-surface-container-low border-t border-outline-variant cursor-pointer"
      >
        {expanded[k] ? "Show fewer" : `Show all ${total}`}
      </button>
    ) : null;

  const filteredClaims = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return approvedClaims;
    return approvedClaims.filter((c) => {
      const hay = [`#${c.id}`, String(c.id), c.type, humanize(c.type), c.withheld ? "" : c.text, c.access_level]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [approvedClaims, filter]);

  const openSign = () => {
    setRecipientName("");
    setAckNote("");
    setAckError(null);
    setAckModalOpen(true);
  };

  const closeSign = () => {
    if (submitting.current) return;
    setAckModalOpen(false);
  };

  const handleAcknowledge = async () => {
    const name = recipientName.trim();
    if (!name || submitting.current) return;
    submitting.current = true;
    setIsSubmittingAck(true);
    setAckError(null);
    try {
      const res = await api.acknowledgeHandover(1, {
        role,
        recipientName: name,
        note: ackNote.trim() || undefined,
      });
      setAckSuccess({
        name: res?.recipient_name || res?.actor_name || name,
        note: res?.note || ackNote.trim() || "",
        at: res?.acknowledged_at || null,
        roleLabel: currentRoleObj.label,
      });
      setAckModalOpen(false);
    } catch (err) {
      setAckError("Signing failed: " + formatErrorMessage(err));
    } finally {
      submitting.current = false;
      setIsSubmittingAck(false);
    }
  };

  const signDisabledReason = isLoading
    ? "Loading the handover"
    : !canSign
      ? "Nothing visible to this role has been approved yet, so there is nothing to sign for."
      : undefined;

  return (
    <div className="flex flex-col w-full gap-5 min-w-0">
      {/* Document header */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[26px] leading-[34px] font-bold tracking-[-0.015em] text-on-surface">
            Handover for {currentRoleObj.label.toLowerCase()}
          </h1>
          <p className="text-[14px] leading-[22px] text-on-surface-variant mt-1 max-w-2xl">
            Compiled only from claims a person approved. Items above this role&apos;s access are hidden.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 no-print shrink-0">
          <Button id="btn-print" variant="outline" onClick={() => window.print()}>
            <Printer size={16} aria-hidden="true" />
            Print or save PDF
          </Button>
          <Button id="btn-ack" variant="primary" onClick={openSign} disabled={!canSign || isLoading} title={signDisabledReason}>
            <PenLine size={16} aria-hidden="true" />
            Sign for receipt
          </Button>
        </div>
      </header>

      {/* Role switcher */}
      <div className="flex flex-col gap-2 no-print">
        <div role="radiogroup" aria-label="View the handover as" className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {ROLES.map((r, i) => {
            const on = role === r.id;
            return (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                onClick={() => setRole(r.id)}
                onKeyDown={(e) => {
                  const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
                  if (!dir) return;
                  e.preventDefault();
                  const next = ROLES[(i + dir + ROLES.length) % ROLES.length];
                  setRole(next.id);
                  const sibs = e.currentTarget.parentElement.querySelectorAll('[role="radio"]');
                  sibs[(i + dir + ROLES.length) % ROLES.length]?.focus();
                }}
                className={`role-btn text-left rounded-[3px] border px-3 py-2 cursor-pointer transition-colors ${
                  on
                    ? "border-ink bg-ink text-on-ink"
                    : "border-outline-variant bg-surface-container-lowest text-on-surface hover:border-outline hover:bg-surface-container-low"
                }`}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[14px] font-semibold">{r.label}</span>
                  <span className={`text-[11px] font-semibold uppercase tracking-[0.05em] ${on ? "text-canary" : "text-on-surface-variant"}`}>{r.access}</span>
                </span>
                <span className={`block text-[12px] leading-[18px] mt-0.5 ${on ? "text-on-ink-muted" : "text-on-surface-variant"}`}>{r.desc}</span>
              </button>
            );
          })}
        </div>
        {handoverData && withheldCount > 0 && (
          <p id="withheld-notice-line" className="flex items-center gap-2 text-[13px] font-semibold text-on-surface">
            <Lock size={15} aria-hidden="true" className="text-outline shrink-0" />
            This view hides {withheldCount} approved {withheldCount === 1 ? "item that needs" : "items that need"} higher access
          </p>
        )}
        {handoverData && role === "lead" && (
          <p id="lead-full-access-line" className="text-[13px] text-on-surface-variant">
            Lead view: restricted items are shown in full.
          </p>
        )}
      </div>

      {isLoading ? (
        <LoadingDocument />
      ) : error ? (
        <div role="alert" className="panel p-6 flex flex-col items-start gap-2 border-error">
          <h2 className="text-[17px] leading-6 font-bold text-on-surface">The handover could not be loaded</h2>
          <p className="text-[14px] text-on-surface-variant break-words max-w-full">{error}</p>
          <Button variant="primary" onClick={loadHandover} className="mt-2">
            Try again
          </Button>
        </div>
      ) : !hasApprovedClaims ? (
        <div className="panel p-8 flex flex-col items-start gap-2 max-w-2xl">
          <ClipboardCheck size={24} aria-hidden="true" className="text-primary" />
          <h2 className="text-[20px] leading-7 font-bold text-on-surface">Nothing has been approved yet</h2>
          <p className="text-[14px] leading-[22px] text-on-surface-variant">
            The handover is built only from claims a person has approved. Review the claims, approve the ones that hold up, and they will appear here for the new owner to read and sign for.
          </p>
          <Button variant="primary" size="lg" onClick={() => setActiveTab("review")} className="mt-3">
            Check the claims
          </Button>
        </div>
      ) : (
        <>
          {/* Consignment summary */}
          <section aria-label="Consignment summary" className="grid grid-cols-2 lg:grid-cols-6 gap-px bg-outline-variant border border-outline-variant rounded-[3px] overflow-hidden print-shadow-none">
            {[
              ["Consignment no.", consignmentNo(project.id)],
              ["Consignor", project.leaver_name || "Not recorded"],
              ["Consignee", currentRoleObj.label],
              ["Project", project.name || "Not recorded"],
              ["Departure", project.departure_date || "Not recorded"],
              [
                "Contents",
                `${visibleCount} approved ${visibleCount === 1 ? "item" : "items"}${withheldCount > 0 ? `, ${withheldCount} withheld` : ""}`,
              ],
            ].map(([label, value], i) => (
              <div key={label} className={`bg-surface-container-lowest px-3 py-2 min-w-0 ${i === 0 ? "font-mono" : ""}`}>
                <div className="field-label">{label}</div>
                <div className="text-[14px] leading-6 font-semibold text-on-surface break-words tnum">{value}</div>
              </div>
            ))}
          </section>

          {/* Ramp-up plan */}
          <section aria-labelledby="plan-h" className="flex flex-col gap-2">
            <h2 id="plan-h" className="text-[17px] leading-6 font-bold">Ramp-up plan</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
              {PHASES.map((ph) => {
                const items = plan[ph.key] || [];
                return (
                  <div key={ph.key} className="panel overflow-hidden print-shadow-none">
                    <div className="flex items-baseline justify-between gap-2 px-3 py-2 bg-surface-container-low border-b border-outline-variant">
                      <div className="min-w-0">
                        <h3 className="text-[15px] leading-6 font-bold">{ph.name}</h3>
                        <p className="text-[12px] leading-4 text-on-surface-variant">{ph.purpose}</p>
                      </div>
                      <span className="tnum text-[12px] font-semibold text-on-surface-variant shrink-0">
                        {items.length} {items.length === 1 ? "item" : "items"}
                      </span>
                    </div>
                    {items.length === 0 ? (
                      <p className="px-3 py-3 text-[13px] text-on-surface-variant">{ph.empty}</p>
                    ) : (
                      <>
                      <ul className="divide-y divide-outline-variant">
                        {shown(ph.key, items).map((item, idx) => {
                          // Show the approved claim's full text; the backend title is a truncated copy of it.
                          const title = item.withheld ? cleanTitle(item.title) : item.description || cleanTitle(item.title);
                          const showDesc = false;
                          return (
                          <li key={item.id ?? idx} className="px-3 py-2.5 flex flex-col gap-1">
                            <div className="flex items-center justify-between gap-2">
                              <TypeChip type={item.type} />
                              <AccessChip level={item.access_level} />
                            </div>
                            <p className="text-[14px] leading-5 font-semibold text-on-surface break-words line-clamp-4">{title}</p>
                            {showDesc && (
                              <p className="text-[13px] leading-[18px] text-on-surface-variant line-clamp-2 break-words">{item.description}</p>
                            )}
                          </li>
                          );
                        })}
                      </ul>
                      <MoreButton k={ph.key} total={items.length} />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Role focus */}
          {Object.keys(roleSections).length > 0 && (
            <section aria-labelledby="focus-h" className="flex flex-col gap-2">
              <div>
                <h2 id="focus-h" className="text-[17px] leading-6 font-bold">Focus for {currentRoleObj.label.toLowerCase()}</h2>
                {handoverData?.role_emphasis?.length > 0 && (
                  <p className="text-[13px] text-on-surface-variant">
                    Emphasis: {handoverData.role_emphasis.map(humanize).join(", ").toLowerCase()}.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
                {Object.entries(roleSections).map(([typeKey, items]) => {
                  const list = items || [];
                  const lockedCount = list.filter((i) => i.withheld).length;
                  return (
                    <div key={typeKey} className="panel overflow-hidden print-shadow-none">
                      <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-surface-container-low border-b border-outline-variant">
                        <h3 className="text-[13px] font-bold">{humanize(typeKey)}</h3>
                        <span className="tnum text-[12px] text-on-surface-variant">
                          {list.length}
                          {lockedCount > 0 ? `, ${lockedCount} locked` : ""}
                        </span>
                      </div>
                      <ul className="divide-y divide-outline-variant">
                        {shown(`focus-${typeKey}`, list).map((it, idx) => (
                          <li key={it.id ?? idx} className="px-3 py-2 text-[13px] leading-[18px]">
                            {it.withheld ? (
                              <span className="flex items-center gap-1.5 text-on-surface-variant">
                                <Lock size={13} aria-hidden="true" className="shrink-0" />
                                Locked: needs {it.access_level} access
                              </span>
                            ) : (
                              <span className="line-clamp-2 break-words text-on-surface">{it.text}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                      <MoreButton k={`focus-${typeKey}`} total={list.length} />
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Declared contents */}
          <section aria-labelledby="contents-h" className="flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <h2 id="contents-h" className="text-[17px] leading-6 font-bold">Declared contents</h2>
                <p className="text-[13px] text-on-surface-variant">Every approved claim for this role.</p>
              </div>
              <div className="flex items-center gap-3 no-print">
                <label className="relative block">
                  <span className="sr-only">Filter contents</span>
                  <Search size={15} aria-hidden="true" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-outline" />
                  <input
                    id="contents-filter"
                    type="search"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filter contents"
                    maxLength={100}
                    className="h-9 w-full sm:w-64 pl-8 pr-2.5 rounded-[3px] border border-outline-variant bg-surface-container-lowest text-[14px] placeholder:text-outline focus:outline-2 focus:outline-primary focus:border-primary"
                  />
                </label>
                <span className="tnum text-[12px] text-on-surface-variant whitespace-nowrap" aria-live="polite">
                  Showing {filteredClaims.length} of {approvedClaims.length}
                </span>
              </div>
            </div>
            <div className="panel overflow-x-auto print-shadow-none">
              <table className="w-full min-w-[640px] text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th scope="col" className="field-label px-3 py-2 w-20">ID</th>
                    <th scope="col" className="field-label px-3 py-2 w-36">Type</th>
                    <th scope="col" className="field-label px-3 py-2">Claim</th>
                    <th scope="col" className="field-label px-3 py-2 w-28">Access</th>
                    <th scope="col" className="field-label px-3 py-2 w-28">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant text-[13px] leading-5 text-on-surface">
                  {filteredClaims.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-on-surface-variant">
                        <SearchX size={16} aria-hidden="true" className="inline mr-2 align-text-bottom" />
                        No items match
                      </td>
                    </tr>
                  ) : (
                    filteredClaims.map((claim, rowIdx) => (
                      <tr key={claim.id} className={`${!expanded.contents && !filter.trim() && rowIdx >= 15 ? "hidden print:table-row " : ""}align-top`}>
                        <td className="px-3 py-2 font-mono text-[12px] text-on-surface-variant">#{claim.id}</td>
                        <td className="px-3 py-2"><TypeChip type={claim.type} /></td>
                        <td className="px-3 py-2 break-words">
                          {claim.withheld ? (
                            <span className="flex items-center gap-1.5 text-on-surface-variant">
                              <Lock size={13} aria-hidden="true" className="shrink-0" />
                              Locked: needs {claim.access_level || "higher"} access. Ask the lead.
                            </span>
                          ) : (
                            claim.text
                          )}
                        </td>
                        <td className="px-3 py-2"><AccessChip level={claim.access_level} /></td>
                        <td className="px-3 py-2">
                          {claim.withheld ? (
                            <span className="inline-block rounded-[2px] bg-surface-container-high px-1.5 py-px text-[11px] leading-4 font-semibold text-on-surface">Withheld</span>
                          ) : (
                            <span className="inline-block rounded-[2px] bg-tertiary-fixed px-1.5 py-px text-[11px] leading-4 font-semibold text-on-tertiary-fixed">
                              {humanize(claim.status || "approved")}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {!filter.trim() && <MoreButton k="contents" total={filteredClaims.length} cap={15} />}
            </div>
          </section>

          {/* Receipt: the slip that closes the consignment note */}
          <section aria-labelledby="receipt-h" className="panel print-shadow-none overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-dashed border-outline bg-surface-container-low">
              <h2 id="receipt-h" className="text-[15px] font-bold">Receipt</h2>
              <span className="font-mono text-[12px] text-on-surface-variant">No. {consignmentNo(project.id)}</span>
            </div>
            {ackSuccess ? (
              <div id="ack-banner" className="flex flex-col md:flex-row md:items-center gap-5 p-4 overflow-hidden">
                <div className="stamp-in shrink-0 self-start md:self-center border-2 border-tertiary text-tertiary rounded-[3px] px-4 py-1.5 text-[18px] leading-6 font-extrabold uppercase tracking-[0.14em] m-1" style={{ transform: "rotate(-3deg)" }}>
                  Received
                </div>
                <dl className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-px bg-outline-variant border border-outline-variant rounded-[2px] min-w-0">
                  {[
                    ["Received by", <span key="n" id="ack-success-title">{ackSuccess.name}</span>],
                    ["Role", ackSuccess.roleLabel],
                    ["Signed at", <span key="t" className="tnum">{formatWhen(ackSuccess.at)}</span>],
                  ].map(([l, v]) => (
                    <div key={l} className="bg-surface-container-lowest px-3 py-2 min-w-0">
                      <dt className="field-label">{l}</dt>
                      <dd className="text-[14px] leading-6 font-semibold break-words">{v}</dd>
                    </div>
                  ))}
                  {ackSuccess.note && (
                    <div className="bg-surface-container-lowest px-3 py-2 sm:col-span-3">
                      <dt className="field-label">Note</dt>
                      <dd className="text-[14px] leading-6 break-words">{ackSuccess.note}</dd>
                    </div>
                  )}
                </dl>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <div className="h-8 border-b border-outline max-w-sm" aria-hidden="true" />
                  <p className="text-[13px] text-on-surface-variant mt-1">Not signed yet. The person taking over signs here.</p>
                </div>
                <Button variant="primary" onClick={openSign} disabled={!canSign} title={signDisabledReason} className="no-print self-start sm:self-center">
                  <PenLine size={16} aria-hidden="true" />
                  Sign for receipt
                </Button>
              </div>
            )}
          </section>
        </>
      )}

      <Dialog
        open={ackModalOpen}
        onClose={closeSign}
        title="Sign for receipt"
        description={`You are confirming that you received the handover as ${currentRoleObj.label.toLowerCase()}. This records a receipt.`}
        footer={
          <>
            <Button variant="outline" onClick={closeSign} disabled={isSubmittingAck}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAcknowledge} disabled={!recipientName.trim() || isSubmittingAck}>
              {isSubmittingAck ? "Signing…" : "Sign for receipt"}
            </Button>
          </>
        }
      >
        <TextInput
          id="ack-recipient"
          label="Your name"
          autoFocus
          required
          maxLength={80}
          value={recipientName}
          placeholder="Full name"
          onChange={(e) => setRecipientName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAcknowledge();
            }
          }}
        />
        <TextInput
          id="ack-note"
          label="Note (optional)"
          maxLength={200}
          value={ackNote}
          placeholder="Anything the lead should know"
          onChange={(e) => setAckNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAcknowledge();
            }
          }}
        />
        {ackError && (
          <p role="alert" className="text-[13px] leading-5 text-on-error-container bg-error-container rounded-[2px] px-3 py-2 break-words">
            {ackError}
          </p>
        )}
      </Dialog>
    </div>
  );
}
