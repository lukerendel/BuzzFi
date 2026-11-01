import type { Category, CategoryKind } from "./types";

export type SpendInput = {
  amountCents: number;
  categoryId: string | null;
  categoryKind: CategoryKind | null;
  isTransfer: boolean;
};

export type SpendNode = {
  id: string;
  name: string;
  currentCents: number;
  compareCents: number;
  children: SpendNode[];
};

export type Classified = {
  bucket: "expense" | "income" | "ignore";
  cents: number;
  categoryId: string | null;
};

export function classifyTransaction(tx: SpendInput): Classified {
  if (tx.isTransfer || tx.categoryKind === "transfer") {
    return { bucket: "ignore", cents: 0, categoryId: tx.categoryId };
  }
  if (tx.categoryKind === "income") {
    return { bucket: "income", cents: tx.amountCents, categoryId: tx.categoryId };
  }
  if (tx.categoryKind === "expense") {
    return { bucket: "expense", cents: -tx.amountCents, categoryId: tx.categoryId };
  }
  if (tx.amountCents < 0) {
    return { bucket: "expense", cents: -tx.amountCents, categoryId: null };
  }
  if (tx.amountCents > 0) {
    return { bucket: "income", cents: tx.amountCents, categoryId: null };
  }
  return { bucket: "ignore", cents: 0, categoryId: null };
}

export function sumBucket(transactions: SpendInput[], bucket: "expense" | "income"): number {
  return transactions.reduce((total, tx) => {
    const classified = classifyTransaction(tx);
    return classified.bucket === bucket ? total + classified.cents : total;
  }, 0);
}

export function categoryTotals(transactions: SpendInput[]): {
  expense: Map<string, number>;
  income: Map<string, number>;
  uncategorizedExpense: number;
  uncategorizedIncome: number;
} {
  const expense = new Map<string, number>();
  const income = new Map<string, number>();
  let uncategorizedExpense = 0;
  let uncategorizedIncome = 0;

  for (const tx of transactions) {
    const classified = classifyTransaction(tx);
    if (classified.bucket === "ignore") continue;
    if (!classified.categoryId) {
      if (classified.bucket === "expense") uncategorizedExpense += classified.cents;
      else uncategorizedIncome += classified.cents;
      continue;
    }
    const map = classified.bucket === "expense" ? expense : income;
    map.set(classified.categoryId, (map.get(classified.categoryId) ?? 0) + classified.cents);
  }

  return { expense, income, uncategorizedExpense, uncategorizedIncome };
}

export function buildTree(
  categories: Category[],
  kind: "expense" | "income",
  current: Map<string, number>,
  compare: Map<string, number>,
): SpendNode[] {
  const relevant = categories.filter((category) => category.kind === kind);
  const byParent = new Map<string | null, Category[]>();
  for (const category of relevant) {
    const list = byParent.get(category.parentId) ?? [];
    list.push(category);
    byParent.set(category.parentId, list);
  }

  function nodeFor(category: Category): SpendNode | null {
    const children = (byParent.get(category.id) ?? [])
      .map(nodeFor)
      .filter((child): child is SpendNode => child != null);
    const currentCents =
      (current.get(category.id) ?? 0) + children.reduce((sum, child) => sum + child.currentCents, 0);
    const compareCents =
      (compare.get(category.id) ?? 0) + children.reduce((sum, child) => sum + child.compareCents, 0);
    if (currentCents === 0 && compareCents === 0) return null;
    return {
      id: category.id,
      name: category.name,
      currentCents,
      compareCents,
      children,
    };
  }

  return (byParent.get(null) ?? [])
    .map(nodeFor)
    .filter((node): node is SpendNode => node != null);
}

export function treeTotal(nodes: SpendNode[], field: "currentCents" | "compareCents"): number {
  return nodes.reduce((sum, node) => sum + node[field], 0);
}

export function averageCents(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export type PositionAccount = {
  type: "checking" | "savings" | "credit" | "venmo" | "cash";
  balanceCents: number | null;
};

export function netPosition(accounts: PositionAccount[]): {
  assets: number;
  liabilities: number;
  net: number;
} {
  let assets = 0;
  let liabilities = 0;
  for (const account of accounts) {
    if (account.balanceCents == null) continue;
    if (account.type === "credit") liabilities += account.balanceCents;
    else assets += account.balanceCents;
  }
  return { assets, liabilities, net: assets - liabilities };
}

export function findNode(nodes: SpendNode[], name: string): SpendNode | null {
  for (const node of nodes) {
    if (node.name === name) return node;
    const child = findNode(node.children, name);
    if (child) return child;
  }
  return null;
}
