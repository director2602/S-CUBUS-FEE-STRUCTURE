"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type AnyRow = Record<string, any>;

// Column order + human-friendly headers for the exported CSV.
// Pulled straight from admissions_computed, plus counselor name resolved separately.
const COLUMNS: { key: string; label: string }[] = [
  { key: "scid", label: "Student ID" },
  { key: "student_name", label: "Student Name" },
  { key: "mother_name", label: "Mother's Name" },
  { key: "father_name", label: "Father's Name" },
  { key: "email", label: "Email" },
  { key: "phone1", label: "Mobile 1" },
  { key: "phone2", label: "Mobile 2" },
  { key: "counselor_name", label: "Counselor" },
  { key: "admission_date", label: "Admission Date" },
  { key: "batch_key", label: "Batch Key" },
  { key: "batch_label", label: "Batch" },
  { key: "batch_group", label: "Batch Group" },
  { key: "batch_commencement_date", label: "Batch Commencement Date" },
  { key: "reg_fee", label: "Registration Fee" },
  { key: "tuition_fee", label: "Tuition Fee" },
  { key: "kit_fee", label: "Kit Fee" },
  { key: "eff_scholarship_pct", label: "Scholarship %" },
  { key: "gross_fee", label: "Gross Fee" },
  { key: "scholarship_amount", label: "Scholarship Amount" },
  { key: "additional_discount", label: "Additional Discount" },
  { key: "net_excl_gst", label: "Net Fee (excl. GST)" },
  { key: "gst_rate", label: "GST Rate %" },
  { key: "gst_amount", label: "GST Amount" },
  { key: "net_incl_gst", label: "Net Fee (incl. GST)" },
  { key: "actual_payable", label: "Actual Payable" },
  { key: "actual_fees_paid", label: "Actual Fees Paid (entered)" },
  { key: "outstanding", label: "Outstanding" },
  { key: "inst0", label: "Installment 0 (Registration)" },
  { key: "inst1", label: "Installment 1" },
  { key: "inst2", label: "Installment 2" },
  { key: "inst3", label: "Installment 3" },
  { key: "mode_reg", label: "Mode - Registration" },
  { key: "mode1", label: "Mode - Installment 1" },
  { key: "mode2", label: "Mode - Installment 2" },
  { key: "mode3", label: "Mode - Installment 3" },
  { key: "pdc1", label: "PDC 1" },
  { key: "pdc2", label: "PDC 2" },
  { key: "billing_status", label: "Billing Status" },
  { key: "payments_total", label: "Payments Received (Total)" },
  { key: "payments_count", label: "Number of Payments" },
  { key: "last_payment_on", label: "Last Payment Date" },
  { key: "total_paid", label: "Total Paid" },
  { key: "status", label: "Status" },
  { key: "refunded_at", label: "Refunded On" },
  { key: "refund_amount", label: "Refund Amount" },
  { key: "refund_note", label: "Refund Note" },
  { key: "remarks", label: "Remarks" },
  { key: "custom_fields", label: "Custom Fields (Student)" },
  { key: "batch_custom_fields", label: "Custom Fields (Batch)" },
  { key: "created_at", label: "Record Created At" },
  { key: "updated_at", label: "Record Updated At" }
];

function csvEscape(value: any): string {
  if (value === null || value === undefined) return "";
  let str: string;
  if (typeof value === "object") {
    try {
      str = JSON.stringify(value);
    } catch {
      str = String(value);
    }
  } else {
    str = String(value);
  }
  if (/[",\n\r]/.test(str)) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export default function ExportAllStudents() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCount, setLastCount] = useState<number | null>(null);

  async function handleExport() {
    setLoading(true);
    setError(null);
    try {
      const supabase = supabaseBrowser();

      const { data: admissions, error: admissionsError } = await supabase
        .from("admissions_computed")
        .select("*")
        .order("created_at", { ascending: true });

      if (admissionsError) throw admissionsError;

      const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id, full_name, email");
      if (profilesError) throw profilesError;

      const counselorNameById = new Map<string, string>();
      (profiles || []).forEach((p: AnyRow) => {
        counselorNameById.set(p.id, p.full_name || p.email || p.id);
      });

      const rows: AnyRow[] = (admissions || []).map((a: AnyRow) => ({
        ...a,
        counselor_name: a.counselor_id ? counselorNameById.get(a.counselor_id) || a.counselor_id : ""
      }));

      const headerLine = COLUMNS.map((c) => csvEscape(c.label)).join(",");
      const bodyLines = rows.map((row) => COLUMNS.map((c) => csvEscape(row[c.key])).join(","));
      const csv = [headerLine, ...bodyLines].join("\r\n");

      // UTF-8 BOM so Excel renders names/currency correctly.
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `scubus-students-export-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setLastCount(rows.length);
    } catch (err: any) {
      setError(err?.message || "Export failed — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <p className="comp-hint" style={{ marginTop: 0 }}>
        Opens directly in Excel or Google Sheets. Includes any custom fields you've added.
      </p>
      <button className="btn" onClick={handleExport} disabled={loading}>
        {loading ? "Preparing download…" : "Download all students (CSV)"}
      </button>
      {lastCount !== null && !loading && !error && (
        <p style={{ color: "#2e7d32", fontSize: 13, marginTop: 10 }}>Exported {lastCount} student record(s).</p>
      )}
      {error && <p style={{ color: "#c62828", fontSize: 13, marginTop: 10 }}>{error}</p>}
    </>
  );
}
