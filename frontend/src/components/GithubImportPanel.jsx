import React, { useState } from "react";
import { api } from "../api";
import RealBacktestView from "./RealBacktestView";

export default function GithubImportPanel() {
  const [url, setUrl] = useState("");
  const [date, setDate] = useState("");
  const [leaver, setLeaver] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!/^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/?$/.test(url.trim())) {
      setError("Use a public repository link like https://github.com/owner/repo.");
      return;
    }
    if (!date) {
      setError("Pick the date the person left.");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      setResult(await api.importGithub({ url: url.trim(), departure_date: date, leaver: leaver.trim() || null }));
    } catch (err) {
      setError(err.message || "The import failed. Try again, or use the mocha dataset.");
    } finally {
      setBusy(false);
    }
  };

  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  return (
    <div className="flex flex-col gap-space-lg">
      <form onSubmit={submit} className="bg-surface-container-lowest rounded-xl p-space-lg border border-surface-container flex flex-col gap-space-md" aria-busy={busy}>
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface font-semibold">Analyse a public repository</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 max-w-3xl">
            Backstop downloads the commit history (no file contents), replaces every name with a pseudonym, ranks modules as of the
            date you pick and checks the ranking against what happened in the next 180 days. Nothing is stored. Up to 3 imports per hour; large repositories may time out after 60 seconds.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-space-md items-end">
          <label className="flex flex-col gap-1 font-label-md text-label-md text-on-surface">
            Repository link
            <input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com/owner/repo"
              className="px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest font-body-md text-body-md" />
          </label>
          <label className="flex flex-col gap-1 font-label-md text-label-md text-on-surface">
            Date the person left
            <input type="date" required max={today} value={date} onChange={(e) => setDate(e.target.value)}
              className="px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest font-body-md text-body-md" />
          </label>
          <label className="flex flex-col gap-1 font-label-md text-label-md text-on-surface">
            Their git author name (optional)
            <input type="text" value={leaver} onChange={(e) => setLeaver(e.target.value)} placeholder="Most active if empty"
              className="px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest font-body-md text-body-md" />
          </label>
          <button type="submit" disabled={busy}
            className="px-space-md py-2.5 bg-primary text-on-primary rounded-lg font-headline-sm text-headline-sm cursor-pointer disabled:opacity-60">
            {busy ? "Analysing… up to a minute" : "Analyse"}
          </button>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Example: <button type="button" className="text-primary underline underline-offset-2 cursor-pointer" onClick={() => { setUrl("https://github.com/tj/commander.js"); setDate("2016-01-01"); setLeaver(""); }}>commander.js, 1 Jan 2016</button>
        </p>
        {error && <p role="alert" className="rounded-lg bg-error-container text-on-error-container px-3 py-2 font-body-sm text-body-sm">{error}</p>}
      </form>
      {result && <RealBacktestView key={result.dataset.name + result.dataset.departure_date} preloaded={result} />}
    </div>
  );
}
