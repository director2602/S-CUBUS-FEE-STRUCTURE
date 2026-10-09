"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  formatINR,
  formatINR2,
  HSN_SAC_CODE,
  installmentInvoiceDescription,
  amountInWordsINR,
  round2,
  type Payment
} from "@/lib/fee-calc";

// Mirrors the company's real Zoho tax invoice layout exactly, so a printed invoice from
// this app and one from Zoho look like they came from the same business.
const COMPANY = {
  name: "S-CUBUS CAREER PRIVATE LIMITED",
  addressLines: ["Delhi", "India"],
  gstin: "GSTIN 07ABSCS4021P1ZQ",
  phone: "91-8796101095",
  email: "scubuscareerpvtltd@gmail.com",
  placeOfSupply: "Delhi (07)"
};

const TERMS_AND_CONDITIONS =
  "At S-CUBUS Career Pvt. Ltd., we maintain a clear and student friendly refund policy to ensure smooth processing in case a student wishes to discontinue the course after admission. Refund requests will be processed as per the refund policy of the Company.";

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
  const outstandingAfter = Math.max(0, round2(admission.actual_payable - (paidBefore + Number(selected.amount))));

  const amount = Number(selected.amount);
  const gstRate = Number(admission.gst_rate) || 0;
  const halfRate = round2(gstRate / 2);
  const taxableValue = gstRate > 0 ? amount / (1 + gstRate / 100) : amount;
  const halfTax = round2(taxableValue * (halfRate / 100));

  const invoiceNo = selected.invoice_no || "—";
  const dateStr = fmtDateSlash(selected.paid_on);

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

      <div className="invoice-sheet">
        <div style={{ border: "1px solid #999", color: "#1a1a1a", fontSize: 13, background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "20px 22px 16px", borderBottom: "1px solid #999" }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: 0.2 }}>{COMPANY.name}</div>
              {COMPANY.addressLines.map((l) => (
                <div key={l}>{l}</div>
              ))}
              <div>{COMPANY.gstin}</div>
              <div>{COMPANY.phone}</div>
              <div>{COMPANY.email}</div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, whiteSpace: "nowrap" }}>TAX INVOICE</div>
          </div>

          <div style={{ display: "flex", borderBottom: "1px solid #999" }}>
            <div style={{ flex: 1, padding: "10px 22px", display: "grid", gridTemplateColumns: "90px 1fr", rowGap: 4 }}>
              <div>#</div>
              <div>: {invoiceNo}</div>
              <div>Invoice Date</div>
              <div>: {dateStr}</div>
              <div>Terms</div>
              <div>: Due on Receipt</div>
              <div>Due Date</div>
              <div>: {dateStr}</div>
            </div>
            <div style={{ flex: 1, padding: "10px 22px", borderLeft: "1px solid #999", display: "grid", gridTemplateColumns: "110px 1fr", rowGap: 4 }}>
              <div>Place Of Supply</div>
              <div>: {COMPANY.placeOfSupply}</div>
            </div>
          </div>

          <div style={{ display: "flex", borderBottom: "1px solid #999" }}>
            <div style={{ flex: 1, padding: "10px 22px" }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Bill To</div>
              <div style={{ fontWeight: 700 }}>{admission.student_name}</div>
              <div>SCID : {admission.scid || "—"}</div>
            </div>
            <div style={{ flex: 1, padding: "10px 22px", borderLeft: "1px solid #999" }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Ship To</div>
              <div style={{ fontWeight: 700 }}>{admission.student_name}</div>
              <div>SCID : {admission.scid || "—"}</div>
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#f2f2f2" }}>
                <th style={{ border: "1px solid #999", padding: "7px 8px", textAlign: "left", width: 28 }}>#</th>
                <th style={{ border: "1px solid #999", padding: "7px 8px", textAlign: "left" }}>Item &amp; Description</th>
                <th style={{ border: "1px solid #999", padding: "7px 8px", textAlign: "right", width: 60 }}>HSN/SAC</th>
                <th style={{ border: "1px solid #999", padding: "7px 8px", textAlign: "right", width: 48 }}>Qty</th>
                <th style={{ border: "1px solid #999", padding: "7px 8px", textAlign: "right", width: 80 }}>Rate</th>
                <th colSpan={2} style={{ border: "1px solid #999", padding: "7px 8px", textAlign: "center" }}>CGST</th>
                <th colSpan={2} style={{ border: "1px solid #999", padding: "7px 8px", textAlign: "center" }}>SGST</th>
                <th style={{ border: "1px solid #999", padding: "7px 8px", textAlign: "right", width: 90 }}>Amount</th>
              </tr>
              <tr style={{ background: "#f2f2f2" }}>
                <th colSpan={5} style={{ border: "1px solid #999" }} />
                <th style={{ border: "1px solid #999", padding: "4px 8px", textAlign: "right", width: 44 }}>%</th>
                <th style={{ border: "1px solid #999", padding: "4px 8px", textAlign: "right", width: 70 }}>Amt</th>
                <th style={{ border: "1px solid #999", padding: "4px 8px", textAlign: "right", width: 44 }}>%</th>
                <th style={{ border: "1px solid #999", padding: "4px 8px", textAlign: "right", width: 70 }}>Amt</th>
                <th style={{ border: "1px solid #999" }} />
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ border: "1px solid #999", padding: "8px", verticalAlign: "top" }}>1</td>
                <td style={{ border: "1px solid #999", padding: "8px", verticalAlign: "top" }}>
                  <div style={{ fontWeight: 700 }}>{admission.batch_label}</div>
                  <div style={{ color: "#555" }}>{installmentInvoiceDescription(selected.installment_label, selected.note)}</div>
                </td>
                <td style={{ border: "1px solid #999", padding: "8px", textAlign: "right", verticalAlign: "top" }}>{HSN_SAC_CODE}</td>
                <td style={{ border: "1px solid #999", padding: "8px", textAlign: "right", verticalAlign: "top" }}>1.00</td>
                <td style={{ border: "1px solid #999", padding: "8px", textAlign: "right", verticalAlign: "top" }}>{formatINR2(amount)}</td>
                <td style={{ border: "1px solid #999", padding: "8px", textAlign: "right", verticalAlign: "top" }}>{gstRate > 0 ? `${halfRate}%` : "—"}</td>
                <td style={{ border: "1px solid #999", padding: "8px", textAlign: "right", verticalAlign: "top" }}>{gstRate > 0 ? formatINR2(halfTax) : "—"}</td>
                <td style={{ border: "1px solid #999", padding: "8px", textAlign: "right", verticalAlign: "top" }}>{gstRate > 0 ? `${halfRate}%` : "—"}</td>
                <td style={{ border: "1px solid #999", padding: "8px", textAlign: "right", verticalAlign: "top" }}>{gstRate > 0 ? formatINR2(halfTax) : "—"}</td>
                <td style={{ border: "1px solid #999", padding: "8px", textAlign: "right", verticalAlign: "top", fontWeight: 600 }}>{formatINR2(amount)}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ display: "flex" }}>
            <div style={{ flex: 1.3, padding: "14px 22px", borderRight: "1px solid #999" }}>
              <div style={{ fontWeight: 700 }}>Total In Words</div>
              <div style={{ fontStyle: "italic", fontWeight: 700, marginBottom: 14 }}>{amountInWordsINR(amount)}</div>

              <div style={{ fontWeight: 700 }}>Notes</div>
              <div>
                Remaining net outstanding amount: {formatINR(outstandingAfter)} only.
                <br />
                Thanks for your business.
              </div>

              <div style={{ fontWeight: 700, marginTop: 14 }}>Terms &amp; Conditions</div>
              <div>{TERMS_AND_CONDITIONS}</div>
            </div>
            <div style={{ flex: 1, padding: "14px 22px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", rowGap: 6 }}>
                <div style={{ textAlign: "right" }}>
                  Sub Total
                  <div style={{ fontSize: 11, color: "#666" }}>(Tax Inclusive)</div>
                </div>
                <div style={{ textAlign: "right" }}>{formatINR2(amount)}</div>
                {gstRate > 0 && (
                  <>
                    <div style={{ textAlign: "right" }}>CGST{halfRate} ({halfRate}%)</div>
                    <div style={{ textAlign: "right" }}>{formatINR2(halfTax)}</div>
                    <div style={{ textAlign: "right" }}>SGST{halfRate} ({halfRate}%)</div>
                    <div style={{ textAlign: "right" }}>{formatINR2(halfTax)}</div>
                  </>
                )}
                <div style={{ textAlign: "right", fontWeight: 700, borderTop: "1px solid #999", paddingTop: 6 }}>Total</div>
                <div style={{ textAlign: "right", fontWeight: 700, borderTop: "1px solid #999", paddingTop: 6 }}>&#8377;{formatINR2(amount)}</div>
                <div style={{ textAlign: "right" }}>Payment Made</div>
                <div style={{ textAlign: "right", color: "#c0392b" }}>(-) {formatINR2(amount)}</div>
                <div style={{ textAlign: "right", fontWeight: 700 }}>Balance Due</div>
                <div style={{ textAlign: "right", fontWeight: 700 }}>&#8377;0.00</div>
              </div>
            </div>
          </div>

          <div style={{ padding: "40px 22px 22px", textAlign: "right" }}>
            <div style={{ display: "inline-block", textAlign: "center" }}>
              <div style={{ width: 200, borderTop: "1px solid #999", paddingTop: 6 }}>
                {counselorName || " "}
                <div style={{ fontSize: 11, color: "#555" }}>Authorized Signature</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
