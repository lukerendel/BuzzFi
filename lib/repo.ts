import { randomUUID } from "crypto";
import type Database from "better-sqlite3";
import { monthRange, shiftMonth } from "./dates";
import { matchRule, normalizeMerchant } from "./merchant";
import { averageCents, sumBucket } from "./spending";
import { RECENT_CATEGORY_FALLBACK } from "./seed-data";
import type {
  Account,
  AccountType,
  BalanceSnapshot,
  Budget,
  Category,
  CategoryKind,
  ColumnMap,
  Profile,
  ReviewStatus,
  Rule,
  SuggestionSource,
  TransactionRow,
  Trip,
} from "./types";

type AccountSql = {
  id: string;
  name: string;
  institution: string;
  type: AccountType;
  folder_slug: string | null;
  created_at: string;
};

type CategorySql = {
  id: string;
  name: string;
  parent_id: string | null;
  kind: CategoryKind;
  created_at: string;
};

type RuleSql = {
  id: string;
  pattern: string;
  category_id: string;
  priority: number;
  created_at: string;
};

type ProfileSql = {
  id: string;
  name: string;
  header_signature: string;
  date_column: string;
  description_column: string;
  amount_column: string | null;
  debit_column: string | null;
  credit_column: string | null;
  balance_column: string | null;
  flip_sign: number;
  created_at: string;
};

type TripSql = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  notes: string;
  created_at: string;
};

type TransactionSql = {
  id: string;
  account_id: string;
  account_name: string;
  account_type: AccountType;
  statement_file_id: string | null;
  posted_on: string;
  amount_cents: number;
  description: string;
  merchant: string;
  category_id: string | null;
  category_name: string | null;
  category_kind: CategoryKind | null;
  trip_id: string | null;
  trip_name: string | null;
  is_transfer: number;
  fingerprint: string;
  review_status: ReviewStatus;
  suggestion_source: SuggestionSource | null;
};

const TX_SELECT = `
  SELECT
    t.id, t.account_id, a.name AS account_name, a.type AS account_type,
    t.statement_file_id, t.posted_on, t.amount_cents, t.description, t.merchant,
    t.category_id, c.name AS category_name, c.kind AS category_kind,
    t.trip_id, trips.name AS trip_name, t.is_transfer, t.fingerprint,
    t.review_status, t.suggestion_source
  FROM transactions t
  JOIN accounts a ON a.id = t.account_id
  LEFT JOIN categories c ON c.id = t.category_id
  LEFT JOIN trips ON trips.id = t.trip_id
`;

function mapAccount(row: AccountSql): Account {
  return {
    id: row.id,
    name: row.name,
    institution: row.institution,
    type: row.type,
    folderSlug: row.folder_slug,
    createdAt: row.created_at,
  };
}

function mapCategory(row: CategorySql): Category {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    kind: row.kind,
    createdAt: row.created_at,
  };
}

function mapRule(row: RuleSql): Rule {
  return {
    id: row.id,
    pattern: row.pattern,
    categoryId: row.category_id,
    priority: row.priority,
    createdAt: row.created_at,
  };
}

function mapProfile(row: ProfileSql): Profile {
  return {
    id: row.id,
    name: row.name,
    headerSignature: row.header_signature,
    dateColumn: row.date_column,
    descriptionColumn: row.description_column,
    amountColumn: row.amount_column,
    debitColumn: row.debit_column,
    creditColumn: row.credit_column,
    balanceColumn: row.balance_column,
    flipSign: row.flip_sign === 1,
    createdAt: row.created_at,
  };
}

function mapTrip(row: TripSql): Trip {
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function mapTransaction(row: TransactionSql): TransactionRow {
  return {
    id: row.id,
    accountId: row.account_id,
    accountName: row.account_name,
    accountType: row.account_type,
    statementFileId: row.statement_file_id,
    postedOn: row.posted_on,
    amountCents: row.amount_cents,
    description: row.description,
    merchant: row.merchant,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categoryKind: row.category_kind,
    tripId: row.trip_id,
    tripName: row.trip_name,
    isTransfer: row.is_transfer === 1,
    fingerprint: row.fingerprint,
    reviewStatus: row.review_status,
    suggestionSource: row.suggestion_source,
  };
}

export function listAccounts(db: Database.Database): Account[] {
  const rows = db
    .prepare("SELECT * FROM accounts ORDER BY name COLLATE NOCASE")
    .all() as AccountSql[];
  return rows.map(mapAccount);
}

export function getAccount(db: Database.Database, id: string): Account | null {
  const row = db.prepare("SELECT * FROM accounts WHERE id = ?").get(id) as AccountSql | undefined;
  return row ? mapAccount(row) : null;
}

export function getAccountBySlug(db: Database.Database, slug: string): Account | null {
  const row = db.prepare("SELECT * FROM accounts WHERE folder_slug = ?").get(slug) as
    | AccountSql
    | undefined;
  return row ? mapAccount(row) : null;
}

export function createAccount(
  db: Database.Database,
  input: { name: string; institution: string; type: AccountType; folderSlug: string | null },
): Account {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO accounts (id, name, institution, type, folder_slug, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, input.name, input.institution, input.type, input.folderSlug, createdAt);
  return getAccount(db, id)!;
}

export function updateAccount(
  db: Database.Database,
  id: string,
  input: { name: string; institution: string; type: AccountType; folderSlug: string | null },
) {
  db.prepare(
    `UPDATE accounts SET name = ?, institution = ?, type = ?, folder_slug = ? WHERE id = ?`,
  ).run(input.name, input.institution, input.type, input.folderSlug, id);
}

export function listCategories(db: Database.Database): Category[] {
  const rows = db
    .prepare("SELECT * FROM categories ORDER BY name COLLATE NOCASE")
    .all() as CategorySql[];
  return rows.map(mapCategory);
}

export function getCategory(db: Database.Database, id: string): Category | null {
  const row = db.prepare("SELECT * FROM categories WHERE id = ?").get(id) as
    | CategorySql
    | undefined;
  return row ? mapCategory(row) : null;
}

export function createCategory(
  db: Database.Database,
  input: { name: string; parentId: string | null; kind: CategoryKind },
): Category {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO categories (id, name, parent_id, kind, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, input.name, input.parentId, input.kind, new Date().toISOString());
  return getCategory(db, id)!;
}

export function listRules(db: Database.Database): Rule[] {
  const rows = db
    .prepare("SELECT * FROM rules ORDER BY priority DESC, length(pattern) DESC, pattern")
    .all() as RuleSql[];
  return rows.map(mapRule);
}

export function createRule(
  db: Database.Database,
  input: { pattern: string; categoryId: string; priority?: number },
): Rule | null {
  const pattern = input.pattern.trim().toLowerCase();
  if (pattern.length < 2) return null;
  const existing = db.prepare("SELECT id FROM rules WHERE pattern = ?").get(pattern) as
    | { id: string }
    | undefined;
  if (existing) {
    db.prepare("UPDATE rules SET category_id = ?, priority = ? WHERE id = ?").run(
      input.categoryId,
      input.priority ?? 20,
      existing.id,
    );
    return listRules(db).find((rule) => rule.id === existing.id) ?? null;
  }
  const id = randomUUID();
  db.prepare(
    `INSERT INTO rules (id, pattern, category_id, priority, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, pattern, input.categoryId, input.priority ?? 20, new Date().toISOString());
  return listRules(db).find((rule) => rule.id === id) ?? null;
}

export function deleteRule(db: Database.Database, id: string) {
  db.prepare("DELETE FROM rules WHERE id = ?").run(id);
}

export function memoryMap(db: Database.Database): Map<string, string> {
  const rows = db.prepare("SELECT merchant, category_id FROM merchant_memory").all() as {
    merchant: string;
    category_id: string;
  }[];
  return new Map(rows.map((row) => [row.merchant, row.category_id]));
}

export function rememberMerchant(db: Database.Database, merchant: string, categoryId: string) {
  db.prepare(
    `INSERT INTO merchant_memory (merchant, category_id, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(merchant) DO UPDATE SET category_id = excluded.category_id, updated_at = excluded.updated_at`,
  ).run(merchant, categoryId, new Date().toISOString());
}

export function listProfiles(db: Database.Database): Profile[] {
  const rows = db.prepare("SELECT * FROM profiles ORDER BY name").all() as ProfileSql[];
  return rows.map(mapProfile);
}

export function getProfileBySignature(db: Database.Database, signature: string): Profile | null {
  const row = db.prepare("SELECT * FROM profiles WHERE header_signature = ?").get(signature) as
    | ProfileSql
    | undefined;
  return row ? mapProfile(row) : null;
}

export function upsertProfile(
  db: Database.Database,
  input: ColumnMap & { name: string; headerSignature: string },
): Profile {
  const existing = getProfileBySignature(db, input.headerSignature);
  if (existing) {
    db.prepare(
      `UPDATE profiles
       SET name = ?, date_column = ?, description_column = ?, amount_column = ?,
           debit_column = ?, credit_column = ?, balance_column = ?, flip_sign = ?
       WHERE id = ?`,
    ).run(
      input.name,
      input.dateColumn,
      input.descriptionColumn,
      input.amountColumn,
      input.debitColumn,
      input.creditColumn,
      input.balanceColumn,
      input.flipSign ? 1 : 0,
      existing.id,
    );
    return getProfileBySignature(db, input.headerSignature)!;
  }
  const id = randomUUID();
  db.prepare(
    `INSERT INTO profiles (
      id, name, header_signature, date_column, description_column, amount_column,
      debit_column, credit_column, balance_column, flip_sign, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.name,
    input.headerSignature,
    input.dateColumn,
    input.descriptionColumn,
    input.amountColumn,
    input.debitColumn,
    input.creditColumn,
    input.balanceColumn,
    input.flipSign ? 1 : 0,
    new Date().toISOString(),
  );
  return getProfileBySignature(db, input.headerSignature)!;
}

export function statementHashExists(db: Database.Database, hash: string): boolean {
  const row = db.prepare("SELECT id FROM statement_files WHERE content_hash = ?").get(hash) as
    | { id: string }
    | undefined;
  return Boolean(row);
}

export function suggestFor(
  db: Database.Database,
  merchant: string,
  description: string,
): { categoryId: string; source: SuggestionSource } | null {
  const rule = matchRule(merchant, description, listRules(db));
  if (rule) return { categoryId: rule.categoryId, source: "rule" };
  const memory = memoryMap(db).get(merchant);
  if (memory) return { categoryId: memory, source: "memory" };
  return null;
}

export type NewTransaction = {
  accountId: string;
  statementFileId: string | null;
  postedOn: string;
  amountCents: number;
  description: string;
  merchant: string;
  fingerprint: string;
  categoryId: string | null;
  isTransfer: boolean;
  suggestionSource: SuggestionSource | null;
};

export function insertStatementFile(
  db: Database.Database,
  input: {
    accountId: string;
    path: string;
    contentHash: string;
    periodStart: string | null;
    periodEnd: string | null;
    endingBalanceCents: number | null;
    profileId: string | null;
  },
): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO statement_files (
      id, account_id, path, content_hash, period_start, period_end,
      ending_balance_cents, profile_id, imported_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.accountId,
    input.path,
    input.contentHash,
    input.periodStart,
    input.periodEnd,
    input.endingBalanceCents,
    input.profileId,
    new Date().toISOString(),
  );
  return id;
}

export function fingerprintExists(db: Database.Database, fingerprint: string): boolean {
  const row = db.prepare("SELECT id FROM transactions WHERE fingerprint = ?").get(fingerprint) as
    | { id: string }
    | undefined;
  return Boolean(row);
}

export function insertTransaction(db: Database.Database, input: NewTransaction): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO transactions (
      id, account_id, statement_file_id, posted_on, amount_cents, description, merchant,
      category_id, trip_id, is_transfer, fingerprint, review_status, suggestion_source, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 'unreviewed', ?, ?)`,
  ).run(
    id,
    input.accountId,
    input.statementFileId,
    input.postedOn,
    input.amountCents,
    input.description,
    input.merchant,
    input.categoryId,
    input.isTransfer ? 1 : 0,
    input.fingerprint,
    input.suggestionSource,
    new Date().toISOString(),
  );
  return id;
}

export function insertSnapshot(
  db: Database.Database,
  input: {
    accountId: string;
    asOf: string;
    balanceCents: number;
    source: "statement" | "manual";
  },
) {
  db.prepare(
    `INSERT INTO balance_snapshots (id, account_id, as_of, balance_cents, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    input.accountId,
    input.asOf,
    input.balanceCents,
    input.source,
    new Date().toISOString(),
  );
}

export function latestSnapshots(db: Database.Database): BalanceSnapshot[] {
  const rows = db
    .prepare(
      `SELECT id, account_id, as_of, balance_cents, source, created_at
       FROM balance_snapshots
       ORDER BY as_of DESC, created_at DESC`,
    )
    .all() as {
    id: string;
    account_id: string;
    as_of: string;
    balance_cents: number;
    source: "statement" | "manual";
    created_at: string;
  }[];
  const seen = new Set<string>();
  const latest: BalanceSnapshot[] = [];
  for (const row of rows) {
    if (seen.has(row.account_id)) continue;
    seen.add(row.account_id);
    latest.push({
      id: row.id,
      accountId: row.account_id,
      asOf: row.as_of,
      balanceCents: row.balance_cents,
      source: row.source,
      createdAt: row.created_at,
    });
  }
  return latest;
}

export function countUnreviewed(db: Database.Database): number {
  const row = db
    .prepare("SELECT COUNT(*) AS count FROM transactions WHERE review_status = 'unreviewed'")
    .get() as { count: number };
  return row.count;
}

export function listReviewQueue(db: Database.Database): TransactionRow[] {
  const rows = db
    .prepare(
      `${TX_SELECT}
       WHERE t.review_status = 'unreviewed'
       ORDER BY t.posted_on DESC, t.description`,
    )
    .all() as TransactionSql[];
  return rows.map(mapTransaction);
}

export function recentCategoryIds(db: Database.Database): string[] {
  const rows = db
    .prepare(
      `SELECT category_id FROM merchant_memory
       ORDER BY updated_at DESC
       LIMIT 9`,
    )
    .all() as { category_id: string }[];
  const ids = rows.map((row) => row.category_id);
  for (const fallback of RECENT_CATEGORY_FALLBACK) {
    if (ids.length >= 9) break;
    if (!ids.includes(fallback)) ids.push(fallback);
  }
  return ids.slice(0, 9);
}

export function listTransactions(
  db: Database.Database,
  filters: {
    from?: string;
    to?: string;
    accountId?: string;
    categoryId?: string;
    reviewStatus?: string;
    query?: string;
    limit?: number;
  },
): TransactionRow[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.from) {
    where.push("t.posted_on >= ?");
    params.push(filters.from);
  }
  if (filters.to) {
    where.push("t.posted_on <= ?");
    params.push(filters.to);
  }
  if (filters.accountId) {
    where.push("t.account_id = ?");
    params.push(filters.accountId);
  }
  if (filters.categoryId === "none") {
    where.push("t.category_id IS NULL");
  } else if (filters.categoryId) {
    where.push("t.category_id = ?");
    params.push(filters.categoryId);
  }
  if (filters.reviewStatus) {
    where.push("t.review_status = ?");
    params.push(filters.reviewStatus);
  }
  if (filters.query) {
    where.push("(t.description LIKE ? OR t.merchant LIKE ?)");
    const like = `%${filters.query}%`;
    params.push(like, like);
  }
  const sql = `${TX_SELECT}
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY t.posted_on DESC, t.description
    LIMIT ?`;
  params.push(filters.limit ?? 400);
  const rows = db.prepare(sql).all(...params) as TransactionSql[];
  return rows.map(mapTransaction);
}

export function transactionsInRange(
  db: Database.Database,
  from: string,
  to: string,
  accountId?: string,
): TransactionRow[] {
  return listTransactions(db, { from, to, accountId, limit: 10000 });
}

export function getTransaction(db: Database.Database, id: string): TransactionRow | null {
  const row = db.prepare(`${TX_SELECT} WHERE t.id = ?`).get(id) as TransactionSql | undefined;
  return row ? mapTransaction(row) : null;
}

export function confirmCategory(
  db: Database.Database,
  input: { id: string; categoryId: string; saveRule: boolean },
): { ok: true } | { ok: false; error: string } {
  const tx = getTransaction(db, input.id);
  const category = getCategory(db, input.categoryId);
  if (!tx) return { ok: false, error: "That transaction is gone." };
  if (!category) return { ok: false, error: "Pick a category." };
  const isTransfer = category.kind === "transfer";
  db.prepare(
    `UPDATE transactions
     SET category_id = ?, is_transfer = ?, review_status = 'confirmed', suggestion_source = NULL
     WHERE id = ?`,
  ).run(category.id, isTransfer ? 1 : 0, tx.id);
  rememberMerchant(db, tx.merchant, category.id);
  if (input.saveRule) {
    createRule(db, { pattern: tx.merchant.toLowerCase(), categoryId: category.id, priority: 20 });
  }
  return { ok: true };
}

export function skipTransaction(db: Database.Database, id: string) {
  db.prepare(
    `UPDATE transactions
     SET review_status = 'skipped', category_id = NULL, is_transfer = 0, suggestion_source = NULL
     WHERE id = ?`,
  ).run(id);
}

export function acceptSuggested(db: Database.Database): number {
  const queue = listReviewQueue(db).filter((tx) => tx.categoryId);
  const run = db.transaction(() => {
    for (const tx of queue) {
      confirmCategory(db, { id: tx.id, categoryId: tx.categoryId!, saveRule: false });
    }
  });
  run();
  return queue.length;
}

export function listBudgets(db: Database.Database, month: string): Budget[] {
  const rows = db
    .prepare(
      `SELECT id, category_id, month, amount_cents FROM budgets WHERE month = ?`,
    )
    .all(month) as {
    id: string;
    category_id: string;
    month: string;
    amount_cents: number;
  }[];
  return rows.map((row) => ({
    id: row.id,
    categoryId: row.category_id,
    month: row.month,
    amountCents: row.amount_cents,
  }));
}

export function spentForCategory(db: Database.Database, categoryId: string, month: string): number {
  const range = monthRange(month);
  const rows = transactionsInRange(db, range.from, range.to).filter(
    (tx) => tx.categoryId === categoryId,
  );
  return sumBucket(
    rows.map((tx) => ({
      amountCents: tx.amountCents,
      categoryId: tx.categoryId,
      categoryKind: tx.categoryKind,
      isTransfer: tx.isTransfer,
    })),
    "expense",
  );
}

export function leafExpenseCategories(categories: Category[]): Category[] {
  const parentIds = new Set(
    categories.map((category) => category.parentId).filter((id): id is string => Boolean(id)),
  );
  return categories.filter((category) => category.kind === "expense" && !parentIds.has(category.id));
}

export function fillBudgets(db: Database.Database, month: string): number {
  const categories = listCategories(db);
  const leaves = leafExpenseCategories(categories);
  const months = [1, 2, 3].map((delta) => shiftMonth(month, -delta));
  let written = 0;
  const run = db.transaction(() => {
    for (const category of leaves) {
      const totals = months.map((prior) => spentForCategory(db, category.id, prior));
      if (totals.every((total) => total === 0)) continue;
      const amount = averageCents(totals);
      upsertBudget(db, category.id, month, amount);
      written += 1;
    }
  });
  run();
  return written;
}

export function upsertBudget(
  db: Database.Database,
  categoryId: string,
  month: string,
  amountCents: number,
) {
  const existing = db
    .prepare("SELECT id FROM budgets WHERE category_id = ? AND month = ?")
    .get(categoryId, month) as { id: string } | undefined;
  if (existing) {
    db.prepare("UPDATE budgets SET amount_cents = ? WHERE id = ?").run(amountCents, existing.id);
    return;
  }
  db.prepare(
    `INSERT INTO budgets (id, category_id, month, amount_cents) VALUES (?, ?, ?, ?)`,
  ).run(randomUUID(), categoryId, month, amountCents);
}

export function saveBudgetAmounts(
  db: Database.Database,
  month: string,
  amounts: { categoryId: string; amountCents: number | null }[],
) {
  const run = db.transaction(() => {
    for (const amount of amounts) {
      if (amount.amountCents == null) {
        db.prepare("DELETE FROM budgets WHERE category_id = ? AND month = ?").run(
          amount.categoryId,
          month,
        );
      } else {
        upsertBudget(db, amount.categoryId, month, amount.amountCents);
      }
    }
  });
  run();
}

export function listTrips(db: Database.Database): Trip[] {
  const rows = db
    .prepare("SELECT * FROM trips ORDER BY start_date DESC, name")
    .all() as TripSql[];
  return rows.map(mapTrip);
}

export function getTrip(db: Database.Database, id: string): Trip | null {
  const row = db.prepare("SELECT * FROM trips WHERE id = ?").get(id) as TripSql | undefined;
  return row ? mapTrip(row) : null;
}

export function createTrip(
  db: Database.Database,
  input: { name: string; startDate: string; endDate: string; notes: string },
): Trip {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO trips (id, name, start_date, end_date, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, input.name, input.startDate, input.endDate, input.notes, new Date().toISOString());
  return getTrip(db, id)!;
}

export function tripCandidates(db: Database.Database, trip: Trip): TransactionRow[] {
  const rows = db
    .prepare(
      `${TX_SELECT}
       WHERE (t.posted_on >= ? AND t.posted_on <= ? AND (t.trip_id IS NULL OR t.trip_id = ?))
          OR t.trip_id = ?
       ORDER BY t.posted_on, t.description`,
    )
    .all(trip.startDate, trip.endDate, trip.id, trip.id) as TransactionSql[];
  return rows.map(mapTransaction);
}

export function searchOutsideTrip(
  db: Database.Database,
  trip: Trip,
  query: string,
): TransactionRow[] {
  const like = `%${query.trim()}%`;
  const rows = db
    .prepare(
      `${TX_SELECT}
       WHERE (t.posted_on < ? OR t.posted_on > ?)
         AND (t.trip_id IS NULL OR t.trip_id = ?)
         AND (t.description LIKE ? OR t.merchant LIKE ?)
       ORDER BY t.posted_on DESC
       LIMIT 40`,
    )
    .all(trip.startDate, trip.endDate, trip.id, like, like) as TransactionSql[];
  return rows.map(mapTransaction);
}

export function saveTripMembers(db: Database.Database, tripId: string, transactionIds: string[]) {
  const trip = getTrip(db, tripId);
  if (!trip) return;
  const selected = new Set(transactionIds);
  const candidates = tripCandidates(db, trip);
  const run = db.transaction(() => {
    for (const tx of candidates) {
      if (selected.has(tx.id)) {
        db.prepare("UPDATE transactions SET trip_id = ? WHERE id = ?").run(tripId, tx.id);
      } else if (tx.tripId === tripId) {
        db.prepare("UPDATE transactions SET trip_id = NULL WHERE id = ?").run(tx.id);
      }
    }
  });
  run();
}

export function assignTransactionToTrip(db: Database.Database, tripId: string, transactionId: string) {
  db.prepare("UPDATE transactions SET trip_id = ? WHERE id = ?").run(tripId, transactionId);
}

export function listAssignedTripTransactions(db: Database.Database): TransactionRow[] {
  const rows = db
    .prepare(`${TX_SELECT} WHERE t.trip_id IS NOT NULL ORDER BY t.posted_on`)
    .all() as TransactionSql[];
  return rows.map(mapTransaction);
}

export function lastImportByAccount(db: Database.Database): Map<string, string> {
  const rows = db
    .prepare(
      `SELECT account_id, MAX(imported_at) AS imported_at
       FROM statement_files
       GROUP BY account_id`,
    )
    .all() as { account_id: string; imported_at: string }[];
  return new Map(rows.map((row) => [row.account_id, row.imported_at]));
}

export function bindFolderSlug(db: Database.Database, accountId: string, folderSlug: string | null) {
  if (!folderSlug) return;
  const account = getAccount(db, accountId);
  if (!account || account.folderSlug) return;
  const taken = getAccountBySlug(db, folderSlug);
  if (taken && taken.id !== accountId) return;
  db.prepare("UPDATE accounts SET folder_slug = ? WHERE id = ?").run(folderSlug, accountId);
}

export { normalizeMerchant };
