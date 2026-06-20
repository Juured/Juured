// Listing photo proxy
// ====================
//
// vordlus itself runs on Vercel. Vercel edge IPs are heavily flagged by
// Cloudflare, so we cannot fetch kv.ee listing photos from here — we get
// the challenge page. Instead, we forward the request to a self-hosted
// scrape service (see /scrape/) that runs on a VPS IP with a clean
// reputation.
//
// If `SCRAPE_SERVICE_URL` is not set, the proxy returns 200 with
// `{ photoUrl: null, skipped: true }` so the rest of the page can render
// gracefully (e.g. on Vercel where we don't have a scrape service wired
// up yet).
//
// Env:
//   SCRAPE_SERVICE_URL  e.g. http://vordlus-scrape:3000
//   SCRAPE_TIMEOUT_MS   per-request timeout (default 8000)

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SCRAPE_TIMEOUT_MS = parseInt(process.env.SCRAPE_TIMEOUT_MS || "8000", 10);

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url") || "";
  if (!url) {
    return NextResponse.json({ error: "missing url" }, { status: 400 });
  }

  // Only proxy known listing-portal URLs. We don't want this endpoint to
  // become a general-purpose forwarder.
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  const host = parsed.hostname.toLowerCase();
  const allowed =
    host === "kv.ee" ||
    host === "www.kv.ee" ||
    host === "city24.ee" ||
    host === "www.city24.ee" ||
    host === "kinnisvara24.ee" ||
    host === "www.kinnisvara24.ee";
  if (!allowed) {
    return NextResponse.json({ error: "unsupported host", host }, { status: 400 });
  }

  const base = process.env.SCRAPE_SERVICE_URL;
  if (!base) {
    return NextResponse.json(
      { photoUrl: null, title: null, address: null, blocked: false, skipped: true },
      { status: 200 },
    );
  }

  // Forward to the scrape service.
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), SCRAPE_TIMEOUT_MS);
  try {
    const upstream = await fetch(`${base.replace(/\/$/, "")}/scrape`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: parsed.toString() }),
      signal: ac.signal,
      // No Next.js caching here — the upstream service has its own LRU.
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `upstream ${upstream.status}`, photoUrl: null, blocked: false },
        { status: 502 },
      );
    }
    const data = await upstream.json();
    return NextResponse.json(
      {
        photoUrl: data.photoUrl ?? null,
        title: data.title ?? null,
        address: data.address ?? null,
        blocked: !!data.blocked,
        cached: !!data.cached,
      },
      {
        status: 200,
        headers: {
          // Edge-cache successful upstream responses briefly. Blocked
          // responses (Cloudflare) we don't cache — they can recover.
          "Cache-Control": data.blocked
            ? "public, s-maxage=30, stale-while-revalidate=120"
            : "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (e) {
    clearTimeout(timer);
    const msg = (e as Error).message || "scrape service unreachable";
    return NextResponse.json(
      { error: msg, photoUrl: null, blocked: false },
      { status: 502 },
    );
  }
}
