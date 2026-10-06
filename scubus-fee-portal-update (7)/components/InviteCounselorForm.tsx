"use client";

import { useState, useTransition } from "react";
import { inviteCounselor } from "@/app/actions/counselors";

export default function InviteCounselorForm() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const formData = new FormData();
    formData.set("email", email);
    formData.set("fullName", fullName);
    startTransition(async () => {
      const res = await inviteCounselor(formData);
      if (res?.error) setMsg({ ok: false, text: res.error });
      else {
        setMsg({ ok: true, text: res?.success || "Invited." });
        setEmail("");
        setFullName("");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="stack" style={{ gap: 14 }}>
      <div className="field">
        <label>Counselor name</label>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Kiran" />
      </div>
      <div className="field">
        <label>Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kiran@scubus.com" />
      </div>
      {msg && <div className={msg.ok ? "success-text" : "error-text"}>{msg.text}</div>}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Sending invite…" : "Send invite"}
      </button>
      <p className="comp-hint">
        Sends a sign-up email via Supabase. Requires <code>SUPABASE_SERVICE_ROLE_KEY</code> to be set on the server
        (see the README) &mdash; without it this will show an error explaining what's missing.
      </p>
    </form>
  );
}
