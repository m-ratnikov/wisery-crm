# ADR-0004: Signal sources plug in via a normalize-at-the-edge connector contract

- Status: proposed
- Date: 2026-05-21
- Supersedes: none
- Source: system-design.md "Decisions and trade-offs"

## Context

The pipeline needs to ingest from many external sources (scrapers, feeds, APIs) that
differ in auth, paging, and payload shape. We want adding a source to be config plus a
small module, not a pipeline fork, and we want one failing source not to stall others.
ADR-0001 already commits us to an in-process pg-boss worker on Postgres.

## Decision

We will define a connector contract where each source type ships a Connector module that
owns auth and paging and returns normalized RawItems; the pipeline owns dedup and Signal
persistence. Sources are config-as-data rows; the worker runs one scan job per Source so
pg-boss isolates and retries failures per source.

## Consequences

- Dedup and downstream stages stay source-agnostic; new sources do not touch them.
- Adding a source type still requires a connector module (code), not pure config.
- Per-source jobs add job rows but give failure isolation and a clean path to peel the
  worker into a standalone process (ADR-0001) without changing the contract.
