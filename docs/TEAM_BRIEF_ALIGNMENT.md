# Team Brief Alignment

This note compares the current team brief with the existing technical/data direction in the
repository. It should be replaced or refined after the structured project brief is finalized.

Source reviewed: team-provided `Hack Goals.txt`.

## Brief Summary

The team brief describes:

- a property listing comparison web app;
- a demo focused on listing comparison, lifestyle/context map data, business customers, packages,
  listing upload, and analytics;
- competitors across Estonia, Latvia, and Lithuania, including listing portals and analytics
  products;
- first-time property buyers as the hackathon's primary user focus;
- a buyer pain point where current Baltic listing sites act mostly as catalogs and do not help users
  compare listings or draw conclusions from data;
- a desired comparison table with relevant scores;
- neighborhood/lifestyle map context around selected properties;
- a seller/broker/agency business side with paid listing upload and listing performance analytics;
- a broader company vision of modern technical real estate portals in the Baltic countries.

## Alignment With Current Technical Direction

The brief strongly supports the current data-intelligence architecture.

| Team brief direction          | Current repository direction                                      | Alignment  |
| ----------------------------- | ----------------------------------------------------------------- | ---------- |
| Listing comparison tool       | Explainable listing comparison and market analytics               | Strong     |
| First-time buyers             | Buyer-facing decision support and realistic pricing explanations  | Strong     |
| Data-backed scores            | Market score, pricing score, completeness, liquidity, comparables | Strong     |
| Lifestyle/context map         | Location/context signals and map-based comparison                 | Strong     |
| Seller analytics              | Later B2B analytics around listing performance and demand         | Compatible |
| Baltic market                 | Estonia-first, Baltic-aware normalization and market intelligence | Strong     |
| Existing portals are catalogs | Differentiate through analysis, not just listing discovery        | Strong     |

## Tensions Or Conflicts

### Buyer Focus Versus Seller Business Model

The hackathon focus is first-time buyers, but the business model in the brief includes sellers,
brokers, agencies, paid listing upload, packages, and analytics.

This is not a contradiction, but it needs sequencing:

1. Build buyer-facing comparison and market intelligence first.
2. Use buyer demand, listing views, comparison behavior, and market scores as future seller/broker
   analytics.
3. Avoid trying to build a full paid listing portal before the comparison/analytics value is proven.

### Portal Vision Versus Aggregation/Comparison

The company vision mentions building modern real estate portals in the Baltics. The current
technical direction is closer to a market intelligence and listing comparison layer.

This should be clarified:

- Is Juured initially a portal where sellers upload listings?
- Is it initially an intelligence layer over existing portals?
- Or is it a hybrid: compare existing market listings first, then add direct listing upload later?

For technical depth and speed, the recommended first version is the hybrid path with comparison and
analytics first, direct listing upload later.

### Lifestyle Map Scope

Lifestyle/context mapping is valuable, but it can grow too broad. It should be tied to buyer
decisions:

- commute and public transport;
- schools or childcare if relevant;
- grocery and daily services;
- green areas and noise/context where data exists;
- neighborhood liquidity and price trends.

Avoid making lifestyle mapping a generic map layer without connection to listing evaluation.

## Recommended Product Spine

For the hackathon and early architecture, frame the product as:

> A Baltic real estate comparison and market intelligence platform that helps first-time buyers
> evaluate listings using structured market data, comparable properties, location context, and
> explainable scores.

This keeps the buyer pain point clear while leaving room for seller analytics later.

## Recommended MVP Scope

The first version should focus on:

1. Estonia-first listing comparison.
2. Classic filter search plus optional AI-assisted search.
3. Listing comparison table.
4. Automatic listing intelligence report on listing click.
5. Overall market score and realistic pricing score.
6. Duplicate-listing detection as a data quality and comparison feature.
7. Map/location context tied to buyer decision-making.
8. Stored market dataset with normalized listings and comparable segments.

Defer:

- full seller listing upload;
- paid packages;
- broker dashboard;
- broad Baltic multi-country ingestion;
- advanced image analysis unless there is time after the data layer works.

## Technical Additions To Consider

### Data Products

- `canonical_listing`
- `listing_event`
- `duplicate_group`
- `market_segment`
- `area_benchmark`
- `comparable_set`
- `listing_score`
- `listing_report`
- `lifestyle_context`

### Scores

- overall market score;
- realistic pricing score;
- listing completeness score;
- duplicate confidence score;
- liquidity/supply score;
- lifestyle/context score;
- future growth potential score, if the team can define defensible inputs.

### Report Sections

An automatic listing report could include:

- price and price-per-square-meter comparison;
- comparable listings;
- duplicate listing findings;
- neighborhood/lifestyle map context;
- market movement and time-on-market;
- strengths, risks, and missing data;
- confidence level and data sources.

## Open Decisions

- Is direct listing upload part of the hackathon demo or a future business path?
- Which buyer score categories are mandatory for the first demo?
- What data sources are legally and practically available?
- Which location/lifestyle datasets can be used in Estonia first?
- Is the first demo one city, one listing type, and one transaction type?
- How much seller/agency analytics should be shown before there is real seller-side data?
