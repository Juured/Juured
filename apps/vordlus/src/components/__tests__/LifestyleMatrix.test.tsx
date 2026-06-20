import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { LifestyleMatrix } from "@/components/LifestyleMatrix";
import type { Lifestyle } from "@/lib/lifestyle";

const REAL: Lifestyle = {
  park: { stars: 3, label: "2 lähedal", count: 2 },
  school: { stars: 4, label: "4 lähedal", count: 4 },
  gym: { stars: 2, label: "1 lähedal", count: 1 },
  transit: { stars: 5, label: "12+ lähedal", count: 12 },
  shop: { stars: 3, label: "3 lähedal", count: 3 },
  cafe: { stars: 0, label: "Andmed puuduvad", count: 0 },
  restaurant: { stars: 0, label: "Andmed puuduvad", count: 0 },
};

describe("LifestyleMatrix", () => {
  it("renders 7 category labels", () => {
    render(<LifestyleMatrix lifestyle={REAL} />);
    expect(screen.getByText("Park")).toBeInTheDocument();
    expect(screen.getByText("Kool")).toBeInTheDocument();
    expect(screen.getByText("Spordisaal")).toBeInTheDocument();
    expect(screen.getByText("Ühistransport")).toBeInTheDocument();
    expect(screen.getByText("Pood")).toBeInTheDocument();
    expect(screen.getByText("Kohvik")).toBeInTheDocument();
    expect(screen.getByText("Restoran")).toBeInTheDocument();
  });

  it("shows counts and 'Andmed puuduvad' for zero-count rows", () => {
    render(<LifestyleMatrix lifestyle={REAL} />);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getAllByText("Andmed puuduvad").length).toBeGreaterThanOrEqual(1);
  });
});
