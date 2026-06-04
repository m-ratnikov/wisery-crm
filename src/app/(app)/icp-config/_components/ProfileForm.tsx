"use client";

import { useState } from "react";
import type { UserProfileData } from "@/lib/icp/schema";
import { saveProfileAction } from "../actions";
import { SaveBar } from "./SaveBar";

// The user profile as config-as-data - positioning, offer, voice, and case studies the
// drafter writes from. Serializes to a hidden JSON field validated by the Server Action.
export function ProfileForm({
  initialVersion,
  initialProfile,
}: {
  initialVersion: number;
  initialProfile: UserProfileData;
}) {
  const [profile, setProfile] = useState<UserProfileData>(initialProfile);
  const set = (patch: Partial<UserProfileData>) => setProfile((p) => ({ ...p, ...patch }));

  return (
    <form action={saveProfileAction} className="space-y-5">
      <input type="hidden" name="profile" value={JSON.stringify(profile)} />

      <Field label="Positioning" hint={`v${initialVersion}`}>
        <textarea
          value={profile.positioning}
          rows={3}
          onChange={(e) => set({ positioning: e.target.value })}
          className={textareaClass}
        />
      </Field>

      <Field label="Offer">
        <textarea
          value={profile.offer}
          rows={2}
          onChange={(e) => set({ offer: e.target.value })}
          className={textareaClass}
        />
      </Field>

      <Field label="Voice">
        <textarea
          value={profile.voice}
          rows={2}
          onChange={(e) => set({ voice: e.target.value })}
          className={textareaClass}
        />
      </Field>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Case studies</h2>
          <button
            type="button"
            onClick={() =>
              set({ caseStudies: [...profile.caseStudies, { title: "", result: "" }] })
            }
            className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            + Add
          </button>
        </div>
        <div className="space-y-3">
          {profile.caseStudies.map((cs, i) => (
            <div
              key={i}
              className="space-y-2 rounded-md border border-zinc-100 p-3 dark:border-zinc-800"
            >
              <input
                value={cs.title}
                placeholder="Title"
                onChange={(e) =>
                  set({
                    caseStudies: profile.caseStudies.map((c, j) =>
                      j === i ? { ...c, title: e.target.value } : c,
                    ),
                  })
                }
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
              />
              <textarea
                value={cs.result}
                rows={2}
                placeholder="Result"
                onChange={(e) =>
                  set({
                    caseStudies: profile.caseStudies.map((c, j) =>
                      j === i ? { ...c, result: e.target.value } : c,
                    ),
                  })
                }
                className={textareaClass}
              />
              <button
                type="button"
                onClick={() => set({ caseStudies: profile.caseStudies.filter((_, j) => j !== i) })}
                className="text-xs text-zinc-500 hover:text-red-600"
              >
                Remove case study
              </button>
            </div>
          ))}
        </div>
      </section>

      <SaveBar label="Save profile (new version)" />
    </form>
  );
}

const textareaClass =
  "w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{label}</h2>
        {hint ? <span className="text-[11px] text-zinc-400">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}
