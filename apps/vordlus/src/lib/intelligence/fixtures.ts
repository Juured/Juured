import type { UserProfile } from "./profiles";
import type { RiskContext } from "./riskRules";
import type { MetricResult, ScoreDimension } from "./types";

export type IntelligenceFixture = {
  id: string;
  title: string;
  synthetic: true;
  recommendedProfile: UserProfile;
  metrics: MetricResult[];
  riskContext: RiskContext;
};

function metric(
  fixtureId: string,
  dimension: ScoreDimension,
  score: number,
  confidence: number,
  reason: string,
): MetricResult {
  return {
    id: `${fixtureId}-${dimension}`,
    dimension,
    score,
    confidence,
    reasons: [reason],
    warnings: [],
    evidenceKeys: [`fixture.${fixtureId}.${dimension}`],
  };
}

export const INTELLIGENCE_FIXTURES: IntelligenceFixture[] = [
  {
    id: "strong-first-home",
    title: "Strong first home with moderate pricing",
    synthetic: true,
    recommendedProfile: "homebuyer",
    metrics: [
      metric("strong-first-home", "pricingFairness", 78, 0.82, "Near the local comparable median."),
      metric("strong-first-home", "ownershipCost", 86, 0.88, "Efficient expected monthly costs."),
      metric("strong-first-home", "legalConsistency", 95, 0.95, "Registry facts are consistent."),
      metric("strong-first-home", "environmentalSafety", 90, 0.9, "No material hazards found."),
      metric("strong-first-home", "locationAccessibility", 84, 0.8, "Strong transit access."),
    ],
    riskContext: {
      floodZone: "none",
      radonRisk: "low",
      usagePermitStatus: "valid",
      comparableCount: 10,
      averageComparableSimilarity: 0.84,
    },
  },
  {
    id: "high-yield-maintenance-risk",
    title: "High-yield investor property with maintenance risk",
    synthetic: true,
    recommendedProfile: "investor",
    metrics: [
      metric("high-yield-maintenance-risk", "investmentPotential", 92, 0.78, "Strong modeled yield."),
      metric("high-yield-maintenance-risk", "liquidity", 82, 0.8, "Healthy rental demand."),
      metric("high-yield-maintenance-risk", "buildingQuality", 42, 0.72, "Older technical systems."),
      metric("high-yield-maintenance-risk", "ownershipCost", 38, 0.7, "Maintenance reserve is high."),
    ],
    riskContext: {
      floodZone: "none",
      usagePermitStatus: "valid",
      comparableCount: 8,
      averageComparableSimilarity: 0.76,
    },
  },
  {
    id: "attractive-location-flood-risk",
    title: "Attractive location with flood risk",
    synthetic: true,
    recommendedProfile: "homebuyer",
    metrics: [
      metric("attractive-location-flood-risk", "lifestyle", 94, 0.9, "Excellent amenities."),
      metric(
        "attractive-location-flood-risk",
        "locationAccessibility",
        91,
        0.9,
        "Excellent mobility.",
      ),
      metric(
        "attractive-location-flood-risk",
        "environmentalSafety",
        75,
        0.9,
        "General environmental baseline.",
      ),
    ],
    riskContext: {
      floodZone: "100-year",
      comparableCount: 11,
      averageComparableSimilarity: 0.82,
    },
  },
  {
    id: "insufficient-comparables",
    title: "Property with insufficient comparable evidence",
    synthetic: true,
    recommendedProfile: "homebuyer",
    metrics: [
      metric(
        "insufficient-comparables",
        "pricingFairness",
        80,
        0.35,
        "Only weak comparable evidence is available.",
      ),
      metric("insufficient-comparables", "dataConfidence", 38, 0.9, "Sparse market segment."),
    ],
    riskContext: {
      comparableCount: 2,
      averageComparableSimilarity: 0.48,
    },
  },
  {
    id: "conflicting-duplicate-price",
    title: "Duplicate listing with conflicting prices",
    synthetic: true,
    recommendedProfile: "investor",
    metrics: [
      metric(
        "conflicting-duplicate-price",
        "pricingFairness",
        76,
        0.75,
        "Primary listing is near the segment median.",
      ),
      metric(
        "conflicting-duplicate-price",
        "listingQuality",
        52,
        0.7,
        "Duplicate sources disagree.",
      ),
    ],
    riskContext: {
      askingPrice: 220000,
      lowestFreshDuplicatePrice: 205000,
      comparableCount: 7,
      averageComparableSimilarity: 0.78,
    },
  },
];
