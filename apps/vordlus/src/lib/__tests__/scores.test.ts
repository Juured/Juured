import { describe, it, expect } from "vitest";
import { fairValueScore } from "@/lib/scores";

describe("fairValueScore (5-arg)", () => {
  it("uses estpropMedian as primary baseline", () => {
    const r = fairValueScore(2000, 2500, null, 2000, 100);
    expect(r.score).toBe(4);
    expect(r.reason).toMatch(/alla/);
  });

  it("falls back to batchMedian when 3+ properties and estpropMedian missing", () => {
    const r = fairValueScore(1500, null, 3000, null, 100);
    expect(r.score).toBe(5);
  });

  it("falls back to maksHind/area when both medians missing", () => {
    const r = fairValueScore(2000, null, null, 200000, 100);
    expect(r.score).toBe(3);
  });

  it("returns 0 stars when no reference and no input", () => {
    const r = fairValueScore(null, null, null, null, null);
    expect(r.score).toBe(0);
  });

  it("scores 5 stars when price ≤ 70% of baseline", () => {
    const r = fairValueScore(1000, 2000, null, null, null);
    expect(r.score).toBe(5);
  });

  it("scores 1 star when price > 130% of baseline", () => {
    const r = fairValueScore(3000, 2000, null, null, null);
    expect(r.score).toBe(1);
  });
});
