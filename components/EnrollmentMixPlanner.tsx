"use client";

import { useMemo, useState } from "react";
import { formatINR, splitEvenly } from "@/lib/fee-calc";

type MixBatch = {
  key: string;
  label: string;
  floorFee: number;
  currentDefaultPct: number;
};

export default function EnrollmentMixPlanner({
  foundationBatches,
  jeeNeetBatches,
  arpuTarget,
  minScholarshipFloorPct,
  defaultTotal
}: {
  foundationBatches: MixBatch[];
  jeeNeetBatches: MixBatch[];
  arpuTarget: number;
  minScholarshipFloorPct: number;
  defaultTotal: number;
}) {
  const [totalInput, setTotalInput] = useState(String(defaultTotal));
  const total = Math.max(0, parseInt(totalInput, 10) || 0);

  const avg = (batches: MixBatch[]) => (batches.length ? batches.reduce((s, b) => s + b.floorFee, 0) / batches.length : 0);
  const avgFoundationFee = avg(foundationBatches);
  const avgJeeNeetFee = avg(jeeNeetBatches);
  const mixDenom = avgJeeNeetFee - arpuTarget;
  const requiredJeeNeetToFoundationRatio = mixDenom > 0 ? (arpuTarget - avgFoundationFee) / mixDenom : null;
  const foundationShare = requiredJeeNeetToFoundationRatio != null ? 1 / (1 + requiredJeeNeetToFoundationRatio) : null;

  const { mixRows, achievedArpu, foundationTotal, jeeNeetTotal } = useMemo(() => {
    const fTotal = foundationShare != null ? Math.round(total * foundationShare) : 0;
    const jnTotal = total - fTotal;
    const fTargets = splitEvenly(fTotal, foundationBatches.length);
    const jnTargets = splitEvenly(jnTotal, jeeNeetBatches.length);
    const rows = [
      ...foundationBatches.map((b, i) => ({ ...b, targetStudents: fTargets[i] || 0 })),
      ...jeeNeetBatches.map((b, i) => ({ ...b, targetStudents: jnTargets[i] || 0 }))
    ];
    const revenue = rows.reduce((s, r) => s + r.floorFee * r.targetStudents, 0);
    const students = rows.reduce((s, r) => s + r.targetStudents, 0);
    return {
      mixRows: rows,
      achievedArpu: students > 0 ? revenue / students : 0,
      foundationTotal: fTotal,
      jeeNeetTotal: jnTotal
    };
  }, [total, foundationShare, foundationBatches, jeeNeetBatches]);

  return (
    <div className="card" style={{ marginBottom: 32 }}>
      <div className="card-head">
        <span className="kicker">Planning</span>
        <h2 className="card-title">Enrollment Mix Planner &mdash; {formatINR(arpuTarget)} Blended ARPU</h2>
      </div>
      <p className="comp-hint" style={{ marginBottom: 14 }}>
        Foundation 8/9/10 can&rsquo;t reach {formatINR(arpuTarget)} on their own no matter the headcount &mdash; the
        only way to land a blended {formatINR(arpuTarget)} across your core offline classes (Foundation + JEE + NEET
        &mdash; SIP, Online, Special, SATHII and Dubai aren&rsquo;t revenue-target classes, so none of those count
        here) is to weight enrollment toward JEE/NEET. Set your target total enrollment below and the per-class
        split and projected blended ARPU update live. Figures assume every class holds scholarship at a floor of
        {" "}{minScholarshipFloorPct}% on every enrollment and 0% GST, matching how admissions are billed today.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <label htmlFor="mix-total" style={{ fontSize: 13, fontWeight: 600 }}>
          Target total enrollment (offline core classes)
        </label>
        <input
          id="mix-total"
          type="number"
          min={0}
          step={1}
          value={totalInput}
          onChange={(e) => setTotalInput(e.target.value)}
          style={{ width: 110, fontSize: 14, padding: "6px 10px" }}
        />
      </div>
      <div className="kpi-grid" style={{ marginBottom: 18, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        <div className="kpi">
          <div className="kpi-label">Required mix</div>
          <div className="kpi-val">
            {foundationShare != null
              ? `${Math.round(foundationShare * 100)}% Foundation / ${Math.round((1 - foundationShare) * 100)}% JEE+NEET`
              : "—"}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Target total enrollment</div>
          <div className="kpi-val">
            {total} <span className="comp-hint">({foundationTotal} Foundation / {jeeNeetTotal} JEE+NEET)</span>
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Blended ARPU at this mix</div>
          <div className="kpi-val" style={{ color: achievedArpu >= arpuTarget ? "var(--good-fg)" : "var(--bad-fg)" }}>
            {formatINR(achievedArpu)}
          </div>
        </div>
      </div>
      <table className="data">
        <thead>
          <tr>
            <th>Class</th>
            <th style={{ textAlign: "right" }}>Fee/student @ {minScholarshipFloorPct}% scholarship</th>
            <th style={{ textAlign: "right" }}>Current default scholarship</th>
            <th style={{ textAlign: "right" }}>Target students</th>
          </tr>
        </thead>
        <tbody>
          {mixRows.map((r) => (
            <tr key={r.key}>
              <td>{r.label}</td>
              <td className="amt">{formatINR(r.floorFee)}</td>
              <td className="amt">{r.currentDefaultPct}%</td>
              <td className="amt">{r.targetStudents}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="comp-hint" style={{ marginTop: 10 }}>
        Foundation currently defaults to {foundationBatches[0]?.currentDefaultPct ?? 50}% scholarship &mdash;
        you&rsquo;d need to tighten that to {minScholarshipFloorPct}% for these numbers to hold in practice.
      </p>
    </div>
  );
}
