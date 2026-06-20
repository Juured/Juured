# vordlus scrape service

A small headless scrape service for Estonian real-estate listings
([kv.ee](https://kv.ee), [city24.ee](https://city24.ee), [kinnisvara24.ee](https://kinnisvara24.ee)).
It runs in Coolify on a VPS IP, which has a much better reputation than
Vercel's edge IPs for getting past Cloudflare's anti-bot layer.

The vordlus Next.js app calls this service to get the first listing photo for
a kv.ee URL.

## API

### `GET /health`

Returns `200 { ok: true, cacheSize, browserReady }`. Used by Coolify's
healthcheck and by the vordlus proxy to verify the upstream is up.

### `POST /scrape`

Body:

```json
{ "url": "https://www.kv.ee/3995056" }
```

Response (200):

```json
{
  "photoUrl": "https://img-bb.kv.ee/.../foo.jpg",
  "title": "Viljandi mnt 47, Nõmme, Tallinn",
  "address": "Viljandi mnt 47, Nõmme, Tallinn",
  "blocked": false,
  "cached": false,
  "elapsedMs": 4321
}
```

When Cloudflare blocks the request:

```json
{ "photoUrl": null, "title": null, "address": null, "blocked": true }
```

Errors:

- `400 { "error": "invalid url" }` — non-HTTP(S) URL.
- `502 { "error": "..." }` — Chromium crashed or navigation timed out.

## How it works

1. Launches a single headless Chromium on boot (`chromium.launch({ headless: true })`).
2. For each request, opens a fresh BrowserContext (clean cookies, no leaks).
3. Navigates with `domcontentloaded`, then waits for `networkidle` (capped at
   `SCRAPE_TIMEOUT_MS / 3`, 2s minimum).
4. Reads `page.content()` (the rendered HTML) and extracts the first `<img>`
   that looks like a listing photo:
   - First, a real URL from a known photo container.
   - Then, any `<img>` with a real URL and `width >= 400`.
   - Then, just the first `<img>` with a real URL.
5. Caches the result in-memory (LRU 100, 1h TTL) keyed by the canonical URL.
6. Detects Cloudflare challenge pages (`cf-chl-bypass`, "Checking your browser
   before accessing", short body with "cloudflare") and returns `blocked: true`
   instead of a fake photo.

## Environment variables

| Var | Default | Notes |
|---|---|---|
| `PORT` | `3000` | HTTP listen port. |
| `SCRAPE_TIMEOUT_MS` | `30000` | Total per-request budget including navigation and `networkidle`. |
| `CACHE_TTL_MS` | `3600000` | In-memory cache TTL (1h). |
| `CACHE_MAX` | `100` | LRU size. |
| `HEADLESS` | `true` | Set to `false` locally to see the browser. |

## Local development

```bash
cd scrape
npm install
npx playwright install chromium      # only needed if you swap the base image
node server.js                       # listens on :3000
curl -s http://localhost:3000/health
curl -s -X POST http://localhost:3000/scrape \
  -H 'content-type: application/json' \
  -d '{"url":"https://www.kv.ee/3995056"}'
```

> Note: local Cloudflare success depends entirely on your residential IP's
> reputation. From a VPS (the deployment target), it almost always works.
> From a home connection, kv.ee will often return the challenge page.

## Coolify deployment

1. In Coolify, create a new **Private Service** (with Dockerfile).
2. Point the Git source at the vordlus repo, set **Dockerfile path** to
   `scrape/Dockerfile`.
3. **Port** = `3000`. **Healthcheck path** = `/health`.
4. The image builds in ~1–2 min (the Playwright base image is large but
   everything is cached). After it starts, hit the health endpoint from the
   Coolify UI to confirm.
5. In the vordlus app's environment, set:
   ```
   SCRAPE_SERVICE_URL=http://<scrape-service-name>:3000
   ```
   where `<scrape-service-name>` is the Coolify internal DNS name of this
   service (usually the project slug + `-scrape` or whatever you named it).
6. vordlus's `POST /api/listing-photo?url=...` will then forward to this
   service.

## Why not just run this on Vercel?

Vercel's edge IPs are heavily flagged by Cloudflare's free tier. Even a
perfectly innocent Chromium from a Vercel function gets the challenge page
for kv.ee. A typical Hetzner / OVH / DO VPS IP, by contrast, is shared by
fewer Cloudflare-targeted users and is far more likely to pass.

## License

MIT. Listing photos are © their respective owners; this service only extracts
URLs, not image bytes.

## Enrichment endpoints (v2)

These power the vordlus `/api/enrich` orchestrator.

### `POST /scrape/listing`

Full record from a single listing URL. Stores in SQLite (sql.js, file at `DB_PATH`).

Body: `{ "url": "https://www.kv.ee/3995056" }`

Response:
```json
{
  "id": "kv-3995056",
  "portal": "kv.ee",
  "listing_id": "3995056",
  "url": "https://www.kv.ee/3995056",
  "address_norm": "viljandi-mnt-47-tallinn",
  "address_display": "Viljandi mnt 47, Tallinn",
  "first_seen_at": 1715000000000,
  "daysOnMarket": 42,
  "priceHistory": [{ "date": 1715000000000, "price": 449000 }, ...],
  "current": {
    "price_eur": 420000, "area_m2": 199, "rooms": 5,
    "energy_class": "D", "build_year": 1970,
    "photo_count": 12, "description_len": 1450, "has_floor_plan": true,
    "photo_url": "https://..."
  },
  "blocked": false
}
```

Persists a `listings` row keyed by `portal-listing_id`. Appends to `price_history` only if price changed since last observation. `first_seen_at` is preserved across re-scrapes.

### `POST /scrape/search`

Listings matching a normalized address, plus aggregate stats.

Body: `{ "address": "Viljandi mnt 47, Tallinn", "type": "sale" | "rent", "areaMin"?, "areaMax"?, "roomsMin"?, "roomsMax"? }`

Response: `{ address_norm, type, totalCount, byPortal, listings: [...top 20], stats: { median_price_eur, median_price_per_m2, p25_price_per_m2, p75_price_per_m2 } }`

Query strategy: SQLite exact-match on `address_norm` first, then LIKE-fallback on the first 2 tokens. Returns whatever has been previously scraped — no live portal scraping in v0.

## Persistence

`sql.js` SQLite. Two tables:

```sql
CREATE TABLE listings (
  id TEXT PRIMARY KEY,         -- e.g. "kv-3995056"
  portal TEXT, listing_id TEXT, url TEXT UNIQUE,
  address_norm TEXT, address_display TEXT,
  first_seen_at INTEGER, last_seen_at INTEGER,
  last_price_eur INTEGER, area_m2 REAL, rooms INTEGER,
  energy_class TEXT, build_year INTEGER,
  photo_url TEXT, photo_count INTEGER, description_len INTEGER, has_floor_plan INTEGER
);
CREATE TABLE price_history (
  listing_id TEXT, observed_at INTEGER, price_eur INTEGER,
  PRIMARY KEY (listing_id, observed_at)
);
```

**Important:** mount `DB_PATH` (default `/data/vordlus.db`) as a Coolify volume so the database persists across container restarts.

## Env vars

- `PORT` — default 3000
- `SCRAPE_TIMEOUT_MS` — default 30000
- `CACHE_TTL_MS` — default 3600000 (1h)
- `CACHE_MAX` — default 100
- `HEADLESS` — default "true"
- `DB_PATH` — default `/data/vordlus.db` (mount as Coolify volume)
