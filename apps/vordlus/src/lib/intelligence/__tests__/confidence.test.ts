import { describe, expect, it } from "vitest";
import { calculateConfidence } from "@/lib/intelligence/confidence";

describe("confidence calculation", () => {
  it("returns a high confidence score for fresh complete authoritative evidence", () => {
    const result = calculateConfidence({
      sourceReliability: 0.95,
      freshness: 0.9,
      fieldCoverage: 0.92,
      comparableCount: 12,
      averageComparableSimilarity: 0.88,
      contradictionCount: 0,
      inferredEvidenceRatio: 0.05,
    });

    expect(result.overall).toBeGreaterThan(0.8);
    expect(result.comparableStrength).toBeGreaterThan(0.8);
  });

  it("penalizes contradictions and inferred evidence", () => {
    const clean = calculateConfidence({
      sourceReliability: 0.8,
      freshness: 0.8,
      fieldCoverage: 0.8,
      comparableCount: 8,
      averageComparableSimilarity: 0.8,
      contradictionCount: 0,
      inferredEvidenceRatio: 0,
    });
    const uncertain = calculateConfidence({
      sourceReliability: 0.8,
      freshness: 0.8,
      fieldCoverage: 0.8,
      comparableCount: 8,
      averageComparableSimilarity: 0.8,
      contradictionCount: 2,
      inferredEvidenceRatio: 0.6,
    });

    expect(uncertain.overall).toBeLessThan(clean.overall);
    expect(uncertain.contradictionPenalty).toBeGreaterThan(0);
    expect(uncertain.inferencePenalty).toBeGreaterThan(0);
  });

  it("treats weak comparable evidence as low strength", () => {
    const result = calculateConfidence({
      sourceReliability: 1,
      freshness: 1,
      fieldCoverage: 1,
      comparableCount: 2,
      averageComparableSimilarity: 0.45,
      contradictionCount: 0,
      inferredEvidenceRatio: 0,
    });

    expect(result.comparableStrength).toBeLessThan(0.35);
    expect(result.reasons.some((reason) => reason.includes("comparable"))).toBe(true);
  });

  it("clamps malformed inputs and output to zero through one", () => {
    const result = calculateConfidence({
      sourceReliability: 4,
      freshness: -1,
      fieldCoverage: 2,
      comparableCount: -5,
      averageComparableSimilarity: 7,
      contradictionCount: 99,
      inferredEvidenceRatio: 3,
    });

    for (const value of [
      result.overall,
      result.sourceReliability,
      result.freshness,
      result.fieldCoverage,
      result.comparableStrength,
      result.contradictionPenalty,
      result.inferencePenalty,
    ]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});
