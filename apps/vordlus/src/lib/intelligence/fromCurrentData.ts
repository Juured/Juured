import type { AgentListingSummary } from "./agentPackage";
import { calculateConfidence, type ConfidenceInputs } from "./confidence";
import type { CompareColumn } from "../compareStore";
import type { ProfilePolicy } from "./profiles";
import { evaluateRiskRules, type RiskContext } from "./riskRules";
import { calculateScores, type PersonalizedScoreResult } from "./scoring";
import {
  createEvidenceFact,
  type EvidenceFact,
  type EvidenceKind,
  type MetricResult,
  type ScoreDimension,
} from "./types";

export type CurrentDataAdaptation = {
  listing: AgentListingSummary;
  evidence: EvidenceFact<unknown>[];
  metrics: MetricResult[];
  riskContext: RiskContext;
  confidenceInputs: ConfidenceInputs;
};

export type CurrentColumnEvaluation = CurrentDataAdaptation & {
  profilePolicy: ProfilePolicy;
  scores: PersonalizedScoreResult;
};

function scoreFromStars(stars: number): number {
  return Math.max(0, Math.min(100, stars * 20));
}

export function adaptCurrentColumn(column: CompareColumn): CurrentDataAdaptation {
  const retrievedAt = new Date(column.fetchedAt || Date.now()).toISOString();
  const evidence: EvidenceFact<unknown>[] = [];

  function addFact<T>(
    key: string,
    value: T | null | undefined,
    unit: string | null,
    kind: EvidenceKind,
    sourceId: string,
    sourceName: string,
    confidence: number,
  ) {
    if (value == null || value === "") return;
    evidence.push(
      createEvidenceFact({
        key,
        value,
        unit,
        kind,
        source: { id: sourceId, name: sourceName, recordRef: column.id },
        retrievedAt,
        effectiveAt: null,
        confidence,
        warnings: [],
      }),
    );
  }

  addFact("listing.asking_price", column.input.manualPrice, "EUR", "observed", "user-input", "User input", 0.8);
  addFact("listing.area_m2", column.input.manualArea, "m2", "observed", "user-input", "User input", 0.8);
  addFact("listing.rooms", column.input.manualRooms, null, "observed", "user-input", "User input", 0.8);

  addFact("cadastre.parcel_area_m2", column.cadastre?.pindala, "m2", "observed", "cadastre", "Cadastre", 0.95);
  addFact("cadastre.taxable_value", column.cadastre?.maks_hind, "EUR", "observed", "cadastre", "Cadastre", 0.95);
  addFact("cadastre.land_use", column.cadastre?.siht1, null, "observed", "cadastre", "Cadastre", 0.95);
  addFact("building.year_first_used", column.ehr?.esmaneKasutus, "year", "observed", "ehr", "Ehitisregister", 0.95);
  addFact("building.energy_class", column.ehr?.energy[0]?.energiaKlass, null, "observed", "ehr", "Ehitisregister", 0.9);
  addFact("building.energy_intensity", column.ehr?.energy[0]?.energiaKaalKasutus, "kWh/m2/year", "observed", "ehr", "Ehitisregister", 0.9);
  addFact("building.heating_type", column.ehr?.energy[0]?.kytteTyypTxt, null, "observed", "ehr", "Ehitisregister", 0.9);
  addFact("environment.flood_zone", column.flood?.zone, null, "observed", "maaamet-flood", "Maa-amet flood data", 0.9);
  addFact("environment.radon_risk", column.radon?.class, null, "observed", "egt-radon", "Estonian Geological Survey", 0.8);
  addFact("mobility.transit_stop_count", column.transit?.stopCount, null, "calculated", "gtfs", "Transit data", 0.85);
  addFact("mobility.transit_frequency", column.transit?.frequency, "services", "calculated", "gtfs", "Transit data", 0.8);
  addFact("planning.nearby_count", column.planeeringud?.length, null, "calculated", "plank", "PLANK", 0.8);
  addFact("market.price_per_m2", column.enrichment?.pricePerM2, "EUR/m2", "calculated", "enrichment", "Listing enrichment", 0.75);
  addFact("market.days_on_market", column.enrichment?.daysOnMarket?.days, "days", "calculated", "listing-history", "Listing history", 0.75);
  addFact("market.comparable_count", column.enrichment?.deviationFromComparables?.n, null, "calculated", "comparables", "Comparable engine", 0.7);
  addFact("listing.completeness", column.enrichment?.completeness?.score, "percent", "calculated", "enrichment", "Listing enrichment", 0.8);
  addFact("market.rent_yield", column.enrichment?.rentYield?.yieldPct, "percent", "calculated", "enrichment", "Listing enrichment", 0.65);

  for (const [category, value] of Object.entries(column.lifestyle)) {
    if (value.count > 0) {
      addFact(
        `lifestyle.${category}_count`,
        value.count,
        null,
        "calculated",
        "osm-poi",
        "OpenStreetMap POI",
        0.75,
      );
    }
  }

  const metrics: MetricResult[] = [];
  function addMetric(
    id: string,
    dimension: ScoreDimension,
    score: number,
    confidence: number,
    reason: string,
    evidenceKeys: string[],
  ) {
    if (score <= 0) return;
    metrics.push({
      id,
      dimension,
      score: Math.max(0, Math.min(100, score)),
      confidence,
      reasons: [reason],
      warnings: [],
      evidenceKeys,
    });
  }

  addMetric(
    "legacy-fair-value",
    "pricingFairness",
    scoreFromStars(column.scores.fairValue.score),
    column.enrichment?.deviationFromComparables ? 0.75 : 0.5,
    column.scores.fairValue.reason,
    ["listing.asking_price", "market.price_per_m2"],
  );
  addMetric(
    "legacy-tco",
    "ownershipCost",
    scoreFromStars(column.scores.tco.score),
    column.ehr?.energy[0] ? 0.8 : 0.45,
    column.scores.tco.reason,
    ["building.energy_class", "building.energy_intensity"],
  );
  addMetric(
    "legacy-appreciation",
    "investmentPotential",
    scoreFromStars(column.scores.appreciation.score),
    0.5,
    column.scores.appreciation.reason,
    ["building.year_first_used", "building.energy_class"],
  );
  addMetric(
    "legacy-lifestyle",
    "lifestyle",
    scoreFromStars(column.scores.lifestyle.score),
    0.7,
    column.scores.lifestyle.reason,
    Object.keys(column.lifestyle).map((key) => `lifestyle.${key}_count`),
  );

  if (column.enrichment?.completeness) {
    addMetric(
      "listing-completeness",
      "listingQuality",
      column.enrichment.completeness.score,
      0.85,
      `${column.enrichment.completeness.missing.length} expected fields are missing.`,
      ["listing.completeness"],
    );
  }
  if (column.enrichment?.liquidity) {
    const score = column.enrichment.liquidity.tone === "kõrge" ? 85 : column.enrichment.liquidity.tone === "keskmine" ? 60 : 35;
    addMetric(
      "listing-liquidity",
      "liquidity",
      score,
      0.65,
      `${column.enrichment.liquidity.totalCount} similar listings are active.`,
      ["market.comparable_count"],
    );
  }
  if (column.enrichment?.rentYield?.yieldPct != null) {
    addMetric(
      "rental-yield",
      "investmentPotential",
      Math.max(0, Math.min(100, column.enrichment.rentYield.yieldPct * 12)),
      0.6,
      column.enrichment.rentYield.reason,
      ["market.rent_yield"],
    );
  }
  if (column.flood || column.radon) {
    const floodScore = column.flood?.zone === "100a_ohualas" ? 30 : column.flood?.zone === "1000a_ohualas" ? 60 : 100;
    const radonScore = column.radon?.class === "korge" ? 45 : column.radon?.class === "keskmine" ? 70 : 100;
    addMetric(
      "environmental-baseline",
      "environmentalSafety",
      Math.min(floodScore, radonScore),
      0.85,
      "Environmental safety reflects current flood and radon evidence.",
      ["environment.flood_zone", "environment.radon_risk"],
    );
  }
  if (column.transit) {
    addMetric(
      "transit-access",
      "locationAccessibility",
      Math.min(100, column.transit.stopCount * 8 + column.transit.frequency),
      0.75,
      `${column.transit.stopCount} nearby stops are available.`,
      ["mobility.transit_stop_count", "mobility.transit_frequency"],
    );
  }

  const comparableCount =
    column.enrichment?.deviationFromComparables?.n ??
    column.enrichment?.liquidity?.totalCount ??
    0;
  const observedCount = evidence.filter((fact) => fact.kind === "observed").length;

  return {
    listing: {
      id: column.id,
      address: column.cadastre?.tais_aadress ?? column.ehr?.taisaadress ?? column.input.raw,
      propertyType: column.ehr?.nimetus ?? null,
      askingPrice: column.input.manualPrice ?? null,
    },
    evidence,
    metrics,
    riskContext: {
      floodZone:
        column.flood?.zone === "100a_ohualas"
          ? "100-year"
          : column.flood?.zone === "1000a_ohualas"
            ? "1000-year"
            : column.flood
              ? "none"
              : null,
      radonRisk:
        column.radon?.class === "korge"
          ? "high"
          : column.radon?.class === "keskmine"
            ? "medium"
            : column.radon
              ? "low"
              : null,
      listingAreaM2: column.input.manualArea ?? null,
      comparableCount,
      askingPrice: column.input.manualPrice ?? null,
      lowestFreshDuplicatePrice:
        column.enrichment?.duplicates && column.enrichment.duplicates.length > 0
          ? Math.min(...column.enrichment.duplicates.map((duplicate) => duplicate.price))
          : null,
    },
    confidenceInputs: {
      sourceReliability: column.cadastre || column.ehr ? 0.9 : 0.65,
      freshness: column.fetchedAt ? 0.9 : 0.5,
      fieldCoverage: Math.min(1, evidence.length / 18),
      comparableCount,
      averageComparableSimilarity: comparableCount > 0 ? 0.7 : 0,
      contradictionCount: column.errors.length,
      inferredEvidenceRatio:
        evidence.length > 0 ? 1 - observedCount / evidence.length : 0,
    },
  };
}

export function evaluateCurrentColumn(
  column: CompareColumn,
  profilePolicy: ProfilePolicy,
): CurrentColumnEvaluation {
  const adapted = adaptCurrentColumn(column);
  const confidence = calculateConfidence(adapted.confidenceInputs);
  const riskRules = evaluateRiskRules(adapted.riskContext);
  const scores = calculateScores({
    metrics: adapted.metrics,
    profilePolicy,
    riskRules,
    confidence: confidence.overall,
  });

  return {
    ...adapted,
    profilePolicy,
    scores,
  };
}
