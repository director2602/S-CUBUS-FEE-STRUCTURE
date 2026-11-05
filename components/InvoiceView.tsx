"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { type Payment } from "@/lib/fee-calc";
import InvoiceSheet from "@/components/InvoiceSheet";

function fmtDateSlash(d: string | null) {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${dt.getFullYear()}`;
  } catch {
    return d;
  }
}

export default function InvoiceView({
  admission,
  payments,
  initialPaymentId,
  counselorName
}: {
  admission: any;
  payments: Payment[];
  initialPaymentId?: string;
  counselorName?: string | null;
}) {
  // Chronological order (oldest first) so "amount already paid before this one" can be
  // worked out for any payment, not just the latest.
  const sorted = useMemo(
    () => [...payments].sort((a, b) => (a.paid_on === b.paid_on ? (a.created_at < b.created_at ? -1 : 1) : a.paid_on < b.paid_on ? -1 : 1)),
    [payments]
  );
  const initialId = (initialPaymentId && sorted.some((p) => p.id === initialPaymentId) ? initialPaymentId : null) ?? (sorted.length ? sorted[sorted.length - 1].id : null);
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const idx = sorted.findIndex((p) => p.id === selectedId);
  const selected = idx >= 0 ? sorted[idx] : null;

  if (!selected) {
    return (
      <div className="invoice-sheet">
        <div className="no-print" style={{ marginBottom: 16 }}>
          <Link href={`/admissions/${admission.id}`} className="comp-hint">
            &larr; Back to summary
          </Link>
        </div>
        <p className="comp-hint">
          No payments have been logged for {admission.student_name} yet — a tax invoice is generated per payment.
          Record a payment on the admission page, then come back here to print its invoice.
        </p>
      </div>
    );
  }

  const paidBefore = admission.actual_fees_paid + sorted.slice(0, idx).reduce((s, p) => s + Number(p.amount), 0);

  return (
    <>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <Link href={`/admissions/${admission.id}`} className="comp-hint">
          &larr; Back to summary
        </Link>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {sorted.length > 1 && (
            <select value={selectedId || ""} onChange={(e) => setSelectedId(e.target.value)} className="reset-btn" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "9px 10px" }}>
              {sorted.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.invoice_no || "—"} &middot; {p.installment_label} &middot; {fmtDateSlash(p.paid_on)}
                </option>
              ))}
            </select>
          )}
          <Link href={`/admissions/${admission.id}/summary`} className="btn secondary small">
            Fee summary
          </Link>
          <button className="btn small" onClick={() => window.print()}>
            Print invoice
          </button>
        </div>
      </div>

      <InvoiceSheet admission={admission} selected={selected} paidBefore={paidBefore} counselorName={counselorName} />
    </>
  );
}
