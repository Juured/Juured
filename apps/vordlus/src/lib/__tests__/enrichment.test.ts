import { describe, it, expect } from "vitest";
import {
  computeCompleteness,
  inferRenovation,
  computeYield,
  energyDistributionFromListings,
  percentileOf,
  daysOnMarketBin,
} from "@/lib/enrichment";

describe("computeCompleteness", () => {
  it("sums weights of present fields", () => {
    const r = computeCompleteness({
      photo_count: 6,
      description_len: 600,
      has_floor_plan: true,
      price_eur: 100000,
      area_m2: 50,
      rooms: 2,
      build_year: 1990,
      energy_class: "B",
    });
    expect(r.score).toBe(100);
    expect(r.missing).toEqual([]);
  });
  it("reports missing fields", () => {
    const r = computeCompleteness({});
    expect(r.missing).toContain("price");
    expect(r.missing).toContain("area");
    expect(r.score).toBe(0);
  });
  it("treats <5 photos as missing", () => {
    const r = computeCompleteness({ photo_count: 3, price_eur: 1, area_m2: 1, rooms: 1, build_year: 2000, energy_class: "C" });
    expect(r.missing).toContain("photos");
  });
});

describe("inferRenovation", () => {
  it("flags pre-1980 + A-C as renoveeritud", () => {
    expect(inferRenovation(1970, "B").label).toMatch(/renoveeritud/i);
  });
  it("flags pre-1980 + D-H as algne", () => {
    expect(inferRenovation(1970, "F").label).toMatch(/algne/i);
  });
  it("modern + A-B as kaasaegne", () => {
    expect(inferRenovation(2015, "A").label).toMatch(/kaasaegne/i);
  });
  it("returns 'andmed puuduvad' when no inputs", () => {
    expect(inferRenovation(null, null).label).toMatch(/puuduvad/i);
  });
});

describe("computeYield", () => {
  it("computes annual yield %", () => {
    const r = computeYield({
      salePrice: 200000,
      monthlyRentPerM2: 10,
      areaM2: 50,
      rentListingsCount: 5,
    });
    expect(r.yieldPct).toBeCloseTo(3.0, 1);
    expect(r.tier).toBe("madal");
  });
  it("returns null when <3 rent listings", () => {
    const r = computeYield({ salePrice: 200000, monthlyRentPerM2: 10, areaM2: 50, rentListingsCount: 1 });
    expect(r.yieldPct).toBeNull();
    expect(r.reason).toMatch(/piisavad/i);
  });
  it("flags high yield", () => {
    const r = computeYield({ salePrice: 100000, monthlyRentPerM2: 20, areaM2: 50, rentListingsCount: 5 });
    expect(r.tier).toBe("kõrge");
  });
});

describe("energyDistributionFromListings", () => {
  it("counts energy class frequencies", () => {
    const dist = energyDistributionFromListings([
      { energy_class: "B" }, { energy_class: "B" }, { energy_class: "C" }, { energy_class: "F" },
    ]);
    expect(dist.B).toBe(2);
    expect(dist.C).toBe(1);
    expect(dist.F).toBe(1);
    expect(dist.A).toBe(0);
  });
  it("returns the mode (most common) class", () => {
    const mode = energyDistributionFromListings([
      { energy_class: "C" }, { energy_class: "C" }, { energy_class: "D" },
    ]).mode;
    expect(mode).toBe("C");
  });
});

describe("percentileOf", () => {
  it("returns the percentile rank", () => {
    const sorted = [500, 1000, 1500, 2000, 3000];
    expect(percentileOf(1500, sorted)).toBe(50);
    expect(percentileOf(500, sorted)).toBe(0);
    expect(percentileOf(5000, sorted)).toBe(100);
  });
});

describe("daysOnMarketBin", () => {
  it("returns roheline for <30", () => {
    expect(daysOnMarketBin(15).tone).toBe("roheline");
  });
  it("returns kollane for 30-90", () => {
    expect(daysOnMarketBin(45).tone).toBe("kollane");
  });
  it("returns punane for >90", () => {
    expect(daysOnMarketBin(120).tone).toBe("punane");
  });
});
