# REGICIDE PVP — HANDOFF v133.0

**Written for the next context window. Next focus: AI / NPCs.**
Supersedes `REGICIDE-HANDOFF-v132.29.md`, which was fifteen versions stale.

---

## 0. Read this first

| | |
|---|---|
| **Version** | `v133.0 — THE ANVIL RESET` |
| **Assertions** | 759, all passing |
| **Determinism** | three byte-identical suite runs; off-seed run clean |
| **Worldgen hash** | `all=0fadb0bd9cbfae78 · res=263053daf3631497` · 743 nodes / 674 wood / 25 stands |
| **Source of truth** | John's Desktop: `C:\Users\John Thompson\Desktop\REGICIDE PVP\REGICIDE PVP GAME\` |
| **Deployed at** | `https://nutcrackerregicide.github.io/` — **John pushes from GitHub Desktop himself** |

The container is ephemeral. If the workspace is empty, stage the repo from the device
(`mcp__remote-devices__device_stage_files`), copy it to a writable dir, then
`npm install three@0.128.0` before the smoketest will run.

---

## 1. Standing constraints — non-negotiable

1. **Never accept a GitHub token pasted into chat.** Offered once, declined. Keep declining.
2. **`potential sounds\` must never reach GitHub.** 1,691 files / 2.6 GB of raw source audio in the
   *parent* folder. The repo root is the inner `REGICIDE PVP GAME` folder. Never stage the parent.
3. **Delivery is `SendUserFile` AND `device_commit_files`, both, every time.**
4. **Bump `sw.js` `VERSION` and `index.html` `verstamp` together, every single time.**
   A smoketest gate enforces the pair — it caught a miss at v132.51.
5. John pushes to GitHub himself. Files written to his Desktop are not live until he does.

---

## 2. The verification ritual

Run all of it before delivering. Nothing ships on one green run.

```bash
node tools/smoketest.js                 # must end ALL SMOKE TESTS PASSED
for i in 1 2 3; do node tools/smoketest.js 2>/dev/null | md5sum; done   # byte-identical
SMOKE_SEED=<anything> node tools/smoketest.js                            # off-seed
node tools/nodehash.js                  # worldgen hash must not move
tools/falsify.sh <name> <mutation.sh> <grep-pattern>                     # mutation testing
```

**`tools/falsify.sh` is the most important of these.** It copies the repo to `/tmp/fals_<name>`,
applies a deliberate break, runs the suite and greps the result. A gate that has only ever passed
is untested. Every new gate gets falsified before it ships.

---

## 3. Invariants and traps — the expensive lessons

These are all real bugs that shipped. Numbering follows the code comments.

- **#2 — the seeded window.** Geometry/materials built at load consume random draws inside
  worldgen and move every tree. Everything must be lazy. `nodehash` is the tripwire.
- **#9 — `u.body` is destroyed and geometry-disposed on every rebuild** (`04-units.js` ~2240).
  Attachments go on `u.root`, never `u.body`.
- **#12 — display code in `tickBody`'s host branch never runs on a guest.** `renderFrame` and
  `updateEffects` are what ALL frame paths call. `tickBody` also returns early on `inMenu` and
  skips its whole block on `gameOver`.
- **One namespace for 14 files.** The bundle evaluates as one script; every top-level binding
  shares scope. `_facetGeo` once collided with a function in `04-units.js`.
- **The empty-list-once pattern.** A sparse list cannot say "cleared". Needed for ring rows,
  loadouts and tmods.
- **`u.moving` is CONSUMABLE.** `animateUnit` clears it on its first line, and `updateUnitCommon`
  runs before `statusTick`. Measure position, not the flag.
- **`DEFS` vs `SND_DATA`.** `SND_DATA` is the payload, `DEFS` is the registry. `loadAll()` iterates
  `DEFS`. Embedding audio without registering it is a silent no-op — twelve cues once shipped mute.
- **Counters are never the claim.** `auraStats().live` was a variable; it reported `1` while John
  looked at thirty dots, twice. `auraStats()` now also reports `lit` / `deadLit` / `worst` / `swept`,
  measured off the colour buffer the GPU actually draws.
- **Additive materials must set `fog:false`.** r128 does `mix(rgb, fogColor, fogFactor)`, so under
  AdditiveBlending a distant fragment ADDS the fog's own colour. A *black* (expired) point becomes a
  bright white dot at range and stays invisible up close. Cost five versions. A class-level gate now
  walks the scene and fails if any additive material takes fog.
- **`sw.js` install must fetch with `cache:"reload"`.** `cache.add()` revalidates against the
  browser's HTTP cache, so a new worker could refill a new cache with stale JS — a build new in some
  files and old in others, which is a different program. GitHub Pages' CDN can still serve stale
  bytes past this, so a mixed build is not impossible even now.
- **Falsify in the right direction.** A mutation that also blinds the instrument proves nothing.
  When reverting a behaviour to test a gate, leave the bookkeeping intact.

---

## 4. What shipped since v132.49

| Version | What |
|---|---|
| v132.50 | Aura motes follow their owner (the trail was structural, not a duration); level ramp made a shape change, not just density |
| v132.51 | `sw.js` `cache:"reload"`; each effect system fenced so one throw can't freeze the others; orphaned motes die at once; mote leash |
| v132.52 | Ambient dust faded to zero by distance + `fog:false`; dust swirl was *integrating* into the position array and walking motes out of the camera box |
| v132.53 | Render-path aura sweep — a mote with no living, levelled, human owner within the leash goes dark on the frame it is drawn |
| v132.54 | **The actual fix**: `fog:false` on the aura material. The dots were dead motes painted white by the fog |
| v133.0 | John's balance pass — 39 changes, Bounty Hunter retired, Timberwright added |

**The lesson from that run:** four fixes shipped against a theory before the fifth found the cause.
The thing that cracked it was John's own bisection (`_auraPts.visible=false`) plus one console
readout. **Ask for the one datum that discriminates before shipping a theory.**

---

## 5. THE AI / NPC MAP — where the next work starts

### 5.1 The files

| File | What lives there |
|---|---|
| `js/07-ai.js` (1,285 lines) | Everything below: spawning, creep camps, directors, bands, bot brains |
| `js/00-data.js` | `PERSONALITIES` (4), `AI_DIFF` (3 tiers), `CLS` unit table, `CAMPS` |
| `js/09-main.js` | `tickBody` drives `directorThink` on each director's own clock |
| `js/10-net.js` | `driveRemote` — a **possessed** body; `updateBot` bails on `u.remote` |

### 5.2 The four layers

```
DIRECTOR   directorThink(D)      07-ai.js:391   strategy: build, train, age, raid timing
   │                                            one per team, own think clock (AI_DIFF.think)
BANDS      manageBands(D)        07-ai.js:733   operational: kingsguard, raids, siege trains,
   │                                            econ hunters, assassins, hold points, lanes
BOTS       updateBot(u,dt)       07-ai.js:936   tactical: per-unit. Dispatches on bot.role
   │
CREEPS     updateCreep(u,dt)     07-ai.js:221   neutral wilds — answer to NO director
```

- **Bot roles**: `citizen`, `cart`, `king`, `kingsguard`, `siege`, `creep`.
- **Band roles**: `kingsguard` (fills first, size scales with `D.threat`), plus raid/hold bands.
- **Lanes**: `LANE_Z=[0,48,-48,106,-106]`, `LANE_TURNIN=62` — raids flank rather than funnel down
  the road. `assignLane` deals opposite hands to the two armies.
- **Threat**: `D.threat` = enemies within 42 units of your King, weighted by distance, plus
  3× the King's missing health fraction.

### 5.3 The data

**`PERSONALITIES`** — rolled per director at construction (`mkDirector`, `07-ai.js:290`):

| | raidAt | minVills | econHunters | assassins | kgBase |
|---|---|---|---|---|---|
| `rush` | 80s | 9 | 2 | 1 | 4 |
| `expand` | 280s | 13 | 1 | 0 | 6 |
| `boom` | 400s | 14 | 0 | 0 | 7 |
| `turtle` | 600s | 12 | 0 | 0 | 9 |

Each also carries `trainW` (a weight per unit line), farm/pit/house/tower/castle/market targets,
`reserveF`/`reserveG`, and raid cadence (`raidEvery`, `raidJit`, `raidMin`, `raidFrac`).

**`AI_DIFF`** — `00-data.js:1138`:

| | think | eco | raidMul | trainMul | counter |
|---|---|---|---|---|---|
| `easy` | 2.2s | 1.0 | 1.6 | 1.6 | **false** |
| `normal` | 1.0s | 1.0 | 1.0 | 1.0 | **false** |
| `hard` | 0.6s | 1.2 | 0.75 | 0.7 | **true** |

`aiDifficulty` defaults to **`"easy"`**. `diffFor(team)` returns `"normal"` for any team holding a
human, so the dial only affects all-AI teams.

### 5.4 The three things most worth knowing before touching this

1. **NPCs have no progression at all.** `campPayParticipants` (`07-ai.js:201`) skips anything that
   fails `isHuman`, and every one of the 60 buffs is read behind an `isHuman` gate in `dealDamage`,
   `auraBuffTick` and `applyBuffStats`. A bot never gains XP, never levels, never holds a buff.
   By minute 30 a player may be carrying 25 levels and a full buff loadout against an opponent
   with none. **This is the biggest single lever available on AI difficulty, and it is untouched.**

2. **Counter-composition only exists on `hard`.** `counterWeights(team,base)` (`07-ai.js:373`)
   reweights training against what the enemy actually fields — and `AI_DIFF.counter` is `false` on
   both `easy` and `normal`. On the default difficulty the AI never answers your army composition.

3. **`updateBot` returns immediately on `u.remote`.** A human-possessed body is driven by
   `NET.driveRemote`. Any new bot behaviour must not assume it owns every unit on its team, and
   anything host-authoritative needs the guest mirror considered (see trap #12).

### 5.5 What is already tested

53 assertions touch director / band / bot / creep / camp / personality behaviour. Already exported
to the harness and callable directly: `directorThink`, `manageBands`, `updateBot`, `updateCreep`,
`campTick`, `campNewWave`, `counterWeights`, `farmAnchors`, `findFarmSpot`, `findPitSpotForFarms`,
`diffFor`, `teamHasHuman`, `PERSONALITIES`, `AI_DIFF`, `directors`, `campStates`, `CAMPS`,
`moveToward`, `steerAroundBuildings`.

So AI work can be gated the same day it is written — the instruments exist.

### 5.6 Traps specific to AI work

- **Determinism.** `mkDirector` calls `Math.random()` at construction, inside the module-eval
  window. Anything added there must not disturb the seeded draw order — check `nodehash` after.
- **The AI runs on the host only.** A guest sees bots move by snapshot. New AI state that the
  display reads must reach the guest (the `u._fx*` fields are the established pattern).
- **`bot.role` is load-bearing in three files.** `05-combat.js`, `07-ai.js` and `10-net.js` all read
  `bot.role==="cart"` and `CLS[].rig==="cart"` for trade routing and plunder.
- **Creeps aggro on damage** as well as proximity — `st.wake` lives on the camp state, so hurting
  one creep wakes the whole camp.

---

## 6. Open items — carried, still open

| Item | Note |
|---|---|
| `NET.TURN=null` | No TURN server. Needs a VPS from John. Blocks some NAT traversal. |
| No loading indicator | The first load is a blank pause. |
| No Leave button | Once in a match there is no way out but reload. |
| Repo public/private | Undecided; matters for the Epic Stock Media licence. |
| `_baseline_v129.4` gone | `artcheck.js`'s regression half is dead without it. |
| Suno anthem licence | Unresolved. |
| Incoming damage numbers | Offered, never built — damage dealt *to* you. |

---

## 7. Tool inventory worth knowing

| Tool | Use |
|---|---|
| `tools/smoketest.js` | 759 assertions. The main gate. |
| `tools/falsify.sh` | Mutation testing. Use on every new gate. |
| `tools/nodehash.js` | Worldgen determinism. |
| `tools/aurastep.js` | One subject, re-levelled, fixed camera — the level ramp by eye. |
| `tools/aurashot.js` | Aura ramp, team read, mobile no-bloom, range rule. |
| `tools/auracost.js` `ringcost.js` `drawcost.js` | Differential frame cost. |
| `tools/auraleak.js` `aurafogproof.js` `spawnlook.js` | Built during the five-version aura hunt; the pattern is reusable for any "it looks wrong" report. |
| `tools/sfxdupe.js` | Waveform duplicate screen (`tools/sfx-screen.json` is its frozen manifest). |
| `tools/artcheck.js` `vista.js` `unitshot.js` | Art regression and staging shots. |

Chromium for the shot tools: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
**Hide the DOM before screenshotting** (`document.querySelectorAll("body > *:not(canvas)")`) — an
A/B once compared two pictures of the name screen and reported a zero-pixel difference.

---

## 8. Working style that has held up

- Every change goes through a `tools/patch-*.js` script with exact-match anchors that abort on a
  match count other than 1. The scripts stay in the repo as the record of why.
- Write the reasoning into the code comment, at the line that changed, in the past tense of the bug
  it fixes. The codebase's own comments have twice contained the answer to a later bug.
- Assert the invariant, not an absolute. `after.lit===0` was wrong where
  `after.worst<=AURA_LEASH` was right.
- When John reports something visual, get the discriminating measurement before writing code.
