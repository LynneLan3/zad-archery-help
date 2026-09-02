# Content policy

## Core principle

Every Guide exists to answer a single player search intent backed by reliable evidence.

```text
Search Intent → Immediate Answer → Structured Facts → Detailed Evidence → Next Intent
```

Do not invent facts, dates, prices, reviews, characters, items, bosses, quests, or mechanics.
Prefer official site / store / developer statements over secondary blogs.
Separate confirmed statements from speculation; use page `status` honestly.
V2 Launch has no fixed Guide count. Ship the smallest complete cluster supported by distinct player search intents and sufficient evidence.
Do not fabricate articles to hit a quota or fill Hub cards, and do not omit a strong launch-critical intent merely to stay below an arbitrary count.
Chinese copy should be natural and direct — avoid mechanical translation tone.
If evidence is insufficient, omit the page and record why in research notes.

---

## Primary Intent rule

`intents[0]` is the **Primary Search Intent** — the single reason a player would search for and open this page.

`intents[1...]` are supporting intents or entities that the page naturally covers.

One Guide solves one primary search task. Do not combine unrelated tasks (weapons + bosses + classes + map) into a single page.

Before the generator dry-run, check every CREATE Guide from its Research Packet through its Primary Intent to its Quick Answer, Facts, and H2 coverage. Preserve important supported facts needed for that intent's useful answer; do not silently omit them. This is a lightweight authoring check, not a requirement to include every research fact. Unknown facts remain unknown and must not be fabricated.

A Guide does not need every possible sub-fact to be known. It may ship when
the Primary Search Intent is distinct and evidence supports a useful direct
answer; unknown sub-facts must be marked unverified. Thus an evidence-backed
CO-OP answer need not wait for every PC / PS5 / Xbox crossplay combination,
and a WEAPONS answer need not wait for DPS, final stats, or unlock costs if it
can cover weapon-pool behavior, Weapon Rank, Affixes, and known identities.
A BOSSES page may separate official structure from playtest/community-observed
encounters rather than imply an incomplete final list is official.

Generic `<game> guide` and `<game> wiki` intent normally belongs to the
Homepage. Add an `/overview/` Guide only for a distinct Primary Search Intent.

---

## Guide Content Contract

Core Guides follow this content responsibility order (not a Markdown template — a logical structure):

```text
Eyebrow           game-world context / guide type
Title              SEO title answering the primary intent
Description        one-sentence page scope (not the answer)
Hero               visual establishing context (when cover exists)
Facts              2–4 high-confidence structured facts
Quick Answer       1–3 sentences directly answering the primary intent
H2 sections        3–5 real player tasks or questions
Evidence/Sources   provenance for claims
Next Questions     1–3 next intents the player is likely to pursue
```

---

## Eyebrow

Use for game-world context or guide type:

```text
Weapon Location    Boss Fight    Puzzle Solution    Quest Step
Starter Route      Character Guide    Class Guide    Build Guide
Map Location
```

Game-specific phrasing is fine when a normal player would understand it (e.g. `Shrine Trial`, `Hunter's Notes`).

Prohibited:

```text
Ultimate Guide    Best Guide    Complete Guide    2026 Guide
Everything You Need    SEO Guide
```

Do not mechanically repeat the H1 keyword.

---

## Facts

2–4 per page. Do not invent facts to fill all 4 slots.

Must satisfy: *a player should know this within 3 seconds and the claim has sufficient evidence.*

By guide type:

| Type | Example labels |
| --- | --- |
| Weapon/Item | Location, Requires, Reward, Build |
| Boss | Location, Weakness, Reward, Required Item |
| Quest | Starts At, Requires, Objective, Reward |
| Character | Location, Role, Faction, Availability |
| Release | Release Date, Platforms, Developer, Price |

Prohibited uses:

- keyword tag cloud
- unverified speculation (`Difficulty: Hard`, `Best Weapon: X`, `Playtime: 40 Hours`)
- repeating title/description content

If evidence is insufficient: fewer facts, not guesses.

---

## Quick Answer

First priority: **directly answer the Primary Intent**.

Wrong: `Mortal Shell II is an upcoming action RPG...`
Right: `The Axe & Dagger is obtained by using the Chapel Key at the Shrine of Trials.`

1–3 sentences that can stand alone as an answer.

Quick Answer ≠ Description:

```text
Description  = page coverage scope
Quick Answer = the answer to the search question
```

---

## H2 sections

3–5 main H2s per core Guide.

Prefer real player tasks or questions:

```text
Where is the Chapel Key?
How do you reach the Shrine of Trials?
How do you solve Gaze Upon Your King?
```

Not mechanical filler:

```text
Overview    Background    Details    Conclusion
```

The Experience Guide derives its inline On This Page block from authored H2s. Do not author a manual On This Page list in page content or spec data.

---

## Images

Use existing `coverAssetId` and `evidence` — do not add new image schema.

Every image must have a semantic purpose:

```text
location    route    item appearance    puzzle state
boss arena    UI confirmation    before/after state
```

Do not add decorative images to meet a per-page minimum.

- **Hero** (cover): establishes the page theme/scene.
- **Evidence** images: prove specific claims.

---

## Sources and evidence status

Use existing page `status`, `sources`, and `evidence.sourceType` for their
existing contracts. For page-level trust/freshness metadata, use the optional
`trust` object: `status`, `lastVerified`, `appliesTo`, and typed `sources`.
`lastUpdated` remains the editorial modification date and must not be used as
the verification date. Trust is declarative; do not infer outdated status from
age or introduce autonomous freshness checks.

Distinguish clearly:

```text
Official            → confirmed
Firsthand/verified  → confirmed or verified
Community report    → needs-verification
Unknown             → needs-verification
```

Do not present community speculation (YouTube, Reddit) as confirmed fact without independent verification.

---

## Next Questions (`next-step`)

1–3 per core Guide using `relations[].type: next-step`.

Selection criterion: *what will the player ask next after solving this page's problem?*

```text
Axe & Dagger Location → Chapel Key → Other Weapon Locations → Best Early Weapons
```

Do not mark every same-category page as `next-step` just for internal linking.

---

## `related` vs `next-step`

```text
next-step  = player's next decision/question in their journey
related    = laterally relevant reference material
```

These are not synonyms. The frontend already deduplicates them at render time.

---

## Homepage: Start Here

`homepage.startHere` is **player task navigation**, not a recommended-articles list.

3–4 entries framed as tasks:

```text
New Player    Find Weapons    Explore the World    Progress Further
```

Or game-appropriate:

```text
Choose a Class    Find Items    Solve Puzzles    Beat Bosses
```

Prefer pages with cover/image. Do not simply pick one article per category.

---

## Homepage: Popular Questions

Source from real player demand:

```text
GSC queries    Google suggestions    YouTube questions
Reddit questions    Steam discussions    verified recurring player questions
```

Do not invent questions to fill slots.

`context` provides a brief answer-scope hint — do not repeat the question.

---

## Category vs Intent vs Start Here

```text
Category    = browse / sidebar / backend organization
Intent      = search semantics (intents[] field)
Route       = player journey / task path (routes[])
Start Here  = player task entry points on the Hub
next-step   = player journey links between Guides
```

Category does not carry all content relationships. Do not create `/topics/*`.

---

## Pre-release vs Launch content

### Pre-release

Only write what current evidence supports. Avoid speculation. Mark status as `pre-release`.

### Released

Replace pre-release predictions with verified launch information from gameplay, official patches, or verified video. If a page still has only pre-release evidence, mark it for follow-up research — do not present old predictions as launch facts.

---

## New site planning sequence

```text
 1. Research real player demand
 2. Define Primary Intents
 3. Plan Guide pages
 4. Assign Categories
 5. Evaluate whether Player Routes are justified
 6. If justified, order route.pages
 7. If justified, define route Fast Answers
 8. Configure Homepage Start Here
 9. Configure Popular Questions
10. Add eyebrow / facts / quickAnswer
11. Add evidence / sources
12. Define next-step relations
13. Assess visual state and assign useful visuals
14. Generate and validate
```

Intent first, conditional route journey second, category fallback third. For
each Guide, plan a Homepage inbound entry, a likely next-step, and lateral
related references when supported by the player journey; these are semantic
choices, not quotas. Structural orphan/link checks cannot prove that those
choices are meaningful.

V2 trust/freshness is page-level: retain provenance, evidence status, page
status, applicable release/build context, and available reviewed/updated
metadata. Claim-level invalidation and GSC/CTR restructuring remain V3.
