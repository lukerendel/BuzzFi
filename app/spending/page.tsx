import Link from "next/link";
import { Suspense } from "react";
import { Money } from "@/components/money";
import { SpendingControls } from "@/components/spending-controls";
import {
  compareRange,
  currentMonth,
  monthRange,
  quarterRange,
  type DateRange,
  type RangeView,
  yearRange,
} from "@/lib/dates";
import { database } from "@/lib/db";
import { live } from "@/lib/live";
import { one } from "@/lib/labels";
import { listAccounts, listCategories, transactionsInRange } from "@/lib/repo";
import {
  buildTree,
  categoryTotals,
  findNode,
  sumBucket,
  treeTotal,
  type SpendNode,
} from "@/lib/spending";
import type { TransactionRow } from "@/lib/types";

export const metadata = { title: "Spending" };

export default function SpendingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="muted">Adding up the period…</p>}>
      <SpendingScreen searchParams={searchParams} />
    </Suspense>
  );
}

function toSpend(tx: TransactionRow) {
  return {
    amountCents: tx.amountCents,
    categoryId: tx.categoryId,
    categoryKind: tx.categoryKind,
    isTransfer: tx.isTransfer,
  };
}

async function SpendingScreen({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await live();
  const params = await searchParams;
  const now = new Date();
  const view = parseView(one(params.view));
  const month = one(params.month) && /^\d{4}-\d{2}$/.test(one(params.month)!) ? one(params.month)! : currentMonth(now);
  const year = Number(one(params.year) ?? now.getFullYear());
  const quarter = clampQuarter(Number(one(params.quarter) ?? Math.floor(now.getMonth() / 3) + 1));
  const compare = one(params.compare) === "year" ? "year" : "previous";
  const accountId = one(params.account) ?? "";
  const range = resolveRange(view, month, year, quarter, one(params.from), one(params.to), now);
  const compared = compareRange(range, view, compare);
  const db = database();
  const accounts = listAccounts(db);
  const currentTx = transactionsInRange(db, range.from, range.to, accountId || undefined);
  const compareTx = transactionsInRange(db, compared.from, compared.to, accountId || undefined);
  const categories = listCategories(db);
  const currentTotals = categoryTotals(currentTx.map(toSpend));
  const compareTotals = categoryTotals(compareTx.map(toSpend));
  const expenses = buildTree(categories, "expense", currentTotals.expense, compareTotals.expense);
  const income = buildTree(categories, "income", currentTotals.income, compareTotals.income);
  const expenseTotal = treeTotal(expenses, "currentCents") + currentTotals.uncategorizedExpense;
  const expenseCompare = treeTotal(expenses, "compareCents") + compareTotals.uncategorizedExpense;
  const incomeTotal = sumBucket(currentTx.map(toSpend), "income");
  const food = findNode(expenses, "Food");
  const unreviewed = currentTx.filter((tx) => tx.reviewStatus === "unreviewed").length;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Compare</p>
          <h1>Spending</h1>
        </div>
      </header>
      <div className="quick-links">
        <Link href={`/spending?view=month&month=${currentMonth(now)}&compare=previous`}>This month vs last</Link>
        <Link href={`/spending?view=month&month=${currentMonth(now)}&compare=year`}>This month vs last year</Link>
        <Link href="/spending?view=month&month=2026-06&compare=year">June 2026 vs June 2025</Link>
      </div>
      <SpendingControls
        key={`${view}-${month}-${year}-${quarter}-${range.from}-${range.to}-${compare}-${accountId}`}
        view={view}
        month={month}
        year={Number.isFinite(year) ? year : now.getFullYear()}
        quarter={quarter}
        from={range.from}
        to={range.to}
        compare={compare}
        accountId={accountId}
        accounts={accounts}
      />
      {food ? (
        <p className="narrative">
          Food was {formatPlain(food.currentCents)} in {range.label}, compared with{" "}
          {formatPlain(food.compareCents)} in {compared.label}.
        </p>
      ) : (
        <p className="narrative">
          {formatPlain(expenseTotal)} spent in {range.label}.
        </p>
      )}
      {unreviewed > 0 ? (
        <p className="small muted">
          {unreviewed} transactions in this period are still unconfirmed. Their suggestions are included.{" "}
          <Link href="/review">Review them</Link>.
        </p>
      ) : null}
      <SpendTable
        title="Expenses"
        nodes={expenses}
        currentLabel={range.label}
        compareLabel={compared.label}
        uncategorizedCurrent={currentTotals.uncategorizedExpense}
        uncategorizedCompare={compareTotals.uncategorizedExpense}
        totalCurrent={expenseTotal}
        totalCompare={expenseCompare}
      />
      {incomeTotal > 0 || treeTotal(income, "compareCents") > 0 ? (
        <div style={{ marginTop: 18 }}>
          <SpendTable
            title="Income"
            nodes={income}
            currentLabel={range.label}
            compareLabel={compared.label}
            uncategorizedCurrent={currentTotals.uncategorizedIncome}
            uncategorizedCompare={compareTotals.uncategorizedIncome}
            totalCurrent={treeTotal(income, "currentCents") + currentTotals.uncategorizedIncome}
            totalCompare={treeTotal(income, "compareCents") + compareTotals.uncategorizedIncome}
          />
        </div>
      ) : null}
    </>
  );
}

function SpendTable({
  title,
  nodes,
  currentLabel,
  compareLabel,
  uncategorizedCurrent,
  uncategorizedCompare,
  totalCurrent,
  totalCompare,
}: {
  title: string;
  nodes: SpendNode[];
  currentLabel: string;
  compareLabel: string;
  uncategorizedCurrent: number;
  uncategorizedCompare: number;
  totalCurrent: number;
  totalCompare: number;
}) {
  const rows = flatten(nodes);
  return (
    <section className="card">
      <h2>{title}</h2>
      <table className="sheet">
        <thead>
          <tr>
            <th>Category</th>
            <th className="num">{currentLabel}</th>
            <th className="num">{compareLabel}</th>
            <th className="num">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ node, depth }) => (
            <tr key={node.id} className={depth > 0 ? "child" : undefined}>
              <td style={{ paddingLeft: depth * 16 }}>{node.name}</td>
              <td className="num">{formatPlain(node.currentCents)}</td>
              <td className="num">{formatPlain(node.compareCents)}</td>
              <td className="num">
                <Money cents={node.currentCents - node.compareCents} sign="delta" />
              </td>
            </tr>
          ))}
          {uncategorizedCurrent !== 0 || uncategorizedCompare !== 0 ? (
            <tr>
              <td>Uncategorized</td>
              <td className="num">{formatPlain(uncategorizedCurrent)}</td>
              <td className="num">{formatPlain(uncategorizedCompare)}</td>
              <td className="num">
                <Money cents={uncategorizedCurrent - uncategorizedCompare} sign="delta" />
              </td>
            </tr>
          ) : null}
          <tr className="total">
            <td>Total</td>
            <td className="num">{formatPlain(totalCurrent)}</td>
            <td className="num">{formatPlain(totalCompare)}</td>
            <td className="num">
              <Money cents={totalCurrent - totalCompare} sign="delta" />
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function flatten(nodes: SpendNode[], depth = 0): { node: SpendNode; depth: number }[] {
  return nodes.flatMap((node) => [{ node, depth }, ...flatten(node.children, depth + 1)]);
}

function formatPlain(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function parseView(value: string | undefined): RangeView {
  if (value === "quarter" || value === "year" || value === "custom" || value === "month") return value;
  return "month";
}

function clampQuarter(value: number) {
  if (value < 1 || value > 4 || !Number.isFinite(value)) return 1;
  return value;
}

function resolveRange(
  view: RangeView,
  month: string,
  year: number,
  quarter: number,
  from: string | undefined,
  to: string | undefined,
  now: Date,
): DateRange {
  if (view === "quarter") return quarterRange(Number.isFinite(year) ? year : now.getFullYear(), quarter);
  if (view === "year") return yearRange(Number.isFinite(year) ? year : now.getFullYear());
  if (view === "custom" && from && to && from <= to) {
    return { from, to, label: `${from} – ${to}` };
  }
  return monthRange(month);
}
