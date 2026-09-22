"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function inviteCounselor(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const fullName = String(formData.get("fullName") || "").trim();

  if (!email) return { error: "Email is required." };

  const supabase = supabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "owner") return { error: "Only the owner can invite counselors." };

  let admin;
  try {
    admin = supabaseAdmin();
  } catch (e: any) {
    return { error: e.message };
  }

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName || undefined }
  });
  if (error) return { error: error.message };

  revalidatePath("/counselors");
  return { success: `Invited ${email}.` };
}
