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
  // Total length of this batch's course, in months. No longer used by the refund
  // calculator (see calculateRefundSuggestion below, which follows the company's
  // week-based refund schedule instead) — kept for reference/reporting only.
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
  card_charge_amount: number;
};

// Card/POS convenience charge — a surcharge the counselor can optionally add when a student
// pays an installment by Debit/Credit Card or a QR code generated by the POS machine, to
// offset the bank's MDR on that transaction. It is 1.5% of the fee amount actually being
// paid right now (not the total fee due), and since that 1.5% is itself a separate taxable
// charge, GST is calculated on top of it rather than backed out of it. The result
// (`total`) is what gets added to the invoice as its own line item — it is never counted
// toward the admission's outstanding balance, only `amount` does that.
export const CARD_CHARGE_RATE = 1.5; // percent

export function computeCardCharge(feeAmount: number, gstRate: number) {
  const base = round2(Math.max(0, feeAmount || 0) * (CARD_CHARGE_RATE / 100));
  const gst = round2(base * (Math.max(0, gstRate || 0) / 100));
  return { base, gst, total: round2(base + gst) };
}

// ---- Tax invoice formatting helpers ----

// Standard SAC code for "Commercial Training & Coaching Services" — same code used on
// every line item since every admission is billing the same kind of service.
export const HSN_SAC_CODE = "999294";

// SAC code for "Financial transactions processing and clearing house services" — used for
// the card/POS convenience-charge line only, since that's a different kind of supply than
// the tuition/coaching service above. Confirm with the company's CA before relying on this
// for a GST filing.
export const CARD_CHARGE_SAC_CODE = "997158";

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

// ---- Refund calculation (S-CUBUS official written refund policy) ----
//
// Rules, as per the company's refund policy document:
//
//   - Registration fee is never refundable, in any circumstance.
//   - Kit fee is never refundable once issued — this also stands in for the Technology/LMS
//     fee and Exam/Test fee, which the policy lists separately but aren't tracked as their
//     own line items in this app, so they're treated as already folded into the kit fee.
//   - GST is never refundable (not addressed in the policy document; kept excluded as
//     standard tax treatment, consistent with how it's always been handled here).
//   - Only the TUITION portion of what's been paid is ever eligible for a refund. Payments
//     tagged "Registration" are excluded entirely, but that alone isn't enough: Installment
//     1/2/3 payments are each a BLENDED figure covering tuition, kit fee and GST together
//     (the installment split in computeFees() above divides up actual_payable as a whole, it
//     doesn't bill kit fee as its own line item). So before applying the week's percentage,
//     this also backs the kit-fee and GST share back out of whatever's been paid, leaving only
//     the tuition slice eligible — kit fee, tech/LMS, exam fee and GST stay non-refundable in
//     every case, exactly as the written policy requires, even though they arrive bundled into
//     the same installment payment as tuition does.
//   - The refund clock starts on the LATER of the batch's commencement date or the
//     student's admission (registration) date.
//   - Withdrawal before the batch's own commencement date: 100% of tuition paid so far is
//     refundable, regardless of the admission date.
//   - Otherwise, a fixed percentage of tuition paid applies by week since the clock started:
//     Week 1 (days 0–6) = 75%, Week 2 (7–13) = 50%, Week 3 (14–20) = 25%,
//     Week 4 onward = 0%. This is a step schedule, not a day-by-day taper — once a week's
//     cutoff is crossed, that week's percentage applies in full.
//
// If a required figure or date is missing or invalid, this returns `flagged: true` instead
// of guessing — the caller should fall back to manual entry.
function parseYMDFull(dateStr: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!match) return null;
  return { y: parseInt(match[1], 10), m: parseInt(match[2], 10), d: parseInt(match[3], 10) };
}

function daysBetween(fromDateStr: string, toDateStr: string): number | null {
  const from = parseYMDFull(fromDateStr);
  const to = parseYMDFull(toDateStr);
  if (!from || !to) return null;
  const fromUTC = Date.UTC(from.y, from.m - 1, from.d);
  const toUTC = Date.UTC(to.y, to.m - 1, to.d);
  return Math.round((toUTC - fromUTC) / 86400000);
}

export type RefundSuggestionInput = {
  tuitionPaidSoFar: number | null | undefined; // sum of payments NOT tagged "Registration" — still blended with kit fee & GST at this point
  tuitionFee: number | null | undefined; // batch tuition fee, pre-scholarship
  effScholarshipPct: number | null | undefined; // scholarship % applied against tuition only
  regFee: number | null | undefined; // this admission's actual registration fee (post-override)
  actualPayable: number | null | undefined; // total amount payable — used to size the non-registration pool that tuitionPaidSoFar is a share of
  batchCommencementDate: string | null | undefined;
  admissionDate: string | null | undefined; // registration date — clock starts at the LATER of this and batch commencement
  refundDate: string | null | undefined; // date the withdrawal/refund request was submitted
};

export type RefundSuggestionResult = {
  tuitionPaidSoFar: number; // blended total paid so far, excl. registration (tuition + kit fee + GST) — shown for transparency
  tuitionShareRatio: number; // the fraction of that blended total this admission's figures say is actually tuition
  refundableBase: number; // the isolated TUITION-ONLY portion — what the week's percentage is actually applied to
  tier: "Before Batch Commencement" | "Week 1" | "Week 2" | "Week 3" | "Week 4 or later";
  refundPct: number; // 100, 75, 50, 25, or 0
  refundAmount: number;
  flagged: boolean;
  flagReason: string | null;
};

function flaggedResult(reason: string): RefundSuggestionResult {
  return {
    tuitionPaidSoFar: 0,
    tuitionShareRatio: 0,
    refundableBase: 0,
    tier: "Week 4 or later",
    refundPct: 0,
    refundAmount: 0,
    flagged: true,
    flagReason: reason
  };
}

export function calculateRefundSuggestion(input: RefundSuggestionInput): RefundSuggestionResult {
  const { tuitionPaidSoFar, tuitionFee, effScholarshipPct, regFee, actualPayable, batchCommencementDate, admissionDate, refundDate } = input;

  if (tuitionPaidSoFar == null || Number.isNaN(tuitionPaidSoFar)) {
    return flaggedResult("Tuition payment details are missing — calculate the refund manually.");
  }
  if (tuitionFee == null || regFee == null || actualPayable == null) {
    return flaggedResult("Fee breakdown (tuition/registration/payable) is missing — calculate the refund manually.");
  }
  if (!batchCommencementDate || !refundDate) {
    return flaggedResult("Batch commencement date or refund date is missing — calculate the refund manually.");
  }

  const paidSoFar = Math.max(0, round2(tuitionPaidSoFar));

  // Isolate the tuition-only slice of what's been paid. Installments 1–3 are a blended split
  // of (actual payable − registration fee), covering net tuition (after scholarship), the full
  // kit fee, and GST all together. Only the net-tuition share of that pool is ever refundable —
  // kit fee, tech/LMS, exam fee and GST stay excluded in every case per the written policy, so
  // they're backed out here proportionally rather than assumed to already be separate.
  const netTuitionAfterScholarship = Math.max(0, round2(tuitionFee * (1 - (effScholarshipPct ?? 0) / 100)));
  const nonRegistrationPool = round2(actualPayable - regFee);
  const tuitionShareRatio = nonRegistrationPool > 0 ? Math.min(1, netTuitionAfterScholarship / nonRegistrationPool) : 0;
  const refundableBase = round2(paidSoFar * tuitionShareRatio);

  // Before the batch's own commencement date — 100%, regardless of admission date.
  const daysUntilCommencement = daysBetween(refundDate, batchCommencementDate);
  if (daysUntilCommencement == null) {
    return flaggedResult("Batch commencement date or refund date is invalid — calculate the refund manually.");
  }
  if (daysUntilCommencement > 0) {
    return {
      tuitionPaidSoFar: paidSoFar,
      tuitionShareRatio,
      refundableBase,
      tier: "Before Batch Commencement",
      refundPct: 100,
      refundAmount: refundableBase,
      flagged: false,
      flagReason: null
    };
  }

  // Clock starts on the later of batch commencement or admission (registration) date —
  // plain string comparison works here since both are "YYYY-MM-DD" and sort correctly.
  const effectiveStart = admissionDate && admissionDate > batchCommencementDate ? admissionDate : batchCommencementDate;
  const daysElapsed = daysBetween(effectiveStart, refundDate);
  if (daysElapsed == null) {
    return flaggedResult("Admission date is invalid — calculate the refund manually.");
  }
  const daysSinceStart = Math.max(0, daysElapsed);

  let tier: RefundSuggestionResult["tier"];
  let refundPct: number;
  if (daysSinceStart < 7) {
    tier = "Week 1";
    refundPct = 75;
  } else if (daysSinceStart < 14) {
    tier = "Week 2";
    refundPct = 50;
  } else if (daysSinceStart < 21) {
    tier = "Week 3";
    refundPct = 25;
  } else {
    tier = "Week 4 or later";
    refundPct = 0;
  }

  const refundAmount = Math.min(refundableBase, Math.max(0, round2(refundableBase * (refundPct / 100))));
  return { tuitionPaidSoFar: paidSoFar, tuitionShareRatio, refundableBase, tier, refundPct, refundAmount, flagged: false, flagReason: null };
}
