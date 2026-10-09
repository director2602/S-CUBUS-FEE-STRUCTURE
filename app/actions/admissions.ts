"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

// Assigns a counselor to a student record. The database itself enforces who is allowed to do
// this (see the admissions_update_own_or_owner RLS policy): the owner can always reassign;
// a manager can only pick up a student that is currently unassigned, and only hand it to
// themselves or one of the counselors allotted to them. We select the row back to tell the
// difference between "nothing matched" (no permission) and a real error.
export async function assignCounselorToAdmission(admissionId: string, counselorId: string) {
  const supabase = supabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  if (!counselorId) return { error: "Pick a counselor first." };

  const { data, error } = await supabase
    .from("admissions")
    .update({ counselor_id: counselorId })
    .eq("id", admissionId)
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "You don't have permission to assign this student, or they're already assigned." };
  }

  revalidatePath("/team");
  revalidatePath("/dashboard");
  return { success: true };
}

// Marks an admission refunded (or clears a refund) — only the owner or a manager can call
// this, since it drops the admission out of every revenue/collections count (AOP, dashboard,
// team, org, annual plan, the admissions list) the moment status flips to 'refunded'. The
// record itself is never deleted — it's just excluded from those counts; the owner can still
// open it directly from a direct link and un-refund it here.
export async function setRefundStatus(
  admissionId: string,
  refunded: boolean,
  details?: { refundedAt?: string; refundAmount?: number | null; refundNote?: string | null }
) {
  const supabase = supabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "owner" && profile?.role !== "manager") {
    return { error: "Only the owner or a manager can mark an admission refunded." };
  }

  const payload = refunded
    ? {
        status: "refunded",
        refunded_at: details?.refundedAt || new Date().toISOString().slice(0, 10),
        refund_amount: details?.refundAmount ?? null,
        refund_note: details?.refundNote || null
      }
    : { status: "active", refunded_at: null, refund_amount: null, refund_note: null };

  const { error } = await supabase.from("admissions").update(payload).eq("id", admissionId);
  if (error) return { error: error.message };

  revalidatePath("/calculator");
  revalidatePath("/dashboard");
  revalidatePath("/team");
  revalidatePath("/org");
  revalidatePath("/aop");
  revalidatePath("/annual-plan");
  revalidatePath(`/admissions/${admissionId}`);
  return { success: true };
}
