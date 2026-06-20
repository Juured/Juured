import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nock from "nock";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/huvipunktid/route";

const WFS = "https://gsavalik.envir.ee";

function makeReq(lat: number, lon: number) {
  return new NextRequest(`http://x/api/huvipunktid?lat=${lat}&lon=${lon}&radius=1000`);
}

describe("GET /api/huvipunktid", () => {
  beforeEach(() => { nock.cleanAll(); });
  afterEach(() => { nock.cleanAll(); });

  it("returns 0 counts on empty WFS response", async () => {
    nock(WFS)
      .get(/geoserver\/maaamet\/wfs/)
      .reply(200, { features: [] });
    const res = await GET(makeReq(59.437, 24.745));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.park).toBe(0);
    expect(body.data.school).toBe(0);
    expect(body.source).toBe("maaamet-huvipunktid");
  });

  it("buckets features by category and counts them", async () => {
    nock(WFS)
      .get(/geoserver\/maaamet\/wfs/)
      .reply(200, {
        features: [
          { properties: { LOIK: "park" } },
          { properties: { LOIK: "park" } },
          { properties: { LOIK: "kool" } },
          { properties: { LOIK: "kauplus" } },
          { properties: { LOIK: "bussipeatus" } },
        ],
      });
    const res = await GET(makeReq(59.437, 24.745));
    const body = await res.json();
    expect(body.data.park).toBe(2);
    expect(body.data.school).toBe(1);
    expect(body.data.shop).toBe(1);
    expect(body.data.transit).toBe(1);
  });

  it("returns 502 on upstream error", async () => {
    nock(WFS).get(/geoserver\/maaamet\/wfs/).reply(500, "boom");
    const res = await GET(makeReq(59.437, 24.745));
    const body = await res.json();
    expect(res.status).toBe(502);
    expect(body.error).toBeTruthy();
    expect(body.data).toBeNull();
  });
});
