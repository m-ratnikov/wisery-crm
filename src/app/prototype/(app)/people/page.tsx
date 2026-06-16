"use client";

// People + Companies list (anchor view) - the broad browse/manage surface and the
// index into the workspace detail pages. Client component: tab switch, search,
// filtering, and sorting are local UI state. A row links to the person workspace
// (/people/[id]) or the company detail (/companies/[id]). Mock data only.

import { useMemo, useState } from "react";
import Link from "next/link";
import { peopleList } from "../_data/people";
import { companies } from "../_data/companies";
import { statusById } from "../_data/pipeline";
import { ScoreBadge } from "../_components/ScoreBadge";
import { SourceChip } from "../_components/SourceChip";
import { PersonTypeChip } from "../_components/PersonTypeChip";
import { PipelineStatusChip } from "../_components/PipelineStatus";
import type { PersonType } from "../_data/types";

type Tab = "people" | "companies";
type TypeFilter = "all" | PersonType;
type SortKey = "name" | "age";

export default function PeoplePage() {
  const [tab, setTab] = useState<Tab>("people");

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white dark:bg-zinc-950">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-1">
          <TabButton active={tab === "people"} onClick={() => setTab("people")}>
            People <Count>{peopleList().length}</Count>
          </TabButton>
          <TabButton active={tab === "companies"} onClick={() => setTab("companies")}>
            Companies <Count>{companies.length}</Count>
          </TabButton>
        </div>
        <span className="text-xs text-zinc-500">Click a row to open the workspace.</span>
      </header>
      {tab === "people" ? <PeopleTab /> : <CompaniesTab />}
    </div>
  );
}

function PeopleTab() {
  const rows = useMemo(() => peopleList(), []);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [monitoredOnly, setMonitoredOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("age");

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (query && !`${row.name} ${row.company} ${row.headline}`.toLowerCase().includes(query))
        return false;
      if (typeFilter !== "all" && row.type !== typeFilter) return false;
      if (monitoredOnly && !row.monitored) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      return a.ageHours - b.ageHours;
    });
  }, [rows, search, typeFilter, monitoredOnly, sortKey]);

  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className="w-56 shrink-0 space-y-5 overflow-y-auto border-r border-zinc-200 p-4 dark:border-zinc-800">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search people"
          className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-500"
        />
        <FilterGroup label="Type">
          <SegButton active={typeFilter === "all"} onClick={() => setTypeFilter("all")}>
            All
          </SegButton>
          <SegButton active={typeFilter === "prospect"} onClick={() => setTypeFilter("prospect")}>
            Prospects
          </SegButton>
          <SegButton active={typeFilter === "peer"} onClick={() => setTypeFilter("peer")}>
            Peers
          </SegButton>
        </FilterGroup>
        <FilterGroup label="Engagement">
          <label className="flex items-center gap-2 px-1 text-sm text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={monitoredOnly}
              onChange={(event) => setMonitoredOnly(event.target.checked)}
              className="accent-zinc-900 dark:accent-zinc-100"
            />
            Monitored only
          </label>
        </FilterGroup>
        <FilterGroup label="Sort by">
          {(["age", "name"] as SortKey[]).map((value) => (
            <SegButton key={value} active={sortKey === value} onClick={() => setSortKey(value)}>
              {value === "age" ? "Newest" : cap(value)}
            </SegButton>
          ))}
        </FilterGroup>
      </aside>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-400 dark:bg-zinc-900">
            <tr>
              <th className="py-2 pl-6 pr-3 font-medium">Person</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Pipeline</th>
              <th className="px-3 py-2 font-medium">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {visible.map((row) => {
              const status = statusById(row.statusId);
              return (
                <tr key={row.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <td className="py-2.5 pl-6 pr-3">
                    <Link href={`/prototype/people/${row.id}`} className="block">
                      <span className="flex items-center gap-2 font-medium text-zinc-900 group-hover:underline dark:text-zinc-100">
                        {row.name}
                        {row.monitored && (
                          <span title="Monitored - posts flow into the Feed" aria-hidden>
                            👁
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-zinc-500">
                        {row.headline}, {row.company}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <PersonTypeChip type={row.type} />
                  </td>
                  <td className="px-3 py-2.5">
                    {status && <PipelineStatusChip status={status} />}
                  </td>
                  <td className="px-3 py-2.5">
                    <SourceChip kind={row.source} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className="px-6 py-10 text-center text-sm text-zinc-400">
            Nothing matches the filter.
          </p>
        )}
      </div>
    </div>
  );
}

function CompaniesTab() {
  return (
    <div className="flex-1 overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-400 dark:bg-zinc-900">
          <tr>
            <th className="py-2 pl-6 pr-3 font-medium">Company</th>
            <th className="px-3 py-2 font-medium">Stage</th>
            <th className="px-3 py-2 font-medium">Industry</th>
            <th className="px-3 py-2 font-medium">Advisory fit</th>
            <th className="px-3 py-2 font-medium">Linked people</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {companies.map((company) => {
            const stage = company.firmographics.find((f) => f.label === "Stage")?.value ?? "-";
            const industry =
              company.firmographics.find((f) => f.label === "Industry")?.value ?? "-";
            return (
              <tr key={company.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-900">
                <td className="py-2.5 pl-6 pr-3">
                  <Link
                    href={`/prototype/companies/${company.id}`}
                    className="font-medium text-zinc-900 group-hover:underline dark:text-zinc-100"
                  >
                    {company.name}
                    {company.domain && (
                      <span className="ml-2 text-xs font-normal text-zinc-400">
                        {company.domain}
                      </span>
                    )}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-300">{stage}</td>
                <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-300">{industry}</td>
                <td className="px-3 py-2.5">
                  {company.advisory ? (
                    <span className="flex items-center gap-2">
                      <ScoreBadge score={company.advisory.score} />
                      <span className="text-xs text-zinc-400">advisory</span>
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-400">-</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-300">
                  {company.linkedPersonIds.length || "-"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-6 py-4 text-xs text-zinc-400">
        Fit is the company signal&apos;s advisory score (ADR-0022: the signal is the only scored
        thing). Expanding a company into its decision-makers is deferred (M2).
      </p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      }`}
    >
      {children}
    </button>
  );
}

function Count({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-black/10 px-1.5 text-[11px] dark:bg-white/15">{children}</span>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
        {label}
      </p>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function SegButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-1 text-left text-sm transition-colors ${
        active
          ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
          : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      }`}
    >
      {children}
    </button>
  );
}

function cap(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
