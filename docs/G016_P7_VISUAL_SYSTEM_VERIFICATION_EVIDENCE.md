# G016 P7 Visual System Verification Evidence

Date: 2026-08-31

Scope: frozen V4 Visual Grammar verification only. P0-P6 were supplied as
confirmed. P8 was not entered. No Resolver, Page Data, Composer, media binding,
Scarlet Skips, or G017 work was performed.

## 1. Frozen visual rules checked

- Game Utility UI: task surface first, with native data/interaction forms.
- Neutral Dark base with Adaptive Game Accent.
- No permanent Docs Sidebar on Answer Surfaces; Hero remains optional.
- Whole-surface interaction for navigation and choice surfaces.
- Reading Density for procedures/explanation and Utility Density for data/tools.
- Functional evidence/media takes precedence over decoration.
- Mobile preserves the primary task and removes desktop chrome.
- No raw JSON, universal generic Primitive card, or debug fallback on product
  surfaces.

Canonical references used: `V4_VISUAL_EVIDENCE_BASELINE.md`,
`V4_PAGE_EXPERIENCE_REFERENCE.md`, `V4_PRIMITIVE_VISUAL_GRAMMAR.md`,
`V4_DISCOVERY_MOBILE_REFERENCE.md`, and `P7_VISUAL_SYSTEM_RESEARCH_REVISION.md`.

## 2. Clean-room Emberfall surface results

The six calibration surfaces were inspected in the clean-room screenshot pack
at `artifacts/g016-v4-cleanroom-final/`, desktop and mobile variants.

| Surface | Desktop | Mobile | Result |
| --- | --- | --- | --- |
| Homepage | compact identity, Start Here, task continuation, browse grid | one-column task list, compact top bar/menu | task-first discovery; no docs layout |
| P1 Entity | identity image, quick answer, grouped facts, next task | image and critical facts remain first; facts stack | native entity surface |
| P4 How-to | requirements, numbered steps, adjacent evidence, recovery | one-column steps and touch-readable evidence | native procedure surface |
| P5 Location | location facts, wide map canvas, marker result, route | full-width map and stacked facts/route | map remains the answer surface |
| P7 Mechanics | context, formula panel, calculator inputs/result | formula variables stack; calculator inputs stack | utility surface remains prominent |
| P9 Tool | bordered workspace, controls/save/share, filter/sort/table | workspace/actions first; table remains controlled overflow | planner/workspace remains primary |

The implementation uses `src/v4/visual-system.css`,
`src/v4/visual-system.ts`, `src/v4/page-composer.ts`,
`scripts/v4/standalone/pages/`, and `src/components/v4/SemanticPrimitive.astro`.

## 3. Responsive and hierarchy checks

- Mobile retains page/task identity, answer content, map, formula/calculator,
  workspace actions, and result state.
- Mobile CSS explicitly stacks facts, formulas, calculator inputs, comparison
  surfaces, and navigation; table surfaces retain horizontal overflow instead
  of squeezing columns into unreadability.
- Header and breadcrumb precede the answer header; contextual navigation is
  compact and there is no permanent documentation rail.
- TOC is conditional and only appears when the page has enough section targets;
  it does not replace the page hierarchy.
- `dist/v4-preview` HTML spot checks show one answer header and one native core
  surface per sampled page. No raw JSON, `primitive-card`, Starlight, or debug
  text was found in the product HTML/source scan.

## 4. Screenshot evidence qualification

The clean-room full-page JPEGs contain repeated lower segments on several long
pages. This is a capture artifact: the corresponding generated HTML contains
each sampled semantic node exactly once (for example one `.v4-facts`, one
`.v4-next`, one `.v4-steps`, one `.v4-map`, one `.v4-formula`, or one
`.v4-workspace`). No duplicate DOM nodes or duplicate renderer loop were found,
so no visual grammar or implementation change was made for this artifact.

The earlier calibration revision captures provide clean first-viewport visual
evidence for P1, P4, P5, P7, and P9 under
`artifacts/v4-calibration-revision/`.

## 5. Tests

Passed:

```text
npx tsx --test tests/v4/*.test.ts
42 passed
npm run test:v4:standalone
2 passed
git diff --check
```

`npm run check` was not used as a P7 acceptance result because the current
workspace still has unrelated pre-existing TypeScript errors in G016 artifact
scripts, `src/g017/research-package-adapter.ts`, and
`src/pages/v4-preview/category.astro`.

## 6. Files changed

No visual implementation files were changed in this review. This evidence file
is the only new P7 review artifact.

## 7. Current remaining P7 defect

No visual or responsive regression was established in the standalone DOM/source
or the clean calibration first viewports. The clean-room full-page screenshot
pack still has a capture-quality defect (repeated lower segments), which makes
those files unsuitable as exact single-render proof until recaptured. P7 is not
declared PASS here, and the review stops at P7.
