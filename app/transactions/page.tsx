import { Suspense } from "react";
import { saveTransactionCategory } from "@/app/actions";
import { Banner } from "@/components/banner";
import { currentMonth, formatDay, monthRange } from "@/lib/dates";
import { database } from "@/lib/db";
import { live } from "@/lib/live";
import { categoryChoices, one } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { listAccounts, listCategories, listTransactions } from "@/lib/repo";

export const metadata = { title: "Transactions" };

export default function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="muted">Loading transactions…</p>}>
      <TransactionsScreen searchParams={searchParams} />
    </Suspense>
  );
}

async function TransactionsScreen({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await live();
  const params = await searchParams;
  const monthParam = one(params.month);
  const month = monthParam === "all" ? "all" : monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonth();
  const accountId = one(params.account) ?? "";
  const categoryId = one(params.category) ?? "";
  const query = one(params.q) ?? "";
  const review = one(params.review) ?? "";
  const range = month === "all" ? null : monthRange(month);
  const db = database();
  const transactions = listTransactions(db, {
    from: range?.from,
    to: range?.to,
    accountId: accountId || undefined,
    categoryId: categoryId || undefined,
    query: query || undefined,
    reviewStatus: review || undefined,
  });
  const accounts = listAccounts(db);
  const choices = categoryChoices(listCategories(db));
  const returnTo = `/transactions?${new URLSearchParams({
    month,
    ...(accountId ? { account: accountId } : {}),
    ...(categoryId ? { category: categoryId } : {}),
    ...(query ? { q: query } : {}),
    ...(review ? { review } : {}),
  }).toString()}`;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Ledger</p>
          <h1>Transactions</h1>
          <p className="lede">Saving a category confirms it and remembers the merchant for next time.</p>
        </div>
      </header>
      <Banner notice={one(params.notice)} error={one(params.error)} />
      <form className="filters" method="get" key={returnTo}>
        <label>
          Month
          <input type="month" name="month" defaultValue={month === "all" ? "" : month} />
        </label>
        <label>
          Account
          <select name="account" defaultValue={accountId}>
            <option value="">All</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select name="category" defaultValue={categoryId}>
            <option value="">All</option>
            <option value="none">Uncategorized</option>
            {choices.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Review
          <select name="review" defaultValue={review}>
            <option value="">Any</option>
            <option value="unreviewed">Needs review</option>
            <option value="confirmed">Confirmed</option>
            <option value="skipped">Skipped</option>
          </select>
        </label>
        <label>
          Search
          <input name="q" defaultValue={query} />
        </label>
        <button className="primary" type="submit">
          Filter
        </button>
        <a className="btn" href="/transactions?month=all">
          All dates
        </a>
      </form>
      <p className="small muted">{transactions.length} shown</p>
      <div className="card">
        <table className="sheet">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Account</th>
              <th className="num">Amount</th>
              <th>Category</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id}>
                <td>{formatDay(tx.postedOn)}</td>
                <td>
                  <strong>{tx.merchant}</strong>
                  {tx.tripName ? <div className="small muted">{tx.tripName}</div> : null}
                  {tx.reviewStatus !== "confirmed" ? (
                    <div className="small muted">{tx.reviewStatus}</div>
                  ) : null}
                </td>
                <td>{tx.accountName}</td>
                <td className="num">{formatMoney(tx.amountCents)}</td>
                <td>
                  <form action={saveTransactionCategory} className="inline">
                    <input type="hidden" name="id" value={tx.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <select name="categoryId" defaultValue={tx.categoryId ?? ""} aria-label={`Category for ${tx.merchant}`}>
                      <option value="">Choose</option>
                      {choices.map((choice) => (
                        <option key={choice.id} value={choice.id}>
                          {choice.label}
                        </option>
                      ))}
                    </select>
                    <button type="submit">Save</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
