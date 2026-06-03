import "server-only";
import type { InferSelectModel } from "drizzle-orm";
import { z } from "zod";
import { scans, signalKind, signals, sources } from "@/lib/db/schema";

// The D4 connector contract (normalize-at-the-edge, ADR-0004). This is the port a
// source type implements; concrete connectors live under ./connectors and are wired
// only by ./registry (D-I, D-M). This module MUST NOT import any concrete connector.

// Row types inferred from the schema so the contract and the data layer never drift.
export type SourceRow = InferSelectModel<typeof sources>;
export type ScanRow = InferSelectModel<typeof scans>;
export type SignalRow = InferSelectModel<typeof signals>;
export type SignalKind = (typeof signalKind.enumValues)[number];

// A normalized item a connector yields. Transient DTO only - never a table (D-A).
// `scan` returns an AsyncIterable so a connector pages lazily and the pipeline dedups
// incrementally rather than buffering a whole source in memory (D-J).
export interface SignalSource {
  readonly kind: string; // matches sources.kind
  scan(source: SourceRow): AsyncIterable<RawItem>;
}

// The pipeline applies this at the edge before insert (D-E/D-J): kind in the closed
// set, a non-empty dedup key, payload passthrough (the DB does not validate JSONB).
export const rawItemSchema = z.object({
  kind: z.enum(signalKind.enumValues),
  dedupKey: z.string().min(1),
  payload: z.unknown(),
});

export type RawItem = z.infer<typeof rawItemSchema>;
