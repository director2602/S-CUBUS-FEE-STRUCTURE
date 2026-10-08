"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dqgwafdihafcttynfaea.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxZ3dhZmRpaGFmY3R0eW5mYWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNjEwOTMsImV4cCI6MjEwNTYzNzA5M30._n-FGaXFyi3c1NxBDI0-DFfUA2nyqFhmELFc1LJat28";

// ---------- Theme tokens (validated status/categorical palette; dark steps are the same
// hues re-stepped for the dark surface, not a separate palette) ----------
type Theme = {
  pagePlane: string;
  surface: string;
  surfaceAlt: string;
  textPrimary: string;
  textSecondary: string;
  muted: string;
  gridline: string;
  baseline: string;
  border: string;
  series1: string;
  series2: string;
  good: string;
  warning: string;
  critical: string;
  successText: string;
  badgeGoodBg: string;
  badgeWarnBg: string;
  badgeCritBg: string;
};
const LIGHT: Theme = {
  pagePlane: "#f9f9f7",
  surface: "#ffffff",
  surfaceAlt: "#f4f1f8",
  textPrimary: "#0b0b0b",
  textSecondary: "#52514e",
  muted: "#898781",
  gridline: "#e1e0d9",
  baseline: "#c3c2b7",
  border: "rgba(11,11,11,0.10)",
  series1: "#2a78d6",
  series2: "#eb6834",
  good: "#0ca30c",
  warning: "#fab219",
  critical: "#d03b3b",
  successText: "#006300",
  badgeGoodBg: "rgba(12,163,12,0.12)",
  badgeWarnBg: "rgba(250,178,25,0.18)",
  badgeCritBg: "rgba(208,59,59,0.12)"
};
const DARK: Theme = {
  pagePlane: "#0d0d0d",
  surface: "#1a1a19",
  surfaceAlt: "#242321",
  textPrimary: "#ffffff",
  textSecondary: "#c3c2b7",
  muted: "#898781",
  gridline: "#2c2c2a",
  baseline: "#383835",
  border: "rgba(255,255,255,0.10)",
  series1: "#3987e5",
  series2: "#d95926",
  good: "#0ca30c",
  warning: "#fab219",
  critical: "#d03b3b",
  successText: "#0ca30c",
  badgeGoodBg: "rgba(12,163,12,0.22)",
  badgeWarnBg: "rgba(250,178,25,0.24)",
  badgeCritBg: "rgba(208,59,59,0.22)"
};

// ---------- FY27 reference constants that are NOT yet modeled in the Annual Plan tables
// (debt is a financing decision, not an operating assumption) ----------
const LOAN_PRINCIPAL_L = 35;
const LOAN_RATE_PCT = 10;
const CC_LIMIT_L = 125;
const CC_USED_L = 0;
const CC_RATE_PCT = 10;

const MONTH_NAMES = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
const RAMP_SHAPE = [80, 70, 60, 55, 50, 45, 45, 40, 40, 35, 30, 20];
const OPENING = 30;

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

type Assumptions = {
  fiscal_year: string;
  students: number;
  avg_fee: number;
  growth_rate: number;
  teaching_pct: number;
  marketing_pct: number;
  admin_pct: number;
  rent_monthly: number;
  other_fixed_monthly: number;
  tax_rate: number;
};
const DEFAULT_ASSUMPTIONS: Assumptions = {
  fiscal_year: "",
  students: 600,
  avg_fee: 110000,
  growth_rate: 16,
  teaching_pct: 20,
  marketing_pct: 8,
  admin_pct: 12,
  rent_monthly: 315000,
  other_fixed_monthly: 500000,
  tax_rate: 25
};

type StaffRow = { id: string; role: string; department: string | null; headcount: number; monthly_salary: number; sort_order: number };
type ActualCostRow = {
  month_index: number;
  teaching_cost: number;
  marketing_cost: number;
  admin_cost: number;
  rent: number;
  other_overheads: number;
};

function currentFiscalYear(d = new Date()): string {
  const y = d.getFullYear();
  const m = d.getMonth(); // 0 = Jan
  if (m >= 3) return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
  return `${y - 1}-${String(y % 100).padStart(2, "0")}`;
}

function computePlan(a: Assumptions) {
  const revenueLakh = (a.students * a.avg_fee) / 100000;
  const teachingLakh = (revenueLakh * a.teaching_pct) / 100;
  const marketingLakh = (revenueLakh * a.marketing_pct) / 100;
  const adminLakh = (revenueLakh * a.admin_pct) / 100;
  const rentAnnualLakh = (a.rent_monthly * 12) / 100000;
  const otherFixedAnnualLakh = (a.other_fixed_monthly * 12) / 100000;
  const totalOperatingCost = teachingLakh + marketingLakh + adminLakh + rentAnnualLakh + otherFixedAnnualLakh;
  const ebitda = revenueLakh - totalOperatingCost;
  const ebitdaMargin = revenueLakh > 0 ? ebitda / revenueLakh : 0;
  const blendedArpu = a.avg_fee;
  const contributionMarginPct = 1 - (a.teaching_pct + a.marketing_pct + a.admin_pct) / 100;
  const fixedForBreakevenLakh = rentAnnualLakh + otherFixedAnnualLakh;
  const breakevenRevenueLakh = contributionMarginPct > 0 ? fixedForBreakevenLakh / contributionMarginPct : null;
  const breakevenStudents = breakevenRevenueLakh != null ? Math.ceil((breakevenRevenueLakh * 100000) / a.avg_fee) : null;
  const termLoanInterest = (LOAN_PRINCIPAL_L * LOAN_RATE_PCT) / 100;
  const ccInterest = (CC_USED_L * CC_RATE_PCT) / 100;
  const financeCost = termLoanInterest + ccInterest;
  const pbt = ebitda - financeCost;
  const taxAmount = pbt > 0 ? (pbt * a.tax_rate) / 100 : 0;
  const profitAfterTax = pbt - taxAmount;
  return {
    totalStudents: a.students,
    revenueLakh,
    teachingLakh,
    marketingLakh,
    adminLakh,
    rentAnnualLakh,
    otherFixedAnnualLakh,
    totalOperatingCost,
    ebitda,
    ebitdaMargin,
    blendedArpu,
    contributionMarginPct,
    fixedForBreakevenLakh,
    breakevenStudents,
    termLoanInterest,
    ccInterest,
    financeCost,
    pbt,
    taxAmount,
    profitAfterTax
  };
}
type Plan = ReturnType<typeof computePlan>;

type MonthRow = { name: string; add: number; cum: number; revenue: number; teaching: number; marketing: number; admin: number; fixed: number; surplus: number };
function computeMonthly(plan: Plan, a: Assumptions): MonthRow[] {
  const newTotal = Math.max(0, a.students - OPENING);
  const shapeTotal = RAMP_SHAPE.reduce((s, v) => s + v, 0);
  const monthlyNew = RAMP_SHAPE.map((v) => Math.round((v / shapeTotal) * newTotal));
  let cum = OPENING;
  const teachingMonthly = plan.teachingLakh / 12;
  const marketingMonthly = plan.marketingLakh / 12;
  const adminMonthly = plan.adminLakh / 12;
  const fixedMonthly = (plan.rentAnnualLakh + plan.otherFixedAnnualLakh) / 12;
  return MONTH_NAMES.map((name, i) => {
    const prevCum = cum;
    const add = monthlyNew[i];
    cum = prevCum + add;
    const avgCum = (prevCum + cum) / 2;
    const revenue = (avgCum * plan.blendedArpu) / 12 / 100000;
    const surplus = revenue - teachingMonthly - marketingMonthly - adminMonthly - fixedMonthly;
    return { name, add, cum, revenue, teaching: teachingMonthly, marketing: marketingMonthly, admin: adminMonthly, fixed: fixedMonthly, surplus };
  });
}

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
  const monthStartCum = floorIdx === 0 ? OPENING : monthlyRows[floorIdx - 1].cum;
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
    return "Foundation (other)";
  }
  if (batchGroup === "NEET") {
    if (lbl.includes("repeat")) return "NEET Repeater";
    if (lbl.includes("11")) return "11th NEET";
    if (lbl.includes("12")) return "12th NEET";
    return "NEET (other)";
  }
  if (batchGroup === "JEE") {
    if (lbl.includes("repeat")) return "JEE Repeater";
    if (lbl.includes("11")) return "11th JEE";
    if (lbl.includes("12")) return "12th JEE";
    return "JEE (other)";
  }
  return batchGroup || "Other";
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

type RagCls = "good" | "warning" | "critical";
type Rag = { cls: RagCls; label: string };
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
function ragColor(t: Theme, cls: RagCls) {
  return cls === "good" ? t.good : cls === "warning" ? t.warning : t.critical;
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
type ActualAgg = { students: number; gross: number; scholarship: number; netExclGst: number; gstAmount: number; actualPayable: number; collected: number };
function emptyAgg(): ActualAgg {
  return { students: 0, gross: 0, scholarship: 0, netExclGst: 0, gstAmount: 0, actualPayable: 0, collected: 0 };
}

export default function AopActualsPage() {
  const [status, setStatus] = useState<"loading" | "denied" | "error" | "ready">("loading");
  const [rows, setRows] = useState<AdmissionRow[]>([]);
  const [assumptions, setAssumptions] = useState<Assumptions>(DEFAULT_ASSUMPTIONS);
  const [assumptionsLive, setAssumptionsLive] = useState(false);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [actualCosts, setActualCosts] = useState<ActualCostRow[]>([]);
  const [asOf, setAsOf] = useState("");
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("scubus-aop-theme");
      if (saved === "dark") setDark(true);
      else if (saved === "light") setDark(false);
      else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) setDark(true);
    } catch {
      /* ignore */
    }
  }, []);
  function toggleDark() {
    setDark((d) => {
      try {
        window.localStorage.setItem("scubus-aop-theme", !d ? "dark" : "light");
      } catch {
        /* ignore */
      }
      return !d;
    });
  }
  const T = dark ? DARK : LIGHT;

  useEffect(() => {
    const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const fy = currentFiscalYear();
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
      const [admRes, assumpRes, staffRes, costsRes] = await Promise.all([
        supabase
          .from("admissions_computed")
          .select("batch_key,batch_label,batch_group,admission_date,gross_fee,scholarship_amount,net_excl_gst,gst_amount,actual_payable,total_paid"),
        supabase.from("aop_assumptions").select("*").eq("fiscal_year", fy).maybeSingle(),
        supabase.from("aop_staff").select("id,role,department,headcount,monthly_salary,sort_order").eq("fiscal_year", fy).order("sort_order"),
        supabase.from("aop_actual_costs").select("month_index,teaching_cost,marketing_cost,admin_cost,rent,other_overheads").eq("fiscal_year", fy)
      ]);
      if (admRes.error) {
        setStatus("error");
        return;
      }
      setRows((admRes.data || []) as AdmissionRow[]);
      if (!assumpRes.error && assumpRes.data) {
        setAssumptions({ ...DEFAULT_ASSUMPTIONS, ...(assumpRes.data as any) });
        setAssumptionsLive(true);
      } else {
        setAssumptions({ ...DEFAULT_ASSUMPTIONS, fiscal_year: fy });
        setAssumptionsLive(false);
      }
      if (!staffRes.error) setStaff((staffRes.data || []) as StaffRow[]);
      if (!costsRes.error) setActualCosts((costsRes.data || []) as ActualCostRow[]);
      setAsOf(new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }));
      setStatus("ready");
    })();
  }, []);

  const plan = useMemo(() => computePlan(assumptions), [assumptions]);
  const monthlyRows = useMemo(() => computeMonthly(plan, assumptions), [plan, assumptions]);
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
      if (!byProgram[pname]) byProgram[pname] = emptyAgg();
      const bp = byProgram[pname];
      bp.students += 1;
      bp.gross += Number(r.gross_fee) || 0;
      bp.scholarship += Number(r.scholarship_amount) || 0;
      bp.netExclGst += Number(r.net_excl_gst) || 0;
      bp.gstAmount += Number(r.gst_amount) || 0;
      bp.actualPayable += Number(r.actual_payable) || 0;
      bp.collected += Number(r.total_paid) || 0;
    });
    const collectionEff = totals.actualPayable > 0 ? totals.collected / totals.actualPayable : null;
    const discountPct = totals.gross > 0 ? totals.scholarship / totals.gross : null;
    const arpu = totals.students > 0 ? totals.netExclGst / totals.students : null;
    return { totals, byProgram, collectionEff, discountPct, arpu };
  }, [rows]);

  // ---- Plan-to-date vs Actual-to-date P&L ----
  const costsBasis = useMemo(() => {
    const monthIdx = Math.max(0, Math.min(11, Math.floor(fyProg)));
    const toDate = actualCosts.filter((c) => c.month_index <= monthIdx);
    if (toDate.length > 0) {
      const sum = toDate.reduce(
        (s, c) => ({
          teaching: s.teaching + (Number(c.teaching_cost) || 0),
          marketing: s.marketing + (Number(c.marketing_cost) || 0),
          admin: s.admin + (Number(c.admin_cost) || 0),
          rent: s.rent + (Number(c.rent) || 0),
          other: s.other + (Number(c.other_overheads) || 0)
        }),
        { teaching: 0, marketing: 0, admin: 0, rent: 0, other: 0 }
      );
      return {
        source: "live" as const,
        teachingLakh: sum.teaching / 100000,
        marketingLakh: sum.marketing / 100000,
        adminLakh: sum.admin / 100000,
        fixedLakh: (sum.rent + sum.other) / 100000
      };
    }
    const frac = fyProg / 12;
    return {
      source: "estimated" as const,
      teachingLakh: plan.teachingLakh * frac,
      marketingLakh: plan.marketingLakh * frac,
      adminLakh: plan.adminLakh * frac,
      fixedLakh: (plan.rentAnnualLakh + plan.otherFixedAnnualLakh) * frac
    };
  }, [actualCosts, fyProg, plan]);

  const planToDate = useMemo(() => {
    const frac = fyProg / 12;
    const revenueLakh = exp.revenueLakh;
    const opex = plan.teachingLakh * frac + plan.marketingLakh * frac + plan.adminLakh * frac + (plan.rentAnnualLakh + plan.otherFixedAnnualLakh) * frac;
    const ebitda = revenueLakh - opex;
    const financeCost = plan.financeCost * frac;
    const pbt = ebitda - financeCost;
    const taxAmount = pbt > 0 ? (pbt * assumptions.tax_rate) / 100 : 0;
    const pat = pbt - taxAmount;
    return { revenueLakh, opex, ebitda, financeCost, pbt, taxAmount, pat };
  }, [fyProg, exp, plan, assumptions.tax_rate]);

  const actualToDate = useMemo(() => {
    const revenueLakh = act.totals.netExclGst / 100000;
    const opex = costsBasis.teachingLakh + costsBasis.marketingLakh + costsBasis.adminLakh + costsBasis.fixedLakh;
    const ebitda = revenueLakh - opex;
    const financeCost = plan.financeCost * (fyProg / 12);
    const pbt = ebitda - financeCost;
    const taxAmount = pbt > 0 ? (pbt * assumptions.tax_rate) / 100 : 0;
    const pat = pbt - taxAmount;
    return { revenueLakh, opex, ebitda, financeCost, pbt, taxAmount, pat };
  }, [act, costsBasis, plan.financeCost, fyProg, assumptions.tax_rate]);

  const studentsRatio = exp.students > 0 ? act.totals.students / exp.students : null;
  const revenueRatio = planToDate.revenueLakh > 0 ? actualToDate.revenueLakh / planToDate.revenueLakh : null;
  const ebitdaRatio = planToDate.ebitda > 0 ? actualToDate.ebitda / planToDate.ebitda : null;
  const pbtRatio = planToDate.pbt > 0 ? actualToDate.pbt / planToDate.pbt : null;
  const patRatio = planToDate.pat > 0 ? actualToDate.pat / planToDate.pat : null;
  const arpuRatio = act.arpu != null && plan.blendedArpu > 0 ? act.arpu / plan.blendedArpu : null;
  const studentsRag = ragHigherBetter(studentsRatio, 0.95, 0.75);
  const revenueRag = ragHigherBetter(revenueRatio, 0.95, 0.75);
  const ebitdaRag = ragHigherBetter(ebitdaRatio, 0.9, 0.7);
  const pbtRag = ragHigherBetter(pbtRatio, 0.9, 0.7);
  const patRag = ragHigherBetter(patRatio, 0.9, 0.7);

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
    beYs.push(n * (plan.blendedArpu / 100000) * plan.contributionMarginPct - plan.fixedForBreakevenLakh);
  }

  const scoreRows: { label: string; target: string; kpi: string; actual: string; rag: Rag; owner: string; freq: string }[] = [
    { label: "Enrolment", target: `${plan.totalStudents} students by Mar`, kpi: "Cumulative paid admissions vs plan-to-date", actual: `${act.totals.students} / ${fmtLakh(exp.students, 0)} expected`, rag: studentsRag, owner: "Director", freq: "Weekly" },
    { label: "Revenue (excl. GST)", target: `${fmtLakh(plan.revenueLakh, 0)} L run-rate`, kpi: "Cumulative revenue vs plan-to-date", actual: `${fmtLakh(actualToDate.revenueLakh, 2)} / ${fmtLakh(planToDate.revenueLakh, 2)} L expected`, rag: revenueRag, owner: "Director", freq: "Weekly" },
    { label: "EBITDA", target: `${fmtLakh(plan.ebitda, 0)} L run-rate`, kpi: "Actual-to-date vs plan-to-date EBITDA", actual: `${fmtLakh(actualToDate.ebitda, 2)} / ${fmtLakh(planToDate.ebitda, 2)} L`, rag: ebitdaRag, owner: "Director", freq: "Monthly" },
    { label: "PBT", target: `${fmtLakh(plan.pbt, 0)} L run-rate`, kpi: "Actual-to-date vs plan-to-date PBT", actual: `${fmtLakh(actualToDate.pbt, 2)} / ${fmtLakh(planToDate.pbt, 2)} L`, rag: pbtRag, owner: "Director", freq: "Monthly" },
    { label: "PAT", target: `${fmtLakh(plan.profitAfterTax, 0)} L run-rate`, kpi: "Actual-to-date vs plan-to-date PAT", actual: `${fmtLakh(actualToDate.pat, 2)} / ${fmtLakh(planToDate.pat, 2)} L`, rag: patRag, owner: "Director", freq: "Monthly" },
    { label: "Blended ARPU", target: fmtINR(plan.blendedArpu), kpi: "Actual revenue excl. GST ÷ actual students", actual: act.arpu != null ? fmtINR(act.arpu) : "—", rag: ragHigherBetter(arpuRatio, 0.95, 0.85), owner: "Director", freq: "Monthly" },
    { label: "Break-even", target: "Admissions needed to cover fixed cost", kpi: "Students × contribution margin = fixed cost", actual: plan.breakevenStudents != null ? `${plan.breakevenStudents} students` : "—", rag: ragHigherBetter(plan.breakevenStudents != null ? plan.totalStudents / plan.breakevenStudents : null, 1, 0.85), owner: "Director", freq: "Monthly" },
    { label: "Fee collection", target: "≥95% green / 90–94% amber / <90% red", kpi: "Collected ÷ Billed", actual: act.collectionEff != null ? fmtPct(act.collectionEff) : "—", rag: ragHigherBetter(act.collectionEff, 0.95, 0.9), owner: "Finance", freq: "Weekly" },
    { label: "Scholarship / discount", target: "≤10% green / 10–15% amber / >15% red", kpi: "Scholarship ÷ Gross fee", actual: act.discountPct != null ? fmtPct(act.discountPct) : "—", rag: ragLowerBetter(act.discountPct, 0.1, 0.15), owner: "Director", freq: "Monthly" },
    { label: "Teaching cost", target: `${assumptions.teaching_pct}% of revenue (per Annual Plan)`, kpi: "Set by the Annual Plan assumptions", actual: "Per Plan", rag: { cls: "good", label: "Per Plan" }, owner: "Director", freq: "Monthly" },
    { label: "Marketing cost", target: `${assumptions.marketing_pct}% of revenue (per Annual Plan)`, kpi: "Set by the Annual Plan assumptions", actual: "Per Plan", rag: { cls: "good", label: "Per Plan" }, owner: "Marketing", freq: "Monthly" },
    { label: "Admin cost", target: `${assumptions.admin_pct}% of revenue (per Annual Plan)`, kpi: "Set by the Annual Plan assumptions", actual: "Per Plan", rag: { cls: "good", label: "Per Plan" }, owner: "Admin", freq: "Monthly" },
    { label: "Debt servicing", target: "PNB term loan ₹35L + CC limit ₹1.25Cr @ 10%", kpi: "Finance cost ÷ EBITDA", actual: fmtPct(plan.ebitda > 0 ? plan.financeCost / plan.ebitda : null), rag: ragLowerBetter(plan.ebitda > 0 ? plan.financeCost / plan.ebitda : null, 0.1, 0.2), owner: "Director", freq: "Monthly" }
  ];

  const collRows: { label: string; target: string; kpi: string; actual: string; rag: Rag; owner: string; freq: string }[] = [
    { label: "Collection efficiency", target: "≥95%", kpi: "Collected ÷ Billed", actual: act.collectionEff != null ? fmtPct(act.collectionEff) : "—", rag: ragHigherBetter(act.collectionEff, 0.95, 0.85), owner: "Finance", freq: "Weekly" },
    { label: "Scholarship / discount", target: "≤10%", kpi: "Scholarship ÷ Gross fee", actual: act.discountPct != null ? fmtPct(act.discountPct) : "—", rag: ragLowerBetter(act.discountPct, 0.1, 0.15), owner: "Director", freq: "Monthly" },
    { label: "Cash reserve", target: "≥3 months opex", kpi: "Cash balance ÷ Monthly opex", actual: "—", rag: { cls: "warning", label: "No data source yet" }, owner: "Director", freq: "Monthly" },
    { label: "Refund rate", target: "<2%", kpi: "Refunds ÷ Billed", actual: "—", rag: { cls: "warning", label: "No data source yet" }, owner: "Finance", freq: "Monthly" }
  ];

  function scenarioProfit(students: number, arpu: number) {
    const revenueLakh = (students * arpu) / 100000;
    const marketingLakh = (revenueLakh * assumptions.marketing_pct) / 100;
    const teachingLakh = (revenueLakh * assumptions.teaching_pct) / 100;
    const adminLakh = (revenueLakh * assumptions.admin_pct) / 100;
    const profit = revenueLakh - teachingLakh - marketingLakh - adminLakh - plan.fixedForBreakevenLakh;
    return { revenueLakh, marketingLakh, teachingLakh, adminLakh, profit };
  }
  const SCENARIOS = [
    { label: "Downside", students: Math.round(plan.totalStudents * 0.75), arpu: Math.round(plan.blendedArpu * 0.9), action: "Freeze hiring; cut discretionary marketing to protect margin" },
    { label: "Base (plan)", students: plan.totalStudents, arpu: plan.blendedArpu, action: "Run the FY27 plan as built" },
    { label: "Upside", students: Math.round(plan.totalStudents * 1.17), arpu: Math.round(plan.blendedArpu * 1.05), action: "Add faculty/batches only after occupancy confirms the extra demand is real" }
  ];

  const staffAnnualTotal = staff.reduce((s, r) => s + (Number(r.headcount) || 0) * (Number(r.monthly_salary) || 0) * 12, 0) / 100000;

  return (
    <div style={{ background: T.pagePlane, minHeight: "100vh" }}>
      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "24px 20px 60px", fontFamily: "system-ui, sans-serif", color: T.textPrimary }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 4 }}>
          <div>
            <h1 style={{ fontSize: 20, margin: 0 }}>Annual Operating Plan &mdash; Expectations vs Actuals</h1>
            <p style={{ color: T.textSecondary, fontSize: 13, marginTop: 6, marginBottom: 0 }}>
              Director &amp; Owner only. Plan figures load live from the Annual Plan assumptions ({assumptions.fiscal_year || currentFiscalYear()}
              {assumptionsLive ? "" : " — no saved assumptions found, showing defaults"}); actuals load live from admissions &mdash; last refreshed {asOf}.
            </p>
          </div>
          <button
            onClick={toggleDark}
            style={{
              flexShrink: 0,
              border: `1px solid ${T.border}`,
              background: T.surface,
              color: T.textPrimary,
              borderRadius: 999,
              padding: "6px 14px",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            {dark ? "☀ Light mode" : "☾ Dark mode"}
          </button>
        </div>

        <Section T={T} title="Expectations vs Actuals" kicker="Reality check">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
            <Tile T={T} label="Students (to date)" value={`${act.totals.students} / ${fmtLakh(exp.students, 0)} expected`} rag={studentsRag} />
            <Tile T={T} label="Revenue excl. GST (to date)" value={`${fmtLakh(actualToDate.revenueLakh, 2)} L`} sub={`vs ${fmtLakh(planToDate.revenueLakh, 2)} L expected`} rag={revenueRag} />
            <Tile T={T} label="GST collected" value={`${fmtLakh(act.totals.gstAmount / 100000, 2)} L`} sub="pass-through, not revenue" />
            <Tile T={T} label="Collected (cash, incl. GST)" value={`${fmtLakh(act.totals.collected / 100000, 2)} L`} sub={act.collectionEff != null ? `Collection efficiency ${fmtPct(act.collectionEff)}` : "—"} />
            <Tile T={T} label="Scholarship / discount" value={fmtPct(act.discountPct)} />
            <Tile T={T} label="Actual blended ARPU" value={act.arpu != null ? fmtINR(act.arpu) : "—"} sub={`plan target ${fmtINR(plan.blendedArpu)}`} />
            <Tile T={T} label="EBITDA (to date)" value={`${fmtLakh(actualToDate.ebitda, 2)} L`} sub={`vs ${fmtLakh(planToDate.ebitda, 2)} L plan`} rag={ebitdaRag} />
            <Tile T={T} label="PAT (to date)" value={`${fmtLakh(actualToDate.pat, 2)} L`} sub={`vs ${fmtLakh(planToDate.pat, 2)} L plan`} rag={patRag} />
          </div>

          <table style={tableStyle(T)}>
            <thead>
              <tr>
                <th style={th(T)}>Program</th>
                <th style={thNum(T)}>Students</th>
                <th style={thNum(T)}>Revenue excl. GST (₹L)</th>
                <th style={thNum(T)}>GST (₹L)</th>
                <th style={thNum(T)}>Collected (₹L)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(act.byProgram).map(([name, a]) => (
                <tr key={name}>
                  <td style={td(T)}>{name}</td>
                  <td style={tdNum(T)}>{a.students}</td>
                  <td style={tdNum(T)}>{fmtLakh(a.netExclGst / 100000, 2)}</td>
                  <td style={tdNum(T)}>{fmtLakh(a.gstAmount / 100000, 2)}</td>
                  <td style={tdNum(T)}>{fmtLakh(a.collected / 100000, 2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700 }}>
                <td style={td(T)}>Total (actual, live)</td>
                <td style={tdNum(T)}>{act.totals.students}</td>
                <td style={tdNum(T)}>{fmtLakh(act.totals.netExclGst / 100000, 2)}</td>
                <td style={tdNum(T)}>{fmtLakh(act.totals.gstAmount / 100000, 2)}</td>
                <td style={tdNum(T)}>{fmtLakh(act.totals.collected / 100000, 2)}</td>
              </tr>
            </tfoot>
          </table>

          <RagChartBlock T={T} title="Cumulative students: Expected (plan) vs Actual (live)" status={studentsRag}>
            <LineChart
              T={T}
              xLabels={MONTH_NAMES}
              expected={{ name: "Expected", values: expStudentsSeries }}
              actual={{ name: "Actual", values: actualSeries.students, status: studentsRag.cls }}
              includeZero
            />
          </RagChartBlock>
          <RagChartBlock T={T} title="Cumulative revenue excl. GST (₹L): Expected (plan) vs Actual (live)" status={revenueRag}>
            <LineChart
              T={T}
              xLabels={MONTH_NAMES}
              expected={{ name: "Expected", values: expRevSeries }}
              actual={{ name: "Actual", values: actualSeries.revenue, status: revenueRag.cls }}
              includeZero
            />
          </RagChartBlock>
          <p style={noteStyle(T)}>
            The Actual line is colour-coded to its current RAG status (green = on track ≥95% of plan-to-date, amber = watch
            75&ndash;94%, red = behind &lt;75%) and stops at today &mdash; nothing is projected into months that
            haven&rsquo;t happened yet.
          </p>
        </Section>

        <Section T={T} title="Plan vs Actual P&L (₹ lakh, year-to-date)" kicker="Actuals">
          <table style={tableStyle(T)}>
            <thead>
              <tr>
                <th style={th(T)}>Line item</th>
                <th style={thNum(T)}>Plan (to date)</th>
                <th style={thNum(T)}>Actual (to date)</th>
                <th style={th(T)}>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={td(T)}>Revenue (excl. GST)</td>
                <td style={tdNum(T)}>{fmtLakh(planToDate.revenueLakh, 2)}</td>
                <td style={tdNum(T)}>{fmtLakh(actualToDate.revenueLakh, 2)}</td>
                <td style={td(T)}>
                  <Badge T={T} rag={revenueRag} />
                </td>
              </tr>
              <tr>
                <td style={td(T)}>Operating cost (teaching + marketing + admin + fixed)</td>
                <td style={tdNum(T)}>{fmtLakh(-planToDate.opex, 2)}</td>
                <td style={tdNum(T)}>{fmtLakh(-actualToDate.opex, 2)}</td>
                <td style={td(T)}>
                  <span style={{ fontSize: 11, color: T.muted }}>{costsBasis.source === "live" ? "Live actuals" : "Estimated (time-prorated)"}</span>
                </td>
              </tr>
              <tr style={{ fontWeight: 700 }}>
                <td style={td(T)}>EBITDA</td>
                <td style={tdNum(T)}>{fmtLakh(planToDate.ebitda, 2)}</td>
                <td style={tdNum(T)}>{fmtLakh(actualToDate.ebitda, 2)}</td>
                <td style={td(T)}>
                  <Badge T={T} rag={ebitdaRag} />
                </td>
              </tr>
              <tr>
                <td style={td(T)}>Finance cost (term loan + CC interest, time-prorated)</td>
                <td style={tdNum(T)}>{fmtLakh(-planToDate.financeCost, 2)}</td>
                <td style={tdNum(T)}>{fmtLakh(-actualToDate.financeCost, 2)}</td>
                <td style={td(T)} />
              </tr>
              <tr style={{ fontWeight: 700 }}>
                <td style={td(T)}>PBT</td>
                <td style={tdNum(T)}>{fmtLakh(planToDate.pbt, 2)}</td>
                <td style={tdNum(T)}>{fmtLakh(actualToDate.pbt, 2)}</td>
                <td style={td(T)}>
                  <Badge T={T} rag={pbtRag} />
                </td>
              </tr>
              <tr>
                <td style={td(T)}>Estimated tax (@ {assumptions.tax_rate}% of PBT)</td>
                <td style={tdNum(T)}>{fmtLakh(-planToDate.taxAmount, 2)}</td>
                <td style={tdNum(T)}>{fmtLakh(-actualToDate.taxAmount, 2)}</td>
                <td style={td(T)} />
              </tr>
              <tr style={{ fontWeight: 700 }}>
                <td style={td(T)}>PAT</td>
                <td style={tdNum(T)}>{fmtLakh(planToDate.pat, 2)}</td>
                <td style={tdNum(T)}>{fmtLakh(actualToDate.pat, 2)}</td>
                <td style={td(T)}>
                  <Badge T={T} rag={patRag} />
                </td>
              </tr>
            </tbody>
          </table>
          <RagChartBlock T={T} title="EBITDA · PBT · PAT — Plan (to date) vs Actual (to date), ₹L" status={ebitdaRag}>
            <GroupedBarChart
              T={T}
              labels={["EBITDA", "PBT", "PAT"]}
              planValues={[planToDate.ebitda, planToDate.pbt, planToDate.pat]}
              actualValues={[actualToDate.ebitda, actualToDate.pbt, actualToDate.pat]}
              actualStatus={[ebitdaRag.cls, pbtRag.cls, patRag.cls]}
            />
          </RagChartBlock>
          <p style={noteStyle(T)}>
            {costsBasis.source === "live"
              ? "Cost actuals come from the Annual Plan's logged monthly actual costs."
              : "No monthly actual costs have been logged yet for this fiscal year, so the Actual cost line above is estimated by time-prorating the Annual Plan's cost assumptions to today's date. Log actual costs on the Annual Plan page to replace this estimate with real figures automatically."}{" "}
            Revenue and student counts are always live from admissions &mdash; never estimated. Finance cost (PNB term loan ₹{LOAN_PRINCIPAL_L}L
            @ {LOAN_RATE_PCT}% + CC ₹{CC_USED_L}L utilised of ₹{CC_LIMIT_L}L limit @ {CC_RATE_PCT}%) is not yet tracked in the Annual Plan tables, so it
            is modeled here as a fixed annual constant, time-prorated.
          </p>
        </Section>

        <Section T={T} title="Annual Plan Assumptions" kicker={assumptionsLive ? "Live from Annual Plan" : "Defaults — no saved plan found"}>
          <table style={tableStyle(T)}>
            <tbody>
              <tr>
                <td style={td(T)}>Fiscal year</td>
                <td style={tdNum(T)}>{assumptions.fiscal_year || currentFiscalYear()}</td>
              </tr>
              <tr>
                <td style={td(T)}>Target students</td>
                <td style={tdNum(T)}>{assumptions.students}</td>
              </tr>
              <tr>
                <td style={td(T)}>Average fee (blended ARPU)</td>
                <td style={tdNum(T)}>{fmtINR(assumptions.avg_fee)}</td>
              </tr>
              <tr>
                <td style={td(T)}>YoY growth rate assumption</td>
                <td style={tdNum(T)}>{fmtPct(assumptions.growth_rate / 100)}</td>
              </tr>
              <tr>
                <td style={td(T)}>Teaching cost</td>
                <td style={tdNum(T)}>
                  {fmtPct(assumptions.teaching_pct / 100)} of revenue ({fmtLakh(plan.teachingLakh, 2)} L)
                </td>
              </tr>
              <tr>
                <td style={td(T)}>Marketing cost</td>
                <td style={tdNum(T)}>
                  {fmtPct(assumptions.marketing_pct / 100)} of revenue ({fmtLakh(plan.marketingLakh, 2)} L)
                </td>
              </tr>
              <tr>
                <td style={td(T)}>Admin cost</td>
                <td style={tdNum(T)}>
                  {fmtPct(assumptions.admin_pct / 100)} of revenue ({fmtLakh(plan.adminLakh, 2)} L)
                </td>
              </tr>
              <tr>
                <td style={td(T)}>Rent</td>
                <td style={tdNum(T)}>
                  {fmtINR(assumptions.rent_monthly)}/month ({fmtLakh(plan.rentAnnualLakh, 2)} L/yr)
                </td>
              </tr>
              <tr>
                <td style={td(T)}>Other fixed overheads</td>
                <td style={tdNum(T)}>
                  {fmtINR(assumptions.other_fixed_monthly)}/month ({fmtLakh(plan.otherFixedAnnualLakh, 2)} L/yr)
                </td>
              </tr>
              <tr>
                <td style={td(T)}>Tax rate</td>
                <td style={tdNum(T)}>{fmtPct(assumptions.tax_rate / 100)}</td>
              </tr>
            </tbody>
          </table>
          <p style={noteStyle(T)}>
            These figures are read live from the same Annual Plan assumptions you maintain on the Annual Plan page &mdash;
            change them there and this page updates automatically. Debt (PNB term loan, cash credit) is not yet part of
            the Annual Plan assumptions table, so it stays a fixed input on this page for now.
          </p>
          {staff.length > 0 && (
            <>
              <h3 style={{ fontSize: 13, color: T.textSecondary, margin: "18px 0 8px" }}>Staffing plan (reference, from Annual Plan)</h3>
              <table style={tableStyle(T)}>
                <thead>
                  <tr>
                    <th style={th(T)}>Role</th>
                    <th style={th(T)}>Department</th>
                    <th style={thNum(T)}>Headcount</th>
                    <th style={thNum(T)}>Monthly Salary</th>
                    <th style={thNum(T)}>Annual (₹L)</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => (
                    <tr key={s.id}>
                      <td style={td(T)}>{s.role}</td>
                      <td style={td(T)}>{s.department || "—"}</td>
                      <td style={tdNum(T)}>{s.headcount}</td>
                      <td style={tdNum(T)}>{fmtINR(s.monthly_salary)}</td>
                      <td style={tdNum(T)}>{fmtLakh((s.headcount * s.monthly_salary * 12) / 100000, 2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700 }}>
                    <td style={td(T)} colSpan={4}>
                      Total
                    </td>
                    <td style={tdNum(T)}>{fmtLakh(staffAnnualTotal, 2)}</td>
                  </tr>
                </tfoot>
              </table>
              <p style={noteStyle(T)}>Shown for reference only &mdash; this staffing list is informational and isn&rsquo;t yet reconciled into the Teaching cost % above.</p>
            </>
          )}
        </Section>

        <Section T={T} title="Annual Operating P&L (plan run-rate, ₹ lakh)" kicker="Full-year plan">
          <table style={tableStyle(T)}>
            <tbody>
              <tr>
                <td style={td(T)}>Revenue</td>
                <td style={tdNum(T)}>{fmtLakh(plan.revenueLakh, 2)}</td>
              </tr>
              <tr>
                <td style={td(T)}>Teaching cost</td>
                <td style={tdNum(T)}>{fmtLakh(-plan.teachingLakh, 2)}</td>
              </tr>
              <tr>
                <td style={td(T)}>Marketing cost</td>
                <td style={tdNum(T)}>{fmtLakh(-plan.marketingLakh, 2)}</td>
              </tr>
              <tr>
                <td style={td(T)}>Admin cost</td>
                <td style={tdNum(T)}>{fmtLakh(-plan.adminLakh, 2)}</td>
              </tr>
              <tr>
                <td style={td(T)}>Rent &amp; other fixed overheads</td>
                <td style={tdNum(T)}>{fmtLakh(-(plan.rentAnnualLakh + plan.otherFixedAnnualLakh), 2)}</td>
              </tr>
              <tr style={{ fontWeight: 700 }}>
                <td style={td(T)}>EBITDA / Operating Surplus</td>
                <td style={tdNum(T)}>
                  {fmtLakh(plan.ebitda, 2)} <span style={{ fontWeight: 400, color: T.muted }}>({fmtPct(plan.ebitdaMargin)})</span>
                </td>
              </tr>
              <tr>
                <td style={td(T)}>
                  Term loan interest (PNB, ₹{LOAN_PRINCIPAL_L}L @ {LOAN_RATE_PCT}%)
                </td>
                <td style={tdNum(T)}>{fmtLakh(-plan.termLoanInterest, 2)}</td>
              </tr>
              <tr>
                <td style={td(T)}>
                  CC interest (₹{CC_USED_L}L utilised @ {CC_RATE_PCT}%, of ₹1.25Cr limit)
                </td>
                <td style={tdNum(T)}>{fmtLakh(-plan.ccInterest, 2)}</td>
              </tr>
              <tr style={{ fontWeight: 700 }}>
                <td style={td(T)}>Profit Before Tax</td>
                <td style={tdNum(T)}>{fmtLakh(plan.pbt, 2)}</td>
              </tr>
              <tr>
                <td style={td(T)}>Estimated tax (illustrative @ {assumptions.tax_rate}% of PBT)</td>
                <td style={tdNum(T)}>{fmtLakh(-plan.taxAmount, 2)}</td>
              </tr>
              <tr style={{ fontWeight: 700 }}>
                <td style={td(T)}>Profit After Tax (illustrative)</td>
                <td style={tdNum(T)}>{fmtLakh(plan.profitAfterTax, 2)}</td>
              </tr>
            </tbody>
          </table>
        </Section>

        <Section T={T} title="Marketing Budget & Channel Split" kicker="Plan">
          <table style={tableStyle(T)}>
            <thead>
              <tr>
                <th style={th(T)}>Channel</th>
                <th style={thNum(T)}>Split %</th>
                <th style={thNum(T)}>Budget (₹L)</th>
                <th style={th(T)}>Primary KPI</th>
              </tr>
            </thead>
            <tbody>
              {CHANNELS.map((c) => (
                <tr key={c.name}>
                  <td style={td(T)}>{c.name}</td>
                  <td style={tdNum(T)}>{fmtPct(c.pct, 0)}</td>
                  <td style={tdNum(T)}>{fmtLakh(c.pct * plan.marketingLakh, 2)}</td>
                  <td style={td(T)}>{c.kpi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section T={T} title="Break-even Analysis" kicker="Sensitivity">
          <table style={tableStyle(T)}>
            <tbody>
              <tr>
                <td style={td(T)}>Blended ARPU</td>
                <td style={tdNum(T)}>{fmtINR(plan.blendedArpu)}</td>
              </tr>
              <tr>
                <td style={td(T)}>Contribution margin (1 &minus; teaching% &minus; marketing% &minus; admin%)</td>
                <td style={tdNum(T)}>{fmtPct(plan.contributionMarginPct)}</td>
              </tr>
              <tr>
                <td style={td(T)}>Annual fixed cost (Rent + Other overheads)</td>
                <td style={tdNum(T)}>{fmtLakh(plan.fixedForBreakevenLakh, 2)} L</td>
              </tr>
              <tr style={{ fontWeight: 700 }}>
                <td style={td(T)}>Break-even admissions</td>
                <td style={tdNum(T)}>{plan.breakevenStudents != null ? plan.breakevenStudents : "—"}</td>
              </tr>
              <tr>
                <td style={td(T)}>Operating profit at {plan.totalStudents} students</td>
                <td style={tdNum(T)}>{fmtLakh(plan.ebitda, 2)} L</td>
              </tr>
            </tbody>
          </table>
          <RagChartBlock T={T} title="Operating profit vs admissions — red below break-even, green above" status={{ cls: "good", label: "" }} hideBadge>
            <ThresholdLineChart T={T} xLabels={beXs.map(String)} values={beYs} />
          </RagChartBlock>
        </Section>

        <Section T={T} title="Monthly Operating Plan (FY27 ramp)" kicker="Plan">
          <table style={tableStyle(T)}>
            <thead>
              <tr>
                <th style={th(T)}>Month</th>
                <th style={thNum(T)}>New Enrolments</th>
                <th style={thNum(T)}>Cumulative</th>
                <th style={thNum(T)}>Revenue (₹L)</th>
                <th style={thNum(T)}>Operating Surplus (₹L)</th>
              </tr>
            </thead>
            <tbody>
              {monthlyRows.map((r) => (
                <tr key={r.name}>
                  <td style={td(T)}>{r.name}</td>
                  <td style={tdNum(T)}>{r.add}</td>
                  <td style={tdNum(T)}>{r.cum}</td>
                  <td style={tdNum(T)}>{fmtLakh(r.revenue, 2)}</td>
                  <td style={{ ...tdNum(T), color: r.surplus >= 0 ? T.good : T.critical, fontWeight: 600 }}>{fmtLakh(r.surplus, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <RagChartBlock T={T} title="Monthly operating surplus (₹L) — green surplus, red deficit" status={{ cls: "good", label: "" }} hideBadge>
            <SurplusBarChart T={T} labels={monthlyRows.map((r) => r.name)} values={monthlyRows.map((r) => r.surplus)} />
          </RagChartBlock>
        </Section>

        <Section T={T} title="Management AOP Scorecard" kicker="Coaching-industry layer">
          <table style={tableStyle(T)}>
            <thead>
              <tr>
                <th style={th(T)}>Pillar</th>
                <th style={th(T)}>FY27 Target</th>
                <th style={th(T)}>Primary KPI</th>
                <th style={thNum(T)}>Actual</th>
                <th style={th(T)}>Status</th>
                <th style={th(T)}>Owner</th>
                <th style={th(T)}>Review</th>
              </tr>
            </thead>
            <tbody>
              {scoreRows.map((r, i) => (
                <tr key={i}>
                  <td style={td(T)}>{r.label}</td>
                  <td style={td(T)}>{r.target}</td>
                  <td style={td(T)}>{r.kpi}</td>
                  <td style={tdNum(T)}>{r.actual}</td>
                  <td style={td(T)}>
                    <Badge T={T} rag={r.rag} />
                  </td>
                  <td style={td(T)}>{r.owner}</td>
                  <td style={td(T)}>{r.freq}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section T={T} title="Admissions Funnel & CAC Plan" kicker="Acquisition">
          <table style={tableStyle(T)}>
            <thead>
              <tr>
                <th style={th(T)}>Funnel Stage</th>
                <th style={thNum(T)}>Target Volume</th>
                <th style={th(T)}>Conversion</th>
                <th style={thNum(T)}>Actual</th>
                <th style={th(T)}>KPI</th>
                <th style={th(T)}>Owner</th>
              </tr>
            </thead>
            <tbody>
              {FUNNEL.map((f, i) => (
                <tr key={f.stage}>
                  <td style={td(T)}>{f.stage}</td>
                  <td style={tdNum(T)}>{f.target}</td>
                  <td style={td(T)}>{f.conv}</td>
                  <td style={tdNum(T)}>{i === FUNNEL.length - 1 ? act.totals.students : "—"}</td>
                  <td style={td(T)}>{f.kpi}</td>
                  <td style={td(T)}>{f.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section T={T} title="Batch Capacity, Faculty Utilisation & Staffing Plan" kicker="Operations">
          <table style={tableStyle(T)}>
            <thead>
              <tr>
                <th style={th(T)}>Metric</th>
                <th style={th(T)}>Planning Assumption</th>
                <th style={th(T)}>FY27 Target</th>
                <th style={th(T)}>Trigger to Hire</th>
                <th style={th(T)}>Trigger to Consolidate</th>
                <th style={th(T)}>Owner</th>
                <th style={th(T)}>Frequency</th>
              </tr>
            </thead>
            <tbody>
              {CAPACITY.map((c, i) => (
                <tr key={i}>
                  {c.map((v, j) => (
                    <td style={td(T)} key={j}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section T={T} title="Collections, Working Capital & Cash Discipline" kicker="Cash">
          <table style={tableStyle(T)}>
            <thead>
              <tr>
                <th style={th(T)}>KPI</th>
                <th style={th(T)}>Target</th>
                <th style={th(T)}>Formula / Definition</th>
                <th style={thNum(T)}>Actual</th>
                <th style={th(T)}>Status</th>
                <th style={th(T)}>Owner</th>
                <th style={th(T)}>Review</th>
              </tr>
            </thead>
            <tbody>
              {collRows.map((r, i) => (
                <tr key={i}>
                  <td style={td(T)}>{r.label}</td>
                  <td style={td(T)}>{r.target}</td>
                  <td style={td(T)}>{r.kpi}</td>
                  <td style={tdNum(T)}>{r.actual}</td>
                  <td style={td(T)}>
                    <Badge T={T} rag={r.rag} />
                  </td>
                  <td style={td(T)}>{r.owner}</td>
                  <td style={td(T)}>{r.freq}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section T={T} title="Scenario Planning & Risk Register" kicker="Scenario planning">
          <table style={tableStyle(T)}>
            <thead>
              <tr>
                <th style={th(T)}>Scenario</th>
                <th style={thNum(T)}>Admissions</th>
                <th style={thNum(T)}>Blended ARPU</th>
                <th style={thNum(T)}>Revenue ₹Cr</th>
                <th style={thNum(T)}>Marketing ₹L</th>
                <th style={thNum(T)}>Operating Profit ₹L</th>
                <th style={th(T)}>Management Action</th>
              </tr>
            </thead>
            <tbody>
              {SCENARIOS.map((s) => {
                const r = scenarioProfit(s.students, s.arpu);
                return (
                  <tr key={s.label}>
                    <td style={td(T)}>{s.label}</td>
                    <td style={tdNum(T)}>{s.students}</td>
                    <td style={tdNum(T)}>{fmtINR(s.arpu)}</td>
                    <td style={tdNum(T)}>{fmtLakh(r.revenueLakh / 100, 2)}</td>
                    <td style={tdNum(T)}>{fmtLakh(r.marketingLakh, 2)}</td>
                    <td style={{ ...tdNum(T), color: r.profit >= 0 ? T.good : T.critical, fontWeight: 600 }}>{fmtLakh(r.profit, 2)}</td>
                    <td style={td(T)}>{s.action}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <table style={{ ...tableStyle(T), marginTop: 16 }}>
            <thead>
              <tr>
                <th style={th(T)}>Risk</th>
                <th style={th(T)}>Probability</th>
                <th style={th(T)}>Impact</th>
                <th style={th(T)}>Early Warning</th>
                <th style={th(T)}>Mitigation</th>
                <th style={th(T)}>Owner</th>
              </tr>
            </thead>
            <tbody>
              {RISK_REGISTER.map((r, i) => (
                <tr key={i}>
                  {r.map((v, j) => (
                    <td style={td(T)} key={j}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section T={T} title="What Large Coaching Operators Track" kicker="Reference">
          <p style={hintStyle(T)}>
            Management-design lessons from how larger operators run their numbers &mdash; not a claim that S-CUBUS should
            copy another company&rsquo;s exact margins or cost ratios.
          </p>
          <table style={tableStyle(T)}>
            <thead>
              <tr>
                <th style={th(T)}>Area</th>
                <th style={th(T)}>What to track</th>
                <th style={th(T)}>S-CUBUS action</th>
                <th style={th(T)}>Industry evidence / rationale</th>
              </tr>
            </thead>
            <tbody>
              {BENCHMARKS.map((b, i) => (
                <tr key={i}>
                  {b.map((v, j) => (
                    <td style={td(T)} key={j}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <p style={{ fontSize: 12, color: T.muted, marginTop: 8 }}>
          The Plan figures on this page are read live from the Annual Plan assumptions table; the Actuals are read live
          from admissions. If your Annual Plan page computes its own P&amp;L with a different formula than the one used
          here, let me know and I&rsquo;ll align the two exactly.
        </p>
      </div>
    </div>
  );
}

function Section({ T, title, kicker, children }: { T: Theme; title: string; kicker: string; children: React.ReactNode }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 22px", marginBottom: 22 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, color: T.muted, fontWeight: 600 }}>{kicker}</div>
      <h2 style={{ fontSize: 16, margin: "0 0 14px", color: T.textPrimary }}>{title}</h2>
      {children}
    </div>
  );
}

function Tile({ T, label, value, sub, rag }: { T: Theme; label: string; value: string; sub?: string; rag?: Rag }) {
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px", position: "relative" }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", color: T.muted, letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2, color: T.textPrimary }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{sub}</div>}
      {rag && (
        <div style={{ position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: "50%", background: ragColor(T, rag.cls) }} title={rag.label} />
      )}
    </div>
  );
}

function Badge({ T, rag }: { T: Theme; rag: Rag }) {
  const bg = rag.cls === "good" ? T.badgeGoodBg : rag.cls === "warning" ? T.badgeWarnBg : T.badgeCritBg;
  const fg = rag.cls === "good" ? T.successText : rag.cls === "warning" ? "#8a5a00" : T.critical;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: bg, color: fg, whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: ragColor(T, rag.cls), flexShrink: 0 }} />
      {rag.label}
    </span>
  );
}

function RagChartBlock({ T, title, status, children, hideBadge }: { T: Theme; title: string; status: Rag; children: React.ReactNode; hideBadge?: boolean }) {
  return (
    <div style={{ marginTop: 18, marginBottom: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: T.textSecondary, marginBottom: 8, flexWrap: "wrap" }}>
        <span>{title}</span>
        {!hideBadge && <Badge T={T} rag={status} />}
      </div>
      {children}
    </div>
  );
}

function LineChart({
  T,
  xLabels,
  expected,
  actual,
  height = 200,
  includeZero
}: {
  T: Theme;
  xLabels: string[];
  expected: { name: string; values: (number | null)[] };
  actual: { name: string; values: (number | null)[]; status: RagCls };
  height?: number;
  includeZero?: boolean;
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
  expected.values.forEach((v) => { if (v != null && !isNaN(v)) allVals.push(v); });
  actual.values.forEach((v) => { if (v != null && !isNaN(v)) allVals.push(v); });
  if (includeZero) allVals.push(0);
  let maxV = Math.max(0, ...allVals);
  let minV = Math.min(0, ...allVals);
  if (maxV === minV) maxV += 1;
  const range = maxV - minV;
  const n = xLabels.length;
  const xPos = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * innerW);
  const yPos = (v: number) => padT + innerH - ((v - minV) / range) * innerH;
  const labelStep = Math.max(1, Math.ceil(n / 14));
  const actualColor = ragColor(T, actual.status);

  function runs(values: (number | null)[]) {
    const out: number[][] = [];
    let cur: number[] = [];
    values.forEach((v, i) => {
      if (v == null || isNaN(v)) {
        if (cur.length) {
          out.push(cur);
          cur = [];
        }
      } else cur.push(i);
    });
    if (cur.length) out.push(cur);
    return out;
  }

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {minV < 0 && maxV > 0 && <line x1={padL} y1={yPos(0)} x2={W - padR} y2={yPos(0)} stroke={T.gridline} strokeWidth={1} strokeDasharray="4,4" />}
      {runs(expected.values).map((run, ri) => (
        <polyline key={"exp" + ri} points={run.map((i) => `${xPos(i)},${yPos(expected.values[i] as number)}`).join(" ")} fill="none" stroke={T.baseline} strokeWidth={2} strokeDasharray="5,4" strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {runs(actual.values).map((run, ri) => (
        <polyline key={"act" + ri} points={run.map((i) => `${xPos(i)},${yPos(actual.values[i] as number)}`).join(" ")} fill="none" stroke={actualColor} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {actual.values.map((v, i) => {
        if (v == null || isNaN(v)) return null;
        const isRunEnd = i === n - 1 || actual.values[i + 1] == null || isNaN(actual.values[i + 1] as number);
        if (i % 2 !== 0 && !isRunEnd) return null;
        return (
          <circle key={i} cx={xPos(i)} cy={yPos(v)} r={isRunEnd ? 4.5 : 3} fill={actualColor}>
            <title>{`${xLabels[i]} — ${actual.name}: ${fmtLakh(v, 1)}`}</title>
          </circle>
        );
      })}
      {xLabels.map((lab, i) => {
        if (i % labelStep !== 0 && i !== n - 1) return null;
        return (
          <text key={i} x={xPos(i)} y={H - 10} textAnchor="middle" fontSize="10.5" fill={T.muted}>
            {lab}
          </text>
        );
      })}
      <g transform={`translate(${padL}, ${padT})`}>
        <line x1={0} y1={-4} x2={16} y2={-4} stroke={T.baseline} strokeWidth={2} strokeDasharray="5,4" />
        <text x={20} y={0} fontSize="10.5" fill={T.textSecondary}>
          Expected
        </text>
        <line x1={100} y1={-4} x2={116} y2={-4} stroke={actualColor} strokeWidth={2.5} />
        <text x={120} y={0} fontSize="10.5" fill={T.textSecondary}>
          Actual
        </text>
      </g>
    </svg>
  );
}

function ThresholdLineChart({ T, xLabels, values }: { T: Theme; xLabels: string[]; values: number[] }) {
  const W = 1000;
  const H = 190;
  const padL = 10;
  const padR = 10;
  const padT = 14;
  const padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const maxV = Math.max(0, ...values);
  const minV = Math.min(0, ...values);
  const range = maxV - minV || 1;
  const n = values.length;
  const xPos = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * innerW);
  const yPos = (v: number) => padT + innerH - ((v - minV) / range) * innerH;
  const crossIdx = values.findIndex((v) => v >= 0);
  const negRun = crossIdx <= 0 ? values.map((_, i) => i).filter((i) => i <= Math.max(0, crossIdx)) : Array.from({ length: crossIdx + 1 }, (_, i) => i);
  const posRun = Array.from({ length: n - Math.max(0, crossIdx) }, (_, i) => i + Math.max(0, crossIdx));
  const labelStep = Math.max(1, Math.ceil(n / 10));
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {minV < 0 && maxV > 0 && <line x1={padL} y1={yPos(0)} x2={W - padR} y2={yPos(0)} stroke={T.gridline} strokeWidth={1} strokeDasharray="4,4" />}
      <polyline points={negRun.map((i) => `${xPos(i)},${yPos(values[i])}`).join(" ")} fill="none" stroke={T.critical} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={posRun.map((i) => `${xPos(i)},${yPos(values[i])}`).join(" ")} fill="none" stroke={T.good} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {xLabels.map((lab, i) => {
        if (i % labelStep !== 0 && i !== n - 1) return null;
        return (
          <text key={i} x={xPos(i)} y={H - 10} textAnchor="middle" fontSize="10" fill={T.muted}>
            {lab}
          </text>
        );
      })}
      <g transform={`translate(${padL}, ${padT})`}>
        <line x1={0} y1={-4} x2={16} y2={-4} stroke={T.critical} strokeWidth={2.5} />
        <text x={20} y={0} fontSize="10.5" fill={T.textSecondary}>
          Below break-even
        </text>
        <line x1={150} y1={-4} x2={166} y2={-4} stroke={T.good} strokeWidth={2.5} />
        <text x={170} y={0} fontSize="10.5" fill={T.textSecondary}>
          Above break-even
        </text>
      </g>
    </svg>
  );
}

function SurplusBarChart({ T, labels, values }: { T: Theme; labels: string[]; values: number[] }) {
  const W = 1000;
  const H = 180;
  const padL = 10;
  const padR = 10;
  const padT = 10;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const maxAbs = Math.max(1, ...values.map((v) => Math.abs(v)));
  const zeroY = padT + innerH / 2;
  const n = labels.length;
  const gap = 10;
  const bw = (innerW - gap * (n - 1)) / n;
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <line x1={padL} y1={zeroY} x2={W - padR} y2={zeroY} stroke={T.baseline} strokeWidth={1} />
      {values.map((v, i) => {
        const h = (Math.abs(v) / maxAbs) * (innerH / 2 - 4);
        const x = padL + i * (bw + gap);
        const y = v >= 0 ? zeroY - h : zeroY;
        const color = v >= 0 ? T.good : T.critical;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={Math.max(h, 1)} rx={3} ry={3} fill={color}>
              <title>{`${labels[i]}: ${fmtLakh(v, 2)} L`}</title>
            </rect>
            <text x={x + bw / 2} y={H - 10} textAnchor="middle" fontSize="10.5" fill={T.muted}>
              {labels[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function GroupedBarChart({
  T,
  labels,
  planValues,
  actualValues,
  actualStatus
}: {
  T: Theme;
  labels: string[];
  planValues: number[];
  actualValues: number[];
  actualStatus: RagCls[];
}) {
  const W = 1000;
  const H = 190;
  const padL = 10;
  const padR = 10;
  const padT = 20;
  const padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const allVals = [...planValues, ...actualValues, 0];
  const maxV = Math.max(...allVals);
  const minV = Math.min(...allVals);
  const range = maxV - minV || 1;
  const zeroY = padT + innerH - ((0 - minV) / range) * innerH;
  const n = labels.length;
  const groupGap = 28;
  const groupW = (innerW - groupGap * (n - 1)) / n;
  const barW = groupW / 2 - 4;
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <line x1={padL} y1={zeroY} x2={W - padR} y2={zeroY} stroke={T.baseline} strokeWidth={1} />
      {labels.map((lab, i) => {
        const gx = padL + i * (groupW + groupGap);
        const pv = planValues[i];
        const av = actualValues[i];
        const py = padT + innerH - ((pv - minV) / range) * innerH;
        const ay = padT + innerH - ((av - minV) / range) * innerH;
        const ph = Math.abs(zeroY - py);
        const ah = Math.abs(zeroY - ay);
        const color = ragColor(T, actualStatus[i]);
        return (
          <g key={lab}>
            <rect x={gx} y={Math.min(py, zeroY)} width={barW} height={Math.max(ph, 1)} rx={3} fill={T.baseline}>
              <title>{`${lab} — Plan: ${fmtLakh(pv, 2)} L`}</title>
            </rect>
            <rect x={gx + barW + 8} y={Math.min(ay, zeroY)} width={barW} height={Math.max(ah, 1)} rx={3} fill={color}>
              <title>{`${lab} — Actual: ${fmtLakh(av, 2)} L`}</title>
            </rect>
            <text x={gx + groupW / 2} y={H - 10} textAnchor="middle" fontSize="11" fill={T.muted}>
              {lab}
            </text>
          </g>
        );
      })}
      <g transform={`translate(${padL}, 2)`}>
        <rect x={0} y={0} width={12} height={12} rx={2} fill={T.baseline} />
        <text x={16} y={10} fontSize="10.5" fill={T.textSecondary}>
          Plan (to date)
        </text>
        <rect x={110} y={0} width={12} height={12} rx={2} fill={T.good} />
        <text x={126} y={10} fontSize="10.5" fill={T.textSecondary}>
          Actual (coloured by status)
        </text>
      </g>
    </svg>
  );
}

function tableStyle(T: Theme): CSSProperties {
  return { width: "100%", borderCollapse: "collapse", fontSize: 13.5, color: T.textPrimary };
}
function th(T: Theme): CSSProperties {
  return { textAlign: "left", padding: "7px 10px", borderBottom: `1px solid ${T.gridline}`, fontSize: 11.5, textTransform: "uppercase", color: T.muted };
}
function thNum(T: Theme): CSSProperties {
  return { ...th(T), textAlign: "right" };
}
function td(T: Theme): CSSProperties {
  return { padding: "7px 10px", borderBottom: `1px solid ${T.gridline}` };
}
function tdNum(T: Theme): CSSProperties {
  return { ...td(T), textAlign: "right", fontVariantNumeric: "tabular-nums" };
}
function hintStyle(T: Theme): CSSProperties {
  return { fontSize: 13, color: T.textSecondary, margin: "4px 0 16px", lineHeight: 1.5 };
}
function noteStyle(T: Theme): CSSProperties {
  return { fontSize: 12.5, color: T.muted, marginTop: 10, lineHeight: 1.5 };
}
