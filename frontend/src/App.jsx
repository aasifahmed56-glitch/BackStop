import { useState } from "react";

const ROLES = ["incoming_dev", "incoming_pm", "lead", "admin"];

const ROLE_LABELS = {
  incoming_dev: "Incoming Dev",
  incoming_pm: "Incoming PM",
  lead: "Lead",
  admin: "Admin",
};

export default function App() {
  const [role, setRole] = useState("incoming_dev");
  const [page, setPage] = useState("handover");

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Demo banner */}
      <div className="bg-amber-400 text-amber-950 text-sm text-center py-1.5 px-4 font-semibold tracking-wide shadow-sm">
        ⚠️ DEMO MODE — Roles are simulated via role switcher. No login system.
      </div>

      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black text-indigo-700 tracking-tight">Backstop</span>
            <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full">
              Handover Ledger
            </span>
          </div>
          {/* Role switcher */}
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">Viewing as:</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm font-medium text-gray-800 bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Nav */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 flex gap-6">
          {[
            { id: "handover", label: "Handover" },
            { id: "claims", label: "Claims Ledger" },
            { id: "backtest", label: "Backtest" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`py-3 px-1 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                page === item.id
                  ? "border-indigo-600 text-indigo-700"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {page === "handover" && <HandoverPage role={role} />}
        {page === "claims" && <ClaimsPage role={role} />}
        {page === "backtest" && <BacktestPage />}
      </main>
    </div>
  );
}

function HandoverPage({ role }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Handover Document</h1>
        <p className="text-sm text-gray-600 mt-1">
          Project: <strong>Campus Event App</strong> · Leaver: <strong>Riya</strong> (Departure: 15 Mar 2026) · Viewing as <strong>{role}</strong>
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-gray-500 space-y-3">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 font-bold text-xl">
          📋
        </div>
        <h3 className="text-lg font-semibold text-gray-800">Permission-Aware Handover Ready</h3>
        <p className="text-sm max-w-md mx-auto text-gray-600">
          Handovers are constructed exclusively from <strong>Approved Claims</strong>. Access control ensures restricted and confidential items remain withheld for lower-privilege roles.
        </p>
        <div className="pt-2">
          <code className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded border border-gray-200">
            GET /api/projects/1/handover?role={role}
          </code>
        </div>
      </div>
    </div>
  );
}

function ClaimsPage({ role }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Claims Ledger</h1>
        <p className="text-sm text-gray-600 mt-1">
          Ledger of DERIVED (deterministic code) and INTERPRETED (LLM quote-backed) claims across all sources.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Verified", count: "—", desc: "Exact source citation" },
          { label: "Inferred", count: "—", desc: "Single source corroboration" },
          { label: "Conflicting", count: "—", desc: "Contradiction found" },
          { label: "Missing evidence", count: "—", desc: "No ground citation" },
        ].map(({ label, count, desc }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{label}</div>
            <div className="text-2xl font-bold text-gray-900 my-1">{count}</div>
            <div className="text-xs text-gray-500">{desc}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center text-gray-500">
        <p className="text-sm">Human Review interface: Approve, Correct, or Reject claims. Only Approved claims feed into handovers.</p>
      </div>
    </div>
  );
}

function BacktestPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Handover Backtest</h1>
        <p className="text-sm text-gray-600 mt-1">
          Evaluates the handover against synthetic post-departure ground truth (hidden from LLMs).
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            "Sole Knowledge Modules",
            "Key Decisions (JWT, etc.)",
            "Critical Contacts",
            "Open Risks & Conflicts",
            "False Positives Check",
          ].map((label) => (
            <div key={label} className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
              <div className="text-xs font-semibold text-gray-600 mb-1">{label}</div>
              <div className="text-2xl font-bold text-gray-400">— / 1.0</div>
              <div className="text-xs text-gray-500 mt-1">F1 metric vs ground truth</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-center text-gray-500">
          Ground truth file: <code className="bg-gray-100 px-1 py-0.5 rounded">backend/data/sample/ground_truth.json</code>
        </p>
      </div>
    </div>
  );
}
