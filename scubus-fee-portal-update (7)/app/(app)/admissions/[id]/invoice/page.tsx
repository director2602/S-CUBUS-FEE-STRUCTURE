import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import InvoiceView from "@/components/InvoiceView";

export default async function InvoicePage({ params }: { params: { id: string } }) {
  const supabase = supabaseServer();
  const { data: admission, error } = await supabase
    .from("admissions_computed")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !admission) notFound();

  return <InvoiceView admission={admission as any} />;
}
