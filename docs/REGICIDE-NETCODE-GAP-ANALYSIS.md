# REGICIDE — Netcode Gap Analysis vs. the 50v50 Server-Authoritative Blueprint

**Written August 2026, against `v128.4` on disk.** Every claim below is cited to a line in the
repo and, where it is a number, measured rather than estimated. Read alongside
`claude/REGICIDE-HANDOFF-v128.4.md`.

---

# 0. THE ONE STRUCTURAL DIFFERENCE, STATED FIRST

The blueprint describes a **dedicated Node.js authoritative server** with a fixed tick rate,
serving 100 clients. **REGICIDE has no server.** It is PeerJS peer-to-peer, host-authoritative,
where the "server" is one player's browser tab running the full 3D game at the same time.

Every conclusion below is downstream of that. In the August field test the authority ran at
**17 fps median with a `simR` of 0.779**, on 136 units and >4,000 draw calls. That is not a
tick-rate problem you can architect around — it is the authority being a laptop that is also
rendering the game. Several parts of the blueprint are answers to problems REGICIDE does not have
yet, and one part is an answer to a problem it very much does.

| # | Blueprint system | REGICIDE status | Worth building? |
|---|---|---|---|
| 1 | Client prediction + reconciliation | **PARTIAL — prediction yes, reconciliation is a blend, not a replay** | Not as specified. The design deliberately forecloses it. |
| 2 | Spatial interest mgmt, 3 LOD tiers | **PARTIAL — 2 rate tiers, 1 precision tier, no grid** | Grid: **no, measured worthless.** Third precision tier: marginal. |
| 3 | Dual-mode lag compensation / rewind | **ABSENT — completely** | **YES. This is the hole.** |
| 4 | Binary packing + delta compression | **PRESENT — the strongest part of the codebase** | Mostly done. Two real defects found. |
| — | Zero-allocation | **PARTIAL — 500:1 in the snapshot path, but GC is not the bottleneck** | Tidy-up, not a frame win. |

---

# 1. CLIENT-SIDE PREDICTION & SERVER RECONCILIATION — PARTIAL

The code names itself honestly at `10-net.js:1746`: `// ---- PREDICTION-LITE: our own body moves
the instant we press a key ----`.

| Textbook element | Status | Evidence |
|---|---|---|
| (a) input ring buffer, unacked, sequenced | **ABSENT** | `NET._inSeq` appears on exactly two lines (`10-net.js:1909-1910`), is written to the wire and never read again. Host uses `seq` only as a reorder filter and *overwrites* the previous input: `10-net.js:444`. |
| (b) parallel predicted-state history | **ABSENT** | No ring buffer, history array or per-tick state exists. The only position memory is `netPX/netPZ` (2 points, for **remote** interpolation) and `authX/authZ` (1 point). |
| (c) server echoes last processed input seq | **ABSENT** | The unit row is fixed 11-slot binary (`10-net.js:1181-1185`); no envelope field carries it. Every host→guest message type was enumerated — none acknowledges an input. |
| (d) snap + replay unacked inputs | **ABSENT** | Replaced by a 7-line error blend, below. |
| (e) visual mesh decoupled from sim state | **ABSENT** | `u.root.position` is simultaneously collision state, combat-range state, AOI centre, wire payload and the drawn mesh. No `simX`/`visX` split anywhere. |

**What exists instead** (`10-net.js:1771-1778`), running after the local move on the same frame:

```js
if(typeof player.authX==="number"&&NET.now()-(player.authAt||0)<600){
  const p=player.root.position;
  const ex=player.authX-p.x, ez=player.authZ-p.z, e=Math.hypot(ex,ez);
  const dead=3.2+(NET.gapAvg-83)*0.02; // lag widens the leash instead of the rubber band
  if(e>25){p.x=player.authX;p.z=player.authZ;NET._cLeash=(NET._cLeash||0)+1;}
  else if(e>dead){const f=(e-dead)/e*Math.min(1,dt*4.5);p.x+=ex*f;p.z+=ez*f;}
}
```

Error inside `dead` is ignored; between `dead` and 25 it eases toward the authoritative point;
above 25 it hard-teleports with no replay. Inputs in flight during the RTT are simply lost, which
is *why* the dead zone has to exist.

### The reason replay would not help: the host is not simulating the guest

`10-net.js:870-890` — THE LEASH:

```js
// THE LEASH: the guest already ran this movement through the same collision
// code — within 6 units, their reported feet ARE the truth.
if(dl>=6&&dl<14){ u.root.position.x=i.px; u.root.position.z=i.pz; dl=0; }
if(dl<6){ if(dl>0.02){ const gk=Math.min(1,dt*16);
    u.root.position.x+=(i.px-u.root.position.x)*gk; ... } trusted=true;
```

On a healthy link the host runs **no movement integration at all** for a guest body — it is a
low-pass filter on the guest's reported feet, and the `authX` that comes back is the guest's own
position round-tripped. **There is nothing to reconcile against.** Building replay means deleting
the leash and letting the host actually own the body, which reintroduces exactly the rubber-banding
the leash was written to cure.

Four further obstacles, if it were ever attempted: `moveUnit` mutates `u.root.position` in place
and reads live mutable globals (`buildings` with current `b.alive`/`b.rot`), so replaying frame
N−5 would use frame N's world; `dt` is variable and clamped (`09-main.js:629`) and never shared;
the row is fixed-arity packed binary, so an ack field costs a **PROTO bump**; and `driveRemote`
also moves the body for garrison decks, climb-downs and lobs, each of which replay would have to
cover or exclude.

## ⚠ Three real defects found in this area

1. **The guest's own prediction ignores analog magnitude.** Three call sites reach the shared
   `moveUnit`, and they do not agree:

   | path | input shaping | dt scaling |
   |---|---|---|
   | host/solo player (`09-main.js:73,100`) | `readMove()` analog with dead/floor shaping | `dt*mag*(blocking?0.55:1)` |
   | **guest predicting itself** (`10-net.js:1766,1769`) | **raw `keys.w/a/s/d` booleans** | `dt*(blocking?0.55:1)` — **no `mag`** |
   | host driving that guest (`10-net.js:900-911`) | `i.mx/i.mz` analog, `mag` clamped to 1 | `dt*mag*_hold*(...)` |

   `12-touch.js:938-943` sets `moveVec.analog=true` and mirrors the stick into booleans at a 0.38
   threshold. **A half-deflected thumbstick makes the guest predict at full speed while the host
   walks it at `mag≈0.5`** — a permanent, input-dependent divergence on every mobile guest, and
   the leash then fights it every frame. This is a live bug, not a design trade-off.

2. **The dead zone degenerates at high ping.** `gapAvg` is clamped to [60,1200] (`10-net.js:1493`),
   so `dead` ranges 2.74 → 25.54. **Above `gapAvg ≈ 1173` the soft branch becomes unreachable**
   (anything over 25 hits the hard snap first) and the body receives no correction at all below 25
   world units of error. The August field test measured Jorunn's p90 ping at **1294 ms** — this
   regime is not hypothetical.

3. The hard-snap branch is an instantaneous visual teleport, because there is no visual/sim split.

---

# 2. SPATIAL INTEREST MANAGEMENT — PARTIAL, and the missing half is measured worthless

## The grid: do not build it

`10-net.js:1157-1162` collects one `centers` array of live guest positions; `10-net.js:1193-1195`
does a linear scan:

```js
let near=false;
for(const c of centers)if(dist2(p.x,p.z,c.x,c.z)<NEAR2){near=true;break;}
if(!near&&((NET._snapN+u.id)%NET.AOI_FAR_EVERY)!==0)ship=false;
```

No grid, hash, quadtree or bounding volume exists. Complexity is O(U·G), behind three guards so it
only runs for a unit whose row actually changed. **Real cost at 136 units and 4 guests: ≤544
`dist2` calls per snapshot, ≤8,160/second.** `dist2` is four arithmetic ops and allocates nothing.

A spatial index here would be **pure loss** — more memory, more bookkeeping, more code, to
accelerate something that is already free. This corroborates the v127 measurement already in the
handoff (1 guest → 13.3 rows/snap; 2 guests 90 units apart → 14.3).

## The tiers: 2 of 3 on rate, 1 of 3 on precision

| class | condition | effective rate |
|---|---|---|
| player bodies + kings | `10-net.js:1187` | 15 Hz unconditional |
| keyframe | `_snapN%15===0` (`:1171`) | everything, 1 Hz |
| structural change (class/alive/garrison) | `:1192` | immediate, any distance |
| near + changed | `dist2 < 60²` (`:1194`) | up to 15 Hz |
| far + changed | `(snapN+id)%4` (`:1195`) | 3.75 Hz |
| unchanged | — | 1 Hz via keyframe |

**Precision is identical in all of them.** `packRows` (`10-net.js:1103-1112`) is the only unit-row
encoder, `SNAP_ROW_B=18`, one fixed layout. A unit 300 units from every guest ships the same 18
bytes at the same `x*10 / z*10 / facing*100` quantization as one standing on a guest's toes.
Cosmetic and animation state — facing, the work pulse, the flags byte — is **never dropped at any
distance**, because the row ships whole or not at all.

**But the budget it would save is already tiny**: 335 B/snap at 2 guests, ~5 KB/s. A third tier is
a real improvement and a small one.

## The near-set is a union, not per-guest

`centers` merges every guest into one array and the scan `break`s on the first hit, so "near" means
*near to any guest*. One `rows` array → one `packRows` buffer → one object broadcast to everyone
(`bcastFast` sends the same `o` down every lane, `10-net.js:135`/`:196`). The delta baselines
`_lastRow`/`_lastStruct` are keyed by unit id alone — also global. A packet one guest misses is
healed only by the 1 Hz keyframe, regardless of which guest missed it.

Making any of this per-guest means N pack passes and N baselines on the host that is already the
bottleneck. **Do not, without re-measuring with `netprofile --sep` first.**

---

# 3. DUAL-MODE LAG COMPENSATION & HITBOX REWIND — ABSENT

**This is the real hole, and it is the one that players feel.**

There is no history buffer, no rewind, and **no guest packet carries a timestamp of any kind.**
The full input packet is `seq, w,a,s,d,e,atk,blk,yaw,px,pz,f, mx,mz, aq, et, lobx,lobz, shot`
(`10-net.js:1910-1929`) — `seq` is a reorder counter, nothing more.

`NET._lastRow` is not usable as history: depth 1, stored as a **string** (`row.join(",")`) for an
equality test, never parsed back, carries no timestamp, and is the last row *sent* rather than
*simulated* — so under AOI throttling it can be 4 snaps stale. (`u._lpx`/`u._lpz` at
`10-net.js:889` look like history; they are written every packet and **never read anywhere**. Dead
stores.)

## Ranged: the host re-simulates from its own present

The guest sends a direction and a draw level only (`05-combat.js:950`) — **no timestamp, no
position, no claimed target.** The host clamps the *charge* to what it observed (`10-net.js:749`)
and accepts the *direction* verbatim, then spawns the arrow from `u.root.position` at the host's
present tick (`05-combat.js:874-883`) and point-tests it against present enemy positions each
frame (`05-combat.js:103-115`, hit radius `√1.25 ≈ 1.118 u`, single point sample, no swept volume).

The charge clamp is validation of *damage magnitude*, not *geometry*. It is the only thing the
handoff has ever called validation.

## Melee: the guest does not even name a target

The guest sends one bit, `atk:1` (`10-net.js:1912`). The host runs its **own** auto-target scan
over `units` at the present tick and hits whatever is nearest within `u.rng+0.8`
(`05-combat.js:466-478`). The guest's screen and the host's scan are two independent searches over
two different world states. There is nothing to validate because nothing was claimed.

## The complete inventory of latency slack that does exist

| # | Location | Slack | Combat-relevant? |
|---|---|---|---|
| 1 | `10-net.js:874-891` | THE LEASH — host adopts the guest's reported feet | **Indirectly — see below** |
| 2 | `10-net.js:993` | priest resurrect reach `RES_REACH+2.0` | No |
| 3 | `10-net.js:1039` | blacksmith `r+4.6` vs host's `+2.6` | No |
| 4 | `10-net.js:1028` | Town Board `BOARD_REACH+2` | No |
| 5 | `10-net.js:718-721` | input-staleness ramp `max(600, rtt*2.5)` then 250 ms ease | Movement continuity only |
| 6 | `10-net.js:729` | lob range matches the aiming UI (a v97 *fix*) | Marginal |
| 7 | `10-net.js:749-750` | draw-charge clamp | **A restriction** |
| 8 | `10-net.js:759` | dragoon pistol `12` for guests vs `15` for host (`05-combat.js:553`) | **A penalty** |

**Nothing in that list is in the damage-resolution path.** The leash is half a rewind and the wrong
half: it places the *attacker* where the guest saw itself ~½ RTT ago, but every candidate *target*
stays at host-present. It is the target's motion that decides the hit.

## The consequence, in numbers

Speeds from `00-data.js`: villager 8.2, melee line 8.0, knight 13.5, elite scout 15.5 u/s.
Field-measured ping: **median 212 ms, p90 1294 ms.** Realistic median staleness with snapshot
cadence and guest extrapolation ≈ **276 ms**.

Target displacement during the round trip:

| target | @212 ms | @1294 ms |
|---|---|---|
| infantry (8.0) | 1.70 u | 10.35 u |
| knight (13.5) | 2.86 u | 17.47 u |
| elite scout (15.5) | 3.29 u | 20.06 u |

Against total melee reach of 3.2 u (clubman) / 3.4 u (broadsword) / 4.4 u (halberdier), for a
target running **away**:

| guest class vs fleeing infantry | reach | usable @212 ms | @1294 ms |
|---|---|---|---|
| broadswordsman | 3.4 u | **1.70 u — 50% gone** | impossible |
| clubman | 3.2 u | 1.50 u — 53% gone | impossible |
| halberdier | 4.4 u | 2.70 u — 39% gone | impossible |

Against a fleeing knight the broadswordsman's usable reach at *median* ping is **0.54 u** — the
guest must stand inside the model. At p90 there is no configuration in which a guest lands a melee
hit on a moving target.

The error is **asymmetric**, which is why it reads as jank rather than as lag: a target closing on
you is *easier* to hit than it looks, because latency carries it into reach. Guest melee feels like
*"my sword passes through people I'm chasing, but I get free hits on people charging me."*

For arrows: the hit radius is 1.118 u and an infantry target displaces **1.70 u at median ping —
1.5× the entire hit cylinder** before `fireAimedFor` is even called. A knight displaces 2.6× it.
This sits on top of the normal flight lead the player can learn; the network error is a hidden,
variable offset they cannot.

## ⚠ Bonus defect: arrows tunnel through targets, and it costs the host too

`dt` is clamped at `09-main.js:629` (`Math.min(0.05, clock.getDelta())`). A full-draw arrow flies
at `36 × 1.6 = 57.6` u/s (`05-combat.js:828`), so it advances up to **2.88 u per sim step** against
a hit **diameter** of 2.236 u. `updateProjectiles` does one point-in-circle test per step with no
swept volume — **a full-draw arrow can step clean over a unit and miss.** The host was measured
pegged at that clamp (17 fps median), so this is the normal operating regime, not an edge case.
This is exactly the failure the blueprint's "sweep a capsule" clause exists to prevent, and unlike
everything else in this section it hits host and guest alike.

## ⚠ And the charge clamp loses charge on packet loss

`r.drawT` accumulates only on frames with a fresh `i.atk` bit, and the staleness path
(`10-net.js:723`) replaces `r.input` with `{}` — so `else if(!i.atk) r.drawT=0` **resets the draw
to zero**. A guest on a lossy uplink is denied charge they actually held.

---

# 4. BINARY BIT-PACKING & DELTA COMPRESSION — PRESENT

This is the strongest part of the codebase and it substantially already is the blueprint.

| Blueprint requirement | REGICIDE |
|---|---|
| No JSON | ✅ for the payload — packed `ArrayBuffer` + `DataView`. **❌ one leak: `JSON.stringify(carry)` runs unconditionally every snapshot (`10-net.js:1241`).** |
| Transforms + anim IDs + combat flags in one buffer | ✅ 18 B/unit row: `[id, cls, flags, x*10, z*10, facing*100, hp, maxHp, respawnT, garrison+1, cargo]` (`:1181-1185`); 8 B/building row |
| Quantize rotations to 8/16-bit | ✅ 16-bit — `dv.setInt16(o+8, facing*100)`. Arguably **over**-precise: 0.01 rad ≈ 0.57°. An 8-bit facing (1.4°) would save 1 B/row = ~5.5% of the wire |
| Bitmask for changed values | ✅ flags byte `alive | moving<<1 | working<<2 | pulse<<3` (`:1178-1180`) |
| Delta since last **acknowledged** snapshot | ⚠️ **Delta yes, ack no.** One global baseline per unit id (`_lastRow`), healed by a 1 Hz keyframe — not per-client |

**The interesting connection:** `aq` — the client ack added in v128.4 for reliable-lane congestion
control — is precisely the field a per-client delta baseline needs, and it is now already on the
wire. Whether to spend it that way is a separate question: per-client baselines mean N pack passes
on the host that is already the bottleneck, and the keyframe already heals loss at 1 Hz for 8 B.
**Measure with `netprofile --sep` before believing it is worth it.**

---

# 5. ZERO-ALLOCATION — real waste, wrong target

Measured on a 136-unit / 62-building state, median of 20 GC-free trials:

```
NET.packSnap()      59,140 B/call   ×15 Hz  =  866 KB/s
  wire payload         117 B/snap   ×15 Hz  =  1.7 KB/s
                                    ratio ≈ 500:1
```

**79% of that cost is fixed** — `row` and `row.join(",")` are built for all 136 units *before* the
ship decision. Attribution:

```
:1181 row[] + :1186 row.join()    ×136 units   41,846 B  (70%)
:1255 brow[] + :1256 brow.join()  ×62 blds     11,912 B  (20%)
:1230 stockKey concat chain                        438 B
:1241 JSON.stringify(carry)                        406 B
:1104 new ArrayBuffer + new DataView                174 B
```

An 11-element numeric array is 49 B; the same array plus `.join(",")` is **193 B**, because `join`
stringifies every number into a throwaway first. That is 2,040 joins/second for units plus 930 for
buildings, all to power a **string** delta cache.

`bcastFast` measures **17 B/call** — at the noise floor, genuinely clean. `hostFrame` measures
607 B/call excluding the snapshot. `driveRemote` is free on the leashed path and ~7.9 KB/remote/
frame off it, almost all of it downstream in `moveUnit`.

### The verdict: GC is a red herring for the 17 fps

1. 866 KB/s is one young-generation scavenge every 2–3 s, and scavenge cost scales with
   **survivors**, not allocation volume. Retained-after-GC measured **50 B/call**. This is the
   cheapest possible garbage.
2. It is **6–17% of the frame's own churn** — the sim allocates 7.7–13.3 MB/s by itself.
3. The measured cause of 17 fps is **>4,000 draw calls** (33.4 per unit × 136), not GC pauses. No
   amount of buffer pooling touches that. `tools/drawcost.js` has the number.

### If tidying anyway, these are bigger than the netcode

| # | Site | What | Measured |
|---|---|---|---|
| 1 | `09-main.js:276-279` | `applyLOD` allocates one object literal per friendly unit + a closure, every 0.15 s | **229 KB/call ≈ 1.5 MB/s** |
| 2 | `01-engine.js:500` | `terrainHeight` defines a **fresh closure on every call** (`const flat=(cx,cz,r,fall)=>{…}`), called once per unit per frame | **601 B × 136 × 17 fps ≈ 1.4 MB/s** |
| 3 | `04-units.js:1628` | `const LEGS={…}` constant map rebuilt inside `applyBaked`, per visible unit per frame | ~37 KB/frame **once baked anims ship** |
| 4 | `05-combat.js:655,664` | `steerAroundBuildings` returns a fresh array per moving unit per frame | per moving unit |
| 5 | `10-net.js:1186,1256` | the two `join(",")` delta keys → numeric hash or `Int32Array` shadow row | ~90% of 866 KB/s |

Credit where due: `04-units.js:1586-1598` already does pooling correctly — `_bq`/`_dq` module-level
quaternions written in place by `_sampleQ`, so the 136-unit × ~15-bone animation path allocates
**zero** quaternions. No `THREE.Ray`, `Raycaster`, `Box3` or `Quaternion` is constructed in any
per-frame loop. `separate()` in `07-ai.js:1149` is O(U²) — 9,180 pair tests/frame — at **13 B/call**.

---

# 6. WHAT TO ACTUALLY BUILD, RANKED

1. **Lag compensation (item 3).** The only genuine architectural hole, and the numbers say guests
   currently cannot land melee on anything that runs away. A 500 ms ring of quantized positions is
   ~136 units × 15 Hz × 0.5 s × 4 B ≈ **4 KB** in an `Int16Array` — trivial memory, and the data is
   already being computed for the snapshot. Needs a time field on the guest's attack (optional,
   guest→host, **no PROTO bump** by the same reasoning as `aq`/`et`).
2. **Arrow tunnelling.** A swept segment test instead of a point sample, in `updateProjectiles`.
   Small, self-contained, and it fixes misses for host and guests alike.
3. **The analog-magnitude divergence** on mobile guests. Probably a handful of lines to make the
   guest's own prediction use `moveVec` the way the host does.
4. **The `dead`-zone degeneration** above `gapAvg ≈ 1173`, which the p90 field ping reaches.
5. **The dragoon's 12-vs-15 pistol range** and the **draw-charge reset on packet loss.**
6. Everything else here is optional. The grid is measured worthless, per-client deltas are
   unproven, and zero-allocation is tidiness rather than frames.

**And above all of it:** the host runs at 17 fps. The unit rigid-cluster merge (2,086 → ~660 draw
calls) remains the largest single lever in the project, and a dedicated Node.js authority — the
thing the blueprint actually assumes — would solve it outright at the cost of hosting.
