# Competitive Context

This note captures early market context before the structured project brief is written.

## Current Project Direction

Working understanding as of 2026-06-20:

- The project is expected to focus on real estate market analysis and listing comparison.
- The first market focus is Estonia, with a broader Baltic direction.
- The project should demonstrate technical depth rather than present as a generic AI wrapper.
- The structured project brief is still pending and should supersede this note where it is more
  specific.

## Competitor Snapshot: One Place

Source reviewed: <https://one-place.com/> and public linked pages on 2026-06-20.

One Place positions itself as an AI-powered European real estate search engine. Its public site
emphasizes broad aggregation, natural-language search, visual search, duplicate listing unification,
saved searches, boards, and future assistant/workspace features.

Observed public claims vary across pages, which is worth noting rather than treating the numbers as
canonical:

| Page                 | Public claim observed                                           |
| -------------------- | --------------------------------------------------------------- |
| Home page            | 3.8M listings, 350+ portals, 18 countries                       |
| Features page        | 16 European markets, 3.6M active listings, 201M property images |
| Explore page         | 18 markets, 3,227,575 active listings                           |
| Estonia explore page | 26,229 total properties, 21,515 for sale, 4,714 for rent        |
| Latvia explore page  | 23,148 total properties, 17,089 for sale, 6,059 for rent        |
| Explore country list | Estonia 29,791, Latvia 21,581, Lithuania 7,692                  |

### One Place Feature Themes

- Aggregates property listings across many European sources.
- Converts duplicate portal listings into one canonical property result.
- Supports natural-language search for budgets, neighborhoods, property types, and subjective
  preferences.
- Uses listing text and images to search for details such as materials, style, amenities, room
  features, views, and surroundings.
- Normalizes budgets across currencies.
- Offers saved searches, favorites, boards, and sharing.
- Mentions future features such as style-search uploads, a conversational AI agent, and a real
  estate agent workspace.

## Competitive Implications

One Place is competing on breadth and consumer-facing AI search. It appears optimized for a global
or pan-European discovery experience: search everything, merge duplicates, save favorites, and use
language or images instead of portal filters.

That makes a direct "AI property search across many listings" pitch weak unless we can show a
different wedge.

## Recommended Differentiation

The stronger direction is Baltic depth rather than global breadth.

Potential wedge:

- Estonia-first and Baltic-aware market intelligence.
- Listing comparison built around decision support, not just discovery.
- Explainable pricing and listing-quality signals.
- Local market normalization across languages, portals, municipalities, districts, property types,
  energy labels, renovation states, legal/ownership indicators, and source-specific quirks.
- Transparent data lineage: where each listing came from, when it changed, what was normalized, and
  why two listings are considered comparable or duplicate.

## Technical Depth To Emphasize

Ruum has signaled that technical depth matters more than generic AI wrapper behavior. The project
should therefore make the non-LLM system visible.

Good technical depth candidates:

1. **Data ingestion pipeline**
   - Source adapters per portal or data feed.
   - Raw snapshot storage.
   - Change detection for price, status, description, photos, and availability.
   - Structured extraction into a normalized listing schema.

2. **Entity resolution and duplicate detection**
   - Match the same property across portals or agencies.
   - Use address hints, coordinates, floor/area/room counts, price, image fingerprints, and text
     similarity.
   - Produce confidence scores and explainable match reasons.

3. **Market normalization**
   - Normalize property type, area, rooms, floor, condition, energy class, location hierarchy,
     ownership/rental status, and price per square meter.
   - Handle Estonian/Baltic naming, spelling, language, and unit differences.

4. **Comparison engine**
   - Compare candidate listings against local comparable properties.
   - Surface outliers, price reductions, stale listings, missing fields, and suspiciously duplicated
     entries.
   - Make comparisons reproducible, not only generated text.

5. **Market analytics**
   - District-level price distributions.
   - Price-per-square-meter bands.
   - Time-on-market and price-change history.
   - Supply by property type, location, and listing status.

6. **AI as an interface layer, not the core**
   - Use AI for query parsing, summarization, and explanation.
   - Keep ranking, deduplication, valuation signals, and comparisons as testable deterministic or
     statistical modules.
   - Show intermediate artifacts so judges can inspect the system.

## Candidate Metrics And Signals

These are strong product ideas to preserve for the structured project brief. They make the platform
useful for buyers, analysts, brokers, and other real estate decision-makers because they turn raw
listings into comparable evidence.

### Listing Comparison Metrics

- Overall listing market score.
- Realistic pricing score: how well the asking price matches comparable market evidence.
- Price per square meter.
- Deviation from comparable listings.
- District or neighborhood benchmark.
- Similar-property price band.
- Listing completeness score.
- Missing or suspicious field indicators.
- Energy class comparison.
- Renovation or condition signal.
- Floor, building age, room count, area, and property-type normalization.
- Rent-versus-sale yield where rental data exists.
- Local supply/liquidity: how many similar listings are active nearby.

### Overall Market Score

The platform should consider an overall score for each listing that summarizes whether the listing
looks attractive, realistic, overpriced, underpriced, risky, stale, or incomplete based on available
data.

Potential score inputs:

- Comparable listings in the same location and property segment.
- Price per square meter versus local distribution bands.
- Recent price changes and price-reduction history.
- Time on market compared with similar listings.
- Duplicate-listing evidence across portals or agencies.
- Listing completeness and source freshness.
- Energy class, renovation state, building age, floor, room count, and area normalization.
- Local supply/liquidity for similar properties.
- Rental yield or investor signal where rental data exists.

The score should be explainable. Users should see the reasons behind the score, such as "priced 11%
above similar active listings nearby," "stale compared with local median time on market," or
"duplicate source shows a lower asking price."

### Market Movement Metrics

- Price-change history.
- Time on market.
- Reposted listing detection.
- Price-reduction frequency.
- Status changes such as active, reserved, removed, rented, or sold when observable.
- Supply by district, property type, room count, and listing status.
- Price-per-square-meter distribution bands over time.

### Duplicate Listing Detection As A Feature

Duplicate listings should not only be treated as a data-cleaning problem. They can become a useful
comparison signal.

If the same property appears across multiple portals or agencies, the system can compare:

- Price differences between duplicate listings.
- Description differences.
- Photo differences.
- Agency or broker differences.
- Timestamp and freshness differences.
- Whether one source has more complete data than another.
- Whether a duplicate was reposted or relisted after a price change.

This creates a defensible product advantage: the platform can explain that two or more listings are
likely the same property, show why they were matched, and use the duplicates to improve confidence
in price, availability, and listing quality.

Good duplicate-matching signals:

- Address hints and normalized location.
- Coordinates or map area.
- Area, floor, room count, and building details.
- Price and price-per-square-meter similarity.
- Image fingerprints or perceptual image similarity.
- Text similarity across titles and descriptions.
- Broker, agency, or contact patterns.
- Listing timestamps and reposting behavior.

## Early Product Framing

Avoid:

- "AI property search" as the only claim.
- A chatbot over listings.
- Generic favorites/boards as the main differentiator.
- Broad Europe-wide claims without data depth.

Prefer:

- "Baltic real estate market intelligence."
- "Explainable listing comparison for Estonia-first property decisions."
- "A normalized, auditable market layer over fragmented Baltic real estate data."
- "AI-assisted search and explanation on top of a real data pipeline."

## Open Decisions

- Which Estonian data sources are in scope for the demo?
- Are we analyzing sale listings, rental listings, or both?
- Which user is primary: buyer, investor, broker, analyst, or municipality/planner?
- What is the first technical proof point: ingestion, deduplication, price comparison, or market
  analytics?
- Will the demo use live scraping, seeded snapshots, or a hybrid fixture dataset?
- What legal and terms-of-service constraints apply to source data?
