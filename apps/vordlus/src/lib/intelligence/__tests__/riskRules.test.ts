import { describe, expect, it } from "vitest";
import { evaluateRiskRules } from "@/lib/intelligence/riskRules";

describe("non-compensating risk rules", () => {
  it("caps environmental safety in a 100-year flood zone", () => {
    const rules = evaluateRiskRules({ floodZone: "100-year" });
    const flood = rules.find((rule) => rule.id === "flood-100-year");

    expect(flood?.dimensionCap).toEqual({
      dimension: "environmentalSafety",
      maximum: 35,
    });
    expect(flood?.warning.severity).toBe("critical");
  });

  it("flags high radon for a basement-level dwelling", () => {
    const rules = evaluateRiskRules({ radonRisk: "high", dwellingLevel: "basement" });
    const radon = rules.find((rule) => rule.id === "radon-basement");

    expect(radon?.manualReviewRequired).toBe(true);
    expect(radon?.warning.message).toContain("radon");
  });

  it("caps legal score and confidence for a usage-permit contradiction", () => {
    const rules = evaluateRiskRules({ usagePermitStatus: "contradictory" });
    const permit = rules.find((rule) => rule.id === "usage-permit-contradiction");

    expect(permit?.dimensionCap?.dimension).toBe("legalConsistency");
    expect(permit?.confidenceCap).toBeLessThan(0.7);
  });

  it("reduces confidence for a material listing-to-registry area mismatch", () => {
    const rules = evaluateRiskRules({
      listingAreaM2: 62,
      registryAreaM2: 48,
    });

    expect(rules.some((rule) => rule.id === "area-mismatch")).toBe(true);
  });

  it("caps valuation confidence when comparable evidence is weak", () => {
    const rules = evaluateRiskRules({
      comparableCount: 2,
      averageComparableSimilarity: 0.5,
    });
    const weak = rules.find((rule) => rule.id === "weak-comparables");

    expect(weak?.confidenceCap).toBe(0.55);
  });

  it("warns when a fresh duplicate has a lower asking price", () => {
    const rules = evaluateRiskRules({
      askingPrice: 220000,
      lowestFreshDuplicatePrice: 205000,
    });
    const duplicate = rules.find((rule) => rule.id === "lower-priced-duplicate");

    expect(duplicate?.warning.message).toContain("€15,000");
    expect(duplicate?.dimensionCap?.dimension).toBe("pricingFairness");
  });
});
