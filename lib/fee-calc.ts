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
  // Total length of this batch's course, in months — the denominator for a pro-rata refund
  // (see calculateProRataRefund below). Left unset on a batch, refunds for its admissions
  // fall back to manual entry instead of guessing a duration.
  course_duration_months?: number | null;
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

// Installment 2 and 3 due dates — always the 20th of a month counted forward from the
// BATCH COMMENCEMENT date, never a fixed calendar date and never the admission date:
// installment 2 is due the 20th of the month 2 months after batch commencement, installment
// 3 the 20th of the month 4 months after batch commencement. E.g. batch commencement 1 Apr
// -> installment 2 due 20 Jun, installment 3 due 20 Aug. Returns null when the anchor date
// isn't set yet, so callers can fall back to the generic wording.
const SHORT_MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseYMD(dateStr: string): { y: number; m: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!m) return null;
  return { y: parseInt(m[1], 10), m: parseInt(m[2], 10) };
}

export function installmentDueDate(anchorDateStr: string | null | undefined, monthsAhead: number): string | null {
  if (!anchorDateStr) return null;
  const parsed = parseYMD(anchorDateStr);
  if (!parsed) return null;
  const zeroBasedTotal = parsed.y * 12 + (parsed.m - 1) + monthsAhead;
  const y = Math.floor(zeroBasedTotal / 12);
  const m = (((zeroBasedTotal % 12) + 12) % 12) + 1;
  return `20 ${SHORT_MONTH_NAMES[m - 1]} ${y}`;
}

export const INSTALLMENT_LABELS = ["Registration", "Installment 1", "Installment 2", "Installment 3", "Other"] as const;

// Fixed list of payment modes — every role picks from this dropdown rather than typing a
// free-text mode, so "UPI", "upi", "Upi transfer" etc. never end up as different values on
// different admissions/payments. No role gets a free-text override, owner included.
export const PAYMENT_MODES = [
  "Cash",
  "UPI",
  "Online Transfer (NEFT/RTGS/IMPS)",
  "Debit/Credit Card",
  "Cheque",
  "PDC (Post-dated Cheque)",
  "Demand Draft (DD)",
  "Net Banking"
] as const;

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

// ---- Pro-rata refund calculation ----
//
// Business rule (as specified): when a student discontinues, the refund is calculated on
// the fee actually collected, minus whatever is never refundable, prorated by how much of
// the course is still unused:
//
//   Refundable Base   = Total Fee Paid − Registration Fee − Kit Fee − Non-Refundable GST
//   Pro-Rata Refund    = Refundable Base × (Unused Service Period ÷ Total Service Period)
//
// Registration fee, kit fee (once issued), and GST are never part of the refundable base —
// they're deducted in full regardless of how early the student discontinues. "Service
// period" is counted in months from the batch's commencement date (not the admission date)
// to the refund date, against the batch's total course duration.
//
// If any required figure or date is missing, or the batch has no course duration configured,
// this returns `flagged: true` instead of guessing — the caller should fall back to manual
// entry rather than show a number that might be wrong.
function parseYMDFull(dateStr: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!match) return null;
  return { y: parseInt(match[1], 10), m: parseInt(match[2], 10), d: parseInt(match[3], 10) };
}

function daysInMonth(y: number, m: number): number {
  // m is 1-based; day 0 of the following month is the last day of month m.
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// Calendar months between two dates, with the leftover days expressed as a fraction of the
// TARGET month's length — e.g. 1 Jan to 1 May is exactly 4.0 months, and 15 Jan to 1 Feb is
// 0.5 months. This is what makes "4 months used of a 12-month course" land on a whole number
// when the anchor and refund dates share the same day-of-month, matching how the business
// rule's own worked example is stated.
function monthsBetween(fromDateStr: string, toDateStr: string): number | null {
  const from = parseYMDFull(fromDateStr);
  const to = parseYMDFull(toDateStr);
  if (!from || !to) return null;
  const wholeMonths = to.y * 12 + to.m - (from.y * 12 + from.m);
  const dayFraction = (to.d - from.d) / daysInMonth(to.y, to.m);
  return wholeMonths + dayFraction;
}

export type ProRataRefundInput = {
  totalFeePaid: number | null | undefined;
  registrationFee: number | null | undefined;
  kitFee: number | null | undefined;
  gstAmount: number | null | undefined;
  totalServiceMonths: number | null | undefined; // from the batch's course_duration_months
  batchCommencementDate: string | null | undefined; // "service" starts here, not admission date
  refundDate: string | null | undefined;
};

export type ProRataRefundResult = {
  refundableBase: number;
  usedMonths: number;
  unusedMonths: number;
  refundAmount: number;
  flagged: boolean;
  flagReason: string | null;
};

function flaggedResult(reason: string): ProRataRefundResult {
  return { refundableBase: 0, usedMonths: 0, unusedMonths: 0, refundAmount: 0, flagged: true, flagReason: reason };
}

export function calculateProRataRefund(input: ProRataRefundInput): ProRataRefundResult {
  const { totalFeePaid, registrationFee, kitFee, gstAmount, totalServiceMonths, batchCommencementDate, refundDate } = input;

  if (
    totalFeePaid == null || Number.isNaN(totalFeePaid) ||
    registrationFee == null || Number.isNaN(registrationFee) ||
    kitFee == null || Number.isNaN(kitFee) ||
    gstAmount == null || Number.isNaN(gstAmount)
  ) {
    return flaggedResult("Fee details are missing or invalid — calculate the refund manually.");
  }
  if (!batchCommencementDate || !refundDate) {
    return flaggedResult("Batch commencement date or refund date is missing — calculate the refund manually.");
  }
  if (totalServiceMonths == null || Number.isNaN(totalServiceMonths) || totalServiceMonths <= 0) {
    return flaggedResult("This batch has no course duration configured (set it in Fee Structure) — calculate the refund manually.");
  }

  const elapsed = monthsBetween(batchCommencementDate, refundDate);
  if (elapsed == null) {
    return flaggedResult("Batch commencement date or refund date is invalid — calculate the refund manually.");
  }

  const refundableBase = Math.max(0, round2(totalFeePaid - registrationFee - kitFee - gstAmount));
  const usedMonths = Math.min(Math.max(elapsed, 0), totalServiceMonths);
  const unusedMonths = Math.max(0, totalServiceMonths - usedMonths);

  if (unusedMonths <= 0) {
    return { refundableBase, usedMonths, unusedMonths: 0, refundAmount: 0, flagged: false, flagReason: null };
  }

  const refundAmount = Math.min(refundableBase, Math.max(0, round2(refundableBase * (unusedMonths / totalServiceMonths))));

  return { refundableBase, usedMonths, unusedMonths, refundAmount, flagged: false, flagReason: null };
}
