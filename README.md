# game-wiki-starter

Astro + Starlight starter for a single-game guide / wiki site.

## Production validation

The starter architecture was first production-validated through the Agefield High migration.

This repo stays a neutral Example Game template. Do not copy Agefield content or Agefield-specific config into it.

## V4 version governance

V4 versions are immutable baselines. A later version must use a new branch and
must not overwrite an earlier V4 tag or baseline branch.

| Version | Code ref | Research baseline | Status |
|---|---|---|---|
| V4.0 | `v4.0.0` / `v4.0` → `e448f6252933edc3ac8b0c4267dcc50b17da95c0` | ai-work-rules G016 / P7 / V4 visual research frozen artifacts | CANONICAL / IMMUTABLE |
| V4.1 | `codex/v4.1` (working tree; base `f62dec3c543665aefdab3f61db7e157a02e7089f`) | V4.0 research baseline, with V4.1 remediation work | IN_PROGRESS |

The V4.0 research references are maintained in ai-work-rules:

- G016 / `P2_PAGE_DATA_CONTRACT_FROZEN`
- G016 / `P7_VISUAL_SYSTEM_FROZEN`
- `V4_PAGE_EXPERIENCE_REFERENCE`
- `V4_PRIMITIVE_VISUAL_GRAMMAR`
- `V4_DISCOVERY_MOBILE_REFERENCE`
- `P7_VISUAL_SYSTEM_RESEARCH_REVISION`

## Template V2.2 Status

**Production Ready / Frozen**

Core capabilities:

- single-game Experience Homepage + Guide architecture
- GameShell navigation and Pagefind search theme
- Guide Library (always-on when Guides exist); optional player Routes and Route Hubs
- search-answer-first pages
- Content Relations
- Evidence / Sources
- Trust
- Analytics
- Social Metadata
- Monetization Hooks

Template V2.2 core is frozen. New template-level capabilities should only be added when a real production site exposes a reusable blocker.

Codex Skill / site generator V1 is included: `site-spec.yaml` → `npm run site:generate` → validators.
Keep Example Game demo content for template mode; generated sites must not retain it.

## Template architecture

### Experience Layer

This is the player-facing production shell:

- `/{hubPath}/` → Experience Homepage
- `/{hubPath}/guides/` → Guide Library
- `/{hubPath}/{guideSlug}/` → Experience Guide

When justified by a genuine multi-Guide task journey, the optional Routes
surface also uses `/{hubPath}/routes/` and `/{hubPath}/routes/{routeId}/`.

Experience pages use `GameConfig`, the docs content collection, formal Experience components, and the production stylesheets:

- `src/styles/experience.css`
- `src/styles/experience-homepage.css`
- `src/styles/routes.css`
- `src/styles/experience-guide.css`

### Starlight Layer

Starlight remains the technical foundation for content loading, Markdown/MDX rendering, Pagefind indexing, sitemap integration, and fallback docs behavior. It is no longer the primary player experience shell.

Category Landings stay on the Starlight fallback:

- `/{hubPath}/{category}/`
- `robots: noindex,follow`
- excluded from sitemap
- excluded from Pagefind

### Content model

- **Category** = backend organization / fallback browse / sidebar.
- **Route** = player journey / task path.
- **Guide** = answer to one primary search intent.

The Guide Library is the index of actual generated Guides and does not depend
on Routes. Player Routes are conditional: evaluate whether two or more Guides
form a materially useful ordered journey before creating `routes[]` or exposing
Routes navigation. `routes[].pages` is the single source of Guide → Route
membership. `fastAnswers` are scoped to one Route. `homepage.startHere` and
`homepage.popularQuestions` are site-wide Homepage modules.

## Requirements

- Node.js `>= 22.12.0`
- npm `>= 9.6.5`

## Install

```bash
npm ci
```

Use `npm ci` for clean installs (CI / fresh machines). `npm install` is fine during local development.

## Commands

| Command | Action |
| --- | --- |
| `npm run dev` | Local preview at `localhost:4321` |
| `npm run check` | Astro + TypeScript diagnostics |
| `npm run verify:template` | Ensure forbidden build artifacts are not Git-tracked (template maintenance) |
| `npm run verify:context` | Strict bound-repository precheck (`remote-verified` or Cloud `content-marker-verified`; requires committed `HEAD`) |
| `npm run verify:bootstrap` | Fresh unbound workspace precheck (`bootstrap-unbound`; unborn `HEAD`, no remote or identity marker) |
| `npm run validate:site` | Validate config, hub slug, images, internal links |
| `npm run validate:site -- --mode=template` | Template config validation (Example Game allowed) |
| `npm run validate:site -- --mode=generated-site` | Same checks + forbid Example Game residue + site-spec/manifest |
| `npm run site:generate -- --spec site-spec.yaml` | Deterministic generate from site-spec |
| `npm run site:generate -- --spec site-spec.yaml --dry-run` | Plan only; no writes |
| `npm run site:generate -- --spec site-spec.yaml --check` | Detect managed-file drift |
| `npm run test:context` | Repository context verifier tests in temp dirs |
| `npm run test:generator` | Generator unit/integration tests in temp dirs |
| `npm run test:validation` | Template vs generated validation-mode regression tests |
| `npm run build` | Static build to `./dist/` |
| `npm run preview` | Preview the production build |
| `npm run validate:template` | Template maintenance: `check` + `verify:template` + `validate:site --mode=template` + `build` |
| `npm run validate:generated` | Generated site: manifest + generator `--check` + generated-site validation + `check` + `build` (no `verify:template`) |
| `npm run validate` | Alias of `validate:template` |
| `npm run deploy:check` | Check Vercel deployment identity without deploying |
| `npm run deploy:production` | Production deploy using `site-spec.yaml` identity (`VERCEL_ORG_ID` / `VERCEL_PROJECT_ID`) |

## Direct dependencies

| Package | Why it is declared |
| --- | --- |
| `astro` | Site framework / build |
| `@astrojs/starlight` | Docs / wiki UI shell |
| `@astrojs/sitemap` | Imported directly in `astro.config.mjs` |
| `sharp` | Required by Astro `<Image>` / `astro:assets` optimization used by Hub, cards, and evidence |
| `zod` | Game config + site validation schemas |
| `yaml` | Parse `site-spec.yaml` for the site generator |
| `@astrojs/check` + `typescript` | `npm run check` |
| `tsx` (dev) | Runs TypeScript-aware validate / generate / test scripts |

Do **not** remove `sharp` just because source files do not `import 'sharp'`. The official image pipeline needs it for production builds.

## Clean template export

Do not zip the whole working directory (that can pull in `.git`, `node_modules`, `dist`, `.astro`, `__MACOSX`, `.DS_Store`).

Recommended:

```bash
git archive --format=zip --output=game-wiki-starter.zip HEAD
```

Then verify:

```bash
npm run verify:template
```

## New game workflow

### Codex direct call — V2 Launch Starter

Invoke the repository-local Skill explicitly:

```text
$create-hotword-wiki
Use the supplied research packet to generate a V2 Launch Starter site.
Stop after generated validation and visual checks. Do not deploy, commit, or push unless separately authorized.
```

Codex converts evidence-backed research into `site-spec.yaml` and `site-input/**`, then uses the deterministic generator. The V2 Launch Starter has no fixed page quota: it generates the smallest complete cluster of distinct, supported player search intents. Optional Routes, analytics, monetization, interactive map/toolkit, and player-readiness features remain off unless the input justifies them.

The V2 callable contract is defined in `.agents/skills/create-hotword-wiki/references/v2-launch-profile.md`. V3 is a later, separate post-data upgrade and is not part of this generation flow.

Preferred deterministic generator workflow:

For an existing bound repo:

`verify:context → inputs → generator dry-run → generate → validate`

For a new unbound workspace:

`verify:bootstrap → inputs → generator dry-run → generate → validate → STOP before commit/push/deploy`

In either flow, use the explicit generator/check sequence: copy
`site-spec.example.yaml` → `site-spec.yaml`, add `site-input/` pages + assets,
run the dry-run, generate, confirm idempotency, run `--check`, then run
`npm run validate:generated` (do **not** use `validate` / `verify:template` for
generated sites). If the selected precheck fails, stop before the dry-run.

Use explicit `$create-hotword-wiki` when driving the flow from Codex.

Template maintenance (generator / Skill / starter baseline):

1. Run `npm run test:context` and `npm run test:generator` when those areas change
2. Run `npm run validate:template` (or `npm run validate`)

Manual template editing (still supported for learning the baseline):

1. Copy `game-wiki-starter` (prefer `git archive` or a clone)
2. Edit generated values via `site-spec.yaml` (preferred) or inspect `src/config/site.generated.ts` / `src/config/game-types.ts`
3. Set:
   - game identity (`name`, `shortName`, `description`, `tagline`)
   - `siteUrl`
   - `hubPath` (**only** `/` or a single segment like `/my-game/`)
   - `locale` (`en` default, or `zh-CN`)
   - `hubTitle`
   - `categories`
   - `routes` (optional player-facing paths — see “Routes” below)
   - `accentColor`
4. Keep Hub CTAs on the path helper (`pageHref` / local `href(...)`) so they cannot drift from `hubPath`
5. Align `src/content/docs/index.mdx` splash `slug` with `hubPath` (`example-game` ↔ `/example-game/`; omit slug when hub is `/`)
6. Replace favicon / hero / logo (optional)
7. Delete Example Game demo content
8. Add Markdown / MDX guides under `src/content/docs/`
9. Set frontmatter (`title`, `description`, `category`, `slug`, `status`, …)
10. Run `npm run validate:site -- --mode=generated-site`
11. Run `npm run build`
12. Deploy

Do not hand-edit the hub card list, sidebar groups, or category landing pages. They are generated from `game.categories` and the docs collection.

### Supported Hub paths

| `hubPath` | Hub URL | Category landing |
| --- | --- | --- |
| `/` | `/` | `/{categoryId}/` |
| `/my-game/` | `/my-game/` | `/my-game/{categoryId}/` |

Multi-segment hubs such as `/games/my-game/` are **not** supported and fail validation on purpose.

### Guide slugs and legacy SEO paths

New sites should continue to use the default single-segment guide slug, such as `system-requirements`.
For a standalone Hub at `/`, `pages[].slug` may also be a safe nested kebab-case path such as
`legacy-game/classes`; it generates `/legacy-game/classes/`. This is primarily for preserving an
existing production site's ranked Guide URLs while moving its Hub to `/`. The slug remains the single
public Guide path source of truth for frontmatter, links, relations, routes, canonical URLs, and sitemap
entries. Do not reset an established SEO slug without a deliberate migration decision.

Nested slugs must not contain a leading or trailing slash, empty segments, `.` / `..`, query strings,
hashes, protocols, or absolute URLs. Guide paths must remain distinct from the Hub, `/guides/`,
`/routes/`, route pages, category landings, and enabled trust pages.

### Locale

Set `locale: 'en' | 'zh-CN'` in `game.ts`. Chrome UI (Start Here, Quick Answer, status labels, breadcrumbs, …) comes from `src/lib/ui.ts`. Guide body copy stays author-controlled.

### Images

Paths are relative to `src/assets/` and may include subfolders:

```text
src/assets/
  brand/
  hero/
  guides/
  screenshots/
  placeholder.svg
```

Examples in `game.ts`:

```ts
heroImage: 'hero/cover.jpg',
// category.image: 'guides/overview.webp'
```

- Omit an optional image field → text fallback
- Configure a path that does not exist → validate/build fails (typos are not swallowed)

### Hub Hero image

For a formal game site, add official horizontal artwork under `src/assets/` (subfolders allowed), then configure:

```ts
heroImage: 'hero/cover.jpg',
heroAlt: 'Official artwork for Example Game',
heroPosition: 'center',
```

Prefer a horizontal image at least 1600px wide. If reliable artwork is unavailable, omit `heroImage`.

## Validation modes

| Mode | When to use | Example Game allowed? |
| --- | --- | --- |
| `template` (default) | Developing this starter | Yes |
| `generated-site` | After copying for a real game | No — fails on Example Game / example domains / demo slugs |

```bash
VALIDATE_MODE=generated-site npm run validate:site
# or
npm run validate:site -- --mode=generated-site
```

## Category navigation

TopNav categories and Browse category title / CTA links go to a Category Landing. Guide links still go to the article.

Category Landings are generated from `game.categories` plus `frontmatter.category`. They are navigation pages, not SEO landings:

- `robots`: `noindex,follow`
- excluded from Pagefind
- excluded from the sitemap

## Routes (player-facing paths)

Optional and conditional in `site-spec.yaml`. Create `routes[]` only when two
or more Guides form a genuine player task journey; specs without justified
Routes must not expose an empty Routes experience.

A Route is a player task path (`/{hubPath}/routes/{id}/`), distinct from a Category:

- **Category** = backend organization / fallback browse / sidebar.
- **Route** = player frontend task path. Routes do not replace Categories and are never generated from them.

Key rules:

- `routes[].pages` is the **single authoritative source** for Guide → Route membership. Do not add `page.routes`.
- A Guide may belong to several Routes (Route is a graph/path, not a folder).
- `pages` order is meaningful and preserved by the generator.
- `fastAnswers` (max 3) must point at pages in the same route; distinct from `homepage.popularQuestions`.
- `visualAssetId` reuses the existing `assets[]`; omit for a content-only route.

Runtime helpers: `routeHref(hubPath, routeId)` builds the URL; `findRoutesForPage(pageId, routes)` returns every route containing a page (computed at runtime, never persisted).

## Hub portal config

Optional Hub presentation lives on `game.portal` in `src/config/game.ts`. Prefer `pageHref(hubPath, 'overview')` (or the local `href()` helper in the demo file) for internal targets.

`startHere` is player-task navigation. If omitted, Hub falls back to guides with `featured: true`.

`evidence` is optional. Configured evidence images must resolve; omit the section when you have no assets.

## Analytics contract (V2.0.1 baseline)

Analytics is optional and is declared in `site-spec.yaml` without provider
secrets or GA4 Measurement IDs:

```yaml
analytics:
  ga4:
    enabled: true
```

For production, configure `PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX` in the
deployment environment. Production is enabled when the site switch and ID are
present; preview and local development are disabled, and a missing ID is a
safe no-op. Existing P0 identity fields remain supported when supplied.

`siteId` is the stable site-level join key; `gameSlug` is the stable game
identity; `templateVersion` supports version comparisons; and `launchDate`
supports age-based cohorts. Future page-level joins are `siteId` plus the
normalized page path. The initial shared placement vocabulary is exported
from `src/lib/analytics.ts`.

GA4 and Vercel Analytics loading are implemented in the shared site head.
Vercel Analytics is production-only when `vercelAnalytics.enabled: true`;
preview and local development are disabled. The shared interaction adapter
emits only `guide_click`, `popular_question_click`, and `start_here_click` to
GA4 in production. Each event includes `site_id`, `game_slug`,
`template_version`, `link_title`, `target_path`, and the centralized
`placement` value; local, preview, disabled, and missing-ID builds are safe
no-ops.

### Guide trust metadata

Guide frontmatter may include an optional `trust` object. `lastUpdated` (the
existing editorial equivalent of `updated`) records when the page was edited;
`trust.lastVerified` records when gameplay information was checked against
evidence. `trust.status` is explicitly `verified`, `provisional`, or `outdated`;
`trust.appliesTo` declares human-readable platform/version scope; and
`trust.sources` records supporting evidence. Sources require a readable `label`
and `type` (`official`, `first-party`, `community`, or `secondary`), with an
optional URL. First-party observations therefore do not need an external URL.

```yaml
trust:
  status: verified
  lastVerified: 2026-08-13
  appliesTo:
    - PC
    - Early Access 0.6
  sources:
    - label: Official patch notes
      type: official
      url: https://example.com/patch-notes
    - label: Direct gameplay observation
      type: first-party
  note: Confirmed for the declared version and platform.
```

Trust is declarative: the template does not infer status from age or run
automatic research/freshness monitoring.

## Content has three independent layers

1. **`category`** — Hub / Sidebar information architecture
2. **Source directory** — files under `src/content/docs/`
3. **`slug`** — public SEO URL

If you are migrating a live site, **always set `slug` explicitly** so existing URLs do not change.
For legacy standalone migrations, keep the historical multi-segment path in `pages[].slug`; do not
replace it with a new short slug merely because the Hub moved to `/`.

`related` in authored Markdown frontmatter uses the **public slug**. In `site-spec.yaml`, `related` uses **page ids**; the generator converts them.

## Hub URL and legacy redirects

New game sites can keep the Hub at `/` by leaving `src/content/docs/index.mdx` without a custom slug and setting `hubPath: '/'`.

This demo Hub uses `slug: example-game` with `hubPath: '/example-game/'`.

Root → Hub redirects for legacy URLs belong on the deploy platform (for example Vercel), not in this generic starter.

## Production deployment identity

### Vercel production policy

All new hotword sites must be created and deployed under:
lynnelan3s-projects

Do not create new production sites under legacy Vercel accounts.

Existing legacy projects may remain for historical purposes, but all new site creation and production deployment use the primary team.

- Team slug: `lynnelan3s-projects`
- orgId: `team_yAOizMTSVuT0RJATgFdAlQuG`
- One game = one Vercel Project; project name = site slug (not `hot-words-*`)

CLI defaults:

```bash
# Create / link under the primary team
vercel link --yes --scope lynnelan3s-projects --project <site-slug>

# Preview
vercel --scope lynnelan3s-projects

# Production (also used by npm run deploy:production)
vercel --prod --scope lynnelan3s-projects
```

Each generated site must declare its Vercel target in `site-spec.yaml`:

```yaml
deployment:
  provider: vercel
  orgId: "team_yAOizMTSVuT0RJATgFdAlQuG"
  projectId: ""
  projectName: ""
  productionUrl: ""
  productionBranch: ""
```

Fill every field before production. `site.siteUrl` must match `deployment.productionUrl`. New sites always set `orgId` to the primary team above.

```bash
npm run deploy:check
npm run deploy:production
```

`site-spec.yaml` is the authority. Local `.vercel/project.json` is diagnostic / transient CLI state. Empty `projectId` placeholders cannot fall back to a previously linked project. These IDs stay out of `src/config/site.generated.ts`.

`deploy:check` never creates a Vercel deployment. `deploy:production` only requires a usable `projectId` (and defaults empty `orgId` to the primary team). It does not gate on git branch, production URL match, or `projectName` differences. Production CLI always passes `--scope lynnelan3s-projects`.

## Hotword OS standard Production publish

The standard Production Publish Trigger for a site that supports this
publisher is:

```bash
npm run publish:production -- --receipt /path/to/receipt.json
```

The publisher requires a `hotword-publish-receipt-v1` input before starting,
runs generated validation/build by default, checks `HEAD`, reuses the existing
deployment identity and `deploy:production` implementation, verifies
Production HTTP 200 and canonical tags where present, derives and deduplicates
IndexNow URLs, then invokes the existing Experiment Ledger receipt CLI with a
temporary normalized receipt. It never modifies the original receipt.

`deploy:production` and `indexnow` remain low-level primitives. A prompt,
commit/push, Preview, dashboard deployment, standalone `vercel --prod`, or
standalone IndexNow call is not Publishing Completion. Use `--check` for a
no-deploy preflight; `--skip-build` is available only for an explicitly
bounded local check.

Completion results are `PUBLISH_COMPLETE`,
`PRODUCTION_LIVE_LEDGER_INCOMPLETE`, or `PUBLISH_FAILED`. A Ledger failure does
not redeploy or roll back already-live Production.

## Not in this template yet

- GitHub Actions provisioning
- Vercel DNS / Search Console automation
- Auto research / bulk page generation / remote asset download
