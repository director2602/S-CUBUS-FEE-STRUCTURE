"use client";

import { useState } from "react";

type StudentRow = {
  id: string;
  scid: string | null;
  student_name: string;
  admission_date: string | null;
  batch_label: string;
  eff_scholarship_pct: number;
  scholarship_amount: number;
  additional_discount: number;
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}

export default function CounselorStudentsList({ students }: { students: StudentRow[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="reset-btn" onClick={() => setOpen((v) => !v)} disabled={students.length === 0}>
        {students.length === 0 ? "No students yet" : open ? "Hide students" : `View students (${students.length})`}
      </button>
      {open && (
        <div style={{ marginTop: 10, overflowX: "auto" }}>
          <table className="data" style={{ minWidth: 560 }}>
            <thead>
              <tr>
                <th>Student</th>
                <th>Batch</th>
                <th>Admitted</th>
                <th style={{ textAlign: "right" }}>Scholarship</th>
                <th style={{ textAlign: "right" }}>Additional discount</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{s.student_name}</div>
                    <div className="comp-hint">{s.scid || "—"}</div>
                  </td>
                  <td>{s.batch_label}</td>
                  <td>{fmtDate(s.admission_date)}</td>
                  <td className="amt">
                    {s.eff_scholarship_pct ? `${s.eff_scholarship_pct}%` : "—"}
                  </td>
                  <td className="amt">{s.additional_discount ? s.additional_discount.toLocaleString("en-IN") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
