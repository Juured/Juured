import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nock from "nock";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/radon/route";

const EGT = "https://gsavalik.envir.ee";

function makeReq(lat: number, lon: number) {
  return new NextRequest(`http://x/api/radon?lat=${lat}&lon=${lon}`);
}

describe("GET /api/radon", () => {
  beforeEach(() => { nock.cleanAll(); });
  afterEach(() => { nock.cleanAll(); });

  it("returns 'madal' when point has no radon settlement data", async () => {
    nock(EGT).get(/geoserver\/ows/).reply(200, { features: [] });
    const res = await GET(makeReq(58.0, 26.0));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.class).toBe("madal");
    expect(body.source).toContain("radoon");
  });

  it("returns 'korge' when keskmine Bq/m³ is high (>=200)", async () => {
    nock(EGT).get(/geoserver\/ows/).reply(200, {
      features: [{ properties: { keskmine: 250 } }],
    });
    const res = await GET(makeReq(59.5, 24.7));
    const body = await res.json();
    expect(body.data.class).toBe("korge");
  });

  it("returns 'keskmine' for 100-200 Bq/m³", async () => {
    nock(EGT).get(/geoserver\/ows/).reply(200, {
      features: [{ properties: { keskmine: 150 } }],
    });
    const res = await GET(makeReq(59.5, 24.7));
    const body = await res.json();
    expect(body.data.class).toBe("keskmine");
  });

  it("returns 'madal' for <100 Bq/m³", async () => {
    nock(EGT).get(/geoserver\/ows/).reply(200, {
      features: [{ properties: { keskmine: 50 } }],
    });
    const res = await GET(makeReq(59.5, 24.7));
    const body = await res.json();
    expect(body.data.class).toBe("madal");
  });
});
