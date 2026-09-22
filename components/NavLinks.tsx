"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLinks({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  const links = [
    { href: "/calculator", label: "Calculator" },
    ...(isOwner ? [{ href: "/dashboard", label: "Dashboard" }, { href: "/counselors", label: "Counselors" }] : [])
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
