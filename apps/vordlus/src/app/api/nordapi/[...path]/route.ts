import { NextRequest, NextResponse } from "next/server";

const NORDAPI = "https://nordapi.ee/api/v1";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  const joined = (path ?? []).join("/");
  if (!joined || joined.includes("..") || joined.startsWith("/")) {
    return NextResponse.json({ error: "Vigane path" }, { status: 400 });
  }
  const u = `${NORDAPI}/${joined}`;
  try {
    const r = await fetch(u, {
      headers: { Accept: "application/json", "User-Agent": "vordlus/0.4 (+https://vordlus.vercel.app)" },
    });
    if (!r.ok) {
      return NextResponse.json(
        { data: null, source: "nordapi", error: `NordAPI ${r.status}` },
        { status: 502 },
      );
    }
    const data = await r.json();
    return NextResponse.json(
      { data, source: "nordapi", error: null },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch (e) {
    return NextResponse.json(
      { data: null, source: "nordapi", error: (e as Error).message },
      { status: 502 },
    );
  }
}
