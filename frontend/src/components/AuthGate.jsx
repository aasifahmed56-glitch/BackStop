import React, { useCallback, useEffect, useState } from "react";
import LoginPage from "./LoginPage";
import { api, setCurrentUser, SIGNED_OUT_EVENT } from "../api";

const isAdminPath = () => window.location.pathname.replace(/\/+$/, "") === "/admin/login";
const isLoginPath = () => ["/login", "/admin/login"].includes(window.location.pathname.replace(/\/+$/, ""));

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
    return <div className="min-h-screen bg-background" aria-busy="true" />;
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
