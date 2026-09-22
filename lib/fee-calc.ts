// Shared fee-calculation logic — mirrors the SQL in admissions_computed exactly,
// so a number computed here and a number computed by the database always agree.

export type Batch = {
  key: string;
  label: string;
  group_name: string;
  reg_fee: number;
  tuition_fee: number;
  kit_fee: number;
  default_scholarship_pct: number;
  sort_order: number;
  active: boolean;
};

export type FeeInputs = {
  batch: Batch;
  regOverride: number | null;
  tuitionOverride: number | null;
  kitOverride: number | null;
  scholarshipPct: number | null; // null = use batch default
  gstRate: number; // percent, e.g. 18
  additionalDiscount: number;
  actualFeesPaid: number;
};

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatINR(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "₹0";
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export function computeFees(inputs: FeeInputs) {
  const { batch } = inputs;
  const regFee = inputs.regOverride ?? batch.reg_fee;
  const tuitionFee = inputs.tuitionOverride ?? batch.tuition_fee;
  const kitFee = inputs.kitOverride ?? batch.kit_fee;
  const grossFee = regFee + tuitionFee + kitFee;

  const effScholarshipPct = inputs.scholarshipPct ?? batch.default_scholarship_pct;
  const scholarshipAmount = round2(tuitionFee * (effScholarshipPct / 100));
  const netExclGst = grossFee - scholarshipAmount;
  const gstAmount = round2(netExclGst * (inputs.gstRate / 100));
  const netInclGst = netExclGst + gstAmount;

  const actualPayable = Math.max(0, round2(netInclGst - inputs.additionalDiscount));
  const outstanding = round2(actualPayable - inputs.actualFeesPaid);
  const billingStatus: "Paid in Full" | "Unpaid" | "Partially Paid" =
    outstanding <= 0 ? "Paid in Full" : inputs.actualFeesPaid === 0 ? "Unpaid" : "Partially Paid";

  const inst0 = regFee;
  const inst1 = round2((actualPayable - inst0) * 0.4);
  const inst2 = round2((actualPayable - inst0 - inst1) / 2);
  const inst3 = round2(actualPayable - inst0 - inst1 - inst2);
  const totalInstallments = round2(inst0 + inst1 + inst2 + inst3);

  return {
    regFee,
    tuitionFee,
    kitFee,
    grossFee,
    effScholarshipPct,
    scholarshipAmount,
    netExclGst,
    gstAmount,
    netInclGst,
    actualPayable,
    outstanding,
    billingStatus,
    installments: { inst0, inst1, inst2, inst3, total: totalInstallments }
  };
}

export const BATCH_GROUP_ORDER = ["Foundation", "JEE", "NEET", "Online", "SIP", "Other"];
