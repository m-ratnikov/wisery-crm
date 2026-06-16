// Mock data for the whole-app shell (/prototype). This screen is not an anchor view -
// it is a clickable view of the primary journey: the daily loop. Live counts are
// computed in the page from the other mock modules; this file holds only the
// background-activity and recent-scan mocks, which have no other home.

import type { SourceKind } from "./types";

// What the background pipeline is doing right now. After the engagement rework
// (ADR-0019/0022) only three things run as background jobs: scan, the advisory filter
// (the only scoring in the system), and the activity scan. Generation and enrichment
// are synchronous on-demand actions on a Person - NOT background stages - so they are
// deliberately absent here.
export interface PipelineActivity {
  key: string;
  label: string;
  state: "running" | "idle";
  detail: string;
}

export const activity: PipelineActivity[] = [
  {
    key: "scan",
    label: "Source scan",
    state: "running",
    detail: "LinkedIn search - paging new people into signals",
  },
  {
    key: "advisory",
    label: "Advisory filter",
    state: "running",
    detail: "Scoring new signals with the type-keyed rubric - a hint, not a gate",
  },
  {
    key: "activity",
    label: "Activity scan",
    state: "idle",
    detail: "Fetches posts from monitored people into the Feed",
  },
];

export interface RecentScan {
  kind: SourceKind;
  label: string;
  added: number;
  at: string;
}

export const recentScans: RecentScan[] = [
  { kind: "linkedin-search", label: "LinkedIn: hiring + leadership", added: 4, at: "1h ago" },
  { kind: "x-posts", label: "X: build-vs-borrow threads", added: 2, at: "3h ago" },
  { kind: "csv-companies", label: "CSV: Series A/B target list", added: 1, at: "5h ago" },
];
