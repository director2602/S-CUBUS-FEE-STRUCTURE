import { supabaseServer } from "@/lib/supabase/server";
import CalculatorPageClient from "@/components/CalculatorPageClient";
import type { Batch } from "@/lib/fee-calc";
import type { CustomFieldDef } from "@/lib/custom-fields";

export default async function CalculatorPage() {
  const supabase = supabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const [{ data: batches }, { data: profile }, { data: fieldDefRows }] = await Promise.all([
    supabase.from("batches").select("*").eq("active", true).order("sort_order"),
    supabase.from("profiles").select("role").eq("id", user!.id).single(),
    supabase.from("custom_field_defs").select("*").eq("entity", "admission").eq("active", true).order("sort_order")
  ]);

  const fieldDefs: CustomFieldDef[] = ((fieldDefRows as any[]) || []).map((r) => ({
    id: r.id,
    entity: r.entity,
    field_key: r.field_key,
    label: r.label,
    field_type: r.field_type,
    options: r.options || [],
    sort_order: r.sort_order,
    active: r.active
  }));

  return (
    <CalculatorPageClient
      batches={(batches as Batch[]) || []}
      counselorId={user!.id}
      isOwner={profile?.role === "owner"}
      fieldDefs={fieldDefs}
    />
  );
}
