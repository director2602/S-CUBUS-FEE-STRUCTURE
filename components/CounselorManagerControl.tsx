"use client";

import { useTransition } from "react";
import { assignManager } from "@/app/actions/counselors";

export default function CounselorManagerControl({
  counselorId,
  managerId,
  managers
}: {
  counselorId: string;
  managerId: string | null;
  managers: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value || null;
    startTransition(async () => {
      await assignManager(counselorId, value);
    });
  }

  return (
    <select value={managerId || ""} onChange={handleChange} disabled={pending} style={{ fontSize: 13, padding: "4px 8px" }}>
      <option value="">— Unassigned —</option>
      {managers.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}
