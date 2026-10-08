"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { createBrowserClient } from "@supabase/ssr";

// Falls back to the project's live URL/anon key if the env vars aren't named exactly this in this
// repo -- the anon key is meant to be public (Row Level Security does the real access control), so
// hardcoding it here as a fallback is safe and keeps this page working regardless of env var naming.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dqgwafdihafcttynfaea.supabase.co";
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

const CHANNELS: { name: string; pct: number; kpi: string }[] = [
  { name: "Digital Performance", pct: 0.4, kpi: "Qualified Leads + Enrolments" },
  { name: "School/Local Outreach", pct: 0.2, kpi: "School visits / seminars" },
  { name: "Content + Social", pct: 0.1, kpi: "Qualified leads + content reach" },
  { name: "Scholarships/Events", pct: 0.1, kpi: "Conversions from events" },
  { name: "Referral/Alumni", pct: 0.05, kpi: "Parent/student referrals" },
  { name: "Branding/Outdoor", pct: 0.1, kpi: "Local awareness" },
  { name: "Contingency", pct: 0.05, kpi: "Reserve" }
];

const FUNNEL = [
  { stage: "Enquiries", target: 6000, conv: "Top of funnel", kpi: "Lead volume", owner: "Marketing" },
  { stage: "Counselled", target: 3600, conv: "60% of enquiries", kpi: "Counsellor conversion", owner: "Counselling" },
  { stage: "Demo attended", target: 1800, conv: "50% of counselled", kpi: "Demo show-rate", owner: "Academics" },
  { stage: "Applications", target: 1200, conv: "67% of demo", kpi: "Application rate", owner: "Admissions" },
  { stage: "Paid admissions", target: 600, conv: "50% of applications", kpi: "Admission conversion", owner: "Admissions" }
];

const CAPACITY: string[][] = [
  ["Batch size", "30–40 students/batch, target 35", "Avg 35 students/batch", "Avg > 38 for 2 consecutive months", "Avg < 20 for 2 consecutive months", "Academic Head", "Monthly"],
  ["Batch occupancy", "Filled seats ÷ batch capacity", "≥ 75% occupancy", "> 90% occupancy sustained", "< 50% occupancy sustained", "Academic Head", "Monthly"],
  ["Faculty utilisation", "Teaching hours used ÷ available hours", "≥ 75% utilisation", "> 85% utilisation sustained", "< 60% utilisation sustained", "Director", "Monthly"]
];

const RISK_REGISTER: string[][] = [
  ["Enrolment shortfall", "Medium", "High — misses revenue & break-even targets", "Monthly admissions trailing the ramp plan for 2+ months", "Weekly funnel review; reallocate marketing spend to best-converting channels", "Director"],
  ["Faculty attrition (core subject)", "Medium", "High — batch disruption, parent complaints", "Resignation notice; sustained faculty dissatisfaction", "Retention conversations, backup/bench faculty for core subjects, timely hike reviews", "Director"],
  ["Fee collection delays/defaults", "Medium", "Medium — cash flow strain", "Collection efficiency drops below 90% for a month", "Structured installment plans, proactive follow-up before due dates, cap outstanding dues before re-enrolment", "Finance"],
  ["Marketing CAC overrun", "Medium", "Medium — erodes margin even if admissions hit target", "Blended CAC trending above ₹15,000", "Shift budget to channels at/below ₹12k CAC; pause underperforming channels", "Marketing"],
  ["Competitive pricing pressure", "Low", "Medium — forces scholarship/discount creep", "Scholarship/discount ratio trending above 15%", "Hold the 40% scholarship floor policy; compete on outcomes, not price", "Director"],
  ["NEET/JEE exam pattern or policy change", "Low", "Medium — curriculum/material rework needed", "Official notification from NTA/exam boards", "Academic team tracks notifications; build buffer into the content revision calendar", "Academic Head"],
  ["Facility/lease risk", "Low", "High — disrupts batches if space is lost", "Lease renewal approaching without confirmation", "Renew/renegotiate lease well ahead of expiry; keep a shortlist of backup premises", "Director"],
  ["Cash reserve shortfall", "Low", "High — can't cover a bad month without external funding", "Cash reserve falls below 3 months of opex", "Monthly cash reserve review; hold reserve as a standing board metric", "Director"],
  ["Debt servicing risk", "Low", "Medium — PNB term loan (₹35L) + CC (₹1.25Cr limit) interest at 10% adds fixed financing cost", "EBITDA margin compresses below ~35% for 2+ months", "Keep CC utilisation low, review PBT (not just EBITDA) monthly, refinance if rates move materially", "Director"]
];

const BENCHMARKS: string[][] = [
  ["Operating margin discipline", "EBITDA margin, tracked monthly, not just at year-end", "Hold a margin guardrail and review it as often as revenue, not just once a year", "Large listed/VC-backed coaching operators publish margin as a standing disclosure metric, not a once-a-year number"],
  ["Marketing efficiency / CAC", "Cost per paid admission, by channel", "Keep a ≤₹12,000 blended CAC guardrail; review by channel monthly", "Larger operators manage CAC at the channel level rather than a single blended guess"],
  ["Faculty cost ratio", "Faculty/people cost as % of revenue, tracked separately from general admin cost", "Watch the ratio in the Management Scorecard below", "Public disclosures separate faculty cost from general staff cost as its own lever"],
  ["Batch utilisation / capacity", "Occupancy % per batch, not just total enrolment", "Don't open or keep running a batch below the occupancy floor", "Industry commentary treats capacity utilisation as a margin lever in its own right, not just a by-product of enrolment"],
  ["Renewal / retention", "Repeat and renewal enrolments, named and tracked as their own KPI", "Report renewal rate quarterly once the data exists", "Large coaching chains name retention/renewal in public disclosures alongside new-student acquisition"]
];

function computePlan() {
  const totalStudents = PLAN.programs.reduce((s, p) => s + p.students, 0);
  const revenueLakh = PLAN.programs.reduce((s, p) => s + (p.students * p.arpu) / 100000, 0);
  const blendedArpu = totalStudents > 0 ? (revenueLakh * 100000) / totalStudents : 0;
  const peopleCurrentTotal = PEOPLE.reduce((s, [, v]) => s + v, 0);
  const peopleFy27Total = peopleCurrentTotal * (1 + PLAN.hikePct / 100);
  const fixedAnnual = (PLAN.rentM + PLAN.elecM + PLAN.printM) * 12;
  const perStudentLinked = PLAN.material + PLAN.tshirt + PLAN.bag + PLAN.stationery;
  const studentLinkedAnnualLakh = (perStudentLinked * totalStudents) / 100000;
  const mktgBudgetLakh = (PLAN.mktgPct / 100) * revenueLakh;
  const totalOperatingCost = peopleFy27Total + fixedAnnual + studentLinkedAnnualLakh + mktgBudgetLakh;
  const ebitda = revenueLakh - totalOperatingCost;
  const ebitdaMargin = revenueLakh > 0 ? ebitda / revenueLakh : 0;
  const contributionPerStudent = blendedArpu * (1 - PLAN.mktgPct / 100) - perStudentLinked;
  const fixedForBreakevenRupees = (peopleFy27Total + fixedAnnual) * 100000;
  const breakevenStudents = contributionPerStudent > 0 ? Math.ceil(fixedForBreakevenRupees / contributionPerStudent) : null;
  const termLoanInterest = PLAN.loanPrincipalL * (PLAN.loanRatePct / 100);
  const ccInterest = PLAN.ccUsedL * (PLAN.ccRatePct / 100);
  const financeCost = termLoanInterest + ccInterest;
  const pbt = ebitda - financeCost;
  const taxAmount = pbt > 0 ? pbt * (PLAN.taxPct / 100) : 0;
  const profitAfterTax = pbt - taxAmount;
  return {
    totalStudents,
    revenueLakh,
    blendedArpu,
    peopleCurrentTotal,
    peopleFy27Total,
    fixedAnnual,
    perStudentLinked,
    studentLinkedAnnualLakh,
    mktgBudgetLakh,
    totalOperatingCost,
    ebitda,
    ebitdaMargin,
    contributionPerStudent,
    fixedForBreakevenRupees,
    breakevenStudents,
    termLoanInterest,
    ccInterest,
    financeCost,
    pbt,
    taxAmount,
    profitAfterTax
  };
}

type MonthRow = {
  name: string;
  add: number;
  cum: number;
  revenue: number;
  people: number;
  fixed: number;
  mktg: number;
  studentcost: number;
  surplus: number;
};

function computeMonthly(m: ReturnType<typeof computePlan>): MonthRow[] {
  let cum = PLAN.opening;
  const peopleMonthly = m.peopleFy27Total / 12;
  const fixedMonthly = m.fixedAnnual / 12;
  const mktgMonthly = m.mktgBudgetLakh / 12;
  const studentCostMonthly = m.studentLinkedAnnualLakh / 12;
  return PLAN.months.map((name, i) => {
    const prevCum = cum;
    const add = PLAN.monthlyNew[i];
    cum = prevCum + add;
    const avgCum = (prevCum + cum) / 2;
    const revenue = (avgCum * m.blendedArpu) / 12 / 100000;
    const surplus = revenue - peopleMonthly - fixedMonthly - mktgMonthly - studentCostMonthly;
    return { name, add, cum, revenue, people: peopleMonthly, fixed: fixedMonthly, mktg: mktgMonthly, studentcost: studentCostMonthly, surplus };
  });
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

function computeExpectedToDate(monthlyRows: MonthRow[], p: number) {
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

function computeActualMonthlySeries(rows: AdmissionRow[]) {
  const cumStudents = new Array(12).fill(0);
  const cumRevenue = new Array(12).fill(0);
  rows.forEach((r) => {
    if (!r.admission_date) return;
    const d = new Date(r.admission_date);
    let idx = (d.getFullYear() - 2026) * 12 + (d.getMonth() - 3);
    idx = Math.max(0, Math.min(11, idx));
    for (let i = idx; i < 12; i++) {
      cumStudents[i] += 1;
      cumRevenue[i] += (Number(r.net_excl_gst) || 0) / 100000;
    }
  });
  const todayIdx = Math.max(0, Math.min(11, Math.floor(fyMonthProgress())));
  const students: (number | null)[] = [];
  const revenue: (number | null)[] = [];
  for (let i = 0; i < 12; i++) {
    if (i <= todayIdx) {
      students.push(cumStudents[i]);
      revenue.push(cumRevenue[i]);
    } else {
      students.push(null);
      revenue.push(null);
    }
  }
  return { students, revenue };
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

type Rag = { cls: "good" | "warning" | "serious" | "critical"; label: string };
function ragHigherBetter(value: number | null, goodMin: number, warnMin: number): Rag {
  if (value == null || isNaN(value)) return { cls: "warning", label: "No data yet" };
  if (value >= goodMin) return { cls: "good", label: "On track" };
  if (value >= warnMin) return { cls: "warning", label: "Watch" };
  return { cls: "critical", label: "Behind" };
}
function ragLowerBetter(value: number | null, goodMax: number, warnMax: number): Rag {
  if (value == null || isNaN(value)) return { cls: "warning", label: "No data yet" };
  if (value <= goodMax) return { cls: "good", label: "On track" };
  if (value <= warnMax) return { cls: "warning", label: "Watch" };
  return { cls: "critical", label: "Above target" };
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
      const { data: profile, error: profileErr } = await supabase.from("profiles").select("role").eq("id", user.id).single();
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
  const monthlyRows = useMemo(() => computeMonthly(plan), [plan]);
  const fyProg = useMemo(() => fyMonthProgress(), []);
  const exp = useMemo(() => computeExpectedToDate(monthlyRows, fyProg), [monthlyRows, fyProg]);
  const actualSeries = useMemo(() => computeActualMonthlySeries(rows), [rows]);

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

  const studentsRatio = exp.students > 0 ? act.totals.students / exp.students : null;
  const revenueRatio = exp.revenueLakh > 0 ? act.totals.netExclGst / 100000 / exp.revenueLakh : null;
  const arpuRatio = act.arpu != null && plan.blendedArpu > 0 ? act.arpu / plan.blendedArpu : null;
  const peopleCostRatio = plan.revenueLakh > 0 ? plan.peopleFy27Total / plan.revenueLakh : null;
  const studentCostRatio = plan.revenueLakh > 0 ? plan.studentLinkedAnnualLakh / plan.revenueLakh : null;

  if (status === "loading") {
    return <div style={{ padding: 40, fontFamily: "system-ui, sans-serif" }}>Loading live admissions data…</div>;
  }
  if (status === "denied") {
    return (
      <div style={{ padding: 40, maxWidth: 520, fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ fontSize: 18 }}>Restricted</h1>
        <p style={{ color: "#666", fontSize: 14, lineHeight: 1.6 }}>
          This page is visible to Director/Owner accounts only. If you believe this is wrong, ask the Director to check
          your account&rsquo;s role in the Fee Portal.
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

  const expStudentsSeries = monthlyRows.map((r) => r.cum);
  let cumRev = 0;
  const expRevSeries = monthlyRows.map((r) => {
    cumRev += r.revenue;
    return cumRev;
  });

  const maxN = Math.max(700, Math.ceil((plan.totalStudents + 100) / 50) * 50);
  const beXs: number[] = [];
  const beYs: number[] = [];
  for (let n = 0; n <= maxN; n += 50) {
    beXs.push(n);
    beYs.push((n * plan.contributionPerStudent - plan.fixedForBreakevenRupees) / 100000);
  }
  const beMarkIdx = plan.breakevenStudents != null ? beXs.findIndex((v) => v >= (plan.breakevenStudents as number)) : undefined;

  const totTargetRevenue = PLAN.programs.reduce((s, p) => s + (p.students * p.arpu) / 100000, 0);

  const scoreRows: [string, string, string, string, Rag, string, string][] = [
    ["Enrolment", "600 students by Mar", "Cumulative paid admissions vs plan-to-date", `${act.totals.students} / ${fmtLakh(exp.students, 0)} expected`, ragHigherBetter(studentsRatio, 0.95, 0.75), "Director", "Weekly"],
    ["Revenue", `${fmtLakh(plan.revenueLakh, 0)} L run-rate`, "Cumulative revenue (excl. GST) vs plan-to-date", `${fmtLakh(act.totals.netExclGst / 100000, 2)} / ${fmtLakh(exp.revenueLakh, 2)} L expected`, ragHigherBetter(revenueRatio, 0.95, 0.75), "Director", "Weekly"],
    ["Blended ARPU", fmtINR(plan.blendedArpu), "Actual revenue excl. GST ÷ actual students", act.arpu != null ? fmtINR(act.arpu) : "—", ragHigherBetter(arpuRatio, 0.95, 0.85), "Director", "Monthly"],
    ["Marketing", "≤10% of revenue", "Marketing budget ÷ revenue (plan)", fmtPct(PLAN.mktgPct / 100), { cls: "good", label: "Within plan" }, "Marketing", "Monthly"],
    ["Break-even", "≥400 green / 341–399 amber / <341 red", "Admissions needed to cover fixed cost", plan.breakevenStudents != null ? `${plan.breakevenStudents} (model)` : "—", ragHigherBetter(plan.breakevenStudents != null ? plan.totalStudents / plan.breakevenStudents : null, 1, 0.85), "Director", "Monthly"],
    ["Faculty utilisation", "≥75% teaching hours used", "See Capacity & Faculty below", "—", { cls: "warning", label: "No data source yet" }, "Academic Head", "Monthly"],
    ["Batch occupancy", "≥75% of batch capacity filled", "See Capacity & Faculty below", "—", { cls: "warning", label: "No data source yet" }, "Academic Head", "Monthly"],
    ["Fee collection", "≥95% green / 90–94% amber / <90% red", "Collected ÷ Billed", act.collectionEff != null ? fmtPct(act.collectionEff) : "—", ragHigherBetter(act.collectionEff, 0.95, 0.9), "Finance", "Weekly"],
    ["Scholarship / discount", "≤10% green / 10–15% amber / >15% red", "Scholarship ÷ Gross fee", act.discountPct != null ? fmtPct(act.discountPct) : "—", ragLowerBetter(act.discountPct, 0.1, 0.15), "Director", "Monthly"],
    ["Renewal", "≥70% of eligible repeaters re-enrol", "Renewed ÷ Eligible for renewal", "—", { cls: "warning", label: "No data source yet" }, "Academics", "Quarterly"],
    ["Student retention", "≥90% stay enrolled through the year", "Active at year-end ÷ Active at admission", "—", { cls: "warning", label: "No data source yet" }, "Academics", "Quarterly"],
    ["Faculty cost", "≤33% of revenue", "People cost ÷ Revenue (plan run-rate)", fmtPct(peopleCostRatio, 1), ragLowerBetter(peopleCostRatio, 0.33, 0.4), "Director", "Monthly"],
    ["Student variable cost", "≤6% of revenue", "Material+T-shirt+Bag+Stationery ÷ Revenue", fmtPct(studentCostRatio, 1), ragLowerBetter(studentCostRatio, 0.06, 0.08), "Admin", "Monthly"],
    ["Refunds", "<2% of billed revenue", "Refunds ÷ Billed", "—", { cls: "warning", label: "No data source yet" }, "Finance", "Monthly"],
    ["Cash reserve", "≥3 months of operating cost held", "Cash balance ÷ Monthly opex", "—", { cls: "warning", label: "No data source yet" }, "Director", "Monthly"],
    ["Debt servicing", "PNB term loan ₹35L + CC limit ₹1.25Cr @ 10%", "Finance cost ÷ EBITDA", fmtPct(plan.ebitda > 0 ? plan.financeCost / plan.ebitda : null), ragLowerBetter(plan.ebitda > 0 ? plan.financeCost / plan.ebitda : null, 0.1, 0.2), "Director", "Monthly"]
  ];

  const collRows: [string, string, string, string, Rag, string, string][] = [
    ["Collection efficiency", "≥95%", "Collected ÷ Billed", act.collectionEff != null ? fmtPct(act.collectionEff) : "—", ragHigherBetter(act.collectionEff, 0.95, 0.85), "Finance", "Weekly"],
    ["DSO (Days Sales Outstanding)", "<30 days", "Avg days from billing to collection", "—", { cls: "warning", label: "No data source yet" }, "Finance", "Monthly"],
    ["Upfront collection", "≥50% within 30 days of admission", "Collected in first 30 days ÷ Billed", "—", { cls: "warning", label: "No data source yet" }, "Finance", "Monthly"],
    ["Installment bounce", "<3%", "Bounced installments ÷ Installments due", "—", { cls: "warning", label: "No data source yet" }, "Finance", "Monthly"],
    ["Refund rate", "<2%", "Refunds ÷ Billed", "—", { cls: "warning", label: "No data source yet" }, "Finance", "Monthly"],
    ["Cash reserve", "≥3 months opex", "Cash balance ÷ Monthly opex", "—", { cls: "warning", label: "No data source yet" }, "Director", "Monthly"],
    ["Scholarship / discount", "≤10%", "Scholarship ÷ Gross fee", act.discountPct != null ? fmtPct(act.discountPct) : "—", ragLowerBetter(act.discountPct, 0.1, 0.15), "Director", "Monthly"]
  ];

  function scenarioProfit(students: number, arpu: number) {
    const revenueLakh = (students * arpu) / 100000;
    const mktgBudgetLakh = (PLAN.mktgPct / 100) * revenueLakh;
    const studentLinkedAnnualLakh = (plan.perStudentLinked * students) / 100000;
    const totalCost = plan.peopleFy27Total + plan.fixedAnnual + studentLinkedAnnualLakh + mktgBudgetLakh;
    return { revenueLakh, mktgBudgetLakh, studentLinkedAnnualLakh, profit: revenueLakh - totalCost };
  }
  const SCENARIOS = [
    { label: "Downside", students: 450, arpu: 100000, action: "Freeze hiring; cut discretionary marketing to protect margin" },
    { label: "Base (plan)", students: 600, arpu: 110000, action: "Run the FY27 plan as built" },
    { label: "Upside", students: 700, arpu: 115000, action: "Add faculty/batches only after occupancy confirms the extra demand is real" }
  ];

  return (
    <div style={{ maxWidth: 1140, margin: "0 auto", padding: "24px 20px 60px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Annual Operating Plan &mdash; Expectations vs Actuals</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 24 }}>
        Director &amp; Owner only. Pulled live from this Fee Portal&rsquo;s own admissions data on every page load &mdash;
        last refreshed {asOf}. Figures are interpolated to today&rsquo;s date within FY27 (Apr&ndash;Mar), not a naive
        full-year-target-vs-partial-year comparison.
      </p>

      <Section title="Expectations vs Actuals" kicker="Reality check">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
          <Tile label="Students (to date)" value={`${act.totals.students} / ${fmtLakh(exp.students, 0)} expected`} />
          <Tile label="Revenue excl. GST (to date)" value={`${fmtLakh(act.totals.netExclGst / 100000, 2)} L`} sub={`vs ${fmtLakh(exp.revenueLakh, 2)} L expected`} />
          <Tile label="GST collected" value={`${fmtLakh(act.totals.gstAmount / 100000, 2)} L`} sub="pass-through, not revenue" />
          <Tile
            label="Collected (cash, incl. GST)"
            value={`${fmtLakh(act.totals.collected / 100000, 2)} L`}
            sub={act.collectionEff != null ? `Collection efficiency ${fmtPct(act.collectionEff)}` : "—"}
          />
          <Tile label="Scholarship / discount" value={fmtPct(act.discountPct)} />
          <Tile label="Actual blended ARPU (excl. GST)" value={act.arpu != null ? fmtINR(act.arpu) : "—"} sub="plan target ₹1,10,000" />
          <Tile label="Plan EBITDA (run-rate)" value={`${fmtLakh(plan.ebitda, 2)} L`} sub={`${fmtPct(plan.ebitdaMargin)} margin`} />
          <Tile label="Plan PAT (illustrative)" value={`${fmtLakh(plan.profitAfterTax, 2)} L`} sub="after loan interest + tax" />
        </div>

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
          <tfoot>
            <tr style={{ fontWeight: 700 }}>
              <td style={td}>Total</td>
              <td style={tdNum}>{plan.totalStudents}</td>
              <td style={tdNum}>{act.totals.students}</td>
              <td style={tdNum}>{fmtLakh(totTargetRevenue, 2)}</td>
              <td style={tdNum}>{fmtLakh(act.totals.netExclGst / 100000, 2)}</td>
              <td style={tdNum}>{fmtLakh(act.totals.gstAmount / 100000, 2)}</td>
              <td style={tdNum}>{fmtLakh(act.totals.collected / 100000, 2)}</td>
            </tr>
          </tfoot>
        </table>

        <ChartBlock legend={[{ label: "Expected cumulative students (plan)", color: SLOT1 }, { label: "Actual cumulative students (live)", color: SLOT2 }]}>
          <LineChart
            xLabels={PLAN.months}
            series={[
              { name: "Expected", color: SLOT1, values: expStudentsSeries },
              { name: "Actual", color: SLOT2, values: actualSeries.students }
            ]}
            includeZero
          />
        </ChartBlock>
        <ChartBlock legend={[{ label: "Expected cumulative revenue excl. GST (plan)", color: SLOT1 }, { label: "Actual cumulative revenue excl. GST (live)", color: SLOT2 }]}>
          <LineChart
            xLabels={PLAN.months}
            series={[
              { name: "Expected", color: SLOT1, values: expRevSeries },
              { name: "Actual", color: SLOT2, values: actualSeries.revenue }
            ]}
            includeZero
          />
        </ChartBlock>
        <p style={noteStyle}>
          Actual lines stop at today &mdash; nothing is projected into months that haven&rsquo;t happened yet. Enrolment
          and revenue RAG are time-adjusted against the interpolated plan-to-date; fee collection and scholarship/discount
          RAG use fixed FY27 thresholds, since those don&rsquo;t depend on how far through the year it is.
        </p>
      </Section>

      <Section title="Revenue by Program (plan)" kicker="Revenue plan">
        <ChartBlock legend={[{ label: "Target revenue by program (₹ lakh)", color: SLOT1 }]}>
          <BarChart data={PLAN.programs.map((p) => ({ label: p.name, value: (p.students * p.arpu) / 100000 }))} color={SLOT1} />
        </ChartBlock>
      </Section>

      <Section title="Annual Operating P&L (run-rate, ₹ lakh)" kicker="Plan P&L">
        <table style={tableStyle}>
          <tbody>
            <tr>
              <td style={td}>Revenue</td>
              <td style={tdNum}>{fmtLakh(plan.revenueLakh, 2)}</td>
            </tr>
            <tr>
              <td style={td}>People Cost</td>
              <td style={tdNum}>{fmtLakh(-plan.peopleFy27Total, 2)}</td>
            </tr>
            <tr>
              <td style={td}>Fixed overheads (rent/electricity/printing)</td>
              <td style={tdNum}>{fmtLakh(-plan.fixedAnnual, 2)}</td>
            </tr>
            <tr>
              <td style={td}>Student-linked costs</td>
              <td style={tdNum}>{fmtLakh(-plan.studentLinkedAnnualLakh, 2)}</td>
            </tr>
            <tr>
              <td style={td}>Marketing</td>
              <td style={tdNum}>{fmtLakh(-plan.mktgBudgetLakh, 2)}</td>
            </tr>
            <tr style={{ fontWeight: 700 }}>
              <td style={td}>EBITDA / Operating Surplus</td>
              <td style={tdNum}>
                {fmtLakh(plan.ebitda, 2)} <span style={{ fontWeight: 400, color: "#888" }}>({fmtPct(plan.ebitdaMargin)})</span>
              </td>
            </tr>
            <tr>
              <td style={td}>Term loan interest (PNB, ₹{PLAN.loanPrincipalL}L @ {PLAN.loanRatePct}%)</td>
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
              <td style={td}>Estimated tax (illustrative @ {PLAN.taxPct}% of PBT)</td>
              <td style={tdNum}>{fmtLakh(-plan.taxAmount, 2)}</td>
            </tr>
            <tr style={{ fontWeight: 700 }}>
              <td style={td}>Profit After Tax (illustrative)</td>
              <td style={tdNum}>{fmtLakh(plan.profitAfterTax, 2)}</td>
            </tr>
          </tbody>
        </table>
        <p style={noteStyle}>
          Revenue excludes GST, matching the plan&rsquo;s own pre-GST per-program ARPU figures; GST collected is tracked
          separately above as a pass-through liability. Term loan interest assumes the full ₹{PLAN.loanPrincipalL}L
          principal outstanding (no amortization schedule modeled since tenure/EMI weren&rsquo;t given). Tax is
          illustrative only &mdash; a flat rate on PBT, not a real computation of taxable income.
        </p>
      </Section>

      <Section title="Marketing Budget & Channel Split" kicker="Plan">
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Channel</th>
              <th style={thNum}>Split %</th>
              <th style={thNum}>Budget (₹L)</th>
              <th style={th}>Primary KPI</th>
            </tr>
          </thead>
          <tbody>
            {CHANNELS.map((c) => (
              <tr key={c.name}>
                <td style={td}>{c.name}</td>
                <td style={tdNum}>{fmtPct(c.pct, 0)}</td>
                <td style={tdNum}>{fmtLakh(c.pct * plan.mktgBudgetLakh, 2)}</td>
                <td style={td}>{c.kpi}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700 }}>
              <td style={td}>Total</td>
              <td style={tdNum}>100%</td>
              <td style={tdNum}>{fmtLakh(plan.mktgBudgetLakh, 2)}</td>
              <td style={td} />
            </tr>
          </tfoot>
        </table>
        <p style={noteStyle}>Acquisition guardrail: blended CAC ≤ ₹12,000; pause or shift budget off any channel running above ₹15,000 CAC.</p>
      </Section>

      <Section title="Break-even Analysis" kicker="Sensitivity">
        <table style={tableStyle}>
          <tbody>
            <tr>
              <td style={td}>Blended ARPU</td>
              <td style={tdNum}>{fmtINR(plan.blendedArpu)}</td>
            </tr>
            <tr>
              <td style={td}>Contribution / student (net of marketing % and student-linked cost)</td>
              <td style={tdNum}>{fmtINR(plan.contributionPerStudent)}</td>
            </tr>
            <tr>
              <td style={td}>Annual fixed cost (People + Rent/Electricity/Printing)</td>
              <td style={tdNum}>{fmtLakh(plan.fixedForBreakevenRupees / 100000, 2)} L</td>
            </tr>
            <tr style={{ fontWeight: 700 }}>
              <td style={td}>Break-even admissions</td>
              <td style={tdNum}>{plan.breakevenStudents != null ? plan.breakevenStudents : "—"}</td>
            </tr>
            <tr>
              <td style={td}>Operating profit at {plan.totalStudents} students</td>
              <td style={tdNum}>{fmtLakh(plan.ebitda, 2)} L</td>
            </tr>
          </tbody>
        </table>
        <ChartBlock legend={[{ label: "Operating profit (₹ lakh) — dashed line = break-even", color: SLOT1 }]}>
          <LineChart xLabels={beXs.map(String)} series={[{ name: "Operating profit", color: SLOT1, values: beYs }]} includeZero markX={beMarkIdx} />
        </ChartBlock>
      </Section>

      <Section title="Monthly Operating Plan (FY27 ramp)" kicker="Plan">
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Month</th>
              <th style={thNum}>New Enrolments</th>
              <th style={thNum}>Cumulative</th>
              <th style={thNum}>Revenue (₹L)</th>
              <th style={thNum}>Operating Surplus (₹L)</th>
            </tr>
          </thead>
          <tbody>
            {monthlyRows.map((r) => (
              <tr key={r.name}>
                <td style={td}>{r.name}</td>
                <td style={tdNum}>{r.add}</td>
                <td style={tdNum}>{r.cum}</td>
                <td style={tdNum}>{fmtLakh(r.revenue, 2)}</td>
                <td style={{ ...tdNum, color: r.surplus >= 0 ? "#006300" : "#d03b3b" }}>{fmtLakh(r.surplus, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ChartBlock legend={[{ label: "Revenue (₹ lakh)", color: SLOT1 }, { label: "Total monthly cost (₹ lakh)", color: SLOT2 }]}>
          <LineChart
            xLabels={PLAN.months}
            series={[
              { name: "Revenue", color: SLOT1, values: monthlyRows.map((r) => r.revenue) },
              { name: "Cost", color: SLOT2, values: monthlyRows.map((r) => r.people + r.fixed + r.mktg + r.studentcost) }
            ]}
          />
        </ChartBlock>
      </Section>

      <Section title="Management AOP Scorecard" kicker="Coaching-industry layer">
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Pillar</th>
              <th style={th}>FY27 Target</th>
              <th style={th}>Primary KPI</th>
              <th style={thNum}>Actual</th>
              <th style={th}>Status</th>
              <th style={th}>Owner</th>
              <th style={th}>Review</th>
            </tr>
          </thead>
          <tbody>
            {scoreRows.map((r, i) => (
              <tr key={i}>
                <td style={td}>{r[0]}</td>
                <td style={td}>{r[1]}</td>
                <td style={td}>{r[2]}</td>
                <td style={tdNum}>{r[3]}</td>
                <td style={td}>
                  <Badge rag={r[4]} />
                </td>
                <td style={td}>{r[5]}</td>
                <td style={td}>{r[6]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Admissions Funnel & CAC Plan" kicker="Acquisition">
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Funnel Stage</th>
              <th style={thNum}>Target Volume</th>
              <th style={th}>Conversion</th>
              <th style={thNum}>Actual</th>
              <th style={th}>KPI</th>
              <th style={th}>Owner</th>
            </tr>
          </thead>
          <tbody>
            {FUNNEL.map((f, i) => (
              <tr key={f.stage}>
                <td style={td}>{f.stage}</td>
                <td style={tdNum}>{f.target}</td>
                <td style={td}>{f.conv}</td>
                <td style={tdNum}>{i === FUNNEL.length - 1 ? act.totals.students : "—"}</td>
                <td style={td}>{f.kpi}</td>
                <td style={td}>{f.owner}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={noteStyle}>
          Only the final &ldquo;Paid admissions&rdquo; row has a live Actual &mdash; the Fee Portal doesn&rsquo;t track
          leads/counselling/demo stages yet.
        </p>
      </Section>

      <Section title="Batch Capacity, Faculty Utilisation & Staffing Plan" kicker="Operations">
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Metric</th>
              <th style={th}>Planning Assumption</th>
              <th style={th}>FY27 Target</th>
              <th style={th}>Trigger to Hire</th>
              <th style={th}>Trigger to Consolidate</th>
              <th style={th}>Owner</th>
              <th style={th}>Frequency</th>
            </tr>
          </thead>
          <tbody>
            {CAPACITY.map((c, i) => (
              <tr key={i}>
                {c.map((v, j) => (
                  <td style={td} key={j}>
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Collections, Working Capital & Cash Discipline" kicker="Cash">
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>KPI</th>
              <th style={th}>Target</th>
              <th style={th}>Formula / Definition</th>
              <th style={thNum}>Actual</th>
              <th style={th}>Status</th>
              <th style={th}>Owner</th>
              <th style={th}>Review</th>
            </tr>
          </thead>
          <tbody>
            {collRows.map((r, i) => (
              <tr key={i}>
                <td style={td}>{r[0]}</td>
                <td style={td}>{r[1]}</td>
                <td style={td}>{r[2]}</td>
                <td style={tdNum}>{r[3]}</td>
                <td style={td}>
                  <Badge rag={r[4]} />
                </td>
                <td style={td}>{r[5]}</td>
                <td style={td}>{r[6]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Scenario Planning & Risk Register" kicker="Scenario planning">
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Scenario</th>
              <th style={thNum}>Admissions</th>
              <th style={thNum}>Blended ARPU</th>
              <th style={thNum}>Revenue ₹Cr</th>
              <th style={thNum}>Marketing ₹L</th>
              <th style={thNum}>Student Cost ₹L</th>
              <th style={thNum}>Operating Profit ₹L</th>
              <th style={th}>Management Action</th>
            </tr>
          </thead>
          <tbody>
            {SCENARIOS.map((s) => {
              const r = scenarioProfit(s.students, s.arpu);
              return (
                <tr key={s.label}>
                  <td style={td}>{s.label}</td>
                  <td style={tdNum}>{s.students}</td>
                  <td style={tdNum}>{fmtINR(s.arpu)}</td>
                  <td style={tdNum}>{fmtLakh(r.revenueLakh / 100, 2)}</td>
                  <td style={tdNum}>{fmtLakh(r.mktgBudgetLakh, 2)}</td>
                  <td style={tdNum}>{fmtLakh(r.studentLinkedAnnualLakh, 2)}</td>
                  <td style={tdNum}>{fmtLakh(r.profit, 2)}</td>
                  <td style={td}>{s.action}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <table style={{ ...tableStyle, marginTop: 16 }}>
          <thead>
            <tr>
              <th style={th}>Risk</th>
              <th style={th}>Probability</th>
              <th style={th}>Impact</th>
              <th style={th}>Early Warning</th>
              <th style={th}>Mitigation</th>
              <th style={th}>Owner</th>
            </tr>
          </thead>
          <tbody>
            {RISK_REGISTER.map((r, i) => (
              <tr key={i}>
                {r.map((v, j) => (
                  <td style={td} key={j}>
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="What Large Coaching Operators Track" kicker="Reference">
        <p style={hintStyle}>
          Management-design lessons from how larger operators run their numbers &mdash; not a claim that S-CUBUS should
          copy another company&rsquo;s exact margins or cost ratios.
        </p>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Area</th>
              <th style={th}>What to track</th>
              <th style={th}>S-CUBUS action</th>
              <th style={th}>Industry evidence / rationale</th>
            </tr>
          </thead>
          <tbody>
            {BENCHMARKS.map((b, i) => (
              <tr key={i}>
                {b.map((v, j) => (
                  <td style={td} key={j}>
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <p style={{ fontSize: 12, color: "#999", marginTop: 8 }}>
        This page mirrors the standalone AOP tool&rsquo;s plan figures and the single calculation engine behind them, so
        the two never disagree. The plan side here (programs, people, overheads, marketing split) is a fixed read-only
        mirror of the approved FY27 plan; to experiment with different assumptions, use the editable AOP tool.
      </p>
    </div>
  );
}

const SLOT1 = "#2a78d6";
const SLOT2 = "#eb6834";

function Section({ title, kicker, children }: { title: string; kicker: string; children: React.ReactNode }) {
  return (
    <div style={cardStyle}>
      <div style={kickerStyle}>{kicker}</div>
      <h2 style={h2Style}>{title}</h2>
      {children}
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

function Badge({ rag }: { rag: Rag }) {
  const colors: Record<Rag["cls"], { bg: string; fg: string }> = {
    good: { bg: "rgba(12,163,12,0.12)", fg: "#006300" },
    warning: { bg: "rgba(250,178,25,0.16)", fg: "#8a5a00" },
    serious: { bg: "rgba(236,131,90,0.16)", fg: "#9a3d1c" },
    critical: { bg: "rgba(208,59,59,0.12)", fg: "#d03b3b" }
  };
  const c = colors[rag.cls];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: c.bg, color: c.fg, whiteSpace: "nowrap" }}>
      {rag.label}
    </span>
  );
}

function ChartBlock({ legend, children }: { legend: { label: string; color: string }[]; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 18, marginBottom: 6 }}>
      <div style={{ display: "flex", gap: 16, fontSize: 12.5, color: "#666", marginBottom: 8, flexWrap: "wrap" }}>
        {legend.map((l) => (
          <span key={l.label}>
            <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: l.color, marginRight: 5 }} />
            {l.label}
          </span>
        ))}
      </div>
      {children}
    </div>
  );
}

function LineChart({
  xLabels,
  series,
  height = 200,
  includeZero,
  markX
}: {
  xLabels: string[];
  series: { name: string; color: string; values: (number | null)[] }[];
  height?: number;
  includeZero?: boolean;
  markX?: number;
}) {
  const W = 1000;
  const H = height;
  const padL = 10;
  const padR = 10;
  const padT = 14;
  const padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const allVals: number[] = [];
  series.forEach((s) => s.values.forEach((v) => { if (v != null && !isNaN(v)) allVals.push(v); }));
  if (includeZero) allVals.push(0);
  let maxV = Math.max(0, ...allVals);
  let minV = Math.min(0, ...allVals);
  if (maxV === minV) maxV += 1;
  const range = maxV - minV;
  const n = xLabels.length;
  const xPos = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * innerW);
  const yPos = (v: number) => padT + innerH - ((v - minV) / range) * innerH;
  const labelStep = Math.max(1, Math.ceil(n / 14));
  const markerStep = Math.max(1, Math.ceil(n / 24));

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {minV < 0 && maxV > 0 && (
        <line x1={padL} y1={yPos(0)} x2={W - padR} y2={yPos(0)} stroke="#c3c2b7" strokeWidth={1} strokeDasharray="4,4" />
      )}
      {markX != null && markX >= 0 && (
        <line x1={xPos(markX)} y1={padT} x2={xPos(markX)} y2={padT + innerH} stroke="#898781" strokeWidth={1} strokeDasharray="3,3" />
      )}
      {series.map((s, si) => {
        const runs: number[][] = [];
        let cur: number[] = [];
        s.values.forEach((v, i) => {
          if (v == null || isNaN(v)) {
            if (cur.length) {
              runs.push(cur);
              cur = [];
            }
          } else cur.push(i);
        });
        if (cur.length) runs.push(cur);
        return (
          <g key={si}>
            {runs.map((run, ri) => (
              <polyline
                key={ri}
                points={run.map((i) => `${xPos(i)},${yPos(s.values[i] as number)}`).join(" ")}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {s.values.map((v, i) => {
              if (v == null || isNaN(v)) return null;
              const isRunEnd = i === n - 1 || s.values[i + 1] == null || isNaN(s.values[i + 1] as number);
              if (i % markerStep !== 0 && !isRunEnd) return null;
              return (
                <circle key={i} cx={xPos(i)} cy={yPos(v)} r={3} fill={s.color}>
                  <title>{`${xLabels[i]} — ${s.name}: ${fmtLakh(v, 1)}`}</title>
                </circle>
              );
            })}
          </g>
        );
      })}
      {xLabels.map((lab, i) => {
        if (i % labelStep !== 0 && i !== n - 1) return null;
        return (
          <text key={i} x={xPos(i)} y={H - 10} textAnchor="middle" fontSize="10.5" fill="#666">
            {lab}
          </text>
        );
      })}
    </svg>
  );
}

function BarChart({ data, height = 190, color }: { data: { label: string; value: number }[]; height?: number; color: string }) {
  const W = 1000;
  const H = height;
  const padL = 10;
  const padR = 10;
  const padT = 10;
  const padB = 34;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const maxV = Math.max(1, ...data.map((d) => d.value));
  const n = data.length;
  const gap = 10;
  const bw = (innerW - gap * (n - 1)) / n;
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {data.map((d, i) => {
        const h = maxV > 0 ? (d.value / maxV) * (innerH - 16) : 0;
        const x = padL + i * (bw + gap);
        const y = padT + (innerH - h);
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={Math.max(h, 1)} rx={4} ry={4} fill={color}>
              <title>{`${d.label}: ${fmtLakh(d.value, 1)} L`}</title>
            </rect>
            <text x={x + bw / 2} y={H - 18} textAnchor="middle" fontSize="10.5" fill="#666">
              {d.label}
            </text>
            <text x={x + bw / 2} y={y - 4} textAnchor="middle" fontSize="9.5" fill="#999">
              {fmtLakh(d.value, 0)}
            </text>
          </g>
        );
      })}
      <line x1={padL} y1={padT + innerH} x2={W - padR} y2={padT + innerH} stroke="#c3c2b7" strokeWidth={1} />
    </svg>
  );
}

const cardStyle: CSSProperties = { background: "#fff", border: "1px solid #e3e3e0", borderRadius: 14, padding: "20px 22px", marginBottom: 22 };
const kickerStyle: CSSProperties = { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, color: "#999", fontWeight: 600 };
const hintStyle: CSSProperties = { fontSize: 13, color: "#666", margin: "4px 0 16px", lineHeight: 1.5 };
const noteStyle: CSSProperties = { fontSize: 12.5, color: "#888", marginTop: 10, lineHeight: 1.5 };
const h2Style: CSSProperties = { fontSize: 16, margin: "0 0 14px" };
const tableStyle: CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13.5 };
const th: CSSProperties = { textAlign: "left", padding: "7px 10px", borderBottom: "1px solid #ddd", fontSize: 11.5, textTransform: "uppercase", color: "#888" };
const thNum: CSSProperties = { ...th, textAlign: "right" };
const td: CSSProperties = { padding: "7px 10px", borderBottom: "1px solid #eee" };
const tdNum: CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };
