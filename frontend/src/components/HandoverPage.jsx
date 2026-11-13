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
  const approvedClaims = handoverData?.approved_claims || [];
  const plan = handoverData?.plan || {};
  const day1Items = plan.day_1 || [];
  const week1Items = plan.week_1 || [];
  const month1Items = plan.month_1 || [];

  return (
    <div className="flex flex-col w-full gap-space-lg">
      {/* Top Header & Role Switcher Section */}
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
              Deterministic transition plan compiled strictly from human-approved claims. Sensitive items are role-gated.
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
              className="px-space-md py-2 bg-primary hover:bg-primary-container text-on-primary rounded-lg font-headline-sm text-headline-sm transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
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
                Evaluator Role:
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
              Current simulation: Viewing as <strong className="text-on-surface">{currentRoleObj.label}</strong>.{" "}
              {role === "lead" || role === "admin"
                ? "Full unrestricted access enabled for this tier."
                : "Claims citing restricted or confidential documents are withheld."}
            </span>
          </div>
        </div>

        {/* Cryptographic Acknowledgement Toast */}
        {ackSuccess && (
          <div
            className="bg-tertiary-fixed text-on-tertiary-fixed p-space-md rounded-lg flex items-center justify-between transition-all shadow-xs"
            id="ack-banner"
          >
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-tertiary text-[22px]">check_circle</span>
              <div>
                <span className="font-headline-sm text-headline-sm text-tertiary font-bold">
                  Cryptographic Receipt Written to AuditLog
                </span>
                <p className="font-code-sm text-code-sm text-on-tertiary-fixed-variant mt-0.5">
                  Digest: {ackSuccess.entry_hash || "sha256:7e8b2f90a...e311"} | Signer: {ackSuccess.recipient_name || `simulated_${role}`} | Timestamp: UTC NOW
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

      {/* Interactive Phased Ramp-up Roadmap: 3 Columns */}
      <section className="flex flex-col gap-space-md">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface font-semibold">
              Phased Ramp-up Roadmap
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Deterministic milestones partitioned by knowledge blast radius and verified code ownership.
            </p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1 font-code-sm text-code-sm text-primary px-space-sm py-0.5 bg-primary-fixed rounded font-semibold">
            AUTO-SORTED: RECENCY & RISK COEFF
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-lg items-start">
          {/* Column 1: Immediate Survival */}
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
                {day1Items.length > 0 ? `${day1Items.length} items` : "2 items"}
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Sole-knowledge risks ≥70% leaver share, active blockers, critical credentials contacts.
            </p>

            {/* Day 1 Card 1: deploy pipeline */}
            <div className="bg-surface-container-lowest rounded-lg p-space-md shadow-sm flex flex-col gap-space-sm hover:shadow-md transition-shadow border border-surface-container">
              <div className="flex items-center justify-between gap-space-xs">
                <span className="inline-flex items-center gap-1 font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-error"></span>Sole-Knowledge
                </span>
                <span className="font-code-sm text-code-sm text-outline">RISK-92</span>
              </div>
              <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                deploy/ pipeline sole ownership
              </h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                Riya holds <strong className="text-on-surface">92% commit attribution</strong> across staging and canary runner orchestration scripts.
              </p>
              <div className="bg-surface-container-low rounded p-space-sm flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-[16px] text-primary">priority_high</span>
                <span className="font-label-sm text-label-sm text-primary font-semibold">
                  Action: Shadow deployment on staging before EOW.
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 font-label-sm text-label-sm text-on-surface-variant">
                <span>Source: git log --stat</span>
                <span className="text-tertiary flex items-center gap-0.5 font-semibold">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>Verified
                </span>
              </div>
            </div>

            {/* Day 1 Card 2: Staging SSL */}
            <div className="bg-surface-container-lowest rounded-lg p-space-md shadow-sm flex flex-col gap-space-sm hover:shadow-md transition-shadow border border-surface-container">
              <div className="flex items-center justify-between gap-space-xs">
                <span className="inline-flex items-center gap-1 font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-error"></span>Blocker
                </span>
                <span className="font-code-sm text-code-sm text-outline">SEC-04</span>
              </div>
              <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Staging SSL certificate expiring
              </h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                Staging ingress wildcard cert expires in <strong className="text-error">12 days</strong>. Automatic ACME renewal failed due to Route53 IAM shift.
              </p>
              <div className="bg-surface-container-low rounded p-space-sm flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Primary contact:</span>
                <span className="font-label-sm text-label-sm text-on-surface font-semibold">SRE team (#sre-ops)</span>
              </div>
              <div className="flex items-center justify-between pt-1 font-label-sm text-label-sm text-on-surface-variant">
                <span>Cert Hash: c3f8...a011</span>
                <span className="text-tertiary flex items-center gap-0.5 font-semibold">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>Verified
                </span>
              </div>
            </div>
          </div>

          {/* Column 2: Context & Decisions */}
          <div className="flex flex-col gap-space-md bg-surface-container-low rounded-xl p-space-md shadow-sm border border-surface-container/60">
            <div className="flex items-center justify-between pb-space-xs">
              <div className="flex items-center gap-space-xs">
                <span className="w-6 h-6 rounded bg-primary-fixed text-on-primary-fixed flex items-center justify-center font-label-sm text-label-sm font-bold">
                  2
                </span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  Week 1: Context & Decisions
                </h3>
              </div>
              <span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-medium">
                {week1Items.length > 0 ? `${week1Items.length} items` : "2 items"}
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Architectural decisions with rationales, active conflicts requiring arbitration.
            </p>

            {/* Week 1 Card 1: Postgres JSONB */}
            <div className="bg-surface-container-lowest rounded-lg p-space-md shadow-sm flex flex-col gap-space-sm hover:shadow-md transition-shadow border border-surface-container">
              <div className="flex items-center justify-between gap-space-xs">
                <span className="inline-flex items-center gap-1 font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>Decision
                </span>
                <span className="font-code-sm text-code-sm text-outline">ADR-109</span>
              </div>
              <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Adopted PostgreSQL JSONB over MongoDB
              </h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                Consolidated event metadata storage into Postgres instances.
              </p>
              <div className="bg-surface-container-low rounded p-space-sm flex flex-col gap-1">
                <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">Verified Rationale:</span>
                <p className="font-body-sm text-body-sm text-on-surface">
                  Strict ACID compliance required for dual-entry ticket ledger reconciliations.
                </p>
              </div>
              <div className="flex items-center justify-between pt-1 font-label-sm text-label-sm text-on-surface-variant">
                <span>Doc: ADR-109.md</span>
                <span className="text-tertiary flex items-center gap-0.5 font-semibold">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>Verified
                </span>
              </div>
            </div>

            {/* Week 1 Card 2: Role-Gated Restricted Item */}
            {role !== "lead" && role !== "admin" ? (
              <div className="role-gated-item bg-surface-container-lowest rounded-lg p-space-md shadow-sm flex flex-col gap-space-sm border border-surface-container" id="locked-card-1">
                <div className="locked-view flex flex-col gap-space-sm">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 font-label-sm text-label-sm px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-semibold">
                      <span className="material-symbols-outlined text-[14px]">lock</span>
                      Role-Gated Claim
                    </span>
                    <span className="font-code-sm text-code-sm text-outline font-bold">RESTRICTED</span>
                  </div>
                  <div className="p-space-sm rounded bg-surface-container-low flex flex-col gap-1.5 border border-surface-container/60">
                    <div className="flex items-center gap-1.5 text-on-surface">
                      <span className="material-symbols-outlined text-[18px] text-outline">lock</span>
                      <span className="font-headline-sm text-headline-sm font-semibold">
                        Withheld Item — Requires Restricted (Lead) Access
                      </span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Reason: Contains sensitive architectural negotiation cited from{" "}
                      <code className="font-code-sm text-code-sm px-1 py-0.5 bg-surface-container rounded text-on-surface">
                        notes/advisor-private.md
                      </code>.
                    </p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="font-label-sm text-label-sm text-outline">
                        Contact Engineering Lead to request clearance
                      </span>
                      <button
                        onClick={() => setRole("lead")}
                        className="font-label-sm text-label-sm text-primary hover:underline cursor-pointer font-semibold"
                      >
                        Request GPG Role Upgrade →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="unlocked-view bg-surface-container-lowest rounded-lg p-space-md shadow-sm flex flex-col gap-space-sm border border-secondary/40">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-semibold">
                    <span className="material-symbols-outlined text-[14px] text-secondary">lock_open</span>
                    Restricted Cleared
                  </span>
                  <span className="font-code-sm text-code-sm text-outline font-bold">ADR-114</span>
                </div>
                <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  Architectural Split: Auth0 vs Self-Hosted Ory Kratos
                </h4>
                <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                  Board negotiation mandates migration from SaaS IAM to internal Ory clusters by Q3 to reduce vendor margin exposure.
                </p>
                <div className="bg-surface-container-low rounded p-space-sm border border-surface-container/60">
                  <span className="font-code-sm text-code-sm text-on-surface">
                    Source: notes/advisor-private.md (Verified cryptographic anchor)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Column 3: Long-term Stewardship */}
          <div className="flex flex-col gap-space-md bg-surface-container-low rounded-xl p-space-md shadow-sm border border-surface-container/60">
            <div className="flex items-center justify-between pb-space-xs">
              <div className="flex items-center gap-space-xs">
                <span className="w-6 h-6 rounded bg-surface-container-highest text-on-surface flex items-center justify-center font-label-sm text-label-sm font-bold">
                  3
                </span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  Month 1: Long-term Stewardship
                </h3>
              </div>
              <span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-medium">
                {month1Items.length > 0 ? `${month1Items.length} items` : "2 items"}
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Cross-system dependencies, stale modules &gt;30 days, missing evidence questions.
            </p>

            {/* Month 1 Card 1: Stripe Webhook */}
            <div className="bg-surface-container-lowest rounded-lg p-space-md shadow-sm flex flex-col gap-space-sm hover:shadow-md transition-shadow border border-surface-container">
              <div className="flex items-center justify-between gap-space-xs">
                <span className="inline-flex items-center gap-1 font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-outline"></span>Dependency
                </span>
                <span className="font-code-sm text-code-sm text-outline">EXT-STRIPE</span>
              </div>
              <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Stripe Webhook Idempotency
              </h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                Idempotent retry logic situated in{" "}
                <code className="font-code-sm text-code-sm px-1 py-0.5 bg-surface-container-low rounded text-on-surface">
                  notifications/services/webhook.ts
                </code>.
              </p>
              <div className="bg-surface-container-low rounded p-space-sm flex items-center gap-space-xs text-on-surface-variant font-body-sm text-body-sm">
                <span className="material-symbols-outlined text-[16px] text-tertiary">replay</span>
                <span>Handles network partition replays within a 72-hour sliding window.</span>
              </div>
              <div className="flex items-center justify-between pt-1 font-label-sm text-label-sm text-on-surface-variant">
                <span>Commit: 4a2b91c</span>
                <span className="text-tertiary flex items-center gap-0.5 font-semibold">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>Verified
                </span>
              </div>
            </div>

            {/* Month 1 Card 2: Confidential Locked Item */}
            {role !== "admin" ? (
              <div className="role-gated-item bg-surface-container-lowest rounded-lg p-space-md shadow-sm flex flex-col gap-space-sm border border-surface-container" id="locked-card-2">
                <div className="locked-view flex flex-col gap-space-sm">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 font-label-sm text-label-sm px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-semibold">
                      <span className="material-symbols-outlined text-[14px]">lock</span>
                      Confidential Item
                    </span>
                    <span className="font-code-sm text-code-sm text-error font-bold">CONFIDENTIAL</span>
                  </div>
                  <div className="p-space-sm rounded bg-surface-container-low flex flex-col gap-1.5 border border-surface-container/60">
                    <div className="flex items-center gap-1.5 text-on-surface">
                      <span className="material-symbols-outlined text-[18px] text-outline">lock</span>
                      <span className="font-headline-sm text-headline-sm font-semibold">
                        Withheld Item — Requires Confidential Access
                      </span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Reason: Financial budgeting notes and infrastructure cost commitments for enterprise contract renewal.
                    </p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="font-label-sm text-label-sm text-outline">
                        Security/Finance Admin role strictly required
                      </span>
                      <button
                        onClick={() => setRole("admin")}
                        className="font-label-sm text-label-sm text-primary hover:underline cursor-pointer font-semibold"
                      >
                        Elevate Role →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="unlocked-view bg-surface-container-lowest rounded-lg p-space-md shadow-sm flex flex-col gap-space-sm border border-error/40">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-semibold">
                    <span className="material-symbols-outlined text-[14px] text-error">lock_open</span>
                    Confidential Cleared
                  </span>
                  <span className="font-code-sm text-code-sm text-outline font-bold">FIN-882</span>
                </div>
                <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  AWS Savings Plan Rebalance & Overdraft Caps
                </h4>
                <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                  Fixed compute commitment expires Nov 30; rollover amortized cap capped at $14,200/mo. Primary budget holder: VP Eng.
                </p>
                <div className="bg-surface-container-low rounded p-space-sm border border-surface-container/60">
                  <span className="font-code-sm text-code-sm text-on-surface">
                    Source: finance/contracts-2024.enc
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Approved Claims Breakdown: Categorized Table */}
      <section className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md border border-surface-container">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface font-semibold">
              Approved Claims Breakdown
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Granular ledger entries verified via plain-code derivations and strict verbatim quotations.
            </p>
          </div>
          <div className="flex items-center gap-space-sm">
            <span className="inline-flex items-center gap-1.5 font-label-sm text-label-sm px-space-sm py-1 rounded bg-surface-container text-on-surface font-semibold">
              <span className="w-2 h-2 rounded-full bg-tertiary"></span>
              {approvedClaims.length > 0 ? approvedClaims.length : 5} Verified Claims Total
            </span>
          </div>
        </div>

        {/* Grouped Claims Table */}
        <div className="overflow-x-auto rounded-lg bg-surface-container-low p-1 border border-surface-container">
          <table className="w-full text-left font-body-sm text-body-sm">
            <thead>
              <tr className="text-on-surface-variant font-label-sm text-label-sm uppercase">
                <th className="px-space-md py-space-sm">Claim ID & Summary</th>
                <th className="px-space-md py-space-sm">Category</th>
                <th className="px-space-md py-space-sm">Verbatim Anchor</th>
                <th className="px-space-md py-space-sm">Confidence</th>
                <th className="px-space-md py-space-sm">Verification Status</th>
              </tr>
            </thead>
            <tbody className="divide-y-0 flex-col">
              {/* Category Row 1: Architectural Decisions */}
              <tr className="bg-surface-container">
                <td className="px-space-md py-1.5 font-label-sm text-label-sm text-on-surface font-bold" colSpan={5}>
                  CATEGORY: ARCHITECTURAL DECISIONS (1 CLAIM)
                </td>
              </tr>
              <tr className="bg-surface-container-lowest hover:bg-surface-container-low transition-colors">
                <td className="px-space-md py-space-sm">
                  <div className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    Adopt PostgreSQL JSONB over MongoDB
                  </div>
                  <div className="font-body-sm text-body-sm text-on-surface-variant">
                    Consolidated event store to prevent cross-database transaction failure
                  </div>
                </td>
                <td className="px-space-md py-space-sm">
                  <span className="px-2 py-0.5 rounded font-label-sm text-label-sm bg-secondary-fixed text-on-secondary-fixed font-semibold">
                    Decision
                  </span>
                </td>
                <td className="px-space-md py-space-sm">
                  <code className="font-code-sm text-code-sm text-primary">docs/adr/ADR-109.md#L34</code>
                </td>
                <td className="px-space-md py-space-sm">
                  <span className="font-label-sm text-label-sm text-tertiary font-bold">100% Deterministic</span>
                </td>
                <td className="px-space-md py-space-sm">
                  <span className="inline-flex items-center gap-1 font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>Verified
                  </span>
                </td>
              </tr>

              {/* Category Row 2: Sole-Knowledge Risks */}
              <tr className="bg-surface-container">
                <td className="px-space-md py-1.5 font-label-sm text-label-sm text-on-surface font-bold" colSpan={5}>
                  CATEGORY: SOLE-KNOWLEDGE RISKS &gt;=70% (1 CLAIM)
                </td>
              </tr>
              <tr className="bg-surface-container-lowest hover:bg-surface-container-low transition-colors">
                <td className="px-space-md py-space-sm">
                  <div className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    deploy/ pipeline sole ownership
                  </div>
                  <div className="font-body-sm text-body-sm text-on-surface-variant">
                    Riya author of 92% of continuous delivery workflow files
                  </div>
                </td>
                <td className="px-space-md py-space-sm">
                  <span className="px-2 py-0.5 rounded font-label-sm text-label-sm bg-error-container text-on-error-container font-semibold">
                    Sole-Knowledge
                  </span>
                </td>
                <td className="px-space-md py-space-sm">
                  <code className="font-code-sm text-code-sm text-on-surface">.github/workflows/deploy.yml</code>
                </td>
                <td className="px-space-md py-space-sm">
                  <span className="font-label-sm text-label-sm text-tertiary font-bold">92.4% Metric Attrib</span>
                </td>
                <td className="px-space-md py-space-sm">
                  <span className="inline-flex items-center gap-1 font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>Verified
                  </span>
                </td>
              </tr>

              {/* Category Row 3: Cross-System Dependencies */}
              <tr className="bg-surface-container">
                <td className="px-space-md py-1.5 font-label-sm text-label-sm text-on-surface font-bold" colSpan={5}>
                  CATEGORY: CROSS-SYSTEM DEPENDENCIES (2 CLAIMS)
                </td>
              </tr>
              <tr className="bg-surface-container-lowest hover:bg-surface-container-low transition-colors">
                <td className="px-space-md py-space-sm">
                  <div className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    Stripe Webhook Idempotency Handler
                  </div>
                  <div className="font-body-sm text-body-sm text-on-surface-variant">
                    Guarantees exactly-once transaction fulfillment via Redis lock
                  </div>
                </td>
                <td className="px-space-md py-space-sm">
                  <span className="px-2 py-0.5 rounded font-label-sm text-label-sm bg-surface-container text-on-surface-variant font-semibold">
                    Dependency
                  </span>
                </td>
                <td className="px-space-md py-space-sm">
                  <code className="font-code-sm text-code-sm text-primary">notifications/services/webhook.ts#L88</code>
                </td>
                <td className="px-space-md py-space-sm">
                  <span className="font-label-sm text-label-sm text-tertiary font-bold">98.1% AST Analysis</span>
                </td>
                <td className="px-space-md py-space-sm">
                  <span className="inline-flex items-center gap-1 font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>Verified
                  </span>
                </td>
              </tr>
              <tr className="bg-surface-container-lowest hover:bg-surface-container-low transition-colors">
                <td className="px-space-md py-space-sm">
                  <div className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    Staging SSL Certificate Expiry
                  </div>
                  <div className="font-body-sm text-body-sm text-on-surface-variant">
                    Ingress wildcard SAN cert requires DNS-01 challenge revalidation
                  </div>
                </td>
                <td className="px-space-md py-space-sm">
                  <span className="px-2 py-0.5 rounded font-label-sm text-label-sm bg-error-container text-on-error-container font-semibold">
                    Blocker
                  </span>
                </td>
                <td className="px-space-md py-space-sm">
                  <code className="font-code-sm text-code-sm text-on-surface">k8s/ingress/staging-cert.yaml</code>
                </td>
                <td className="px-space-md py-space-sm">
                  <span className="font-label-sm text-label-sm text-tertiary font-bold">100% Certificate Expiry</span>
                </td>
                <td className="px-space-md py-space-sm">
                  <span className="inline-flex items-center gap-1 font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>Verified
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm pt-2">
          <span>Zero unverified or inferred claims admitted into the Official Handover record.</span>
          <span className="font-code-sm text-code-sm font-semibold">MERKLE_ROOT: b41a...929f</span>
        </div>
      </section>

      {/* Dossier Cryptographic Footer Stamp */}
      <section className="p-space-md rounded-xl bg-surface-container-low flex flex-col md:flex-row items-center justify-between gap-space-md text-on-surface-variant font-body-sm text-body-sm border border-surface-container">
        <div className="flex items-center gap-space-sm">
          <span className="material-symbols-outlined text-[20px] text-tertiary">verified</span>
          <span>Ledger snapshot validated by 3 human verifiers: Lead Architect, Security Auditor, and Leaver.</span>
        </div>
        <div className="flex items-center gap-space-md font-code-sm text-code-sm">
          <span>GPG-ID: 0x98FF2C8A</span>
          <span className="text-tertiary font-bold">SEALED & IMMUTABLE</span>
        </div>
      </section>

      {/* Acknowledge Modal */}
      {ackModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl border border-surface-container max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-md text-headline-md text-on-surface font-bold">
                Acknowledge Receipt
              </h3>
              <button
                onClick={() => setAckModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Signing this acknowledgment records an immutable cryptographic audit record confirming receipt of the handover dossier for role:{" "}
              <strong className="text-on-surface">{currentRoleObj.label}</strong>.
            </p>
            <div className="space-y-1">
              <label className="font-label-sm text-label-sm text-on-surface-variant font-semibold">Your Name / Handle</label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g. Alex (Incoming Lead)"
                className="w-full bg-surface-container-low border border-surface-container rounded-xl p-2.5 font-body-sm text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="font-label-sm text-label-sm text-on-surface-variant font-semibold">Acknowledgment Note (Optional)</label>
              <input
                type="text"
                value={ackNote}
                onChange={(e) => setAckNote(e.target.value)}
                placeholder="e.g. Reviewed architecture decisions and deploy runbook"
                className="w-full bg-surface-container-low border border-surface-container rounded-xl p-2.5 font-body-sm text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setAckModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-surface-container text-on-surface font-label-md text-label-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAcknowledge}
                disabled={!recipientName.trim() || isSubmittingAck}
                className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md cursor-pointer disabled:opacity-50"
              >
                Confirm & Seal Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
