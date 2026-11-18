import React, { useState } from "react";
import { api } from "../api";
import RealBacktestView from "./RealBacktestView";
import { Button } from "./ui";

export default function GithubImportPanel({ title = "Analyse a public repository" }) {
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

  const input =
    "w-full h-10 px-2.5 rounded-[10px] border border-outline-variant bg-surface-container-lowest text-[14px] text-on-surface placeholder:text-outline focus:outline-2 focus:outline-primary focus:border-primary";

  return (
    <div className="flex flex-col gap-5 min-w-0">
      <form onSubmit={submit} className="bg-surface-container-lowest rounded-[22px] p-6 sm:p-10 flex flex-col gap-5" aria-busy={busy} aria-labelledby="gh-import-h">
        <div>
          <h2 id="gh-import-h" className="text-[28px] sm:text-[34px] leading-[1.1] font-bold tracking-[-0.025em] text-on-surface">{title}.</h2>
          <p className="text-[14px] leading-[22px] text-on-surface-variant mt-1 max-w-3xl">
            Backstop downloads the commit history (no file contents), replaces every name with a pseudonym, ranks modules as of the
            date you pick and checks the ranking against what happened in the next 180 days. Nothing is stored. Up to 3 imports per hour; large repositories may time out after 60 seconds.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-3 items-end">
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Repository link</span>
            <input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com/owner/repo" className={`${input} font-mono text-[13px]`} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Date the person left</span>
            <input type="date" required max={today} value={date} onChange={(e) => setDate(e.target.value)} className={input} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Their git author name (optional)</span>
            <input type="text" value={leaver} onChange={(e) => setLeaver(e.target.value)} placeholder="Most active if empty" className={input} />
          </label>
          <Button type="submit" variant="primary" disabled={busy} className="h-10">
            {busy ? "Analysing… up to a minute" : "Analyse"}
          </Button>
        </div>
        <p className="text-[13px] text-on-surface-variant">
          Example:{" "}
          <button
            type="button"
            className="text-primary font-semibold hover:underline underline-offset-2 cursor-pointer rounded-[2px]"
            onClick={() => {
              setUrl("https://github.com/tj/commander.js");
              setDate("2016-01-01");
              setLeaver("");
            }}
          >
            commander.js, 1 Jan 2016
          </button>
        </p>
        {error && (
          <p role="alert" className="rounded-[3px] border border-error bg-error-container text-on-error-container px-3 py-2 text-[13.5px]">
            {error}
          </p>
        )}
      </form>
      {result && <RealBacktestView key={result.dataset.name + result.dataset.departure_date} preloaded={result} />}
    </div>
  );
}
