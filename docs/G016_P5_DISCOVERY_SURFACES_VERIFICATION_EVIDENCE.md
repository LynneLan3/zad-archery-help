# G016 P5 Discovery Surfaces Verification Evidence

Date: 2026-08-31

Scope: Homepage, Search, and Category discovery data wiring only. P0-P4 were supplied as externally confirmed. No P6-P9, Product Acceptance, Scarlet Skips, or G017 work was performed.

## 1. Data flow

The generator reads `site-input/v4-example/site.json`, resolves each page, and emits `generated.pages`, `generated.homepage.pageIds`, and `generated.navigation`.

For the standalone generated site:

- Homepage reads `generated.homepage.pageIds`, resolves those IDs against `generated.pages`, and derives hot/continue/browse sections from the resulting page objects.
- Search builds its index directly from `generated.pages`; query filtering is client-side over generated title, task type, query, and player problem.
- Category reads generated navigation groups, resolves `pageId` against `generated.pages`, and filters groups with no resolved pages.

The current `/v4-preview/` routes use the same generated data source. The preview Homepage was repaired to use `generated.homepage.pageIds` and generated navigation rather than positional `generated.pages` slices. The preview Category was repaired to resolve and filter real pages per navigation group.

`src/v4/discovery-surfaces.ts` contains generic discovery helpers, but the actual Astro product routes consume the generated site object directly; this verification follows the actual route wiring.

## 2. Clean-room Emberfall result

Input: `site-input/v4-example/site.json`.

- Generated pages: 11.
- Homepage page IDs: all 11 generated page IDs, ordered by generator priority output.
- Search entries: 11; each entry corresponds to a generated page and has an internal page href.
- Category groups: 4 non-empty groups.
- Navigation group page IDs: all resolve to generated pages.
- Existing clean-room output: `dist/index.html`, `dist/search/index.html`, and `dist/category/index.html` exist.
- Internal links in those three discovery documents: no broken internal hrefs detected.
- Legacy `/starter/`, `/getting-started/`, or legacy scaffold text: not detected.

Raw result: `artifacts/g016-p5-verification/cleanroom-output.json` and `discovery-flow.json`.

## 3. Sparse-site result

A generated sparse fixture with exactly three pages (`s1`, `s2`, `s3`) was passed through the current generator.

- Homepage: exactly those 3 page IDs; Start Here/continue contains the remaining 2 pages; Browse contains only the 3 navigation-linked pages.
- Search: exactly 3 entries.
- Category: exactly 1 non-empty group containing the same 3 page IDs.
- Navigation: all referenced page IDs exist in the generated page set.
- Emberfall/example fallback: absent.
- No extra fixture or legacy page was introduced.

Raw input/output: `artifacts/g016-p5-verification/sparse-site.json`.

## 4. Hardcoded fixture scan

Scanned:

- `src/pages/v4-preview.astro`
- `src/pages/v4-preview/search.astro`
- `src/pages/v4-preview/category.astro`
- `scripts/v4/standalone/pages/index.astro`
- `scripts/v4/standalone/pages/search.astro`
- `scripts/v4/standalone/pages/category.astro`

Results after repair:

- Emberfall literal: not found.
- Example Game literal: not found.
- Known fixture page IDs: not found.
- Positional homepage fallback (`generated.pages[0]` / `generated.pages.slice`): not found.
- Homepage empty-section guards: present.
- Category empty-group guard: present.
- All six discovery route files read generated data.

Test fixtures may contain names such as `Fixture Game`; those are test inputs, not product route constants.

Raw scan: `artifacts/g016-p5-verification/hardcoded-scan.json`.

## 5. Changes made

- `src/pages/v4-preview.astro`: switched Homepage hot/continue sections to generated homepage ordering and Browse to generated navigation-linked pages; added empty-section guards.
- `src/pages/v4-preview/category.astro`: changed Category to generated navigation groups resolved against generated pages and filtered empty groups.
- `artifacts/g016-p5-verification/run-p5-verification.ts`: added reproducible clean-room and sparse-site verification runner.

No Resolver, Page Data, Primitive, Composer, Visual Grammar, Scarlet Skips, or G017 files were changed.

## 6. Tests

Existing discovery tests:

```text
tsx --test tests/v4/discovery-surfaces.test.ts
```

Verification runner:

```text
tsx artifacts/g016-p5-verification/run-p5-verification.ts
```

The runner records generated Emberfall flow, clean-room output, sparse-site output, and hardcoded scan results. JSON parsing and `git diff --check` were also run successfully.

No P6 or later test suite was run.

## 7. Current P5 defect

The previously found preview Homepage positional/static section wiring and preview Category empty-group behavior were repaired. No additional discovery data-wiring defect was found in this focused verification. Browser visual acceptance and later phases were intentionally not checked.

