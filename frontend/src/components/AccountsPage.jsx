import React, { useEffect, useState } from "react";
import { KeyRound, Plus, Trash2, UserCheck, UserX } from "lucide-react";
import { api, formatErrorMessage, getCurrentUser } from "../api";
import { Button, Dialog, Skeleton } from "./ui";

const ROLE_LABEL = {
  admin: "Admin",
  lead: "Lead",
  incoming_dev: "New developer",
  incoming_pm: "New project manager",
};
const ROLE_HELP = {
  admin: "Signs in at /admin/login. Manages accounts and sees every access level.",
  lead: "Reviews claims and sees restricted notes. Can preview the newcomer views.",
  incoming_dev: "Reads the developer handover at team level.",
  incoming_pm: "Reads the project manager handover at team level.",
};

const input =
  "w-full h-10 px-2.5 rounded-[6px] border border-outline-variant bg-surface-container-lowest text-[14px] text-on-surface placeholder:text-outline focus:outline-2 focus:outline-stamp focus:border-stamp";

const fmt = (iso) => {
  if (!iso) return "Never";
  const d = new Date(iso.endsWith("Z") ? iso : iso + "Z");
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

/* Admin only: who can sign in, and as what. */
export default function AccountsPage() {
  const me = getCurrentUser();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ username: "", displayName: "", role: "incoming_dev", password: "" });
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [resetFor, setResetFor] = useState(null);
  const [newPw, setNewPw] = useState("");
  const [toDelete, setToDelete] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [rowNote, setRowNote] = useState(null);

  const load = () =>
    api
      .listUsers()
      .then((r) => {
        setUsers(r.users);
        setLoadFailed(false);
      })
      .catch((e) => {
        setError(formatErrorMessage(e));
        setLoadFailed(true);
      });

  const pwShort = (pw) => (pw.length >= 8 ? null : `8 characters minimum, ${pw.length} so far`);
  const canCreate = form.username.trim().length > 0 && form.password.length >= 8;

  useEffect(() => {
    load();
  }, []);

  const run = async (fn, note) => {
    setError(null);
    setRowNote(null);
    try {
      await fn();
      await load();
      if (note) {
        setRowNote(note);
        setTimeout(() => setRowNote((cur) => (cur === note ? null : cur)), 4000);
      }
    } catch (err) {
      setError(formatErrorMessage(err));
    }
  };

  const create = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFormError(null);
    try {
      await api.createUser(form);
      setForm({ username: "", displayName: "", role: "incoming_dev", password: "" });
      setCreating(false);
      await load();
    } catch (err) {
      setFormError(formatErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!me?.is_admin) {
    return <p className="text-[15px] text-on-surface-variant">Only admins can manage accounts.</p>;
  }

  return (
    <div className="flex flex-col gap-8 max-w-[960px]">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="max-w-[60ch]">
          <h1 className="text-[32px] sm:text-[40px] leading-[1.05] font-bold tracking-[-0.03em]">Accounts</h1>
          <p className="text-[15px] leading-6 text-on-surface-variant mt-2">
            Each person signs in with their own account. The account's role decides what the server shows them, whatever the page asks for.
          </p>
        </div>
        {!creating && (
          <Button variant="primary" size="lg" onClick={() => setCreating(true)}>
            <Plus size={18} aria-hidden="true" /> New account
          </Button>
        )}
      </header>

      {creating && (
        <form onSubmit={create} className="panel px-5 py-5 grid gap-4 sm:grid-cols-2" noValidate>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">Username</span>
            <input className={input} autoCapitalize="none" spellCheck={false} value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })} autoFocus />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">Name</span>
            <input className={input} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">Role</span>
            <select className={input} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {Object.entries(ROLE_LABEL).map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
            <span className="text-[12px] text-on-surface-variant">{ROLE_HELP[form.role]}</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">Password</span>
            <input className={input} type="password" autoComplete="new-password" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <span className="text-[12px] text-on-surface-variant">
              {form.password ? pwShort(form.password) || "Long enough." : "8 characters minimum."} Share it with the person directly.
            </span>
          </label>
          {formError && <p role="alert" className="sm:col-span-2 text-[13.5px] text-error">{formError}</p>}
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button onClick={() => (setCreating(false), setFormError(null))}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={busy || !canCreate}>{busy ? "Creating…" : "Create account"}</Button>
          </div>
        </form>
      )}

      {error && (
        <div role="alert" className="panel border-error/40 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-[14px] text-error">
          <p>{error}</p>
          {loadFailed && <Button size="sm" className="min-h-9" onClick={() => (setError(null), load())}>Try again</Button>}
        </div>
      )}
      {rowNote && <p role="status" className="text-[13.5px] text-tertiary">{rowNote}</p>}

      {!users ? (
        loadFailed ? null : <Skeleton className="h-40" />
      ) : (
        <div className="panel relative overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="text-left text-[12.5px] text-on-surface-variant border-b border-outline-variant">
                <th className="px-4 py-2.5 font-semibold">Person</th>
                <th className="px-4 py-2.5 font-semibold">Role</th>
                <th className="px-4 py-2.5 font-semibold hidden sm:table-cell">Last sign-in</th>
                <th className="px-4 py-2.5 font-semibold"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const self = u.id === me.id;
                return (
                  <tr key={u.id} className={`border-b border-outline-variant last:border-0 ${u.active ? "" : "opacity-60"}`}>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{u.display_name}{self && <span className="ml-1.5 text-[12px] font-normal text-on-surface-variant">(you)</span>}</div>
                      <div className="font-mono text-[12.5px] text-on-surface-variant">{u.username}{!u.active && " · disabled"}</div>
                      <div className="sm:hidden text-[12px] text-on-surface-variant tnum whitespace-nowrap">Last sign-in: {fmt(u.last_login_at)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        aria-label={`Role for ${u.username}`}
                        className="min-h-9 sm:min-h-8 px-2 rounded-[6px] border border-outline-variant bg-surface-container-lowest text-[13.5px] disabled:opacity-60"
                        value={u.role}
                        disabled={self}
                        onChange={(e) => run(() => api.updateUser(u.id, { role: e.target.value }), `Role for ${u.username} is now ${ROLE_LABEL[e.target.value]}.`)}
                      >
                        {Object.entries(ROLE_LABEL).map(([id, label]) => (
                          <option key={id} value={id}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant tnum whitespace-nowrap hidden sm:table-cell">{fmt(u.last_login_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" className="min-h-9 min-w-9" onClick={() => (setResetFor(u), setNewPw(""))} title="Set a new password">
                          <KeyRound size={15} aria-hidden="true" /> <span className="sr-only md:not-sr-only">Set password for {u.username}</span>
                        </Button>
                        {!self && (
                          <Button size="sm" variant="ghost" className="min-h-9 min-w-9" onClick={() => run(() => api.updateUser(u.id, { active: !u.active }), `${u.username} is now ${u.active ? "disabled" : "enabled"}.`)}>
                            {u.active ? <UserX size={15} aria-hidden="true" /> : <UserCheck size={15} aria-hidden="true" />}
                            <span className="sr-only md:not-sr-only">{u.active ? "Disable" : "Enable"}<span className="sr-only"> {u.username}</span></span>
                          </Button>
                        )}
                        {!self && (
                          <Button size="sm" variant="ghost" className="min-h-9 min-w-9" onClick={() => setToDelete(u)} aria-label={`Delete ${u.username}`}>
                            <Trash2 size={15} aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={!!resetFor}
        onClose={() => setResetFor(null)}
        title={`New password for ${resetFor?.username || ""}`}
        description="Their open sessions end, and they sign in again with this password."
        footer={
          <>
            <Button onClick={() => setResetFor(null)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={newPw.length < 8}
              onClick={() => {
                const u = resetFor;
                setResetFor(null);
                run(() => api.updateUser(u.id, { password: newPw }), `Password set for ${u.username}.`);
              }}
            >
              Set password
            </Button>
          </>
        }
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">Password</span>
          <input className={input} type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          <span className="text-[12px] text-on-surface-variant">{pwShort(newPw) || "Long enough."}</span>
        </label>
      </Dialog>

      <Dialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`Delete ${toDelete?.username || ""}?`}
        description="They can no longer sign in. Review history keeps their role on past decisions."
        footer={
          <>
            <Button onClick={() => setToDelete(null)}>Keep</Button>
            <Button
              variant="danger"
              onClick={() => {
                const u = toDelete;
                setToDelete(null);
                run(() => api.deleteUser(u.id));
              }}
            >
              Delete account
            </Button>
          </>
        }
      />
    </div>
  );
}
