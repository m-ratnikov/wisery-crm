// Mock data for the ICP & source config prototype (anchor view #1). The whole
// point of this screen is that the ICP rubric, the user profile, and the sources
// are config-as-data the engine reads (D6, D1), never hardcoded in prompts - so
// these shapes mirror the domain-model Rubric, USER_PROFILE, Source, and Scan.
// Hand-typed here; the prototype never imports src/lib.

import type { Score, SourceKind } from "./types";

export interface RubricBand {
  score: Score;
  criteria: string;
}

export interface Rubric {
  name: string;
  version: number;
  active: boolean;
  idealTitles: string[];
  idealStages: string[];
  positiveSignals: string[];
  disqualifiers: string[];
  bands: RubricBand[];
  insufficientDataRule: string;
  platformNote: string;
}

export interface CaseStudy {
  title: string;
  result: string;
}

export interface UserProfile {
  version: number;
  positioning: string;
  offer: string;
  voice: string;
  caseStudies: CaseStudy[];
}

export type ScanStatus = "completed" | "failed" | "running";

export interface LastScan {
  at: string;
  status: ScanStatus;
  fetched: number;
  persisted: number;
  dropped: number;
  error?: string;
}

export interface SourceConfig {
  id: string;
  kind: SourceKind;
  name: string;
  query: string;
  enabled: boolean;
  schedule: string;
  lastScan?: LastScan;
}

export const rubric: Rubric = {
  name: "Fractional CTO / technical leadership ICP",
  version: 3,
  active: true,
  idealTitles: [
    "Founder / CEO (non-technical)",
    "Founder & CTO (early-stage)",
    "VP Engineering",
    "Head of Engineering",
    "Director of Engineering",
  ],
  idealStages: [
    "Pre-seed to Series B",
    "5 to 60 engineers",
    "Recently funded or scaling headcount",
  ],
  positiveSignals: [
    "Public hiring push for senior/staff engineers or leadership",
    "Stated org-design or process pain",
    "Build-vs-borrow deliberation (fractional vs full-time)",
    "Non-technical founder with no technical co-founder",
    "Post-raise scaling moment",
  ],
  disqualifiers: [
    "Individual contributors with no buying authority",
    "Recruiting, agency, or vendor roles",
    "Enterprises with an established CTO + VP bench",
    "Off-ICP industries with no technical-leadership need",
  ],
  bands: [
    {
      score: 5,
      criteria:
        "Exact fit plus a fresh, specific, high-intent signal (e.g. a non-technical founder asking for technical leadership).",
    },
    {
      score: 4,
      criteria:
        "Strong fit; decision-maker title with a credible need, intent slightly less explicit or stage slightly early.",
    },
    {
      score: 3,
      criteria:
        "On-ICP company and seniority, or a real pain from an influencer rather than a buyer. Surface, lower priority.",
    },
    {
      score: 2,
      criteria: "Tangential: right company, wrong role (IC), or a weak/absent leadership signal.",
    },
    { score: 1, criteria: "Off-ICP on role, company, or need." },
  ],
  insufficientDataRule:
    "Return -1 / INSUFFICIENT_DATA rather than guessing when the profile is too thin to judge responsibly (locked profile, no bio or history).",
  platformNote:
    "Platform-aware: the same person scores differently as a hiring post, a people-search result, or an article quote.",
};

export const profile: UserProfile = {
  version: 2,
  positioning:
    "Fractional CTO / CXO for founders and scaling teams. I help post-raise and founder-led companies stage the 10-to-50 engineer jump - org design, delivery, and the load-bearing technical decisions - without committing to a full-time VP before the shape is clear.",
  offer:
    "Fractional engagements, 1 to 3 days a week, 3 to 6 months by default, scoped to a specific inflection: a raise, a scaling push, or a build-vs-borrow decision.",
  voice:
    "Direct and peer-to-peer. No pitch. Mirror the prospect's own words for the pain, offer to share what worked rather than to sell, and keep it short.",
  caseStudies: [
    {
      title: "Series B platform team, 20 to 50",
      result:
        "Staged the org-design jump so the first VP Eng stepped into a shaped org, not a rebuild.",
    },
    {
      title: "Non-technical founder, 14-person team",
      result: "Steadied delivery and process; the founder kept optionality on the full-time hire.",
    },
    {
      title: "Seed-stage infra startup",
      result:
        "Build-vs-borrow call: fractional first, full-time later, avoiding a premature senior hire.",
    },
  ],
};

export const sources: SourceConfig[] = [
  {
    id: "s-li-1",
    kind: "linkedin-search",
    name: "LinkedIn: hiring + leadership posts",
    query: 'fractional CTO OR "VP Engineering" hiring post',
    enabled: true,
    schedule: "Every 6h",
    lastScan: { at: "2h ago", status: "completed", fetched: 41, persisted: 14, dropped: 27 },
  },
  {
    id: "s-x-1",
    kind: "x-posts",
    name: "X: build-vs-borrow threads",
    query: '(fractional CTO) OR ("VP Eng" hire) lang:en',
    enabled: true,
    schedule: "Every 12h",
    lastScan: { at: "5h ago", status: "completed", fetched: 18, persisted: 6, dropped: 12 },
  },
  {
    id: "s-li-2",
    kind: "linkedin-search",
    name: "LinkedIn: design-tooling founders",
    query: 'non-technical founder "design tool" OR "creative software"',
    enabled: true,
    schedule: "Every 12h",
    lastScan: {
      at: "4h ago",
      status: "failed",
      fetched: 0,
      persisted: 0,
      dropped: 0,
      error: "Auth cookie expired - re-link the LinkedIn session to resume.",
    },
  },
  {
    id: "s-x-2",
    kind: "x-posts",
    name: "X: non-technical founders",
    query: '"non-technical founder" OR "no technical co-founder" lang:en',
    enabled: true,
    schedule: "Daily",
    lastScan: { at: "9h ago", status: "completed", fetched: 22, persisted: 5, dropped: 17 },
  },
];
// People-first MVP: sources are the two person scrapers (LinkedIn, X). Company-list
// (CSV) and news scrapers expand to people and are V2 (normalize-expand, roadmap M2).
