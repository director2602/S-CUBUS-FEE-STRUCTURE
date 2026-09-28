import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import EditAdmissionClient from "@/components/EditAdmissionClient";
import type { Batch } from "@/lib/fee-calc";
import type { CustomFieldDef } from "@/lib/custom-fields";

export default async function EditAdmissionPage({ params }: { params: { id: string } }) {
  const supabase = supabaseServer();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const [{ data: admission, error }, { data: batches }, { data: fieldDefRows }] = await Promise.all([
    supabase.from("admissions_computed").select("*").eq("id", params.id).single(),
    supabase.from("batches").select("*").eq("active", true).order("sort_order"),
    supabase.from("custom_field_defs").select("*").eq("entity", "admission").eq("active", true).order("sort_order")
  ]);

  if (error || !admission) notFound();

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
    <EditAdmissionClient
      admission={admission}
      batches={(batches as Batch[]) || []}
      counselorId={user!.id}
      fieldDefs={fieldDefs}
    />
  );
}
