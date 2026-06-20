import { NextRequest, NextResponse } from "next/server";

const EGT = "https://gsavalik.envir.ee/geoserver/ows";

// Estonian norms: <100 Bq/m³ madal, 100-200 keskmine, >200 korge.
// Sorted ASCENDING; first threshold that exceeds bq determines the class.
const RISK_MAP_BQ: [number, "madal" | "keskmine" | "korge"][] = [
  [100, "madal"],
  [200, "keskmine"],
  [Number.MAX_SAFE_INTEGER, "korge"],
];

function bqToClass(bq: number): "madal" | "keskmine" | "korge" {
  for (const [threshold, cls] of RISK_MAP_BQ) {
    if (bq < threshold) return cls;
  }
  return "korge";
}

type Cfg = {
  typeNames: string;
  field: string;
  map: (raw: string | number | null | undefined) => "madal" | "keskmine" | "korge" | null;
};

// Try settlement → municipality → county. Returns the first hit.
const LAYERS: Cfg[] = [
  { typeNames: "keskkonnainfo:radoon_asustused", field: "keskmine", map: (v) => (typeof v === "number" ? bqToClass(v) : null) },
  { typeNames: "keskkonnainfo:radoon_omavalitsused", field: "keskmine", map: (v) => (typeof v === "number" ? bqToClass(v) : null) },
  { typeNames: "keskkonnainfo:radoon_maakonnad", field: "keskmine", map: (v) => (typeof v === "number" ? bqToClass(v) : null) },
];

async function tryLayer(cfg: Cfg, lat: number, lon: number): Promise<"madal" | "keskmine" | "korge" | null> {
  const cql = `INTERSECTS(shape,POINT(${lon} ${lat}))`;
  const u = new URL(EGT);
  u.searchParams.set("service", "WFS");
  u.searchParams.set("version", "2.0.0");
  u.searchParams.set("request", "GetFeature");
  u.searchParams.set("typeNames", cfg.typeNames);
  u.searchParams.set("outputFormat", "application/json");
  u.searchParams.set("CQL_FILTER", cql);
  u.searchParams.set("count", "1");
  const r = await fetch(u.toString(), {
    headers: { Accept: "application/json", "User-Agent": "vordlus/0.5" },
  });
  if (!r.ok) return null;
  const j = (await r.json()) as { features?: { properties?: Record<string, unknown> }[] };
  const f = j.features?.[0];
  if (!f) return null;
  const raw = f.properties?.[cfg.field];
  return cfg.map(typeof raw === "string" || typeof raw === "number" ? raw : null);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "lat ja lon on kohustuslikud" }, { status: 400 });
  }
  for (const cfg of LAYERS) {
    try {
      const cls = await tryLayer(cfg, lat, lon);
      if (cls) {
        return NextResponse.json(
          { data: { class: cls }, source: `keskkonnainfo:${cfg.typeNames.split(":")[1]}`, error: null },
          { headers: { "Cache-Control": "public, s-maxage=2592000, stale-while-revalidate=2592000" } },
        );
      }
    } catch {
      // try next layer
    }
  }
  return NextResponse.json(
    { data: { class: "madal" }, source: "keskkonnainfo:radoon", error: null },
    { headers: { "Cache-Control": "public, s-maxage=2592000, stale-while-revalidate=2592000" } },
  );
}
