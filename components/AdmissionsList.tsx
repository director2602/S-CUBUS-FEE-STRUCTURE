"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatINR } from "@/lib/fee-calc";

type Row = {
  id: string;
  student_name: string;
  batch_label: string;
  actual_payable: number;
  outstanding: number;
  billing_status: "Paid in Full" | "Unpaid" | "Partially Paid";
  created_at: string;
  pdf_path: string | null;
};

export default function AdmissionsList({ isOwner, reloadToken }: { isOwner: boolean; reloadToken: number }) {
  const supabase = supabaseBrowser();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from("admissions_computed")
      .select("id, student_name, batch_label, actual_payable, outstanding, billing_status, created_at, pdf_path")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (!cancelled) {
          setRows((data as Row[]) || []);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadToken]);

  return (
    <div className="card">
      <div className="card-head">
        <span className="kicker">07</span>
        <h2 className="card-title">{isOwner ? "All Admissions" : "My Admissions"}</h2>
      </div>
      {loading ? (
        <p className="comp-hint">Loading&hellip;</p>
      ) : rows.length === 0 ? (
        <p className="comp-hint">No admissions saved yet. Fill in the calculator above and save one.</p>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>Student</th>
              <th>Batch</th>
              <th style={{ textAlign: "right" }}>Payable</th>
              <th style={{ textAlign: "right" }}>Outstanding</th>
              <th>Status</th>
              <th>Receipt</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.student_name}</td>
                <td>{r.batch_label}</td>
                <td className="amt">{formatINR(r.actual_payable)}</td>
                <td className="amt">{formatINR(r.outstanding)}</td>
                <td>
                  <span
                    className={`badge ${r.billing_status === "Paid in Full" ? "good" : r.billing_status === "Unpaid" ? "bad" : "warn"}`}
                  >
                    {r.billing_status}
                  </span>
                </td>
                <td>
                  <Link className="btn small secondary" href={`/admissions/${r.id}`}>
                    {r.pdf_path ? "View / re-sign" : "Sign & download"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
