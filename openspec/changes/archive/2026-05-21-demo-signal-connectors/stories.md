## Personas

- **Consultant** (primary operating persona): runs outreach for their own book of business; wants relevant signals flowing in without touching code.
- **Signal source** (external system): a scraper/feed/API that emits raw items; named because its shape drives the connector contract.

## User stories

### Consultant
- As a consultant, I want to add and configure a signal source, so that new prospects surface without an engineer.
- As a consultant, I want a failing source to not block my other sources, so that one bad feed does not blind the pipeline.

## Primary journey

1. Consultant registers a source and its config - source config anchor view.
2. A scheduled scan job claims the source - in-process pg-boss worker (ADR-0001).
3. The connector fetches raw items and normalizes them to RawItems - background job.
4. Each RawItem is deduped and promoted to a Signal - background job.
5. New Signals enter qualification - downstream, out of scope here.

## Acceptance signals

- Add a source: can a new source type be added with config + one connector module, no pipeline edit? (extensibility QA)
- Isolation: if one source's scan throws, do other sources' scans still complete? (isolation QA)
- Idempotency: does re-running a scan produce zero duplicate Signals? (idempotency QA)
