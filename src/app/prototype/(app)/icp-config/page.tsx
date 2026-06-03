"use client";

// Anchor view #1 mockup - the config screen. Client component on purpose: tab
// switching and inline editing are local UI state, and state is lifted here so
// edits survive moving between tabs. The product's discipline is that the ICP
// rubric, the user profile, and the sources all live as data the engine reads
// (config-as-data, D1/D6), never hardcoded - this screen is where you edit it.

import { useState } from "react";
import {
  profile as seedProfile,
  rubric as seedRubric,
  sources as seedSources,
  type Rubric,
  type SourceConfig,
  type UserProfile,
} from "../_data/icp-config";
import { RubricEditor } from "./_components/RubricEditor";
import { ProfileEditor } from "./_components/ProfileEditor";
import { SourceManager } from "./_components/SourceManager";

type Tab = "rubric" | "profile" | "sources";

const tabs: { id: Tab; label: string }[] = [
  { id: "rubric", label: "ICP rubric" },
  { id: "profile", label: "User profile" },
  { id: "sources", label: "Sources" },
];

export default function IcpConfigPage() {
  const [tab, setTab] = useState<Tab>("rubric");
  const [rubric, setRubric] = useState<Rubric>(seedRubric);
  const [profile, setProfile] = useState<UserProfile>(seedProfile);
  const [sources, setSources] = useState<SourceConfig[]>(seedSources);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="border-b border-zinc-200 bg-white px-8 pt-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-lg font-semibold tracking-tight">ICP &amp; source config</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Everything personal to you lives here as data the engine reads (D1, D6), never hardcoded
          in a prompt. This is the one discipline kept now so the product works for other users
          later.
        </p>
        <nav className="mt-4 flex gap-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                tab === item.id
                  ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                  : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex-1 overflow-y-auto bg-zinc-50 px-8 py-6 dark:bg-zinc-950">
        <div className="mx-auto max-w-3xl">
          {tab === "rubric" && <RubricEditor value={rubric} onChange={setRubric} />}
          {tab === "profile" && <ProfileEditor value={profile} onChange={setProfile} />}
          {tab === "sources" && <SourceManager sources={sources} setSources={setSources} />}
        </div>
      </div>
    </div>
  );
}
