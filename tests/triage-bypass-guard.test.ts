import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { glob } from "tinyglobby";

// Fitness function (system-review 2026-06-08, lens A): qualifySignal creates a Person directly from
// a Signal, bypassing the universal triage gate (ADR-0013). It survives only as a test-only helper;
// no production module may import or call it, or the pre-triage auto-create path is silently
// re-armed. Mechanized here because dependency-cruiser is module-level and qualifySignal shares its
// module with qualifyProspect (a legitimate Server-Action import).
describe("triage bypass guard", () => {
  it("no production module under src/ references qualifySignal (only its own definition)", async () => {
    const files = await glob("src/**/*.{ts,tsx}", { cwd: process.cwd() });
    const offenders = files
      .filter((f) => !f.endsWith("qualify/pipeline.ts"))
      .filter((f) => /\bqualifySignal\b/.test(readFileSync(join(process.cwd(), f), "utf8")));
    expect(offenders, `qualifySignal is test-only; remove these production references`).toEqual([]);
  });
});
