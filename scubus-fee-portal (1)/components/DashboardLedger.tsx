"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { BATCH_GROUP_ORDER, formatINR } from "@/lib/fee-calc";

type Row = {
  id: string;
  scid: string | null;
  student_name: string;
  mother_name: string | null;
  father_name: string | null;
  email: string | null;
  phone1: string | null;
  phone2: string | null;
  admission_date: string | null;
  batch_commencement_date: string | null;
  batch_key: string;
  counselor_id: string;
  batch_label: string;
  batch_group: string;
  reg_fee: number;
  tuition_fee: number;
  kit_fee: number;
  eff_scholarship_pct: number;
  gross_fee: number;
  scholarship_amount: number;
  gst_rate: number;
  gst_amount: number;
  net_incl_gst: number;
  additional_discount: number;
  actual_payable: number;
  total_paid: number;
  outstanding: number;
  billing_status: "Paid in Full" | "Unpaid" | "Partially Paid";
  inst0: number;
  inst1: number;
  inst2: number;
  inst3: number;
  payments_count: number;
  last_payment_on: string | null;
  mode_reg: string | null;
  mode1: string | null;
  mode2: string | null;
  mode3: string | null;
  pdc1: string | null;
  pdc2: string | null;
  remarks: string | null;
  signed_by_name: string | null;
  signed_at: string | null;
  pdf_path: string | null;
  created_at: string;
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
    "Student", "SCID", "Counselor", "Batch", "Group", "Admission date",
    "Gross fee", "Scholarship %", "GST %", "Actual payable", "Total paid", "Outstanding", "Status",
    "Last payment", "Payments logged", "Phone", "Email"
  ];
  const lines = [cols.join(",")];
  for (const r of rows) {
    const vals = [
      r.student_name, r.scid || "", counselorNames.get(r.counselor_id) || "Unassigned", r.batch_label, r.batch_group,
      r.admission_date || "", r.gross_fee, r.eff_scholarship_pct, r.gst_rate, r.actual_payable, r.total_paid,
      Math.max(0, r.outstanding), r.billing_status, r.last_payment_on || "", r.payments_count, r.phone1 || "", r.email || ""
    ];
    lines.push(vals.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  }
  return lines.join("\n");
}

export default function DashboardLedger({ rows, counselors }: { rows: Row[]; counselors: { id: string; name: string }[] }) {
  const counselorNames = useMemo(() => new Map(counselors.map((c) => [c.id, c.name])), [counselors]);

  const [counselorFilter, setCounselorFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState<keyof Row>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (counselorFilter !== "all" && r.counselor_id !== counselorFilter) return false;
      if (groupFilter !== "all" && r.batch_group !== groupFilter) return false;
      if (statusFilter !== "all" && r.billing_status !== statusFilter) return false;
      if (dateFrom && (!r.admission_date || r.admission_date < dateFrom)) return false;
      if (dateTo && (!r.admission_date || r.admission_date > dateTo)) return false;
      if (q) {
        const hay = `${r.student_name} ${r.scid || ""} ${r.phone1 || ""} ${r.phone2 || ""} ${r.email || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    out = out.sort((a, b) => {
      const av = a[sortKey] as any;
      const bv = b[sortKey] as any;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return out;
  }, [rows, counselorFilter, groupFilter, statusFilter, query, dateFrom, dateTo, sortKey, sortDir]);

  const selectedRows = useMemo(() => filtered.filter((r) => selected.has(r.id)), [filtered, selected]);
  const summaryRows = selectedRows.length > 0 ? selectedRows : filtered;

  const summary = useMemo(
    () =>
      summaryRows.reduce(
        (acc, r) => {
          acc.count += 1;
          acc.payable += Number(r.actual_payable || 0);
          acc.paid += Number(r.total_paid || 0);
          acc.outstanding += Math.max(0, Number(r.outstanding || 0));
          return acc;
        },
        { count: 0, payable: 0, paid: 0, outstanding: 0 }
      ),
    [summaryRows]
  );

  function toggleSort(key: keyof Row) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length && filtered.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((r) => r.id)));
    }
  }

  function toggleSelectOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearFilters() {
    setCounselorFilter("all");
    setGroupFilter("all");
    setStatusFilter("all");
    setQuery("");
    setDateFrom("");
    setDateTo("");
  }

  function handleExport() {
    const csv = toCSV(selectedRows.length > 0 ? selectedRows : filtered, counselorNames);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scubus-admissions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const th = (label: string, key: keyof Row, align: "left" | "right" = "left") => (
    <th style={{ textAlign: align, cursor: "pointer" }} onClick={() => toggleSort(key)}>
      {label}
      {sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );

  return (
    <div className="card">
      <div className="card-head">
        <span className="kicker">Full Detail</span>
        <h2 className="card-title">Every Admission, Filterable by Counselor</h2>
      </div>

      <div className="field-grid" style={{ marginBottom: 14, gridTemplateColumns: "1.3fr 1fr 1fr 1fr 1fr" }}>
        <div className="field">
          <label>Search</label>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Student, SCID, phone, email" />
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
          <label>Billing status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="Paid in Full">Paid in Full</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Unpaid">Unpaid</option>
          </select>
        </div>
        <div className="field">
          <label>Admission date</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="reset-btn" onClick={clearFilters}>
            Clear filters
          </button>
          {selected.size > 0 && (
            <button className="reset-btn" onClick={() => setSelected(new Set())}>
              Clear selection ({selected.size})
            </button>
          )}
        </div>
        <button className="btn secondary small" onClick={handleExport} disabled={filtered.length === 0}>
          Export {selected.size > 0 ? "selected" : "filtered"} to CSV
        </button>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 18, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <div className="kpi">
          <div className="kpi-label">{selected.size > 0 ? "Selected" : "Showing"}</div>
          <div className="kpi-val">{summary.count}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Payable</div>
          <div className="kpi-val" style={{ fontSize: 20 }}>
            {formatINR(summary.payable)}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Paid</div>
          <div className="kpi-val" style={{ fontSize: 20 }}>
            {formatINR(summary.paid)}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Outstanding</div>
          <div className="kpi-val" style={{ fontSize: 20 }}>
            {formatINR(summary.outstanding)}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="comp-hint">No admissions match these filters.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="data" style={{ minWidth: 980 }}>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                {th("Student", "student_name")}
                {th("Counselor", "counselor_id")}
                {th("Batch", "batch_label")}
                {th("Admitted", "admission_date")}
                {th("Payable", "actual_payable", "right")}
                {th("Paid", "total_paid", "right")}
                {th("Outstanding", "outstanding", "right")}
                {th("Status", "billing_status")}
                {th("Last payment", "last_payment_on")}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <Fragment key={r.id}>
                  <tr>
                    <td>
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelectOne(r.id)} />
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.student_name}</div>
                      <div className="comp-hint">{r.scid || "—"}</div>
                    </td>
                    <td>{counselorNames.get(r.counselor_id) || "Unassigned"}</td>
                    <td>{r.batch_label}</td>
                    <td>{fmtDate(r.admission_date)}</td>
                    <td className="amt">{formatINR(r.actual_payable)}</td>
                    <td className="amt">{formatINR(r.total_paid)}</td>
                    <td className="amt">{formatINR(Math.max(0, r.outstanding))}</td>
                    <td>
                      <span
                        className={`badge ${r.billing_status === "Paid in Full" ? "good" : r.billing_status === "Unpaid" ? "bad" : "warn"}`}
                      >
                        {r.billing_status}
                      </span>
                    </td>
                    <td>{fmtDate(r.last_payment_on)}</td>
                    <td>
                      <button className="reset-btn" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                        {expandedId === r.id ? "Hide" : "Details"}
                      </button>
                    </td>
                  </tr>
                  {expandedId === r.id && (
                    <tr>
                      <td colSpan={11} style={{ background: "#fbfaf6" }}>
                        <div className="field-grid" style={{ margin: "10px 4px" }}>
                          <div>
                            <div className="comp-hint">Parent / guardian</div>
                            <div>{r.mother_name || "—"} / {r.father_name || "—"}</div>
                          </div>
                          <div>
                            <div className="comp-hint">Contact</div>
                            <div>{r.phone1 || "—"} {r.phone2 ? `/ ${r.phone2}` : ""} {r.email ? `· ${r.email}` : ""}</div>
                          </div>
                          <div>
                            <div className="comp-hint">Batch commencement</div>
                            <div>{fmtDate(r.batch_commencement_date)}</div>
                          </div>
                          <div>
                            <div className="comp-hint">Fee components</div>
                            <div>Reg {formatINR(r.reg_fee)} · Tuition {formatINR(r.tuition_fee)} · Kit {formatINR(r.kit_fee)}</div>
                          </div>
                          <div>
                            <div className="comp-hint">Scholarship / GST</div>
                            <div>{r.eff_scholarship_pct}% scholarship · GST {r.gst_rate}% ({formatINR(r.gst_amount)}) · discount {formatINR(r.additional_discount)}</div>
                          </div>
                          <div>
                            <div className="comp-hint">Installment schedule</div>
                            <div>
                              Reg {formatINR(r.inst0)} · I1 {formatINR(r.inst1)} · I2 {formatINR(r.inst2)} · I3 {formatINR(r.inst3)}
                            </div>
                          </div>
                          <div>
                            <div className="comp-hint">Payment modes on file</div>
                            <div>
                              {[r.mode_reg, r.mode1, r.mode2, r.mode3].filter(Boolean).join(", ") || "—"}
                              {r.pdc1 || r.pdc2 ? ` · PDC ${[r.pdc1, r.pdc2].filter(Boolean).join(", ")}` : ""}
                            </div>
                          </div>
                          <div>
                            <div className="comp-hint">Installments logged</div>
                            <div>{r.payments_count} tracked payment{r.payments_count === 1 ? "" : "s"}</div>
                          </div>
                          <div>
                            <div className="comp-hint">Signed copy</div>
                            <div>{r.pdf_path ? `Yes — ${r.signed_by_name || "signed"} on ${fmtDate(r.signed_at)}` : "Not signed yet"}</div>
                          </div>
                          {r.remarks && (
                            <div className="field full">
                              <div className="comp-hint">Remarks</div>
                              <div>{r.remarks}</div>
                            </div>
                          )}
                        </div>
                        <Link className="btn secondary small" href={`/admissions/${r.id}`} style={{ margin: "0 4px" }}>
                          Open full record &rarr;
                        </Link>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
