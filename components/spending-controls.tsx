"use client";

import { useState } from "react";
import type { Account } from "@/lib/types";
import type { RangeView } from "@/lib/dates";

export function SpendingControls({
  view,
  month,
  year,
  quarter,
  from,
  to,
  compare,
  accountId,
  accounts,
}: {
  view: RangeView;
  month: string;
  year: number;
  quarter: number;
  from: string;
  to: string;
  compare: "previous" | "year";
  accountId: string;
  accounts: Account[];
}) {
  const [currentView, setCurrentView] = useState<RangeView>(view);

  return (
    <form className="filters" method="get">
      <label>
        Period
        <select
          name="view"
          value={currentView}
          onChange={(event) => setCurrentView(event.target.value as RangeView)}
        >
          <option value="month">Month</option>
          <option value="quarter">Quarter</option>
          <option value="year">Year</option>
          <option value="custom">Custom</option>
        </select>
      </label>
      {currentView === "month" ? (
        <label>
          Month
          <input type="month" name="month" defaultValue={month} />
        </label>
      ) : null}
      {currentView === "quarter" || currentView === "year" ? (
        <label>
          Year
          <input name="year" type="number" min={2000} max={2100} defaultValue={year} />
        </label>
      ) : null}
      {currentView === "quarter" ? (
        <label>
          Quarter
          <select name="quarter" defaultValue={String(quarter)}>
            <option value="1">Q1</option>
            <option value="2">Q2</option>
            <option value="3">Q3</option>
            <option value="4">Q4</option>
          </select>
        </label>
      ) : null}
      {currentView === "custom" ? (
        <>
          <label>
            From
            <input type="date" name="from" defaultValue={from} />
          </label>
          <label>
            To
            <input type="date" name="to" defaultValue={to} />
          </label>
        </>
      ) : null}
      <label>
        Compare with
        <select name="compare" defaultValue={compare}>
          <option value="previous">Previous period</option>
          <option value="year">A year earlier</option>
        </select>
      </label>
      <label>
        Account
        <select name="account" defaultValue={accountId}>
          <option value="">All accounts</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </label>
      <button className="primary" type="submit">
        Update
      </button>
    </form>
  );
}
