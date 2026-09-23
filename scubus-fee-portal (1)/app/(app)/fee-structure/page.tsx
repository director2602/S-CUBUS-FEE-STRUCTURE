import { supabaseServer } from "@/lib/supabase/server";
import FeeStructureEditor from "@/components/FeeStructureEditor";
import type { Batch } from "@/lib/fee-calc";

export default async function FeeStructurePage() {
  const supabase = supabaseServer();
  const { data: batches } = await supabase.from("batches").select("*").order("sort_order");

  return (
    <>
      <p className="lede">
        This is the base fee structure new admissions pull from. Changing a number here and saving only affects{" "}
        <strong>future</strong> admissions &mdash; every admission already saved keeps the fee it was calculated
        with, so revising fees for a new session never rewrites what an existing student agreed to.
      </p>
      <FeeStructureEditor initialBatches={(batches as Batch[]) || []} />
    </>
  );
}
