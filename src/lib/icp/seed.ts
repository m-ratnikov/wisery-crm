import "server-only";
import { getActiveRubric, getUserProfile, saveRubric, saveUserProfile } from "@/lib/icp/config";
import type { RubricCriteria, UserProfileData } from "@/lib/icp/schema";

// Starter ICP so the pipeline can run before hand-entry (icp-config D-G). This restates
// the fractional-CTO ICP from the prototype src/app/prototype/(app)/_data/icp-config.ts
// (itself the port of job-monitor's ICP_SYSTEM_PROMPT + gtm.md). The prototype is a mock
// that never imports src/lib, so the content is deliberately copied at that boundary;
// once seeded, this is the source of truth. Keep the two in rough sync by hand.

const STARTER_RUBRIC_NAME = "Fractional CTO / technical leadership ICP";

const STARTER_CRITERIA: RubricCriteria = {
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

const STARTER_PROFILE: UserProfileData = {
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

// Idempotent: seeds only what is missing, so re-running changes nothing.
export async function seedIcpConfig(): Promise<void> {
  if (!(await getActiveRubric())) {
    await saveRubric({ name: STARTER_RUBRIC_NAME, criteria: STARTER_CRITERIA });
  }
  if (!(await getUserProfile())) {
    await saveUserProfile(STARTER_PROFILE);
  }
}
