import { NextRequest, NextResponse } from "next/server";

const EGT = "https://gsavalik.envir.ee/geoserver/ows";

// Flood zones from EU Floods Directive (kr_yleujutusohuga_ala).
// "tyyp" property: 100a = 100-year return period, 1000a = 1000-year, others vary.
// We render the highest severity found.
type FloodZone = "ei_ole_ohualas" | "100a_ohualas" | "1000a_ohualas";

function tyypToZone(raw: string | null | undefined): FloodZone {
  if (!raw) return "ei_ole_ohualas";
  const t = raw.toLowerCase();
  // 1000-year: 0.1% annual exceedance ("0.1%") or the "1000a" string code.
  // 100-year: 1% annual exceedance ("1%") or the "100a" string code.
  // 1% is the canonical marker for 100-year — do NOT classify it as 1000-year.
  if (t.includes("1000") || t.includes("0.1%")) return "1000a_ohualas";
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
    // Pick the highest-severity zone. We compare as strings in a fixed
    // order: ei_ole_ohualas < 100a_ohualas < 1000a_ohualas.
    const ORDER: Record<FloodZone, number> = { ei_ole_ohualas: 0, "100a_ohualas": 1, "1000a_ohualas": 2 };
    let best: FloodZone = "ei_ole_ohualas";
    for (const f of j.features ?? []) {
      const z = tyypToZone(f.properties?.tyyp);
      if (ORDER[z] > ORDER[best]) best = z;
    }
    return NextResponse.json(
      { data: { zone: best }, source: "eelis:kr_yleujutusohuga_ala", error: null },
      { headers: { "Cache-Control": "public, s-maxage=2592000, stale-while-revalidate=2592000" } },
    );
  } catch (e) {
    return NextResponse.json(
      { data: null, source: "eelis:kr_yleujutusohuga_ala", error: (e as Error).message },
      { status: 502 },
    );
  }
}
