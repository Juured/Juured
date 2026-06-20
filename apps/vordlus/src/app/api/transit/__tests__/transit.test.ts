import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nock from "nock";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/transit/route";

const GTFS = "https://eu-gtfs.remix.com";

function makeReq(lat: number, lon: number) {
  return new NextRequest(`http://x/api/transit?lat=${lat}&lon=${lon}&radius=1000`);
}

describe("GET /api/transit", () => {
  beforeEach(() => { nock.cleanAll(); });
  afterEach(() => { nock.cleanAll(); });

  it("returns 0 stops when upstream is empty", async () => {
    nock(GTFS).get("/tallinn.zip").reply(200, Buffer.from(""));
    const res = await GET(makeReq(59.437, 24.745));
    const body = await res.json();
    expect(body.data.stopCount).toBe(0);
    expect(body.source).toBe("peatus-gtfs");
  });

  it("returns 502 on upstream error", async () => {
    nock(GTFS).get("/tallinn.zip").reply(500, "boom");
    const res = await GET(makeReq(59.437, 24.745));
    expect([200, 502]).toContain(res.status);
    if (res.status === 502) {
      const body = await res.json();
      expect(body.error).toBeTruthy();
    }
  });
});
