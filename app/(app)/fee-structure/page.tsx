import { supabaseServer } from "@/lib/supabase/server";
import FeeStructureEditor from "@/components/FeeStructureEditor";
import type { Batch } from "@/lib/fee-calc";
import type { CustomFieldDef } from "@/lib/custom-fields";

export default async function FeeStructurePage() {
  const supabase = supabaseServer();
  const [{ data: batches }, { data: fieldDefRows }] = await Promise.all([
    supabase.from("batches").select("*").order("sort_order"),
    supabase.from("custom_field_defs").select("*").eq("entity", "batch").eq("active", true).order("sort_order")
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
    <>
      <p className="lede">
        This is the base fee structure new admissions pull from. Changing a number here and saving only affects{" "}
        <strong>future</strong> admissions &mdash; every admission already saved keeps the fee it was calculated
        with, so revising fees for a new session never rewrites what an existing student agreed to.
      </p>
      <FeeStructureEditor initialBatches={(batches as Batch[]) || []} fieldDefs={fieldDefs} />
    </>
  );
}
