"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { BATCH_GROUP_ORDER, computeFees, formatINR, type Batch } from "@/lib/fee-calc";
import { cleanCustomFieldValues, type CustomFieldDef } from "@/lib/custom-fields";
import CustomFieldInputs from "@/components/CustomFieldInputs";
import { currentFiscalYear } from "@/lib/aop-calc";
import type { SupabaseClient } from "@supabase/supabase-js";

type Student = {
  scid: string;
  name: string;
  mother: string;
  father: string;
  email: string;
  phone1: string;
  phone2: string;
  admissionDate: string;
  batchStart: string;
};

type Notes = {
  modeReg: string;
  mode1: string;
  mode2: string;
  mode3: string;
  pdc1: string;
  pdc2: string;
  remarks: string;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const emptyStudent: Student = {
  scid: "",
  name: "",
  mother: "",
  father: "",
  email: "",
  phone1: "",
  phone2: "",
  admissionDate: todayISO(),
  batchStart: ""
};

const emptyNotes: Notes = { modeReg: "", mode1: "", mode2: "", mode3: "", pdc1: "", pdc2: "", remarks: "" };

// SCID format: SC + {both years of the fiscal year, e.g. 26 + 27 = "2627"} + "-" +
// {4-digit sequence} — e.g. SC2627-0001 for the first admission of FY 2026-27, SC2627-0142
// for the 142nd. The year part rolls over automatically every April along with the fiscal
// year, and the sequence is per-year (starts over at 0001 each new fiscal year), so a SCID
// on its own tells you which fiscal year an admission belongs to — handy when uploading or
// comparing admissions across fiscal years. Admissions saved before this format was
// introduced keep whatever SCID they already have; only new admissions get this format.
function scidYearPrefix() {
  const [startYear, endYY] = currentFiscalYear().split("-");
  return `${startYear.slice(-2)}${endYY}`;
}

function nextScidFromExisting(existingScids: (string | null)[], yearPrefix: string) {
  const pattern = new RegExp(`^SC${yearPrefix}-(\\d{4})$`, "i");
  let maxN = 0;
  for (const s of existingScids) {
    const m = s ? pattern.exec(s) : null;
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
  }
  return `SC${yearPrefix}-${String(maxN + 1).padStart(4, "0")}`;
}

async function fetchNextScid(supabase: SupabaseClient) {
  const yearPrefix = scidYearPrefix();
  const { data } = await supabase.from("admissions").select("scid").ilike("scid", `SC${yearPrefix}-%`);
  return nextScidFromExisting(((data as any[]) || []).map((r) => r.scid), yearPrefix);
}

export default function CalculatorForm({
  batches,
  counselorId,
  onSaved,
  mode = "create",
  admissionId,
  initial,
  fieldDefs = []
}: {
  batches: Batch[];
  counselorId: string;
  onSaved?: () => void;
  mode?: "create" | "edit";
  admissionId?: string;
  initial?: any;
  fieldDefs?: CustomFieldDef[];
}) {
  const supabase = supabaseBrowser();
  const [batchKey, setBatchKey] = useState(initial?.batch_key ?? batches[0]?.key ?? "");
  const [regOverride, setRegOverride] = useState<number | null>(initial?.reg_fee_override ?? null);
  const [tuitionOverride, setTuitionOverride] = useState<number | null>(initial?.tuition_fee_override ?? null);
  const [kitOverride, setKitOverride] = useState<number | null>(initial?.kit_fee_override ?? null);
  const [scholarshipPct, setScholarshipPct] = useState<number | null>(initial?.scholarship_pct ?? null);
  const [gstRate, setGstRate] = useState(initial?.gst_rate ?? 18);
  const [additionalDiscount, setAdditionalDiscount] = useState(initial?.additional_discount ?? 0);
  const [actualFeesPaid, setActualFeesPaid] = useState(initial?.actual_fees_paid ?? 0);
  const [student, setStudent] = useState<Student>(
    initial
      ? {
          scid: initial.scid ?? "",
          name: initial.student_name ?? "",
          mother: initial.mother_name ?? "",
          father: initial.father_name ?? "",
          email: initial.email ?? "",
          phone1: initial.phone1 ?? "",
          phone2: initial.phone2 ?? "",
          // A blank admission date silently drops this record from Annual Plan / Dashboard
          // fiscal-year totals (they filter by this date), so an older record saved without
          // one gets today's date pre-filled here — a one-click Save backfills it correctly,
          // or the counselor can pick the real date before saving.
          admissionDate: initial.admission_date ?? todayISO(),
          batchStart: initial.batch_commencement_date ?? ""
        }
      : emptyStudent
  );
  const [notes, setNotes] = useState<Notes>(
    initial
      ? {
          modeReg: initial.mode_reg ?? "",
          mode1: initial.mode1 ?? "",
          mode2: initial.mode2 ?? "",
          mode3: initial.mode3 ?? "",
          pdc1: initial.pdc1 ?? "",
          pdc2: initial.pdc2 ?? "",
          remarks: initial.remarks ?? ""
        }
      : emptyNotes
  );
  const [customValues, setCustomValues] = useState<Record<string, string>>(() => {
    const src = initial?.custom_fields || {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(src)) out[k] = v == null ? "" : String(v);
    return out;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [scidLoading, setScidLoading] = useState(mode === "create");

  // New admissions get the next SCID in sequence automatically — no typing, no risk of a
  // duplicate or a typo'd number. Editing an existing admission leaves its SCID as saved.
  useEffect(() => {
    if (mode !== "create") return;
    let cancelled = false;
    fetchNextScid(supabase)
      .then((scid) => {
        if (!cancelled) setStudent((prev) => (prev.scid ? prev : { ...prev, scid }));
      })
      .finally(() => {
        if (!cancelled) setScidLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  async function refreshScid() {
    setScidLoading(true);
    const scid = await fetchNextScid(supabase);
    setStudent((prev) => ({ ...prev, scid }));
    setScidLoading(false);
  }

  const batch = useMemo(() => batches.find((b) => b.key === batchKey) ?? batches[0], [batches, batchKey]);
  const groups = useMemo(
    () =>
      BATCH_GROUP_ORDER.map((g) => ({ group: g, items: batches.filter((b) => b.group_name === g) })).filter(
        (g) => g.items.length
      ),
    [batches]
  );

  const result = useMemo(() => {
    if (!batch) return null;
    return computeFees({
      batch,
      regOverride,
      tuitionOverride,
      kitOverride,
      scholarshipPct,
      gstRate,
      additionalDiscount,
      actualFeesPaid
    });
  }, [batch, regOverride, tuitionOverride, kitOverride, scholarshipPct, gstRate, additionalDiscount, actualFeesPaid]);

  function resetAllForNewBatch(key: string) {
    setBatchKey(key);
    setRegOverride(null);
    setTuitionOverride(null);
    setKitOverride(null);
  }

  async function handleSave() {
    if (!batch || !student.name.trim()) {
      setError("Enter the student's name before saving.");
      return;
    }
    if (!student.admissionDate) {
      // Required: Annual Plan and Dashboard totals for a fiscal year are filtered by this
      // date, so a blank one silently excludes the admission from every "actuals" figure.
      setError("Set the admission date before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    setSavedMsg(null);

    const payload = {
      scid: student.scid || null,
      student_name: student.name,
      mother_name: student.mother || null,
      father_name: student.father || null,
      email: student.email || null,
      phone1: student.phone1 || null,
      phone2: student.phone2 || null,
      admission_date: student.admissionDate || null,
      batch_commencement_date: student.batchStart || null,
      batch_key: batch.key,
      // Always store the actual effective numbers (never null) so this admission is a frozen
      // snapshot: a later change to the batch's base fee structure (a fee revision) must never
      // retroactively alter a fee that was already calculated and agreed with a student.
      reg_fee_override: regOverride ?? batch.reg_fee,
      tuition_fee_override: tuitionOverride ?? batch.tuition_fee,
      kit_fee_override: kitOverride ?? batch.kit_fee,
      scholarship_pct: scholarshipPct ?? batch.default_scholarship_pct,
      gst_rate: gstRate,
      additional_discount: additionalDiscount,
      actual_fees_paid: actualFeesPaid,
      mode_reg: notes.modeReg || null,
      mode1: notes.mode1 || null,
      mode2: notes.mode2 || null,
      mode3:
