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

  // Fetched via a SECURITY DEFINER function rather than a direct profiles query, because
  // profiles RLS only lets a counselor read their own row (or a manager/owner read any) —
  // an accounts user printing another counselor's fee summary would otherwise see no name.
  const { data: counselorName } = await supabase.rpc("get_profile_name", { target_id: admission.counselor_id });

  return <FeeSummaryView admission={admission as any} counselorName={(counselorName as string) || null} />;
}
