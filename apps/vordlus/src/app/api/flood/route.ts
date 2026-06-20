import { NextRequest, NextResponse } from "next/server";

const EGT = "https://gsavalik.envir.ee/geoserver/ows";

// Flood zones from EU Floods Directive (kr_yleujutusohuga_ala).
// "tyyp" property: 100a = 100-year return period, 1000a = 1000-year, others vary.
// We render the highest severity found.
type FloodZone = "ei_ole_ohualas" | "100a_ohualas" | "1000a_ohualas";

const RANK: Record<string, number> = { ei_ole_ohualas: 0, "100a_ohualas": 1, "1000a_ohualas": 2 };

function rankToZone(rank: number): FloodZone {
  if (rank >= 2) return "1000a_ohualas";
  if (rank >= 1) return "100a_ohualas";
  return "ei_ole_ohualas";
}

function tyypToZone(raw: string | null | undefined): FloodZone {
  if (!raw) return "ei_ole_ohualas";
  const t = raw.toLowerCase();
  if (t.includes("1000") || t.includes("1%") || t.includes("0.1")) return "1000a_ohualas";
  if (t.includes("100") || t.includes("1%")) return "100a_ohualas";
  return "ei_ole_ohualas";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "lat ja lon on kohustuslikud" }, { status: 400 });
  }
  const cql = `INTERSECTS(shape,POINT(${lon} ${lat}))`;
  const u = new URL(EGT);
  u.searchParams.set("service", "WFS");
  u.searchParams.set("version", "2.0.0");
  u.searchParams.set("request", "GetFeature");
  u.searchParams.set("typeNames", "eelis:kr_yleujutusohuga_ala");
  u.searchParams.set("outputFormat", "application/json");
  u.searchParams.set("CQL_FILTER", cql);
  u.searchParams.set("count", "10");
  try {
    const r = await fetch(u.toString(), {
      headers: { Accept: "application/json", "User-Agent": "vordlus/0.5" },
    });
    if (!r.ok) {
      return NextResponse.json(
        { data: null, source: "eelis:kr_yleujutusohuga_ala", error: `WFS ${r.status}` },
        { status: 502 },
      );
    }
    const j = (await r.json()) as { features?: { properties?: { tyyp?: string } }[] };
    let bestRank = 0;
    for (const f of j.features ?? []) {
      const z = tyypToZone(f.properties?.tyyp);
      const rk = RANK[z] ?? 0;
      if (rk > bestRank) bestRank = rk;
    }
    const zone = rankToZone(bestRank);
    return NextResponse.json(
      { data: { zone }, source: "eelis:kr_yleujutusohuga_ala", error: null },
      { headers: { "Cache-Control": "public, s-maxage=2592000, stale-while-revalidate=2592000" } },
    );
  } catch (e) {
    return NextResponse.json(
      { data: null, source: "eelis:kr_yleujutusohuga_ala", error: (e as Error).message },
      { status: 502 },
    );
  }
}
