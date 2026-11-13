import React, { useState, useEffect } from "react";
import {
  Printer, CheckCircle2, Lock, Compass, ArrowRight,
  ShieldCheck, FileCheck, ChevronDown, ChevronUp,
  Layers, HelpCircle,
} from "lucide-react";
import { api } from "../api";

const HANDOVER_ROLES = [
  {
    id: "incoming_dev",
    label: "New developer",
    canSee: "Owners, decisions with reasons, risks, sole-knowledge modules, and contacts.",
    cannotSee: "Restricted advisor notes and confidential budget figures.",
  },
  {
    id: "incoming_pm",
    label: "New project manager",
    canSee: "Owners, open questions, blockers, risks, and next actions.",
    cannotSee: "Restricted advisor notes and confidential budget figures.",
  },
  {
    id: "lead",
    label: "Lead",
    canSee: "All project decisions, code risks, and restricted advisor notes.",
    cannotSee: "Confidential executive budget items.",
  },
];

function HelpPanel({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-2xl bg-white shadow-xs overflow-hidden no-print">
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

function PlanColumn({ phase, label, urgency, colorScheme, items }) {
  const { bg, border, badge, badgeText, actionText } = colorScheme;
  return (
    <div className={`${bg} rounded-2xl border ${border} p-5 space-y-3.5`}>
      <div className="flex items-center justify-between">
        <span className={`px-3 py-1 text-xs font-black uppercase tracking-wider ${badge} ${badgeText} rounded-lg`}>
          {phase}
        </span>
        <span className={`text-xs font-bold ${actionText}`}>{urgency}</span>
      </div>
      <div className="space-y-2.5">
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No items for this phase.</p>
        ) : items.map((item, idx) => (
          <div key={idx} className="bg-white p-3.5 rounded-xl border border-white/80 shadow-xs text-sm space-y-1.5">
            {item.withheld ? (
              <div className="flex items-start gap-2.5 text-gray-600">
                <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-gray-800">Hidden: you don't have access</p>
                  <p className="text-xs text-gray-500 mt-0.5">Requires higher clearance — request access from lead.</p>
                </div>
              </div>
            ) : (
              <>
                <p className="font-bold text-gray-900 leading-snug">{item.title}</p>
                {item.description && <p className="text-xs text-gray-600 leading-relaxed">{item.description}</p>}
                {item.action_prompt && <p className={`text-xs font-bold ${actionText}`}>{item.action_prompt}</p>}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HandoverPage({ role, setRole, setActiveTab }) {
  const [localRole, setLocalRole] = useState(role || "incoming_dev");
  const [handoverData, setHandoverData] = useState(null);
  const [isLoading, setIsLoading]       = useState(false);
  const [error, setError]               = useState(null);

  const [ackModalOpen, setAckModalOpen]   = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [ackNote, setAckNote]             = useState("");
  const [isSubmittingAck, setIsSubmittingAck] = useState(false);
  const [ackSuccess, setAckSuccess]       = useState(null);

  const [expandedClaims, setExpandedClaims] = useState({});
  const toggleClaimExpand = (id) =>
    setExpandedClaims((p) => ({ ...p, [id]: !p[id] }));

  const currentRoleObj = HANDOVER_ROLES.find((r) => r.id === localRole) || HANDOVER_ROLES[0];

  const changeRole = (newRole) => {
    setLocalRole(newRole);
    if (setRole) setRole(newRole);
  };

  const loadHandover = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getHandover({ projectId: 1, role: localRole });
      setHandoverData(data);
    } catch (err) {
      setError(err.message || "Failed to load handover");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadHandover(); }, [localRole]);

  const handleAcknowledge = async () => {
    if (!recipientName.trim()) return;
    setIsSubmittingAck(true);
    try {
      const res = await api.acknowledgeHandover(1, {
        role: localRole,
        recipientName: recipientName.trim(),
        note: ackNote.trim() || undefined,
      });
      setAckSuccess(res);
      setAckModalOpen(false);
    } catch (err) {
      alert("Acknowledgment failed: " + err.message);
    } finally {
      setIsSubmittingAck(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-4">

      {/* Header + NEXT STEP MAIN BUTTON */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">Handover for the new person</h1>
          <p className="text-[15px] text-gray-600 mt-1">
            Built from approved claims. Switch roles below to see what each teammate sees.
          </p>
        </div>

        {/* ONE OBVIOUS MAIN BUTTON FOR NEXT STEP */}
        <button
          onClick={() => setActiveTab?.("backtest")}
          className="flex items-center gap-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl text-[15px] shadow-sm hover:shadow-md transition-all transform active:scale-95 cursor-pointer shrink-0"
        >
          <span>Next: Did it work? (test)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Help Panel */}
      <HelpPanel>
        <p>
          This handover plan organizes approved transition items into Day 1, Week 1, and Month 1 timelines.
          Sensitive items are withheld automatically based on the selected recipient's role.
        </p>
      </HelpPanel>

      {/* ROLE SELECTOR: PROMINENT & INLINE */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs no-print space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label className="text-[15px] font-bold text-gray-900">
            View this handover as:
          </label>
          <span className="text-xs text-gray-400">Simulated role view</span>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {HANDOVER_ROLES.map((r) => (
            <button
              key={r.id}
              onClick={() => changeRole(r.id)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all cursor-pointer ${
                localRole === r.id
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-200"
                  : "bg-gray-50 text-gray-700 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Plain-language line beside/under it */}
        <div className="bg-gray-50 rounded-xl px-5 py-3.5 text-sm space-y-1.5 border border-gray-200">
          <p className="text-gray-900">
            <span className="font-bold text-emerald-700">Can see:</span> {currentRoleObj.canSee}
          </p>
          <p className="text-gray-900">
            <span className="font-bold text-rose-600">Cannot see:</span> {currentRoleObj.cannotSee}
          </p>
        </div>
      </div>

      {/* Loading & Error */}
      {isLoading && (
        <div className="bg-white p-12 text-center rounded-2xl border border-gray-200">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent" />
          <p className="mt-3 text-sm text-gray-500 font-medium">Generating handover view for {currentRoleObj.label}...</p>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 p-6 rounded-2xl text-[15px] text-rose-800 text-center space-y-2">
          <p className="font-semibold">Could not load handover</p>
          <p className="text-xs">{error}</p>
          <button onClick={loadHandover} className="text-indigo-600 font-bold hover:underline text-sm cursor-pointer">Retry</button>
        </div>
      )}

      {/* Acknowledged Banner */}
      {ackSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-950 p-4 rounded-2xl flex items-start gap-3 no-print">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm">Handover acknowledged (Audit log #{ackSuccess.audit_log_id})</p>
            <p className="text-sm text-emerald-800 mt-0.5">
              Signed by <strong>{ackSuccess.recipient_name}</strong> as <em>{ackSuccess.role}</em> on {new Date(ackSuccess.timestamp).toLocaleString()}.
            </p>
          </div>
        </div>
      )}

      {handoverData && !isLoading && !error && (
        <div className="space-y-8">
          {/* Withheld claims count notice */}
          {handoverData.claims_withheld > 0 && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 text-sm text-amber-900 no-print">
              <Lock className="w-5 h-5 text-amber-600 shrink-0" />
              <p>
                <strong>{handoverData.claims_withheld} sensitive items are hidden</strong> from this role.
                Neither text nor quotes are disclosed. Contact the lead to request clearance.
              </p>
            </div>
          )}

          {/* Phased Action Plan */}
          {handoverData.plan && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-indigo-600" />
                <h2 className="text-xl font-black text-gray-900">Phased transition plan</h2>
              </div>
              <p className="text-sm text-gray-500">
                Determined automatically by rules: blockers in Day 1, decisions in Week 1, and dependencies in Month 1.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <PlanColumn
                  phase="Day 1"
                  urgency="Immediate focus"
                  colorScheme={{
                    bg: "bg-rose-50/50",
                    border: "border-rose-200",
                    badge: "bg-rose-600",
                    badgeText: "text-white",
                    actionText: "text-rose-700",
                  }}
                  items={handoverData.plan.day_1}
                />
                <PlanColumn
                  phase="Week 1"
                  urgency="Key decisions"
                  colorScheme={{
                    bg: "bg-amber-50/50",
                    border: "border-amber-200",
                    badge: "bg-amber-500",
                    badgeText: "text-white",
                    actionText: "text-amber-700",
                  }}
                  items={handoverData.plan.week_1}
                />
                <PlanColumn
                  phase="Month 1"
                  urgency="Dependencies"
                  colorScheme={{
                    bg: "bg-indigo-50/50",
                    border: "border-indigo-200",
                    badge: "bg-indigo-600",
                    badgeText: "text-white",
                    actionText: "text-indigo-700",
                  }}
                  items={handoverData.plan.month_1}
                />
              </div>
            </div>
          )}

          {/* Approved Claims Sections */}
          <div className="space-y-6 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                <h2 className="text-xl font-black text-gray-900">Approved claims for {currentRoleObj.label}</h2>
              </div>
              <button
                onClick={() => setActiveTab?.("review")}
                className="text-sm font-bold text-indigo-600 hover:underline flex items-center gap-1 no-print cursor-pointer"
              >
                Back to review <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {handoverData.role_sections && Object.keys(handoverData.role_sections).length > 0 ? (
              Object.entries(handoverData.role_sections).map(([key, sectionClaims]) => (
                <div key={key} className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-500 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    {key} ({sectionClaims.length})
                  </h3>
                  <div className="space-y-2.5">
                    {sectionClaims.map((claim) => {
                      if (claim.withheld) {
                        return (
                          <div key={claim.id} className="p-4 rounded-2xl border border-dashed border-gray-300 bg-gray-50 flex items-center gap-3">
                            <Lock className="w-5 h-5 text-gray-400 shrink-0" />
                            <div>
                              <p className="text-[15px] font-semibold text-gray-700">Hidden: you don't have access</p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                Requires {claim.access_level ?? "higher"} access — request clearance from your lead.
                              </p>
                            </div>
                          </div>
                        );
                      }
                      const isExpanded = expandedClaims[claim.id];
                      return (
                        <div key={claim.id} className="p-4 rounded-2xl border border-gray-200 bg-white shadow-xs space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1.5 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded border ${
                                  claim.kind === "derived"
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : "bg-purple-50 text-purple-700 border-purple-200"
                                }`}>{claim.kind}</span>
                                <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">{claim.status}</span>
                                <span className="text-xs text-gray-400 font-mono">#{claim.id}</span>
                              </div>
                              <p className="text-[15px] font-semibold text-gray-900 leading-snug">{claim.text}</p>
                            </div>
                            {claim.evidence?.length > 0 && (
                              <button
                                onClick={() => toggleClaimExpand(claim.id)}
                                className="text-xs font-semibold text-gray-500 hover:text-indigo-600 flex items-center gap-1 shrink-0 cursor-pointer no-print p-1"
                              >
                                {isExpanded ? "Hide quote" : "Show quote"}
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                          {isExpanded && claim.evidence && (
                            <div className="pt-2 border-t border-gray-100 space-y-2">
                              {claim.evidence.map((ev, i) => (
                                <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs font-mono">
                                  {ev.quote && <div className="text-indigo-900 font-semibold mb-1">"{ev.quote}"</div>}
                                  <div className="text-gray-400">Source #{ev.source_id} · Chunk #{ev.chunk_id} · Lines {ev.line_start}-{ev.line_end}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-10 bg-gray-50 rounded-2xl border border-gray-200 text-center space-y-4">
                <ShieldCheck className="w-10 h-10 mx-auto text-indigo-400" />
                <div>
                  <h4 className="text-base font-bold text-gray-800">No approved claims for this role yet</h4>
                  <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                    Approve claims in Step 2 (Check the claims) to populate this handover.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab?.("review")}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl cursor-pointer hover:bg-indigo-700 transition-colors no-print"
                >
                  Go to Check the claims <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Bottom Toolbar: Print & Acknowledge & Next Step */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-6 border-t border-gray-200 no-print">
            <div className="flex items-center gap-3">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 cursor-pointer shadow-xs"
              >
                <Printer className="w-4 h-4" /> Print / Export PDF
              </button>
              <button
                onClick={() => {
                  setRecipientName(localRole === "incoming_dev" ? "New developer" : localRole === "incoming_pm" ? "New PM" : "Lead");
                  setAckNote("");
                  setAckModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs"
              >
                <FileCheck className="w-4 h-4" /> Acknowledge receipt
              </button>
            </div>

            <button
              onClick={() => setActiveTab?.("backtest")}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-xs"
            >
              Next: Did it work? (test) <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Acknowledge Modal */}
      {ackModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 no-print">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-200">
            <div className="flex items-center gap-2 text-indigo-700 font-bold text-base">
              <FileCheck className="w-5 h-5" /> Sign handover acknowledgment
            </div>
            <p className="text-sm text-gray-600">
              Records an immutable audit log entry confirming receipt by the incoming role.
            </p>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Recipient name *</label>
              <input type="text" value={recipientName} onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g. Kabir (New Developer)"
                className="w-full text-sm p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Note (optional)</label>
              <textarea rows={2} value={ackNote} onChange={(e) => setAckNote(e.target.value)}
                placeholder="e.g. Reviewed Day 1 blockers and sole knowledge modules."
                className="w-full text-sm p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setAckModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer">Cancel</button>
              <button onClick={handleAcknowledge} disabled={!recipientName.trim() || isSubmittingAck}
                className="px-4 py-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl disabled:opacity-40 cursor-pointer">
                {isSubmittingAck ? "Saving..." : "Confirm & Sign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
