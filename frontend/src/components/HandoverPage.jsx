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
    <div className="space-y-6 max-w-5xl mx-auto py-2">
      {/* Handover Toolbar & Role Switcher */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#e2e8f0] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#004ac6] bg-[#dbe1ff] px-2.5 py-0.5 rounded-md font-mono">
              Role-Gated Dossier
            </span>
            <span className="text-[#c3c6d7]">•</span>
            <span className="text-xs font-semibold text-[#737686]">Simulated Role:</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap pt-0.5">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="font-bold text-xs sm:text-sm bg-[#f8f9ff] border border-[#e2e8f0] rounded-lg px-3 py-1.5 text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] cursor-pointer"
            >
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label} ({r.access})
                </option>
              ))}
            </select>
            <span className="text-xs text-[#737686] hidden sm:inline">
              — {currentRoleObj.desc}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-white hover:bg-[#f8f9ff] text-[#334155] border border-[#e2e8f0] transition-colors shadow-2xs cursor-pointer"
            title="Print or export clean PDF handover dossier"
          >
            <Printer className="w-3.5 h-3.5 text-[#737686]" />
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
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-[#004ac6] hover:bg-[#003ea8] text-white transition-colors shadow-2xs cursor-pointer"
          >
            <FileCheck className="w-3.5 h-3.5 text-white" />
            Acknowledge Receipt
          </button>
        </div>
      </div>

      {/* Acknowledgment Alert */}
      {ackSuccess && (
        <div className="bg-[#ecfdf5] border border-[#a7f3d0] text-[#065f46] p-4 rounded-xl flex items-start gap-3 shadow-2xs animate-fade-in no-print">
          <CheckCircle2 className="w-5 h-5 text-[#059669] shrink-0 mt-0.5" />
          <div className="text-xs">
            <h4 className="font-bold text-sm text-[#065f46]">
              Cryptographic Receipt Written to AuditLog (Entry #{ackSuccess.audit_log_id})
            </h4>
            <p className="mt-0.5 text-[#047857]">
              Acknowledged by <strong>{ackSuccess.recipient_name}</strong> as <em>{ackSuccess.role}</em> on {new Date(ackSuccess.timestamp).toLocaleString()}.
              Permanent immutable receipt saved in SQLite audit log.
            </p>
          </div>
        </div>
      )}

      {/* Dossier Document Container */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs p-6 md:p-8 space-y-7 print:p-0 print:border-none print:shadow-none">
        {/* Document Header */}
        <div className="border-b border-[#f1f5f9] pb-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-[#004ac6] uppercase tracking-wider font-mono">
                <span>Official Transition Dossier</span>
                <span>·</span>
                <span>Verified Handover</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0b1c30] mt-1 tracking-tight">
                {handoverData?.project?.name || "Campus Event App"}
              </h1>
            </div>

            <div className="text-left sm:text-right text-xs text-[#737686] space-y-1 font-mono">
              <div>Departing Member: <strong className="text-[#0b1c30] font-sans">{handoverData?.project?.leaver_name || "Riya"}</strong></div>
              <div>Cutoff Date: <strong className="text-[#0b1c30]">{handoverData?.project?.departure_date || "2026-03-15"}</strong></div>
              <div>Rendered for: <strong className="text-[#004ac6] uppercase">{role}</strong></div>
            </div>
          </div>

          <div className="p-3.5 bg-[#f8f9ff] rounded-xl border border-[#e2e8f0] text-xs text-[#434655] flex items-start gap-2.5">
            <Info className="w-4 h-4 text-[#004ac6] shrink-0 mt-0.5" />
            <div>
              <strong>Strict Integrity Guarantee:</strong> This handover is constructed <em>only</em> from human-approved claims.
              Claims with access levels exceeding <strong>{currentRoleObj.access}</strong> are strictly withheld with no text or quote disclosed.
            </div>
          </div>

          {handoverData?.claims_withheld > 0 && (
            <div className="p-3 bg-[#fffbeb] rounded-xl border border-[#fde68a] text-xs text-[#92400e] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#d97706]" />
                <span>
                  <strong>{handoverData.claims_withheld} sensitive claims withheld</strong> due to role access level ({currentRoleObj.access}).
                </span>
              </span>
              <span className="text-[11px] font-semibold text-[#b45309]">
                Request clearance from lead
              </span>
            </div>
          )}
        </div>

        {/* Phased Transition Roadmap */}
        {handoverData?.plan && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-[#004ac6]" />
                  <h2 className="text-lg font-bold text-[#0b1c30] tracking-tight">
                    Phased Ramp-up Roadmap
                  </h2>
                </div>
                <p className="text-xs text-[#737686] mt-0.5">
                  Deterministic timeline partitioned by knowledge blast radius and verified code ownership.
                </p>
              </div>
              <span className="text-[11px] font-mono text-[#004ac6] bg-[#dbe1ff] px-2 py-0.5 rounded font-semibold self-start sm:self-auto">
                AUTO-SORTED BY RISK
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Day 1 */}
              <div className="bg-[#f8f9ff] rounded-xl border border-[#e2e8f0] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center font-mono text-[11px] font-bold">
                      1
                    </span>
                    <h3 className="text-xs font-bold text-[#0b1c30]">Day 1: Immediate Survival</h3>
                  </div>
                  <span className="text-[10px] font-bold font-mono text-[#ba1a1a] bg-[#ffdad6]/60 px-1.5 py-0.5 rounded">
                    {handoverData.plan.day_1.length} items
                  </span>
                </div>
                <p className="text-[11px] text-[#737686]">
                  Sole-knowledge risks ≥70% leaver share, active blockers, critical dependencies.
                </p>

                <div className="space-y-2 pt-1">
                  {handoverData.plan.day_1.length === 0 ? (
                    <p className="text-xs text-[#737686] italic">No Day 1 blockers.</p>
                  ) : (
                    handoverData.plan.day_1.map((item, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-lg border border-[#e2e8f0] shadow-2xs text-xs space-y-1.5">
                        {item.withheld ? (
                          <div className="flex items-center gap-1.5 text-[#92400e] font-bold text-[11px]">
                            <Lock className="w-3.5 h-3.5 text-[#d97706]" />
                            {item.title}
                          </div>
                        ) : (
                          <div className="font-bold text-[#0b1c30]">{item.title}</div>
                        )}
                        <p className="text-[11px] text-[#434655] leading-relaxed">{item.description}</p>
                        <div className="text-[10px] font-bold text-[#ba1a1a] bg-[#ffdad6]/40 p-1.5 rounded border border-[#ffdad6]">
                          {item.action_prompt}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Week 1 */}
              <div className="bg-[#f8f9ff] rounded-xl border border-[#e2e8f0] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-[#dbe1ff] text-[#00174b] flex items-center justify-center font-mono text-[11px] font-bold">
                      2
                    </span>
                    <h3 className="text-xs font-bold text-[#0b1c30]">Week 1: Operational Alignment</h3>
                  </div>
                  <span className="text-[10px] font-bold font-mono text-[#004ac6] bg-[#dbe1ff]/60 px-1.5 py-0.5 rounded">
                    {handoverData.plan.week_1.length} items
                  </span>
                </div>
                <p className="text-[11px] text-[#737686]">
                  Decisions requiring rationale clarification and conflicting architectural statements.
                </p>

                <div className="space-y-2 pt-1">
                  {handoverData.plan.week_1.length === 0 ? (
                    <p className="text-xs text-[#737686] italic">No Week 1 items.</p>
                  ) : (
                    handoverData.plan.week_1.map((item, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-lg border border-[#e2e8f0] shadow-2xs text-xs space-y-1.5">
                        {item.withheld ? (
                          <div className="flex items-center gap-1.5 text-[#92400e] font-bold text-[11px]">
                            <Lock className="w-3.5 h-3.5 text-[#d97706]" />
                            {item.title}
                          </div>
                        ) : (
                          <div className="font-bold text-[#0b1c30]">{item.title}</div>
                        )}
                        <p className="text-[11px] text-[#434655] leading-relaxed">{item.description}</p>
                        <div className="text-[10px] font-bold text-[#004ac6] bg-[#e5eeff]/50 p-1.5 rounded border border-[#dce9ff]">
                          {item.action_prompt}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Month 1 */}
              <div className="bg-[#f8f9ff] rounded-xl border border-[#e2e8f0] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-[#f1f5f9] text-[#475569] flex items-center justify-center font-mono text-[11px] font-bold">
                      3
                    </span>
                    <h3 className="text-xs font-bold text-[#0b1c30]">Month 1: Long-term Mastery</h3>
                  </div>
                  <span className="text-[10px] font-bold font-mono text-[#475569] bg-[#f1f5f9] px-1.5 py-0.5 rounded">
                    {handoverData.plan.month_1.length} items
                  </span>
                </div>
                <p className="text-[11px] text-[#737686]">
                  External dependencies, stale modules (&gt;30 days), and open leaver debrief questions.
                </p>

                <div className="space-y-2 pt-1">
                  {handoverData.plan.month_1.length === 0 ? (
                    <p className="text-xs text-[#737686] italic">No Month 1 items.</p>
                  ) : (
                    handoverData.plan.month_1.map((item, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-lg border border-[#e2e8f0] shadow-2xs text-xs space-y-1.5">
                        {item.withheld ? (
                          <div className="flex items-center gap-1.5 text-[#92400e] font-bold text-[11px]">
                            <Lock className="w-3.5 h-3.5 text-[#d97706]" />
                            {item.title}
                          </div>
                        ) : (
                          <div className="font-bold text-[#0b1c30]">{item.title}</div>
                        )}
                        <p className="text-[11px] text-[#434655] leading-relaxed">{item.description}</p>
                        <div className="text-[10px] font-bold text-[#475569] bg-[#f1f5f9] p-1.5 rounded border border-[#e2e8f0]">
                          {item.action_prompt}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Role-Emphasized Claims Breakdown */}
        <div className="space-y-5 pt-4 border-t border-[#f1f5f9]">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#004ac6]" />
                <h2 className="text-lg font-bold text-[#0b1c30] tracking-tight">
                  Approved Ledger Claims for {currentRoleObj.label}
                </h2>
              </div>
              <p className="text-xs text-[#737686] mt-0.5">
                Only approved claims are rendered. Filtered strictly to match {role} responsibilities.
              </p>
            </div>
            <button
              onClick={() => setActiveTab("review")}
              className="text-xs font-bold text-[#004ac6] hover:underline flex items-center gap-1 no-print cursor-pointer"
            >
              Manage in Review Queue <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {handoverData?.role_sections && Object.keys(handoverData.role_sections).length > 0 ? (
            Object.entries(handoverData.role_sections).map(([sectionKey, sectionClaims]) => (
              <div key={sectionKey} className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#737686] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#004ac6]" />
                  {sectionKey} ({sectionClaims.length})
                </h3>

                <div className="space-y-2">
                  {sectionClaims.map((claim) => {
                    if (claim.withheld) {
                      return (
                        <div
                          key={claim.id}
                          className="p-3.5 rounded-xl border border-dashed border-[#fde68a] bg-[#fffbeb]/70 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2.5 text-xs">
                            <div className="w-7 h-7 rounded-lg bg-[#fef3c7] flex items-center justify-center text-[#92400e]">
                              <Lock className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-bold text-[#92400e]">
                                Withheld [{claim.type.toUpperCase()}] Item
                              </div>
                              <p className="text-[11px] text-[#b45309]">
                                {claim.reason} · Request access from lead
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#fef3c7] text-[#92400e] border border-[#fde68a]">
                            {claim.access_level}
                          </span>
                        </div>
                      );
                    }

                    const isExpanded = expandedClaims[claim.id];

                    return (
                      <div
                        key={claim.id}
                        className="p-4 rounded-xl border border-[#e2e8f0] bg-white shadow-2xs space-y-2 hover:border-[#cbd5e1] transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#e2dfff] text-[#0f0069] border border-[#c3c0ff]">
                                {claim.kind}
                              </span>
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0] flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#059669]"></span>
                                {claim.status}
                              </span>
                              <span className="text-[10px] font-mono text-[#737686]">
                                Claim #{claim.id}
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-[#0b1c30] leading-snug">
                              {claim.text}
                            </p>
                          </div>

                          {claim.evidence && claim.evidence.length > 0 && (
                            <button
                              onClick={() => toggleClaimExpand(claim.id)}
                              className="text-xs font-medium text-[#737686] hover:text-[#004ac6] flex items-center gap-1 shrink-0 p-1 rounded no-print cursor-pointer"
                            >
                              <span>{isExpanded ? "Hide Evidence" : "View Citation"}</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>

                        {/* Collapsible Evidence Quotes */}
                        {isExpanded && claim.evidence && (
                          <div className="pt-2 border-t border-[#f1f5f9] space-y-1.5 animate-fade-in">
                            <div className="text-[11px] font-bold text-[#0b1c30]">Exact Evidence Citations:</div>
                            {claim.evidence.map((ev, i) => (
                              <div key={i} className="p-2.5 bg-[#f8f9ff] rounded-lg border border-[#e2e8f0] text-xs font-mono">
                                {ev.quote && (
                                  <div className="text-[#004ac6] font-semibold mb-1">
                                    "{ev.quote}"
                                  </div>
                                )}
                                <div className="text-[10px] text-[#737686]">
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
            <div className="p-10 bg-[#f8f9ff] rounded-xl border border-[#e2e8f0] text-center space-y-3">
              <ShieldCheck className="w-8 h-8 mx-auto text-[#004ac6]" />
              <h4 className="text-sm font-bold text-[#0b1c30]">No Approved Claims for this Role</h4>
              <p className="text-xs text-[#737686] max-w-md mx-auto">
                Only approved claims appear in the handover. Head to the Review Queue to approve candidate claims.
              </p>
              <button
                onClick={() => setActiveTab("review")}
                className="px-4 py-2 bg-[#004ac6] hover:bg-[#003ea8] text-white rounded-lg text-xs font-bold shadow-2xs cursor-pointer no-print"
              >
                Go to Review Queue
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Acknowledge Modal */}
      {ackModalOpen && (
        <div className="fixed inset-0 bg-[#0b1c30]/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in no-print">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-[#cbd5e1]">
            <div className="flex items-center gap-2 text-[#004ac6] font-bold text-base">
              <FileCheck className="w-5 h-5" />
              Acknowledge Handover Receipt
            </div>
            <p className="text-xs text-[#434655]">
              Confirming receipt records an immutable audit log entry documenting that the incoming role has reviewed and accepted the handover ledger.
            </p>
            <div>
              <label className="block text-xs font-semibold text-[#0b1c30] mb-1">Recipient Name *</label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g. Dev (Incoming Backend Lead)"
                className="w-full text-xs p-2.5 bg-[#f8f9ff] border border-[#e2e8f0] rounded-lg focus:ring-2 focus:ring-[#004ac6] focus:outline-none text-[#0b1c30]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0b1c30] mb-1">Optional Acceptance Note</label>
              <textarea
                rows={2}
                value={ackNote}
                onChange={(e) => setAckNote(e.target.value)}
                placeholder="e.g. Reviewed Day 1 blockers and auth module sole knowledge items."
                className="w-full text-xs p-2.5 bg-[#f8f9ff] border border-[#e2e8f0] rounded-lg focus:ring-2 focus:ring-[#004ac6] focus:outline-none text-[#0b1c30]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setAckModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-[#434655] hover:bg-[#f1f5f9] rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAcknowledge}
                disabled={!recipientName.trim() || isSubmittingAck}
                className="px-4 py-1.5 text-xs font-bold bg-[#004ac6] hover:bg-[#003ea8] text-white rounded-lg disabled:opacity-40 shadow-2xs cursor-pointer"
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

