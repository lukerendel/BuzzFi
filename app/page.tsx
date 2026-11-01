import Link from "next/link";
import { Suspense } from "react";
import { Money } from "@/components/money";
import { currentMonth, formatDay, formatMonth, monthPace, monthRange } from "@/lib/dates";
import { database } from "@/lib/db";
import { live } from "@/lib/live";
import { accountTypeLabel } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import {
  countUnreviewed,
  latestSnapshots,
  listAccounts,
  listBudgets,
  listCategories,
  transactionsInRange,
} from "@/lib/repo";
import { buildTree, categoryTotals, netPosition, sumBucket, type SpendInput } from "@/lib/spending";
import type { TransactionRow } from "@/lib/types";

export default function HomePage() {
  return (
    <Suspense fallback={<p className="muted">Loading your books…</p>}>
      <Home />
    </Suspense>
  );
}

function toSpend(tx: TransactionRow): SpendInput {
  return {
    amountCents: tx.amountCents,
    categoryId: tx.categoryId,
    categoryKind: tx.categoryKind,
    isTransfer: tx.isTransfer,
  };
}

async function Home() {
  await live();
  const db = database();
  const now = new Date();
  const month = currentMonth(now);
  const range = monthRange(month);
  const accounts = listAccounts(db);
  const snapshots = new Map(latestSnapshots(db).map((snapshot) => [snapshot.accountId, snapshot]));
  const rows = accounts.map((account) => {
    const snapshot = snapshots.get(account.id);
    return {
      ...account,
      balanceCents: snapshot?.balanceCents ?? null,
      asOf: snapshot?.asOf ?? null,
    };
  });
  const position = netPosition(rows);
  const transactions = transactionsInRange(db, range.from, range.to);
  const spent = sumBucket(transactions.map(toSpend), "expense");
  const budget = listBudgets(db, month).reduce((sum, item) => sum + item.amountCents, 0);
  const pace = monthPace(now);
  const tree = buildTree(
    listCategories(db),
    "expense",
    categoryTotals(transactions.map(toSpend)).expense,
    new Map(),
  ).sort((a, b) => b.currentCents - a.currentCents);
  const waiting = countUnreviewed(db);
  const assets = rows.filter((account) => account.type !== "credit");
  const cards = rows.filter((account) => account.type === "credit");
  const spendRatio = budget > 0 ? spent / budget : 0;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">As of your latest statement</p>
          <h1>Where your money sits</h1>
          <p className="lede">
            Balances update when you import a statement or type one in. BuzzFi does not connect to a bank.
          </p>
        </div>
      </header>

      {accounts.length === 0 ? (
        <section className="card">
          <h2>Start with an account</h2>
          <p className="muted">
            Add checking, cards, and Venmo, then drop CSV downloads into the statements folder.
            Sample files are included if you want to see the shape of the app first.
          </p>
          <div className="row-actions">
            <Link className="btn btn-primary" href="/accounts">
              Add an account
            </Link>
            <Link className="btn" href="/import">
              Import statements
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section className="grid-2">
            <article className="card">
              <p className="eyebrow">Net</p>
              <p className="net-figure">{formatMoney(position.net)}</p>
              <p className="muted small">
                {formatMoney(position.assets)} in accounts, minus {formatMoney(position.liabilities)} on credit cards.
              </p>
            </article>
            <article className="card">
              <p className="eyebrow">{formatMonth(month)}</p>
              <p className="stat">{formatMoney(spent)} spent</p>
              {budget > 0 ? (
                <>
                  <div className={spendRatio > 1 ? "bar over" : "bar"}>
                    <span style={{ width: `${Math.min(spendRatio, 1) * 100}%` }} />
                  </div>
                  <p className="small muted">
                    {formatMoney(budget)} budgeted · day {pace.day} of {pace.days}
                    {spendRatio > pace.timeRatio ? " · ahead of pace" : " · within pace"}
                  </p>
                </>
              ) : (
                <p className="small muted">
                  <Link href="/budgets">Set a budget</Link> to compare this month with a plan.
                </p>
              )}
              {waiting > 0 ? (
                <p className="small">
                  <Link href="/review">{waiting} to review</Link>
                </p>
              ) : (
                <p className="small muted">Review queue is clear.</p>
              )}
            </article>
          </section>

          <section className="split">
            <AccountGroup title="Cash and accounts" accounts={assets} />
            <AccountGroup title="Credit cards" accounts={cards} owed />
          </section>

          {tree.length > 0 ? (
            <section className="card" style={{ marginTop: 16 }}>
              <h2>Spending this month</h2>
              {tree.slice(0, 6).map((node) => (
                <div className="account-row" key={node.id}>
                  <div>
                    <strong>{node.name}</strong>
                  </div>
                  <Money cents={node.currentCents} sign="plain" />
                </div>
              ))}
              <p className="small" style={{ marginTop: 8 }}>
                <Link href={`/spending?view=month&month=${month}&compare=year`}>
                  Compare {formatMonth(month)} with last year
                </Link>
              </p>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}

function AccountGroup({
  title,
  accounts,
  owed = false,
}: {
  title: string;
  accounts: {
    id: string;
    name: string;
    institution: string;
    type: "checking" | "savings" | "credit" | "venmo" | "cash";
    balanceCents: number | null;
    asOf: string | null;
  }[];
  owed?: boolean;
}) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {accounts.length === 0 ? <p className="muted">None yet.</p> : null}
      {accounts.map((account) => (
        <div className="account-row" key={account.id}>
          <div>
            <strong>{account.name}</strong>
            <div className="small muted">
              {account.institution ? `${account.institution} · ` : ""}
              {accountTypeLabel(account.type)}
              {account.asOf ? ` · as of ${formatDay(account.asOf)}` : ""}
            </div>
          </div>
          <div>
            {account.balanceCents == null ? (
              <Link href="/accounts">Add balance</Link>
            ) : (
              <>
                <Money cents={owed ? account.balanceCents : account.balanceCents} sign="plain" />
                {owed && account.balanceCents > 0 ? <div className="small muted">owed</div> : null}
              </>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
