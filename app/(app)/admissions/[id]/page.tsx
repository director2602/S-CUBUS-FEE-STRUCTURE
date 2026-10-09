import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import ReceiptView from "@/components/ReceiptView";
import type { CustomFieldDef } from "@/lib/custom-fields";

export default async function AdmissionPage({ params }: { params: { id: string } }) {
  const supabase = supabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const [{ data: admission, error }, { data: payments }, { data: fieldDefRows }, { data: profile }] = await Promise.all([
    supabase.from("admissions_computed").select("*").eq("id", params.id).single(),
    supabase.from("payments").select("*").eq("admission_id", params.id).order("paid_on", { ascending: false }),
    supabase.from("custom_field_defs").select("*").eq("entity", "admission").order("sort_order"),
    user ? supabase.from("profiles").select("role").eq("id", user.id).single() : Promise.resolve({ data: null })
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

  const canManageRefund = profile?.role === "owner" || profile?.role === "manager";

  return <ReceiptView admission={admission as any} payments={(payments as any) || []} fieldDefs={fieldDefs} canManageRefund={canManageRefund} />;
}
