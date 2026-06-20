import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PersonalizedScoreBadge } from "@/components/intelligence/PersonalizedScoreBadge";

describe("PersonalizedScoreBadge", () => {
  it("renders suitability separately from confidence", () => {
    render(
      <PersonalizedScoreBadge
        profile="homebuyer"
        score={83.6}
        confidence={0.62}
      />,
    );

    expect(screen.getByText("84/100")).toBeInTheDocument();
    expect(screen.getByText("Kindlus 62%")).toBeInTheDocument();
  });
});
