# vordlus — Listing Enrichment Layer

**Date:** 2026-06-20
**Status:** proposed (Sections 1-5)
**Live:** https://vordlus.vercel.app
**Code:** /root/projects/vordlus
**Author:** second AI agent (in parallel with the v2 lifestyle/AVM work)

## Context

A separate AI agent has shipped the v2 design (see `2026-06-20-vordlus-v2-design.md`):
- `/api/resolve` orchestrator + 5-score system (`Fair Value`, `TCO`, `Appreciation`, `Lifestyle`, `Rohelaen`)
- `LifestyleMatrix`, `AvmBar`, `Monogram`, `RiskBadges`, `PlaneeringuRadar`, `ComparisonTable` UI
- 6 new proxy routes (poi, huvipunktid, transit, nordapi, radon, flood, planeeringud, orthophoto)
- Per-omavalitsus € / m² baseline (`estprop_median_eur_m2`)

The user has now requested 11 new enrichment features on top of v2:

1. price per m² (already in v2, surface it)
2. deviation from comparable listings
3. price-change history
4. days on market
5. duplicate listing detection
6. listing completeness score
7. location/district benchmark (already in v2, deepen it)
8. energy class comparison (already in v2, deepen it)
9. renovation/condition signals
10. rent vs sale yield if rental data exists
11. liquidity: similar supply nearby

User decisions (this round):
- **Scrape extension:** extend the existing `vordlus-scrape` Coolify service (not a new container)
- **Persistence:** SQLite inside the scrape container (use `sql.js` to avoid native-module Docker bloat)
- **Sync with other AI:** commit to master, additive isolation
- **UI depth:** full UI — `<EnrichmentPanel>` + tooltips on every metric

## Goal

Add an 11-block enrichment layer that augments every `CompareColumn` with kv.ee/city24.ee-derived intelligence. Visible in a collapsible `<EnrichmentPanel>` at the bottom of each column. Explain each metric in Estonian via tooltips so the user understands what they're looking at. Make sure data flows from scrape service → Next.js API → client without any silent failures.

## Non-goals

- Do not touch the 5 existing scores, `resolve`, or any v2 component.
- Do not scrape Maa-amet htraru (transaction history) — restricted, defer.
- Do not change the existing `/api/listing-photo` (photo only).
- Do not add a new Coolify container. Extend `vordlus-scrape`.

## Design — five sections

### Section 1: Architecture (additive layer on top of v2)

```
   ┌────────────────────────────────────────────────────────────┐
   │ Browser (Next.js)                                          │
   │  CompareColumnView ──<EnrichmentPanel> (NEW, this round)  │
   └──────┬─────────────────────────────────┬───────────────────┘
          │ /api/resolve (v2)               │ /api/enrich (NEW)
          ▼                                ▼
   ┌────────────────────┐         ┌────────────────────────────┐
   │  Resolve flow      │         │  Enrich orchestrator (NEW) │
   │  (In-AKS, EHR,     │ ──addr─▶│  - delegates to scrape     │
   │   cadastre,        │  WGS84  │  - derives everything else │
   │   poi, transit…)   │         │    from EHR + cadastre     │
   └────────────────────┘         └──────────┬─────────────────┘
                                              │ /scrape/listing, /scrape/search
                                              ▼
   ┌────────────────────────────────────────────────────────────┐
   │  vordlus-scrape (extended)                                 │
   │  - /scrape        existing (photo)                         │
   │  - /scrape/listing  NEW — full record + price history      │
   │  - /scrape/search   NEW — by address, type=rent|sale       │
   │  - SQLite (sql.js)  NEW — listings + price_history tables  │
   │  - /health         existing                                │
   └────────────────────────────────────────────────────────────┘
```

Key principle: **`/api/enrich` runs after `/api/resolve` and never blocks the v2 flow.** If enrichment fails (Cloudflare, no kv.ee link, etc.), the column still renders the v2 scores. Enrichment is best-effort, additive, and isolated from the v2 resolve pipeline.

### Section 2: Data model + persistence

**SQLite schema (inside vordlus-scrape, `data/vordlus.db`):**

```sql
CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,             -- sha1(portal + listing_id)
  portal TEXT NOT NULL,            -- 'kv.ee' | 'city24.ee' | 'kinnisvara24.ee'
  listing_id TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  address_norm TEXT NOT NULL,      -- lowercase, hyphenated, no commas
  address_display TEXT,            -- human-readable, e.g. "Viljandi mnt 47, Tallinn"
  first_seen_at INTEGER NOT NULL, -- unix ms
  last_seen_at INTEGER NOT NULL,
  last_price_eur INTEGER,
  area_m2 REAL,
  rooms INTEGER,
  energy_class TEXT,
  build_year INTEGER,
  photo_url TEXT,
  photo_count INTEGER DEFAULT 0,
  description_len INTEGER DEFAULT 0,
  has_floor_plan INTEGER DEFAULT 0,
  raw_json TEXT
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
```

**Persistence layer:** `sql.js` (pure-JS WASM SQLite). No native build deps → trivial to add to the existing `mcr.microsoft.com/playwright:v1.49.0-jammy` image. DB file lives at `/data/vordlus.db` (Coolify volume mount point). On startup, sql.js loads the file into memory and writes back on every mutation. Safe for single-process scrape service.

**Why sql.js over better-sqlite3:** the scrape container is `playwright:v1.49.0-jammy` — adding `apt-get install build-essential python` to support `node-gyp` would balloon the image. `sql.js` is 1.2MB and works on every Node version. Trade-off: writes are in-memory and flushed, so a kill -9 can lose the last few writes. Acceptable for an enrichment store.

### Section 3: New scrape endpoints

**`POST /scrape/listing` — full record from a single kv.ee/city24 URL.**

Request: `{ url: "https://www.kv.ee/3995056" }`
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
  "priceHistory": [
    { "date": 1715000000000, "price": 449000 },
    { "date": 1716100000000, "price": 435000 },
    { "date": 1717800000000, "price": 420000 }
  ],
  "current": {
    "price_eur": 420000,
    "area_m2": 199,
    "rooms": 5,
    "energy_class": "D",
    "build_year": 1970,
    "photo_count": 12,
    "description_len": 1450,
    "has_floor_plan": true,
    "photo_url": "https://..."
  },
  "completeness": { "score": 87, "missing": [] },
  "blocked": false
}
```

Pipeline:
1. Validate URL (only kv.ee, city24.ee, kinnisvara24.ee — same allowlist as `/api/listing-photo`)
2. If cached in LRU (existing) and not stale (>6h), return cached
3. Launch Playwright, `domcontentloaded` + `networkidle 2s`
4. Detect Cloudflare block (existing `looksLikeBlocked` heuristic)
5. Extract via per-portal parser in `extract.js`:
   - kv.ee: `div.object-price strong`, `div.object-data dt/dd`, `.object-photos img`, etc.
   - city24.ee: similar selectors
6. Normalize address → `address_norm` (lowercase, hyphenated, strip punctuation)
7. Compute `id = sha1(portal + listing_id)`; upsert into `listings`
8. If price changed, append to `price_history`
9. Compute `completeness.score` (see Section 4)
10. Cache result in LRU + return

**`POST /scrape/search` — listings matching an address.**

Request: `{ address: "Viljandi mnt 47, Tallinn", type: "sale"|"rent", areaMin?, areaMax?, roomsMin?, roomsMax?, radiusKm?: 0.5 }`
Response:
```json
{
  "address_norm": "viljandi-mnt-47-tallinn",
  "type": "sale",
  "totalCount": 47,
  "byPortal": { "kv.ee": 28, "city24.ee": 15, "kinnisvara24.ee": 4 },
  "listings": [
    {
      "id": "kv-3995056",
      "url": "https://www.kv.ee/3995056",
      "portal": "kv.ee",
      "price_eur": 420000,
      "area_m2": 199,
      "rooms": 5,
      "price_per_m2": 2110,
      "first_seen_at": 1715000000000,
      "daysOnMarket": 42,
      "address_display": "Viljandi mnt 47, Tallinn",
      "photo_url": "..."
    }
  ],
  "stats": {
    "median_price_eur": 380000,
    "median_price_per_m2": 2050,
    "p25_price_per_m2": 1750,
    "p75_price_per_m2": 2400
  }
}
```

Pipeline:
1. Normalize the address
2. Query SQLite `listings WHERE address_norm LIKE '%<norm>%'` first (free, instant)
3. If < 10 results or DB empty, fall through to live scrape:
   - For each portal: `https://<portal>/<search-url>?q=<address>` → Playwright → parse result list
4. Aggregate by `address_norm` cluster, compute stats (median, p25, p75)
5. Filter by type, area, rooms if given
6. Return top 20 + stats + total count

**Rate limiting:** no more than 1 live search per 10 seconds per `address_norm`. Live searches hit the LRU first.

### Section 4: Enrichment algorithms (server-side, in `/api/enrich`)

The enrich route orchestrates everything and returns a single `EnrichmentData` object per column. Sections 4.1–4.11 below map 1:1 to the 11 user-requested features in the same order.

**4.1 price per m²**
- `price_per_m2 = manualPrice / manualArea` (same computation as v2)
- Surface as the primary number in the enrichment panel, color-coded against the v2 AVM bar
- tooltip: "Hind jagatud pindalaga. Võrdle sama linnaosa varasemate tehingutega — see on kõige täpsem võrreldav suurus."

**4.2 deviation from comparable listings**
- From `/scrape/search` stats — `deviation_pct = (this_price_per_m2 - median_comparables_price_per_m2) / median_comparables_price_per_m2 × 100`
- Color: roheline if `< -5%`, kollane `±5%`, punane if `> +5%`
- tooltip: "Hinna erinevus sarnaste piirkonna kuulutuste mediaanist. Üle +10% → omanik ootab turust kõrgemat hinda."

**4.3 price-change history**
- Source: SQLite `price_history`
- Compute: `% change from first_seen`, `count of price drops`, `last_change_days_ago`
- Render: sparkline (8 SVG points) + list of changes
- tooltip: "Kuulutuse hinnamuutused alates esmakordsest fikseerimisest. Sagedased langused → omanik on paindlik, võib pakkuda alla."

**4.4 days on market**
- Source: `now - first_seen_at` from SQLite
- Bins: roheline <30, kollane 30-90, punane >90
- tooltip: "Mitu päeva on see kuulutus portaalis olnud. Alla 7 = kiirustage, üle 90 = omanik on tõenäoliselt valmis läbirääkimisteks."

**4.5 duplicate listing detection**
- From `/scrape/search`: group by `(address_norm, rooms, area±5%)`
- If `count > 1`: flag as duplicate, list duplicates with portal + price
- tooltip: "Sama korter võib olla üleval mitmes portaalis. Odavaim on tavaliselt tõde. Kui hinnad erinevad, küsitle müüjat."

**4.6 listing completeness score**
- Weighted field presence (no scraping, computed from `/scrape/listing` response):
  - `photos ≥ 5` → 25
  - `description_len ≥ 500` → 20
  - `has_floor_plan` → 15
  - `price` → 10
  - `area_m2` → 10
  - `rooms` → 10
  - `build_year` → 5
  - `energy_class` → 5
- Output: 0-100 + array of missing fields
- tooltip: "Mitu võtmevälja on kuulutuses täidetud. Rohkem välju = usaldusväärsem, sageli parem hind."

**4.7 location/district benchmark (deepened on top of v2's estprop_median_eur_m2)**
- v2 already exposes `estprop_median_eur_m2` per omavalitsus. We extend it with:
  - `NATIONAL_DISTRIBUTION: number[]` — constant, all ~80 omavalitsus medians from the v2 table, sorted ascending. Lives in `src/lib/enrichment.ts`.
  - This property's percentile: `pctile = (rank(this_price_per_m2, NATIONAL_DISTRIBUTION) / N) * 100`
  - Render: "Tallinn: 2540 €/m² · 75. protsentiil Eestis"
- tooltip: "Sinu kinnisvara positsioon Eesti omavalitsuste mediaanide edetabelis. 75% = sinu linnaosa on Eesti 75. protsentiilis (kõrgem pool)."

**4.8 energy class comparison**
- This property: from EHR `energy[0].energiaKlass`
- District average: from `/scrape/search` → aggregate energy_class across listings in same `address_norm` cluster
- National average: hardcoded constant `NATIONAL_ENERGY_DISTRIBUTION: Record<string, number>` (from Maa-amet building registry 2024, ~30% B, 30% C, 20% D, 10% E, 10% F-H). Lives in `src/lib/enrichment.ts`.
- Render: "B · linnaosa keskmine: C · Eesti keskmine: D"
- tooltip: "Energiamärgise võrdlus. A-C on rohelaenuks sobiv, D on tingimuslik, E-H on kõrge energiakuluga."

**4.9 renovation/condition signals**
- Rule-based inference from EHR:
  - `build_year < 1980 AND energy_class ∈ {A, B, C}` → "Renoveeritud (energia­märgis A-C, ehitatud enne 1980)"
  - `build_year < 1980 AND energy_class ∈ {D-H}` → "Algne, ei viita renoveerimisele"
  - `build_year >= 1980 AND build_year < 2000 AND energy_class ∈ {A, B, C}` → "Renoveeritud 90ndate hoone"
  - `build_year >= 2000 AND energy_class ∈ {A, B}` → "Kaasaegne, energiatõhus"
  - `lift` in EHR `technical[]` → "+ Lift olemas"
  - `tubadeArv !== null` → "Terviklik planeering"
- Output: 1-line verdict + 0-3 bullet signals
- tooltip: "Renoveerimis- ja seisukorra märgid EHR andmetest. Täpseks hinnanguks vaata üle ise või kutsu ekspert."

**4.10 rent vs sale yield**
- From `/scrape/search?type=rent` (same address_norm cluster)
- If `rent_listings.length >= 3`:
  - `median_rent_per_m2 = median(rent_listings.price_eur / rent_listings.area_m2)`
  - `annual_rent = median_rent_per_m2 × 12 × area_m2`
  - `yield_pct = (annual_rent / sale_price) × 100`
  - If `yield_pct > 8%` → amber "Head tootlust"
  - If `yield_pct < 4%` → red "Madal tootlus"
- If `rent_listings.length < 3` → "Üüriandmed pole piisavad"
- tooltip: "Aastane üüritulu jagatud müügihinnaga. 4-7% on Eestis tavaline. Üle 8% on hea, alla 4% on madal."

**4.11 liquidity (similar supply nearby)**
- From `/scrape/search`: `totalCount` + `byPortal`
- Bins: kõrge ≥30, keskmine 10-29, madal <10
- tooltip: "Sarnaste kuulutuste arv samas piirkonnas. Kõrge likviidsus = lihtne müüa, kui vaja. Madal = nišš, ostjaid vähe."

### Section 5: UI

**`<EnrichmentPanel>` — collapsible accordion at the bottom of `CompareColumnView`.**

```
┌─ [▼ Rikastused (8/11)] ─────────────────────────┐
│                                                  │
│  1. €/m² ja võrdlus naabruskonnaga              │
│     €2,110 / m²                                  │
│     [============|=========] vs Tallinn mediaan   │
│     +2.9% üle 4 sarnase kuulutuse mediaani       │
│     ⓘ                                           │
│                                                  │
│  2. Hinna ajalugu (3 muutust)                   │
│     [sparkline]                                  │
│     18 päeva tagasi: −€14,000 (−3.2%)           │
│     42 päeva tagasi: −€29,000 (−6.5%)           │
│     ⓘ                                           │
│                                                  │
│  3. Turul olnud: 42 päeva 🟡                    │
│     ⓘ                                           │
│                                                  │
│  ... (kõik 11 blokki, kõigil ⓘ tooltip)         │
└──────────────────────────────────────────────────┘
```

**`<Tooltip>` — small reusable component (NEW, 8 lines).**
- Hover/tap on the ⓘ icon shows a 1-3 sentence Estonian explanation
- Uses `aria-describedby` for accessibility
- Render: floating bubble with thin border, paper background, max 280px

**Loading state:**
- Each block is its own sub-section. If `/api/enrich` hasn't returned yet, show a 1-line placeholder "..." in faint text. Never block the v2 column render.

**Empty/error state:**
- If `/api/enrich` returns 502 or no kv.ee link was given, show a single line: "Rikastused pole saadaval — [selgitus]". Never crash the column.

**No-link case:**
- If user pasted a free-text address (no kv.ee URL), features 3, 4, 5, 6, 10, 11 fall back to "Lisa kv.ee link" hint in that block. Features 1, 2, 7, 8, 9 still work (they use only EHR + cadastre + scrape search).

**Mobile:** accordion collapses to single column; tooltips work via tap (touch).

## Data flow (end-to-end)

```
User pastes "https://www.kv.ee/3995056"
   │
   ▼
POST /api/resolve { raw }
   │ (v2 — unchanged)
   ▼
Resolved { input, picked, cadastre, ehr, lifestyle, ... }
   │
   ▼
Client immediately renders CompareColumnView (v2 — unchanged)
   │ After v2 render:
   ▼
POST /api/enrich {
     raw,                    // the kv.ee URL
     wgs84: [lat, lon],      // from resolve.cadastre
     addressNorm,            // from resolve.cadastre
     addressDisplay,
     manualPrice?, manualArea?, manualRooms?
   }
   │
   ├─ resolve enrichment URL → POST scrape /scrape/listing → SQLite
   ├─ POST scrape /scrape/search?type=sale (this address) → comparables
   ├─ POST scrape /scrape/search?type=rent (this address) → yield
   ├─ read SQLite price_history → history + days_on_market
   ├─ aggregate energy distribution from search results
   ├─ compute completeness from /scrape/listing response
   ├─ compute renovation signals from ehr
   ├─ compute percentile from estprop_median
   │
   ▼
EnrichmentData { ...all 11 blocks... }
   │
   ▼
Client renders <EnrichmentPanel> below the v2 column
```

## Caching

| Layer | Key | TTL | SWR |
|---|---|---|---|
| Scrape LRU | full URL | 6h | 24h |
| SQLite | listing id | persistent | persistent |
| Next.js `/api/enrich` | `address_norm + manualPrice + manualArea` | 30min | 24h |
| Next.js `/api/listing-photo` | URL | 1h | 24h (existing) |

The SQLite-backed price history is the only persistent store. Everything else is cache-aside.

## Error handling

- `/api/enrich` always returns 200 with `{ data: EnrichmentData | null, errors: string[] }` — never 5xx to the client
- Each sub-fetch (scrape/listing, scrape/search) is wrapped in try/catch. Failure of one block doesn't kill the others
- `data: null` + `errors: [...]` → client renders the "Rikastused pole saadaval" state
- Scraping Cloudflare-blocked responses → `blocked: true` → those features show "—", others (district, energy comparison, renovation) keep working
- No kv.ee URL → blocks 3, 4, 5, 6, 10, 11 are null, others still render

## Testing approach

- **Unit (vitest):**
  - `enrichment.ts` — `computeCompleteness`, `inferRenovation`, `computeYield`, `energyDistribution`, `percentileOf`
  - `addressNorm.ts` — `normalizeAddress`, `similarAddressCluster`
- **API tests (vitest + nock):**
  - `/api/enrich` — handles missing kv.ee link, blocked scrape, partial failure, full success
- **Scrape tests (vitest + nock):**
  - `parseKvListing` — extracts price, area, photos, etc. from sample HTML
  - `parseCity24Listing` — same for city24
  - SQLite upsert + price_history append
- **Component (vitest + RTL):**
  - `EnrichmentPanel` — renders 11 blocks, tooltips on each, accordion toggle
  - `Tooltip` — appears on hover, dismisses on leave
- **E2E (Playwright, optional):**
  - Open vordlus.vercel.app, paste 1 real kv.ee URL, assert enrichment block appears within 8s

## Implementation order

**Sprint 5 (2 days) — Scrape service extension**
- Task 1: Add `sql.js` + SQLite schema (`scrape/db.js`)
- Task 2: Add per-portal parsers in `scrape/extract.js` (`parseKvListing`, `parseCity24Listing`)
- Task 3: Add `POST /scrape/listing` route
- Task 4: Add `POST /scrape/search` route
- Task 5: Add sql.js to scrape `Dockerfile` (just `npm install sql.js`)

**Sprint 6 (2 days) — Next.js enrichment layer**
- Task 6: `src/lib/addressNorm.ts` + tests (normalize + cluster)
- Task 7: `src/lib/enrichment.ts` (pure functions for the 11 algorithms) + tests
- Task 8: `src/app/api/enrich/route.ts` + tests
- Task 9: `src/components/Tooltip.tsx` + tests
- Task 10: `src/components/EnrichmentPanel.tsx` + tests

**Sprint 7 (1 day) — Wire into UI**
- Task 11: Augment `CompareColumn` type with `enrichment: EnrichmentData | null`
- Task 12: Fetch enrichment in `src/app/page.tsx` after `resolveSlot` returns
- Task 13: Render `<EnrichmentPanel>` at the bottom of `CompareColumnView`
- Task 14: Manual visual verification + commit

## Out-of-scope decisions (deferred)

- **Real AVM** (Estiq) — paid. Use static `estprop_median` table.
- **Sold-price history** (Maa-amet htraru) — restricted. Use SQLite-snapshot-of-active-listings as proxy.
- **Server-side accounts / save enrichment results** — localStorage only.
- **Push notifications on price drops** — out of scope; user would need a cron.

## Open questions

None at design time. All sections approved by user (commit-to-master, full UI, sql.js for portability).

## Files I will touch (additive only)

**New files:**
- `scrape/db.js` (SQLite + sql.js)
- `scrape/parsers.js` (per-portal parsers)
- `src/lib/addressNorm.ts` + `__tests__/addressNorm.test.ts`
- `src/lib/enrichment.ts` + `__tests__/enrichment.test.ts`
- `src/app/api/enrich/route.ts` + `__tests__/enrich.test.ts`
- `src/components/EnrichmentPanel.tsx` + `__tests__/EnrichmentPanel.test.tsx`
- `src/components/Tooltip.tsx` + `__tests__/Tooltip.test.tsx`

**Modified files (additive only — new fields, no removals):**
- `src/lib/compareStore.ts` — add `enrichment: EnrichmentData | null` to `CompareColumn`
- `src/app/page.tsx` — fetch enrichment after resolve, pass to columns
- `src/components/CompareColumnView.tsx` — render `<EnrichmentPanel>` at the bottom
- `scrape/server.js` — add `/scrape/listing` and `/scrape/search` routes
- `scrape/extract.js` — add per-portal parsers (additive)
- `scrape/package.json` — add `sql.js` dep
- `scrape/Dockerfile` — no changes needed (sql.js is pure JS)
- `scrape/README.md` — document the two new endpoints

**Files I will NOT touch:**
- `src/lib/scores.ts` — the 5 existing scores stay
- `src/app/api/resolve/route.ts` — the v2 resolve flow stays
- `src/lib/lifestyle.ts`, `src/lib/estdata.ts` — stay
- All v2 components (`AvmBar`, `LifestyleMatrix`, `Monogram`, `RiskBadges`, `PlaneeringuRadar`, `ComparisonTable`, `PropertyMap`) — stay
- The existing `/api/listing-photo` route — stays
- The existing `/scrape` and `/health` routes — stay (back-compat)
