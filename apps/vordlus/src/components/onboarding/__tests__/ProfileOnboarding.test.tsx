import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfileOnboarding } from "@/components/onboarding/ProfileOnboarding";

describe("ProfileOnboarding", () => {
  it("lets a user select the homebuyer profile", () => {
    const onSelect = vi.fn();
    render(<ProfileOnboarding profile={null} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "Ostan endale kodu" }));
    expect(onSelect).toHaveBeenCalledWith("homebuyer");
    expect(localStorage.getItem("vordlus.profile.v1")).toBe("homebuyer");
  });

  it("shows the selected profile state", () => {
    render(<ProfileOnboarding profile="investor" onSelect={() => {}} />);

    expect(screen.getByRole("button", { name: "Investeerin", pressed: true })).toBeInTheDocument();
    expect(screen.getByText("Investeerimisvaade")).toBeInTheDocument();
  });
});
