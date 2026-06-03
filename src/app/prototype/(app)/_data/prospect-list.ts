// Mock data for the prospect-list prototype (anchor view #3). Unlike the review
// queue - a focused act-now inbox of queued/drafted prospects - this is the broad
// browse/manage surface over the WHOLE pipeline: every prospect at every lifecycle
// status (domain-model.md), including the below-bar and dismissed ones the queue
// never shows. Hand-typed here; the prototype never imports src/lib.

import type { ProspectStatus, ScoreOrInsufficient, SourceKind } from "./types";

export type ActResult = "Replied" | "Booked" | "No response";

export interface ProspectRow {
  id: string;
  name: string;
  title: string;
  company: string;
  location: string;
  // null = not scored yet (status "new"); -1 = insufficient data to score.
  score: ScoreOrInsufficient | null;
  scoreReason: string;
  status: ProspectStatus;
  // Derived facets (ADR-0008): a Dossier / a selected Draft exists. Orthogonal to
  // status - a queued prospect is always drafted; enrichment is optional/user-triggered.
  enriched: boolean;
  drafted: boolean;
  source: SourceKind;
  signalLabel: string;
  signalExcerpt: string;
  ageHours: number;
  tags: string[];
  dossierSummary?: string;
  result?: ActResult;
}

// Relative-age label derived from ageHours so the display string is one source of
// truth and the column still sorts numerically.
export function formatAge(hours: number): string {
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export const prospects: ProspectRow[] = [
  {
    id: "p-1042",
    name: "Dana Whitfield",
    title: "VP Engineering",
    company: "Northwind Labs",
    location: "Austin, TX",
    score: 5,
    scoreReason:
      "Series B, scaling eng from 20 to 50, explicitly hiring fractional leadership help - exact ICP fit.",
    status: "queued",
    enriched: true,
    drafted: true,
    source: "linkedin-search",
    signalLabel: "Hiring post on LinkedIn",
    signalExcerpt:
      "We're doubling the platform team this year and looking for senior help shaping the org - DMs open.",
    ageHours: 2,
    tags: ["hot", "series-b"],
    dossierSummary:
      "8 years scaling platform teams (Stripe, then Northwind). $34M Series B led by Bessemer; public hiring push and a self-flagged org-design gap.",
  },
  {
    id: "p-1049",
    name: "Raj Patel",
    title: "Head of Engineering",
    company: "Forge Analytics",
    location: "Bengaluru, IN",
    score: 5,
    scoreReason:
      "Owns eng at a fast-scaling data company, posting about org-design pain - decision-maker with a fresh, specific need.",
    status: "queued",
    enriched: true,
    drafted: true,
    source: "linkedin-search",
    signalLabel: "Hiring post on LinkedIn",
    signalExcerpt:
      "Tripled the team in 9 months and our process didn't keep up. Looking for senior help untangling it.",
    ageHours: 3,
    tags: ["hot", "scaling"],
    dossierSummary:
      "Runs a 30-person eng org that outgrew its process. Buyer-level title, names the exact pain a fractional lead solves.",
  },
  {
    id: "p-1046",
    name: "Sofia Alvarez",
    title: "Co-founder & CEO",
    company: "Renderbloom",
    location: "Remote (EU)",
    score: 5,
    scoreReason:
      "Non-technical CEO of a fast-growing design-tooling startup, openly missing technical leadership - prime fractional-CTO fit.",
    status: "queued",
    enriched: true,
    drafted: true,
    source: "linkedin-search",
    signalLabel: "Hiring post on LinkedIn",
    signalExcerpt:
      "Non-technical founder here. Need senior technical leadership to steady a team that's grown faster than our process.",
    ageHours: 6,
    tags: ["hot", "non-technical-founder"],
    dossierSummary:
      "Non-technical CEO, 14-person team that outgrew its process, no senior technical leader. Profitable and design-led - the clearest fractional-CTO need in the batch.",
  },
  {
    id: "p-1051",
    name: "Chloe Martin",
    title: "Founder",
    company: "Tess (stealth)",
    location: "Paris, FR",
    score: 4,
    scoreReason:
      "Solo non-technical founder pre-launch, asking who owns the build - early but a clean fractional entry point.",
    status: "queued",
    enriched: false,
    drafted: true,
    source: "x-posts",
    signalLabel: "X post (thread author)",
    signalExcerpt:
      "Building in stealth, no technical co-founder yet. Do I hire a lead engineer or get fractional CTO help to set direction first?",
    ageHours: 9,
    tags: ["stealth", "seed"],
  },
  {
    id: "p-1043",
    name: "Marcus Lindqvist",
    title: "Founder & CTO",
    company: "Titanic Cloud",
    location: "Stockholm, SE",
    score: 4,
    scoreReason:
      "Technical founder publicly weighing a fractional CTO vs. a full-time VP - strong intent, slightly early stage.",
    status: "acted",
    enriched: true,
    drafted: true,
    source: "x-posts",
    signalLabel: "X post (thread author)",
    signalExcerpt:
      "Solo technical founder. Do I hire a VP Eng now or get fractional senior help for 6 months first? Torn.",
    ageHours: 28,
    tags: ["seed", "high-intent"],
    result: "Replied",
    dossierSummary:
      "Second-time founder, seed-stage infra startup, 6 engineers. Asked the exact build-vs-borrow question fractional leadership answers.",
  },
  {
    id: "p-1047",
    name: "Owen Park",
    title: "CTO",
    company: "Halcyon Robotics",
    location: "San Jose, CA",
    score: 4,
    scoreReason:
      "CTO at a scaling hardware startup naming a delivery-ownership gap; a buyer with budget and urgency.",
    status: "closed",
    enriched: true,
    drafted: true,
    source: "linkedin-search",
    signalLabel: "Hiring post on LinkedIn",
    signalExcerpt:
      "Scaling from prototype to production and our software org needs a steadier hand than I can give it right now.",
    ageHours: 120,
    tags: ["hardware", "won"],
    result: "Booked",
    dossierSummary:
      "CTO splitting focus between hardware and a growing software org. Booked an intro call; engagement scoped.",
  },
  {
    id: "p-1044",
    name: "Priya Nair",
    title: "Head of Product",
    company: "Lumen Health",
    location: "Toronto, CA",
    score: 4,
    scoreReason:
      "Decision-maker title at an ICP-fit company expanding into a new line; product-eng coordination gap implied.",
    status: "qualified",
    enriched: false,
    drafted: false,
    source: "linkedin-search",
    signalLabel: "People-search result",
    signalExcerpt:
      "Head of Product at a Series A healthtech, posting about owning the launch of a new clinician-facing line.",
    ageHours: 26,
    tags: ["healthtech", "series-a"],
  },
  {
    id: "p-1052",
    name: "Hannah Cole",
    title: "Director of Engineering",
    company: "Brightwave",
    location: "Remote (US)",
    score: 3,
    scoreReason:
      "Right title and a real coordination gap, but a larger, better-resourced org - surface, lower priority.",
    status: "qualified",
    enriched: false,
    drafted: false,
    source: "linkedin-search",
    signalLabel: "Hiring + leadership post",
    signalExcerpt:
      "We grew headcount faster than we grew the discipline around how we ship - looking for senior help.",
    ageHours: 30,
    tags: [],
  },
  {
    id: "p-1045",
    name: "Tom Becker",
    title: "Engineering Manager",
    company: "Drayton Systems",
    location: "Berlin, DE",
    score: 3,
    scoreReason:
      "Right industry and a real pain signal, but an EM (influencer, not budget owner) - surface, lower priority.",
    status: "queued",
    enriched: true,
    drafted: true,
    source: "x-posts",
    signalLabel: "X post (thread author)",
    signalExcerpt:
      "Our biggest constraint isn't headcount - it's that nobody owns the architecture end-to-end.",
    ageHours: 44,
    tags: ["influencer"],
    dossierSummary:
      "EM at a mid-size industrial-software firm who publicly named an architecture-ownership gap. Influencer rather than buyer, but a credible warm path into the org.",
  },
  {
    id: "p-1053",
    name: "Lena Fischer",
    title: "VP Product",
    company: "Aerial Mobility",
    location: "Munich, DE",
    score: 3,
    scoreReason:
      "On-ICP company and seniority, but the signal is generic - qualified, not yet drafted.",
    status: "qualified",
    enriched: false,
    drafted: false,
    source: "x-posts",
    signalLabel: "X post (thread author)",
    signalExcerpt: "Hiring season again. Anyone got a good framework for staffing a platform team?",
    ageHours: 14,
    tags: [],
  },
  {
    id: "p-1054",
    name: "Sam Whitaker",
    title: "VP Engineering",
    company: "Northstar Retail",
    location: "Chicago, IL",
    score: null,
    scoreReason: "Just in from a LinkedIn people-search; the qualifier has not scored it yet.",
    status: "new",
    enriched: false,
    drafted: false,
    source: "linkedin-search",
    signalLabel: "People-search result",
    signalExcerpt:
      "VP Engineering at a Series B retail-tech company; surfaced on a leadership search.",
    ageHours: 0.5,
    tags: ["just-in"],
  },
  {
    id: "p-1048",
    name: "Diego Ramos",
    title: "Senior Engineer",
    company: "Cobalt Pay",
    location: "Madrid, ES",
    score: 2,
    scoreReason:
      "On-ICP company but an individual contributor with no buying authority and no leadership signal.",
    status: "below_bar",
    enriched: false,
    drafted: false,
    source: "linkedin-search",
    signalLabel: "People-search result",
    signalExcerpt:
      "Senior backend engineer, payments. No posts indicating a leadership transition.",
    ageHours: 40,
    tags: [],
  },
  {
    id: "p-1055",
    name: "Mei Tan",
    title: "Technical Recruiter",
    company: "TalentForge",
    location: "Singapore, SG",
    score: 1,
    scoreReason: "Off-ICP role (recruiting agency); no fit on title, company, or need.",
    status: "below_bar",
    enriched: false,
    drafted: false,
    source: "linkedin-search",
    signalLabel: "People-search result",
    signalExcerpt: "Recruiter sourcing engineering leaders for client companies.",
    ageHours: 52,
    tags: [],
  },
  {
    id: "p-1056",
    name: "Private profile",
    title: "Unknown title",
    company: "Unknown company",
    location: "Unknown",
    score: -1,
    scoreReason:
      "Profile data too thin to score responsibly - anti-hallucination guard returned INSUFFICIENT_DATA.",
    status: "below_bar",
    enriched: false,
    drafted: false,
    source: "x-posts",
    signalLabel: "X post (thread author)",
    signalExcerpt:
      "Reposted an article on engineering leadership. Locked profile, no bio or history.",
    ageHours: 60,
    tags: [],
  },
  {
    id: "p-1050",
    name: "Grace O'Neil",
    title: "COO",
    company: "Lattice Foods",
    location: "Dublin, IE",
    score: 3,
    scoreReason:
      "Scored 3 on company fit, but operations rather than engineering leadership - the CRM user dismissed it.",
    status: "dismissed",
    enriched: false,
    drafted: false,
    source: "linkedin-search",
    signalLabel: "People-search result",
    signalExcerpt: "COO at a Series A company; surfaced on a C-suite leadership search.",
    ageHours: 36,
    tags: ["not-now"],
  },
];
