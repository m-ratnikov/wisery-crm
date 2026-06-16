// Mock companies for the prototype. A Company is a first-class entity created when a
// company signal is approved (ADR-0016). Company fit is the signal's advisory score
// (ADR-0022: the signal is the only scored thing). The company-to-people expansion
// job is deferred (M2), so `employees` is shown as a deferred affordance, not live data.

import type { ScoreOrInsufficient } from "./types";

export interface CompanyDetail {
  id: string;
  name: string;
  domain: string | null;
  linkedinUrl: string | null;
  origin: "signal" | "manual";
  // Firmographics are provider-shaped JSON; here a flat label/value list.
  firmographics: { label: string; value: string }[];
  // Advisory company-rubric fit captured at triage (a hint on the signal, ADR-0022).
  advisory: { score: ScoreOrInsufficient | null; reason: string } | null;
  signal?: { label: string; capturedAt: string; excerpt: string };
  // Linked people (manual links here; the expansion job that populates this is M2).
  linkedPersonIds: string[];
  createdAt: string;
}

export const companies: CompanyDetail[] = [
  {
    id: "co-northwind",
    name: "Northwind Labs",
    domain: "northwindlabs.com",
    linkedinUrl: "https://www.linkedin.com/company/example-northwind",
    origin: "signal",
    firmographics: [
      { label: "Stage", value: "Series B" },
      { label: "Headcount", value: "~140" },
      { label: "Eng team", value: "20 -> 50 (scaling)" },
      { label: "Industry", value: "Developer infrastructure" },
      { label: "HQ", value: "Austin, TX" },
      { label: "Last raise", value: "$34M (Bessemer, 3 weeks ago)" },
    ],
    advisory: {
      score: 5,
      reason:
        "Fresh Series B, eng org doubling, public org-design gap. Strong firmographic fit before expanding to people.",
    },
    signal: {
      label: "CSV of target companies",
      capturedAt: "1w ago",
      excerpt: "Northwind Labs - dev-infra, Series B, hiring senior eng leadership.",
    },
    linkedPersonIds: ["per-dana"],
    createdAt: "1w ago",
  },
  {
    id: "co-lumen",
    name: "Lumen Health",
    domain: "lumenhealth.io",
    linkedinUrl: "https://www.linkedin.com/company/example-lumen",
    origin: "signal",
    firmographics: [
      { label: "Stage", value: "Series A" },
      { label: "Headcount", value: "~45" },
      { label: "Industry", value: "Clinician-facing healthtech" },
      { label: "HQ", value: "Toronto, CA" },
      { label: "Signal", value: "Launching a new product line" },
    ],
    advisory: {
      score: 4,
      reason:
        "Regulated healthtech launching a new line with split product/eng reporting and no shared technical lead - a recurring fractional-CTO entry point.",
    },
    signal: {
      label: "CSV of target companies",
      capturedAt: "5d ago",
      excerpt: "Lumen Health - Series A healthtech, new clinician-facing line, no CTO listed.",
    },
    linkedPersonIds: ["per-priya"],
    createdAt: "5d ago",
  },
  {
    id: "co-aperture",
    name: "Aperture Robotics",
    domain: "aperture.dev",
    linkedinUrl: null,
    origin: "signal",
    firmographics: [
      { label: "Stage", value: "Seed" },
      { label: "Headcount", value: "~18" },
      { label: "Industry", value: "Industrial automation" },
      { label: "HQ", value: "Remote (US)" },
    ],
    advisory: {
      score: 2,
      reason:
        "Too early and hardware-heavy; the fractional-CTO motion fits software-scaling pain better. Kept for the record, low priority.",
    },
    signal: {
      label: "CSV of target companies",
      capturedAt: "3d ago",
      excerpt: "Aperture Robotics - seed, industrial automation.",
    },
    linkedPersonIds: [],
    createdAt: "3d ago",
  },
];

export function getCompany(id: string): CompanyDetail | undefined {
  return companies.find((company) => company.id === id);
}
