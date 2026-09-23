import { supabaseServer } from "@/lib/supabase/server";
import InviteCounselorForm from "@/components/InviteCounselorForm";

export default async function CounselorsPage() {
  const supabase = supabaseServer();
  const { data: counselors } = await supabase
    .from("profiles")
    .select("id, full_name, email, created_at")
    .eq("role", "counselor")
    .order("created_at", { ascending: false });

  return (
    <>
      <p className="lede">Invite counselors and see who currently has access to the fee portal.</p>
      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h2 className="card-title">Invite a counselor</h2>
          </div>
          <InviteCounselorForm />
        </div>
        <div className="card">
          <div className="card-head">
            <h2 className="card-title">Current counselors</h2>
          </div>
          {!counselors || counselors.length === 0 ? (
            <p className="comp-hint">No counselors added yet.</p>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {counselors.map((c: any) => (
                  <tr key={c.id}>
                    <td>{c.full_name || "—"}</td>
                    <td>{c.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
