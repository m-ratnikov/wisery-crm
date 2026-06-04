import "server-only";
import type { SignalSource } from "@/lib/signals/connector";
import { fixtureConnector } from "@/lib/signals/connectors/fixture";
import { linkedinJobsConnector } from "@/lib/signals/connectors/linkedin-jobs-client";

// The single composition point that wires a source.kind to its connector (D-I, D-M).
// This is the ONLY module that imports concrete connectors; the port (connector.ts)
// and the pipeline reach adapters solely through here, enforced by dependency-cruiser.
const registry = new Map<string, SignalSource>([
  [fixtureConnector.kind, fixtureConnector],
  [linkedinJobsConnector.kind, linkedinJobsConnector],
]);

export function getConnector(kind: string): SignalSource {
  const connector = registry.get(kind);
  if (!connector) {
    throw new Error(`no connector registered for source kind "${kind}"`);
  }
  return connector;
}

// Whether a source kind has a registered connector. Callers that create sources use this
// to reject kinds whose adapter has not landed yet, so a scan is never enqueued for a
// connector that cannot run (today only "fixture" is registered).
export function isConnectorRegistered(kind: string): boolean {
  return registry.has(kind);
}

// The registered connector kinds. Lets the source-kind catalog assert it declares settings
// for every kind that can actually be scanned (no scannable kind without a wizard form).
export function registeredKinds(): string[] {
  return [...registry.keys()];
}
