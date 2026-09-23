import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import EditAdmissionClient from "@/components/EditAdmissionClient";
import type { Batch } from "@/lib/fee-calc";

export default async function EditAdmissionPage({ params }: { params: { id: string } }) {
  const supabase = supabaseServer();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const [{ data: admission, error }, { data: batches }] = await Promise.all([
    supabase.from("admissions_computed").select("*").eq("id", params.id).single(),
    supabase.from("batches").select("*").eq("active", true).order("sort_order")
  ]);

  if (error || !admission) notFound();

  return (
    <EditAdmissionClient
      admission={admission}
      batches={(batches as Batch[]) || []}
      counselorId={user!.id}
    />
  );
}
