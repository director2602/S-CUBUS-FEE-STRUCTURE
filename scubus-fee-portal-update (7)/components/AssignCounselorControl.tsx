"use client";

import { useState, useTransition } from "react";
import { assignCounselorToAdmission } from "@/app/actions/admissions";

export default function AssignCounselorControl({
  admissionId,
  people
}: {
  admissionId: string;
  people: { id: string; name: string }[];
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleAssign() {
    if (!value) return;
    setError(null);
    startTransition(async () => {
      const res = await assignCounselorToAdmission(admissionId, value);
      if (res?.error) setError(res.error);
      else setDone(true);
    });
  }

  if (done) return <span className="success-text">Assigned</span>;

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <select value={value} onChange={(e) => setValue(e.target.value)} style={{ fontSize: 13, padding: "4px 8px" }}>
        <option value="">Pick a counselor…</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button type="button" className="btn secondary small" disabled={!value || pending} onClick={handleAssign}>
        {pending ? "Assigning…" : "Assign"}
      </button>
      {error && <span className="error-text">{error}</span>}
    </div>
  );
}
