import { describe, expect, it } from "vitest";
import {
  SCORE_DIMENSIONS,
  createEvidenceFact,
  type MetricResult,
} from "@/lib/intelligence/types";

describe("intelligence contracts", () => {
  it("creates a serializable evidence fact with provenance", () => {
    const fact = createEvidenceFact({
      key: "property.energy_class",
      value: "B",
      unit: null,
      kind: "observed",
      source: {
        id: "ehr",
        name: "Ehitisregister",
        recordRef: "ehr:123",
      },
      retrievedAt: "2026-06-20T12:00:00.000Z",
      effectiveAt: "2026-06-01",
      confidence: 0.94,
      warnings: [],
    });

    expect(fact.kind).toBe("observed");
    expect(fact.source.id).toBe("ehr");
    expect(fact.confidence).toBe(0.94);
    expect(JSON.parse(JSON.stringify(fact))).toEqual(fact);
  });

  it("rejects evidence confidence outside zero to one", () => {
    expect(() =>
      createEvidenceFact({
        key: "market.price_per_m2",
        value: 3200,
        unit: "EUR/m2",
        kind: "calculated",
        source: { id: "market-engine", name: "Market engine", recordRef: null },
        retrievedAt: "2026-06-20T12:00:00.000Z",
        effectiveAt: null,
        confidence: 1.1,
        warnings: [],
      }),
    ).toThrow("confidence");
  });

  it("defines the stable objective score dimensions", () => {
    expect(SCORE_DIMENSIONS).toContain("pricingFairness");
    expect(SCORE_DIMENSIONS).toContain("environmentalSafety");
    expect(SCORE_DIMENSIONS).toContain("dataConfidence");
    expect(new Set(SCORE_DIMENSIONS).size).toBe(SCORE_DIMENSIONS.length);
  });

  it("keeps metric confidence separate from its score", () => {
    const metric: MetricResult = {
      id: "pricing-fairness-v1",
      dimension: "pricingFairness",
      score: 84,
      confidence: 0.51,
      reasons: ["Asking price is close to the comparable median"],
      warnings: [],
      evidenceKeys: ["market.price_per_m2"],
    };

    expect(metric.score).toBe(84);
    expect(metric.confidence).toBe(0.51);
  });
});
