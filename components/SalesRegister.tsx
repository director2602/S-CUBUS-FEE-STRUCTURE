"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BATCH_GROUP_ORDER, PAYMENT_MODES, formatINR, formatINR2, round2 } from "@/lib/fee-calc";

type AdmissionInfo = {
  id: string;
  scid: string | null;
  student_name: string;
  batch_label: string;
  batch_group: string;
  counselor_id: string;
  gst_rate: number;
  status: string;
};

type PaymentRow = {
  id: string;
  admission_id: string;
  installment_label: string;
  amount: number;
  card_charge_amount: number | null;
  paid_on: string;
  mode: string | null;
  invoice_no: string | null;
  note: string | null;
};

type Row = PaymentRow & {
  admission: AdmissionInfo;
  cardCharge: number;
  grandTotal: number;
  gstAmount: number;
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}

function toCSV(rows: Row[], counselorNames: Map<string, string>) {
  const cols = [
    "Invoice No", "Date", "Student", "SCID", "Batch", "Group", "Counselor", "Installment", "Mode",
    "Fee Amount", "Card Charge", "GST (CGST+SGST)", "Total Collected", "Status"
  ];
  const lines = [cols.join(",")];
  for (const r of rows) {
    const vals = [
      r.invoice_no || "", r.paid_on, r.admission.student_name, r.admission.scid || "", r.admission.batch_label,
      r.admission.batch_group, counselorNames.get(r.admission.counselor_id) || "Unassigned", r.installment_label,
      r.mode || "", r.amount, r.cardCharge, r.gstAmount, r.grandTotal, r.admission.status
    ];
    lines.push(vals.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  }
  return lines.join("\n");
}

export default function SalesRegister({
  payments,
  admissions,
  counselors
}: {
  payments: PaymentRow[];
  admissions: AdmissionInfo[];
  counselors: { id: string; name: string }[];
}) {
  const counselorNames = useMemo(() => new Map(counselors.map((c) => [c.id, c.name])), [counselors]);
  const admissionsById = useMemo(() => new Map(admissions.map((a) => [a.id, a])), [admissions]);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const p of payments) {
      const admission = admissionsById.get(p.admission_id);
      if (!admission) continue; // defensive — shouldn't happen, but never crash the register on an orphan row
      const amount = Number(p.amount || 0);
      const cardCharge = Number(p.card_charge_amount || 0);
      const grandTotal = round2(amount + cardCharge);
      const gstRate = Number(admission.gst_rate) || 0;
      const taxableTotal = gstRate > 0 ? grandTotal / (1 + gstRate / 100) : grandTotal;
      const gstAmount = round2(grandTotal - taxableTotal);
      out.push({ ...p, admission, cardCharge, grandTotal, gstAmount });
    }
    return out.sort((a, b) => (a.paid_on === b.paid_on ? (a.id < b.id ? 1 : -1) : a.paid_on < b.paid_on ? 1 : -1));
  }, [payments, admissionsById]);

  const [counselorFilter, setCounselorFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (counselorFilter !== "all" && r.admission.counselor_id !== counselorFilter) return false;
      if (groupFilter !== "all" && r.admission.batch_group !== groupFilter) return false;
      if (modeFilter !== "all" && (r.mode || "") !== modeFilter) return false;
      if (dateFrom && r.paid_on < dateFrom) return false;
      if (dateTo && r.paid_on > dateTo) return false;
      if (q) {
        const hay = `${r.admission.student_name} ${r.admission.scid || ""} ${r.invoice_no || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, counselorFilter, groupFilter, modeFilter, dateFrom, dateTo, query]);

  const totalFee = filtered.reduce((s, r) => s + r.amount, 0);
  const totalCardCharge = filtered.reduce((s, r) => s + r.cardCharge, 0);
  const totalGst = filtered.reduce((s, r) => s + r.gstAmount, 0);
  const totalCollected = filtered.reduce((s, r) => s + r.grandTotal, 0);

  function downloadCSV() {
    const csv = toCSV(filtered, counselorNames);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-register-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <div className="kpi">
          <div className="kpi-label">Invoices (filtered)</div>
          <div className="kpi-val">{filtered.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Fee collected</div>
          <div className="kpi-val">{formatINR(totalFee)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Card charges collected</div>
          <div className="kpi-val">{formatINR(totalCardCharge)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">GST collected (CGST+SGST)</div>
          <div className="kpi-val">{formatINR(totalGst)}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <span className="kicker">Total</span>
          <h2 className="card-title">Grand total collected (filtered rows)</h2>
        </div>
        <div className="kpi-val" style={{ fontSize: 28 }}>{formatINR(totalCollected)}</div>
        <p className="comp-hint" style={{ marginTop: 6 }}>
          Fee + card/POS convenience charges, for every row the filters below currently match &mdash; this is what
          actually landed in the bank, not just what's billed as tuition.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <span className="kicker">Filter</span>
          <h2 className="card-title">Sales Register</h2>
        </div>
        <p className="comp-hint" style={{ marginBottom: 14 }}>
          Every invoice issued company-wide, one row per payment logged on any admission &mdash; the running
          accounting record of sales, independent of each student's own page.
        </p>

        <div className="field-grid" style={{ marginBottom: 16 }}>
          <div className="field">
            <label>Search (student, SCID, invoice no.)</label>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Sanna, SC2627-0142" />
          </div>
          <div className="field">
            <label>Counselor</label>
            <select value={counselorFilter} onChange={(e) => setCounselorFilter(e.target.value)}>
              <option value="all">All counselors</option>
              {counselors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Batch group</label>
            <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
              <option value="all">All groups</option>
              {BATCH_GROUP_ORDER.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Payment mode</label>
            <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
              <option value="all">All modes</option>
              {PAYMENT_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>From date</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="field">
            <label>To date</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        <button className="btn secondary small" onClick={downloadCSV} disabled={filtered.length === 0}>
          Export filtered as CSV
        </button>
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <p className="comp-hint">No invoices match these filters.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Date</th>
                  <th>Student</th>
                  <th>Batch</th>
                  <th>Counselor</th>
                  <th>Installment</th>
                  <th>Mode</th>
                  <th style={{ textAlign: "right" }}>Fee</th>
                  <th style={{ textAlign: "right" }}>Card chg.</th>
                  <th style={{ textAlign: "right" }}>GST</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link className="reset-btn" href={`/admissions/${r.admission_id}/invoice?payment=${r.id}`}>
                        {r.invoice_no || "—"}
                      </Link>
                    </td>
                    <td>{fmtDate(r.paid_on)}</td>
                    <td>
                      {r.admission.student_name}
                      <div className="comp-hint">{r.admission.scid || "—"}</div>
                    </td>
                    <td>{r.admission.batch_label}</td>
                    <td>{counselorNames.get(r.admission.counselor_id) || "Unassigned"}</td>
                    <td>{r.installment_label}</td>
                    <td>{r.mode || "—"}</td>
                    <td className="amt">{formatINR2(r.amount)}</td>
                    <td className="amt">{r.cardCharge > 0 ? formatINR2(r.cardCharge) : "—"}</td>
                    <td className="amt">{formatINR2(r.gstAmount)}</td>
                    <td className="amt">
                      <strong>{formatINR2(r.grandTotal)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={7}>
                    <strong>Total ({filtered.length} invoices)</strong>
                  </td>
                  <td className="amt">
                    <strong>{formatINR2(totalFee)}</strong>
                  </td>
                  <td className="amt">
                    <strong>{formatINR2(totalCardCharge)}</strong>
                  </td>
                  <td className="amt">
                    <strong>{formatINR2(totalGst)}</strong>
                  </td>
                  <td className="amt">
                    <strong>{formatINR2(totalCollected)}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
