import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import NavLinks from "@/components/NavLinks";
import SignOutButton from "@/components/SignOutButton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = supabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("full_name, role, email, active").eq("id", user.id).single();

  // The owner's "Deactivate" button bans the account at the Auth level, but an access token
  // already issued keeps working until it expires (~1 hour) — this check closes that gap
  // immediately on the next page load, for any already-open session, by bouncing to a page
  // that signs them out properly rather than leaving them looking at a half-working app.
  if (profile?.active === false) redirect("/deactivated");

  const role = profile?.role || "counselor";
  const roleLabel = role === "owner" ? "Owner" : role === "manager" ? "Manager" : role === "accounts" ? "Accounts" : "Counselor";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div className="topbar">
        <div className="topbar-wrap">
          <div className="brand">
            <img className="brand-logo" src="/logo.png" alt="S-CUBUS" />
            <div className="brand-sub">Fee Portal</div>
          </div>
          <div className="nav">
            <NavLinks role={role} />
            <span style={{ color: "#c9bfce", fontSize: 12.5, padding: "0 6px" }}>
              {profile?.full_name || profile?.email} &middot; {roleLabel}
            </span>
            <SignOutButton />
          </div>
        </div>
      </div>
      <div className="wrap">{children}</div>
    </div>
  );
}
