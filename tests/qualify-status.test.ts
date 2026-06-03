import { describe, expect, it } from "vitest";
import { gateStatus, prospectStatusSchema } from "@/lib/qualify/status";

// Pure unit tests for the score gate and the disposition vocabulary (ADR-0008, D5). These
// run without a database so the mutation sensor (stryker.config.mjs) can exercise status.ts
// fast and the gate boundary is asserted directly, not only via the qualify integration path.
describe("gateStatus (the >= 3 score gate, D5)", () => {
  it("qualifies a score at or above the bar", () => {
    expect(gateStatus(3)).toBe("qualified");
    expect(gateStatus(4)).toBe("qualified");
    expect(gateStatus(5)).toBe("qualified");
  });

  it("puts a score below the bar - including the -1 insufficient-data sentinel - below bar", () => {
    expect(gateStatus(2)).toBe("below_bar");
    expect(gateStatus(1)).toBe("below_bar");
    expect(gateStatus(-1)).toBe("below_bar");
  });

  it("treats exactly 3 as the inclusive boundary (not 2.9, not >3)", () => {
    expect(gateStatus(2.9)).toBe("below_bar");
    expect(gateStatus(3)).toBe("qualified");
  });
});

describe("prospectStatusSchema (the 7-value disposition vocabulary, ADR-0008)", () => {
  it("accepts every disposition value", () => {
    for (const s of ["new", "below_bar", "qualified", "queued", "acted", "dismissed", "closed"]) {
      expect(prospectStatusSchema.parse(s)).toBe(s);
    }
  });

  it("rejects the dropped pre-ADR-0008 values (scored / enriched / drafted are not statuses)", () => {
    for (const s of ["scored", "enriched", "drafted"]) {
      expect(prospectStatusSchema.safeParse(s).success).toBe(false);
    }
  });

  it("rejects an unknown value", () => {
    expect(prospectStatusSchema.safeParse("archived").success).toBe(false);
  });
});
