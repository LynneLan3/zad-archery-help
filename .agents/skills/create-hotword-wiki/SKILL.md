---
name: create-hotword-wiki
description: Generate or check a single-game hotword wiki inside LynneLan3/game-wiki-starter from research input, official assets, site-spec.yaml, and local site-input materials. Explicit invocation only.
---

# create-hotword-wiki

Build or verify one single-game wiki in `LynneLan3/game-wiki-starter` using:

```text
existing bound repo: npm run verify:context
new unbound workspace: npm run verify:bootstrap
→ site-spec.yaml / site-input checks
→ npm run site:generate (--dry-run, then real, then second run)
→ npm run site:generate -- --check
→ npm run validate:generated
→ git status / visual check
```

Codex understands sources and runs the workflow. The generator performs deterministic file writes. Validators block bad results.

The default callable profile is **V2 Launch Starter**. It turns an evidence-backed research packet into the smallest complete single-game launch site. Page count is determined by distinct player search intents and available evidence, never by a fixed quota. V3 post-data upgrade behavior is outside this skill. The canonical product contract and final acceptance vocabulary live in `references/v2-launch-profile.md`.

Use `validate:generated` after site generation. Do **not** run `validate` / `validate:template` / `verify:template` / `test:context` / `test:generator` as part of the live build flow (those remain for template maintenance and CI).

## Explicit invocation only

Do not start this skill unless the user explicitly asks for `$create-hotword-wiki` / `create-hotword-wiki`.

## Required reading before edits

1. `AGENTS.md`
2. `references/v2-launch-profile.md`
3. `references/input-contract.md`
4. `references/content-policy.md`
5. `references/asset-policy.md`
6. `references/qa-checklist.md`
7. `references/output-contract.md`
8. `references/repo-context.md`

## Content planning sequence

Before writing `site-spec.yaml` pages, follow this order:

```text
 1. Research real player demand
 2. Define site identity (game, repo, GitHub, Vercel)
 3. Run Asset Research in the source-priority order in `references/v2-launch-profile.md`
 4. Record the result and every candidate/source URL in an Asset Intake report
 5. Define the theme from the site identity
 6. Define Primary Intents
 7. Plan Guide pages
 8. Assign Categories
 9. Evaluate whether Player Routes are justified
10. If justified, order route.pages
11. If justified, define route Fast Answers
12. Configure Homepage Start Here
13. Configure Popular Questions
14. Add eyebrow / facts / quickAnswer
15. Add evidence / sources
16. Define next-step relations
17. Assign reviewed candidates into the existing `assets[]` only; reuse/crop semantically
18. Assess visual completion and run secure asset bootstrap when approved
19. Generate, visually check, and validate
```

Intent first, route journey second, category fallback third. Apply `references/v2-launch-profile.md` before selecting optional capabilities, and see `references/content-policy.md` for all content rules.

## Execution stages (strict order)

1. Select exactly one repository precheck before any input or generator command:
   - Existing bound repository: `npm run verify:context`.
   - New unbound workspace: `npm run verify:bootstrap`; it reports
     `bootstrap-unbound` and `repository identity: unbound`.
   - Do **not** require the local branch name to equal the Codex UI source branch.
   - Accept `work`, detached HEAD, or other checkout names used by Codex Cloud.
   - Report `identityMode` as `remote-verified` or `content-marker-verified`.
   - Do **not** add, modify, or invent a Git remote.
   - Do **not** claim the container independently verified the Codex Cloud UI source branch when remotes are absent.
2. If the selected precheck fails, stop immediately. Do not continue into the generator dry-run.
3. Only after the selected precheck passes: run Asset Research before authoring `site-spec.yaml` when the task starts from a Research Packet or game name. `npm run assets:research -- --game "..." --steam-appid ...` creates a reviewable report; inspect the official website, publisher/developer, press-kit, and trailer sources as applicable.
   - The report must state `FOUND_USABLE_MEDIA` or `NO_USABLE_MEDIA_FOUND`.
   - Do not choose `text-first` merely because the Research Packet omitted images. Search official sources first; use `text-first` only after recording `NO_USABLE_MEDIA_FOUND` or an explicit rights/suitability failure.
4. Only after Asset Research: check `site-spec.yaml` and `site-input/**` (and declared assets / usageStatus).
   - Missing `site-spec.yaml` or `site-input/**` must stop generation as an **input** Error.
   - Never report missing input files as a wrong-repository identity failure.
5. Read the reference contracts above.
6. If remote assets are declared, add `assetBootstrap.allowedHosts` for publisher/developer/press-kit sources, then run `npm run assets:bootstrap -- --spec site-spec.yaml --dry-run` and review that every remote URL is official, Steam, or press-kit. Secure bootstrap does not by itself satisfy the Asset & Media System contract.
7. Run the same command without `--dry-run` when official assets are approved for local preview; preserve `sourceUrl`, `sourceType`, `alt`, and `usageStatus`.
8. Run input prechecks (spec parse / source files / assets) via generator dry-run prerequisites.
9. If any Error exists, stop before modifying generated files.
10. Run `npm run site:generate -- --spec site-spec.yaml --dry-run`.
11. Report the generation plan to the user.
12. Run `npm run site:generate -- --spec site-spec.yaml`.
13. Run a second `npm run site:generate -- --spec site-spec.yaml` and confirm idempotency (`written=0` / no unexpected deletes).
14. If needed, edit only non-generated sources (`site-spec.yaml`, `site-input/**`, hand-maintained code). Never hand-edit managed outputs.
15. Run `npm run site:generate -- --spec site-spec.yaml --check`.
16. Run `npm run validate:generated` (manifest → generator check → generated-site validation → Astro check → Astro build).
    - Do **not** run `npm run validate`, `validate:template`, `verify:template`, `test:context`, or `test:generator` in this flow.
17. Run `git diff --check`.
18. Inspect `git status` / diff for unexpected files (secrets, `dist`, `.env`, temp dirs).
19. If browser tooling is available, spot-check desktop and mobile Hub + one guide.
20. Output the standard site report from `references/output-contract.md`, including:
    - current task work branch (may be `work` or detached)
    - current HEAD
    - repository identity mode
    - whether the source branch is independently verifiable inside the container
21. Do not commit or push unless the current user task explicitly authorizes it.
22. Never auto-deploy or auto-merge.

## Stop conditions

Stop immediately when any of these are true:

- `npm run verify:context` fails (wrong remote, missing/mismatched `REPOSITORY_ID`, broken template structure)
- `npm run verify:bootstrap` fails (non-Git workspace, existing commit, remote,
  identity marker, or invalid V2 structure)
- A Git remote exists but points at a repository other than `LynneLan3/game-wiki-starter`
- Unrelated dirty worktree changes are present
- Critical factual sources / `site-spec.yaml` / declared assets are missing (**input** failure after identity passed)
- `usageStatus` is `unknown` and the task requires public shipping clearance
- Target path collides with a non-managed file
- Path / slug collisions
- `validate:generated` or build fails and cannot be fixed safely in scope
- Work requires domain, DNS, payment, backend auth, or production deploy changes
- Work requires deleting unknown user files
- Work requires changing already-live public URLs outside the declared hub/page plan

## Non-failures in Codex Cloud

These alone must **not** fail repository identity:

- Local branch name is `work`
- Detached HEAD
- Empty `git remote -v` when `REPOSITORY_ID` and required template structure verify as `content-marker-verified`

For a fresh unbound workspace, the valid order is:

```text
verify:bootstrap → inputs → generator dry-run → generate → validate → STOP
```

This state permits local generation and validation only. Commit, push, and
deploy remain blocked until a later repository-binding/publishing phase.

## Output

Always finish with the fixed report sections in `references/output-contract.md`.
