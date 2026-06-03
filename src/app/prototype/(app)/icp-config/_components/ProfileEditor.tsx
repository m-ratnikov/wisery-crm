import type { UserProfile } from "../../_data/icp-config";
import { ConfigSection } from "./ConfigSection";
import { SaveButton } from "./SaveButton";

// The user profile as config-as-data: positioning, offer, voice, and case studies
// the drafting step reads to personalize a first touch (D1, D6). Per-tenant later.
export function ProfileEditor({
  value,
  onChange,
}: {
  value: UserProfile;
  onChange: (profile: UserProfile) => void;
}) {
  const set = (patch: Partial<UserProfile>) => onChange({ ...value, ...patch });

  const setCase = (index: number, patch: Partial<UserProfile["caseStudies"][number]>) =>
    set({
      caseStudies: value.caseStudies.map((study, i) =>
        i === index ? { ...study, ...patch } : study,
      ),
    });
  const removeCase = (index: number) =>
    set({ caseStudies: value.caseStudies.filter((_, i) => i !== index) });
  const addCase = () => set({ caseStudies: [...value.caseStudies, { title: "", result: "" }] });

  return (
    <div className="space-y-5">
      <ConfigSection
        title="Positioning"
        description="Who you help and the moment you help them. The spine of every draft."
        action={<SaveButton />}
      >
        <textarea
          value={value.positioning}
          rows={3}
          onChange={(event) => set({ positioning: event.target.value })}
          className="w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
        />
      </ConfigSection>

      <ConfigSection title="Offer" description="The shape of the engagement.">
        <textarea
          value={value.offer}
          rows={2}
          onChange={(event) => set({ offer: event.target.value })}
          className="w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
        />
      </ConfigSection>

      <ConfigSection title="Voice" description="How drafts should sound. Tone, not template.">
        <textarea
          value={value.voice}
          rows={2}
          onChange={(event) => set({ voice: event.target.value })}
          className="w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
        />
      </ConfigSection>

      <ConfigSection
        title="Case studies"
        description="Proof the draft can reach for when it fits the prospect."
        action={
          <button
            type="button"
            onClick={addCase}
            className="shrink-0 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            + Add
          </button>
        }
      >
        <div className="space-y-3">
          {value.caseStudies.map((study, index) => (
            <div key={index} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <input
                  value={study.title}
                  placeholder="Title"
                  onChange={(event) => setCase(index, { title: event.target.value })}
                  className="flex-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm font-medium outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
                />
                <button
                  type="button"
                  onClick={() => removeCase(index)}
                  aria-label="Remove case study"
                  className="shrink-0 rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                  ✕
                </button>
              </div>
              <textarea
                value={study.result}
                rows={2}
                placeholder="The result"
                onChange={(event) => setCase(index, { result: event.target.value })}
                className="mt-2 w-full resize-y rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm leading-6 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
              />
            </div>
          ))}
        </div>
      </ConfigSection>
    </div>
  );
}
