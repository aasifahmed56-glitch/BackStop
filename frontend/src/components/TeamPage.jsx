import React, { useEffect, useMemo, useState } from "react";
import { Activity, FolderOpen, Pencil, Plus, Trash2, Users } from "lucide-react";
import { api, formatErrorMessage } from "../api";
import { Button, Dialog, Skeleton } from "./ui";

const RANK = { admin: "Admin", manager: "Manager", lead: "Lead", member: "Member" };
const ROLE = { incoming_dev: "Developer", incoming_pm: "Project manager", lead: "Lead", admin: "Admin" };

const ago = (iso) => {
  if (!iso) return null;
  const t = new Date(iso.endsWith("Z") ? iso : iso + "Z").getTime();
  if (Number.isNaN(t)) return null;
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};

function Chip({ children, tone = "plain" }) {
  const c = tone === "stamp" ? "bg-stamp-container text-on-stamp-container border-stamp/30" : "bg-surface-container-low text-on-surface border-outline-variant";
  return <span className={`inline-flex items-center gap-1 h-6 px-2 rounded-full border text-[12px] font-medium whitespace-nowrap ${c}`}>{children}</span>;
}

function LastSeen({ a }) {
  if (!a) return <span className="text-on-surface-variant">No activity yet</span>;
  return (
    <span>
      <span className="text-on-surface">{a.action}</span>
      {a.detail && <span className="text-on-surface-variant"> ({a.detail})</span>}
      {a.project_name && <span className="text-on-surface-variant"> in <strong className="font-semibold text-on-surface">{a.project_name}</strong></span>}
      <span className="text-on-surface-variant"> · {ago(a.at)}</span>
    </span>
  );
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/* Who is under whom, what each person works on, and where. Admin also edits teams here. */
export default function TeamPage({ onOpenProject }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);
  const [editing, setEditing] = useState(null); // team object, or {} for a new team
  const [showAllActivity, setShowAllActivity] = useState(false);

  const load = () =>
    api
      .orgOverview()
      .then((d) => (setData(d), setError(null)))
      .catch((e) => setError(formatErrorMessage(e)));

  useEffect(() => {
    load();
  }, []);

  const toggleAssignment = async (team, member, projectId) => {
    const has = member.projects.includes(projectId);
    const next = has ? member.projects.filter((p) => p !== projectId) : [...member.projects, projectId];
    try {
      await api.setAssignments(team.id, member.id, next);
      const pname = team.projects.find((p) => p.id === projectId)?.name;
      setNote(`${member.display_name} ${has ? "no longer works on" : "now works on"} ${pname}.`);
      await load();
    } catch (err) {
      setError(formatErrorMessage(err));
    }
  };

  if (error && !data) {
    return (
      <div role="alert" className="panel border-error/40 px-4 py-3 text-[14px] flex flex-wrap items-center gap-2">
        <span>{error}</span> <Button size="sm" className="ml-2 min-h-9" onClick={load}>Try again</Button>
      </div>
    );
  }
  if (!data) return <Skeleton className="h-64" />;

  const isAdmin = data.scope === "admin";
  const title = isAdmin ? "Teams and people" : data.scope === "manager" ? "Your teams" : "Your team";
  const intro = isAdmin
    ? "Every team, who leads it, who is in it, which projects each person works on and what they did last."
    : data.scope === "manager"
    ? "The teams you oversee: their leads, their members, which projects each person works on and what they did last."
    : "The people in your team, the projects each one works on and what they did last. Tick a project to give someone access to it.";

  return (
    <div className="flex flex-col gap-8 max-w-[1100px]">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="max-w-[64ch]">
          <h1 className="text-[32px] sm:text-[40px] leading-[1.05] font-bold tracking-[-0.03em]">{title}</h1>
          <p className="text-[15px] leading-6 text-on-surface-variant mt-2">{intro}</p>
        </div>
        {isAdmin && (
          <Button variant="primary" size="lg" onClick={() => setEditing({})}>
            <Plus size={18} aria-hidden="true" /> New team
          </Button>
        )}
      </header>

      <p className="text-[14px] text-on-surface-variant tnum -mt-4">
        {plural(data.stats.people, "person", "people")} in {plural(data.stats.teams, "team", "teams")} across {plural(data.stats.projects, "project", "projects")}. {data.stats.active_today} active today.
      </p>

      {error && <p role="alert" className="text-[14px] text-error">{error}</p>}
      {note && <p role="status" className="text-[13.5px] text-tertiary">{note}</p>}

      {data.teams.length === 0 && (
        <p className="panel px-5 py-4 text-[14.5px] text-on-surface-variant">
          {isAdmin ? "No teams yet. Create one and give it a manager, a lead, members and projects." : "You do not run a team yet. An admin can add you to one."}
        </p>
      )}

      {data.teams.map((team) => (
        <section key={team.id} className="panel overflow-hidden" aria-labelledby={`team-${team.id}`}>
          <header className="px-5 py-4 border-b border-outline-variant flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id={`team-${team.id}`} className="text-[19px] font-bold flex items-center gap-2">
                <Users size={18} aria-hidden="true" className="text-outline" /> {team.name}
              </h2>
              <p className="text-[13.5px] text-on-surface-variant mt-1">
                Manager: <strong className="text-on-surface font-semibold">{team.manager?.display_name || "none"}</strong>
                <span aria-hidden="true"> · </span>
                Lead: <strong className="text-on-surface font-semibold">{team.lead?.display_name || "none"}</strong>
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {team.projects.length === 0 && <span className="text-[13px] text-on-surface-variant">No projects yet</span>}
                {team.projects.map((p) => (
                  <button key={p.id} type="button" onClick={() => onOpenProject?.(p.id)} className="cursor-pointer min-h-9 sm:min-h-0 inline-flex items-center rounded-full" title={`Open ${p.name}`} aria-label={`Open ${p.name}`}>
                    <Chip tone="stamp"><FolderOpen size={12} aria-hidden="true" /> {p.name}</Chip>
                  </button>
                ))}
              </div>
            </div>
            {isAdmin && (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="min-h-9" onClick={() => setEditing(team)} aria-label={`Edit ${team.name}`}><Pencil size={15} aria-hidden="true" /> Edit</Button>
              </div>
            )}
          </header>

          {team.members.length === 0 ? (
            <p className="px-5 py-4 text-[14px] text-on-surface-variant">No members yet.</p>
          ) : (
            <ul className="divide-y divide-outline-variant">
              {team.members.map((m) => (
                <li key={m.id} className="px-5 py-3.5 grid gap-2 md:grid-cols-[minmax(160px,1fr)_minmax(200px,1.2fr)_minmax(220px,1.6fr)] md:items-center">
                  <div>
                    <div className="font-semibold text-[14.5px]">{m.display_name}</div>
                    <div className="font-mono text-[12.5px] text-on-surface-variant">{m.username}</div>
                  </div>
                  <fieldset className="flex flex-wrap gap-x-4 gap-y-0.5 sm:gap-y-1.5 min-w-0">
                    <legend className="sr-only">Projects {m.display_name} works on</legend>
                    {team.projects.length === 0 && <span className="text-[13px] text-on-surface-variant">No team projects</span>}
                    {team.projects.map((p) => (
                      <label key={p.id} className="inline-flex items-center gap-2 min-h-9 sm:min-h-0 text-[13.5px] cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-[var(--color-stamp)]"
                          checked={m.projects.includes(p.id)}
                          onChange={() => toggleAssignment(team, m, p.id)}
                        />
                        {p.name}
                      </label>
                    ))}
                  </fieldset>
                  <div className="text-[13.5px] leading-5">
                    <span className="md:hidden text-[12.5px] font-medium text-on-surface-variant block">Last activity</span>
                    <LastSeen a={m.last_activity} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section aria-labelledby="people-h" className="flex flex-col gap-3">
        <h2 id="people-h" className="text-[20px] font-bold">{isAdmin ? "Everyone" : "Everyone you can see"}</h2>
        <ul className="panel divide-y divide-outline-variant">
          {data.people.map((p) => (
            <li key={p.id} className={`px-5 py-3.5 grid gap-2 md:grid-cols-[minmax(200px,1.3fr)_minmax(140px,0.8fr)_minmax(200px,1.2fr)] md:items-start ${p.active ? "" : "opacity-60"}`}>
              <div className="min-w-0">
                <div className="font-semibold text-[14.5px]">{p.display_name}</div>
                <div className="text-[12.5px] leading-5 text-on-surface-variant">{p.last_activity ? <LastSeen a={p.last_activity} /> : `Last sign-in: ${ago(p.last_login_at) || "never"}`}</div>
              </div>
              <div className="text-[13.5px] leading-5">
                {RANK[p.rank]}
                {p.rank === "member" && <span className="text-on-surface-variant"> · {ROLE[p.role]}</span>}
                {p.teams.length > 0 && <div className="text-on-surface-variant">{p.teams.join(", ")}</div>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {p.rank === "admin" ? <Chip>All projects</Chip> : p.projects.length ? p.projects.map((x) => <Chip key={x.id}>{x.name}</Chip>) : <span className="text-[13.5px] text-on-surface-variant">No projects</span>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="activity-h" className="flex flex-col gap-3">
        <h2 id="activity-h" className="text-[20px] font-bold flex items-center gap-2">
          <Activity size={18} aria-hidden="true" className="text-outline" /> Recent activity
        </h2>
        {data.activity.length === 0 ? (
          <p className="text-[14px] text-on-surface-variant">Nothing yet. Opening a handover, checking a claim or adding a record shows up here.</p>
        ) : (
          <ol className="panel divide-y divide-outline-variant">
            {data.activity.slice(0, showAllActivity ? 30 : 10).map((a) => {
              const who = data.people.find((p) => p.id === a.user_id);
              return (
                <li key={a.id} className="px-4 py-2.5 text-[13.5px] leading-5">
                  <strong className="font-semibold">{who?.display_name || a.username}</strong> <LastSeen a={a} />
                </li>
              );
            })}
          </ol>
        )}
        {data.activity.length > 10 && (
          <Button size="sm" className="self-start min-h-9" onClick={() => setShowAllActivity((v) => !v)}>
            {showAllActivity ? "Show fewer" : "Show more"}
          </Button>
        )}
      </section>

      {isAdmin && editing && (
        <TeamDialog
          team={editing}
          people={data.people}
          projects={data.projects}
          onClose={() => setEditing(null)}
          onSaved={async (msg) => {
            setEditing(null);
            setNote(msg);
            await load();
          }}
        />
      )}
    </div>
  );
}

function TeamDialog({ team, people, projects, onClose, onSaved }) {
  const isNew = !team.id;
  const [name, setName] = useState(team.name || "");
  const [managerId, setManagerId] = useState(team.manager?.id || "");
  const [leadId, setLeadId] = useState(team.lead?.id || "");
  const [members, setMembers] = useState(new Set((team.members || []).map((m) => m.id)));
  const [projectIds, setProjectIds] = useState(new Set((team.projects || []).map((p) => p.id)));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const byRank = useMemo(() => {
    const g = { manager: [], lead: [], member: [] };
    people.forEach((p) => g[p.rank]?.push(p));
    return g;
  }, [people]);

  const toggle = (set, setter, id) => {
    const n = new Set(set);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setter(n);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    const body = {
      name,
      manager_id: managerId ? Number(managerId) : null,
      lead_id: leadId ? Number(leadId) : null,
      member_ids: [...members],
      project_ids: [...projectIds],
    };
    try {
      if (isNew) await api.createTeam(body);
      else await api.updateTeam(team.id, { ...body, clear_manager: !managerId, clear_lead: !leadId });
      onSaved(isNew ? `Team ${name} created.` : `Team ${name} saved.`);
    } catch (err) {
      setError(formatErrorMessage(err));
      setBusy(false);
    }
  };

  const remove = async () => {
    try {
      await api.deleteTeam(team.id);
      onSaved(`Team ${team.name} deleted. Its members keep the projects assigned to them.`);
    } catch (err) {
      setError(formatErrorMessage(err));
    }
  };

  const sel = "w-full h-10 px-2.5 rounded-[6px] border border-outline-variant bg-surface-container-lowest text-[14px] text-on-surface focus:outline-2 focus:outline-stamp focus:border-stamp";
  const box = "max-h-40 overflow-y-auto flex flex-col gap-1.5 p-2.5 rounded-[6px] border border-outline-variant";

  return (
    <Dialog
      open
      onClose={onClose}
      title={isNew ? "New team" : `Edit ${team.name}`}
      description="Members only reach the team projects their lead ticks for them."
      width="max-w-lg"
      footer={
        <>
          {!isNew && (
            confirmDelete ? (
              <Button variant="danger" className="mr-auto" onClick={remove}>Delete for good</Button>
            ) : (
              <Button variant="ghost" className="mr-auto" onClick={() => setConfirmDelete(true)}><Trash2 size={15} aria-hidden="true" /> Delete team</Button>
            )
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={busy || !name.trim()} onClick={save}>{busy ? "Saving…" : "Save team"}</Button>
        </>
      }
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">Team name</span>
        <input className={sel} autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">Manager</span>
          <select className={sel} value={managerId} onChange={(e) => setManagerId(e.target.value)}>
            <option value="">None</option>
            {byRank.manager.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">Lead</span>
          <select className={sel} value={leadId} onChange={(e) => setLeadId(e.target.value)}>
            <option value="">None</option>
            {byRank.lead.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
          </select>
        </label>
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-[13px] font-semibold mb-1.5">Members</legend>
        <div className={box}>
          {byRank.member.length === 0 && <span className="text-[13px] text-on-surface-variant">No developer or PM accounts yet.</span>}
          {byRank.member.map((p) => (
            <label key={p.id} className="inline-flex items-center gap-2 min-h-9 sm:min-h-0 text-[14px]">
              <input type="checkbox" className="w-4 h-4 accent-[var(--color-stamp)]" checked={members.has(p.id)} onChange={() => toggle(members, setMembers, p.id)} />
              {p.display_name} <span className="text-on-surface-variant text-[12.5px]">{ROLE[p.role]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-[13px] font-semibold mb-1.5">Projects</legend>
        <div className={box}>
          {projects.map((p) => (
            <label key={p.id} className="inline-flex items-center gap-2 min-h-9 sm:min-h-0 text-[14px]">
              <input type="checkbox" className="w-4 h-4 accent-[var(--color-stamp)]" checked={projectIds.has(p.id)} onChange={() => toggle(projectIds, setProjectIds, p.id)} />
              {p.name}
            </label>
          ))}
        </div>
      </fieldset>
      {error && <p role="alert" className="text-[13.5px] text-error">{error}</p>}
    </Dialog>
  );
}
