import { supabaseServer } from "@/lib/supabase/server";
import AnnualPlanClient from "@/components/AnnualPlanClient";
import {
  DEFAULT_ASSUMPTIONS,
  currentFiscalYear,
  fiscalMonthIndex,
  type Assumptions,
  type StaffRow,
  type ActualCostRow
} from "@/lib/aop-calc";

function fyBounds(fy: string) {
  const startYear = parseInt(fy.split("-")[0], 10);
  return { start: `${startYear}-04-01`, end: `${startYear + 1}-03-31` };
}

export default async function AnnualPlanPage() {
  const supabase = supabaseServer();
  const fiscalYear = currentFiscalYear();
  const { start, end } = fyBounds(fiscalYear);

  const [{ data: assumptionsRow }, { data: staffRows }, { data: actualCostRows }, { data: admissionRows }, { data: paymentRows }] =
    await Promise.all([
      supabase.from("aop_assumptions").select("*").eq("fiscal_year", fiscalYear).maybeSingle(),
      supabase.from("aop_staff").select("*").eq("fiscal_year", fiscalYear).order("sort_order"),
      supabase.from("aop_actual_costs").select("*").eq("fiscal_year", fiscalYear),
      supabase.from("admissions").select("admission_date, actual_fees_paid").gte("admission_date", start).lte("admission_date", end),
      supabase.from("payments").select("paid_on, amount").gte("paid_on", start).lte("paid_on", end)
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

  // Auto-pull actual revenue from real fee data: the amount collected at admission
  // (bucketed by admission_date) plus every later installment logged in `payments`
  // (bucketed by its own paid_on date) — both mapped into this fiscal year's 0..11
  // month index (0 = Apr … 11 = Mar).
  const revenueByMonth = new Map<number, number>();
  const addRevenue = (dateStr: string | null, amount: number) => {
    if (!dateStr || !amount) return;
    const idx = fiscalMonthIndex(dateStr, fiscalYear);
    if (idx == null) return;
    revenueByMonth.set(idx, (revenueByMonth.get(idx) || 0) + amount);
  };
  ((admissionRows as any[]) || []).forEach((r) => addRevenue(r.admission_date, Number(r.actual_fees_paid || 0)));
  ((paymentRows as any[]) || []).forEach((r) => addRevenue(r.paid_on, Number(r.amount || 0)));

  return (
    <AnnualPlanClient
      fiscalYear={fiscalYear}
      initialAssumptions={assumptions}
      hasSavedAssumptions={!!assumptionsRow}
      initialStaff={staff}
      initialActualCosts={actualCosts}
      actualRevenueByMonth={[...revenueByMonth.entries()]}
    />
  );
}
