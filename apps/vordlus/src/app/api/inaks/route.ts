import { NextRequest, NextResponse } from "next/server";

// Server-side proxy to In-AKS. Required because the browser would otherwise
// hit CORS issues + Cloudflare preflight for some endpoints.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || req.nextUrl.searchParams.get("address") || "";
  if (!q.trim()) return NextResponse.json({ addresses: [] });
  const u = new URL("https://aks.geoportaal.ee/inaks/inaadress/gazetteer");
  u.searchParams.set("address", q);
  try {
    const r = await fetch(u.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "vordlus/1.0 (+https://vordlus.vercel.app)",
      },
    });
    if (!r.ok) {
      return NextResponse.json({ error: `In-AKS ${r.status}` }, { status: r.status });
    }
    const j = await r.json();
    return NextResponse.json(j, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
