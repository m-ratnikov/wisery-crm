// Mock people for the prototype. Shapes mirror the domain-model nouns (Person,
// Dossier, Message, Outcome) but are hand-typed - the prototype never imports
// src/lib. A Person carries a `type` (prospect | peer) and a `monitored` facet
// (ADR-0015); it carries NO score - the advisory score stays on the signal, the
// only scored thing in the system (ADR-0022). Posts live in feed.ts (the
// engagement source of truth) and are joined to a person via postsForPerson().

import type {
  MessageStatus,
  MessageType,
  Origin,
  OutcomeResult,
  PersonSource,
  PersonType,
} from "./types";

export interface DossierData {
  summary: string;
  highlights: string[];
  links: { label: string; href: string }[];
  provider: string;
  enrichedAt: string;
}

export interface Message {
  id: string;
  type: MessageType;
  body: string;
  status: MessageStatus;
  promptVersion: string;
  createdAt: string;
}

export interface OutcomeLog {
  id: string;
  result: Exclude<OutcomeResult, "none">;
  channel: string;
  notes?: string;
  occurredAt: string;
}

export interface PersonDetail {
  id: string;
  type: PersonType;
  monitored: boolean;
  origin: Origin;
  source: PersonSource;
  name: string;
  headline: string;
  company: string;
  companyId?: string;
  location: string;
  linkedinUrl: string;
  statusId: string;
  // Present iff origin = signal; the context that surfaced this person.
  signal?: { label: string; capturedAt: string; excerpt: string };
  dossier: DossierData | null;
  messages: Message[];
  outcomes: OutcomeLog[];
}

export const people: PersonDetail[] = [
  {
    id: "per-dana",
    type: "prospect",
    monitored: false,
    origin: "signal",
    source: "linkedin-search",
    name: "Dana Whitfield",
    headline: "VP Engineering",
    company: "Northwind Labs",
    companyId: "co-northwind",
    location: "Austin, TX",
    linkedinUrl: "https://www.linkedin.com/in/example-dana",
    statusId: "ps-cr-sent",
    signal: {
      label: "Hiring post on LinkedIn",
      capturedAt: "2d ago",
      excerpt:
        "We're doubling the platform team this year and looking for senior help shaping the org - DMs open.",
    },
    dossier: {
      summary:
        "8 years scaling platform teams (Stripe, then Northwind). Just raised a $34M Series B led by Bessemer; public hiring push for senior/staff and an org-design gap she has flagged twice.",
      highlights: [
        "Series B closed 3 weeks ago - org-scaling pain is fresh",
        "Posts about eng-management, not just tech - receptive to leadership framing",
        "No VP of Platform yet; reports the org-design work to herself",
      ],
      links: [
        { label: "LinkedIn profile", href: "https://www.linkedin.com/in/example-dana" },
        {
          label: "Northwind Series B (TechCrunch)",
          href: "https://example.com/northwind-series-b",
        },
      ],
      provider: "apify",
      enrichedAt: "1d ago",
    },
    messages: [
      {
        id: "msg-dana-1",
        type: "connection_request",
        body: "Hi Dana - congrats on the Series B. Doubling the platform team in a year is exactly where org design quietly becomes the bottleneck. I've helped a couple of post-B teams stage that 20-to-50 jump without the usual rework. Happy to share what worked if useful - no pitch.",
        status: "sent",
        promptVersion: "message_v2",
        createdAt: "1d ago",
      },
    ],
    outcomes: [
      {
        id: "out-dana-1",
        result: "connected",
        channel: "LinkedIn",
        notes: "Accepted the connection request within a few hours.",
        occurredAt: "20h ago",
      },
    ],
  },
  {
    id: "per-sofia",
    type: "prospect",
    monitored: true,
    origin: "signal",
    source: "linkedin-search",
    name: "Sofia Alvarez",
    headline: "Co-founder & CEO",
    company: "Renderbloom",
    location: "Remote (EU)",
    linkedinUrl: "https://www.linkedin.com/in/example-sofia",
    statusId: "ps-conversation",
    signal: {
      label: "Hiring post on LinkedIn",
      capturedAt: "6d ago",
      excerpt:
        "Non-technical founder here. Need senior technical leadership to steady a team that's grown faster than our process.",
    },
    dossier: null,
    messages: [
      {
        id: "msg-sofia-1",
        type: "connection_request",
        body: "Hi Sofia - 'grown faster than our process' is the exact moment a fractional technical lead earns their keep: enough seniority to steady the team, without committing to a full-time VP before you know the shape you need. Worth a short chat?",
        status: "sent",
        promptVersion: "message_v2",
        createdAt: "5d ago",
      },
      {
        id: "msg-sofia-2",
        type: "message",
        body: "Thanks for connecting, Sofia. Quick thought on the process pain: the usual first win is making delivery predictable for one team before touching the rest. Happy to walk through how I'd scope a 2-week look if you're open to it.",
        status: "generated",
        promptVersion: "message_v2",
        createdAt: "2h ago",
      },
    ],
    outcomes: [
      {
        id: "out-sofia-1",
        result: "replied",
        channel: "LinkedIn",
        notes: "Replied asking what a fractional engagement usually looks like.",
        occurredAt: "1d ago",
      },
    ],
  },
  {
    id: "per-marcus",
    type: "prospect",
    monitored: false,
    origin: "signal",
    source: "x-posts",
    name: "Marcus Lindqvist",
    headline: "Founder & CTO",
    company: "Titanic Cloud",
    location: "Stockholm, SE",
    linkedinUrl: "https://www.linkedin.com/in/example-marcus",
    statusId: "ps-cold",
    signal: {
      label: "X post (thread author)",
      capturedAt: "5h ago",
      excerpt:
        "Solo technical founder. Do I hire a VP Eng now or get fractional senior help for 6 months first? Torn.",
    },
    dossier: null,
    messages: [],
    outcomes: [],
  },
  {
    id: "per-priya",
    type: "prospect",
    monitored: false,
    origin: "manual",
    source: "manual",
    name: "Priya Nair",
    headline: "Head of Product",
    company: "Lumen Health",
    companyId: "co-lumen",
    location: "Toronto, CA",
    linkedinUrl: "https://www.linkedin.com/in/example-priya",
    statusId: "ps-cold",
    dossier: null,
    messages: [],
    outcomes: [],
  },
  {
    id: "per-tom",
    type: "prospect",
    monitored: false,
    origin: "signal",
    source: "x-posts",
    name: "Tom Becker",
    headline: "Engineering Manager",
    company: "Drayton Systems",
    location: "Berlin, DE",
    linkedinUrl: "https://www.linkedin.com/in/example-tom",
    statusId: "ps-not-interested",
    signal: {
      label: "X post (thread author)",
      capturedAt: "2d ago",
      excerpt:
        "Our biggest constraint isn't headcount - it's that nobody owns the architecture end-to-end.",
    },
    dossier: null,
    messages: [],
    outcomes: [
      {
        id: "out-tom-1",
        result: "no_response",
        channel: "LinkedIn",
        occurredAt: "12h ago",
      },
    ],
  },
  {
    id: "per-lena",
    type: "peer",
    monitored: true,
    origin: "signal",
    source: "linkedin-search",
    name: "Lena Fischer",
    headline: "Fractional CTO & writer on engineering leadership",
    company: "Independent",
    location: "Munich, DE",
    linkedinUrl: "https://www.linkedin.com/in/example-lena",
    statusId: "ps-cold",
    signal: {
      label: "Authored post (content signal)",
      capturedAt: "3d ago",
      excerpt:
        "The hardest part of scaling an eng org isn't hiring - it's deciding what NOT to centralize.",
    },
    dossier: null,
    messages: [],
    outcomes: [],
  },
  {
    id: "per-raj",
    type: "peer",
    monitored: true,
    origin: "signal",
    source: "x-posts",
    name: "Raj Patel",
    headline: "Founder-coach, posts on the 0-to-1 eng org",
    company: "Independent",
    location: "London, UK",
    linkedinUrl: "https://www.linkedin.com/in/example-raj",
    statusId: "ps-cold",
    signal: {
      label: "Authored post (content signal)",
      capturedAt: "8h ago",
      excerpt:
        "Founders keep asking me when to make their first senior eng hire. The answer is almost never 'now'.",
    },
    dossier: null,
    messages: [],
    outcomes: [],
  },
];

export function getPerson(id: string): PersonDetail | undefined {
  return people.find((person) => person.id === id);
}

// List projection (mirrors ProspectListItem): the columns the people list needs.
// No score or qualification - the advisory score lives on the signal (ADR-0022).
export interface PersonListItem {
  id: string;
  type: PersonType;
  monitored: boolean;
  origin: Origin;
  source: PersonSource;
  name: string;
  headline: string;
  company: string;
  statusId: string;
  ageHours: number;
}

const ageHoursByPerson: Record<string, number> = {
  "per-dana": 48,
  "per-sofia": 144,
  "per-marcus": 5,
  "per-priya": 30,
  "per-tom": 48,
  "per-lena": 72,
  "per-raj": 8,
};

export function peopleList(): PersonListItem[] {
  return people.map((person) => ({
    id: person.id,
    type: person.type,
    monitored: person.monitored,
    origin: person.origin,
    source: person.source,
    name: person.name,
    headline: person.headline,
    company: person.company,
    statusId: person.statusId,
    ageHours: ageHoursByPerson[person.id] ?? 24,
  }));
}
