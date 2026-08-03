# REGICIDE PVP — Handoff v128.3 (August 2026)

Read this at the start of a new chat to continue. `claude/REGICIDE-DEPLOY.md` covers hosting.
Supersedes `REGICIDE-HANDOFF-v127.md`, which can be deleted from the project.

**On disk: `v128.3 — THE LINE IN CSS PIXELS`.** Next version: **v128.4** (or v129 if the unit-merge
below gets built, because that is a big enough change to earn a number).

> ### ⚠ PROTO IS 26 AND HAS NOT MOVED SINCE v127.
> Nothing in v128 touched the wire. World gen is untouched since v115 — the v128 undergrowth is
> drawn from its **own** seeded RNG (`mulberry32(0x5EEDF00D)`) placed *after*
> `Math.random=__realRandom` precisely so the deterministic `nodes` stream stays byte-identical.
> If you change foliage, keep it on that side of the line or PROTO has to move.

---

# ⇢ READ THIS FIRST: THE NETCODE IS BLOCKED ON A PLAYTEST, NOT ON CODE

John's stated priority is netcode, so here is the honest position before anything else.

**Two full releases of netcode work — v126 and v127 — have never been validated against a real
device.** They are correct as far as 389 headless assertions can tell, and the v126 diagnosis was
predicted from theory and then confirmed against measured field data. But no human has played a
match on them and no field log has been collected since.

That means the highest-value netcode action available is **not writing more netcode.** It is:

```
1. John hosts a match with 1–2 guests, 15+ minutes, phones or desktops.
2. Everyone saves their net log JSON (the flight recorder writes one per peer).
3. node tools/netlog.js <host.json> <guest1.json> <guest2.json>
```

`netlog.js` joins the three on wall-clock `t` so host and guest rows line up. **What to check, in
order** (these thresholds are from the v125.1 logs, which is the last real data that exists):

| # | metric | was | expect after v126/v127 | if it didn't move |
|---|---|---|---|---|
| 1 | guest `stale` | 64–89% | **near zero** | the clock seam didn't take — check `s.ht` is present on host rows |
| 2 | guest `age` | wild | **tens of ms** | `NET._hOff` floor is being poisoned; look at `HOFF_DECAY_MS` |
| 3 | `dup` | 17–20% | **~7%** | `MIRROR_EVERY:15` isn't in effect |
| 4 | `redial` count | high | **collapse** | `REDIAL_MS`/`DIAL_TIMEOUT_MS` |
| 5 | `lane-wedged` | n/a | should be rare | if frequent, `LANE_WEDGE_MS:2500` is too tight |
| 6 | `kb` per guest | — | **down ~1 KB/s** | the envelope diet isn't shipping |
| 7 | host `simR` | ~0.85 | **still ~0.85** | expected — the sim clock was deliberately left alone |

Item 7 is the one that matters most for what comes next, and it is the bridge to the rest of this
document. **`simR` is 0.85 because the host runs at 10–19 fps.** The dt clamp bites, sim time falls
behind wall time, and every downstream timing decision inherits the error. v126 stopped that from
*corrupting* the netcode. It did not make the host faster. **Only frame rate fixes frame rate**,
and this session finally measured where it goes.

---

# ⇢ THE MEASUREMENT THAT SHOULD DRIVE THE NEXT SESSION

`node tools/drawcost.js` — new this session. It renders a base fight and A/Bs the units in and out:

```
scene WITHOUT units :   283 draw calls   131,587 tris
scene WITH  54 units:  2,086 draw calls  190,405 tris
-----------------------------------------------------
units cost          : 1,803 draw calls  =  33.4 PER UNIT
units cost          :    58,818 tris    =  1,089 per unit
```

**Units are 86% of the draw calls and 31% of the triangles.** A villager is 49 separate meshes
across 19 materials; a barbarian is 46 across 23.

### Correct the record: units are NOT merged

An earlier session (and an earlier version of this handoff's framing) asserted that the game's
geometry was "procedural boxes merged down into a handful of draws." **That is true of trees and
scenery and false of characters.** `_mergeColored` in `02-world.js:192` welds tree parts into one
vertex-coloured `BufferGeometry`. Nothing does that for units. Every boot, buckle and eyeball is
its own draw call, 54 times over.

This matters because it inverts the conclusion about imported models — see the Blender section
below — and because it makes the fix obvious.

### The fix, concretely: rigid-cluster merge

A unit animates, so you cannot merge the whole body into one mesh. But **most parts do not move
relative to each other.** Merge per rigid cluster, using the technique `_mergeColored` already
proves works in this codebase (vertex colours, one shared material):

| cluster | today | merged |
|---|---|---|
| torso assembly (chest, belt, tabard, pack, straps) | ~14 meshes | 1 |
| head assembly (skull, hat, face, plume, brim) | ~10 | 1 |
| each arm | ~4 | 1 (×2) |
| each leg | ~5 | 1 (×2) |
| weapon | ~6 | 1 |
| **total** | **~48** | **~7** |

≈ **7 draw calls per unit instead of 33–48.** At 54 units that is 2,086 → roughly 660 for the whole
scene. That is the single largest performance lever in the project, and it is a netcode item,
because it is what lifts `simR` off 0.85.

**Before starting, read these three hazards:**

1. **`buildBodyFor` (`04-units.js:128`) disposes geometry on rebuild** and the comment above it
   documents the v122 leak that whited out John's iPhone. Merged geometries are per-unit and must
   be disposed on the same path. Materials must NOT be — they come from `_skinCache` and are
   shared.
2. **The pixel skins.** Units wear hand-drawn generated textures via `texturedMat`. Merging into
   one material means either a small texture atlas with remapped UVs, or moving those parts to
   vertex colours. Decide which before writing any merge code; it is the whole design.
3. **`tryAttachModel` runs first.** Any merge has to sit on the procedural branch, below the
   model-registry early return, or it silently does nothing when a glTF is registered.

**Do not build per-guest AOI.** v127 measured it: 1 guest → 13.3 rows/snap, 2 guests 90 units apart
→ 14.3 rows/snap. One row. The near-set is dominated by units clustered at the town centres that
everyone is near anyway. It would add per-guest delta baselines and N pack passes to the host that
is *already* the bottleneck. Re-measure with `--sep` before believing that changed.

### If you want more wire savings after that

`tools/netprofile.js` prices every snapshot field by deletion through PeerJS's own BinaryPack — no
estimates. Current state at 2 guests / 138 units / 15 Hz: **335 B/snap**, of which **unit rows are
79%** at 18 B each. The envelope is down to 8 B. So the only remaining fat is in the rows
themselves — quantising position/facing harder, or shipping fewer rows. Measure first.

---

# ⇢ WHAT v128 WAS: THE GRAPHICS PASS

John asked for a "Pokémon Gen 1 Pallet Town / better than Game Freak" look: toon materials, lush
saturated foliage, bright hemisphere lighting, cel outlines for mobile readability.

**Shipped and verified in renders:**

- **`MeshToonMaterial` everywhere**, off one shared 4-step gradient ramp (`TOON_RAMP`,
  `makeToonRamp(4)`, steps `[0x64,0x9e,0xd2,0xff]`, `NearestFilter`, **no sRGB encoding** — encoding
  it smears the steps back into a gradient). Five edits in `01-engine.js` converted the whole game
  because `mat`, `plainMat`, `texturedMat`, `headMaterials` and `heraldryMat` all originate there.
- **Lighting**: `HemisphereLight(0xb1e1ff,0x447755,0.75)` + `DirectionalLight(0xfff4e0,1.15)` at
  `(36,90,48)` + a 0.05 warm ambient. `LinearToneMapping` at exposure 0.78 — **ACES was crushing the
  ramp**, which is why the tone mapping changed at the same time.
- **Camera near plane raised 0.1 → 0.6.** This was for Android depth precision, and it is load-
  bearing for flicker. Do not lower it back.
- **Six-layer instanced undergrowth** in `02-world.js` — grass, bushes, flowers, ferns. Own seeded
  RNG (see the PROTO note at the top). Road exclusion walks the `roadPoint()` polyline because a
  straight z-band missed the curve and grass grew through the King's Road.
- **Outlines**: inverted-hull (BackSide + normal push in a vertex shader), fog-aware so distant
  trees don't keep a hard black edge while their bodies fade to sky.

## The outline saga, and where it landed

This took four rounds and two of them were my errors. The current state:

- **Units carry NO outline.** Head-only ink was a draw-call compromise and it read as a rendering
  defect, not a style — John's words were "looks odd and not great." Off by default, still
  reachable with `?ink=heads` for comparison.
- **Only gable roof slabs are inked**, at **1.8 CSS px** (`03-buildings.js:242`). Applied to the
  roof rather than every wall panel so a hall costs ~2 extra calls, not ~20.
- **`?ink=<n>` scales everything.** `?ink=0` off · `?ink=0.5` half · `?ink=2` double. This exists
  because the person who can see the phone is not the person who can edit the shader. **Have John
  dial it on the device and report the number** rather than shipping a build per guess.

**Rejected, with reasons, so nobody spends a session re-attempting them:**

- **Screen-space depth-edge outlines.** Failed three ways: `EffectComposer.clone()` copies
  `depthTexture` by reference so the pass sampled its own target; `ShaderPass.render()` reassigns
  `uniforms[textureID]` from `readBuffer.texture` and blacked the screen (worked around with
  `_blit.textureID="__sceneRT_do_not_bind"`); and then depth still read all-zero under swiftshader,
  so it could not be verified headlessly at all. Abandoned rather than shipped unverifiable.
- **Tree outlines as hull children.** Broke `v114 draw budget`, which asserts a tree is ONE mesh.
  **The correct fix is to bake the inside-out shell into the merged geometry** inside
  `_mergeColored` — zero extra draw calls. Same technique the unit merge above needs. If both get
  built, build the merge machinery once.

---

# The netcode as it stands

`js/10-net.js`, ~1650 lines. PeerJS, **host-authoritative**. Constants at lines 26–59:

```
SNAP_HZ:15   INPUT_HZ:20         BUF_FAST_MAX:16384   BUF_REL_MAX:16384
AOI_NEAR:60  AOI_FAR_EVERY:4     MIRROR_EVERY:15      INPUT_STALE_MS:600
INPUT_EASE_MS:250                AUTH_FRESH_S:0.6 (legacy path only)
AGE_FRESH_MS:600                 HOFF_DECAY_MS:20000
LANE_WEDGE_MS:2500               REDIAL_MS:1200       DIAL_TIMEOUT_MS:6000
EXTRAP_MAX_MS:260                                     PROTO:26
```

- **ONE CLOCK.** Every timing decision reads wall time through `NET.now()`. Monotonic on purpose —
  never `Date.now()` while `performance.now()` exists, because the age measurement must not be
  walked backwards by an NTP correction mid-match.
- **TWO LANES.** A reliable PeerJS `conn` for handshake/acts/notes, and an unreliable one
  (`NET.fast`, `dialFast`) for snapshots. `bcastFast` **skips rather than queues** above 16 KB
  unflushed. The comment on `BUF_REL_MAX` names the original bug: *"that backlog was THE freeze."*
- **SNAPSHOTS ARE PACKED BINARY DELTAS.** 18 B/unit row (`packRows`/`readSnapRows`, one shared
  decoder used by the smoketest too, deliberately — no drift), 8 B/building row. Unchanged rows are
  skipped (`NET._lastRow`), so an idle unit costs nothing. Envelope (`stock0`, `stock1`, `carry`,
  `ares`) ships only when changed, healing through the every-15th-snap keyframe.
- **AOI.** Units within `AOI_NEAR` of any guest body ship every snap; distant ones every 4th,
  staggered by `(snapN + id) % 4`. Structural changes — death, class change, garrison — always ship
  at once.
- **THE LEASH.** The guest predicts its own body; the host corrects it, inside a 6-unit leash and
  only from a snapshot whose measured **age** is under `AGE_FRESH_MS`.
- **THE GLIDE (v127).** A remote body remembers the velocity of the leg it just walked
  (`netVX`/`netVZ`, derived from two received positions — no bytes) and keeps walking past the end
  of the glide for `EXTRAP_MAX_MS`, but only while the host says that body is moving (bit 2 of the
  flags byte, held in `gmv`). Safe by construction: every arrival re-anchors `netPX` to wherever the
  unit is *currently drawn*, so a wrong guess is absorbed by the same smoothing that handles a late
  packet.
- **THE WORK PULSE.** A 2-bit counter in the unit flags byte, ticking every 0.5 s of work, so a
  stationary miner's arm keeps swinging on guests even when their row stops changing.
- **v128.2 — the status panel folds.** `NET.status(txt,show)` / `NET.setFold(bool)`, state in
  `localStorage.reg_netfold`, collapsed to a `#netchip`. John's mobile playtest: the copy-link and
  ping windows "take up way too much room" on both host and guest.

## Rules for changing the wire

- **PROTO is 26.** Bump it only for a change an old peer would *misread*. An OPTIONAL field an old
  peer ignores does not need a bump — that is how `mx`/`mz`/`shot` shipped, and how `ht` did.
  **OMITTING** a field an old peer reads unguarded is the other case, and that is v127's envelope
  delta: 25 → 26. If you add a delta'd field, guard the read on the guest AND give it a keyframe
  refresh, or a dropped packet becomes permanent staleness.
- **`packRows` and `readSnapRows` are one codec** used by both the game and the smoketest.
- **Never trust a guest's claim.** The guest reports, the host clamps to what it observed.
- **The v125 fallback path is load-bearing.** When `ht` is absent, `applySnap` uses the old
  sim-clock comparison and `guestFrame` resumes advancing `estT`. There is a test for exactly that
  pairing — keep it.
- **Extend `tools/smoketest.js`, don't write a new harness.** It already covers snapshot round-
  trips, the work pulse, snapshot age (both paths), shot batching, facing relay, the analog field
  and all of v126's lane behaviour. Runs headless in ~100 s.

## Netcode threads still open

- **THE FIELD TEST.** See the table at the top. This is the whole job.
- **Does the leash coming back feel right?** For ~88% of John's last session his body was never
  corrected. It is corrected now. If that reads as rubber-banding, the dial is the 6-unit dead zone
  and `dead=3.2+(gapAvg-83)*0.02`, **not** `AGE_FRESH_MS`.
- **Do distant units read as smoother?** The v127 glide is the one change that cannot be verified
  from a log file. It needs eyes on a friendly warband fighting at range: walk, or stutter?
- **Hall registry election.** The public hall list lives on whichever host holds `HALL_ID`
  (`hallData`, `hallJoin`). When that host leaves, nothing elects a replacement.
- **host-can't-play-RED.** `tryAgeUp` checks `teamTC(BLUE)` while reading `teamAge[MYTEAM]`.
  Harmless today because the host is always BLUE; a real bug the moment that changes.
- **Unit draw calls.** Now quantified — see the top of this document. Top netcode item.

---

# ⇢ THE SERVICE WORKER, AND THE TRAP IT SET

`sw.js` is new since v127 (v128.2) and it **immediately caused a field bug**, which is worth
recording in full because the failure mode is invisible and confusing.

The worker exists for two reasons: Chrome on Android will not offer a real WebAPK install without
a fetch-handling service worker (iOS installs from the manifest alone, which is why the iPhone
worked for versions), and the ~29 MB first load otherwise stares at a blank screen.

**What went wrong.** It was cache-first for `js/*.js`, keyed on a `VERSION` constant, with a header
comment instructing the reader to bump `VERSION` on every deploy. Two JS files were then edited
without a bump. Result: any phone that had installed the v128.2 worker served the **old**
`04-units.js` out of cache permanently. John deployed the head-outline fix, reloaded, and his phone
showed him the bug he had just paid to have fixed. Desktop looked correct because a fresh desktop
load often has no worker registered at all.

**The fix, v128.3.** `js/` and `css/` are now **network-first**, like the HTML. They total ~830 KB
uncompressed (~200 KB gzipped) and GitHub Pages sends ETags, so in the common case this is a
conditional request returning 304. Cache-first stays on `libs/` and `assets/` where the megabytes
actually are. Offline play is unaffected. Two hardening fixes went in at the same time: only `.ok`
responses are cached (a stored 404 would be served back as though it were the file), and the
offline fallback no longer hands `index.html` to a script request.

**Two things anyone touching this must know:**

1. **A deploy needs TWO page loads to take effect.** The old worker still controls load #1 while
   the new one installs behind it; `skipWaiting` + `clients.claim` mean load #2 is clean. If a
   change appears not to have shipped, reload once more before debugging it.
2. **The verstamp is the diagnostic.** The menu reads `v128.3 — THE LINE IN CSS PIXELS`. Ask which
   version a device reports before believing any bug report about rendering.

---

# The game as it stands

## The shape of the codebase

Three HUD layouts, exactly one runs per session:

| file | when | what |
|---|---|---|
| `js/12-touch.js` | a touchscreen | the phone build: rotated stage, thumb zones, contextual rail, action grid, frame cap, battery saver, 34px strip |
| `js/13-deskui.js` | everything else | the same strip on desktop at 46px, no rail, no stage, no cap |
| neither (`?ui=classic`) | escape hatch | the pre-v125 desktop HUD, seven floating panels, untouched |

**The handshake is one line.** 12-touch loads first and adds `touch-mode` to `<html>` synchronously
if it is taking over; 13-deskui loads second and returns immediately if it sees it, otherwise adds
`bar-mode`. No shared state, no other ordering subtlety.

Two shared branches read those classes at CALL time: `updateRoster()` in `07-ai.js` and
`updateAgeHud()` in `08-ui.js` render the compact form when either class is present, and the long
desktop form only for `?ui=classic`.

**Why 13-deskui is a separate file and not a shared bar.** Deliberate. 12-touch's strip is 34px,
sized in a rotated stage, measured against safe-area insets, and held up by ~190 assertions that
took thirteen field-test rounds to get green. A shared implementation would be mostly per-mode
overrides anyway. **If a third layout ever appears, extract then. Two copies is a smell; three is a
bug factory.**

14 script files, no bundler, loaded in index order. **Load order is a real constraint** — see trap
#13.

## Battery Saver (mobile only, default ON)

Moves pixel ratio 0.7 ↔ 1.0 and cull distance 88 ↔ 105, and caps the frame rate. John's sessions
are therefore 30 fps at 0.7 unless he taps it off. **The phone's real drawing buffer is 590×273** —
measured this session, and the reason the CSS-pixel bug below mattered.

---

# Tests

Three harnesses. **All three are green as of v128.3**, verified this session:

| harness | count | runtime | port | run it after |
|---|---|---|---|---|
| `node tools/smoketest.js` | **389 PASS** | ~100 s | — | anything |
| `node tools/mobilecheck.js` | **192, MOBILE SPIKE OK** | ~5 min | 8132 | any `12-touch.js` or CSS change |
| `node tools/deskcheck.js` | **DESKTOP UI OK** | ~2 min | 8133 | any `13-deskui.js`, CSS or shared-branch change |

### ⚠ mobilecheck needs files that are not in the sandbox

`tools/mobilecheck.js` and the whole `assets/` folder exist on John's machine but were **not** in
the assistant sandbox. Without them:

- mobilecheck cannot be run at all, which is why it sat unrun for a whole session; and
- once staged, `v120 pwa: the manifest asks for fullscreen landscape with real icons` **false-reds**,
  because it does `fs.existsSync` on `assets/icon-192.png`.

**Stage these at the start of any session that will touch mobile:**

```
tools/mobilecheck.js
assets/icon-192.png   assets/icon-512.png   assets/apple-touch-icon.png
```

With them present the suite reports MOBILE SPIKE OK. The manifest itself was correct all along.

### Known flakes

- **`phone: v124.1 feed — a promoted line is MOVED to the banner`** — failed once in two runs, then
  passed. Harness state bleed, not a game bug.
- **The militia-pair smoketest flake**, roughly 1 run in 13. Start at `manageBands`.
- `turtle curtain wall` has not been reproduced since v127.

---

# The traps this codebase sets

1. **`getBoundingClientRect()` inside `#tstage` returns the TRANSPOSED box.** The stage is
   `rotate(90deg)`. Use `offsetTop`/`offsetLeft`/`offsetWidth`/`offsetHeight`. **Bitten five times**,
   including inside `mobilecheck.js` itself. Does not apply to 13-deskui — no stage there.
2. **A child cannot escape its parent's stacking context**, whatever z-index you write. Bitten four
   times. Desktop z-map: HUD 10–12, menus 20, scoreboard 40, help 45, overlays 50+.
3. **A CSS custom property on an ancestor cannot read one defined on a descendant** — silently
   invalid, and the `calc` falls back. `--tbarfull` and `--sb` must both live on `#tstage`.
4. **`scrollWidth` does not count start-side overflow.**
5. **A flex child that can shrink can never be dropped.**
6. **Node 22 defines a global `navigator`.** Both UI layers guard on
   `document || location || screen || navigator` being absent — `screen` carries that guard alone
   under the smoketest now, which asserts it explicitly.
7. **SIM TIME IS NOT WALL TIME, and the harness pins one of them.** `clock.getDelta` is fixed at
   `1/30` in `smoketest.js`, so sim time advances and real time does not. Anything reading
   `NET.now()` needs the harness's synthetic wall clock, which advances in lockstep inside
   `getDelta`. Two consequences:
   - **Never mix `performance.now()` and `NET.now()` in a test.** Stamping `r.inputAt` from
     `performance.now()` made a fresh input look ~970 *seconds* old and the body refused to walk.
   - **A frozen wall clock silently starves the feed.** Blocks needing a specific timing edge
     override `NET.now` and restore it.
8. **A "per second" counter is only per second if something says so.** Every rate the flight
   recorder emitted for 28 versions was per *sim* second while claiming otherwise, and the error was
   largest exactly where the data mattered. Rows carry `win` now. Divide by it.
9. **A regicide mid-run disarms `dealDamage` ITSELF, not just the clock.** `09-main.js:634` gates
   the simulation on `if(!gameOver)` and `05-combat.js:196` returns early from `dealDamage` when it
   is set. Every staged kill after that silently does nothing. Clear the flag **per tick**, and
   protect **town centres only** — clearing it globally lets the campaign raze both thrones, and
   protecting kings breaks "RED kingsguard never disbands".
10. **A test that reaches past the real entry point cannot see a missing call site.** The board "!"
    was green for 27 versions on a test that called the driver by hand. **Drive the frame.** And make
    sure such a test cannot pass while measuring nothing — the first `__WIRE` block filtered an
    empty list and reported all clear. Assert `spied>0`.
11. **The harness runs every file in STRICT mode; the browser does not.** `00-data.js` line 2 is
    `"use strict"` and the smoketest concatenates all fourteen files into one script. That is why
    function declarations do not reach `global` and why `__WIRE` exists.
12. **A guest runs a DIFFERENT frame.** `NET.guestFrame` is not `tickBody`; a guest returns from
    `tickBody` at `09-main.js:631` and never sees the 40 lines below it. Anything display-only added
    to the host branch must be added to `guestFrame` too. Siblings to audit whenever something is
    added to `tickBody`: `drainVisualQueue`, `updateEffects`, `updateProjectiles`, `tickAgeResearch`,
    `Sound.tick`, `updateRoster`, `drawMinimap`, `tickBoardBang`.
13. **Load order is real: `dist2` lives in `04-units.js`, which loads AFTER `02-world.js`.** New
    world-gen code cannot call it. Inline the distance check. (Bitten again in v128.)
14. **v128 — r128 `InstancedMesh` frustum-tests against the BASE geometry's bounding sphere**, which
    sits at the origin. Every instanced layer needs `frustumCulled=false` or the whole layer vanishes
    the moment the origin leaves the view. This silently affected the two pre-existing layers too.
15. **v128 — vertical planes face an overhead sun edge-on** and drop into the toon ramp's bottom
    cell, rendering near-black. Grass blades blend their normals 45% skyward (`SKY_BLEND=0.45`). A
    *full* skyward blend blows out to mint, so the palettes had to come down with it.
16. **v128.1 — anything expressed in "px" in a shader must say WHICH pixel.** The outline width was
    fed the raw drawing-buffer height, making it *device* pixels. The phone rasterises at a 0.7
    pixel ratio and upscales, so a 2.4 line landed at **3.4 CSS px** on a phone and a hairline on a
    monitor — the opposite of what the small screen needed. `__syncInk` now divides by
    `renderer.getPixelRatio()`, which makes the unit CSS pixels.
17. **v128.1 — a sync function wired to events but never called at init.** `__syncInk` was attached
    to `resize` and the battery-saver toggle and to **nothing at startup**. A desktop never fires a
    resize, so it ran an entire session on a 620 default against a 1440 buffer, drawing every line
    ~2.3× too thick. **If a function's job is "keep X in step with Y," call it once at boot.**
18. **v128.3 — a cache keyed on a constant a human must remember is not a cache strategy.** See the
    service worker section. It shipped stale code to a real device inside one session of being
    written.

And about the harnesses:

- **`mobilecheck` blocks share one `page.evaluate` and inherit state** — a latched AIM, a funded
  treasury, a frozen AI director. Isolate anything stateful.
- **"the string changed" is not proof a loop ran.** A steady frame rate renders the identical
  read-out every window. Assert it is no longer the boot placeholder, or that `T` advanced.
- **A text write into the HUD does not hold.** `updateResHud` is event-driven. Set the STOCK, and
  assert five-digit-*ness*, because the team keeps spending.
- **The player spawns INSIDE the Town Centre's deposit radius** and 09-main auto-deposits every
  frame you are in it. Move the player to the tree first.
- **A test that leaves authority armed poisons the next block.** Clear `player.authX`.
- **`pkill -f mobilecheck` kills the calling shell.** Clear the port by PID:
  `ss -tlnp | grep 8132 | grep -oP 'pid=\K[0-9]+'` then `kill -9`. deskcheck uses **8133**.

---

# Tooling

Dev-only, none in the verify chain except where noted:

| tool | what it answers |
|---|---|
| `tools/netlog.js` | **the field-test reader.** Joins host+guest logs on wall-clock `t`. |
| `tools/netprofile.js` | exact snapshot bytes by field, via PeerJS's own BinaryPack. `--guests --sep --snaps` |
| `tools/drawcost.js` | **new.** A/Bs units in and out of a rendered frame — the 33.4-calls-per-unit number. |
| `tools/perfcheck.js` | draw calls / tris / ms at three vantage points, deterministic. |
| `tools/vista.js` | 6 fixed-camera renders at desktop res. Eyeball a graphics change. |
| `tools/phoneshot.js` | the same at 844×390 / 0.7 ratio. **Run after ANY change to something measured in px.** |
| `tools/inkweight.js` | **new.** Renders gable roofs across `?ink=` scales at phone resolution. |
| `tools/treemap.js` | world-gen distribution. |
| `tools/browsercheck.js` | audio, http + `file://`. |
| `tools/cartshot.js` | model changes. |

**Rendering is headless Chromium via playwright-core + swiftshader** at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Do not run `playwright install`.
**swiftshader cannot be trusted for depth-buffer work** — that is what killed the screen-space
outline attempt.

---

# Workflow / protocol

Browser 50v50 regicide war game, Three.js r128 no-bundler, PeerJS host-authoritative, **PROTO=26**.
John's copy at `C:\Users\John Thompson\Desktop\REGICIDE PVP\REGICIDE PVP GAME` — that inner folder
is the git repo. The **parent** also holds `potential sounds\` (1,691 files, 2.6 GB) which must
**never** reach GitHub. Deploy is **commit + push in GitHub Desktop** → `nutcrackerregicide.github.io`.

Deliver work with `SendUserFile` **and** `mcp__remote-devices__device_commit_files` to that folder —
he commits and pushes from GitHub Desktop himself.

**Do not accept a GitHub token pasted into chat.** This was asked and declined; keep declining.

Notes on sandbox drift:

- The sandbox's git history is **not** a mirror of John's repo (17 tracked files, one `baseline`
  commit). Do not reason about what is deployed from `git log` here. **Ask, or read the verstamp.**
- `assets/anims.js` exists on John's machine, is absent from the sandbox, and its `<script>` tag is
  **commented out** in `index.html`. Do not write tests that assume baked anims.
- `tools/mobilecheck.js` and `assets/*.png` need staging — see the Tests section.

**Verify chain:** `node --check` every changed file → `npm i three@0.128.0 playwright-core` →
`node tools/smoketest.js` 2–3× → `node tools/deskcheck.js` after any `13-deskui.js`/CSS/shared-branch
change → `node tools/mobilecheck.js` after any `12-touch.js`/CSS change → `node tools/browsercheck.js`
after any audio change → `node tools/phoneshot.js` after anything sized in pixels →
`node tools/perfcheck.js` + `treemap.js` after world-gen changes → **`node tools/netlog.js` on any
new field logs** → bump the verstamp → **bump `VERSION` in `sw.js`** → update this handoff.

---

# Can Blender MCP refine the models?

Asked this session; no Blender MCP was connected, so this is the assessment, not a result.

**Yes, and the draw-call arithmetic runs in favour of it — the opposite of the initial guess.**
Because units are 33–48 draw calls today, a glTF character with **one material** would be **1 draw
call**, cutting 1,803 → 54. Even a careless 20-material export would be roughly break-even. The
constraint is **material count per model, not polygon count**; 1,089 tris per unit is nothing.

The integration path already exists: `01-engine.js` has a glTF registry (`MODELS`,
`MODEL_MANIFEST`), and `buildBodyFor` hot-swaps live units the moment a model loads. A local
Blender MCP on John's desktop would be reachable through the same device bridge used to write files.

**Caveats, worst first:**

1. One material, one atlas, or the win evaporates.
2. The current look is deliberate — hand-drawn pixel skins on a 4-step toon ramp. An imported model
   will look imported unless built to that palette and flat read.
3. Animation is a separate project: `assets/anims.js` is on his disk but its `<script>` tag is
   commented out.
4. **Best first target is buildings and scenery, not characters** — static, fewer on screen, no rig.

**History to check before committing a weekend:** `00-data.js:331` reads
`const MODEL_MANIFEST={}; // imported models retired — characters use generated pixel skins`, with a
note that the Tripo→Mixamo pipeline (`tools/autorig.py`, `tools/mixamo_merge.py` — **not present in
the sandbox**) still works. John went down this road once and backed out. Find out why first.

---

# Open threads / watch list

- **THE v126/v127 FIELD TEST.** Top of this document. Everything netcode is downstream of it.
- **The unit rigid-cluster merge.** Biggest single lever in the project, and it is a netcode item.
- **ASSET LICENCE — still unresolved, and the repo is public.** 75 of the 139 sounds carry
  `2021 Epic Stock Media (Empire Game) — All Rights Reserved` in their Vorbis comments, and
  `js/audio-data.js` embeds the same 139 as base64. Nobody has read the actual terms. **Highest-
  stakes item on this list**, and it gets worse the closer this gets to Steam or ads.
- **The Android flicker.** John's guest flickered badly on Android. Two fixes shipped blind — near
  plane 0.1 → 0.6, and the outline hulls that were wrongly blamed and then correctly cleared. **This
  has never been confirmed fixed on a device.** `?ink=0` is the A/B if it recurs.
- **Outline weight on a real phone.** `?ink=<n>` is the dial; 1.8 CSS px is the current default.
  Get a number from John, don't guess.
- **v125 desktop bar field test.** Does the 46px strip feel right on a 1920 monitor? Is losing the
  advance COST and the "(T at Town Center)" hint a real loss on a keyboard?
- **Wood economy never rebalanced** — ~95,000 wood on the map since v114 against ~12,600 before.
  Dials in order: `amount:140` in `makeTree` → 60–80, then `STEP`, then stand count.
- **Combat feel, never started**: camera shake scaled to damage, hit-stop on kills, directional
  blood/spark bursts, floating damage numbers, directional knockdown on death.
- Older: quest balance, v94 AI playtest.
