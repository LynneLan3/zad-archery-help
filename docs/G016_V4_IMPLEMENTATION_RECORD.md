# G016 V4 Implementation Record

This record tracks implementation evidence for the isolated V4 boundary. It
does not define a new gate or lifecycle system.

## Status

- P0 Clean Boundary: COMPLETE / FROZEN
- P1 Intent Resolver + Page Intent Contract: COMPLETE / FROZEN
- P2 Page Data Contract: COMPLETE / FROZEN
- P3 Primitive Implementation: COMPLETE / FROZEN
- P4 Page Composer: COMPLETE / FROZEN
- P5 Discovery Surfaces: COMPLETE / FROZEN
- P6 Asset / Media Binding: COMPLETE / FROZEN
- P7 Visual System: COMPLETE / FROZEN
- P8 V4 Generator Pipeline: COMPLETE / FROZEN
- P9 Artificial Fixture / Example Game Full Coverage: COMPLETE / FROZEN
- V4 Site Shell / Navigation System: COMPLETE / FROZEN
- G016: COMPLETE / PRODUCT ACCEPTED / V4 INPUT FROZEN
- Product Acceptance: COMPLETE — clean-room standalone Emberfall manual
  screenshot review accepted; P0–P9 are complete.
- G017: P1–P4 COMPLETE / P5 RESUMED / PRODUCTION LIVE / RUNTIME PENDING

## P1 evidence

- `src/v4/intent-contract.ts` defines the V4 Resolver Input/Output boundary,
  P1–P10 Prototype vocabulary, player-task vocabulary, and primitive decisions.
- `src/v4/intent-resolver.ts` exposes independently testable
  `resolvePrimaryTask`, `resolvePrimaryPrototype`, `buildPrimitiveCandidates`,
  and `resolvePrimitiveActivation` stages, with the frozen precedence.
- The 44 Winner evidence is explicitly split between taxonomy mapping and
  resolver inference regression; no unsupported task inference is fabricated.
- `src/v4/primitives.ts` exposes exactly the frozen 26 IDs. Unsupported map,
  ranking, calculator, filter, and planner candidates omit without blocking.
- Validation: `npx tsx --test tests/v4/*.test.ts` — 34 passed.

## P2 evidence

- `src/v4/page-data-contract.ts` emits the frozen PageData boundary with
  `pageDataVersion`, `page`, `state`, `primitiveData`, `evidence`, and `media`.
- Primitive instances require `instanceId`, `primitiveId`, typed payload,
  `evidenceRefs`, and `mediaRefs`; duplicate instances are supported and only
  resolved `include` instances serialize.
- Evidence and media registries are separate, and all 26 payload contracts have
  explicit TypeScript shapes plus required-field coverage.
- Legacy `behavior/data` is input-only fixture compatibility and is not emitted.
- Validation: P2 contract, registry, omission, conditional, and duplicate
  instance tests pass in `npx tsx --test tests/v4/*.test.ts`.

## RUN B calibration evidence

- `src/components/v4/SemanticPrimitive.astro` is the product renderer boundary;
  it renders native semantic forms for the calibration primitive set. The raw
  renderer is isolated under `src/pages/v4-debug/`.
- `src/v4/page-composer.ts` supplies ordering, grouping, omission, density, and
  evidence/media adjacency for product composition without re-resolving intent.
- `src/pages/v4-preview.astro` is a priority-driven product Homepage, and
  `src/pages/v4-preview/[...page].astro` serves the five calibration page types.
- `src/v4/visual-system.css` provides reading and utility density plus mobile
  task-first layouts; it does not turn every primitive into the same card.
- `artifacts/v4-calibration/` contains 1440x1000 and 390x844 screenshots,
  per-page metadata, and the calibration summary.
- Validation: `npx tsx --test tests/v4/*.test.ts` — 32 passed;
  `npx astro check` — 0 errors, 0 warnings.

## P5 evidence

- `src/v4/discovery-surfaces.ts` keeps Homepage, Search, and Navigation
  Category as separate discovery surfaces, sorts Homepage by research
  priority, and preserves P2 as an answer-hub candidate.
- Search filters the indexed Emberfall fixture with keyboard `/` focus; Category
  exposes grouped high-value child tasks and remains distinct from P2.

## P6 evidence

- `src/v4/media-binding.ts` binds functional media by task, prioritizes map,
  entity, and step evidence over decorative media, and reports unsupported map
  data without blocking the location page.
- Validation: `npx tsx --test tests/v4/*.test.ts` — 34 passed;
  browser checks confirm marker, calculator, planner, and mobile overflow behavior.

## P7 evidence

- `src/v4/visual-system.ts` and `src/v4/visual-system.css` define Neutral Dark,
  Adaptive Game Accent, optional Hero, functional-evidence-first ordering, and
  no permanent Docs Sidebar.
- Validation: `npm run check` — 0 errors; `npm run build` — 53 static pages;
  26 final viewport screenshots captured.

## P8 evidence

- `scripts/v4/generate-v4.ts` is the deterministic V4-only pipeline from JSON
  input through Resolver, Page Data, task media binding, and Composer output.
- Validation: `npx tsx --test tests/v4/*.test.ts` — 34 passed;
  `npm run build` — pass; `git diff --check` — pass.

## P9 evidence

- `site-input/v4-example/site.json` is an independent artificial Emberfall
  fixture with Homepage/Search/Category and full P1–P10 surfaces plus the
  retained no-map case.
- `src/v4/generated/example-site.json` was produced only by
  `scripts/v4/generate-v4.ts`.
- Product Preview implements native state, entity grid/table, comparison,
  ranking, choice matrix, progression, calendar, and the retained
  facts/requirements/steps/location/tool forms. No generic renderer fallback
  is used.
- Final interaction validation covers actual filter result changes, sort order
  changes, map marker selection, calculator recomputation, and planner local
  save/share behavior. Full results are recorded in the calibration summary.

## Current handoff

RUN A — Contract Correction and RUN B full expansion are complete. The final
V4 Site Shell confirmation is recorded under
`artifacts/v4-shell-regression-final/`. Product Acceptance was completed from
the clean-room standalone Emberfall manual screenshot pack; P0–P9 are complete
and the V4 input boundary is frozen. G017 P5 is unblocked; the remaining
blocker is Scarlet Skips Runtime Sync / Ledger OAuth scope. No G017 P5
implementation is performed by this record.

## Calibration revision evidence

- Product-facing labels no longer expose Prototype IDs, task taxonomy, or
  implementation names; the debug renderer remains isolated under
  `src/pages/v4-debug/`.
- Entity media is rendered beside the Ember Core identity, generic evidence
  notes were removed, and P4 evidence/media are attached to Step 2.
- P9 composition now places the Current Build workspace and Save/Share actions
  before the supporting armory filter, sort, and table.
- `artifacts/v4-calibration-revision/` contains the six revised desktop/mobile
  captures and per-page metadata.
- Status: `PRODUCT_ACCEPTED / V4 INPUT FROZEN`.

## Frozen G016 → G017 interfaces

1. `src/v4/intent-contract.ts` — V4 Resolver Input Contract
2. `src/v4/intent-contract.ts` — P1–P10 Prototype vocabulary
3. `src/v4/primitives.ts` — 26 Primitive vocabulary
4. `src/v4/page-data-contract.ts` — Page Data Contract
5. `src/v4/media-binding.ts` — Media Role / Asset Binding vocabulary
6. `scripts/v4/generate-v4.ts` — V4 Generator input/output boundary

Navigation is recorded separately as a Generator / Site Shell stable input
capability. It is defined at `src/v4/navigation.ts`, consumed through the
Generator boundary, and exercised by `site-input/v4-example/site.json`. It
supports dynamic primary navigation, category hierarchy, optional secondary
groups, page ownership by `pageId`, active-state resolution, breadcrumb
hierarchy, Search as a global utility, and conditional page-local TOC support.

## Final confirmation

- Intent Resolver: PASS
- Page Data Contract: PASS
- 26 Primitives: FROZEN
- P1–P10 Prototypes: FROZEN
- Semantic Renderer: PASS
- Visual Grammar: FROZEN
- Homepage / Search / Category: PASS
- P1–P10 Full Coverage: PASS
- Desktop / Mobile: PASS
- Site Shell: PASS
- Six G016 → G017 interfaces: FROZEN

## Product Acceptance closure

- Clean-room standalone Emberfall manual screenshot acceptance: COMPLETE.
- Accepted: Homepage, Search, Category, P1–P10 canonical pages, desktop/mobile
  shell, media/no-media, omission behavior, and functional utility surfaces.
- G016: `COMPLETE / PRODUCT ACCEPTED / V4 INPUT FROZEN`.
- P0–P9: COMPLETE.
- `New Sites Default → V4` remains outside G016 and remains BLOCKED under G017.

## G017 P1 handoff

- Research Package → V4 Resolver Input adapter: COMPLETE
- Adapter: `src/g017/research-package-adapter.ts`
- Fixtures: `site-input/research/g017-p1-artificial-emberfall.json` and
  `site-input/research/g017-p1-missing-optional.json`
- G017 P2 remains NOT_STARTED. G017 P5 is resumed for the real production
  lifecycle, with the current blocker limited to Scarlet Skips Runtime Sync /
  Ledger OAuth scope. No G017 P5 implementation was performed here.
