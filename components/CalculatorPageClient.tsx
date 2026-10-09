"use client";

import { useState } from "react";
import CalculatorForm from "@/components/CalculatorForm";
import AdmissionsList from "@/components/AdmissionsList";
import type { Batch } from "@/lib/fee-calc";
import type { CustomFieldDef } from "@/lib/custom-fields";

export default function CalculatorPageClient({
  batches,
  counselorId,
  isOwner,
  allAdmissions,
  fieldDefs = [],
  canEditFees = true
}: {
  batches: Batch[];
  counselorId: string;
  isOwner: boolean;
  allAdmissions?: boolean;
  fieldDefs?: CustomFieldDef[];
  canEditFees?: boolean;
}) {
  const [reloadToken, setReloadToken] = useState(0);

  return (
    <>
      <p className="lede">
        Select a batch to pull its fee components, apply the scholarship and any additional discount, and save the
        admission &mdash; replacing the per-counselor copies of the old sheet with one shared, always-current tool.
      </p>
      <CalculatorForm
        batches={batches}
        counselorId={counselorId}
        onSaved={() => setReloadToken((n) => n + 1)}
        fieldDefs={fieldDefs}
        canEditFees={canEditFees}
      />
      <div style={{ height: 32 }} />
      <AdmissionsList isOwner={isOwner} allAdmissions={allAdmissions} reloadToken={reloadToken} />
    </>
  );
}
