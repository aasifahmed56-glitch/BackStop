import React, { useEffect, useState } from "react";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { api, formatErrorMessage } from "../api";
import { Button, Dialog, Skeleton, consignmentNo } from "./ui";

const fmt = (iso) => {
  const d = new Date(iso + "T00:00:00");
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const input =
  "w-full h-10 px-2.5 rounded-[6px] border border-outline-variant bg-surface-container-lowest text-[14px] text-on-surface placeholder:text-outline focus:outline-2 focus:outline-stamp focus:border-stamp";

/* Every handover lives in its own project: one person leaving, their records, their claims. */
export default function ProjectsPage({ currentId, onOpen, onDeleted, startOpen = false }) {
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(startOpen);
  const [form, setForm] = useState({ name: "", leaver: "", date: "" });
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const load = () =>
    api
      .listProjects()
      .then((p) => setProjects(Array.isArray(p) ? p : []))
      .catch((e) => setError(formatErrorMessage(e)));

  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!form.name.trim() || !form.leaver.trim() || !form.date) {
      setFormError("Fill in all three: the project, who is leaving, and their last day.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const p = await api.createProject({ name: form.name.trim(), leaverName: form.leaver.trim(), departureDate: form.date });
      setForm({ name: "", leaver: "", date: "" });
      setCreating(false);
      onOpen(p.id, "records");
    } catch (err) {
      setFormError(formatErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    const p = toDelete;
    setToDelete(null);
    try {
      await api.deleteProject(p.id);
      await load();
      onDeleted(p.id);
    } catch (err) {
      setError(formatErrorMessage(err));
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-[960px]">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="max-w-[60ch]">
          <h1 className="text-[32px] sm:text-[40px] leading-[1.05] font-bold tracking-[-0.03em]">Projects</h1>
          <p className="text-[15px] leading-6 text-on-surface-variant mt-2">
            One project for each person leaving. Add their records, build the claims, check them, and hand over what a person approved.
          </p>
        </div>
        {!creating && (
          <Button variant="primary" size="lg" onClick={() => setCreating(true)}>
            <Plus size={18} aria-hidden="true" /> New project
          </Button>
        )}
      </header>

      {creating && (
        <form onSubmit={create} className="rise-in bg-surface-container-lowest rounded-[12px] border border-outline-variant p-5 sm:p-7 flex flex-col gap-5" aria-labelledby="new-project-h">
          <h2 id="new-project-h" className="text-[20px] font-bold tracking-[-0.01em]">Start a handover</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="field-label">Project or team</span>
              <input className={input} value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Billing service" autoFocus />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="field-label">Person leaving</span>
              <input className={input} value={form.leaver} maxLength={80} onChange={(e) => setForm({ ...form, leaver: e.target.value })} placeholder="As written in git, e.g. Asha Rao" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="field-label">Their last day</span>
              <input type="date" className={input} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </label>
          </div>
          <p className="text-[12.5px] text-on-surface-variant">
            Use the name exactly as it appears in the git history, so ownership can be counted. You can import a GitHub history later and Backstop will match it.
          </p>
          {formError && (
            <p role="alert" className="rounded-[6px] border border-error/40 bg-error-container text-on-error-container px-3 py-2 text-[13.5px]">
              {formError}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" variant="stamp" disabled={busy}>
              {busy ? "Creating…" : "Create and add records"}
            </Button>
            <Button onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="text-[14px] text-error">
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-3" aria-label="Your projects">
        {!projects &&
          [0, 1].map((i) => (
            <li key={i}>
              <Skeleton className="h-24 w-full" />
            </li>
          ))}
        {projects?.map((p) => {
          const current = p.id === currentId;
          const pct = p.claim_count ? Math.round((p.reviewed_count / p.claim_count) * 100) : 0;
          return (
            <li
              key={p.id}
              className={`group bg-surface-container-lowest rounded-[12px] border px-5 py-4 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-center transition-colors ${
                current ? "border-on-surface/70" : "border-outline-variant hover:border-outline"
              }`}
            >
              <div className="min-w-0 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-[17px] font-bold truncate">{p.name}</h2>
                  {p.is_sample && <span className="px-2 py-px rounded-full text-[11.5px] font-medium bg-surface-container text-on-surface-variant">Synthetic sample</span>}
                  {current && <span className="px-2 py-px rounded-full text-[11.5px] font-medium bg-stamp-container text-on-stamp-container">Open now</span>}
                </div>
                <p className="text-[13.5px] text-on-surface-variant">
                  {p.leaver_name} leaves {fmt(p.departure_date)} <span className="font-mono text-[12px] text-outline">· {consignmentNo(p.id)}</span>
                </p>
                <div className="flex items-center gap-3 text-[12.5px] text-on-surface-variant">
                  <span className="font-mono tnum">{p.source_count} records</span>
                  <span className="font-mono tnum">{p.claim_count} claims</span>
                  <span className="flex items-center gap-2">
                    <span className="relative w-20 h-1.5 rounded-full bg-surface-container-high overflow-hidden" aria-hidden="true">
                      <span className="absolute inset-y-0 left-0 bg-stamp" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="font-mono tnum">{pct}% checked</span>
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!p.is_sample && (
                  <Button variant="ghost" size="sm" onClick={() => setToDelete(p)} aria-label={`Delete ${p.name}`}>
                    <Trash2 size={15} aria-hidden="true" />
                  </Button>
                )}
                <Button variant={current ? "outline" : "primary"} onClick={() => onOpen(p.id, p.claim_count ? "overview" : "records")}>
                  {current ? "Go to overview" : "Open"} <ArrowRight size={15} aria-hidden="true" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`Delete ${toDelete?.name || "this project"}?`}
        description="Its records, claims, review decisions and debrief answers are removed. This cannot be undone."
        footer={
          <>
            <Button onClick={() => setToDelete(null)}>Keep it</Button>
            <Button variant="danger" onClick={doDelete}>Delete project</Button>
          </>
        }
      >
        <p className="text-[14px] text-on-surface-variant">The synthetic sample cannot be deleted.</p>
      </Dialog>
    </div>
  );
}
