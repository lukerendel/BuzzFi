import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { csvRecords, headerSignature as signature, parseCsv, parseMappedRow } from "../lib/csv";
import { compareRange, inclusiveDays, monthRange, parseDate, quarterRange } from "../lib/dates";
import { openDatabase } from "../lib/db";
import { resolveInside, importRelativeFile, scanStatements } from "../lib/importing";
import { matchRule, normalizeMerchant } from "../lib/merchant";
import { parseAmount } from "../lib/money";
import {
  createAccount,
  fillBudgets,
  latestSnapshots,
  listBudgets,
  spentForCategory,
  transactionsInRange,
  upsertProfile,
} from "../lib/repo";
import { averageCents, classifyTransaction, netPosition, sumBucket } from "../lib/spending";

test("parses money, dates, and quoted CSV cells", () => {
  assert.equal(parseAmount("$1,234.50"), 123450);
  assert.equal(parseAmount("(12.00)"), -1200);
  assert.equal(parseAmount("-84.20"), -8420);
  assert.equal(parseDate("06/03/2025"), "2025-06-03");
  assert.equal(parseDate("2026-05-14T21:05:00"), "2026-05-14");
  assert.equal(parseDate("02/31/2026"), null);
  const table = parseCsv('Date,Note\n01/02/2026,"Dinner, Ana"\n');
  assert.deepEqual(table, [
    ["Date", "Note"],
    ["01/02/2026", "Dinner, Ana"],
  ]);
});

test("normalizes merchants and prefers the longer rule", () => {
  assert.equal(normalizeMerchant("POS WHOLE FOODS MARKET 1042"), "WHOLE FOODS MARKET");
  const rules = [
    { id: "1", pattern: "uber", categoryId: "rides", priority: 10, createdAt: "" },
    { id: "2", pattern: "uber eats", categoryId: "food", priority: 10, createdAt: "" },
  ];
  assert.equal(matchRule("UBER EATS LISBON", "UBER EATS LISBON", rules)?.categoryId, "food");
});

test("compares months, quarters, and trip length", () => {
  const june = monthRange("2026-06");
  assert.equal(june.to, "2026-06-30");
  const previous = compareRange(june, "month", "previous");
  const yearAgo = compareRange(june, "month", "year");
  assert.equal(previous.label, "May 2026");
  assert.equal(yearAgo.from, "2025-06-01");
  assert.equal(yearAgo.label, "June 2025");
  assert.deepEqual(quarterRange(2026, 2), {
    from: "2026-04-01",
    to: "2026-06-30",
    label: "Q2 2026",
  });
  assert.equal(inclusiveDays("2026-05-10", "2026-05-18"), 9);
  assert.equal(averageCents([100, 0, 50]), 50);
  assert.deepEqual(
    netPosition([
      { type: "checking", balanceCents: 800000 },
      { type: "venmo", balanceCents: 15000 },
      { type: "credit", balanceCents: 126040 },
    ]),
    { assets: 815000, liabilities: 126040, net: 688960 },
  );
});

test("refuses paths outside the statements folder", () => {
  assert.throws(() => resolveInside("/tmp/buzzfi-statements", "../secrets.csv"));
});

test("imports sample statements once, categorizes food, and budgets from history", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "buzzfi-"));
  const db = openDatabase(path.join(dir, "buzzfi.db"));
  const root = path.join(process.cwd(), "examples", "statements");
  const chase = createAccount(db, {
    name: "Chase Checking",
    institution: "Chase",
    type: "checking",
    folderSlug: "chase-checking",
  });
  const amex = createAccount(db, {
    name: "Amex Gold",
    institution: "American Express",
    type: "credit",
    folderSlug: "amex",
  });
  createAccount(db, { name: "Venmo", institution: "Venmo", type: "venmo", folderSlug: "venmo" });

  const profiles = [
    upsertProfile(db, {
      name: "Chase",
      headerSignature: signature(["Transaction Date", "Description", "Amount", "Balance"]),
      dateColumn: "Transaction Date",
      descriptionColumn: "Description",
      amountColumn: "Amount",
      debitColumn: null,
      creditColumn: null,
      balanceColumn: "Balance",
      flipSign: false,
    }),
    upsertProfile(db, {
      name: "Amex",
      headerSignature: signature(["Date", "Description", "Amount"]),
      dateColumn: "Date",
      descriptionColumn: "Description",
      amountColumn: "Amount",
      debitColumn: null,
      creditColumn: null,
      balanceColumn: null,
      flipSign: true,
    }),
    upsertProfile(db, {
      name: "Venmo",
      headerSignature: signature(["Datetime", "Note", "Amount (total)", "Balance"]),
      dateColumn: "Datetime",
      descriptionColumn: "Note",
      amountColumn: "Amount (total)",
      debitColumn: null,
      creditColumn: null,
      balanceColumn: "Balance",
      flipSign: false,
    }),
  ];

  const files = scanStatements(db, root);
  assert.ok(files.some((file) => file.relativePath === "citi/2026-11.csv" && !file.profileId));
  const statuses = new Map<string, string>();
  for (const file of files) {
    if (!file.accountId || !file.profileId) continue;
    const profile = profiles.find((item) => item.id === file.profileId);
    if (!profile) continue;
    const result = importRelativeFile(db, file.relativePath, {
      accountId: file.accountId,
      profile,
      root,
    });
    statuses.set(file.relativePath, result.status);
  }
  assert.equal(
    [
      statuses.get("chase-checking/2026-06.csv"),
      statuses.get("chase-checking/2026-06-duplicate.csv"),
    ].filter((status) => status === "duplicate-file").length,
    1,
  );
  assert.equal(statuses.get("chase-checking/2026-06-overlap.csv"), "imported");

  const june2026 = transactionsInRange(db, "2026-06-01", "2026-06-30");
  const foodIds = new Set(["cat_groceries", "cat_restaurants"]);
  const food2026 = june2026.reduce((sum, tx) => {
    if (!tx.categoryId || !foodIds.has(tx.categoryId)) return sum;
    const classified = classifyTransaction(tx);
    return classified.bucket === "expense" ? sum + classified.cents : sum;
  }, 0);
  const food2025 = transactionsInRange(db, "2025-06-01", "2025-06-30").reduce((sum, tx) => {
    if (!tx.categoryId || !foodIds.has(tx.categoryId)) return sum;
    const classified = classifyTransaction(tx);
    return classified.bucket === "expense" ? sum + classified.cents : sum;
  }, 0);
  assert.equal(food2026, 18622);
  assert.equal(food2025, 15160);
  assert.equal(june2026.filter((tx) => tx.description.includes("WHOLE FOODS")).length, 1);
  assert.equal(june2026.filter((tx) => tx.description.includes("FARMERS MARKET")).length, 1);
  assert.equal(
    june2026.find((tx) => tx.description.includes("FARMERS MARKET"))?.categoryId,
    null,
  );

  const june2025 = transactionsInRange(db, "2025-06-01", "2025-06-30");
  assert.equal(
    june2025.find((tx) => tx.description.includes("PAYMENT THANK YOU"))?.isTransfer,
    true,
  );
  assert.equal(sumBucket(june2025, "expense"), 200360);

  const card = parseMappedRow(
    { Posted: "11/01/2026", Details: "BLUE BOTTLE COFFEE", Debit: "6.75", Credit: "" },
    {
      dateColumn: "Posted",
      descriptionColumn: "Details",
      amountColumn: null,
      debitColumn: "Debit",
      creditColumn: "Credit",
      balanceColumn: null,
      flipSign: false,
    },
  );
  assert.equal(card?.amountCents, -675);

  const november = csvRecords(fs.readFileSync(path.join(root, "chase-checking/2026-11.csv"), "utf8"));
  const expectedBalance = parseAmount(november.rows.at(-1)?.Balance ?? "");
  const snapshot = latestSnapshots(db).find((item) => item.accountId === chase.id);
  assert.equal(snapshot?.balanceCents, expectedBalance);

  const groceryMonths = ["2026-08", "2026-09", "2026-10"].map((month) =>
    spentForCategory(db, "cat_groceries", month),
  );
  assert.deepEqual(groceryMonths, [12820, 10110, 12060]);
  fillBudgets(db, "2026-11");
  const groceryBudget = listBudgets(db, "2026-11").find((budget) => budget.categoryId === "cat_groceries");
  assert.equal(groceryBudget?.amountCents, averageCents(groceryMonths));
  assert.ok(amex.id);
  db.close();
});
