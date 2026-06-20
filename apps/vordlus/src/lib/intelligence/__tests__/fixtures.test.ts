import { describe, expect, it } from "vitest";
import { INTELLIGENCE_FIXTURES } from "@/lib/intelligence/fixtures";
import { evaluateRiskRules } from "@/lib/intelligence/riskRules";

describe("intelligence fixtures", () => {
  it("contains the five required deterministic scenarios", () => {
    expect(INTELLIGENCE_FIXTURES.map((fixture) => fixture.id)).toEqual([
      "strong-first-home",
      "high-yield-maintenance-risk",
      "attractive-location-flood-risk",
      "insufficient-comparables",
      "conflicting-duplicate-price",
    ]);
  });

  it("marks every fixture as synthetic demo evidence", () => {
    expect(INTELLIGENCE_FIXTURES.every((fixture) => fixture.synthetic === true)).toBe(true);
    expect(
      INTELLIGENCE_FIXTURES.every((fixture) =>
        fixture.metrics.every((metric) => metric.evidenceKeys[0]?.startsWith("fixture.")),
      ),
    ).toBe(true);
  });

  it("causes the flood fixture to trigger a non-compensating rule", () => {
    const fixture = INTELLIGENCE_FIXTURES.find(
      (candidate) => candidate.id === "attractive-location-flood-risk",
    );
    const rules = evaluateRiskRules(fixture?.riskContext ?? {});

    expect(rules.some((rule) => rule.id === "flood-100-year")).toBe(true);
  });

  it("represents different profile tradeoffs", () => {
    const firstHome = INTELLIGENCE_FIXTURES.find(
      (candidate) => candidate.id === "strong-first-home",
    );
    const investor = INTELLIGENCE_FIXTURES.find(
      (candidate) => candidate.id === "high-yield-maintenance-risk",
    );

    expect(firstHome?.recommendedProfile).toBe("homebuyer");
    expect(investor?.recommendedProfile).toBe("investor");
  });
});
