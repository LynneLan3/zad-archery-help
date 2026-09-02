# G016 V4 Final Preview

Status: `FINAL_PREVIEW_READY_FOR_USER_REVIEW`

Preview: `http://127.0.0.1:4321/v4-preview/`
Debug: `http://127.0.0.1:4321/v4-debug/`

## Discovery

- Homepage: `/v4-preview/`
- Search: `/v4-preview/search/`
- Navigation Category: `/v4-preview/category/`

## Prototype routes

- P1 Entity: `/v4-preview/ember-core/`
- P2 Catalog / Hub: `/v4-preview/ember-catalog/`
- P3 Choice / Comparison: `/v4-preview/class-choice/`
- P4 How-to: `/v4-preview/forge-guide/`
- P5 Location: `/v4-preview/marsh-map/`
- P6 Progression: `/v4-preview/ashfall-progression/`
- P7 Mechanics: `/v4-preview/heat-system/`
- P8 Meta / Recommendation: `/v4-preview/season-meta/`
- P9 Tool: `/v4-preview/armory-db/`
- P10 Planning / Calendar: `/v4-preview/ashfall-calendar/`

## Primitive coverage

All 26 canonical IDs are present in the contract and product renderer. The expansion fixture exercises S02, S03, S04, E02, D01, D02, D03, P03, and N01. Existing calibration primitives remain active, including map/no-map omission, media/no-media, filter, sort, calculator, and planner.

## Browser interaction evidence

- Search `forge`: 1 indexed result.
- Map marker selection: visible selected marker result.
- Calculator inputs `10 + 2 × 5`: result `20`.
- Planner control: `Selected tools: cinder-axe`.
- Mobile viewport: `390×844`, document width matched viewport (`390px`), no obvious horizontal overflow.

## Screenshots

Each surface has exact viewport screenshots at `1440×1000` and `390×844` in this directory: `<surface>-desktop.png` and `<surface>-mobile.png` for homepage, search, category, and P1–P10.

## Validation

- `astro check`: pass, existing deprecation/content warnings only.
- `npm run build`: pass, 53 static pages.
- `npx tsx --test tests/v4/*.test.ts`: pass after expanding fixture assertions.
- `git diff --check`: required final check.
- `npm run validate:generated`: not applicable to this V4-only fixture boundary; it stops at the repository's missing `.site-generator-manifest.json` before running V4 checks.

No deploy, production publish, Research Package integration, Site Creation, New Sites Default → V4, or G017 work was performed.
