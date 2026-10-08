
"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { createBrowserClient } from "@supabase/ssr";

// Falls back to the project's live URL/anon key if the env vars aren't named exactly this in this
// repo -- the anon key is meant to be public (Row Level Security does the real access control), so
// hardcoding it here as a fallback is safe and keeps this page working regardless of env var naming.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dqgwafdihafcttynfaea.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxZ3dhZmRpaGFmY3R0eW5mYWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNjEwOTMsImV4cCI6MjEwNTYzNzA5M30._n-FGaXFyi3c1NxBDI0-DFfUA2nyqFhmELFc1LJat28";

// ---------- FY27 plan constants -- mirrors the standalone AOP tool (S-CUBUS-AOP repo) so the two
// never show different numbers for the same plan. If you change the plan there, change it here too. ----------
const PEOPLE: [string, number][] = [
  ["Sarika - Director", 30],
  ["Subir - Director", 30],
  ["Amit - Chemistry", 24],
  ["Sachin - Physics", 14],
  ["Satuti - Chemistry", 12],
  ["Yashwant - Maths", 15],
  ["Vaishali - Botany", 14.5],
  ["Bridul", 6],
  ["EDP", 3.6],
  ["Editor 1", 5.4],
  ["Editor 2", 2.16],
  ["Counselor 1", 3.6],
  ["Counselor 2", 2.04],
  ["Suleman - Marketing", 8.4],
  ["Gaurav Anand - Marketing", 10.2],
  ["Shubham - Admin", 3.6],
  ["Office Boy 1", 2.64],
  ["Office Boy 2", 2.4],
  ["Guard", 4.8],
  ["Legal + HR", 3.6]
];

const PLAN = {
  programs: [
    { name: "Class 8", students: 60, arpu: 70000 },
    { name: "Class 9", students: 70, arpu: 70000 },
    { name: "Class 10", students: 70, arpu: 70000 },
    { name: "11th NEET", students: 70, arpu: 130000 },
    { name: "12th NEET", students: 70, arpu: 130000 },
    { name: "11th JEE", students: 65, arpu: 130000 },
    { name: "12th JEE", students: 65, arpu: 130000 },
    { name: "JEE Repeater", students: 60, arpu: 130000 },
    { name: "NEET Repeater", students: 70, arpu: 130000 }
  ],
  hikePct: 10,
  rentM: 3.15,
  elecM: 0.7,
  printM: 0.5,
  material: 4000,
  tshirt: 1000,
  bag: 500,
  stationery: 500,
  mktgPct: 10,
  loanPrincipalL: 35,
  loanRatePct: 10,
  ccUsedL: 0,
  ccRatePct: 10,
  taxPct: 25,
  opening: 30,
  months: ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"],
  monthlyNew: [80, 70, 60, 55, 50, 45, 45, 40, 40, 35, 30, 20]
};

function computePlan() {
  const totalStudents = PLAN.programs.reduce((s, p) => s + p.students, 0);
  const revenueLakh = PLAN.programs.reduce((s, p) => s + (p.students * p.arpu) / 100000, 0);
  const peopleCurrentTotal = PEOPLE.reduce((s, [, v]) => s + v, 0);
  const peopleFy27Total = peopleCurrentTotal * (1 + PLAN.hikePct / 100);
  const fixedAnnual = (PLAN.rentM + PLAN.elecM + PLAN.printM) * 12;
  const perStudentLinked = PLAN.material + PLAN.tshirt + PLAN.bag + PLAN.stationery;
  const studentLinkedAnnualLakh = (perStudentLinked * totalStudents) / 100000;
  const mktgBudgetLakh = (PLAN.mktgPct / 100) * revenueLakh;
  const totalOperatingCost = peopleFy27Total + fixedAnnual + studentLinkedAnnualLakh + mktgBudgetLakh;
  const ebitda = revenueLakh - totalOperatingCost;
  const termLoanInterest = PLAN.loanPrincipalL * (PLAN.loanRatePct / 100);
  const ccInterest = PLAN.ccUsedL * (PLAN.ccRatePct / 100);
  const financeCost = termLoanInterest + ccInterest;
  const pbt = ebitda - financeCost;
  const taxAmount = pbt > 0 ? pbt * (PLAN.taxPct / 100) : 0;
  const profitAfterTax = pbt - taxAmount;
  return {
    totalStudents,
    revenueLakh,
    totalOperatingCost,
    ebitda,
    termLoanInterest,
    ccInterest,
    financeCost,
    pbt,
    taxAmount,
    profitAfterTax
  };
}

function computeMonthly(blendedArpu: number) {
  let cum = PLAN.opening;
  const rows = PLAN.months.map((name, i) => {
    const prevCum = cum;
    cum = prevCum + PLAN.monthlyNew[i];
    const avgCum = (prevCum + cum) / 2;
    const revenue = (avgCum * blendedArpu) / 12 / 100000;
    return { name, cum, revenue };
  });
  return rows;
}

// 0 = 1 Apr FY27 start, 12 = 31 Mar FY27 end; real "today" so this stays accurate on every visit
function fyMonthProgress() {
  const fyStart = new Date(2026, 3, 1);
  const fyEnd = new Date(2027, 3, 1);
  const today = new Date();
  if (today < fyStart) return 0;
  if (today >= fyEnd) return 12;
  const monthsElapsed = (today.getFullYear() - fyStart.getFullYear()) * 12 + (today.getMonth() - fyStart.getMonth());
  const daysInCurMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const fracInMonth = (today.getDate() - 1) / daysInCurMonth;
  return monthsElapsed + fracInMonth;
}

function computeExpectedToDate(monthlyRows: { cum: number; revenue: number }[], p: number) {
  if (p >= 12) {
    return { students: monthlyRows[11].cum, revenueLakh: monthlyRows.reduce((s, r) => s + r.revenue, 0) };
  }
  const floorIdx = Math.max(0, Math.min(11, Math.floor(p)));
  const frac = Math.max(0, Math.min(1, p - floorIdx));
  const monthStartCum = floorIdx === 0 ? PLAN.opening : monthlyRows[floorIdx - 1].cum;
  const monthEndCum = monthlyRows[floorIdx].cum;
  const cumStudents = monthStartCum + frac * (monthEndCum - monthStartCum);
  let cumRevenue = 0;
  for (let i = 0; i < floorIdx; i++) cumRevenue += monthlyRows[i].revenue;
  cumRevenue += frac * monthlyRows[floorIdx].revenue;
  return { students: cumStudents, revenueLakh: cumRevenue };
}

function mapProgramName(batchKey: string, batchLabel: string | null, batchGroup: string | null) {
  const lbl = (batchLabel || "").toLowerCase();
  if (batchGroup === "Foundation") {
    if (lbl.includes("8")) return "Class 8";
    if (lbl.includes("9")) return "Class 9";
    if (lbl.includes("10")) return "Class 10";
    return null;
  }
  if (batchGroup === "NEET") {
    if (lbl.includes("repeat")) return "NEET Repeater";
    if (lbl.includes("11")) return "11th NEET";
    if (lbl.includes("12")) return "12th NEET";
    return null;
  }
  if (batchGroup === "JEE") {
    if (lbl.includes("repeat")) return "JEE Repeater";
    if (lbl.includes("11")) return "11th JEE";
    if (lbl.includes("12")) return "12th JEE";
    return null;
  }
  return null; // Online, Special, SIP, SATHII, Dubai etc. are not ARPU-target classes
}

function fmtINR(n: number) {
  if (n == null || isNaN(n)) return "₹0";
  return "₹" + Math.round(n).toLocaleString("en-IN");
}
function fmtLakh(n: number, dp?: number) {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString("en-IN", { minimumFractionDigits: dp ?? 2, maximumFractionDigits: dp ?? 2 });
}
function fmtPct(n: number | null, dp?: number) {
  if (n == null || isNaN(n)) return "—";
  return (n * 100).toFixed(dp ?? 1) + "%";
}

type AdmissionRow = {
  batch_key: string;
  batch_label: string | null;
  batch_group: string | null;
  admission_date: string | null;
  gross_fee: number;
  scholarship_amount: number;
  net_excl_gst: number;
  gst_amount: number;
  actual_payable: number;
  total_paid: number;
};

type ActualAgg = {
  students: number;
  gross: number;
  scholarship: number;
  netExclGst: number;
  gstAmount: number;
  actualPayable: number;
  collected: number;
};

function emptyAgg(): ActualAgg {
  return { students: 0, gross: 0, scholarship: 0, netExclGst: 0, gstAmount: 0, actualPayable: 0, collected: 0 };
}

export default function AopActualsPage() {
  const [status, setStatus] = useState<"loading" | "denied" | "error" | "ready">("loading");
  const [rows, setRows] = useState<AdmissionRow[]>([]);
  const [asOf, setAsOf] = useState("");

  useEffect(() => {
    const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    (async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        setStatus("denied");
        return;
      }
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profileErr || !profile || profile.role !== "owner") {
        setStatus("denied");
        return;
      }
      const { data, error } = await supabase
        .from("admissions_computed")
        .select(
          "batch_key,batch_label,batch_group,admission_date,gross_fee,scholarship_amount,net_excl_gst,gst_amount,actual_payable,total_paid"
        );
      if (error) {
        setStatus("error");
        return;
      }
      setRows((data || []) as AdmissionRow[]);
      setAsOf(new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }));
      setStatus("ready");
    })();
  }, []);

  const plan = useMemo(() => computePlan(), []);
  const blendedArpu = plan.totalStudents > 0 ? (plan.revenueLakh * 100000) / plan.totalStudents : 0;
  const monthlyRows = useMemo(() => computeMonthly(blendedArpu), [blendedArpu]);
  const fyProg = useMemo(() => fyMonthProgress(), []);
  const exp = useMemo(() => computeExpectedToDate(monthlyRows, fyProg), [monthlyRows, fyProg]);

  const act = useMemo(() => {
    const totals = emptyAgg();
    const byProgram: Record<string, ActualAgg> = {};
    rows.forEach((r) => {
      totals.students += 1;
      totals.gross += Number(r.gross_fee) || 0;
      totals.scholarship += Number(r.scholarship_amount) || 0;
      totals.netExclGst += Number(r.net_excl_gst) || 0;
      totals.gstAmount += Number(r.gst_amount) || 0;
      totals.actualPayable += Number(r.actual_payable) || 0;
      totals.collected += Number(r.total_paid) || 0;
      const pname = mapProgramName(r.batch_key, r.batch_label, r.batch_group);
      if (pname) {
        if (!byProgram[pname]) byProgram[pname] = emptyAgg();
        const bp = byProgram[pname];
        bp.students += 1;
        bp.gross += Number(r.gross_fee) || 0;
        bp.scholarship += Number(r.scholarship_amount) || 0;
        bp.netExclGst += Number(r.net_excl_gst) || 0;
        bp.gstAmount += Number(r.gst_amount) || 0;
        bp.actualPayable += Number(r.actual_payable) || 0;
        bp.collected += Number(r.total_paid) || 0;
      }
    });
    const collectionEff = totals.actualPayable > 0 ? totals.collected / totals.actualPayable : null;
    const discountPct = totals.gross > 0 ? totals.scholarship / totals.gross : null;
    const arpu = totals.students > 0 ? totals.netExclGst / totals.students : null;
    return { totals, byProgram, collectionEff, discountPct, arpu };
  }, [rows]);

  if (status === "loading") {
    return <div style={{ padding: 40, fontFamily: "system-ui, sans-serif" }}>Loading live admissions data…</div>;
  }
  if (status === "denied") {
    return (
      <div style={{ padding: 40, maxWidth: 520, fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ fontSize: 18 }}>Restricted</h1>
        <p style={{ color: "#666", fontSize: 14, lineHeight: 1.6 }}>
          This page is visible to Director/Owner accounts only. If you believe this is wrong, ask the Director to
          check your account&rsquo;s role in the Fee Portal.
        </p>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div style={{ padding: 40, fontFamily: "system-ui, sans-serif" }}>
        Could not load live admissions data right now &mdash; try refreshing the page.
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px 60px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Annual Operating Plan &mdash; Expectations vs Actuals</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        Director &amp; Owner only. Pulled live from this Fee Portal&rsquo;s own admissions data on every page load
        &mdash; last refreshed {asOf}.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 28 }}>
        <Tile label="Students (to date)" value={`${act.totals.students} / ${fmtLakh(exp.students, 0)} expected`} />
        <Tile
          label="Revenue excl. GST (to date)"
          value={`${fmtLakh(act.totals.netExclGst / 100000, 2)} L`}
          sub={`vs ${fmtLakh(exp.revenueLakh, 2)} L expected`}
        />
        <Tile label="GST collected" value={`${fmtLakh(act.totals.gstAmount / 100000, 2)} L`} sub="pass-through, not revenue" />
        <Tile
          label="Collected (cash, incl. GST)"
          value={`${fmtLakh(act.totals.collected / 100000, 2)} L`}
          sub={act.collectionEff != null ? `Collection efficiency ${fmtPct(act.collectionEff)}` : "—"}
        />
        <Tile label="Scholarship / discount" value={fmtPct(act.discountPct)} />
        <Tile label="Actual blended ARPU (excl. GST)" value={act.arpu != null ? fmtINR(act.arpu) : "—"} sub="plan target ₹1,10,000" />
        <Tile label="Plan EBITDA (run-rate)" value={`${fmtLakh(plan.ebitda, 2)} L`} sub={`${fmtPct(plan.revenueLakh > 0 ? plan.ebitda / plan.revenueLakh : null)} margin`} />
        <Tile label="Plan PAT (illustrative)" value={`${fmtLakh(plan.profitAfterTax, 2)} L`} sub="after loan interest + 25% tax" />
      </div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Revenue by program</h2>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={th}>Program</th>
            <th style={thNum}>Target Students</th>
            <th style={thNum}>Actual Students</th>
            <th style={thNum}>Target Revenue (₹L)</th>
            <th style={thNum}>Actual Revenue excl. GST (₹L)</th>
            <th style={thNum}>GST (₹L)</th>
            <th style={thNum}>Collected (₹L)</th>
          </tr>
        </thead>
        <tbody>
          {PLAN.programs.map((p) => {
            const a = act.byProgram[p.name] || emptyAgg();
            const targetRevenue = (p.students * p.arpu) / 100000;
            return (
              <tr key={p.name}>
                <td style={td}>{p.name}</td>
                <td style={tdNum}>{p.students}</td>
                <td style={tdNum}>{a.students}</td>
                <td style={tdNum}>{fmtLakh(targetRevenue, 2)}</td>
                <td style={tdNum}>{fmtLakh(a.netExclGst / 100000, 2)}</td>
                <td style={tdNum}>{fmtLakh(a.gstAmount / 100000, 2)}</td>
                <td style={tdNum}>{fmtLakh(a.collected / 100000, 2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2 style={{ fontSize: 15, marginTop: 28, marginBottom: 8 }}>Plan P&amp;L (run-rate, ₹ lakh)</h2>
      <table style={tableStyle}>
        <tbody>
          <tr>
            <td style={td}>Revenue</td>
            <td style={tdNum}>{fmtLakh(plan.revenueLakh, 2)}</td>
          </tr>
          <tr>
            <td style={td}>Total operating cost</td>
            <td style={tdNum}>{fmtLakh(-plan.totalOperatingCost, 2)}</td>
          </tr>
          <tr style={{ fontWeight: 700 }}>
            <td style={td}>EBITDA</td>
            <td style={tdNum}>{fmtLakh(plan.ebitda, 2)}</td>
          </tr>
          <tr>
            <td style={td}>Term loan interest (PNB, ₹35L @ {PLAN.loanRatePct}%)</td>
            <td style={tdNum}>{fmtLakh(-plan.termLoanInterest, 2)}</td>
          </tr>
          <tr>
            <td style={td}>CC interest (₹{PLAN.ccUsedL}L utilised @ {PLAN.ccRatePct}%, of ₹1.25Cr limit)</td>
            <td style={tdNum}>{fmtLakh(-plan.ccInterest, 2)}</td>
          </tr>
          <tr style={{ fontWeight: 700 }}>
            <td style={td}>Profit Before Tax</td>
            <td style={tdNum}>{fmtLakh(plan.pbt, 2)}</td>
          </tr>
          <tr>
            <td style={td}>Estimated tax (illustrative @ {PLAN.taxPct}%)</td>
            <td style={tdNum}>{fmtLakh(-plan.taxAmount, 2)}</td>
          </tr>
          <tr style={{ fontWeight: 700 }}>
            <td style={td}>Profit After Tax</td>
            <td style={tdNum}>{fmtLakh(plan.profitAfterTax, 2)}</td>
          </tr>
        </tbody>
      </table>
      <p style={{ fontSize: 12, color: "#888", marginTop: 10, lineHeight: 1.6 }}>
        The P&amp;L above is the FY27 plan run-rate (same figures as the standalone AOP tool), not computed from
        actuals — there isn&rsquo;t enough real cost data yet to build an actual P&amp;L. CC utilised is fixed
        at ₹{PLAN.ccUsedL}L in this page&rsquo;s source; update the <code>PLAN.ccUsedL</code> constant once you
        want it to track a real average balance. Term loan interest assumes the full ₹35L principal outstanding
        (no amortization schedule modeled since tenure/EMI weren&rsquo;t given). Revenue figures exclude GST, which
        is tracked separately above as a pass-through liability, not institute revenue &mdash; this matches the
        plan&rsquo;s own pre-GST per-program ARPU figures. Collection efficiency is the one GST-inclusive,
        cash-basis figure, since that&rsquo;s a real cash-flow check rather than a revenue comparison. Everything
        else on this page refreshes automatically from the Fee Portal&rsquo;s live data on every visit.
      </p>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ border: "1px solid #e3e3e0", borderRadius: 10, padding: "10px 14px" }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", color: "#888", letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#999", marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

const tableStyle: CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13.5 };
const th: CSSProperties = {
  textAlign: "left",
  padding: "7px 10px",
  borderBottom: "1px solid #ddd",
  fontSize: 11.5,
  textTransform: "uppercase",
  color: "#888"
};
const thNum: CSSProperties = { ...th, textAlign: "right" };
const td: CSSProperties = { padding: "7px 10px", borderBottom: "1px solid #eee" };
const tdNum: CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };
