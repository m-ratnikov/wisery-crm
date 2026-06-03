import type { Rubric } from "../../_data/icp-config";
import { ScoreBadge } from "../../_components/ScoreBadge";
import { ConfigSection } from "./ConfigSection";
import { EditableList } from "./EditableList";
import { SaveButton } from "./SaveButton";

// The ICP rubric as editable data (D6) - what the qualifier scores against. In
// job-monitor this lived in a hardcoded ICP_SYSTEM_PROMPT; here it is config.
export function RubricEditor({
  value,
  onChange,
}: {
  value: Rubric;
  onChange: (rubric: Rubric) => void;
}) {
  const set = (patch: Partial<Rubric>) => onChange({ ...value, ...patch });
  const setBand = (score: number, criteria: string) =>
    set({
      bands: value.bands.map((band) => (band.score === score ? { ...band, criteria } : band)),
    });

  return (
    <div className="space-y-5">
      <ConfigSection
        title="Rubric"
        description={value.platformNote}
        action={
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              {value.active ? "Active" : "Inactive"} &middot; v{value.version}
            </span>
            <SaveButton />
          </div>
        }
      >
        <input
          value={value.name}
          onChange={(event) => set({ name: event.target.value })}
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
        />
        <p className="mt-2 text-xs leading-5 text-zinc-500">
          Editing the rubric creates a new version. Past scores keep the version they were taken
          against, so the bar stays tunable without rewriting history.
        </p>
      </ConfigSection>

      <ConfigSection title="Ideal titles">
        <EditableList
          items={value.idealTitles}
          onChange={(idealTitles) => set({ idealTitles })}
          placeholder="A buyer-level title"
        />
      </ConfigSection>

      <ConfigSection title="Ideal company stage / size">
        <EditableList
          items={value.idealStages}
          onChange={(idealStages) => set({ idealStages })}
          placeholder="A stage or size band"
        />
      </ConfigSection>

      <ConfigSection title="Positive signals" description="What pushes a score up.">
        <EditableList
          items={value.positiveSignals}
          onChange={(positiveSignals) => set({ positiveSignals })}
          placeholder="A buying or intent signal"
        />
      </ConfigSection>

      <ConfigSection title="Disqualifiers" description="What forces a low score.">
        <EditableList
          items={value.disqualifiers}
          onChange={(disqualifiers) => set({ disqualifiers })}
          placeholder="A disqualifying trait"
        />
      </ConfigSection>

      <ConfigSection title="Score bands (1 to 5)" description="The bar is 3+. 1 and 2 stay silent.">
        <div className="space-y-3">
          {value.bands.map((band) => (
            <div key={band.score} className="flex gap-3">
              <ScoreBadge score={band.score} />
              <textarea
                value={band.criteria}
                rows={2}
                onChange={(event) => setBand(band.score, event.target.value)}
                className="flex-1 resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
              />
            </div>
          ))}
        </div>
      </ConfigSection>

      <ConfigSection
        title="Insufficient-data guard"
        description="The anti-hallucination rule: score -1 instead of guessing on thin data."
      >
        <textarea
          value={value.insufficientDataRule}
          rows={2}
          onChange={(event) => set({ insufficientDataRule: event.target.value })}
          className="w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
        />
      </ConfigSection>
    </div>
  );
}
