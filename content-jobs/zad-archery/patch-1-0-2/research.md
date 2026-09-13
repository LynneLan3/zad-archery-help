# Writer Research Brief: Zad Archery Patch 1.0.2: Historical Launch Fixes (Not Current)

## Intent Brief

```json
{
  "primaryQuery": "Zad Archery Patch 1.0.2: Historical Launch Fixes (Not Current)",
  "queryCluster": [
    "Zad Archery Patch 1.0.2: Historical Launch Fixes (Not Current)",
    "patch notes"
  ],
  "userJob": "Patch 1.0.2 is a launch-week historical patch, not the current version. It fixed monster gem counting below your highest level, restored missed Guardians that could lock the King, and repaired the Defeat the King achievement after Steam connectivity problems. For the current game, start with the September 4 Mega Update and September 5 Patch 1.1.1.",
  "intentOwnerStatus": "KEEP",
  "serpPromise": "Patch 1.0.2 is a launch-week historical patch, not the current version. It fixed monster gem counting below your highest level, restored missed Guardians that could lock the King, and repaired the Defeat the King achievement after Steam connectivity problems. For the current game, start with the September 4 Mega Update and September 5 Patch 1.1.1."
}
```

Operation: UPDATE for canonical route `/updates/patch-1-0-2/`.

## Must Include Facts

- Patch 1.0.2 is retained as historical launch evidence and should not be presented as the live current patch.
- Current-version reading order: September 4 Mega Update, then September 5 Patch 1.1.1.
- Monster gems now counted when farming a level below the player's highest.
- A Guardian that failed to appear could permanently lock the King; missed Guardians were restored on restart.
- Defeat the King achievement unlock was fixed for cases where Steam was unreachable.
- The player's own screen resolution was added as the first option in settings.

## Quick Answer direction

Lead with this verified answer, polished but not expanded beyond evidence:

Patch 1.0.2 is a launch-week historical patch, not the current version. It fixed monster gem counting below your highest level, restored missed Guardians that could lock the King, and repaired the Defeat the King achievement after Steam connectivity problems. For the current game, start with the September 4 Mega Update and September 5 Patch 1.1.1.

## Required structure

1. Quick Answer
2. Sections matching the verified claims above
3. FAQ using only verified answers
4. Short related links section pointing to:
- /updates/mega-update/
- /updates/patch-1-1-1/
- /guides/progression/guardian-skipped-level/

## Forbidden Claims

- Do not invent Symbol rankings, Ring rankings, Endless farming routes, or exact hidden values.
- Do not treat Patch 1.0.2 as the current patch.
- Do not claim a fixed current full-game length of only 4–5 hours after the Mega Update.
- Do not mention Research Pack, Evidence Gate, FAST_VERIFIED, or internal labels in public copy.
- Use only facts listed below.

## Sources

- [Patch 1.0.2](https://steamdb.info/patchnotes/25063956/) — monster gems below highest level bug fixed; missing Guardian could lock the King and was fixed; Defeat the King achievement unlock issue fixed; native screen resolution option added
- [September 4 Mega Update](https://steamdb.info/patchnotes/25128059/) — Symbol System added; 50+ Symbols and Exalted Symbols; Preferred Job added; doubles all bonuses of the preferred job; Ring System added; Portal Currency used after level 30; 9 Ring perks; Endless farming added; Level 50 cap removed; automatic currency pickup / progression behavior improved
- [September 5 Patch 1.1.1](https://steamcommunity.com/app/4412000/) — Effects Amount slider; mining ore auto-collect when too much ore piles up; currency UI wrap fix; fix for dying as Run Portal dies causing next level to skip monsters / Guardian; missed Guardian can appear next level; if already passed, Guardian is counted defeated and currency granted; leftover skill effects no longer kill the next Run Portal; lost Portal Currency from skipped-level bug corrected on load

## Media State

Media gate is N/A for update pages and PARTIAL/MISSING for verified problem/system pages. Do not invent screenshots or UI steps that are not evidenced.

## Output

Return a complete English guide article in Markdown with:
- YAML frontmatter including title and description
- H1 matching the title promise
- Quick Answer near the top
- H2 sections
- FAQ section
