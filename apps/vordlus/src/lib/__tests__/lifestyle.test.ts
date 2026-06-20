import { describe, it, expect } from "vitest";
import { scoreLifestyle, type Lifestyle, LIFESTYLE_LABELS } from "@/lib/lifestyle";

const MISSING_LABEL = "Andmed puuduvad";

const EMPTY: Lifestyle = {
  park: { stars: 0, label: MISSING_LABEL, count: 0 },
  school: { stars: 0, label: MISSING_LABEL, count: 0 },
  gym: { stars: 0, label: MISSING_LABEL, count: 0 },
  transit: { stars: 0, label: MISSING_LABEL, count: 0 },
  shop: { stars: 0, label: MISSING_LABEL, count: 0 },
  cafe: { stars: 0, label: MISSING_LABEL, count: 0 },
  restaurant: { stars: 0, label: MISSING_LABEL, count: 0 },
};

describe("scoreLifestyle", () => {
  it("returns 0 stars + missing label when input is null", () => {
    const out = scoreLifestyle(null);
    expect(out).toEqual(EMPTY);
    for (const k of Object.keys(LIFESTYLE_LABELS) as (keyof Lifestyle)[]) {
      expect(out[k].label).toBe(MISSING_LABEL);
      expect(out[k].stars).toBe(0);
      expect(out[k].count).toBe(0);
    }
  });

  it("returns 0 stars + missing label when all counts are zero", () => {
    const out = scoreLifestyle({ park: 0, school: 0, gym: 0, transit: 0, shop: 0, cafe: 0, restaurant: 0 });
    expect(out).toEqual(EMPTY);
  });

  it("scores each category from real counts", () => {
    const out = scoreLifestyle({ park: 3, school: 5, gym: 1, transit: 8, shop: 2, cafe: 4, restaurant: 0 });
    expect(out.transit.count).toBe(8);
    expect(out.transit.stars).toBe(5);
    expect(out.school.count).toBe(5);
    expect(out.school.stars).toBe(4);
    expect(out.restaurant.count).toBe(0);
    expect(out.restaurant.label).toBe(MISSING_LABEL);
    expect(out.restaurant.stars).toBe(0);
  });

  it("is deterministic — same input → same output", () => {
    const a = scoreLifestyle({ park: 2, school: 0, gym: 0, transit: 0, shop: 0, cafe: 0, restaurant: 0 });
    const b = scoreLifestyle({ park: 2, school: 0, gym: 0, transit: 0, shop: 0, cafe: 0, restaurant: 0 });
    expect(a).toEqual(b);
  });
});
