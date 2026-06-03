// Mock data for the review/approve queue prototype. Shapes mirror the domain-model
// nouns (Prospect, Signal, Scoring, dossier, draft) but are intentionally hand-typed
// here - the prototype never imports src/lib, so the look transfers without coupling.

import type { Score, SourceKind } from "./types";

export type { Score, SourceKind };
export type Outcome = "none" | "sent" | "replied" | "booked";

export interface Signal {
  kind: SourceKind;
  label: string;
  capturedAt: string;
  excerpt: string;
}

export interface Dossier {
  summary: string;
  highlights: string[];
  links: { label: string; href: string }[];
}

export interface Draft {
  promptVersion: string;
  channel: "LinkedIn";
  body: string;
}

export interface QueuedProspect {
  id: string;
  name: string;
  title: string;
  company: string;
  location: string;
  score: Score;
  scoreReason: string;
  signal: Signal;
  dossier: Dossier;
  draft: Draft;
  actionUrl: string;
  outcome: Outcome;
}

export const queuedProspects: QueuedProspect[] = [
  {
    id: "p-1042",
    name: "Dana Whitfield",
    title: "VP Engineering",
    company: "Northwind Labs",
    location: "Austin, TX",
    score: 5,
    scoreReason:
      "Series B, scaling eng from 20 to 50, explicitly hiring fractional leadership help - exact ICP fit.",
    signal: {
      kind: "linkedin-search",
      label: "Hiring post on LinkedIn",
      capturedAt: "2h ago",
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
    },
    draft: {
      promptVersion: "draft_v3",
      channel: "LinkedIn",
      body: "Hi Dana - congrats on the Series B. Doubling the platform team in a year is exactly where org design quietly becomes the bottleneck. I've helped a couple of post-B teams stage that 20-to-50 jump without the usual rework. Happy to share what worked if useful - no pitch.",
    },
    actionUrl: "https://www.linkedin.com/in/example-dana",
    outcome: "none",
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
    signal: {
      kind: "x-posts",
      label: "X post (thread author)",
      capturedAt: "5h ago",
      excerpt:
        "Solo technical founder. Do I hire a VP Eng now or get fractional senior help for 6 months first? Torn.",
    },
    dossier: {
      summary:
        "Second-time founder, seed-stage infra startup, 6 engineers. Asking the exact build-vs-borrow question fractional leadership answers. Active on X, replies to thoughtful DMs.",
      highlights: [
        "Explicitly comparing fractional vs. full-time - high-intent moment",
        "Seed stage: budget-sensitive, so framing matters",
        "Engages with technical-leadership content, not vendor pitches",
      ],
      links: [{ label: "X profile", href: "https://x.com/example-marcus" }],
    },
    draft: {
      promptVersion: "draft_v3",
      channel: "LinkedIn",
      body: "Hi Marcus - saw your thread on fractional vs. full-time VP Eng. The honest answer is usually 'fractional first' at 6 engineers, precisely so the full-time hire later has a shaped org to step into. Glad to walk through the trade-off for your stage if helpful.",
    },
    actionUrl: "https://www.linkedin.com/in/example-marcus",
    outcome: "sent",
  },
  {
    id: "p-1044",
    name: "Priya Nair",
    title: "Head of Product",
    company: "Lumen Health",
    location: "Toronto, CA",
    score: 4,
    scoreReason:
      "Decision-maker title at an ICP-fit company launching a new line; product-eng coordination gap implied.",
    signal: {
      kind: "linkedin-search",
      label: "People-search result",
      capturedAt: "1d ago",
      excerpt:
        "Head of Product at a Series A healthtech, posting about owning the launch of a new clinician-facing line.",
    },
    dossier: {
      summary:
        "Leads product at a Series A healthtech launching a clinician-facing line. Eng and product reporting lines are split with no shared technical leadership - a recurring fractional-CTO entry point.",
      highlights: [
        "New product line = delivery risk she owns",
        "No CTO listed; eng led by a senior IC",
        "Regulated domain - values a steady hand over speed",
      ],
      links: [
        { label: "LinkedIn profile", href: "https://www.linkedin.com/in/example-priya" },
        { label: "Lumen Health", href: "https://example.com/lumen-health" },
      ],
    },
    draft: {
      promptVersion: "draft_v3",
      channel: "LinkedIn",
      body: "Hi Priya - launching a clinician-facing line without a shared technical lead between product and eng is where delivery risk usually hides. I work with Series A teams in regulated domains on exactly that seam. Open to comparing notes if it's timely.",
    },
    actionUrl: "https://www.linkedin.com/in/example-priya",
    outcome: "none",
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
    signal: {
      kind: "x-posts",
      label: "X post (thread author)",
      capturedAt: "2d ago",
      excerpt:
        "Our biggest constraint isn't headcount - it's that nobody owns the architecture end-to-end.",
    },
    dossier: {
      summary:
        "EM at a mid-size industrial-software firm who publicly named an architecture-ownership gap. Influencer rather than buyer, but a credible warm intro path into the org.",
      highlights: [
        "Named the pain publicly - easy, specific opener",
        "Not the budget owner - treat as a relationship, not a pitch",
        "Could route to a VP/CTO over time",
      ],
      links: [
        { label: "X thread", href: "https://x.com/example-tom" },
        { label: "LinkedIn profile", href: "https://www.linkedin.com/in/example-tom" },
      ],
    },
    draft: {
      promptVersion: "draft_v3",
      channel: "LinkedIn",
      body: "Hi Tom - your line about nobody owning architecture end-to-end stuck with me; it's the quiet tax on a lot of growing eng orgs. Not selling anything - just enjoyed the framing and would read more of your thinking on it.",
    },
    actionUrl: "https://www.linkedin.com/in/example-tom",
    outcome: "none",
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
    signal: {
      kind: "linkedin-search",
      label: "Hiring post on LinkedIn",
      capturedAt: "6h ago",
      excerpt:
        "Non-technical founder here. Need senior technical leadership to steady a team that's grown faster than our process.",
    },
    dossier: {
      summary:
        "Non-technical CEO, 14-person team that outgrew its process, no senior technical leader. Profitable and design-led. The clearest fractional-CTO need in the batch.",
      highlights: [
        "Non-technical founder - the canonical fractional-CTO buyer",
        "Profitable: budget exists, urgency is real",
        "Process pain stated in her own words - mirror it back",
      ],
      links: [
        { label: "LinkedIn profile", href: "https://www.linkedin.com/in/example-sofia" },
        { label: "Renderbloom", href: "https://example.com/renderbloom" },
      ],
    },
    draft: {
      promptVersion: "draft_v3",
      channel: "LinkedIn",
      body: "Hi Sofia - 'grown faster than our process' is the exact moment a fractional technical lead earns their keep: enough seniority to steady the team, without committing to a full-time VP before you know the shape you need. I do this with founder-led teams your size. Worth a short chat?",
    },
    actionUrl: "https://www.linkedin.com/in/example-sofia",
    outcome: "none",
  },
];
