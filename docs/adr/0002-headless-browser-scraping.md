# ADR-0002: Headless-browser scraping runs as an on-demand child process of the worker

- Status: accepted
- Date: 2026-05-22 (revised 2026-05-23 - reframed from a standing "separately deployable service over HTTP" to an on-demand child process; accepted + promoted 2026-05-24)
- Supersedes: none (extends ADR-0001)
- Source: openspec/changes/c4-level2-architecture/system-design.md (Decisions - "Headless browser as an on-demand child process") and the C4 L2 architecture review.

## Context

D4 puts scraping and enrichment behind the `SignalSource` / `EnrichmentProvider` interfaces and allows self-hosting a headless browser as an alternative to a managed provider such as Apify. ADR-0001 makes in-process the default for background work and names HTML parsing as the example of CPU-bound work that goes on a `worker_threads` pool inside the process.

A full headless browser is far heavier than parsing: high memory, its own lifecycle, and a wide crash blast radius. It cannot share the worker's event loop. But "cannot share the event loop" does not imply "must be a standing separate service" - the question the L2 view must settle is *what kind* of separation.

The scraping engine itself (orchestration, the D4 adapters, normalization) is ordinary async logic, and API/HTTP-based source fetching is plain I/O - both belong in the worker process. Only the browser is the problem.

## Decision

Self-hosted headless-browser scraping runs **in-process via Playwright, which launches the browser as a separate OS process on demand** - not in the worker's event loop, and not as a standing separate service.

- The **scraping engine and all API/HTTP fetching stay in the worker process** (in-process).
- When a self-host target needs a real browser, the worker (from within a pg-boss job) calls Playwright **`launch()`**, which spawns and supervises a headless browser (Chromium) as a **separate OS process over a pipe (CDP)**; the worker drives it through the in-process Playwright library and **`close()`s it per scrape** to reap it. A browser crash surfaces in-process as a rejected promise / `disconnected` event, not a worker crash. We do not stand up a `launchServer()` ws endpoint - in-process `launch()` already puts the browser's weight and crash blast radius in its own OS process.
- The browser process runs on the **same host** as the worker; the main logic never leaves the main host.
- The **managed provider (e.g. Apify) is the default** for hardened/authenticated targets (keeping detection/ban risk off the user's own account, D2); self-host is the escape hatch behind the same D4 ports, and the two are interchangeable adapters. We use **Playwright** over Puppeteer when self-hosting.

## Consequences

- This is an **L3 isolation mechanism** of the worker - a sibling of the `worker_threads` pool - **not a separate L2 container**. By the container test ("something that has to be running"), an on-demand child spawned per-need and then reaped is not a container. So the L2 view draws no separate scraper box: the worker reaches sources directly and spawns a browser child only for the browser case.
- It **extends** ADR-0001's in-process default rather than reversing it: everything stays in the one process except the transient browser child, which exists solely to keep the browser's weight and crash blast radius off the worker's event loop.
- A browser crash is **contained in that OS process** and fails only that one scrape - it surfaces in-process as a rejected promise / `disconnected` event; the surrounding pg-boss job retries and dead-letters it, and the worker is unaffected.
- **No standing service and no extra host** in the default shape - but it is **not zero-ops**. Playwright browser processes are heavy (hundreds of MB of RSS, climbing under load) and can orphan/zombie on crash or abrupt shutdown, so each scrape wraps the browser in `try/finally { close() }` with a hard timeout that force-kills, runs under an init/`tini`-style reaper for orphans, and is watched by a process-count / RSS check. Concurrent browser processes are **capped by a semaphore sized against host memory** - the same kind of sizing constraint as pg-boss's pool `max` against the connection cap - because the browser shares the worker's host and an uncapped burst (e.g. a retry storm) could OOM the single web+worker failure domain. A `launchServer()` pool or a dedicated browser host is a later scaling option, not the default.
- Session material for authenticated self-host scraping lives in the **browser process** - on the worker's host, not an isolated unit - so that secret surface is co-located with the worker. Defaulting hardened/authenticated targets to the managed provider (D2) keeps the riskiest credentials off the self-host path in the first place.
- Process-spawn overhead is paid per browser-need; if it bites, the first lever is reusing one warm browser via **`browser.newContext()` per scrape** (a context is the isolation primitive, cheaper than a process, though it widens the crash blast radius to in-flight scrapes on that browser) before a `launchServer()` pool or a dedicated host. Accepted as the cost of event-loop and crash isolation.
