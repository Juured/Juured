import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ComparisonTable } from "@/components/ComparisonTable";
import type { CompareColumn } from "@/lib/compareStore";

const baseCol: CompareColumn = {
  id: "1",
  input: { raw: "Viljandi 47" },
  cadastre: null,
  ehr: null,
  lifestyle: {
    park: { stars: 3, label: "2 lähedal", count: 2 },
    school: { stars: 0, label: "—", count: 0 },
    gym: { stars: 0, label: "—", count: 0 },
    transit: { stars: 0, label: "—", count: 0 },
    shop: { stars: 0, label: "—", count: 0 },
    cafe: { stars: 0, label: "—", count: 0 },
    restaurant: { stars: 0, label: "—", count: 0 },
  },
  transit: null,
  radon: null,
  flood: null,
  planeeringud: null,
  listingPhoto: null,
  enrichment: null,
  scores: {
    fairValue: { score: 4, ratio: 0.8, baseline: 2500, baselineSource: "Maa-amet 2022", reason: "alla mediaani" },
    tco: { score: 3, kWh: 150, reason: "150 kWh/m²/a" },
    appreciation: { score: 3, reason: "keskmine" },
    lifestyle: { score: 3, top: [], reason: "keskmine" },
    greenMortgage: { score: 4, tone: "good", reason: "C-märgis" },
    overall: 3.5,
    overallLabel: "hea",
  },
  fetchedAt: 0,
  errors: [],
};

describe("ComparisonTable", () => {
  it("renders a header row with addresses", () => {
    render(<ComparisonTable columns={[baseCol]} />);
    const headers = screen.getAllByRole("row")[0];
    expect(within(headers).getByText("Väli")).toBeInTheDocument();
  });

  it("renders a row per data field", () => {
    render(<ComparisonTable columns={[baseCol]} />);
    expect(screen.getByText("Fair Value")).toBeInTheDocument();
    expect(screen.getByText("Rohelaen")).toBeInTheDocument();
    expect(screen.getByText("Üldskoor")).toBeInTheDocument();
  });

  it("highlights the best score in green and the worst in red", () => {
    const col1 = { ...baseCol, id: "1", scores: { ...baseCol.scores, overall: 5 } };
    const col2 = { ...baseCol, id: "2", scores: { ...baseCol.scores, overall: 2 } };
    const { container } = render(<ComparisonTable columns={[col1, col2]} />);
    expect(container.querySelector(".bg-emerald-50")).toBeInTheDocument();
    expect(container.querySelector(".bg-red-50")).toBeInTheDocument();
  });
});
