"use client";

import { useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import {
  MONTH_NAMES,
  type Assumptions,
  type StaffRow,
  type ActualCostRow,
  type CounselorTarget,
  type AdmissionActual,
  formatINR,
  pct1,
  variance,
  varianceLabel,
  type PlanResult,
  computePlan,
  type PeriodRow,
  getMonthlyRows,
  getQuarterlyRows,
  getWeeklyRows,
  computePayroll,
  computeCounselorPerformance,
  executiveSummary
} from "@/lib/aop-calc";

// Validated 7-slot categorical palette (dataviz skill, references/palette.md) — fixed
// order, never cycled: blue, orange, aqua, yellow, magenta, green, violet.
const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7"];
const COST_COLOR = "#2a78d6";
const PROFIT_COLOR = "#008300";
const LOSS_COLOR = "#d03b3b";
// Target/Actual is a 2-series comparison used across the CFO overview & counselor charts —
// identity (which counselor, which line item) is carried by the axis label, not by color.
const TARGET_COLOR = "#2a78d6";
const ACTUAL_COLOR = "#008300";

type Msg = { type: "error" | "success"; text: string } | null;

type StaffState = StaffRow & { _dirty?: boolean; _isNew?: boolean };

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEsc(s: string) {
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  suffix?: string;
}) {
  return (
    <div className="slider-row">
      <div className="slider-top">
        <label>{label}</label>
        <input
          type="number"
          className="money-input"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(clamp(parseFloat(e.target.value) || 0, min, max))}
          style={{ width: 96, textAlign: "right", padding: "5px 7px", fontSize: 13 }}
        />
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
      {suffix && <div className="comp-hint">{suffix}</div>}
    </div>
  );
}

function AllocationBar({ segments }: { segments: PlanResult["segments"] }) {
  return (
    <div>
      <div className="alloc-bar">
        {segments.map((s, i) => (
          <div
            key={s.label}
            className="alloc-seg"
            style={{ width: `${Math.max(s.pctOfRevenue, 0.4)}%`, background: PALETTE[i % PALETTE.length] }}
            title={`${s.label}: ${pct1(s.pctOfRevenue)} (${formatINR(s.value)})`}
          />
        ))}
      </div>
      <div className="legend">
        {segments.map((s, i) => (
          <div key={s.label} className="legend-item">
            <span className="legend-swatch" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="legend-label">{s.label}</span>
            <span className="legend-sub">
              {pct1(s.pctOfRevenue)} &middot; {formatINR(s.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PnLTable({ plan }: { plan: PlanResult }) {
  const pct = (v: number) => (plan.revenue ? pct1((Math.abs(v) / plan.revenue) * 100) : "—");
  const rows: [string, number, boolean?][] = [
    ["Revenue", plan.revenue],
    ["Teaching & academic", -plan.teaching],
    ["Gross profit", plan.grossProfit, true],
    ["Marketing & admissions", -plan.marketing],
    ["Admin, ops & support", -plan.admin],
    ["Rent & infrastructure", -plan.rent],
    ["Other fixed overheads", -plan.other],
    ["EBITDA", plan.ebitda, true],
    ["Income tax", -plan.tax],
    ["Net profit", plan.netProfit, true]
  ];
  return (
    <table className="data">
      <thead>
        <tr>
          <th>Line item</th>
          <th style={{ textAlign: "right" }}>Amount</th>
          <th style={{ textAlign: "right" }}>% of revenue</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, val, strong]) => (
          <tr key={label}>
            <td style={strong ? { fontWeight: 700 } : undefined}>{label}</td>
            <td className="amt" style={strong ? { fontWeight: 700 } : undefined}>
              {formatINR(val)}
            </td>
            <td className="amt">{pct(val)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function HBarGroup({
  items,
  formatter
}: {
  items: { label: string; value: number; color: string }[];
  formatter: (n: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div>
      {items.map((it) => (
        <div className="hbar-row" key={it.label}>
          <div className="hbar-label">{it.label}</div>
          <div className="hbar-track">
            <div className="hbar-fill" style={{ width: `${Math.max(2, (it.value / max) * 100)}%`, background: it.color }} />
          </div>
          <div className="hbar-value">{formatter(it.value)}</div>
        </div>
      ))}
    </div>
  );
}

function achieveClass(pct: number | null) {
  if (pct == null) return undefined;
  return pct >= 100 ? "achieve-good" : pct >= 60 ? "achieve-warn" : "achieve-bad";
}

function CompareRow({
  label,
  hint,
  target,
  actual,
  achievedPct,
  formatter
}: {
  label: string;
  hint?: string;
  target: number | null;
  actual: number;
  achievedPct: number | null;
  formatter: (n: number) => string;
}) {
  return (
    <tr>
      <td>
        {label}
        {hint && <div className="comp-hint">{hint}</div>}
      </td>
      <td className="amt">{target != null ? formatter(target) : "—"}</td>
      <td className="amt" style={{ fontWeight: 700 }}>
        {formatter(actual)}
      </td>
      <td className={`amt ${achieveClass(achievedPct) || ""}`}>{achievedPct != null ? pct1(achievedPct) : "—"}</td>
    </tr>
  );
}

function PeriodChart({ rows }: { rows: PeriodRow[] }) {
  const maxVal = Math.max(1, ...rows.map((r) => Math.max(r.revenue, r.actualRevenue ?? 0)));
  return (
    <div className="chart-scroll">
      <div className="chart-bars">
        {rows.map((r) => {
          const isLoss = r.ebitda < 0;
          const revH = (r.revenue / maxVal) * 100;
          const costH = (Math.min(r.cost, r.revenue) / maxVal) * 100;
          const profitH = Math.max(0, revH - costH);
          const markerH = r.actualRevenue != null ? (r.actualRevenue / maxVal) * 100 : null;
          return (
            <div className="chart-bar-col" key={r.name}>
              {markerH != null && (
                <div className="chart-marker" style={{ bottom: `${markerH}%` }} title={`Actual revenue: ${formatINR(r.actualRevenue!)}`} />
              )}
              <div className="chart-bar-stack" style={{ height: `${revH}%` }}>
                <div style={{ height: `${costH}%`, background: isLoss ? LOSS_COLOR : COST_COLOR }} title={`Cost: ${formatINR(r.cost)}`} />
                {!isLoss && <div style={{ height: `${profitH}%`, background: PROFIT_COLOR }} title={`EBITDA: ${formatINR(r.ebitda)}`} />}
              </div>
              <div className="chart-bar-name">{r.name}</div>
            </div>
          );
        })}
      </div>
      <div className="legend" style={{ marginTop: 14 }}>
        <div className="legend-item">
          <span className="legend-swatch" style={{ background: COST_COLOR }} />
          <span className="legend-label">Cost</span>
        </div>
        <div className="legend-item">
          <span className="legend-swatch" style={{ background: PROFIT_COLOR }} />
          <span className="legend-label">EBITDA (profit)</span>
        </div>
        <div className="legend-item">
          <span className="legend-swatch" style={{ background: LOSS_COLOR }} />
          <span className="legend-label">Loss period</span>
        </div>
        <div className="legend-item">
          <span style={{ display: "inline-block", width: 14, height: 3, background: "var(--ink)", borderRadius: 2 }} />
          <span className="legend-label">Actual revenue</span>
        </div>
      </div>
    </div>
  );
}

function PeriodTable({ rows }: { rows: PeriodRow[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data" style={{ minWidth: 720 }}>
        <thead>
          <tr>
            <th>Period</th>
            <th style={{ textAlign: "right" }}>Plan revenue</th>
            <th style={{ textAlign: "right" }}>Plan EBITDA</th>
            <th style={{ textAlign: "right" }}>Actual revenue</th>
            <th style={{ textAlign: "right" }}>Actual EBITDA</th>
            <th style={{ textAlign: "right" }}>Rev. variance</th>
            <th style={{ textAlign: "right" }}>EBITDA variance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const rv = r.actualRevenue != null ? variance(r.actualRevenue, r.revenue) : null;
            const ev = r.actualEbitda != null ? variance(r.actualEbitda, r.ebitda) : null;
            return (
              <tr key={r.name}>
                <td>
                  {r.name}
                  {r.partial && <span className="comp-hint"> (partial)</span>}
                </td>
                <td className="amt">{formatINR(r.revenue)}</td>
                <td className="amt">{formatINR(r.ebitda)}</td>
                <td className="amt">{r.actualRevenue != null ? formatINR(r.actualRevenue) : "—"}</td>
                <td className="amt">{r.actualEbitda != null ? formatINR(r.actualEbitda) : "—"}</td>
                <td className="amt" style={{ color: rv != null && rv < 0 ? "var(--bad-fg)" : rv != null ? "var(--good-fg)" : undefined }}>
                  {varianceLabel(rv)}
                </td>
                <td className="amt" style={{ color: ev != null && ev < 0 ? "var(--bad-fg)" : ev != null ? "var(--good-fg)" : undefined }}>
                  {varianceLabel(ev)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function parseStaffCSV(text: string) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = {
    role: header.findIndex((h) => h.includes("role")),
    department: header.findIndex((h) => h.includes("department")),
    headcount: header.findIndex((h) => h.includes("headcount")),
    salary: header.findIndex((h) => h.includes("salary"))
  };
  const rows: { role: string; department: string; headcount: number; monthlySalary: number }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.trim());
    const role = idx.role >= 0 ? cells[idx.role] : "";
    const salary = idx.salary >= 0 ? parseFloat(cells[idx.salary]) || 0 : 0;
    if (!role || !salary) continue;
    rows.push({
      role,
      department: idx.department >= 0 ? cells[idx.department] || "" : "",
      headcount: idx.headcount >= 0 ? parseFloat(cells[idx.headcount]) || 1 : 1,
      monthlySalary: salary
    });
  }
  return rows;
}

function parseCostCSV(text: string) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = {
    month: header.findIndex((h) => h.includes("month")),
    teaching: header.findIndex((h) => h.includes("teaching")),
    marketing: header.findIndex((h) => h.includes("marketing")),
    admin: header.findIndex((h) => h.includes("admin")),
    rent: header.findIndex((h) => h.includes("rent")),
    other: header.findIndex((h) => h.includes("other"))
  };
  const num = (cells: string[], i: number) => (i >= 0 ? parseFloat(cells[i]) || 0 : 0);
  const rows: ActualCostRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.trim());
    const monthName = idx.month >= 0 ? cells[idx.month] : "";
    const monthIndex = MONTH_NAMES.findIndex((m) => m.toLowerCase() === monthName.toLowerCase());
    if (monthIndex < 0) continue;
    rows.push({
      monthIndex,
      teachingCost: num(cells, idx.teaching),
      marketingCost: num(cells, idx.marketing),
      adminCost: num(cells, idx.admin),
      rent: num(cells, idx.rent),
      otherOverheads: num(cells, idx.other)
    });
  }
  return rows;
}

type Props = {
  fiscalYear: string;
  initialAssumptions: Assumptions;
  hasSavedAssumptions: boolean;
  initialStaff: StaffRow[];
  initialActualCosts: ActualCostRow[];
  actualRevenueByMonth: [number, number][];
  counselors: { id: string; name: string }[];
  initialCounselorTargets: CounselorTarget[];
  fyAdmissionActuals: AdmissionActual[];
};

export default function AnnualPlanClient(props: Props) {
  const supabase = supabaseBrowser();
  const [tab, setTab] = useState<"overview" | "staffing" | "reports" | "actuals" | "counselors">("overview");

  // --- Assumptions ---
  const [assumptions, setAssumptions] = useState<Assumptions>(props.initialAssumptions);
  const [savedAssumptions, setSavedAssumptions] = useState<Assumptions>(props.initialAssumptions);
  const [savingAssumptions, setSavingAssumptions] = useState(false);
  const [assumptionsMsg, setAssumptionsMsg] = useState<Msg>(null);
  const assumptionsDirty = JSON.stringify(assumptions) !== JSON.stringify(savedAssumptions);

  function set<K extends keyof Assumptions>(key: K, value: number) {
    setAssumptions((prev) => ({ ...prev, [key]: value }));
    setAssumptionsMsg(null);
  }

  async function saveAssumptions() {
    setSavingAssumptions(true);
    setAssumptionsMsg(null);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("aop_assumptions").upsert(
      {
        fiscal_year: props.fiscalYear,
        students: assumptions.students,
        avg_fee: assumptions.avgFee,
        growth_rate: assumptions.growthRate,
        teaching_pct: assumptions.teachingPct,
        marketing_pct: assumptions.marketingPct,
        admin_pct: assumptions.adminPct,
        rent_monthly: assumptions.rentMonthly,
        other_fixed_monthly: assumptions.otherFixedMonthly,
        tax_rate: assumptions.taxRate,
        updated_by: user?.id ?? null
      },
      { onConflict: "fiscal_year" }
    );
    setSavingAssumptions(false);
    if (error) {
      setAssumptionsMsg({ type: "error", text: error.message });
      return;
    }
    setSavedAssumptions(assumptions);
    setAssumptionsMsg({ type: "success", text: `Saved for FY ${props.fiscalYear} — everyone who opens this page now sees these assumptions.` });
  }

  // --- Staffing ---
  const [staff, setStaff] = useState<StaffState[]>(props.initialStaff.map((s) => ({ ...s })));
  const [deletedStaffIds, setDeletedStaffIds] = useState<string[]>([]);
  const [staffSaving, setStaffSaving] = useState(false);
  const [staffMsg, setStaffMsg] = useState<Msg>(null);

  function updateStaffRow(idx: number, patch: Partial<StaffState>) {
    setStaff((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch, _dirty: true } : r)));
    setStaffMsg(null);
  }
  function addStaffRow() {
    setStaff((prev) => [...prev, { id: crypto.randomUUID(), role: "", department: "", headcount: 1, monthlySalary: 0, _isNew: true, _dirty: true }]);
  }
  function removeStaffRow(idx: number) {
    const row = staff[idx];
    if (row && !row._isNew) setDeletedStaffIds((ids) => [...ids, row.id]);
    setStaff((prev) => prev.filter((_, i) => i !== idx));
  }
  function handleStaffCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseStaffCSV(String(reader.result || ""));
      if (parsed.length === 0) {
        setStaffMsg({ type: "error", text: "No valid rows found — check the Role and MonthlySalaryPerEmployee columns." });
        return;
      }
      setStaff((prev) => [...prev, ...parsed.map((p) => ({ id: crypto.randomUUID(), ...p, _isNew: true, _dirty: true }))]);
      setStaffMsg({ type: "success", text: `Added ${parsed.length} row${parsed.length === 1 ? "" : "s"} — review, then Save.` });
    };
    reader.readAsText(file);
    e.target.value = "";
  }
  async function saveStaff() {
    setStaffSaving(true);
    setStaffMsg(null);
    if (deletedStaffIds.length) {
      const { error } = await supabase.from("aop_staff").delete().in("id", deletedStaffIds);
      if (error) {
        setStaffSaving(false);
        setStaffMsg({ type: "error", text: error.message });
        return;
      }
    }
    const dirty = staff.filter((s) => s._dirty);
    if (dirty.length) {
      const payload = dirty.map((s) => ({
        id: s.id,
        fiscal_year: props.fiscalYear,
        role: s.role,
        department: s.department || null,
        headcount: s.headcount,
        monthly_salary: s.monthlySalary,
        sort_order: staff.indexOf(s)
      }));
      const { error } = await supabase.from("aop_staff").upsert(payload, { onConflict: "id" });
      if (error) {
        setStaffSaving(false);
        setStaffMsg({ type: "error", text: error.message });
        return;
      }
    }
    setStaff((prev) => prev.map((s) => ({ ...s, _dirty: false, _isNew: false })));
    setDeletedStaffIds([]);
    setStaffSaving(false);
    setStaffMsg({ type: "success", text: `Saved roster (${dirty.length} row${dirty.length === 1 ? "" : "s"} updated).` });
  }

  // --- Actual monthly costs ---
  const [costRows, setCostRows] = useState<ActualCostRow[]>(() => {
    const base: ActualCostRow[] = MONTH_NAMES.map((_, i) => ({ monthIndex: i, teachingCost: 0, marketingCost: 0, adminCost: 0, rent: 0, otherOverheads: 0 }));
    props.initialActualCosts.forEach((r) => {
      base[r.monthIndex] = { ...r };
    });
    return base;
  });
  const [dirtyCostMonths, setDirtyCostMonths] = useState<Set<number>>(new Set());
  const [actualsSaving, setActualsSaving] = useState(false);
  const [actualsMsg, setActualsMsg] = useState<Msg>(null);

  function updateCostRow(i: number, patch: Partial<ActualCostRow>) {
    setCostRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    setDirtyCostMonths((prev) => new Set(prev).add(i));
    setActualsMsg(null);
  }
  function handleCostCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCostCSV(String(reader.result || ""));
      if (parsed.length === 0) {
        setActualsMsg({ type: "error", text: "No valid rows found — check the Month column values (Apr..Mar)." });
        return;
      }
      setCostRows((prev) => {
        const next = [...prev];
        parsed.forEach((r) => {
          next[r.monthIndex] = r;
        });
        return next;
      });
      setDirtyCostMonths((prev) => {
        const next = new Set(prev);
        parsed.forEach((r) => next.add(r.monthIndex));
        return next;
      });
      setActualsMsg({ type: "success", text: `Loaded ${parsed.length} month${parsed.length === 1 ? "" : "s"} from the uploaded file — review, then Save.` });
    };
    reader.readAsText(file);
    e.target.value = "";
  }
  async function saveActualCosts() {
    const dirty = [...dirtyCostMonths];
    if (!dirty.length) return;
    setActualsSaving(true);
    setActualsMsg(null);
    const payload = dirty.map((i) => {
      const r = costRows[i];
      return {
        fiscal_year: props.fiscalYear,
        month_index: i,
        teaching_cost: r.teachingCost,
        marketing_cost: r.marketingCost,
        admin_cost: r.adminCost,
        rent: r.rent,
        other_overheads: r.otherOverheads
      };
    });
    const { error } = await supabase.from("aop_actual_costs").upsert(payload, { onConflict: "fiscal_year,month_index" });
    setActualsSaving(false);
    if (error) {
      setActualsMsg({ type: "error", text: error.message });
      return;
    }
    setDirtyCostMonths(new Set());
    setActualsMsg({ type: "success", text: `Saved actual costs for ${dirty.length} month${dirty.length === 1 ? "" : "s"}.` });
  }

  // --- Counselor targets (owner sets, for appraisal against actual admissions) ---
  const [counselorTargets, setCounselorTargets] = useState<Record<string, { targetStudents: number; targetRevenue: number }>>(() => {
    const map: Record<string, { targetStudents: number; targetRevenue: number }> = {};
    props.counselors.forEach((c) => {
      map[c.id] = { targetStudents: 0, targetRevenue: 0 };
    });
    props.initialCounselorTargets.forEach((t) => {
      map[t.counselorId] = { targetStudents: t.targetStudents, targetRevenue: t.targetRevenue };
    });
    return map;
  });
  const [dirtyCounselors, setDirtyCounselors] = useState<Set<string>>(new Set());
  const [counselorTargetsSaving, setCounselorTargetsSaving] = useState(false);
  const [counselorTargetsMsg, setCounselorTargetsMsg] = useState<Msg>(null);

  function updateCounselorTarget(id: string, patch: Partial<{ targetStudents: number; targetRevenue: number }>) {
    setCounselorTargets((prev) => ({ ...prev, [id]: { ...(prev[id] || { targetStudents: 0, targetRevenue: 0 }), ...patch } }));
    setDirtyCounselors((prev) => new Set(prev).add(id));
    setCounselorTargetsMsg(null);
  }

  async function saveCounselorTargets() {
    const dirty = [...dirtyCounselors];
    if (!dirty.length) return;
    setCounselorTargetsSaving(true);
    setCounselorTargetsMsg(null);
    const payload = dirty.map((id) => ({
      fiscal_year: props.fiscalYear,
      counselor_id: id,
      target_students: counselorTargets[id]?.targetStudents || 0,
      target_revenue: counselorTargets[id]?.targetRevenue || 0
    }));
    const { error } = await supabase.from("aop_counselor_targets").upsert(payload, { onConflict: "fiscal_year,counselor_id" });
    setCounselorTargetsSaving(false);
    if (error) {
      setCounselorTargetsMsg({ type: "error", text: error.message });
      return;
    }
    setDirtyCounselors(new Set());
    setCounselorTargetsMsg({ type: "success", text: `Saved targets for ${dirty.length} counselor${dirty.length === 1 ? "" : "s"}.` });
  }

  // --- Derived plan / payroll / reports ---
  const plan = useMemo(() => computePlan(assumptions), [assumptions]);
  const payroll = useMemo(() => computePayroll(staff, plan.revenue), [staff, plan.revenue]);
  const revenueByMonth = useMemo(() => new Map(props.actualRevenueByMonth), [props.actualRevenueByMonth]);
  const costByMonth = useMemo(() => {
    const m = new Map<number, number>();
    costRows.forEach((r) => m.set(r.monthIndex, r.teachingCost + r.marketingCost + r.adminCost + r.rent + r.otherOverheads));
    return m;
  }, [costRows]);

  const monthlyRows = useMemo(() => getMonthlyRows(plan, revenueByMonth, costByMonth), [plan, revenueByMonth, costByMonth]);
  const quarterlyRows = useMemo(() => getQuarterlyRows(plan, revenueByMonth, costByMonth), [plan, revenueByMonth, costByMonth]);
  const weeklyRows = useMemo(() => getWeeklyRows(plan), [plan]);
  const annualRow: PeriodRow = useMemo(() => {
    const withRev = monthlyRows.filter((m) => m.actualRevenue != null);
    const actualRevenue = withRev.length ? withRev.reduce((s, m) => s + (m.actualRevenue || 0), 0) : null;
    const withEbitda = monthlyRows.filter((m) => m.actualEbitda != null);
    const actualEbitda = withEbitda.length ? withEbitda.reduce((s, m) => s + (m.actualEbitda || 0), 0) : null;
    return {
      name: `FY ${props.fiscalYear}`,
      revenue: plan.revenue,
      cost: plan.revenue - plan.ebitda,
      ebitda: plan.ebitda,
      actualRevenue,
      actualEbitda,
      partial: withRev.length > 0 && withRev.length < 12
    };
  }, [plan, monthlyRows, props.fiscalYear]);

  const actualsYTD = useMemo(() => {
    const withRev = monthlyRows.filter((m) => m.actualRevenue != null);
    if (withRev.length === 0) return null;
    const sumRev = withRev.reduce((s, m) => s + (m.actualRevenue || 0), 0);
    const sumPlanRev = withRev.reduce((s, m) => s + m.revenue, 0);
    const withEbitda = withRev.filter((m) => m.actualEbitda != null);
    let ebitdaVarTotal: number | null = null;
    if (withEbitda.length > 0) {
      const sumAct = withEbitda.reduce((s, m) => s + (m.actualEbitda || 0), 0);
      const sumPlan = withEbitda.reduce((s, m) => s + m.ebitda, 0);
      ebitdaVarTotal = variance(sumAct, sumPlan);
    }
    return { count: withRev.length, revVarTotal: variance(sumRev, sumPlanRev), ebitdaVarTotal };
  }, [monthlyRows]);

  const summary = useMemo(() => executiveSummary(assumptions, plan, payroll, actualsYTD), [assumptions, plan, payroll, actualsYTD]);

  const [periodTab, setPeriodTab] = useState<"weekly" | "monthly" | "quarterly" | "annual">("monthly");
  const activeRows = periodTab === "weekly" ? weeklyRows : periodTab === "monthly" ? monthlyRows : periodTab === "quarterly" ? quarterlyRows : [annualRow];

  function exportReportCSV() {
    const header = ["Period", "Plan Revenue", "Plan Cost", "Plan EBITDA", "Actual Revenue", "Actual EBITDA", "Revenue Variance %", "EBITDA Variance %"];
    const lines = [header.join(",")];
    activeRows.forEach((r) => {
      const rv = r.actualRevenue != null ? variance(r.actualRevenue, r.revenue) : null;
      const ev = r.actualEbitda != null ? variance(r.actualEbitda, r.ebitda) : null;
      lines.push(
        [
          csvEsc(r.name),
          r.revenue.toFixed(0),
          r.cost.toFixed(0),
          r.ebitda.toFixed(0),
          r.actualRevenue != null ? r.actualRevenue.toFixed(0) : "",
          r.actualEbitda != null ? r.actualEbitda.toFixed(0) : "",
          rv != null ? rv.toFixed(1) : "",
          ev != null ? ev.toFixed(1) : ""
        ].join(",")
      );
    });
    downloadText(lines.join("\n"), `aop-${periodTab}-${props.fiscalYear}.csv`);
  }

  const payrollVsPlan = payroll.headcount ? variance(payroll.totalAnnual, plan.teaching + plan.admin) : null;

  // --- Company-wide target vs actual (CFO overview) — actuals fetched straight from the
  // Fee Calculator: every admission and payment made this fiscal year. ---
  const companyActual = useMemo(() => {
    const students = props.fyAdmissionActuals.length;
    const booked = props.fyAdmissionActuals.reduce((s, a) => s + a.actualPayable, 0);
    const collected = props.fyAdmissionActuals.reduce((s, a) => s + a.totalPaid, 0);
    const outstanding = props.fyAdmissionActuals.reduce((s, a) => s + Math.max(0, a.outstanding), 0);
    return { students, booked, collected, outstanding };
  }, [props.fyAdmissionActuals]);

  const actualCostsTotal = useMemo(
    () => costRows.reduce((s, r) => s + r.teachingCost + r.marketingCost + r.adminCost + r.rent + r.otherOverheads, 0),
    [costRows]
  );
  const actualEbitdaCash = companyActual.collected - actualCostsTotal;

  const studentsAchievedPct = assumptions.students ? Math.round((companyActual.students / assumptions.students) * 1000) / 10 : null;
  const revenueBookedAchievedPct = plan.revenue ? Math.round((companyActual.booked / plan.revenue) * 1000) / 10 : null;
  const revenueCollectedAchievedPct = plan.revenue ? Math.round((companyActual.collected / plan.revenue) * 1000) / 10 : null;
  const ebitdaAchievedPct = plan.ebitda ? Math.round((actualEbitdaCash / plan.ebitda) * 1000) / 10 : null;

  const counselorTargetsList: CounselorTarget[] = useMemo(
    () =>
      props.counselors.map((c) => ({
        counselorId: c.id,
        targetStudents: counselorTargets[c.id]?.targetStudents || 0,
        targetRevenue: counselorTargets[c.id]?.targetRevenue || 0
      })),
    [props.counselors, counselorTargets]
  );
  const counselorPerformance = useMemo(
    () => computeCounselorPerformance(props.fyAdmissionActuals, counselorTargetsList, props.counselors),
    [props.fyAdmissionActuals, counselorTargetsList, props.counselors]
  );

  return (
    <>
      <p className="lede">
        S-CUBUS Annual Operating Plan for <strong>FY {props.fiscalYear}</strong> (Apr–Mar) — owner-only. Move the assumptions to model the
        year, and the P&amp;L, budget split, reports and executive summary all recalculate instantly. Actual revenue below is pulled
        automatically from real fee data already recorded in the Fee Portal; only actual costs need to be entered by hand.
      </p>

      <div className="tabs">
        {(
          [
            ["overview", "Overview"],
            ["staffing", "Staffing & Payroll"],
            ["reports", "Reports"],
            ["actuals", "Actual vs Plan"],
            ["counselors", "Counselor Performance"]
          ] as const
        ).map(([key, label]) => (
          <button key={key} className={`tab-btn${tab === key ? " active" : ""}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-head">
              <span className="kicker">CFO overview</span>
              <h2 className="card-title">Target vs actual, FY {props.fiscalYear}</h2>
            </div>
            <p className="comp-hint" style={{ marginBottom: 16 }}>
              Targets are the assumptions you set below (e.g. {assumptions.students.toLocaleString("en-IN")} students at{" "}
              {formatINR(assumptions.avgFee)} average fee). Actuals are fetched live from every admission and payment recorded in the Fee
              Calculator this fiscal year.
            </p>

            <div style={{ overflowX: "auto", marginBottom: 20 }}>
              <table className="data compare-table" style={{ minWidth: 640 }}>
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th style={{ textAlign: "right" }}>Target</th>
                    <th style={{ textAlign: "right" }}>Actual</th>
                    <th style={{ textAlign: "right" }}>Achieved</th>
                  </tr>
                </thead>
                <tbody>
                  <CompareRow
                    label="Students admitted"
                    target={assumptions.students}
                    actual={companyActual.students}
                    achievedPct={studentsAchievedPct}
                    formatter={(n) => n.toLocaleString("en-IN")}
                  />
                  <CompareRow
                    label="Revenue booked"
                    hint="Total fee payable across every admission made this year"
                    target={plan.revenue}
                    actual={companyActual.booked}
                    achievedPct={revenueBookedAchievedPct}
                    formatter={formatINR}
                  />
                  <CompareRow
                    label="Revenue collected"
                    hint="Actually received so far — registration + every installment logged"
                    target={plan.revenue}
                    actual={companyActual.collected}
                    achievedPct={revenueCollectedAchievedPct}
                    formatter={formatINR}
                  />
                  <CompareRow
                    label="Yet to be collected"
                    hint="Outstanding balance across every admission made this year"
                    target={null}
                    actual={companyActual.outstanding}
                    achievedPct={null}
                    formatter={formatINR}
                  />
                  <CompareRow
                    label="EBITDA (cash)"
                    hint="Revenue collected minus actual costs entered in Actual vs Plan"
                    target={plan.ebitda}
                    actual={actualEbitdaCash}
                    achievedPct={ebitdaAchievedPct}
                    formatter={formatINR}
                  />
                </tbody>
              </table>
            </div>

            <div className="grid-2">
              <div>
                <div className="comp-hint" style={{ marginBottom: 10, fontWeight: 600, color: "var(--ink)" }}>
                  Revenue: target vs booked vs collected
                </div>
                <HBarGroup
                  formatter={formatINR}
                  items={[
                    { label: "Target", value: plan.revenue, color: "#2a78d6" },
                    { label: "Booked", value: companyActual.booked, color: "#eb6834" },
                    { label: "Collected", value: companyActual.collected, color: "#1baf7a" }
                  ]}
                />
                <div className="legend" style={{ marginTop: 8 }}>
                  <div className="legend-item">
                    <span className="legend-swatch" style={{ background: "#2a78d6" }} />
                    <span className="legend-label">Target</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-swatch" style={{ background: "#eb6834" }} />
                    <span className="legend-label">Booked</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-swatch" style={{ background: "#1baf7a" }} />
                    <span className="legend-label">Collected</span>
                  </div>
                </div>
              </div>
              <div>
                <div className="comp-hint" style={{ marginBottom: 10, fontWeight: 600, color: "var(--ink)" }}>
                  Students: target vs admitted
                </div>
                <HBarGroup
                  formatter={(n) => n.toLocaleString("en-IN")}
                  items={[
                    { label: "Target", value: assumptions.students, color: TARGET_COLOR },
                    { label: "Admitted", value: companyActual.students, color: ACTUAL_COLOR }
                  ]}
                />
                <div className="legend" style={{ marginTop: 8 }}>
                  <div className="legend-item">
                    <span className="legend-swatch" style={{ background: TARGET_COLOR }} />
                    <span className="legend-label">Target</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-swatch" style={{ background: ACTUAL_COLOR }} />
                    <span className="legend-label">Admitted</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="comp-hint" style={{ marginBottom: 10, fontWeight: 600, color: "var(--ink)" }}>
            Full-year target (from assumptions below)
          </div>
          <div className="kpi-grid" style={{ marginBottom: 24 }}>
            <div className="kpi">
              <div className="kpi-label">Revenue</div>
              <div className="kpi-val">{formatINR(plan.revenue)}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">EBITDA</div>
              <div className="kpi-val">{formatINR(plan.ebitda)}</div>
              <div className="stat-note">{pct1(plan.ebitdaMarginPct)} margin</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Net profit</div>
              <div className="kpi-val">{formatINR(plan.netProfit)}</div>
              <div className="stat-note">{pct1(plan.netMarginPct)} margin</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Break-even students</div>
              <div className="kpi-val">{plan.breakEven != null ? plan.breakEven.toLocaleString("en-IN") : "—"}</div>
              <div className="stat-note">of {assumptions.students.toLocaleString("en-IN")} planned</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-head">
              <span className="kicker">Executive summary</span>
              <h2 className="card-title">How this plan reads</h2>
            </div>
            {summary.map((p, i) => (
              <p key={i} className="lede" style={{ marginBottom: i === summary.length - 1 ? 0 : 14 }}>
                {p}
              </p>
            ))}
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="card-head">
                <span className="kicker">Assumptions</span>
                <h2 className="card-title">Plan inputs</h2>
              </div>
              <div className="stack" style={{ gap: 18 }}>
                <SliderField label="Students" value={assumptions.students} onChange={(v) => set("students", v)} min={0} max={3000} step={10} />
                <SliderField
                  label="Average fee / student"
                  value={assumptions.avgFee}
                  onChange={(v) => set("avgFee", v)}
                  min={0}
                  max={200000}
                  step={500}
                  suffix="₹ per student, blended across all batches"
                />
                <SliderField
                  label="YoY growth rate"
                  value={assumptions.growthRate}
                  onChange={(v) => set("growthRate", v)}
                  min={-30}
                  max={80}
                  step={1}
                  suffix="% vs last year's revenue"
                />
                <SliderField
                  label="Teaching & academic"
                  value={assumptions.teachingPct}
                  onChange={(v) => set("teachingPct", v)}
                  min={0}
                  max={70}
                  step={1}
                  suffix="% of revenue"
                />
                <SliderField
                  label="Marketing & admissions"
                  value={assumptions.marketingPct}
                  onChange={(v) => set("marketingPct", v)}
                  min={0}
                  max={30}
                  step={1}
                  suffix="% of revenue"
                />
                <SliderField
                  label="Admin, ops & support"
                  value={assumptions.adminPct}
                  onChange={(v) => set("adminPct", v)}
                  min={0}
                  max={30}
                  step={1}
                  suffix="% of revenue"
                />
                <SliderField label="Rent" value={assumptions.rentMonthly} onChange={(v) => set("rentMonthly", v)} min={0} max={1000000} step={5000} suffix="₹ per month" />
                <SliderField
                  label="Other fixed overheads"
                  value={assumptions.otherFixedMonthly}
                  onChange={(v) => set("otherFixedMonthly", v)}
                  min={0}
                  max={500000}
                  step={2500}
                  suffix="₹ per month"
                />
                <SliderField label="Income tax rate" value={assumptions.taxRate} onChange={(v) => set("taxRate", v)} min={0} max={40} step={1} suffix="% of EBITDA, if positive" />
              </div>

              <div style={{ height: 1, background: "var(--line)", margin: "20px 0" }} />
              {assumptionsMsg && <div className={assumptionsMsg.type === "error" ? "error-text" : "success-text"} style={{ marginBottom: 12 }}>{assumptionsMsg.text}</div>}
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn" onClick={saveAssumptions} disabled={savingAssumptions || !assumptionsDirty} style={{ flex: 1 }}>
                  {savingAssumptions ? "Saving…" : assumptionsDirty ? "Save assumptions" : "No changes to save"}
                </button>
                <button className="btn secondary" onClick={() => setAssumptions(savedAssumptions)} disabled={!assumptionsDirty}>
                  Reset
                </button>
              </div>
              {!props.hasSavedAssumptions && <div className="comp-hint" style={{ marginTop: 10 }}>Showing starting defaults — save to persist your own numbers for FY {props.fiscalYear}.</div>}
            </div>

            <div className="stack">
              <div className="card">
                <div className="card-head">
                  <span className="kicker">Budget allocation</span>
                  <h2 className="card-title">Where each rupee of revenue goes</h2>
                </div>
                <AllocationBar segments={plan.segments} />
              </div>

              <div className="card">
                <div className="card-head">
                  <span className="kicker">P&amp;L statement</span>
                  <h2 className="card-title">Annual, FY {props.fiscalYear}</h2>
                </div>
                <PnLTable plan={plan} />
              </div>
            </div>
          </div>
        </>
      )}

      {tab === "staffing" && (
        <div className="card">
          <div className="card-head">
            <span className="kicker">Staffing &amp; payroll</span>
            <h2 className="card-title">Roster, FY {props.fiscalYear}</h2>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="data" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>Role</th>
                  <th style={{ minWidth: 140 }}>Department</th>
                  <th style={{ textAlign: "right" }}>Headcount</th>
                  <th style={{ textAlign: "right" }}>Monthly salary / employee</th>
                  <th style={{ textAlign: "right" }}>Annual cost</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s, idx) => (
                  <tr key={s.id}>
                    <td>
                      <input value={s.role} onChange={(e) => updateStaffRow(idx, { role: e.target.value })} placeholder="e.g. Physics Faculty" />
                    </td>
                    <td>
                      <input value={s.department || ""} onChange={(e) => updateStaffRow(idx, { department: e.target.value })} placeholder="e.g. Academic" />
                    </td>
                    <td>
                      <input
                        className="money-input"
                        type="number"
                        min={0}
                        value={s.headcount}
                        onChange={(e) => updateStaffRow(idx, { headcount: parseFloat(e.target.value) || 0 })}
                        style={{ textAlign: "right" }}
                      />
                    </td>
                    <td>
                      <input
                        className="money-input"
                        type="number"
                        min={0}
                        value={s.monthlySalary}
                        onChange={(e) => updateStaffRow(idx, { monthlySalary: parseFloat(e.target.value) || 0 })}
                        style={{ textAlign: "right" }}
                      />
                    </td>
                    <td className="amt">{formatINR(s.headcount * s.monthlySalary * 12)}</td>
                    <td>
                      <button className="reset-btn" onClick={() => removeStaffRow(idx)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginTop: 16 }}>
            <button className="btn secondary small" onClick={addStaffRow}>
              + Add employee row
            </button>
            <label className="btn secondary small" style={{ margin: 0 }}>
              Bulk upload CSV
              <input type="file" accept=".csv,text/csv" onChange={handleStaffCsvUpload} style={{ display: "none" }} />
            </label>
            <button
              className="reset-btn"
              onClick={() => downloadText("Role,Department,Headcount,MonthlySalaryPerEmployee\nTeacher,Academic,5,45000\nCounselor,Admissions,3,32000\n", "staff-roster-template.csv")}
            >
              Download template
            </button>
          </div>

          <div style={{ height: 1, background: "var(--line)", margin: "20px 0" }} />
          {staffMsg && <div className={staffMsg.type === "error" ? "error-text" : "success-text"} style={{ marginBottom: 12 }}>{staffMsg.text}</div>}
          <button className="btn" onClick={saveStaff} disabled={staffSaving}>
            {staffSaving ? "Saving…" : "Save roster"}
          </button>

          <div style={{ height: 32 }} />

          <div className="card-head">
            <span className="kicker">Payroll summary</span>
            <h2 className="card-title">Bottom-up cross-check</h2>
          </div>
          <div className="kpi-grid" style={{ marginBottom: 20 }}>
            <div className="kpi">
              <div className="kpi-label">Headcount</div>
              <div className="kpi-val">{payroll.headcount}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Total payroll / year</div>
              <div className="kpi-val">{formatINR(payroll.totalAnnual)}</div>
              <div className="stat-note">{pct1(payroll.pctOfRevenue)} of revenue</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Avg. monthly salary</div>
              <div className="kpi-val">{formatINR(payroll.avgMonthly)}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Revenue / employee</div>
              <div className="kpi-val">{payroll.revenuePerEmployee != null ? formatINR(payroll.revenuePerEmployee) : "—"}</div>
            </div>
          </div>
          {payrollVsPlan != null && (
            <p className="comp-hint" style={{ marginBottom: 16 }}>
              This roster runs {varianceLabel(payrollVsPlan)} against the Teaching + Admin assumption in the plan above.
            </p>
          )}
          {payroll.byDept.length > 0 && (
            <table className="data">
              <thead>
                <tr>
                  <th>Department</th>
                  <th style={{ textAlign: "right" }}>Headcount</th>
                  <th style={{ textAlign: "right" }}>Avg. monthly</th>
                  <th style={{ textAlign: "right" }}>Annual</th>
                  <th style={{ textAlign: "right" }}>% of payroll</th>
                </tr>
              </thead>
              <tbody>
                {payroll.byDept.map((d) => (
                  <tr key={d.department}>
                    <td>{d.department}</td>
                    <td className="amt">{d.headcount}</td>
                    <td className="amt">{formatINR(d.avgMonthly)}</td>
                    <td className="amt">{formatINR(d.annual)}</td>
                    <td className="amt">{pct1(d.pctOfPayroll)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "reports" && (
        <div className="card">
          <div className="card-head">
            <span className="kicker">Reports</span>
            <h2 className="card-title">Plan vs actual, by period</h2>
          </div>

          <div className="tabs" style={{ marginBottom: 20 }}>
            {(
              [
                ["weekly", "Weekly"],
                ["monthly", "Monthly"],
                ["quarterly", "Quarterly"],
                ["annual", "Annual"]
              ] as const
            ).map(([key, label]) => (
              <button key={key} className={`tab-btn${periodTab === key ? " active" : ""}`} onClick={() => setPeriodTab(key)}>
                {label}
              </button>
            ))}
          </div>

          <PeriodChart rows={activeRows} />
          <div style={{ height: 20 }} />
          <PeriodTable rows={activeRows} />
          <button className="btn secondary small" style={{ marginTop: 16 }} onClick={exportReportCSV}>
            Export CSV
          </button>
        </div>
      )}

      {tab === "actuals" && (
        <div className="card">
          <div className="card-head">
            <span className="kicker">Actual vs plan</span>
            <h2 className="card-title">Monthly actuals, FY {props.fiscalYear}</h2>
          </div>
          <p className="comp-hint" style={{ marginBottom: 16 }}>
            Actual revenue is pulled automatically from admissions and payments already recorded in the Fee Portal, and can&apos;t be edited
            here. Enter actual costs by hand as they come in, or bulk-upload a CSV.
          </p>

          <div style={{ overflowX: "auto" }}>
            <table className="data" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th>Month</th>
                  <th style={{ textAlign: "right" }}>Actual revenue</th>
                  <th style={{ textAlign: "right" }}>Teaching</th>
                  <th style={{ textAlign: "right" }}>Marketing</th>
                  <th style={{ textAlign: "right" }}>Admin</th>
                  <th style={{ textAlign: "right" }}>Rent</th>
                  <th style={{ textAlign: "right" }}>Other</th>
                </tr>
              </thead>
              <tbody>
                {MONTH_NAMES.map((name, i) => {
                  const r = costRows[i];
                  const rev = revenueByMonth.get(i);
                  return (
                    <tr key={name}>
                      <td>{name}</td>
                      <td className="amt">{rev != null ? formatINR(rev) : "—"}</td>
                      {(["teachingCost", "marketingCost", "adminCost", "rent", "otherOverheads"] as const).map((field) => (
                        <td key={field}>
                          <input
                            className="money-input"
                            type="number"
                            min={0}
                            value={r[field]}
                            onChange={(e) => updateCostRow(i, { [field]: parseFloat(e.target.value) || 0 } as Partial<ActualCostRow>)}
                            style={{ textAlign: "right" }}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginTop: 16 }}>
            <label className="btn secondary small" style={{ margin: 0 }}>
              Bulk upload CSV
              <input type="file" accept=".csv,text/csv" onChange={handleCostCsvUpload} style={{ display: "none" }} />
            </label>
            <button
              className="reset-btn"
              onClick={() =>
                downloadText(
                  "Month,TeachingCost,MarketingCost,AdminCost,Rent,OtherOverheads\n" + MONTH_NAMES.map((m) => `${m},,,,,`).join("\n") + "\n",
                  "actual-costs-template.csv"
                )
              }
            >
              Download template
            </button>
          </div>

          <div style={{ height: 1, background: "var(--line)", margin: "20px 0" }} />
          {actualsMsg && <div className={actualsMsg.type === "error" ? "error-text" : "success-text"} style={{ marginBottom: 12 }}>{actualsMsg.text}</div>}
          <button className="btn" onClick={saveActualCosts} disabled={actualsSaving || dirtyCostMonths.size === 0}>
            {actualsSaving ? "Saving…" : dirtyCostMonths.size > 0 ? `Save ${dirtyCostMonths.size} month${dirtyCostMonths.size === 1 ? "" : "s"}` : "No changes to save"}
          </button>

          <div style={{ height: 32 }} />

          <div className="card-head">
            <span className="kicker">Year to date</span>
            <h2 className="card-title">Actual vs plan</h2>
          </div>
          {actualsYTD ? (
            <div className="kpi-grid">
              <div className="kpi">
                <div className="kpi-label">Months with actuals</div>
                <div className="kpi-val">{actualsYTD.count}</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Revenue variance</div>
                <div className="kpi-val" style={{ color: actualsYTD.revVarTotal != null && actualsYTD.revVarTotal < 0 ? "var(--bad-fg)" : "var(--good-fg)" }}>
                  {varianceLabel(actualsYTD.revVarTotal)}
                </div>
              </div>
              <div className="kpi">
                <div className="kpi-label">EBITDA variance</div>
                <div
                  className="kpi-val"
                  style={{ color: actualsYTD.ebitdaVarTotal != null ? (actualsYTD.ebitdaVarTotal < 0 ? "var(--bad-fg)" : "var(--good-fg)") : undefined }}
                >
                  {varianceLabel(actualsYTD.ebitdaVarTotal)}
                </div>
              </div>
            </div>
          ) : (
            <p className="comp-hint">No admissions recorded yet for FY {props.fiscalYear} — actual revenue will appear here automatically once they are.</p>
          )}

          <div style={{ height: 32 }} />

          <div className="card-head">
            <span className="kicker">Month by month</span>
            <h2 className="card-title">Plan vs actual, FY {props.fiscalYear}</h2>
          </div>
          <p className="comp-hint" style={{ marginBottom: 16 }}>
            Actual revenue comes straight from every admission and payment recorded in the Fee Calculator, bucketed by fiscal month; actual
            EBITDA also reflects the costs entered above.
          </p>
          <PeriodChart rows={monthlyRows} />
          <div style={{ height: 20 }} />
          <PeriodTable rows={monthlyRows} />
        </div>
      )}

      {tab === "counselors" && (
        <div className="card">
          <div className="card-head">
            <span className="kicker">Appraisal</span>
            <h2 className="card-title">Counselor performance, FY {props.fiscalYear}</h2>
          </div>

          {props.counselors.length === 0 ? (
            <p className="comp-hint">
              No counselor accounts yet — invite counselors from the Counselors page, then set their targets here.
            </p>
          ) : (
            <>
              <p className="comp-hint" style={{ marginBottom: 16 }}>
                Set each counselor&apos;s target for the year, then compare it against admissions they&apos;ve actually logged in the
                calculator — the same numbers you&apos;d use for an appraisal.
              </p>

              <div style={{ overflowX: "auto", marginBottom: 16 }}>
                <table className="data" style={{ minWidth: 520 }}>
                  <thead>
                    <tr>
                      <th>Counselor</th>
                      <th style={{ textAlign: "right" }}>Target students</th>
                      <th style={{ textAlign: "right" }}>Target revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {props.counselors.map((c) => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td>
                          <input
                            className="money-input"
                            type="number"
                            min={0}
                            value={counselorTargets[c.id]?.targetStudents ?? 0}
                            onChange={(e) => updateCounselorTarget(c.id, { targetStudents: parseFloat(e.target.value) || 0 })}
                            style={{ textAlign: "right" }}
                          />
                        </td>
                        <td>
                          <input
                            className="money-input"
                            type="number"
                            min={0}
                            value={counselorTargets[c.id]?.targetRevenue ?? 0}
                            onChange={(e) => updateCounselorTarget(c.id, { targetRevenue: parseFloat(e.target.value) || 0 })}
                            style={{ textAlign: "right" }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {counselorTargetsMsg && (
                <div className={counselorTargetsMsg.type === "error" ? "error-text" : "success-text"} style={{ marginBottom: 12 }}>
                  {counselorTargetsMsg.text}
                </div>
              )}
              <button className="btn" onClick={saveCounselorTargets} disabled={counselorTargetsSaving || dirtyCounselors.size === 0}>
                {counselorTargetsSaving
                  ? "Saving…"
                  : dirtyCounselors.size > 0
                  ? `Save ${dirtyCounselors.size} target${dirtyCounselors.size === 1 ? "" : "s"}`
                  : "No changes to save"}
              </button>

              <div style={{ height: 32 }} />

              <div className="card-head">
                <span className="kicker">Comparison</span>
                <h2 className="card-title">Target vs actual, by counselor</h2>
              </div>

              <div style={{ overflowX: "auto", marginBottom: 24 }}>
                <table className="data compare-table" style={{ minWidth: 820 }}>
                  <thead>
                    <tr>
                      <th>Counselor</th>
                      <th style={{ textAlign: "right" }}>Target students</th>
                      <th style={{ textAlign: "right" }}>Admissions</th>
                      <th style={{ textAlign: "right" }}>Achieved</th>
                      <th style={{ textAlign: "right" }}>Target revenue</th>
                      <th style={{ textAlign: "right" }}>Collected</th>
                      <th style={{ textAlign: "right" }}>Achieved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {counselorPerformance.map((r) => (
                      <tr key={r.counselorId}>
                        <td>{r.name}</td>
                        <td className="amt">{r.targetStudents || "—"}</td>
                        <td className="amt" style={{ fontWeight: 700 }}>
                          {r.actualStudents}
                        </td>
                        <td className={`amt ${achieveClass(r.studentsAchievedPct) || ""}`}>
                          {r.studentsAchievedPct != null ? pct1(r.studentsAchievedPct) : "—"}
                        </td>
                        <td className="amt">{r.targetRevenue ? formatINR(r.targetRevenue) : "—"}</td>
                        <td className="amt" style={{ fontWeight: 700 }}>
                          {formatINR(r.actualCollected)}
                        </td>
                        <td className={`amt ${achieveClass(r.revenueAchievedPct) || ""}`}>
                          {r.revenueAchievedPct != null ? pct1(r.revenueAchievedPct) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="card-head">
                <span className="kicker">Visual</span>
                <h2 className="card-title">Students: target vs admitted, by counselor</h2>
              </div>
              {counselorPerformance.map((r) => (
                <div key={r.counselorId} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{r.name}</div>
                  <HBarGroup
                    formatter={(n) => n.toLocaleString("en-IN")}
                    items={[
                      { label: "Target", value: r.targetStudents, color: TARGET_COLOR },
                      { label: "Admitted", value: r.actualStudents, color: ACTUAL_COLOR }
                    ]}
                  />
                </div>
              ))}
              <div className="legend">
                <div className="legend-item">
                  <span className="legend-swatch" style={{ background: TARGET_COLOR }} />
                  <span className="legend-label">Target students</span>
                </div>
                <div className="legend-item">
                  <span className="legend-swatch" style={{ background: ACTUAL_COLOR }} />
                  <span className="legend-label">Actual admissions</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
