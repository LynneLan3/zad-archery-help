# V2 Launch Starter profile

This is the default product profile for explicit `$create-hotword-wiki` calls.

Its job is to turn evidence-backed game research into a production-ready, lightweight single-game guide site that can collect real search data. It is not the V3 post-data upgrade.

## Canonical V2 Launch Product Contract

V2 turns an evidence-backed Research Packet into a lightweight,
production-quality single-game launch guide site that is useful, visually
credible, internally coherent, mobile-usable, technically valid, and honest
about evidence and freshness. A generator/build pass is necessary evidence,
not product acceptance.

The required baseline is a Research-backed Primary Intent cluster; Homepage;
real Guide Library and Guide detail pages; direct Quick Answers;
evidence-bounded facts and provenance; Categories as fallback organization;
intentional internal-link planning; valid search, metadata, sitemap and robots
behavior; responsive desktop/mobile experience; explicit visual completion;
page-level trust/freshness state; and deterministic generation/validation.

The Guide Library is always-on when Guides exist and is backed by actual
generated Guide pages. Player Routes are an optional journey presentation and
must never suppress the underlying Guide set. When Routes are enabled, the
formal `/guides/` surface may present the Route-based Guide Index; when Routes
are disabled it presents the clean Guide Library fallback.

Homepage experience is demand-first: Hero → Facts/Status → Priority or Popular
Guides → Popular Questions → Start Here or Routes → remaining content. Routes
must not displace hot guides. Start Here, Popular Questions, route guide rows,
Related, and Next rows are full-row links with coordinated hover/focus states,
roughly 48–56px minimum touch height, and mobile active feedback. Route imagery
is wide (about 2.4–2.7:1), subordinate to guide rows, and uses low-contrast
dividers. Compact route navigation uses `sidebarLabel ?? title` with the
description as secondary text. Missing assets render text-first; formal
Homepage, Guides, Routes, and Guide surfaces never render a giant image
placeholder. With Routes enabled, `/guides/` remains the Route-based Guide
Index; with Routes disabled it uses the clean Guide Library fallback.

Player Routes are conditional. Enable them only when two or more Guides form a
genuine player task journey where ordered navigation materially helps. If that
test is not met, planning need not create `routes[]`, route Fast Answers are
not required, route-specific QA is not required, and the UI must not expose an
empty Routes experience.

## Input modes

Codex may start from either:

1. **Prepared inputs** — `site-spec.yaml`, `site-input/pages/**`, approved assets, and source notes already exist. If the input set has no Asset Research report, run Asset Research before generation.
2. **Research packet** — the user supplies research, source URLs, page candidates, assets, or a prior planning report. Codex first performs Asset Research/Intake for official media, then converts only supported material into `site-spec.yaml` and `site-input/**` before running the generator.

If the material does not support a factual answer, omit that claim or page and report the gap. Never use Example Game values as production fallback.

## V2 output contract

A generated V2 site uses the existing deterministic architecture:

```text
Research packet / prepared inputs
  → Asset Research (official sources, candidates, or `NO_USABLE_MEDIA_FOUND`)
  → Asset Intake review (purpose, crop, alt, provenance, usage status)
  → site-spec.yaml
  → site-input/pages + assets + optional trust copy
  → npm run site:generate
  → Experience Homepage
  → optional Route index / Route Hubs
  → Guide Library
  → Guide detail pages
  → optional trust pages
  → npm run validate:generated
```

The generator-managed outputs remain authoritative. Codex edits inputs, not generated files.

## Required baseline

Every generated site must have:

- verified repository context and explicit game/site identity
- one Guide per distinct primary player search intent
- a direct Quick Answer for each core Guide
- evidence-bounded facts and honest page status
- categories for backend organization and fallback navigation
- a Homepage that links to real Guides rather than placeholder cards
- valid internal links, metadata, sitemap behavior, mobile rendering, and generated-site validation
- real-game acceptance on at least one representative generated site, including
  the actual homepage, guide/media surfaces, desktop and mobile visual checks,
  and a passing normal build
- no Example Game residue, fabricated facts, secrets, or undeclared production actions

A Guide does not require every possible sub-fact to be known before it can
ship. Ship it when its Primary Search Intent is distinct and current evidence
supports a useful direct answer; mark unknown sub-facts honestly as
unverified. For example, a CO-OP Guide may answer solo support, player count,
multiplayer model, co-op progression, and cautious cross-platform status even
when every PC / PS5 / Xbox crossplay combination is unknown. A WEAPONS Guide
may cover weapon-pool behavior, Weapon Rank, Affixes, and known identities
without waiting for DPS, final stats, or unlock costs. A BOSSES Guide may
separate official structure from playtest/community-observed encounters
without presenting an incomplete final list as official.

Generic `<game> guide` and `<game> wiki` intent normally belongs on the
Homepage. Do not create a redundant `/overview/` Guide unless it answers a
distinct Primary Search Intent. Keep the no-fabrication and no-filler rules.

## Page-set rule

There is no default of 4–5 pages and no numeric page target.

Choose the smallest complete launch cluster that satisfies all three conditions:

1. each page answers a distinct, real player search intent;
2. the available evidence can support a useful answer;
3. together the pages cover the launch scope selected in the research packet.

Do not split one intent to manufacture more URLs. Do not suppress a strong, supported intent merely to stay below a count. A small game may justify a small cluster; a question-rich game may justify more.

There is no automatic warning for a Guide count over five. Do not change
`schemaVersion` merely because a reference uses historical V1 terminology;
correct the terminology instead.

## Capability defaults

| Capability | V2 Launch default | Enable when |
| --- | --- | --- |
| Search-answer-first Guide pages | on | always |
| Homepage + Guide Library | on | always |
| Categories / fallback browse | on | always |
| Sources and evidence | on when claims need them | reliable provenance exists |
| About / Editorial Method / Privacy | recommended for production | use honest independent-site copy |
| Player Routes | off | two or more Guides form a genuine task journey |
| Homepage evidence gallery | off | useful approved screenshots exist |
| Analytics | off | measurement ID and privacy page are ready |
| Monetization hooks | off | explicitly requested and disclosure is ready |
| Location Explorer / map deep links | off | the game and research justify location-led navigation |
| Player readiness / tracker | off | the game has a real prerequisite or progression use case |
| Remote asset bootstrap | off until reviewed | URLs are official, Steam/store, or press-kit sources |

Optional features must never be enabled merely because the schema supports them.

### Asset Research / Intake gate

Before authoring or generating `site-spec.yaml` from a game name or Research
Packet, actively inspect official media in this order:

1. Steam official store page and its official CDN
2. Game official website
3. Publisher / developer official pages or news
4. Official press kit
5. Official trailer / gameplay media

Record the checked sources and candidates in an Asset Research / Intake report.
The report must state `FOUND_USABLE_MEDIA` when at least one suitable official
visual is found, or `NO_USABLE_MEDIA_FOUND` only after the source order has
actually been checked. A missing image in the Research Packet is not evidence
of no media. If candidates exist, the Homepage hero should use at least one;
Guide covers/cards should cover the main launch guides as far as the available
visuals reasonably allow, with semantic reuse and different crops allowed.
Evidence assignments are reserved for images that support a specific claim.

After review, put the selected files and provenance into the existing `assets[]`
entries. Do not create a second media schema. Every selected asset needs a
purpose, suitable crop/focal behavior, mobile suitability, meaningful alt text,
and `usageStatus`. `text-first` is a fallback only after `NO_USABLE_MEDIA_FOUND`
or an explicitly recorded rights/suitability failure.

For repeatable Steam discovery, use:

```text
npm run assets:research -- --game "<game>" --steam-appid <appid> \
  [--official-url https://<official-site>/] \
  [--publisher-url https://<publisher-or-developer>/] \
  [--press-kit-url https://<press-kit>/] \
  [--trailer-url https://<official-trailer-page>/] \
  --out site-input/asset-research.md
```

The script creates a report and candidate URLs; it does not bypass review or
write a second schema. Approved candidates still go through `assets:bootstrap`.

### Visual, theme, link, and trust rules

Secure Asset Bootstrap only downloads declared official, Steam/store, or
press-kit assets with provenance, allowed-host checks, and usage status. The
Asset & Media System is separate: it assigns approved assets to Hero, Guide
Cover, Evidence, or justified Route visual purposes, with semantic purpose,
reuse, crop/focal behavior, mobile suitability, meaningful alt text, and
fallback behavior. Useful approved assets must not be silently ignored. Record
`VISUAL_COMPLETE` when they are intentionally integrated, or
`VISUAL_DEGRADED` only when suitable approved assets are unavailable or
uncleared and the reduced fallback is disclosed. There is no image-count
minimum.

Current implementation truth is fixed experience styling plus
`accentColor`/`accentForeground` variables; this is not automatic
game-specific theming. The V2 target is deterministic derivation from approved
visual identity or an explicit approved theme input, covering accent, accent
foreground, background, surface, soft surface, border, primary text, muted
text, and contrast validation, with a neutral fallback when identity is absent.

Semantic internal-link planning belongs to Research/Codex; structural
validation belongs to deterministic code. For each Guide, consider a Homepage
inbound entry, a likely `next-step`, lateral `related` references, and Route
membership only when Routes are justified. These are not quotas: `next-step`
is the likely next player question/task and `related` is lateral reference
material. Structural existence does not prove semantic quality.

V2 owns source provenance, evidence status, page status, applicable
release/build context, and available last-reviewed/updated metadata, including
verification-needed state. Claim-level lifecycle, automatic patch/version
invalidation, GSC Query × Page restructuring, and CTR-driven optimization are
V3 concerns.

Final V2 QA has five layers: Content; Information Architecture;
Visual/Media/Theme; Interaction/Mobile; and Technical. It must include
representative real-game acceptance before freeze. The result is exactly one
of `PASS_V2_LAUNCH`, `PASS_V2_WITH_VISUAL_DEGRADED`, or `FAIL_V2`.
Technical build success alone cannot produce a V2 pass.

## V2/V3 boundary

V2 ends only when all five QA layers pass and the visual state is recorded;
`validate:generated` and visual checks are necessary but not sufficient.

The following belong to a later V3 upgrade and must not be invented during a normal V2 call:

- restructuring from post-launch GSC Query × Page performance
- CTR-driven title changes based on actual impressions
- claim-level freshness workflow and version-review states beyond the existing V2 fields
- game-type-specific expansion inferred without evidence
- broad content expansion intended to imitate a large guide network

A V3 upgrade must start from a successful generated site and its real performance evidence. It must be implemented separately rather than overwriting this V2 profile.

## Invocation contract

A sufficient user instruction is:

```text
$create-hotword-wiki
Generate a V2 Launch Starter site for <game> from these research materials.
Stop after validation and visual review. Do not deploy, commit, or push unless I explicitly authorize it.
```

Codex must still stop for missing repository identity, missing critical evidence, unsafe assets, collisions, or failed validation as defined by the main Skill.
