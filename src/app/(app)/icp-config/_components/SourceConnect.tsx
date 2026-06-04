"use client";

import { useState } from "react";
import type { ConnectableKind, SourceField } from "@/lib/signals/source-kinds";
import { createSourceAction } from "../actions";

// Connect/configure a signal source (source-connection). Client component: the wizard holds
// multi-step local state (chosen kind, then its fields) before a single confirming submit;
// the field descriptors are passed in from the Server Component page (no Zod crosses the
// boundary - validation is server-authoritative in the action). Type-only imports of the
// catalog types are erased at build, so this client module never pulls in the server-only
// catalog at runtime.

const inputClass =
  "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950";

// Renders a kind's declared fields as inputs, optionally prefilled (edit). Shared by the
// connect wizard and the per-source edit form so the rendering lives in one place.
export function SourceFieldInputs({
  fields,
  values,
}: {
  fields: SourceField[];
  values?: Record<string, unknown>;
}) {
  return (
    <>
      {fields.map((f) => {
        const raw = values?.[f.name];
        const initial = typeof raw === "string" ? raw : "";
        return (
          <label key={f.name} className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              {f.label}
            </span>
            {f.type === "textarea" ? (
              <textarea
                name={f.name}
                defaultValue={initial}
                required={f.required}
                placeholder={f.placeholder}
                rows={3}
                className={inputClass}
              />
            ) : (
              <input
                name={f.name}
                defaultValue={initial}
                required={f.required}
                placeholder={f.placeholder}
                className={inputClass}
              />
            )}
          </label>
        );
      })}
    </>
  );
}

export function SourceWizard({ connectableKinds }: { connectableKinds: ConnectableKind[] }) {
  const [kind, setKind] = useState<string | null>(null);
  const selected = connectableKinds.find((k) => k.kind === kind) ?? null;

  if (connectableKinds.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No connectable source kinds yet - a kind appears here once its connector is registered.
      </p>
    );
  }

  // Step 1: choose a kind.
  if (!selected) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-zinc-500">Choose a source to connect.</p>
        <div className="flex flex-wrap gap-2">
          {connectableKinds.map((k) => (
            <button
              key={k.kind}
              type="button"
              onClick={() => setKind(k.kind)}
              className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Step 2: fill the chosen kind's settings and connect.
  return (
    <form action={createSourceAction} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="kind" value={selected.kind} />
      <div className="flex items-center justify-between sm:col-span-2">
        <span className="text-xs text-zinc-500">
          Connecting: <strong className="text-zinc-700 dark:text-zinc-300">{selected.label}</strong>
        </span>
        <button
          type="button"
          onClick={() => setKind(null)}
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          &larr; Back
        </button>
      </div>
      <SourceFieldInputs fields={selected.fields} />
      <div className="sm:col-span-2">
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Connect source
        </button>
      </div>
    </form>
  );
}
