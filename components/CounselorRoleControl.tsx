"use client";

import { useTransition } from "react";
import { setCounselorRole } from "@/app/actions/counselors";

const ROLES: { value: "counselor" | "manager" | "accounts"; label: string }[] = [
  { value: "counselor", label: "Counselor" },
  { value: "manager", label: "Manager" },
  { value: "accounts", label: "Accounts" }
];

export default function CounselorRoleControl({ id, role }: { id: string; role: string }) {
  const [pending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as "counselor" | "manager" | "accounts";
    if (next === role) return;
    startTransition(async () => {
      await setCounselorRole(id, next);
    });
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <select value={role} onChange={handleChange} disabled={pending} className="reset-btn" style={{ textTransform: "capitalize" }}>
        {ROLES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      {pending && <span className="comp-hint">Updating…</span>}
    </span>
  );
}
