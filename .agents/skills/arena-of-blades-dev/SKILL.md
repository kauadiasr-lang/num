---
name: arena-of-blades-dev
description: Use when working on the Arena of Blades codebase (vanilla HTML5/Canvas/JS RPG at this repo root) — implementing features, fixing bugs, or auditing architecture. Covers the project's real conventions, testing method, and known scalability limitations. Do not use for unrelated projects.
---

# Arena of Blades Development

## Overview

Arena of Blades is a single-player browser RPG: vanilla HTML5 Canvas + JS,
**no build step, no framework, no module system**. Every file in `js/` is a
classic `<script>` loaded in a fixed order by `index.html`, sharing one
global scope via `window.*`.

**The real architecture is the source of truth — never assume this project
uses a technology just because it's common in web games.** Before writing
any code, read `/CLAUDE.md` at the repo root — it's the maintained map of
systems, conventions, and known limitations. This skill tells you *how to
work*; CLAUDE.md tells you *what exists*. Read both; keep CLAUDE.md updated
when you change something it documents.

## Before touching code

1. Read `/CLAUDE.md`.
2. Grep for the actual usage of whatever you're about to change — this
   codebase has ~180 completed iterations of prior work; assume there's
   history and prior intent behind what looks unfinished or odd.
3. Check `docs/superpowers/specs/` and `docs/superpowers/plans/` for any
   existing design doc covering the area you're touching (e.g. the
   world/road travel redesign). Don't re-derive a design that's already
   written down.
4. Identify every caller/dependency of what you're changing (`grep -rn` for
   the symbol across `js/*.js` — everything is a global, so this is
   reliable). This project's global-scope-everything style means an
   innocent-looking rename can break a dozen unrelated files silently if
   you don't check first.

## Working rules

- **Never reach for a framework, bundler, TypeScript, or npm dependency.**
  If the task seems to need one, that's a signal to reconsider the
  approach, not to introduce one.
- **Follow the data-driven-registry pattern already established**
  (`CityDatabase`, `QUEST_DEFS`, `ItemDatabase`, encantamentos, linhagens):
  new *content* is a new entry in a table; new *mechanics* are a new field
  on the table that existing generic code reads. Avoid
  `if (id === 'specific_thing')` branches when a data field would do — but
  don't force this pattern where the codebase doesn't already use it.
- **Don't rewrite a working system because it's imperfect.** Classify
  problems (🔴 critical / 🟠 important / 🟡 moderate / 🟢 minor) before
  deciding what to touch, and fix in that priority order. A system that
  "works but would be hard to extend later" is 🟠, not a rewrite mandate —
  document it and get explicit sign-off before a large refactor.
- **Combat has a distance/range gate that runs before everything else**:
  `BattleSystem`/`ai.js` block ATK/SKILL when `battle.distance` is outside
  `enemy.getWeaponRange()` — checked before any AI scoring or player-action
  validation. Any test or new mechanic touching combat must account for
  this or it will silently produce wrong results (this has bitten prior
  sessions repeatedly — always verify distance is in-range in isolated
  tests).
- **HP/MP sentinels are `-1` for "uninitialized"**, never `0` — `0` is a
  legitimate "just died" combat state and colliding the two caused a real
  save/revive bug previously. Don't reintroduce `0` as a sentinel anywhere
  in `Entity`-derived code.
- **Save compatibility**: any new field on `player` needs a defensive
  fallback (`p.field || default`) at the point of use for saves created
  before the field existed. Structural format changes need real migration
  logic (see `save.js` `_migrateLegacySave`, `mainmenu.js`
  `loadSlotAndEnterHub`) — don't silently drop old-save data.
- **Preserve everything that currently works.** This is a live game with a
  lot of accumulated correct behavior; a change that fixes one thing while
  breaking another is a net loss. Test the surrounding functionality, not
  just the thing you changed.

## Testing

There is no automated test suite in the repo. The established method for
this project:

1. Serve the repo: `python3 -m http.server 8877 --directory <repo root>`
   (check with `curl -s -o /dev/null -w "%{http_code}" http://localhost:8877/index.html`
   before assuming it's already running — containers restart and lose it).
2. Write a small standalone script under `/tmp/pw/*.js` (or your
   environment's scratch dir — never commit these) using Playwright:
   ```js
   const { chromium } = require('/opt/node22/lib/node_modules/playwright');
   const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
   ```
   Drive a real flow: main menu → new game → character creation →
   `#screen-hub.active`, then use `page.evaluate` to call/inspect
   `window.Engine`, `window.City`, `window.BattleEngine`, `window.AICombat`,
   etc. directly. Capture `console` (`type()==='error'`) and `pageerror`
   events and assert zero.
3. Run with `node /tmp/pw/yourscript.js`.
4. For combat-specific tests, manage `battle.distance` against
   `enemy.getWeaponRange()` explicitly in your test loop (approach first if
   out of range) — see the working rules above.
5. Minimum regression pass before calling a change done: init loads clean →
   character creation → movement → camera follows player → city
   interaction → combat resolves (win or lose, doesn't stall) → inventory
   opens → save → reload page → load slot → key player fields match →
   zero console errors across the whole run.

For code review after a change, use this repo's `code-review` skill at
`high` effort for a "how could this break?" pass — don't build a separate
adversarial-review skill for this project; the generic one plus the rules
above is enough context.

## Preparing for scale (read before large-architecture changes)

Arena of Blades is expected to grow into a much bigger world (more cities,
a capital, submaps, dungeons, more NPCs, quests, wandering encounters).
`/CLAUDE.md`'s "Limitações conhecidas" section lists the specific points in
the current code that assume a small/single/fixed world (fixed building
list per city, small NPC population cap, single-enemy battles, no
world-positioned enemies outside battle). When a task touches one of these,
re-read that section first — it has exact file:line pointers — and treat
generalizing it as its own scoped, tested change, not a side effect of an
unrelated task.
