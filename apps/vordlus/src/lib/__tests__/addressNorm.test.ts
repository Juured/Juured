import { describe, it, expect } from "vitest";
import { normalizeAddress, similarAddressCluster } from "@/lib/addressNorm";

describe("normalizeAddress", () => {
  it("lowercases and strips diacritics", () => {
    expect(normalizeAddress("Pärnu mnt 28, Tallinn")).toBe("parnu-mnt-28-tallinn");
  });
  it("strips district tokens that are not in our map", () => {
    expect(normalizeAddress("Viljandi mnt 47, Nõmme, Tallinn")).toBe("viljandi-mnt-47-tallinn");
  });
  it("handles missing city gracefully", () => {
    expect(normalizeAddress("Tartu mnt 84a")).toBe("tartu-mnt-84a");
  });
  it("returns empty string for empty input", () => {
    expect(normalizeAddress("")).toBe("");
    expect(normalizeAddress(null)).toBe("");
  });
});

describe("similarAddressCluster", () => {
  it("groups similar addresses", () => {
    const a = normalizeAddress("Viljandi mnt 47, Nõmme, Tallinn");
    const b = normalizeAddress("viljandi mnt 47, tallinn");
    expect(similarAddressCluster(a)).toBe(similarAddressCluster(b));
  });
  it("differentiates different streets", () => {
    const a = similarAddressCluster("viljandi-mnt-47-tallinn");
    const b = similarAddressCluster("parnu-mnt-28-tallinn");
    expect(a).not.toBe(b);
  });
});
