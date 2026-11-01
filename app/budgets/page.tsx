import { Suspense } from "react";
import { fillBudgetsAction, saveBudgetsAction } from "@/app/actions";
import { Banner } from "@/components/banner";
import { currentMonth, formatMonth, monthRange, shiftMonth } from "@/lib/dates";
import { database } from "@/lib/db";
import { live } from "@/lib/live";
import { categoryChoices, one } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { leafExpenseCategories, listBudgets, listCategories, transactionsInRange } from "@/lib/repo";
import { categoryTotals } from "@/lib/spending";
import type { TransactionRow } from "@/lib/types";

export const metadata = { title: "Budgets" };

export default function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="muted">Loading budgets…</p>}>
      <BudgetsScreen searchParams={searchParams} />
    </Suspense>
  );
}

async function BudgetsScreen({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await live();
  const params = await searchParams;
  const month =
    one(params.month) && /^\d{4}-\d{2}$/.test(one(params.month)!)
      ? one(params.month)!
      : currentMonth();
  const db = database();
  const leaves = leafExpenseCategories(listCategories(db));
  const labels = new Map(categoryChoices(leaves).map((choice) => [choice.id, choice.label]));
  const ordered = [...leaves].sort((a, b) =>
    (labels.get(a.id) ?? a.name).localeCompare(labels.get(b.id) ?? b.name),
  );
  const budgets = new Map(listBudgets(db, month).map((budget) => [budget.categoryId, budget.amountCents]));
  const range = monthRange(month);
  const totals = categoryTotals(
    transactionsInRange(db, range.from, range.to).map((tx: TransactionRow) => ({
      amountCents: tx.amountCents,
      categoryId: tx.categoryId,
      categoryKind: tx.categoryKind,
      isTransfer: tx.isTransfer,
    })),
  );
  const prior = [1, 2, 3].map((delta) => formatMonth(shiftMonth(month, -delta)));
  const signature = ordered.map((category) => `${category.id}:${budgets.get(category.id) ?? ""}`).join("|");

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Plan</p>
          <h1>Budgets</h1>
          <p className="lede">
            Amounts are for the detailed categories. Food on the spending page is groceries plus restaurants.
          </p>
        </div>
      </header>
      <Banner notice={one(params.notice)} error={one(params.error)} />
      <form className="filters" method="get" key={month}>
        <label>
          Month
          <input type="month" name="month" defaultValue={month} />
        </label>
        <button className="primary" type="submit">
          Show
        </button>
      </form>
      <form action={fillBudgetsAction} style={{ margin: "12px 0 18px" }}>
        <input type="hidden" name="month" value={month} />
        <button type="submit">Fill {formatMonth(month)} from {prior.join(", ")}</button>
      </form>
      <form key={signature} action={saveBudgetsAction} className="card">
        <input type="hidden" name="month" value={month} />
        <table className="sheet">
          <thead>
            <tr>
              <th>Category</th>
              <th className="num">Spent</th>
              <th className="num">Budget</th>
              <th className="num">Left</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((category) => {
              const spent = totals.expense.get(category.id) ?? 0;
              const budget = budgets.get(category.id);
              return (
                <tr key={category.id}>
                  <td>{labels.get(category.id) ?? category.name}</td>
                  <td className="num">{formatMoney(spent)}</td>
                  <td className="num">
                    <input
                      name={`amount_${category.id}`}
                      inputMode="decimal"
                      defaultValue={budget == null ? "" : (budget / 100).toFixed(2)}
                      aria-label={`Budget for ${category.name}`}
                      style={{ width: 110, textAlign: "right" }}
                    />
                  </td>
                  <td className="num">{budget == null ? "—" : formatMoney(budget - spent)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ marginTop: 14 }}>
          <button className="primary" type="submit">
            Save budgets
          </button>
        </div>
      </form>
    </>
  );
}
