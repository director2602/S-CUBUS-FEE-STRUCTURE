import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import InvoiceView from "@/components/InvoiceView";

export default async function InvoicePage({ params, searchParams }: { params: { id: string }; searchParams: { payment?: string } }) {
  const supabase = supabaseServer();
  const [{ data: admission, error }, { data: payments }] = await Promise.all([
    supabase.from("admissions_computed").select("*").eq("id", params.id).single(),
    supabase.from("payments").select("*").eq("admission_id", params.id).order("paid_on", { ascending: true })
  ]);

  if (error || !admission) notFound();

  // Fetched via a SECURITY DEFINER function rather than a direct profiles query, because
  // profiles RLS only lets a counselor read their own row (or a manager/owner read any) —
  // an accounts user printing another counselor's invoice would otherwise see no name here.
  const { data: counselorName } = await supabase.rpc("get_profile_name", { target_id: admission.counselor_id });

  return (
    <InvoiceView
      admission={admission as any}
      payments={(payments as any) || []}
      initialPaymentId={searchParams?.payment}
      counselorName={(counselorName as string) || null}
    />
  );
}
