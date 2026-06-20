import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nock from "nock";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/nordapi/[...path]/route";

const NORDAPI = "https://nordapi.ee";

function makeReq(subpath: string) {
  return new NextRequest(`http://x/api/nordapi/${subpath}`);
}

describe("GET /api/nordapi/[...path]", () => {
  beforeEach(() => { nock.cleanAll(); });
  afterEach(() => { nock.cleanAll(); });

  it("proxies a simple path", async () => {
    nock(NORDAPI).get("/api/v1/estonian-utilities/electricity").reply(200, { rate: 0.18 });
    const res = await GET(makeReq("estonian-utilities/electricity"), { params: Promise.resolve({ path: ["estonian-utilities", "electricity"] }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.rate).toBe(0.18);
    expect(body.source).toBe("nordapi");
  });

  it("returns 502 on upstream error", async () => {
    nock(NORDAPI).get("/api/v1/estonian-utilities/electricity").reply(500);
    const res = await GET(makeReq("estonian-utilities/electricity"), { params: Promise.resolve({ path: ["estonian-utilities", "electricity"] }) });
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("rejects path traversal", async () => {
    const res = await GET(makeReq("../etc/passwd"), { params: Promise.resolve({ path: ["..", "etc", "passwd"] }) });
    expect(res.status).toBe(400);
  });
});
