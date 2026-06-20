// Server-side proxy to OpenStreetMap Overpass API for lifestyle POI scoring.
//
// One union query against any of the OSM Overpass mirrors, bucketed by
// category. With aggressive Next.js caching (24h s-maxage, 7d SWR) the
// first request is ~3-8s and subsequent ones are instant.
//
// Mirror chain (priority order):
//   1. overpass-api.de   — official, fresh, but rate-limited on bursts
//   2. overpass.kumi.systems — community mirror
//   3. overpass.osm.ch   — Swiss mirror; ON A 2018 SNAPSHOT. Last-resort.

import { NextRequest, NextResponse } from "next/server";

const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
];

// Tag-bucket rules. Each rule says "if an element's tags satisfy the
// predicate, count it under this key". We use this to bucket the
// flat union of all categories into per-category counts.
const POI_RULES: { key: string; match: (t: Record<string, string>) => boolean }[] = [
  { key: "park",       match: (t) => t.leisure === "park" },
  { key: "school",     match: (t) => t.amenity === "school" || t.amenity === "kindergarten" || t.amenity === "college" },
  { key: "gym",        match: (t) => t.leisure === "fitness_centre" || t.sport === "gym" },
  { key: "transit",    match: (t) => t.public_transport === "platform" || t.highway === "bus_stop" || t.railway === "station" || t.railway === "tram_stop" },
  { key: "shop",       match: (t) => t.shop === "supermarket" || t.shop === "convenience" },
  { key: "cafe",       match: (t) => t.amenity === "cafe" },
  { key: "restaurant", match: (t) => t.amenity === "restaurant" },
];

function scoreFromCount(n: number): { stars: number; label: string } {
  if (n <= 0) return { stars: 1, label: "ei leitud" };
  if (n <= 2) return { stars: 2, label: `${n} lähedal` };
  if (n <= 5) return { stars: 3, label: `${n} lähedal` };
  if (n <= 10) return { stars: 4, label: `${n} lähedal` };
  return { stars: 5, label: `${n} lähedal` };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  const radius = Math.min(Math.max(Number(searchParams.get("radius") ?? 800), 200), 3000);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "lat ja lon on kohustuslikud" }, { status: 400 });
  }

  // Single combined Overpass query — one union of all categories, then
  // `out tags center;` so we get individual elements with tags and can
  // bucket them ourselves. ~3-8s on a fresh request.
  const q = `[out:json][timeout:15];
(nwr["leisure"="park"](around:${radius},${lat},${lon});
nwr["amenity"~"^(school|kindergarten|college)$"](around:${radius},${lat},${lon});
nwr["leisure"="fitness_centre"](around:${radius},${lat},${lon});
nwr["sport"="gym"](around:${radius},${lat},${lon});
nwr["public_transport"="platform"](around:${radius},${lat},${lon});
nwr["highway"="bus_stop"](around:${radius},${lat},${lon});
nwr["railway"~"^(station|tram_stop)$"](around:${radius},${lat},${lon});
nwr["shop"~"^(supermarket|convenience)$"](around:${radius},${lat},${lon});
nwr["amenity"="cafe"](around:${radius},${lat},${lon});
nwr["amenity"="restaurant"](around:${radius},${lat},${lon}););
out tags center;`;

  let elements: { tags?: Record<string, string> }[] = [];
  let usedMirror = "";
  let lastErr = "";
  for (const mirror of OVERPASS_MIRRORS) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 12_000);
    const t0 = Date.now();
    try {
      const r = await fetch(mirror, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          "User-Agent": "vordlus/0.3 (vordlus.vercel.app; contact: hello@vordlus.app)",
        },
        body: q,
        signal: ac.signal,
      });
      clearTimeout(t);
      if (!r.ok) {
        lastErr = `Overpass ${r.status}`;
        continue;
      }
      const j = (await r.json()) as { elements?: { tags?: Record<string, string> }[] };
      const got = j.elements ?? [];
      const ms = Date.now() - t0;
      // If empty + not last mirror, this mirror is probably stale — try next.
      if (got.length === 0 && mirror !== OVERPASS_MIRRORS[OVERPASS_MIRRORS.length - 1]) {
        console.log(`[poi] ${mirror} returned 0 in ${ms}ms, trying next mirror`);
        continue;
      }
      console.log(`[poi] ${mirror} ok in ${ms}ms, ${got.length} elements`);
      elements = got;
      usedMirror = mirror;
      break;
    } catch (e) {
      clearTimeout(t);
      const ms = Date.now() - t0;
      lastErr = (e as Error).message;
      console.log(`[poi] ${mirror} ERR in ${ms}ms: ${lastErr}`);
      continue;
    }
  }

  // Bucket by category. Each element goes into the first matching rule.
  // Multi-tag elements (e.g. a bus stop with shop=convenience) count once
  // for the first matching rule, which is fine.
  const counts: Record<string, number> = {};
  for (const r of POI_RULES) counts[r.key] = 0;
  for (const el of elements) {
    const tags = el.tags ?? {};
    for (const r of POI_RULES) {
      if (r.match(tags)) {
        counts[r.key]++;
        break;
      }
    }
  }

  const result: Record<string, { count: number; stars: number; label: string }> = {};
  for (const r of POI_RULES) {
    const total = counts[r.key];
    result[r.key] = {
      count: total,
      stars: scoreFromCount(total).stars,
      label: scoreFromCount(total).label,
    };
  }

  return NextResponse.json(
    {
      lat,
      lon,
      radius,
      pois: result,
      source: usedMirror || null,
      warning: usedMirror ? null : (lastErr || "Overpass unreachable; showing 0 counts"),
    },
    { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
  );
}
