import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ tunnus: string }> },
) {
  const { tunnus } = await ctx.params;
  if (!tunnus || !tunnus.includes(":")) {
    return NextResponse.json({ error: "Vigane katastri number" }, { status: 400 });
  }
  try {
    const r = await fetch(
      `https://cadastrepublic.kataster.ee/api/xroad/valid/${encodeURIComponent(tunnus)}`,
      { headers: { Accept: "application/json" } },
    );
    if (r.status === 404) {
      return NextResponse.json({ error: "Katastrit ei leitud" }, { status: 404 });
    }
    if (!r.ok) {
      return NextResponse.json({ error: `Kadastre ${r.status}` }, { status: r.status });
    }
    const data = await r.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
