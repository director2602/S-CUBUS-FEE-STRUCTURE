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

  // Any counselor can now look up and view/print any student's invoice (company-wide read
  // access — see admissions_select_any_counselor / payments_select_any_counselor in the DB),
  // but editing payments, overriding fee amounts, or re-signing the fee summary stays limited
  // to that student's own assigned counselor, or the owner — same as the database write
  // policies already enforce. This flag is what hides those write controls in the UI instead
  // of letting someone click "Save" and discover it fails.
  const canEdit = profile?.role === "owner" || user?.id === (admission as any).counselor_id;

  // Fetched separately rather than via admissions_computed — that view's deeply chained CTEs
  // would need every layer touched to carry one more column through, where a direct lookup
  // on the admission's own batch_key does the same job in one query.
  const { data: batchRow } = await supabase
    .from("batches")
    .select("course_duration_months")
    .eq("key", (admission as any).batch_key)
    .single();
  const courseDurationMonths = (batchRow as any)?.course_duration_months ?? null;

  return (
    <ReceiptView
      admission={admission as any}
      payments={(payments as any) || []}
      fieldDefs={fieldDefs}
      canManageRefund={canManageRefund}
      courseDurationMonths={courseDurationMonths}
      canEdit={canEdit}
    />
  );
}
