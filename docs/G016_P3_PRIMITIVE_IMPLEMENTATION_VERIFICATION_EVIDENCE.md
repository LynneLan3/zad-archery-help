# G016 P3 Primitive Implementation Verification Evidence

Date: 2026-08-31

Scope: P3 26 Primitive implementation only. P0-P2 were supplied as externally confirmed. No P4 or later phase, Scarlet Skips, or G017 work was performed.

## Formal P3 basis

The frozen plan requires the renderer basis to be:

`Primitive semantics → native task representation → V4 visual grammar`

The product renderer must not use `JSON.stringify(payload)`, raw `<pre>`, a generic Primitive fallback, or one universal bordered-card treatment. The `/v4-debug/` surface is separate and was not evaluated as the product renderer.

## Renderer path

The semantic product component is:

`src/components/v4/SemanticPrimitive.astro`

The Page Data-to-view adapter is:

`src/v4/primitives.ts::renderPrimitive` and `renderIncludedPrimitives`

The product route consumes the composed Primitive views through:

`src/pages/v4-preview/[...page].astro` → `SemanticPrimitive.astro`

The renderer component has an explicit semantic branch for each of the 26 frozen IDs. Static scan results are in `artifacts/g016-p3-verification/implementation-scan.json`.

## 26 Primitive mapping

| ID | Implementation branch | Semantic output |
|---|---|---|
| A01 | `SemanticPrimitive.astro` A01 branch | answer header with title, task context, subject, optional identity media |
| A02 | A02 branch | quick-answer aside, qualifier, evidence note, next action |
| A03 | A03 branch | scoped context aside with caveat and conditions |
| S01 | S01 branch | version state value and applicability |
| S02 | S02 branch | platform state with option controls |
| S03 | S03 branch | season state, options, and calendar events |
| S04 | S04 branch | freshness/update semantic output |
| E01 | E01 branch | fact card using `dl` fact rows |
| E02 | E02 branch | entity collection grid with links and count |
| E03 | E03 branch | semantic HTML table with columns and rows |
| D01 | D01 branch | comparison matrix by options, dimensions, and cells |
| D02 | D02 branch | ordered ranking list with methodology |
| D03 | D03 branch | scenario/choice matrix |
| P01 | P01 branch | requirements list with status and how-to-meet text |
| P02 | P02 branch | ordered step sequence with results and evidence/media refs |
| P03 | P03 branch | milestone/progress sequence with status and next step |
| P04 | P04 branch | failure symptom, cause, and recovery blocks |
| L01 | L01 branch | location facts for area, coordinates, landmark, and access |
| L02 | L02 branch | map surface with media, marker buttons, and selected-marker output |
| L03 | L03 branch | ordered route sequence from start through waypoints to destination |
| X01 | X01 branch | filter control connected to page row filtering behavior |
| X02 | X02 branch | sortable-data control connected to table row sorting behavior |
| X03 | X03 branch | formula expression, variables, and worked example |
| X04 | X04 branch | calculator inputs and result output connected to calculation behavior |
| X05 | X05 branch | planner controls, result output, local save, and share action |
| N01 | N01 branch | related next-task navigation links |

The 26 cases use real minimal payloads, pass through `createPageData`, then through `renderPrimitive`. Optional arrays are empty in the cases to exercise non-crashing degradation. Results: 26/26 view objects returned and 26/26 component branches found. Raw JSON and `<pre>` fallback scan: none. Generic fallback count: 0.

Machine-readable evidence: `artifacts/g016-p3-verification/primitive-render-cases.json`.

## Functional Primitive spot checks

- D01: consumes `options`, `dimensions`, and `cells`; the renderer resolves each displayed cell by `optionId` plus `dimensionId` and emits desktop/mobile comparison structures.
- P02: consumes ordered `steps`; emits an ordered list and conditionally resolves step-level result, evidence, and media references.
- L02: consumes map source and markers; emits marker controls and a selected-marker result. `selectMapMarker` returned the requested marker.
- X01: emits a filter control; the route behavior filters rendered table rows by query. `filterPrimitiveRows` returned only the matching row in the focused case.
- X04: emits numeric inputs and a result output; the focused calculator behavior returned `14` for base `2`, rate `3`, duration `4`.
- X05: emits planner controls plus save/share controls and a result output; `togglePlannerSlot` added and removed the selected slot as expected. The route uses local storage for save and clipboard/share behavior.

The six cases and their actual native shapes/behavior evidence are in `artifacts/g016-p3-verification/functional-primitive-cases.json`.

## Repair made

`src/v4/primitives.ts` was repaired so `renderIncludedPrimitives` passes the selected instance into `renderPrimitive`. Previously, repeated instances with the same `primitiveId` could all resolve to the first matching Page Data instance. The repair is limited to Primitive instance rendering and does not change Resolver, Page Data, Composer ordering, visual grammar, or frozen vocabulary.

Regression coverage was added to `tests/v4/primitives.test.ts` for two `E01` instances with independent payloads.

## Tests

Command:

```text
tsx --test tests/v4/primitives.test.ts tests/v4/interactive.test.ts
```

Result: 6/6 passed, including the repeated-instance regression and the focused filter/calculator/map/planner behavior test.

Verification runner:

```text
tsx artifacts/g016-p3-verification/run-p3-verification.ts
```

Result: 26 render cases, 26 rendered; 26 semantic branches; 6 functional cases recorded.

## Current P3 defect

No additional unimplemented/generic-fallback Primitive was found in this implementation scan. The repaired repeated-instance wiring was the confirmed defect in the inspected Primitive implementation. Full browser/visual/product acceptance was intentionally not performed because it belongs outside this P3-only review scope.

