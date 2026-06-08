import { describe, expect, it } from "vitest";
import { gateStatus } from "@/lib/qualify/status";

// Pure unit tests for the score gate (D5). These run without a database so the mutation sensor
// (stryker.config.mjs) can exercise status.ts fast and the gate boundary is asserted directly, not
// only via the qualify integration path. The old `prospectStatusSchema` text enum was retired
// (ADR-0020): the pipeline position is a DB-backed vocabulary now, and qualification is a read.
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
