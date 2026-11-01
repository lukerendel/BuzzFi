import { parseDate } from "./dates";
import { parseAmount } from "./money";
import type { ColumnMap } from "./types";

export function parseCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((value) => value.trim() !== ""));
}

export function headerSignature(headers: string[]): string {
  return headers.map((header) => header.trim().toLowerCase()).join("|");
}

export function csvRecords(text: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const table = parseCsv(text);
  if (table.length === 0) return { headers: [], rows: [] };
  const headers = table[0].map((header) => header.trim());
  const rows = table.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = (cells[index] ?? "").trim();
    });
    return record;
  });
  return { headers, rows };
}

export type ParsedRow = {
  postedOn: string;
  amountCents: number;
  description: string;
  balanceCents: number | null;
};

export function parseMappedRow(row: Record<string, string>, map: ColumnMap): ParsedRow | null {
  const postedOn = parseDate(row[map.dateColumn] ?? "");
  const description = (row[map.descriptionColumn] ?? "").trim() || "(no description)";
  const amountCents = rowAmount(row, map);
  if (!postedOn || amountCents == null || amountCents === 0) return null;

  let balanceCents: number | null = null;
  if (map.balanceColumn) {
    const raw = row[map.balanceColumn] ?? "";
    balanceCents = raw.trim() ? parseAmount(raw) : null;
  }

  return { postedOn, amountCents, description, balanceCents };
}

export function rowAmount(row: Record<string, string>, map: ColumnMap): number | null {
  if (map.amountColumn) {
    const raw = row[map.amountColumn] ?? "";
    if (!raw.trim()) return null;
    const parsed = parseAmount(raw);
    if (parsed == null) return null;
    return map.flipSign ? -parsed : parsed;
  }

  const debitRaw = map.debitColumn ? (row[map.debitColumn] ?? "").trim() : "";
  const creditRaw = map.creditColumn ? (row[map.creditColumn] ?? "").trim() : "";
  if (!debitRaw && !creditRaw) return null;
  const debit = debitRaw ? parseAmount(debitRaw) : 0;
  const credit = creditRaw ? parseAmount(creditRaw) : 0;
  if (debit == null || credit == null) return null;
  const amount = Math.abs(credit) - Math.abs(debit);
  return map.flipSign ? -amount : amount;
}

export function lastBalance(rows: ParsedRow[]): number | null {
  let balance: number | null = null;
  for (const row of rows) {
    if (row.balanceCents != null) balance = row.balanceCents;
  }
  return balance;
}
