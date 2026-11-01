import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import type Database from "better-sqlite3";
import { csvRecords, headerSignature, lastBalance, parseMappedRow } from "./csv";
import { statementsRoot } from "./db";
import { fingerprint, normalizeMerchant } from "./merchant";
import {
  bindFolderSlug,
  fingerprintExists,
  getAccount,
  getAccountBySlug,
  getCategory,
  getProfileBySignature,
  insertSnapshot,
  insertStatementFile,
  insertTransaction,
  statementHashExists,
  suggestFor,
} from "./repo";
import type { ColumnMap, ImportResult, Profile, ScannedFile } from "./types";

export function resolveInside(root: string, relativePath: string): string {
  const base = path.resolve(root);
  const full = path.resolve(base, relativePath);
  if (full !== base && !full.startsWith(base + path.sep)) {
    throw new Error("That file is outside the statements folder.");
  }
  return full;
}

export function scanStatements(db: Database.Database, root = statementsRoot()): ScannedFile[] {
  fs.mkdirSync(root, { recursive: true });
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".csv")) files.push(full);
    }
  };
  walk(root);

  return files
    .map((full) => {
      const relativePath = path.relative(root, full).split(path.sep).join("/");
      const text = fs.readFileSync(full, "utf8");
      const hash = createHash("sha256").update(text).digest("hex");
      const { headers, rows } = csvRecords(text);
      const signature = headerSignature(headers);
      const folderSlug = relativePath.includes("/") ? relativePath.split("/")[0] : null;
      const profile = getProfileBySignature(db, signature);
      const account = folderSlug ? getAccountBySlug(db, folderSlug) : null;
      return {
        relativePath,
        folderSlug,
        hash,
        headers,
        signature,
        preview: rows.slice(0, 6),
        imported: statementHashExists(db, hash),
        accountId: account?.id ?? null,
        profileId: profile?.id ?? null,
        rowCount: rows.length,
      } satisfies ScannedFile;
    })
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export function importRelativeFile(
  db: Database.Database,
  relativePath: string,
  input: {
    accountId: string;
    profile: Profile | (ColumnMap & { id: string | null });
    endingBalanceCents?: number | null;
    root?: string;
  },
): ImportResult {
  const root = input.root ?? statementsRoot();
  const absolute = resolveInside(root, relativePath);
  const text = fs.readFileSync(absolute, "utf8");
  const hash = createHash("sha256").update(text).digest("hex");
  if (statementHashExists(db, hash)) {
    return {
      status: "duplicate-file",
      inserted: 0,
      skippedDuplicates: 0,
      skippedInvalid: 0,
      endingBalanceCents: null,
      periodStart: null,
      periodEnd: null,
    };
  }

  const account = getAccount(db, input.accountId);
  if (!account) throw new Error("Choose an account for this file.");

  const { rows } = csvRecords(text);
  const parsed = rows.map((row) => parseMappedRow(row, input.profile));
  const valid = parsed.filter((row): row is NonNullable<typeof row> => row != null);
  const skippedInvalid = parsed.length - valid.length;
  const dates = valid.map((row) => row.postedOn).sort();
  const periodStart = dates[0] ?? null;
  const periodEnd = dates[dates.length - 1] ?? null;
  const columnBalance = lastBalance(valid);
  const endingBalanceCents =
    columnBalance ?? (input.endingBalanceCents == null ? null : input.endingBalanceCents);

  let inserted = 0;
  let skippedDuplicates = 0;

  const run = db.transaction(() => {
    const statementFileId = insertStatementFile(db, {
      accountId: account.id,
      path: relativePath,
      contentHash: hash,
      periodStart,
      periodEnd,
      endingBalanceCents,
      profileId: input.profile.id,
    });

    for (const row of valid) {
      const merchant = normalizeMerchant(row.description);
      const fp = fingerprint(account.id, row.postedOn, row.amountCents, row.description);
      if (fingerprintExists(db, fp)) {
        skippedDuplicates += 1;
        continue;
      }
      const suggestion = suggestFor(db, merchant, row.description);
      const category = suggestion ? getCategory(db, suggestion.categoryId) : null;
      insertTransaction(db, {
        accountId: account.id,
        statementFileId,
        postedOn: row.postedOn,
        amountCents: row.amountCents,
        description: row.description,
        merchant,
        fingerprint: fp,
        categoryId: category?.id ?? null,
        isTransfer: category?.kind === "transfer",
        suggestionSource: suggestion?.source ?? null,
      });
      inserted += 1;
    }

    if (endingBalanceCents != null && periodEnd) {
      insertSnapshot(db, {
        accountId: account.id,
        asOf: periodEnd,
        balanceCents: endingBalanceCents,
        source: "statement",
      });
    }
  });
  run();

  const folderSlug = relativePath.includes("/") ? relativePath.split("/")[0] : null;
  bindFolderSlug(db, account.id, folderSlug);

  return {
    status: "imported",
    inserted,
    skippedDuplicates,
    skippedInvalid,
    endingBalanceCents,
    periodStart,
    periodEnd,
  };
}
