import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nock from "nock";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/planeeringud/route";

const NORDAPI = "https://nordapi.ee";

function makeReq(lat: number, lon: number) {
  return new NextRequest(`http://x/api/planeeringud?lat=${lat}&lon=${lon}&radius=500`);
}

describe("GET /api/planeeringud", () => {
  beforeEach(() => { nock.cleanAll(); });
  afterEach(() => { nock.cleanAll(); });

  it("returns 0 plans when upstream is empty", async () => {
    nock(NORDAPI).get(/estonian-plans.*/).reply(200, []);
    const res = await GET(makeReq(59.437, 24.745));
    const body = await res.json();
    expect(body.data.plans).toEqual([]);
    expect(body.source).toBe("nordapi-plank");
  });

  it("filters plans to within the radius (rough bbox)", async () => {
    nock(NORDAPI).get(/estonian-plans.*/).reply(200, [
      { name: "Lähedal plaan", lat: 59.438, lon: 24.746, maxFloors: 8, status: "kehtiv" },
      { name: "Kaugel plaan", lat: 60.0, lon: 25.0, maxFloors: 3, status: "kehtiv" },
    ]);
    const res = await GET(makeReq(59.437, 24.745));
    const body = await res.json();
    expect(body.data.plans).toHaveLength(1);
    expect(body.data.plans[0].name).toBe("Lähedal plaan");
  });
});
