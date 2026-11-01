import { Suspense } from "react";
import { acceptSuggestedAction, addCategoryAction, deleteRuleAction } from "@/app/actions";
import { Banner } from "@/components/banner";
import { ReviewQueue } from "@/components/review-queue";
import { database } from "@/lib/db";
import { live } from "@/lib/live";
import { categoryChoices, one } from "@/lib/labels";
import { listCategories, listReviewQueue, listRules, recentCategoryIds } from "@/lib/repo";

export const metadata = { title: "Review" };

export default function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="muted">Loading the queue…</p>}>
      <ReviewScreen searchParams={searchParams} />
    </Suspense>
  );
}

async function ReviewScreen({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await live();
  const params = await searchParams;
  const db = database();
  const items = listReviewQueue(db);
  const categories = listCategories(db);
  const choices = categoryChoices(categories);
  const recentIds = recentCategoryIds(db);
  const byId = new Map(choices.map((choice) => [choice.id, choice]));
  const recent = recentIds.flatMap((id) => {
    const choice = byId.get(id);
    return choice ? [choice] : [];
  });
  const rules = listRules(db);
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));
  const suggested = items.filter((item) => item.categoryId).length;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Categorize</p>
          <h1>Review</h1>
          <p className="lede">
            Confirm the suggestion, change it, or skip. Saving a rule teaches the next import.
          </p>
        </div>
        {suggested > 0 ? (
          <form action={acceptSuggestedAction}>
            <button className="primary" type="submit">
              Accept {suggested} suggested
            </button>
          </form>
        ) : null}
      </header>
      <Banner notice={one(params.notice)} error={one(params.error)} />
      <ReviewQueue items={items} choices={choices} recent={recent} />

      <section className="split" style={{ marginTop: 28 }}>
        <div className="card">
          <h2>Rules</h2>
          <p className="small muted">Starter rules are editable. Delete any that get in the way.</p>
          {rules.map((rule) => (
            <div className="account-row" key={rule.id}>
              <div>
                <strong>{rule.pattern}</strong>
                <div className="small muted">{categoryName.get(rule.categoryId) ?? "Category"}</div>
              </div>
              <form action={deleteRuleAction}>
                <input type="hidden" name="id" value={rule.id} />
                <button type="submit">Remove</button>
              </form>
            </div>
          ))}
        </div>
        <form action={addCategoryAction} className="card stack">
          <h2>New category</h2>
          <label>
            Name
            <input name="name" required />
          </label>
          <label>
            Kind
            <select name="kind" defaultValue="expense">
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="transfer">Transfer</option>
            </select>
          </label>
          <label>
            Parent
            <select name="parentId" defaultValue="">
              <option value="">None</option>
              {categories
                .filter((category) => !category.parentId)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </select>
          </label>
          <button className="primary" type="submit">
            Add category
          </button>
        </form>
      </section>
    </>
  );
}
