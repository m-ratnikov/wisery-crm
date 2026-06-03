// Shared scalar/domain types for the prototype screens. They mirror the canonical
// domain-model.md nouns (Score, SourceKind, Prospect.status) but are hand-typed
// here on purpose - the prototype never imports src/lib, so the look transfers
// without coupling. Extracted into a shared module once a second and third screen
// needed the same types (rule of three; README convention 3).

export type Score = 1 | 2 | 3 | 4 | 5;

// -1 is the anti-hallucination "insufficient data" sentinel (domain-model SCORING).
export type ScoreOrInsufficient = Score | -1;

export type SourceKind = "linkedin-search" | "x-posts" | "csv-companies" | "news";

// The Prospect disposition (domain-model.md state machine, ADR-0008): one
// mutually-exclusive category. In the real schema this is text + a Zod enum,
// because a lifecycle is the most churn-prone set. "scored" is dropped (the gate
// goes straight to qualified/below_bar); "enriched"/"drafted" are NOT statuses -
// they are derived facets (a Dossier / a selected Draft exists), modeled as the
// `enriched`/`drafted` booleans on a prospect, because they are orthogonal to
// disposition and can co-occur.
export type ProspectStatus =
  | "new"
  | "below_bar"
  | "qualified"
  | "queued"
  | "acted"
  | "dismissed"
  | "closed";
