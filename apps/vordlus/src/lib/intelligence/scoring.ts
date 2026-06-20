import type { ProfilePolicy, WeightReason } from "./profiles";
import type { AppliedRiskRule } from "./riskRules";
import {
  SCORE_DIMENSIONS,
  type MetricResult,
  type ScoreDimension,
} from "./types";

export type DimensionResult = {
  score: number;
  confidence: number;
  metricIds: string[];
  reasons: string[];
};

export type ScoreContribution = {
  dimension: ScoreDimension;
  score: number;
  normalizedWeight: number;
  contribution: number;
  explanation: string;
};

export type PersonalizedScoreResult = {
  objectiveDimensions: Partial<Record<ScoreDimension, DimensionResult>>;
  objectiveSummary: number;
  personalizedSuitability: number;
  contributions: ScoreContribution[];
  missingDimensions: ScoreDimension[];
  appliedCaps: {
    ruleId: string;
    dimension: ScoreDimension;
    previousScore: number;
    cappedScore: number;
  }[];
  confidence: number;
  weightReasons: WeightReason[];
};

export type CalculateScoresInput = {
  metrics: MetricResult[];
  profilePolicy: ProfilePolicy;
  riskRules: AppliedRiskRule[];
  confidence: number;
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function aggregateDimensions(
  metrics: MetricResult[],
): Partial<Record<ScoreDimension, DimensionResult>> {
  const result: Partial<Record<ScoreDimension, DimensionResult>> = {};

  for (const dimension of SCORE_DIMENSIONS) {
    const relevant = metrics.filter((metric) => metric.dimension === dimension);
    if (relevant.length === 0) continue;
    const confidenceTotal = relevant.reduce((sum, metric) => sum + metric.confidence, 0);
    const score =
      confidenceTotal > 0
        ? relevant.reduce(
            (sum, metric) => sum + clampScore(metric.score) * metric.confidence,
            0,
          ) / confidenceTotal
        : relevant.reduce((sum, metric) => sum + clampScore(metric.score), 0) / relevant.length;

    result[dimension] = {
      score,
      confidence: relevant.reduce((sum, metric) => sum + metric.confidence, 0) / relevant.length,
      metricIds: relevant.map((metric) => metric.id),
      reasons: relevant.flatMap((metric) => metric.reasons),
    };
  }

  return result;
}

export function calculateScores(input: CalculateScoresInput): PersonalizedScoreResult {
  const objectiveDimensions = aggregateDimensions(input.metrics);
  const appliedCaps: PersonalizedScoreResult["appliedCaps"] = [];

  for (const rule of input.riskRules) {
    if (!rule.dimensionCap) continue;
    const current = objectiveDimensions[rule.dimensionCap.dimension];
    if (!current || current.score <= rule.dimensionCap.maximum) continue;
    appliedCaps.push({
      ruleId: rule.id,
      dimension: rule.dimensionCap.dimension,
      previousScore: current.score,
      cappedScore: rule.dimensionCap.maximum,
    });
    objectiveDimensions[rule.dimensionCap.dimension] = {
      ...current,
      score: rule.dimensionCap.maximum,
      reasons: [...current.reasons, rule.warning.message],
    };
  }

  const available = SCORE_DIMENSIONS.filter((dimension) => objectiveDimensions[dimension]);
  const missingDimensions = SCORE_DIMENSIONS.filter((dimension) => !objectiveDimensions[dimension]);
  const objectiveSummary =
    available.length > 0
      ? available.reduce(
          (sum, dimension) => sum + (objectiveDimensions[dimension]?.score ?? 0),
          0,
        ) / available.length
      : 0;

  const availableWeight = available.reduce(
    (sum, dimension) => sum + input.profilePolicy.weights[dimension],
    0,
  );
  const contributions: ScoreContribution[] = available.map((dimension) => {
    const score = objectiveDimensions[dimension]?.score ?? 0;
    const normalizedWeight =
      availableWeight > 0 ? input.profilePolicy.weights[dimension] / availableWeight : 0;
    return {
      dimension,
      score,
      normalizedWeight,
      contribution: score * normalizedWeight,
      explanation: `${dimension} contributes ${(normalizedWeight * 100).toFixed(1)}% for the ${input.profilePolicy.profile} profile.`,
    };
  });
  const personalizedSuitability = contributions.reduce(
    (sum, contribution) => sum + contribution.contribution,
    0,
  );
  const confidenceCap = input.riskRules.reduce(
    (cap, rule) => Math.min(cap, rule.confidenceCap ?? 1),
    1,
  );

  return {
    objectiveDimensions,
    objectiveSummary,
    personalizedSuitability,
    contributions,
    missingDimensions,
    appliedCaps,
    confidence: Math.max(0, Math.min(1, Math.min(input.confidence, confidenceCap))),
    weightReasons: input.profilePolicy.reasons,
  };
}
