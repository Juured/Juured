import { NextRequest, NextResponse } from "next/server";

const WFS = "https://gsavalik.envir.ee/geoserver/maaamet/wfs";

const LOIK_RULES: { key: "park" | "school" | "gym" | "transit" | "shop" | "cafe" | "restaurant"; match: (s: string) => boolean }[] = [
  { key: "park",       match: (s) => s.includes("park") },
  { key: "school",     match: (s) => s.includes("kool") || s.includes("lasteaed") || s.includes("gümnaasium") },
  { key: "gym",        match: (s) => s.includes("spord") || s.includes("sport") || s.includes("jõusaal") },
  { key: "transit",    match: (s) => s.includes("bussipeatus") || s.includes("trammipeatus") || s.includes("raudteejaam") },
  { key: "shop",       match: (s) => s.includes("kauplus") || s.includes("toidupood") || s.includes("supermarket") },
  { key: "cafe",       match: (s) => s.includes("kohvik") || s.includes("cafe") },
  { key: "restaurant", match: (s) => s.includes("restoran") || s.includes("restaurant") },
];

function bucketByCategory(features: { properties?: Record<string, string> }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of LOIK_RULES) counts[r.key] = 0;
  for (const f of features) {
    const loik = (f.properties?.LOIK ?? "").toLowerCase();
    if (!loik) continue;
    for (const r of LOIK_RULES) {
      if (r.match(loik)) {
        counts[r.key]++;
        break;
      }
    }
  }
  return counts;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  const radius = Math.min(Math.max(Number(searchParams.get("radius") ?? 1000), 200), 5000);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "lat ja lon on kohustuslikud" }, { status: 400 });
  }

  const dLat = radius / 111_000;
  const dLon = radius / (111_000 * Math.cos((lat * Math.PI) / 180));
  const minLat = lat - dLat;
  const maxLat = lat + dLat;
  const minLon = lon - dLon;
  const maxLon = lon + dLon;

  const cql = `BBOX(geom,${minLon},${minLat},${maxLon},${maxLat},'EPSG:4326')`;
  const u = new URL(WFS);
  u.searchParams.set("service", "WFS");
  u.searchParams.set("version", "2.0.0");
  u.searchParams.set("request", "GetFeature");
  u.searchParams.set("typeNames", "maaamet:huvipunktid");
  u.searchParams.set("outputFormat", "application/json");
  u.searchParams.set("CQL_FILTER", cql);
  u.searchParams.set("count", "200");

  try {
    const r = await fetch(u.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "vordlus/0.4 (+https://vordlus.vercel.app)",
      },
    });
    if (!r.ok) {
      return NextResponse.json(
        { data: null, source: "maaamet-huvipunktid", error: `WFS ${r.status}` },
        { status: 502 },
      );
    }
    const j = (await r.json()) as { features?: { properties?: Record<string, string> }[] };
    const counts = bucketByCategory(j.features ?? []);
    return NextResponse.json(
      { data: counts, source: "maaamet-huvipunktid", error: null },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch (e) {
    return NextResponse.json(
      { data: null, source: "maaamet-huvipunktid", error: (e as Error).message },
      { status: 502 },
    );
  }
}
