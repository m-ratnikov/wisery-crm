import type { Metadata } from "next";
import { getSettings } from "@/lib/enrich/settings";
import { saveSettingsAction } from "./actions";

// The wired settings screen (app-shell): the app-wide home of the per-tenant settings row,
// starting with the auto-enrich flag (ADR-0007). prospect-list also exposes auto-enrich
// contextually; both write the one settings row through the single setAutoEnrich seam, so
// the authoritative representation stays single (config-as-data, D1).
//
// D1: authorization is deferred (single-user MVP); the Server Action is unauthenticated by design.

export const metadata: Metadata = {
  title: "Settings - Wisery CRM",
};

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-3xl px-8 py-10">
        <header className="mb-6">
          <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-zinc-500">
            App-wide settings, kept as data the engine reads (D1).
          </p>
        </header>

        <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold">Enrichment</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Deep enrichment is user-triggered by default (ADR-0007). Turn this on to enrich every
            qualified prospect automatically.
          </p>
          <form
            action={saveSettingsAction}
            className="mt-4 flex items-center justify-between gap-4"
          >
            <label htmlFor="autoEnrich" className="flex items-center gap-2 text-sm">
              <input
                id="autoEnrich"
                name="autoEnrich"
                type="checkbox"
                defaultChecked={settings.autoEnrich}
                className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
              />
              Auto-enrich qualified prospects
            </label>
            <button
              type="submit"
              className="shrink-0 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Save changes
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
