"use client";

import { useTransition } from "react";
import { setCounselorRole } from "@/app/actions/counselors";

export default function CounselorRoleControl({ id, role }: { id: string; role: string }) {
  const [pending, startTransition] = useTransition();
  const nextRole = role === "manager" ? "counselor" : "manager";

  function handleClick() {
    startTransition(async () => {
      await setCounselorRole(id, nextRole);
    });
  }

  return (
    <button type="button" className="reset-btn" disabled={pending} onClick={handleClick}>
      {pending ? "Updating…" : role === "manager" ? "Make counselor" : "Make manager"}
    </button>
  );
}
