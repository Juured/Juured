import { describe, expect, it } from "vitest";
import { buildAgentPackage } from "@/lib/intelligence/agentPackage";
import { buildProfilePolicy } from "@/lib/intelligence/profiles";
import { calculateScores } from "@/lib/intelligence/scoring";
import { createEvidenceFact } from "@/lib/intelligence/types";
import { createVisualization } from "@/lib/intelligence/visualizations";

const metric = {
  id: "price-v1",
  dimension: "pricingFairness" as const,
  score: 82,
  confidence: 0.8,
  reasons: ["Near comparable median"],
  warnings: [],
  evidenceKeys: ["listing.price"],
};
const profilePolicy = buildProfilePolicy("homebuyer", {});
const scores = calculateScores({
  metrics: [metric],
  profilePolicy,
  riskRules: [],
  confidence: 0.8,
});

describe("agent evidence package", () => {
  it("contains bounded structured evidence and registered visuals", () => {
    const packageResult = buildAgentPackage({
      listing: {
        id: "listing-1",
        address: "Example 1, Tallinn",
        propertyType: "apartment",
        askingPrice: 210000,
      },
      evidence: [
        createEvidenceFact({
          key: "listing.price",
          value: 210000,
          unit: "EUR",
          kind: "observed",
          source: { id: "listing", name: "Listing", recordRef: "listing-1" },
          retrievedAt: "2026-06-20T12:00:00.000Z",
          effectiveAt: null,
          confidence: 0.9,
          warnings: [],
        }),
      ],
      metrics: [metric],
      riskRules: [],
      profilePolicy,
      scores,
      visualizations: [
        createVisualization({
          component: "profile_weight_explanation",
          version: 1,
          title: "Why this score fits you",
          dataRef: "profile.weights.v1",
          confidence: 1,
          payload: { profile: "homebuyer" },
        }),
      ],
      generatedAt: "2026-06-20T12:05:00.000Z",
    });

    expect(packageResult.version).toBe(1);
    expect(packageResult.evidence[0].source.recordRef).toBe("listing-1");
    expect(packageResult.visualizations[0].component).toBe("profile_weight_explanation");
    expect(JSON.parse(JSON.stringify(packageResult))).toEqual(packageResult);
  });

  it("drops raw rows, secrets, and unrelated input properties", () => {
    const packageResult = buildAgentPackage({
      listing: {
        id: "listing-1",
        address: "Example 1, Tallinn",
        propertyType: "apartment",
        askingPrice: 210000,
      },
      evidence: [],
      metrics: [],
      riskRules: [],
      profilePolicy,
      scores,
      visualizations: [],
      generatedAt: "2026-06-20T12:05:00.000Z",
      rawDatabaseRows: [{ secret: "do-not-send" }],
      apiKey: "do-not-send",
    } as Parameters<typeof buildAgentPackage>[0] & {
      rawDatabaseRows: unknown[];
      apiKey: string;
    });
    const serialized = JSON.stringify(packageResult);

    expect(serialized).not.toContain("rawDatabaseRows");
    expect(serialized).not.toContain("apiKey");
    expect(serialized).not.toContain("do-not-send");
  });

  it("rejects unregistered visualization payloads", () => {
    expect(() =>
      buildAgentPackage({
        listing: {
          id: "listing-1",
          address: "Example 1, Tallinn",
          propertyType: "apartment",
          askingPrice: 210000,
        },
        evidence: [],
        metrics: [],
        riskRules: [],
        profilePolicy,
        scores,
        visualizations: [{ component: "arbitrary_code" }],
        generatedAt: "2026-06-20T12:05:00.000Z",
      } as unknown as Parameters<typeof buildAgentPackage>[0]),
    ).toThrow("visualization");
  });
});
