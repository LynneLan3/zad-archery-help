# AGENTS.md — game-wiki-starter

Rules every Codex session in this repository must follow.

## Repository identity

- This repository is always `LynneLan3/game-wiki-starter`.
- Machine-readable marker: root file `REPOSITORY_ID` must contain exactly `LynneLan3/game-wiki-starter`.
- Do not create, rename, fork-as-replacement, or switch the working remote to another repository.
- Do not modify Git remotes.
- Before `$create-hotword-wiki` generation, run `npm run verify:context`.
- Codex Cloud may present branch `work` and an empty `git remote -v`. That alone is not a wrong-repository failure when `verify:context` reports `content-marker-verified`.
- If a remote exists and points elsewhere, stop. Do not silently fall back to content markers.

## Site generation

- New single-game wikis must be produced from `site-spec.yaml` through the deterministic generator.
- Do not hand-edit generator-managed files (`src/config/site.generated.ts`, generated guide pages, copied managed assets, `.site-generator-manifest.json`).
- After changing `site-spec.yaml` or `site-input/`, run `npm run site:generate`.
- After generating a site, run `npm run validate:generated` (never `verify:template` in the live build flow).
- After changing application / template code, run `npm run validate` (alias of `validate:template`).
- After changing the generator or context verifier, run `npm run test:generator` and `npm run test:context`.
- After changing validation workflows, run `npm run test:validation`.

## Content and assets

- Do not invent game facts, prices, release dates, reviews, mechanics, or characters.
- Mark unconfirmed information clearly.
- Only use the controlled `assets:bootstrap` flow for declared official, Steam
  store/CDN, or press-kit URLs. Never use competitor/search-result images.
  Do not treat `usageStatus: unknown|review-required` as cleared rights.

## Git and delivery safety

- Do not commit `node_modules/`, `dist/`, `.astro/`, `.env*`, caches, or test temp output.
- Do not push directly to `main`.
- Do not deploy, buy domains, change DNS, merge PRs, or open production accounts unless the current user task explicitly authorizes that action.
- Mechanical validation belongs to scripts/CI — do not rely on prompt memory as the only gate.

## Vercel team (new sites)

- All new hotword sites: create, link, preview, and production under `lynnelan3s-projects` (`team_yAOizMTSVuT0RJATgFdAlQuG`).
- Do not create new production sites under legacy Vercel accounts.
- Prefer CLI `--scope lynnelan3s-projects`; project name = site slug.

## Hotword OS production publishing

- The standard Production Publish Trigger is:
  `npm run publish:production -- --receipt /path/to/receipt.json`.
- A normal Production publish must use `publish:production` when this script
  exists. It owns build/generated validation, deployment, Production HTTP and
  canonical verification, IndexNow, and Experiment Ledger writeback.
- `npm run deploy:production` and `npm run indexnow` remain low-level
  primitives. Do not manually combine them with a Ledger call unless the
  standard publisher has a real blocker.
- A prompt saying publish/deploy/live, a Git commit/push, a Preview deploy,
  the Vercel dashboard, IndexNow alone, or `vercel --prod` alone is not a
  Hotword OS Publishing Completion.
- The receipt is required before the publisher starts; it is normalized in a
  temporary file and the original receipt is never modified.
- Phase 7G site creation stops at Preview / `READY_FOR_PRODUCTION_REVIEW`.
  Production approval is required before invoking `publish:production`.
