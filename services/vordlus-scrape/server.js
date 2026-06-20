// vordlus scrape service
// ======================
// Headless scrape service for Estonian real-estate listings (kv.ee, city24.ee,
// kinnisvara24.ee). Runs on a VPS IP to bypass Cloudflare gating that hits
// Vercel edge IPs.
//
// POST /scrape          body: { url }       → { photoUrl, title, address, blocked }
// POST /scrape/listing  body: { url }       → { id, first_seen_at, daysOnMarket, priceHistory, current, blocked }
// POST /scrape/search   body: { address, type, areaMin?, areaMax?, roomsMin?, roomsMax? }
//                                            → { address_norm, type, totalCount, byPortal, listings, stats }
// GET  /health                            → 200 "ok"
//
// Env vars:
//   PORT                default 3000
//   SCRAPE_TIMEOUT_MS   default 30000 — total per-request budget
//   CACHE_TTL_MS        default 3600000 (1h)
//   CACHE_MAX           default 100
//   HEADLESS            default "true" — set "false" for local debugging only
//   DB_PATH             default /data/vordlus.db — SQLite (sql.js) file

const express = require("express");
const { chromium } = require("playwright");
const { LruTtl } = require("./cache");
const {
  extractFirstPhoto,
  extractTitle,
  looksLikeBlocked,
} = require("./extract");
const { openDb, upsertListing, appendPriceHistory, getPriceHistory, getListingsByAddress, getFirstSeenAt } = require("./db");
const { parseKvListing, parseCity24Listing } = require("./parsers");
const path = require("node:path");

const PORT = parseInt(process.env.PORT || "3000", 10);
const SCRAPE_TIMEOUT_MS = parseInt(process.env.SCRAPE_TIMEOUT_MS || "30000", 10);
const CACHE_TTL_MS = parseInt(process.env.CACHE_TTL_MS || "3600000", 10);
const CACHE_MAX = parseInt(process.env.CACHE_MAX || "100", 10);
const HEADLESS = (process.env.HEADLESS || "true").toLowerCase() !== "false";
const DB_PATH = process.env.DB_PATH || path.join("/data", "vordlus.db");

const cache = new LruTtl({ max: CACHE_MAX, ttlMs: CACHE_TTL_MS });

let browserPromise = null;

async function getBrowser() {
  if (browserPromise) return browserPromise;
  browserPromise = chromium.launch({
    headless: HEADLESS,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      // Make us look like a normal Chrome a bit more. Playwright already
      // patches navigator.webdriver, but a few extra flags don't hurt.
      "--disable-blink-features=AutomationControlled",
    ],
  });
  return browserPromise;
}

async function scrapeOnce(url) {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/131.0.0.0 Safari/537.36",
    locale: "et-EE",
    timezoneId: "Europe/Tallinn",
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: {
      "Accept-Language": "et-EE,et;q=0.9,en;q=0.7",
    },
  });
  const page = await context.newPage();

  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: SCRAPE_TIMEOUT_MS,
    });
    // Try to wait for the page to settle. Don't fail if it never does —
    // we still want the HTML we have.
    try {
      await page.waitForLoadState("networkidle", { timeout: Math.max(2000, Math.floor(SCRAPE_TIMEOUT_MS / 3)) });
    } catch {
      /* swallow — networkidle may never fire on ad-heavy pages */
    }

    const status = response ? response.status() : 0;
    const html = await page.content();

    if (looksLikeBlocked(html) || status === 403 || status === 503) {
      return { blocked: true, photoUrl: null, title: null, address: null, status };
    }

    const photoUrl = extractFirstPhoto(html, url);
    const title = extractTitle(html);

    return { blocked: false, photoUrl, title, address: title, status };
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }
}

function validateUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u;
  } catch {
    return null;
  }
}

const app = express();
app.use(express.json({ limit: "32kb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, cacheSize: cache.size(), browserReady: !!browserPromise });
});

app.post("/scrape", async (req, res) => {
  const t0 = Date.now();
  const url = (req.body && req.body.url) || "";
  const parsed = validateUrl(url);
  if (!parsed) {
    return res.status(400).json({ error: "invalid url", url });
  }

  const cacheKey = parsed.toString();
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json({ ...cached, cached: true, elapsedMs: Date.now() - t0 });
  }

  try {
    const result = await scrapeOnce(cacheKey);
    const out = {
      photoUrl: result.photoUrl,
      title: result.title,
      address: result.address,
      blocked: result.blocked,
    };
    // Cache everything except pure "blocked" responses — those can recover
    // and we want to re-try. Cache miss + null photo (a real miss) is fine to
    // cache so we don't hammer kv.ee with a known-broken URL.
    if (!result.blocked) {
      cache.set(cacheKey, out);
    }
    return res.json({ ...out, cached: false, elapsedMs: Date.now() - t0, status: result.status });
  } catch (e) {
    return res.status(502).json({
      error: (e && e.message) || "scrape failed",
      url,
      elapsedMs: Date.now() - t0,
    });
  }
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`[scrape] listening on :${PORT}`);
  // Warm up the browser in the background so the first /scrape is fast.
  getBrowser().then(() => console.log("[scrape] browser ready")).catch((e) => {
    console.error("[scrape] failed to launch browser:", e && e.message);
  });
  // Open the SQLite DB at startup; this is best-effort.
  openDb(DB_PATH).then((db) => {
    if (db) {
      console.log(`[scrape] db ready at ${DB_PATH}`);
    } else {
      console.log(`[scrape] db unavailable, /scrape/listing and /scrape/search will operate without persistence`);
    }
  }).catch((e) => {
    console.error("[scrape] db open failed:", e.message);
  });
});

// ── enrichment layer endpoints ──────────────────────────────────────────

let dbPromise = null;
function getDb() {
  if (!dbPromise) dbPromise = openDb(DB_PATH).catch(() => null);
  return dbPromise;
}

function pickParser(url) {
  if (/kv\.ee|kinnisvara24\.ee/.test(url)) return parseKvListing;
  if (/city24\.ee/.test(url)) return parseCity24Listing;
  return null;
}

function listingIdFromUrl(url) {
  let m = url.match(/kv\.ee\/(?:[a-z]{2}\/)?(\d+)/i);
  if (m) return { portal: "kv.ee", id: m[1], composite: `kv-${m[1]}` };
  m = url.match(/(\d{4,})/);
  if (m && /city24\.ee/.test(url)) return { portal: "city24.ee", id: m[1], composite: `c24-${m[1]}` };
  return { portal: "unknown", id: "", composite: `unknown-${Math.random().toString(36).slice(2, 8)}` };
}

async function fetchHtml(url) {
  const browser = await getBrowser();
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "et-EE",
    timezoneId: "Europe/Tallinn",
  });
  const page = await ctx.newPage();
  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: SCRAPE_TIMEOUT_MS,
    });
    try { await page.waitForLoadState("networkidle", { timeout: 3000 }); } catch {}
    return { html: await page.content(), status: response ? response.status() : 0 };
  } finally {
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
  }
}

app.post("/scrape/listing", async (req, res) => {
  const url = (req.body && req.body.url) || "";
  const parsed = validateUrl(url);
  if (!parsed) return res.status(400).json({ error: "invalid url", url });
  if (!/kv\.ee|city24\.ee|kinnisvara24\.ee/.test(parsed.hostname)) {
    return res.status(400).json({ error: "unsupported host", host: parsed.hostname });
  }
  const cacheKey = "listing:" + parsed.toString();
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ ...cached, cached: true });

  const parser = pickParser(parsed.toString());
  if (!parser) return res.status(400).json({ error: "unsupported portal" });

  try {
    const { html, status } = await fetchHtml(parsed.toString());
    if (looksLikeBlocked(html) || status === 403 || status === 503) {
      return res.json({ blocked: true, photoUrl: null, title: null, address: null, status });
    }
    const parsed1 = parser(parsed.toString(), html);
    if (!parsed1) return res.status(502).json({ error: "parse failed" });

    const db = await getDb();
    const { composite } = listingIdFromUrl(parsed.toString());
    const now = Date.now();
    const existingFirstSeen = db ? getFirstSeenAt(db, composite) : null;
    const firstSeen = existingFirstSeen ?? now;

    const photoUrl = extractFirstPhoto(html, parsed.toString());
    const record = {
      id: composite,
      portal: parsed1.portal,
      listing_id: parsed1.listing_id,
      url: parsed.toString(),
      address_norm: parsed1.address_norm,
      address_display: parsed1.address_display,
      first_seen_at: firstSeen,
      last_seen_at: now,
      last_price_eur: parsed1.price_eur,
      area_m2: parsed1.area_m2,
      rooms: parsed1.rooms,
      energy_class: parsed1.energy_class,
      build_year: parsed1.build_year,
      photo_url: photoUrl,
      photo_count: parsed1.photo_count,
      description_len: parsed1.description_len,
      has_floor_plan: parsed1.has_floor_plan,
    };
    if (db) {
      upsertListing(db, record);
      if (parsed1.price_eur != null) {
        appendPriceHistory(db, composite, now, parsed1.price_eur);
      }
    }
    const daysOnMarket = Math.floor((now - firstSeen) / 86_400_000);
    const out = {
      id: record.id,
      portal: record.portal,
      listing_id: record.listing_id,
      url: record.url,
      address_norm: record.address_norm,
      address_display: record.address_display,
      first_seen_at: firstSeen,
      daysOnMarket,
      priceHistory: db ? getPriceHistory(db, composite) : [],
      current: {
        price_eur: record.last_price_eur,
        area_m2: record.area_m2,
        rooms: record.rooms,
        energy_class: record.energy_class,
        build_year: record.build_year,
        photo_count: record.photo_count,
        description_len: record.description_len,
        has_floor_plan: record.has_floor_plan === 1,
        photo_url: record.photo_url,
      },
      blocked: false,
    };
    cache.set(cacheKey, out);
    return res.json({ ...out, cached: false });
  } catch (e) {
    return res.status(502).json({ error: (e && e.message) || "scrape failed" });
  }
});

function median(arr) {
  if (arr.length === 0) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function pctile(arr, p) {
  if (arr.length === 0) return null;
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.floor((s.length - 1) * p);
  return s[idx];
}

app.post("/scrape/search", async (req, res) => {
  const body = req.body || {};
  const address = (body.address || "").trim();
  if (!address) return res.status(400).json({ error: "address required" });
  const type = body.type === "rent" ? "rent" : "sale";
  const areaMin = body.areaMin ?? null;
  const areaMax = body.areaMax ?? null;
  const roomsMin = body.roomsMin ?? null;
  const roomsMax = body.roomsMax ?? null;

  const { normalizeAddress } = require("./parsers");
  const addressNorm = normalizeAddress(address);
  const cacheKey = `search:${type}:${addressNorm}:${areaMin}:${areaMax}:${roomsMin}:${roomsMax}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ ...cached, cached: true });

  const db = await getDb();
  let rows = db ? getListingsByAddress(db, addressNorm) : [];
  if (rows.length < 3 && db && addressNorm) {
    const like = "%" + addressNorm.split("-").slice(0, 2).join("-") + "%";
    const stmt = db.prepare("SELECT * FROM listings WHERE address_norm LIKE ? ORDER BY last_seen_at DESC LIMIT 50");
    stmt.bind([like]);
    rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
  }
  let filtered = rows.filter((r) => {
    if (r.area_m2 != null && areaMin != null && r.area_m2 < areaMin) return false;
    if (r.area_m2 != null && areaMax != null && r.area_m2 > areaMax) return false;
    if (r.rooms != null && roomsMin != null && r.rooms < roomsMin) return false;
    if (r.rooms != null && roomsMax != null && r.rooms > roomsMax) return false;
    return true;
  });
  const pricesPerM2 = filtered
    .filter((r) => r.last_price_eur != null && r.area_m2)
    .map((r) => r.last_price_eur / r.area_m2);
  const stats = {
    median_price_eur: median(filtered.map((r) => r.last_price_eur).filter((p) => p != null)),
    median_price_per_m2: median(pricesPerM2),
    p25_price_per_m2: pctile(pricesPerM2, 0.25),
    p75_price_per_m2: pctile(pricesPerM2, 0.75),
  };
  const byPortal = {};
  for (const r of filtered) byPortal[r.portal] = (byPortal[r.portal] || 0) + 1;
  const out = {
    address_norm: addressNorm,
    type,
    totalCount: filtered.length,
    byPortal,
    listings: filtered.slice(0, 20).map((r) => ({
      id: r.id,
      url: r.url,
      portal: r.portal,
      price_eur: r.last_price_eur,
      area_m2: r.area_m2,
      rooms: r.rooms,
      price_per_m2: r.last_price_eur && r.area_m2 ? Math.round(r.last_price_eur / r.area_m2) : null,
      first_seen_at: r.first_seen_at,
      daysOnMarket: Math.floor((Date.now() - r.first_seen_at) / 86_400_000),
      address_display: r.address_display,
      photo_url: r.photo_url,
      energy_class: r.energy_class,
    })),
    stats,
  };
  cache.set(cacheKey, out);
  return res.json(out);
});

async function shutdown(signal) {
  console.log(`[scrape] received ${signal}, shutting down`);
  server.close(() => process.exit(0));
  try {
    if (browserPromise) {
      const b = await browserPromise;
      await b.close();
    }
  } catch {
    /* ignore */
  }
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
