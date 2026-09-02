# G016 P0 Verification Evidence

Date: 2026-08-31
Scope: V4 Clean Boundary Verification / Repair only

This is an evidence record, not a Phase verdict. It does not evaluate P1-P9,
visual quality, page content, or Product Acceptance.

## 1. V4-owned paths

The inspected V4 implementation is under:

- `src/v4/` — intent, page-data, primitive, composition, media, navigation,
  visual-system, and generated structured site data.
- `src/components/v4/` — V4 header, breadcrumb, and semantic primitive
  presentation components.
- `scripts/v4/generate-v4.ts` — structured input generation and standalone
  output assembly.
- `scripts/v4/standalone/` — standalone Astro config, package manifest,
  TypeScript config, and canonical page entrypoints.
- `site-input/v4-example/site.json` — structured V4 example input.
- `public/v4/` — V4 fixture assets.

`generateV4Standalone()` copies only the V4 component/runtime directories,
V4 assets, standalone config/package/tsconfig, standalone page entrypoints,
and generated JSON into the destination. It does not copy the repository's
legacy `src/pages`, `src/components`, Starlight config, or Markdown articles.

## 2. Reused shared infrastructure

The standalone output reuses only generic infrastructure needed to run/build
the site:

- Node `fs` and `path` in the generator for filesystem assembly.
- Astro runtime and TypeScript.
- `@astrojs/sitemap` for sitemap output.
- `@astrojs/check` for static checking.
- `sharp`, as declared by the standalone Astro dependency set.

The standalone Astro config contains only `defineConfig` and sitemap. The
repository's top-level Astro config still owns the historical site and uses
Starlight, but the V4 standalone path does not import or execute that config.

## 3. Legacy presentation dependencies found

No legacy presentation dependency was found in the inspected V4 runtime or
standalone generator:

- no import of `Article` or `ArticleLayout`;
- no import of Starlight or the top-level legacy Astro config;
- no import of legacy `src/pages` or non-V4 presentation components;
- no Markdown/MDX article is used as V4 page source of truth;
- no generated legacy article output is copied into the standalone destination.

The V4 contract contains an input-only `LegacyPrimitivePayload` compatibility
shape and an internal behavior-to-Primitive mapping. This is a V4-owned
structured-input compatibility path, not a dependency on the old Article
contract or old presentation runtime. The canonical example input is JSON and
the generated page data is structured JSON.

The example input uses `/v4-preview/` URLs as an input compatibility form.
`generateV4Standalone()` canonicalizes those values to `/`-rooted public URLs
before writing the standalone generated JSON. The clean-room output contains
no `/v4-preview/` references.

## 4. Dependency change / repair

No P0 legacy presentation dependency was confirmed, so no implementation
repair was made in this verification round.

The requested source-of-truth file
`V4_CLEAN_BOUNDARY_FROZEN.md` was not present under the inspected
`ai-work-rules` tree. The current G016 Goal and frozen development plan both
state the boundary and were used as the available documentation authority;
the missing file was not recreated or modified.

## 5. Clean-room isolation evidence

Clean-room path:
`/Users/lanling/Code/hot_words_websites/_g016-v4-cleanroom-emberfall`

Observed results:

- `npm ci --ignore-scripts`: completed successfully.
- `npm run check`: 0 errors, 0 warnings, 0 hints across 19 files.
- `npm run build`: completed successfully; 14 static pages emitted.
- Existing standalone generator regression: 2 tests passed, including empty
  destination generation, canonical URL conversion, absence of starter-like
  page files, and rejection of a non-empty destination.
- HTTP checks against the clean-room preview returned 200 for `/`, `/search/`,
  `/category/`, and `/ember-core/`; `/starter/`, `/getting-started/`, and
  `/v4-preview/` returned 404.
- Built output contains only the canonical V4 route set and V4 assets; no
  starter, getting-started, article, or v4-preview route was emitted.
- Clean-room source closure contains only V4 components, V4 modules, V4
  generated JSON, four V4 Astro page entrypoints, standalone config, and the
  standalone dependency manifest.

The clean-room build therefore exercises canonical routes directly from the
V4 runtime. It does not require the legacy Article runtime, legacy generated
articles, or `/v4-preview/` to run.

## 6. Not checked in this P0 record

- P1-P9 phase status or implementation quality.
- Product content correctness or visual acceptance.
- Responsive/product screenshot review.
- Resolver semantics, Page Data completeness, Primitive behavior, Composer
  behavior, Visual System, or G017 integration.
- Scarlet Skips and production/default cutover behavior.

## 7. Remaining P0 defects

No confirmed legacy presentation dependency remains from the inspected V4
implementation path. The absent `V4_CLEAN_BOUNDARY_FROZEN.md` is a source
documentation gap to keep visible for human review; it was not repaired in
this round because Frozen documents were not to be changed implicitly.
