"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dqgwafdihafcttynfaea.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxZ3dhZmRpaGFmY3R0eW5mYWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNjEwOTMsImV4cCI6MjEwNTYzNzA5M30._n-FGaXFyi3c1NxBDI0-DFfUA2nyqFhmELFc1LJat28";

type Theme = {
  pagePlane: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  muted: string;
  gridline: string;
  border: string;
  good: string;
};
const LIGHT: Theme = { pagePlane: "#f9f9f7", surface: "#ffffff", textPrimary: "#0b0b0b", textSecondary: "#52514e", muted: "#898781", gridline: "#e1e0d9", border: "rgba(11,11,11,0.10)", good: "#0ca30c" };
const DARK: Theme = { pagePlane: "#0d0d0d", surface: "#1a1a19", textPrimary: "#ffffff", textSecondary: "#c3c2b7", muted: "#898781", gridline: "#2c2c2a", border: "rgba(255,255,255,0.10)", good: "#0ca30c" };

type Profile = { id: string; full_name: string | null; email: string; role: string; manager_id: string | null };
type AdmRow = { counselor_id: string | null; net_excl_gst: number; total_paid: number };
type TargetRow = { counselor_id: string; target_students: number; target_revenue: number };

function fmtLakh(n: number, dp = 2) {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export default function OrgHierarchyPage() {
  const [status, setStatus] = useState<"loading" | "denied" | "error" | "ready">("loading");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [admissions, setAdmissions] = useState<AdmRow[]>([]);
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [dark, setDark] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("scubus-aop-theme");
      if (saved === "dark") setDark(true);
      else if (saved === "light") setDark(false);
      else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) setDark(true);
    } catch {
      /* ignore */
    }
  }, []);
  const T = dark ? DARK : LIGHT;

  const supabase = useMemo(() => createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY), []);

  async function load() {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      setStatus("denied");
      return;
    }
    const { data: profile, error: profileErr } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profileErr || !profile || profile.role !== "owner") {
      setStatus("denied");
      return;
    }
    const [profRes, admRes, targetRes] = await Promise.all([
      supabase.from("profiles").select("id,full_name,email,role,manager_id"),
      supabase.from("admissions_computed").select("counselor_id,net_excl_gst,total_paid").eq("status", "active"),
      supabase.from("aop_counselor_targets").select("counselor_id,target_students,target_revenue")
    ]);
    if (profRes.error) {
      setStatus("error");
      return;
    }
    setProfiles((profRes.data || []) as Profile[]);
    if (!admRes.error) setAdmissions((admRes.data || []) as AdmRow[]);
    if (!targetRes.error) setTargets((targetRes.data || []) as TargetRow[]);
    setStatus("ready");
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byId = useMemo(() => {
    const m = new Map<string, Profile>();
    profiles.forEach((p) => m.set(p.id, p));
    return m;
  }, [profiles]);

  const ownPerf = useMemo(() => {
    const m = new Map<string, { students: number; revenueLakh: number; collectedLakh: number }>();
    admissions.forEach((a) => {
      if (!a.counselor_id) return;
      const cur = m.get(a.counselor_id) || { students: 0, revenueLakh: 0, collectedLakh: 0 };
      cur.students += 1;
      cur.revenueLakh += (Number(a.net_excl_gst) || 0) / 100000;
      cur.collectedLakh += (Number(a.total_paid) || 0) / 100000;
      m.set(a.counselor_id, cur);
    });
    return m;
  }, [admissions]);

  const targetById = useMemo(() => {
    const m = new Map<string, TargetRow>();
    targets.forEach((t) => m.set(t.counselor_id, t));
    return m;
  }, [targets]);

  const managers = profiles.filter((p) => p.role === "manager");
  const counselors = profiles.filter((p) => p.role === "counselor");
  const director = profiles.find((p) => p.role === "owner");

  function childManagersOf(id: string | null) {
    return managers.filter((m) => m.manager_id === id);
  }
  function counselorsOf(id: string) {
    return counselors.filter((c) => c.manager_id === id);
  }

  function rollup(id: string): { students: number; revenueLakh: number; collectedLakh: number } {
    const own = ownPerf.get(id) || { students: 0, revenueLakh: 0, collectedLakh: 0 };
    let students = own.students;
    let revenueLakh = own.revenueLakh;
    let collectedLakh = own.collectedLakh;
    counselorsOf(id).forEach((c) => {
      const r = rollup(c.id);
      students += r.students;
      revenueLakh += r.revenueLakh;
      collectedLakh += r.collectedLakh;
    });
    childManagersOf(id).forEach((m) => {
      const r = rollup(m.id);
      students += r.students;
      revenueLakh += r.revenueLakh;
      collectedLakh += r.collectedLakh;
    });
    return { students, revenueLakh, collectedLakh };
  }

  async function assignManager(managerProfileId: string, newManagerId: string | null) {
    setSaving(managerProfileId);
    setSavedMsg(null);
    const { error } = await supabase.from("profiles").update({ manager_id: newManagerId }).eq("id", managerProfileId);
    setSaving(null);
    if (error) {
      setSavedMsg(`Could not update: ${error.message}`);
    } else {
      setProfiles((prev) => prev.map((p) => (p.id === managerProfileId ? { ...p, manager_id: newManagerId } : p)));
      setSavedMsg("Saved.");
      setTimeout(() => setSavedMsg(null), 2500);
    }
  }

  if (status === "loading") return <div style={{ padding: 40, fontFamily: "system-ui, sans-serif" }}>Loading team data…</div>;
  if (status === "denied")
    return (
      <div style={{ padding: 40, maxWidth: 520, fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ fontSize: 18 }}>Restricted</h1>
        <p style={{ color: "#666", fontSize: 14, lineHeight: 1.6 }}>This page is visible to Director/Owner accounts only.</p>
      </div>
    );
  if (status === "error") return <div style={{ padding: 40, fontFamily: "system-ui, sans-serif" }}>Could not load team data right now — try refreshing.</div>;

  const topLevelManagers = managers.filter((m) => !m.manager_id || !byId.has(m.manager_id) || byId.get(m.manager_id)?.role !== "manager");

  function nameOf(p: Profile | undefined | null) {
    if (!p) return "—";
    return p.full_name || p.email;
  }

  return (
    <div style={{ background: T.pagePlane, minHeight: "100vh" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 20px 60px", fontFamily: "system-ui, sans-serif", color: T.textPrimary }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 4 }}>
          <div>
            <h1 style={{ fontSize: 20, margin: 0 }}>Team &amp; Reporting Hierarchy</h1>
            <p style={{ color: T.textSecondary, fontSize: 13, marginTop: 6, marginBottom: 0 }}>
              Director &amp; Owner only. Assign one manager to report to another so the Director can track a
              manager&rsquo;s whole team &mdash; including sub-managers &mdash; in one rollup.
            </p>
          </div>
          <button
            onClick={() => {
              setDark((d) => {
                try {
                  window.localStorage.setItem("scubus-aop-theme", !d ? "dark" : "light");
                } catch {
                  /* ignore */
                }
                return !d;
              });
            }}
            style={{ flexShrink: 0, border: `1px solid ${T.border}`, background: T.surface, color: T.textPrimary, borderRadius: 999, padding: "6px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
          >
            {dark ? "☀ Light mode" : "☾ Dark mode"}
          </button>
        </div>

        <Section T={T} title="Assign reporting manager">
          <table style={tableStyle(T)}>
            <thead>
              <tr>
                <th style={th(T)}>Manager</th>
                <th style={th(T)}>Email</th>
                <th style={th(T)}>Reports to</th>
                <th style={th(T)} />
              </tr>
            </thead>
            <tbody>
              {managers.map((m) => (
                <tr key={m.id}>
                  <td style={td(T)}>{nameOf(m)}</td>
                  <td style={{ ...td(T), color: T.muted }}>{m.email}</td>
                  <td style={td(T)}>
                    <select
                      value={m.manager_id || ""}
                      onChange={(e) => assignManager(m.id, e.target.value || null)}
                      disabled={saving === m.id}
                      style={{ padding: "5px 8px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.surface, color: T.textPrimary, fontSize: 13 }}
                    >
                      <option value="">Reports directly to Director</option>
                      {managers
                        .filter((other) => other.id !== m.id)
                        .map((other) => (
                          <option key={other.id} value={other.id}>
                            {nameOf(other)}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td style={{ ...td(T), fontSize: 12, color: T.muted }}>{saving === m.id ? "Saving…" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {savedMsg && <p style={{ fontSize: 12.5, color: savedMsg === "Saved." ? T.good : "#d03b3b", marginTop: 8 }}>{savedMsg}</p>}
          <p style={noteStyle(T)}>
            Choosing another manager here makes that manager a &ldquo;manager of managers&rdquo; &mdash; their rollup
            below will include the sub-manager&rsquo;s whole team. This only changes who reports to whom; it does not
            change anyone&rsquo;s role or login access.
          </p>
        </Section>

        <Section T={T} title="Performance rollup (live)">
          <Node T={T} label={`${nameOf(director)} (Director)`} perf={rollup("__director__placeholder__") } isRoot overridePerf={(() => {
            // Director's own rollup = everyone (sum of all top-level managers + any unmanaged counselors)
            let s = 0, r = 0, c = 0;
            topLevelManagers.forEach((m) => {
              const x = rollup(m.id);
              s += x.students; r += x.revenueLakh; c += x.collectedLakh;
            });
            counselors.filter((c2) => !c2.manager_id).forEach((c2) => {
              const x = rollup(c2.id);
              s += x.students; r += x.revenueLakh; c += x.collectedLakh;
            });
            return { students: s, revenueLakh: r, collectedLakh: c };
          })()} depth={0} />
          {topLevelManagers.map((m) => (
            <ManagerNode key={m.id} T={T} profile={m} managers={managers} counselors={counselors} rollup={rollup} ownPerf={ownPerf} targetById={targetById} depth={1} nameOf={nameOf} />
          ))}
          {counselors.filter((c) => !c.manager_id).map((c) => (
            <CounselorNode key={c.id} T={T} profile={c} ownPerf={ownPerf} targetById={targetById} depth={1} nameOf={nameOf} />
          ))}
        </Section>
      </div>
    </div>
  );
}

function ManagerNode({
  T,
  profile,
  managers,
  counselors,
  rollup,
  ownPerf,
  targetById,
  depth,
  nameOf
}: {
  T: Theme;
  profile: Profile;
  managers: Profile[];
  counselors: Profile[];
  rollup: (id: string) => { students: number; revenueLakh: number; collectedLakh: number };
  ownPerf: Map<string, { students: number; revenueLakh: number; collectedLakh: number }>;
  targetById: Map<string, TargetRow>;
  depth: number;
  nameOf: (p: Profile | undefined | null) => string;
}) {
  const perf = rollup(profile.id);
  const own = ownPerf.get(profile.id);
  const childManagers = managers.filter((m) => m.manager_id === profile.id);
  const directCounselors = counselors.filter((c) => c.manager_id === profile.id);
  return (
    <div style={{ marginLeft: depth * 20, marginTop: 8 }}>
      <Node T={T} label={`${nameOf(profile)} (Manager${childManagers.length ? " of managers" : ""})`} perf={perf} own={own} depth={depth} />
      {childManagers.map((cm) => (
        <ManagerNode key={cm.id} T={T} profile={cm} managers={managers} counselors={counselors} rollup={rollup} ownPerf={ownPerf} targetById={targetById} depth={depth + 1} nameOf={nameOf} />
      ))}
      {directCounselors.map((c) => (
        <CounselorNode key={c.id} T={T} profile={c} ownPerf={ownPerf} targetById={targetById} depth={depth + 1} nameOf={nameOf} />
      ))}
    </div>
  );
}

function CounselorNode({
  T,
  profile,
  ownPerf,
  targetById,
  depth,
  nameOf
}: {
  T: Theme;
  profile: Profile;
  ownPerf: Map<string, { students: number; revenueLakh: number; collectedLakh: number }>;
  targetById: Map<string, TargetRow>;
  depth: number;
  nameOf: (p: Profile | undefined | null) => string;
}) {
  const perf = ownPerf.get(profile.id) || { students: 0, revenueLakh: 0, collectedLakh: 0 };
  const target = targetById.get(profile.id);
  return (
    <div style={{ marginLeft: depth * 20, marginTop: 8 }}>
      <Node
        T={T}
        label={`${nameOf(profile)} (Counselor)`}
        perf={perf}
        depth={depth}
        sub={target ? `Target: ${target.target_students} students · ₹${fmtLakh(target.target_revenue / 100000, 2)}L` : undefined}
      />
    </div>
  );
}

function Node({
  T,
  label,
  perf,
  own,
  depth,
  sub,
  isRoot,
  overridePerf
}: {
  T: Theme;
  label: string;
  perf: { students: number; revenueLakh: number; collectedLakh: number };
  own?: { students: number; revenueLakh: number; collectedLakh: number };
  depth: number;
  sub?: string;
  isRoot?: boolean;
  overridePerf?: { students: number; revenueLakh: number; collectedLakh: number };
}) {
  const p = overridePerf || perf;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        padding: "9px 12px",
        background: T.surface,
        border: `1px solid ${T.gridline}`,
        borderRadius: 8,
        fontSize: 13,
        borderLeft: isRoot ? `3px solid ${T.good}` : `1px solid ${T.gridline}`
      }}
    >
      <div>
        <div style={{ fontWeight: depth === 0 ? 700 : 600 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{sub}</div>}
        {own && own.students > 0 && <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Direct: {own.students} students</div>}
      </div>
      <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        <div>
          {p.students} students &middot; ₹{fmtLakh(p.revenueLakh, 2)}L
        </div>
        <div style={{ fontSize: 11, color: T.muted }}>Collected ₹{fmtLakh(p.collectedLakh, 2)}L</div>
      </div>
    </div>
  );
}

function Section({ T, title, children }: { T: Theme; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 22px", marginBottom: 22 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 14px", color: T.textPrimary }}>{title}</h2>
      {children}
    </div>
  );
}

function tableStyle(T: Theme): CSSProperties {
  return { width: "100%", borderCollapse: "collapse", fontSize: 13.5, color: T.textPrimary };
}
function th(T: Theme): CSSProperties {
  return { textAlign: "left", padding: "7px 10px", borderBottom: `1px solid ${T.gridline}`, fontSize: 11.5, textTransform: "uppercase", color: T.muted };
}
function td(T: Theme): CSSProperties {
  return { padding: "7px 10px", borderBottom: `1px solid ${T.gridline}` };
}
function noteStyle(T: Theme): CSSProperties {
  return { fontSize: 12.5, color: T.muted, marginTop: 10, lineHeight: 1.5 };
}
