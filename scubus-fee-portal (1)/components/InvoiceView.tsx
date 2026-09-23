"use client";

import Link from "next/link";
import { formatINR } from "@/lib/fee-calc";

function fmtDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}

export default function InvoiceView({ admission }: { admission: any }) {
  const invoiceNo = `SC-${admission.id.slice(0, 8).toUpperCase()}`;

  return (
    <>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Link href={`/admissions/${admission.id}`} className="comp-hint">
          &larr; Back to summary
        </Link>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href={`/admissions/${admission.id}/edit`} className="btn secondary small">
            Edit details
          </Link>
          <button className="btn small" onClick={() => window.print()}>
            Print invoice
          </button>
        </div>
      </div>

      <div className="invoice-sheet card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img src="/logo.png" alt="S-CUBUS" style={{ height: 56, width: "auto" }} />
            <div>
              <div className="serif" style={{ fontSize: 20, fontWeight: 600 }}>
                S-CUBUS
              </div>
              <div className="comp-hint">Admission Fee Invoice</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>Invoice No.</div>
            <div style={{ fontWeight: 700 }}>{invoiceNo}</div>
            <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 6 }}>Date</div>
            <div>{fmtDate(admission.created_at)}</div>
          </div>
        </div>

        <div style={{ height: 1, background: "var(--line)", margin: "0 0 20px" }} />

        <div className="field-grid" style={{ marginBottom: 24 }}>
          <div>
            <div className="comp-hint">Student</div>
            <div style={{ fontWeight: 600 }}>{admission.student_name}</div>
          </div>
          <div>
            <div className="comp-hint">SCID</div>
            <div>{admission.scid || "—"}</div>
          </div>
          <div>
            <div className="comp-hint">Parent / Guardian</div>
            <div>
              {admission.mother_name || "—"} / {admission.father_name || "—"}
            </div>
          </div>
          <div>
            <div className="comp-hint">Contact</div>
            <div>
              {admission.phone1 || "—"}
              {admission.phone2 ? ` / ${admission.phone2}` : ""}
            </div>
          </div>
          <div>
            <div className="comp-hint">Batch</div>
            <div style={{ fontWeight: 600 }}>{admission.batch_label}</div>
          </div>
          <div>
            <div className="comp-hint">Batch commencement</div>
            <div>{fmtDate(admission.batch_commencement_date)}</div>
          </div>
        </div>

        <table className="data" style={{ marginBottom: 20 }}>
          <thead>
            <tr>
              <th>Fee component</th>
              <th style={{ textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Registration fee</td>
              <td className="amt">{formatINR(admission.reg_fee)}</td>
            </tr>
            <tr>
              <td>Tuition fee</td>
              <td className="amt">{formatINR(admission.tuition_fee)}</td>
            </tr>
            <tr>
              <td>Kit fee (module + technology + uniform)</td>
              <td className="amt">{formatINR(admission.kit_fee)}</td>
            </tr>
            <tr>
              <td>
                <strong>Gross fee</strong>
              </td>
              <td className="amt">
                <strong>{formatINR(admission.gross_fee)}</strong>
              </td>
            </tr>
            <tr>
              <td>Scholarship ({admission.eff_scholarship_pct}% of tuition)</td>
              <td className="amt">&minus; {formatINR(admission.scholarship_amount)}</td>
            </tr>
            <tr>
              <td>Net payable (excl. GST)</td>
              <td className="amt">{formatINR(admission.net_excl_gst)}</td>
            </tr>
            <tr>
              <td>GST @ {admission.gst_rate}%</td>
              <td className="amt">+ {formatINR(admission.gst_amount)}</td>
            </tr>
            <tr>
              <td>Additional discount</td>
              <td className="amt">&minus; {formatINR(admission.additional_discount)}</td>
            </tr>
            <tr>
              <td>
                <strong>Actual fee payable</strong>
              </td>
              <td className="amt">
                <strong>{formatINR(admission.actual_payable)}</strong>
              </td>
            </tr>
            <tr>
              <td>Fees paid so far{admission.payments_count > 0 ? ` (${admission.payments_count} installment${admission.payments_count === 1 ? "" : "s"} logged)` : ""}</td>
              <td className="amt">{formatINR(admission.total_paid)}</td>
            </tr>
            <tr>
              <td>
                <strong>Net outstanding</strong>
              </td>
              <td className="amt">
                <strong>{formatINR(Math.max(admission.outstanding, 0))}</strong>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="card-head" style={{ marginTop: 8 }}>
          <h3 className="card-title" style={{ fontSize: 15 }}>
            Installment Schedule
          </h3>
        </div>
        <table className="data" style={{ marginBottom: 8 }}>
          <thead>
            <tr>
              <th>Stage</th>
              <th style={{ textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>On registration</td>
              <td className="amt">{formatINR(admission.inst0)}</td>
            </tr>
            <tr>
              <td>1st &mdash; before batch commencement</td>
              <td className="amt">{formatINR(admission.inst1)}</td>
            </tr>
            <tr>
              <td>2nd &mdash; by the 20th of month 2</td>
              <td className="amt">{formatINR(admission.inst2)}</td>
            </tr>
            <tr>
              <td>3rd &mdash; by the 20th of month 4</td>
              <td className="amt">{formatINR(admission.inst3)}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div className="comp-hint">
            Billing status: <strong style={{ color: "var(--ink)" }}>{admission.billing_status}</strong>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ borderTop: "1px solid var(--line)", width: 180, marginBottom: 6 }} />
            <div className="comp-hint">Authorized signatory</div>
          </div>
        </div>
      </div>
    </>
  );
}
