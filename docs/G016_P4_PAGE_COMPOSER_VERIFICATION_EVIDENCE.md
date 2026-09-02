# G016 P4 Page Composer Verification Evidence

Date: 2026-08-31

Scope: P4 Page Composer only. P0-P3 were supplied as externally confirmed. No P5-P9, Product Acceptance, Scarlet Skips, or G017 work was performed.

## 1. Entrypoint and call chain

Composer entrypoint:

`src/v4/page-composer.ts::composePage(page: PageData): ComposedPage`

Observed generator chain:

`site-input/v4-example/site.json` → `scripts/v4/generate-v4.ts::generateV4` → `resolveIntent` → `createPageData` → `composePage` → `src/pages/v4-preview/[...page].astro` → `SemanticPrimitive.astro`

The Composer consumes `page.intent.prototype`, `page.primitiveRecipe`, `page.primitiveData`, and usable assets. It does not call Resolver, create facts, or create payloads. The call-chain evidence is in `artifacts/g016-p4-verification/composer-scan.json`.

## 2. Composer responsibilities verified

- Prototype-specific primitive ordering is defined in `ORDER_BY_PROTOTYPE`.
- Only Page Data instances whose recipe status is `include` reach composition.
- Conditional/unsupported omission is already reflected in Page Data and no empty section is created by Composer.
- Repeated instances are retained through `renderIncludedPrimitives` and preserve instance IDs/payloads.
- Composer does not re-infer Prototype; it reads the resolved Prototype from Page Data.
- Composer does not generate facts or payloads; it passes Primitive views to the renderer.
- `showHero` is derived from usable page assets; it is not a required section.

## 3. P1-P10 Emberfall composition evidence

The runner selected one real fixture page per Prototype, preferring the page with the fullest primitive input when two pages shared a Prototype:

| Prototype | Emberfall page | Input instances → composed order |
|---|---|---|
| P1 | ember-core | A01 → A02 → E01 → N01 |
| P2 | ember-catalog | A01 → E02 → X01 → X02 → E03 |
| P3 | class-choice | A01 → S02 → D01 → D03 |
| P4 | forge-guide | A01 → P01 → P02 → P04 → N01 |
| P5 | marsh-map | A01 → L01 → L02 → L03 |
| P6 | ashfall-progression | A01 → P03 |
| P7 | heat-system | A01 → A03 → X03 → X04 |
| P8 | season-meta | A01 → S01 → S03 → S04 → D02 → D01 |
| P9 | armory-db | A01 → X05 → X01 → X02 → E03 |
| P10 | ashfall-calendar | A01 → S03 → S04 → N01 |

The complete input `instanceId` and output `instanceId` mapping is preserved in `artifacts/g016-p4-verification/prototype-compositions.json`. All 10 frozen Prototype IDs had a real Emberfall page and a non-generic composition.

## 4. Focused Prototype order

- P3 Comparison: header → platform state → comparison → choice matrix.
- P4 How-to: header → requirements → ordered steps → recovery → next task.
- P5 Location: header → location facts → map → route. The runner uses `marsh-map`, not the separate no-map fixture.
- P6 Progression: header → progress sequence; optional steps/recovery are absent rather than fabricated.
- P7 Mechanics: header → task context → formula → calculator.
- P9 Tool: header → workspace/planner → filter → sort → entity table.

These orders come from the Prototype recipe, not from page IDs or fixture-specific branching.

## 5. Omit and repeated-instance behavior

Focused omit case: unsupported `L02` produced a composed list containing only `L01`; no empty map section, null, or placeholder was emitted.

Focused repeated-instance case: two `E01` instances, `facts-a` and `facts-b`, both survived composition with independent payloads and instance IDs.

Evidence: `artifacts/g016-p4-verification/omit-and-repeat.json`.

## 6. Hardcoded fixture layout check

No Emberfall page IDs occur in `src/v4/page-composer.ts`. The Composer contains no fixture-specific branch, payload construction, JSON serialization, or generic Article layout. Static scan results:

- fixture IDs found in Composer: 0
- generic Article layout: false
- Prototype re-inference in Composer: false
- payload generation in Composer: false

Evidence: `artifacts/g016-p4-verification/composer-scan.json`.

## 7. Repair made

`src/v4/page-composer.ts` was changed to explicitly include `N01` in the P1 order recipe. Resolver P1 can emit `N01`; previously it was ordered only through the generic unknown-item fallback. The repair makes the P1 recipe explicit and keeps the related next task at the end of the P1 composition.

`tests/v4/page-composer.test.ts` was updated only to provide the required Page Data page identity introduced in P2, so the existing Composer tests can execute.

No Resolver, Page Data implementation, Primitive renderer, Visual Grammar, Scarlet Skips, or G017 files were modified.

## 8. Tests

Command:

```text
tsx --test tests/v4/page-composer.test.ts
```

Result: 2/2 passed.

Verification runner:

```text
tsx artifacts/g016-p4-verification/run-p4-verification.ts
```

Result: 10 Prototype compositions, 10 covered; omit case retained only L01; repeated case retained both `facts-a` and `facts-b`.

`git diff --check` passed.

## 9. Current P4 defect

No remaining Composer defect was found in this focused verification after the explicit P1 `N01` recipe repair. Browser rendering, visual acceptance, discovery surfaces, and later phases were intentionally not checked.

