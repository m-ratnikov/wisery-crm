"use client";

import { useState } from "react";
import type { ConnectableKind } from "@/lib/signals/source-kinds";
import { scanSourceAction, toggleSourceAction, updateSourceSettingsAction } from "../actions";
import { SourceFieldInputs, SourceWizard } from "./SourceConnect";

export interface SourceView {
  id: string;
  kind: string;
  name: string;
  query: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

// Source management (source-connection): list, enable/disable, scan, edit settings per kind,
// and connect a new source through the guided wizard. Enable/scan/edit are plain Server-Action
// <form>s; the editing-row toggle is the only local state.
export function SourcesPanel({
  sources,
  connectableKinds,
}: {
  sources: SourceView[];
  connectableKinds: ConnectableKind[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const defByKind = (kind: string) => connectableKinds.find((k) => k.kind === kind) ?? null;

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold">Signal sources</h2>
        {sources.length === 0 ? (
          <p className="text-sm text-zinc-500">No sources yet. Connect one below.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {sources.map((s) => {
              const def = defByKind(s.kind);
              const editing = editingId === s.id;
              return (
                <li key={s.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
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
                      {def ? (
                        <button
                          type="button"
                          onClick={() => setEditingId(editing ? null : s.id)}
                          className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400"
                        >
                          {editing ? "Close" : "Edit"}
                        </button>
                      ) : null}
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
                  </div>
                  {editing && def ? (
                    <form
                      action={updateSourceSettingsAction}
                      className="mt-3 grid gap-3 border-t border-zinc-100 pt-3 sm:grid-cols-2 dark:border-zinc-800"
                    >
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="kind" value={s.kind} />
                      <SourceFieldInputs fields={def.fields} values={s.config} />
                      <div className="sm:col-span-2">
                        <button
                          type="submit"
                          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
                        >
                          Save settings
                        </button>
                      </div>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold">Connect a source</h2>
        <SourceWizard connectableKinds={connectableKinds} />
      </section>
    </div>
  );
}
