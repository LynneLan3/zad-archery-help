# Asset policy

- Official asset bootstrap is allowed only for declared `sourceUrl` entries with
  `sourceType: official`, `store` (Steam / its official CDN), or `press-kit`.
  Competitor sites, search-result hosts, and random image search are rejected.
- `official` and `press-kit` entries must also match the top-level
  `assetBootstrap.allowedHosts` list; `store` entries are restricted to Steam
  and its official CDN hosts.
- Run `npm run assets:bootstrap -- --spec site-spec.yaml --dry-run` to inspect
  the plan, then run it without `--dry-run` before site generation. The
  generator itself remains deterministic and consumes only local files.
- Every asset needs local `source`, `target`, `alt`, `sourceType`, and `usageStatus`.
- `unknown` / `review-required` are **not** commercial clearance.
- Hero images require meaningful alt text.
- `target` must stay under `src/assets/`; path traversal (`..`, backslashes, absolute paths) is a hard error.
- Symlinked `source` files are rejected in V1 (prevents escaping the allowed input tree).
- Do not overwrite unknown/non-managed files; stop on collision instead.
- Keep provenance (`sourceUrl`) for every bootstrapped asset. Asset metadata is
  not a rights clearance: `review-required` still needs human confirmation.
- `sourceType` / `usageStatus` are recorded in `.site-generator-manifest.json` for audit; they are not game UI chrome.

## V2 media contract

The template resolves every Guide cover/evidence image to one `MediaAsset`
shape: `src`, semantic `alt`, optional `caption`, optional `sourceLabel` and
`sourceUrl`, plus `kind`, `aspectRatio`, and `objectPosition`. Use `auto` for
gameplay evidence unless a deliberate crop is required. The shared renderer
keeps images bounded, uses `cover` only for cropped media, and omits optional
media entirely when it is absent.

## Bootstrap versus Asset & Media System

Secure Asset Bootstrap is the download/provenance/host-control layer. It does
not decide how approved assets complete the product experience. The V2 Asset &
Media System must separately decide, for each approved useful asset, whether it
serves as Hero, Guide Cover, Evidence, or a justified Route visual, and record
semantic purpose, sensible reuse, crop/focal behavior, mobile suitability,
meaningful alt text, and fallback behavior.

If approved useful assets exist and the build ignores them, the result is
incomplete rather than `VISUAL_DEGRADED`. Use `VISUAL_COMPLETE` when useful
approved assets are intentionally integrated; use `VISUAL_DEGRADED` only when
suitable approved assets are unavailable or uncleared and the reduced fallback
is disclosed. There is no image-count minimum.

## Asset Research / Intake gate

Asset discovery is required before generating a new game site, even when a
Research Packet contains no images. Check Steam, the official game website,
publisher/developer pages, an official press kit, and official trailer/gameplay
media in that order. Record each checked source and either selected candidates
or `NO_USABLE_MEDIA_FOUND`. Only the latter (or a recorded rights/suitability
failure) permits the disclosed `text-first` fallback.

Intake writes selected candidates into the existing `assets[]` entries with
purpose, provenance, semantic alt text, usage status, and crop/focal decisions.
It must not introduce a second media schema. One approved visual may be reused
for hero, covers, and cards when the meaning remains appropriate; evidence must
be tied to a specific supported claim.
