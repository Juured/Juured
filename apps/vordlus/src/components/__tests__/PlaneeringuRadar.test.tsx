import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { PlaneeringuRadar } from "@/components/PlaneeringuRadar";

describe("PlaneeringuRadar", () => {
  it("renders clean state when no plans", () => {
    render(<PlaneeringuRadar plans={[]} />);
    expect(screen.getByText(/Planeeringuid lähedal ei ole/i)).toBeInTheDocument();
  });

  it("renders risk state for high-rise plan", () => {
    render(<PlaneeringuRadar plans={[{ name: "X", maxFloors: 8 }]} />);
    expect(screen.getByText(/8-korruseline/i)).toBeInTheDocument();
  });

  it("renders caution state for low-rise plans", () => {
    render(<PlaneeringuRadar plans={[{ name: "X", maxFloors: 2 }, { name: "Y", maxFloors: 3 }]} />);
    expect(screen.getByText(/2 madal planeering/i)).toBeInTheDocument();
  });

  it("renders nothing when plans is null", () => {
    const { container } = render(<PlaneeringuRadar plans={null} />);
    expect(container.firstChild).toBeNull();
  });
});
