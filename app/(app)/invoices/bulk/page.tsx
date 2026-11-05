import { supabaseServer } from "@/lib/supabase/server";
import BulkInvoiceDownload from "@/components/BulkInvoiceDownload";

export default async function BulkInvoicesPage() {
  const supabase = supabaseServer();

  const { data: paymentsData } = await supabase
    .from("payments")
    .select("*")
    .order("paid_on", { ascending: true })
    .order("created_at", { ascending: true });

  const rows = paymentsData || [];
  const admissionIds = Array.from(new Set(rows.map((p: any) => p.admission_id)));

  const { data: admissionsData } = admissionIds.length
    ? await supabase.from("admissions_computed").select("*").in("id", admissionIds)
    : { data: [] as any[] };

  const admissionsById = new Map((admissionsData || []).map((a: any) => [a.id, a]));

  // Fetched via the same SECURITY DEFINER function the single-invoice page uses, because
  // profiles RLS only lets a counselor read their own row (or a manager/owner read any) — an
  // accounts user printing someone else's invoice would otherwise see no signatory name.
  const counselorIds = Array.from(new Set((admissionsData || []).map((a: any) => a.counselor_id).filter(Boolean)));
  const counselorNameEntries = await Promise.all(
    counselorIds.map(async (id) => {
      const { data } = await supabase.rpc("get_profile_name", { target_id: id });
      return [id, (data as string) || null] as const;
    })
  );
  const counselorNamesById = new Map(counselorNameEntries);

  // Group payments by admission so "amount already paid before this one" (needed for the
  // Balance Due / outstanding line on each invoice) is worked out the same chronological way
  // the single-invoice page works it out — just across every admission at once here.
  const byAdmission = new Map<string, any[]>();
  for (const p of rows) {
    const list = byAdmission.get(p.admission_id) || [];
    list.push(p);
    byAdmission.set(p.admission_id, list);
  }

  const items = rows
    .map((p: any) => {
      const admission = admissionsById.get(p.admission_id);
      if (!admission) return null;
      const siblings = byAdmission.get(p.admission_id) || [];
      const idx = siblings.findIndex((x) => x.id === p.id);
      const paidBefore = admission.actual_fees_paid + siblings.slice(0, idx).reduce((s: number, x: any) => s + Number(x.amount), 0);
      return {
        payment: p,
        admission,
        paidBefore,
        counselorName: counselorNamesById.get(admission.counselor_id) || null
      };
    })
    .filter(Boolean) as { payment: any; admission: any; paidBefore: number; counselorName: string | null }[];

  return (
    <div>
      <div className="card-head" style={{ marginBottom: 16 }}>
        <h2 className="card-title">Bulk Invoices</h2>
      </div>
      <p className="comp-hint" style={{ marginBottom: 16 }}>
        Every tax invoice generated so far, oldest first — download them all as one combined PDF, or narrow to a
        date range first. A payment that isn&rsquo;t showing up here usually means its admission record is
        missing or not visible to your role.
      </p>
      <BulkInvoiceDownload items={items} />
    </div>
  );
}
