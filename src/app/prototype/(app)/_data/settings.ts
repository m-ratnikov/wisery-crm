// Mock data for the Settings screen. Minimal account fields plus the connected
// scrapers (integrations) view. People-first MVP: the LinkedIn and X person
// scrapers are the connected integrations; company (CSV) and content (news)
// expansion are V2 (normalize-expand, roadmap M2), shown but not connectable yet.
// Read-only in MVP, expandable in V2. Hand-typed; the prototype never imports src/lib.

export interface Account {
  name: string;
  email: string;
  company: string;
  timezone: string;
}

export const account: Account = {
  name: "Michael Ratnikov",
  email: "michael@example.com",
  company: "Softwisery",
  timezone: "Asia/Bangkok (GMT+7)",
};

export type ScraperStatus = "connected" | "action-needed" | "v2";

export interface ConnectedScraper {
  id: string;
  name: string;
  kind: "person" | "company" | "content";
  status: ScraperStatus;
  detail: string;
}

// MVP connects the two person scrapers; company/content scrapers are V2.
export const scrapers: ConnectedScraper[] = [
  {
    id: "sc-linkedin",
    name: "LinkedIn",
    kind: "person",
    status: "connected",
    detail: "Session healthy. People search and post scans run on schedule.",
  },
  {
    id: "sc-x",
    name: "X (Twitter)",
    kind: "person",
    status: "connected",
    detail: "Connected. Thread-author and keyword scans enabled.",
  },
  {
    id: "sc-csv",
    name: "Company list (CSV)",
    kind: "company",
    status: "v2",
    detail: "Upload a company list and expand to decision-maker people. Arrives in V2.",
  },
  {
    id: "sc-news",
    name: "News / alerts",
    kind: "content",
    status: "v2",
    detail: "Turn article mentions into people. Arrives in V2.",
  },
];
