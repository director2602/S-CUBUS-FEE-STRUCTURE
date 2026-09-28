import { supabaseServer } from "@/lib/supabase/server";
import ManageFieldsClient from "@/components/ManageFieldsClient";
import type { CustomFieldDef } from "@/lib/custom-fields";

export default async function CustomFieldsPage() {
  const supabase = supabaseServer();
  const { data } = await supabase.from("custom_field_defs").select("*").order("sort_order");

  const defs: CustomFieldDef[] = ((data as any[]) || []).map((r) => ({
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
    <>
      <p className="lede">
        Add your own fields to capture anything the standard admission or fee-structure forms don&rsquo;t cover
        &mdash; no code change needed. A field you add here shows up immediately on the relevant form for every
        counselor.
      </p>
      <ManageFieldsClient initialDefs={defs} />
    </>
  );
}
