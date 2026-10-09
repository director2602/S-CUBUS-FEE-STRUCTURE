import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { formatINR } from "@/lib/fee-calc";
import CounselorStudentsList from "@/components/CounselorStudentsList";
import AssignCounselorControl from "@/components/AssignCounselorControl";

type Row = {
  id: string;
  scid: string | null;
  student_name: string;
  admission_date: string | null;
  batch_label: string;
  eff_scholarship_pct: number;
  scholarship_amount: number;
  additional_discount: number;
  counselor_id: string;
  actual_payable: number;
  total_paid: number;
  outstanding: number;
  created_at: string | null;
  updated_at: string | null;
  last_payment_on: string | null;
};

type CounselorStat = {
  id: string;
  name: string;
  email: string;
  role: string;
  count: number;
  payable: number;
  collected: number;
  outstanding: number;
  scholarshipGiven: number;
  lastUpdate: string | null;
  students: Row[];
};

function fmtWhen(d: string | null) {
  if (!d) return "No activity yet";
  try {
    return new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return d;
  }
}

function latest(...dates: (string | null)[]) {
  let max: string | null = null;
  for (const d of dates) {
    if (!d) continue;
    if (!max || new Date(d).getTime() > new Date(max).getTime()) max = d;
  }
  return max;
}

export default async function TeamPage() {
  const supabase = supabaseServer();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const [{ data: viewerProfile }, { data: rows }, { data: profiles }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user!.id).single(),
    supabase
      .from("admissions_computed")
      .select(
        "id, scid, student_name, admission_date, batch_label, eff_scholarship_pct, scholarship_amount, additional_discount, counselor_id, actual_payable, total_paid, outstanding, created_at, updated_at, last_payment_on"
      )
      .eq("status", "active"),
    supabase.from("profiles").select("id, full_name, email, role").in("role", ["counselor", "manager"])
  ]);

  const isOwner = viewerProfile?.role === "owner";
  const data = (rows as Row[]) || [];
  const people = (profiles as { id: string; full_name: string | null; email: string; role: string }[]) || [];

  const stats = new Map<string, CounselorStat>();
  for (const p of people) {
    stats.set(p.id, {
      id: p.id,
      name: p.full_name || p.email,
      email:
