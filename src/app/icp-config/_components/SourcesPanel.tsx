"use client";

import { createSourceAction, scanSourceAction, toggleSourceAction } from "../actions";

export interface SourceView {
  id: string;
  kind: string;
  name: string;
  query: string;
  enabled: boolean;
}

// Source management: list, enable/disable, scan, and create. Each control is a plain
// Server-Action <form> (no client state) - the action mutates and revalidates the route.
export function SourcesPanel({ sources }: { sources: SourceView[] }) {
  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold">Signal sources</h2>
        {sources.length === 0 ? (
          <p className="text-sm text-zinc-500">No sources yet. Add one below.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {sources.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{s.name || s.kind}</span>
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800">
                      {s.kind}
                    </span>
                    {!s.enabled ? (
                      <span className="text-[11px] text-zinc-400">disabled</span>
                    ) : null}
                  </div>
                  {s.query ? (
                    <p className="mt-0.5 truncate text-xs text-zinc-500">{s.query}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <form action={toggleSourceAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="enabled" value={(!s.enabled).toString()} />
                    <button
                      type="submit"
                      className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400"
                    >
                      {s.enabled ? "Disable" : "Enable"}
                    </button>
                  </form>
                  <form action={scanSourceAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <button
                      type="submit"
                      disabled={!s.enabled}
                      className="rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
                    >
                      Scan now
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-1 text-sm font-semibold">Add a source</h2>
        <p className="mb-3 text-xs text-zinc-500">
          Only the demo `fixture` connector is wired today; LinkedIn and X light up with the
          source-adapters change.
        </p>
        <form action={createSourceAction} className="grid gap-3 sm:grid-cols-2">
          <input
            name="name"
            placeholder="Name (e.g. LinkedIn: hiring posts)"
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <select
            name="kind"
            defaultValue="fixture"
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="fixture">fixture (demo)</option>
            <option value="linkedin-search" disabled>
              linkedin-search (adapter pending)
            </option>
            <option value="x-posts" disabled>
              x-posts (adapter pending)
            </option>
          </select>
          <input
            name="query"
            placeholder="Query"
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 sm:col-span-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Add source
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
