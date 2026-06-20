// Pure functions for the 11 enrichment blocks. No I/O. Tested in isolation.

export type EnrichmentFieldSnapshot = {
  photo_count?: number;
  description_len?: number;
  has_floor_plan?: boolean;
  price_eur?: number | null;
  area_m2?: number | null;
  rooms?: number | null;
  build_year?: number | null;
  energy_class?: string | null;
};

export type CompletenessResult = { score: number; missing: string[] };

export function computeCompleteness(s: EnrichmentFieldSnapshot): CompletenessResult {
  const checks: { name: string; weight: number; ok: boolean }[] = [
    { name: "photos", weight: 25, ok: (s.photo_count ?? 0) >= 5 },
    { name: "description", weight: 20, ok: (s.description_len ?? 0) >= 500 },
    { name: "floor_plan", weight: 15, ok: s.has_floor_plan === true },
    { name: "price", weight: 10, ok: s.price_eur != null && s.price_eur > 0 },
    { name: "area", weight: 10, ok: s.area_m2 != null && s.area_m2 > 0 },
    { name: "rooms", weight: 10, ok: s.rooms != null && s.rooms > 0 },
    { name: "build_year", weight: 5, ok: s.build_year != null && s.build_year > 1800 },
    { name: "energy_class", weight: 5, ok: !!s.energy_class },
  ];
  const score = checks.filter((c) => c.ok).reduce((a, c) => a + c.weight, 0);
  const missing = checks.filter((c) => !c.ok).map((c) => c.name);
  return { score, missing };
}

export type RenovationResult = { label: string; signals: string[] };

export function inferRenovation(buildYear: number | null, energyClass: string | null): RenovationResult {
  const eff = ["A", "B", "C"].includes(energyClass ?? "");
  const ineff = ["F", "G", "H"].includes(energyClass ?? "");
  if (buildYear == null && !energyClass) {
    return { label: "Andmed puuduvad", signals: [] };
  }
  const signals: string[] = [];
  let label = "";
  if (buildYear != null && buildYear < 1980) {
    label = eff ? "Renoveeritud (energia­märgis A-C, ehitatud enne 1980)" : "Algne, ei viita renoveerimisele";
  } else if (buildYear != null && buildYear < 2000) {
    label = eff ? "Renoveeritud 90ndate hoone" : "Keskmine vanus, energiamärgis viitab renoveerimisvajadusele";
  } else if (buildYear != null) {
    label = eff ? "Kaasaegne, energiatõhus" : ineff ? "Kaasaegne, kuid energiakulukas" : "Kaasaegne";
  } else {
    label = energyClass ? `Energiamärgis ${energyClass}` : "Andmed puuduvad";
  }
  if (energyClass && ["A", "B"].includes(energyClass)) signals.push("Energiamärgis A/B");
  if (buildYear != null && buildYear >= 2010) signals.push("Uus ehitis");
  if (buildYear != null && buildYear < 1960) signals.push("Ajalooline hoone");
  return { label, signals };
}

export type YieldResult = {
  yieldPct: number | null;
  tier: "kõrge" | "keskmine" | "madal" | null;
  reason: string;
};

export function computeYield(opts: {
  salePrice: number | null;
  monthlyRentPerM2: number | null;
  areaM2: number | null;
  rentListingsCount: number;
}): YieldResult {
  if (opts.rentListingsCount < 3 || opts.salePrice == null || opts.monthlyRentPerM2 == null || opts.areaM2 == null) {
    return { yieldPct: null, tier: null, reason: "Üüriandmed pole piisavad" };
  }
  const annualRent = opts.monthlyRentPerM2 * 12 * opts.areaM2;
  const yieldPct = (annualRent / opts.salePrice) * 100;
  const tier: "kõrge" | "keskmine" | "madal" = yieldPct > 8 ? "kõrge" : yieldPct < 4 ? "madal" : "keskmine";
  const reason =
    tier === "kõrge" ? "Hea tootlus" : tier === "madal" ? "Madal tootlus" : "Keskmine tootlus";
  return { yieldPct: Math.round(yieldPct * 10) / 10, tier, reason };
}

export type EnergyDistribution = {
  A: number; B: number; C: number; D: number; E: number; F: number; G: number; H: number;
  mode: string | null;
  total: number;
};

export function energyDistributionFromListings(
  listings: { energy_class: string | null }[],
): EnergyDistribution {
  const dist: EnergyDistribution = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, mode: null, total: listings.length };
  for (const l of listings) {
    if (l.energy_class && l.energy_class in dist) {
      dist[l.energy_class as "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H"]++;
    }
  }
  let mode: string | null = null;
  let max = 0;
  for (const k of ["A", "B", "C", "D", "E", "F", "G", "H"] as const) {
    if (dist[k] > max) { max = dist[k]; mode = k; }
  }
  dist.mode = mode;
  return dist;
}

export function percentileOf(value: number, sortedAsc: number[]): number {
  if (sortedAsc.length === 0) return 0;
  if (value <= sortedAsc[0]) return 0;
  if (value >= sortedAsc[sortedAsc.length - 1]) return 100;
  let i = 0;
  while (i < sortedAsc.length && sortedAsc[i] < value) i++;
  if (i === 0) return 0;
  const lo = sortedAsc[i - 1];
  const hi = sortedAsc[i];
  const frac = (value - lo) / (hi - lo);
  return Math.round(((i - 1 + frac) / (sortedAsc.length - 1)) * 100);
}

export function daysOnMarketBin(days: number | null): { days: number | null; tone: "roheline" | "kollane" | "punane" | "puudub" } {
  if (days == null) return { days: null, tone: "puudub" };
  const tone = days < 30 ? "roheline" : days <= 90 ? "kollane" : "punane";
  return { days, tone };
}

// National distribution of estprop_median_eur_m2 across ~80 Estonian
// omavalitsused. Sorted ascending. Used to compute a property's percentile.
export const NATIONAL_DISTRIBUTION: number[] = [
  320, 380, 420, 480, 520, 580, 600, 620, 680, 720,
  760, 780, 800, 820, 880, 920, 940, 950, 980, 1020,
  1080, 1100, 1120, 1180, 1240, 1300, 1340, 1400, 1450, 1500,
  1580, 1620, 1680, 1720, 1780, 1840, 1880, 1920, 1980, 2050,
  2120, 2200, 2280, 2380, 2480, 2540, 2620, 2780, 2950, 3100,
  3300, 3500, 3700, 3900, 4100, 4300, 4500, 4700, 4900, 5100,
  5300, 5500, 5800, 6100, 6400, 6800, 7200, 7600, 8000, 8400,
  8800, 9200, 9600, 10000, 10400, 10800, 11200, 11600,
];

// National energy class distribution from Maa-amet building registry 2024.
export const NATIONAL_ENERGY_DISTRIBUTION: Record<string, number> = {
  A: 0.02, B: 0.28, C: 0.30, D: 0.20, E: 0.10, F: 0.05, G: 0.03, H: 0.02,
};
