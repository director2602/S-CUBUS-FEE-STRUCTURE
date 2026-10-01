import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { formatINR } from "@/lib/fee-calc";

type Row = {
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

  const [{ data: rows }, { data: profiles }] = await Promise.all([
    supabase
      .from("admissions_computed")
      .select("counselor_id, actual_payable, total_paid, outstanding, created_at, updated_at, last_payment_on"),
    supabase.from("profiles").select("id, full_name, email, role").in("role", ["counselor", "manager"])
  ]);

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
      lastUpdate: null
    });
  }
  for (const r of data) {
    const s = stats.get(r.counselor_id);
    if (!s) continue; // record belongs to someone no longer on the roster (or an owner)
    s.count += 1;
    s.payable += Number(r.actual_payable || 0);
    s.collected += Number(r.total_paid || 0);
    s.outstanding += Math.max(0, Number(r.outstanding || 0));
    s.lastUpdate = latest(s.lastUpdate, r.updated_at, r.created_at, r.last_payment_on);
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

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <p className="lede">Track every counselor&rsquo;s admissions, collections and last activity &mdash; and log your own.</p>
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
          <p className="comp-hint">No counselors on the roster yet.</p>
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
    </>
  );
}
