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

  return <InvoiceView admission={admission as any} payments={(payments as any) || []} initialPaymentId={searchParams?.payment} />;
}
