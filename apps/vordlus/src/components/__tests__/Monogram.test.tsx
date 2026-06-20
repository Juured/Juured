import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Monogram } from "@/components/Monogram";

function findImg(container: HTMLElement): HTMLImageElement | null {
  return container.querySelector("img");
}

describe("Monogram", () => {
  it("derives glyph from first street letter + building number", () => {
    render(<Monogram address="Viljandi mnt 47, Tallinn" index={1} overallScore={3.8} overallLabel="hea" />);
    expect(screen.getByText("V47")).toBeInTheDocument();
  });

  it("falls back to city initial when street starts with a number", () => {
    render(<Monogram address="3. Jannseni 8, Tartu" index={2} overallScore={4.0} overallLabel="hea" />);
    expect(screen.getByText("J8")).toBeInTheDocument();
  });

  it("shows em-dash when address is empty", () => {
    render(<Monogram address="" index={3} overallScore={0} overallLabel="andmed puuduvad" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("uses cooler gradient for multi-unit buildings (korterelamu)", () => {
    const { container } = render(
      <Monogram address="Pärnu mnt 28, Tallinn" buildingType="korterelamu" index={4} overallScore={3.5} overallLabel="hea" />,
    );
    expect(container.firstChild).toHaveClass("photo-cool");
  });

  it("derives glyph from the street+number chunk when address is county-prefixed", () => {
    render(<Monogram address="Harju maakond, Tallinn, Nõmme linnaosa, Viljandi mnt 47" index={0} overallScore={3.5} overallLabel="hea" />);
    expect(screen.getByText("V47")).toBeInTheDocument();
  });

  it("renders the index, overall pill, and close button", () => {
    render(<Monogram address="Viljandi mnt 47" index={4} overallScore={3.8} overallLabel="hea" onClose={() => {}} />);
    expect(screen.getByText("#05")).toBeInTheDocument();
    expect(screen.getByText(/3\.8 \/ 5/)).toBeInTheDocument();
    expect(screen.getByLabelText("Sulge")).toBeInTheDocument();
  });

  it("renders the listing photo when listingPhoto is provided", () => {
    const { container } = render(
      <Monogram
        address="Viljandi mnt 47"
        index={0}
        overallScore={0}
        overallLabel="andmed puuduvad"
        listingPhoto="https://img-bb.kv.ee/abc/foo.jpg"
      />,
    );
    const img = findImg(container);
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", "https://img-bb.kv.ee/abc/foo.jpg");
  });

  it("hides the listing photo and keeps the glyph on img error", () => {
    const { container } = render(
      <Monogram
        address="Viljandi mnt 47"
        index={0}
        overallScore={0}
        overallLabel="andmed puuduvad"
        listingPhoto="https://broken.example/missing.jpg"
      />,
    );
    const img = findImg(container);
    expect(img).not.toBeNull();
    fireEvent.error(img!);
    // After error: img gone, glyph stays.
    expect(findImg(container)).toBeNull();
    expect(screen.getByText("V47")).toBeInTheDocument();
  });
});
