"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import CalculatorForm from "@/components/CalculatorForm";
import type { Batch } from "@/lib/fee-calc";

export default function EditAdmissionClient({
  admission,
  batches,
  counselorId
}: {
  admission: any;
  batches: Batch[];
  counselorId: string;
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
        onSaved={() => {
          router.push(`/admissions/${admission.id}`);
          router.refresh();
        }}
      />
    </>
  );
}
