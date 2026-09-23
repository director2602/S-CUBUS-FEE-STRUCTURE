import { supabaseServer } from "@/lib/supabase/server";
import { formatINR } from "@/lib/fee-calc";
import DashboardLedger from "@/components/DashboardLedger";

type Row = {
  id: string;
  counselor_id: string;
  batch_label: string;
  batch_group: string;
  gross_fee: number;
  actual_payable: number;
  total_paid: number;
  outstanding: number;
  billing_status: "Paid in Full" | "Unpaid" | "Partially Paid";
};

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ background: "var(--line)", borderRadius: 4, height: 8, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, background: "var(--accent)", height: "100%", borderRadius: 4 }} />
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = supabaseServer();

  const [{ data: rows }, { data: profiles }] = await Promise.all([
    supabase.from("admissions_computed").select("*"),
    supabase.from("profiles").select("id, full_name, email").eq("role", "counselor")
  ]);

  const data = (rows as any[]) || [];
  const counselors = (profiles || []).map((p: any) => ({ id: p.id, name: p.full_name || p.email }));
  const counselorNames = new Map(counselors.map((c) => [c.id, c.name]));

  const totalAdmissions = data.length;
  const totalGross = data.reduce((s, r) => s + Number(r.gross_fee || 0), 0);
  const totalPayable = data.reduce((s, r) => s + Number(r.actual_payable || 0), 0);
  const totalCollected = data.reduce((s, r) => s + Number(r.total_paid || 0), 0);
  const totalOutstanding = data.reduce((s, r) => s + Math.max(0, Number(r.outstanding || 0)), 0);
  const paidInFull = data.filter((r) => r.billing_status === "Paid in Full").length;
  const partiallyPaid = data.filter((r) => r.billing_status === "Partially Paid").length;
  const unpaid = data.filter((r) => r.billing_status === "Unpaid").length;

  const byBatch = new Map<string, { label: string; count: number; gross: number; collected: number }>();
  for (const r of data) {
    const key = r.batch_label || "—";
    const cur = byBatch.get(key) || { label: key, count: 0, gross: 0, collected: 0 };
    cur.count += 1;
    cur.gross += Number(r.gross_fee || 0);
    cur.collected += Number(r.total_paid || 0);
    byBatch.set(key, cur);
  }
  const batchRows = [...byBatch.values()].sort((a, b) => b.gross - a.gross);
  const maxBatchGross = Math.max(1, ...batchRows.map((b) => b.gross));

  const byCounselor = new Map<string, { name: string; count: number; payable: number; collected: number; outstanding: number }>();
  for (const r of data) {
    const name = counselorNames.get(r.counselor_id) || "Unassigned";
    const cur = byCounselor.get(name) || { name, count: 0, payable: 0, collected: 0, outstanding: 0 };
    cur.count += 1;
    cur.payable += Number(r.actual_payable || 0);
    cur.collected += Number(r.total_paid || 0);
    cur.outstanding += Math.max(0, Number(r.outstanding || 0));
    byCounselor.set(name, cur);
  }
  const counselorRows = [...byCounselor.values()].sort((a, b) => b.collected - a.collected);
  const maxCounselorCollected = Math.max(1, ...counselorRows.map((c) => c.collected));

  return (
    <>
      <p className="lede">Owner-only view across every counselor and batch &mdash; not visible to counselor accounts.</p>

      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <div className="kpi">
          <div className="kpi-label">Admissions</div>
          <div className="kpi-val">{totalAdmissions}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Gross bookings</div>
          <div className="kpi-val">{formatINR(totalGross)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Collected</div>
          <div className="kpi-val">{formatINR(totalCollected)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Outstanding</div>
          <div className="kpi-val">{formatINR(totalOutstanding)}</div>
        </div>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 32 }}>
        <div className="kpi">
          <div className="kpi-label" style={{ color: "var(--good-fg)" }}>
            Paid in full
          </div>
          <div className="kpi-val">{paidInFull}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label" style={{ color: "var(--warn-fg)" }}>
            Partially paid
          </div>
          <div className="kpi-val">{partiallyPaid}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label" style={{ color: "var(--bad-fg)" }}>
            Unpaid
          </div>
          <div className="kpi-val">{unpaid}</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h2 className="card-title">Revenue by batch</h2>
          </div>
          {batchRows.length === 0 ? (
            <p className="comp-hint">No admissions saved yet.</p>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th style={{ textAlign: "right" }}>Admissions</th>
                  <th style={{ textAlign: "right" }}>Gross</th>
                  <th>&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {batchRows.map((b) => (
                  <tr key={b.label}>
                    <td>{b.label}</td>
                    <td className="amt">{b.count}</td>
                    <td className="amt">{formatINR(b.gross)}</td>
                    <td style={{ width: 100 }}>
                      <Bar value={b.gross} max={maxBatchGross} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h2 className="card-title">Counselor performance</h2>
          </div>
          {counselorRows.length === 0 ? (
            <p className="comp-hint">No admissions saved yet.</p>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Counselor</th>
                  <th style={{ textAlign: "right" }}>Admissions</th>
                  <th style={{ textAlign: "right" }}>Collected</th>
                  <th style={{ textAlign: "right" }}>Outstanding</th>
                  <th>&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {counselorRows.map((c) => (
                  <tr key={c.name}>
                    <td>{c.name}</td>
                    <td className="amt">{c.count}</td>
                    <td className="amt">{formatINR(c.collected)}</td>
                    <td className="amt">{formatINR(c.outstanding)}</td>
                    <td style={{ width: 100 }}>
                      <Bar value={c.collected} max={maxCounselorCollected} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={{ height: 32 }} />

      <DashboardLedger rows={data as any} counselors={counselors} />
    </>
  );
}
