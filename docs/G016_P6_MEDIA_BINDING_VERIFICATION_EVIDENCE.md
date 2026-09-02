# G016 P6 Asset / Media Binding Verification Evidence

Date: 2026-08-31

Scope: P6 media binding only. P0-P5 were supplied as confirmed. P7 and later
were not entered. Scarlet Skips and G017 were not modified.

## 1. Entrypoint and flow

The live V4 flow is:

`V4 input page asset candidates -> scripts/v4/generate-v4.ts -> bindTaskMedia()`
`-> createPageData() media registry -> PrimitiveInstance.mediaRefs ->`
`src/components/v4/SemanticPrimitive.astro renderer`

`bindTaskMedia()` removes unusable candidates, orders functional roles before
decorative media, and supplies task-specific support for entity and location
media. `createPageData()` emits the registry and filters instance refs to IDs
that exist in that registry. The renderer resolves refs through the registry;
it does not contain an Emberfall asset lookup or asset-name switch.

## 2. Frozen media roles

All six declared roles are accepted by the binding vocabulary and registry:
`hero`, `entity`, `map`, `step`, `evidence`, and `decorative`.

Observed product binding behavior is functional for `entity` (P1 header
identity media), `step` (P4 nested step media), and `map` (P5 map media).
`hero`, `evidence`, and `decorative` are registry-capable and ordered, but only
render when a Primitive supplies a valid ref; no renderer-side asset is guessed.
The P5 map and route capabilities are independently omitted when map support is
not available.

## 3. Focused cases

The focused cases are in `tests/v4/media-binding.test.ts` and all passed.

1. Valid media: `/v4/entity.svg` becomes `media-1` with the same localRef.
2. Shared media: two Primitive instances both retain `media-1`; the registry
   contains one entry.
3. Missing optional map: no assets are emitted, L02/L03 are unsupported, and
   Page Data remains constructible with the non-media location content.
4. Invalid/unsupported media: empty paths, non-HTTP(S) schemes, and candidates
   marked unusable are rejected before registry construction; no ref survives.

The previous hole was in the binding boundary: `usable: true` alone allowed an
empty or scheme-invalid path to reach the registry and potentially produce an
empty/broken `<img>` source. The minimal repair is in
`src/v4/media-binding.ts`; Page Data, Resolver, Composer, and Visual Grammar
were not changed by this repair.

## 4. Emberfall generated samples

The generated source is `src/v4/generated/example-site.json`, and the copied
public assets are under `public/v4/`.

| Page | Registry entry | Primitive ref | Output path | File exists |
| --- | --- | --- | --- | --- |
| P1 `ember-core` | `media-1`, role `entity` | A01 header -> `media-1` | `/v4/emberfall-core.svg` | yes |
| P4 `forge-guide` | `media-1`, role `step` | P02 `steps[1]` -> `media-1` | `/v4/emberfall-forge.svg` | yes |
| P5 `marsh-map` | `media-1`, role `map` | L02 map -> `media-1` | `/v4/emberfall-map.svg` | yes |

The standalone route `[...page].astro` passes each generated page to
`SemanticPrimitive`; its renderer reads `localRef`/`source` only from the
resolved registry entry.

## 5. Hardcoded and broken-reference scan

- No Emberfall literal or fixture asset switch was found in the binding,
  generator, or renderer source. Emberfall appears only in the artificial input,
  generated artifact, and public fixture assets.
- No fixture-only media path fallback exists in the generator or renderer.
- Missing refs are filtered by registry membership; missing optional media
  therefore omits the media element rather than emitting an empty `src`.
- The input-only legacy compatibility converter in
  `src/v4/page-data-contract.ts:66` still has a textual map-source fallback of
  `fixture`. It is not a media path and is not reached by the current generated
  asset path, but remains a residual bypass/legacy concern and was not changed
  because this review explicitly excludes Page Data contract changes.

## 6. Files changed in this P6 review

- `src/v4/media-binding.ts` — reject unusable, empty-path, and unsupported-scheme
  candidates before registry binding.
- `tests/v4/media-binding.test.ts` — add valid/shared/invalid binding coverage.
- This evidence document.

No Resolver, Page Data contract, Composer, Visual Grammar, Scarlet Skips, or
G017 file was changed.

## 7. Tests and evidence

Passed:

```text
npx tsx --test tests/v4/media-binding.test.ts tests/v4/page-data-contract.test.ts tests/v4/calibration-product.test.ts tests/v4/generator.test.ts
16 passed
npm run test:v4:standalone
2 passed
git diff --check
```

`npm run check` was attempted but remains blocked by pre-existing unrelated
TypeScript errors in `artifacts/g016-p1-verification`, `artifacts/g016-p2-verification`,
`artifacts/g016-p5-verification`, `src/g017/research-package-adapter.ts`, and
`src/pages/v4-preview/category.astro`; no error was reported in the changed
media-binding file.

Raw evidence paths:

- `src/v4/media-binding.ts`
- `scripts/v4/generate-v4.ts`
- `src/v4/generated/example-site.json`
- `src/components/v4/SemanticPrimitive.astro`
- `tests/v4/media-binding.test.ts`
- `tests/v4/calibration-product.test.ts`
- `public/v4/emberfall-core.svg`
- `public/v4/emberfall-forge.svg`
- `public/v4/emberfall-map.svg`

## 8. Current remaining P6 defect

The generator-bound P6 path has no remaining broken-asset case after the
minimal repair, based on the focused tests and generated P1/P4/P5 sample.
P6 is not declared PASS here. The remaining open concern is the legacy direct
`createPageData()` bypass: its input-only L02 fallback can still label a map
source as `fixture`, and direct callers can bypass `bindTaskMedia()`'s path
validation. Resolving that would require a Page Data contract change, which is
outside this review's authorized repair scope.
