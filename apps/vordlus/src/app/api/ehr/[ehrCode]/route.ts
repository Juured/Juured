import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ ehrCode: string }> },
) {
  const { ehrCode } = await ctx.params;
  if (!ehrCode || !/^\d+$/.test(ehrCode)) {
    return NextResponse.json({ error: "Vigane EHR kood" }, { status: 400 });
  }
  try {
    const r = await fetch(
      `https://livekluster.ehr.ee/api/building/v2/buildingData?ehr_code=${encodeURIComponent(ehrCode)}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "vordlus/1.0 (+https://vordlus.vercel.app)",
        },
      },
    );
    if (r.status === 404 || r.status === 400) {
      return NextResponse.json({ error: "EHR andmeid ei leitud" }, { status: 404 });
    }
    if (!r.ok) {
      return NextResponse.json({ error: `EHR ${r.status}` }, { status: r.status });
    }
    const data = await r.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
