import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import nock from "nock";

const SCRAPE = "http://localhost:3000";

// Mock NextRequest/Response minimally
vi.mock("next/server", () => ({
  NextRequest: class {
    url: string;
    method: string;
    _body: unknown;
    constructor(input: string | { url: string }, init?: { method?: string; body?: unknown }) {
      this.url = typeof input === "string" ? input : input.url;
      this.method = (init && init.method) || "POST";
      this._body = (init && init.body) || null;
    }
    async json() {
      return typeof this._body === "string" ? JSON.parse(this._body) : this._body;
    }
    get nextUrl() {
      return new URL(this.url);
    }
  },
  NextResponse: {
    json: (data: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
      _data: data,
      status: (init && init.status) || 200,
      headers: new Map(Object.entries((init && init.headers) || {})),
      async json() { return this._data; },
    }),
  },
}));

async function callHandler(body: unknown) {
  // Lazy import so the mock is in place
  const { POST } = await import("../route");
  const { NextRequest } = await import("next/server");
  const req = new NextRequest("http://localhost:3011/api/enrich", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
  const res = await POST(req);
  return { status: res.status, body: await res.json() };
}

describe("POST /api/enrich", () => {
  beforeEach(() => {
    nock.cleanAll();
    process.env.SCRAPE_SERVICE_URL = SCRAPE;
  });
  afterEach(() => {
    nock.cleanAll();
    delete process.env.SCRAPE_SERVICE_URL;
  });

  it("returns null scrape blocks when no kv.ee link given", async () => {
    const { status, body } = await callHandler({
      raw: "Viljandi mnt 47, Tallinn",
      addressDisplay: "Viljandi mnt 47, Tallinn",
      addressNorm: "viljandi-mnt-47-tallinn",
      wgs84: [24.7, 59.4],
      manualPrice: 420000,
      manualArea: 199,
      manualRooms: 5,
      estpropMedian: 2540,
    });
    expect(status).toBe(200);
    expect(body.data).toBeTruthy();
    expect(body.data.priceHistory).toBeNull();
    expect(body.data.daysOnMarket).toBeNull();
    expect(body.data.completeness).toBeNull();
    expect(body.data.duplicates).toBeNull();
    expect(body.data.rentYield).toBeNull();
    expect(body.data.liquidity).toBeNull();
    expect(body.data.pricePerM2).toBeGreaterThan(2000);
    expect(body.data.districtBenchmark).toBeTruthy();
  });

  it("returns full enrichment when kv.ee link is given", async () => {
    nock(SCRAPE)
      .post("/scrape/listing")
      .reply(200, {
        id: "kv-1",
        first_seen_at: Date.now() - 42 * 86_400_000,
        daysOnMarket: 42,
        priceHistory: [
          { date: Date.now() - 42 * 86_400_000, price: 449000 },
          { date: Date.now() - 14 * 86_400_000, price: 420000 },
        ],
        current: { price_eur: 420000, area_m2: 199, rooms: 5, energy_class: "D", build_year: 1970, photo_count: 12, description_len: 1450, has_floor_plan: true },
      });
    nock(SCRAPE)
      .post("/scrape/search")
      .reply(200, {
        address_norm: "viljandi-mnt-47-tallinn",
        type: "sale",
        totalCount: 12,
        byPortal: { "kv.ee": 12 },
        listings: [
          { id: "kv-1", price_eur: 420000, area_m2: 199, rooms: 5, price_per_m2: 2110, daysOnMarket: 42, energy_class: "D" },
          { id: "kv-2", price_eur: 380000, area_m2: 180, rooms: 4, price_per_m2: 2111, daysOnMarket: 30, energy_class: "C" },
        ],
        stats: { median_price_eur: 400000, median_price_per_m2: 2110, p25_price_per_m2: 1750, p75_price_per_m2: 2400 },
      });
    nock(SCRAPE)
      .post("/scrape/search")
      .reply(200, {
        address_norm: "viljandi-mnt-47-tallinn",
        type: "rent",
        totalCount: 5,
        byPortal: { "kv.ee": 5 },
        listings: [
          { id: "kv-r1", price_eur: 1500, area_m2: 80, rooms: 3, price_per_m2: 18.75 },
        ],
        stats: { median_price_eur: 1500, median_price_per_m2: 18.75, p25_price_per_m2: 16, p75_price_per_m2: 22 },
      });

    const { status, body } = await callHandler({
      raw: "https://www.kv.ee/3995056",
      addressDisplay: "Viljandi mnt 47, Tallinn",
      addressNorm: "viljandi-mnt-47-tallinn",
      wgs84: [24.7, 59.4],
      manualPrice: 420000,
      manualArea: 199,
      manualRooms: 5,
    });
    expect(status).toBe(200);
    expect(body.data.priceHistory).toBeTruthy();
    expect(body.data.priceHistory.length).toBe(2);
    expect(body.data.daysOnMarket.days).toBe(42);
    expect(body.data.completeness.score).toBeGreaterThan(50);
    expect(body.data.liquidity.totalCount).toBe(12);
  });

  it("returns 200 with errors when scrape service is down", async () => {
    nock(SCRAPE).post("/scrape/listing").reply(502);
    nock(SCRAPE).post("/scrape/search").reply(502);
    const { status, body } = await callHandler({
      raw: "https://www.kv.ee/1",
      addressDisplay: "X",
      addressNorm: "x",
      wgs84: [24, 59],
      manualPrice: 100000,
      manualArea: 50,
    });
    expect(status).toBe(200);
    expect(body.errors.length).toBeGreaterThan(0);
  });
});
