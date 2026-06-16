// Mock pending signals for the unified Queue - the sole intake surface (ADR-0013).
// Every signal awaits a human approve/dismiss; nothing is created at persist. The
// advisory score is a type-keyed rubric HINT shown before approval, never a gate -
// and the only score in the system, kept on the signal (ADR-0017/0022). Approval
// routes by kind and creates the entity only:
//   person  -> Person(type = prospect)
//   company -> Company
//   content -> author Person(type = peer) + Post

import type { AdvisoryScore, SourceKind } from "./types";

export interface PersonPayload {
  name: string;
  headline: string;
  company: string;
  location: string;
  linkedinUrl: string;
  context: string;
}

export interface CompanyPayload {
  name: string;
  domain: string | null;
  industry: string;
  stage: string;
  location: string;
  note: string;
}

export interface ContentPayload {
  authorName: string;
  authorHeadline: string;
  authorUrl: string;
  postExcerpt: string;
  postUrl: string;
  postedAt: string;
}

interface SignalBase {
  id: string;
  source: SourceKind;
  capturedAt: string;
  advisory: { score: AdvisoryScore; rubricKind: "icp" | "peer" | "company"; reason: string };
}

export type PendingSignal = SignalBase &
  (
    | { kind: "person"; payload: PersonPayload }
    | { kind: "company"; payload: CompanyPayload }
    | { kind: "content"; payload: ContentPayload }
  );

export const pendingSignals: PendingSignal[] = [
  {
    id: "sig-1",
    kind: "person",
    source: "linkedin-search",
    capturedAt: "1h ago",
    advisory: {
      score: 5,
      rubricKind: "icp",
      reason:
        "Non-technical CEO of a fast-growing design-tooling startup, openly missing technical leadership - prime fractional-CTO fit.",
    },
    payload: {
      name: "Elena Vasquez",
      headline: "Co-founder & CEO",
      company: "Palette Studio",
      location: "Lisbon, PT",
      linkedinUrl: "https://www.linkedin.com/in/example-elena",
      context:
        'Hiring post: "Non-technical founder. We\'ve grown to 16 people and our delivery is getting unpredictable - I need senior technical leadership, ideally part-time to start."',
    },
  },
  {
    id: "sig-2",
    kind: "content",
    source: "linkedin-search",
    capturedAt: "3h ago",
    advisory: {
      score: 5,
      rubricKind: "peer",
      reason:
        "High-reach voice writing exactly on the engineering-leadership niche; strong amplification value as a peer.",
    },
    payload: {
      authorName: "Hannah Mbeki",
      authorHeadline: "Writes 'Scaling Teams' - 40k followers",
      authorUrl: "https://www.linkedin.com/in/example-hannah",
      postExcerpt:
        "Most 'org redesigns' fail because they reorganize the boxes before fixing who owns the decision. Three patterns I keep seeing in post-Series-A teams...",
      postUrl: "https://www.linkedin.com/posts/example-hannah-orgdesign",
      postedAt: "4h ago",
    },
  },
  {
    id: "sig-3",
    kind: "company",
    source: "csv-companies",
    capturedAt: "5h ago",
    advisory: {
      score: 4,
      rubricKind: "company",
      reason:
        "Series A fintech, eng team of ~25 with no VP/CTO listed, recent funding - good firmographic fit before expanding to people.",
    },
    payload: {
      name: "Ledgerwise",
      domain: "ledgerwise.com",
      industry: "Fintech / payments",
      stage: "Series A",
      location: "Berlin, DE",
      note: "Raised 12M EUR 6 weeks ago; job posts for senior backend but no eng leadership role.",
    },
  },
  {
    id: "sig-4",
    kind: "person",
    source: "x-posts",
    capturedAt: "7h ago",
    advisory: {
      score: 3,
      rubricKind: "icp",
      reason:
        "Real pain signal at an ICP-fit company, but the author is a senior IC, not a budget owner - surface, lower priority.",
    },
    payload: {
      name: "Daniel Cho",
      headline: "Staff Engineer",
      company: "Forecast.io",
      location: "Seattle, WA",
      linkedinUrl: "https://www.linkedin.com/in/example-daniel",
      context:
        "X post: \"We've tripled the team and nobody actually owns the platform roadmap anymore. It's quietly killing our velocity.\"",
    },
  },
  {
    id: "sig-5",
    kind: "person",
    source: "linkedin-search",
    capturedAt: "9h ago",
    advisory: {
      score: -1,
      rubricKind: "icp",
      reason:
        "Insufficient data to score - sparse profile, no company stage or team-size signal. Anti-hallucination guard returned -1.",
    },
    payload: {
      name: "M. Okonkwo",
      headline: "Founder",
      company: "(undisclosed)",
      location: "Unknown",
      linkedinUrl: "https://www.linkedin.com/in/example-okonkwo",
      context: "People-search result with a thin profile and no recent activity.",
    },
  },
  {
    id: "sig-6",
    kind: "content",
    source: "x-posts",
    capturedAt: "11h ago",
    advisory: {
      score: null,
      rubricKind: "peer",
      reason: "No active peer rubric of this kind, so no advisory score was computed.",
    },
    payload: {
      authorName: "Theo Brandt",
      authorHeadline: "Building in public, early-stage SaaS",
      authorUrl: "https://x.com/example-theo",
      postExcerpt:
        "Hot take: your first 'Head of Engineering' hire should be a contractor for the first 90 days. Here's why that de-risks everyone...",
      postUrl: "https://x.com/example-theo/status/123",
      postedAt: "12h ago",
    },
  },
  {
    id: "sig-7",
    kind: "company",
    source: "csv-companies",
    capturedAt: "1d ago",
    advisory: {
      score: 2,
      rubricKind: "company",
      reason:
        "Late-stage and likely to already have a full eng leadership bench - weaker fit for fractional. Kept for the record.",
    },
    payload: {
      name: "Vantage Mobility",
      domain: "vantagemobility.com",
      industry: "Mobility / logistics",
      stage: "Series D",
      location: "Amsterdam, NL",
      note: "300+ headcount; established VP Eng and CTO already in place.",
    },
  },
];
