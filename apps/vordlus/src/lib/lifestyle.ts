// Lifestyle scoring — combines live OpenStreetMap / Maa-amet POI counts
// for accurate neighborhood scoring.

export type LifestyleKey = "park" | "school" | "gym" | "transit" | "shop" | "cafe" | "restaurant";

export type Lifestyle = Record<LifestyleKey, { stars: number; label: string; count: number }>;

export const LIFESTYLE_LABELS: Record<LifestyleKey, string> = {
  park: "Park lähedal",
  school: "Kool lähedal",
  gym: "Spordisaal lähedal",
  transit: "Ühistransport",
  shop: "Pood lähedal",
  cafe: "Kohvik lähedal",
  restaurant: "Restoran lähedal",
};

export const LIFESTYLE_STAR_LABELS = ["", "halb", "nõrk", "keskmine", "hea", "suurepärane"];

export function lifestyleFromPOI(
  poi: Partial<Record<LifestyleKey, { count: number; stars: number; label: string }>>,
): Lifestyle {
  const counts: LifestyleCounts = {};
  for (const key of Object.keys(LIFESTYLE_LABELS) as LifestyleKey[]) {
    counts[key] = poi?.[key]?.count ?? 0;
  }
  return scoreLifestyle(counts);
}

const MISSING_LABEL = "Andmed puuduvad";

function starsFromCount(n: number): { stars: number; label: string } {
  if (n <= 0) return { stars: 0, label: MISSING_LABEL };
  if (n < 5) return { stars: 3, label: `${n} lähedal` };
  if (n < 8) return { stars: 4, label: `${n} lähedal` };
  return { stars: 5, label: `${n}+ lähedal` };
}

export type LifestyleCounts = Partial<Record<LifestyleKey, number>>;

// Public: takes real POI counts (or null when both Overpass and Maa-amet
// huvipunktid returned nothing). NEVER falls back to random.
export function scoreLifestyle(counts: LifestyleCounts | null): Lifestyle {
  const k: LifestyleKey[] = ["park", "school", "gym", "transit", "shop", "cafe", "restaurant"];
  const out = {} as Lifestyle;
  for (const key of k) {
    const n = counts?.[key] ?? 0;
    const { stars, label } = starsFromCount(n);
    out[key] = { stars, label, count: n };
  }
  return out;
}

export const EMPTY_LIFESTYLE: Lifestyle = {
  park: { stars: 0, label: MISSING_LABEL, count: 0 },
  school: { stars: 0, label: MISSING_LABEL, count: 0 },
  gym: { stars: 0, label: MISSING_LABEL, count: 0 },
  transit: { stars: 0, label: MISSING_LABEL, count: 0 },
  shop: { stars: 0, label: MISSING_LABEL, count: 0 },
  cafe: { stars: 0, label: MISSING_LABEL, count: 0 },
  restaurant: { stars: 0, label: MISSING_LABEL, count: 0 },
};
