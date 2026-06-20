import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { RiskBadges } from "@/components/RiskBadges";

describe("RiskBadges", () => {
  it("renders both badges when data is present", () => {
    render(<RiskBadges radon={{ class: "keskmine" }} flood={{ zone: "ei_ole_ohualas" }} />);
    expect(screen.getByText(/Radoon/i)).toBeInTheDocument();
    expect(screen.getByText(/Üleujutus/i)).toBeInTheDocument();
  });

  it("renders nothing when both are null", () => {
    const { container } = render(<RiskBadges radon={null} flood={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("applies the 'bad' style to high radon", () => {
    render(<RiskBadges radon={{ class: "korge" }} flood={null} />);
    expect(screen.getByText(/Radoon/i)).toHaveClass("bad");
  });
});
