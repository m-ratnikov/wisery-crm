// Mock Feed: posts from monitored people (ADR-0018). The Feed is the engagement
// analog of the Queue - instead of triaging signals into entities, you triage posts
// into AI-drafted comments that you post by hand (D2). A Post accrues many Comment
// drafts (regenerable); several "generated" drafts may coexist, you post one and may
// dismiss the rest. personId/personName join back to people.ts (the monitored set).

import type { CommentStatus, PersonType } from "./types";

export interface FeedComment {
  id: string;
  body: string;
  status: CommentStatus;
  promptVersion: string;
  createdAt: string;
}

export interface FeedPost {
  id: string;
  personId: string;
  personName: string;
  personHeadline: string;
  personType: PersonType;
  externalUrl: string;
  content: string;
  postedAt: string;
  fetchedAt: string;
  comments: FeedComment[];
}

export const feedPosts: FeedPost[] = [
  {
    id: "post-lena-1",
    personId: "per-lena",
    personName: "Lena Fischer",
    personHeadline: "Fractional CTO & writer on engineering leadership",
    personType: "peer",
    externalUrl: "https://www.linkedin.com/posts/example-lena-centralize",
    content:
      "The hardest part of scaling an eng org isn't hiring - it's deciding what NOT to centralize. Every centralized function you add is a queue you now have to staff and defend. The teams that scale cleanly centralize ruthlessly little and re-decide it every six months.",
    postedAt: "3h ago",
    fetchedAt: "2h ago",
    comments: [
      {
        id: "cmt-lena-1a",
        body: "The 're-decide every six months' part is what most teams miss - they treat the first org design as permanent. I've seen the opposite failure too: under-centralizing security/identity and paying for it later. Curious where you draw that line.",
        status: "generated",
        promptVersion: "comment_v2",
        createdAt: "1h ago",
      },
      {
        id: "cmt-lena-1b",
        body: "Strong take. The queue-you-have-to-defend framing is exactly right - every platform team starts as a gift and becomes a toll booth if nobody owns its scope.",
        status: "generated",
        promptVersion: "comment_v2",
        createdAt: "55m ago",
      },
    ],
  },
  {
    id: "post-lena-2",
    personId: "per-lena",
    personName: "Lena Fischer",
    personHeadline: "Fractional CTO & writer on engineering leadership",
    personType: "peer",
    externalUrl: "https://www.linkedin.com/posts/example-lena-oncall",
    content:
      "Unpopular opinion: a brand-new team should not own on-call for a service they didn't build. Ownership without context is just blame with a pager.",
    postedAt: "1d ago",
    fetchedAt: "22h ago",
    comments: [
      {
        id: "cmt-lena-2a",
        body: "'Blame with a pager' is going in my notes. The fix that worked for me was a 4-6 week shadow period where the building team stays primary - context transfers, the pager doesn't, until it's earned.",
        status: "posted",
        promptVersion: "comment_v2",
        createdAt: "20h ago",
      },
    ],
  },
  {
    id: "post-raj-1",
    personId: "per-raj",
    personName: "Raj Patel",
    personHeadline: "Founder-coach, posts on the 0-to-1 eng org",
    personType: "peer",
    externalUrl: "https://x.com/example-raj/status/200",
    content:
      "Founders keep asking me when to make their first senior eng hire. The answer is almost never 'now'. You hire senior when the cost of NOT having judgment in the room exceeds the cost of the salary - and at 5 engineers it rarely does.",
    postedAt: "8h ago",
    fetchedAt: "7h ago",
    comments: [
      {
        id: "cmt-raj-1a",
        body: "This matches what I see. The cheaper move at 5 engineers is borrowing senior judgment a day or two a week rather than buying it full-time before the shape of the org is even clear. Full-time senior too early often just adds process the team isn't ready for.",
        status: "generated",
        promptVersion: "comment_v2",
        createdAt: "30m ago",
      },
    ],
  },
  {
    id: "post-raj-2",
    personId: "per-raj",
    personName: "Raj Patel",
    personHeadline: "Founder-coach, posts on the 0-to-1 eng org",
    personType: "peer",
    externalUrl: "https://x.com/example-raj/status/201",
    content: "If your standup takes 30 minutes with 6 people, the problem isn't the standup.",
    postedAt: "2d ago",
    fetchedAt: "2d ago",
    comments: [],
  },
  {
    id: "post-sofia-1",
    personId: "per-sofia",
    personName: "Sofia Alvarez",
    personHeadline: "Co-founder & CEO, Renderbloom",
    personType: "prospect",
    externalUrl: "https://www.linkedin.com/posts/example-sofia-process",
    content:
      "Six months ago our releases were a coin flip. This week we shipped three times with zero rollbacks. Turns out 'we need more engineers' was never the real problem - we needed someone to own how the work flows. Grateful for the steady hands that got us here.",
    postedAt: "5h ago",
    fetchedAt: "4h ago",
    comments: [
      {
        id: "cmt-sofia-1a",
        body: "This is the part founders underestimate - predictable delivery is mostly a flow problem, not a headcount problem. Great to see it click for the team, Sofia.",
        status: "generated",
        promptVersion: "comment_v2",
        createdAt: "20m ago",
      },
    ],
  },
];

export function postsForPerson(personId: string): FeedPost[] {
  return feedPosts.filter((post) => post.personId === personId);
}
