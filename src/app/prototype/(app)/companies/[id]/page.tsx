"use client";

// Company detail. A Company is first-class (ADR-0016); its fit is the company
// signal's advisory score (ADR-0022: the signal is the only scored thing). The
// expansion job that turns a company into its decision-makers is deferred (M2), so
// "Expand to people" is shown as a deferred affordance. Client component for
// consistency with the rest of the app; mock data only.

import { useParams } from "next/navigation";
import Link from "next/link";
import { getCompany } from "../../_data/companies";
import { getPerson } from "../../_data/people";
import { ScoreBadge } from "../../_components/ScoreBadge";

export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const company = getCompany(params.id);

  if (!company) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-zinc-500">
        <p>No such company in the mock dataset.</p>
        <Link href="/prototype/people" className="font-medium text-zinc-900 dark:text-zinc-100">
          Back to people &rarr;
        </Link>
      </div>
    );
  }

  const linked = company.linkedPersonIds.map(getPerson).filter((person) => person !== undefined);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1700px] px-6 py-8 lg:px-10">
        <Link
          href="/prototype/people?tab=companies"
          className="text-xs text-zinc-500 underline-offset-2 hover:underline"
        >
          &larr; Companies
        </Link>

        <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-800 ring-1 ring-inset ring-violet-600/20 dark:bg-violet-500/15 dark:text-violet-300">
              Company
            </span>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">{company.name}</h1>
            <p className="text-sm text-zinc-500">
              {company.domain ?? "no domain"}
              {" · "}
              {company.origin === "manual" ? "Added by hand" : "From a company signal"}
              {" · created "}
              {company.createdAt}
            </p>
          </div>
          {company.linkedinUrl && (
            <a
              href={company.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Company on LinkedIn
            </a>
          )}
        </header>

        <div className="mt-5 columns-1 gap-5 md:columns-2 [&>*]:mb-5 [&>*]:break-inside-avoid">
          {company.advisory && (
            <Section title="Advisory fit" right={<ScoreBadge score={company.advisory.score} />}>
              <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                {company.advisory.reason}
              </p>
              <p className="mt-2 text-xs italic text-zinc-400">
                The signal&apos;s advisory fit (ADR-0022) - a cheap firmographic pre-check before
                paying to expand into people.
              </p>
            </Section>
          )}

          <Section title="Firmographics">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {company.firmographics.map((fact) => (
                <div key={fact.label} className="flex justify-between gap-3 text-sm">
                  <dt className="text-zinc-400">{fact.label}</dt>
                  <dd className="text-right font-medium text-zinc-700 dark:text-zinc-200">
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>
          </Section>

          {company.signal && (
            <Section title="Why surfaced">
              <p className="text-xs text-zinc-400">
                {company.signal.label} · {company.signal.capturedAt}
              </p>
              <blockquote className="mt-2 border-l-2 border-zinc-200 pl-3 text-sm italic leading-6 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                {company.signal.excerpt}
              </blockquote>
            </Section>
          )}

          <Section
            title="People"
            right={
              <button
                type="button"
                disabled
                title="Company-to-people expansion is deferred (M2)"
                className="cursor-not-allowed rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-400 dark:border-zinc-700"
              >
                Expand to people · soon
              </button>
            }
          >
            {linked.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No people linked yet. The expansion job (firmographic pre-check, then expand only
                decision-maker titles) is deferred to M2.
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {linked.map((person) => (
                  <li key={person.id}>
                    <Link
                      href={`/prototype/people/${person.id}`}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm hover:opacity-80"
                    >
                      <span>
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {person.name}
                        </span>
                        <span className="block text-xs text-zinc-500">{person.headline}</span>
                      </span>
                      <span className="text-zinc-400" aria-hidden>
                        &rarr;
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}
