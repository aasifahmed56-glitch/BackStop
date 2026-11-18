import React, { useEffect, useState } from "react";
import { api, formatErrorMessage } from "../api";
import { ROLES } from "./Navbar";
import { Button } from "./ui";
import { ArrowLeft, ListChecks } from "lucide-react";

const EXAMPLES = [
  { label: "Switch notifications to websockets", description: "switch notifications to websockets", files: "notifications/realtime.py" },
  { label: "Rewrite the deploy scripts", description: "rewrite the deploy scripts", files: "deploy/deploy.sh\ndeploy/nginx.conf" },
];

const KIND_LABEL = {
  reverted_work: "Reverted work",
  decision: "Recorded decision",
  sole_knowledge: "Sole knowledge",
  stale_module: "Stale module",
  conflict: "Unresolved conflict",
};

const pct = (x) => (x === null || x === undefined ? "n/a" : `${Math.round(x * 1000) / 10}%`);

// A pasted unified diff is sent as `diff`; anything else is one path per line.
function splitInput(text) {
  if (/^(\+\+\+ |--- |diff --git )/m.test(text)) return { files: [], diff: text };
  const files = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return { files, diff: null };
}

function EvidenceItem({ ev }) {
  if (ev.kind === "commit") {
    return (
      <li className="text-[13.5px] leading-[21px] text-on-surface-variant">
        Commit <code className="font-mono text-[12.5px]">{ev.commit}</code>
        {ev.date ? ` (${ev.date})` : ""}: “{ev.message}”
      </li>
    );
  }
  const lines = ev.line_start ? `, line ${ev.line_start}${ev.line_end && ev.line_end !== ev.line_start ? `–${ev.line_end}` : ""}` : "";
  return (
    <li className="text-[13.5px] leading-[21px] text-on-surface-variant">
      <q className="font-mono text-[12.5px] text-on-surface bg-canary-container px-0.5">{ev.quote}</q>{" "}
      <span className="whitespace-nowrap">
        (claim #{ev.claim_id}, {ev.source_name}{lines}
        {ev.review_state !== "approved" && ev.review_state !== "corrected" ? ", not reviewed yet" : ""})
      </span>
    </li>
  );
}

function ResultCard({ tw }) {
  const high = tw.severity === "high";
  return (
    <article className={`panel p-4 flex flex-col gap-2 border-l-4 ${high ? "border-l-error" : "border-l-goldenrod"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`px-2 py-0.5 rounded-[2px] text-[12px] leading-[18px] font-semibold ${high ? "bg-error-container text-on-error-container" : "bg-goldenrod-container text-on-goldenrod"}`}>
          {high ? "High severity" : "Medium severity"}
        </span>
        <span className="field-label">{KIND_LABEL[tw.kind] || tw.kind}</span>
        <span className="field-label ml-auto">{tw.access_level} access</span>
      </div>
      <h3 className="text-[17px] leading-6 font-bold text-on-surface">{tw.title}</h3>
      <p className="text-[14px] leading-[22px] text-on-surface">{tw.warning}</p>
      <div>
        <h4 className="field-label">Why it matched</h4>
        <ul className="list-disc pl-5">
          {tw.why.map((w, i) => (
            <li key={i} className="text-[13.5px] leading-[21px] text-on-surface-variant">
              {w.type === "path" ? "Path: " : "Keyword: "}
              {w.text}
            </li>
          ))}
        </ul>
      </div>
      {tw.evidence?.length > 0 && (
        <div>
          <h4 className="field-label">Evidence</h4>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            {tw.evidence.map((ev, i) => <EvidenceItem key={i} ev={ev} />)}
          </ul>
        </div>
      )}
      <p className="text-[13.5px] leading-[21px] text-on-surface">
        <strong>Who to ask:</strong> {tw.contacts?.length ? tw.contacts.join(", ") : "nobody is recorded; ask the lead"}
      </p>
    </article>
  );
}

function ReplaySummary() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    api.getTripwireReplay().then(setData).catch((e) => setError(formatErrorMessage(e)));
  }, []);
  if (error) return <p className="text-[13.5px] leading-[21px] text-on-surface-variant">The replay result could not be loaded: {error}</p>;
  if (!data) return <p className="text-[13.5px] leading-[21px] text-on-surface-variant">Loading the replay result…</p>;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13.5px] leading-[21px] text-on-surface-variant">
        Tripwires were built from history before a cutoff, then every later commit was checked as if it were a proposed change.
        A commit counts as later problematic if it was reverted or a fix touched the same files within {data.rules.fix_days} days.
        Only git-based tripwires can be replayed. No AI is used.
      </p>
      {data.datasets.map((ds) => {
        const r = ds.results.same_file;
        const rows = [
          ["Tripwires", r.tripwires],
          ["Baseline: leaver-owned modules", r.baseline_leaver_owned_module],
          ["Flag everything", r.flag_everything],
        ];
        return (
          <div key={ds.dataset.name} className="flex flex-col gap-2">
            <h3 className="text-[17px] leading-6 font-bold text-on-surface">{ds.dataset.label}</h3>
            <p className="text-[13.5px] leading-[21px] text-on-surface-variant">
              Cutoff {ds.cutoff}, {ds.proposed_changes} later commits checked, {ds.tripwires_built} tripwires, {r.problematic} later problematic (base rate {pct(r.base_rate)}).
              {" "}{ds.dataset.note}
            </p>
            <div className="overflow-x-auto border border-outline-variant rounded-[3px]">
              <table className="min-w-full text-left text-[13.5px] leading-[21px] tnum">
                <caption className="sr-only">Replay results for {ds.dataset.label}</caption>
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th scope="col" className="py-1.5 px-3 field-label">Method</th>
                    <th scope="col" className="py-1.5 px-3 field-label">Flagged</th>
                    <th scope="col" className="py-1.5 px-3 field-label">Hits</th>
                    <th scope="col" className="py-1.5 px-3 field-label">Misses</th>
                    <th scope="col" className="py-1.5 px-3 field-label">Flag rate</th>
                    <th scope="col" className="py-1.5 px-3 field-label">Precision</th>
                    <th scope="col" className="py-1.5 px-3 field-label">Recall</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([name, m]) => (
                    <tr key={name} className="border-b border-outline-variant last:border-b-0">
                      <th scope="row" className="py-1.5 px-3 font-semibold">{name}</th>
                      <td className="py-1.5 px-3">{m.flagged}</td>
                      <td className="py-1.5 px-3">{m.hits}</td>
                      <td className="py-1.5 px-3">{m.misses}</td>
                      <td className="py-1.5 px-3">{pct(m.flag_rate)}</td>
                      <td className="py-1.5 px-3">{r.problematic === 0 ? "n/a" : pct(m.precision)}</td>
                      <td className="py-1.5 px-3">{pct(m.recall)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      <p className="text-[13.5px] leading-[21px] text-on-surface">
        <strong>What this means:</strong> on mocha, tripwires are only slightly better than chance and flag most commits, so treat a warning as a
        prompt to ask, not as proof of risk. On the synthetic sample every commit has its own invented file name, so the replay cannot measure anything there.
        Method and limits: docs/TRIPWIRES.md in the repository.
      </p>
    </div>
  );
}

export default function CheckChangePage({ role, setRole, setActiveTab }) {
  const [changes, setChanges] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  const runCheck = async (changesText = changes, desc = description) => {
    if (isChecking) return;
    const { files, diff } = splitInput(changesText);
    if (!files.length && !diff && !desc.trim()) {
      setError("Enter at least one file path, a diff, or a description of the change.");
      setResult(null);
      return;
    }
    setIsChecking(true);
    setError(null);
    try {
      setResult(await api.checkChange({ projectId: 1, role, files, diff, description: desc }));
    } catch (err) {
      setResult(null);
      setError(formatErrorMessage(err));
    } finally {
      setIsChecking(false);
    }
  };

  // Re-check when the role changes, so the result always matches the selected access level.
  useEffect(() => {
    if (result) runCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const applyExample = (ex) => {
    setChanges(ex.files);
    setDescription(ex.description);
    runCheck(ex.files, ex.description);
  };

  return (
    <div className="flex flex-col w-full gap-5 min-w-0">
      <section className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("handover")}
          className="self-start inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline underline-offset-2 cursor-pointer rounded-[2px]"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Back to the handover
        </button>
        <h1 className="text-[26px] leading-[34px] font-bold tracking-[-0.015em] text-on-surface">Check a change</h1>
        <p className="text-[14px] leading-[22px] text-on-surface-variant max-w-2xl">
          Before changing code you inherited, check it against what the handover already knows: reverted work, recorded decisions,
          code only the leaver understood, stale modules and unresolved conflicts. Plain rules, no AI.
        </p>
      </section>

      <form
        className="panel p-4 sm:p-5 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          runCheck();
        }}
      >
        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="field-label mb-1.5">Check as</legend>
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              aria-pressed={role === r.id}
              onClick={() => setRole(r.id)}
              className={`rounded-[3px] border px-3 py-1.5 text-[13.5px] font-semibold cursor-pointer transition-colors ${
                role === r.id
                  ? "border-ink bg-ink text-on-ink"
                  : "border-outline-variant bg-surface-container-lowest text-on-surface hover:border-outline hover:bg-surface-container-low"
              }`}
            >
              {r.label} <span className={`text-[11px] uppercase tracking-[0.05em] ${role === r.id ? "text-canary" : "text-on-surface-variant"}`}>{r.access}</span>
            </button>
          ))}
        </fieldset>

        <div className="flex flex-col gap-1">
          <label htmlFor="tw-files" className="field-label">
            Files to change, one per line, or paste a unified diff
          </label>
          <textarea
            id="tw-files"
            rows={5}
            value={changes}
            onChange={(e) => setChanges(e.target.value)}
            placeholder={"deploy/deploy.sh\nauth/jwt.py"}
            className="w-full p-2.5 rounded-[3px] border border-outline-variant bg-surface-container-lowest font-mono text-[12.5px] leading-5 text-on-surface placeholder:text-outline focus:outline-2 focus:outline-primary focus:border-primary"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="tw-desc" className="field-label">
            What does the change do?
          </label>
          <input
            id="tw-desc"
            type="text"
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="for example: switch notifications to websockets"
            className="w-full h-10 px-2.5 rounded-[3px] border border-outline-variant bg-surface-container-lowest text-[14px] text-on-surface placeholder:text-outline focus:outline-2 focus:outline-primary focus:border-primary"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="primary" disabled={isChecking}>
            <ListChecks size={16} aria-hidden="true" />
            {isChecking ? "Checking…" : "Check the change"}
          </Button>
          <span className="text-[13px] text-on-surface-variant ml-2">Try an example:</span>
          {EXAMPLES.map((ex) => (
            <Button key={ex.label} size="sm" disabled={isChecking} onClick={() => applyExample(ex)}>
              {ex.label}
            </Button>
          ))}
        </div>
      </form>

      <section aria-live="polite" className="flex flex-col gap-3">
        {error && (
          <div role="alert" className="p-3 rounded-[3px] border border-error bg-error-container text-on-error-container text-[14px] leading-[22px]">
            {error}
          </div>
        )}
        {result && (
          <>
            <h2 className="text-[22px] leading-[28px] font-bold text-on-surface">
              {result.triggered.length
                ? `${result.triggered.length} tripwire${result.triggered.length === 1 ? "" : "s"} matched`
                : "No tripwires matched"}
            </h2>
            <p className="text-[13.5px] leading-[21px] text-on-surface-variant">
              Checked {result.files.length} file{result.files.length === 1 ? "" : "s"} against {result.tripwires_checked} tripwires visible to this role.
              {result.claims_withheld > 0 && ` ${result.claims_withheld} claims above this role's access level were not used.`}
              {result.decisions_waiting_for_review > 0 &&
                ` ${result.decisions_waiting_for_review} recorded decision${result.decisions_waiting_for_review === 1 ? " is" : "s are"} waiting for review and not used yet.`}
            </p>
            {result.triggered.length === 0 ? (
              <div className="panel p-4 text-[14px] leading-[22px] text-on-surface">
                No tripwires matched. This does not mean the change is safe.
              </div>
            ) : (
              result.triggered.map((tw) => <ResultCard key={tw.id} tw={tw} />)
            )}
          </>
        )}
      </section>

      <section className="panel p-4 sm:p-5 flex flex-col gap-3">
        <h2 className="text-[22px] leading-[28px] font-bold text-on-surface">Do tripwires work? Replay on past history</h2>
        <ReplaySummary />
      </section>
    </div>
  );
}
