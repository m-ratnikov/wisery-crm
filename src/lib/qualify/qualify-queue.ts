import "server-only";
import { enqueue, enqueueInTx, getBoss, work } from "@/lib/jobs";
import type { DbTx } from "@/lib/db";
import { qualifyProspect, qualifySignal } from "@/lib/qualify/pipeline";

// One qualify job per signal, over the generic jobs facade (mirrors the scan worker). The
// enqueue-on-persist wiring lives at the composition root (bootstrap), so signal-ingestion
// never imports this module - dependency direction stays qualify -> signals (D-G).
const QUALIFY_QUEUE = "qualify";
// The prospect-keyed entry (manual leads, ADR-0010, and re-qualify): qualify an existing
// prospect by id rather than creating one from a signal.
const QUALIFY_PROSPECT_QUEUE = "qualify-prospect";

// Enqueue qualification for a signal ON the caller's transaction - the scan's signal-insert
// transaction - so a newly persisted signal and its qualify job commit atomically (ADR-0009).
// The queue's `singleton` policy + `singletonKey` keep at most one active qualify job per
// signal; combined with the prospect-exists guard in qualifySignal, a duplicate or concurrent
// enqueue yields one prospect and one LLM call - without a DB unique on signal_id (ADR-0005).
export async function enqueueQualifyInTx(tx: DbTx, signalId: string): Promise<string | null> {
  return enqueueInTx(tx, QUALIFY_QUEUE, { signalId }, { singletonKey: signalId });
}

// Fire-and-forget enqueue of qualification for an existing prospect (a manual add, or a
// re-qualify). User-triggered, so per ADR-0009's carve-out it uses the plain facade `enqueue`
// (not in-transaction): failure surfaces to the user, who can re-trigger. The `singleton`
// policy + singletonKey keep at most one active qualify job per prospect; combined with the
// scored-already guard in qualifyProspect, a duplicate enqueue yields one score, one LLM call.
export async function enqueueQualifyProspect(personId: string): Promise<string | null> {
  return enqueue(QUALIFY_PROSPECT_QUEUE, { personId }, { singletonKey: personId });
}

// Enqueue qualification for a person ON the caller's transaction (universal-triage): triage
// approval creates the Person and enqueues its qualify job in one tx (ADR-0009), so an approved
// prospect is never stranded without its qualify handoff.
export async function enqueueQualifyProspectInTx(
  tx: DbTx,
  personId: string,
): Promise<string | null> {
  return enqueueInTx(tx, QUALIFY_PROSPECT_QUEUE, { personId }, { singletonKey: personId });
}

// The downstream handoff (enqueue drafting for qualified person, + enrichment when auto) is
// injected at the composition root as a transaction-aware callback, not imported here, so
// qualification never depends on drafting - the same seam as scan -> qualify (drafting D-E).
// `resolveHandoff` runs BEFORE qualifySignal opens its transaction, so any I/O the routing
// decision needs (reading the auto-enrich setting) happens outside the tx; the callback it
// returns does only enqueues, on the tx, keeping the transaction write-only (ADR-0009).
export interface QualifyWorkerOptions {
  resolveHandoff?: () => Promise<(tx: DbTx, qualifiedProspectIds: string[]) => Promise<void>>;
}

export async function registerQualifyWorker(options: QualifyWorkerOptions = {}): Promise<void> {
  // `singleton` policy makes `singletonKey` enforce one active qualify job per signal.
  await getBoss().createQueue(QUALIFY_QUEUE, { policy: "singleton" });
  await work<{ signalId: string }>(QUALIFY_QUEUE, async (jobs) => {
    // Let a handler error propagate so pg-boss retries a transient failure and dead-letters
    // genuine poison (ADR-0001 durability). At the default batchSize=1 there is no sibling
    // batch to isolate; a swallowing catch here would only suppress that retry.
    for (const job of jobs) {
      const enqueueNext = options.resolveHandoff ? await options.resolveHandoff() : undefined;
      await qualifySignal(job.data.signalId, { enqueueNext });
    }
  });
}

// The prospect-keyed qualify worker (manual leads / re-qualify). Same handoff as the
// signal-keyed worker (draft, + enrich when auto), so a qualified manual prospect reaches
// the queue identically.
export async function registerQualifyProspectWorker(
  options: QualifyWorkerOptions = {},
): Promise<void> {
  await getBoss().createQueue(QUALIFY_PROSPECT_QUEUE, { policy: "singleton" });
  await work<{ personId: string }>(QUALIFY_PROSPECT_QUEUE, async (jobs) => {
    for (const job of jobs) {
      const enqueueNext = options.resolveHandoff ? await options.resolveHandoff() : undefined;
      await qualifyProspect(job.data.personId, { enqueueNext });
    }
  });
}
