"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import CalculatorForm from "@/components/CalculatorForm";
import type { Batch } from "@/lib/fee-calc";
import type { CustomFieldDef } from "@/lib/custom-fields";

export default function EditAdmissionClient({
  admission,
  batches,
  counselorId,
  fieldDefs = [],
  canEditFees = true
}: {
  admission: any;
  batches: Batch[];
  counselorId: string;
  fieldDefs?: CustomFieldDef[];
  canEditFees?: boolean;
}) {
  const router = useRouter();

  return (
    <>
      <Link href={`/admissions/${admission.id}`} className="comp-hint">
        &larr; Back to summary
      </Link>
      <div style={{ height: 8 }} />
      <p className="lede">
        Editing <strong>{admission.student_name}</strong>&rsquo;s admission. Changes are saved directly to their
        record &mdash; the installment schedule and totals recalculate automatically.
      </p>
      <CalculatorForm
        batches={batches}
        counselorId={counselorId}
        mode="edit"
        admissionId={admission.id}
        initial={admission}
        fieldDefs={fieldDefs}
        canEditFees={canEditFees}
        onSaved={() => {
          router.push(`/admissions/${admission.id}`);
          router.refresh();
        }}
      />
    </>
  );
}
