import { formatMoney } from "@/lib/money";

export function Money({
  cents,
  sign = "auto",
}: {
  cents: number;
  sign?: "auto" | "plain" | "delta";
}) {
  if (sign === "delta") {
    const prefix = cents > 0 ? "+" : cents < 0 ? "−" : "";
    const className = cents > 0 ? "money money-neg" : cents < 0 ? "money money-pos" : "money";
    return (
      <span className={className}>
        {prefix}
        {formatMoney(Math.abs(cents))}
      </span>
    );
  }
  const className =
    sign === "plain" ? "money" : cents < 0 ? "money money-neg" : cents > 0 ? "money money-pos" : "money";
  return <span className={className}>{formatMoney(cents)}</span>;
}
