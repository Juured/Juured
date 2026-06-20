// Orchestrates the 11 enrichment features. Always returns 200 — best-effort.
// On scrape failure, individual blocks are null and `errors[]` is populated.

import { NextRequest, NextResponse } from "next/server";
import { normalizeAddress } from "@/lib/addressNorm";
import {
  computeCompleteness,
  inferRenovation,
  computeYield,
  energyDistributionFromListings,
  percentileOf,
  daysOnMarketBin,
  NATIONAL_DISTRIBUTION,
  NATIONAL_ENERGY_DISTRIBUTION,
} from "@/lib/enrichment";

type EnrichmentRequest = {
  raw: string;
  addressDisplay: string;
  addressNorm: string;
  wgs84: [number, number] | null;
  manualPrice?: number | null;
  manualArea?: number | null;
  manualRooms?: number | null;
  // From resolve — pre-resolved
  energyClass?: string | null;
  buildYear?: number | null;
  estpropMedian?: number | null;
};

export type EnrichmentData = {
  pricePerM2: number | null;
  deviationFromComparables: { pct: number; median: number; n: number } | null;
  priceHistory: { date: number; price: number }[] | null;
  daysOnMarket: { days: number | null; tone: "roheline" | "kollane" | "punane" | "puudub" } | null;
  duplicates: { portal: string; url: string; price: number }[] | null;
  completeness: { score: number; missing: string[] } | null;
  districtBenchmark: { districtMedian: number | null; districtName: string | null; nationalPercentile: number | null } | null;
  energyComparison: { thisClass: string | null; districtMode: string | null; nationalMode: string } | null;
  renovation: { label: string; signals: string[] } | null;
  rentYield: { yieldPct: number | null; tier: "kõrge" | "keskmine" | "madal" | null; reason: string } | null;
  liquidity: { totalCount: number; byPortal: Record<string, number>; tone: "kõrge" | "keskmine" | "madal" } | null;
};

const SCRAPE = process.env.SCRAPE_SERVICE_URL || "";
const SCRAPE_TIMEOUT_MS = parseInt(process.env.SCRAPE_TIMEOUT_MS || "10000", 10);

async function postJson<T>(path: string, body: unknown): Promise<T | null> {
  if (!SCRAPE) return null;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), SCRAPE_TIMEOUT_MS);
  try {
    const r = await fetch(`${SCRAPE.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    clearTimeout(t);
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    clearTimeout(t);
    return null;
  }
}

type ListingRecord = {
  id: string;
  url: string;
  portal: string;
  price_eur: number;
  area_m2: number;
  rooms: number;
  price_per_m2: number;
  first_seen_at: number;
  daysOnMarket: number;
  address_display: string;
  energy_class?: string;
  photo_url?: string;
};

type ListingScrape = {
  id: string;
  first_seen_at: number;
  daysOnMarket: number;
  priceHistory: { date: number; price: number }[];
  current: {
    price_eur: number;
    area_m2: number;
    rooms: number;
    energy_class: string;
    build_year: number;
    photo_count: number;
    description_len: number;
    has_floor_plan: boolean;
  };
};

type SearchScrape = {
  address_norm: string;
  type: "sale" | "rent";
  totalCount: number;
  byPortal: Record<string, number>;
  listings: ListingRecord[];
  stats: { median_price_eur: number; median_price_per_m2: number; p25_price_per_m2: number; p75_price_per_m2: number };
};

export async function POST(req: NextRequest) {
  let body: EnrichmentRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Vigane päring" }, { status: 400 });
  }
  const errors: string[] = [];
  const out: EnrichmentData = {
    pricePerM2: null,
    deviationFromComparables: null,
    priceHistory: null,
    daysOnMarket: null,
    duplicates: null,
    completeness: null,
    districtBenchmark: null,
    energyComparison: null,
    renovation: null,
    rentYield: null,
    liquidity: null,
  };

  const { raw, addressDisplay, addressNorm, wgs84, manualPrice, manualArea, manualRooms } = body;
  const norm = addressNorm || normalizeAddress(addressDisplay);
  const isKvUrl = /kv\.ee|city24\.ee|kinnisvara24\.ee/i.test(raw);

  if (manualPrice != null && manualArea != null && manualArea > 0) {
    out.pricePerM2 = Math.round(manualPrice / manualArea);
  }

  out.renovation = inferRenovation(body.buildYear ?? null, body.energyClass ?? null);

  if (body.estpropMedian != null) {
    const pctile = out.pricePerM2 != null ? percentileOf(out.pricePerM2, NATIONAL_DISTRIBUTION) : null;
    out.districtBenchmark = {
      districtMedian: body.estpropMedian,
      districtName: null,
      nationalPercentile: pctile,
    };
  }

  if (isKvUrl) {
    const [listing, saleSearch, rentSearch] = await Promise.all([
      postJson<ListingScrape>("/scrape/listing", { url: raw }),
      postJson<SearchScrape>("/scrape/search", {
        address: addressDisplay,
        type: "sale",
        areaMin: manualArea ? manualArea * 0.85 : undefined,
        areaMax: manualArea ? manualArea * 1.15 : undefined,
        roomsMin: manualRooms,
        roomsMax: manualRooms,
      }),
      postJson<SearchScrape>("/scrape/search", { address: addressDisplay, type: "rent" }),
    ]);

    if (!listing) errors.push("scrape/listing ebaõnnestus");
    if (!saleSearch) errors.push("scrape/search sale ebaõnnestus");

    if (listing) {
      out.priceHistory = listing.priceHistory ?? [];
      out.daysOnMarket = daysOnMarketBin(listing.daysOnMarket);
      out.completeness = computeCompleteness({
        photo_count: listing.current.photo_count,
        description_len: listing.current.description_len,
        has_floor_plan: listing.current.has_floor_plan,
        price_eur: listing.current.price_eur,
        area_m2: listing.current.area_m2,
        rooms: listing.current.rooms,
        build_year: listing.current.build_year,
        energy_class: listing.current.energy_class,
      });
    }

    if (saleSearch) {
      const tone = saleSearch.totalCount >= 30 ? "kõrge" : saleSearch.totalCount >= 10 ? "keskmine" : "madal";
      out.liquidity = { totalCount: saleSearch.totalCount, byPortal: saleSearch.byPortal, tone };

      if (out.pricePerM2 != null && saleSearch.stats.median_price_per_m2) {
        const pct = ((out.pricePerM2 - saleSearch.stats.median_price_per_m2) / saleSearch.stats.median_price_per_m2) * 100;
        out.deviationFromComparables = {
          pct: Math.round(pct * 10) / 10,
          median: saleSearch.stats.median_price_per_m2,
          n: saleSearch.totalCount,
        };
      }

      if (manualArea != null && manualRooms != null) {
        const dups = saleSearch.listings.filter(
          (l) => l.id !== listing?.id && Math.abs(l.area_m2 - manualArea) / manualArea <= 0.15 && l.rooms === manualRooms,
        );
        if (dups.length > 0) {
          out.duplicates = dups.map((d) => ({ portal: d.portal, url: d.url, price: d.price_eur }));
        } else {
          out.duplicates = [];
        }
      }

      const thisEnergy = body.energyClass ?? listing?.current.energy_class ?? null;
      const districtDist = energyDistributionFromListings(
        saleSearch.listings.map((l) => ({ energy_class: l.energy_class ?? null })),
      );
      const nationalMode = Object.entries(NATIONAL_ENERGY_DISTRIBUTION).sort((a, b) => b[1] - a[1])[0][0];
      out.energyComparison = {
        thisClass: thisEnergy,
        districtMode: districtDist.mode,
        nationalMode,
      };
    }

    if (rentSearch && rentSearch.stats.median_price_per_m2 != null) {
      out.rentYield = computeYield({
        salePrice: manualPrice ?? null,
        monthlyRentPerM2: rentSearch.stats.median_price_per_m2,
        areaM2: manualArea ?? null,
        rentListingsCount: rentSearch.totalCount,
      });
    }
  }

  return NextResponse.json(
    { data: out, errors, wgs84 },
    { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400" } },
  );
}
