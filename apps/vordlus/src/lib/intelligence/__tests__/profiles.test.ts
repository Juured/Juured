import { describe, expect, it } from "vitest";
import {
  SUPPORTED_PROFILES,
  buildProfilePolicy,
  type UserPreferences,
} from "@/lib/intelligence/profiles";

describe("profile policies", () => {
  it("supports the initial homebuyer and investor profiles", () => {
    expect(SUPPORTED_PROFILES).toEqual(["homebuyer", "investor"]);
  });

  it("normalizes default profile weights to one", () => {
    for (const profile of SUPPORTED_PROFILES) {
      const policy = buildProfilePolicy(profile, {});
      const total = Object.values(policy.weights).reduce((sum, weight) => sum + weight, 0);
      expect(total).toBeCloseTo(1, 8);
    }
  });

  it("gives homebuyers more ownership-cost weight than investors by default", () => {
    const homebuyer = buildProfilePolicy("homebuyer", {});
    const investor = buildProfilePolicy("investor", {});

    expect(homebuyer.weights.ownershipCost).toBeGreaterThan(investor.weights.ownershipCost);
    expect(investor.weights.investmentPotential).toBeGreaterThan(
      homebuyer.weights.investmentPotential,
    );
  });

  it("adjusts weights from bounded user priorities and explains the change", () => {
    const preferences: UserPreferences = {
      priorities: {
        lifestyle: 2,
        ownershipCost: -2,
      },
    };
    const baseline = buildProfilePolicy("homebuyer", {});
    const adjusted = buildProfilePolicy("homebuyer", preferences);

    expect(adjusted.weights.lifestyle).toBeGreaterThan(baseline.weights.lifestyle);
    expect(adjusted.weights.ownershipCost).toBeLessThan(baseline.weights.ownershipCost);
    expect(adjusted.reasons.some((reason) => reason.dimension === "lifestyle")).toBe(true);
  });

  it("never removes mandatory environmental and legal risk weight", () => {
    const policy = buildProfilePolicy("investor", {
      priorities: {
        environmentalSafety: -99,
        legalConsistency: -99,
      },
    });

    expect(policy.weights.environmentalSafety).toBeGreaterThan(0);
    expect(policy.weights.legalConsistency).toBeGreaterThan(0);
  });
});
