export function guessColumns(headers: string[]): {
  dateColumn: string;
  descriptionColumn: string;
  amountColumn: string;
  debitColumn: string;
  creditColumn: string;
  balanceColumn: string;
  mode: "signed" | "split";
} {
  const find = (...needles: string[]) =>
    headers.find((header) => needles.some((needle) => header.toLowerCase().includes(needle))) ?? "";
  const debitColumn = find("debit");
  const creditColumn = find("credit");
  const amountColumn = headers.find((header) => {
    const lower = header.toLowerCase();
    return lower.includes("amount") && !lower.includes("debit") && !lower.includes("credit");
  }) ?? "";
  return {
    dateColumn: find("date", "posted"),
    descriptionColumn: find("description", "note", "memo", "details", "payee"),
    amountColumn,
    debitColumn,
    creditColumn,
    balanceColumn: find("balance"),
    mode: debitColumn && creditColumn ? "split" : "signed",
  };
}
