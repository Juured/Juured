# võrdlus

**Kinnisvara võrdlus.** Võrdle kuni viit Eesti kinnisvaraobjekti kõrvuti: hind, energiamärgis, kasutusluba, pindala, naabruskond.

🔗 **Live demo:** [https://juured.vercel.app/vordlus](https://juured.vercel.app/vordlus) (will be deployed)

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** with custom warm-grey Nordic palette
- **Fraunces** (display serif) + **Inter Tight** (body) + **JetBrains Mono** (numbers)
- **4 serverless API routes** for CORS-safe same-origin proxying
- **localStorage** persistence + base64 URL share for comparison sets
- **Zero backend database** — all data from public Estonian open APIs in real time

## Live data sources (all free, no auth)

| Source | URL | Used for |
|---|---|---|
| **In-AKS** | `https://aks.geoportaal.ee/inaks/inaadress/gazetteer` | Address → ADS_OID + WGS84 |
| **Cadastre X-Road** | `https://cadastrepublic.kataster.ee/api/xroad/valid/{tunnus}` | Parcel area, tax value, land use, ownership |
| **EHR (Ehitisregister)** | `https://livekluster.ehr.ee/api/building/v2/buildingData?ehr_code={code}` | Build year, energy class, kasutusluba, floor count, heating |
| **kv.ee** | scraped via the `scrape/` service in Coolify (VPS IP bypasses Cloudflare better than Vercel edge) | We extract the address from the URL slug for In-AKS; we also pull the first listing photo via the scrape service |

The comparison fetches data **per address**: In-AKS → building → kadastritunnus → cadastre. Same chain as juured.com.

## How to run

```bash
npm install
npm run dev
# open http://localhost:3011
```

## Project layout

```
src/
  app/
    layout.tsx              # global
    page.tsx                # the comparison dashboard
    globals.css             # editorial typography
    api/
      inaks/route.ts        # GET proxy → aks.geoportaal.ee
      cadastre/[tunnus]/    # GET proxy → cadastrepublic.kataster.ee
      ehr/[ehrCode]/        # GET proxy → livekluster.ehr.ee
      resolve/route.ts      # POST orchestrator: input → In-AKS → EHR → cadastre → listing photo
      listing-photo/        # GET proxy → self-hosted scrape service in Coolify
  components/
    FilterSidebar.tsx       # left sidebar with accordions
    CompareSlot.tsx         # 5 paste slots
    CompareColumnView.tsx   # the comparison column
    Monogram.tsx            # typographic identity, with optional listing photo overlay
  lib/
    estdata.ts              # typed API adapters
    parseInput.ts           # parses user input (kv URL, address, tunnus, ehr)
    compareStore.ts         # localStorage + URL share
    lifestyle.ts            # 1–5 star scoring (deterministic stub; replace with POI-based)
  types/
    proj4.d.ts              # ambient type for proj4
scrape/                     # separate Node.js + Playwright service (deploys to Coolify)
  server.js                 # POST /scrape, GET /health
  extract.js                # first-photo HTML extraction
  cache.js                  # in-memory LRU
  Dockerfile                # mcr.microsoft.com/playwright base
  README.md                 # scrape service docs
Dockerfile                  # Next.js standalone build (vordlus)
.dockerignore
```

## Features

- 5 paste slots, each accepts a kv.ee URL, an Estonian address, a cadastral id (`78401:001:0215`), or an EHR building id
- 5-column side-by-side comparison with photo, name, location, metrics (rooms / m² / terrace), price (color-coded vs market), €/m²
- Lifestyle star matrix (Park / School / Gym / Transit / Shop / Quiet) per property
- Borderless data table with all cadastral + EHR facts side-by-side
- Filter sidebar: price, area, rooms, county, energy class (A–H), lifestyle checklist
- "Salvesta" (Save) and "Minu konto" (My Account) header buttons — placeholder for v2 (no real auth)
- localStorage persistence + base64 URL share for sharing comparison sets
- Mobile-responsive: filters collapse to top, columns scroll horizontally
- All Estonian, no English

## Roadmap (v2+)

- Real lifestyle scores via distance-to-POI (parks, schools, transit)
- Pre-rendered architectural photos or `Maa-amet orthophoto` overlays
- Real AVM (median closed €/m² per micro-area from Maa-amet htraru via WFS)
- Save / share to server (instead of just localStorage)
- True accounts with saved comparisons

## Coolify deployment

The Next.js app and the kv.ee scrape service live in this repo. The
scrape service (`scrape/`) is a separate small Node.js + Playwright
container. We run **both** in Coolify (not on Vercel) so that listing
photo requests come from a VPS IP — Vercel's edge IPs get the
Cloudflare challenge page from kv.ee almost every time.

### Layout

| Service | Source | Coolify type | Port | Healthcheck |
|---|---|---|---|---|
| **vordlus** | repo root | Dockerfile → `Dockerfile` | `3000` | `/vordlus` |
| **vordlus-scrape** | `scrape/` | Dockerfile → `scrape/Dockerfile` | `3000` | `/health` |

### One-time setup

1. **Push the repo** (already done — `Juured/Vordlus`).
2. In Coolify, create a new **Private Service** named `vordlus-scrape`:
   - **Source**: this GitHub repo.
   - **Build**: Dockerfile.
   - **Dockerfile path**: `scrape/Dockerfile`.
   - **Port**: `3000`.
   - **Healthcheck path**: `/health`.
   - **Domains**: optional, e.g. `scrape.example.com` (only needed if
     you want to hit it from outside the Coolify network for debugging).
3. Create another service, `vordlus` (the Next.js app):
   - **Source**: same GitHub repo.
   - **Build**: Dockerfile.
   - **Dockerfile path**: `Dockerfile` (the one at the repo root).
   - **Port**: `3000`.
   - **Healthcheck path**: `/vordlus`.
   - **Domains**: whatever you want — the app expects to be served
     under `/vordlus` because of the `basePath` config. Either set the
     domain root to that path or set `NEXT_PUBLIC_BASE_PATH=/` to drop
     the prefix (then update any links in the UI).

### Environment variables

Set these on the **vordlus** service (the Next.js one):

| Var | Value | Notes |
|---|---|---|
| `SCRAPE_SERVICE_URL` | `http://vordlus-scrape:3000` | Internal Coolify DNS name of the scrape service. Adjust if you named it differently. |
| `SCRAPE_TIMEOUT_MS` | `8000` | Optional. Per-request timeout for the proxy. |
| `NEXT_PUBLIC_BASE_PATH` | `/vordlus` | Only if you keep the default basePath. Empty string for root-mount. |
| `NEXT_TELEMETRY_DISABLED` | `1` | Optional. Quiets Next.js analytics. |

The `vordlus-scrape` service needs no env vars — defaults are fine.

### What this gets you

- **Listing photos on the comparison card.** When a user pastes a
  `kv.ee` / `city24.ee` / `kinnisvara24.ee` URL, `/api/resolve` now
  calls `/api/listing-photo`, which forwards to `vordlus-scrape`. The
  scrape service runs a headless Chromium from the VPS IP, extracts the
  first `<img>` from the listing page, and returns the URL. The
  Monogram component on the card renders the photo with a graceful
  fallback to the typographic glyph if the image 404s.
- **No change to existing data sources.** In-AKS, Maa-amet X-Road,
  Ehitisregister, OSM Overpass, huvipunktid, PLANK, orthophoto, radon,
  flood — all still work as before.
- **Vercel is still the fallback.** You can leave the Vercel project
  alive. It just won't have listing photos because Cloudflare blocks
  the edge IPs.

### Smoke test the deployed stack

```bash
# 1. Scrape service health
curl -fsS https://scrape.example.com/health
# → {"ok":true,"cacheSize":0,"browserReady":true}

# 2. Scrape a known listing (returns photoUrl or blocked:true)
curl -fsS -X POST https://scrape.example.com/scrape \
  -H 'content-type: application/json' \
  -d '{"url":"https://www.kv.ee/3995056"}'

# 3. vordlus proxy (forwards to scrape service)
curl -fsS 'https://vordlus.example.com/api/listing-photo?url=https://www.kv.ee/3995056'
# → {"photoUrl":"https://...","title":"...","blocked":false}
```

### Why a separate scrape service?

Vercel serverless functions are short-lived and run from edge IPs that
Cloudflare heavily flags. A long-running headless Chromium on a VPS IP
gets past the challenge page reliably. The trade-off is one more
container in Coolify; the upside is listing photos actually load.

### Local dev with the scrape service

```bash
# Terminal 1: scrape service
cd scrape && npm install && npx playwright install chromium && node server.js

# Terminal 2: vordlus (point at local scrape)
cd /root/projects/vordlus
SCRAPE_SERVICE_URL=http://localhost:3000 npm run dev
```

> Note: from a residential IP, Cloudflare may still challenge kv.ee
> even via Playwright. That's expected — the production setup runs
> from the VPS IP for exactly this reason.

## License

Code: MIT. Data attribution: In-AKS, Maa-amet X-Road, Ehitisregister.
