"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatINR } from "@/lib/fee-calc";

type Row = {
  id: string;
  scid: string | null;
  student_name: string;
  batch_label: string;
  actual_payable?: number;
  total_paid?: number;
  outstanding?: number;
  billing_status?: "Paid in Full" | "Unpaid" | "Partially Paid";
  created_at: string;
  pdf_path: string | null;
};

const BASE_COLS = "id, scid, student_name, batch_label, created_at, pdf_path";
const AMOUNT_COLS = "actual_payable, total_paid, outstanding";
const STATUS_COL = "billing_status";

export default function AdmissionsList({
  isOwner,
  allAdmissions,
  reloadToken,
  role
}: {
  isOwner: boolean;
  allAdmissions?: boolean;
  reloadToken: number;
  // Counselors see a directory only — fee/payment figures stay on the individual
  // student's own page (calculator edit / payments screen), not in this shared list.
  role?: string;
}) {
  const supabase = supabaseBrowser();
  // Payable/Outstanding stay owner & accounts only — managers see their team's roster and
  // billing status, but not the rupee figures; counselors see neither figures nor status.
  const canSeeAmounts = role === "owner" || role === "accounts";
  const canSeeStatus = role !== "counselor";
  const SELECT_COLS = [BASE_COLS, canSeeAmounts && AMOUNT_COLS, canSeeStatus && STATUS_COL].filter(Boolean).join(", ");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const term = query.trim();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(
      async () => {
        if (!term) {
          const { data } = await supabase
            .from("admissions_computed")
            .select(SELECT_COLS)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(50);
          if (!cancelled) {
            setRows((data as unknown as Row[]) || []);
            setLoading(false);
          }
          return;
        }
        // Two separate ilike queries (name, SCID) merged & deduped — avoids any ambiguity
        // in how `%`/`,` need escaping inside a combined .or() filter string. Refunded
        // admissions are excluded here too — this list drives "update payments" / revenue
        // workflows, not a historical lookup.
        const pattern = `%${term}%`;
        const [byName, byScid] = await Promise.all([
          supabase.from("admissions_computed").select(SELECT_COLS).eq("status", "active").ilike("student_name", pattern).order("created_at", { ascending: false }).limit(25),
          supabase.from("admissions_computed").select(SELECT_COLS).eq("status", "active").ilike("scid", pattern).order("created_at", { ascending: false }).limit(25)
        ]);
        if (cancelled) return;
        const merged = new Map<string, Row>();
        [...((byName.data as unknown as Row[]) || []), ...((byScid.data as unknown as Row[]) || [])].forEach((r) => merged.set(r.id, r));
        setRows([...merged.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)));
        setLoading(false);
      },
      term ? 300 : 0
    );
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadToken, term]);

  async function handleDelete(r: Row) {
    const ok = window.confirm(
      `Delete ${r.student_name}${r.scid ? ` (SCID ${r.scid})` : ""} and every payment recorded for them?\n\nThis permanently removes their admission record, fee breakdown and payment history — it cannot be undone.`
    );
    if (!ok) return;
    setDeletingId(r.id);
    setDeleteError(null);
    if (r.pdf_path) {
      // Best-effort cleanup of the saved PDF copy — don't block the delete if this fails.
      await supabase.storage.from("fee-receipts").remove([r.pdf_path]).catch(() => {});
    }
    const { error } = await supabase.from("admissions").delete().eq("id", r.id);
    setDeletingId(null);
    if (error) {
      setDeleteError(error.message);
      return;
    }
    setRows((prev) => prev.filter((row) => row.id !== r.id));
  }

  return (
    <div className="card">
      <div className="card-head">
        <span className="kicker">07</span>
        <h2 className="card-title">{isOwner || allAdmissions ? "All Admissions" : "My Admissions"}</h2>
      </div>

      <div className="field" style={{ marginBottom: 16 }}>
        <label>Find a student to update payments</label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by student name or SCID…"
        />
      </div>

      {deleteError && <div className="error-text" style={{ marginBottom: 12 }}>{deleteError}</div>}

      {loading ? (
        <p className="comp-hint">Loading&hellip;</p>
      ) : rows.length === 0 ? (
        <p className="comp-hint">
          {term ? `No admissions match "${term}".` : "No admissions saved yet. Fill in the calculator above and save one."}
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="data" style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th>Student</th>
                <th>SCID</th>
                <th>Batch</th>
                {canSeeAmounts && (
                  <>
                    <th style={{ textAlign: "right" }}>Payable</th>
                    <th style={{ textAlign: "right" }}>Outstanding</th>
                  </>
                )}
                {canSeeStatus && <th>Status</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.student_name}</td>
                  <td>{r.scid || "—"}</td>
                  <td>{r.batch_label}</td>
                  {canSeeAmounts && (
                    <>
                      <td className="amt">{formatINR(r.actual_payable || 0)}</td>
                      <td className="amt">{formatINR(r.outstanding || 0)}</td>
                    </>
                  )}
                  {canSeeStatus && (
                    <td>
                      <span
                        className={`badge ${r.billing_status === "Paid in Full" ? "good" : r.billing_status === "Unpaid" ? "bad" : "warn"}`}
                      >
                        {r.billing_status}
                      </span>
                    </td>
                  )}
                  <td>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Link className="btn small" href={`/admissions/${r.id}#payments`}>
                        Update payments
                      </Link>
                      <Link className="btn small secondary" href={`/admissions/${r.id}/edit`}>
                        Edit
                      </Link>
                      <Link className="btn small secondary" href={`/admissions/${r.id}/invoice`}>
                        Print invoice
                      </Link>
                      <Link className="btn small secondary" href={`/admissions/${r.id}/summary`}>
                        Fee summary
                      </Link>
                      <Link className="btn small secondary" href={`/admissions/${r.id}`}>
                        {r.pdf_path ? "View / re-sign" : "Sign & download"}
                      </Link>
                      {isOwner && (
                        <button
                          className="reset-btn"
                          style={{ color: "var(--bad-fg)" }}
                          disabled={deletingId === r.id}
                          onClick={() => handleDelete(r)}
                        >
                          {deletingId === r.id ? "Deleting…" : "Delete"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
