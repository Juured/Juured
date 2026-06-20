# vordlus v2 — data depth & lifestyle fix

**Date:** 2026-06-20
**Status:** approved design (Sections 1–7)
**Live:** https://vordlus.vercel.app
**Code:** /root/projects/vordlus

## Problem

The v0.2 MVP is shipped and works, but two things are wrong:

1. **Lifestyle is broken.** `src/lib/lifestyle.ts:77` (`scoreLifestyle`) returns stars from a hash of the cadastral id. Pure random. The 7-category lifestyle data (park, school, gym, transit, shop, cafe, restaurant) is computed but **never rendered** in `CompareColumnView.tsx` — only the combined "Elustiil" score shows. When a user pastes a real address, the lifestyle card shows stars that don't reflect anything real.
2. **Other gaps.** Fair Value has no real per-area baseline (uses batch median of the comparison set, useless for 1-2 properties). No green mortgage signal. No planeeringu radar. No risk overlays. No real building photos (just a fake SVG). No school quality, real transit frequency, or per-address utility rates.

## Goal

Make vordlus the comparison tool it claims to be in the masthead: every score, every row in the lifestyle matrix, every visible "—" should be backed by a real, free, public Estonian data source. No random data. No fake placeholders.

## Non-goals

- A property detail view. That's juured.com.
- A real AVM (Maa-amet htraru is restricted; Estiq is paid). Use the 2022 regular land valuation as the only free per-address proxy.
- Server-side accounts / save-to-server. Localstorage + base64 URL share stays.
- Mobile app. The site is responsive but not a PWA.
- Scraping kv.ee / city24.ee. ToS-restricted; we already extract address hints from URL slugs only.
- Redesigning the masthead or navigation. Stay focused on the column.

## Design — seven sections

### Section 1: Lifestyle data flow (PRIMARY FIX)

**Replace the random stub.** `scoreLifestyle(c, e)` currently calls `deterministic(c, e)` which generates stars from a hash. Replace with a three-tier fetch:

- **Primary** — OSM Overpass via `/api/poi?lat&lon&radius=1000`. Keep the existing proxy. Harden it (see Caching).
- **Secondary** — Maa-amet huvipunktid WFS (official Estonian POI catalog). New proxy `/api/huvipunktid?lat&lon&radius`. Same 7 categories, used when Overpass is down or returns 0 elements.
- **Tertiary** — `null` with `{ label: "Andmed puuduvad", count: 0, stars: 0 }`. **Never random.**

The score function in `lifestyle.ts:76` becomes `scoreLifestyle(poiData | huvipunktidData | null)`. If both real-data paths return null/empty, return the explicit-missing shape.

**Render the 7-category matrix.** New compact block in `CompareColumnView.tsx` between the score cards and the data table. Layout: 2-column grid, 7 rows. Each row: icon + category name (Park, Kool, Spordisaal, Ühistransport, Pood, Kohvik, Restoran) + count + 5-star row. Use the existing `Stars` component. "Andmed puuduvad" badge on missing rows, not random stars.

### Section 2: Real AVM baseline (Fair Value)

**New field.** `estprop_median_eur_m2` — per-omavalitsus median €/m² from Maa-amet 2022 regular land valuation. Pulled from `ky.kataster.ee` (or `kataster.ee/avaandmed`). New adapter in `estdata.ts`, new optional field in `CadastreRecord`. Cache for 30 days, immutable.

**Score change.** `fairValueScore(pricePerM2, marketMedian, maksHind, area)` becomes `fairValueScore(pricePerM2, estpropMedian, batchMedian, maksHind, area)` — explicit 5-arg signature change. The orchestrator (`computeScores` in `src/lib/scores.ts`) passes both `estpropMedian` (per-omavalitsus baseline) and `batchMedian` (current comparison set). The function uses `estpropMedian` as primary; falls back to `batchMedian` when 3+ properties are in the comparison set (more reliable than 1-2); falls back to `maksHind` last.

**UI.** AVM bar — a thin horizontal bar below the price showing `price/m²` on a logarithmic scale, with markers for "Maa-amet 2022 mediaan" (always) and "Turu mediaan" (when 3+ properties). Green below median, red above. Subtle, not loud.

**Hint line.** Below the bar, in faint text: "vs Maa-amet 2022 mediaan €X / m²". Always visible (this is the new "real" baseline).

### Section 3: Skipped — orthophoto

User decision: no map in vordlus; juured.com is the property view. Section 3 of the original roadmap (Maa-amet orthophoto WMS for real building photos) is **out of scope**. Replaced by Section 7 (typographic monogram).

### Section 4: Six new data sources

New proxy routes in `src/app/api/`. Each returns `{ data, source, error }` shape. Each sets `Cache-Control` headers.

| # | Source | Proxy route | Used for | Cache | Auth |
|---|---|---|---|---|---|
| 1 | Peatus.ee GTFS | `/api/transit?lat&lon&radius` | Real bus/tram stop count + daytime frequency within 1 km | 24h s-maxage, 7d SWR | none |
| 2 | EHIS avaandmed | `/api/schools?lat&lon&radius` | School count + type + student/teacher ratio + state/municipal | 7d s-maxage, 30d SWR | email request (1-3 day) |
| 3 | NordAPI.ee | `/api/nordapi/[...path]` | Parking zones, monuments, plans, utility rates (€/kWh) | 24h s-maxage, 7d SWR | none |
| 4 | PLANK via NordAPI | `/api/planeeringud?lat&lon&radius` | Detailplaneeringud within 500 m — name, max floors, status | 7d s-maxage, 30d SWR | none |
| 5 | EGT radon WMS | `/api/radon?lat&lon` | Radon risk class (madal/keskmine/kõrge) from point-in-polygon | 30d immutable | none |
| 6 | Maa-amet flood WFS | `/api/flood?lat&lon` | 100-year / 1000-year flood zone boolean | 30d immutable | none |

**UI placement:**
- Peatus → upgrades the `transit` row in the lifestyle matrix (real frequency, not just stop count).
- EHIS → upgrades the `school` row with a quality sub-score (state gümnaasium > municipal lasteaed).
- NordAPI utilities → monthly cost estimate → enhances `TCO` score with € / month figure.
- PLANK → Section 5a.
- EGT radon + Maa-amet flood → Section 5c.

**Caching strategy.** Every proxy sets `Cache-Control` and is wrapped by Vercel's edge cache. No persistent disk cache needed (the data changes slowly and the public APIs are read-mostly). Overpass gets a separate, longer-lived in-process LRU keyed by `lat,lon,radius` (LRU 5000 entries) to absorb cold-start bursts.

**Resilience.** Every proxy returns a structured `{ data, source, error }` shape. UI shows explicit "Andmed puuduvad" rather than random or fake values on failure. The `source` field is used to label the data ("OSM Overpass · kumi.systems" or "Maa-amet huvipunktid").

### Section 5: New score cards

#### 5a. Planeeringu radar (compact, in the column header)

A single-line pill below the address. Three states:
- **Clean** (no plans within 500 m) → quiet checkmark, "Planeeringuid lähedal ei ole".
- **Caution** (1-2 plans, ≤4 floors) → amber dot, "1-2 planeeringut 500 m raadiuses".
- **Risk** (1+ plan with ≥5 floors or commercial) → red dot, "Uus 8-korruseline plaanitakse 240 m kaugusele".

The Risk state is the killer use case — a price-shifting signal buyers wouldn't see on kv.ee. Source: PLANK via NordAPI (Section 4 #4).

#### 5b. Green mortgage suitability (5th score card)

A 5th card in the scores block, next to the existing 4. New field on `PropertyScores`. Computed from:
- Energy class (A-C = eligible, D = depends on bank, E-H = not eligible).
- TCO monthly cost estimate from NordAPI utilities (cheaper = more eligible).
- Heating type (heat pump, district = green; oil, gas = not).

Output:
- 1-5 stars, same visual language as the other scores.
- Three-tone background: green (rohelaen sobib), amber (tingimuslik), red (ei sobi).
- Reason text: "Energiamärgis C, kaugküte 80 €/MWh → rohelaen kuni 90% LTV".

#### 5c. Risk badges (compact, below data table)

Two small pills below the existing data table:
- **Radoon** — `madal` / `keskmine` / `kõrge` with the appropriate color.
- **Üleujutus** — `ei ole ohualas` / `100a ohualas` / `1000a ohualas`.

These are factual, not scored. Just visible. Source: EGT radon + Maa-amet flood (Section 4 #5, #6).

### Section 6: UI integration

**Column layout (top to bottom):**

1. **Header block** — typographic monogram + address + location (replaces the photo, Section 7).
2. **Planeeringu radar pill** (Section 5a) — single line below address.
3. **Key metrics row** (existing) — rooms / m² / build year.
4. **Price block** (existing) — adds the AVM bar (Section 2) below.
5. **5 score cards** — Fair Value, Elamiskulud, Väärtuse kasv, Elustiil, **Rohelaen** (Section 5b).
6. **Lifestyle matrix** (Section 1) — 2-column 7-row grid under the scores.
7. **Data table** (existing) — adds the **risk badges** (Section 5c) below.

**Below the columns (new section):**

8. **Side-by-side comparison table** — same data table rendered horizontally for at-a-glance comparison across all 5 properties. Headers row, data rows aligned. Highlights best/worst per metric (subtle background, not loud colors).

**Filter sidebar additions:**

- New "Elustiil" filter — 7 checkboxes (Park, Kool, Spordisaal, Ühistransport, Pood, Kohvik, Restoran) at minimum-N threshold.
- New "Rohelaen sobilik" toggle (1-click filter for the 5th score ≥4).
- Existing filters (price, area, rooms, energy, overall) unchanged.

**Empty state:**

- When 0 columns match filters, show a quiet "0 / N vastab filtritele — [Tühjenda filtrid]" prompt with a single button. Keep the "lae 3 näidet" example loader as a separate action.

**Mobile:**

- Columns collapse to a vertical stack with a sticky property selector at the top (so the user can switch between the 5 properties without scrolling back).
- The comparison table at the bottom becomes a swipeable card stack.
- Lifestyle matrix stays inline (compact).

### Section 7: Typographic monogram (replaces photo)

**Goal** — quiet visual identifier per column, no fake illustration, no map.

- **Height**: 200px.
- **Background**: soft beige gradient (`linear-gradient(180deg, #ECEBE3 0%, #E0DED4 100%)`). Multi-unit buildings get a cooler gradient (`photo-cool`) to subtly differentiate.
- **Glyph**: large Fraunces serif initials derived from the address (e.g. "V47" for "Viljandi 47", "PM28" for "Pärnu mnt 28").
- **Glyph logic**:
  - Take the first consonant of the street name.
  - Concatenate with the building number (no separator).
  - If first word is a number, fall back to first letter of the city.
  - Empty/single-char street → first letter of the city.
- **Color**: glyph is always `ink` (#1A1A1A) at 92% opacity. No per-property hash. (Kills the current `id.charCodeAt(0) % 4` colour hash.)
- **Top-left**: `#01` column index.
- **Top-right**: close button.
- **Bottom-right**: overall score pill — `3.8 / 5 · hea`.
- **Accessibility**: `<h1>`/`<h2>` semantic stays on the address text below, not the glyph. Glyph is `aria-hidden="true"`. Reduced-motion: no animation.

## Data flow (end-to-end)

```
User pastes "Viljandi mnt 47, Tallinn"
   │
   ▼
POST /api/resolve { raw, manual }
   │
   ├─ parseUserInput → "address" kind
   │
   ├─ searchAddresses → In-AKS gazetteer → addr (WGS84 + tunnus)
   │
   ├─ getBuilding(addr.tunnus) → EHR building data
   │
   ├─ getCadastre(b.katastriyksused[0].tunnus) → CadastreRecord
   │     (now also includes estprop_median_eur_m2)
   │
   ├─ POI + transit + schools + planeeringud + radon + flood all fire
   │   in parallel (Promise.all) after we have wgs. Each is wrapped
   │   in its own try/catch — a single source failing does not block
   │   the others. Latency target: < 1.5s p50 with edge cache warm,
   │   < 4s p95 cold. (See Caching strategy below.)
   │
   ├─ fetchPOI(wgs, radius=1000) → /api/poi
   │     ├─ OSM Overpass (primary)
   │     └─ if 0 elements or 5xx → /api/huvipunktid (Maa-amet WFS)
   │     └─ if still empty → null + "Andmed puuduvad"
   │
   ├─ fetchTransit(wgs) → /api/transit
   │     └─ Peatus GTFS parse → stops within 1 km + daytime frequency
   │
   ├─ fetchSchools(wgs) → /api/schools
   │     └─ EHIS avaandmed → schools within 1 km + type/quality
   │
   ├─ fetchPlaneeringud(wgs) → /api/planeeringud
   │     └─ PLANK via NordAPI → detailplaneeringud within 500 m
   │
   ├─ fetchRadon(wgs) → /api/radon → risk class
   │
   ├─ fetchFlood(wgs) → /api/flood → boolean
   │
   └─ computeScores(...) → 5 scores + lifestyle matrix
   │
   ▼
Client renders column with all 9 sections
```

## Caching strategy

| Layer | Key | TTL | SWR |
|---|---|---|---|
| Vercel edge | URL + query | proxy-defined | proxy-defined |
| In-process LRU (Overpass) | `lat,lon,radius` | 24h | 7d |
| In-process LRU (EHIS) | `lat,lon,radius` | 7d | 30d |
| In-process LRU (PLANK) | `lat,lon,radius` | 7d | 30d |
| In-process LRU (NordAPI) | path | 24h | 7d |
| In-process LRU (radon, flood) | `lat,lon` | 30d | never |

Vercel edge is the primary cache. In-process LRU is a safety net for cold-starts on dev / local. The Overpass LRU is the most important: it absorbs the 3-8s cold-start cost.

## Error handling

- Every proxy returns `{ data: T | null, source: string | null, error: string | null }`.
- The `resolve` orchestrator never throws. Errors are collected into the `errors[]` array on `Resolved`.
- The UI never shows a fake/random value. Every "missing" cell shows "—" with `aria-label="Andmed puuduvad"`.
- Tier fallback: if primary source fails, the secondary is tried. If both fail, the UI shows the explicit-missing shape.
- Logging: every proxy logs `{ source, latency_ms, status, count, error? }` to stdout for Vercel observability.

## Testing approach

- **Unit** — `fairValueScore`, `tcoScore`, `appreciationScore`, `lifestyleScore`, `greenMortgageScore`, `computeScores` get Vitest unit tests with fixture inputs.
- **Proxy unit** — each proxy route gets a Vitest test that mocks the upstream API (nock or vi.mock) and asserts the `{ data, source, error }` shape on success/failure/timeout.
- **Integration** — a Playwright test that opens `vordlus.vercel.app`, pastes 3 real addresses, waits for scores, asserts that the lifestyle matrix shows 7 rows with non-zero stars for at least one address.
- **Visual** — `npm run build && npm run start`, take a screenshot at 480px and 1440px widths, diff against the reference mockup in `/tmp/vordlus-mockup.html`.

## Implementation order

**Sprint 1 — Lifestyle fix + AVM (1 week)**
- Section 1 (lifestyle fix): replace `scoreLifestyle`, add huvipunktid fallback, render 7-category matrix.
- Section 2 (AVM baseline): pull `estprop_median_eur_m2`, update `fairValueScore`, add AVM bar.
- Section 7 (monogram): replace `PhotoFor`, add glyph logic.

**Sprint 2 — New proxies (1 week)**
- Section 4 #1 (Peatus GTFS).
- Section 4 #3 (NordAPI utility rates).
- Section 4 #5 + #6 (radon + flood).
- Section 5c (risk badges).

**Sprint 3 — Planeeringu + green mortgage (1 week)**
- Section 4 #4 (PLANK via NordAPI).
- Section 5a (planeeringu radar).
- Section 4 #2 (EHIS schools — gated on email access).
- Section 5b (green mortgage).

**Sprint 4 — UI integration (3 days)**
- Section 6 (side-by-side comparison table, filter sidebar additions, mobile sticky selector).

## Out-of-scope decisions (deferred)

- Maa-amet htraru (transaction history) — email-gated, defer.
- Estiq AVM — paid, defer.
- Orthophoto WMS — section 3, deferred to juured.com.
- Server-side accounts / save-to-server — defer; localstorage + URL share stays.
- Mapbox / MapLibre split view — defer; user said no map.

## Open questions

None at design time. All sections approved.
