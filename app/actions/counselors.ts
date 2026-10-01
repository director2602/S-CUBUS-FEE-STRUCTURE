"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Avoids visually ambiguous characters (0/O, 1/l/I) since these are read off a screen and
// typed in by hand by whoever the owner shares them with.
const PASSWORD_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
function generatePassword(length = 10) {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += PASSWORD_CHARS[bytes[i] % PASSWORD_CHARS.length];
  return out;
}

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

export type CounselorCreateResult = {
  email: string;
  fullName: string;
  password?: string;
  error?: string;
};

// Creates counselor (or manager) logins directly, with a generated password the owner shares
// themselves (WhatsApp, in person, however) — no outbound email involved at all. This is the
// reliable path when Supabase's own invite email isn't going out (rate-limited, in spam, or
// the project's default email sending just isn't configured), and it works for any number of
// people in one go.
export async function createCounselorAccounts(rows: { fullName: string; email: string; role?: "counselor" | "manager" }[]) {
  const supabase = supabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "owner") return { error: "Only the owner can add counselors." };

  const cleaned = rows
    .map((r) => ({ fullName: r.fullName.trim(), email: r.email.trim(), role: r.role === "manager" ? "manager" : "counselor" }))
    .filter((r) => r.email);
  if (!cleaned.length) return { error: "Add at least one row with an email." };

  let admin;
  try {
    admin = supabaseAdmin();
  } catch (e: any) {
    return { error: e.message };
  }

  const results: CounselorCreateResult[] = [];
  for (const row of cleaned) {
    const password = generatePassword();
    const { data, error } = await admin.auth.admin.createUser({
      email: row.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: row.fullName || undefined }
    });
    // New accounts are created as 'counselor' by the on_auth_user_created trigger; bump to
    // 'manager' here when that's what was asked for (service role bypasses RLS for this).
    if (!error && data?.user && row.role === "manager") {
      await admin.from("profiles").update({ role: "manager" }).eq("id", data.user.id);
    }
    results.push({
      email: row.email,
      fullName: row.fullName,
      password: error ? undefined : password,
      error: error?.message
    });
  }

  revalidatePath("/counselors");
  revalidatePath("/team");
  return { results };
}

// Promotes/demotes an existing account between 'counselor' and 'manager'. Uses the normal
// (non-admin) client so the usual owner-only RLS policy on profiles enforces who can call this.
export async function setCounselorRole(id: string, role: "counselor" | "manager") {
  const supabase = supabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "owner") return { error: "Only the owner can change roles." };

  const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/counselors");
  revalidatePath("/team");
  return { success: true };
}

// Allots a counselor to a manager (or clears the assignment with managerId = null). Only the
// owner can call this — it decides which manager's "Team Performance" view a counselor shows
// up in.
export async function assignManager(counselorId: string, managerId: string | null) {
  const supabase = supabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "owner") return { error: "Only the owner can allot counselors to managers." };

  const { error } = await supabase.from("profiles").update({ manager_id: managerId }).eq("id", counselorId);
  if (error) return { error: error.message };

  revalidatePath("/counselors");
  revalidatePath("/team");
  return { success: true };
}
