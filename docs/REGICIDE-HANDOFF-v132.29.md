# REGICIDE PVP — Handoff v132.29 (August 2026)
Read this at the start of a new chat to continue. Supersedes `REGICIDE-HANDOFF-v132.28.md`.
Companions, still authoritative in their lanes: `claude/REGICIDE-DEPLOY.md` (hosting, and the
asset-licence problem) · `claude/REGICIDE-MAP-REWORK.md` (the v132 map programme, complete) ·
`claude/REGICIDE-WALLS-AND-GATES.md` · `claude/REGICIDE-ART-DIRECTION.md` +
`claude/REGICIDE-ART-WORK-PLAN.md` (the law for anything visual) · `claude/REGICIDE-HANDOFF-v130.md`
(the art overhaul — its five root-cause bugs and its "do not shrink the head" warning are still
live) · `claude/REGICIDE-HANDOFF-v129.4.md` (netcode).

**On disk: `v132.29 — THEY MEAN BUSINESS`. PROTO 34.** Next version: **v132.30**.
v132.28 (the questing/levelling spine) and v132.29 (the level aura) shipped in one session; both
are described below. The aura is cosmetic and added NOTHING to the wire, so PROTO stayed at 34.

> ### ⚠ THE CONTAINER CAME UP EMPTY THIS TIME — NOT ROLLED BACK, *GONE*.
> `/root/regicide` did not exist at all: no repo, no `tools/`, no `.git`. This is the third
> incident of its kind and it is worse than the v132.27 rollback. **JOHN'S DISK IS THE SOURCE OF
> TRUTH.** Recovery took ten minutes and worked cleanly:
> `device_list_dir` the game folder → `device_stage_files` every `js/*.js`, `index.html`, `sw.js`,
> `libs/`, `css/`, `assets/anims.js` → `npm install three@0.128.0 playwright-core` → `node --check`.
> Confirm you have the real build by the census, not the version string:
> **743 nodes / 674 wood / 25 stands**, `NET.PROTO`, and `verstamp`.
>
> **`tools/` SURVIVED on John's disk this time** (70 files) — but `bazaars.js`, `nodefair.js`,
> `nodeplan.js`, `mapsurvey.js` and `_standcap.js` are still missing and were **not** rebuilt this
> session. `nodehash.js` **was** rebuilt (see §3).

> ### ⚠ THE SMOKETEST WAS LYING IN FIVE PLACES, AND THE GAME WAS INNOCENT IN ALL FIVE.
> Every one was verified by direct measurement *before* being touched. Details in §2. The lesson is
> the standing one: **a red is not automatically the game's fault, and a green is not automatically
> a pass.** Two of the repairs I wrote were themselves wrong on the first attempt.

---
## 1. HANDLING RULES — standing and non-negotiable
- **Do not accept a GitHub token pasted into chat.** Offered once and declined; keep declining.
- **`potential sounds\` must never reach GitHub** — 1,691 files, 2.6 GB in the *parent* folder. The
  repo root is the inner `REGICIDE PVP GAME` folder. Never stage the parent. (John granted read
  access to `potential sounds\sfx` this session for buff-sound mapping — **filenames only, nothing
  copied near the repo**.)
- **Delivery is `SendUserFile` AND `device_commit_files`**, to
  `C:\Users\John Thompson\Desktop\REGICIDE PVP\REGICIDE PVP GAME\`. Both, every time.
  **v132.28 and v132.29 were both committed to John's disk once the bridge came back.**
- **Bump `sw.js`'s `VERSION` and `index.html`'s `verstamp` together, every single time.**
- **The working method John keeps asking for:** fan out sub-agents, loop with harsh critics, measure
  before and after, and *falsify your own gate before believing it*.

---
## 2. THE ONE DISCIPLINE THAT MATTERS MOST HERE
**Gates that measure things invisible to the eye have been reliable. Judgements about how something
looks have been wrong repeatedly.** And: **a gate that passes on its first run has not been tested.**

The five stale assertions, all measured before being touched:

| assertion | truth |
|---|---|
| `stone: exactly 5 piles` | the map has **6** since v132.24 |
| `PROTO===30`, twice | it was **33** |
| `TREE_STANDS.length%2===0` | **25**, and correct — under the x-mirror a stand on `x=0` is its own partner |
| `every stand is mirrored 180°` | measured x-mirror **true**, 180-mirror **false**. v132.25 retired that convention; the gate was demanding the thing the map programme deliberately removed |
| tree clearing | picked the first of **634** candidates through a filter that never excluded **roads**, and landed on one of the 22 sitting on the King's Road. 612 were buildable. The game was right |

**Then two of my own repairs failed the same way, and this is the more useful half of the lesson:**
- The differential I wrote printed `false -> false` — it passed while proving *nothing*, because the
  site it sampled was blocked with the timber and without it. Replaced with a **sweep of every
  candidate tree** (474 sites, 0 differ, 456 buildable) plus an explicit **non-vacuity** check.
- My "the stone is the sole reason it is blocked" clause was simply **false**: the four off-axis
  piles sit inside v132.24 resource **clusters**, so removing the stone leaves a neighbour covering
  the footprint. Only the two axis piles free up. Now asserts what is true.
- And the stone gate then **flaked 6/6 → 5/6** between runs: the campaign *mines a pile out*, and a
  spent pile correctly stops refusing a plot. The invariant is about **live** piles.

### ✅ §7's LAST OPEN ITEM IS CLOSED: THE HARNESS IS SEEDED
Three assertions flaked across runs — TURTLE (~1 in 3), "a band is dispatched to the distress
point", and "driveRemote: fake guest gathers". All campaign nondeterminism, none of them bugs, and
every one of them trained the reader to shrug at a red.

`tools/smoketest.js` now installs `Math.random=mulberry32(SMOKE_SEED)` **before the bundle is
evaluated**. This is safe against the seeded window: `js/02-world.js:203` captures
`__realRandom=Math.random` at load, installs its own `mulberry32(0x20260710)` for world gen, and
restores the capture at `:2416`. World gen is untouched; everything below the handback becomes
reproducible. `SMOKE_SEED=<n>` overrides, to sweep a suspect assertion across seeds.

**Result: 533 assertions, 0 failures, three byte-identical logs.** A red now means a regression.

---
## 3. `tools/nodehash.js` WAS REBUILT — AND THE OLD DIGESTS ARE DEAD
The original was lost. A different hash construction over identical data yields a different digest,
so **the recorded `all=27c3c30b9234448b · res=fc5de53990586a44` are meaningless against the new
tool** and would read as a moved world. The **counts** still carry and are asserted.

The replacement is used **differentially**, which is stronger than a stored constant:
```
ROOT=/tmp/pristine node tools/nodehash.js     # untouched staging copy of John's disk
ROOT=/root/regicide node tools/nodehash.js    # the patched tree
```
**v132.28 baseline (record this): `all=0fadb0bd9cbfae78 · res=263053daf3631497`, 743 nodes,
674 wood, 25 stands.** Pristine and patched matched exactly — **the world did not move.**

---
## 4. WHAT SHIPPED THIS SESSION — v132.28, the questing/levelling spine
John's brief: max level 25 · a level aura · the CSV's new quests and buffs · participation XP for
creep camps and the Viking raid. He chose **spine first, the 42 new buffs in later batches**, and
**keep the full death wipe**.

| # | change | where |
|---|---|---|
| 1 | `XP_MAX_LVL` **20 → 25** | `00-data.js:880` |
| 2 | Every quest carries an **`age`** (John's "Age Available" column) | `00-data.js` QUESTS |
| 3 | **Perfect Guard deleted**; seven new postings added → **31 quests** | `00-data.js` QUESTS |
| 4 | The board **deals only what your age has unlocked** | `09-main.js` questDraft |
| 5 | **Participation tracking** — the first contribution state this game has ever had. Pays **XP and levels** | `05-combat.js` + `07-ai.js` |
| 6 | Six new progress hooks wired (the seventh fires free) | `05-combat.js`, `09-main.js`, `10-net.js` |
| 7 | The **death-wipe hole** plugged; quest HUD repaints on respawn | `05-combat.js`, `08-ui.js` |

**The seven new postings** (ids and names mine; desc/n/xp/age John's). `n` was read from the
DESCRIPTION where the CSV carried a placeholder `1` — ox_wood **300**, heal_hp **200**,
build_tower **2**. Two scalars corrected to the CSV: `camp1` xp 2→1, `res2` xp 1→2.

| id | name | ev | n | xp | age |
|---|---|---|---|---|---|
| `oxplun1` | Highwayman | `plunder_ox` | 1 | 2 | 0 |
| `trplun1` | Road Agent | `plunder_tr` | 1 | 2 | 3 |
| `oxwood` | Timber Haul | `ox_wood` | 300 | 1 | 0 |
| `grand1` | Lord of the Crossroads | `cap_grand` | 1 | 3 | 0 |
| `heal200` | Field Surgeon | `heal_hp` | 200 | 2 | 3 |
| `horse1` | Horsebane | `counter_cav` | 1 | 1 | 0 |
| `tower2` | Watchwarden | `build_tower` | 2 | 1 | 3 |

Cumulative pool by age: **0:18 · 1:20 · 2:21 · 3:29 · 4:30 · 5:31.**

### 4.1 PARTICIPATION — the new system, and the one design call to review
Nothing in this game had **ever** tracked contribution. Every credit path — score, quests, the kill
streak — reads a single `killer` argument and pays the last blow. John's rule: **any damage to any
member of the camp puts you on the list.**

Recorded at the **v132.10 wake site** (`05-combat.js:370`) — the one place that already knows "a
camp member was hurt, and by whom", and which already excludes towers and the wilds for its own
reasons. One site, one truth. The list lives on the **camp state**, so it survives the death of any
individual creep, and is cleared on payout and on a fresh wave.

Pays **1** per wild camp and **15** for the Viking raid, as **both XP and levels** (`campPayParticipants`, `07-ai.js`).
**CAMP BREAKER moved with it** — the last-hit call in `killUnit` is gone; the quest now completes
for every participant.

> **PARTICIPATION PAYS XP *AND* LEVEL — John's ruling.** I shipped it XP-only first, reasoning that
> decoupling the two was the fix for the unreachable forge (old §5.3 #2); John's call is that
> clearing a camp should advance a player exactly as a finished quest does. Done.
> **Level clamps at `XP_MAX_LVL`; XP does not** — that asymmetry is what keeps the forge reachable
> once a player is capped, and it is separately gated.
>
> **Two consequences, both live, neither decided by me:**
> 1. **THE BOARD CLOSES AT THE CAP.** `questPick` refuses when `lvl >= XP_MAX_LVL`
>    (`09-main.js:399`). The raid pays **15 of 25**, so **two raids cap a player** and their Town
>    Board stops accepting work for the rest of that life. Before this, reaching the cap took ~25
>    finished quests. The notification now warns the player when it happens. Worth a playtest —
>    if it bites, the options are a smaller raid award, a higher cap, or letting the board stay
>    open at the cap.
> 2. **REROLLS WERE REWORKED — see §4.4.** The old per-level banking is gone, so participation
>    levels no longer mint rerolls (the raid would otherwise have handed out fifteen at once).

Known and accepted: a participant who **dies and respawns** before the wipe still collects (they are
alive at payout). Death already zeroed their XP, so it is a small gift, not an exploit.

John's ruling on the raid: **15 XP to every participant IS the edge** — no extra buff or unlock. The
twin 500 food / 500 gold chests are unchanged.

### 4.4 REROLLS — reworked (v132.28.2, John)
**Capped at 3 (`QUEST_REROLL_MAX`, 00-data.js), and earned ONCE PER QUEST OPPORTUNITY.** The v99
rule — one banked reroll per LEVEL gained, in `completeQuest` — is **replaced, not supplemented**.
It had also become quietly wrong this version: participation now grants levels, so camps and the
raid would have minted rerolls as a side effect, **fifteen at once off a single raid**.

Implemented as a **cycle flag in `questTick`**, not as a grant bolted onto `completeQuest`, because
"free to take a posting" has three entrances and only one of them is finishing a quest: the
**start of a life**, **finishing a quest**, and **respawning after death**. The grant fires on the
*transition* into questlessness and re-arms only when a posting is taken, so one rule covers all
three and it cannot pay twice for the same opportunity.

> ⚠ `u._rrCycle` **must** be cleared wherever death clears the quest, or a player who died while
> questless carries the spent cycle into the new life and is never granted their reroll. Both wipe
> sites are patched — `killUnit` (05-combat.js) and the deserter path (10-net.js:700).

Gated four ways, each falsified: levels alone bank nothing · becoming questless banks exactly one
however many ticks pass · taking a posting re-arms the grant · twelve opportunities still cap at 3.

No wire change: a guest reroll count rides `qdraft.rr`, sent when the board opens — which is the
only moment it can matter.

### 4.5 THE LEVEL AURA — v132.29, and the lesson in it
John's three rulings: **rising motes** · **team-tinted low, gold at the cap** · **readable only
once you are close** (the v125 "you should have to scout for it" precedent).

**THE GATES ALL PASSED WHILE THE FEATURE WAS INVISIBLE.** One draw call, pool ceiling, range gate,
colour ramp, no allocation — every one green on the first run, and the first render showed
essentially nothing. §2 says a gate that passes on its first run has not been tested; the sharper
version this version taught is that **a gate can be correct and still measure the wrong thing.**
Those gates measured the MECHANISM. Nothing measured the READ. Five tuning passes followed, each
one found by LOOKING at `tools/aurashot.js` output, none by a test:

| pass | what the picture showed |
|---|---|
| 1 | `0.42` world-space motes were flatly invisible in daylight |
| 2 | `AURA_HOT=3.2` drove every channel past 1.0, so gold **clipped to white** — the ramp's whole point, gone. Intensity must stay near 1.0-1.4 and let BLOOM supply the glow (threshold 0.86, §4.6) |
| 3 | the fade **compounded** per tick (`col *= k` each frame), so a mote was at a third brightness within half a second and only ~5 were ever bright. Fixed by storing a per-mote BASE colour and fading as `base * (life/LIFE)^0.55` |
| 4 | sized for close-up, the rank at a normal ~30-unit camera photographed as **plain units** |
| 5 | sized for distance (`2.3`), the near end blew out: with the composer OFF — every mobile player — the raw discs washed over the nutcracker faces, breaking §5's silhouette priority |

**A world-space mote cannot serve both ends of a 34..62 range gate.** It is `sizeAttenuation:false`
now — a constant ~11px screen footprint that reads at the far edge without swallowing the unit at
the near one. ⚠ Screen-space size does not scale with devicePixelRatio; if it reads differently on
a real phone than in `aurashot`, that is the reason.

**HOW IT IS BUILT.** ONE pooled `THREE.Points` for the whole scene (`AURA_MAX` 320 slots,
additive, per-vertex colour): one draw call for every mote in the game at any player count, and
zero allocation after warm-up. `puff()` was the obvious reuse and is the WRONG tool — it mints a
Sprite AND a SpriteMaterial per call and only does `scene.remove` on expiry, so a continuous
emitter leaks a material per mote and costs a draw call per mote. Additive blending is load-bearing:
"fade" is just multiplying the vertex colour toward black, because `PointsMaterial` opacity is
per-MATERIAL, and that single fact rules out one-sprite-per-mote sharing a material.

**WHERE IT IS DRIVEN, AND THE TRAP THAT DECIDED IT.** From inside `updateEffects(dt)`. tickBody's
copy sits inside `if(!gameOver)` in the HOST branch, which a guest never reaches — that is trap #12,
the v128.8 objective ribbon. So it was VERIFIED, not assumed: `NET.guestFrame` calls updateEffects
at **10-net.js:2133**. Both frame paths provably run it, it is already spied by the v127 wiring
probe, and it does not run in the menu or after a regicide.

**THE SEEDED WINDOW.** Points, BufferGeometry, PointsMaterial and DataTexture each mint a uuid and
`generateUUID()` draws FOUR randoms (invariant #2). All are created LAZILY on first emit, which
cannot happen during world gen. nodehash confirmed unchanged.

**EVERY DIAL IS IN ONE PLACE**, `00-data.js` beside `XP_MAX_LVL`: `AURA_MAX` 320 · `AURA_NEAR` 34 ·
`AURA_FAR` 62 · `AURA_RATE_LO` 2.6 · `AURA_RATE_HI` 34 · `AURA_LIFE` 1.45 · `AURA_RISE` 1.55 ·
`AURA_R` 0.78 · `AURA_GOLD` 0xFFC64A · `AURA_HOT` 1.38 · `AURA_SIZE` 11 (pixels).

> ⚠ **OPEN, AND IT IS JOHN'S TASTE, NOT A BUG:** at these values the aura preserves the nutcracker
> faces but reads SUBTLE — arguably not "super saiyan" at 25. Pushing it costs face readability up
> close, worst on mobile where there is no bloom to tame it. He has the contact sheet
> (`_aura/03-teamread`, `04-cap-bloom`, `05-cap-nobloom-mobile`). Re-shoot with
> `node tools/aurashot.js` after any change to those dials.

### 4.2 The six hooks
`plunder_ox` · `plunder_tr` (**two** sites — the human trader and the AI's NPC cart, whose branches
end in **byte-identical lines**, so each is anchored with its whole `else if`) · `counter_cav`
(read as *cutting down* a horseman: `line==="anticav"` — the same key `rps()` reads for the 3.8×
counter — against `mounted`) · `ox_wood` (**two** sites: local player *and* the host-driven remote
human; missing the second is how a feature ships working for the host and dead for everyone else) ·
`heal_hp` (fractional HP; the HUD now **rounds for display**, `quest.prog` stays exact) ·
`cap_grand` (the only one needing new state — `bazaarTick`'s occupancy loop counted heads and threw
the names away).

### 4.3 The death-wipe hole
The guard read `lvl || xp || quest || buffs` but the body it guards also clears `questDraft`,
`qRerolls`, `_scoutOut` and `smithOffer`. A **fresh** player who drew a trio and died kept it. The
guard now tests everything the body clears.

---
## 5. THE INVARIANTS THAT WILL BITE
1. **THE SEEDED WINDOW.** `js/02-world.js` runs world gen under `mulberry32(0x20260710)` (~line 204)
   and hands back at ~line 2416. `nodes[]` is indexed **positionally** by the netcode.
2. **THE UUID TRAP.** r128 mints a uuid in `BufferGeometry`, `Material` **and** `Object3D`, and
   `generateUUID()` draws **four** randoms. Build cosmetics **below the handback**.
3. **`tools/nodehash.js` is the only way to know whether a change moved the world** — see §3, and
   note the digests were re-baselined this version.
4. **PROTO bumps are decided by the hash and the wire, not by judgement.** 26 → 34 so far.
   **v132.28's bump is because QUESTS is POSITIONALLY indexed** (`qst.qi`, `qdraft.offer`):
   deleting Perfect Guard at position 20 and appending seven rows renames every index above it.
5. **ONE MIRROR: `(x,z) → (−x, z)`.** Do not reintroduce the 180° convention.
6. **THE T·R·S TRAP.** Rotate the GEOMETRY, then scale the MESH. Rotation about +x sends +z *down*.
7. **`groundY()` ≠ `terrainHeight()`.** Decals must sample the mesh.
8. **`polygonOffset`'s factor term scales with depth slope.**
9. **⚠ NEW — `u.body` vs `u.root`.** Anything added to `u.body` is **destroyed and its geometry
   disposed** on every rebuild (`04-units.js:2240`) — class change, age restyle, arming up.
   Attachments that must survive go on **`u.root`**, which is where the name tag and health bar
   live. **This is the aura's main landmine.**
10. **⚠ NEW — a backtick inside a template literal kills a `patch-*.js`** with a confusing
    `SyntaxError`. Paid again this session, in a *comment*. Also: anchors identical between two call
    sites match zero times under the exactly-once rule — write both out with context.

---
## 6. ⇢ THE NEXT TASK
### 6.1 THE LEVEL AURA — the one spine item NOT built
John: *"as someone gains level they should gradually gain some type of aura… the higher the level
the more it glows. Level 25 should be golden / super saiyan like."* He chose **faint from level 1,
gold at 25** (a continuous ramp, not tiers). **Deliberately deferred**: it is visual work governed
by `REGICIDE-ART-DIRECTION.md`, it needs an `artcheck` cycle with John *looking* at the contact
sheet, and §2 says judgements about how things look have been wrong repeatedly.

The survey is done — start here, do not re-derive it:
- **Bloom already exists and ships**: `01-engine.js:1022-1082`, `UnrealBloomPass(…,0.30,0.45,**0.86**)`
  at `:1051`. **No `emissive` appears anywhere in `js/`** — nothing bloom-keys today but sky/sun.
  Anything above **0.86 luma in sRGB** blooms. That is the golden-glow lever.
- **⚠ Mobile sets `composer=null`** (`12-touch.js:191`). The aura **must read without bloom.**
- **Attach to `u.root`, never `u.body`** — invariant #9.
- Copy the priest's aura for form (`04-units.js:4666-4669`: `RingGeometry` + transparent
  `MeshBasicMaterial`, `rotation.x=-π/2`) but **share the geometry** — the priest's mints fresh geo
  and material per unit with no caching. Transparent/Basic is excluded from `_mergeableMat`
  (`:2094`), so it is +1 draw call — negligible, because the aura is only ever on **humans**.
- **Level already reaches guests**: `syncNameTags(sc)` reads `row[4]` from `snap.sc`
  (`04-units.js:5074`, `10-net.js:1496`) and already prints "⭐N" over every player's head. **So the
  aura needs no new wire field.** But `syncNameTags` is called **only from net paths**
  (`10-net.js:853, 1953`) — it never runs in **solo**. Drive the aura from a per-frame driver
  instead: `updateRoster` (`07-ai.js:1243`) already loops all units every frame in every mode, but
  note it **`return`s early** in touch/bar-mode, so hook inside the *first* loop, before the return,
  and before the `if(!u.alive||u.isKing)continue`. Stash the guest's view of another player's level
  as `u._netLvl` in `syncNameTags`.

### 6.2 THEN: the 42 new buffs, in themed batches
The CSV takes BUFFS from **21 → 63** and adds a **per-buff max-stack column** (1/2/3/5), replacing
the global `BUFF_MAX_STACK=3`. Many need whole new mechanics: DoTs (bleed, poison), stuns with
cooldowns, on-hit procs, aura radii, projectile/melee blocks, thrown knives, debuff cleanse,
resource-on-kill, healing zones, permanent-HP-on-kill.
**⚠ BUFFS is positionally indexed on the wire exactly as QUESTS is** (`smith` ships `offer:[3]` and
`act:"buff"` ships `{pick:id}` — check which before assuming), so re-ordering that table is another
PROTO bump.

**Audio, John's answer:** reuse the sounds in `C:\Users\John Thompson\Desktop\REGICIDE PVP\potential
sounds\sfx` first, **and tell him which buffs have no fitting sound.** Do not source new audio while
§7's licence question is open. Deliver a per-buff proc→cue table for his sign-off.

---
## 7. THE TOOL INVENTORY
| tool | what it asserts |
|---|---|
| `smoketest` | **533** assertions. **Now deterministic** — `SMOKE_SEED` env overrides. First thing to run and last. |
| `headless` | server-shaped tick cost. **v132.28: mean 4.2-4.3 ms of a 33.33 ms budget, 0/600 ticks over.** It is UNSEEDED and the container is noisy — p99 swings 8-15 ms run to run, so compare it DIFFERENTIALLY against a pristine tree (pristine measured 3.94-4.30 mean, patched 4.17-4.34 — no regression) rather than against a remembered number. |
| `nodehash` | **REBUILT** — see §3. Use differentially against a pristine tree. |
| `mapconst` · `creepcamps` · `vikingroad` · `foliageclear` · `campridge` · `campsite` · `creepwake` | the map programme's gates |
| `wallpop` · `gatefit` · `shootover` · `wallbase` | walls, gates, projectiles |
| `deskcheck` · `mobilecheck` | UI at desktop and phone sizes |
| `browsercheck` | boots the real page. **Its 6 audio failures are expected in this container.** |
| `artcheck` | ⚠ **ITS BASELINE IS GONE.** It diffs against `_baseline_v129.4/` at the repo root, which is not in the container and was not in any listing of John's disk this session — almost certainly gitignored and lost with the wipe. Its regression half is dead for EVERYTHING until the directory is found or a new baseline is frozen. The freeze was v129.4, so it predates the whole v132 map rework anyway. |
| `aurashot` | **NEW (v132.29).** Renders the level aura at levels 1/8/16/25 on both teams, with bloom, without bloom (the mobile path), at distance, and beyond the range gate. Dev-only, for judging — the countable claims are in `smoketest`. |
| **MISSING, never rebuilt** | `bazaars` · `nodefair` · `nodeplan` · `mapsurvey` · `_standcap` |

**`tools/patch-*.js` is the house style** — an idempotent script whose header *argues* for the
change, whose `sub()` refuses to write unless every anchor matches exactly once, and which writes
nothing at all if any site fails. All fourteen from this session are in the delivery.

### The verify chain
`node --check` every changed file → `smoketest` (3× — it is deterministic now, so any drift is real)
→ the gates relevant to what changed → `nodehash` **differentially against a pristine tree** →
bump PROTO if the wire or the hash moved → bump `verstamp` **and** `sw.js` `VERSION` → deliver
**both ways** → update this handoff.

---
## 8. STILL OPEN
**Highest stakes, and it gets strictly worse with time:**
- **The asset licence.** 75 of the 139 sounds carry `2021 Epic Stock Media — All Rights Reserved` in
  their Vorbis comments, and `js/audio-data.js` is the same 139 sounds base64-embedded — **twice
  downloadable from a public repo**. Nobody has read the actual terms. The Suno anthems have the
  same question. If restrictive: a private repo on GitHub Pro (~$4/mo, Pages still serves publicly),
  or a drag-and-drop host. **Deferred every session since v129 — and the buff work in §6.2 will
  want new audio, which makes this the blocking item, not a background one.**

**Next in line:**
- **TUNE THE AURA to John's taste** (§4.5) — it is built, gated and shipping, but deliberately
  conservative. Four numbers in `00-data.js`, then `node tools/aurashot.js`.
- **The 42 new buffs** (§6.2) — the big remaining piece of John's brief.
- **RE-FREEZE THE ARTCHECK BASELINE — `_baseline_v129.4` is gone for good.** This was run down,
  not guessed: it is absent from the repo root, `assets/`, `docs/` and the parent
  `Desktop\REGICIDE PVP` (which holds only the two Playtest QAQC folders, `potential sounds` and
  the game folder). And `.gitignore` does **not** list it — it names only OS junk, editor dirs and
  `node_modules`. So it was never ignored; it was simply never committed, lived in the container
  alone, and died with it. The only place left it could hide is one of the two Playtest folders,
  which are named for model QAQC and are a long shot.
  **Until a new baseline is frozen, artcheck cannot catch a visual regression in ANYTHING.** The
  freeze was v129.4 and predates the whole v132 map programme, so a re-freeze was overdue anyway —
  but it means declaring the current look correct, which needs John's eyes on a contact sheet first.
  ⚠ Also note `.gitignore` does not exclude `_vista/`, `_aura/` or `_baseline_*`. If a future
  session ever commits render output to John's disk it will land in git. Add them first.
- **Playtest the bazaars at the v132.27 rate** (1 / 2 / 4, no stone), and the new camp/raid XP.
- **No loading indicator.** A cold visit pulls ~30 MB against a blank white screen.
- **`NET.TURN` is `null`**, so nobody can host from mobile data. Highest-value netcode item.
- **No Leave button.** The only way out of a match is closing the tab.
- **Nine camps on a two-player map may be a lot of neutral fighting.**
- **The Classical (a3) gate reads thin** since its drums slimmed to 2.0/2.2.
- **You cannot walk from one curtain segment to the next.** Deliberate.
- **Art items 7, 9 and 11 were never dispatched.** Item 11 (the game-wide outline pass) is the
  largest remaining visual lever; item 9 frees ~140 draw calls to pay for it.
- **A benign harness artifact worth knowing:** `nodehash` prints
  `GAME ERROR: ReferenceError: Cannot access 'Sound' before initialization` from `renderFrame` under
  the bare eval. It appears **identically on the pristine tree**, is caught by the game's own
  handler, and does not touch world gen. Not a regression.
