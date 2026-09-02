# V2 launch QA checklist

Apply the canonical V2 Product Contract in `v2-launch-profile.md`. A technical
build pass alone is never final acceptance. Record `VISUAL_COMPLETE` or
`VISUAL_DEGRADED`, then choose exactly `PASS_V2_LAUNCH`,
`PASS_V2_WITH_VISUAL_DEGRADED`, or `FAIL_V2`.

## A. Content

- [ ] Research-backed Primary Intents are real and distinct.
- [ ] Every Guide has a useful direct Quick Answer.
- [ ] Facts and copy are evidence-bounded; zero fabricated factual claims.
- [ ] Source provenance, page status, and verification-needed states are honest.
- [ ] H2s answer real player tasks; `next-step` and `related` meanings are correct.

## B. Information Architecture

- [ ] Homepage is useful and links to real Guides.
- [ ] Homepage order is demand-first: Hero → Facts/Status → Priority/Popular Guides → Popular Questions → Start Here/Routes → remaining content.
- [ ] Guide Library is populated from actual generated Guide pages whenever Guides exist.
- [ ] The underlying Guide set is retained when Routes are enabled; Routes do not suppress Guides.
- [ ] Routes-enabled `/guides/` keeps the Route Index; routes-disabled `/guides/` uses the clean Guide Library fallback.
- [ ] Routes are exposed only when two or more Guides form a genuine useful journey.
- [ ] No empty promised Routes or other conditional surface is exposed.
- [ ] Categories provide fallback organization.
- [ ] Internal-link graph is intentional; structural existence is not treated as semantic proof.
- [ ] Search, canonical metadata, sitemap, and robots behavior match enabled surfaces.

## C. Visual / Media / Theme

- [ ] Secure asset provenance and usage status are recorded.
- [ ] Approved useful assets are intentionally assigned to Hero/Cover/Evidence/Route visual when applicable.
- [ ] No arbitrary image-count minimum is used.
- [ ] `VISUAL_COMPLETE` is recorded when useful approved visuals are integrated; otherwise `VISUAL_DEGRADED` is disclosed only when suitable assets are unavailable or uncleared.
- [ ] Hero/media crops, focal behavior, mobile suitability, and meaningful alt text are checked.
- [ ] Missing assets are text-first; formal Homepage, Guides, Routes, and Guide surfaces have no giant image placeholder.
- [ ] Route imagery is approximately 2.4–2.7:1, guide rows are visually primary, and dividers remain low contrast.
- [ ] Theme identity is intentional, readable, contrast-checked, and its fallback is honest.

## D. Interaction / Mobile

- [ ] Top navigation is usable and exposes only valid enabled surfaces.
- [ ] Hero/title wrapping and Quick Answer prominence work on mobile.
- [ ] Cards, tap targets, TOC, images/crops, tables/wide content, and Next Questions are usable.
- [ ] Start Here, Popular Questions, route guide rows, Related, and Next are full-row clickable with coordinated hover/focus and mobile active feedback; compact route labels prefer `sidebarLabel ?? title`.
- [ ] Footer and empty states are deliberate.
- [ ] Search opens, returns useful results, and result navigation works.
- [ ] Desktop and mobile reading flows are visually spot-checked; no horizontal overflow is only one check, not the whole QA.

## E. Technical

- [ ] Generator is deterministic and idempotent.
- [ ] `npm run site:generate -- --check` passes.
- [ ] `npm run validate:generated` passes.
- [ ] Astro check/build pass.
- [ ] Internal links, sitemap, robots, metadata, and generated output are valid.
- [ ] No generated drift, secrets, or forbidden artifacts are present.

## Template maintenance / CI evidence

- [ ] Run `npm run test:context` and `npm run test:generator` when changing template/generator behavior.
- [ ] Run `npm run test:validation` when changing validation workflows.
- [ ] `npm run validate:template` passes for template maintenance.
- [ ] Template mode still allows Example Game; generated-site mode rejects it.
