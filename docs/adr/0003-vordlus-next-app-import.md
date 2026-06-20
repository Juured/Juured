# 0003. Import Vordlus Next.js Application

Date: 2026-06-20

## Status

Accepted

## Context

The Juured repository foundation reserved product boundaries for applications and services without
creating empty directories. The Vordlus comparison product already exists in `Juured/Vordlus` as a
Next.js application with a companion scraping service for listing photos.

## Decision

Import the Vordlus application into `apps/vordlus` and the scraping service into
`services/vordlus-scrape`. Keep the existing repository README, governance files, CI, and
documentation structure intact.

Add root Vercel configuration so the monorepo can build the Next.js app from `apps/vordlus`.

## Consequences

- The target repository keeps its existing foundation and now has real product code inside the
  documented boundaries.
- Vercel can build the imported Next.js app from the monorepo using `vercel.json`.
- The scraping service remains deployable separately for environments that need listing-photo
  extraction outside Vercel edge IPs.
- Root repository verification continues to focus on foundation files while app-specific checks stay
  inside `apps/vordlus` and `services/vordlus-scrape`.
