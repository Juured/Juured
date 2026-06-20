export const VISUALIZATION_COMPONENTS = [
  "estimated_value_distribution",
  "price_per_m2_histogram",
  "price_history_timeline",
  "ownership_cost_breakdown",
  "lifestyle_category_bars",
  "environmental_risk_matrix",
  "confidence_breakdown",
  "profile_weight_explanation",
] as const;

export type VisualizationComponent = (typeof VISUALIZATION_COMPONENTS)[number];

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type VisualizationViewModel = {
  component: VisualizationComponent;
  version: 1;
  title: string;
  dataRef: string;
  confidence: number;
  payload: Record<string, JsonValue>;
};

type VisualizationInput = Omit<VisualizationViewModel, "component" | "version"> & {
  component: string;
  version: number;
};

const EXECUTABLE_KEY = /^(on[A-Z]|script|code|html|dangerouslySetInnerHTML)/;

function assertSafeJson(value: unknown, path = "payload"): asserts value is JsonValue {
  if (
    value == null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeJson(item, `${path}[${index}]`));
    return;
  }
  if (typeof value !== "object") {
    throw new TypeError(`${path} contains an executable or unsupported value`);
  }
  for (const [key, nested] of Object.entries(value)) {
    if (EXECUTABLE_KEY.test(key)) {
      throw new TypeError(`${path}.${key} contains executable UI instructions`);
    }
    assertSafeJson(nested, `${path}.${key}`);
  }
}

export function createVisualization(input: VisualizationInput): VisualizationViewModel {
  if (!VISUALIZATION_COMPONENTS.includes(input.component as VisualizationComponent)) {
    throw new TypeError(`Unknown visualization component: ${input.component}`);
  }
  if (input.version !== 1) {
    throw new RangeError("Visualization version must be 1");
  }
  if (input.confidence < 0 || input.confidence > 1) {
    throw new RangeError("Visualization confidence must be between 0 and 1");
  }
  if (!input.dataRef.trim()) {
    throw new TypeError("Visualization dataRef is required");
  }
  assertSafeJson(input.payload);

  return {
    ...input,
    component: input.component as VisualizationComponent,
    version: 1,
  };
}

export function isVisualizationViewModel(value: unknown): value is VisualizationViewModel {
  try {
    createVisualization(value as VisualizationInput);
    return true;
  } catch {
    return false;
  }
}
