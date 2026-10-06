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
