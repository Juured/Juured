// Comparison state — a list of comparison "columns", each tied to a property.
// Persisted to localStorage and sharable via URL.

import type { CadastreRecord, EhrBuilding } from "./estdata";
import type { Lifestyle } from "./lifestyle";
import type { PropertyScores } from "./scores";
import type { EnrichmentData } from "@/app/api/enrich/route";

export type CompareInput = {
  raw: string;
  manualPrice?: number | null;
  manualArea?: number | null;
  manualRooms?: number | null;
  manualListingPhoto?: string | null; // for the hackathon demo only
  manualListingUrl?: string | null;   // for the hackathon demo only
  manualEnergyClass?: string | null;  // for the hackathon demo only
};

export type CompareColumn = {
  id: string; // stable uuid for the column
  input: CompareInput;
  cadastre: CadastreRecord | null;
  ehr: EhrBuilding | null;
  lifestyle: Lifestyle;
  transit: { stopCount: number; frequency: number } | null;
  radon: { class: "madal" | "keskmine" | "korge" } | null;
  flood: { zone: "ei_ole_ohualas" | "100a_ohualas" | "1000a_ohualas" } | null;
  planeeringud: { name: string; maxFloors: number }[] | null;
  listingPhoto?: string | null;
  enrichment: EnrichmentData | null;
  lat?: number | null;
  lon?: number | null;
  scores: PropertyScores; // 4-score evaluation
  fetchedAt: number;
  errors: string[];
};

const STORAGE_KEY = "vordlus.compare.v1";

export function loadCompare(): CompareColumn[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCompare(cols: CompareColumn[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cols));
  } catch {}
}

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// URL share: encode each column's raw input + manual fields as base64-JSON.
// ?c=<base64> in the URL → restored on load. We carry the raw string plus
// the manual fields so that the demo's manual enhancements (price, area,
// rooms, photo, energy class) survive the share.
export type ShareableColumn = {
  raw: string;
  price?: number | null;
  area?: number | null;
  rooms?: number | null;
  listingPhoto?: string | null;
  listingUrl?: string | null;
  energyClass?: string | null;
};

export function encodeShareUrl(cols: CompareColumn[]): string {
  const inputs: ShareableColumn[] = cols.map((c) => ({
    raw: c.input.raw,
    price: c.input.manualPrice ?? null,
    area: c.input.manualArea ?? null,
    rooms: c.input.manualRooms ?? null,
    listingPhoto: c.input.manualListingPhoto ?? null,
    listingUrl: c.input.manualListingUrl ?? null,
    // Preserve the demo's energy class so the recipient's TCO and
    // Rohelaen scores still compute. Strip the EHR override we applied
    // in resolveSlot — only the *manual* class is what the user typed
    // (or the demo button set), so that's what we share.
    energyClass: c.ehr?.energy?.[0]?.energiaKlass ?? null,
  }));
  if (inputs.length === 0) return "";
  const json = JSON.stringify(inputs);
  if (typeof btoa === "function") return btoa(unescape(encodeURIComponent(json)));
  return Buffer.from(json, "utf-8").toString("base64");
}

export function decodeShareUrl(b64: string): ShareableColumn[] {
  try {
    const json =
      typeof atob === "function"
        ? decodeURIComponent(escape(atob(b64)))
        : Buffer.from(b64, "base64").toString("utf-8");
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr.map((x): ShareableColumn => {
      if (typeof x === "string") return { raw: x };
      if (x && typeof x === "object" && typeof x.raw === "string") {
        return {
          raw: x.raw,
          price: typeof x.price === "number" ? x.price : null,
          area: typeof x.area === "number" ? x.area : null,
          rooms: typeof x.rooms === "number" ? x.rooms : null,
          listingPhoto: typeof x.listingPhoto === "string" ? x.listingPhoto : null,
          listingUrl: typeof x.listingUrl === "string" ? x.listingUrl : null,
          energyClass: typeof x.energyClass === "string" ? x.energyClass : null,
        };
      }
      return { raw: "" };
    }).filter((c) => c.raw.length > 0);
  } catch {
    return [];
  }
}

// Default scores — used while data is loading
import { computeScores } from "./scores";
import { EMPTY_LIFESTYLE } from "./lifestyle";

export function defaultScores(): PropertyScores {
  return computeScores({
    c: null,
    e: null,
    lifestyle: EMPTY_LIFESTYLE,
    marketMedian: null,
  });
}
