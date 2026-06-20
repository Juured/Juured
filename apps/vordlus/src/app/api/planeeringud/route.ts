import { NextRequest, NextResponse } from "next/server";

const NORDAPI = "https://nordapi.ee/api/v1/estonian-plans";

type Plan = {
  id: number;
  name: string;
  purpose: string;
  organizer: string;
  adopted_date: string;
  established_date: string;
  initiated_date: string;
  annulled_date: string | null;
  // Lat/lon fields vary by NordAPI version; we look for any of these.
  lat?: number;
  lon?: number;
  latitude?: number;
  longitude?: number;
  geom?: { coordinates?: number[][] | number[][][] };
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  const radius = Math.min(Math.max(Number(searchParams.get("radius") ?? 500), 100), 3000);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "lat ja lon on kohustuslikud" }, { status: 400 });
  }
  try {
    const r = await fetch(NORDAPI, {
      headers: { Accept: "application/json", "User-Agent": "vordlus/0.5" },
    });
    if (!r.ok) {
      return NextResponse.json(
        { data: null, source: "nordapi-plank", error: `NordAPI ${r.status}` },
        { status: 502 },
      );
    }
    const body = (await r.json()) as { data?: Plan[]; total?: number } | Plan[];
    // NordAPI returns { data: [...], total, count, success, page } — pull out the list.
    const all: Plan[] = Array.isArray(body) ? body : (body.data ?? []);
    const dLat = radius / 111_000;
    const dLon = radius / (111_000 * Math.cos((lat * Math.PI) / 180));
    const filtered = all.filter((p) => {
      const plat = p.lat ?? p.latitude ?? null;
      const plon = p.lon ?? p.longitude ?? null;
      if (plat == null || plon == null) return false;
      return Math.abs(plat - lat) < dLat && Math.abs(plon - lon) < dLon;
    });
    const plans = filtered.map((p) => {
      // PLANK data doesn't always carry maxFloors — best-effort extraction from
      // the plan name/purpose string (Estonian "elamu" + "korrus" pattern).
      const text = `${p.name} ${p.purpose ?? ""}`.toLowerCase();
      let maxFloors = 0;
      const m = text.match(/(\d+)\s*(korrus|korru|sht|этаж)/);
      if (m) maxFloors = parseInt(m[1], 10);
      return { name: p.name, maxFloors };
    });
    return NextResponse.json(
      { data: { plans }, source: "nordapi-plank", error: null },
      { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=2592000" } },
    );
  } catch (e) {
    return NextResponse.json(
      { data: null, source: "nordapi-plank", error: (e as Error).message },
      { status: 502 },
    );
  }
}
