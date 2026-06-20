export type EvidenceKind = "observed" | "calculated" | "inferred";

export type EvidenceSource = {
  id: string;
  name: string;
  recordRef: string | null;
  url?: string | null;
};

export type IntelligenceWarning = {
  code: string;
  message: string;
  severity: "info" | "warning" | "critical";
};

export type EvidenceFact<T> = {
  key: string;
  value: T;
  unit: string | null;
  kind: EvidenceKind;
  source: EvidenceSource;
  retrievedAt: string;
  effectiveAt: string | null;
  confidence: number;
  warnings: IntelligenceWarning[];
};

export function createEvidenceFact<T>(fact: EvidenceFact<T>): EvidenceFact<T> {
  if (fact.confidence < 0 || fact.confidence > 1) {
    throw new RangeError("Evidence confidence must be between 0 and 1");
  }
  return fact;
}

export const SCORE_DIMENSIONS = [
  "pricingFairness",
  "buildingQuality",
  "ownershipCost",
  "locationAccessibility",
  "lifestyle",
  "environmentalSafety",
  "legalConsistency",
  "liquidity",
  "investmentPotential",
  "listingQuality",
  "dataConfidence",
] as const;

export type ScoreDimension = (typeof SCORE_DIMENSIONS)[number];

export type MetricResult = {
  id: string;
  dimension: ScoreDimension;
  score: number;
  confidence: number;
  reasons: string[];
  warnings: IntelligenceWarning[];
  evidenceKeys: string[];
};

export type ConfidenceBreakdown = {
  overall: number;
  sourceReliability: number;
  freshness: number;
  fieldCoverage: number;
  comparableStrength: number;
  contradictionPenalty: number;
  inferencePenalty: number;
  reasons: string[];
};
