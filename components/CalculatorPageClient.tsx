"use client";

import { useState } from "react";
import CalculatorForm from "@/components/CalculatorForm";
import AdmissionsList from "@/components/AdmissionsList";
import type { Batch } from "@/lib/fee-calc";

export default function CalculatorPageClient({
  batches,
  counselorId,
  isOwner
}: {
  batches: Batch[];
  counselorId: string;
  isOwner: boolean;
}) {
  const [reloadToken, setReloadToken] = useState(0);

  return (
    <>
      <p className="lede">
        Select a batch to pull its fee components, apply the scholarship and any additional discount, and save the
        admission &mdash; replacing the per-counselor copies of the old sheet with one shared, always-current tool.
      </p>
      <CalculatorForm batches={batches} counselorId={counselorId} onSaved={() => setReloadToken((n) => n + 1)} />
      <div style={{ height: 32 }} />
      <AdmissionsList isOwner={isOwner} reloadToken={reloadToken} />
    </>
  );
}
