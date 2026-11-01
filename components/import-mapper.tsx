"use client";

import { useMemo, useState } from "react";
import { importMappedFile } from "@/app/actions";
import { parseMappedRow } from "@/lib/csv";
import { guessColumns } from "@/lib/csv-guess";
import { formatMoney } from "@/lib/money";
import type { Account, Profile } from "@/lib/types";

export function ImportMapper({
  relativePath,
  headers,
  preview,
  accounts,
  profile,
  accountId,
}: {
  relativePath: string;
  headers: string[];
  preview: Record<string, string>[];
  accounts: Account[];
  profile: Profile | null;
  accountId: string | null;
}) {
  const guess = guessColumns(headers);
  const [mode, setMode] = useState<"signed" | "split">(
    profile ? (profile.amountColumn ? "signed" : "split") : guess.mode,
  );
  const [dateColumn, setDateColumn] = useState(profile?.dateColumn || guess.dateColumn);
  const [descriptionColumn, setDescriptionColumn] = useState(
    profile?.descriptionColumn || guess.descriptionColumn,
  );
  const [amountColumn, setAmountColumn] = useState(profile?.amountColumn || guess.amountColumn);
  const [debitColumn, setDebitColumn] = useState(profile?.debitColumn || guess.debitColumn);
  const [creditColumn, setCreditColumn] = useState(profile?.creditColumn || guess.creditColumn);
  const [balanceColumn, setBalanceColumn] = useState(profile?.balanceColumn || guess.balanceColumn);
  const [flipSign, setFlipSign] = useState(profile?.flipSign ?? false);

  const parsed = useMemo(
    () =>
      preview.map((row) =>
        parseMappedRow(row, {
          dateColumn,
          descriptionColumn,
          amountColumn: mode === "signed" ? amountColumn : null,
          debitColumn: mode === "split" ? debitColumn : null,
          creditColumn: mode === "split" ? creditColumn : null,
          balanceColumn: balanceColumn || null,
          flipSign,
        }),
      ),
    [
      preview,
      dateColumn,
      descriptionColumn,
      amountColumn,
      debitColumn,
      creditColumn,
      balanceColumn,
      flipSign,
      mode,
    ],
  );

  return (
    <form action={importMappedFile} className="card stack">
      <div>
        <p className="eyebrow">Column mapping</p>
        <h2 style={{ marginBottom: 4 }}>{relativePath}</h2>
        <p className="muted small">
          This shape is saved and reused the next time a file has the same headers. Outflows should
          end up negative.
        </p>
      </div>
      <input type="hidden" name="relativePath" value={relativePath} />
      <input type="hidden" name="amountMode" value={mode} />
      <div className="filters">
        <label>
          Account
          <select name="accountId" defaultValue={accountId ?? ""} required>
            <option value="">Choose</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Profile name
          <input name="profileName" defaultValue={profile?.name ?? ""} placeholder="Chase checking" />
        </label>
        <label>
          Amount style
          <select value={mode} onChange={(event) => setMode(event.target.value as "signed" | "split")}>
            <option value="signed">One signed amount column</option>
            <option value="split">Separate debit and credit</option>
          </select>
        </label>
      </div>
      <div className="filters">
        <ColumnSelect label="Date" name="dateColumn" headers={headers} value={dateColumn} onChange={setDateColumn} />
        <ColumnSelect
          label="Description"
          name="descriptionColumn"
          headers={headers}
          value={descriptionColumn}
          onChange={setDescriptionColumn}
        />
        {mode === "signed" ? (
          <ColumnSelect
            label="Amount"
            name="amountColumn"
            headers={headers}
            value={amountColumn}
            onChange={setAmountColumn}
          />
        ) : (
          <>
            <ColumnSelect
              label="Debit"
              name="debitColumn"
              headers={headers}
              value={debitColumn}
              onChange={setDebitColumn}
            />
            <ColumnSelect
              label="Credit"
              name="creditColumn"
              headers={headers}
              value={creditColumn}
              onChange={setCreditColumn}
            />
          </>
        )}
        <ColumnSelect
          label="Balance"
          name="balanceColumn"
          headers={headers}
          value={balanceColumn}
          onChange={setBalanceColumn}
          optional
        />
      </div>
      <label className="check">
        <input
          type="checkbox"
          name="flipSign"
          checked={flipSign}
          onChange={(event) => setFlipSign(event.target.checked)}
        />
        Charges are positive in this file (flip the sign). Typical for credit cards.
      </label>
      {!balanceColumn ? (
        <label>
          Statement ending balance
          <input name="endingBalance" inputMode="decimal" placeholder="0.00" />
          <span>Leave blank if the statement does not show one. Credit cards: amount owed, as a positive number.</span>
        </label>
      ) : (
        <p className="small muted">Ending balance will be taken from the last row in the balance column.</p>
      )}
      <div>
        <h3>Preview</h3>
        <table className="sheet">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {parsed.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td>{row?.postedOn ?? "—"}</td>
                <td>{row?.description ?? "Unreadable row"}</td>
                <td className="num">{row ? formatMoney(row.amountCents) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <button className="primary" type="submit">
          Save mapping and import
        </button>
      </div>
    </form>
  );
}

function ColumnSelect({
  label,
  name,
  headers,
  value,
  onChange,
  optional = false,
}: {
  label: string;
  name: string;
  headers: string[];
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
}) {
  return (
    <label>
      {label}
      <select name={name} value={value} onChange={(event) => onChange(event.target.value)}>
        {optional ? <option value="">None</option> : null}
        {headers.map((header) => (
          <option key={header} value={header}>
            {header}
          </option>
        ))}
      </select>
    </label>
  );
}
