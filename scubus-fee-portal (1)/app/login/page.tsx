"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/calculator");
        router.refresh();
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo(
          "Account created. If your inbox needs email confirmation you'll get a link there — otherwise you're signed in already; try Sign in."
        );
        setMode("signin");
      }
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div className="topbar">
        <div className="topbar-wrap">
          <div className="brand">
            <img className="brand-logo" src="/logo.png" alt="S-CUBUS" />
            <div className="brand-sub">Fee Portal</div>
          </div>
        </div>
      </div>
      <div className="wrap narrow">
        <div className="card">
          <div className="card-head">
            <h2 className="card-title">{mode === "signin" ? "Sign in" : "Create the owner account"}</h2>
          </div>
          <p className="comp-hint" style={{ marginBottom: 16 }}>
            {mode === "signin"
              ? "Use the email and password you (or your counselor invite) set up."
              : "Sign up with director@scubus.com to get owner access automatically. Counselors get a separate email invite from the owner’s Counselors page."}
          </p>
          <form onSubmit={handleSubmit} className="stack" style={{ gap: 14 }}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@scubus.com"
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <div className="error-text">{error}</div>}
            {info && <div className="success-text">{info}</div>}
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
          <div style={{ marginTop: 16, fontSize: 13 }}>
            {mode === "signin" ? (
              <button className="reset-btn" style={{ pointerEvents: "auto", color: "var(--accent)" }} onClick={() => setMode("signup")}>
                First time as owner? Create the owner account
              </button>
            ) : (
              <button className="reset-btn" style={{ pointerEvents: "auto", color: "var(--accent)" }} onClick={() => setMode("signin")}>
                Already have an account? Sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
