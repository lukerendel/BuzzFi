import { Suspense } from "react";
import { addManualBalance, createAccountAction, updateAccountAction } from "@/app/actions";
import { Banner } from "@/components/banner";
import { formatDay } from "@/lib/dates";
import { database } from "@/lib/db";
import { live } from "@/lib/live";
import { accountTypeLabel, one } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { lastImportByAccount, latestSnapshots, listAccounts } from "@/lib/repo";
import { ACCOUNT_TYPES } from "@/lib/types";

export const metadata = { title: "Accounts" };

export default function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="muted">Loading accounts…</p>}>
      <AccountsScreen searchParams={searchParams} />
    </Suspense>
  );
}

async function AccountsScreen({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await live();
  const params = await searchParams;
  const db = database();
  const accounts = listAccounts(db);
  const snapshots = new Map(latestSnapshots(db).map((snapshot) => [snapshot.accountId, snapshot]));
  const imports = lastImportByAccount(db);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Accounts</p>
          <h1>Where the files belong</h1>
          <p className="lede">
            The folder name matches a directory inside statements. Chase files in statements/chase-checking use the slug chase-checking.
          </p>
        </div>
      </header>
      <Banner notice={one(params.notice)} error={one(params.error)} />
      <form action={createAccountAction} className="card filters" style={{ marginBottom: 16 }}>
        <label>
          Name
          <input name="name" required placeholder="Chase Checking" />
        </label>
        <label>
          Institution
          <input name="institution" placeholder="Chase" />
        </label>
        <label>
          Type
          <select name="type" defaultValue="checking">
            {ACCOUNT_TYPES.map((type) => (
              <option key={type} value={type}>
                {accountTypeLabel(type)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Statement folder
          <input name="folderSlug" placeholder="chase-checking" />
        </label>
        <button className="primary" type="submit">
          Add account
        </button>
      </form>
      <div className="stack">
        {accounts.map((account) => {
          const snapshot = snapshots.get(account.id);
          const imported = imports.get(account.id);
          return (
            <section className="card" key={account.id}>
              <div className="page-head" style={{ marginBottom: 8 }}>
                <div>
                  <h2 style={{ margin: 0 }}>{account.name}</h2>
                  <p className="small muted">
                    {accountTypeLabel(account.type)}
                    {snapshot ? ` · ${formatMoney(snapshot.balanceCents)} as of ${formatDay(snapshot.asOf)}` : " · no balance yet"}
                    {imported ? ` · last import ${formatDay(imported.slice(0, 10))}` : ""}
                  </p>
                </div>
              </div>
              <form action={updateAccountAction} className="filters">
                <input type="hidden" name="id" value={account.id} />
                <label>
                  Name
                  <input name="name" defaultValue={account.name} />
                </label>
                <label>
                  Institution
                  <input name="institution" defaultValue={account.institution} />
                </label>
                <label>
                  Type
                  <select name="type" defaultValue={account.type}>
                    {ACCOUNT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {accountTypeLabel(type)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Folder
                  <input name="folderSlug" defaultValue={account.folderSlug ?? ""} />
                </label>
                <button type="submit">Save</button>
              </form>
              <form action={addManualBalance} className="filters" style={{ marginTop: 12 }}>
                <input type="hidden" name="accountId" value={account.id} />
                <label>
                  As of
                  <input type="date" name="asOf" defaultValue={today} />
                </label>
                <label>
                  {account.type === "credit" ? "Amount owed" : "Balance"}
                  <input name="amount" inputMode="decimal" placeholder="0.00" />
                </label>
                <button type="submit">Save balance</button>
              </form>
            </section>
          );
        })}
      </div>
    </>
  );
}
