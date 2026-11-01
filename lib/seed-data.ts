import type { CategoryKind } from "./types";

export type SeedCategory = {
  id: string;
  name: string;
  parentId: string | null;
  kind: CategoryKind;
};

export type SeedRule = {
  pattern: string;
  categoryId: string;
  priority: number;
};

export const SEED_CATEGORIES: SeedCategory[] = [
  { id: "cat_income", name: "Income", parentId: null, kind: "income" },
  { id: "cat_paycheck", name: "Paycheck", parentId: "cat_income", kind: "income" },
  { id: "cat_other_income", name: "Other income", parentId: "cat_income", kind: "income" },
  { id: "cat_food", name: "Food", parentId: null, kind: "expense" },
  { id: "cat_groceries", name: "Groceries", parentId: "cat_food", kind: "expense" },
  { id: "cat_restaurants", name: "Restaurants", parentId: "cat_food", kind: "expense" },
  { id: "cat_transport", name: "Transport", parentId: null, kind: "expense" },
  { id: "cat_fuel", name: "Fuel", parentId: "cat_transport", kind: "expense" },
  { id: "cat_transit", name: "Transit", parentId: "cat_transport", kind: "expense" },
  { id: "cat_rideshare", name: "Rideshare", parentId: "cat_transport", kind: "expense" },
  { id: "cat_travel", name: "Travel", parentId: null, kind: "expense" },
  { id: "cat_flights", name: "Flights", parentId: "cat_travel", kind: "expense" },
  { id: "cat_lodging", name: "Lodging", parentId: "cat_travel", kind: "expense" },
  { id: "cat_housing", name: "Housing", parentId: null, kind: "expense" },
  { id: "cat_rent", name: "Rent", parentId: "cat_housing", kind: "expense" },
  { id: "cat_utilities", name: "Utilities", parentId: "cat_housing", kind: "expense" },
  { id: "cat_subscriptions", name: "Subscriptions", parentId: null, kind: "expense" },
  { id: "cat_shopping", name: "Shopping", parentId: null, kind: "expense" },
  { id: "cat_health", name: "Health", parentId: null, kind: "expense" },
  { id: "cat_other", name: "Other", parentId: null, kind: "expense" },
  { id: "cat_transfer", name: "Transfer", parentId: null, kind: "transfer" },
];

export const SEED_RULES: SeedRule[] = [
  { pattern: "whole foods", categoryId: "cat_groceries", priority: 10 },
  { pattern: "trader joe", categoryId: "cat_groceries", priority: 10 },
  { pattern: "kroger", categoryId: "cat_groceries", priority: 10 },
  { pattern: "safeway", categoryId: "cat_groceries", priority: 10 },
  { pattern: "wegmans", categoryId: "cat_groceries", priority: 10 },
  { pattern: "costco", categoryId: "cat_groceries", priority: 10 },
  { pattern: "aldi", categoryId: "cat_groceries", priority: 10 },
  { pattern: "starbucks", categoryId: "cat_restaurants", priority: 10 },
  { pattern: "chipotle", categoryId: "cat_restaurants", priority: 10 },
  { pattern: "doordash", categoryId: "cat_restaurants", priority: 10 },
  { pattern: "uber eats", categoryId: "cat_restaurants", priority: 20 },
  { pattern: "sweetgreen", categoryId: "cat_restaurants", priority: 10 },
  { pattern: "shell", categoryId: "cat_fuel", priority: 10 },
  { pattern: "chevron", categoryId: "cat_fuel", priority: 10 },
  { pattern: "exxon", categoryId: "cat_fuel", priority: 10 },
  { pattern: "uber trip", categoryId: "cat_rideshare", priority: 20 },
  { pattern: "lyft", categoryId: "cat_rideshare", priority: 10 },
  { pattern: "united airlines", categoryId: "cat_flights", priority: 10 },
  { pattern: "delta air", categoryId: "cat_flights", priority: 10 },
  { pattern: "southwest", categoryId: "cat_flights", priority: 10 },
  { pattern: "jetblue", categoryId: "cat_flights", priority: 10 },
  { pattern: "american airlines", categoryId: "cat_flights", priority: 10 },
  { pattern: "hotel", categoryId: "cat_lodging", priority: 10 },
  { pattern: "airbnb", categoryId: "cat_lodging", priority: 10 },
  { pattern: "rent payment", categoryId: "cat_rent", priority: 10 },
  { pattern: "con ed", categoryId: "cat_utilities", priority: 10 },
  { pattern: "netflix", categoryId: "cat_subscriptions", priority: 10 },
  { pattern: "spotify", categoryId: "cat_subscriptions", priority: 10 },
  { pattern: "icloud", categoryId: "cat_subscriptions", priority: 10 },
  { pattern: "payroll", categoryId: "cat_paycheck", priority: 10 },
  { pattern: "direct dep", categoryId: "cat_paycheck", priority: 10 },
  { pattern: "payment thank you", categoryId: "cat_transfer", priority: 10 },
  { pattern: "payment received", categoryId: "cat_transfer", priority: 10 },
  { pattern: "autopay", categoryId: "cat_transfer", priority: 10 },
  { pattern: "transfer to venmo", categoryId: "cat_transfer", priority: 10 },
  { pattern: "transfer from bank", categoryId: "cat_transfer", priority: 10 },
];

export const RECENT_CATEGORY_FALLBACK = [
  "cat_groceries",
  "cat_restaurants",
  "cat_fuel",
  "cat_flights",
  "cat_lodging",
  "cat_rent",
  "cat_subscriptions",
  "cat_shopping",
  "cat_other",
];
