import "server-only";
import { z } from "zod";
import type { RawItem, SignalSource, SourceRow } from "@/lib/signals/connector";

// A deterministic, no-network connector so the whole ingestion loop is integration-
// tested end to end against real Postgres (D-A goal). Real network adapters
// (LinkedIn search, X) are deferred to `source-adapters` (roadmap #4).

// Driven by source.config: an explicit item set, or the default below. `throwAfter`
// makes the connector raise mid-iteration to exercise per-source failure isolation.
const fixtureConfigSchema = z.object({
  // payload is optional here (unlike the RawItem contract) so a test can configure a
  // payload-less item and exercise the pipeline's edge-validation drop.
  items: z
    .array(z.object({ kind: z.string(), dedupKey: z.string(), payload: z.unknown().optional() }))
    .optional(),
  throwAfter: z.number().int().nonnegative().optional(),
});

// The default set deliberately exercises both drop paths in one scan: a repeated
// dedup key (intra-scan dedup drop, D-B) and an item with a blank dedup key
// (edge-validation drop, D-J). So a first scan is fetched 4 / persisted 2 / dropped 2.
const DEFAULT_ITEMS: RawItem[] = [
  { kind: "person", dedupKey: "fixture:alice", payload: { name: "Alice", headline: "VP Eng" } },
  { kind: "person", dedupKey: "fixture:bob", payload: { name: "Bob", headline: "Founder" } },
  { kind: "person", dedupKey: "fixture:alice", payload: { name: "Alice (duplicate)" } },
  { kind: "person", dedupKey: "", payload: { name: "missing dedup key" } },
];

export const fixtureConnector: SignalSource = {
  kind: "fixture",
  async *scan(source: SourceRow): AsyncIterable<RawItem> {
    const cfg = fixtureConfigSchema.parse(source.config ?? {});
    const items = cfg.items ?? DEFAULT_ITEMS;
    await Promise.resolve(); // a real connector awaits the network here; the fixture does not
    let yielded = 0;
    for (const item of items) {
      if (cfg.throwAfter !== undefined && yielded >= cfg.throwAfter) {
        throw new Error(`fixture: simulated connector failure after ${cfg.throwAfter} item(s)`);
      }
      yield item as RawItem;
      yielded++;
    }
  },
};
