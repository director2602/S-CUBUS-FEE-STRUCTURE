import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import FeeSummaryView from "@/components/FeeSummaryView";

export default async function FeeSummaryPage({ params }: { params: { id: string } }) {
  const supabase = supabaseServer();
  const { data: admission, error } = await supabase
    .from("admissions_computed")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !admission) notFound();

  return <FeeSummaryView admission={admission as any} />;
}
