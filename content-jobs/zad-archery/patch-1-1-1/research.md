# Writer Research Brief: Zad Archery Patch 1.1.1 (Sep 5): Guardian Skip and Portal Currency Fixes

## Intent Brief

```json
{
  "primaryQuery": "Zad Archery Patch 1.1.1 (Sep 5): Guardian Skip and Portal Currency Fixes",
  "queryCluster": [
    "Zad Archery Patch 1.1.1 (Sep 5): Guardian Skip and Portal Currency Fixes",
    "patch notes"
  ],
  "userJob": "Patch 1.1.1 is the September 5 follow-up to the Mega Update. It adds an Effects Amount slider, auto-collects piled mining ore, fixes currency UI wrapping, repairs the Run Portal death skip that could skip monsters or a Guardian, restores missed Guardians or grants their currency if already passed, stops leftover skill effects from killing the next Run Portal, and corrects lost Portal Currency from the skipped-level bug on load.",
  "intentOwnerStatus": "KEEP",
  "serpPromise": "Patch 1.1.1 is the September 5 follow-up to the Mega Update. It adds an Effects Amount slider, auto-collects piled mining ore, fixes currency UI wrapping, repairs the Run Portal death skip that could skip monsters or a Guardian, restores missed Guardians or grants their currency if already passed, stops leftover skill effects from killing the next Run Portal, and corrects lost Portal Currency from the skipped-level bug on load."
}
```

Operation: CREATE for canonical route `/updates/patch-1-1-1/`.

## Must Include Facts

- Effects Amount slider added.
- Mining ore now auto-collects when too much ore piles up.
- Currency UI wrap issue fixed.
- Dying as the Run Portal dies no longer causes the next level to skip monsters or the Guardian.
- A missed Guardian can appear on the next level; if you already passed that point, the Guardian is counted defeated and currency is granted.
- Leftover skill effects no longer kill the next Run Portal.
- Lost Portal Currency from the skipped-level bug is corrected on load.

## Quick Answer direction

Lead with this verified answer, polished but not expanded beyond evidence:

Patch 1.1.1 is the September 5 follow-up to the Mega Update. It adds an Effects Amount slider, auto-collects piled mining ore, fixes currency UI wrapping, repairs the Run Portal death skip that could skip monsters or a Guardian, restores missed Guardians or grants their currency if already passed, stops leftover skill effects from killing the next Run Portal, and corrects lost Portal Currency from the skipped-level bug on load.

## Required structure

1. Quick Answer
2. Sections matching the verified claims above
3. FAQ using only verified answers
4. Short related links section pointing to:
- /updates/mega-update/
- /guides/progression/guardian-skipped-level/
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
- [Zad Archery Steam Community hub](https://steamcommunity.com/app/4412000/) — official community hub for Mega Update and Patch 1.1.1 announcements

## Media State

Media gate is N/A for update pages and PARTIAL/MISSING for verified problem/system pages. Do not invent screenshots or UI steps that are not evidenced.

## Output

Return a complete English guide article in Markdown with:
- YAML frontmatter including title and description
- H1 matching the title promise
- Quick Answer near the top
- H2 sections
- FAQ section
