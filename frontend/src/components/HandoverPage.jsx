import React, { useState, useEffect } from "react";
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
  const approvedClaims = handoverData?.claims || [];
  const plan = handoverData?.plan || {};
  const day1Items = plan.day_1 || [];
  const week1Items = plan.week_1 || [];
  const month1Items = plan.month_1 || [];
  const hasApprovedClaims = approvedClaims.length > 0;

  return (
    <div className="flex flex-col w-full gap-space-lg">
      {/* Top Header Section */}
      <section className="flex flex-col gap-space-md mb-space-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
          <div>
            <div className="flex items-center gap-space-sm mb-1">
              <span className="font-code-sm text-code-sm text-primary uppercase tracking-wider font-semibold">
                Ledger Digest // Production Transition
              </span>
              <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
              <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                Verified Ramp-up Dossier
              </span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold">
              Official Handover Dossier
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-0.5 max-w-3xl">
              Transition plan compiled strictly from human-approved claims. Sensitive items are role-gated. Automated checks reduce errors and a human approves.
            </p>
          </div>
          <div className="flex items-center gap-space-sm shrink-0">
            <button
              id="btn-print"
              type="button"
              onClick={() => window.print()}
              className="px-space-md py-2 bg-surface-container-low hover:bg-surface-container text-on-surface rounded-lg font-label-md text-label-md transition-colors flex items-center gap-1.5 cursor-pointer border border-surface-container"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              <span>Print Dossier (PDF Export)</span>
            </button>
            <button
              id="btn-ack"
              type="button"
              onClick={() => {
                setRecipientName(`Engineer (${currentRoleObj.label})`);
                setAckModalOpen(true);
              }}
              disabled={!hasApprovedClaims}
              className="px-space-md py-2 bg-primary hover:bg-primary-container text-on-primary rounded-lg font-headline-sm text-headline-sm transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">verified_user</span>
              <span>Acknowledge Handover Receipt</span>
            </button>
          </div>
        </div>

        {/* Role Switcher Strip */}
        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-surface-container flex flex-col gap-space-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold mr-1">
                Role View:
              </span>
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRole(r.id)}
                  className={`role-btn px-3 py-1.5 rounded-lg font-label-md text-label-md transition-all cursor-pointer ${
                    role === r.id
                      ? "bg-secondary-fixed text-on-secondary-fixed font-bold shadow-xs"
                      : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                  }`}
                >
                  {r.label} ({r.access})
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5 font-body-sm text-body-sm text-on-surface-variant pt-1 border-t border-surface-container/60">
            <span className="material-symbols-outlined text-[15px] text-outline">info</span>
            <span id="role-caption">
              Current view: <strong className="text-on-surface">{currentRoleObj.label}</strong>.{" "}
              {role === "lead"
                ? "Full unrestricted access enabled for this tier."
                : "Claims citing restricted or confidential documents are withheld."}
            </span>
          </div>
        </div>

        {/* Acknowledgement Toast */}
        {ackSuccess && (
          <div
            className="bg-tertiary-fixed text-on-tertiary-fixed p-space-md rounded-lg flex items-center justify-between transition-all shadow-xs"
            id="ack-banner"
          >
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-tertiary text-[22px]">check_circle</span>
              <div>
                <span className="font-headline-sm text-headline-sm text-tertiary font-bold">
                  Receipt Written to Audit Log
                </span>
                <p className="font-code-sm text-code-sm text-on-tertiary-fixed-variant mt-0.5">
                  Signer: {ackSuccess.recipient_name || `simulated_${role}`} | Handover successfully acknowledged.
                </p>
              </div>
            </div>
            <button
              onClick={() => setAckSuccess(null)}
              className="text-on-tertiary-fixed-variant hover:text-on-tertiary-fixed cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        )}
      </section>

      {/* Main Handover Content: Empty State vs Phased Plan & Claims List */}
      {isLoading ? (
        <div className="p-space-2xl text-center bg-surface-container-lowest rounded-xl border border-surface-container">
          <span className="material-symbols-outlined text-[32px] text-primary animate-spin">refresh</span>
          <p className="font-label-md text-label-md text-on-surface-variant mt-2">Loading approved handover claims...</p>
        </div>
      ) : !hasApprovedClaims ? (
        /* Empty State */
        <div className="bg-surface-container-lowest rounded-xl p-space-2xl text-center shadow-sm border border-surface-container flex flex-col items-center justify-center my-space-lg">
          <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center text-primary mb-4">
            <span className="material-symbols-outlined text-[32px]">fact_check</span>
          </div>
          <h3 className="font-headline-md text-headline-md text-on-surface font-bold">
            No Approved Claims Yet
          </h3>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-md mt-2 mb-6">
            The handover dossier is compiled exclusively from reviewer-approved claims. Head to the Review Queue to check candidate claims and approve them.
          </p>
          <button
            onClick={() => setActiveTab("review")}
            className="px-space-lg py-2.5 bg-primary hover:bg-primary-container text-on-primary rounded-lg font-headline-sm text-headline-sm transition-all shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">assignment_turned_in</span>
            <span>Check the claims</span>
          </button>
        </div>
      ) : (
        <>
          {/* Phased Ramp-up Roadmap: 3 Columns */}
          <section className="flex flex-col gap-space-md">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface font-semibold">
                  Phased Ramp-up Roadmap
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Milestones partitioned by priority and verified code ownership.
                </p>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1 font-code-sm text-code-sm text-primary px-space-sm py-0.5 bg-primary-fixed rounded font-semibold">
                {approvedClaims.length} APPROVED CLAIMS
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-lg items-start">
              {/* Column 1: Day 1 */}
              <div className="flex flex-col gap-space-md bg-surface-container-low rounded-xl p-space-md shadow-sm border border-surface-container/60">
                <div className="flex items-center justify-between pb-space-xs">
                  <div className="flex items-center gap-space-xs">
                    <span className="w-6 h-6 rounded bg-error-container text-on-error-container flex items-center justify-center font-label-sm text-label-sm font-bold">
                      1
                    </span>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                      Day 1: Immediate Survival
                    </h3>
                  </div>
                  <span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-medium">
                    {day1Items.length} items
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Blockers, critical dependencies, and high-concentration areas.
                </p>

                <div className="flex flex-col gap-space-sm">
                  {day1Items.length === 0 ? (
                    <div className="p-space-md text-center bg-surface-container-lowest rounded-lg border border-surface-container text-on-surface-variant text-xs">
                      No Day 1 items approved for this role.
                    </div>
                  ) : (
                    day1Items.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-surface-container-lowest p-space-md rounded-lg shadow-xs border border-surface-container/60 flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="px-1.5 py-0.5 rounded bg-error-container text-on-error-container font-semibold uppercase text-[10px]">
                            {item.type}
                          </span>
                          <span className="font-code-sm text-[10px] text-outline uppercase">{item.access_level}</span>
                        </div>
                        <h4 className="font-headline-sm text-sm text-on-surface font-semibold">{item.title}</h4>
                        <p className="font-body-sm text-xs text-on-surface-variant line-clamp-3">{item.description}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Column 2: Week 1 */}
              <div className="flex flex-col gap-space-md bg-surface-container-low rounded-xl p-space-md shadow-sm border border-surface-container/60">
                <div className="flex items-center justify-between pb-space-xs">
                  <div className="flex items-center gap-space-xs">
                    <span className="w-6 h-6 rounded bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center font-label-sm text-label-sm font-bold">
                      2
                    </span>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                      Week 1: Knowledge Transfer
                    </h3>
                  </div>
                  <span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-medium">
                    {week1Items.length} items
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Key decisions, architectural context, and conflicting patterns.
                </p>

                <div className="flex flex-col gap-space-sm">
                  {week1Items.length === 0 ? (
                    <div className="p-space-md text-center bg-surface-container-lowest rounded-lg border border-surface-container text-on-surface-variant text-xs">
                      No Week 1 items approved for this role.
                    </div>
                  ) : (
                    week1Items.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-surface-container-lowest p-space-md rounded-lg shadow-xs border border-surface-container/60 flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="px-1.5 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed font-semibold uppercase text-[10px]">
                            {item.type}
                          </span>
                          <span className="font-code-sm text-[10px] text-outline uppercase">{item.access_level}</span>
                        </div>
                        <h4 className="font-headline-sm text-sm text-on-surface font-semibold">{item.title}</h4>
                        <p className="font-body-sm text-xs text-on-surface-variant line-clamp-3">{item.description}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Column 3: Month 1 */}
              <div className="flex flex-col gap-space-md bg-surface-container-low rounded-xl p-space-md shadow-sm border border-surface-container/60">
                <div className="flex items-center justify-between pb-space-xs">
                  <div className="flex items-center gap-space-xs">
                    <span className="w-6 h-6 rounded bg-primary-fixed text-on-primary-fixed flex items-center justify-center font-label-sm text-label-sm font-bold">
                      3
                    </span>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                      Month 1: Ownership
                    </h3>
                  </div>
                  <span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-medium">
                    {month1Items.length} items
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  System evolution, long-term ownership, and maintenance cadence.
                </p>

                <div className="flex flex-col gap-space-sm">
                  {month1Items.length === 0 ? (
                    <div className="p-space-md text-center bg-surface-container-lowest rounded-lg border border-surface-container text-on-surface-variant text-xs">
                      No Month 1 items approved for this role.
                    </div>
                  ) : (
                    month1Items.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-surface-container-lowest p-space-md rounded-lg shadow-xs border border-surface-container/60 flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="px-1.5 py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-semibold uppercase text-[10px]">
                            {item.type}
                          </span>
                          <span className="font-code-sm text-[10px] text-outline uppercase">{item.access_level}</span>
                        </div>
                        <h4 className="font-headline-sm text-sm text-on-surface font-semibold">{item.title}</h4>
                        <p className="font-body-sm text-xs text-on-surface-variant line-clamp-3">{item.description}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Approved Claims Detailed Table */}
          <section className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container overflow-hidden">
            <div className="p-space-lg flex items-center justify-between bg-surface-container-low border-b border-surface-container/60">
              <div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Approved Claims Ledger ({approvedClaims.length})
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  All claims approved for the {currentRoleObj.label} role.
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container text-on-surface-variant font-label-md text-label-md">
                    <th className="py-3 px-4 font-bold w-20">ID</th>
                    <th className="py-3 px-4 font-bold w-32">Type</th>
                    <th className="py-3 px-4 font-bold">Approved Claim Text</th>
                    <th className="py-3 px-4 font-bold w-28">Access</th>
                    <th className="py-3 px-4 font-bold w-28 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container text-body-sm font-body-sm text-on-surface">
                  {approvedClaims.map((claim) => (
                    <tr key={claim.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="py-3 px-4 font-code-sm text-xs text-outline font-bold">#{claim.id}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-surface-container font-code-sm text-xs uppercase font-semibold">
                          {claim.type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {claim.withheld ? (
                          <span className="text-outline italic">
                            Withheld ({claim.reason}) — request access from lead
                          </span>
                        ) : (
                          <span>{claim.text}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-code-sm text-xs text-on-surface-variant uppercase">
                        {claim.access_level}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="px-2 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed font-code-sm text-xs font-semibold capitalize">
                          {claim.status || "approved"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Dossier Footer Note */}
          <div className="p-space-md rounded-xl bg-surface-container-low text-on-surface-variant font-label-md text-label-md flex items-center justify-between border border-surface-container">
            <span>Official handover record compiled for {currentRoleObj.label}. Automated checks reduce errors and a human approves.</span>
            <span className="font-code-sm text-xs text-outline">{approvedClaims.length} claims on record</span>
          </div>
        </>
      )}

      {/* Acknowledge Modal */}
      {ackModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-surface-container-lowest rounded-xl shadow-lg border border-surface-container max-w-md w-full p-6 space-y-4">
            <h3 className="font-headline-md text-headline-md text-on-surface font-bold">
              Acknowledge Handover Receipt
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Confirming receipt creates an audit log record for the project handover.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-on-surface-variant block">Recipient Name / Title</label>
              <input
                type="text"
                className="w-full p-2.5 rounded-lg border border-surface-container bg-surface-container-low text-on-surface font-body-sm focus:outline-primary"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-on-surface-variant block">Optional Acknowledgment Note</label>
              <input
                type="text"
                className="w-full p-2.5 rounded-lg border border-surface-container bg-surface-container-low text-on-surface font-body-sm focus:outline-primary"
                placeholder="e.g. Reviewed Day 1 blockers with departing lead..."
                value={ackNote}
                onChange={(e) => setAckNote(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setAckModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-surface-container text-on-surface text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAcknowledge}
                disabled={!recipientName.trim() || isSubmittingAck}
                className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold cursor-pointer disabled:opacity-50"
              >
                {isSubmittingAck ? "Signing..." : "Sign Acknowledgment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
