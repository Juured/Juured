import { NextRequest, NextResponse } from "next/server";
import proj4 from "proj4";

proj4.defs(
  "EPSG:3301",
  "+proj=lcc +lat_0=57.5175539305556 +lon_0=24 +lat_1=59.3333333333333 +lat_2=58 +x_0=500000 +y_0=6375000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs",
);

// Maa-amet orthophoto WMS. Server-side render of a small bbox around
// the property's WGS84 center. The result is a single aerial photo
// (not an interactive map) shown as the property's image.
//
// EESTIFOTO is only published in EPSG:3301 (L-EST97), so we transform
// the WGS84 center into L-EST97 first, then build the bbox in metres.
const WMS = "https://kaart.maaamet.ee/wms/fotokaart";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  // Half-width in metres. 25m gives a ~50m x 50m patch — a single house.
  const half = Math.min(Math.max(Number(searchParams.get("half") ?? 25), 10), 200);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "lat ja lon on kohustuslikud" }, { status: 400 });
  }

  const [x, y] = proj4("EPSG:4326", "EPSG:3301", [lon, lat]);
  const minX = x - half;
  const minY = y - half;
  const maxX = x + half;
  const maxY = y + half;

  const u = new URL(WMS);
  u.searchParams.set("service", "WMS");
  u.searchParams.set("version", "1.3.0");
  u.searchParams.set("request", "GetMap");
  u.searchParams.set("layers", "EESTIFOTO");
  u.searchParams.set("styles", "");
  u.searchParams.set("bbox", `${minX},${minY},${maxX},${maxY}`);
  u.searchParams.set("crs", "EPSG:3301");
  u.searchParams.set("width", "600");
  u.searchParams.set("height", "450");
  u.searchParams.set("format", "image/jpeg");
  u.searchParams.set("transparent", "false");

  try {
    const r = await fetch(u.toString(), {
      headers: { Accept: "image/jpeg", "User-Agent": "vordlus/0.5" },
    });
    if (!r.ok) {
      return NextResponse.json({ error: `WMS ${r.status}` }, { status: 502 });
    }
    const buf = Buffer.from(await r.arrayBuffer());
    // WMS error responses are XML — detect and surface as JSON.
    if (buf.length < 200 || buf[0] === 0x3c /* '<' */) {
      const txt = buf.toString("utf8", 0, Math.min(buf.length, 500));
      return NextResponse.json({ error: "WMS error", detail: txt }, { status: 502 });
    }
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, s-maxage=2592000, stale-while-revalidate=2592000",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
