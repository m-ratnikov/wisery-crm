# Module conventions - anatomy of a capability

How code is organised inside `src/lib`, and the internal layering the build enforces. This is
an engineering convention (a sibling of [engineering.md](engineering.md)), not part of the
architecture canon under `docs/architecture/`. The boundary rules described here live in
`.dependency-cruiser.cjs` and run in `npm run verify`.

## The unit: a vertical slice under `src/lib`

Business logic lives entirely under `src/lib` - the `lib-not-to-app` rule fences it from the
`src/app` delivery layer, so **to lift the product to another delivery surface you take
`src/lib`**. Inside it, code is organised by **capability** (a vertical slice: `signals`,
`qualify`, `draft`, `enrich`, `prospect`, ...), not by technical layer - one feature is one
folder, the inverse of a layer-major (`Data`/`Application`/`Infrastructure`) split. The
trade is deliberate: this makes *one capability* easy to read and lift in isolation, at the
cost of *one layer* not being a single folder.

## Internal layers

Within a slice, files fall into internal layers that depend inward only:

- **L0 - pure kernel** (no I/O: no DB connection, `jobs`, `log`, network, queue): port
  interfaces, DTO types, pure mappers, and pure domain rules. The portable core - liftable
  with zero infrastructure. It MAY read `db/schema` (DDL-as-data, e.g. enum values) and use
  type-only imports, since neither is a runtime I/O coupling.
- **L1 - application**: orchestration cores and read-models. May use the DB directly and the
  port *factories*, but not concrete adapters or the jobs facade.
- **L2 - infrastructure / adapters**: vendor adapters, the `*-queue.ts` wrappers, the pg-boss
  facade (`jobs/index.ts`), the logger.
- **composition root** (`runtime/bootstrap.ts`, the `index.ts` factories, `registry.ts`): the
  only place a concrete adapter is chosen.

Plus `db/**` (data) and `src/app/**` (delivery).

The portable kernel the L0 layer protects is the answer to "where is the environment-agnostic
business logic": the ports plus the pure rules and mappers. The orchestration cores (L1) are
decoupled from every volatile collaborator (LLM, enrichment, scraper, queue - all behind
ports) but are deliberately coupled to Drizzle/Postgres directly; we invert what varies, not
the settled datastore. (Background: this is dependency inversion applied by judgment, not the
dogmatic "domain references nothing" of layered .NET.)

## Role markers (the naming convention)

Files that play a *structural role* carry a universal name, reused in every slice. These are
the convention, and what the boundary rules match on:

| Marker | Role | Layer |
| --- | --- | --- |
| `provider.ts` / `connector.ts` | port (interface) | L0 |
| `*-view.ts` | DTO types (client-safe) | L0 |
| `*-map.ts` | pure mapper (row -> DTO) | L0 |
| `read.ts` | read-model (query -> DTO) | L1 |
| `pipeline.ts` | orchestration core | L1 |
| `*-queue.ts` | job / worker wrapper | L2 |
| adapter under `adapters/` or `connectors/` | adapter | L2 |
| `index.ts` | composition factory (`getX`) | root |

`index.ts` is a *factory*, never a re-export barrel (barrels slow the Next build and invite
cycles).

## Domain files keep their own names

The business-logic files inside a slice - `scorer.ts`, `drafter.ts`, `status.ts`,
`identity.ts` - are named in the **ubiquitous language**, not by stereotype, and are
deliberately *not* a naming convention (`scorer` says more than `qualify-service` would).
Their layer is set by content: most are L1 (the residual), and the few pure ones
(`qualify/status.ts`, `prospect/identity.ts`, `icp/schema.ts`,
`signals/source-kind-schemas.ts`, a connector's normalize/schema half) are listed explicitly
in the L0 boundary rule.

We do **not** adopt .NET/Nest stereotype subfolders (`Commands/`, `Dtos/`, `Services/`): our
slices are 2-10 files, where flat + role markers reads better than a tree of one-file folders.
**A role earns a subfolder only at its third file** (the `signals/connectors/` precedent - two
adapters stay flat, three move into a folder).

## DTO naming

Types derive from their Zod schema (`z.infer`), so a hand-written DTO class is rare. The
distinctions worth a suffix:

- `*View` - a read / output shape (`ScanRunView`).
- `*ListItem` - the lean shape for a list row, distinct from the heavier detail shape
  (`ProspectListItem`, `QueueItem`).
- `*Schema` + the inferred `*Input` - a mutation/input contract; at an HTTP route,
  `*Request` / `*Response` for the wire contract.

We do **not** use `*Dto` (a Nest/.NET idiom, foreign here) or `*Command` (a CQRS/MediatR
artifact - Server Actions are our commands).

## Enforcement

The internal layering is build-enforced, not just convention - see the rules in
`.dependency-cruiser.cjs` and the [Architectural boundaries](engineering.md#architectural-boundaries-dependency-cruiser)
section of engineering.md:

- `pure-kernel-no-runtime-io` - L0 files must not have a runtime dependency on the DB
  connection, the jobs facade, or the logger (type-only and `db/schema` allowed).
- `jobs-facade-only-from-wrappers` - only `*-queue.ts` and the composition root import the
  jobs facade.
- the per-port `*-not-to-adapters` rules - only the composition point imports a concrete
  adapter.
