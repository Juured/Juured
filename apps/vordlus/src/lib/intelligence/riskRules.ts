import type { IntelligenceWarning, ScoreDimension } from "./types";

export type RiskContext = {
  floodZone?: "none" | "100-year" | "1000-year" | null;
  radonRisk?: "low" | "medium" | "high" | null;
  dwellingLevel?: "basement" | "ground" | "upper" | null;
  usagePermitStatus?: "valid" | "missing" | "contradictory" | null;
  listingAreaM2?: number | null;
  registryAreaM2?: number | null;
  comparableCount?: number | null;
  averageComparableSimilarity?: number | null;
  askingPrice?: number | null;
  lowestFreshDuplicatePrice?: number | null;
};

export type AppliedRiskRule = {
  id: string;
  version: 1;
  evidence: string[];
  dimensionCap?: {
    dimension: ScoreDimension;
    maximum: number;
  };
  confidenceCap?: number;
  warning: IntelligenceWarning;
  manualReviewRequired: boolean;
};

export function evaluateRiskRules(context: RiskContext): AppliedRiskRule[] {
  const rules: AppliedRiskRule[] = [];

  if (context.floodZone === "100-year") {
    rules.push({
      id: "flood-100-year",
      version: 1,
      evidence: ["environment.flood_zone"],
      dimensionCap: { dimension: "environmentalSafety", maximum: 35 },
      confidenceCap: 0.85,
      warning: {
        code: "FLOOD_100_YEAR",
        message: "The property is located in a 100-year flood hazard area.",
        severity: "critical",
      },
      manualReviewRequired: true,
    });
  }

  if (context.radonRisk === "high" && context.dwellingLevel === "basement") {
    rules.push({
      id: "radon-basement",
      version: 1,
      evidence: ["environment.radon_risk", "property.dwelling_level"],
      dimensionCap: { dimension: "environmentalSafety", maximum: 45 },
      warning: {
        code: "HIGH_RADON_BASEMENT",
        message: "High radon risk requires mitigation evidence for a basement-level dwelling.",
        severity: "critical",
      },
      manualReviewRequired: true,
    });
  }

  if (context.usagePermitStatus === "contradictory") {
    rules.push({
      id: "usage-permit-contradiction",
      version: 1,
      evidence: ["legal.usage_permit"],
      dimensionCap: { dimension: "legalConsistency", maximum: 30 },
      confidenceCap: 0.6,
      warning: {
        code: "USAGE_PERMIT_CONTRADICTION",
        message: "Listing and registry usage-permit information contradict each other.",
        severity: "critical",
      },
      manualReviewRequired: true,
    });
  }

  if (
    context.listingAreaM2 != null &&
    context.registryAreaM2 != null &&
    context.listingAreaM2 > 0 &&
    Math.abs(context.listingAreaM2 - context.registryAreaM2) / context.listingAreaM2 >= 0.1
  ) {
    rules.push({
      id: "area-mismatch",
      version: 1,
      evidence: ["listing.area_m2", "registry.area_m2"],
      confidenceCap: 0.7,
      warning: {
        code: "AREA_MISMATCH",
        message: "Listing area materially differs from the registered area.",
        severity: "warning",
      },
      manualReviewRequired: true,
    });
  }

  if (
    (context.comparableCount != null && context.comparableCount < 4) ||
    (context.averageComparableSimilarity != null && context.averageComparableSimilarity < 0.6)
  ) {
    rules.push({
      id: "weak-comparables",
      version: 1,
      evidence: ["valuation.comparable_count", "valuation.comparable_similarity"],
      confidenceCap: 0.55,
      warning: {
        code: "WEAK_COMPARABLES",
        message: "Comparable evidence is too weak for a high-confidence valuation.",
        severity: "warning",
      },
      manualReviewRequired: false,
    });
  }

  if (
    context.askingPrice != null &&
    context.lowestFreshDuplicatePrice != null &&
    context.lowestFreshDuplicatePrice < context.askingPrice
  ) {
    const difference = context.askingPrice - context.lowestFreshDuplicatePrice;
    rules.push({
      id: "lower-priced-duplicate",
      version: 1,
      evidence: ["listing.asking_price", "duplicate.lowest_fresh_price"],
      dimensionCap: { dimension: "pricingFairness", maximum: 55 },
      warning: {
        code: "LOWER_PRICED_DUPLICATE",
        message: `A fresh duplicate listing is €${difference.toLocaleString("en-US")} cheaper.`,
        severity: "warning",
      },
      manualReviewRequired: false,
    });
  }

  return rules;
}
