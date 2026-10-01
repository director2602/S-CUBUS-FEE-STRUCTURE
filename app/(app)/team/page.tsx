import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { formatINR } from "@/lib/fee-calc";
import CounselorStudentsList from "@/components/CounselorStudentsList";
import AssignCounselorControl from "@/components/AssignCounselorControl";

type Row = {
  id: string;
  scid: string | null;
  student_name: string;
  admission_date: string | null;
  batch_label: string;
  eff_scholarship_pct: number;
  scholarship_amount: number;
  additional_discount: number;
  counselor_id: string;
  actual_payable: number;
  total_paid: number;
  outstanding: number;
  created_at: string | null;
  updated_at: string | null;
  last_payment_on: string | null;
};

type CounselorStat = {
  id: string;
  name: string;
  email: string;
  role: string;
  count: number;
  payable: number;
  collected: number;
  outstanding: number;
  lastUpdate: string | null;
  students: Row[];
};

function fmtWhen(d: string | null) {
  if (!d) return "No activity yet";
  try {
    return new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return d;
  }
}

function latest(...dates: (string | null)[]) {
  let max: string | null = null;
  for (const d of dates) {
    if (!d) continue;
    if (!max || new Date(d).getTime() > new Date(max).getTime()) max = d;
  }
  return max;
}

export default async function TeamPage() {
  const supabase = supabaseServer();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const [{ data: viewerProfile }, { data: rows }, { data: profiles }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user!.id).single(),
    supabase
      .from("admissions_computed")
      .select(
        "id, scid, student_name, admission_date, batch_label, eff_scholarship_pct, scholarship_amount, additional_discount, counselor_id, actual_payable, total_paid, outstanding, created_at, updated_at, last_payment_on"
      ),
    supabase.from("profiles").select("id, full_name, email, role").in("role", ["counselor", "manager"])
  ]);

  const isOwner = viewerProfile?.role === "owner";
  const data = (rows as Row[]) || [];
  const people = (profiles as { id: string; full_name: string | null; email: string; role: string }[]) || [];

  const stats = new Map<string, CounselorStat>();
  for (const p of people) {
    stats.set(p.id, {
      id: p.id,
      name: p.full_name || p.email,
      email: p.email,
      role: p.role,
      count: 0,
      payable: 0,
      collected: 0,
      outstanding: 0,
      lastUpdate: null,
      students: []
    });
  }

  const unassigned: Row[] = [];
  for (const r of data) {
    const s = r.counselor_id ? stats.get(r.counselor_id) : undefined;
    if (!s) {
      // Either no counselor at all, or one no longer on the roster (deleted account, say).
      // Only the owner can actually see these rows (RLS), but guard anyway.
      unassigned.push(r);
      continue;
    }
    s.count += 1;
    s.payable += Number(r.actual_payable || 0);
    s.collected += Number(r.total_paid || 0);
    s.outstanding += Math.max(0, Number(r.outstanding || 0));
    s.lastUpdate = latest(s.lastUpdate, r.updated_at, r.created_at, r.last_payment_on);
    s.students.push(r);
  }

  const counselorRows = [...stats.values()].sort((a, b) => b.collected - a.collected);
  const totals = counselorRows.reduce(
    (acc, c) => {
      acc.count += c.count;
      acc.collected += c.collected;
      acc.outstanding += c.outstanding;
      return acc;
    },
    { count: 0, collected: 0, outstanding: 0 }
  );
  const assignablePeople = people.map((p) => ({ id: p.id, name: p.full_name || p.email }));

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <p className="lede">Track every counselor&rsquo;s admissions and last activity &mdash; and log your own.</p>
        <Link className="btn secondary small" href="/calculator">
          + New admission
        </Link>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <div className="kpi">
          <div className="kpi-label">Team admissions</div>
          <div className="kpi-val">{totals.count}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Collected</div>
          <div className="kpi-val">{formatINR(totals.collected)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Outstanding</div>
          <div className="kpi-val">{formatINR(totals.outstanding)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Counselor performance</h2>
        </div>
        {counselorRows.length === 0 ? (
          <p className="comp-hint">No counselors on your roster yet.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th style={{ textAlign: "right" }}>Admissions</th>
                <th style={{ textAlign: "right" }}>Collected</th>
                <th style={{ textAlign: "right" }}>Outstanding</th>
                <th>Last update</th>
              </tr>
            </thead>
            <tbody>
              {counselorRows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    <div className="comp-hint">{c.email}</div>
                  </td>
                  <td style={{ textTransform: "capitalize" }}>{c.role}</td>
                  <td className="amt">{c.count}</td>
                  <td className="amt">{formatINR(c.collected)}</td>
                  <td className="amt">{formatINR(c.outstanding)}</td>
                  <td className="comp-hint">{fmtWhen(c.lastUpdate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ height: 24 }} />

      <div className="card">
        <div className="card-head">
          <span className="kicker">Per student</span>
          <h2 className="card-title">Students enrolled by counselor</h2>
        </div>
        <p className="comp-hint" style={{ marginBottom: 14 }}>
          Scholarship and additional discount only &mdash; fee totals and collections stay on the summary above.
        </p>
        {counselorRows.length === 0 ? (
          <p className="comp-hint">No counselors on your roster yet.</p>
        ) : (
          <div className="stack" style={{ gap: 18 }}>
            {counselorRows.map((c) => (
              <div key={c.id}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{c.name}</div>
                <CounselorStudentsList students={c.students} />
              </div>
            ))}
          </div>
        )}
      </div>

      {isOwner && (
        <>
          <div style={{ height: 24 }} />
          <div className="card">
            <div className="card-head">
              <h2 className="card-title">Unassigned students</h2>
            </div>
            {unassigned.length === 0 ? (
              <p className="comp-hint">Every student is assigned to a counselor.</p>
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Batch</th>
                    <th>Admitted</th>
                    <th>Assign to</th>
                  </tr>
                </thead>
                <tbody>
                  {unassigned.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.student_name}</div>
                        <div className="comp-hint">{r.scid || "—"}</div>
                      </td>
                      <td>{r.batch_label}</td>
                      <td>{r.admission_date || "—"}</td>
                      <td>
                        <AssignCounselorControl admissionId={r.id} people={assignablePeople} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </>
  );
}
