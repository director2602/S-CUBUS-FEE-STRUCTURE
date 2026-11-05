"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

// Landing page for the link in the "forgot password" email. Supabase's browser client reads the
// recovery tokens out of the URL hash on load and establishes a (recovery-scoped) session
// automatically — this page just waits for that, then lets the user set a new password.
export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true);
        return;
      }
      // the hash-fragment tokens can take a tick to be parsed on first load — check once more
      setTimeout(() => {
        supabase.auth.getSession().then(({ data }) => {
          if (data.session) setReady(true);
          else setInvalid(true);
        });
      }, 1200);
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.push("/calculator");
      router.refresh();
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
            <h2 className="card-title">Set a new password</h2>
          </div>
          {invalid ? (
            <>
              <p className="comp-hint" style={{ marginBottom: 16 }}>
                This reset link is invalid or has expired. Go back to the login page and request a new one.
              </p>
              <a className="btn" href="/login">
                Back to sign in
              </a>
            </>
          ) : !ready ? (
            <p className="comp-hint">Verifying your reset link…</p>
          ) : (
            <form onSubmit={handleSubmit} className="stack" style={{ gap: 14 }}>
              <div className="field">
                <label htmlFor="password">New password</label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="confirm">Confirm new password</label>
                <input
                  id="confirm"
                  type="password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              {error && <div className="error-text">{error}</div>}
              <button className="btn" type="submit" disabled={busy}>
                {busy ? "Please wait…" : "Set new password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
