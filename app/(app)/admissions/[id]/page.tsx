import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import ReceiptView from "@/components/ReceiptView";

export default async function AdmissionPage({ params }: { params: { id: string } }) {
  const supabase = supabaseServer();
  const { data: admission, error } = await supabase
    .from("admissions_computed")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !admission) notFound();

  return <ReceiptView admission={admission as any} />;
}
