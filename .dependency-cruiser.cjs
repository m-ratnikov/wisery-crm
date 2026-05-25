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

    // --- Extension point: port/adapter rules land here as seams are introduced ---
    // When the D4/D9 ports arrive, add rules such as:
    //   adapters (src/lib/**/adapters) may depend on ports, never the reverse;
    //   the domain may not depend on any adapter (depend on the port interface).
    // Keep each rule named and commented with the decision it enforces.
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
