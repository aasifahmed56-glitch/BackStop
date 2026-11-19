import React, { useCallback, useEffect, useState } from "react";
import LoginPage from "./LoginPage";
import { Mark } from "./Navbar";
import { api, setCurrentUser, SIGNED_OUT_EVENT } from "../api";

const isAdminPath = () => window.location.pathname.replace(/\/+$/, "") === "/admin/login";
const isLoginPath = () => ["/login", "/admin/login"].includes(window.location.pathname.replace(/\/+$/, ""));

/* Shown while the session check runs; the free host can take a while to wake. */
function Checking() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 3000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="min-h-screen bg-background text-on-surface flex items-center justify-center px-4 antialiased" aria-busy="true">
      <div role="status" className="flex flex-col items-center gap-3 text-center">
        <div className="flex items-center gap-2">
          <Mark size={28} />
          <span className="text-[18px] font-bold tracking-[-0.01em]">Backstop</span>
        </div>
        <p className="text-[14px] text-on-surface-variant">Checking your session…</p>
        {slow && <p className="text-[13px] text-on-surface-variant max-w-[32ch]">The server may be waking up. This can take up to a minute.</p>}
      </div>
    </div>
  );
}

/* Shows the right sign-in page until there is a session, then the app. */
export default function AuthGate({ children }) {
  const [state, setState] = useState({ status: "checking", user: null });

  const signedIn = useCallback((user) => {
    setCurrentUser(user);
    setState({ status: "in", user });
    if (isLoginPath()) {
      window.history.replaceState(null, "", user.is_admin ? "/#/accounts" : "/#/overview");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
  }, []);

  const signedOut = useCallback(() => {
    setCurrentUser(null);
    setState({ status: "out", user: null });
  }, []);

  useEffect(() => {
    api.me().then(({ user }) => signedIn(user)).catch(signedOut);
    window.addEventListener(SIGNED_OUT_EVENT, signedOut);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, signedOut);
  }, [signedIn, signedOut]);

  if (state.status === "checking") {
    return <Checking />;
  }
  if (state.status === "out") {
    if (!isLoginPath()) window.history.replaceState(null, "", "/login");
    return <LoginPage admin={isAdminPath()} onSignedIn={signedIn} />;
  }
  return children(state.user);
}

export async function signOut() {
  try {
    await api.logout();
  } finally {
    setCurrentUser(null);
    window.location.assign("/login");
  }
}
