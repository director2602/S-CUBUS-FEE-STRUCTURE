import { supabaseServer } from "@/lib/supabase/server";
import BulkCreateCounselorsForm from "@/components/BulkCreateCounselorsForm";
import CounselorRoleControl from "@/components/CounselorRoleControl";
import CounselorManagerControl from "@/components/CounselorManagerControl";

export default async function CounselorsPage() {
  const supabase = supabaseServer();
  const { data: counselors } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, manager_id, created_at")
    .in("role", ["counselor", "manager"])
    .order("created_at", { ascending: false });

  const managers = ((counselors as any[]) || [])
    .filter((c) => c.role === "manager")
    .map((m) => ({ id: m.id, name: m.full_name || m.email }));

  return (
    <>
      <p className="lede">Add counselors and see who currently has access to the fee portal.</p>
      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h2 className="card-title">Add counselors</h2>
          </div>
          <BulkCreateCounselorsForm />
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
                  <th>Role</th>
                  <th></th>
                  <th>Reports to</th>
                </tr>
              </thead>
              <tbody>
                {counselors.map((c: any) => (
                  <tr key={c.id}>
                    <td>{c.full_name || "—"}</td>
                    <td>{c.email}</td>
                    <td style={{ textTransform: "capitalize" }}>{c.role}</td>
                    <td>
                      <CounselorRoleControl id={c.id} role={c.role} />
                    </td>
                    <td>
                      {c.role === "counselor" ? (
                        managers.length === 0 ? (
                          <span className="comp-hint">No managers yet</span>
                        ) : (
                          <CounselorManagerControl counselorId={c.id} managerId={c.manager_id} managers={managers} />
                        )
                      ) : (
                        <span className="comp-hint">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {managers.length > 0 && (
            <p className="comp-hint" style={{ marginTop: 10 }}>
              "Reports to" decides whose Team Performance view a counselor shows up in — a manager only sees the
              counselors allotted to them.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
