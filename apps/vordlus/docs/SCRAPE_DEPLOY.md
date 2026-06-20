# vordlus-scrape deploy guide (Coolify)

The Python + Crawl4AI scrape service that powers kv.ee / city24.ee /
kinnisvara24.ee extraction. Runs on a VPS IP to bypass Cloudflare
anti-bot. Source: `scrape/` directory of the Vordlus repo.

Branch: `feat/crawl4ai-scrape` (use this branch in Coolify).

## Coolify setup

1. **New Private Service** named `vordlus-scrape` (or whatever
   your existing service is called).
2. **Source**:
   - GitHub repo: `Juured/Vordlus`
   - Branch: `feat/crawl4ai-scrape`
   - Build: Dockerfile
   - Dockerfile path: `scrape/Dockerfile`
3. **Port**: `3000`
4. **Healthcheck**: `GET /health` → 200 with `{"ok": true, "llmReady": ..., "db": {...}}`
5. **Volume** (required for SQLite persistence):
   - Mount path: `/data`
   - The DB file at `/data/vordlus.db` survives container restarts.
6. **Domains** (optional, for direct debugging): `scrape.example.com`

## Environment variables

| Var | Required | Default | Notes |
|---|---|---|---|
| `PORT` | no | `3000` | |
| `SCRAPE_TIMEOUT_MS` | no | `30000` | Per-request timeout for the LLM extraction |
| `CACHE_TTL_SECONDS` | no | `3600` | LRU cache TTL for /scrape |
| `CACHE_MAX` | no | `100` | LRU cache size |
| `DB_PATH` | no | `/data/vordlus.db` | SQLite file. **Mount `/data` as a Coolify volume** |
| `OPENAI_API_KEY` | **yes** for full LLM extraction | — | Used by Crawl4AI. Without it, `/scrape` returns 503, but `/scrape/listing` and `/scrape/search` still work from the SQLite cache. |
| `ANTHROPIC_API_KEY` | alternative to OpenAI | — | Set `LLM_PROVIDER=anthropic` to use |
| `LLM_PROVIDER` | no | `openai` | `openai` or `anthropic` |
| `LLM_MODEL` | no | `gpt-4o-mini` | Override the model name |
| `LOG_LEVEL` | no | `INFO` | `DEBUG` for verbose |

## Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | Liveness + DB stats. Returns `{ok, cacheSize, llmReady, db: {listings, price_history_rows}, version}` |
| `/sources` | GET | `["kv.ee", "city24.ee", "kinnisvara24.ee"]` |
| `/scrape` | POST | Full LLM extraction. Body: `{url}`. Returns `NormalizedListing` (now includes `energy_class`, `build_year`, `has_floor_plan`). |
| `/scrape/listing` | POST | Full record + price history. Body: `{url}`. Persists to SQLite. Falls back to SQLite cache when LLM key is missing. |
| `/scrape/search` | POST | Listings matching an address. Body: `{address, type: "sale"\|"rent", areaMin?, areaMax?, roomsMin?, roomsMax?}`. Returns aggregate stats. |

## Vercel side

Set `SCRAPE_SERVICE_URL` on the **vordlus** Next.js service to the
Coolify internal DNS name of the scrape service. For example:

```
SCRAPE_SERVICE_URL=http://vordlus-scrape:3000
```

The Vordlus `/api/enrich` orchestrator will then call:
- `POST {SCRAPE_SERVICE_URL}/scrape/listing` for price history + days on market
- `POST {SCRAPE_SERVICE_URL}/scrape/search` for comparables, rent yield, liquidity

## Smoke test after deploy

```bash
# From any machine that can reach the Coolify network
curl -s http://vordlus-scrape:3000/health
# Expected: {"ok": true, "cacheSize": 0, "llmReady": true, "db": {...}, "version": "0.3.0"}

curl -s http://vordlus-scrape:3000/sources
# Expected: ["kv.ee","city24.ee","kinnisvara24.ee"]

curl -s -X POST http://vordlus-scrape:3000/scrape/search \
  -H 'content-type: application/json' \
  -d '{"address":"Viljandi mnt 47, Tallinn","type":"sale"}'
# Expected: {"address_norm": "...", "total_count": 0, ...} (empty until first scrape populates it)
```

## How enrichment works end-to-end

```
User pastes "https://www.kv.ee/3995056"
   │
   ▼
POST /api/resolve {raw} (v2)
   │ Returns: address, EHR, cadastre, lifestyle
   ▼
Client renders the comparison column
   │
   ▼ (background)
POST /api/enrich {raw, addressDisplay, manualPrice, manualArea}
   │
   ├─ /scrape/listing   → priceHistory, daysOnMarket, completeness
   ├─ /scrape/search    → deviation, duplicates, energyComparison, rentYield, liquidity
   │
   ▼
EnrichmentPanel renders 11 blocks (when the scrape service is up)
```

## Local dev

```bash
cd scrape
python -m pip install --break-system-packages -r requirements.txt
python -m playwright install chromium
DB_PATH=/tmp/test.db OPENAI_API_KEY=<your-openai-api-key> python -m uvicorn server:app --reload
```

## Tests

```bash
cd scrape
python -m pip install --break-system-packages pytest pydantic
python -m pytest __tests__/db_test.py -v
```

6/6 tests pass: schema creation, upsert, first_seen_at preservation,
price_history dedup, address normalization (diacritics + district
drop).

## First deploy checklist

- [ ] `Juured/Vordlus` repo on GitHub, branch `feat/crawl4ai-scrape` has the latest code (commit `12fa7b1` or later)
- [ ] Coolify service created with Dockerfile path `scrape/Dockerfile`
- [ ] Volume mounted at `/data`
- [ ] `OPENAI_API_KEY` set (for full enrichment)
- [ ] Healthcheck returns 200 within 60s of deploy
- [ ] Vercel `SCRAPE_SERVICE_URL` points to the Coolify service
- [ ] Test paste `https://www.kv.ee/3995056` in vordlus → enrichment panel shows `RIKASTUSED · 11/11` with full price history, days on market, etc.
