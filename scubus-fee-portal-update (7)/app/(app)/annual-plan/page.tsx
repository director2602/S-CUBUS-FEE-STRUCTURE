import { supabaseServer } from "@/lib/supabase/server";
import AnnualPlanClient from "@/components/AnnualPlanClient";
import {
  DEFAULT_ASSUMPTIONS,
  currentFiscalYear,
  fiscalMonthIndex,
  type Assumptions,
  type StaffRow,
  type ActualCostRow,
  type CounselorTarget,
  type AdmissionActual
} from "@/lib/aop-calc";

export default async function AnnualPlanPage() {
  const supabase = supabaseServer();
  const fiscalYear = currentFiscalYear();

  const [
    { data: assumptionsRow },
    { data: staffRows },
    { data: actualCostRows },
    { data: paymentRows },
    { data: counselorTargetRows },
    { data: counselorProfiles },
    { data: allAdmissions }
  ] = await Promise.all([
    supabase.from("aop_assumptions").select("*").eq("fiscal_year", fiscalYear).maybeSingle(),
    supabase.from("aop_staff").select("*").eq("fiscal_year", fiscalYear).order("sort_order"),
    supabase.from("aop_actual_costs").select("*").eq("fiscal_year", fiscalYear),
    supabase.from("payments").select("paid_on, amount"),
    supabase.from("aop_counselor_targets").select("*").eq("fiscal_year", fiscalYear),
    supabase.from("profiles").select("id, full_name, email").eq("role", "counselor"),
    // Fetched unfiltered (not .gte/.lte on admission_date) and bucketed into the fiscal year
    // below instead — a null admission_date would otherwise silently drop that admission out
    // of a database-side date-range filter, so an older record that was saved without one
    // still counts here, falling back to when the record was created.
    supabase.from("admissions_computed").select("counselor_id, admission_date, created_at, actual_fees_paid, actual_payable, total_paid, outstanding")
  ]);

  const assumptions: Assumptions = assumptionsRow
    ? {
        students: Number(assumptionsRow.students),
        avgFee: Number(assumptionsRow.avg_fee),
        growthRate: Number(assumptionsRow.growth_rate),
        teachingPct: Number(assumptionsRow.teaching_pct),
        marketingPct: Number(assumptionsRow.marketing_pct),
        adminPct: Number(assumptionsRow.admin_pct),
        rentMonthly: Number(assumptionsRow.rent_monthly),
        otherFixedMonthly: Number(assumptionsRow.other_fixed_monthly),
        taxRate: Number(assumptionsRow.tax_rate)
      }
    : DEFAULT_ASSUMPTIONS;

  const staff: StaffRow[] = ((staffRows as any[]) || []).map((r) => ({
    id: r.id,
    role: r.role,
    department: r.department,
    headcount: Number(r.headcount),
    monthlySalary: Number(r.monthly_salary)
  }));

  const actualCosts: ActualCostRow[] = ((actualCostRows as any[]) || []).map((r) => ({
    monthIndex: r.month_index,
    teachingCost: Number(r.teaching_cost),
    marketingCost: Number(r.marketing_cost),
    adminCost: Number(r.admin_cost),
    rent: Number(r.rent),
    otherOverheads: Number(r.other_overheads)
  }));

  // An admission's own admission_date is the source of truth for which fiscal year it
  // belongs to; if that was left blank when it was saved, fall back to the row's created_at
  // (the date it was actually entered) rather than silently excluding it everywhere.
  const effectiveDate = (r: { admission_date: string | null; created_at: string | null }) => r.admission_date || r.created_at?.slice(0, 10) || null;

  const fyRows = ((allAdmissions as any[]) || []).filter((r) => fiscalMonthIndex(effectiveDate(r) || "", fiscalYear) != null);

  // Auto-pull actual revenue from real fee data: the amount collected at admission
  // (bucketed by its effective date) plus every later installment logged in `payments`
  // (bucketed by its own paid_on date) — both mapped into this fiscal year's 0..11
  // month index (0 = Apr … 11 = Mar).
  const revenueByMonth = new Map<number, number>();
  const addRevenue = (dateStr: string | null, amount: number) => {
    if (!dateStr || !amount) return;
    const idx = fiscalMonthIndex(dateStr, fiscalYear);
    if (idx == null) return;
    revenueByMonth.set(idx, (revenueByMonth.get(idx) || 0) + amount);
  };
  fyRows.forEach((r) => addRevenue(effectiveDate(r), Number(r.actual_fees_paid || 0)));
  ((paymentRows as any[]) || []).forEach((r) => addRevenue(r.paid_on, Number(r.amount || 0)));

  const counselors = ((counselorProfiles as any[]) || []).map((p) => ({ id: p.id, name: p.full_name || p.email }));

  const counselorTargets: CounselorTarget[] = ((counselorTargetRows as any[]) || []).map((r) => ({
    counselorId: r.counselor_id,
    targetStudents: Number(r.target_students),
    targetRevenue: Number(r.target_revenue)
  }));

  // Every admission made this fiscal year — the same "actual" data the calculator itself
  // computes (actual_payable, total_paid, outstanding) — used both for the company-wide
  // target-vs-actual overview and the per-counselor performance comparison.
  const fyAdmissionActuals: AdmissionActual[] = fyRows.map((r) => ({
    counselorId: r.counselor_id,
    actualPayable: Number(r.actual_payable || 0),
    totalPaid: Number(r.total_paid || 0),
    outstanding: Number(r.outstanding || 0)
  }));

  return (
    <AnnualPlanClient
      fiscalYear={fiscalYear}
      initialAssumptions={assumptions}
      hasSavedAssumptions={!!assumptionsRow}
      initialStaff={staff}
      initialActualCosts={actualCosts}
      actualRevenueByMonth={[...revenueByMonth.entries()]}
      counselors={counselors}
      initialCounselorTargets={counselorTargets}
      fyAdmissionActuals={fyAdmissionActuals}
    />
  );
}
