"use client";

import { useState } from "react";
import type { RubricCriteria, UserProfileData } from "@/lib/icp/schema";
import { ProfileForm } from "./ProfileForm";
import { RubricForm } from "./RubricForm";
import { SourcesPanel, type SourceView } from "./SourcesPanel";

type Tab = "rubric" | "profile" | "sources";

const TABS: { id: Tab; label: string }[] = [
  { id: "rubric", label: "ICP rubric" },
  { id: "profile", label: "User profile" },
  { id: "sources", label: "Sources" },
];

export function IcpConfigTabs({
  rubricName,
  rubricVersion,
  rubricCriteria,
  profileVersion,
  profile,
  sources,
}: {
  rubricName: string;
  rubricVersion: number;
  rubricCriteria: RubricCriteria;
  profileVersion: number;
  profile: UserProfileData;
  sources: SourceView[];
}) {
  const [tab, setTab] = useState<Tab>("rubric");

  return (
    <div>
      <nav className="mb-6 flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "rubric" && (
        <RubricForm
          initialName={rubricName}
          initialVersion={rubricVersion}
          initialCriteria={rubricCriteria}
        />
      )}
      {tab === "profile" && (
        <ProfileForm initialVersion={profileVersion} initialProfile={profile} />
      )}
      {tab === "sources" && <SourcesPanel sources={sources} />}
    </div>
  );
}
