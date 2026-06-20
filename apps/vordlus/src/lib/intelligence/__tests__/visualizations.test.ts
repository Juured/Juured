import { describe, expect, it } from "vitest";
import {
  VISUALIZATION_COMPONENTS,
  createVisualization,
} from "@/lib/intelligence/visualizations";

describe("visualization contracts", () => {
  it("accepts registered versioned visualization view models", () => {
    const model = createVisualization({
      component: "estimated_value_distribution",
      version: 1,
      title: "Estimated value range",
      dataRef: "valuation.result.v1",
      confidence: 0.78,
      payload: {
        low: 185000,
        median: 204000,
        high: 222000,
        highlight: 209000,
      },
    });

    expect(model.component).toBe("estimated_value_distribution");
    expect(model.payload.median).toBe(204000);
  });

  it("registers the initial chart family", () => {
    expect(VISUALIZATION_COMPONENTS).toContain("price_history_timeline");
    expect(VISUALIZATION_COMPONENTS).toContain("environmental_risk_matrix");
    expect(VISUALIZATION_COMPONENTS).toContain("profile_weight_explanation");
  });

  it("rejects arbitrary component names", () => {
    expect(() =>
      createVisualization({
        component: "generated_react_component",
        version: 1,
        title: "Unsafe",
        dataRef: "x",
        confidence: 0.5,
        payload: {},
      }),
    ).toThrow("component");
  });

  it("rejects executable values and script-like payload keys", () => {
    expect(() =>
      createVisualization({
        component: "lifestyle_category_bars",
        version: 1,
        title: "Lifestyle",
        dataRef: "lifestyle.result.v1",
        confidence: 0.9,
        payload: {
          onClick: "fetch('/secret')",
        },
      }),
    ).toThrow("executable");
  });

  it("rejects invalid versions and confidence", () => {
    expect(() =>
      createVisualization({
        component: "confidence_breakdown",
        version: 2,
        title: "Confidence",
        dataRef: "confidence.result.v1",
        confidence: 3,
        payload: {},
      }),
    ).toThrow();
  });
});
