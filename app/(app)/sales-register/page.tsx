import { supabaseServer } from "@/lib/supabase/server";
import SalesRegister from "@/components/SalesRegister";

export default async function SalesRegisterPage() {
  const supabase = supabaseServer();

  // Every payment ever logged, company-wide, joined client-side (below, inside
  // SalesRegister) against admission info — not filtered to status="active" here, unlike
  // the Dashboard, because this is an accounting record: a payment collected before a
  // student later withdrew and was refunded still happened and still needs to reconcile
  // against the bank statement for that date, so it stays in the register (its admission's
  // Status column shows "refunded" rather than disappearing from the ledger).
  const [{ data: payments }, { data: admissions }, { data: profiles }] = await Promise.all([
    supabase.from("payments").select("id, admission_id, installment_label, amount, card_charge_amount, paid_on, mode, invoice_no, note").order("paid_on", { ascending: false }),
    supabase.from("admissions_computed").select("id, scid, student_name, batch_label, batch_group, counselor_id, gst_rate, status"),
    supabase.from("profiles").select("id, full_name, email").eq("role", "counselor")
  ]);

  const counselors = ((profiles as any[]) || []).map((p) => ({ id: p.id, name: p.full_name || p.email }));

  return (
    <>
      <p className="lede">
        Owner-only accounting view &mdash; every sales invoice issued across every counselor and batch, in one
        place.
      </p>
      <SalesRegister
        payments={(payments as any) || []}
        admissions={(admissions as any) || []}
        counselors={counselors}
      />
    </>
  );
}
