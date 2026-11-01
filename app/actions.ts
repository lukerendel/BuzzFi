"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { database } from "@/lib/db";
import { live } from "@/lib/live";
import { dollarsToCents } from "@/lib/money";
import { parseDate } from "@/lib/dates";
import { loadSample } from "@/lib/sample";
import { importRelativeFile, scanStatements } from "@/lib/importing";
import {
  acceptSuggested,
  assignTransactionToTrip,
  confirmCategory,
  createAccount,
  createCategory,
  createTrip,
  deleteRule,
  fillBudgets,
  getAccount,
  insertSnapshot,
  leafExpenseCategories,
  listCategories,
  listProfiles,
  saveBudgetAmounts,
  saveTripMembers,
  skipTransaction,
  updateAccount,
  upsertProfile,
} from "@/lib/repo";
import { slugify } from "@/lib/labels";
import { ACCOUNT_TYPES, type AccountType, type CategoryKind, type ColumnMap } from "@/lib/types";

function refresh() {
  revalidatePath("/", "layout");
}

function withParam(path: string, key: string, value: string) {
  const [pathname, search = ""] = path.split("?");
  const params = new URLSearchParams(search);
  params.set(key, value);
  return `${pathname}?${params.toString()}`;
}

function bail(path: string, message: string): never {
  redirect(withParam(path, "error", message));
}

function done(path: string, message: string): never {
  redirect(withParam(path, "notice", message));
}

function accountType(value: FormDataEntryValue | null): AccountType | null {
  const raw = String(value ?? "");
  return (ACCOUNT_TYPES as readonly string[]).includes(raw) ? (raw as AccountType) : null;
}

function folderSlug(value: FormDataEntryValue | null): string | null {
  const slug = slugify(String(value ?? ""));
  return slug || null;
}

export async function createAccountAction(formData: FormData) {
  await live();
  const name = String(formData.get("name") ?? "").trim();
  const institution = String(formData.get("institution") ?? "").trim();
  const type = accountType(formData.get("type"));
  if (!name) bail("/accounts", "Name is required.");
  if (!type) bail("/accounts", "Choose an account type.");
  try {
    createAccount(database(), { name, institution, type, folderSlug: folderSlug(formData.get("folderSlug")) });
  } catch {
    bail("/accounts", "That folder name is already used by another account.");
  }
  refresh();
  done("/accounts", `${name} added.`);
}

export async function updateAccountAction(formData: FormData) {
  await live();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const institution = String(formData.get("institution") ?? "").trim();
  const type = accountType(formData.get("type"));
  if (!getAccount(database(), id)) bail("/accounts", "Account not found.");
  if (!name || !type) bail("/accounts", "Name and type are required.");
  try {
    updateAccount(database(), id, {
      name,
      institution,
      type,
      folderSlug: folderSlug(formData.get("folderSlug")),
    });
  } catch {
    bail("/accounts", "That folder name is already used by another account.");
  }
  refresh();
  done("/accounts", `${name} saved.`);
}

export async function addManualBalance(formData: FormData) {
  await live();
  const accountId = String(formData.get("accountId") ?? "");
  const asOf = parseDate(String(formData.get("asOf") ?? ""));
  const balance = dollarsToCents(String(formData.get("amount") ?? ""));
  const account = getAccount(database(), accountId);
  if (!account) bail("/accounts", "Account not found.");
  if (!asOf) bail("/accounts", "Enter a valid as-of date.");
  if (balance == null) bail("/accounts", "Enter a balance.");
  insertSnapshot(database(), {
    accountId,
    asOf,
    balanceCents: balance,
    source: "manual",
  });
  refresh();
  done("/accounts", `Balance saved for ${account.name}.`);
}

export async function addCategoryAction(formData: FormData) {
  await live();
  const name = String(formData.get("name") ?? "").trim();
  const kindRaw = String(formData.get("kind") ?? "expense");
  const parentId = String(formData.get("parentId") ?? "") || null;
  const kind: CategoryKind =
    kindRaw === "income" || kindRaw === "transfer" || kindRaw === "expense" ? kindRaw : "expense";
  if (!name) bail("/review", "Category name is required.");
  createCategory(database(), { name, parentId, kind });
  refresh();
  done("/review", `${name} added.`);
}

export async function deleteRuleAction(formData: FormData) {
  await live();
  deleteRule(database(), String(formData.get("id") ?? ""));
  refresh();
  done("/review", "Rule removed.");
}

export async function confirmTransaction(formData: FormData) {
  await live();
  const returnTo = String(formData.get("returnTo") ?? "");
  const result = confirmCategory(database(), {
    id: String(formData.get("id") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    saveRule: formData.get("saveRule") === "on" || formData.get("saveRule") === "true",
  });
  refresh();
  if (returnTo) {
    if (!result.ok) bail(returnTo, result.error);
    redirect(returnTo);
  }
  return result;
}

export async function skipTransactionAction(formData: FormData) {
  await live();
  skipTransaction(database(), String(formData.get("id") ?? ""));
  refresh();
  return { ok: true as const };
}

export async function acceptSuggestedAction() {
  await live();
  const count = acceptSuggested(database());
  refresh();
  done(
    "/review",
    count ? `Confirmed ${count} suggested transactions.` : "Nothing had a suggestion yet.",
  );
}

export async function saveTransactionCategory(formData: FormData) {
  await live();
  const returnTo = String(formData.get("returnTo") ?? "/transactions");
  const result = confirmCategory(database(), {
    id: String(formData.get("id") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    saveRule: false,
  });
  refresh();
  if (!result.ok) bail(returnTo, result.error);
  redirect(returnTo);
}

export async function importMappedFile(formData: FormData) {
  await live();
  const relativePath = String(formData.get("relativePath") ?? "");
  const accountId = String(formData.get("accountId") ?? "");
  const db = database();
  const scanned = scanStatements(db).find((file) => file.relativePath === relativePath);
  if (!scanned) bail("/import", "That statement is no longer in the folder.");
  if (!getAccount(db, accountId)) bail(`/import?file=${encodeURIComponent(relativePath)}`, "Choose an account.");

  const mode = String(formData.get("amountMode") ?? "signed");
  const pick = (name: string) => {
    const value = String(formData.get(name) ?? "").trim();
    return value || null;
  };
  const map: ColumnMap = {
    dateColumn: String(formData.get("dateColumn") ?? "").trim(),
    descriptionColumn: String(formData.get("descriptionColumn") ?? "").trim(),
    amountColumn: mode === "split" ? null : pick("amountColumn"),
    debitColumn: mode === "split" ? pick("debitColumn") : null,
    creditColumn: mode === "split" ? pick("creditColumn") : null,
    balanceColumn: pick("balanceColumn"),
    flipSign: formData.get("flipSign") === "on",
  };
  if (!scanned.headers.includes(map.dateColumn) || !scanned.headers.includes(map.descriptionColumn)) {
    bail(`/import?file=${encodeURIComponent(relativePath)}`, "Choose date and description columns.");
  }
  if (mode === "split") {
    if (!map.debitColumn || !map.creditColumn) {
      bail(`/import?file=${encodeURIComponent(relativePath)}`, "Choose debit and credit columns.");
    }
  } else if (!map.amountColumn) {
    bail(`/import?file=${encodeURIComponent(relativePath)}`, "Choose an amount column.");
  }

  const profile = upsertProfile(db, {
    name: String(formData.get("profileName") ?? "").trim() || scanned.folderSlug || "Statement",
    headerSignature: scanned.signature,
    ...map,
  });
  const ending = dollarsToCents(String(formData.get("endingBalance") ?? ""));
  let result;
  try {
    result = importRelativeFile(db, relativePath, {
      accountId,
      profile,
      endingBalanceCents: ending,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed.";
    bail(`/import?file=${encodeURIComponent(relativePath)}`, message);
  }
  refresh();
  if (result.status === "duplicate-file") {
    done("/import", "That file was already imported.");
  }
  done(
    "/import",
    `Imported ${result.inserted} transactions. Skipped ${result.skippedDuplicates} duplicates and ${result.skippedInvalid} unreadable rows.`,
  );
}

export async function importReadyAction() {
  await live();
  const db = database();
  const profiles = listProfiles(db);
  let filesImported = 0;
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
      filesImported += 1;
      inserted += result.inserted;
    }
  }
  refresh();
  done("/import", `Imported ${inserted} transactions from ${filesImported} files.`);
}

export async function loadSampleAction() {
  await live();
  const result = loadSample(database());
  refresh();
  done(
    "/import",
    `Sample statements are in the statements folder. Imported ${result.inserted} transactions from ${result.importedFiles} files. The Citi file still needs a column mapping.`,
  );
}

export async function saveBudgetsAction(formData: FormData) {
  await live();
  const month = String(formData.get("month") ?? "");
  if (!/^\d{4}-\d{2}$/.test(month)) bail("/budgets", "Choose a month.");
  const leaves = leafExpenseCategories(listCategories(database()));
  const amounts: { categoryId: string; amountCents: number | null }[] = [];
  for (const category of leaves) {
    const text = String(formData.get(`amount_${category.id}`) ?? "").trim();
    if (!text) {
      amounts.push({ categoryId: category.id, amountCents: null });
      continue;
    }
    const cents = dollarsToCents(text);
    if (cents == null || cents < 0) {
      bail(`/budgets?month=${month}`, `Enter a dollar amount for ${category.name}.`);
    }
    amounts.push({ categoryId: category.id, amountCents: cents });
  }
  saveBudgetAmounts(database(), month, amounts);
  refresh();
  done(`/budgets?month=${month}`, "Budgets saved.");
}

export async function fillBudgetsAction(formData: FormData) {
  await live();
  const month = String(formData.get("month") ?? "");
  if (!/^\d{4}-\d{2}$/.test(month)) bail("/budgets", "Choose a month.");
  const count = fillBudgets(database(), month);
  refresh();
  done(
    `/budgets?month=${month}`,
    count
      ? `Filled ${count} categories from the previous three months.`
      : "No spending in the previous three months to copy.",
  );
}

export async function createTripAction(formData: FormData) {
  await live();
  const name = String(formData.get("name") ?? "").trim();
  const startDate = parseDate(String(formData.get("startDate") ?? ""));
  const endDate = parseDate(String(formData.get("endDate") ?? ""));
  const notes = String(formData.get("notes") ?? "").trim();
  if (!name || !startDate || !endDate) bail("/trips", "Name, start, and end are required.");
  if (endDate < startDate) bail("/trips", "The end date has to be on or after the start.");
  const trip = createTrip(database(), { name, startDate, endDate, notes });
  refresh();
  redirect(`/trips/${trip.id}`);
}

export async function saveTripMembersAction(formData: FormData) {
  await live();
  const tripId = String(formData.get("tripId") ?? "");
  const ids = formData.getAll("transactionId").map(String);
  saveTripMembers(database(), tripId, ids);
  refresh();
  done(`/trips/${tripId}`, "Trip transactions saved.");
}

export async function addTripTransactionAction(formData: FormData) {
  await live();
  const tripId = String(formData.get("tripId") ?? "");
  const transactionId = String(formData.get("transactionId") ?? "");
  assignTransactionToTrip(database(), tripId, transactionId);
  refresh();
  done(`/trips/${tripId}`, "Transaction added to the trip.");
}
