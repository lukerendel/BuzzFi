export function parseAmount(value: string): number | null {
  let v = value.trim();
  if (!v || v === "-" || v === "—" || v === "–") return null;

  let negative = false;
  if (v.startsWith("(") && v.endsWith(")")) {
    negative = true;
    v = v.slice(1, -1).trim();
  }

  v = v.replace(/[$,\s]/g, "");
  if (!v) return null;
  if (v.startsWith("+")) v = v.slice(1);
  if (v.startsWith("-")) {
    negative = !negative;
    v = v.slice(1);
  }
  if (!/^\d+(\.\d+)?$/.test(v)) return null;

  const cents = Math.round(Number(v) * 100);
  if (!Number.isFinite(cents)) return null;
  return negative ? -cents : cents;
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function dollarsToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return parseAmount(trimmed);
}
