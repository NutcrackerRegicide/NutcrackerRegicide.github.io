# REGICIDE PVP — Handoff v127 (July 2026)

Read this at the start of a new chat to continue. `claude/REGICIDE-DEPLOY.md` covers hosting.
Supersedes `REGICIDE-HANDOFF-v126.md` and `REGICIDE-HANDOFF-v125.1.md`, both of which should be
deleted from the project.

**Shipped: `v127 — THE DIET AND THE GLIDE`.** Next version: **v128**.

> ### ⚠ PROTO WENT TO 26. Host and guests must both be on v127.
> The snapshot envelope (`stock0`, `stock1`, `carry`, `ares`) now ships **only when it changes**,
> plus the existing 1 Hz keyframe. A v126 guest reads `s.stock0.f` unguarded, so an absent field
> would write **NaN into the treasury** — a misread, which is exactly what the bump rule is for.
> The hall list already refuses a mismatched peer with "⚠ other version" rather than letting it
> join and break, so the failure mode of a stale tab is a clear refusal, not a broken game.
> World gen untouched since v115. Layout untouched since v125.1.

---

# ⇢ WHAT v127 WAS

v126 fixed the netcode's *measurement* — it stopped comparing a sim clock to a wall clock, and it
made the flight recorder tell the truth. v127 is about what the honest numbers then pointed at:
**bytes**, and **how remote bodies move between snapshots**.

## First, an instrument: `tools/netprofile.js`

```
node tools/netprofile.js [--guests N] [--sep UNITS] [--snaps N]
```

The only size number the game had ever reported was `s.bs`, a hand-written estimate that guessed
the envelope at a flat 140 bytes and **did not count `carry` at all**. So "where do the bytes go?"
was unanswerable, and optimising without answering it is guessing.

netprofile packs real snapshots from a real world through **PeerJS's own serializer**
(`peerjs-js-binarypack`, the same BinaryPack a `DataConnection` uses) and prices every field **by
deletion**: pack the snapshot, delete one field, pack again, and the difference is that field's
true cost with its key name included. No estimates, no double-counting.

What it found, at 2 guests / 138 units / 15 Hz:

| | before v127 | after |
|---|---|---|
| mean bytes per snapshot | 406 B | **335 B** (−17.5%) |
| everything that is not unit/building rows | 142 B/snap | **71 B/snap** (halved) |
| `stock0`+`stock1`+`carry`+`ares` | 77 B/snap | **8 B/snap** |
| unit rows (`ub`) | 264 B/snap (65%) | 264 B/snap (79%) |

**And the redundancy that justified the change:** across 300 snapshots, `stock0`+`stock1` were
byte-identical to the previous snapshot **100% of the time**, and so was `carry`. That was ~1.0 KB/s
per guest of pure repetition, on a host whose send buffer sat at or over `BUF_FAST_MAX` for 11–13%
of John's session and dropped 2,991 snapshots between the two guests.

## The envelope diet

Unit rows have shipped only-when-changed since v95. Building rows since v95. And then `stock0`,
`stock1`, `carry` and `ares` were re-sent in full **fifteen times a second**. v127 puts the
envelope on the same discipline, healing through the same every-15th-snap keyframe the rows
already use — so a dropped packet costs at most one second of staleness, exactly as before.

`ares` is the interesting one: it was worse than redundant. The guest already interpolates the
advance countdown locally via `tickAgeResearch(dt,false)`, so 15 Hz of authoritative overwrite was
**fighting its own smoothing**. It rides ~2 Hz now.

`s.bs` was also rewritten to count what is actually present. It now under-reports by 1% instead of
being structurally blind to a whole field.

## The glide: remote bodies stopped standing still

This one is pure feel, and it needed no wire change at all.

```js
const a=Math.min(1,(NET.now()-(u.netAt||0))/NET.gapAvg);   // ← clamps at 1
```

A remote unit glided from where it was drawn to the newest truth over `gapAvg`, **and then froze
until the next row arrived.** Do the arithmetic on the field logs: `gapAvg` measured 76–78 ms
median, and a unit under the AOI far-stagger ships every 4th snap ≈ **266 ms**. So two thirds of
every distant unit's life was spent standing perfectly still and then jerking forward — plus one
extra freeze for every dropped snapshot, and each guest logged ~1,400 sequence holes.

Now the guest remembers the velocity of the leg it just walked (`netVX`/`netVZ`, **derived from the
two positions it already received** — no bytes, and it cannot disagree with the data it came from)
and keeps walking along it past the end of the glide. Two guards:

- only while the host still says that body is **moving** (bit 2 of the flags byte, held in `gmv`);
- only for `EXTRAP_MAX_MS` (260 ms ≈ one far-stagger period), so a body that stopped or turned is
  never flung onward.

**Why overshoot is safe here, which is the whole reason this is a small change rather than a
risky one:** on every arrival the code already sets `netPX` to *wherever the unit is currently
drawn* and glides from there. A wrong guess is absorbed by the same smoothing that handles a late
packet. The existing design made extrapolation safe by construction; it just never used it.

## Measured and REJECTED: per-guest AOI

Worth recording so nobody spends a session on it. `packSnap` builds **one** snapshot for all
guests and tests `AOI_NEAR` against **every** guest's body, so in principle each guest receives
every other guest's neighbourhood at full rate. Per-guest packing would fix that.

Measured: 1 guest → 13.3 rows/snap. 2 guests 90 units apart → **14.3 rows/snap.** One row.

The near-set is dominated by the units clustered around the town centres, which everybody is near
regardless. The sharing costs almost nothing, and per-guest packing would have added per-guest
delta baselines and N pack passes to the host that is already the frame-rate bottleneck. **Don't
build it.** If a future match ever spreads guests to opposite corners of the map with big warbands
each, re-measure with `--sep` before believing that changed.

## THE SUITE ITSELF: from ~1 run in 4 red, to 12 clean in 13 — and the last one is named

Two releases (v126, v127) are on disk unplayed, one of them moving PROTO. The smoketest is the
only thing standing behind them — and it was failing about a quarter of its runs for reasons that
had nothing to do with the code under test. **A harness that cries wolf that often is one you
learn to ignore, and the day it is right you shrug at it.** So it was hardened before anything
else got built on top of it.

Three distinct causes, worth separating because the fixes are different:

**1. Tests that OBSERVED the world instead of CONTROLLING it.** The expensive one: `updateCreep`
only knits wounds in the branch it takes when no living non-neutral unit is inside the camp's
aggro ring. The test parked its own intruder outside and then trusted a hundred wandering army
bots to stay away for three sim-seconds. They did, about three runs in four — and when one drifted
in, the pack stayed aggro'd, regen never fired, and **all eleven camp assertions below it fell
together.** Same shape in the garden courtyard, the militia yard, the market cap's control case
(the AI's own markets could invert it), the v113 "cold field", and the rescue dispatch — which
needed an eligible band to exist at all, so it was really asking whether the campaign happened to
leave one alive. Two helpers now establish those preconditions explicitly, `isolateArea` and
`clearBuildings`, and **each puts its count in the assertion message** so an isolation that stops
isolating announces itself instead of quietly going back to being a coin flip.

**2. A regicide mid-run silently disarms the whole harness.** Two lines do it:
`09-main.js:634` wraps the entire simulation in `if(!gameOver)`, and — the one that took longest
to find — **`05-combat.js:196` makes `dealDamage` a NO-OP once the game is over**:

```js
if(!victim.alive||gameOver)return;   // 05-combat.js:196
```

So when a staged fight elsewhere on the map fells a king inside a tick loop, every subsequent
staged kill quietly does nothing and every timer stops, **for the rest of the run**. That is what
took out the eleven-check creep cluster, and separately the resurrection pair: *"the resurrection
target is a corpse first"* was failing because `dealDamage` had stopped dealing damage — not
because corpses were broken. The file used to tap `setGameOver(false)` between sections by hand;
sections that tick for hundreds of frames need it held down. The `tick` export is wrapped once now,
which covers both the local binding and every `global.__G.tick(...)` call site. **This is the most
transferable finding of the pass: any test that stages damage was implicitly betting that no king
had died yet.**

**3. Assertions with no margin.** The garden ring of six houses yielded ~2 plantings, and
`layGardens` rejects ~42% of candidate cells by a hash of their grid index — two is close enough
to zero to lose on the coin. Ten houses at radius 15 gives 32. Likewise, regen asserted a flat
`+20 hp` against a creep whose `maxHp` varies by kind; it is measured against `maxHp` now.

> **The counter-intuitive one, so nobody re-derives it the hard way:** TIGHTENING the garden ring
> makes it *worse*. At radius 7 or less the paving aprons merge and pave the courtyard away
> entirely — 0 gardens. The obvious "make the ring tighter so it definitely closes" breaks it
> outright. Probed across 10 geometries × 10 city layouts before choosing.

**Result: 12 clean runs in 13, 389 checks each** (against roughly one run in four red before, and
about seven distinct flake families). The eleven-check creep cluster has not recurred once across
the whole session, and `garden`, `sixth market`, `band dispatched`, `blacksmith at Iron`,
`v113 relief`, the resurrection pair and the splash/deposit pair are all gone.

One flake is left, and it is *named* rather than lurking: the militia pair — `an overwhelmed TC
levies villagers into soldiers` / `the militia stands down`. Its own diagnostic prints
`yard cleared of N`, and on the failure N was **0**, which rules out the enemy-isolation this pass
added: the levy decision itself never fired. `manageBands` is where to look, and the first
question is what else it needs besides a mob standing in the yard.

Do not paper over it with a retry. The whole point of this pass is that a named, understood flake
is worth ten silent ones.

## The wiring test — the one that would have caught the board "!"

`tickBoardBang` shipped broken for guests in v99 and stayed broken for **27 versions with a green
test the whole time**, because that test called `tickBoardBang()` by hand. It proved the driver
worked and said nothing about whether anybody drives it. Every check in this file that pokes a
helper directly has the same blind spot, and auditing 380 of them one at a time would find today's
instance and miss the next one.

So the wiring is asserted instead. Each of the twelve per-frame drivers is swapped for a counter,
one host frame and one guest frame are run, and the checks are: the host calls every driver it
owns; the guest calls every DISPLAY driver; the guest calls **no** host-authoritative driver
(`campTick`, `healTick`, `questTick`, `economyTick` must never run on a guest). A guest runs a
completely different frame from a host — it returns from `tickBody` at `09-main.js:631` and never
sees the 40 lines below — so **"it works" is meaningless until you say for whom.**

Two things that make this block trustworthy rather than decorative:

- **It was mutation-tested.** The `guestFrame` call to `tickBoardBang` was removed — re-creating
  the exact v99–v125 bug — and the guest's call count went 20 → 0. The check goes red on the bug
  it was written for. A wiring test nobody has ever seen fail is a wiring test you are guessing about.
- **It cannot pass vacuously.** Each check requires `spied>0`. Without that, a probe that installed
  nothing would filter an empty list and report three cheerful passes — a test that reports success
  when it measured nothing, which is the exact species of bug the block exists to hunt. The first
  version did precisely that, and said "all clear" while spying on nothing.

**Why `__WIRE` and not `global`:** `js/00-data.js` line 2 is `"use strict"`, and because the
harness concatenates all fourteen files into ONE script, the whole bundle is strict — under which
an indirect `eval`'s function declarations stay inside the eval scope instead of landing on the
global object. Exporting through `__G` does not help either: exporting a function exports a *copy
of the reference*, so reassigning `__G.campTick` does not change what `tickBody` calls. The only
place the binding can be swapped is inside the bundle's own scope, so the harness generates a
get/set pair per driver there. **Worth knowing independently: in the browser each `<script>` is
separate and only `00-data.js` is strict — the harness runs the other thirteen files under a
stricter regime than the game does.**

## Still on the table, with prices attached

- **`maxHp` rides every unit row** — 2 B of every 18. That is 29 B/snap in the profiler's quiet
  world and roughly 96 B/snap in a busy one. It changes only on class change, age restyle or a
  buff. Not done because the 18-byte row layout is shared with the smoketest's decoder and the
  age-up path recomputes stats on the guest in a way I did not want to trust on speculation —
  **measure the restyle path first.**
- **`sc` ships player NAME STRINGS at 5 Hz** — 19 B/snap. The names never change. Send them on the
  keyframe and cache by id on the guest.

---

# ⇢ WHAT v126 WAS

John closed v125.1 with: *"i want to improve netcoding next, i have some real world feedback a
json files from two guest and host from a real playthrough"* — and delivered them: one host
(`Sigrid the Lucky`), two guests (`John`, `Petra the Wolf`), the same 24-minute playthrough,
1213 / 1490 / 1287 rows.

**Every number in THIS SECTION is measured from those three files** — nothing in it is estimated.
(v127's byte figures above come from `tools/netprofile.js` instead, and say so.)

## THE BUG: a sim clock was being compared against a wall clock

`09-main.js:629` — `const dt=Math.min(0.05,clock.getDelta())`.

The host's real frame rate was **median 18.8 fps, p10 13.4, min 9.8**. Frames longer than 50 ms
have the excess *deleted* from `T` rather than carried, so the host's match clock ran at:

| host real fps | T advance vs wall clock |
|---|---|
| ~10 | **0.60×** |
| ~15 | 0.80× |
| ~20 | 1.00× |
| ~30 | 1.00× |

Overall: **T advanced 1230.6 s across 1449.6 s of wall time — 219 seconds of match time gone.**

`10-net.js` then advanced the guest's reference clock with `estT += dt` on a machine running at
60–90 fps, where the clamp never bites. So `lagT = estT − s.T` grew ~0.15 s per second out of
nothing but the frame-rate gap, crossed `AUTH_FRESH_S` (0.6) after ~4 s, and only reset when it
passed the 5 s bail-out — a sawtooth of period ~33 s in which authority was valid for the first
~4 s only.

The diagnosis was **confirmed predictively, not by correlation**: reconstructing the sawtooth
from wall-clock vs match-clock deltas alone predicts each guest's stale count.

| | predicted | measured |
|---|---|---|
| John | 85.2% | **88.7%** (15,330 / 17,288) |
| Petra | 68.6% | **63.6%** (9,944 / 15,657) |

**Consequence.** `applySnap` line ~1171: `if(freshAuth){u.authX=x;u.authZ=z;u.authAt=nowP;}`. For
~88% of the session the guest's own body received **no positional authority at all** — pure dead
reckoning, unbounded divergence from the host's truth, until the `e>25` catastrophe snap fired
(9 times for John, 6 for Petra). Host-side melee reach, arrow origins, gather radius and build
placement all resolve against the host's copy of your body. This is the "I swung and nothing
happened" class of complaint.

**The tell that proves it was never the network: Petra had the worse connection and the better
clock.** `guestFrame` only advanced `estT` when `!NET._stale`, so her 43 stalls kept accidentally
re-syncing her. A guest who stalls *more* and goes stale *less* is a clock bug's signature.

### The fix: ask the age question with a wall clock

`ht` (host `performance.now()`, rounded) rides every snapshot. The guest keeps the running
**minimum** of `(arrival − ht)` — the one-way delay floor — and calls the excess the age. That is
one machine's clock differenced against itself plus one of ours: no clock sync, no absolute
offset, and completely blind to whatever the sim clock is doing. `AGE_FRESH_MS:600` replaces
`AUTH_FRESH_S` on this path.

The floor is a **two-bucket rolling minimum** (`HOFF_DECAY_MS:20000`), not a periodic reset. It
has to expire, because the two machines' clocks drift — but resetting it to whatever single
sample lands on the tick is *worse* than never expiring it: one unlucky 500 ms-delayed packet
would become the new definition of zero delay and everything for the next window would read
500 ms fresher than it is. Keeping the min of this window and the last means the floor can only
ever be a value actually observed in the last two windows.

`_hOff` is cleared in `applyWorld` — it is calibrated against ONE host's `performance.now()`
origin, and carrying it into a rejoin would measure every snapshot against a stranger's clock.

### What was NOT done, and why

**The sim clock was not made real-time.** Doing it properly needs substepping, and at 10 fps that
means 2 sim steps per frame on a host already CPU-bound — the frame rate falls, which needs more
substeps, which is a death spiral. Carrying the truncated remainder forward doesn't help either:
at 10 fps with a 50 ms cap the debt saturates and time is still lost, just bounded.

A loaded host simulating slower than wall clock is a legitimate design choice — the whole match
runs in slow motion, consistently, for everyone. **The bug was never that `T` runs slow. It was
that a wall-clock question was being asked of a sim clock.** Fixing the measurement is the whole
fix, and it costs nothing.

---

## The other five, all measured

**1. A fifth of every guest's downstream was discarded on arrival.** `bcastFast` mirrored every
4th snap onto the reliable lane (`o.q%4===0` — 3.75 Hz of full snapshots), and `applySnap` threw
them away at `q<=lastQ`: **17% of Petra's arrivals, 20% of John's**. Paid for on the lane that
*retransmits*, while the host's send buffer sat at ≥16 KB for 11–13% of seconds. Now
`MIRROR_EVERY:15` — a 1 Hz liveness trickle, so a silently-dying fast lane still delivers a
world until the guest redials.

**2. The host never recovered a wedged lane.** John at t+87 s: `buf` pinned at *exactly* 16855
for 11 straight seconds, `sent:0`, `skipF:15/s`, while his body sat frozen on stale inputs. A
`DataChannel` reporting `open` with a `bufferedAmount` that never moves is dead, not busy. The
guest has had `redial` for this since v98; the host had nothing and skipped against it for ever.
`LANE_WEDGE_MS:2500` drops such a lane, the reliable relay picks up the very snap that dropped
it, and a `lane-wedged` event lands in the log. **A lane that drains is watched afresh** — the
first version cleared only half the watch state, so a later choke on the same byte count would
have found a zeroed timer and never started a new one.

**3. `dialFast` had no in-flight guard, and the host never closed the lane it replaced.** Two
callers (the 1200 ms redial and the 5 s retry installed on admit) with no knowledge of each
other, plus `r.fast=c` at the accept site orphaning the previous channel — still open, still
holding a wedged buffer, never collected. Petra: **38 redials, 37 fast-ups, 38 fast-downs** in
24 minutes. A lane that never settled. Now: `DIAL_TIMEOUT_MS:6000` admits one dial at a time,
the host closes what it replaces, and a late `close` only nulls the slot if it *is* the current
lane (otherwise it killed the fresh lane a moment after it came up — the flap itself).

**4. The redial watched the wrong thing.** "No snapshot from ANY lane for 1200 ms" could not fire
while the reliable mirror was trickling, so a genuinely dead fast lane hid behind the relay —
and once the mirror dropped to 1 Hz, that same test would have started firing on a *healthy*
link, because a 1000 ms mirror period sits inside a 1200 ms window. `NET._fastAt` is stamped in
`dialFast`'s own data handler, so the watchdog now asks the only question it ever meant: the
fast lane claims open — is anything coming down it?

**5. The input-staleness cliff became a ramp, and the ledge moved with the ping.** Both guests
spent **13–15% of their seconds** past the fixed 600 ms `INPUT_STALE_MS` (inAge p90 1470 ms and
1162 ms) against pings whose p90 was 537 ms and 737 ms — a normal round trip was being called a
dead uplink, and the host stopped walking their body outright. The ledge is now
`max(600, 2.5 × RTT)`: a guest cannot be declared silent faster than their own network can
speak. Past it the body **eases** to a halt over `INPUT_EASE_MS:250` (`r._hold` rides `mag`,
which already rides dt) — still no ghost-walking, but a 700 ms hiccup reads as a stumble
instead of a freeze.

---

## The one John reported by eye: a guest never saw the quest board's "!"

*"as a guest I could not see the exclamation point over the question board"* — and he could not,
because `tickBoardBang` was called from **exactly one place**: `tickBody`'s host/solo branch, at
`09-main.js:670`. A guest returns from `tickBody` at line 631, long before reaching it. The marker
was not hidden on guests; `_boardBang` was never constructed at all.

Every other display-only driver made the trip into `guestFrame` — `drainVisualQueue`,
`updateEffects`, `updateProjectiles`, `tickAgeResearch` (v107), `Sound.tick` (v100),
`updateRoster`, `drawMinimap`. The v99 bang predates all of them and was simply never added.
Nothing else needed changing: `townBoards` is populated by the guest's own local world gen,
`MYTEAM` is set in `applyWorld`, and `player.quest`/`player.lvl` arrive on the `qst` message — so
the one call site was the entire bug and the entire fix.

**Why the existing test could not have caught it, which is the part worth keeping.** The v99 check
calls `G.tickBoardBang(0.05)` **directly**. It proves the driver works and says nothing whatever
about whether anybody drives it. The v126 check goes through `NET.guestFrame` — the real frame —
and asserts that a guest standing questless *sees* the marker over *their own* board. When a
feature is missing on one role only, suspect the call site before the function, and test the
frame, not the helper.

---

## THE FLIGHT RECORDER WAS LYING, and it lied in the host's favour

**Both diag timers accumulated the clamped sim `dt`.** So "one row per second" meant one row per
*sim* second: host rows came up to **2.04 s** apart while claiming to be one, and every rate in
them was inflated by up to **2×** — exactly in the seconds worth reading.

| | logged | true |
|---|---|---|
| host fps (med/p10/min) | 21 / 20 / 20 | **18.8 / 13.4 / 9.8** |
| host sent/s (med/p10) | 15 / 1 | **12.3 / 0.0** |

Every frame-rate number in the v125.1 handoff's netcode section came off this. A recorder that
flatters the host precisely when the host is the problem is worse than no recorder.

Fixed by moving the whole net layer onto **one clock seam, `NET.now()`**:

- The cadence is wall time now, so `SNAP_HZ:15` means 15 snaps per *wall* second (it was 12.3).
- Rows carry **`win`** — the window actually measured. Divide by it; do not assume 1000.
- Host rows carry **`simR`**, the sim clock's rate against wall time (0.85 in John's session,
  0.74 at 20 fps). **This is the one number that makes the whole bug self-evident on sight.**
- Guest rows carry **`age`** and **`ageMax`** — the measured wall-clock age `stale` is counting.
- `meta.ver` is **read from the page's `.verstamp`** instead of the literal `"v98"` that had been
  frozen in `saveLog` since the day it was written. All three of John's v125.1 logs said v98.
- `meta.logfmt:2` marks the new format.

`NET.now()` also exists so a headless harness can drive it — see the trap list below.

## `tools/netlog.js` — new

```
node tools/netlog.js <host.json> <guest.json> [<guest2.json> ...]
```

Joins the files on wall-clock `t` and walks the whole ladder: the clock ratio first (§0, because
everything is downstream of it, with a per-real-fps breakdown), then host render/send health,
then guest arrival/usability, then the host-said/guest-got join, then the two-guest comparison.
Reads **both** formats — for a format-1 log it derives the true window from consecutive `t`
values and corrects the rates, and says so. It recognises the v126 signatures by name (clock
drift, discarded mirror, wedged lane, redial storms) so the next field test is one command
instead of an afternoon of ad-hoc python.

**It joins on `t`, never `T`** — `T` is the field the bug corrupted, so joining on it would have
hidden the bug inside itself.

---

# The netcode as it stands

`js/10-net.js`, ~1650 lines. PeerJS, **host-authoritative**. Constants at lines 26–52:

```
SNAP_HZ:15   INPUT_HZ:20         BUF_FAST_MAX:16384   BUF_REL_MAX:16384
AOI_NEAR:60  AOI_FAR_EVERY:4     MIRROR_EVERY:15      INPUT_STALE_MS:600
INPUT_EASE_MS:250                AUTH_FRESH_S:0.6 (legacy path only)
AGE_FRESH_MS:600                 HOFF_DECAY_MS:20000
LANE_WEDGE_MS:2500               REDIAL_MS:1200       DIAL_TIMEOUT_MS:6000
EXTRAP_MAX_MS:260                                     PROTO:26
```

- **ONE CLOCK.** Every timing decision in the net layer reads wall time through `NET.now()`.
  Monotonic on purpose — never `Date.now()` while `performance.now()` exists, because the age
  measurement must not be walked backwards by an NTP correction mid-match.
- **TWO LANES.** A reliable PeerJS `conn` for handshake/acts/notes, and an unreliable one
  (`NET.fast`, `dialFast`) for snapshots. `bcastFast` **skips rather than queues** above 16 KB
  unflushed. The comment on `BUF_REL_MAX` names the original bug: *"that backlog was THE freeze."*
- **SNAPSHOTS ARE PACKED BINARY DELTAS.** 18 B/unit row (`packRows`/`readSnapRows`, one shared
  decoder used by the smoketest too, deliberately — no drift), 8 B/building row. Unchanged rows
  are skipped (`NET._lastRow`), so an idle unit costs nothing.
- **AOI.** Units within `AOI_NEAR` of any guest body ship every snap; distant ones every 4th,
  staggered by `(snapN + id) % 4`. Structural changes — death, class change, garrison — always
  ship at once.
- **THE LEASH.** The guest predicts its own body; the host corrects it, inside a 6-unit leash and
  only from a snapshot whose measured **age** is under `AGE_FRESH_MS`.
- **THE INPUT PACKET.** `{t:"input"}` at `INPUT_HZ` carries w/a/s/d bits plus optional `mx`/`mz`
  (analog) and `shot`. The host clamps a claimed draw level to the hold it actually observed.
- **THE WORK PULSE.** A 2-bit counter in the unit flags byte, ticking every 0.5 s of work, so a
  stationary miner's arm keeps swinging on guests even when their row stops changing.

## Rules for changing the wire

- **PROTO is 26.** Bump it only for a change an old peer would *misread*. An OPTIONAL field an
  old peer ignores does not need a bump — that is how `mx`/`mz`/`shot` shipped, and how `ht` did.
  **OMITTING** a field an old peer reads unguarded is the other case, and that is v127's envelope
  delta: 25 → 26. If you add a delta'd field, guard the read on the guest AND give it a keyframe
  refresh, or a dropped packet becomes permanent staleness.
- **`packRows` and `readSnapRows` are one codec** used by both the game and the smoketest.
- **Never trust a guest's claim.** The guest reports, the host clamps to what it observed.
- **The v125 fallback path is load-bearing.** PROTO 25 means a v126 guest may meet a v125 host.
  When `ht` is absent, `applySnap` uses the old sim-clock comparison and `guestFrame` resumes
  advancing `estT`. There is a test for exactly that pairing — keep it.
- `tools/smoketest.js` covers snapshot round-trips, the work pulse, snapshot age (both paths),
  shot batching, facing relay, the analog field, and all of v126's lane behaviour. **Extend
  those rather than writing a new harness** — they run headless in ~100 s.

## Netcode threads still open

- **v126 FIELD TEST — the whole point of the next session.** Collect three logs again the same
  way and run `tools/netlog.js`. What to check, in order: (1) `simR` on host rows — expect
  ~0.85 still, since the sim clock was deliberately left alone; (2) guest `stale` should fall
  from 64–89% to near zero, and `age` should sit within tens of ms; (3) `dup` should fall from
  17–20% to ~7%; (4) `redial` counts should collapse; (5) whether `lane-wedged` ever fires.
- **Does the leash coming back feel right?** For ~88% of John's last session his body was never
  corrected. It is corrected now. If that reads as rubber-banding, the dial is the 6-unit dead
  zone and `dead=3.2+(gapAvg-83)*0.02`, not `AGE_FRESH_MS`.
- **Hall registry election.** The public hall list lives on whichever host holds `HALL_ID`
  (`hallData`, `hallJoin`). When that host leaves, nothing elects a replacement.
- **host-can't-play-RED.** `tryAgeUp` checks `teamTC(BLUE)` while reading `teamAge[MYTEAM]`.
  Harmless today because the host is always BLUE; a real bug the moment that changes.
- **Guests and the ~29 MB first load.** No loading indicator, no service worker — a joining guest
  stares at a blank screen. Offered four times, never green-lit.
- **Unit draw calls — now the top netcode item too.** 54 units ≈ 1,800 calls against ~380 for the
  whole forest. This is *why* the host runs at 10–19 fps, which is why the dt clamp bites, which
  is why the sim clock is at 0.85×. v126 stopped that from corrupting the netcode; only this
  fixes the underlying slowness.

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
synchronously if it is taking over; 13-deskui loads second and returns immediately if it sees it,
otherwise adds `bar-mode`. No shared state, no other ordering subtlety.

Two shared branches read those classes at CALL time, so it does not matter that both files load
after them: `updateRoster()` in `07-ai.js` and `updateAgeHud()` in `08-ui.js` render the compact
form when either class is present, and the long desktop form only for `?ui=classic`.

**Why 13-deskui is a separate file and not a shared bar.** Deliberate. 12-touch's strip is 34px,
sized in a rotated stage, measured against safe-area insets, and held up by ~190 assertions that
took thirteen field-test rounds to get green. The desktop bar is 46px with no stage, no insets, a
keyboard hint line and a mouse — a shared implementation would be mostly per-mode overrides
anyway, and the refactor would risk every one of those assertions to save duplicated CSS.
**If a third layout ever appears, extract then. Two copies is a smell; three is a bug factory.**

## v125 / v125.1 — the one bar, and the caption

John: *"take the basis of the mobile UI and apply it to the desktop version — move the UI bar to
the bottom, put fps counter up top etc. button rail only meant for mobile so exclude that."* He
then chose **full parity** on all four open questions: draining crowns, minimap behind a toggle,
your team's roster only, help as a `?` opening centred.

Then: *"the gather UI for desktop should be the same as mobile, showing up at lower center of
screen with the resource icon and the (0/20)."* → `#dauto`, and **the haul left the strip
entirely**, same as 12-touch did in v124.10. Two deliberate improvements on the phone version,
neither visible: it shows while *carrying* as well as gathering (the walk home is when you want
it), and with an empty satchel it names the node from `player.gathering.type` so it reads
`🪵 0/20` and counts up — the phone cannot, because its caption is written before auto-gather
has picked a node.

**Desktop had no frame counter at all** before v125. Every frame-rate number John had ever quoted
came off his phone — and, as v126 established, the host's own counter was inflated too.

### Three things the desktop layout needed that the phone did not

**1. The health bar had to be centred, not the panel around it.** `#playerhud` is a 3-column grid
(`1fr auto 1fr`) with only two children, so the bar lands in the middle column and the third
stays empty. A flex row centres the *pair*, which puts the bar off centre by half the class name
— and **no amount of measuring the panel would ever show that** (the first version measured 960.0
on a 1920 screen with the bar 100px left of centre). `#ptip` was lifted out of the panel entirely.

**2. A sacrifice ladder, because flexbox shrinks in proportion.** On a 1366 laptop the right group
overflows, and the browser's rule produced `STONE vs` with the enemy's age cut off and a roster
reading `⛏ 49 ·`. What is given up must be the least *time-critical* thing, not whatever the
algorithm reaches: **hints first, then the roster** (Tab has the full version). The **age line is
never in the ladder** — an age you cannot see is an age you forget to spend on, and the enemy's is
your only warning. The haul used to be the third rung and was the rung that got pulled, so
v125.1 moved it off the strip.

**3. Two silent traps inside that**, both of which produced a passing test over a visibly broken
bar:

- **A segment that can shrink can never be dropped.** With `flex:0 1 auto` the hint shrank to fit,
  so the overflow check never saw an overflow and the bar showed a hard-cut `E gather · B b`.
  Every ladder segment is `flex:0 0 auto`; the JS removes them whole.
- **`scrollWidth` is blind to start-side overflow.** The group is `justify-content:flex-end`, so
  it overflows LEFT — and `scrollWidth` reported a comfortable fit while the hint was sliced off
  its left edge. Sum the children against the content box; the harness measures by rects for the
  same reason.

## v124.13a — the half-rate fix

**The frame cap was silently halving whatever you asked for.** The gate was `1000/(target + 0.5)`
= 16.53 ms for a 60 fps target. A 60 Hz display delivers frames 16.67 ms apart *nominally*, but
real rAF timestamps jitter by a millisecond either way — so any frame arriving at 16.4 ms was
rejected and the next candidate was a whole vsync later at 33.3 ms. 60 became 30, and 30 became
20. **The "min 20" that sat in his read-out for weeks was the cap doing it, not the phone.** The
gate is `period × 0.8` now: loose enough to admit its own target, tight enough to reject the next
rate up.

**The adaptive pixel ratio is retired.** Introduced in v124 for "the picture is blurry", tuned
twice, and it caused a bug both times: v124.12's black flashes (every change reallocates the
WebGL drawing buffer = one undrawn frame) and then John toggling the saver OFF while the
controller quietly stepped the ratio back DOWN behind him, so the switch looked broken. **Once
there is an explicit user-facing dial, a second invisible one guessing against it is strictly
worse.**

Also: the pixel filter restored a hardcoded `1.0` when switched off, throwing away the saver's 0.7
every time; and the crunch is halved (1.67 screen px per rendered px, was 3.33). Both now
expressed against `window.__basePR`, which the saver owns.

## Battery Saver (v124.13) — mobile only

⚡ in the ☰ grid, **default ON**, persisted as `reg_saver`, overridable with `?saver=0` / `?saver=1`.

| | ON | OFF |
|---|---|---|
| frame cap | 30 | 60 |
| pixel ratio | 0.7 | 1.0 |
| cull distance | 88 | 105 |

Plus `visibilitychange` suspending the AudioContext and pausing the music element.

**The frame cap has a trap and I fell in once.** The game runs *five* separate rAF consumers. The
first wrapper gave them one shared `last` timestamp, so the first callback each frame ate the
budget and **starved the other four** — the game looked alive and updated nothing. The shipped
wrapper batches every pending callback and releases them together.

## Still true from v124

- **The organising principle:** a button exists only when pressing it would work right now. Every
  contextual slot is gated on the same test the action runs, so a button that exists is never
  refused with a message.
- **The rail** (mobile): `#tctx` above three fixed core buttons, at most 3 slots, ordered by the
  `ACTIONS` table in `06-input.js` — AGE UP > CLASS > BUILD > USE > RALLY. Predicates live beside
  the actions they gate. `availableActions(max)` is the whole API.
- **THE ESCAPE HATCH, earned three times** (v118 rotate gate, v122 scoreboard, v124 build picker):
  every panel ships with a visible, unconditional way out, **and the test asserts the way OUT.**
- **THE DRAW:** ~1.2 s to full, 0.5×→2.0× damage, 0.6×→1.6× speed. **`rig` is NOT the
  discriminator** — crossbowman and skirmisher are `rig:"bow"` for their animation, so the obvious
  test would hand the draw to exactly the two classes John excluded. `DRAW_CLASSES` is explicit:
  slinger, archer, imparcher, comparcher.
- **Analog movement:** one `moveVec` for both schemes, magnitude rides the dt argument, dead zone
  0.16, floor 0.42.
- **Names:** `mkName(i)` returns `<Name> the <Epithet>`, deterministic from the unit id so host and
  guest agree without a byte on the wire.
- **Aimed shots converge on the crosshair point.** They used to spawn a unit off the shoulder and
  fly *parallel* to the camera ray — parallel lines never meet, so every shot tracked ~1 unit
  right at every range for ever. Affected every ranged class; the cannon repeated it at 4.5 units.

## Tests

```
smoketest      389 checks   exit 0  — one known flake left (militia pair) (~100 s)
mobilecheck    192 PASS     exit 0  — 64 checks × 3 devices              (~5 min, background it)
deskcheck       56 PASS     exit 0  — 18 checks × 3 viewports + ?ui=classic
browsercheck   PASSED               — 139 SFX + 6 anthems, http and file://
netlog                              — not a test: the field-log reader
netprofile                          — not a test: the snapshot byte profiler
```

v127 adds 11 checks: the envelope shipping on change (and immediately on a real change, and healing
through the keyframe), `ares` at ~2 Hz, a guest applying a snapshot with no treasury / carry /
countdown without writing NaN into anything, PROTO 26, and four on the glide — velocity derived
from the wire, a moving body carrying on past the glide, the carry-on capped at `EXTRAP_MAX_MS`,
and a body the host reports as still not drifting however long the feed is quiet.

v126 adds 20 checks to the smoketest, in a `v126: THE LANES` block plus rewrites in place:
snapshot age on both the `ht` and legacy paths, the mirror rate (and that its period cannot fall
inside `REDIAL_MS`), wedged-lane recovery (including that a drained lane is watched afresh), the
dial guard, the input ramp at two pings, `ht` on the wire with PROTO still 25, `win`/`simR`/
`age`/`ver` in the log rows, and the quest board's "!" seen through a guest's own frame.

`deskcheck.js` checks two things a layout test would not think to: **that NONE of the mobile layer
is present** (the way "rail is mobile-only" breaks is a touch-detection change handing a desktop
the phone build, which no positive assertion about the bar would catch), and **that `?ui=classic`
still works** — an escape hatch nobody tests is not an escape hatch.

**THE FLAKE LIST IS DOWN TO ONE.** v127 hardened the suite: `garden`, `sixth market`,
`band dispatched`, `blacksmith at Iron`, `v113 relief` and the eleven-check creep/raid cluster
were all the same three bugs wearing different hats — see "THE SUITE ITSELF" above. What remains
is the **militia pair**, about 1 run in 13, and it is understood well enough to be worth naming:
the levy decision itself does not fire, and the isolation this pass added is not the cause (its
own diagnostic printed `yard cleared of 0` on the failure). Start at `manageBands`.

**Everything else: if it goes red now, believe it.** Do not add a name to a flake list; work out
which of the three families it is — ambient world state, a regicide disarming the harness, or an
assertion with no margin — and fix it properly.

**`v95 work pulse` was never a flake — it was a bad assertion, fixed in v124.13.** It asserted
`attackAnimT > 0`, but `triggerAttackAnim` only moves that when a mixer clip or the baked Mixamo
pool is loaded, and **baked playback is commented out in `index.html`**. *A test that depends on
an optional asset is a test that lies.*

`turtle curtain wall` was never reproduced in v127's runs and was left alone; it drives
`directorThink` synchronously already, so if it ever does fail, suspect the 20-iteration cap
rather than ambient state.

### The traps this codebase sets

1. **`getBoundingClientRect()` inside `#tstage` returns the TRANSPOSED box.** The stage is
   `rotate(90deg)`. Use `offsetTop`/`offsetLeft`/`offsetWidth`/`offsetHeight`. **Bitten five
   times**, including inside `mobilecheck.js` itself. Does not apply to 13-deskui — no stage there.
2. **A child cannot escape its parent's stacking context**, whatever z-index you write. Bitten
   four times. Desktop z-map: HUD 10–12, menus 20, scoreboard 40, help 45, overlays 50+.
3. **A CSS custom property on an ancestor cannot read one defined on a descendant** — silently
   invalid, and the `calc` falls back. `--tbarfull` and `--sb` must both live on `#tstage`.
4. **`scrollWidth` does not count start-side overflow.**
5. **A flex child that can shrink can never be dropped.**
6. **Node 22 defines a global `navigator`.** Both UI layers guard on
   `document || location || screen || navigator` being absent — `screen` is now carrying that
   guard alone under the smoketest, which asserts it explicitly so the day `screen` is defined too
   it says so rather than silently reparenting a stubbed DOM under every test in the file.
7. **v126 — SIM TIME IS NOT WALL TIME, and the harness pins one of them.** `clock.getDelta` is
   fixed at `1/30` in `smoketest.js`, so sim time advances and real time does not. Anything in the
   net layer that reads `NET.now()` therefore needs the harness's synthetic wall clock, which
   advances in lockstep inside `getDelta` (top of `smoketest.js`). Two consequences:
   - **Never mix `performance.now()` and `NET.now()` in a test.** Stamping `r.inputAt` from
     `performance.now()` made a fresh input look ~970 *seconds* old and the body refused to walk.
     Everything net-side stamps and compares through `NET.now()`.
   - **A frozen wall clock silently starves the feed.** Before the lockstep advance, hundreds of
     `tick()` calls sent zero snapshots, so any test leaning on the feed flowing quietly stopped
     testing it. Blocks that need a specific timing edge override `NET.now` and restore it.
8. **v126 — a "per second" counter is only per second if something says so.** Every rate the
   flight recorder emitted for 28 versions was per *sim* second while claiming to be per second,
   and the error was largest exactly where the data mattered. Rows carry `win` now. Divide by it.
9. **v127 — a regicide mid-run disarms `dealDamage` ITSELF, not just the clock.**
   `09-main.js:634` gates the whole simulation on `if(!gameOver)`, and `05-combat.js:196` returns
   early from `dealDamage` when `gameOver` is set. Every staged kill after that point silently
   does nothing. The smoketest wraps its `tick` export to hold the flag down; anything else that
   drives frames must do the same, or it is betting that no king has died yet.
10. **v127 — a test that reaches past the real entry point cannot see a missing call site.** The
   board "!" was green for 27 versions on a test that called the driver by hand. Drive the frame.
   And when you write the test that guards against that, make sure it cannot pass while measuring
   nothing — the first version of the wiring block filtered an empty list and reported all clear.
11. **v127 — the harness runs every file in STRICT mode; the browser does not.** `00-data.js`
   line 2 is `"use strict"` and the smoketest concatenates all fourteen files into one script, so
   the directive covers the lot. That is why function declarations do not reach `global` and why
   `__WIRE` exists. It also means the harness is very slightly stricter than the shipping game.
12. **v126 — a guest runs a DIFFERENT frame, so "it works" means nothing until you say for whom.**
   `NET.guestFrame` is not `tickBody`; a guest returns from `tickBody` at `09-main.js:631` and
   never sees the 40 lines below it. Anything display-only added to the host branch has to be
   added to `guestFrame` too — the v99 board "!" sat unnoticed on the wrong side of that line for
   27 versions. **And a test that calls the helper directly cannot catch it.** Drive the frame.
   Sibling risk to audit whenever something is added to `tickBody`: `drainVisualQueue`,
   `updateEffects`, `updateProjectiles`, `tickAgeResearch`, `Sound.tick`, `updateRoster`,
   `drawMinimap`, `tickBoardBang` — the eight that must exist in both.

And about the harnesses:

- **`mobilecheck` blocks share one `page.evaluate` and inherit state** — a latched AIM, a funded
  treasury, a frozen AI director. Isolate anything stateful.
- **"the string changed" is not proof a loop ran.** A steady frame rate renders the identical
  read-out every window. Assert it is no longer the boot placeholder, or that the match clock `T`
  advanced. (The helper in that block is named `TP` on purpose: the first version shadowed `T`.)
- **A text write into the HUD does not hold.** `updateResHud` is event-driven, so a villager
  depositing mid-wait rewrites all four figures from the real stockpile. Set the STOCK, and assert
  five-digit-*ness*, because the team keeps spending.
- **The player spawns INSIDE the Town Centre's deposit radius**, and 09-main auto-deposits every
  frame you are in it. Any carry a harness writes is banked and zeroed before the next rAF —
  three assertions failed on this and the caption they were testing was correct the whole time.
  Move the player to the tree first.
- **A test that leaves authority armed poisons the next block.** v126's snapshot-age test ends by
  clearing `player.authX`, because the gather-theatre block below it stands still next to a node
  and a live leash drags the body out of reach — which reads as "the pick does not swing".
- **`pkill -f mobilecheck` kills the calling shell.** Clear the port by PID:
  `ss -tlnp | grep 8132 | grep -oP 'pid=\K[0-9]+'` then `kill -9`. deskcheck uses **8133** so both
  can run at once. (Same trap with `pkill -f smoketest` — it matches the wrapper that launched it.)

## Workflow / protocol

Browser 50v50 regicide war game, Three.js r128 no-bundler, PeerJS host-authoritative, **PROTO=25**.
John's copy at `Desktop\REGICIDE PVP\REGICIDE PVP GAME` — that inner folder is the git repo; the
parent also holds `potential sounds\` (1,691 files, 2.6 GB) which must never reach GitHub. Deploy
is **commit + push in GitHub Desktop** → `nutcrackerregicide.github.io`.

Deliver work with `SendUserFile` **and** `device_commit_files` to that folder — he commits and
pushes from GitHub Desktop.

Note: `assets/anims.js` exists on John's machine but is **not** in the assistant sandbox, and its
`<script>` tag is commented out in `index.html`. Do not write tests that assume baked anims.

Verify: `node --check` every file → `npm i three@0.128.0 playwright-core` →
`node tools/smoketest.js` 2–3× → `node tools/deskcheck.js` after ANY change to `13-deskui.js`,
`css/style.css` or the shared branches → `node tools/mobilecheck.js` after ANY change to
`12-touch.js` → `node tools/browsercheck.js` after ANY audio change (http + file://) →
`node tools/cartshot.js` after model changes → `node tools/perfcheck.js` + `tools/treemap.js`
after world-gen changes → **`node tools/netlog.js` on any new field logs** → verstamp + handoff.

## Open threads / watch list

- **v127 FIELD TEST — three logs again, then `tools/netlog.js`.** Everything below still applies;
  v127 adds two things to watch. (1) `kb` per guest should fall — the envelope diet removes ~1 KB/s
  of repetition per guest, more once rows are busy. (2) **Do distant units read as smoother?** The
  glide change is the one thing in v127 that cannot be verified from a log file; it needs eyes.
  Watch a friendly warband fighting at range and ask whether they walk or stutter.
- **ASSET LICENCE — still unresolved, and the repo is public.** 75 of the 139 sounds carry
  `2021 Epic Stock Media (Empire Game) — All Rights Reserved` in their Vorbis comments, and
  `js/audio-data.js` embeds the same 139 base64. Nobody has read the actual terms. **Highest-stakes
  item on this list**, and it gets worse the closer this gets to Steam or ads.
- **v125 FIELD TEST — the desktop bar.** Does the 46px strip feel right on a 1920 monitor? Is
  losing the advance COST and the "(T at Town Center)" hint from the age line a real loss on a
  keyboard? Does the hint line vanishing on a narrow window read as broken?
- **v124.13 FIELD TEST — the battery saver.** Default ON, so his sessions are 30 fps at 0.7. Now
  that the cap actually works, 60 is genuinely available with one tap.
- **Unit draw calls** — 54 units ≈ 1,800 calls against ~380 for the whole forest. **Promoted: this
  is the root of the host's 10–19 fps**, which is what made the dt clamp bite in the first place.
- **No loading indicator.** ~29 MB first load against a blank screen. A service worker fixes that,
  the cold-launch pause, and makes the Home Screen icon a real offline install. **Matters more for
  netcode work than it looks: a joining guest sits on that blank screen too.**
- **The correlated creep/raid flake cluster.** See Tests above. It is a harness isolation problem,
  not a game bug, and it makes every run of the smoketest slightly untrustworthy.
- **Wood economy never rebalanced** — ~95,000 wood on the map since v114 against ~12,600 before.
  Dials in order: `amount:140` in `makeTree` → 60–80, then `STEP`, then stand count.
- **Combat feel, never started**: camera shake scaled to damage, hit-stop on kills, directional
  blood/spark bursts, floating damage numbers, directional knockdown on death.
- Older: quest balance, v94 AI playtest.
