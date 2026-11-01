import Link from "next/link";
import { Suspense } from "react";
import { createTripAction } from "@/app/actions";
import { Banner } from "@/components/banner";
import { Money } from "@/components/money";
import { formatDay, inclusiveDays } from "@/lib/dates";
import { database } from "@/lib/db";
import { live } from "@/lib/live";
import { one } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { listAssignedTripTransactions, listTrips } from "@/lib/repo";
import { classifyTransaction } from "@/lib/spending";
import type { TransactionRow, Trip } from "@/lib/types";

export const metadata = { title: "Trips" };

export default function TripsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="muted">Loading trips…</p>}>
      <TripsScreen searchParams={searchParams} />
    </Suspense>
  );
}

async function TripsScreen({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await live();
  const params = await searchParams;
  const db = database();
  const trips = listTrips(db);
  const transactions = listAssignedTripTransactions(db);
  const summaries = trips.map((trip) => summarize(trip, transactions));
  const categoryNames = categoryColumns(summaries);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Travel</p>
          <h1>Trips</h1>
          <p className="lede">
            A trip can include a flight bought months earlier. Home spending during the same dates stays off the trip until you check it.
          </p>
        </div>
      </header>
      <Banner notice={one(params.notice)} error={one(params.error)} />
      <form action={createTripAction} className="card filters" style={{ marginBottom: 16 }}>
        <label>
          Name
          <input name="name" required placeholder="Lisbon" />
        </label>
        <label>
          Start
          <input type="date" name="startDate" required />
        </label>
        <label>
          End
          <input type="date" name="endDate" required />
        </label>
        <label>
          Notes
          <input name="notes" />
        </label>
        <button className="primary" type="submit">
          Create trip
        </button>
      </form>

      {summaries.length === 0 ? (
        <p className="muted">No trips yet.</p>
      ) : (
        <section className="card">
          <h2>Comparison</h2>
          <table className="sheet">
            <thead>
              <tr>
                <th>Trip</th>
                <th className="num">Days</th>
                <th className="num">Spent</th>
                <th className="num">Per day</th>
                {categoryNames.map((name) => (
                  <th key={name} className="num">
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summaries.map((summary) => (
                <tr key={summary.trip.id}>
                  <td>
                    <Link href={`/trips/${summary.trip.id}`}>{summary.trip.name}</Link>
                    <div className="small muted">
                      {formatDay(summary.trip.startDate)} – {formatDay(summary.trip.endDate)}
                    </div>
                  </td>
                  <td className="num">{summary.days}</td>
                  <td className="num">
                    <Money cents={summary.total} sign="plain" />
                  </td>
                  <td className="num">{formatMoney(summary.perDay)}</td>
                  {categoryNames.map((name) => (
                    <td key={name} className="num">
                      {formatMoney(summary.byCategory.get(name) ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}

function summarize(trip: Trip, transactions: TransactionRow[]) {
  const byCategory = new Map<string, number>();
  let total = 0;
  for (const tx of transactions) {
    if (tx.tripId !== trip.id) continue;
    const classified = classifyTransaction(tx);
    if (classified.bucket !== "expense") continue;
    total += classified.cents;
    const name = tx.categoryName ?? "Uncategorized";
    byCategory.set(name, (byCategory.get(name) ?? 0) + classified.cents);
  }
  const days = inclusiveDays(trip.startDate, trip.endDate);
  return { trip, total, days, perDay: Math.round(total / days), byCategory };
}

function categoryColumns(summaries: ReturnType<typeof summarize>[]) {
  const totals = new Map<string, number>();
  for (const summary of summaries) {
    for (const [name, cents] of summary.byCategory) {
      totals.set(name, (totals.get(name) ?? 0) + cents);
    }
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name]) => name);
}
