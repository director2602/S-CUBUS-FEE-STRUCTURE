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
  custom_fields?: Record<string, string | number>;
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

// Class-wise ARPU target (billed fee per student, after scholarship/discount) — applies to
// every regular offline teaching class. Online-delivered batches and the handful of batches
// that aren't a regular class at all (Special Student, the SATHII exam fee, Dubai Online)
// are excluded, since none of them are meant to be priced against this target.
export const ARPU_TARGET = 110000;
export const ARPU_EXCLUDED_BATCH_KEYS = ["special", "sathii", "dubai"];
export function isOfflineArpuBatch(batchKey: string, batchGroup: string) {
  return batchGroup !== "Online" && !ARPU_EXCLUDED_BATCH_KEYS.includes(batchKey);
}

// Recommended enrollment mix to hit the ARPU target "overall" rather than per class.
// Foundation (8/9/10) is priced structurally below the target no matter how much
// scholarship is trimmed, so the only lever that moves a BLENDED average is the mix
// of students across classes, not headcount in isolation. This models every core
// class (Foundation + JEE + NEET — SIP runs an 80% scholarship by design and isn't a
// revenue-target class; Online/Special/SATHII/Dubai are excluded for the same reason
// as the ARPU card
// above) at a scholarship floor of 40%, then solves for the Foundation : JEE+NEET
// headcount ratio that blends to the target.
export const MIX_TARGET_GROUPS = ["Foundation", "JEE", "NEET"];
export const MIN_SCHOLARSHIP_FLOOR_PCT = 40;

export function floorFee(batch: Batch) {
  return computeFees({
    batch,
    regOverride: null,
    tuitionOverride: null,
    kitOverride: null,
    scholarshipPct: MIN_SCHOLARSHIP_FLOOR_PCT,
    gstRate: 0,
    additionalDiscount: 0,
    actualFeesPaid: 0
  }).actualPayable;
}

// Splits `total` whole students across `n` classes as evenly as possible.
export function splitEvenly(total: number, n: number) {
  if (n <= 0) return [];
  const base = Math.floor(total / n);
  let rem = total - base * n;
  return Array.from({ length: n }, () => {
    if (rem > 0) {
      rem--;
      return base + 1;
    }
    return base;
  });
}

export const INSTALLMENT_LABELS = ["Registration", "Installment 1", "Installment 2", "Installment 3", "Other"] as const;

export type Payment = {
  id: string;
  admission_id: string;
  installment_label: (typeof INSTALLMENT_LABELS)[number];
  amount: number;
  paid_on: string;
  mode: string | null;
  note: string | null;
  recorded_by: string | null;
  created_at: string;
  invoice_no: string | null;
};

// ---- Tax invoice formatting helpers ----

// Standard SAC code for "Commercial Training & Coaching Services" — same code used on
// every line item since every admission is billing the same kind of service.
export const HSN_SAC_CODE = "999294";

export function formatINR2(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "0.00";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// "Towards 2nd instalment of the course fees." style line used as the invoice item's
// description — mirrors how each installment is billed on the printed tax invoice.
export function installmentInvoiceDescription(label: string, note?: string | null) {
  const base =
    label === "Registration"
      ? "Towards registration fee."
      : label === "Installment 1"
      ? "Towards 1st instalment of the course fees."
      : label === "Installment 2"
      ? "Towards 2nd instalment of the course fees."
      : label === "Installment 3"
      ? "Towards 3rd instalment of the course fees."
      : "Towards course fees.";
  return note ? `${base} (${note})` : base;
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigitsToWords(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return TENS[t] + (o ? " " + ONES[o] : "");
}

function threeDigitsToWords(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return (h ? ONES[h] + " Hundred" + (rest ? " " : "") : "") + (rest ? twoDigitsToWords(rest) : "");
}

// Indian numbering (lakh/crore) amount-in-words, e.g. 1650000 -> "Sixteen Lakh Fifty
// Thousand". Used for the "Total In Words" line on the printed tax invoice.
export function numberToWordsIndian(n: number): string {
  const num = Math.round(Math.abs(n));
  if (num === 0) return "Zero";
  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const hundred = num % 1000;
  const parts: string[] = [];
  if (crore) parts.push(threeDigitsToWords(crore) + " Crore");
  if (lakh) parts.push(threeDigitsToWords(lakh) + " Lakh");
  if (thousand) parts.push(threeDigitsToWords(thousand) + " Thousand");
  if (hundred) parts.push(threeDigitsToWords(hundred));
  return parts.join(" ");
}

export function amountInWordsINR(n: number) {
  return `Indian Rupee ${numberToWordsIndian(n)} Only`;
}
