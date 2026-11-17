import React, { useEffect, useState } from "react";
import { api, formatErrorMessage } from "../api";
import { ROLES } from "./Navbar";

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
      <li className="font-body-sm text-body-sm text-on-surface-variant">
        Commit <code className="font-code-sm text-code-sm">{ev.commit}</code>
        {ev.date ? ` (${ev.date})` : ""}: “{ev.message}”
      </li>
    );
  }
  const lines = ev.line_start ? `, line ${ev.line_start}${ev.line_end && ev.line_end !== ev.line_start ? `–${ev.line_end}` : ""}` : "";
  return (
    <li className="font-body-sm text-body-sm text-on-surface-variant">
      <q className="text-on-surface">{ev.quote}</q>{" "}
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
    <article className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-surface-container flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`px-2 py-0.5 rounded font-label-sm text-label-sm font-bold uppercase ${high ? "bg-error-container text-on-error-container" : "bg-secondary-fixed text-on-secondary-fixed"}`}>
          {high ? "High severity" : "Medium severity"}
        </span>
        <span className="font-label-md text-label-md text-on-surface-variant">{KIND_LABEL[tw.kind] || tw.kind}</span>
        <span className="font-code-sm text-[11px] text-outline uppercase ml-auto">{tw.access_level}</span>
      </div>
      <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">{tw.title}</h3>
      <p className="font-body-md text-body-md text-on-surface">{tw.warning}</p>
      <div>
        <h4 className="font-label-md text-label-md text-on-surface font-semibold">Why it matched</h4>
        <ul className="list-disc pl-5">
          {tw.why.map((w, i) => (
            <li key={i} className="font-body-sm text-body-sm text-on-surface-variant">
              {w.type === "path" ? "Path: " : "Keyword: "}
              {w.text}
            </li>
          ))}
        </ul>
      </div>
      {tw.evidence?.length > 0 && (
        <div>
          <h4 className="font-label-md text-label-md text-on-surface font-semibold">Evidence</h4>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            {tw.evidence.map((ev, i) => <EvidenceItem key={i} ev={ev} />)}
          </ul>
        </div>
      )}
      <p className="font-body-sm text-body-sm text-on-surface">
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
  if (error) return <p className="font-body-sm text-body-sm text-on-surface-variant">The replay result could not be loaded: {error}</p>;
  if (!data) return <p className="font-body-sm text-body-sm text-on-surface-variant">Loading the replay result…</p>;
  return (
    <div className="flex flex-col gap-space-md">
      <p className="font-body-sm text-body-sm text-on-surface-variant">
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
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">{ds.dataset.label}</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Cutoff {ds.cutoff}, {ds.proposed_changes} later commits checked, {ds.tripwires_built} tripwires, {r.problematic} later problematic (base rate {pct(r.base_rate)}).
              {" "}{ds.dataset.note}
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left font-body-sm text-body-sm">
                <caption className="sr-only">Replay results for {ds.dataset.label}</caption>
                <thead>
                  <tr className="border-b border-surface-container">
                    <th scope="col" className="py-1 pr-4">Method</th>
                    <th scope="col" className="py-1 pr-4">Flagged</th>
                    <th scope="col" className="py-1 pr-4">Hits</th>
                    <th scope="col" className="py-1 pr-4">Misses</th>
                    <th scope="col" className="py-1 pr-4">Flag rate</th>
                    <th scope="col" className="py-1 pr-4">Precision</th>
                    <th scope="col" className="py-1 pr-4">Recall</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([name, m]) => (
                    <tr key={name} className="border-b border-surface-container/60">
                      <th scope="row" className="py-1 pr-4 font-medium">{name}</th>
                      <td className="py-1 pr-4">{m.flagged}</td>
                      <td className="py-1 pr-4">{m.hits}</td>
                      <td className="py-1 pr-4">{m.misses}</td>
                      <td className="py-1 pr-4">{pct(m.flag_rate)}</td>
                      <td className="py-1 pr-4">{r.problematic === 0 ? "n/a" : pct(m.precision)}</td>
                      <td className="py-1 pr-4">{pct(m.recall)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      <p className="font-body-sm text-body-sm text-on-surface">
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
    <div className="flex flex-col w-full gap-space-lg">
      <section className="flex flex-col gap-space-sm">
        <button
          type="button"
          onClick={() => setActiveTab("handover")}
          className="self-start font-label-md text-label-md text-primary underline underline-offset-2 cursor-pointer"
        >
          ← Back to the handover dossier
        </button>
        <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold">Check a change</h1>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
          Before changing code you inherited, check it against what the handover already knows: reverted work, recorded decisions,
          code only the leaver understood, stale modules and unresolved conflicts. Plain rules, no AI.
        </p>
      </section>

      <form
        className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-surface-container flex flex-col gap-space-md"
        onSubmit={(e) => {
          e.preventDefault();
          runCheck();
        }}
      >
        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="font-label-md text-label-md text-on-surface font-semibold mb-1">Check as</legend>
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              aria-pressed={role === r.id}
              onClick={() => setRole(r.id)}
              className={`px-3 py-1.5 rounded-lg font-label-md text-label-md cursor-pointer ${
                role === r.id ? "bg-secondary-fixed text-on-secondary-fixed font-bold" : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              {r.label} ({r.access})
            </button>
          ))}
        </fieldset>

        <div className="flex flex-col gap-1">
          <label htmlFor="tw-files" className="font-label-md text-label-md text-on-surface font-semibold">
            Files to change, one per line, or paste a unified diff
          </label>
          <textarea
            id="tw-files"
            rows={5}
            value={changes}
            onChange={(e) => setChanges(e.target.value)}
            placeholder={"deploy/deploy.sh\nauth/jwt.py"}
            className="w-full p-2 rounded-lg border border-outline-variant bg-surface font-code-sm text-code-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="tw-desc" className="font-label-md text-label-md text-on-surface font-semibold">
            What does the change do?
          </label>
          <input
            id="tw-desc"
            type="text"
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="for example: switch notifications to websockets"
            className="w-full p-2 rounded-lg border border-outline-variant bg-surface font-body-md text-body-md"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={isChecking}
            className="px-space-md py-2 bg-primary hover:bg-primary-container text-on-primary rounded-lg font-headline-sm text-headline-sm cursor-pointer disabled:opacity-50"
          >
            {isChecking ? "Checking…" : "Check"}
          </button>
          <span className="font-label-md text-label-md text-on-surface-variant ml-2">Try an example:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              disabled={isChecking}
              onClick={() => applyExample(ex)}
              className="px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md cursor-pointer border border-surface-container disabled:opacity-50"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </form>

      <section aria-live="polite" className="flex flex-col gap-space-md">
        {error && (
          <div role="alert" className="p-space-md rounded-xl bg-error-container text-on-error-container font-body-md text-body-md">
            {error}
          </div>
        )}
        {result && (
          <>
            <h2 className="font-headline-md text-headline-md text-on-surface font-semibold">
              {result.triggered.length
                ? `${result.triggered.length} tripwire${result.triggered.length === 1 ? "" : "s"} matched`
                : "No tripwires matched"}
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Checked {result.files.length} file{result.files.length === 1 ? "" : "s"} against {result.tripwires_checked} tripwires visible to this role.
              {result.claims_withheld > 0 && ` ${result.claims_withheld} claims above this role's access level were not used.`}
              {result.decisions_waiting_for_review > 0 &&
                ` ${result.decisions_waiting_for_review} recorded decision${result.decisions_waiting_for_review === 1 ? " is" : "s are"} waiting for review and not used yet.`}
            </p>
            {result.triggered.length === 0 ? (
              <div className="p-space-md rounded-xl bg-surface-container-low border border-surface-container font-body-md text-body-md text-on-surface">
                No tripwires matched. This does not mean the change is safe.
              </div>
            ) : (
              result.triggered.map((tw) => <ResultCard key={tw.id} tw={tw} />)
            )}
          </>
        )}
      </section>

      <section className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-surface-container flex flex-col gap-space-sm">
        <h2 className="font-headline-md text-headline-md text-on-surface font-semibold">Do tripwires work? Replay on past history</h2>
        <ReplaySummary />
      </section>
    </div>
  );
}
