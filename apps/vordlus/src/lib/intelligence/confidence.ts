import type { ConfidenceBreakdown } from "./types";

export type ConfidenceInputs = {
  sourceReliability: number;
  freshness: number;
  fieldCoverage: number;
  comparableCount: number;
  averageComparableSimilarity: number;
  contradictionCount: number;
  inferredEvidenceRatio: number;
};

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function calculateConfidence(inputs: ConfidenceInputs): ConfidenceBreakdown {
  const sourceReliability = clamp(inputs.sourceReliability);
  const freshness = clamp(inputs.freshness);
  const fieldCoverage = clamp(inputs.fieldCoverage);
  const comparableCount = Math.max(0, inputs.comparableCount);
  const similarity = clamp(inputs.averageComparableSimilarity);
  const countStrength = clamp(comparableCount / 10);
  const comparableStrength = clamp(countStrength * 0.45 + similarity * 0.55);
  const contradictionPenalty = clamp(Math.max(0, inputs.contradictionCount) * 0.12);
  const inferencePenalty = clamp(inputs.inferredEvidenceRatio) * 0.25;

  const base =
    sourceReliability * 0.25 +
    freshness * 0.15 +
    fieldCoverage * 0.2 +
    comparableStrength * 0.4;
  const overall = clamp(base - contradictionPenalty - inferencePenalty);
  const reasons: string[] = [];

  if (comparableStrength < 0.4) {
    reasons.push("Weak comparable evidence limits valuation confidence.");
  }
  if (contradictionPenalty > 0) {
    reasons.push("Contradictory facts reduce confidence.");
  }
  if (inferencePenalty > 0.1) {
    reasons.push("A large share of the evidence is inferred.");
  }
  if (fieldCoverage < 0.6) {
    reasons.push("Important property fields are missing.");
  }
  if (freshness < 0.6) {
    reasons.push("Some evidence is stale.");
  }

  return {
    overall,
    sourceReliability,
    freshness,
    fieldCoverage,
    comparableStrength,
    contradictionPenalty,
    inferencePenalty,
    reasons,
  };
}
