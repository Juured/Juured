# vordlus — Data Source Roadmap (v2/v3)

> **Compiled 2026-06-19.** This file is the v2/v3 backlog for [vordlus](https://vordlus.vercel.app). MVP uses In-AKS + Cadastre X-Road + Ehitisregister (see [PLAN.md](../estprop/PLAN.md) for vordlus's own source catalog; this file is the **next** 30 sources, ordered by impact).
>
> **Key strategic finding:** **NordAPI.ee** (https://nordapi.ee/docs) is a community-maintained no-auth JSON wrapper around ~30 Estonian public services. It already covers **11 of the 15 categories** we need to fill in vordlus. It's the single highest-leverage addition.

---

## MVP source set (live now)

| Source | Use |
|---|---|
| In-AKS gazetteer | address → ADS_OID |
| Cadastre X-Road | parcel area, tax value, land use, ownership |
| Ehitisregister (EHR) live API | build year, energy class, kasutusluba, heating, floors |

These three give us the **property** view. vordlus's "Parkimine / MyFitness / Ühistransport / Pood / Kool / Elustiil" columns are all `—` placeholders. The 30 sources below fill those.

---

## Top 10 v2 sources (ordered by impact)

### 1. NordAPI.ee — 137 Estonian endpoints, no auth
- **URL:** `https://nordapi.ee` · **base:** `https://nordapi.ee/api/v1/`
- **Auth:** none · **CORS:** enabled · **License:** free, attribution
- **Wraps:** 11 of 15 vordlus columns in one dependency
- **Endpoint catalog (verified by mining the docs site):**
  - `/estonian-power/outages` — current power outages by maakond (Elektrilevi rikkekaart)
  - `/estonian-monuments` — 12,569 cultural monuments, filter by county/type
  - `/estonian-plans` — 17,420 detailplaneeringud (PLANK, read-only since Dec 2025)
  - `/estonian-sports/facilities` — 4,161 facilities (gym/pool/hall) by municipality
  - `/peatus/stops` — national bus/tram stop search
  - `/tallinn/transport/vehicles` — live bus positions
  - `/tallinn/parking-zones` — 209 zones (Tallinn/Tartu/Narva/Pärnu)
  - `/tallinn/districts` — 8 linnaosad (population + area)
  - `/tallinn/data/query?table=…` — Tallinn universal open-data
  - `/maaamet/search` and `/maaamet/reverse` — Maa-amet ADS geocoder
  - `/estonian-stats/browse` — Statistikaamet PxWeb mirror
  - `/estonian-utilities/{electricity,heating,water,gas}` — utility rates
  - ... 124 more
- **Sample:** `curl "https://nordapi.ee/api/v1/tallinn/parking-zones/nearby?lat=59.437&lng=24.745&radius=1.0"`
- **Join key:** `WGS84 (lat,lng)` for most, `?county=…` for filtered endpoints
- **Tier:** 🟢🟢🟢 essential
- **Action:** add `/api/nordapi/[...path]` proxy in vordlus, call from each column

### 2. OSM Overpass — universal POI distance queries
- **URL:** `https://overpass-api.de/api/interpreter` (also `overpass.kumi.systems`)
- **Auth:** none · **Rate limit:** public server ~30 k users/day, queries <10s; self-host for production
- **Format:** POST `data=…` → OSM XML/JSON
- **Estonia coverage:** high (Maa-amet ADS import performed 2023)
- **Sample (gyms within 1 km of Tallinn center):**
  ```bash
  curl -X POST https://overpass-api.de/api/interpreter \
    --data-urlencode 'data=[out:json][timeout:25];
      (node["leisure"="fitness_centre"](around:1000,59.437,24.745);
       node["sport"="gym"](around:1000,59.437,24.745););
      out tags center;'
  ```
- **Covers:** MyFitness (leisure=fitness_centre / sport=gym), Pood (shop=supermarket / convenience), Kool (amenity=school / kindergarten), Park (leisure=park)
- **License:** ODbL (`© OpenStreetMap contributors`)
- **Join key:** WGS84
- **Gotcha:** rural coverage is spotty — always show "n/POI within 5 km" instead of "no data"
- **Tier:** 🟢🟢🟢 essential

### 3. Peatus.ee / Ühistranspordiregister GTFS — national transit
- **URL:** `https://www.transit.land/feeds/f-ud-jarvamaa` (Transitland mirror) · raw GTFS via Transpordiamet
- **Auth:** none · **Format:** GTFS zip
- **Estonia coverage:** all counties (Bolt, Lux Express, ATKO, ELRON, TLT)
- **Sample:** `curl -O https://eu-gtfs.remix.com/tallinn.zip && unzip`
- **Use:** Ühistransport column — nearest stop, route count, daytime frequency
- **License:** CC0
- **Tier:** 🟢🟢🟢 essential

### 4. EHIS avaandmed — school registry
- **URL:** `https://enda.ehis.ee/avaandmed/`
- **Auth:** none once granted · access via `ehis.tugi@hm.ee` (email request, 1–3 day turnaround)
- **Format:** CSV/Excel/XML
- **Coverage:** every Estonian school — name, reg code, address, language, level, student count, teacher count, owner
- **Quality proxy:** language, level, student/teacher ratio, state vs municipal
- **License:** free for non-commercial, commercial needs permission
- **Join key:** address text → Maa-amet ADS reverse-geocode → WGS84
- **Tier:** 🟢🟢🟢 essential (only school-quality source)

### 5. Maa-amet orthophoto WMS — real building photos
- **URL:** `https://kaart.maaamet.ee/wms/fotokaart?service=WMS&version=1.3.0&request=GetMap&layers=of10000&…&srs=EPSG:4326`
- **Auth:** none · **License:** free + attribution + capture date
- **Resolution:** ~16 cm GSD
- **Use:** render the building's ADS polygon, snap the WMS tile, output clipped JPEG. Replaces SVG illustrations.
- **Combine with:** `https://kaart.maaamet.ee/wms/aadressid` — building polygon layer (121k buildings)
- **Tier:** 🟢🟢🟢 essential

### 6. Maa-amet huvipunktid (POI) WFS — official POI catalog
- **URL:** `https://gsavalik.envir.ee/geoserver/maaamet/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=huvipunktid&outputFormat=application/json`
- **Auth:** none · **Rate limit:** 5000 features/query (paginate)
- **Format:** OGC WFS 2.0.0 / GeoJSON
- **Use:** backup to Overpass, more authoritative for Estonian-language POI types
- **License:** free, attribution to Maa-amet
- **Join key:** WGS84
- **Tier:** 🟢🟢 useful (backup)

### 7. Maa-amet Flood Hazard Areas WMS — flood risk
- **URL:** metadata `https://metadata.geoportaal.ee/geonetwork/srv/api/records/e2d8796a-5f13-4856-aa0e-c368e7767f8d` → WFS at `gsavalik.envir.ee/geoserver/maaamet/wfs`
- **Auth:** none · **Format:** WMS / WFS / point-in-polygon
- **Source:** EU Floods Directive (2007/60/EU) deliverable
- **Use:** Üleujutuse risk column — does this property sit in a 100-year flood zone?
- **Tier:** 🟢🟢🟢 essential (only authoritative source)

### 8. Eesti Geoloogiateenistus — radon risk
- **URL:** `https://www.egt.ee/en/fields-activity-and-objectives/geology-and-environment/natural-radon-risk`
- **WMS via:** `https://gsavalik.envir.ee/geoserver/egt/ows`
- **Auth:** none · **License:** free, attribution
- **Use:** Radooni risk column — North Estonian Klint = high radon; south = lower
- **Gotcha:** municipal-level resolution
- **Tier:** 🟢🟢🟢 essential (only free source)

### 9. PLANK (planeeringud.ee) — upcoming developments
- **URL:** `https://planeeringud.ee/plank-web/#/planning` (web); NordAPI `/estonian-plans` (JSON)
- **Auth:** none · **Format:** JSON
- **Coverage:** 17,420 detailplaneeringud (read-only since 28.12.2025)
- **Use:** "Planeeringu radar" — a new 8-storey apartment planned 240 m away is a price-shifting signal
- **Join key:** WGS84 point-in-polygon
- **Tier:** 🟢🟢🟢 essential (killer retention feature)

### 10. Maa-amet regular land valuation 2022 (HTRARU substitute)
- **URL:** `https://www.kataster.ee/avaandmed` · actual `maks_hind` field comes from the `kinnistu` table
- **Auth:** none · **Format:** REST/JSON via `ky.kataster.ee`
- **Use:** "Maksustamisväärtus" — your best per-address AVM proxy
- **Join key:** `ads_oid` (perfect join with vordlus's existing record)
- **Gotcha:** It's the 2022 valuation, not a live price
- **Tier:** 🟢🟢🟢 essential

---

## 10 more sources (Tier 2)

| # | Source | URL | Use | Tier |
|---|---|---|---|---|
| 11 | **NordAPI utilities** | `nordapi.ee/api/v1/estonian-utilities/{electricity,heating,water,gas}` | monthly cost estimate | 🟢🟢 |
| 12 | **NordAPI monuments** | `nordapi.ee/api/v1/estonian-monuments?county=…` | heritage zone flag | 🟢🟢 |
| 13 | **Tallinn TPR** | `https://www.tpr.tallinn.ee/` (web) | Tallinn detailplaneeringud | 🟢 nice |
| 14 | **Tartu YP2040** | `https://gis.tartulv.ee/arcgis/rest/services/IT/YP2040_Maakasutus_ja_Ehitus_avaandmed/FeatureServer` | Tartu general plan 2040 | 🟢🟢 |
| 15 | **Statistikaamet PxWeb** | `https://andmed.stat.ee/api/v1/en/...` | demographic overlay | 🟢🟢 |
| 16 | **Tallinn avaandmed** | `https://avaandmed.tallinn.ee/data/?table=…` | Tallinn universal | 🟢🟢 |
| 17 | **parkimine.ee** | `https://www.parkimine.ee` | Tallinn parking zones (raw) | 🟢 nice |
| 18 | **TLT live vehicles** | `https://nordapi.ee/api/v1/tallinn/transport/vehicles` | real-time bus | 🟢 nice |
| 19 | **Tartu Observatory** | `https://kosmos.tartu.ee` | satellite / environmental | 🟢 nice |
| 20 | **Konkurentsiamet NER** | `https://services3.arcgis.com/JRDYwqPPUAnbbdBO/arcgis/rest/services/NER/FeatureServer/15` | district heating zones | 🟢🟢 |

## 10 more (Tier 3 — verify first)

| # | Source | Use | Status |
|---|---|---|---|
| 21 | EHIS avaandmed (Excel files) | school quality | request via email |
| 22 | OSRM `osrm.tallinn.ee` | isochrone from property to POIs | public OSRM instance |
| 23 | Statistikaamet spatial data | 1 km² population grid | INSPIRE WFS |
| 24 | Spordiregister | direct source for 4161 facilities | `spordiregister.ee` |
| 25 | EEA noise fact sheet | national noise baseline | PDF only |
| 26 | Transpordiamet strategic noise | per-road noise | PDF only |
| 27 | Kriminaalpoliitika annual | national crime rate | PDF only |
| 28 | Justiitsministeerium statistika | maakond crime | interactive dashboard |
| 29 | TÜ radon study 2022 | validation dataset for radon | PDF |
| 30 | Estiq AVM | real €/m² AVM (commercial) | paid |

---

## v2 quick-win features

1. **"Elukvaliteedi sõrmejälg"** — replace the deterministic `scoreLifestyle` hash with a real 5-axis radar chart from OSM Overpass POI counts (cafés × 0.5, schools × 2, transit × 3, gyms × 1, parks × 1.5, noise-debuff −1, heritage +0.5). Two different apartments would actually differentiate. ~3–4 days.
2. **"Planeeringu radar"** — fires when a property is within 500 m of a kehtiv detailplaneering from PLANK. Single-line "Uus 8-korruseline elamu plaanitakse 240 m kaugusele" creates immediate value differentiation. ~2 days with NordAPI.
3. **"AVM-ribakood"** — show the property's regular-land-valuation taxable value (€) on a logarithmic scale, color-coded against the median € for its omavalitsus. ~1 day (data is in the proxy we already run).
4. **Split-view Mapbox/MapLibre + Maa-amet orthophoto** — drop two addresses as pins, side-by-side. Add 500 m transit/walkability isochrone via osrm.tallinn.ee. ~1 week; biggest UX upgrade.
5. **"Green mortgage score" card** — energy class + district heating utility rate from NordAPI + monthly kWh/m² estimate. Output: green-amber-red "rohelaenu sobivus" badge. ~2 days; zero new sources.

---

## Implementation order

**Sprint 1 (1–2 weeks) — "Real estate + transit":** NordAPI, OSM Overpass, Peatus GTFS, parking zones via NordAPI
**Sprint 2 (1 week) — "Real photos + green mortgage":** Maa-amet orthophoto + aadressid WMS → clipped building photo, regular land valuation join
**Sprint 3 (1–2 weeks) — "Quality-of-life overlays":** EELIS WFS, EGT radon, EHIS avaandmed
**Sprint 4 (best effort) — "AVM & history":** Maa-amet htraru web summary (coarse), Maa-amet regular valuation 2022 (per-address)

---

## Sources
- https://nordapi.ee/docs/estonia (137 endpoints, all JSON, no auth)
- https://wiki.openstreetmap.org/wiki/Overpass_API
- https://enda.ehis.ee/avaandmed/EHIS_avaandmed.pdf
- https://geoportaal.maaamet.ee/eng/services/public-wms-wfs-p346.html
- https://metadata.geoportaal.ee/geonetwork/srv/api/records/e2d8796a-5f13-4856-aa0e-c368e7767f8d (flood)
- https://www.egt.ee/en/fields-activity-and-objectives/geology-and-environment/natural-radon-risk
- https://planeeringud.ee/plank-web/ (17,420 plans)
- https://www.kataster.ee/avaandmed (regular land valuation)
- https://eu-gtfs.remix.com/tallinn.zip (TLT GTFS)
- https://geoportaal.maaamet.ee/est/ruumiandmed/kinnisvara-tehingute-andmebaas-p81.html (HTRARU access restriction)
- https://estiq.ee/en/about (commercial AVM)
- https://github.com/rstats-tartu/datasets (R scripts that pointed us to htraru's old AJAX endpoint)
