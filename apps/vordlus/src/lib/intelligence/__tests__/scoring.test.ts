import { describe, expect, it } from "vitest";
import { buildProfilePolicy } from "@/lib/intelligence/profiles";
import { calculateScores } from "@/lib/intelligence/scoring";
import type { MetricResult } from "@/lib/intelligence/types";

const metrics: MetricResult[] = [
  {
    id: "price",
    dimension: "pricingFairness",
    score: 82,
    confidence: 0.8,
    reasons: ["Close to comparable median"],
    warnings: [],
    evidenceKeys: ["market.price"],
  },
  {
    id: "cost",
    dimension: "ownershipCost",
    score: 45,
    confidence: 0.9,
    reasons: ["High expected heating cost"],
    warnings: [],
    evidenceKeys: ["energy.class"],
  },
  {
    id: "investment",
    dimension: "investmentPotential",
    score: 91,
    confidence: 0.72,
    reasons: ["Strong rental yield"],
    warnings: [],
    evidenceKeys: ["market.rent_yield"],
  },
  {
    id: "environment",
    dimension: "environmentalSafety",
    score: 78,
    confidence: 0.95,
    reasons: ["No known material hazards"],
    warnings: [],
    evidenceKeys: ["environment.flood"],
  },
];

describe("personalized scoring", () => {
  it("keeps objective dimensions identical across profiles", () => {
    const homebuyer = calculateScores({
      metrics,
      profilePolicy: buildProfilePolicy("homebuyer", {}),
      riskRules: [],
      confidence: 0.8,
    });
    const investor = calculateScores({
      metrics,
      profilePolicy: buildProfilePolicy("investor", {}),
      riskRules: [],
      confidence: 0.8,
    });

    expect(homebuyer.objectiveDimensions).toEqual(investor.objectiveDimensions);
    expect(homebuyer.personalizedSuitability).not.toBe(investor.personalizedSuitability);
  });

  it("renormalizes available weights when dimensions are missing", () => {
    const result = calculateScores({
      metrics: metrics.slice(0, 2),
      profilePolicy: buildProfilePolicy("homebuyer", {}),
      riskRules: [],
      confidence: 0.7,
    });

    const weightTotal = result.contributions.reduce(
      (sum, contribution) => sum + contribution.normalizedWeight,
      0,
    );
    expect(weightTotal).toBeCloseTo(1, 8);
    expect(result.missingDimensions.length).toBeGreaterThan(0);
  });

  it("applies dimension caps after metrics are calculated", () => {
    const result = calculateScores({
      metrics,
      profilePolicy: buildProfilePolicy("homebuyer", {}),
      riskRules: [
        {
          id: "flood-100-year",
          version: 1,
          evidence: ["environment.flood_zone"],
          dimensionCap: { dimension: "environmentalSafety", maximum: 35 },
          warning: {
            code: "FLOOD_100_YEAR",
            message: "Flood risk",
            severity: "critical",
          },
          manualReviewRequired: true,
        },
      ],
      confidence: 0.8,
    });

    expect(result.objectiveDimensions.environmentalSafety?.score).toBe(35);
    expect(result.appliedCaps).toHaveLength(1);
  });

  it("caps final confidence from applicable risk rules", () => {
    const result = calculateScores({
      metrics,
      profilePolicy: buildProfilePolicy("investor", {}),
      riskRules: [
        {
          id: "weak-comparables",
          version: 1,
          evidence: [],
          confidenceCap: 0.55,
          warning: {
            code: "WEAK_COMPARABLES",
            message: "Weak evidence",
            severity: "warning",
          },
          manualReviewRequired: false,
        },
      ],
      confidence: 0.9,
    });

    expect(result.confidence).toBe(0.55);
  });

  it("provides contribution and weighting explanations", () => {
    const result = calculateScores({
      metrics,
      profilePolicy: buildProfilePolicy("homebuyer", {
        priorities: { ownershipCost: 2 },
      }),
      riskRules: [],
      confidence: 0.8,
    });

    expect(result.contributions.every((entry) => entry.explanation.length > 0)).toBe(true);
    expect(result.weightReasons.some((reason) => reason.dimension === "ownershipCost")).toBe(true);
  });
});
