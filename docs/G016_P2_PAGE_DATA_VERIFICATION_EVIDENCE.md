# G016 P2 Page Data Contract Verification Evidence

Date: 2026-08-31

Scope: P2 Page Data Contract only. P0 and P1 were supplied as externally confirmed. No P3-P9, Product Acceptance, Scarlet Skips, or G017 work was performed.

## 1. Formal P2 requirements used

The current formal sources were read before implementation inspection:

- `/Users/lanling/Code/ai-work-rules/projects/game-search-opportunity-engine/goals/G016-game-wiki-starter-v4-intent-driven-clean-template.md`
- `/Users/lanling/Code/ai-work-rules/projects/game-search-opportunity-engine/goals/G016_V4_EVIDENCE_BASELINE_FROZEN.md`
- `/Users/lanling/Code/ai-work-rules/projects/game-search-opportunity-engine/goals/G016_V4_DEVELOPMENT_PLAN_FROZEN.md`
- `/Users/lanling/Code/ai-work-rules/projects/game-search-opportunity-engine/goals/P2_PAGE_DATA_CONTRACT_FROZEN.md`
- `/Users/lanling/Code/hot_words_websites/game-wiki-starter/docs/G016_V4_IMPLEMENTATION_RECORD.md` (read as an implementation record, not as source-of-truth evidence)

P2 requires a structured Page Data object containing page identity, state/freshness, resolved intent, instance-level primitive data, evidence registry, media registry, and primitive recipe. Resolver output enters the builder; the builder resolves conditional activation before serialization, omits unsupported or irrelevant primitives, preserves local missing-data degradation, and rejects missing core page identity. Composer consumes Page Data after construction.

## 2. Entry point and call chain

The real entry point is `createPageData(input: PageDataInput): PageData` in `src/v4/page-data-contract.ts`. The generator call chain observed at `scripts/v4/generate-v4.ts:99` is:

`site-input/v4-example/site.json` → `generateV4` → `resolveIntent` → `bindTaskMedia` → `createPageData` → `composePage`.

The entrypoint and call-site evidence is recorded in `artifacts/g016-p2-verification/page-data-entrypoint.json`.

## 3. Current contract shape

The runtime output contains:

```text
pageDataVersion: "v4"
page: { id, title, href, query, playerProblem }
state: PageFreshness
intent: ResolvedPageIntent
facts: PageFact[]
evidence: EvidenceEntry[]
media: MediaEntry[]
freshness?: PageFreshness
assets: PageAssetCandidate[]
primitiveData: PrimitiveInstance[]
primitiveRecipe: PrimitiveDecision[]
```

Each `PrimitiveInstance` contains `instanceId`, `primitiveId`, `payload`, `evidenceRefs`, and `mediaRefs`. The same `primitiveId` can occur in multiple instances. Instance IDs are checked for duplicates; omitted instances are not serialized as empty placeholders.

The implementation now performs runtime primitive payload checks for required top-level fields and key array/string/object field types. It is not a complete deep validator for every nested member of every payload, which remains a limitation noted below.

## 4. Page Data bypass check

No production generator bypass was observed. The generator does not read a finalized Page Data file; it resolves intent and calls `createPageData` before composition. Route/page code was not used to reconstruct the contract in this P2 check.

`site-input/v4-example/site.json` does contain structured `primitiveData` upstream input. This is accepted as builder input and is converted/validated by `createPageData`; it is not a finalized Page Data shortcut. `src/v4/generated/` was treated as generated output, not as source of truth.

## 5. Multiple primitive instances

Focused case: two `E01` instances, `facts-a` and `facts-b`, with independent payloads and separate refs, were serialized together. Both retained `primitiveId: "E01"`; IDs remained distinct and the first payload was not overwritten. Both instances resolved the same evidence and media refs. Full input/output: `artifacts/g016-p2-verification/multiple-instances.json`.

## 6. Twenty-six payload cases

One minimal payload was submitted to `validatePrimitivePayload` for each frozen primitive ID: A01-A03, S01-S04, E01-E03, D01-D03, P01-P04, L01-L03, X01-X05, and N01. The artifact contains 26 real inputs and outputs; all 26 were accepted by the current runtime checks: `artifacts/g016-p2-verification/primitive-payload-cases.json`.

## 7. Malformed payload behavior

Six malformed cases were tested: A02, E03, D01, P02, L02, and X05. The runtime validator rejected all six. When the malformed primitive was actually included by the builder, the builder rejected it; when its activation resolved to omit, it did not enter final `primitiveData`. This distinction is preserved in `malformed-payload-cases.json` rather than being counted as a blanket builder rejection.

The current protection is therefore runtime primitive validation plus activation-time omission. Registry object fields and all nested collection member shapes do not yet have equally deep runtime validation.

## 8. Evidence Registry

Two primitive instances successfully referenced one evidence entry by ID; the primitive instances stored refs rather than embedded evidence objects. Duplicate evidence IDs were rejected with `Duplicate evidenceId`. Dangling refs were filtered from serialized instances and could not resolve to a registry item. Evidence cases: `artifacts/g016-p2-verification/evidence-registry-cases.json`.

## 9. Media Registry

Multiple instances referenced the same generated media ID. Media identity was unique in the registry, and dangling refs were filtered. Two input assets with the same source path received separate generated media IDs because the current input has no caller-supplied media ID field. Media cases: `artifacts/g016-p2-verification/media-registry-cases.json`.

## 10. Include / conditional / omit

The activation cases show:

- available conditional support → primitive instance serialized and recipe status becomes `include`;
- unresolved conditional support → recipe status becomes `omit` before final serialization;
- unsupported conditional support → recipe status becomes `omit` before final serialization.

Final Page Data produced by this builder contains no unresolved conditional recipe status and no empty/null omit placeholder. Evidence: `artifacts/g016-p2-verification/activation-serialization.json`.

## 11. Missing data

With an optional map unsupported, the location fact instance remained and the unsupported map was omitted; the page still serialized. Missing core page identity (`id`, `title`, or `href`) failed with `Page Data requires page id, title, and href`. Evidence: `artifacts/g016-p2-verification/missing-data-cases.json`.

## 12. Page and state provenance

Page identity comes from the generator input page (`id`, `title`, `href`); query and player problem are copied from resolved intent. `state` is sourced from `freshness`, with `{}` when no freshness was provided. Generator samples show supplied freshness on Ember Core and an empty state on the other focused pages; unsupported state is not fabricated. The actual samples are in `generator-page-samples.json`.

## 13. Generator integration samples

The current generator produced three representative samples from `site-input/v4-example/site.json`:

- Ember Core: P1 Entity, 4 primitive instances, 1 evidence entry, 1 media entry.
- Forge Guide: P4 How-to, 5 primitive instances, 1 evidence entry, 1 media entry.
- Armory Planner: P9 Tool, 5 primitive instances, 1 evidence entry, 0 media entries.

Each artifact records upstream input and the resulting `pageData` including page, state, primitiveData, evidence, and media. This is Page Data integration evidence only; page content, visual output, and later-phase acceptance were not assessed.

## 14. Changes made

- `src/v4/page-data-contract.ts`: required core page identity; added runtime primitive payload validation; rejected duplicate evidence and duplicate instance IDs; resolved conditional activation before serialization; filtered dangling refs.
- `scripts/v4/generate-v4.ts`: wired the generator's required page identity into `PageDataInput`.
- `tests/v4/page-data-contract.test.ts`: kept the existing focused contract test file aligned with the required page identity and added direct coverage for instance and registry behavior.
- `artifacts/g016-p2-verification/run-p2-verification.ts`: added the reproducible P2 evidence runner.

The frozen contract file was not modified. No Resolver semantics, primitive renderer, Composer behavior, visual system, navigation, output architecture, Scarlet Skips, or G017 files were changed.

## 15. Tests and reproducibility

Existing focused Page Data test file:

```text
tests/v4/page-data-contract.test.ts — 5/5 passed
```

Verification runner:

```text
artifacts/g016-p2-verification/run-p2-verification.ts — completed; JSON artifacts written
```

Breakdown:

- valid primitive payload cases: 26, validator accepted 26;
- malformed payload cases: 6, validator rejected 6;
- multiple-instance case: 1, two instances serialized;
- evidence registry cases: shared/dangling refs plus duplicate ID;
- media registry cases: shared/dangling refs plus duplicate-source inputs;
- activation serialization cases: available, unresolved, unsupported;
- missing-data cases: optional degradation and required identity failure;
- generator integration samples: 3.

No P3-P9 test suite or Product Acceptance test was run.

## 16. Known remaining P2 issue

The implementation now blocks the tested malformed top-level primitive payloads, but runtime validation is not deep across every nested payload member, and PageFact/EvidenceEntry/MediaEntry field shapes are not comprehensively runtime-schema validated. This is the remaining P2 contract-hardening issue identified by this verification. The frozen Page Data Contract itself was not touched.

