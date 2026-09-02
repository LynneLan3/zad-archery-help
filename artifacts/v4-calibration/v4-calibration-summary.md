# G016 V4 Calibration Preview

Calibration surfaces are ready for User Product Review. The preview is served
from `/v4-preview/`; the debug-only raw renderer remains under `/v4-debug/`.

## Homepage

- URL: `/v4-preview/`
- Prototype: discovery homepage
- Player task: choose a useful next task
- Primitive recipe: compact identity, Hot Now, Start Here, Primary Tool, Browse by Task
- Media used: none
- Interactive behavior: whole-surface navigation with hover and focus states
- Desktop: `artifacts/v4-calibration/homepage/desktop.png`
- Mobile: `artifacts/v4-calibration/homepage/mobile.png`

## P1 Entity — Ember Core

- URL: `/v4-preview/ember-core/`
- Prototype: P1
- Player task: entity-lookup
- Primitive recipe: A01, A02, E01
- Media used: media-1, Ember Core crystal
- Interactive behavior: task-oriented related link; identity evidence is adjacent to the answer
- Desktop: `artifacts/v4-calibration/p1-entity/desktop.png`
- Mobile: `artifacts/v4-calibration/p1-entity/mobile.png`

## P4 How-to — Forge Guide

- URL: `/v4-preview/forge-guide/`
- Prototype: P4
- Player task: procedure
- Primitive recipe: A01, P01, P02, P04
- Media used: forge step evidence
- Interactive behavior: numbered action sequence with supporting step media and next task
- Desktop: `artifacts/v4-calibration/p4-how-to/desktop.png`
- Mobile: `artifacts/v4-calibration/p4-how-to/mobile.png`

## P5 Location — Cinder Marsh Map

- URL: `/v4-preview/marsh-map/`
- Prototype: P5
- Player task: location
- Primitive recipe: A01, L01, L02, L03
- Media used: Cinder Marsh map
- Interactive behavior: real markers expose selection state; route is a waypoint sequence
- Desktop: `artifacts/v4-calibration/p5-location/desktop.png`
- Mobile: `artifacts/v4-calibration/p5-location/mobile.png`

## P7 Mechanics — Heat System

- URL: `/v4-preview/heat-system/`
- Prototype: P7
- Player task: mechanics
- Primitive recipe: A01, A03, X03, X04
- Media used: none; the page intentionally stands without media
- Interactive behavior: calculator inputs recompute the result and interpretation
- Desktop: `artifacts/v4-calibration/p7-mechanics/desktop.png`
- Mobile: `artifacts/v4-calibration/p7-mechanics/mobile.png`

## P9 Tool — Armory / Planner

- URL: `/v4-preview/armory-db/`
- Prototype: P9
- Player task: tool-database
- Primitive recipe: A01, X01, X02, E03, X05
- Media used: none; the utility surface is data-first
- Interactive behavior: filter, sort, planner local state, local Save, and deterministic Share URL
- Desktop: `artifacts/v4-calibration/p9-tool/desktop.png`
- Mobile: `artifacts/v4-calibration/p9-tool/mobile.png`

## Retained omission case

`/v4-preview/unmapped-location/` retains L01 without L02 when map support is
unavailable; the location page remains complete and does not render a null or
generic map placeholder.
