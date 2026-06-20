import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProfileWeightExplanation } from "@/components/intelligence/ProfileWeightExplanation";
import { buildProfilePolicy } from "@/lib/intelligence/profiles";

describe("ProfileWeightExplanation", () => {
  it("shows why the selected profile changes weighting", () => {
    const policy = buildProfilePolicy("homebuyer", {
      priorities: { ownershipCost: 2 },
    });
    render(<ProfileWeightExplanation policy={policy} />);

    expect(screen.getByText("Sinu hinnangu kaalud")).toBeInTheDocument();
    expect(screen.getByText("Elamiskulud")).toBeInTheDocument();
    expect(screen.getByText(/märkisid selle oluliseks/)).toBeInTheDocument();
  });
});
