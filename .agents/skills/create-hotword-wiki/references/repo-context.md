# Repository context contract

`$create-hotword-wiki` must separate **repository identity** from **site input** checks.

## Command

```bash
npm run verify:context
```

Optional:

```bash
npm run verify:context -- --root /path/to/checkout
```

For a new local workspace before its first commit:

```bash
npm run verify:bootstrap -- --root /path/to/checkout
```

Properties:

- read-only (no file writes)
- no network
- no Git config / remote mutation
- does **not** require `site-spec.yaml`
- non-zero exit on identity/context failure

`verify:context` is strict and requires a valid committed `HEAD`. It does not
accept an unborn repository.

## Fresh unbound workspace — `bootstrap-unbound`

`verify:bootstrap` is a separate read-only precheck for a new V2 workspace. It
passes only when the directory is an initialized Git worktree with an unborn
`HEAD`, no remotes, no `REPOSITORY_ID` marker, and the required V2 generator,
validation, Astro, and config structure. It reports:

```text
identityMode: bootstrap-unbound
repository identity: unbound
```

It never infers identity from `site.id`, game name, or local folder name. An
existing marker, any remote, an existing commit, a non-Git directory, or
malformed structure fails the bootstrap check. After it passes, local inputs,
generation, and validation are allowed; commit, push, and deploy are not.

## Expected repository

Machine-readable marker file at repo root:

```text
REPOSITORY_ID
```

Exact contents:

```text
LynneLan3/game-wiki-starter
```

## Mode A — `remote-verified`

When any Git remote exists (prefer `origin`):

1. Normalize SSH / HTTPS GitHub URLs to `owner/name`.
2. Accept only `LynneLan3/game-wiki-starter`.
3. Equivalent accepted forms include:
   - `git@github.com:LynneLan3/game-wiki-starter.git`
   - `https://github.com/LynneLan3/game-wiki-starter.git`
4. If the remote points elsewhere → **fail**. Do not fall back to content markers.

## Mode B — `content-marker-verified`

When `git remote -v` is empty (common in Codex Cloud task containers):

1. Do **not** fail solely because remotes are empty.
2. Do **not** add / invent remotes.
3. Require `REPOSITORY_ID` exact match.
4. Require template structure:
   - `TEMPLATE_VERSION`
   - `AGENTS.md`
   - `.agents/skills/create-hotword-wiki/SKILL.md`
   - `scripts/generate-site.ts`
   - `scripts/validate-site.mjs`
   - `site-spec.example.yaml`
   - `package.json` scripts: `site:generate`, `validate`, `validate:template`, `validate:generated`, `test:generator`, `verify:context`
   - valid Git `HEAD`
5. Emit warning:
   `Git remote is unavailable in this Codex Cloud task; repository identity was verified using the repository marker and required template structure.`

## Branch / HEAD rules

- Local branch may be `work`, a feature branch, or detached HEAD.
- Do not require `git branch --show-current` to equal the Codex UI source branch.
- Record `workBranch` + `head` in the report.
- `sourceBranchIndependentlyVerifiable` is typically `false` in Cloud (no remotes / `work` checkout). Do not claim otherwise.

## Input checks (next stage)

Only after `verify:context` passes:

- require `site-spec.yaml`
- require declared `site-input/**` sources and assets

Missing inputs are **input Errors**, not repository-identity Errors.
