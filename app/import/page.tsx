import Link from "next/link";
import { Suspense } from "react";
import { importReadyAction, loadSampleAction } from "@/app/actions";
import { Banner } from "@/components/banner";
import { ImportMapper } from "@/components/import-mapper";
import { database } from "@/lib/db";
import { live } from "@/lib/live";
import { one } from "@/lib/labels";
import { scanStatements } from "@/lib/importing";
import { getProfileBySignature, listAccounts } from "@/lib/repo";

export const metadata = { title: "Import" };

export default function ImportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="muted">Reading the statements folder…</p>}>
      <ImportScreen searchParams={searchParams} />
    </Suspense>
  );
}

async function ImportScreen({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await live();
  const params = await searchParams;
  const db = database();
  const files = scanStatements(db);
  const accounts = listAccounts(db);
  const selectedPath = one(params.file);
  const selected = files.find((file) => file.relativePath === selectedPath) ?? null;
  const profile = selected ? getProfileBySignature(db, selected.signature) : null;
  const ready = files.filter((file) => !file.imported && file.accountId && file.profileId).length;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Statements</p>
          <h1>Import</h1>
          <p className="lede">
            Put CSV downloads in a folder per account, for example statements/chase-checking/2026-06.csv.
            The same file, or the same charge in an overlapping download, is skipped.
          </p>
        </div>
      </header>
      <Banner notice={one(params.notice)} error={one(params.error)} />
      <div className="row-actions" style={{ marginBottom: 16 }}>
        <form action={loadSampleAction}>
          <button type="submit">Load sample statements</button>
        </form>
        <form action={importReadyAction}>
          <button className="primary" type="submit" disabled={ready === 0}>
            Import {ready} ready {ready === 1 ? "file" : "files"}
          </button>
        </form>
        {accounts.length === 0 ? <Link href="/accounts">Add an account first</Link> : null}
      </div>
      <section className="card" style={{ marginBottom: 16 }}>
        {files.length === 0 ? (
          <p className="muted">No CSV files in the statements folder yet.</p>
        ) : (
          <div className="file-list">
            {files.map((file) => {
              const status = file.imported
                ? "Imported"
                : file.accountId && file.profileId
                  ? "Ready"
                  : file.profileId
                    ? "Needs an account"
                    : "Needs a column mapping";
              return (
                <div className="file-row" key={file.relativePath}>
                  <div>
                    <strong>{file.relativePath}</strong>
                    <div className="small muted">{file.rowCount} rows</div>
                  </div>
                  <span className="pill">{status}</span>
                  {file.imported ? (
                    <span className="small muted">Stored</span>
                  ) : (
                    <Link href={`/import?file=${encodeURIComponent(file.relativePath)}`}>Map columns</Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
      {selected ? (
        <ImportMapper
          relativePath={selected.relativePath}
          headers={selected.headers}
          preview={selected.preview}
          accounts={accounts}
          profile={profile}
          accountId={selected.accountId}
        />
      ) : null}
    </>
  );
}
