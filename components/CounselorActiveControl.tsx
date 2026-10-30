"use client";

import { useState, useTransition } from "react";
import { setCounselorActive } from "@/app/actions/counselors";

export default function CounselorActiveControl({ id, active }: { id: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    const ok = window.confirm(
      active
        ? "Deactivate this login? They won't be able to sign in again until you reactivate them — their admissions and payment history are untouched."
        : "Reactivate this login? They'll be able to sign in again right away."
    );
    if (!ok) return;
    startTransition(async () => {
      const res = await setCounselorActive(id, !active);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span className={`badge ${active ? "good" : "bad"}`}>{active ? "Active" : "Deactivated"}</span>
      <button className="reset-btn" disabled={pending} onClick={toggle}>
        {pending ? "Saving…" : active ? "Deactivate" : "Reactivate"}
      </button>
      {error && <span className="error-text" style={{ fontSize: 12 }}>{error}</span>}
    </span>
  );
}
