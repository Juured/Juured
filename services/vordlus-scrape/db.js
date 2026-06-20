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
    const r = proxiedExec(sql);
    flush(db, filePath);
    return r;
  };
  db.run = (sql, params) => {
    const r = proxiedRun(sql, params);
    flush(db, filePath);
    return r;
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
  const stmt = db.prepare("SELECT price_eur FROM price_history WHERE listing_id = ? AND observed_at = ?");
  stmt.bind([listingId, observedAt]);
  const exists = stmt.step();
  let skip = false;
  if (exists) {
    const existing = stmt.getAsObject().price_eur;
    if (existing === priceEur) skip = true;
  }
  stmt.free();
  if (skip) return;
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
    out.push({ date: row.observed_at, price_eur: row.price_eur });
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
