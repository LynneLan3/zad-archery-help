# G016 P1 Intent Resolver Verification Evidence

Date: 2026-08-31
Scope: P1 Intent Resolver Verification / Repair only

This record reports implementation evidence and does not assign a P1 phase
verdict. P2-P9, Product Acceptance, Scarlet Skips, and G017 were not reviewed.

## 1. P1 formal requirements used

- Input is Resolver Input: query, player problem, optional primary/secondary
  task signals, priority, and research evidence such as answer shape, game
  context, SERP signals, and capability support.
- Research supplies signals; the G016 Resolver owns the final P1-P10
  Prototype, candidate Primitive recipe, and activation decision input.
- Final task/Prototype precedence is explicit player task, query semantics,
  SERP/answer-shape evidence, then game-context prior.
- A Prototype produces a candidate Primitive pool; support resolves candidate
  behavior as include, conditional, or omit.
- The 44 Certified Winners provide the frozen taxonomy/regression mapping.
  They are evidence and expected outputs, not Resolver inputs containing a
  precomputed final Prototype.

## 2. Resolver entrypoint and call chain

Entrypoint: `src/v4/intent-resolver.ts::resolveIntent(input)`.

- Input type: `ResolverInput` from `src/v4/intent-contract.ts`.
- Output type: `ResolvedPageIntent`.
- Internal chain: `resolvePrimaryTask()` → `resolvePrimaryPrototype()` →
  `buildPrimitiveCandidates()`.
- `scripts/v4/generate-v4.ts` calls `resolveIntent()` for every input page and
  then passes the returned `primaryTask` to media binding and the returned
  intent into page-data generation.
- The standalone generator uses the same module through this generator path.
- No second legacy Resolver was found in the inspected V4 path. The historical
  top-level site path is separate; it is not called by the V4 generator.

## 3. Ownership boundary

The example input supplies query, player problem, task signal, resolver
evidence, priority, facts, assets, and structured primitive payload data for
the downstream generated fixture. It contains no `prototype`,
`primaryPrototype`, `resolvedPrototype`, or `primitiveRecipe` input key.

The generator does not copy a final Prototype from the fixture: it calls
`resolveIntent()` and uses that returned intent. The page route and renderer
do not call or re-run Prototype inference. No adapter or route-name Prototype
lookup was found in the inspected P1 path.

`secondaryTasks` is accepted by the Resolver input type but is not used to
replace the primary task. Final Prototype remains derived from the resolved
primary task, preserving Resolver ownership.

## 4. Precedence focused cases

Four focused cases were executed through `resolveIntent()`:

| Case | Input signal | Result | Basis |
|---|---|---|---|
| A | Explicit `choice-comparison` conflicts with `terraria bosses` | P3 | primary-task |
| B | `diablo 4 build planner` with no explicit task | P9 | query-semantics |
| C | Ambiguous `terraria` plus `answerShape=comparison` | P3 | answer-shape |
| D | Weak query/player problem plus `gameType=calendar` | P10 | game-prior |

All 4 cases matched the expected precedence layer. Full input/output records
are in `artifacts/g016-p1-verification/precedence-cases.json`.

## 5. P1-P10 focused fixtures

Ten fixtures were executed without supplying a final Prototype input. The
resolved outputs were:

`dream nail → entity lookup → P1`

`minecraft mobs → collection browse → P2`

`bg3 classes → choice comparison → P3`

`ark taming → procedure → P4`

`ark resource map the island → location → P5`

`ark bosses + progression answer shape → progression → P6`

`minecraft enchantments → mechanics → P7`

`best minecraft enchantments → recommendation → P8`

`diablo 4 build planner → tool/database → P9`

`stardew valley fall → planning → P10`

Result: 10 cases, 0 mismatches. Full records are in
`artifacts/g016-p1-verification/prototype-cases.json`.

## 6. 44 Winner regression

The frozen Winner table in `G016_V4_EVIDENCE_BASELINE_FROZEN.md` contains 44
rows. The verification script parses each row's query and expected Prototype,
constructs a Resolver Input without `primaryTask` or final Prototype, calls
`resolveIntent()`, and compares the returned `actualPrototype` to the frozen
expected value.

For the three genuinely ambiguous certified queries (`terraria bosses`, `ark
bosses`, and `diablo 4 uniques`), the input includes the corresponding
certified answer-shape evidence (`catalog`, `progression`, and `tool`). This
is evidence input, not an expected Prototype field. All other Winner cases
use the query with a neutral player problem and no final-task shortcut.

Result: 44 Winner rows entered the Resolver regression; 44 matched; 0
mismatches. Before repair, 4 mismatches exposed over-broad query semantics:
`stardew valley summer seeds`, `terraria bosses`, `terraria hardmode guide`,
and `satisfactory fluids guide`.

The machine-readable result is
`artifacts/g016-p1-verification/winner-regression.json`.

## 7. Primitive candidate evidence

Candidate generation was inspected and executed for six resolved Prototypes:

| Prototype | Candidate Primitive IDs observed |
|---|---|
| P1 | A01, A02, E01, N01 |
| P3 | A01, S02, D01, D02, D03 |
| P4 | A01, P01, P02, P04, N01 |
| P5 | A01, L01, L02, L03 |
| P7 | A01, A03, X03, X04 |
| P9 | A01, X01, X02, X05, E03 |

These candidates are returned by `buildPrimitiveCandidates()` from the
resolved Prototype branch. They are not added by the renderer. Full status and
reason records are in `artifacts/g016-p1-verification/primitive-candidates.json`.

## 8. Unsupported capability evidence

Ten activation cases were executed:

- unsupported Map, Ranking, Calculator, Filter, Planner → omit;
- available Map, Calculator, Filter → include;
- unresolved Ranking, Planner → conditional.

The results are in
`artifacts/g016-p1-verification/capability-activation.json`.

## 9. Hardcoded fixture shortcut search

The searched V4 fixture and generator contain `primaryTask` and
`resolverEvidence`, which are allowed task/evidence signals. They contain no
final Prototype or Primitive Recipe input fields. `generate-v4.ts` directly
calls `resolveIntent()` at its page loop. The generated JSON contains resolved
output by design; it is not the Resolver input source.

No fixture-to-final-Prototype bypass, route-name Prototype hardcode, renderer
Prototype inference, or parallel legacy Resolver was found in the inspected
P1 path.

## 10. Repair

Modified: `src/v4/intent-resolver.ts`.

Minimal repair: added higher-priority compound query semantics for `hardmode
guide` → progression and `fluids guide` → mechanics; narrowed broad planning
terms by removing `summer`/`spring` so `summer seeds` remains entity lookup;
removed generic `bosses` from query semantics so certified answer-shape evidence
can resolve the ambiguous catalog/progression cases.

No expected Winner value was changed. No Page Data, renderer, Composer, Visual
System, Generator output, Navigation, Scarlet Skips, or G017 file was modified
for this repair.

## 11. Tests and reproducible commands

Existing Resolver tests:

- `tests/v4/intent-resolver.test.ts`: 7 tests, all passed.
- Its 44-row test checks task-to-Prototype mapping; the separate machine
  regression above is the actual query-to-Resolver Winner check.

New verification cases:

- precedence focused: 4 / 4 matched;
- P1-P10 Prototype focused: 10 / 10 matched;
- actual Winner Resolver regression: 44 / 44 matched, 0 mismatch;
- capability activation: 10 cases, all expected activation results;
- representative candidate evidence: 6 Prototype cases generated.

Commands used from the implementation repository:

```text
/Users/lanling/Code/hot_words_websites/_g016-v4-cleanroom-emberfall/node_modules/.bin/tsx --test tests/v4/intent-resolver.test.ts
/Users/lanling/Code/hot_words_websites/_g016-v4-cleanroom-emberfall/node_modules/.bin/tsx artifacts/g016-p1-verification/run-p1-verification.ts
```

## 12. Known remaining P1 issues

No confirmed P1 Resolver bypass or remaining Winner mismatch was found in the
checked path. The verification runner is retained beside the generated
machine-readable artifacts as the reproducible evidence producer. P2 Page Data
serialization and all later phases remain unchecked.
