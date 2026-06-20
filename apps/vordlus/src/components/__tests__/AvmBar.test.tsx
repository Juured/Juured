import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { AvmBar } from "@/components/AvmBar";

describe("AvmBar", () => {
  it("shows the baseline hint text", () => {
    render(<AvmBar pricePerM2={2000} baseline={2500} baselineSource="Maa-amet 2022" />);
    expect(screen.getByText(/vs Maa-amet 2022 mediaan/i)).toBeInTheDocument();
  });

  it("renders nothing if baseline is null", () => {
    const { container } = render(<AvmBar pricePerM2={2000} baseline={null} baselineSource="—" />);
    expect(container.firstChild).toBeNull();
  });

  it("clamps the bar position to [-30%, +30%]", () => {
    const { container } = render(<AvmBar pricePerM2={5000} baseline={1000} baselineSource="x" />);
    const marker = container.querySelector("[data-marker='property']") as HTMLElement;
    expect(marker.style.left).toBe("80%");
    const fill = container.querySelector("[data-fill='property']") as HTMLElement;
    expect(fill.style.left).toBe("50%");
    expect(fill.style.right).toBe("20%");
  });
});
