import React, { useEffect, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { Mark } from "./Navbar";
import { Button, TextInput } from "./ui";
import { api, formatErrorMessage } from "../api";

/* Two doors: /login for team members, /admin/login for administrators.
   The server refuses an account at the wrong door, so the pages only differ in wording. */
export default function LoginPage({ admin = false, onSignedIn }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    document.title = admin ? "Admin sign-in · Backstop" : "Sign in · Backstop";
    api.authConfig().then(setConfig).catch(() => setConfig(null));
  }, [admin]);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { user } = await api.login({ username, password, admin });
      onSignedIn(user);
    } catch (err) {
      setError(formatErrorMessage(err));
      setBusy(false);
    }
  };

  const demoNames = admin ? (config?.demo_admin ? [config.demo_admin] : []) : config?.demo_users || [];

  return (
    <div className="min-h-screen bg-background text-on-surface flex items-center justify-center px-4 py-10 antialiased">
      <main className="w-full max-w-[400px]">
        <div className="flex items-center gap-2 mb-6">
          <Mark size={28} />
          <span className="text-[18px] font-bold tracking-[-0.01em]">Backstop</span>
        </div>

        <div className={`panel px-6 py-6 ${admin ? "border-stamp/50" : ""}`}>
          <h1 className="flex items-center gap-2 text-[22px] leading-7 font-bold">
            {admin ? <ShieldCheck size={20} aria-hidden="true" className="text-stamp" /> : <Lock size={20} aria-hidden="true" className="text-on-surface-variant" />}
            {admin ? "Admin sign-in" : "Team sign-in"}
          </h1>
          <p className="mt-1 text-[14px] leading-5 text-on-surface-variant">
            {admin
              ? "Manage accounts and see every access level."
              : "Leads review claims. Newcomers read the handover their role allows."}
          </p>

          <form onSubmit={submit} className="mt-5 flex flex-col gap-4" noValidate>
            <TextInput
              id="username"
              label="Username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
            <TextInput
              id="password"
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && (
              <p role="alert" className="text-[13.5px] leading-5 text-error">
                {error}
              </p>
            )}
            <Button type="submit" variant={admin ? "stamp" : "primary"} size="lg" disabled={busy || !username || !password}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>

        {demoNames.length > 0 && (
          <p className="mt-4 text-[13px] leading-5 text-on-surface-variant">
            Demo accounts: {demoNames.map((n, i) => (
              <React.Fragment key={n}>
                {i > 0 && ", "}
                <button type="button" className="font-mono underline underline-offset-2 hover:text-on-surface cursor-pointer" onClick={() => setUsername(n)}>
                  {n}
                </button>
              </React.Fragment>
            ))}
            {admin
              ? config?.demo_admin_password_hint ? <> with password <span className="font-mono">admin</span>.</> : "."
              : config?.demo_password_hint ? <> with password <span className="font-mono">backstop-demo</span>.</> : "."}
          </p>
        )}

        <p className="mt-4 text-[13px] text-on-surface-variant">
          {admin ? (
            <>Not an admin? <a className="underline underline-offset-2 hover:text-on-surface" href="/login">Team sign-in</a></>
          ) : (
            <>Administrator? <a className="underline underline-offset-2 hover:text-on-surface" href="/admin/login">Admin sign-in</a></>
          )}
        </p>
      </main>
    </div>
  );
}
