import { describe, expect, it } from "vitest";
import { registeredKinds } from "@/lib/signals/registry";
import {
  buildAndValidateConfig,
  getSourceKindDef,
  listConnectableKinds,
} from "@/lib/signals/source-kinds";

// The per-kind settings contract (source-connection). Pure logic, no DB: the catalog/registry
// sync, descriptor/schema agreement, and the validate-on-connect boundary.

describe("source-kind catalog", () => {
  it("declares settings for every registered connector kind", () => {
    // No scannable kind may lack a wizard form: every registered connector has a catalog def.
    for (const kind of registeredKinds()) {
      expect(getSourceKindDef(kind), `catalog entry for "${kind}"`).toBeDefined();
    }
  });

  it("only offers connectable kinds and omits the Zod schema", () => {
    const kinds = listConnectableKinds();
    expect(kinds.map((k) => k.kind)).toContain("fixture");
    for (const k of kinds) {
      expect(registeredKinds()).toContain(k.kind);
      // Client-safe projection: descriptors only, no non-serializable schema.
      expect(k).not.toHaveProperty("configSchema");
      expect(Array.isArray(k.fields)).toBe(true);
    }
  });

  it("accepts a config built from each kind's own declared fields (descriptor/schema drift guard)", () => {
    for (const k of listConnectableKinds()) {
      const values = Object.fromEntries(k.fields.map((f) => [f.name, "sample"]));
      expect(() => buildAndValidateConfig(k.kind, (f) => values[f] ?? "")).not.toThrow();
    }
  });
});

describe("buildAndValidateConfig", () => {
  it("builds the fixture config from its declared fields", () => {
    const values: Record<string, string> = { name: "Demo", query: "founders" };
    const config = buildAndValidateConfig("fixture", (f) => values[f] ?? "");
    expect(config).toEqual({ name: "Demo", query: "founders" });
  });

  it("rejects an unknown kind", () => {
    expect(() => buildAndValidateConfig("not-a-kind", () => "")).toThrow(/unknown source kind/);
  });
});
