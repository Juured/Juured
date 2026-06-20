import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

const CACHE_DIR = "/tmp/vordlus-gtfs";
const CACHE_FILE = path.join(CACHE_DIR, "tallinn.zip");
const GTFS_URL = "https://eu-gtfs.remix.com/tallinn.zip";
const STOP_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type Stop = { stop_id: string; stop_lat: number; stop_lon: number };
type Cache = { stops: Stop[]; fetchedAt: number } | null;
let memCache: Cache = null;

async function ensureZip(): Promise<Buffer> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  try {
    const stat = await fs.stat(CACHE_FILE);
    if (Date.now() - stat.mtimeMs < STOP_TTL_MS) {
      return fs.readFile(CACHE_FILE);
    }
  } catch { /* missing */ }
  const r = await fetch(GTFS_URL);
  if (!r.ok) throw new Error(`GTFS download ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  await fs.writeFile(CACHE_FILE, buf);
  return buf;
}

async function loadCache(): Promise<Cache> {
  if (memCache && Date.now() - memCache.fetchedAt < STOP_TTL_MS) return memCache;
  const buf = await ensureZip();
  try {
    const { unzip } = await import("unzipit");
    const { entries } = await unzip(buf);
    const stopsEntry = entries["stops.txt"];
    if (!stopsEntry) return null;
    const text = await stopsEntry.text();
    const lines = text.split("\n").filter(Boolean);
    if (lines.length === 0) return null;
    const header = lines[0].split(",");
    const latIdx = header.indexOf("stop_lat");
    const lonIdx = header.indexOf("stop_lon");
    const idIdx = header.indexOf("stop_id");
    const stops: Stop[] = lines.slice(1).map((line: string) => {
      const cols = line.split(",");
      return {
        stop_id: cols[idIdx] ?? "",
        stop_lat: Number(cols[latIdx]),
        stop_lon: Number(cols[lonIdx]),
      };
    });
    memCache = { stops, fetchedAt: Date.now() };
    return memCache;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  const radius = Math.min(Math.max(Number(searchParams.get("radius") ?? 1000), 200), 5000);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "lat ja lon on kohustuslikud" }, { status: 400 });
  }
  try {
    const cache = await loadCache();
    if (!cache) {
      return NextResponse.json(
        { data: { stopCount: 0, frequency: 0 }, source: "peatus-gtfs", error: "GTFS load failed" },
        { status: 200 },
      );
    }
    const dLat = radius / 111_000;
    const dLon = radius / (111_000 * Math.cos((lat * Math.PI) / 180));
    let count = 0;
    for (const s of cache.stops) {
      if (Math.abs(s.stop_lat - lat) < dLat && Math.abs(s.stop_lon - lon) < dLon) count++;
    }
    return NextResponse.json(
      { data: { stopCount: count, frequency: 0 }, source: "peatus-gtfs", error: null },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch (e) {
    return NextResponse.json(
      { data: null, source: "peatus-gtfs", error: (e as Error).message },
      { status: 502 },
    );
  }
}
