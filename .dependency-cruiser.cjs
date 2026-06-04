// Architectural fitness functions (quality-harness, ADR-aligned). These encode
// our seams as build-failing rules so the architecture is protected by the build,
// not by convention. Run via `npm run depcruise` (part of `verify`).
//
// Scope note: the server-only / client boundary is enforced by `next build` - the
// `server-only` package throws when a module is pulled into a client bundle - so
// it is not duplicated here. These rules cover layering, cycles, and runtime
// isolation, which dependency-cruiser is well suited to.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Circular dependencies are a maintainability and load-order hazard.",
      from: {},
      to: { circular: true },
    },
    {
      name: "lib-not-to-app",
      severity: "error",
      comment:
        "src/lib is the lower layer (runtime, data, domain). It must not depend on src/app (the web/UI layer). App depends on lib, never the reverse.",
      from: { path: "^src/lib" },
      to: { path: "^src/app" },
    },
    {
      name: "runtime-bootstrap-isolation",
      severity: "error",
      comment:
        "The Node-only bootstrap (src/lib/runtime) is reached only via instrumentation's dynamic import (ADR-0001), never statically from app or other lib code, so nothing Node-specific is statically reachable from the Edge compile.",
      from: { pathNot: "^(src/instrumentation\\.ts|src/lib/runtime)" },
      to: { path: "^src/lib/runtime" },
    },

    // --- Port/adapter rules: each protects a seam by the build (one per decision) ---
    // These forbid ANY module except the single composition point from importing a concrete
    // adapter, so the port can never be skipped - not just by the port file, but by a
    // pipeline, a Server Action, or any future consumer (the gap that lets a "save a hop"
    // import silently break the LLM-agnostic / inverted seam while `verify` stays green).
    {
      name: "signals-port-not-to-adapters",
      severity: "error",
      comment:
        "D-M (signal-ingestion): only registry.ts (the composition point wiring source.kind to an instance) may import concrete connectors. The SignalSource port (connector.ts), the scan pipeline, and every other consumer reach connectors only through the registry (dependency inversion).",
      from: { pathNot: "^src/lib/signals/(registry\\.ts$|connectors/)" },
      to: { path: "^src/lib/signals/connectors/" },
    },
    {
      // System-review FF-2 (2026-06-04): the port-side source-kind catalog (source-kinds.ts)
      // depends on the registry; a connector importing the catalog would invert the seam and
      // risk an adapter -> catalog -> registry -> adapter cycle that `verify` stays green on.
      // Per-kind config schemas shared by both live in the leaf source-kind-schemas.ts.
      name: "connectors-not-to-catalog",
      severity: "error",
      comment:
        "Connector adapters (src/lib/signals/connectors/) must not import the source-kind catalog (source-kinds.ts). Shared per-kind config schemas live in source-kind-schemas.ts, a leaf with no upward dependency.",
      from: { path: "^src/lib/signals/connectors/" },
      to: { path: "^src/lib/signals/source-kinds\\.ts$" },
    },
    {
      // System-review FF-4 (2026-06-04): a domain pipeline core must not reach the jobs facade.
      // Stage-to-stage handoff is injected at the composition root (bootstrap), so a core stays
      // role-agnostic and db-only (ADR-0001 peel-safety). Honored by convention before this rule.
      name: "pipeline-not-to-jobs",
      severity: "error",
      comment:
        "Domain pipeline cores (*/pipeline.ts) must not import the jobs facade (@/lib/jobs). The next-stage enqueue is injected at the composition root; a core depends on db only.",
      from: { path: "^src/lib/[^/]+/pipeline\\.ts$" },
      to: { path: "^src/lib/jobs(/|$)" },
    },
    {
      name: "llm-port-not-to-adapters",
      severity: "error",
      comment:
        "D-I (llm-provider): only index.ts (getLLM) may import a concrete LLM adapter (anthropic.ts / fake.ts). The LLMProvider port and all consumers depend on the port and receive an adapter by injection (dependency inversion, ADR-0003).",
      from: { pathNot: "^src/lib/llm/(index|anthropic|fake)\\.ts$" },
      to: { path: "^src/lib/llm/(anthropic|fake)\\.ts$" },
    },
    {
      name: "enrich-port-not-to-adapters",
      severity: "error",
      comment:
        "D-C (enrichment): only index.ts (getEnrichmentProvider) may import a concrete enrichment adapter (apify.ts / fake.ts). The EnrichmentProvider port and all consumers depend on the port and receive an adapter by injection (dependency inversion, ADR-0002/D4).",
      from: { pathNot: "^src/lib/enrich/(index|apify|fake)\\.ts$" },
      to: { path: "^src/lib/enrich/(apify|fake)\\.ts$" },
    },
  ],
  options: {
    doNotFollow: { path: "(^|/)node_modules/" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".js", ".jsx", ".ts", ".tsx"],
    },
  },
};
