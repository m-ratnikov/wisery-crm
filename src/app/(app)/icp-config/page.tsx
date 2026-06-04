import type { Metadata } from "next";
import { getActiveRubric, getUserProfile } from "@/lib/icp/config";
import { listSources } from "@/lib/signals/sources";
import { listConnectableKinds } from "@/lib/signals/source-kinds";
import { seedStarterAction } from "./actions";
import { IcpConfigTabs } from "./_components/IcpConfigTabs";
import type { SourceView } from "./_components/SourcesPanel";

// Anchor view #1, wired (icp-config). The config screen graduated from the prototype to a
// Server Component reading live config-as-data, with Server Actions for edits. Everything
// personal to the user lives here as data the engine reads (D1, D6), never hardcoded.
//
// D1: authorization is deferred (single-user MVP). The Server Actions invoked from here are
// unauthenticated by design; auth attaches at the productization milestone (see actions.ts).

export const metadata: Metadata = {
  title: "ICP & source config - Wisery CRM",
};

export default async function IcpConfigPage() {
  const [rubric, profile, sourceRows] = await Promise.all([
    getActiveRubric(),
    getUserProfile(),
    listSources(),
  ]);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-3xl px-8 py-10">
        <header className="mb-6">
          <h1 className="text-lg font-semibold tracking-tight">ICP &amp; source config</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Your ICP rubric, profile, and sources live here as data the engine reads (D1, D6), never
            hardcoded in a prompt.
          </p>
        </header>

        {!rubric || !profile ? (
          <section className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold">No configuration yet</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
              Load the starter fractional-CTO ICP and profile so the pipeline has something to score
              against. You can edit everything afterwards.
            </p>
            <form action={seedStarterAction} className="mt-4">
              <button
                type="submit"
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
              >
                Load starter ICP
              </button>
            </form>
          </section>
        ) : (
          <IcpConfigTabs
            rubricName={rubric.name}
            rubricVersion={rubric.version}
            rubricCriteria={rubric.criteria}
            profileVersion={profile.version}
            profile={profile.profile}
            sources={toSourceViews(sourceRows)}
            connectableKinds={listConnectableKinds()}
          />
        )}
      </div>
    </div>
  );
}

function toSourceViews(rows: Awaited<ReturnType<typeof listSources>>): SourceView[] {
  return rows.map((s) => ({
    id: s.id,
    kind: s.kind,
    name: typeof s.config.name === "string" ? s.config.name : "",
    query: typeof s.config.query === "string" ? s.config.query : "",
    enabled: s.enabled,
    // Full config so the edit form can prefill the kind's declared fields.
    config: s.config,
  }));
}
