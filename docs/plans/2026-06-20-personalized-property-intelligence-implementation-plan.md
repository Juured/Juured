# Personalized Property Intelligence Implementation Plan

<!-- markdownlint-disable MD001 MD036 -->

> **For Agent:** Use executing-plans skill to implement this plan task-by-task.

**Goal:** Build a typed, deterministic intelligence core for homebuyer and investor profiles before
connecting additional external data sources.

**Architecture:** Add a source-independent `intelligence` module under the Vordlus application.
Existing source routes will later adapt into normalized evidence. Scores, confidence, hard-risk
rules, personalization and chart view models remain pure functions with fixture-driven tests.

**Tech Stack:** TypeScript, Vitest, Next.js 15, React 18 and schema validation using the project's
selected validation dependency when implementation starts.

---

### Task 1: Define Evidence And Metric Contracts

**Files:**

- Create: `apps/vordlus/src/lib/intelligence/types.ts`
- Create: `apps/vordlus/src/lib/intelligence/__tests__/types.test.ts`

**Step 1: Write the failing test**

Test that a normalized evidence fact distinguishes observed, calculated and inferred data and
requires source, timestamp, confidence and warnings.

**Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- --run src/lib/intelligence/__tests__/types.test.ts
```

Expected: fail because the intelligence contracts do not exist.

**Step 3: Implement the contracts**

Define:

- `EvidenceFact<T>`;
- `EvidenceKind`;
- `EvidenceSource`;
- `MetricResult`;
- `ScoreDimension`;
- `ConfidenceBreakdown`;
- `IntelligenceWarning`.

Keep these as serializable data contracts without framework dependencies.

**Step 4: Run the test to verify it passes**

Run the same focused test and expect all assertions to pass.

**Step 5: Commit**

```bash
git add apps/vordlus/src/lib/intelligence
git commit -m "feat(intelligence): define evidence contracts"
```

### Task 2: Define Homebuyer And Investor Profiles

**Files:**

- Create: `apps/vordlus/src/lib/intelligence/profiles.ts`
- Create: `apps/vordlus/src/lib/intelligence/__tests__/profiles.test.ts`

**Step 1: Write the failing tests**

Cover:

- supported profile types are `homebuyer` and `investor`;
- default weights sum to one;
- user priorities adjust weights within declared bounds;
- mandatory risk dimensions cannot receive zero weight;
- the result includes human-readable weight reasons.

**Step 2: Run the focused test**

Expected: fail because profile policy functions do not exist.

**Step 3: Implement profile policies**

Add:

- onboarding preference types;
- default profile weights;
- bounded priority adjustments;
- normalized final weights;
- `WeightReason[]`.

**Step 4: Verify the focused tests**

Expected: pass.

**Step 5: Commit**

```bash
git add apps/vordlus/src/lib/intelligence
git commit -m "feat(intelligence): add buyer profile policies"
```

### Task 3: Implement Confidence Calculation

**Files:**

- Create: `apps/vordlus/src/lib/intelligence/confidence.ts`
- Create: `apps/vordlus/src/lib/intelligence/__tests__/confidence.test.ts`

**Step 1: Write failing tests**

Cover:

- source reliability;
- freshness;
- field coverage;
- comparable count and similarity;
- contradiction penalties;
- inferred-evidence penalties;
- output clamped between zero and one.

**Step 2: Run the focused test**

Expected: fail.

**Step 3: Implement a pure confidence calculator**

Return both the confidence value and a breakdown so the UI and agent can explain it.

**Step 4: Verify tests**

Expected: pass.

**Step 5: Commit**

```bash
git add apps/vordlus/src/lib/intelligence
git commit -m "feat(intelligence): calculate evidence confidence"
```

### Task 4: Implement Non-Compensating Risk Rules

**Files:**

- Create: `apps/vordlus/src/lib/intelligence/riskRules.ts`
- Create: `apps/vordlus/src/lib/intelligence/__tests__/riskRules.test.ts`

**Step 1: Write failing tests**

Cover initial rules:

- 100-year flood zone caps environmental safety;
- high radon plus basement dwelling emits a mandatory warning;
- permit contradiction caps legal consistency and overall confidence;
- area mismatch reduces confidence;
- weak comparables cap valuation confidence;
- lower-priced fresh duplicate emits a pricing warning.

**Step 2: Run the focused test**

Expected: fail.

**Step 3: Implement versioned rules**

Each rule returns:

- rule ID and version;
- trigger evidence;
- dimension cap or confidence cap;
- mandatory warning;
- manual-review requirement.

**Step 4: Verify tests**

Expected: pass.

**Step 5: Commit**

```bash
git add apps/vordlus/src/lib/intelligence
git commit -m "feat(intelligence): enforce material risk rules"
```

### Task 5: Calculate Objective And Personalized Scores

**Files:**

- Create: `apps/vordlus/src/lib/intelligence/scoring.ts`
- Create: `apps/vordlus/src/lib/intelligence/__tests__/scoring.test.ts`

**Step 1: Write failing tests**

Cover:

- objective dimension scores remain identical across user profiles;
- homebuyer and investor suitability differs only through policy weights;
- missing dimensions are excluded and remaining weights renormalized;
- hard caps apply after weighted calculation;
- output includes contribution and weighting explanations.

**Step 2: Run the focused test**

Expected: fail.

**Step 3: Implement score aggregation**

Return:

- objective dimensions;
- objective summary;
- personalized suitability;
- contribution by dimension;
- applied caps;
- confidence;
- explanation inputs.

**Step 4: Verify tests**

Expected: pass.

**Step 5: Commit**

```bash
git add apps/vordlus/src/lib/intelligence
git commit -m "feat(intelligence): add personalized scoring"
```

### Task 6: Define Registered Visualization View Models

**Files:**

- Create: `apps/vordlus/src/lib/intelligence/visualizations.ts`
- Create: `apps/vordlus/src/lib/intelligence/__tests__/visualizations.test.ts`

**Step 1: Write failing tests**

Validate allowed component names, versioned payloads, data references, confidence and component-
specific fields. Reject arbitrary component names and inline executable content.

**Step 2: Run the focused test**

Expected: fail.

**Step 3: Implement the discriminated view-model union**

Start with:

- estimated value distribution;
- price/m² histogram;
- price history;
- ownership-cost breakdown;
- lifestyle bars;
- environmental-risk matrix;
- confidence breakdown;
- profile-weight explanation.

**Step 4: Verify tests**

Expected: pass.

**Step 5: Commit**

```bash
git add apps/vordlus/src/lib/intelligence
git commit -m "feat(intelligence): define visualization contracts"
```

### Task 7: Build Deterministic Fixtures

**Files:**

- Create: `apps/vordlus/src/lib/intelligence/fixtures.ts`
- Create: `apps/vordlus/src/lib/intelligence/__tests__/fixtures.test.ts`

**Step 1: Write failing tests**

Create fixture scenarios for:

- strong first home with moderate price;
- high-yield investor property with higher maintenance risk;
- attractive location with flood risk;
- insufficient comparable evidence;
- duplicate listing with conflicting prices.

**Step 2: Run the focused test**

Expected: fail.

**Step 3: Implement fixtures using only explicit synthetic/demo evidence**

Fixtures must clearly identify that they are non-production examples.

**Step 4: Verify tests**

Expected: pass.

**Step 5: Commit**

```bash
git add apps/vordlus/src/lib/intelligence
git commit -m "test(intelligence): add scoring scenarios"
```

### Task 8: Create The Agent Evidence Package

**Files:**

- Create: `apps/vordlus/src/lib/intelligence/agentPackage.ts`
- Create: `apps/vordlus/src/lib/intelligence/__tests__/agentPackage.test.ts`

**Step 1: Write failing tests**

Assert that the package:

- contains normalized summaries and source references;
- contains metrics, confidence, risk rules and profile weights;
- contains only registered visualization view models;
- excludes raw database rows, secrets and executable UI code.

**Step 2: Run the focused test**

Expected: fail.

**Step 3: Implement the package builder**

Make the output JSON serializable and suitable for a future LangGraph tool result.

**Step 4: Verify tests**

Expected: pass.

**Step 5: Commit**

```bash
git add apps/vordlus/src/lib/intelligence
git commit -m "feat(intelligence): build bounded agent context"
```

### Task 9: Adapt Existing Demo Data

**Files:**

- Create: `apps/vordlus/src/lib/intelligence/fromCurrentData.ts`
- Create: `apps/vordlus/src/lib/intelligence/__tests__/fromCurrentData.test.ts`
- Modify: `apps/vordlus/src/lib/compareStore.ts`

**Step 1: Write failing adapter tests**

Map current:

- EHR;
- Cadastre;
- OSM lifestyle;
- transit;
- flood;
- radon;
- planning;
- listing enrichment

into the normalized evidence contract without changing existing UI behavior.

**Step 2: Run the focused test**

Expected: fail.

**Step 3: Implement the adapter**

Keep legacy score calculation active until the new outputs are displayed and compared.

**Step 4: Run focused tests, TypeScript and build**

```bash
npm run typecheck:app
npm run build:app
```

Expected: pass.

**Step 5: Commit**

```bash
git add apps/vordlus/src/lib/intelligence apps/vordlus/src/lib/compareStore.ts
git commit -m "feat(intelligence): adapt current property evidence"
```

### Task 10: Integrate Profile Onboarding And Score Presentation

**Files:**

- Create: `apps/vordlus/src/components/onboarding/ProfileOnboarding.tsx`
- Create: `apps/vordlus/src/components/intelligence/ProfileWeightExplanation.tsx`
- Modify: `apps/vordlus/src/app/page.tsx`
- Add focused component tests under `apps/vordlus/src/components/**/__tests__/`

**Step 1: Write failing interaction tests**

Cover:

- selecting homebuyer or investor;
- storing preferences;
- changing preferences;
- showing why weights changed;
- maintaining the same objective evidence across profiles.

**Step 2: Run focused tests**

Expected: fail.

**Step 3: Implement onboarding and explanation UI**

Use stable controls and existing application styles. Do not add the full graph dashboard in this
task.

**Step 4: Run tests, type checking and build**

Expected: pass.

**Step 5: Commit**

```bash
git add apps/vordlus/src
git commit -m "feat(vordlus): personalize property intelligence"
```

## Final Verification

Run:

```bash
npm run verify
npm run test:app
npm run typecheck:app
npm run build:app
```

Do not run visual browser automation unless explicitly requested by the user.
