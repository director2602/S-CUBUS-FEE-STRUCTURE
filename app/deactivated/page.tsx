"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function DeactivatedPage() {
  const supabase = supabaseBrowser();
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.signOut().finally(() => setDone(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <div className="card" style={{ borderColor: "var(--bad-fg)" }}>
          <div className="card-head">
            <span className="kicker">Access removed</span>
            <h2 className="card-title">This login has been deactivated</h2>
          </div>
          <p className="comp-hint" style={{ marginBottom: 16 }}>
            The owner has deactivated this account — you've been signed out{done ? "" : "…"}. Your admissions and
            payment history haven't been touched; contact the owner if you think this was a mistake or need access
            back.
          </p>
          <Link className="btn secondary small" href="/login">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
