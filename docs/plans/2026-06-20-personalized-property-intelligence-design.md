# Personalized Property Intelligence Design

## Status

Accepted for initial implementation.

## Goal

Create a source-independent intelligence layer that turns verified property and market evidence into
objective dimension scores, explicit risk warnings, profile-aware suitability scores, and
schema-validated visualization data.

The first supported profiles are:

- homebuyer;
- investor.

## Core Principle

The system computes; the agent explains and orchestrates.

The agent must not receive arbitrary database rows and invent a valuation. Deterministic or
statistical modules produce metrics, confidence, score effects, and evidence. The agent receives a
bounded evidence package and may explain conflicts, personalize the presentation, and select
registered visual components.

## Intelligence Pipeline

```text
Raw source records
  -> normalized facts with provenance
  -> validation and contradiction checks
  -> market segment selection
  -> comparable selection
  -> deterministic metrics
  -> independent dimension scores
  -> non-compensating risk rules
  -> objective market assessment
  -> profile-specific weighting
  -> personalized suitability
  -> chart view models
  -> agent explanation
```

## Fact Contract

Every normalized fact must carry:

- value and unit;
- source identifier;
- source record or URL reference where allowed;
- retrieval timestamp;
- observed, calculated, or inferred status;
- confidence from `0` to `1`;
- freshness or effective date;
- warnings and contradictions.

Missing information must remain missing. It must never be replaced with a neutral score or an
LLM-generated estimate unless the estimate is explicitly represented as inferred evidence.

## Score Dimensions

The platform calculates stable, objective dimensions before applying profile preferences:

| Dimension                  | Purpose                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| Pricing fairness           | Asking price versus weighted comparable and segment evidence       |
| Building quality           | Age, structure, condition, renovation and registered building data |
| Total cost of ownership    | Energy, heating, utilities and expected maintenance burden         |
| Location and accessibility | Transport, travel access and daily-service availability            |
| Lifestyle                  | Parks, restaurants, cafés, recreation, schools and local amenities |
| Environmental safety       | Flood, radon, noise, air and other location risks                  |
| Legal and data consistency | Permits, registry alignment and contradictory listing facts        |
| Liquidity                  | Supply, market time, turnover and likely resale difficulty         |
| Investment potential       | Yield, rental demand, growth signals and market movement           |
| Listing quality            | Completeness, freshness, media and source quality                  |
| Data confidence            | Coverage, freshness, source quality and comparable strength        |

Scores and confidence are separate. A listing can have a high score with low confidence.

## Known Data Universe

### Identity And Location

- normalized address and address hierarchy;
- ADS identifier;
- cadastral identifier;
- EHR building identifier;
- WGS84 coordinates;
- parcel and building geometry;
- city, municipality, district and neighborhood.

Sources: In-AKS, Cadastre, EHR and official geospatial datasets.

### Listing Facts

- asking price and price per square meter;
- sale or rental status;
- property type and subtype;
- area, rooms, floor and total floors;
- plot area, balcony, terrace, parking and storage;
- condition and renovation claims;
- description, photos and floor plan;
- broker, agency, portal and source URL;
- listing creation, update and source timestamps.

Sources: approved portal feeds, permitted ingestion, direct uploads and stored snapshots.

### Listing History And Duplicates

- first and last seen;
- days on market;
- price changes;
- removal, reservation, sale or rental signals;
- relisting and reposting;
- duplicate portal or agency records;
- price, description, media and freshness differences;
- duplicate confidence and match reasons.

Sources: stored listing snapshots and entity-resolution outputs.

### Market And Comparable Evidence

- weighted comparable set;
- comparable similarity and exclusion reasons;
- segment median, quartiles and percentiles;
- estimated market value and value range;
- deviation from comparables;
- active supply and new-listing rate;
- median market time and reduction frequency;
- district and neighborhood trends;
- rental asking levels and gross yield.

Sources: normalized listing warehouse, historical events, market segments, cadastral valuation and
licensed transaction data where available.

### Building And Parcel

- construction and first-use year;
- building type, materials and technical systems;
- net, gross and footprint area;
- floors and room count;
- energy class, certificate dates and energy intensity;
- heating type;
- parcel area and land purpose;
- ownership form and taxable value;
- usage permits and registry mismatches.

Sources: EHR and Cadastre.

### Ownership Cost

- modeled heating, electricity, water and gas cost;
- energy intensity;
- expected monthly utilities;
- maintenance and renovation-risk bands;
- green-mortgage eligibility indicators;
- financing and affordability inputs supplied by the user.

Sources: EHR, utility datasets, listing disclosures, provider tariffs and calculation models.

### Mobility And Daily Access

- nearest public-transport stops;
- route count and service frequency;
- travel time to saved destinations;
- walking, cycling and driving access;
- grocery stores, pharmacies and healthcare;
- parking zones and EV charging.

Sources: national GTFS and Peatus data, municipal transport data, OSM, official POIs and routing
services.

### Lifestyle And Education

- parks and green space;
- cafés and restaurants;
- gyms and sports facilities;
- cultural and recreational facilities;
- schools and kindergartens;
- school level, language and other legally usable quality indicators;
- waterfront and recreation access.

Sources: OSM Overpass, Maa-amet POIs, EHIS, sports registry and municipal open data.

### Environmental And External Risks

- 100-year and 1000-year flood zones;
- radon category;
- road, rail and aircraft noise where available;
- air quality and industrial proximity;
- power-outage exposure where meaningful;
- heritage or conservation restrictions;
- nearby hazardous or incompatible land use.

Sources: Maa-amet flood datasets, Estonian Geological Survey, environmental datasets, cultural
monument registry, municipal datasets and verified utility data.

### Planning And Future Signals

- nearby detail plans;
- planned building height and use;
- transport and infrastructure projects;
- district development activity;
- demographic and population movement;
- new construction supply;
- future service and school development.

Sources: PLANK, municipal planning systems, Statistics Estonia and official project datasets.

### Media-Derived Signals

- room and finish condition;
- visible damage or renovation indicators;
- natural-light and view indicators;
- kitchen and bathroom condition;
- floor-plan availability and extractable layout facts;
- perceptual image hashes for duplicate detection.

Sources: listing media, asynchronous computer-vision processing and human verification. Media
signals are inferred evidence and must never be presented as inspected facts.

### Data Quality

- missing required fields;
- stale source records;
- source reliability;
- listing-to-registry contradictions;
- duplicate agreement;
- comparable count and similarity;
- geographic resolution;
- model or inference uncertainty.

Sources: internal provenance, validation and monitoring systems.

Candidate sources must pass availability, licensing, terms-of-use and retention review before
production ingestion.

## Non-Compensating Risk Rules

Positive amenities must not average away material risks. Rules may:

- cap a dimension score;
- cap overall confidence;
- emit a mandatory warning;
- mark a listing as requiring manual review;
- exclude a listing from a specific recommendation.

Initial examples:

| Trigger                                      | Effect                                                        |
| -------------------------------------------- | ------------------------------------------------------------- |
| Property in a 100-year flood zone            | Cap environmental safety and show a mandatory warning         |
| High radon risk with basement-level dwelling | Cap environmental safety and request mitigation evidence      |
| Missing or contradictory usage permit        | Cap legal consistency and overall confidence                  |
| Material EHR/listing area mismatch           | Reduce confidence and flag manual review                      |
| Duplicate source has a lower current price   | Show pricing warning and use the freshest defensible evidence |
| Expired energy certificate                   | Reduce energy and TCO confidence                              |
| Too few or weak comparables                  | Cap valuation confidence                                      |
| Stale listing or uncertain availability      | Reduce freshness and liquidity confidence                     |

Rules must be versioned, testable and visible in the user-facing explanation.

## Personalization

Onboarding initially asks whether the user is a homebuyer or investor, followed by a small set of
decision-relevant questions:

- expected ownership period;
- household size and children;
- saved work or commute destinations;
- maximum purchase price and monthly ownership cost;
- renovation tolerance;
- environmental and legal risk tolerance;
- importance of transit, schools, quietness, restaurants and green space;
- accessibility needs;
- for investors: yield, appreciation and liquidity preference.

The objective evidence and scores remain unchanged between users. Personalization changes only:

- dimension weights;
- thresholds based on declared constraints;
- ordering and emphasis of insights;
- selected visualizations;
- recommendations and explanation language.

The response must include a weighting explanation such as:

> Total ownership cost received 24% weight because you selected first-home purchase, a strict
> monthly budget and low renovation tolerance.

Users must be able to inspect and change their preferences.

## Initial Profile Policies

### Homebuyer

Prioritizes:

- affordability and TCO;
- legal certainty;
- environmental safety;
- building quality;
- personalized mobility and lifestyle;
- long-term suitability.

### Investor

Prioritizes:

- pricing fairness;
- rental yield;
- liquidity;
- local demand and supply;
- appreciation signals;
- market and listing history.

Neither profile can override hard safety, legal or confidence rules.

## Agent Contract

The agent receives:

- normalized listing summary;
- metric results;
- confidence values;
- applicable risk rules;
- selected profile and policy weights;
- source references;
- allowed visualization view models.

The agent may:

- explain positive, negative and conflicting signals;
- compare listings;
- tailor emphasis to the user profile;
- select registered visualizations;
- ask for missing user preferences;
- identify when evidence is insufficient.

The agent may not:

- invent source facts;
- calculate an unsupported valuation;
- silently override score rules;
- hide material risks;
- generate arbitrary executable UI code.

## Visualization Contract

Charts are prebuilt, polished React components with smooth interaction and accessible reduced-motion
behavior. The agent selects a component and supplies a schema-validated view model.

Initial registered components:

- estimated-value distribution;
- comparable-property table;
- comparable price scatterplot;
- price-per-square-meter histogram;
- price-history timeline;
- ownership-cost breakdown;
- lifestyle category bars;
- environmental-risk matrix;
- market supply and liquidity trend;
- rental-yield comparison;
- data-confidence breakdown;
- map layer configuration;
- profile-weight explanation.

Example:

```json
{
  "component": "estimated_value_distribution",
  "version": 1,
  "title": "Estimated value range",
  "dataRef": "valuation.result.v1",
  "highlight": 204900,
  "confidence": 0.78
}
```

The view model references computed data. The agent does not provide chart coordinates, colors,
formulas or unverified values.

## Implementation Sequence

Do not wait for every data source.

1. Build evidence, metric, risk-rule, profile and visualization schemas.
2. Implement homebuyer and investor weighting with deterministic fixtures.
3. Implement confidence and non-compensating risk evaluation.
4. Build registered chart components against fixtures.
5. Connect current EHR, Cadastre, OSM, flood, radon, planning and listing-enrichment data.
6. Add each new source behind an adapter without changing the intelligence contract.
7. Add the agent after the deterministic package is stable.

This permits parallel work: data acquisition can continue while scoring and UI contracts are built
and tested.
