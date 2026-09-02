# Zad Archery Writer brief: /achievements/

This is the research/evidence boundary for one page-package Writer job. It is not final prose.

## Pack
{
  "pack": "zad-archery-research",
  "version": "1.0.0",
  "generated_at": "2026-09-02T12:45:00+08:00",
  "target_domain": "zadarchery.help",
  "target_language": "en",
  "purpose": "Research/evidence input for game-wiki-starter V4. This is not a final prose bundle.",
  "content_policy": {
    "no_invented_gameplay": true,
    "no_invented_unlock_thresholds": true,
    "no_invented_item_or_ore_names": true,
    "no_demo_claim_as_full_release_fact_without_verification": true,
    "writer_copy_status": "research_ready_not_final_editorial_copy"
  },
  "counts": {
    "sources": 15,
    "launch_ready_articles": 7,
    "hold_for_gameplay_articles": 7,
    "category_briefs": 5
  },
  "recommended_v4_flow": [
    "Research Pack",
    "Guide Content Result",
    "guide-content-adapter.ts",
    "V4 PageData / Media Binding",
    "approved Zad Archery presentation"
  ]
}

## Site identity
{
  "identity": {
    "game": "Zad Archery",
    "verified_search_variants": [
      "Zad Archery",
      "Zad Archery: Idle RPG",
      "Zad Archery Demo"
    ],
    "do_not_invent_aliases": [
      "ZA",
      "ZadArchery wiki slang"
    ],
    "steam_app_id": 4412000,
    "developer": "Samharia Studios",
    "publisher": "Samharia Studios",
    "release_date": "2026-09-01",
    "site_domain": "zadarchery.help"
  },
  "official_game_description_summary": "Incremental archery RPG/action game: clear waves of target-like monsters, collect loot, and grow through skill tree, jobs, skills, crafting, mining and later progression systems.",
  "verified_systems": [
    "Massive Skill Tree",
    "5 Archer Jobs",
    "Loot",
    "Upgradeable Skills",
    "Crafting",
    "Mining",
    "Alchemy (developer/demo sources)",
    "Gathering/Herbing (developer/demo sources)",
    "Shaping",
    "Masteries",
    "Guardian Perks"
  ],
  "platforms": {
    "steam": [
      "Windows",
      "macOS",
      "Linux"
    ],
    "steam_deck": "Playable; some controller glyph mismatch may appear",
    "mobile": "Developer linked iOS and Android versions in launch Reddit thread; mobile title is 'Zad Archery: Idle RPG'."
  },
  "length": {
    "official": "Designed around ~5 hours; build choices and loot can change duration, especially for completionists.",
    "community_launch_reports": "Several Reddit launch-day comments reported roughly 4 to 5.5 hours.",
    "claim_rule": "Use '~5 hours' as the headline estimate; label community reports separately."
  },
  "achievements": {
    "live_observed_count": 12,
    "pre_release_developer_claim": 25,
    "discrepancy": true,
    "rule": "Do not publish '25 achievements' as current fact. Page should say 12 are currently exposed by live Steam metadata as of 2026-09-02, while a pre-release announcement mentioned 25."
  },
  "launch_patch": {
    "version": "1.0.2",
    "date": "2026-09-01",
    "important_fixes": [
      "monster gems below highest level now count",
      "missing Guardian/King lock fixed",
      "Defeat the King Steam achievement fix",
      "native display resolution added"
    ]
  },
  "search_demand_context": {
    "google_trends_user_evidence": "US Trends screenshots supplied by user show Zad Archery at effectively 0 average relative interest for both past week and past month against In Stars And Time benchmark; treat as very early search demand.",
    "community_signal": "Steam discussions and Reddit already contain concrete post-purchase questions, especially playtime, demo save carryover, Steam Deck/mobile, item selling and progression.",
    "strategy": "Launch narrowly around verified questions first; expand build/mining/crafting pages only after gameplay/video evidence."
  }
}

## Article research
{
  "schema": "research-guide-content-v1",
  "slug": "achievements",
  "route": "/achievements/",
  "page_type": "article",
  "category": "Achievements",
  "priority": "P0",
  "research_status": "READY_WITH_LIVE_COUNT_NOTE",
  "primary_intent": "achievements",
  "title_draft": "Zad Archery Achievements: Current Steam List and Unlocks",
  "editorial_status": "RESEARCH_READY_NOT_FINAL_PROSE",
  "quick_answer_draft": "As of September 2, 2026, live achievement metadata exposes 12 Zad Archery achievements. They cover the main progression systems, getting legendary gear, defeating the King and reaching Level 40. A pre-release developer post mentioned 25 achievements, so the live count should be rechecked before each update.",
  "sections": [
    {
      "h2": "Current achievement list",
      "table": [
        {
          "name": "Bullseye",
          "unlock": "Destroy a target"
        },
        {
          "name": "Archer",
          "unlock": "Unlock the Archer"
        },
        {
          "name": "A New Path",
          "unlock": "Unlock the Jobs system"
        },
        {
          "name": "Artisan",
          "unlock": "Unlock Crafting"
        },
        {
          "name": "Prospector",
          "unlock": "Unlock Mining"
        },
        {
          "name": "Shaper",
          "unlock": "Unlock Shaping"
        },
        {
          "name": "Grandmaster",
          "unlock": "Unlock Mastery"
        },
        {
          "name": "Stargazer",
          "unlock": "Unlock Guardian Perks"
        },
        {
          "name": "Strongest Archer in Zad",
          "unlock": "Defeat the King"
        },
        {
          "name": "Legendary Gear",
          "unlock": "Gain a legendary bow or armor"
        },
        {
          "name": "Treasure Hunter",
          "unlock": "Open a chest"
        },
        {
          "name": "Perfectionist",
          "unlock": "Reach Level 40"
        }
      ],
      "sources": [
        "S12_ACHIEVEMENTS"
      ]
    },
    {
      "h2": "Why the count may look inconsistent",
      "claims": [
        {
          "text": "The pre-release developer announcement said 25 achievements would be available.",
          "sources": [
            "S02_STEAM_NEWS_RELEASE_INFO"
          ]
        },
        {
          "text": "The live store/achievement metadata currently exposes 12.",
          "sources": [
            "S01_STEAM_STORE",
            "S12_ACHIEVEMENTS"
          ]
        },
        {
          "text": "Patch 1.0.2 specifically fixed the Defeat the King achievement when Steam was unreachable.",
          "sources": [
            "S03_PATCH_1_0_2"
          ]
        }
      ]
    }
  ],
  "source_ids": [
    "S01_STEAM_STORE",
    "S02_STEAM_NEWS_RELEASE_INFO",
    "S03_PATCH_1_0_2",
    "S12_ACHIEVEMENTS"
  ],
  "media_slots": [
    {
      "slot": "achievement_grid",
      "preferred": "steam_achievement_icons",
      "status": "RETRIEVE_FROM_STEAM_OR_EXOPHASE"
    }
  ],
  "faq": [],
  "warnings": [
    "Live count discrepancy requires periodic recheck."
  ],
  "codex_rule": "Map evidence into existing V4 Guide Content Result. Do not invent missing mechanics. Final editorial prose may be generated by the existing writer pipeline."
}

## Source records
[
  {
    "id": "S01_STEAM_STORE",
    "tier": "A_OFFICIAL",
    "title": "Zad Archery on Steam",
    "url": "https://store.steampowered.com/app/4412000/Zad_Archery/",
    "retrieved": "2026-09-02",
    "supports": [
      "release date 2026-09-01",
      "developer/publisher Samharia Studios",
      "core systems: skill tree, 5 Archer jobs, loot, skills, crafting, mining, Shaping, Masteries, Guardian Perks",
      "Windows/macOS/Linux",
      "Steam achievements / Steam Cloud / Family Sharing",
      "14 interface languages"
    ]
  },
  {
    "id": "S02_STEAM_NEWS_RELEASE_INFO",
    "tier": "A_OFFICIAL",
    "title": "Zad Archery Releases in 24 Hours + Info",
    "url": "https://store.steampowered.com/news/app/4412000/view/703277854914249378",
    "retrieved": "2026-09-02",
    "supports": [
      "developer said game was designed around ~5 hours",
      "build choices and loot can change completion time",
      "pre-release statement claimed 7 major content systems",
      "pre-release statement claimed 25 achievements"
    ],
    "warning": "Achievement count conflicts with the live store/Exophase snapshot, which exposes 12. Treat 25 as a pre-release claim, not current truth."
  },
  {
    "id": "S03_PATCH_1_0_2",
    "tier": "A_OFFICIAL_VIA_STEAMDB",
    "title": "Patch 1.0.2",
    "url": "https://steamdb.info/patchnotes/25063956/",
    "retrieved": "2026-09-02",
    "supports": [
      "monster gems below highest level bug fixed",
      "missing Guardian could lock the King and was fixed",
      "Defeat the King achievement unlock issue fixed",
      "native screen resolution option added"
    ]
  },
  {
    "id": "S12_ACHIEVEMENTS",
    "tier": "B_LIVE_METADATA",
    "title": "Zad Archery Achievements - Exophase",
    "url": "https://www.exophase.com/game/zad-archery-steam/achievements/",
    "retrieved": "2026-09-02",
    "supports": [
      "12 currently exposed achievement names and unlock descriptions"
    ]
  }
]

## Writer constraints
Use only supplied evidence. Do not invent mechanics, thresholds, item names, locations, counts, or current-build behavior. Return the existing page-package JSON contract. Keep any caveat and live-count discrepancy explicit.
