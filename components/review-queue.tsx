"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmTransaction, skipTransactionAction } from "@/app/actions";
import { formatDay } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { TransactionRow } from "@/lib/types";

type Choice = { id: string; label: string };

export function ReviewQueue({
  items,
  choices,
  recent,
}: {
  items: TransactionRow[];
  choices: Choice[];
  recent: Choice[];
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<{ id: string; categoryId: string; saveRule: boolean } | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const safeIndex = items.length === 0 ? 0 : Math.min(index, items.length - 1);
  const current = items[safeIndex];
  const categoryId =
    current && draft?.id === current.id ? draft.categoryId : (current?.categoryId ?? "");
  const saveRule = current && draft?.id === current.id ? draft.saveRule : false;

  useEffect(() => {
    itemRefs.current[safeIndex]?.scrollIntoView({ block: "nearest" });
  }, [safeIndex, current?.id]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (pending || !current) return;

      if (event.key === "j" || event.key === "ArrowDown") {
        event.preventDefault();
        setIndex(Math.min(items.length - 1, safeIndex + 1));
      } else if (event.key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        setIndex(Math.max(0, safeIndex - 1));
      } else if (event.key === "Enter") {
        event.preventDefault();
        submit(categoryId, saveRule);
      } else if (event.key === "s") {
        event.preventDefault();
        skip();
      } else if (/^[1-9]$/.test(event.key)) {
        const pick = recent[Number(event.key) - 1];
        if (pick) chooseCategory(pick.id);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);

    function chooseCategory(nextCategory: string) {
      if (!current) return;
      setDraft({ id: current.id, categoryId: nextCategory, saveRule });
      setError("");
    }

    function submit(nextCategory: string, remember: boolean) {
      if (!current) return;
      if (!nextCategory) {
        setError("Pick a category first.");
        return;
      }
      const formData = new FormData();
      formData.set("id", current.id);
      formData.set("categoryId", nextCategory);
      if (remember) formData.set("saveRule", "true");
      startTransition(async () => {
        const result = await confirmTransaction(formData);
        if (result && !result.ok) {
          setError(result.error);
          return;
        }
        setError("");
        router.refresh();
      });
    }

    function skip() {
      if (!current) return;
      const formData = new FormData();
      formData.set("id", current.id);
      startTransition(async () => {
        await skipTransactionAction(formData);
        router.refresh();
      });
    }
  }, [categoryId, current, items.length, pending, recent, router, safeIndex, saveRule]);

  if (!current) {
    return (
      <section className="card">
        <h2>Nothing waiting</h2>
        <p className="muted">
          Import a statement and new merchants land here. Rules and places you have already
          categorized come in with a suggestion, so Enter is enough.
        </p>
      </section>
    );
  }

  const suggestion =
    current.suggestionSource === "rule"
      ? "Suggested by a rule"
      : current.suggestionSource === "memory"
        ? "Suggested from the last time you categorized this merchant"
        : "No suggestion yet";

  function chooseCategory(nextCategory: string) {
    setDraft({ id: current.id, categoryId: nextCategory, saveRule });
    setError("");
  }

  function submit(nextCategory: string, remember: boolean) {
    if (!nextCategory) {
      setError("Pick a category first.");
      return;
    }
    const formData = new FormData();
    formData.set("id", current.id);
    formData.set("categoryId", nextCategory);
    if (remember) formData.set("saveRule", "true");
    startTransition(async () => {
      const result = await confirmTransaction(formData);
      if (result && !result.ok) {
        setError(result.error);
        return;
      }
      setError("");
      router.refresh();
    });
  }

  return (
    <div className="review">
      <div className="review-list" role="listbox" aria-label="Unreviewed transactions">
        {items.map((item, itemIndex) => (
          <button
            key={item.id}
            type="button"
            className={itemIndex === safeIndex ? "active" : undefined}
            ref={(node) => {
              itemRefs.current[itemIndex] = node;
            }}
            onClick={() => setIndex(itemIndex)}
          >
            <strong>{item.merchant}</strong>
            <div className="small muted">
              {formatDay(item.postedOn)} · {formatMoney(item.amountCents)}
            </div>
          </button>
        ))}
      </div>
      <section className="card review-card">
        <p className="eyebrow">
          {safeIndex + 1} of {items.length} · {current.accountName}
        </p>
        <h2 className="merchant">{current.merchant}</h2>
        <p className="muted">{current.description}</p>
        <p className="stat">
          <span className={current.amountCents < 0 ? "money money-neg" : "money money-pos"}>
            {formatMoney(current.amountCents)}
          </span>
        </p>
        <p className="small">{formatDay(current.postedOn)}</p>
        <p className="pill">{suggestion}</p>
        <div className="stack" style={{ marginTop: 16 }}>
          <label>
            Category
            <select value={categoryId} onChange={(event) => chooseCategory(event.target.value)}>
              <option value="">Choose</option>
              {choices.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.label}
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={saveRule}
              onChange={(event) =>
                setDraft({ id: current.id, categoryId, saveRule: event.target.checked })
              }
            />
            Always apply this to {current.merchant}
          </label>
          {error ? <p className="banner banner-error">{error}</p> : null}
          <div className="row-actions">
            <button
              type="button"
              className="primary"
              disabled={pending}
              onClick={() => submit(categoryId, saveRule)}
            >
              Confirm
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                const formData = new FormData();
                formData.set("id", current.id);
                startTransition(async () => {
                  await skipTransactionAction(formData);
                  router.refresh();
                });
              }}
            >
              Skip
            </button>
          </div>
          <div className="keys">
            {recent.map((choice, choiceIndex) => (
              <button key={choice.id} type="button" onClick={() => chooseCategory(choice.id)}>
                <span className="kbd">{choiceIndex + 1}</span> {choice.label}
              </button>
            ))}
          </div>
          <p className="small muted">
            <span className="kbd">j</span> <span className="kbd">k</span> move ·{" "}
            <span className="kbd">enter</span> confirms · <span className="kbd">s</span> skips ·
            number keys pick a category
          </p>
        </div>
      </section>
    </div>
  );
}
