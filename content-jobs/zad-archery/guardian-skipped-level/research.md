# Writer Research Brief: Zad Archery Missing Guardian or Skipped Level: Patch 1.1.1 Recovery

## Intent Brief

```json
{
  "primaryQuery": "Zad Archery Missing Guardian or Skipped Level: Patch 1.1.1 Recovery",
  "queryCluster": [
    "Zad Archery Missing Guardian or Skipped Level: Patch 1.1.1 Recovery",
    "problem solving"
  ],
  "userJob": "If a level skipped monsters or a Guardian after dying as the Run Portal died, Patch 1.1.1 is the fix. A missed Guardian can appear on the next level; if you already passed that point, the Guardian is counted defeated and currency is granted. Lost Portal Currency from the skipped-level bug is corrected on load.",
  "intentOwnerStatus": "KEEP",
  "serpPromise": "If a level skipped monsters or a Guardian after dying as the Run Portal died, Patch 1.1.1 is the fix. A missed Guardian can appear on the next level; if you already passed that point, the Guardian is counted defeated and currency is granted. Lost Portal Currency from the skipped-level bug is corrected on load."
}
```

Operation: CREATE for canonical route `/guides/progression/guardian-skipped-level/`.

## Must Include Facts

- Before Patch 1.1.1, dying as the Run Portal died could cause the next level to skip monsters or the Guardian.
- Leftover skill effects could also kill the next Run Portal.
- The skip caused by dying as the Run Portal dies is fixed.
- A missed Guardian can appear next level.
- If you already passed the relevant point, the Guardian is counted defeated and currency is granted.
- Lost Portal Currency from the skipped-level bug is corrected on load.
- Leftover skill effects no longer kill the next Run Portal.
- This page only restates the official Patch 1.1.1 recovery behavior. It does not invent extra manual workarounds beyond those notes.

## Quick Answer direction

Lead with this verified answer, polished but not expanded beyond evidence:

If a level skipped monsters or a Guardian after dying as the Run Portal died, Patch 1.1.1 is the fix. A missed Guardian can appear on the next level; if you already passed that point, the Guardian is counted defeated and currency is granted. Lost Portal Currency from the skipped-level bug is corrected on load.

## Required structure

1. Quick Answer
2. Sections matching the verified claims above
3. FAQ using only verified answers
4. Short related links section pointing to:
- /updates/patch-1-1-1/
- /updates/mega-update/
- /updates/patch-1-0-2/

## Forbidden Claims

- Do not invent Symbol rankings, Ring rankings, Endless farming routes, or exact hidden values.
- Do not treat Patch 1.0.2 as the current patch.
- Do not claim a fixed current full-game length of only 4–5 hours after the Mega Update.
- Do not mention Research Pack, Evidence Gate, FAST_VERIFIED, or internal labels in public copy.
- Use only facts listed below.

## Sources

- [September 5 Patch 1.1.1](https://steamcommunity.com/app/4412000/) — Effects Amount slider; mining ore auto-collect when too much ore piles up; currency UI wrap fix; fix for dying as Run Portal dies causing next level to skip monsters / Guardian; missed Guardian can appear next level; if already passed, Guardian is counted defeated and currency granted; leftover skill effects no longer kill the next Run Portal; lost Portal Currency from skipped-level bug corrected on load
- [September 4 Mega Update](https://steamdb.info/patchnotes/25128059/) — Symbol System added; 50+ Symbols and Exalted Symbols; Preferred Job added; doubles all bonuses of the preferred job; Ring System added; Portal Currency used after level 30; 9 Ring perks; Endless farming added; Level 50 cap removed; automatic currency pickup / progression behavior improved

## Media State

Media gate is N/A for update pages and PARTIAL/MISSING for verified problem/system pages. Do not invent screenshots or UI steps that are not evidenced.

## Output

Return a complete English guide article in Markdown with:
- YAML frontmatter including title and description
- H1 matching the title promise
- Quick Answer near the top
- H2 sections
- FAQ section
