import fs from "fs";
import path from "path";
import type Database from "better-sqlite3";
import { statementsRoot } from "./db";
import { headerSignature } from "./csv";
import { importRelativeFile, scanStatements } from "./importing";
import { createAccount, getAccountBySlug, insertSnapshot, upsertProfile } from "./repo";
import type { AccountType, ColumnMap } from "./types";

const SAMPLE_ACCOUNTS: {
  name: string;
  institution: string;
  type: AccountType;
  folderSlug: string;
}[] = [
  { name: "Chase Checking", institution: "Chase", type: "checking", folderSlug: "chase-checking" },
  { name: "Amex Gold", institution: "American Express", type: "credit", folderSlug: "amex" },
  { name: "Venmo", institution: "Venmo", type: "venmo", folderSlug: "venmo" },
];

const PROFILES: (ColumnMap & { name: string; headers: string[] })[] = [
  {
    name: "Chase checking",
    headers: ["Transaction Date", "Description", "Amount", "Balance"],
    dateColumn: "Transaction Date",
    descriptionColumn: "Description",
    amountColumn: "Amount",
    debitColumn: null,
    creditColumn: null,
    balanceColumn: "Balance",
    flipSign: false,
  },
  {
    name: "Amex",
    headers: ["Date", "Description", "Amount"],
    dateColumn: "Date",
    descriptionColumn: "Description",
    amountColumn: "Amount",
    debitColumn: null,
    creditColumn: null,
    balanceColumn: null,
    flipSign: true,
  },
  {
    name: "Venmo",
    headers: ["Datetime", "Note", "Amount (total)", "Balance"],
    dateColumn: "Datetime",
    descriptionColumn: "Note",
    amountColumn: "Amount (total)",
    debitColumn: null,
    creditColumn: null,
    balanceColumn: "Balance",
    flipSign: false,
  },
];

export const SAMPLE_AMEX_BALANCE_CENTS = 126040;
export const SAMPLE_AMEX_AS_OF = "2026-11-01";

export function loadSample(db: Database.Database): { importedFiles: number; inserted: number } {
  const source = path.join(process.cwd(), "examples", "statements");
  const destination = statementsRoot();
  fs.mkdirSync(destination, { recursive: true });
  fs.cpSync(source, destination, { recursive: true });

  for (const account of SAMPLE_ACCOUNTS) {
    if (!getAccountBySlug(db, account.folderSlug)) {
      createAccount(db, account);
    }
  }

  const profiles = PROFILES.map((profile) =>
    upsertProfile(db, {
      ...profile,
      headerSignature: headerSignature(profile.headers),
    }),
  );

  const amex = getAccountBySlug(db, "amex");
  if (amex) {
    const existing = db
      .prepare(
        `SELECT id FROM balance_snapshots
         WHERE account_id = ? AND as_of = ? AND balance_cents = ? AND source = 'manual'`,
      )
      .get(amex.id, SAMPLE_AMEX_AS_OF, SAMPLE_AMEX_BALANCE_CENTS) as { id: string } | undefined;
    if (!existing) {
      insertSnapshot(db, {
        accountId: amex.id,
        asOf: SAMPLE_AMEX_AS_OF,
        balanceCents: SAMPLE_AMEX_BALANCE_CENTS,
        source: "manual",
      });
    }
  }

  let importedFiles = 0;
  let inserted = 0;
  for (const file of scanStatements(db)) {
    if (file.imported || !file.accountId || !file.profileId) continue;
    const profile = profiles.find((item) => item.id === file.profileId);
    if (!profile) continue;
    const result = importRelativeFile(db, file.relativePath, {
      accountId: file.accountId,
      profile,
    });
    if (result.status === "imported") {
      importedFiles += 1;
      inserted += result.inserted;
    }
  }

  return { importedFiles, inserted };
}

export type SampleLoadResult = ReturnType<typeof loadSample>;
