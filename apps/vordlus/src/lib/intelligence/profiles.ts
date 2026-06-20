import { SCORE_DIMENSIONS, type ScoreDimension } from "./types";

export const SUPPORTED_PROFILES = ["homebuyer", "investor"] as const;
export type UserProfile = (typeof SUPPORTED_PROFILES)[number];

export type UserPreferences = {
  priorities?: Partial<Record<ScoreDimension, number>>;
  ownershipYears?: number | null;
  householdSize?: number | null;
  hasChildren?: boolean | null;
  maxMonthlyCost?: number | null;
  renovationTolerance?: "low" | "medium" | "high" | null;
  riskTolerance?: "low" | "medium" | "high" | null;
};

export type WeightReason = {
  dimension: ScoreDimension;
  change: "increased" | "decreased" | "protected";
  message: string;
};

export type ProfilePolicy = {
  profile: UserProfile;
  weights: Record<ScoreDimension, number>;
  reasons: WeightReason[];
};

const HOME_BUYER_WEIGHTS: Record<ScoreDimension, number> = {
  pricingFairness: 0.14,
  buildingQuality: 0.12,
  ownershipCost: 0.16,
  locationAccessibility: 0.11,
  lifestyle: 0.09,
  environmentalSafety: 0.1,
  legalConsistency: 0.1,
  liquidity: 0.04,
  investmentPotential: 0.04,
  listingQuality: 0.04,
  dataConfidence: 0.06,
};

const INVESTOR_WEIGHTS: Record<ScoreDimension, number> = {
  pricingFairness: 0.18,
  buildingQuality: 0.07,
  ownershipCost: 0.08,
  locationAccessibility: 0.08,
  lifestyle: 0.04,
  environmentalSafety: 0.07,
  legalConsistency: 0.08,
  liquidity: 0.13,
  investmentPotential: 0.2,
  listingQuality: 0.03,
  dataConfidence: 0.04,
};

const MANDATORY_MINIMUMS: Partial<Record<ScoreDimension, number>> = {
  environmentalSafety: 0.04,
  legalConsistency: 0.04,
  dataConfidence: 0.03,
};

function clampPriority(value: number): number {
  return Math.max(-2, Math.min(2, value));
}

function normalize(weights: Record<ScoreDimension, number>): Record<ScoreDimension, number> {
  const total = SCORE_DIMENSIONS.reduce((sum, dimension) => sum + weights[dimension], 0);
  return Object.fromEntries(
    SCORE_DIMENSIONS.map((dimension) => [dimension, weights[dimension] / total]),
  ) as Record<ScoreDimension, number>;
}

export function buildProfilePolicy(
  profile: UserProfile,
  preferences: UserPreferences,
): ProfilePolicy {
  const base = profile === "homebuyer" ? HOME_BUYER_WEIGHTS : INVESTOR_WEIGHTS;
  const adjusted = { ...base };
  const reasons: WeightReason[] = [];

  for (const dimension of SCORE_DIMENSIONS) {
    const requested = preferences.priorities?.[dimension];
    if (requested == null || requested === 0) continue;
    const priority = clampPriority(requested);
    const multiplier = 1 + priority * 0.2;
    adjusted[dimension] *= multiplier;
    reasons.push({
      dimension,
      change: priority > 0 ? "increased" : "decreased",
      message:
        priority > 0
          ? `${dimension} received more weight because you marked it as important.`
          : `${dimension} received less weight because you marked it as lower priority.`,
    });
  }

  for (const [dimension, minimum] of Object.entries(MANDATORY_MINIMUMS) as [
    ScoreDimension,
    number,
  ][]) {
    if (adjusted[dimension] < minimum) {
      adjusted[dimension] = minimum;
      reasons.push({
        dimension,
        change: "protected",
        message: `${dimension} keeps a minimum weight because material risks cannot be ignored.`,
      });
    }
  }

  return {
    profile,
    weights: normalize(adjusted),
    reasons,
  };
}
