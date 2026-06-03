"use client";

import { useState } from "react";
import type { RubricCriteria } from "@/lib/icp/schema";
import { saveRubricAction } from "../actions";
import { EditableList } from "./EditableList";
import { SaveBar } from "./SaveBar";

// The ICP rubric as editable config-as-data (D6) - what the qualifier scores against. The
// edited criteria serialize to a hidden JSON field; the Server Action validates it with
// rubricCriteriaSchema and persists a new version (additive, never overwriting).
export function RubricForm({
  initialName,
  initialVersion,
  initialCriteria,
}: {
  initialName: string;
  initialVersion: number;
  initialCriteria: RubricCriteria;
}) {
  const [name, setName] = useState(initialName);
  const [criteria, setCriteria] = useState<RubricCriteria>(initialCriteria);
  const set = (patch: Partial<RubricCriteria>) => setCriteria((c) => ({ ...c, ...patch }));

  return (
    <form action={saveRubricAction} className="space-y-5">
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="criteria" value={JSON.stringify(criteria)} />

      <Section
        title="Rubric"
        description="Editing creates a new version; past scores keep the version they were taken against."
        aside={`Active · v${initialVersion}`}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
        />
      </Section>

      <Section title="Ideal titles">
        <EditableList
          items={criteria.idealTitles}
          onChange={(idealTitles) => set({ idealTitles })}
          placeholder="A buyer-level title"
        />
      </Section>

      <Section title="Ideal company stage / size">
        <EditableList
          items={criteria.idealStages}
          onChange={(idealStages) => set({ idealStages })}
          placeholder="A stage or size band"
        />
      </Section>

      <Section title="Positive signals" description="What pushes a score up.">
        <EditableList
          items={criteria.positiveSignals}
          onChange={(positiveSignals) => set({ positiveSignals })}
          placeholder="A buying or intent signal"
        />
      </Section>

      <Section title="Disqualifiers" description="What forces a low score.">
        <EditableList
          items={criteria.disqualifiers}
          onChange={(disqualifiers) => set({ disqualifiers })}
          placeholder="A disqualifying trait"
        />
      </Section>

      <Section title="Score bands (1 to 5)" description="The bar is 3+. 1 and 2 stay silent.">
        <div className="space-y-3">
          {criteria.bands.map((band, i) => (
            <div key={band.score} className="flex gap-3">
              <span className="mt-2 w-6 shrink-0 text-center text-sm font-semibold text-zinc-500">
                {band.score}
              </span>
              <textarea
                value={band.criteria}
                rows={2}
                onChange={(e) =>
                  set({
                    bands: criteria.bands.map((b, j) =>
                      j === i ? { ...b, criteria: e.target.value } : b,
                    ),
                  })
                }
                className="flex-1 resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
              />
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Insufficient-data guard"
        description="Anti-hallucination: score -1 instead of guessing on thin data."
      >
        <textarea
          value={criteria.insufficientDataRule}
          rows={2}
          onChange={(e) => set({ insufficientDataRule: e.target.value })}
          className="w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
        />
      </Section>

      <Section title="Platform note">
        <textarea
          value={criteria.platformNote}
          rows={2}
          onChange={(e) => set({ platformNote: e.target.value })}
          className="w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
        />
      </Section>

      <SaveBar label="Save rubric (new version)" />
    </form>
  );
}

function Section({
  title,
  description,
  aside,
  children,
}: {
  title: string;
  description?: string;
  aside?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-zinc-500">{description}</p> : null}
        </div>
        {aside ? (
          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            {aside}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}
