import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { addTripTransactionAction, saveTripMembersAction } from "@/app/actions";
import { Banner } from "@/components/banner";
import { formatDay, inclusiveDays } from "@/lib/dates";
import { database } from "@/lib/db";
import { live } from "@/lib/live";
import { one } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { getTrip, searchOutsideTrip, tripCandidates } from "@/lib/repo";
import { classifyTransaction } from "@/lib/spending";

export const metadata = { title: "Trip" };

export default function TripPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="muted">Loading trip…</p>}>
      <TripScreen params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function TripScreen({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await live();
  const { id } = await params;
  const query = await searchParams;
  const db = database();
  const trip = getTrip(db, id);
  if (!trip) notFound();
  const candidates = tripCandidates(db, trip);
  const inRange = candidates.filter(
    (tx) => tx.postedOn >= trip.startDate && tx.postedOn <= trip.endDate,
  );
  const outside = candidates.filter(
    (tx) => tx.postedOn < trip.startDate || tx.postedOn > trip.endDate,
  );
  const q = one(query.q)?.trim() ?? "";
  const found = q ? searchOutsideTrip(db, trip, q).filter((tx) => !candidates.some((item) => item.id === tx.id)) : [];
  const assigned = candidates.filter((tx) => tx.tripId === trip.id);
  let total = 0;
  for (const tx of assigned) {
    const classified = classifyTransaction(tx);
    if (classified.bucket === "expense") total += classified.cents;
  }
  const days = inclusiveDays(trip.startDate, trip.endDate);

  return (
    <>
      <p className="eyebrow">
        <Link href="/trips">Trips</Link>
      </p>
      <header className="page-head">
        <div>
          <h1>{trip.name}</h1>
          <p className="lede">
            {formatDay(trip.startDate)} – {formatDay(trip.endDate)} · {days} days · {formatMoney(total)} spent
            {days > 0 ? ` · ${formatMoney(Math.round(total / days))} per day` : ""}
          </p>
          {trip.notes ? <p className="muted">{trip.notes}</p> : null}
        </div>
      </header>
      <Banner notice={one(query.notice)} error={one(query.error)} />
      <form key={trip.id} action={saveTripMembersAction} className="card">
        <input type="hidden" name="tripId" value={trip.id} />
        <h2>During the trip</h2>
        <p className="small muted">Uncheck groceries and bills that happened to fall on these dates.</p>
        <TransactionChecks transactions={inRange} tripId={trip.id} />
        {outside.length > 0 ? (
          <>
            <h2 style={{ marginTop: 18 }}>Outside these dates</h2>
            <TransactionChecks transactions={outside} tripId={trip.id} />
          </>
        ) : null}
        <button className="primary" type="submit" style={{ marginTop: 12 }}>
          Save trip
        </button>
      </form>
      <form className="filters" method="get" style={{ marginTop: 16 }} key={q}>
        <label>
          Add a charge from outside the dates
          <input name="q" defaultValue={q} placeholder="United, hotel, deposit" />
        </label>
        <button type="submit">Search</button>
      </form>
      {found.length > 0 ? (
        <div className="card" style={{ marginTop: 12 }}>
          {found.map((tx) => (
            <div className="account-row" key={tx.id}>
              <div>
                <strong>{tx.merchant}</strong>
                <div className="small muted">
                  {formatDay(tx.postedOn)} · {tx.accountName} · {formatMoney(tx.amountCents)}
                </div>
              </div>
              <form action={addTripTransactionAction}>
                <input type="hidden" name="tripId" value={trip.id} />
                <input type="hidden" name="transactionId" value={tx.id} />
                <button type="submit">Add</button>
              </form>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

function TransactionChecks({
  transactions,
  tripId,
}: {
  transactions: {
    id: string;
    merchant: string;
    postedOn: string;
    amountCents: number;
    accountName: string;
    tripId: string | null;
    categoryName: string | null;
  }[];
  tripId: string;
}) {
  if (transactions.length === 0) return <p className="muted">No transactions in this set.</p>;
  return (
    <div>
      {transactions.map((tx) => (
        <label className="check account-row" key={tx.id} style={{ alignItems: "center" }}>
          <input
            type="checkbox"
            name="transactionId"
            value={tx.id}
            defaultChecked={tx.tripId === tripId}
          />
          <span style={{ flex: 1 }}>
            <strong>{tx.merchant}</strong>
            <span className="small muted">
              {" "}
              · {formatDay(tx.postedOn)} · {tx.accountName}
              {tx.categoryName ? ` · ${tx.categoryName}` : ""}
            </span>
          </span>
          <span className="money">{formatMoney(tx.amountCents)}</span>
        </label>
      ))}
    </div>
  );
}
