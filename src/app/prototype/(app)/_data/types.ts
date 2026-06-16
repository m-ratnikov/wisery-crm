// Shared scalar/domain types for the prototype screens. They mirror the canonical
// domain-model.md nouns but are hand-typed here on purpose - the prototype never
// imports src/lib, so the look transfers without coupling. Extracted into a shared
// module once a second and third screen needed the same types (rule of three;
// README convention 3).
//
// This file tracks the engagement-rework model (ADR-0013..0022): a unified Queue,
// Person with a `type`, on-demand actions, configurable pipelines, and the
// Message/Post/Comment engagement artifacts. The old drafting-stage / 7-value
// ProspectStatus types are gone with the screens that used them; so are the
// person-keyed Scoring/Qualification types (ADR-0022: the signal advisory is
// the only score in the system).

export type Score = 1 | 2 | 3 | 4 | 5;

// -1 is the anti-hallucination "insufficient data" sentinel (advisory scoring).
export type ScoreOrInsufficient = Score | -1;

// The advisory triage hint can also be absent (no active rubric of the signal's
// kind), surfaced as null in the read-model (listTriage.advisoryScore).
export type AdvisoryScore = ScoreOrInsufficient | null;

// The *connector* a signal came from (provenance). Signal kind below is *what entity
// the signal resolves to* - a different axis. A connector source is never "manual";
// a manually entered person carries PersonSource instead.
export type SourceKind = "linkedin-search" | "x-posts" | "csv-companies" | "news";

// A person's provenance chip: a connector source, or hand-entry (ADR-0010).
export type PersonSource = SourceKind | "manual";

// A signal resolves to one of these entity shapes; approval routes by kind
// (ADR-0013). "job" exists in the schema but is not surfaced in the MVP triage UI.
export type SignalKind = "person" | "company" | "content";

// A tracked person is either a buyer (prospect) or an amplifier (peer). The rubric
// kind the advisory filter scores their SIGNAL against differs by kind (ADR-0017).
export type PersonType = "prospect" | "peer";

// Whether a person was fanned out from a signal or entered by hand (ADR-0010).
export type Origin = "signal" | "manual";

// A LinkedIn Message is a connection-request or a DM (ADR-0021).
export type MessageType = "connection_request" | "message";
export type MessageStatus = "generated" | "sent" | "dismissed";

// A Comment is an AI draft on a Post; the human posts it manually (ADR-0018, D2).
export type CommentStatus = "generated" | "posted" | "dismissed";

// Outcome of a human touch, logged against the person and artifact (no score
// snapshot - ADR-0022; the D7 learning loop is deferred).
export type OutcomeResult = "none" | "connected" | "replied" | "booked" | "no_response";
