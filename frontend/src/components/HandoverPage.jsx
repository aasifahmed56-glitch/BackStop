import React, { useState, useEffect } from "react";
import {
  Printer,
  CheckCircle2,
  Lock,
  Calendar,
  AlertTriangle,
  User,
  Compass,
  ArrowRight,
  ShieldCheck,
  FileCheck,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles,
  Info,
  Layers,
} from "lucide-react";
import { api } from "../api";
import { ROLES } from "./Navbar";

export default function HandoverPage({ role, setRole, setActiveTab }) {
  const [handoverData, setHandoverData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Acknowledge Modal
  const [ackModalOpen, setAckModalOpen] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [ackNote, setAckNote] = useState("");
  const [isSubmittingAck, setIsSubmittingAck] = useState(false);
  const [ackSuccess, setAckSuccess] = useState(null);

  // Expanded evidence drawer for claims
  const [expandedClaims, setExpandedClaims] = useState({});

  const toggleClaimExpand = (claimId) => {
    setExpandedClaims((prev) => ({
      ...prev,
      [claimId]: !prev[claimId],
    }));
  };

  const loadHandover = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getHandover({ projectId: 1, role });
      setHandoverData(data);
    } catch (err) {
      setError(err.message || "Failed to load handover");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHandover();
  }, [role]);

  const handleAcknowledge = async () => {
    if (!recipientName.trim()) return;
    setIsSubmittingAck(true);
    try {
      const res = await api.acknowledgeHandover(1, {
        role,
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

  const currentRoleObj = ROLES.find((r) => r.id === role) || ROLES[0];

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-2">
      {/* Handover Toolbar & Role Switcher */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
              Role-Gated Handover Dossier
            </span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs font-semibold text-gray-600">Simulated Viewer:</span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="font-bold text-sm bg-gray-50 border border-gray-300 rounded-lg px-3 py-1.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label} ({r.access})
                </option>
              ))}
            </select>
            <span className="text-xs text-gray-500 hidden sm:inline">
              ({currentRoleObj.desc})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 transition-colors shadow-2xs cursor-pointer"
            title="Print or export professional handover PDF"
          >
            <Printer className="w-4 h-4 text-gray-600" />
            Print Dossier
          </button>

          <button
            onClick={() => {
              setRecipientName(
                role === "incoming_dev" ? "Dev / Kabir" : role === "incoming_pm" ? "Sara" : "Team Member"
              );
              setAckNote("");
              setAckModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm cursor-pointer"
          >
            <FileCheck className="w-4 h-4" />
            Acknowledge Receipt
          </button>
        </div>
      </div>

      {/* Acknowledgment Alert */}
      {ackSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-950 p-4 rounded-xl flex items-start gap-3 shadow-xs animate-fade-in no-print">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <h4 className="font-bold text-sm text-emerald-900">
              Handover Formally Acknowledged! (Audit Log Entry #{ackSuccess.audit_log_id})
            </h4>
            <p className="mt-0.5 text-emerald-800">
              Acknowledged by <strong>{ackSuccess.recipient_name}</strong> as <em>{ackSuccess.role}</em> on {new Date(ackSuccess.timestamp).toLocaleString()}.
              A permanent immutable receipt has been saved in the project audit log.
            </p>
          </div>
        </div>
      )}

      {/* Dossier Document Container */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-10 space-y-8 print:p-0 print:border-none print:shadow-none">
        {/* Document Header */}
        <div className="border-b border-gray-200 pb-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 uppercase tracking-widest">
                <span>Official Transition Dossier</span>
                <span>·</span>
                <span>Verified Handover</span>
              </div>
              <h1 className="text-3xl font-black text-gray-900 mt-1 tracking-tight">
                {handoverData?.project?.name || "Campus Event App"}
              </h1>
            </div>

            <div className="text-left sm:text-right text-xs text-gray-500 space-y-1">
              <div>Departing Member: <strong className="text-gray-900">{handoverData?.project?.leaver_name || "Riya"}</strong></div>
              <div>Cutoff Date: <strong className="text-gray-900">{handoverData?.project?.departure_date || "2026-03-15"}</strong></div>
              <div>Rendered for: <strong className="text-indigo-700 uppercase">{role}</strong></div>
            </div>
          </div>

          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-600 flex items-start gap-3">
            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <strong>Strict Integrity Guarantee:</strong> This handover is constructed <em>only</em> from human-approved claims.
              Claims with access levels exceeding <strong>{currentRoleObj.access}</strong> are strictly withheld with zero text or quote disclosure.
            </div>
          </div>

          {handoverData?.claims_withheld > 0 && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600" />
                <span>
                  <strong>{handoverData.claims_withheld} sensitive claims withheld</strong> due to role access level ({currentRoleObj.access}).
                </span>
              </span>
              <span className="text-[11px] font-semibold text-amber-800">
                Contact Lead to request clearance
              </span>
            </div>
          )}
        </div>

        {/* Phased Transition Roadmap */}
        {handoverData?.plan && (
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-indigo-600" />
                <h2 className="text-xl font-black text-gray-900 tracking-tight">
                  Phased Ramp-up Roadmap
                </h2>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Rule-driven timeline derived automatically from approved blockers, sole-knowledge modules, and dependencies.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Day 1 */}
              <div className="bg-rose-50/50 rounded-xl border border-rose-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white rounded">
                    Day 1
                  </span>
                  <span className="text-xs font-bold text-rose-800">Immediate Focus</span>
                </div>
                <p className="text-[11px] text-rose-900/80 font-medium">
                  Blockers, sole-knowledge code ownership, and high-risk modules.
                </p>

                <div className="space-y-2 pt-1">
                  {handoverData.plan.day_1.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No Day 1 blockers.</p>
                  ) : (
                    handoverData.plan.day_1.map((item, idx) => (
                      <div key={idx} className="bg-white p-2.5 rounded-lg border border-rose-100 shadow-2xs text-xs space-y-1">
                        {item.withheld ? (
                          <div className="flex items-center gap-1.5 text-amber-800 font-bold text-[11px]">
                            <Lock className="w-3.5 h-3.5 text-amber-600" />
                            {item.title}
                          </div>
                        ) : (
                          <div className="font-semibold text-gray-900">{item.title}</div>
                        )}
                        <p className="text-[11px] text-gray-500 leading-snug">{item.description}</p>
                        <div className="text-[10px] font-bold text-rose-700">{item.action_prompt}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Week 1 */}
              <div className="bg-amber-50/50 rounded-xl border border-amber-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-amber-600 text-white rounded">
                    Week 1
                  </span>
                  <span className="text-xs font-bold text-amber-800">Operational Alignment</span>
                </div>
                <p className="text-[11px] text-amber-900/80 font-medium">
                  Decisions requiring rationale clarification and conflicting statements.
                </p>

                <div className="space-y-2 pt-1">
                  {handoverData.plan.week_1.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No Week 1 items.</p>
                  ) : (
                    handoverData.plan.week_1.map((item, idx) => (
                      <div key={idx} className="bg-white p-2.5 rounded-lg border border-amber-100 shadow-2xs text-xs space-y-1">
                        {item.withheld ? (
                          <div className="flex items-center gap-1.5 text-amber-800 font-bold text-[11px]">
                            <Lock className="w-3.5 h-3.5 text-amber-600" />
                            {item.title}
                          </div>
                        ) : (
                          <div className="font-semibold text-gray-900">{item.title}</div>
                        )}
                        <p className="text-[11px] text-gray-500 leading-snug">{item.description}</p>
                        <div className="text-[10px] font-bold text-amber-700">{item.action_prompt}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Month 1 */}
              <div className="bg-indigo-50/50 rounded-xl border border-indigo-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-indigo-600 text-white rounded">
                    Month 1
                  </span>
                  <span className="text-xs font-bold text-indigo-800">Long-term Mastery</span>
                </div>
                <p className="text-[11px] text-indigo-900/80 font-medium">
                  External dependencies, stale modules, and open follow-up questions.
                </p>

                <div className="space-y-2 pt-1">
                  {handoverData.plan.month_1.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No Month 1 items.</p>
                  ) : (
                    handoverData.plan.month_1.map((item, idx) => (
                      <div key={idx} className="bg-white p-2.5 rounded-lg border border-indigo-100 shadow-2xs text-xs space-y-1">
                        {item.withheld ? (
                          <div className="flex items-center gap-1.5 text-amber-800 font-bold text-[11px]">
                            <Lock className="w-3.5 h-3.5 text-amber-600" />
                            {item.title}
                          </div>
                        ) : (
                          <div className="font-semibold text-gray-900">{item.title}</div>
                        )}
                        <p className="text-[11px] text-gray-500 leading-snug">{item.description}</p>
                        <div className="text-[10px] font-bold text-indigo-700">{item.action_prompt}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Role-Emphasized Claims Breakdown */}
        <div className="space-y-6 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                <h2 className="text-xl font-black text-gray-900 tracking-tight">
                  Approved Ledger Claims for {currentRoleObj.label}
                </h2>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Only approved claims are rendered. Filtered strictly to match {role} responsibilities.
              </p>
            </div>
            <button
              onClick={() => setActiveTab("review")}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 no-print"
            >
              Manage in Review Queue <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {handoverData?.role_sections && Object.keys(handoverData.role_sections).length > 0 ? (
            Object.entries(handoverData.role_sections).map(([sectionKey, sectionClaims]) => (
              <div key={sectionKey} className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-500 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  {sectionKey} ({sectionClaims.length})
                </h3>

                <div className="space-y-2.5">
                  {sectionClaims.map((claim) => {
                    if (claim.withheld) {
                      return (
                        <div
                          key={claim.id}
                          className="p-3.5 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2.5 text-xs">
                            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
                              <Lock className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-bold text-amber-950">
                                Withheld [{claim.type.toUpperCase()}] Item
                              </div>
                              <p className="text-[11px] text-amber-800">
                                {claim.reason} · Request access from lead
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                            {claim.access_level}
                          </span>
                        </div>
                      );
                    }

                    const isExpanded = expandedClaims[claim.id];

                    return (
                      <div
                        key={claim.id}
                        className="p-4 rounded-xl border border-gray-200 bg-white shadow-2xs space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {claim.kind}
                              </span>
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {claim.status}
                              </span>
                              <span className="text-[10px] font-mono text-gray-400">
                                Claim #{claim.id}
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-gray-900 leading-snug">
                              {claim.text}
                            </p>
                          </div>

                          {claim.evidence && claim.evidence.length > 0 && (
                            <button
                              onClick={() => toggleClaimExpand(claim.id)}
                              className="text-xs font-medium text-gray-500 hover:text-indigo-600 flex items-center gap-1 shrink-0 p-1 rounded no-print cursor-pointer"
                            >
                              <span>{isExpanded ? "Hide Evidence" : "View Citation"}</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>

                        {/* Collapsible Evidence Quotes */}
                        {isExpanded && claim.evidence && (
                          <div className="pt-2 border-t border-gray-100 space-y-2 animate-fade-in">
                            <div className="text-[11px] font-bold text-gray-700">Exact Evidence Citations:</div>
                            {claim.evidence.map((ev, i) => (
                              <div key={i} className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 text-xs font-mono">
                                {ev.quote && (
                                  <div className="text-indigo-950 font-semibold mb-1">
                                    "{ev.quote}"
                                  </div>
                                )}
                                <div className="text-[10px] text-gray-500">
                                  Source #{ev.source_id} · Chunk #{ev.chunk_id} · Lines {ev.line_start}-{ev.line_end}
                                </div>
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
            <div className="p-10 bg-gray-50 rounded-2xl border border-gray-200 text-center space-y-3">
              <ShieldCheck className="w-8 h-8 mx-auto text-indigo-500" />
              <h4 className="text-sm font-bold text-gray-800">No Approved Claims for this Role</h4>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                Only approved claims appear in the handover. Head to the Review Queue to approve candidate claims.
              </p>
              <button
                onClick={() => setActiveTab("review")}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-xs hover:bg-indigo-700 cursor-pointer no-print"
              >
                Go to Review Queue
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Acknowledge Modal */}
      {ackModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in no-print">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-200">
            <div className="flex items-center gap-2 text-indigo-700 font-bold text-base">
              <FileCheck className="w-5 h-5" />
              Acknowledge Handover Receipt
            </div>
            <p className="text-xs text-gray-600">
              Confirming receipt records an immutable audit log entry documenting that the incoming role has reviewed and accepted the handover ledger.
            </p>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Recipient Name *</label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g. Dev (Incoming Backend Lead)"
                className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Optional Acceptance Note</label>
              <textarea
                rows={2}
                value={ackNote}
                onChange={(e) => setAckNote(e.target.value)}
                placeholder="e.g. Reviewed Day 1 blockers and auth module sole knowledge items."
                className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setAckModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAcknowledge}
                disabled={!recipientName.trim() || isSubmittingAck}
                className="px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-40 shadow-xs cursor-pointer"
              >
                {isSubmittingAck ? "Logging..." : "Confirm & Sign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

