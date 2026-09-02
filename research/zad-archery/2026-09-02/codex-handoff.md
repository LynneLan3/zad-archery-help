# Codex handoff

Repository target: `game-wiki-starter` V4 implementation.

## Input

Use this directory as the research source of truth.

## Required behavior

1. Read `manifest.json`, `page-plan.json`, `media-manifest.json` and `research-gaps.json`.
2. Convert **READY** article JSON into the existing V4 Guide Content Result contract.
3. Map through the existing V4 adapter / PageData / Media Binding.
4. Keep the already approved Zad Archery presentation.
5. Do not hardcode research content into UI components.
6. Do not publish any `HOLD_*` article as factual guide content.
7. Hide or gracefully omit cards/routes whose research status is HOLD unless the existing V4 workflow has a research-pending mechanism.
8. Use source IDs as provenance and keep the evidence boundary.
9. Search must index only real published guide content.
10. Do not deploy until local build/search/navigation pass.

## Homepage mapping

Use `page-plan.json` for:
- Players Are Asking
- Popular Searches
- Popular Right Now
- Recently Updated

Do not keep mock “best build / unlock Sniper / rare ore” cards unless current-build evidence is added first.

## Media

Official marketing art may be used as visual/brand material according to project policy, but it is not proof of mechanics.  
Mechanic-specific pages should wait for `required_current_build_captures` in `media-manifest.json`.

## Output report

Return:
- READY routes created
- HOLD routes intentionally skipped
- source/provenance mapping
- media bound
- unresolved research gaps
- build/search validation
