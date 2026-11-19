import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Copy, FileText, GitBranch, Trash2, Upload } from "lucide-react";
import { api, formatErrorMessage } from "../api";
import { Button, Dialog, Skeleton, Slip, humanize } from "./ui";
import RepoMap from "./RepoMap";

const KINDS = [
  { id: "git", label: "Git history", hint: "Run this in the repository and paste the output. Emails are dropped and messages masked.", cmd: "git log --no-merges --name-status" },
  { id: "note", label: "Notes", hint: "Handover notes, meeting notes, a README or a runbook. Markdown or plain text." },
  { id: "issue", label: "Issues (JSON)", hint: 'A JSON list: [{"id": 12, "title": "…", "status": "open", "body": "…", "comments": [{"author": "…", "body": "…"}]}]' },
  { id: "task", label: "Tasks (CSV)", hint: "A CSV with a header row, e.g. id,title,owner,status,updated_at. A blank owner is flagged." },
  { id: "chat", label: "Chat (JSON)", hint: 'A JSON list: [{"author": "…", "text": "…", "timestamp": "2026-01-05T10:00:00"}]' },
];

const EXAMPLES = {
  note: `# Payments handover

We decided to keep the nightly reconciliation job because the bank only sends files after midnight.

We switched to idempotency keys on refunds.

Don't rerun the migration script, it duplicates invoices.

The webhook depends on the Acme API key in the team vault.

Who approves refunds over 500?

Next step: move the cron job to the new scheduler before March.`,
  task: `id,title,owner,status,updated_at
1,Rotate the Acme API key,,blocked,2026-02-02
4,Renew the bank certificate,Ben,blocked,2026-02-12
2,Move cron to the new scheduler,Ben,in progress,2026-02-10
3,Write refund runbook,,todo,2026-02-11`,
  issue: `[{"id": 41, "title": "Refunds fail on retries", "status": "open", "labels": ["bug"], "author": "Ben", "created_at": "2026-01-20T09:00:00", "body": "Retries are blocked waiting on the bank sandbox. We decided to cap retries at 3.", "comments": [{"author": "Asha", "body": "Careful, the cap breaks the monthly report.", "date": "2026-01-21T10:00:00"}]}]`,
  chat: `[{"author": "Asha", "text": "Contact Priya for the Acme account, she owns the contract.", "timestamp": "2026-02-01T10:00:00"}, {"author": "Ben", "text": "Is the old webhook still used?", "timestamp": "2026-02-01T10:05:00"}]`,
};

const LEVELS = [
  ["public", "Everyone"],
  ["team", "Team"],
  ["restricted", "Lead only"],
  ["confidential", "Admin only"],
];

const ACCESS_CHIP = {
  restricted: "bg-error-container text-on-error-container",
  confidential: "bg-goldenrod-container text-on-goldenrod",
  team: "bg-surface-container text-on-surface-variant",
  public: "bg-tertiary-fixed text-on-tertiary-fixed",
};

const input =
  "w-full h-10 px-2.5 rounded-[6px] border border-outline-variant bg-surface-container-lowest text-[14px] text-on-surface placeholder:text-outline focus:outline-2 focus:outline-stamp focus:border-stamp";

function guessKind(name, text) {
  const n = name.toLowerCase();
  if (n.endsWith(".csv")) return "task";
  if (n.endsWith(".json")) return /"text"\s*:/.test(text) && !/"title"\s*:/.test(text) ? "chat" : "issue";
  if (/^\s*commit [0-9a-f]{40}/.test(text)) return "git";
  return "note";
}

/* Records: what a project is built from. Paste, upload or import, then build claims. */
export default function RecordsPage({ project, onChanged, setActiveTab, onNewProject }) {
  const isSample = !project || project.name === "Campus Event App";
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState("paste");
  const [kind, setKind] = useState("note");
  const [name, setName] = useState("");
  const [level, setLevel] = useState("team");
  const [text, setText] = useState("");
  const [gh, setGh] = useState({ url: "", leaver: "" });
  const [busy, setBusy] = useState(null);
  const [flash, setFlash] = useState(null);
  const [built, setBuilt] = useState(null);
  const [confirmBuild, setConfirmBuild] = useState(false);
  const [copied, setCopied] = useState(false);
  const [grownAt, setGrownAt] = useState(0);
  const fileRef = useRef(null);

  const load = () =>
    api
      .listSources(project?.id)
      .then(setData)
      .catch((e) => setError(formatErrorMessage(e)));

  useEffect(() => {
    if (project?.id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  const k = KINDS.find((x) => x.id === kind);

  const addPaste = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!text.trim()) {
      setFlash({ tone: "error", text: "Paste or choose a file first." });
      return;
    }
    setBusy("add");
    setFlash(null);
    try {
      const r = await api.pasteSource({ projectId: project.id, kind, name: name.trim(), accessLevel: level, text });
      setText("");
      setName("");
      setFlash({ tone: r.note ? "warn" : "ok", text: `Added ${r.name}: ${r.chunk_count} part${r.chunk_count === 1 ? "" : "s"} read.${r.note ? " " + r.note : ""}` });
      await load();
      onChanged?.();
    } catch (err) {
      setFlash({ tone: "error", text: formatErrorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  const addGithub = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!/^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/?$/.test(gh.url.trim())) {
      setFlash({ tone: "error", text: "Use a public repository link like https://github.com/owner/repo." });
      return;
    }
    setBusy("github");
    setFlash(null);
    try {
      const r = await api.githubSource({ projectId: project.id, url: gh.url.trim(), leaver: gh.leaver.trim() });
      setFlash({ tone: "ok", text: `Imported ${r.commit_count.toLocaleString()} commits from ${r.contributor_count} contributors. ${r.note}` });
      setGh({ url: "", leaver: "" });
      await load();
      setGrownAt(Date.now());
      onChanged?.();
    } catch (err) {
      setFlash({ tone: "error", text: formatErrorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 2_000_000) {
      setFlash({ tone: "error", text: "That file is over 2 MB. Trim it, or split it into parts." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const t = String(reader.result || "");
      setText(t);
      setName(f.name);
      setKind(guessKind(f.name, t));
      setFlash({ tone: "ok", text: `Loaded ${f.name}. Check the type, then add it.` });
    };
    reader.readAsText(f);
  };

  const remove = async (s) => {
    try {
      const r = await api.deleteSource(s.id, project.id);
      setFlash({ tone: "ok", text: `Removed ${s.name}${r.claims_removed ? ` and ${r.claims_removed} claim${r.claims_removed === 1 ? "" : "s"} that cited only it` : ""}.` });
      await load();
      onChanged?.();
    } catch (err) {
      setFlash({ tone: "error", text: formatErrorMessage(err) });
    }
  };

  const build = async () => {
    setConfirmBuild(false);
    setBusy("build");
    setFlash(null);
    try {
      const r = await api.analyseProject(project.id);
      setBuilt(r);
      await load();
      onChanged?.();
    } catch (err) {
      setFlash({ tone: "error", text: formatErrorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  const sources = data?.sources || [];
  const reviewed = data?.project?.reviewed_count || 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2 max-w-[66ch]">
        <h1 className="text-[32px] sm:text-[40px] leading-[1.05] font-bold tracking-[-0.03em]">Records</h1>
        <p className="text-[15px] leading-6 text-on-surface-variant">
          What Backstop reads about {project?.leaver_name || "the person leaving"}'s work: commits, notes, issues, tasks and chat. Every claim it builds quotes one of these word for word.
        </p>
      </header>

      {isSample && (
        <div className="bg-surface-container-lowest rounded-[12px] border border-outline-variant p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <p className="text-[14px] leading-6 text-on-surface-variant max-w-[60ch]">
            <strong className="text-on-surface">This is the synthetic sample, so it is read-only.</strong> Start your own project to add real records and build claims from them.
          </p>
          <Button variant="primary" onClick={onNewProject}>
            New project <ArrowRight size={15} aria-hidden="true" />
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
        {/* Add a record */}
        {!isSample && (
          <section aria-labelledby="add-h" className="bg-surface-container-lowest rounded-[12px] border border-outline-variant p-5 sm:p-7 flex flex-col gap-5 min-w-0">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 id="add-h" className="text-[20px] font-bold tracking-[-0.01em]">Add a record</h2>
              <fieldset className="inline-flex p-0.5 rounded-full bg-surface-container text-[13px] font-semibold">
                <legend className="sr-only">How to add</legend>
                {[
                  ["paste", "Paste or upload"],
                  ["github", "From GitHub"],
                ].map(([id, label]) => (
                  <label
                    key={id}
                    className={`h-8 px-3.5 inline-flex items-center rounded-full cursor-pointer transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-stamp ${mode === id ? "bg-surface-container-lowest text-on-surface shadow-[0_1px_2px_rgb(29_32_31/0.12)]" : "text-on-surface-variant hover:text-on-surface"}`}
                  >
                    <input type="radio" name="add-mode" value={id} checked={mode === id} onChange={() => setMode(id)} className="sr-only" />
                    {label}
                  </label>
                ))}
              </fieldset>
            </div>

            {mode === "paste" ? (
              <form onSubmit={addPaste} className="flex flex-col gap-4">
                <fieldset className="flex flex-wrap gap-1.5">
                  <legend className="sr-only">Type of record</legend>
                  {KINDS.map((x) => (
                    <label
                      key={x.id}
                      className={`h-8 px-3 inline-flex items-center rounded-full border text-[13px] font-medium cursor-pointer transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-stamp ${
                        kind === x.id ? "border-on-surface bg-on-surface text-surface-container-lowest" : "border-outline-variant text-on-surface-variant hover:border-outline hover:text-on-surface"
                      }`}
                    >
                      <input type="radio" name="record-kind" value={x.id} checked={kind === x.id} onChange={() => setKind(x.id)} className="sr-only" />
                      {x.label}
                    </label>
                  ))}
                </fieldset>
                <div className="text-[12.5px] leading-5 text-on-surface-variant flex flex-col gap-2">
                  <p>{k.hint}</p>
                  {k.cmd && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(k.cmd).then(() => {
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1600);
                        });
                      }}
                      className="self-start inline-flex items-center gap-2 h-8 px-3 rounded-[6px] bg-surface-container font-mono text-[12.5px] text-on-surface cursor-pointer hover:bg-surface-container-high"
                    >
                      {k.cmd}
                      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                      <span className="sr-only">Copy command</span>
                    </button>
                  )}
                  <span role="status" aria-live="polite" className="text-[12.5px] text-on-surface-variant min-h-5">{copied ? "Copied" : ""}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="field-label">Name (optional)</span>
                    <input className={`${input} font-mono text-[13px]`} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder={`e.g. ${kind === "git" ? "billing-git.txt" : kind === "note" ? "handover-notes.md" : kind === "task" ? "tasks.csv" : `${kind}s.json`}`} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="field-label">Who may read it</span>
                    <select className={input} value={level} onChange={(e) => setLevel(e.target.value)}>
                      {LEVELS.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="flex flex-col gap-1.5">
                  <span className="field-label">Text</span>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={10}
                    spellCheck={false}
                    placeholder={kind === "git" ? "commit 3f2a…\nAuthor: Asha Rao <…>\nDate:   …\n\n    Fix billing retry\n\nM\tbilling/retry.py" : "Paste here"}
                    className="w-full p-3 rounded-[6px] border border-outline-variant bg-surface-container-lowest font-mono text-[12.5px] leading-5 text-on-surface placeholder:text-outline focus:outline-2 focus:outline-stamp focus:border-stamp"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="submit" variant="primary" disabled={!!busy}>
                    {busy === "add" ? "Adding…" : "Add record"}
                  </Button>
                  <Button onClick={() => fileRef.current?.click()}>
                    <Upload size={15} aria-hidden="true" /> Choose a file
                  </Button>
                  <input ref={fileRef} type="file" accept=".txt,.md,.markdown,.csv,.json,.log" className="sr-only" onChange={onFile} tabIndex={-1} aria-hidden="true" />
                  {EXAMPLES[kind] && (
                    <button type="button" onClick={() => setText(EXAMPLES[kind])} className="text-[13px] font-semibold text-primary hover:underline underline-offset-2 cursor-pointer ml-1">
                      Fill in an example
                    </button>
                  )}
                </div>
              </form>
            ) : (
              <form onSubmit={addGithub} className="flex flex-col gap-4">
                <p className="text-[13px] leading-5 text-on-surface-variant">
                  Backstop downloads the commit history of a public repository up to {project?.leaver_name || "the person"}'s last day (no file contents), replaces every author with a pseudonym, and keeps it as one record.
                  Up to 3 imports an hour.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="field-label">Repository link</span>
                    <input type="url" className={`${input} font-mono text-[13px]`} value={gh.url} onChange={(e) => setGh({ ...gh, url: e.target.value })} placeholder="https://github.com/owner/repo" />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="field-label">Their git author name</span>
                    <input className={input} value={gh.leaver} onChange={(e) => setGh({ ...gh, leaver: e.target.value })} placeholder="Most active if empty" />
                  </label>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <Button type="submit" variant="primary" disabled={!!busy}>
                    <GitBranch size={15} aria-hidden="true" />
                    {busy === "github" ? "Importing… up to a minute" : "Import history"}
                  </Button>
                  <button
                    type="button"
                    className="text-[13px] font-semibold text-primary hover:underline underline-offset-2 cursor-pointer"
                    onClick={() => setGh({ url: "https://github.com/tj/commander.js", leaver: "" })}
                  >
                    Try commander.js
                  </button>
                </div>
              </form>
            )}

            {flash && (
              <p
                role={flash.tone === "error" ? "alert" : "status"}
                className={`rounded-[6px] border px-3 py-2 text-[13.5px] ${
                  flash.tone === "error"
                    ? "border-error/40 bg-error-container text-on-error-container"
                    : flash.tone === "warn"
                    ? "border-goldenrod/40 bg-goldenrod-container text-on-goldenrod"
                    : "border-outline-variant bg-surface-container-low text-on-surface"
                }`}
              >
                {flash.text}
              </p>
            )}
          </section>
        )}

        {/* The records, and the build button */}
        <aside className={`flex flex-col gap-4 min-w-0 ${isSample ? "xl:col-span-2" : ""}`} aria-labelledby="records-h">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="records-h" className="text-[17px] font-bold">
              In this project <span className="font-mono tnum text-[13px] text-on-surface-variant font-normal">{sources.length}</span>
            </h2>
            {data?.withheld_count > 0 && <span className="text-[12.5px] text-on-surface-variant">{data.withheld_count} admin-only hidden</span>}
          </div>
          {error && <p className="text-[13px] text-error">{error}</p>}
          {!data && !error && <Skeleton className="h-32 w-full" />}
          {data && sources.length === 0 && (
            <div className="rounded-[12px] border border-dashed border-outline-variant px-5 py-8 text-center">
              <FileText size={22} aria-hidden="true" className="mx-auto text-outline" />
              <p className="mt-2 text-[14px] text-on-surface-variant">No records yet. A git history gives ownership and risk; notes and issues give decisions and warnings.</p>
            </div>
          )}
          <ul className={`grid gap-2 ${isSample ? "sm:grid-cols-2 lg:grid-cols-3" : ""}`}>
            {sources.map((s) => (
              <li key={s.id} className="rise-in flex items-center gap-3 bg-surface-container-lowest rounded-[10px] border border-outline-variant pl-3.5 pr-2 py-2.5">
                <span className="font-mono text-[11px] text-on-surface-variant w-10 shrink-0">{s.kind}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[13px] truncate" title={s.name}>
                    {s.name}
                  </span>
                  <span className="block text-[12px] text-on-surface-variant">
                    {s.chunk_count} part{s.chunk_count === 1 ? "" : "s"} ·{" "}
                    <span className={`px-1.5 rounded-full ${ACCESS_CHIP[s.access_level] || ACCESS_CHIP.team}`}>{humanize(s.access_level)}</span>
                  </span>
                </span>
                {!isSample && (
                  <button type="button" onClick={() => remove(s)} aria-label={`Remove ${s.name}`} className="w-9 h-9 inline-flex items-center justify-center shrink-0 rounded-[6px] text-outline hover:text-error hover:bg-error-container cursor-pointer">
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>

          {!isSample && (
            <div className="mt-2 flex flex-col gap-3 bg-ink text-on-ink rounded-[12px] p-5">
              <h3 className="text-[16px] font-bold">Build the claims</h3>
              <p className="text-[13px] leading-5 text-on-ink-muted">
                Code rules rank who owns which module and what is stale or reverted. Notes, issues, tasks and chat are read by the AI extractor when one is set up, and otherwise by published keyword rules. Nothing is approved for you.
              </p>
              <Button variant="stamp" size="lg" disabled={!!busy || sources.length === 0} onClick={() => (reviewed ? setConfirmBuild(true) : build())}>
                {busy === "build" ? "Building…" : "Build claims"}
              </Button>
            </div>
          )}

          {built && (
            <div className="rise-in flex flex-col gap-3">
              <Slip
                who="Backstop"
                when="just now"
                what={`${built.project.claim_count} claims ready`}
                note={`${built.derived} from code, ${built.extracted} extracted, ${built.rules_added} new from keyword rules`}
              />
              {built.notes?.map((n) => (
                <p key={n} className="text-[12.5px] text-on-surface-variant">
                  {n}
                </p>
              ))}
              <div className="flex gap-2 flex-wrap">
                <Button variant="primary" onClick={() => setActiveTab("review")}>
                  Check the claims <ArrowRight size={15} aria-hidden="true" />
                </Button>
                <Button onClick={() => setActiveTab("debrief")}>See debrief questions</Button>
              </div>
            </div>
          )}
        </aside>
      </div>

      {project?.id && sources.some((s) => s.kind === "git") && (
        <RepoMap
          projectId={project.id}
          refreshKey={`${sources.map((s) => s.id).join(",")}-${built ? built.project.claim_count : 0}-${grownAt}`}
          grow={grownAt > 0}
          setActiveTab={setActiveTab}
        />
      )}

      <Dialog
        open={confirmBuild}
        onClose={() => setConfirmBuild(false)}
        title="Build the claims again?"
        description={`${reviewed} claim${reviewed === 1 ? " has" : "s have"} been checked. Claims from code and from the AI extractor are rebuilt, which clears their decisions. Keyword-rule claims and debrief answers keep theirs.`}
        footer={
          <>
            <Button onClick={() => setConfirmBuild(false)}>Not now</Button>
            <Button variant="stamp" onClick={build}>Build again</Button>
          </>
        }
      >
        <p className="text-[14px] text-on-surface-variant">Only new keyword-rule claims are added; existing ones are left as they are.</p>
      </Dialog>
    </div>
  );
}
