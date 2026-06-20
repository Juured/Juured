import { describe, expect, it } from "vitest";
import { adaptCurrentColumn } from "@/lib/intelligence/fromCurrentData";
import { defaultScores, type CompareColumn } from "@/lib/compareStore";
import { EMPTY_LIFESTYLE } from "@/lib/lifestyle";

function column(overrides: Partial<CompareColumn> = {}): CompareColumn {
  return {
    id: "column-1",
    input: {
      raw: "Example 1, Tallinn",
      manualPrice: 210000,
      manualArea: 50,
      manualRooms: 2,
    },
    cadastre: null,
    ehr: null,
    lifestyle: EMPTY_LIFESTYLE,
    transit: null,
    radon: null,
    flood: null,
    planeeringud: null,
    listingPhoto: null,
    enrichment: null,
    scores: defaultScores(),
    fetchedAt: Date.parse("2026-06-20T12:00:00.000Z"),
    errors: [],
    ...overrides,
  };
}

describe("current Vordlus data adapter", () => {
  it("maps observed listing, cadastral, and EHR facts with provenance", () => {
    const adapted = adaptCurrentColumn(
      column({
        cadastre: {
          geom: "",
          tunnus: "78401:101:1234",
          siht1: "Elamumaa",
          siht2: null,
          siht3: null,
          so_prts1: 100,
          registreeritud: "2020-01-01",
          pindala: 800,
          ads_oid: "CU001",
          aadress: "Example 1",
          hkood: "",
          kinnistu: "",
          omvorm: "Eraomand",
          maks_hind: 120000,
          estprop_median_eur_m2: 3500,
          adob_id: 1,
          tsentroid_x: 542000,
          tsentroid_y: 6589000,
          tais_aadress: "Example 1, Tallinn",
        },
        ehr: {
          ehr_code: "123",
          taisaadress: "Example 1, Tallinn",
          nimetus: "Korterelamu",
          esmaneKasutus: "2018",
          ehAlustKp: null,
          tubadeArv: 2,
          ehitisalunePind: 300,
          suletud_netopind: 1000,
          mahtBruto: null,
          minKorrusteArv: 4,
          maxKorrusteArv: 4,
          energy: [
            {
              energiaKlass: "B",
              energiaValjastKp: "2024-01-01",
              energiaKehtibKuniKp: "2034-01-01",
              energiaKaalKasutus: "105",
              tarnEn: null,
              tarnEnKK: null,
              kytteTyypTxt: "Kaugküte",
            },
          ],
          katastriyksused: [],
          technical: [],
        },
      }),
    );

    expect(adapted.listing.askingPrice).toBe(210000);
    expect(
      adapted.evidence.find((fact) => fact.key === "cadastre.parcel_area_m2")?.source.id,
    ).toBe("cadastre");
    expect(adapted.evidence.find((fact) => fact.key === "building.energy_class")?.value).toBe("B");
  });

  it("maps environmental data into non-compensating risk context", () => {
    const adapted = adaptCurrentColumn(
      column({
        flood: { zone: "100a_ohualas" },
        radon: { class: "korge" },
      }),
    );

    expect(adapted.riskContext.floodZone).toBe("100-year");
    expect(adapted.riskContext.radonRisk).toBe("high");
  });

  it("maps current score and enrichment outputs into metrics", () => {
    const current = column({
      enrichment: {
        pricePerM2: 4200,
        deviationFromComparables: { pct: 5, median: 4000, n: 12 },
        priceHistory: null,
        daysOnMarket: { days: 34, tone: "kollane" },
        duplicates: [],
        completeness: { score: 85, missing: ["floor_plan"] },
        districtBenchmark: null,
        energyComparison: null,
        renovation: null,
        rentYield: { yieldPct: 6.2, tier: "keskmine", reason: "12 rental listings" },
        liquidity: { totalCount: 24, byPortal: { kv: 24 }, tone: "keskmine" },
      },
    });
    current.scores.fairValue.score = 4;
    current.scores.tco.score = 3;
    current.scores.lifestyle.score = 5;

    const adapted = adaptCurrentColumn(current);

    expect(adapted.metrics.some((metric) => metric.dimension === "pricingFairness")).toBe(true);
    expect(adapted.metrics.some((metric) => metric.dimension === "listingQuality")).toBe(true);
    expect(adapted.metrics.some((metric) => metric.dimension === "liquidity")).toBe(true);
    expect(adapted.metrics.some((metric) => metric.dimension === "investmentPotential")).toBe(true);
  });

  it("does not manufacture missing registry evidence", () => {
    const adapted = adaptCurrentColumn(column());

    expect(adapted.evidence.some((fact) => fact.key === "building.energy_class")).toBe(false);
    expect(adapted.evidence.some((fact) => fact.key === "cadastre.parcel_area_m2")).toBe(false);
  });
});
