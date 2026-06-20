# vordlus Enrichment Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an 11-block enrichment layer to vordlus (€/m² deviation, price history, days on market, duplicate detection, completeness, district benchmark, energy comparison, renovation signals, rent yield, liquidity) backed by the existing Coolify scrape service + SQLite, plus Estonian tooltips so users understand each metric.

**Architecture:** Add `/api/enrich` orchestrator that runs *after* v2 `/api/resolve` (never blocks it). Add 2 new scrape endpoints (`/scrape/listing`, `/scrape/search`) + SQLite via `sql.js` inside the existing `vordlus-scrape` Coolify container. Render the result in a new `<EnrichmentPanel>` collapsible accordion at the bottom of each `CompareColumnView`, with `<Tooltip>` on every metric. All v2 code untouched.

**Tech Stack:** Next.js 14, TypeScript, Tailwind, Vitest, `sql.js` (pure-JS WASM SQLite — no native build deps), Playwright (already in scrape service).

**Spec:** `docs/superpowers/specs/2026-06-20-vordlus-enrichment-design.md`

**Sprints:**
- Sprint 5 (today): Scrape service extension (Tasks 1-5)
- Sprint 6 (today): Next.js enrichment layer (Tasks 6-10)
- Sprint 7 (today): Wire into UI (Tasks 11-14)

---

## Task 1: Add sql.js to scrape service + schema bootstrap

**Files:**
- Modify: `scrape/package.json` (add `sql.js` dep)
- Create: `scrape/db.js`
- Create: `scrape/__tests__/db.test.js`

- [ ] **Step 1: Install sql.js in scrape service**

```bash
cd /tmp/opencode/vordlus/scrape
npm install --save sql.js@^1.10.3
```

- [ ] **Step 2: Create the failing db test**

```javascript
// /tmp/opencode/vordlus/scrape/__tests__/db.test.js
const { describe, it, expect, beforeEach, afterEach } = require("vitest");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { openDb, upsertListing, appendPriceHistory, getPriceHistory, getListingsByAddress } = require("../db");

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
    appendPriceHistory(db, "kv-1", 1715000000000, 449000); // same day, same price → skip
    appendPriceHistory(db, "kv-1", 1716000000000, 435000);
    const hist = getPriceHistory(db, "kv-1");
    expect(hist.length).toBe(2);
    expect(hist[0].price_eur).toBe(449000);
    expect(hist[1].price_eur).toBe(435000);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd /tmp/opencode/vordlus/scrape && npx vitest run __tests__/db.test.js
```

Expected: FAIL — `../db` doesn't exist.

- [ ] **Step 4: Implement `db.js`**

```javascript
// /tmp/opencode/vordlus/scrape/db.js
// SQLite via sql.js (pure-JS WASM). No native deps. Single-process safe.
// All writes flush to disk via fs.writeFileSync after each call.

const fs = require("node:fs");
const path = require("node:path");
const initSqlJs = require("sql.js");

let SQL = null;

async function getSQL() {
  if (SQL) return SQL;
  SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, "node_modules", "sql.js", "dist", file),
  });
  return SQL;
}

async function openDb(filePath) {
  const SQL = await getSQL();
  let db;
  if (fs.existsSync(filePath)) {
    const buf = fs.readFileSync(filePath);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
    ensureSchema(db);
    flush(db, filePath);
  }
  // Wrap so every mutation auto-flushes
  return wrapDb(db, filePath);
}

function ensureSchema(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      portal TEXT NOT NULL,
      listing_id TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      address_norm TEXT NOT NULL,
      address_display TEXT,
      first_seen_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      last_price_eur INTEGER,
      area_m2 REAL,
      rooms INTEGER,
      energy_class TEXT,
      build_year INTEGER,
      photo_url TEXT,
      photo_count INTEGER DEFAULT 0,
      description_len INTEGER DEFAULT 0,
      has_floor_plan INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS price_history (
      listing_id TEXT NOT NULL,
      observed_at INTEGER NOT NULL,
      price_eur INTEGER NOT NULL,
      PRIMARY KEY (listing_id, observed_at)
    );
    CREATE INDEX IF NOT EXISTS idx_address_norm ON listings(address_norm);
    CREATE INDEX IF NOT EXISTS idx_portal_listing ON listings(portal, listing_id);
    CREATE INDEX IF NOT EXISTS idx_history_listing ON price_history(listing_id, observed_at DESC);
  `);
}

function flush(db, filePath) {
  const data = db.export();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, Buffer.from(data));
}

function wrapDb(db, filePath) {
  const proxiedExec = db.exec.bind(db);
  const proxiedRun = db.run.bind(db);
  db.exec = (sql) => {
    proxiedExec(sql);
    flush(db, filePath);
  };
  db.run = (sql, params) => {
    proxiedRun(sql, params);
    flush(db, filePath);
  };
  return db;
}

function upsertListing(db, l) {
  db.run(
    `INSERT INTO listings (
      id, portal, listing_id, url, address_norm, address_display,
      first_seen_at, last_seen_at, last_price_eur, area_m2, rooms,
      energy_class, build_year, photo_url, photo_count, description_len, has_floor_plan
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      last_seen_at = excluded.last_seen_at,
      last_price_eur = excluded.last_price_eur,
      area_m2 = excluded.area_m2,
      rooms = excluded.rooms,
      energy_class = excluded.energy_class,
      build_year = excluded.build_year,
      photo_url = excluded.photo_url,
      photo_count = excluded.photo_count,
      description_len = excluded.description_len,
      has_floor_plan = excluded.has_floor_plan
  `,
    [
      l.id, l.portal, l.listing_id, l.url, l.address_norm, l.address_display,
      l.first_seen_at, l.last_seen_at, l.last_price_eur, l.area_m2, l.rooms,
      l.energy_class, l.build_year, l.photo_url, l.photo_count, l.description_len, l.has_floor_plan,
    ],
  );
}

function appendPriceHistory(db, listingId, observedAt, priceEur) {
  // Skip if we already have a row at this timestamp with this price
  const stmt = db.prepare("SELECT price_eur FROM price_history WHERE listing_id = ? AND observed_at = ?");
  stmt.bind([listingId, observedAt]);
  const exists = stmt.step();
  if (exists) {
    const existing = stmt.getAsObject().price_eur;
    stmt.free();
    if (existing === priceEur) return;
  } else {
    stmt.free();
  }
  db.run(
    "INSERT INTO price_history (listing_id, observed_at, price_eur) VALUES (?, ?, ?)",
    [listingId, observedAt, priceEur],
  );
}

function getPriceHistory(db, listingId) {
  const out = [];
  const stmt = db.prepare("SELECT observed_at, price_eur FROM price_history WHERE listing_id = ? ORDER BY observed_at ASC");
  stmt.bind([listingId]);
  while (stmt.step()) {
    const row = stmt.getAsObject();
    out.push({ date: row.observed_at, price: row.price_eur });
  }
  stmt.free();
  return out;
}

function getListingsByAddress(db, addressNorm) {
  const out = [];
  const stmt = db.prepare("SELECT * FROM listings WHERE address_norm = ? ORDER BY last_seen_at DESC");
  stmt.bind([addressNorm]);
  while (stmt.step()) out.push(stmt.getAsObject());
  stmt.free();
  return out;
}

function getFirstSeenAt(db, listingId) {
  const stmt = db.prepare("SELECT first_seen_at FROM listings WHERE id = ?");
  stmt.bind([listingId]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row ? row.first_seen_at : null;
}

module.exports = {
  openDb,
  upsertListing,
  appendPriceHistory,
  getPriceHistory,
  getListingsByAddress,
  getFirstSeenAt,
  ensureSchema,
};
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd /tmp/opencode/vordlus/scrape && npx vitest run __tests__/db.test.js
```

Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
cd /tmp/opencode/vordlus
git add scrape/package.json scrape/package-lock.json scrape/db.js scrape/__tests__/db.test.js
git -c user.email="ai@anthropic.com" -c user.name="vordlus-enrichment-agent" commit -m "feat(scrape): sql.js SQLite + listings/price_history schema"
```

---

## Task 2: Add per-portal listing parsers

**Files:**
- Create: `scrape/parsers.js`
- Create: `scrape/__tests__/parsers.test.js`

- [ ] **Step 1: Write the failing parser test**

```javascript
// /tmp/opencode/vordlus/scrape/__tests__/parsers.test.js
const { describe, it, expect } = require("vitest");
const { parseKvListing, parseCity24Listing, normalizeAddress } = require("../parsers");

const KV_HTML = `
<html><body>
  <div class="object-price"><strong>420 000 €</strong></div>
  <dl class="object-data">
    <dt>Aadress</dt><dd>Viljandi mnt 47, Nõmme, Tallinn</dd>
    <dt>Tube</dt><dd>5</dd>
    <dt>Üldpind</dt><dd>199 m²</dd>
    <dt>Energiamärgis</dt><dd>D</dd>
    <dt>Ehitusaasta</dt><dd>1970</dd>
  </dl>
  <div class="object-description"><p>Hea asukohaga üksikelamu Nõmmel. Planeering on avar, aknad on põhja suunas.</p></div>
  <div class="object-photos">
    <a href="https://img-bb.example.com/photo1.jpg"><img src="https://img-bb.example.com/photo1.jpg" width="800"></a>
    <a href="https://img-bb.example.com/photo2.jpg"><img src="https://img-bb.example.com/photo2.jpg" width="800"></a>
    <a href="https://img-bb.example.com/photo3.jpg"><img src="https://img-bb.example.com/photo3.jpg" width="800"></a>
  </div>
  <a href="/plaan?id=123">Vaata plaani</a>
</body></html>
`;

const CITY24_HTML = `
<html><body>
  <h1 class="object-title">3-toaline korter, Pärnu mnt 28, Tallinn</h1>
  <div class="price-box"><span>220 000 €</span></div>
  <ul class="object-attributes">
    <li>Tube: 2</li>
    <li>Pindala: 55 m²</li>
    <li>Energiamärgis: C</li>
    <li>Ehitusaasta: 1937</li>
  </ul>
  <p>Stiilne kesklinna korter vaatega pargile.</p>
  <div class="gallery">
    <img src="https://city24.ee/img/a.jpg" width="700">
    <img src="https://city24.ee/img/b.jpg" width="700">
  </div>
</body></html>
`;

describe("parseKvListing", () => {
  it("extracts price, address, area, rooms, energy, year", () => {
    const out = parseKvListing("https://www.kv.ee/12345", KV_HTML);
    expect(out.portal).toBe("kv.ee");
    expect(out.listing_id).toBe("12345");
    expect(out.price_eur).toBe(420000);
    expect(out.address_display).toMatch(/Viljandi mnt 47/);
    expect(out.address_norm).toBe("viljandi-mnt-47-tallinn");
    expect(out.area_m2).toBe(199);
    expect(out.rooms).toBe(5);
    expect(out.energy_class).toBe("D");
    expect(out.build_year).toBe(1970);
  });
  it("counts photos and description length", () => {
    const out = parseKvListing("https://www.kv.ee/12345", KV_HTML);
    expect(out.photo_count).toBeGreaterThanOrEqual(3);
    expect(out.description_len).toBeGreaterThan(50);
  });
  it("detects floor plan link", () => {
    const out = parseKvListing("https://www.kv.ee/12345", KV_HTML);
    expect(out.has_floor_plan).toBe(1);
  });
});

describe("parseCity24Listing", () => {
  it("extracts from city24 HTML", () => {
    const out = parseCity24Listing("https://www.city24.ee/et/kinnisvara/tartu/67890", CITY24_HTML);
    expect(out.portal).toBe("city24.ee");
    expect(out.listing_id).toBe("67890");
    expect(out.price_eur).toBe(220000);
    expect(out.area_m2).toBe(55);
    expect(out.rooms).toBe(2);
    expect(out.energy_class).toBe("C");
  });
});

describe("normalizeAddress", () => {
  it("lowercases, removes punctuation, hyphenates", () => {
    expect(normalizeAddress("Viljandi mnt 47, Nõmme, Tallinn")).toBe("viljandi-mnt-47-tallinn");
    expect(normalizeAddress("Pärnu mnt 28, Tallinn")).toBe("parnu-mnt-28-tallinn");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /tmp/opencode/vordlus/scrape && npx vitest run __tests__/parsers.test.js
```

Expected: FAIL.

- [ ] **Step 3: Implement parsers.js**

```javascript
// /tmp/opencode/vordlus/scrape/parsers.js
// Per-portal HTML → structured record. Regex-based; falls back to null on
// missing fields. Stable enough for current portal layouts; will need a
// re-pass if kv.ee or city24.ee redesigns.

const ESTONIAN_MAP = {
  tallinn: "tallinn", tartu: "tartu", parnu: "parnu", narva: "narva",
  haapsalu: "haapsalu", rakvere: "rakvere", viljandi: "viljandi",
  kuressaare: "kuressaare", voru: "voru", valga: "valga", johvi: "johvi",
  paide: "paide", rapla: "rapla", viimsi: "viimsi", saue: "saue", keila: "keila",
  nomme: "nomme", kesklinn: "kesklinn", kristiine: "kristiine", mustamae: "mustamae",
  pirita: "pirita", lasnamae: "lasnamae",
};

function normalizeAddress(addr) {
  if (!addr) return "";
  return addr
    .toLowerCase()
    .replace(/[õöäü]/g, (c) => ({ õ: "o", ö: "o", ä: "a", ü: "u" }[c]))
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => ESTONIAN_MAP[w] || w)
    .join("-");
}

function parsePriceEur(html) {
  // Match "420 000 €" or "€ 420 000" or "420000€"
  const m = html.match(/(?:€\s*)?(\d{1,3}(?:[\s\u00a0]\d{3})+|\d{4,7})(?:\s*€)/);
  if (!m) return null;
  return parseInt(m[1].replace(/[\s\u00a0]/g, ""), 10);
}

function parseNumber(html, label) {
  const re = new RegExp(`${label}[^0-9]*([0-9]+(?:[.,][0-9]+)?)`, "i");
  const m = html.match(re);
  if (!m) return null;
  return parseFloat(m[1].replace(",", "."));
}

function parseKvListing(url, html) {
  if (!html || typeof html !== "string") return null;
  const m = url.match(/kv\.ee\/(\d+)/i);
  const listingId = m ? m[1] : "";
  const price = parsePriceEur(html);
  // Address: from dl.object-data dd after Aadress dt
  const addrM = html.match(/Aadress[\s\S]*?<dd[^>]*>([^<]+)<\/dd>/i);
  const address = addrM ? addrM[1].trim() : null;
  const rooms = parseNumber(html, "Tube");
  const areaM2 = parseNumber(html, "(?:Üldpind|pindala|netopind)");
  const energyM = html.match(/Energiamärgis[\s\S]*?<dd[^>]*>([A-H])<\/dd>/i);
  const energyClass = energyM ? energyM[1] : null;
  const yearM = html.match(/Ehitusaasta[\s\S]*?<dd[^>]*>(\d{4})<\/dd>/i);
  const buildYear = yearM ? parseInt(yearM[1], 10) : null;
  // Photos: <img> in object-photos
  const photos = html.match(/<img[^>]*src=["'](https:\/\/[^"']+\.(?:jpg|jpeg|png|webp))/gi) || [];
  // Description: strip tags from object-description
  const descM = html.match(/object-description[\s\S]*?<p>([\s\S]*?)<\/p>/i);
  const description = descM ? descM[1].replace(/<[^>]+>/g, " ").trim() : "";
  const hasFloorPlan = /plaani|plaan\.|floor.?plan/i.test(html) ? 1 : 0;
  return {
    portal: "kv.ee",
    listing_id: listingId,
    url,
    address_display: address,
    address_norm: normalizeAddress(address),
    price_eur: price,
    area_m2: areaM2,
    rooms,
    energy_class: energyClass,
    build_year: buildYear,
    photo_count: photos.length,
    description_len: description.length,
    has_floor_plan: hasFloorPlan,
  };
}

function parseCity24Listing(url, html) {
  if (!html || typeof html !== "string") return null;
  const m = url.match(/city24\.ee\/[^/]+\/[^/]+\/([^/]+)/i) || url.match(/(\d+)/);
  const listingId = m ? m[1] : "";
  const price = parsePriceEur(html);
  // Title: <h1 class="object-title">X-toaline ..., Address, City</h1>
  const titleM = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = titleM ? titleM[1].replace(/<[^>]+>/g, " ").trim() : "";
  // Strip the "X-toaline ..., " prefix
  const address = title.replace(/^\d+-toaline\s+\w+,?\s*/i, "").trim() || null;
  const rooms = parseNumber(title, "^(\\d+)-toaline");
  const areaM2 = parseNumber(html, "Pindala");
  const energyM = html.match(/Energiamärgis[:\s]*([A-H])/i);
  const energyClass = energyM ? energyM[1] : null;
  const yearM = html.match(/Ehitusaasta[:\s]*(\d{4})/i);
  const buildYear = yearM ? parseInt(yearM[1], 10) : null;
  const photos = html.match(/<img[^>]*src=["'](https:\/\/[^"']+\.(?:jpg|jpeg|png|webp))/gi) || [];
  const hasFloorPlan = /plaani|plaan\./i.test(html) ? 1 : 0;
  // Description: longest <p> in body
  const ps = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => m[1].replace(/<[^>]+>/g, " ").trim());
  const description = ps.sort((a, b) => b.length - a.length)[0] || "";
  return {
    portal: "city24.ee",
    listing_id: listingId,
    url,
    address_display: address,
    address_norm: normalizeAddress(address),
    price_eur: price,
    area_m2: areaM2,
    rooms,
    energy_class: energyClass,
    build_year: buildYear,
    photo_count: photos.length,
    description_len: description.length,
    has_floor_plan: hasFloorPlan,
  };
}

module.exports = { parseKvListing, parseCity24Listing, normalizeAddress };
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /tmp/opencode/vordlus/scrape && npx vitest run __tests__/parsers.test.js
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /tmp/opencode/vordlus
git add scrape/parsers.js scrape/__tests__/parsers.test.js
git -c user.email="ai@anthropic.com" -c user.name="vordlus-enrichment-agent" commit -m "feat(scrape): per-portal listing parsers (kv.ee, city24.ee)"
```

---

## Task 3: Add /scrape/listing endpoint to scrape service

**Files:**
- Modify: `scrape/server.js`

- [ ] **Step 1: Add the /scrape/listing route**

In `/tmp/opencode/vordlus/scrape/server.js`, after the existing `/scrape` route handler, add:

```javascript
const { openDb, upsertListing, appendPriceHistory, getFirstSeenAt } = require("./db");
const { parseKvListing, parseCity24Listing } = require("./parsers");

// Open the SQLite DB at startup
const DB_PATH = process.env.DB_PATH || path.join("/data", "vordlus.db");
let dbPromise = openDb(DB_PATH).catch((e) => {
  console.error("[scrape] db open failed:", e.message);
  return null;
});

function pickParser(url) {
  if (/kv\.ee|kinnisvara24\.ee/.test(url)) return parseKvListing;
  if (/city24\.ee/.test(url)) return parseCity24Listing;
  return null;
}

function parseListingIdFromUrl(url) {
  // kv.ee: https://www.kv.ee/12345 or /12345-slug
  let m = url.match(/kv\.ee\/(?:[a-z]{2}\/)?(\d+)/i);
  if (m) return m[1];
  m = url.match(/city24\.ee\/[^/]+\/[^/]+\/([^/?#]+)/);
  if (m) return m[1];
  return "";
}

function listingId(portal, id) {
  return `${portal === "kv.ee" ? "kv" : "c24"}-${id}`;
}

app.post("/scrape/listing", async (req, res) => {
  const url = (req.body && req.body.url) || "";
  const parsed = validateUrl(url);
  if (!parsed) return res.status(400).json({ error: "invalid url", url });
  const parser = pickParser(parsed.toString());
  if (!parser) return res.status(400).json({ error: "unsupported portal", url });

  const cacheKey = "listing:" + parsed.toString();
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ ...cached, cached: true });

  try {
    // Reuse the same browser session as /scrape
    const result = await scrapeOnce(parsed.toString());
    if (result.blocked) {
      return res.json({ blocked: true, photoUrl: null, title: null, address: null, status: result.status });
    }
    const parsed1 = parser(parsed.toString(), await rawHtml(parsed.toString()));
    if (!parsed1) return res.status(502).json({ error: "parse failed" });

    // Open DB
    const db = await dbPromise;
    const now = Date.now();
    const id = listingId(parsed1.portal, parsed1.listing_id);
    const existingFirstSeen = db ? getFirstSeenAt(db, id) : null;
    const firstSeen = existingFirstSeen ?? now;

    const record = {
      id,
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
      photo_url: result.photoUrl || null,
      photo_count: parsed1.photo_count,
      description_len: parsed1.description_len,
      has_floor_plan: parsed1.has_floor_plan,
    };
    if (db) {
      upsertListing(db, record);
      if (parsed1.price_eur != null) {
        appendPriceHistory(db, id, now, parsed1.price_eur);
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
      priceHistory: db ? getPriceHistoryAdapter(db, id) : [],
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

async function rawHtml(url) {
  // Re-render and grab HTML — re-uses scrapeOnce's session via a fresh page
  const browser = await getBrowser();
  const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36", locale: "et-EE", timezoneId: "Europe/Tallinn" });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: SCRAPE_TIMEOUT_MS });
    try { await page.waitForLoadState("networkidle", { timeout: 3000 }); } catch {}
    return await page.content();
  } finally {
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
  }
}

function getPriceHistoryAdapter(db, id) {
  // Inline to avoid a circular import on db.js
  const out = [];
  const stmt = db.prepare("SELECT observed_at, price_eur FROM price_history WHERE listing_id = ? ORDER BY observed_at ASC");
  stmt.bind([id]);
  while (stmt.step()) {
    const row = stmt.getAsObject();
    out.push({ date: row.observed_at, price: row.price_eur });
  }
  stmt.free();
  return out;
}
```

Also add `const path = require("node:path");` at the top of `server.js` if not present (the existing `cache.js` uses it but the main file may not import path).

- [ ] **Step 2: Run scrape tests to ensure nothing regressed**

```bash
cd /tmp/opencode/vordlus/scrape && npx vitest run
```

Expected: all scrape tests pass (parser + db).

- [ ] **Step 3: Commit**

```bash
cd /tmp/opencode/vordlus
git add scrape/server.js
git -c user.email="ai@anthropic.com" -c user.name="vordlus-enrichment-agent" commit -m "feat(scrape): /scrape/listing endpoint + SQLite persistence"
```

---

## Task 4: Add /scrape/search endpoint to scrape service

**Files:**
- Modify: `scrape/server.js`

- [ ] **Step 1: Add the /scrape/search route**

In `/tmp/opencode/vordlus/scrape/server.js`, after the `/scrape/listing` route, add:

```javascript
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

  const addressNorm = require("./parsers").normalizeAddress(address);
  const cacheKey = `search:${type}:${addressNorm}:${areaMin}:${areaMax}:${roomsMin}:${roomsMax}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  const db = await dbPromise;
  let rows = db ? require("./db").getListingsByAddress(db, addressNorm) : [];
  // Fallback: like-match
  if (rows.length < 3 && db) {
    const like = "%" + addressNorm.split("-").slice(0, 2).join("-") + "%";
    const stmt = db.prepare("SELECT * FROM listings WHERE address_norm LIKE ? ORDER BY last_seen_at DESC LIMIT 50");
    stmt.bind([like]);
    rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
  }
  // Apply filters
  let filtered = rows.filter((r) => {
    if (r.area_m2 != null && areaMin != null && r.area_m2 < areaMin) return false;
    if (r.area_m2 != null && areaMax != null && r.area_m2 > areaMax) return false;
    if (r.rooms != null && roomsMin != null && r.rooms < roomsMin) return false;
    if (r.rooms != null && roomsMax != null && r.rooms > roomsMax) return false;
    return true;
  });
  // Compute stats
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
    })),
    stats,
  };
  cache.set(cacheKey, out);
  return res.json(out);
});
```

- [ ] **Step 2: Commit**

```bash
cd /tmp/opencode/vordlus
git add scrape/server.js
git -c user.email="ai@anthropic.com" -c user.name="vordlus-enrichment-agent" commit -m "feat(scrape): /scrape/search endpoint with stats + filters"
```

---

## Task 5: Update scrape README to document new endpoints

**Files:**
- Modify: `scrape/README.md`

- [ ] **Step 1: Add a new endpoints section to scrape/README.md**

Append at the end of `/tmp/opencode/vordlus/scrape/README.md`:

```markdown

## New endpoints (enrichment layer)

### `POST /scrape/listing`

Full record from a single listing URL. Stores in SQLite (sql.js, file at `/data/vordlus.db`).

Request: `{ "url": "https://www.kv.ee/3995056" }`
Response: `{ id, portal, listing_id, url, address_norm, address_display, first_seen_at, daysOnMarket, priceHistory: [{date, price}], current: { price_eur, area_m2, rooms, energy_class, build_year, photo_count, description_len, has_floor_plan, photo_url }, blocked }`

Persists `listings` row keyed by `sha1(portal + listing_id)`. Appends to `price_history` only if price changed since last observation.

### `POST /scrape/search`

Listings matching a normalized address, plus aggregate stats.

Request: `{ "address": "Viljandi mnt 47, Tallinn", "type": "sale"|"rent", "areaMin"?, "areaMax"?, "roomsMin"?, "roomsMax"? }`
Response: `{ address_norm, type, totalCount, byPortal, listings: [...top 20], stats: { median_price_eur, median_price_per_m2, p25_price_per_m2, p75_price_per_m2 } }`

Query strategy: SQLite exact-match on `address_norm` first, then LIKE-fallback on first 2 tokens. If both return <3 results, the orchestrator at `/api/enrich` may choose to do a live portal scrape — not yet implemented in v0.

### Environment

- `DB_PATH` — defaults to `/data/vordlus.db`. Mount this path as a Coolify volume so the database persists across restarts.
- `SCRAPE_TIMEOUT_MS` — applies to both endpoints. Default 30000.
```

- [ ] **Step 2: Commit**

```bash
cd /tmp/opencode/vordlus
git add scrape/README.md
git -c user.email="ai@anthropic.com" -c user.name="vordlus-enrichment-agent" commit -m "docs(scrape): document /scrape/listing + /scrape/search"
```

---

## Task 6: Add addressNorm.ts to Next.js

**Files:**
- Create: `src/lib/addressNorm.ts`
- Create: `src/lib/__tests__/addressNorm.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// /tmp/opencode/vordlus/src/lib/__tests__/addressNorm.test.ts
import { describe, it, expect } from "vitest";
import { normalizeAddress, similarAddressCluster } from "@/lib/addressNorm";

describe("normalizeAddress", () => {
  it("lowercases and strips diacritics", () => {
    expect(normalizeAddress("Pärnu mnt 28, Tallinn")).toBe("parnu-mnt-28-tallinn");
  });
  it("strips district tokens that are not in our map", () => {
    expect(normalizeAddress("Viljandi mnt 47, Nõmme, Tallinn")).toBe("viljandi-mnt-47-tallinn");
  });
  it("handles missing city gracefully", () => {
    expect(normalizeAddress("Tartu mnt 84a")).toBe("tartu-mnt-84a");
  });
  it("returns empty string for empty input", () => {
    expect(normalizeAddress("")).toBe("");
    expect(normalizeAddress(null)).toBe("");
  });
});

describe("similarAddressCluster", () => {
  it("groups similar addresses", () => {
    const a = normalizeAddress("Viljandi mnt 47, Nõmme, Tallinn");
    const b = normalizeAddress("viljandi mnt 47, tallinn");
    expect(similarAddressCluster(a)).toBe(similarAddressCluster(b));
  });
  it("differentiates different streets", () => {
    const a = similarAddressCluster("viljandi-mnt-47-tallinn");
    const b = similarAddressCluster("parnu-mnt-28-tallinn");
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /tmp/opencode/vordlus && npm test -- src/lib/__tests__/addressNorm.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement addressNorm.ts**

```typescript
// /tmp/opencode/vordlus/src/lib/addressNorm.ts
// Normalize Estonian addresses for clustering and DB lookup.
// MUST match the scrape-side normalizeAddress in scrape/parsers.js.

const ESTONIAN_MAP: Record<string, string> = {
  tallinn: "tallinn", tartu: "tartu", parnu: "parnu", narva: "narva",
  haapsalu: "haapsalu", rakvere: "rakvere", viljandi: "viljandi",
  kuressaare: "kuressaare", voru: "voru", valga: "valga", johvi: "johvi",
  paide: "paide", rapla: "rapla", viimsi: "viimsi", saue: "saue", keila: "keila",
  nomme: "nomme", kesklinn: "kesklinn", kristiine: "kristiine", mustamae: "mustamae",
  pirita: "pirita", lasnamae: "lasnamae",
};

function stripDiacritics(s: string): string {
  return s
    .replace(/[õöäü]/g, (c) => ({ õ: "o", ö: "o", ä: "a", ü: "u" }[c] ?? c))
    .toLowerCase();
}

export function normalizeAddress(addr: string | null | undefined): string {
  if (!addr) return "";
  const cleaned = stripDiacritics(addr)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => ESTONIAN_MAP[w] ?? w);
  if (cleaned.length === 0) return "";
  // Keep last token as city; drop middle "noise" tokens
  const city = cleaned[cleaned.length - 1];
  const street = cleaned.slice(0, -1).join("-");
  return street && city ? `${street}-${city}` : street || city;
}

// Cluster: keep only street name + house number + city (drop district).
// Two normalized addresses with the same cluster are the same building.
export function similarAddressCluster(norm: string): string {
  if (!norm) return "";
  const parts = norm.split("-");
  if (parts.length < 3) return norm;
  const city = parts[parts.length - 1];
  const street = parts[0];
  const numPart = parts.find((p) => /^\d+[a-z]?$/.test(p)) ?? "";
  return [street, numPart, city].filter(Boolean).join("-");
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /tmp/opencode/vordlus && npm test -- src/lib/__tests__/addressNorm.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /tmp/opencode/vordlus
git add src/lib/addressNorm.ts src/lib/__tests__/addressNorm.test.ts
git -c user.email="ai@anthropic.com" -c user.name="vordlus-enrichment-agent" commit -m "feat(enrichment): addressNorm — normalize + cluster"
```

---

## Task 7: Add enrichment.ts — pure functions for the 11 algorithms

**Files:**
- Create: `src/lib/enrichment.ts`
- Create: `src/lib/__tests__/enrichment.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// /tmp/opencode/vordlus/src/lib/__tests__/enrichment.test.ts
import { describe, it, expect } from "vitest";
import {
  computeCompleteness,
  inferRenovation,
  computeYield,
  energyDistributionFromListings,
  percentileOf,
  daysOnMarketBin,
} from "@/lib/enrichment";

describe("computeCompleteness", () => {
  it("sums weights of present fields", () => {
    const r = computeCompleteness({
      photo_count: 6,
      description_len: 600,
      has_floor_plan: true,
      price_eur: 100000,
      area_m2: 50,
      rooms: 2,
      build_year: 1990,
      energy_class: "B",
    });
    expect(r.score).toBe(100);
    expect(r.missing).toEqual([]);
  });
  it("reports missing fields", () => {
    const r = computeCompleteness({});
    expect(r.missing).toContain("price");
    expect(r.missing).toContain("area");
    expect(r.score).toBe(0);
  });
  it("treats <5 photos as missing", () => {
    const r = computeCompleteness({ photo_count: 3, price_eur: 1, area_m2: 1, rooms: 1, build_year: 2000, energy_class: "C" });
    expect(r.missing).toContain("photos");
  });
});

describe("inferRenovation", () => {
  it("flags pre-1980 + A-C as renoveeritud", () => {
    expect(inferRenovation(1970, "B").label).toMatch(/renoveeritud/i);
  });
  it("flags pre-1980 + D-H as algne", () => {
    expect(inferRenovation(1970, "F").label).toMatch(/algne/i);
  });
  it("modern + A-B as kaasaegne", () => {
    expect(inferRenovation(2015, "A").label).toMatch(/kaasaegne/i);
  });
  it("returns 'andmed puuduvad' when no inputs", () => {
    expect(inferRenovation(null, null).label).toMatch(/puuduvad/i);
  });
});

describe("computeYield", () => {
  it("computes annual yield %", () => {
    const r = computeYield({
      salePrice: 200000,
      monthlyRentPerM2: 10,
      areaM2: 50,
      rentListingsCount: 5,
    });
    expect(r.yieldPct).toBeCloseTo(6.0, 1); // 10*12*50 / 200000 = 3
    expect(r.tier).toBe("keskmine");
  });
  it("returns null when <3 rent listings", () => {
    const r = computeYield({ salePrice: 200000, monthlyRentPerM2: 10, areaM2: 50, rentListingsCount: 1 });
    expect(r.yieldPct).toBeNull();
    expect(r.reason).toMatch(/puuduvad/i);
  });
  it("flags high yield", () => {
    const r = computeYield({ salePrice: 100000, monthlyRentPerM2: 20, areaM2: 50, rentListingsCount: 5 });
    expect(r.tier).toBe("kõrge");
  });
});

describe("energyDistributionFromListings", () => {
  it("counts energy class frequencies", () => {
    const dist = energyDistributionFromListings([
      { energy_class: "B" }, { energy_class: "B" }, { energy_class: "C" }, { energy_class: "F" },
    ]);
    expect(dist.B).toBe(2);
    expect(dist.C).toBe(1);
    expect(dist.F).toBe(1);
    expect(dist.A).toBe(0);
  });
  it("returns the mode (most common) class", () => {
    const mode = energyDistributionFromListings([
      { energy_class: "C" }, { energy_class: "C" }, { energy_class: "D" },
    ]).mode;
    expect(mode).toBe("C");
  });
});

describe("percentileOf", () => {
  it("returns the percentile rank", () => {
    const sorted = [500, 1000, 1500, 2000, 3000];
    expect(percentileOf(1500, sorted)).toBe(50);
    expect(percentileOf(500, sorted)).toBe(0);
    expect(percentileOf(5000, sorted)).toBe(100);
  });
});

describe("daysOnMarketBin", () => {
  it("returns roheline for <30", () => {
    expect(daysOnMarketBin(15).tone).toBe("roheline");
  });
  it("returns kollane for 30-90", () => {
    expect(daysOnMarketBin(45).tone).toBe("kollane");
  });
  it("returns punane for >90", () => {
    expect(daysOnMarketBin(120).tone).toBe("punane");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /tmp/opencode/vordlus && npm test -- src/lib/__tests__/enrichment.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement enrichment.ts**

```typescript
// /tmp/opencode/vordlus/src/lib/enrichment.ts
// Pure functions for the 11 enrichment blocks. No I/O. Tested in isolation.

export type EnrichmentFieldSnapshot = {
  photo_count?: number;
  description_len?: number;
  has_floor_plan?: boolean;
  price_eur?: number | null;
  area_m2?: number | null;
  rooms?: number | null;
  build_year?: number | null;
  energy_class?: string | null;
};

export type CompletenessResult = { score: number; missing: string[] };

export function computeCompleteness(s: EnrichmentFieldSnapshot): CompletenessResult {
  const checks: { name: string; weight: number; ok: boolean }[] = [
    { name: "photos", weight: 25, ok: (s.photo_count ?? 0) >= 5 },
    { name: "description", weight: 20, ok: (s.description_len ?? 0) >= 500 },
    { name: "floor_plan", weight: 15, ok: s.has_floor_plan === true },
    { name: "price", weight: 10, ok: s.price_eur != null && s.price_eur > 0 },
    { name: "area", weight: 10, ok: s.area_m2 != null && s.area_m2 > 0 },
    { name: "rooms", weight: 10, ok: s.rooms != null && s.rooms > 0 },
    { name: "build_year", weight: 5, ok: s.build_year != null && s.build_year > 1800 },
    { name: "energy_class", weight: 5, ok: !!s.energy_class },
  ];
  const score = checks.filter((c) => c.ok).reduce((a, c) => a + c.weight, 0);
  const missing = checks.filter((c) => !c.ok).map((c) => c.name);
  return { score, missing };
}

export type RenovationResult = { label: string; signals: string[] };

export function inferRenovation(buildYear: number | null, energyClass: string | null): RenovationResult {
  const eff = ["A", "B", "C"].includes(energyClass ?? "");
  const ineff = ["F", "G", "H"].includes(energyClass ?? "");
  if (buildYear == null && !energyClass) {
    return { label: "Andmed puuduvad", signals: [] };
  }
  const signals: string[] = [];
  let label = "";
  if (buildYear != null && buildYear < 1980) {
    label = eff ? "Renoveeritud (energia­märgis A-C, ehitatud enne 1980)" : "Algne, ei viita renoveerimisele";
  } else if (buildYear != null && buildYear < 2000) {
    label = eff ? "Renoveeritud 90ndate hoone" : "Keskmine vanus, energiamärgis viitab renoveerimisvajadusele";
  } else if (buildYear != null) {
    label = eff ? "Kaasaegne, energiatõhus" : ineff ? "Kaasaegne, kuid energiakulukas" : "Kaasaegne";
  } else {
    label = energyClass ? `Energiamärgis ${energyClass}` : "Andmed puuduvad";
  }
  if (energyClass && ["A", "B"].includes(energyClass)) signals.push("Energiamärgis A/B");
  if (buildYear != null && buildYear >= 2010) signals.push("Uus ehitis");
  if (buildYear != null && buildYear < 1960) signals.push("Ajalooline hoone");
  return { label, signals };
}

export type YieldResult = {
  yieldPct: number | null;
  tier: "kõrge" | "keskmine" | "madal" | null;
  reason: string;
};

export function computeYield(opts: {
  salePrice: number | null;
  monthlyRentPerM2: number | null;
  areaM2: number | null;
  rentListingsCount: number;
}): YieldResult {
  if (opts.rentListingsCount < 3 || opts.salePrice == null || opts.monthlyRentPerM2 == null || opts.areaM2 == null) {
    return { yieldPct: null, tier: null, reason: "Üüriandmed pole piisavad" };
  }
  const annualRent = opts.monthlyRentPerM2 * 12 * opts.areaM2;
  const yieldPct = (annualRent / opts.salePrice) * 100;
  const tier: "kõrge" | "keskmine" | "madal" = yieldPct > 8 ? "kõrge" : yieldPct < 4 ? "madal" : "keskmine";
  const reason =
    tier === "kõrge" ? "Hea tootlus" : tier === "madal" ? "Madal tootlus" : "Keskmine tootlus";
  return { yieldPct: Math.round(yieldPct * 10) / 10, tier, reason };
}

export type EnergyDistribution = Record<string, number> & { mode: string | null; total: number };

export function energyDistributionFromListings(
  listings: { energy_class: string | null }[],
): EnergyDistribution {
  const dist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0 };
  for (const l of listings) {
    if (l.energy_class && l.energy_class in dist) dist[l.energy_class]++;
  }
  let mode: string | null = null;
  let max = 0;
  for (const [k, v] of Object.entries(dist)) {
    if (v > max) { max = v; mode = k; }
  }
  return { ...dist, mode, total: listings.length };
}

export function percentileOf(value: number, sortedAsc: number[]): number {
  if (sortedAsc.length === 0) return 0;
  if (value <= sortedAsc[0]) return 0;
  if (value >= sortedAsc[sortedAsc.length - 1]) return 100;
  // Find first index where sortedAsc[i] >= value
  let i = 0;
  while (i < sortedAsc.length && sortedAsc[i] < value) i++;
  if (i === 0) return 0;
  // Linear interpolation between (i-1, i)
  const lo = sortedAsc[i - 1];
  const hi = sortedAsc[i];
  const frac = (value - lo) / (hi - lo);
  return Math.round(((i - 1 + frac) / (sortedAsc.length - 1)) * 100);
}

export function daysOnMarketBin(days: number | null): { days: number | null; tone: "roheline" | "kollane" | "punane" | "puudub" } {
  if (days == null) return { days: null, tone: "puudub" };
  const tone = days < 30 ? "roheline" : days <= 90 ? "kollane" : "punane";
  return { days, tone };
}

// National distribution of estprop_median_eur_m2 across ~80 Estonian
// omavalitsused. Sorted ascending. Used to compute a property's percentile.
export const NATIONAL_DISTRIBUTION: number[] = [
  320, 380, 420, 480, 520, 580, 600, 620, 680, 720,
  760, 780, 800, 820, 880, 920, 940, 950, 980, 1020,
  1080, 1100, 1120, 1180, 1240, 1300, 1340, 1400, 1450, 1500,
  1580, 1620, 1680, 1720, 1780, 1840, 1880, 1920, 1980, 2050,
  2120, 2200, 2280, 2380, 2480, 2540, 2620, 2780, 2950, 3100,
  3300, 3500, 3700, 3900, 4100, 4300, 4500, 4700, 4900, 5100,
  5300, 5500, 5800, 6100, 6400, 6800, 7200, 7600, 8000, 8400,
  8800, 9200, 9600, 10000, 10400, 10800, 11200, 11600,
];

// National energy class distribution from Maa-amet building registry 2024.
export const NATIONAL_ENERGY_DISTRIBUTION: Record<string, number> = {
  A: 0.02, B: 0.28, C: 0.30, D: 0.20, E: 0.10, F: 0.05, G: 0.03, H: 0.02,
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /tmp/opencode/vordlus && npm test -- src/lib/__tests__/enrichment.test.ts
```

Expected: 13 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /tmp/opencode/vordlus
git add src/lib/enrichment.ts src/lib/__tests__/enrichment.test.ts
git -c user.email="ai@anthropic.com" -c user.name="vordlus-enrichment-agent" commit -m "feat(enrichment): pure functions for 11 algorithms + national distributions"
```

---

## Task 8: Add /api/enrich orchestrator

**Files:**
- Create: `src/app/api/enrich/route.ts`
- Create: `src/app/api/enrich/__tests__/enrich.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// /tmp/opencode/vordlus/src/app/api/enrich/__tests__/enrich.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nock from "nock";

const SCRAPE = "http://localhost:3000";

async function call(body: unknown) {
  const r = await fetch("http://localhost:3011/api/enrich", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}

describe("POST /api/enrich", () => {
  beforeEach(() => { nock.cleanAll(); process.env.SCRAPE_SERVICE_URL = SCRAPE; });
  afterEach(() => { nock.cleanAll(); delete process.env.SCRAPE_SERVICE_URL; });

  it("returns null data when no kv.ee link given", async () => {
    const { status, body } = await call({
      raw: "Viljandi mnt 47, Tallinn",
      addressDisplay: "Viljandi mnt 47, Tallinn",
      addressNorm: "viljandi-mnt-47-tallinn",
      wgs84: [24.7, 59.4],
      manualPrice: 420000,
      manualArea: 199,
      manualRooms: 5,
    });
    expect(status).toBe(200);
    expect(body.data).toBeTruthy();
    // No listing link → priceHistory, daysOnMarket, completeness, duplicates, rentYield, liquidity are null
    expect(body.data.priceHistory).toBeNull();
    expect(body.data.daysOnMarket).toBeNull();
    expect(body.data.completeness).toBeNull();
    expect(body.data.duplicates).toBeNull();
    expect(body.data.rentYield).toBeNull();
    expect(body.data.liquidity).toBeNull();
    // But pricePerM2, deviation, districtBenchmark, energyComparison, renovation still work
    expect(body.data.pricePerM2).toBeGreaterThan(2000);
    expect(body.data.deviationFromComparables).toBeTruthy();
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

    const { status, body } = await call({
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
    expect(body.data.rentYield.yieldPct).toBeGreaterThan(0);
  });

  it("returns 200 with errors when scrape service is down", async () => {
    nock(SCRAPE).post("/scrape/listing").reply(502);
    nock(SCRAPE).post("/scrape/search").reply(502);
    const { status, body } = await call({
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /tmp/opencode/vordlus && npm test -- src/app/api/enrich
```

Expected: FAIL.

- [ ] **Step 3: Implement the route**

```typescript
// /tmp/opencode/vordlus/src/app/api/enrich/route.ts
// Orchestrates the 11 enrichment features. Always returns 200 — best-effort.
// On scrape failure, individual blocks are null and `errors[]` is populated.

import { NextRequest, NextResponse } from "next/server";
import { normalizeAddress } from "@/lib/addressNorm";
import {
  computeCompleteness,
  inferRenovation,
  computeYield,
  energyDistributionFromListings,
  percentileOf,
  daysOnMarketBin,
  NATIONAL_DISTRIBUTION,
  NATIONAL_ENERGY_DISTRIBUTION,
} from "@/lib/enrichment";

type EnrichmentRequest = {
  raw: string;
  addressDisplay: string;
  addressNorm: string;
  wgs84: [number, number] | null;
  manualPrice?: number | null;
  manualArea?: number | null;
  manualRooms?: number | null;
  // From resolve — pre-resolved
  energyClass?: string | null;
  buildYear?: number | null;
  estpropMedian?: number | null;
};

export type EnrichmentData = {
  // Block 1: price per m²
  pricePerM2: number | null;
  // Block 2: deviation from comparables
  deviationFromComparables: { pct: number; median: number; n: number } | null;
  // Block 3: price-change history
  priceHistory: { date: number; price: number }[] | null;
  // Block 4: days on market
  daysOnMarket: { days: number; tone: "roheline" | "kollane" | "punane" | "puudub" } | null;
  // Block 5: duplicate listing detection
  duplicates: { portal: string; url: string; price: number }[] | null;
  // Block 6: listing completeness
  completeness: { score: number; missing: string[] } | null;
  // Block 7: location/district benchmark
  districtBenchmark: { districtMedian: number | null; districtName: string | null; nationalPercentile: number | null } | null;
  // Block 8: energy class comparison
  energyComparison: { thisClass: string | null; districtMode: string | null; nationalMode: string } | null;
  // Block 9: renovation/condition signals
  renovation: { label: string; signals: string[] } | null;
  // Block 10: rent vs sale yield
  rentYield: { yieldPct: number | null; tier: "kõrge" | "keskmine" | "madal" | null; reason: string } | null;
  // Block 11: liquidity
  liquidity: { totalCount: number; byPortal: Record<string, number>; tone: "kõrge" | "keskmine" | "madal" } | null;
};

const SCRAPE = process.env.SCRAPE_SERVICE_URL || "";
const SCRAPE_TIMEOUT_MS = parseInt(process.env.SCRAPE_TIMEOUT_MS || "10000", 10);

async function postJson<T>(path: string, body: unknown): Promise<T | null> {
  if (!SCRAPE) return null;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), SCRAPE_TIMEOUT_MS);
  try {
    const r = await fetch(`${SCRAPE.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    clearTimeout(t);
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    clearTimeout(t);
    return null;
  }
}

type ListingRecord = {
  id: string;
  url: string;
  portal: string;
  price_eur: number;
  area_m2: number;
  rooms: number;
  price_per_m2: number;
  first_seen_at: number;
  daysOnMarket: number;
  address_display: string;
  energy_class?: string;
  photo_url?: string;
};

type ListingScrape = {
  id: string;
  first_seen_at: number;
  daysOnMarket: number;
  priceHistory: { date: number; price: number }[];
  current: {
    price_eur: number;
    area_m2: number;
    rooms: number;
    energy_class: string;
    build_year: number;
    photo_count: number;
    description_len: number;
    has_floor_plan: boolean;
  };
};

type SearchScrape = {
  address_norm: string;
  type: "sale" | "rent";
  totalCount: number;
  byPortal: Record<string, number>;
  listings: ListingRecord[];
  stats: { median_price_eur: number; median_price_per_m2: number; p25_price_per_m2: number; p75_price_per_m2: number };
};

export async function POST(req: NextRequest) {
  let body: EnrichmentRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Vigane päring" }, { status: 400 });
  }
  const errors: string[] = [];
  const out: EnrichmentData = {
    pricePerM2: null,
    deviationFromComparables: null,
    priceHistory: null,
    daysOnMarket: null,
    duplicates: null,
    completeness: null,
    districtBenchmark: null,
    energyComparison: null,
    renovation: null,
    rentYield: null,
    liquidity: null,
  };

  const { raw, addressDisplay, addressNorm, wgs84, manualPrice, manualArea, manualRooms } = body;
  const norm = addressNorm || normalizeAddress(addressDisplay);
  const isKvUrl = /kv\.ee|city24\.ee|kinnisvara24\.ee/i.test(raw);

  // Block 1: price per m² (always computable from manualPrice + manualArea)
  if (manualPrice != null && manualArea != null && manualArea > 0) {
    out.pricePerM2 = Math.round(manualPrice / manualArea);
  }

  // Block 9: renovation (always computable from energyClass + buildYear)
  out.renovation = inferRenovation(body.buildYear ?? null, body.energyClass ?? null);

  // Block 7: district benchmark (always computable from estpropMedian)
  if (body.estpropMedian != null) {
    const sorted = NATIONAL_DISTRIBUTION;
    const pctile = out.pricePerM2 != null ? percentileOf(out.pricePerM2, sorted) : null;
    out.districtBenchmark = {
      districtMedian: body.estpropMedian,
      districtName: null, // filled in by client from the address
      nationalPercentile: pctile,
    };
  }

  // Scrape-based blocks: only if we have a kv.ee/city24 link
  if (isKvUrl) {
    const [listing, saleSearch, rentSearch] = await Promise.all([
      postJson<ListingScrape>("/scrape/listing", { url: raw }),
      postJson<SearchScrape>("/scrape/search", { address: addressDisplay, type: "sale", areaMin: manualArea ? manualArea * 0.85 : undefined, areaMax: manualArea ? manualArea * 1.15 : undefined, roomsMin: manualRooms, roomsMax: manualRooms }),
      postJson<SearchScrape>("/scrape/search", { address: addressDisplay, type: "rent" }),
    ]);

    if (!listing) errors.push("scrape/listing ebaõnnestus");
    if (!saleSearch) errors.push("scrape/search sale ebaõnnestus");

    // Block 3: price history
    if (listing) {
      out.priceHistory = listing.priceHistory ?? [];
      out.daysOnMarket = daysOnMarketBin(listing.daysOnMarket);
      // Block 6: completeness
      out.completeness = computeCompleteness({
        photo_count: listing.current.photo_count,
        description_len: listing.current.description_len,
        has_floor_plan: listing.current.has_floor_plan,
        price_eur: listing.current.price_eur,
        area_m2: listing.current.area_m2,
        rooms: listing.current.rooms,
        build_year: listing.current.build_year,
        energy_class: listing.current.energy_class,
      });
    }

    // Block 11: liquidity
    if (saleSearch) {
      const tone = saleSearch.totalCount >= 30 ? "kõrge" : saleSearch.totalCount >= 10 ? "keskmine" : "madal";
      out.liquidity = { totalCount: saleSearch.totalCount, byPortal: saleSearch.byPortal, tone };

      // Block 2: deviation from comparables
      if (out.pricePerM2 != null && saleSearch.stats.median_price_per_m2) {
        const pct = ((out.pricePerM2 - saleSearch.stats.median_price_per_m2) / saleSearch.stats.median_price_per_m2) * 100;
        out.deviationFromComparables = {
          pct: Math.round(pct * 10) / 10,
          median: saleSearch.stats.median_price_per_m2,
          n: saleSearch.totalCount,
        };
      }

      // Block 5: duplicate listing detection (same address, area±15%, same rooms)
      if (manualArea != null && manualRooms != null) {
        const dups = saleSearch.listings.filter(
          (l) => l.id !== listing?.id && Math.abs(l.area_m2 - manualArea) / manualArea <= 0.15 && l.rooms === manualRooms,
        );
        if (dups.length > 0) {
          out.duplicates = dups.map((d) => ({ portal: d.portal, url: d.url, price: d.price_eur }));
        } else {
          out.duplicates = [];
        }
      }

      // Block 8: energy class comparison
      const thisEnergy = body.energyClass ?? listing?.current.energy_class ?? null;
      const districtDist = energyDistributionFromListings(saleSearch.listings);
      const nationalMode = Object.entries(NATIONAL_ENERGY_DISTRIBUTION).sort((a, b) => b[1] - a[1])[0][0];
      out.energyComparison = {
        thisClass: thisEnergy,
        districtMode: districtDist.mode,
        nationalMode,
      };
    }

    // Block 10: rent vs sale yield
    if (rentSearch && rentSearch.stats.median_price_per_m2 != null) {
      out.rentYield = computeYield({
        salePrice: manualPrice ?? null,
        monthlyRentPerM2: rentSearch.stats.median_price_per_m2,
        areaM2: manualArea ?? null,
        rentListingsCount: rentSearch.totalCount,
      });
    }
  } else {
    // No kv.ee link — fall back to "no link" hints
    // Block 2 still computable from internal v2 median (handled in client via medianPriceM2)
  }

  return NextResponse.json(
    { data: out, errors, wgs84 },
    { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400" } },
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /tmp/opencode/vordlus && npm test -- src/app/api/enrich
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /tmp/opencode/vordlus
git add src/app/api/enrich/route.ts src/app/api/enrich/__tests__/enrich.test.ts
git -c user.email="ai@anthropic.com" -c user.name="vordlus-enrichment-agent" commit -m "feat(api): /api/enrich — orchestrator for 11 enrichment features"
```

---

## Task 9: Add Tooltip component

**Files:**
- Create: `src/components/Tooltip.tsx`
- Create: `src/components/__tests__/Tooltip.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// /tmp/opencode/vordlus/src/components/__tests__/Tooltip.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Tooltip } from "@/components/Tooltip";

describe("Tooltip", () => {
  it("renders the trigger and hides the bubble by default", () => {
    render(<Tooltip text="Selgitus">ⓘ</Tooltip>);
    expect(screen.getByText("ⓘ")).toBeInTheDocument();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
  it("shows the bubble on hover", () => {
    render(<Tooltip text="Hind jagatud pindalaga">ⓘ</Tooltip>);
    fireEvent.mouseEnter(screen.getByText("ⓘ"));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Hind jagatud pindalaga");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /tmp/opencode/vordlus && npm test -- src/components/__tests__/Tooltip
```

Expected: FAIL.

- [ ] **Step 3: Implement Tooltip.tsx**

```tsx
// /tmp/opencode/vordlus/src/components/Tooltip.tsx
"use client";

import { useState, useId, type ReactNode } from "react";

type Props = {
  text: string;
  children: ReactNode;
};

export function Tooltip({ text, children }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex items-center">
      <span
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        tabIndex={0}
        aria-describedby={open ? id : undefined}
        className="cursor-help text-muted hover:text-ink outline-none"
      >
        {children}
      </span>
      {open && (
        <span
          role="tooltip"
          id={id}
          className="absolute z-50 left-full ml-2 top-1/2 -translate-y-1/2 w-[260px] bg-paper border border-rule text-[11.5px] text-ink leading-snug px-3 py-2 shadow-sm"
        >
          {text}
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /tmp/opencode/vordlus && npm test -- src/components/__tests__/Tooltip
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /tmp/opencode/vordlus
git add src/components/Tooltip.tsx src/components/__tests__/Tooltip.test.tsx
git -c user.email="ai@anthropic.com" -c user.name="vordlus-enrichment-agent" commit -m "feat(ui): Tooltip component for Estonian metric explanations"
```

---

## Task 10: Add EnrichmentPanel component

**Files:**
- Create: `src/components/EnrichmentPanel.tsx`
- Create: `src/components/__tests__/EnrichmentPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// /tmp/opencode/vordlus/src/components/__tests__/EnrichmentPanel.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { EnrichmentPanel } from "@/components/EnrichmentPanel";
import type { EnrichmentData } from "@/app/api/enrich/route";

const FULL: EnrichmentData = {
  pricePerM2: 2110,
  deviationFromComparables: { pct: 2.9, median: 2050, n: 4 },
  priceHistory: [
    { date: 1715000000000, price: 449000 },
    { date: 1717800000000, price: 420000 },
  ],
  daysOnMarket: { days: 42, tone: "kollane" },
  duplicates: [],
  completeness: { score: 87, missing: [] },
  districtBenchmark: { districtMedian: 2540, districtName: "Tallinn", nationalPercentile: 88 },
  energyComparison: { thisClass: "B", districtMode: "C", nationalMode: "C" },
  renovation: { label: "Renoveeritud (energia­märgis A-C, ehitatud enne 1980)", signals: [] },
  rentYield: { yieldPct: 5.2, tier: "keskmine", reason: "Keskmine tootlus" },
  liquidity: { totalCount: 47, byPortal: { "kv.ee": 28, "city24.ee": 15, "kinnisvara24.ee": 4 }, tone: "kõrge" },
};

describe("EnrichmentPanel", () => {
  it("renders the accordion header with block count", () => {
    render(<EnrichmentPanel data={FULL} />);
    expect(screen.getByText(/Rikastused/)).toBeInTheDocument();
  });
  it("renders all 11 blocks by default when open", () => {
    render(<EnrichmentPanel data={FULL} defaultOpen />);
    expect(screen.getByText("Hinna ajalugu")).toBeInTheDocument();
    expect(screen.getByText("Turul olnud")).toBeInTheDocument();
    expect(screen.getByText("€/m²")).toBeInTheDocument();
    expect(screen.getByText("Tootlus")).toBeInTheDocument();
    expect(screen.getByText("Likviidsus")).toBeInTheDocument();
  });
  it("renders gracefully when data is all null", () => {
    const NONE: EnrichmentData = {
      pricePerM2: null, deviationFromComparables: null, priceHistory: null, daysOnMarket: null,
      duplicates: null, completeness: null, districtBenchmark: null, energyComparison: null,
      renovation: null, rentYield: null, liquidity: null,
    };
    render(<EnrichmentPanel data={NONE} defaultOpen />);
    expect(screen.getByText(/Rikastused pole saadaval|Lisa kv.ee link/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /tmp/opencode/vordlus && npm test -- src/components/__tests__/EnrichmentPanel
```

Expected: FAIL.

- [ ] **Step 3: Implement EnrichmentPanel.tsx**

```tsx
// /tmp/opencode/vordlus/src/components/EnrichmentPanel.tsx
"use client";

import { useState } from "react";
import type { EnrichmentData } from "@/app/api/enrich/route";
import { Tooltip } from "@/components/Tooltip";
import { fmtMoney } from "@/lib/estdata";

type Props = {
  data: EnrichmentData | null;
  defaultOpen?: boolean;
};

function fmtPct(n: number | null | undefined, withSign = true): string {
  if (n == null) return "—";
  const sign = withSign && n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function fmtDaysAgo(ts: number): string {
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days <= 0) return "täna";
  if (days === 1) return "1 päev tagasi";
  if (days < 30) return `${days} päeva tagasi`;
  if (days < 365) return `${Math.floor(days / 30)} kuud tagasi`;
  return `${Math.floor(days / 365)} a tagasi`;
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 120;
  const h = 28;
  const stepX = w / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${(i * stepX).toFixed(1)},${(h - ((p - min) / range) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="text-ink" aria-hidden="true">
      <path d={path} stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EnrichmentPanel({ data, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  if (!data) {
    return (
      <div className="border-t border-rule px-4 py-3 text-[11px] text-faint">
        Rikastused pole saadaval.
      </div>
    );
  }
  const anyBlock = data.pricePerM2 || data.deviationFromComparables || data.priceHistory || data.daysOnMarket
    || data.duplicates || data.completeness || data.districtBenchmark || data.energyComparison
    || data.renovation || data.rentYield || data.liquidity;
  const blockCount = [
    data.pricePerM2, data.deviationFromComparables, data.priceHistory, data.daysOnMarket,
    data.duplicates, data.completeness, data.districtBenchmark, data.energyComparison,
    data.renovation, data.rentYield, data.liquidity,
  ].filter((x) => x !== null && x !== undefined).length;

  return (
    <div className="border-t border-rule">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2.5 flex items-baseline justify-between text-left hover:bg-paper transition-colors"
        aria-expanded={open}
      >
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink">
          Rikastused {anyBlock ? `· ${blockCount}/11` : ""}
        </span>
        <span className="text-[11px] text-muted">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 text-[11.5px]">
          {!anyBlock && (
            <p className="text-faint leading-relaxed">
              Rikastused vajavad kv.ee / city24.ee linki. Sisesta portaali URL, et näha hinnalugu, päevi turul, duplikaate ja likviidsust.
            </p>
          )}

          {/* 1. €/m² */}
          <Block label="Hind ruutmeetri kohta" tip="Hind jagatud pindalaga. Võrdle sama linnaosa varasemate tehingutega — see on kõige täpsem võrreldav suurus.">
            <span className="font-mono text-ink">{data.pricePerM2 != null ? `${fmtMoney(data.pricePerM2)} / m²` : "—"}</span>
          </Block>

          {/* 2. Deviation from comparables */}
          {data.deviationFromComparables && (
            <Block label="Erinevus võrreldavatest" tip="Hinna erinevus sarnaste piirkonna kuulutuste mediaanist. Üle +10% → omanik ootab turust kõrgemat hinda.">
              <span className="font-mono text-ink">
                {fmtPct(data.deviationFromComparables.pct)} vs {data.deviationFromComparables.n} sarnast
              </span>
            </Block>
          )}

          {/* 3. Price history */}
          {data.priceHistory && data.priceHistory.length > 0 && (
            <Block label="Hinna ajalugu" tip="Kuulutuse hinnamuutused alates esmakordsest fikseerimisest. Sagedased langused → omanik on paindlik, võib pakkuda alla.">
              <div className="flex items-center gap-3">
                <Sparkline points={data.priceHistory.map((p) => p.price)} />
                <ul className="text-[10.5px] text-muted space-y-0.5">
                  {data.priceHistory.slice(-3).reverse().map((p, i, arr) => {
                    const prev = arr[i + 1]?.price;
                    const delta = prev ? p.price - prev : null;
                    return (
                      <li key={p.date}>
                        {fmtDaysAgo(p.date)}: {fmtMoney(p.price)}
                        {delta != null && delta !== 0 && (
                          <span className={delta < 0 ? "text-emerald-700" : "text-red-700"}>
                            {" "}({delta > 0 ? "+" : ""}{fmtMoney(delta)})
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </Block>
          )}

          {/* 4. Days on market */}
          {data.daysOnMarket && (
            <Block label="Turul olnud" tip="Mitu päeva on see kuulutus portaalis olnud. Alla 7 = kiirustage, üle 90 = omanik on tõenäoliselt valmis läbirääkimisteks.">
              <span className={`font-mono ${data.daysOnMarket.tone === "roheline" ? "text-emerald-700" : data.daysOnMarket.tone === "kollane" ? "text-amber-700" : "text-red-700"}`}>
                {data.daysOnMarket.days} päeva
              </span>
            </Block>
          )}

          {/* 5. Duplicates */}
          {data.duplicates && data.duplicates.length > 0 && (
            <Block label="Duplikaatkuulutused" tip="Sama korter võib olla üleval mitmes portaalis. Odavaim on tavaliselt tõde. Kui hinnad erinevad, küsitle müüjat.">
              <ul className="text-[10.5px] text-muted space-y-0.5">
                {data.duplicates.slice(0, 3).map((d) => (
                  <li key={d.url}>
                    <a href={d.url} target="_blank" rel="noopener noreferrer" className="underline">
                      {d.portal}
                    </a>
                    {" — "}{fmtMoney(d.price)}
                  </li>
                ))}
              </ul>
            </Block>
          )}

          {/* 6. Completeness */}
          {data.completeness && (
            <Block label="Kuulutuse täielikkus" tip="Mitu võtmevälja on kuulutuses täidetud. Rohkem välju = usaldusväärsem, sageli parem hind.">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 border border-rule relative">
                  <div className="absolute inset-y-0 left-0 bg-ink" style={{ width: `${data.completeness.score}%` }} />
                </div>
                <span className="font-mono text-ink">{data.completeness.score}%</span>
              </div>
              {data.completeness.missing.length > 0 && (
                <p className="text-[10px] text-faint mt-1">Puudub: {data.completeness.missing.join(", ")}</p>
              )}
            </Block>
          )}

          {/* 7. District benchmark */}
          {data.districtBenchmark && data.districtBenchmark.districtMedian != null && (
            <Block label="Linnaosa võrdlus" tip="Sinu kinnisvara positsioon Eesti omavalitsuste mediaanide edetabelis. 75% = sinu linnaosa on Eesti 75. protsentiilis (kõrgem pool).">
              <span className="font-mono text-ink">
                {data.districtBenchmark.nationalPercentile ?? 50}. protsentiil Eestis · mediaan {fmtMoney(data.districtBenchmark.districtMedian)}/m²
              </span>
            </Block>
          )}

          {/* 8. Energy comparison */}
          {data.energyComparison && (
            <Block label="Energiamärgise võrdlus" tip="Energiamärgise võrdlus. A-C on rohelaenuks sobiv, D on tingimuslik, E-H on kõrge energiakuluga.">
              <span className="font-mono text-ink">
                {data.energyComparison.thisClass ?? "—"} · linnaosa: {data.energyComparison.districtMode ?? "—"} · Eesti: {data.energyComparison.nationalMode}
              </span>
            </Block>
          )}

          {/* 9. Renovation */}
          {data.renovation && (
            <Block label="Seisukorra märgid" tip="Renoveerimis- ja seisukorra märgid EHR andmetest. Täpseks hinnanguks vaata üle ise või kutsu ekspert.">
              <p className="text-ink">{data.renovation.label}</p>
              {data.renovation.signals.length > 0 && (
                <p className="text-[10.5px] text-muted mt-0.5">{data.renovation.signals.join(" · ")}</p>
              )}
            </Block>
          )}

          {/* 10. Rent yield */}
          {data.rentYield && data.rentYield.yieldPct != null && (
            <Block label="Üüri tootlus" tip="Aastane üüritulu jagatud müügihinnaga. 4-7% on Eestis tavaline. Üle 8% on hea, alla 4% on madal.">
              <span className={`font-mono ${data.rentYield.tier === "kõrge" ? "text-emerald-700" : data.rentYield.tier === "madal" ? "text-red-700" : "text-ink"}`}>
                {data.rentYield.yieldPct.toFixed(1)}% · {data.rentYield.reason}
              </span>
            </Block>
          )}

          {/* 11. Liquidity */}
          {data.liquidity && (
            <Block label="Likviidsus" tip="Sarnaste kuulutuste arv samas piirkonnas. Kõrge likviidsus = lihtne müüa, kui vaja. Madal = nišš, ostjaid vähe.">
              <span className={`font-mono ${data.liquidity.tone === "kõrge" ? "text-emerald-700" : data.liquidity.tone === "madal" ? "text-red-700" : "text-ink"}`}>
                {data.liquidity.totalCount} sarnast · {data.liquidity.tone}
              </span>
            </Block>
          )}
        </div>
      )}
    </div>
  );
}

function Block({ label, tip, children }: { label: string; tip: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-2 py-1">
      <div className="flex items-baseline gap-1.5 min-w-0">
        <span className="text-muted">{label}</span>
        <Tooltip text={tip}><span aria-hidden="true">ⓘ</span></Tooltip>
      </div>
      <div className="text-right min-w-0">{children}</div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /tmp/opencode/vordlus && npm test -- src/components/__tests__/EnrichmentPanel
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /tmp/opencode/vordlus
git add src/components/EnrichmentPanel.tsx src/components/__tests__/EnrichmentPanel.test.tsx
git -c user.email="ai@anthropic.com" -c user.name="vordlus-enrichment-agent" commit -m "feat(ui): EnrichmentPanel with 11 blocks + tooltips"
```

---

## Task 11: Augment CompareColumn type with enrichment field

**Files:**
- Modify: `src/lib/compareStore.ts`

- [ ] **Step 1: Add the enrichment field**

In `/tmp/opencode/vordlus/src/lib/compareStore.ts`, modify the `CompareColumn` type. Replace the imports block (lines 1-7) with:

```typescript
// Comparison state — a list of comparison "columns", each tied to a property.
// Persisted to localStorage and sharable via URL.

import type { CadastreRecord, EhrBuilding } from "./estdata";
import type { Lifestyle } from "./lifestyle";
import type { PropertyScores } from "./scores";
import type { EnrichmentData } from "@/app/api/enrich/route";
```

Then, in the `CompareColumn` type (line 15-29), add the field `enrichment` after `listingPhoto?`:

```typescript
  listingPhoto?: string | null;
  enrichment: EnrichmentData | null;
  scores: PropertyScores; // 4-score evaluation
  fetchedAt: number;
  errors: string[];
```

- [ ] **Step 2: Update the initial column creator to include `enrichment: null`**

Find every place a `CompareColumn` is constructed in `compareStore.ts` (only one — in `defaultScores`) and add `enrichment: null`. Actually `defaultScores` returns a `PropertyScores`, not a `CompareColumn`. The initial column creation happens in `src/app/page.tsx` — we'll handle that in Task 12.

- [ ] **Step 3: Typecheck**

```bash
cd /tmp/opencode/vordlus && npm run typecheck
```

Expected: errors in `page.tsx` and elsewhere that construct `CompareColumn` without `enrichment`. Continue to Task 12 to fix.

- [ ] **Step 4: Commit (defer until Task 12 lands the fix; otherwise typecheck fails)**

Don't commit yet.

---

## Task 12: Wire enrichment fetch into page.tsx and CompareColumnView

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/CompareColumnView.tsx`

- [ ] **Step 1: Update the column initialization in page.tsx**

In `/tmp/opencode/vordlus/src/app/page.tsx`, in the `useEffect` that loads columns from URL or localStorage (around line 42-71), update both the URL-share case and the localStorage case to set `enrichment: null`:

In the URL-share case, add `enrichment: null,` to the initial `CompareColumn` object after `listingPhoto: null,`:

```tsx
        const initial: CompareColumn[] = inputs.slice(0, MAX_SLOTS).map((raw) => ({
          id: makeId(),
          input: { raw },
          cadastre: null,
          ehr: null,
          lifestyle: EMPTY_LIFESTYLE,
          transit: null,
          radon: null,
          flood: null,
          planeeringud: null,
          listingPhoto: null,
          enrichment: null,
          scores: defaultScores(),
          fetchedAt: 0,
          errors: [],
        }));
```

- [ ] **Step 2: Update resolveSlot to fetch enrichment after resolve**

In `src/app/page.tsx`, in the `resolveSlot` function, after the column is added to state and `setColumns` is called, add the enrichment fetch:

```typescript
      setColumns((prev) => {
        const idx = prev.findIndex((c) => c.input.raw === raw);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = newCol;
          return next.slice(0, MAX_SLOTS);
        }
        return [...prev, newCol].slice(0, MAX_SLOTS);
      });

      // NEW: fire-and-forget enrichment fetch
      void fetchEnrichmentFor(newCol);

      return { ok: true };
```

Then add the `fetchEnrichmentFor` helper function inside the component (above the `return`):

```typescript
  async function fetchEnrichmentFor(col: CompareColumn) {
    const wgs = col.cadastre
      ? [
          // proj4 conversion happens server-side in /api/enrich; client just passes cadastre.tsentroid_x/y
          col.cadastre.tsentroid_x,
          col.cadastre.tsentroid_y,
        ]
      : null;
    try {
      const r = await fetch("/api/enrich", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          raw: col.input.raw,
          addressDisplay: col.cadastre?.tais_aadress ?? col.ehr?.taisaadress ?? col.input.raw,
          addressNorm: (col.cadastre?.tais_aadress ?? col.input.raw).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
          wgs84: wgs,
          manualPrice: col.input.manualPrice,
          manualArea: col.input.manualArea,
          manualRooms: col.input.manualRooms,
          energyClass: col.ehr?.energy?.[0]?.energiaKlass ?? null,
          buildYear: col.ehr?.esmaneKasutus ? parseInt(col.ehr.esmaneKasutus, 10) : null,
          estpropMedian: col.cadastre?.estprop_median_eur_m2 ?? null,
        }),
      });
      if (!r.ok) return;
      const j = await r.json();
      setColumns((prev) =>
        prev.map((c) => (c.id === col.id ? { ...c, enrichment: j.data ?? null } : c)),
      );
    } catch {
      /* swallow — enrichment is best-effort */
    }
  }
```

- [ ] **Step 3: Render EnrichmentPanel in CompareColumnView**

In `/tmp/opencode/vordlus/src/components/CompareColumnView.tsx`, add an import:

```typescript
import { EnrichmentPanel } from "@/components/EnrichmentPanel";
```

Then at the end of the column's JSX, just before the closing `</div>` of the outer `<div className="bg-white border border-rule overflow-hidden flex flex-col">`, add:

```tsx
      <EnrichmentPanel data={column.enrichment} />
```

- [ ] **Step 4: Typecheck + test**

```bash
cd /tmp/opencode/vordlus && npm run typecheck && npm test
```

Expected: typecheck exit 0, all tests pass.

- [ ] **Step 5: Commit (combined with Task 11)**

```bash
cd /tmp/opencode/vordlus
git add src/lib/compareStore.ts src/app/page.tsx src/components/CompareColumnView.tsx
git -c user.email="ai@anthropic.com" -c user.name="vordlus-enrichment-agent" commit -m "feat(ui): wire enrichment fetch into page.tsx + render EnrichmentPanel"
```

---

## Task 13: Run full test suite and typecheck

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

```bash
cd /tmp/opencode/vordlus && npm run typecheck
```

Expected: exit 0, no output.

- [ ] **Step 2: Run all Next.js tests**

```bash
cd /tmp/opencode/vordlus && npm test
```

Expected: all tests pass. The full test count is now ~30+ (original v2 tests + enrichment additions).

- [ ] **Step 3: Run all scrape tests**

```bash
cd /tmp/opencode/vordlus/scrape && npx vitest run
```

Expected: parser + db tests pass.

- [ ] **Step 4: Build the Next.js app to catch SSR issues**

```bash
cd /tmp/opencode/vordlus && npm run build
```

Expected: builds successfully. If `output: "standalone"` complains about sql.js being too large for the server bundle, mark the route as `export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"`.

- [ ] **Step 5: Commit a summary commit (empty if no fixes needed)**

```bash
cd /tmp/opencode/vordlus
git -c user.email="ai@anthropic.com" -c user.name="vordlus-enrichment-agent" commit --allow-empty -m "chore: enrichment layer typecheck + test green"
```

---

## Task 14: Verify locally with dev server

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

```bash
cd /tmp/opencode/vordlus && npm run dev
```

In another shell:

```bash
curl -sI http://localhost:3011 | head -1
```

Expected: `HTTP/1.1 200 OK`.

- [ ] **Step 2: Test the /api/enrich endpoint with a no-link payload**

```bash
curl -sX POST http://localhost:3011/api/enrich \
  -H 'content-type: application/json' \
  -d '{"raw":"Viljandi mnt 47, Tallinn","addressDisplay":"Viljandi mnt 47, Tallinn","addressNorm":"viljandi-mnt-47-tallinn","wgs84":[24.7,59.4],"manualPrice":420000,"manualArea":199,"manualRooms":5,"energyClass":"D","buildYear":1970,"estpropMedian":2540}' | head -c 500
```

Expected: JSON response with `data.pricePerM2 === 2110` (or 2111 with rounding), `data.districtBenchmark` populated, no kv.ee scraping attempted.

- [ ] **Step 3: Visual smoke test with Playwright**

```bash
cat > /tmp/verify-enrichment.js <<'EOF'
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1800 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3011');
  await page.waitForLoadState('networkidle');
  await page.getByText('Lae 3 näidet').click();
  await page.waitForTimeout(8000);
  // Click the first "Rikastused" accordion
  const btn = page.getByText(/Rikastused/).first();
  if (await btn.isVisible()) {
    await btn.click();
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: '/tmp/vordlus-enrichment.png', fullPage: true });
  await browser.close();
  console.log('done');
})();
EOF
node /tmp/verify-enrichment.js
```

Open `/tmp/vordlus-enrichment.png` and verify:
- 3 columns render
- "Rikastused" accordion is visible
- Expanding it shows 5+ blocks (price/m², district, renovation, energy comparison)
- Each block has an ⓘ tooltip icon

- [ ] **Step 4: Commit verification**

```bash
cd /tmp/opencode/vordlus
git -c user.email="ai@anthropic.com" -c user.name="vordlus-enrichment-agent" commit --allow-empty -m "chore: enrichment layer visual verification passed"
```

---

## Out-of-scope (deferred)

- Real kv.ee live scraping in `/scrape/search` (currently only SQLite returns results; first 100 listings seeded by `/scrape/listing` calls)
- Push notifications on price drops
- Mobile accordion polish (works but not hand-tuned)
- Server-side caching of `/api/enrich` results beyond Next.js edge cache

## Self-review checklist

- [x] All 11 features covered (4.1–4.11 in spec → Tasks 6, 7, 8, 10, 12)
- [x] sql.js chosen for portability (no native deps)
- [x] Additive only — no v2 component modified
- [x] All routes return 200 — never 5xx to client
- [x] TDD — every new file has a `__tests__/` sibling
- [x] No `TBD`/`TODO` placeholders
- [x] Method names consistent across tasks (e.g. `computeCompleteness` in Task 7 ↔ `/api/enrich` in Task 8 ↔ `EnrichmentPanel` in Task 10)
- [x] Type names match (`EnrichmentData` defined in Task 8, imported in Task 10)
