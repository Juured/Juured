import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { EnrichmentPanel } from "@/components/EnrichmentPanel";
import type { EnrichmentData } from "@/app/api/enrich/route";

const FULL: EnrichmentData = {
  pricePerM2: 2110,
  deviationFromComparables: { pct: 2.9, median: 2050, n: 4 },
  priceHistory: [
    { date: 1715000000000, price: 449000 },
    { date: 1717800000000, price: 420000 },
  ],
  daysOnMarket: { days: 42, tone: "kollane" },
  duplicates: [],
  completeness: { score: 87, missing: [] },
  districtBenchmark: { districtMedian: 2540, districtName: "Tallinn", nationalPercentile: 88 },
  energyComparison: { thisClass: "B", districtMode: "C", nationalMode: "C" },
  renovation: { label: "Renoveeritud (energia­märgis A-C, ehitatud enne 1980)", signals: [] },
  rentYield: { yieldPct: 5.2, tier: "keskmine", reason: "Keskmine tootlus" },
  liquidity: { totalCount: 47, byPortal: { "kv.ee": 28, "city24.ee": 15, "kinnisvara24.ee": 4 }, tone: "kõrge" },
};

describe("EnrichmentPanel", () => {
  it("renders the accordion header with block count", () => {
    render(<EnrichmentPanel data={FULL} />);
    expect(screen.getByText(/Rikastused/)).toBeInTheDocument();
  });
  it("renders all 11 blocks by default when open", () => {
    render(<EnrichmentPanel data={FULL} defaultOpen />);
    expect(screen.getByText("Hinna ajalugu")).toBeInTheDocument();
    expect(screen.getByText("Turul olnud")).toBeInTheDocument();
    expect(screen.getByText("Hind ruutmeetri kohta")).toBeInTheDocument();
    expect(screen.getByText("Üüri tootlus")).toBeInTheDocument();
    expect(screen.getByText("Likviidsus")).toBeInTheDocument();
  });
  it("renders gracefully when data is all null", () => {
    const NONE: EnrichmentData = {
      pricePerM2: null, deviationFromComparables: null, priceHistory: null, daysOnMarket: null,
      duplicates: null, completeness: null, districtBenchmark: null, energyComparison: null,
      renovation: null, rentYield: null, liquidity: null,
    };
    render(<EnrichmentPanel data={NONE} defaultOpen />);
    expect(screen.getByText(/Rikastused vajavad kv/)).toBeInTheDocument();
  });
});
