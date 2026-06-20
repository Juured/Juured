import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDb, upsertListing, appendPriceHistory, getPriceHistory, getListingsByAddress } from "../db.js";

let dbPath;
beforeEach(() => {
  dbPath = path.join(os.tmpdir(), `vordlus-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
});
afterEach(() => {
  try { fs.unlinkSync(dbPath); } catch {}
});

describe("db", () => {
  it("creates a fresh DB with the listings and price_history tables", async () => {
    const db = await openDb(dbPath);
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    const names = tables[0].values.map((r) => r[0]);
    expect(names).toContain("listings");
    expect(names).toContain("price_history");
  });

  it("upserts a listing and reads it back by address", async () => {
    const db = await openDb(dbPath);
    upsertListing(db, {
      id: "kv-1",
      portal: "kv.ee",
      listing_id: "1",
      url: "https://www.kv.ee/1",
      address_norm: "viljandi-mnt-47-tallinn",
      address_display: "Viljandi mnt 47, Tallinn",
      first_seen_at: 1715000000000,
      last_seen_at: 1715000000000,
      last_price_eur: 449000,
      area_m2: 199,
      rooms: 5,
      energy_class: "D",
      build_year: 1970,
      photo_url: null,
      photo_count: 0,
      description_len: 0,
      has_floor_plan: 0,
    });
    const rows = getListingsByAddress(db, "viljandi-mnt-47-tallinn");
    expect(rows.length).toBe(1);
    expect(rows[0].last_price_eur).toBe(449000);
  });

  it("appends price history only when the price changes", async () => {
    const db = await openDb(dbPath);
    appendPriceHistory(db, "kv-1", 1715000000000, 449000);
    appendPriceHistory(db, "kv-1", 1715000000000, 449000);
    appendPriceHistory(db, "kv-1", 1716000000000, 435000);
    const hist = getPriceHistory(db, "kv-1");
    expect(hist.length).toBe(2);
    expect(hist[0].price_eur).toBe(449000);
    expect(hist[1].price_eur).toBe(435000);
  });
});
