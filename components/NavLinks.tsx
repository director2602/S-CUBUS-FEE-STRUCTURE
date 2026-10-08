"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLinks({ role }: { role: string }) {
  const pathname = usePathname();
  const isOwner = role === "owner";
  const isManager = role === "manager";
  const links = [
    { href: "/calculator", label: "Calculator" },
    ...(isOwner || isManager ? [{ href: "/team", label: "Team Performance" }] : []),
    ...(isOwner
      ? [
          { href: "/dashboard", label: "Dashboard" },
          { href: "/annual-plan", label: "Annual Plan" },
          { href: "/aop", label: "AOP" },
          { href: "/org", label: "Team & Hierarchy" },
          { href: "/fee-structure", label: "Fee Structure" },
          { href: "/counselors", label: "Counselors" },
          { href: "/custom-fields", label: "Manage Fields" }
        ]
      : [])
  ];
  return (
    <>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={pathname?.startsWith(l.href) ? "active" : ""}>
          {l.label}
        </Link>
      ))}
    </>
  );
}
