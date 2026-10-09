"use client";

import { useState, useTransition } from "react";
import { createCounselorAccounts, type CounselorCreateResult } from "@/app/actions/counselors";

function parseRows(text: string): { fullName: string; email: string; role: "counselor" | "manager" | "accounts" }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      // Accepts "Name, email", "Name, email, manager", "Name, email, accounts", or just "email" per line.
      const parts = line.split(",").map((p) => p.trim());
      const roleFlag = parts[2]?.toLowerCase();
      const role: "counselor" | "manager" | "accounts" = roleFlag === "manager" ? "manager" : roleFlag === "accounts" ? "accounts" : "counselor";
      if (parts.length >= 2) return { fullName: parts[0], email: parts[1], role };
      return { fullName: "", email: parts[0], role: "counselor" };
    });
}

export default function BulkCreateCounselorsForm() {
  const [text, setText] = useState("");
  const [results, setResults] = useState<CounselorCreateResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [pending, startTransition] = useTransition();

  const rows = parseRows(text);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResults(null);
    if (!rows.length) {
      setError("Add at least one line with an email.");
      return;
    }
    startTransition(async () => {
      const res = await createCounselorAccounts(rows);
      if (res?.error) setError(res.error);
      else {
        setResults(res?.results || []);
        setText("");
      }
    });
  }

  function credentialsText(rs: CounselorCreateResult[]) {
    return rs
      .filter((r) => r.password)
      .map((r) => `${r.fullName || r.email}\nEmail: ${r.email}\nPassword: ${r.password}\n`)
      .join("\n");
  }

  async function copyAll() {
    if (!results) return;
    try {
      await navigator.clipboard.writeText(credentialsText(results));
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      /* clipboard may be unavailable — the table below still shows everything to copy by hand */
    }
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <form onSubmit={handleSubmit} className="stack" style={{ gap: 14 }}>
        <div className="field">
          <label>Counselors (one per line)</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Kiran, kiran@scubus.com\nPriya, priya@scubus.com, manager\nAccounts, accounts@scubus.com, accounts"}
            rows={5}
            style={{ width: "100%", fontFamily: "inherit", fontSize: 14, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)" }}
          />
          <div className="comp-hint">
            "Name, email" per line, or just an email on its own. Add ", manager" to create a manager, or ", accounts"
            to create an accounts login that can find and update any admission's fees and payments (but can't delete
            admissions or manage other logins). {rows.length > 0 ? `${rows.length} account${rows.length === 1 ? "" : "s"} ready.` : ""}
          </div>
        </div>
        {error && <div className="error-text">{error}</div>}
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Creating accounts…" : `Create account${rows.length === 1 ? "" : "s"}`}
        </button>
        <p className="comp-hint">
          Creates each login directly with a generated password — no email is sent. Copy the password shown below and
          share it with that counselor yourself. Requires <code>SUPABASE_SERVICE_ROLE_KEY</code> to be set on the
          server (see the README); without it this will show an error explaining what's missing.
        </p>
      </form>

      {results && results.length > 0 && (
        <div className="card" style={{ background: "var(--bg)" }}>
          <div className="card-head">
            <h2 className="card-title" style={{ fontSize: 16 }}>New logins — share these with each counselor</h2>
          </div>
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Password</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.email}>
                  <td>{r.fullName || "—"}</td>
                  <td>{r.email}</td>
                  <td>
                    {r.password ? <code>{r.password}</code> : <span className="error-text">{r.error || "Failed"}</span>}
                  </td>
                  <td>
                    {r.password && (
                      <button type="button" className="reset-btn" onClick={() => navigator.clipboard?.writeText(`${r.email} / ${r.password}`)}>
                        Copy
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="btn secondary small" style={{ marginTop: 12 }} onClick={copyAll}>
            {copiedAll ? "Copied!" : "Copy all credentials"}
          </button>
          <div className="comp-hint" style={{ marginTop: 8 }}>
            These passwords are shown once — they aren't stored anywhere retrievable, so copy them now. A counselor
            can change theirs after logging in.
          </div>
        </div>
      )}
    </div>
  );
}
