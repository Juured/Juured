import { describe, it, expect } from "vitest";
import { greenMortgageScore } from "@/lib/scores";

describe("greenMortgageScore", () => {
  it("returns 5 stars for energy class A with district heating", () => {
    const r = greenMortgageScore("A", "Kaugküte", 80);
    expect(r.score).toBe(5);
    expect(r.tone).toBe("good");
  });

  it("returns 1 star for energy class H with oil heating", () => {
    const r = greenMortgageScore("H", "Õliküte", 250);
    expect(r.score).toBe(1);
    expect(r.tone).toBe("bad");
  });

  it("returns 3 stars for energy class D (depends on bank)", () => {
    const r = greenMortgageScore("D", "Kaugküte", 160);
    expect(r.score).toBe(3);
    expect(r.tone).toBe("warn");
  });

  it("returns 0 + 'andmed puuduvad' when energy class is missing", () => {
    const r = greenMortgageScore(null, null, null);
    expect(r.score).toBe(0);
    expect(r.reason).toMatch(/puuduvad/);
  });
});
