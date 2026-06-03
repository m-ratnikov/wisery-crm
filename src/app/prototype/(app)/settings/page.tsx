"use client";

// Settings (account + connected scrapers). Client component for the inline-edit and
// save gestures; nothing persists in the prototype. Connected scrapers are read-only
// in MVP (people-first: LinkedIn + X connect; company/content scrapers are V2) and
// become manageable in V2 - so this screen shows status, not controls.

import { useState } from "react";
import { account, scrapers, type ScraperStatus } from "../_data/settings";

const statusChip: Record<ScraperStatus, { label: string; className: string }> = {
  connected: {
    label: "Connected",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  "action-needed": {
    label: "Action needed",
    className: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  },
  v2: {
    label: "V2",
    className: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  },
};

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const save = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-10">
        <header>
          <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Your account and the scrapers Wisery uses to find people.
          </p>
        </header>

        <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Account</h2>
              <p className="mt-0.5 text-xs text-zinc-500">Minimal for MVP. More in V2.</p>
            </div>
            <button
              type="button"
              onClick={save}
              className="shrink-0 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {saved ? "Saved ✓" : "Save changes"}
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" defaultValue={account.name} />
            <Field label="Email" type="email" defaultValue={account.email} />
            <Field label="Company" defaultValue={account.company} />
            <Field label="Timezone" defaultValue={account.timezone} />
          </div>
        </section>

        <section className="mt-5 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Connected scrapers</h2>
            <span className="text-[11px] uppercase tracking-wide text-zinc-400">
              Read-only in MVP
            </span>
          </div>
          <p className="mb-4 text-xs text-zinc-500">
            People-first: LinkedIn and X find people directly. Company-list and news scrapers (which
            expand to people) arrive in V2.
          </p>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {scrapers.map((scraper) => {
              const chip = statusChip[scraper.status];
              return (
                <li key={scraper.id} className="flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{scraper.name}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${chip.className}`}
                      >
                        {chip.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs leading-5 text-zinc-500">{scraper.detail}</p>
                  </div>
                  <span className="shrink-0 cursor-not-allowed pt-0.5 text-xs text-zinc-300 dark:text-zinc-600">
                    Manage (V2)
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  type = "text",
  defaultValue,
}: {
  label: string;
  type?: string;
  defaultValue: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {label}
      </span>
      <input
        type={type}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
      />
    </label>
  );
}
