import type { AccountType, Category } from "./types";

export function accountTypeLabel(type: AccountType): string {
  switch (type) {
    case "checking":
      return "Checking";
    case "savings":
      return "Savings";
    case "credit":
      return "Credit card";
    case "venmo":
      return "Venmo";
    case "cash":
      return "Cash";
  }
}

export function categoryChoices(categories: Category[]): { id: string; label: string }[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  return categories
    .map((category) => ({
      id: category.id,
      label: category.parentId
        ? `${byId.get(category.parentId)?.name ?? "Category"} / ${category.name}`
        : category.name,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug;
}

export function one(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
