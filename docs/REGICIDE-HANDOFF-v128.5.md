# REGICIDE PVP — Handoff v128.5 (August 2026)

Read this at the start of a new chat to continue. `claude/REGICIDE-DEPLOY.md` covers hosting.
Supersedes `REGICIDE-HANDOFF-v128.4.md`, which can be deleted from the project.
`claude/REGICIDE-NETCODE-GAP-ANALYSIS.md` is the audit that produced v128.5 and is still the
reference for what this netcode does and does not have.

**On disk: `v128.5 — THE WORLD YOU WERE AIMING AT`.** Next version: **v128.6** (or v129 if the
unit-merge below gets built, because that is a big enough change to earn a number).

> ### ⚠ PROTO IS STILL 26.
> v128.4 and v128.5 put four new fields on the wire between them and bumped nothing, because all
> of them are OPTIONAL and additive: `aq`, `et` and `at` are guest→host (an old host ignores
> them), and `bye` is a new message type that `hostData` already falls through on. Nothing
> existing changed shape.
> World gen is untouched since v115; the v128 undergrowth still draws from its own seeded RNG
> (`mulberry32(0x5EEDF00D)`) placed *after* `Math.random=__realRandom`. If you change foliage,
> keep it on that side of the line or PROTO has to move.

---

# ⇢ READ THIS FIRST: THE FIELD TEST HAPPENED, AND IT FOUND THE FREEZE

Two full releases of netcode work — v126 and v127 — had never been validated against a real
device. **They have now.** John ran a 1042-second match on v128.2 with three other players and
collected a host log plus two guest logs. His verdict: *"pretty much unplayable."* One guest
left early. The logs say why, and it is not what any previous handoff guessed.

`logs/` — host `SigridtheLucky-210339`, guests `JorunntheBlack-205411` and
`GodwintheSteadfast-210349`. Run them through `node tools/netlog.js <host> <guest…>`.

## What the seven-row check table actually returned

| # | metric | was (v125.1) | predicted | **measured v128.2** | verdict |
|---|---|---|---|---|---|
| 1 | guest `stale` | 64–89% | near zero | **39% (Jorunn) · 0% (Godwin)** | half-fixed — the residue is the flood, not the clock |
| 2 | guest `age` | wild | tens of ms | **med 31ms, max 40,874ms** | median fixed; the tail is the flood |
| 3 | `dup` | 17–20% | ~7% | **4–6%** | ✅ `MIRROR_EVERY:15` shipped |
| 4 | `redial` | high | collapse | **15 (Jorunn) · 2 (Godwin)** | ❌ not collapsed |
| 5 | `lane-wedged` | n/a | rare | **7 host events** | ❌ and it is part of the problem |
| 6 | `kb` per guest | — | down ~1 KB/s | **13 KB/s med, 528 KB spikes** | ❌ the spikes are the bug |
| 7 | host `simR` | ~0.85 | still ~0.85 | **0.779, fps med 17** | worse — v128's graphics pass cost frames |

## THE FREEZE: the reliable lane was the freeze

`10-net.js` `bcastFast`. When a guest's fast (unreliable) lane goes down, the host used to fall
back to relaying the **full 15 Hz snapshot stream on the reliable, ORDERED lane**, behind one
guard: `laneBuf(conn) < BUF_REL_MAX`. **That guard is blind.** `bufferedAmount` counts only what
the app has queued that the transport has not yet accepted; SCTP keeps accepting new sends while
it retransmits, so a stalled pipe reads ~800 B and the host shovels 15 snapshots a second into it.

Jorunn's session:

- **20 outages. 144 seconds with ZERO snapshots and ZERO bytes — 35% of his session.**
- **Longest single outage: 39 seconds.** His renderer never stopped (19–20 fps throughout); `T`
  sat at 55.5 the whole time, because `applySnap` is the only thing that sets it (`10-net.js`,
  `T=s.T` right after the age maths). That is "everyone freezes in place."
- Recovery: **621 snapshots / 528 KB in one second, the oldest 40.9 s old, 604 refused as stale.**
- Across all 20 outages the floods carried **112% of what a 15 Hz stream would have pushed.**
  **Nothing was ever dropped. All of it was delivered late.**
- The fast lane was down in **139 of those 144 seconds**, and up in 227 of 252 healthy ones.

**It got worse, not better.** v125.1: John 5% dead / longest 16 s, Petra 12% / 21 s, fast lane up
84–94%. v128.2: 35% dead / 39 s, fast lane up 57%. The prime suspect is **v126's own wedge
recovery** — it closes the fast lane after 2.5 s of a static buffer and hands the stream
"instantly to the reliable relay," which is precisely the lane that freezes people.

**Why thirty versions of reading these logs missed it: the flight recorder lied.** `sent` in a
host row was `r.sentF`, incremented only on the fast-lane branch. The reliable send incremented
**nothing**. Through all 144 frozen seconds the host row read `sent:0 skipF:0 skipR:0` — idle —
while the host was flooding. The tell was visible and nobody could see it.

## What v128.4 does about it

Two honest brakes, because an empty `bufferedAmount` proves nothing on an ordered lane:

1. **THE ACK.** The guest puts the last snapshot `q` it has **applied** on its 20 Hz input packet
   (`aq`). The host tracks `_relQ − ackQ` — what it relayed minus what the guest ate — and stops
   above `REL_ACK_WINDOW:30` (~2 s). This measures **delivery**, the thing that actually stopped.
   It works because the stall is one-directional: through every outage in the logs the host was
   still receiving that guest's input at **2–3 ms** age.
2. **THE RATE CAP.** `REL_FALLBACK_HZ:4`. Even flowing, the reliable lane is the wrong place for
   15 Hz. A 39-second outage now queues at most 30 snapshots instead of 600.

The 1 Hz mirror is exempt from the cap (it *is* the liveness trickle) but not from the window.
`sentR`/`holdR`/`lag` are now in the host row, so the blind spot is closed.

## THE GHOSTS: the host never noticed anyone leaving

The host logged **one `drop` event for at least three departures**. John's desktop session joined
at T=6 and was still holding a peer slot 1042 seconds later, with `inAge` climbing to 669 seconds.
PeerJS reported that lane `open:true` for **8 minutes** after he was gone and fired neither
`close` nor `error` — and those two events were the *only* things that could call `hostDrop`.

There was no `peer.on("disconnected")`, no timeout sweep, no `bye`, no `pagehide`, and no way to
leave a match except closing the tab. `INPUT_STALE_MS` only freezes the body; `LANE_WEDGE_MS`
only kills the lane.

**The revert-to-NPC code was already correct — it was simply never called.** And it costs more
than a standing statue: `updateBot` returns immediately on `u.remote` (`07-ai.js:854`), so an
abandoned body is permanently subtracted from its team's economy, army, roster and job pool, and
`hostAdmit`'s three scans all require `!v.remote` so it can never be handed to a future joiner.
Every un-reaped departure walks the room toward *"That army is full."*

v128.4 splits `hostDrop(conn)` into **`NET.hostRelease(key, why)`** (a reaper only ever holds a
`NET.remotes` key, not a connection) and gives it three triggers:

- **`bye`** — the guest's `pagehide` sends one and closes both lanes. `pagehide`, not
  `beforeunload`: iOS Safari does not fire the latter. Instant, covers the common case.
- **The peer-connection verdict** — `conn.peerConnection.connectionState`. `failed`/`closed`
  reaps at once; `disconnected` starts a `PC_DEAD_MS:30000` timer, because Chrome bounces through
  that state on an ordinary network handover. Wrapped in try/catch: an absent field means no opinion.
- **`PEER_DEAD_MS:90000`** — nothing heard on any lane. `r.seenAt` is stamped for *every* message
  on *every* lane, unlike `inputAt`.

**Deliberately NOT triggered on `inputAt`/`INPUT_STALE_MS` or on a wedged lane.** The v125 log
contains a **21.3-second input silence that fully recovered**, with the lane buffer frozen on
18585 for 19 s, while the host was healthy. A screen-locked phone is indistinguishable from a
departure at those timescales. 90 s is 4× the worst genuine recovery on record.

## THE MOBILE USE BUTTON

John: *"on mobile I could not use the USE button."* `12-touch.js:1235/1239` — `autoTick` writes
`keys.e` **every animation frame** when you are a guest (`true` with a gather node in reach,
`false` without), and it runs **before** `guestFrame`, so it owns whatever the 20 Hz uplink
samples. Two failure modes, both total:

- no node in reach → `keys.e` forced `false` → the button's press is erased before it ships;
- node in reach → `keys.e` pinned `true` → the host's rising edge `if(i.e&&!r.lastE)` never fires.

**E was the only player action with no discrete message.** Every other one — build, train, rally,
charge, ageup, quest, buff, gate, resurrect — is a `guestAct` RPC. Interact alone rode a per-frame
boolean that a second subsystem also wrote. That is exactly why only this button broke, and only
on a phone: desktop-as-guest has no `autoTick`, mobile-as-host takes the other branch, and the
headless harness never loads the touch layer at all (`12-touch.js:35` returns with no `screen`).

**The fix:** `et`, a monotonic tap counter incremented in the `k==="e"` branch of the keydown
dispatcher in `06-input.js` — which catches both the physical key and the synthetic keydown the
touch button dispatches, and cannot be clobbered by anything writing `keys.e` directly. The host
fires the interact block on `(i.e && !r.lastE) || eTap`. The held bit still drives hold-to-gather,
untouched. Both ends start the counter at **0** (`hostAdmit` stamps `lastET:0`, the guest's
`admit` handler resets `NET._eTap=0`) so a rejoin inside one page load cannot arrive carrying a
count the host reads as an instant interact.

---

# ⇢ WHAT v128.5 WAS: LAG COMPENSATION

A full audit against a textbook server-authoritative blueprint found exactly one architectural
hole, and it was the one players feel. **The host resolved every guest attack against its OWN
present tick while the guest was aiming at a world ~276 ms old.** There was no history buffer, no
rewind, and no guest packet carried a timestamp of any kind.

Measured against the field-test pings, for a target running away:

| guest class vs fleeing infantry | reach | usable @212 ms (median) | @1294 ms (p90) |
|---|---|---|---|
| broadswordsman | 3.4 u | **1.70 u — half the reach gone** | impossible |
| clubman | 3.2 u | 1.50 u | impossible |
| halberdier | 4.4 u | 2.70 u | impossible |

Against a fleeing knight the broadswordsman's usable reach at *median* ping was **0.54 u** — you
had to stand inside the model. The error is asymmetric, which is why it read as jank rather than
lag: a target *charging* you is easier to hit than it looks, because latency carries it into
reach. The player-facing symptom is *"my sword passes through people I'm chasing, but I get free
hits on people charging me."* Melee never even named a target — the guest sent one bit, `atk:1`,
and the host ran its own scan at its own present tick.

## THE REWIND STORE (`10-net.js`, above `bcast`)

`HIST_SLOTS:24` × `HIST_MIN_MS:22` = 528 ms of position history. One shared `Float64Array` of
timestamps for the whole world (every unit is sampled on the same host frame, so the times are
identical), plus one `Int16Array` pair per unit allocated once and written in place. ~13 KB total
at 136 units, **zero allocation per sample**. Positions use the same `x*10` quantization the wire
already uses — a hit test finer than the snapshot that produced it is measuring noise.

**Two things about the design worth keeping:**

1. **Nothing is ever mutated, so nothing has to be restored.** The usual shape of this system
   rewinds the live transforms, tests, and restores them — leaving a window where a throw
   mid-check corrupts the world for every other system. Here the history is a separate store and
   `NET.histAt(u,t)` writes its answer into two scratch scalars. There is no restore step and no
   way to leave the world in the past.
2. **A unit born mid-ring fills its whole history with its spawn point**, or it would read as
   standing at the origin in the past and catch arrows aimed nowhere near it.

## THE TRUST BOUNDARY

The guest stamps combat frames with `at`: the host-clock instant of the world it was looking at,
derived from the `ht`/`_hOff` machinery v126 already built (`NET.viewTime()`). It is **absolute,
not "rewind me N ms"**, so the input packet's own transit cannot bias it — if that packet takes
300 ms to arrive the host still resolves against the instant the guest actually saw.

`NET.rewindTime(r,claim)` then applies the codebase's own rule — *never trust a guest's claim*:

- a claim is capped at **the peer's own measured `rtt` + `LAGCOMP_SLACK_MS:120`**, so a guest on a
  20 ms link may not ask to shoot into a 500 ms-old world;
- everything is capped at `LAGCOMP_MAX_MS:500`;
- a claim in the *future* is refused;
- a guest that sends no claim (a pre-v128.5 build) still gets an `rtt`-shaped estimate.

`at` is sent **only on frames that swing, block or loose**. Nine bytes at 20 Hz is not worth
paying while walking.

## RANGED: CATCH-UP SIMULATION

An arrow has travel time, so it cannot simply be hitscan-rewound. `catchUpArrow` in `05-combat.js`
gives a guest's arrow the instant it was actually loosed and **fast-forwards it to the host's
present**, testing a swept segment each step against positions rewound to that same step. If it
connects in the past it connects; if not it enters the world already at the position it should
have reached.

**Be clear about what this does and does not buy.** A player still has to *lead* a moving target —
that skill is the game. What they no longer have to lead is an invisible, variable network offset.

Hitscan is simpler: `pistolTarget(u,rng,rwT)` picks its target from rewound positions.

## MELEE: THE SWING-WINDOW SWEEP

`rwDist(u,v)` returns the closest the target came across `MELEE_WINDOW_MS:120` — the swing's
active window — **and takes the minimum with the present-tick answer**. Compensation can therefore
only ever add hits a fair player deserved; it can never take one away. A target that was never in
reach during the window is still a miss, and there is a test for exactly that.

The context is a module global `_rwT` set by `driveRemote` around the scan and cleared straight
after, because `tryAttack` fans out through four different target scans (pistol, bayonet, melee,
building) that the host player and every AI bot also call. With it at zero the code is
byte-for-byte the old behaviour, which is why solo and the AI are untouched.

## THE FIVE DEFECTS THAT FELL OUT OF THE AUDIT

1. **Arrows tunnelled through people — and it cost the host too.** `dt` is clamped to 0.05, a
   full-draw arrow flies at 57.6 u/s = **2.88 u per step against a 2.24 u hit *diameter***, and
   `updateProjectiles` did one point-in-circle test per step. The host was measured pegged at that
   clamp (17 fps), so this was the normal regime, not an edge case. Now a swept segment.
2. **Mobile guests predicted at full speed while the host walked them at half.** `12-touch`
   mirrors the analog stick into `w/a/s/d` at a 0.38 threshold, and the guest's own prediction was
   the only one of three call sites into `moveUnit` that ignored `mag`. A half-deflected thumb
   predicted double the speed the host granted, and the leash fought it every frame. It now reads
   the same `readMove()` vector the host is sent.
3. **The dead zone degenerated at high ping.** `gapAvg` is clamped to 1200, so
   `dead=3.2+(gapAvg-83)*0.02` reached 25.5 — above `gapAvg≈1173` the soft branch was unreachable
   (anything over 25 hit the hard snap first) and the body got no correction at all below 25 units
   of error. Jorunn's p90 was 1294 ms. Now `Math.min(18,…)`.
4. **Guest dragoons had a shorter pistol than everyone else** — 12 against the host's and the AI's
   15. A penalty for being the laggier player. Now 15 for all.
5. **The draw-charge clamp reset on packet loss.** `r.drawT` accumulated only on frames with a
   fresh `atk` bit, and the staleness path swaps `r.input` for `{}` — so `else if(!i.atk)` read
   silence as "let go" and robbed a guest of charge it was actually holding. Silence is not a
   released trigger.

---

# ⇢ WHAT TO DO NEXT

1. **Re-run the field test on v128.5.** Same drill: host + guests, 15+ minutes, F9 on every
   machine, `node tools/netlog.js <host.json> <guest…>`. What to check:

   | check | expect |
   |---|---|
   | `outages` line in section 2 | **near zero dead seconds**; certainly no 39-second run |
   | `held RELAY` in section 1 | **non-zero** whenever the fast lane is down — that is the brake working |
   | `relay lag` | should sit well under `REL_ACK_WINDOW:30` |
   | `rewind` / `view stamps` | **non-zero and ~100%** — if rewind sits at 0 while ping is high, the claim is not arriving |
   | section 3 `guest got` vs `host sent` | now comparable — it read 171% because relay sends were uncounted |
   | `drop` events | **one per departure**, with a reason: `left` / `pc-failed` / `silent-Ns` |
   | guest `stale` | should collapse with the floods gone |

2. **Ask the guests the question the logs cannot answer: does melee feel like it connects now?**
   Lag compensation is the one change here that a log file cannot verify. It needs a human who was
   chasing someone.
3. **If outages persist but are short**, the fast lane is still dying too often — 15 redials and
   7 wedges in 17 minutes. `LANE_WEDGE_MS` is the dial.
4. **Then the unit rigid-cluster merge**, below. `simR` is 0.779 and the host is at 17 fps.

---

# ⇢ THE MEASUREMENT THAT SHOULD DRIVE THE PERFORMANCE WORK

`node tools/drawcost.js` renders a base fight and A/Bs the units in and out:

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

`_mergeColored` in `02-world.js:192` welds tree parts into one vertex-coloured `BufferGeometry`.
**Nothing does that for units.** Every boot, buckle and eyeball is its own draw call, 54 times
over. This inverts the conclusion about imported models — see the Blender section — and makes the
fix obvious.

### The fix, concretely: rigid-cluster merge

A unit animates, so you cannot merge the whole body. But **most parts do not move relative to each
other.** Merge per rigid cluster, using the technique `_mergeColored` already proves works here:

| cluster | today | merged |
|---|---|---|
| torso assembly (chest, belt, tabard, pack, straps) | ~14 meshes | 1 |
| head assembly (skull, hat, face, plume, brim) | ~10 | 1 |
| each arm | ~4 | 1 (×2) |
| each leg | ~5 | 1 (×2) |
| weapon | ~6 | 1 |
| **total** | **~48** | **~7** |

≈ **7 draw calls per unit instead of 33–48.** At 54 units, 2,086 → roughly 660. Largest single
performance lever in the project, and it is a netcode item, because it is what lifts `simR`.

**Before starting, read these three hazards:**

1. **`buildBodyFor` (`04-units.js:128`) disposes geometry on rebuild** and the comment above it
   documents the v122 leak that whited out John's iPhone. Merged geometries are per-unit and must
   be disposed on the same path. Materials must NOT be — they come from `_skinCache` and are shared.
2. **The pixel skins.** Units wear hand-drawn generated textures via `texturedMat`. One material
   means either a small atlas with remapped UVs, or moving those parts to vertex colours. Decide
   which before writing any merge code; it is the whole design.
3. **`tryAttachModel` runs first.** Any merge has to sit on the procedural branch, below the
   model-registry early return, or it silently does nothing when a glTF is registered.

**Do not build per-guest AOI.** v127 measured it: 1 guest → 13.3 rows/snap, 2 guests 90 units
apart → 14.3. One row. Re-measure with `--sep` before believing that changed.

### If you want more wire savings after that

`tools/netprofile.js` prices every snapshot field by deletion through PeerJS's own BinaryPack.
At 2 guests / 138 units / 15 Hz: **335 B/snap**, of which **unit rows are 79%** at 18 B each. The
envelope is down to 8 B. The only remaining fat is in the rows. Measure first.

---

# ⇢ WHAT v128 WAS: THE GRAPHICS PASS

John asked for a "Pokémon Gen 1 Pallet Town / better than Game Freak" look. **Shipped and
verified in renders:**

- **`MeshToonMaterial` everywhere**, off one shared 4-step gradient ramp (`TOON_RAMP`,
  `makeToonRamp(4)`, steps `[0x64,0x9e,0xd2,0xff]`, `NearestFilter`, **no sRGB encoding** —
  encoding it smears the steps back into a gradient). Five edits in `01-engine.js` converted the
  whole game because `mat`, `plainMat`, `texturedMat`, `headMaterials` and `heraldryMat` all
  originate there.
- **Lighting**: `HemisphereLight(0xb1e1ff,0x447755,0.75)` + `DirectionalLight(0xfff4e0,1.15)` at
  `(36,90,48)` + 0.05 warm ambient. `LinearToneMapping` at exposure 0.78 — **ACES was crushing the
  ramp**, which is why tone mapping changed at the same time.
- **Camera near plane raised 0.1 → 0.6.** For Android depth precision, load-bearing for flicker.
  Do not lower it back.
- **Six-layer instanced undergrowth** in `02-world.js`. Road exclusion walks the `roadPoint()`
  polyline because a straight z-band missed the curve and grass grew through the King's Road.
- **Outlines**: inverted-hull (BackSide + normal push in a vertex shader), fog-aware.

**It cost frames.** The host ran at `simR` 0.779 / 17 fps median in the field test, against 0.85
before. Nothing here is free on a 10-year-old laptop hosting 136 units.

## The outline saga, and where it landed

- **Units carry NO outline.** Head-only ink read as a rendering defect, not a style — John's words
  were "looks odd and not great." Off by default, reachable with `?ink=heads`.
- **Only gable roof slabs are inked**, at **1.8 CSS px** (`03-buildings.js:242`).
- **`?ink=<n>` scales everything.** `?ink=0` off · `0.5` half · `2` double. **Have John dial it on
  the device and report the number** rather than shipping a build per guess.

**Rejected, with reasons, so nobody spends a session re-attempting them:**

- **Screen-space depth-edge outlines.** Failed three ways: `EffectComposer.clone()` copies
  `depthTexture` by reference so the pass sampled its own target; `ShaderPass.render()` reassigns
  `uniforms[textureID]` from `readBuffer.texture` and blacked the screen; and depth still read
  all-zero under swiftshader, so it could not be verified headlessly at all.
- **Tree outlines as hull children.** Broke `v114 draw budget`, which asserts a tree is ONE mesh.
  **The correct fix is to bake the inside-out shell into the merged geometry** inside
  `_mergeColored` — zero extra draw calls. Same machinery the unit merge needs. Build it once.

---

# The netcode as it stands

`js/10-net.js`, ~2150 lines. PeerJS, **host-authoritative**. Constants at lines 26–95:

```
SNAP_HZ:15   INPUT_HZ:20         BUF_FAST_MAX:16384   BUF_REL_MAX:16384
AOI_NEAR:60  AOI_FAR_EVERY:4     MIRROR_EVERY:15      INPUT_STALE_MS:600
INPUT_EASE_MS:250                AUTH_FRESH_S:0.6 (legacy path only)
AGE_FRESH_MS:600                 HOFF_DECAY_MS:20000
LANE_WEDGE_MS:2500               REDIAL_MS:1200       DIAL_TIMEOUT_MS:6000
EXTRAP_MAX_MS:260                PROTO:26
v128.4:  REL_ACK_WINDOW:30   REL_FALLBACK_HZ:4   PEER_DEAD_MS:90000   PC_DEAD_MS:30000
v128.5:  HIST_SLOTS:24  HIST_MIN_MS:22  LAGCOMP_MAX_MS:500  LAGCOMP_SLACK_MS:120
         MELEE_WINDOW_MS:120  CATCHUP_STEP_MS:16.7
```

- **ONE CLOCK.** Every timing decision reads wall time through `NET.now()`. Monotonic on purpose.
- **TWO LANES.** A reliable PeerJS `conn` for handshake/acts/notes, and an unreliable one
  (`NET.fast`, `dialFast`) for snapshots. `bcastFast` **skips rather than queues** above 16 KB.
- **THE RELIABLE LANE IS NOT A SNAPSHOT LANE (v128.4).** When the fast lane dies, the relay runs
  at `REL_FALLBACK_HZ` and stops entirely once the guest is `REL_ACK_WINDOW` snapshots behind.
  Read the comment block in `bcastFast` before touching any of it.
- **SNAPSHOTS ARE PACKED BINARY DELTAS.** 18 B/unit row (`packRows`/`readSnapRows`, one shared
  decoder used by the smoketest too), 8 B/building row. Unchanged rows are skipped.
- **AOI.** Units within `AOI_NEAR` of any guest body ship every snap; distant ones every 4th,
  staggered by `(snapN + id) % 4`. Structural changes always ship at once.
- **THE LEASH.** The guest predicts its own body; the host corrects it, inside a 6-unit leash and
  only from a snapshot whose measured **age** is under `AGE_FRESH_MS`.
- **THE GLIDE (v127).** A remote body remembers the velocity of the leg it just walked and keeps
  walking for `EXTRAP_MAX_MS`, but only while the host says that body is moving.
- **THE WORK PULSE.** A 2-bit counter in the unit flags byte, ticking every 0.5 s of work.
- **THE PEER REAPER (v128.4).** `NET.hostRelease(key, why)` + `NET.reapPeers()` on the 1 Hz tick.
- **LAG COMPENSATION (v128.5).** A 528 ms ring of quantized positions sampled once per host frame;
  `NET.histAt(u,t)` answers "where was this unit then" into scratch scalars without mutating
  anything. Guests stamp combat frames with `at`; `NET.rewindTime` clamps the claim to the peer's
  own rtt. Melee sweeps the swing window, arrows fast-forward from the past.

## Rules for changing the wire

- **PROTO is 26.** Bump it only for a change an old peer would *misread*. An OPTIONAL field an old
  peer ignores does not need a bump — that is how `mx`/`mz`/`shot`/`ht` shipped, and how
  v128.4's `aq`/`et`/`bye` and v128.5's `at` shipped. **OMITTING** a field an old peer reads
  unguarded is the other case, and that is v127's envelope delta: 25 → 26.
- **`packRows` and `readSnapRows` are one codec** used by both the game and the smoketest.
- **Never trust a guest's claim.** The guest reports, the host clamps to what it observed.
- **The v125 fallback path is load-bearing.** When `ht` is absent, `applySnap` uses the old
  sim-clock comparison and `guestFrame` resumes advancing `estT`. There is a test for that pairing.
- **Extend `tools/smoketest.js`, don't write a new harness.**

## Netcode threads still open

- **THE v128.4 FIELD TEST.** See "what to do next" at the top.
- **The fast lane still dies too often.** 15 redials and 7 wedges in 17 minutes. `LANE_WEDGE_MS`
  is the dial, and the wedge's "hand it to the reliable relay" is no longer the disaster it was —
  but a lane that has to be rebuilt 15 times is not healthy.
- **Does the leash coming back feel right?** If it reads as rubber-banding, the dial is the
  6-unit dead zone and `dead=3.2+(gapAvg-83)*0.02`, **not** `AGE_FRESH_MS`.
- **Do distant units read as smoother?** The v127 glide cannot be verified from a log file.
- **Hall registry election.** The public hall list lives on whichever host holds `HALL_ID`. When
  that host leaves, nothing elects a replacement.
- **host-can't-play-RED.** `tryAgeUp` checks `teamTC(BLUE)` while reading `teamAge[MYTEAM]`.
- **There is still no way to leave a match except closing the tab.** `bye` now makes that clean,
  but a Leave button belongs in the menu.
- **Unit draw calls.** Top netcode item — see above.

---

# ⇢ THE SERVICE WORKER, AND THE TRAP IT SET

`sw.js` exists because Chrome on Android will not offer a real WebAPK install without a
fetch-handling service worker, and the ~29 MB first load otherwise stares at a blank screen.

**What went wrong in v128.2.** Cache-first for `js/*.js`, keyed on a `VERSION` constant a human
had to remember to bump. Two JS files were edited without a bump; any phone with the v128.2
worker served the **old** `04-units.js` out of cache permanently.

**The fix, v128.3.** `js/` and `css/` are **network-first**, like the HTML (~830 KB uncompressed,
~200 KB gzipped, and GitHub Pages sends ETags, so the common case is a 304). Cache-first stays on
`libs/` and `assets/`. Only `.ok` responses are cached, and the offline fallback no longer hands
`index.html` to a script request.

**Two things anyone touching this must know:**

1. **A deploy needs TWO page loads to take effect.** The old worker controls load #1 while the new
   one installs behind it. If a change appears not to have shipped, reload once more.
2. **The verstamp is the diagnostic.** The menu reads `v128.4 — THE LANE THAT COULD NOT DROP`.
   **All three v128 field logs reported v128.2, not v128.3** — ask which version a device reports
   before believing any bug report about rendering.

---

# The game as it stands

## The shape of the codebase

Three HUD layouts, exactly one runs per session:

| file | when | what |
|---|---|---|
| `js/12-touch.js` | a touchscreen | the phone build: rotated stage, thumb zones, contextual rail, action grid, frame cap, battery saver, 34px strip |
| `js/13-deskui.js` | everything else | the same strip on desktop at 46px, no rail, no stage, no cap |
| neither (`?ui=classic`) | escape hatch | the pre-v125 desktop HUD, seven floating panels, untouched |

**The handshake is one line.** 12-touch loads first and adds `touch-mode` to `<html>`
synchronously if it is taking over; 13-deskui loads second and returns immediately if it sees it.

Two shared branches read those classes at CALL time: `updateRoster()` in `07-ai.js` and
`updateAgeHud()` in `08-ui.js`.

**Why 13-deskui is a separate file.** Deliberate — 12-touch's strip is held up by ~190 assertions
that took thirteen field-test rounds to get green. **If a third layout ever appears, extract then.**

14 script files, no bundler, loaded in index order. **Load order is a real constraint** — trap #13.

## Battery Saver (mobile only, default ON)

Moves pixel ratio 0.7 ↔ 1.0 and cull distance 88 ↔ 105, and caps the frame rate. John's sessions
are 30 fps at 0.7 unless he taps it off. **The phone's real drawing buffer is 590×273.**

---

# Tests

Three harnesses. **All three are green as of v128.4**, verified this session:

| harness | count | runtime | port | run it after |
|---|---|---|---|---|
| `node tools/smoketest.js` | **426 PASS** (388 baseline + 17 in v128.4 + 21 in v128.5) | ~100 s | — | anything |
| `node tools/mobilecheck.js` | **MOBILE SPIKE OK** | ~5 min | 8132 | any `12-touch.js` or CSS change |
| `node tools/deskcheck.js` | **DESKTOP UI OK** | ~2 min | 8133 | any `13-deskui.js`, CSS or shared-branch change |

v128.4's 17 cover the relay rate cap, the ack window opening and releasing, the mirror's
exemption, `sentR` counting, the reaper's 90 s threshold *and* its refusal to fire at 25 s, `bye`,
`hostDrop` back-compatibility, and the e-tap. v128.5's 21 cover the ring (interpolation between
samples, clamping past the end, a unit born mid-ring), the trust boundary (an over-claim cut to
rtt+slack, an honest claim granted, the hard ceiling, a future claim refused, an unstamped guest
estimated), the melee sweep, the arrow sweep and the catch-up.

**Every one of the combat assertions reproduces the uncompensated MISS first**, in the same block,
so none of them can pass vacuously — and they stage their duels in an empty corner of the map
found at runtime, because `tryAttack` scans every unit in the world and a bystander would score
them for the wrong reason. That isolation is itself asserted.

### ⚠ mobilecheck needs files that are not in the sandbox

`tools/mobilecheck.js`, `tools/deskcheck.js`, `css/`, `libs/`, `assets/` and `js/audio-data.js`
live on John's machine. **Stage these at the start of any session that will run a browser check:**

```
tools/mobilecheck.js  tools/deskcheck.js  css/style.css  libs/*  js/audio-data.js
assets/icon-192.png   assets/icon-512.png   assets/apple-touch-icon.png   manifest.json
```

With them present the suite reports MOBILE SPIKE OK; without the icons,
`v120 pwa: the manifest asks for fullscreen landscape with real icons` **false-reds** on
`fs.existsSync`.

### Known flakes

- **`v124.1 feed — a promoted line is MOVED to the banner`** — flaked in 3 of 4 mobilecheck runs
  this session, sometimes under `phone:`, sometimes `portrait:`. **Confirmed pre-existing:** a
  pristine v128.3 tree fails the identical assertion. Harness state bleed, not a game bug — but it
  is now frequent enough to be worth fixing rather than tolerating.
- **The militia-pair smoketest flake** — measured this session at **2 failures in 9 runs** on
  v128.5 against **0 in 9** on a pristine tree. Do not read that as a regression: the v128.5 code
  is provably inert before line 862 where the test runs (no `p.free` projectile is ever created by
  an AI unit, and `hostFrame` — hence `histSample` — never runs before it). The real cause is that
  **`Math.random` is unseeded in the harness**, so the 400 warm-up ticks put the world in a
  different state every run and the test is a coin flip weighted by the AI's luck. Seeding it is
  the fix, and it would make the whole suite reproducible. Start at `manageBands`.
- `turtle curtain wall` has not been reproduced since v127.

---

# The traps this codebase sets

1. **`getBoundingClientRect()` inside `#tstage` returns the TRANSPOSED box.** The stage is
   `rotate(90deg)`. Use `offsetTop`/`offsetLeft`/`offsetWidth`/`offsetHeight`. **Bitten five times.**
2. **A child cannot escape its parent's stacking context.** Bitten four times. Desktop z-map:
   HUD 10–12, menus 20, scoreboard 40, help 45, overlays 50+.
3. **A CSS custom property on an ancestor cannot read one defined on a descendant.** `--tbarfull`
   and `--sb` must both live on `#tstage`.
4. **`scrollWidth` does not count start-side overflow.**
5. **A flex child that can shrink can never be dropped.**
6. **Node 22 defines a global `navigator`.** Both UI layers guard on
   `document || location || screen || navigator` being absent.
7. **SIM TIME IS NOT WALL TIME, and the harness pins one of them.** `clock.getDelta` is fixed at
   `1/30` in `smoketest.js`. Anything reading `NET.now()` needs the harness's synthetic wall clock.
   - **Never mix `performance.now()` and `NET.now()` in a test.**
   - **A frozen wall clock silently starves the feed.** Override `NET.now` and restore it.
8. **A "per second" counter is only per second if something says so.** Rows carry `win`. Divide by it.
9. **A regicide mid-run disarms `dealDamage` ITSELF.** Clear the flag **per tick**, and protect
   **town centres only**.
10. **A test that reaches past the real entry point cannot see a missing call site.** **Drive the
    frame**, and assert `spied>0` so it cannot pass while measuring nothing.
11. **The harness runs every file in STRICT mode; the browser does not.** That is why `__WIRE` exists.
12. **A guest runs a DIFFERENT frame.** `NET.guestFrame` is not `tickBody`. Siblings to audit:
    `drainVisualQueue`, `updateEffects`, `updateProjectiles`, `tickAgeResearch`, `Sound.tick`,
    `updateRoster`, `drawMinimap`, `tickBoardBang`.
13. **Load order is real: `dist2` lives in `04-units.js`, which loads AFTER `02-world.js`.**
14. **r128 `InstancedMesh` frustum-tests against the BASE geometry's bounding sphere.** Every
    instanced layer needs `frustumCulled=false`.
15. **Vertical planes face an overhead sun edge-on** and drop into the toon ramp's bottom cell.
    Grass blades blend normals 45% skyward (`SKY_BLEND=0.45`).
16. **Anything expressed in "px" in a shader must say WHICH pixel.** `__syncInk` divides by
    `renderer.getPixelRatio()`.
17. **A sync function wired to events but never called at init.** **If a function's job is "keep X
    in step with Y," call it once at boot.**
18. **A cache keyed on a constant a human must remember is not a cache strategy.** See `sw.js`.
19. **v128.4 — `bufferedAmount` is not a delivery signal on a RELIABLE ORDERED lane.** It counts
    what the transport has not yet *accepted*, not what the receiver has not yet *got*. SCTP keeps
    accepting while it retransmits, so a head-of-line-blocked channel reads as empty. **Ask the
    receiver.** This cost 35% of a guest's session and hid behind an empty buffer for 30 versions.
20. **v128.4 — a counter that only counts the happy path makes the sad path invisible.** `sent`
    counted fast-lane sends only, so the host logged `sent:0 skipF:0 skipR:0` — indistinguishable
    from idle — in exactly the seconds it was flooding a dead pipe. **If a branch can send, it must
    count.**
21. **v128.4 — a transport event you do not receive is not a transport event.** PeerJS held a
    DataConnection `open:true` for 8 minutes after the player was gone, firing neither `close` nor
    `error`. Anything whose only trigger is a library callback needs a timeout behind it.
22. **v128.4 — two subsystems writing one variable, and the loser is whichever runs first.**
    `autoTick` and the USE button both wrote `keys.e`; `autoTick` ran later and won every frame.
    **A discrete user action needs a discrete message, not a shared per-frame boolean.**
23. **v128.4 — the host truncates peer names to 14 characters** (`hostAdmit`, `.slice(0,14)`), so
    a host row keys "Jorunn the Black" as `Jorunn the Bla`. `netlog.js` looked that up by full name
    and silently reported "no overlapping seconds" for **every** long-named guest. Section 3 had
    never once worked. Resolve keys by prefix.

24. **v128.5 — `bufferedAmount` has a sibling: a hit test finer than the data that feeds it.**
    Positions on the wire are quantized to 10 cm, so the rewind ring stores them the same way.
    Rewinding at float precision against a target whose position you only know to 10 cm is
    measuring noise and paying memory for it.
25. **v128.5 — rewind by READING history, never by mutating the world.** The textbook shape of
    lag compensation moves the live transforms, tests, and moves them back. That leaves a window
    in which a throw mid-check strands every other system in the past. Keep the history in its own
    store and hand the answer back in scratch scalars; then there is no restore step to forget.
26. **v128.5 — a compensation that can take a hit away is a bug, not a trade-off.** `rwDist`
    returns the MINIMUM of the rewound window and the present-tick distance, so the system can
    only ever add hits a fair player earned. Anything that resolves purely in the past will start
    denying hits that connect on screen right now.
27. **v128.5 — a projectile cannot be rewound like a hitscan.** An arrow has travel time, so the
    honest fix is to spawn it at the instant it was loosed and fast-forward it to the present
    against positions rewound to each step. Compensation does NOT mean the shot lands: the player
    still leads the target. It means they stop having to lead an invisible network offset too.
28. **v128.5 — a duel test in a world of 136 units is scored by bystanders.** `tryAttack` scans
    every unit alive. Stage combat assertions in an empty corner found at runtime, and assert that
    the corner is actually empty, or the test passes for reasons you did not write.

And about the harnesses:

- **`mobilecheck` blocks share one `page.evaluate` and inherit state.** Isolate anything stateful.
- **"the string changed" is not proof a loop ran.**
- **A text write into the HUD does not hold.** `updateResHud` is event-driven.
- **The player spawns INSIDE the Town Centre's deposit radius.** Move the player to the tree first.
- **A test that leaves authority armed poisons the next block.** Clear `player.authX`.
- **`pkill -f mobilecheck` kills the calling shell.** Clear the port by PID:
  `ss -tlnp | grep 8132 | grep -oP 'pid=\K[0-9]+'` then `kill -9`. deskcheck uses **8133**.

---

# Tooling

| tool | what it answers |
|---|---|
| `tools/netlog.js` | **the field-test reader.** Joins host+guest logs on wall-clock `t`. **v128.4: the join now resolves truncated host keys (it never worked before), reports the OUTAGE LADDER — runs of zero arrivals, their recovery floods and whether the flood carried everything that was pushed — surfaces `sentR`/`holdR`/`relay lag`, and flags a pre-128.4 host whose `sent` cannot be trusted. v128.5: reports the `rewind` actually GRANTED per guest and what share of seconds carried an `at` view stamp — a rewind stuck at 0 while ping is high means the claim is not arriving.** |
| `tools/netprofile.js` | exact snapshot bytes by field, via PeerJS's own BinaryPack. `--guests --sep --snaps` |
| `tools/drawcost.js` | A/Bs units in and out of a rendered frame — the 33.4-calls-per-unit number. |
| `tools/perfcheck.js` | draw calls / tris / ms at three vantage points, deterministic. |
| `tools/vista.js` | 6 fixed-camera renders at desktop res. |
| `tools/phoneshot.js` | the same at 844×390 / 0.7 ratio. **Run after ANY change to something measured in px.** |
| `tools/inkweight.js` | renders gable roofs across `?ink=` scales at phone resolution. |
| `tools/treemap.js` | world-gen distribution. |
| `tools/browsercheck.js` | audio, http + `file://`. |
| `tools/cartshot.js` | model changes. |

**Rendering is headless Chromium via playwright-core + swiftshader** at
`/opt/pw-browsers/chromium-*/chrome-linux/chrome`. Do not run `playwright install`.
**swiftshader cannot be trusted for depth-buffer work.**

---

# Workflow / protocol

Browser 50v50 regicide war game, Three.js r128 no-bundler, PeerJS host-authoritative, **PROTO=26**.
John's copy at `C:\Users\John Thompson\Desktop\REGICIDE PVP\REGICIDE PVP GAME` — that inner folder
is the git repo. The **parent** also holds `potential sounds\` (1,691 files, 2.6 GB) which must
**never** reach GitHub. Deploy is **commit + push in GitHub Desktop** → `nutcrackerregicide.github.io`.

Deliver work with `SendUserFile` **and** `mcp__remote-devices__device_commit_files` to that folder —
he commits and pushes from GitHub Desktop himself. Request folder access to the inner game folder
only; `Downloads` is where the F9 net logs land.

**Do not accept a GitHub token pasted into chat.** This was asked and declined; keep declining.

Notes on sandbox drift:

- The sandbox's git history is **not** a mirror of John's repo. Do not reason about what is
  deployed from `git log` here. **Ask, or read the verstamp.**
- `assets/anims.js` exists on John's machine, is absent from the sandbox, and its `<script>` tag is
  **commented out** in `index.html`. Do not write tests that assume baked anims.
- `tools/mobilecheck.js`, `tools/deskcheck.js`, `css/`, `libs/`, `assets/*.png` and
  `js/audio-data.js` all need staging — see the Tests section.

**Verify chain:** `node --check` every changed file → `npm i three@0.128.0 playwright-core` →
`node tools/smoketest.js` 2–3× → `node tools/deskcheck.js` after any `13-deskui.js`/CSS/shared-branch
change → `node tools/mobilecheck.js` after any `12-touch.js`/CSS change → `node tools/browsercheck.js`
after any audio change → `node tools/phoneshot.js` after anything sized in pixels →
`node tools/perfcheck.js` + `treemap.js` after world-gen changes → **`node tools/netlog.js` on any
new field logs** → bump the verstamp → **bump `VERSION` in `sw.js`** → update this handoff.

---

# Can Blender MCP refine the models?

No Blender MCP was connected, so this is the assessment, not a result.

**Yes, and the draw-call arithmetic runs in favour of it — the opposite of the initial guess.**
Because units are 33–48 draw calls today, a glTF character with **one material** would be **1 draw
call**, cutting 1,803 → 54. Even a careless 20-material export would be roughly break-even. The
constraint is **material count per model, not polygon count**; 1,089 tris per unit is nothing.

The integration path already exists: `01-engine.js` has a glTF registry (`MODELS`,
`MODEL_MANIFEST`), and `buildBodyFor` hot-swaps live units the moment a model loads.

**Caveats, worst first:**

1. One material, one atlas, or the win evaporates.
2. The current look is deliberate — hand-drawn pixel skins on a 4-step toon ramp.
3. Animation is a separate project: `assets/anims.js` is on his disk, `<script>` commented out.
4. **Best first target is buildings and scenery, not characters** — static, fewer on screen, no rig.

**History to check before committing a weekend:** `00-data.js:331` reads
`const MODEL_MANIFEST={}; // imported models retired — characters use generated pixel skins`, with a
note that the Tripo→Mixamo pipeline (`tools/autorig.py`, `tools/mixamo_merge.py` — **not present in
the sandbox**) still works. John went down this road once and backed out. Find out why first.

---

# Open threads / watch list

- **THE v128.5 FIELD TEST.** Top of this document. Everything netcode is downstream of it, and
  lag compensation is the one change in it that a log file cannot verify — it needs a human who
  was chasing someone to say whether melee connects now.
- **The unit rigid-cluster merge.** Biggest single lever in the project, and it is a netcode item.
- **ASSET LICENCE — still unresolved, and the repo is public.** 75 of the 139 sounds carry
  `2021 Epic Stock Media (Empire Game) — All Rights Reserved` in their Vorbis comments, and
  `js/audio-data.js` embeds the same 139 as base64. Nobody has read the actual terms. **Highest-
  stakes item on this list**, and it gets worse the closer this gets to Steam or ads.
- **The Android flicker.** Two fixes shipped blind — near plane 0.1 → 0.6, and outline hulls that
  were wrongly blamed then correctly cleared. **Never confirmed fixed on a device.** `?ink=0` is
  the A/B if it recurs.
- **Outline weight on a real phone.** `?ink=<n>` is the dial; 1.8 CSS px is the default. Get a
  number from John, don't guess.
- **A Leave button.** There is no way out of a match but closing the tab.
- **Seed `Math.random` in the smoketest.** It is the root cause of the militia flake and of any
  future one — 2933 lines of assertions running against an unseeded AI is a suite that can only
  ever be probabilistically green.
- **Client-side prediction is still "prediction-lite"** and deliberately so: no input buffer, no
  state history, no replay. The gap analysis explains why replay would fight the leash rather than
  help it — read it before anyone decides to "do reconciliation properly".
- **The feed-banner mobilecheck flake** is now hitting most runs. Fix it or it will mask a real one.
- **v125 desktop bar field test.** Does the 46px strip feel right on a 1920 monitor?
- **Wood economy never rebalanced** — ~95,000 wood on the map since v114 against ~12,600 before.
  Dials in order: `amount:140` in `makeTree` → 60–80, then `STEP`, then stand count.
- **Combat feel, never started**: camera shake scaled to damage, hit-stop on kills, directional
  blood/spark bursts, floating damage numbers, directional knockdown on death.
- Older: quest balance, v94 AI playtest.
