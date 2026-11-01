"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/review", label: "Review" },
  { href: "/spending", label: "Spending" },
  { href: "/budgets", label: "Budgets" },
  { href: "/trips", label: "Trips" },
  { href: "/transactions", label: "Transactions" },
  { href: "/import", label: "Import" },
  { href: "/accounts", label: "Accounts" },
];

export function SideNav({ reviewCount }: { reviewCount: number }) {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Sections">
      {LINKS.map((link) => {
        const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined}>
            <span>{link.label}</span>
            {link.href === "/review" && reviewCount > 0 ? (
              <span className="count">{reviewCount}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
