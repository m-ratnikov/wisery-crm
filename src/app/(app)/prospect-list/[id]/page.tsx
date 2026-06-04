import Link from "next/link";
import { notFound } from "next/navigation";
import { getProspectDetail } from "@/lib/prospect/read";
import { enrichAction, regenerateDraftAction } from "../actions";

// Prospect detail (prospect-list): score reasoning, the selected draft, and the dossier
// (ADR-0008: enriched/drafted are the related rows, shown here). Enrich and regenerate act
// on this prospect. Server Component; params is async in Next 16.
export default async function ProspectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getProspectDetail(id);
  if (!detail) notFound();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-2xl px-8 py-10">
        <Link href="/prospect-list" className="text-sm text-zinc-500 hover:underline">
          &larr; All prospects
        </Link>
        <header className="mt-3 mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{detail.name}</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {detail.status} &middot; score {detail.score ?? "-"}
            </p>
          </div>
          <div className="flex gap-2">
            <form action={enrichAction}>
              <input type="hidden" name="id" value={detail.id} />
              <button
                type="submit"
                className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm dark:border-zinc-700"
              >
                Enrich
              </button>
            </form>
            <form action={regenerateDraftAction}>
              <input type="hidden" name="id" value={detail.id} />
              <button
                type="submit"
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                Regenerate draft
              </button>
            </form>
          </div>
        </header>

        <Section title="Why this score">
          <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            {detail.reason ?? "Not scored yet."}
          </p>
          {detail.summary ? <p className="mt-2 text-xs text-zinc-500">{detail.summary}</p> : null}
        </Section>

        <Section title="Selected draft">
          {detail.draft ? (
            <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-300">
              {detail.draft}
            </p>
          ) : (
            <p className="text-sm text-zinc-500">No draft yet.</p>
          )}
        </Section>

        <Section title="Dossier">
          {detail.dossier !== null && detail.dossier !== undefined ? (
            <pre className="overflow-x-auto rounded-md bg-zinc-100 p-3 text-xs dark:bg-zinc-900">
              {JSON.stringify(detail.dossier, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-zinc-500">Not enriched. Use Enrich to build a dossier.</p>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}
