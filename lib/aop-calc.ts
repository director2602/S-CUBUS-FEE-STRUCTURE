// Annual Operating Plan (AOP) & P&L calculation logic — ported from the standalone
// S-CUBUS AOP app (app.js) so the same formulas run inside the Fee Portal.

export const MONTH_NAMES = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"] as const;

// Same admission-season seasonality weights as the original tool (sums to 1).
export const MONTH_WEIGHTS = [0.14, 0.12, 0.1, 0.07, 0.06, 0.06, 0.07, 0.07, 0.06, 0.08, 0.06, 0.11];

export type Assumptions = {
  students: number;
  avgFee: number;
  growthRate: number;
  teachingPct: number;
  marketingPct: number;
  adminPct: number;
  rentMonthly: number;
  otherFixedMonthly: number;
  taxRate: number;
};

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  students: 600,
  avgFee: 50000,
  growthRate: 15,
  teachingPct: 38,
  marketingPct: 8,
  adminPct: 12,
  rentMonthly: 150000,
  otherFixedMonthly: 50000,
  taxRate: 25
};

export type StaffRow = {
  id: string;
  role: string;
  department: string | null;
  headcount: number;
  monthlySalary: number;
};

export type ActualCostRow = {
  monthIndex: number;
  teachingCost: number;
  marketingCost: number;
  adminCost: number;
  rent: number;
  otherOverheads: number;
};

export type ActualRevenueRow = {
  monthIndex: number;
  revenue: number;
};

export function round0(n: number) {
  return Math.round(n);
}

export function formatINR(n: number) {
  const sign = n < 0 ? "-" : "";
  return sign + "₹" + Math.round(Math.abs(n)).toLocaleString("en-IN");
}

export function pct1(n: number) {
  return Math.round(n * 10) / 10 + "%";
}

export function variance(actual: number, plan: number): number | null {
  if (!plan) return null;
  return ((actual - plan) / Math.abs(plan)) * 100;
}

export function varianceLabel(v: number | null) {
  if (v == null) return "—";
  return (v >= 0 ? "+" : "") + pct1(v);
}

export type MonthPlan = {
  name: string;
  revenue: number;
  cost: number;
  ebitda: number;
};

export type PlanResult = {
  revenue: number;
  teaching: number;
  marketing: number;
  admin: number;
  rent: number;
  other: number;
  grossProfit: number;
  grossMarginPct: number;
  totalOpex: number;
  ebitda: number;
  ebitdaMarginPct: number;
  tax: number;
  netProfit: number;
  netMarginPct: number;
  breakEven: number | null;
  prevYearRevenue: number;
  months: MonthPlan[];
  segments: { label: string; value: number; pctOfRevenue: number }[];
};

export function computePlan(a: Assumptions): PlanResult {
  const revenue = a.students * a.avgFee;
  const teaching = (revenue * a.teachingPct) / 100;
  const marketing = (revenue * a.marketingPct) / 100;
  const admin = (revenue * a.adminPct) / 100;
  const rent = a.rentMonthly * 12;
  const other = a.otherFixedMonthly * 12;

  const grossProfit = revenue - teaching;
  const grossMarginPct = revenue ? (grossProfit / revenue) * 100 : 0;

  const totalOpex = marketing + admin + rent + other;
  const ebitda = grossProfit - totalOpex;
  const ebitdaMarginPct = revenue ? (ebitda / revenue) * 100 : 0;

  const tax = Math.max(0, ebitda) * (a.taxRate / 100);
  const netProfit = ebitda - tax;
  const netMarginPct = revenue ? (netProfit / revenue) * 100 : 0;

  const variablePctTotal = a.teachingPct + a.marketingPct + a.adminPct;
  const contribPerStudent = a.avgFee * (1 - variablePctTotal / 100);
  const fixedTotal = rent + other;
  const breakEven = contribPerStudent > 0 ? Math.ceil(fixedTotal / contribPerStudent) : null;

  const prevYearRevenue = revenue / (1 + a.growthRate / 100);

  const segments = [
    ["Teaching & academic", teaching],
    ["Marketing & admissions", marketing],
    ["Admin, ops & support", admin],
    ["Rent & infrastructure", rent],
    ["Other fixed overheads", other],
    ["Income tax", tax],
    ["Net profit", Math.max(netProfit, 0)]
  ].map(([label, value]) => ({
    label: label as string,
    value: value as number,
    // Guard against dividing by a substituted 1 when revenue is 0 (e.g. average fee not
    // set yet) — without this, a fixed cost like rent renders as a nonsensical percentage.
    pctOfRevenue: revenue ? Math.round(((value as number) / revenue) * 1000) / 10 : 0
  }));

  const months: MonthPlan[] = MONTH_WEIGHTS.map((w, i) => {
    const rev = revenue * w;
    const teachM = (rev * a.teachingPct) / 100;
    const mktM = (rev * a.marketingPct) / 100;
    const fixedM = rent / 12 + other / 12 + admin / 12;
    const cost = teachM + mktM + fixedM;
    return { name: MONTH_NAMES[i], revenue: rev, cost, ebitda: rev - cost };
  });

  return {
    revenue,
    teaching,
    marketing,
    admin,
    rent,
    other,
    grossProfit,
    grossMarginPct,
    totalOpex,
    ebitda,
    ebitdaMarginPct,
    tax,
    netProfit,
    netMarginPct,
    breakEven,
    prevYearRevenue,
    months,
    segments
  };
}

export type PeriodRow = {
  name: string;
  revenue: number;
  cost: number;
  ebitda: number;
  actualRevenue: number | null;
  actualEbitda: number | null;
  partial?: boolean;
};

const QUARTER_DEFS = [
  { name: "Q1 (Apr–Jun)", idx: [0, 1, 2] },
  { name: "Q2 (Jul–Sep)", idx: [3, 4, 5] },
  { name: "Q3 (Oct–Dec)", idx: [6, 7, 8] },
  { name: "Q4 (Jan–Mar)", idx: [9, 10, 11] }
];

// actualRevenueByMonth: revenue actually collected (from real admissions/payments data).
// actualCostByMonth: hand-entered actual costs (teaching+marketing+admin+rent+other), if any.
export function getMonthlyRows(
  plan: PlanResult,
  actualRevenueByMonth: Map<number, number>,
  actualCostByMonth: Map<number, number>
): PeriodRow[] {
  return plan.months.map((m, i) => {
    const actualRevenue = actualRevenueByMonth.has(i) ? actualRevenueByMonth.get(i)! : null;
    const actualCost = actualCostByMonth.get(i);
    const actualEbitda = actualRevenue != null ? actualRevenue - (actualCost ?? 0) : null;
    return { name: m.name, revenue: m.revenue, cost: m.cost, ebitda: m.ebitda, actualRevenue, actualEbitda };
  });
}

export function getQuarterlyRows(
  plan: PlanResult,
  actualRevenueByMonth: Map<number, number>,
  actualCostByMonth: Map<number, number>
): PeriodRow[] {
  return QUARTER_DEFS.map((q) => {
    let revenue = 0,
      cost = 0,
      ebitda = 0,
      actualRevenue: number | null = null,
      actualEbitda: number | null = null,
      actualCount = 0;
    q.idx.forEach((i) => {
      revenue += plan.months[i].revenue;
      cost += plan.months[i].cost;
      ebitda += plan.months[i].ebitda;
      if (actualRevenueByMonth.has(i)) {
        actualCount++;
        const rev = actualRevenueByMonth.get(i)!;
        const c = actualCostByMonth.get(i) ?? 0;
        actualRevenue = (actualRevenue ?? 0) + rev;
        actualEbitda = (actualEbitda ?? 0) + (rev - c);
      }
    });
    return { name: q.name, revenue, cost, ebitda, actualRevenue, actualEbitda, partial: actualCount > 0 && actualCount < q.idx.length };
  });
}

export function getWeeklyRows(plan: PlanResult): PeriodRow[] {
  const weeksTotal = 52;
  const weights = plan.months.map((m) => (plan.revenue ? m.revenue / plan.revenue : 0));
  const raw = weights.map((w) => w * weeksTotal);
  const weeksPerMonth = raw.map(Math.floor);
  const used = weeksPerMonth.reduce((a, b) => a + b, 0);
  const remainder = weeksTotal - used;
  const order = raw
    .map((w, i) => ({ i, frac: w - Math.floor(w) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < remainder; k++) weeksPerMonth[order[k % order.length].i]++;

  const rows: PeriodRow[] = [];
  plan.months.forEach((m, i) => {
    const n = weeksPerMonth[i] || 0;
    for (let w = 1; w <= n; w++) {
      rows.push({
        name: m.name + " W" + w,
        revenue: n ? m.revenue / n : 0,
        cost: n ? m.cost / n : 0,
        ebitda: n ? m.ebitda / n : 0,
        actualRevenue: null,
        actualEbitda: null
      });
    }
  });
  return rows;
}

export type PayrollByDept = {
  department: string;
  headcount: number;
  avgMonthly: number;
  annual: number;
  pctOfPayroll: number;
};

export type Payroll = {
  headcount: number;
  totalAnnual: number;
  avgMonthly: number;
  byDept: PayrollByDept[];
  pctOfRevenue: number;
  revenuePerEmployee: number | null;
};

export function computePayroll(staff: StaffRow[], revenue: number): Payroll {
  const valid = staff.filter((e) => (e.headcount || 0) > 0);
  let totalHeadcount = 0;
  let totalAnnual = 0;
  const byDeptMap = new Map<string, { department: string; headcount: number; annual: number }>();
  valid.forEach((e) => {
    const hc = e.headcount || 0;
    const sal = e.monthlySalary || 0;
    const annual = hc * sal * 12;
    totalHeadcount += hc;
    totalAnnual += annual;
    const dept = (e.department && e.department.trim()) || (e.role && e.role.trim()) || "Unspecified";
    const cur = byDeptMap.get(dept) || { department: dept, headcount: 0, annual: 0 };
    cur.headcount += hc;
    cur.annual += annual;
    byDeptMap.set(dept, cur);
  });
  const byDept = [...byDeptMap.values()]
    .map((d) => ({
      department: d.department,
      headcount: d.headcount,
      avgMonthly: d.headcount ? d.annual / d.headcount / 12 : 0,
      annual: d.annual,
      pctOfPayroll: totalAnnual ? (d.annual / totalAnnual) * 100 : 0
    }))
    .sort((a, b) => b.annual - a.annual);

  return {
    headcount: totalHeadcount,
    totalAnnual,
    avgMonthly: totalHeadcount ? totalAnnual / totalHeadcount / 12 : 0,
    byDept,
    pctOfRevenue: revenue ? (totalAnnual / revenue) * 100 : 0,
    revenuePerEmployee: totalHeadcount ? revenue / totalHeadcount : null
  };
}

// Fiscal year helpers — S-CUBUS runs an Apr–Mar fiscal year.
export function currentFiscalYear(d = new Date()): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth(); // 0 = Jan
  const startYear = m >= 3 ? y : y - 1; // Apr(3)..Dec -> this year; Jan..Mar -> previous year started it
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

// Maps a JS Date to a 0..11 fiscal month index (0 = Apr, 11 = Mar) within the given fiscal year.
// Returns null if the date falls outside that fiscal year.
export function fiscalMonthIndex(dateStr: string, fiscalYear: string): number | null {
  const d = new Date(dateStr + "T00:00:00Z");
  if (isNaN(d.getTime())) return null;
  const startYear = parseInt(fiscalYear.split("-")[0], 10);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth(); // 0 = Jan
  if (y === startYear && m >= 3) return m - 3; // Apr..Dec of startYear -> 0..8
  if (y === startYear + 1 && m <= 2) return m + 9; // Jan..Mar of startYear+1 -> 9..11
  return null;
}

export function executiveSummary(
  a: Assumptions,
  plan: PlanResult,
  payroll: Payroll,
  actualsYTD: { count: number; revVarTotal: number | null; ebitdaVarTotal: number | null } | null
): string[] {
  const paras: string[] = [];

  paras.push(
    `S-CUBUS is planned to enroll ${a.students.toLocaleString("en-IN")} students this fiscal year, generating ${formatINR(plan.revenue)} in revenue — ` +
      (a.growthRate >= 0 ? `up ${pct1(a.growthRate)}` : `down ${pct1(Math.abs(a.growthRate))}`) +
      ` on last year's ${formatINR(plan.prevYearRevenue)}.`
  );

  let marginNote: string;
  if (plan.netMarginPct >= 20) marginNote = "a healthy net margin, comfortably ahead of the 15–20% typical for established coaching institutes";
  else if (plan.netMarginPct >= 10) marginNote = "a moderate net margin, roughly in line with typical coaching-institute economics";
  else if (plan.netMarginPct >= 0) marginNote = "a thin net margin — a small swing in enrollment or costs could erode most of this profit";
  else marginNote = "a projected loss at these assumptions — the cost structure needs revisiting before this plan is viable";
  paras.push(
    `At ${pct1(plan.netMarginPct)} (${formatINR(plan.netProfit)} net profit) and ${pct1(plan.ebitdaMarginPct)} EBITDA margin, the plan runs ${marginNote}.`
  );

  const candidates: [string, number][] = [
    ["Teaching & academic", plan.teaching],
    ["Marketing & admissions", plan.marketing],
    ["Admin, ops & support", plan.admin],
    ["Rent & infrastructure", plan.rent],
    ["Other fixed overheads", plan.other]
  ];
  let dominant = candidates[0];
  candidates.forEach((c) => {
    if (c[1] > dominant[1]) dominant = c;
  });
  let costLine = `${dominant[0]} is the largest cost driver at ${pct1(plan.revenue ? (dominant[1] / plan.revenue) * 100 : 0)} of revenue.`;
  if (payroll.headcount) {
    const combinedPlan = plan.teaching + plan.admin;
    const v = variance(payroll.totalAnnual, combinedPlan);
    costLine +=
      ` Your ${payroll.headcount}-employee payroll roster (${formatINR(payroll.totalAnnual)}/year, ${pct1(payroll.pctOfRevenue)} of revenue) ` +
      (v != null && Math.abs(v) < 8 ? "lines up closely with" : v != null && v > 0 ? "runs higher than" : "runs lower than") +
      " the Teaching + Admin assumption above.";
  }
  paras.push(costLine);

  if (plan.breakEven != null) {
    const cushion = plan.breakEven > 0 ? a.students / plan.breakEven : null;
    let cushionNote = "";
    if (cushion == null) cushionNote = "";
    else if (cushion >= 2) cushionNote = "a comfortable cushion above that level.";
    else if (cushion >= 1.2) cushionNote = "a reasonable buffer above that level.";
    else if (cushion >= 1) cushionNote = "a thin buffer above that level — worth monitoring closely.";
    else cushionNote = "currently below that level.";
    paras.push(
      `The plan needs ${plan.breakEven.toLocaleString("en-IN")} students to break even; at ${a.students.toLocaleString("en-IN")} enrolled, that's ${cushionNote}`
    );
  }

  if (payroll.headcount && payroll.revenuePerEmployee != null) {
    paras.push(
      `Staffing efficiency: ${formatINR(payroll.revenuePerEmployee)} of revenue per employee across ${payroll.headcount} staff, averaging ${formatINR(payroll.avgMonthly)}/month per employee.`
    );
  }

  if (actualsYTD && actualsYTD.count > 0) {
    paras.push(
      `Year-to-date actuals (${actualsYTD.count} month${actualsYTD.count === 1 ? "" : "s"} with real fee data) show revenue running ` +
        `${varianceLabel(actualsYTD.revVarTotal)} against plan` +
        (actualsYTD.ebitdaVarTotal != null ? ` and EBITDA ${varianceLabel(actualsYTD.ebitdaVarTotal)}` : "") +
        ` — ${actualsYTD.revVarTotal != null && actualsYTD.revVarTotal >= 0 ? "ahead of" : "behind"} the annual target so far.`
    );
  }

  return paras;
}
