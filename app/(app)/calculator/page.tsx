import { supabaseServer } from "@/lib/supabase/server";
import CalculatorPageClient from "@/components/CalculatorPageClient";
import type { Batch } from "@/lib/fee-calc";

export default async function CalculatorPage() {
  const supabase = supabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { data: batches } = await supabase.from("batches").select("*").eq("active", true).order("sort_order");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user!.id).single();

  return (
    <CalculatorPageClient
      batches={(batches as Batch[]) || []}
      counselorId={user!.id}
      isOwner={profile?.role === "owner"}
    />
  );
}
