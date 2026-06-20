# ADR 0002: Agent-Guided Market Intelligence Architecture

## Status

Proposed

## Date

2026-06-20

## Context

The current product direction is a real estate listing comparison and market analysis platform. The
team brief describes a web app where buyers can compare listings with relevant scores and data, with
an initial emphasis on first-time property buyers. It also includes a later business-side direction:
sellers, brokers, and agencies may upload listings, buy packages, and receive listing analytics.

The technical direction needs to avoid being a generic AI wrapper. The system should show technical
depth through data ingestion, normalization, duplicate detection, market benchmarks, listing
comparison, and explainable scoring.

The core architecture question is how the AI agent should interact with listing data without making
search slow, expensive, or biased toward only the user's current query result set.

## Decision

Use a market intelligence architecture where the agent operates on top of a stored, normalized, and
precomputed market data layer.

The agent should not evaluate listings only against the current search results. It should evaluate
against broader stored market segments, comparable listings, historical events, duplicate groups,
and official/open data where available.

The system should separate search scope from evaluation scope:

- Search scope: the candidate listings returned by classic filters or AI-assisted search.
- Evaluation scope: the wider stored market dataset used for benchmarks, comparables, scores, and
  explanations.

The AI agent should be used for orchestration and explanation, while scoring, comparable selection,
duplicate detection, and market metrics should be deterministic or statistical modules where
possible.

## Architecture Shape

```text
Data sources and open datasets
  -> raw snapshots and source metadata
  -> source adapters and normalization
  -> canonical listing database
  -> duplicate groups and listing events
  -> market segments and benchmarks
  -> comparable sets and market scores
  -> classic search and AI-assisted search
  -> automatic listing intelligence report
  -> agent-guided analysis and explanation
```

## Interaction Model

### Classic Search

Classic search should stay fast and predictable:

- filters over normalized structured data;
- location and map queries;
- sorting by price, price per square meter, freshness, and score;
- listing cards with precomputed score badges and key metrics.

### AI-Assisted Search

AI-assisted search should be a separate mode or clearly distinct experience. It can parse natural
language intent into filters and semantic search terms, then retrieve a limited candidate set.

The agent should not reason over the whole database at query time. It should query typed backend
tools that return candidates and market context.

### Listing Click

When a user opens a listing, the system should automatically generate or refresh a detailed listing
intelligence report. The user should not need to ask the agent for the first useful analysis.

The report should include:

- realistic pricing score;
- overall market score;
- comparable listing evidence;
- duplicate listing evidence;
- location and lifestyle/context signals;
- price history and market movement where available;
- listing completeness and data confidence;
- explanations for each score.

### Agent-Guided Analysis

The agent can support deeper tasks such as:

- evaluated search;
- comparing selected listings;
- explaining why a listing is overpriced or underpriced;
- showing duplicate-listing mismatches;
- generating buyer-facing or seller-facing reports.

This agentic workflow can be implemented with a graph-based orchestration framework such as
LangGraph, but the core data and scoring logic should remain behind typed backend tools.

## Data Storage Decision

Store enough data to support comparison, trends, duplicate detection, scoring, auditability, and
user-facing explanations.

Store:

- normalized active listings;
- historical listing events;
- source timestamps and source references;
- price changes and status changes;
- duplicate groups and match reasons;
- market segment aggregates;
- comparable candidates;
- listing scores and score inputs;
- media metadata, image hashes, and extracted image features;
- raw snapshots where legally and operationally appropriate.

Do not use live portal/API calls as the only source for analytics. Live calls can support ingestion,
freshness checks, or source linking, but comparison and scoring require a stored market dataset.

Images and raw media should live in object storage or equivalent media storage. The database should
store references, hashes, metadata, extracted tags, and feature signals rather than large binary
media.

## Market Segments

Market segments are the main defense against biased scoring. A listing should be evaluated against
its relevant market segment, not just against the user's current search results.

Example segment:

```text
Tallinn / Kesklinn / apartment / sale / 2 rooms / 40-60 m2
```

Each segment can maintain:

- median price;
- median price per square meter;
- percentile bands;
- active supply;
- median time on market;
- price-reduction frequency;
- liquidity score;
- data confidence.

## AI And Model Strategy

Use different model capabilities for different tasks:

- small or cheap model for query parsing and summaries;
- embedding model for semantic search over descriptions and extracted features;
- vision model asynchronously during ingestion for image tags and condition signals;
- stronger reasoning model for detailed report explanation or multi-listing analysis;
- deterministic/statistical code for scoring, comparables, duplicate detection, and benchmarks.

AI should explain and orchestrate. The system should compute.

## Consequences

- Search remains fast because heavy metrics are precomputed or cached.
- Listing reports can be rich because they use stored market context.
- Scores are more defensible because they are based on broader market segments, not only visible
  search results.
- The project demonstrates technical depth through the market data layer.
- The team must prioritize data acquisition, normalization, and storage before advanced agent
  behavior becomes useful.
- Legal and terms-of-service constraints for source data must be decided before building ingestion
  beyond demo fixtures or approved sources.

## Open Follow-Up Decisions

- Which listing sources are allowed for the first demo?
- Should the demo use live ingestion, seeded snapshots, or a hybrid dataset?
- Which user path is primary for the hackathon: first-time buyer comparison or seller/agency
  analytics?
- Which market score inputs are feasible in the first version?
- Which official/open datasets are available for Estonian market baselines?
- Which data retention rules apply to raw listing snapshots and media?
