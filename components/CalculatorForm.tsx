"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { BATCH_GROUP_ORDER, computeFees, formatINR, installmentDueDate, PAYMENT_MODES, type Batch } from "@/lib/fee-calc";
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

// Mobile numbers are stored and validated as exactly 10 digits everywhere — this strips
// anything typed/pasted that isn't a digit and caps the length at 10 as the person types,
// so the field can never hold letters, spaces, a country code, or more/fewer than 10 digits.
function digitsOnly(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
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
  // Calls the next_scid() DB function rather than querying admissions directly — a direct
  // select here is subject to RLS, which only lets a counselor see their OWN admissions. A
  // counselor who hasn't saved one yet would see zero rows and suggest "0001" even when that
  // number is already taken by someone else's student, blocking every save with a duplicate-key
  // error. next_scid() is SECURITY DEFINER, so it scans the real company-wide sequence.
  const { data, error } = await supabase.rpc("next_scid", { year_prefix: yearPrefix });
  if (!error && typeof data === "string") return data;
  // Fallback (e.g. RPC not reachable): best-effort from whatever this user can see, same as before.
  const { data: rows } = await supabase.from("admissions").select("scid").ilike("scid", `SC${yearPrefix}-%`);
  return nextScidFromExisting(((rows as any[]) || []).map((r) => r.scid), yearPrefix);
}

export default function CalculatorForm({
  batches,
  counselorId,
  onSaved,
  mode = "create",
  admissionId,
  initial,
  fieldDefs = [],
  // Only owner/manager/accounts can override a batch's registration/tuition/kit fee —
  // counselors always get the batch's own numbers. The database enforces this independently
  // (a trigger resets these columns for anyone else on save), so this just keeps the UI
  // honest and in sync with what will actually be saved.
  canEditFees = true
}: {
  batches: Batch[];
  counselorId: string;
  onSaved?: () => void;
  mode?: "create" | "edit";
  admissionId?: string;
  initial?: any;
  fieldDefs?: CustomFieldDef[];
  canEditFees?: boolean;
}) {
  const supabase = supabaseBrowser();
  const [batchKey, setBatchKey] = useState(initial?.batch_key ?? batches[0]?.key ??
