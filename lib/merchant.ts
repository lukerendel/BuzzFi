import type { Rule } from "./types";

const LEADING_NOISE =
  /^(POS|DEBIT|CREDIT|PURCHASE|CHECKCARD|ACH|VISA|RECURRING PAYMENT|RECURRING)\s+/;

export function normalizeMerchant(description: string): string {
  let value = description.toUpperCase().replace(/\s+/g, " ").trim();
  let previous = "";
  while (value !== previous) {
    previous = value;
    value = value.replace(LEADING_NOISE, "");
  }
  value = value.replace(/\s+#?\d{3,}\b/g, "");
  value = value.replace(/\s+\d{2}\/\d{2}(\/\d{2,4})?\b/g, "");
  value = value.replace(/[*]+/g, " ");
  value = value.replace(/\s+/g, " ").trim();
  return value.slice(0, 80) || description.trim().slice(0, 80);
}

export function matchRule(
  merchant: string,
  description: string,
  rules: Rule[],
): Rule | null {
  const haystack = `${merchant}\n${description}`.toLowerCase();
  const hits = rules.filter((rule) => {
    const pattern = rule.pattern.trim().toLowerCase();
    return pattern.length > 0 && haystack.includes(pattern);
  });
  if (hits.length === 0) return null;
  hits.sort((a, b) => b.priority - a.priority || b.pattern.length - a.pattern.length);
  return hits[0];
}

export function fingerprint(
  accountId: string,
  postedOn: string,
  amountCents: number,
  description: string,
): string {
  const descriptionKey = description.trim().toLowerCase().replace(/\s+/g, " ");
  return `${accountId}|${postedOn}|${amountCents}|${descriptionKey}`;
}
