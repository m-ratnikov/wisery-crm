// Mock data for the whole-app shell (/prototype). This screen is not a fourth
// anchor view - the thesis commits to only three. It is a clickable view of the
// primary journey (product-overview), a peer to the sequence diagrams: the daily
// loop as a funnel, with deep links into the three hand-built anchors.

import type { SourceKind } from "./types";

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
  emphasis?: boolean;
  href?: string;
}

// The pipeline as a descending funnel (product-overview section 4). Illustrative counts.
export const funnel: FunnelStage[] = [
  { key: "signals", label: "Signals", count: 128 },
  { key: "scored", label: "Scored", count: 96 },
  { key: "qualified", label: "Qualified (3+)", count: 41 },
  { key: "drafted", label: "Drafted", count: 23 },
  {
    key: "queued",
    label: "Queued",
    count: 12,
    emphasis: true,
    href: "/prototype/review-queue",
  },
];

// Scored under the bar (96 - 41): kept silently for the learning loop (D7).
export const belowBar = 55;

export interface RecentScan {
  kind: SourceKind;
  label: string;
  added: number;
  at: string;
}

// People-first MVP: only the person scrapers (LinkedIn, X). Company-list and news
// scrapers (which expand to people) are V2 - see Settings > Connected scrapers.
export const recentScans: RecentScan[] = [
  { kind: "linkedin-search", label: "LinkedIn: hiring + leadership", added: 14, at: "2h ago" },
  { kind: "x-posts", label: "X: build-vs-borrow threads", added: 6, at: "5h ago" },
  { kind: "linkedin-search", label: "LinkedIn: design-tooling founders", added: 5, at: "8h ago" },
];

// What the background pipeline is doing right now. The product is mostly jobs +
// generative output (the thesis); this panel makes that work legible on the shell.
export interface PipelineActivity {
  key: string;
  label: string;
  state: "running" | "queued";
  detail: string;
}

export const activity: PipelineActivity[] = [
  {
    key: "scan",
    label: "Scanning LinkedIn",
    state: "running",
    detail: "hiring + leadership posts",
  },
  { key: "qualify", label: "Qualifying", state: "running", detail: "6 new signals scoring" },
  { key: "draft", label: "Drafting", state: "running", detail: "3 qualified prospects" },
  { key: "enrich", label: "Enriching", state: "queued", detail: "2 you sent to enrich" },
];

export const queueSummary = { ready: 12, draftedToday: 3 };
