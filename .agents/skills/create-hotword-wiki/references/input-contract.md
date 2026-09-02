# Input contract — site-spec.yaml V1

## Required layout

```text
site-spec.yaml
site-input/
  pages/*.md
  assets/*
TEMPLATE_VERSION
```

`site.id` identifies the game experiment. It is **not** a GitHub repository name and must never be used to create or rename repositories.

## Top level

| Field | Required | Notes |
| --- | --- | --- |
| `schemaVersion` | yes | Must be `1` |
| `templateVersion` | yes | Must match root `TEMPLATE_VERSION` (`2.0.0`) |
| `mode` | yes | Must be `generated-site` |
| `deployment` | no for generate / yes for production deploy | Vercel identity; empty placeholders are allowed in the template and **block** `deploy:check` / `deploy:production`. Never copied into `site.generated.ts`. |
| `monetization` | no | Optional. Default off. Affiliate disclosure + AdSlot hooks only; no ad/affiliate provider. |

## `deployment`

| Field | Required for deploy | Constraints |
| --- | --- | --- |
| `provider` | yes | `vercel` only |
| `orgId` | yes | Primary team only for new sites: `team_yAOizMTSVuT0RJATgFdAlQuG` (`lynnelan3s-projects`). Used as `VERCEL_ORG_ID`. Empty values default to the primary team. Do not use legacy Vercel accounts for new production sites. |
| `projectId` | yes | Vercel project id (`prj_…`). Used as `VERCEL_PROJECT_ID`. Create the project under `lynnelan3s-projects`. Required before `deploy:production`. |
| `projectName` | recommended | Vercel project name = site slug (one game = one project; not `hot-words-*`). Name differences do not block deploy. |
| `productionUrl` | recommended | public `https://` URL; should match `site.siteUrl` for the live site, but is not a deploy gate |
| `productionBranch` | recommended | intended production git branch; not enforced as a deploy gate |

Preview / production CLI for new sites always uses `--scope lynnelan3s-projects`.

## `site`

| Field | Required | Constraints |
| --- | --- | --- |
| `id` | yes | lowercase kebab-case |
| `locale` | yes | `en` or `zh-CN` only → `GameConfig.locale` / UI chrome |
| `siteUrl` | yes | absolute `https://` URL; fixtures may use `*.example` → Astro `site` |
| `hubPath` | yes | `/` or single segment `/game/` → Hub + guide URLs |
| `title` | yes | full site title → Starlight / browser title (`GameConfig.title`) |
| `shortName` | yes | short product name → nav chrome |
| `description` | yes | meta / hub description |
| `disclaimer` | no | shown in Hub About when present; omitted when empty |

## `game`

| Field | Required | Constraints |
| --- | --- | --- |
| `name` | yes | public game name |
| `hubTitle` | yes | Hub H1 |
| `tagline` | yes | short tagline |
| `releaseStatus` | yes | `announced` \| `pre-release` \| `early-access` \| `released` \| `unknown` → Hub strip + About |
| `releaseDate` | conditional | `YYYY-MM-DD`; omit when unknown — never invent. Required when `released`. |
| `developer` | yes | |
| `publisher` | yes | |
| `platforms` | yes | non-empty string list |

## `theme`

| Field | Required | Constraints |
| --- | --- | --- |
| `accentColor` | yes | `#RGB` / `#RRGGBB` / `#RRGGBBAA` → `--game-accent` |
| `accentForeground` | no | same hex rules → `--game-accent-foreground` (primary CTA text); defaults to `#041012` |
| `heroAssetId` | no | must reference `assets[].id` → `heroImage` / `heroAlt` |
| `heroPosition` | no | CSS object-position; default `center` |

## `categories[]`

Unique `id` (kebab-case), unique positive `order`, required `label` / `description` / `icon`.
`imageAssetId` may be `null` or an asset id.

Category is backend organization and Starlight fallback browse. It is always
available as fallback organization when Guides exist; it is not the primary
player journey and should not be used as a substitute for conditional Routes.

## `pages[]`

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | unique kebab-case page id |
| `title` / `description` | yes | |
| `category` | yes | must exist in `categories` |
| `slug` | yes | unique single-segment kebab-case (no hub prefix) |
| `source` | yes | existing local markdown path |
| `status` | yes | `pre-release` \| `confirmed` \| `verified` \| `needs-verification` |
| `featured` | no | default `false` |
| `sidebarOrder` | yes | positive integer |
| `quickAnswer` | no | |
| `related` | no | list of **page ids** |
| `coverAssetId` | no | asset id or `null` |
| `changeSummary` | no | |
| `eyebrow` | no | game-world context label shown above H1 (e.g. `Weapon Location`, `Boss Fight`). Not for SEO keywords. |
| `facts` | no | max 4 `{label, value}` pairs — high-confidence structured facts visible in a strip below the hero. |

A Guide is the answer page for one primary search intent. Category chooses fallback organization; Route membership is defined only by `routes[].pages`.

### `intents[]`

Optional but recommended for every page.

Convention: `intents[0]` is the **Primary Search Intent** — the single search task this page exists to answer. `intents[1...]` are supporting intents or entities.

See `references/content-policy.md` for the full Primary Intent rule.

### `relations[]`

Optional. Each entry has `pageId` + `type` (`related` | `next-step`).

- `next-step`: player's next question after solving this page (max 3 rendered, config order preserved).
- `related`: laterally relevant reference material.

These are not synonyms. See `references/content-policy.md` for selection criteria.

V2 Launch guidance: author the smallest complete cluster supported by distinct player search intents and sufficient evidence. There is no numeric target or warning threshold. Do not split one intent into filler pages, and do not omit a strongly supported launch-critical intent merely to stay under a page count.

## `routes[]`

Optional, conditional player-facing Route paths. Evaluate whether two or more
Guides form a genuine task journey before creating `routes[]`. A Route is a **player task path** (`/{hubPath}/routes/{routeId}/`),
not a content folder:

- **Category** = backend organization / fallback browse / sidebar.
- **Route** = player journey / task path. Routes do not replace Categories and are never auto-generated from Categories.
- **Guide** = search intent answer surfaced inside one or more Routes.

### Membership has a single authoritative source

`routes[].pages` is the **only** source for which Guide belongs to which Route.
Do **not** add `routes` to a page (no `page.routes` on `pages[]`) — a second source would drift.
To find which Routes contain a page, compute it at runtime (reverse lookup helper
`findRoutesForPage(pageId, routes)`); never persist memberships on the page.

A Guide may belong to several Routes:

```yaml
routes:
  - id: getting-started
    pages:
      - example-guide
  - id: core-gameplay
    pages:
      - example-guide
```

### Fields

| Field | Required | Constraints |
| --- | --- | --- |
| `id` | yes | unique, non-empty, kebab-case; safe for `/routes/{id}/`. No `slug` field — `id` is the URL. |
| `title` | yes | non-empty |
| `description` | yes | non-empty |
| `eyebrow` | no | small eyebrow label above the route title |
| `visualAssetId` | no | reuses `assets[].id`. Omit for a content-only route. No second image schema. |
| `pages` | yes | **at least 1** page id; order is meaningful and preserved (no alphabetic sort) |
| `fastAnswers` | no | max 3, see below |

### `fastAnswers[]`

Each entry: `question` (non-empty), `answer` (non-empty), `pageId` (must exist **and** belong to
this route's `pages`).

```yaml
fastAnswers:
  - question: How do I get started?
    answer: Begin with the Overview.
    pageId: beginner-guide
```

`route.fastAnswers` is **not** the same as `homepage.popularQuestions`:

- `homepage.popularQuestions` = site-wide high-value real search questions.
- `route.fastAnswers` = the route's most common quick questions, scoped to that route.

They are separate data structures and are never auto-generated from each other.

If Routes are not justified, omit `routes[]`; route Fast Answers and
route-specific QA are not required, and the UI must not expose an empty Routes
experience. See `v2-launch-profile.md` for the canonical conditional rule.

## `homepage`

Internal links must use `pageId` or allowed `anchor` — never free-form internal path strings.

CTA shape (exactly one target):

```yaml
label: ...
pageId: beginner-guide        # or
anchor: browse-guides         # or
externalUrl: https://...
```

Allowed anchors today: `browse-guides`, `start-here`.

### `startHere[]`

Player task navigation — not a recommended-articles list.

Each entry: `pageId` (required), `label` (recommended), `badge` (optional).

3–4 entries framed as player tasks (e.g. `New Player`, `Find Weapons`, `Explore the World`). Prefer pages with cover/image. Do not simply pick one article per category.

### `popularQuestions[]`

Each entry: `pageId` (required), `label` (required), `context` (optional — brief answer-scope hint, do not repeat the question).

Source questions from real player demand (GSC, Google suggestions, Steam discussions, Reddit). Do not invent questions to fill slots.

### `evidence.items[]`

Reference `assetId` and optional `pageId`.

Optional `homepage.statusItems[]` (`label` + `value`, max 4). Omit to let the Hub derive a short rail from existing game fields. Empty values are skipped; missing items are not padded.

## `assets[]`

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | unique kebab-case |
| `source` | yes | regular local file; create it manually or with the controlled official `assets:bootstrap` flow; **symlinks rejected in V1** |
| `target` | yes | relative path under `src/assets/` only; no `..`, no absolute paths, no `src/assets/` prefix |
| `alt` | yes | required, especially for hero |
| `sourceUrl` | no | provenance URL |
| `sourceType` | yes | `official` \| `store` \| `press-kit` \| `user-provided` \| `unknown`; bootstrap accepts only the first three |
| `usageStatus` | yes | `approved` \| `review-required` \| `unknown` |
| `kind` | no | `cover` \| `screenshot` \| `evidence` \| `illustration` |
| `aspectRatio` | no | `16:9` \| `4:3` \| `1:1` \| `portrait` \| `auto`; `auto` preserves natural evidence ratio |
| `objectPosition` | no | CSS focal position used by cropped cover/card media |

Media contract: `alt` describes the visible information contributed by the
image, not the page title or SEO keywords. `caption` explains the image;
`sourceLabel`/`sourceUrl` identifies attribution and is displayed separately.
Guide page evidence may omit `sourceType` when no source attribution should be
shown, but every configured image still requires semantic `alt` text.

Optional bootstrap guard:

```yaml
assetBootstrap:
  allowedHosts:
    - publisher.example
    - developer.example
```

`official` / `press-kit` downloads must match this host list. `store` downloads
are limited to Steam and its official CDN hosts.

Secure bootstrap is not the Asset & Media System. When approved useful assets
exist, launch planning must assign their semantic purpose (Hero, Guide Cover,
Evidence, or justified Route visual), reuse/crop/focal behavior, mobile
suitability, and meaningful alt text. See `asset-policy.md` and
`v2-launch-profile.md` for `VISUAL_COMPLETE` / `VISUAL_DEGRADED`.

## Markdown placeholders

Sources must not hard-code hub prefixes like `/example-game/...`.

```md
查看[配置要求]({{page:system-requirements}})。
返回[首页]({{hub}})。
```

- `{{page:<id>}}` → public guide URL for that page id (exact id only)
- `{{hub}}` → normalized hub path
- Unknown page ids fail generation
- Ordinary external links are left untouched
- Output must not retain unresolved placeholders

## Example

See `site-spec.example.yaml` and `tests/site-generator/fixtures/valid-site/`.
