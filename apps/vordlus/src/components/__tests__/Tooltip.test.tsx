import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Tooltip } from "@/components/Tooltip";

describe("Tooltip", () => {
  it("renders the trigger and hides the bubble by default", () => {
    render(<Tooltip text="Selgitus">ⓘ</Tooltip>);
    expect(screen.getByText("ⓘ")).toBeInTheDocument();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
  it("shows the bubble on hover", () => {
    render(<Tooltip text="Hind jagatud pindalaga">ⓘ</Tooltip>);
    fireEvent.mouseEnter(screen.getByText("ⓘ"));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Hind jagatud pindalaga");
  });
});
