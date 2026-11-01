import { Suspense } from "react";
import Link from "next/link";
import { database } from "@/lib/db";
import { live } from "@/lib/live";
import { countUnreviewed } from "@/lib/repo";
import { SideNav } from "./side-nav";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          Buzz<span>Fi</span>
        </Link>
        <p className="brand-sub">Local books</p>
        <Suspense fallback={<StaticNav />}>
          <NavWithCount />
        </Suspense>
      </aside>
      <div className="content">{children}</div>
    </div>
  );
}

function StaticNav() {
  return (
    <nav className="nav" aria-label="Sections">
      {[
        ["/", "Home"],
        ["/review", "Review"],
        ["/spending", "Spending"],
        ["/budgets", "Budgets"],
        ["/trips", "Trips"],
        ["/transactions", "Transactions"],
        ["/import", "Import"],
        ["/accounts", "Accounts"],
      ].map(([href, label]) => (
        <a key={href} href={href}>
          {label}
        </a>
      ))}
    </nav>
  );
}

async function NavWithCount() {
  await live();
  return <SideNav reviewCount={countUnreviewed(database())} />;
}
