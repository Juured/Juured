// Five-score evaluation for property comparison.
//
//   1. Fair Value       — is the asking price reasonable vs market?
//   2. TCO              — Total Cost of Ownership (energy + heating)
//   3. Appreciation     — future value outlook (build year + energy class + city)
//   4. Lifestyle Match  — neighborhood POI density (parks, schools, transit, etc.)
//   5. Green Mortgage   — suitability for a rohelaen (energy class + heating + monthly cost)
//
// Each score is 1–5 (integer + label).
// The numeric value is meaningful for both visual rating and filtering
// ("elustiil 3+ stars" means Lifestyle Match ≥ 3).

import type { CadastreRecord, EhrBuilding } from "./estdata";
import type { Lifestyle } from "./lifestyle";

export type ScoreKey = "fairValue" | "tco" | "appreciation" | "lifestyle" | "greenMortgage";

export const SCORE_LABELS: Record<ScoreKey, { title: string; subtitle: string; oneStar: string; fiveStar: string }> = {
  fairValue: {
    title: "Fair Value",
    subtitle: "Hind vs. turu mediaan",
    oneStar: "väga ülehinnatud",
    fiveStar: "väga hea õiglase väärtusega",
  },
  tco: {
    title: "Elamiskulud",
    subtitle: "Igakuised kulud (küte, elekter)",
    oneStar: "väga kulukas sees elada",
    fiveStar: "soodne sees elada",
  },
  appreciation: {
    title: "Väärtuse kasv",
    subtitle: "Tuleviku potentsiaal",
    oneStar: "väga halb potentsiaal, kahanev",
    fiveStar: "tulevikus väärtus kasvab",
  },
  lifestyle: {
    title: "Elustiil",
    subtitle: "Lähedal: park, kool, transport",
    oneStar: "tühi piirkond",
    fiveStar: "kõik lähedal",
  },
  greenMortgage: {
    title: "Rohelaen",
    subtitle: "Sobivus rohelaenuks",
    oneStar: "ei sobi rohelaenuks",
    fiveStar: "rohelaen kuni 90% LTV",
  },
};

// ===== 1. Fair Value =====
// ratio = price / baseline. < 1 = below market, > 1 = above.
// Baseline preference: estprop_median_eur_m2 (Maa-amet 2022 per-omavalitsus) →
// batch median (only meaningful with 3+ properties) → maks_hind / area (tax value).
export function fairValueScore(
  pricePerM2: number | null,
  estpropMedian: number | null,
  batchMedian: number | null,
  maksHind: number | null,
  area: number | null,
): { score: number; ratio: number | null; baseline: number | null; baselineSource: string; reason: string } {
  if (pricePerM2 == null || pricePerM2 <= 0) {
    return { score: 0, ratio: null, baseline: null, baselineSource: "none", reason: "andmed puuduvad" };
  }
  let baseline: number | null = null;
  let baselineSource = "none";
  if (estpropMedian != null && estpropMedian > 0) {
    baseline = estpropMedian;
    baselineSource = "Maa-amet 2022";
  } else if (batchMedian != null && batchMedian > 0) {
    baseline = batchMedian;
    baselineSource = "võrdluse mediaan";
  } else if (maksHind != null && area && area > 0) {
    baseline = maksHind / area;
    baselineSource = "maksustamisväärtus";
  }
  if (baseline == null) {
    return { score: 3, ratio: null, baseline: null, baselineSource: "none", reason: "võrdlusandmed puuduvad" };
  }
  const ratio = pricePerM2 / baseline;
  let score: number;
  if (ratio <= 0.7) score = 5;
  else if (ratio <= 0.9) score = 4;
  else if (ratio <= 1.1) score = 3;
  else if (ratio <= 1.3) score = 2;
  else score = 1;
  return {
    score,
    ratio,
    baseline,
    baselineSource,
    reason:
      score === 5
        ? `${baselineSource}st oluliselt madalam`
        : score === 4
          ? `alla ${baselineSource}i`
          : score === 3
            ? `${baselineSource}i lähedal`
            : score === 2
              ? `üle ${baselineSource}i`
              : `${baselineSource}st oluliselt kõrgem`,
  };
}

// ===== 2. TCO (Total Cost of Ownership) =====
// Primary signal: energiaKaalKasutus (kWh/m²/year). The lower, the cheaper.
// Secondary: energy class as a fallback.
export function tcoScore(
  energyKlass: string | null,
  kWhM2Year: number | null,
  area: number | null,
): { score: number; kWh: number | null; reason: string } {
  if (kWhM2Year != null && kWhM2Year > 0) {
    let score: number;
    if (kWhM2Year <= 80) score = 5;
    else if (kWhM2Year <= 120) score = 4;
    else if (kWhM2Year <= 160) score = 3;
    else if (kWhM2Year <= 220) score = 2;
    else score = 1;
    const annualKWh = area && kWhM2Year ? Math.round(area * kWhM2Year) : null;
    return {
      score,
      kWh: kWhM2Year,
      reason: annualKWh ? `~${annualKWh.toLocaleString("et-EE")} kWh/aastas` : `${kWhM2Year} kWh/m²/aastas`,
    };
  }
  if (energyKlass) {
    const map: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, E: 1, F: 1, G: 1, H: 1 };
    const s = map[energyKlass] ?? 3;
    return { score: s, kWh: null, reason: `energia­märgis ${energyKlass}` };
  }
  return { score: 0, kWh: null, reason: "andmed puuduvad" };
}

// ===== 3. Appreciation Potential =====
// Modern + energy-efficient = appreciates. Old + inefficient = risks losing value.
export function appreciationScore(
  buildYear: number | null,
  energyKlass: string | null,
): { score: number; reason: string } {
  if (buildYear == null) {
    return { score: 0, reason: "valmimisaasta puudub" };
  }
  const eff = energyKlass && ["A", "B", "C"].includes(energyKlass);
  const mid = energyKlass && ["D", "E"].includes(energyKlass);
  const ineff = energyKlass && ["F", "G", "H"].includes(energyKlass);
  const modern = buildYear >= 2015;
  const late20 = buildYear >= 1990 && buildYear < 2015;
  const soviet = buildYear >= 1960 && buildYear < 1990;
  const historical = buildYear < 1960;

  let score: number;
  let reason: string;
  if (modern && eff) {
    score = 5;
    reason = "uus + roheline energia­märgis";
  } else if ((modern && mid) || (late20 && eff)) {
    score = 4;
    reason = "uus või renoveeritud, hea energia­märgis";
  } else if (modern && ineff) {
    score = 3;
    reason = "uus, kuid energiakulukas";
  } else if (late20 && mid) {
    score = 3;
    reason = "keskmine vanus ja energia­märgis";
  } else if (soviet && eff) {
    score = 3;
    reason = "renoveeritud nõuk. aegade ehitis";
  } else if (soviet && (mid || ineff)) {
    score = 2;
    reason = "nõuk. aegne paneelmaja, kõrge energiakulu";
  } else if (historical && eff) {
    score = 2;
    reason = "väga vana, kuid renoveeritud";
  } else {
    score = 1;
    reason = "väga vana, kõrge hoolduskulu risk";
  }
  return { score, reason };
}

// ===== 4. Lifestyle Match =====
// Weights: each POI category contributes. Sum → score 1–5.
const LIFESTYLE_WEIGHTS: { key: keyof Lifestyle; weight: number }[] = [
  { key: "transit", weight: 2.0 },   // ühistransport — high impact
  { key: "school", weight: 2.0 },    // kool
  { key: "park", weight: 1.5 },      // park
  { key: "cafe", weight: 1.0 },
  { key: "restaurant", weight: 1.0 },
  { key: "shop", weight: 1.0 },
  { key: "gym", weight: 0.5 },
];

// 1 unit ≈ walking distance (~5 min). 5+ units = excellent.
// We cap each category at a sensible max (e.g. 6 transit stops) to
// prevent a single category from dominating.
function capForKey(k: keyof Lifestyle): number {
  if (k === "transit") return 8;
  if (k === "cafe" || k === "restaurant") return 8;
  if (k === "shop") return 4;
  if (k === "school") return 4;
  if (k === "park") return 3;
  if (k === "gym") return 3;
  return 5;
}

export function lifestyleScore(l: Lifestyle): { score: number; top: { key: keyof Lifestyle; count: number }[]; reason: string } {
  let total = 0;
  const maxPossible = LIFESTYLE_WEIGHTS.reduce((a, w) => a + w.weight * capForKey(w.key), 0);
  for (const { key, weight } of LIFESTYLE_WEIGHTS) {
    const v = l[key];
    if (!v) continue;
    const capped = Math.min(v.count, capForKey(key));
    total += capped * weight;
  }
  const norm = total / maxPossible; // 0–1
  let score: number;
  if (norm >= 0.7) score = 5;
  else if (norm >= 0.5) score = 4;
  else if (norm >= 0.3) score = 3;
  else if (norm >= 0.15) score = 2;
  else score = 1;
  // Top contributing categories for the reason
  const top = LIFESTYLE_WEIGHTS
    .map((w) => ({ key: w.key, count: l[w.key]?.count ?? 0 }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 2);
  const reason = top.length > 0
    ? `${top.map((t) => `${t.count} ${t.key}`).join(", ")} lähedal`
    : "tühi piirkond";
  return { score, top, reason };
}

// ===== 5. Green Mortgage Suitability =====
// Estonian banks offer "rohelaen" (green mortgage) with better terms
// (lower rate, up to 90% LTV) for energy-efficient homes. Heuristic:
//   - Energy class is the primary signal (A/B=5, C=4, D=3, E/F=2, G/H=1)
//   - Fossil-fuel heating (oil/gas) penalizes by 1
//   - High monthly cost (>250 EUR) penalizes by 1
//   - Missing energy class → score 0, neutral tone
export function greenMortgageScore(
  energyKlass: string | null,
  heating: string | null,
  monthlyEur: number | null,
): { score: number; tone: "good" | "warn" | "bad" | "neutral"; reason: string } {
  if (!energyKlass) {
    return { score: 0, tone: "neutral", reason: "andmed puuduvad" };
  }
  const baseScore: Record<string, number> = { A: 5, B: 5, C: 4, D: 3, E: 2, F: 2, G: 1, H: 1 };
  let score = baseScore[energyKlass] ?? 3;
  if (heating) {
    const h = heating.toLowerCase();
    if (h.includes("õli") || h.includes("gaas")) score = Math.max(1, score - 1);
  }
  if (monthlyEur != null && monthlyEur > 250) score = Math.max(1, score - 1);
  const tone: "good" | "warn" | "bad" | "neutral" = score >= 4 ? "good" : score >= 3 ? "warn" : score >= 1 ? "bad" : "neutral";
  const reason = `Energiamärgis ${energyKlass}${heating ? `, ${heating.toLowerCase()}` : ""}${monthlyEur ? ` ~€${Math.round(monthlyEur)} / kk` : ""}`;
  return { score, tone, reason };
}

// ===== Combined: compute all five scores for a property =====

export type PropertyScores = {
  fairValue: ReturnType<typeof fairValueScore>;
  tco: ReturnType<typeof tcoScore>;
  appreciation: ReturnType<typeof appreciationScore>;
  lifestyle: ReturnType<typeof lifestyleScore>;
  greenMortgage: ReturnType<typeof greenMortgageScore>;
  // Simple average for an "overall" badge
  overall: number;
  overallLabel: string;
};

export function computeScores(opts: {
  c: CadastreRecord | null;
  e: EhrBuilding | null;
  lifestyle: Lifestyle;
  marketMedian: number | null;
  pricePerM2Override?: number | null;
  // The user's actual unit area (for TCO), not the building's net area.
  unitArea?: number | null;
}): PropertyScores {
  const { c, e, lifestyle, marketMedian, pricePerM2Override, unitArea } = opts;
  const energy = e?.energy[0] ?? null;
  const buildYear = e?.esmaneKasutus
    ? parseInt(e.esmaneKasutus, 10)
    : e?.ehAlustKp
      ? parseInt(String(e.ehAlustKp).slice(0, 4), 10)
      : null;
  // Price-per-m²: ALWAYS from the user's manualPrice/manualArea when given.
  // Never fall back to maks_hind/pindala (that's the 2022 tax per parcel).
  const pricePerM2 = pricePerM2Override != null ? pricePerM2Override : null;

  // TCO area: user's unit area, not the building's total
  const tcoArea = unitArea ?? null;

  const fairValue = fairValueScore(pricePerM2, c?.estprop_median_eur_m2 ?? null, marketMedian, c?.maks_hind ?? null, tcoArea);
  const tco = tcoScore(energy?.energiaKlass ?? null, energy?.energiaKaalKasutus ? Number(energy.energiaKaalKasutus) : null, tcoArea);
  const appreciation = appreciationScore(buildYear, energy?.energiaKlass ?? null);
  const lifestyleS = lifestyleScore(lifestyle);
  const greenMortgage = greenMortgageScore(energy?.energiaKlass ?? null, energy?.kytteTyypTxt ?? null, null);

  // Overall: weighted average (lifestyle counts more for buyers, fairValue counts more for investors)
  const vals = [fairValue.score, tco.score, appreciation.score, lifestyleS.score, greenMortgage.score].filter((s) => s > 0);
  const overall = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  const overallLabel =
    overall >= 4.5
      ? "suurepärane"
      : overall >= 3.5
        ? "hea"
        : overall >= 2.5
          ? "keskmine"
          : overall >= 1.5
            ? "nõrk"
            : overall > 0
              ? "halb"
              : "andmed puuduvad";

  return { fairValue, tco, appreciation, lifestyle: lifestyleS, greenMortgage, overall, overallLabel };
}
