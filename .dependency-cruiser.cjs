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
      // Generalises System-review FF-4 (2026-06-04) from pipeline.ts to all of src/lib: the
      // next-stage handoff is injected at the composition root (bootstrap), so a core stays
      // role-agnostic and db-only (ADR-0001 peel-safety, ADR-0009). Only the *-queue.ts wrappers
      // and the composition root touch the facade; the app layer (delivery) may read it for the
      // monitor, so this is scoped to src/lib. Targets index.ts (the runtime facade), not the
      // L0 activity-view/-map types in the same dir.
      name: "jobs-facade-only-from-wrappers",
      severity: "error",
      comment:
        "Only *-queue.ts wrappers and the composition root (src/lib/runtime) may import the jobs facade (src/lib/jobs/index.ts). Orchestration cores and read-models depend on db only; the next-stage enqueue is injected at the composition root (ADR-0001, ADR-0009). See docs/module-conventions.md.",
      from: { path: "^src/lib/", pathNot: "(-queue\\.ts$|^src/lib/runtime/|^src/lib/jobs/)" },
      to: { path: "^src/lib/jobs/index\\.ts$" },
    },
    {
      // The L0 pure kernel - ports (provider.ts/connector.ts), DTO types (*-view.ts), pure mappers
      // (*-map.ts), and the listed pure domain-rule files - is the portable core. It must have NO
      // RUNTIME dependency on the database CONNECTION (db/index, i.e. getDb/the pool), the jobs
      // facade, or the logger; type-only imports are erased at runtime, so they are exempt
      // (dependencyTypesNot). db/schema is deliberately NOT a target: it is pure DDL-as-data, and
      // the kernel reads its enum values (e.g. signalKind) as the single source of truth rather
      // than duplicating them (knowledge-DRY). Adapters and src/app are already barred for all of
      // lib by the *-not-to-adapters and lib-not-to-app rules. Makes the liftable kernel a
      // build-failing contract (docs/module-conventions.md).
      name: "pure-kernel-no-runtime-io",
      severity: "error",
      comment:
        "L0 pure-kernel files (ports, *-view, *-map, and the listed pure domain rules) must not have a runtime dependency on the DB connection (src/lib/db/index.ts), the jobs facade, or the logger, so the domain core stays portable. db/schema (DDL-as-data) and type-only imports are allowed. See docs/module-conventions.md.",
      from: {
        path: "^src/lib/.*(-view|-map)\\.ts$|^src/lib/[^/]+/(provider|connector)\\.ts$|^src/lib/qualify/status\\.ts$|^src/lib/prospect/identity\\.ts$|^src/lib/icp/schema\\.ts$|^src/lib/signals/source-kind-schemas\\.ts$|^src/lib/signals/connectors/linkedin-jobs\\.ts$",
      },
      to: {
        path: "^src/lib/db/index\\.ts$|^src/lib/jobs/index\\.ts$|^src/lib/log",
        dependencyTypesNot: ["type-only"],
      },
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
