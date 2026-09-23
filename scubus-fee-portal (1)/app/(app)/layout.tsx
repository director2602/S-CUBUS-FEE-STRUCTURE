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

  const { data: profile } = await supabase.from("profiles").select("full_name, role, email").eq("id", user.id).single();

  const isOwner = profile?.role === "owner";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div className="topbar">
        <div className="topbar-wrap">
          <div className="brand">
            <img className="brand-logo" src="/logo.png" alt="S-CUBUS" />
            <div className="brand-sub">Fee Portal</div>
          </div>
          <div className="nav">
            <NavLinks isOwner={isOwner} />
            <span style={{ color: "#c9bfce", fontSize: 12.5, padding: "0 6px" }}>
              {profile?.full_name || profile?.email} &middot; {isOwner ? "Owner" : "Counselor"}
            </span>
            <SignOutButton />
          </div>
        </div>
      </div>
      <div className="wrap">{children}</div>
    </div>
  );
}
