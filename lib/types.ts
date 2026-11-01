export const ACCOUNT_TYPES = [
  "checking",
  "savings",
  "credit",
  "venmo",
  "cash",
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export type CategoryKind = "expense" | "income" | "transfer";

export type ReviewStatus = "unreviewed" | "confirmed" | "skipped";

export type SuggestionSource = "rule" | "memory";

export type Account = {
  id: string;
  name: string;
  institution: string;
  type: AccountType;
  folderSlug: string | null;
  createdAt: string;
};

export type Category = {
  id: string;
  name: string;
  parentId: string | null;
  kind: CategoryKind;
  createdAt: string;
};

export type Rule = {
  id: string;
  pattern: string;
  categoryId: string;
  priority: number;
  createdAt: string;
};

export type ColumnMap = {
  dateColumn: string;
  descriptionColumn: string;
  amountColumn: string | null;
  debitColumn: string | null;
  creditColumn: string | null;
  balanceColumn: string | null;
  flipSign: boolean;
};

export type Profile = ColumnMap & {
  id: string;
  name: string;
  headerSignature: string;
  createdAt: string;
};

export type Trip = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  notes: string;
  createdAt: string;
};

export type Budget = {
  id: string;
  categoryId: string;
  month: string;
  amountCents: number;
};

export type BalanceSnapshot = {
  id: string;
  accountId: string;
  asOf: string;
  balanceCents: number;
  source: "statement" | "manual";
  createdAt: string;
};

export type TransactionRow = {
  id: string;
  accountId: string;
  accountName: string;
  accountType: AccountType;
  statementFileId: string | null;
  postedOn: string;
  amountCents: number;
  description: string;
  merchant: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryKind: CategoryKind | null;
  tripId: string | null;
  tripName: string | null;
  isTransfer: boolean;
  fingerprint: string;
  reviewStatus: ReviewStatus;
  suggestionSource: SuggestionSource | null;
};

export type ScannedFile = {
  relativePath: string;
  folderSlug: string | null;
  hash: string;
  headers: string[];
  signature: string;
  preview: Record<string, string>[];
  imported: boolean;
  accountId: string | null;
  profileId: string | null;
  rowCount: number;
};

export type ImportResult = {
  status: "imported" | "duplicate-file";
  inserted: number;
  skippedDuplicates: number;
  skippedInvalid: number;
  endingBalanceCents: number | null;
  periodStart: string | null;
  periodEnd: string | null;
};
