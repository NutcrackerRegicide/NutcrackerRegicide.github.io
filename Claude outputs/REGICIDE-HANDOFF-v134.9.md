# v134.9 — THE SCREEN FACES THE LANES

**Status: built, verified, not pushed.** `sw.js` VERSION and `index.html` verstamp both read
`v134.9 — THE SCREEN FACES THE LANES`.

John asked for the stale map constants. All four are now derived from the map instead of typed at
it. Chasing why one bench went red on the way there turned up something much larger.

---

## 1. The thing that was underneath everything: orphaned soldiers

A bench failed on `SMOKE_SEED=777` — *"BLUE kingsguard never disbands (0 strong, 23 soldiers
left)"*. The first two explanations were wrong and both would have ended in a bench edit: the king
is alive, and the band exists. The third probe is the one that mattered:

```
BLUE soldiers 23 -> king 1 · band:kingsguard 2 · band:camp 16 · nobot 4
                 | bands kingsguard:0, camp:6
```

**Sixteen soldiers carried a `bandRef` pointing at a band that did not list them.** `manageBands`
prunes dead members out of a band's roster and never clears their pointer; `respawnUnit` brought
them back with it intact — under a comment that reads *"the dead answer no horn — a respawned
villager forgets the band"*, beside three lines that did not do it. And the loose pool is built from

```js
if(!v.bandRef || !D.bands.includes(v.bandRef)) roster.push(v);
```

so a pointer at a **live** band it isn't in makes a soldier invisible to every deal for the rest of
the match. **One soldier lost per death, compounding all game.**

Measured, four armies, 15-minute campaigns:

| | bandable soldiers | in a band | **orphaned** | mission bands |
|---|---|---|---|---|
| 777 blue *(before)* | 11 | 0 | **11** | 0 |
| 777 blue *(after)* | 4 | 4 | **0** | 0 |
| 777 red *(before)* | 38 | 11 | **27** | 1 |
| 777 red *(after)* | 24 | 24 | **0** | **4** |
| 42 blue *(before)* | 27 | 12 | **15** | 1 |
| 42 blue *(after)* | 24 | 24 | **0** | **2** |
| 42 red *(before)* | 19 | 7 | **12** | 0 |
| 42 red *(after)* | 17 | 17 | **0** | **3** |

**65 of 95 bandable soldiers orphaned, across four armies. Now none.** Mission bands went from 2 to
9. (The armies are *smaller* afterwards because they now go on missions and take casualties instead
of standing about invisible.)

This is very likely the second cause under v134.3's *"one mission band a match"*. The doctrine bug
fixed there was real; the loose pool it deals from was leaking the whole time.

**It survived twenty versions with a green suite** because the consistency gate only ever read one
direction — `members → pointer`, never `pointer → members`. Both now, plus a staged round trip
(deal, kill, prune, respawn, re-arm, deal again).

⚠ **The prune is the fix.** `manageBands` always prunes before it builds the roster, so releasing
there closes it completely. The `respawnUnit` line is belt and braces — `falsify m_respawn` came
back 0 failures on the first cut, because by then the prune has already cleared the pointer. It is
kept because the comment beside it has claimed to do this for twenty versions, and it is gated
separately (a death with no think in between) rather than dressed up as load-bearing.

---

## 2. The four stale constants, re-derived

`tools/mapdrift.js` is the new instrument — the map-drift counterpart to `tools/mapconst.js`.

**THE GATE.** `const d=Math.abs(b.z-6); // the road runs ~z 6 at the wall line`. It does not.
`roadPoint`'s x is linear in t, so the road's z at any x is exact arithmetic:

| front | 34 | 48 | 62 | 76 |
|---|---|---|---|---|
| road z | 7.98 | 10.53 | 12.43 | 13.64 |

Segments sit **10.9** apart, so an error of 7.64 is most of a segment: the gate went into the wrong
one and the Kings Road ran through a wall. `roadZAt` inverts `roadPoint` — one source.

**THE CURTAIN.** A 96-unit plan cut into **9** segments by `wallLineSegments`, then `.slice(0,8)`
threw the ninth away — so a turtle that built every wall it had still left a **segment-wide hole at
one end, every game, by construction**. The length is derived from the walls it can pay for now
(`P.walls * 10.9`), so the plan and the purse are the same number. Only `turtle` walls (8; rush,
boom and expand are 0), which is why this was rare rather than wrong.

**THE TOWER SCREEN.** `z=(Math.random()-0.5)*66` — anywhere in ±33 on a map 304 deep, covering one
lane of five. Measured at 1 Hz over four seeded campaigns, enemy soldiers in an 8-wide slab at the
defender's own wall line:

| | mean coverage |
|---|---|
| `\|z\| ≤ 33` (the shipped screen) | **31.9%** |
| `\|z\| ≤ 48` (the curtain's span) | 53.4% |
| within 25 of a `LANE_Z` | **93.9%** |

The lanes are where they walk, because `assignLane` deals every raid and every band one of the five.
Towers are dealt `LANE_Z` centre-out now — road first, then the flanks, then the far lanes for a
turtle that can afford them. Two random draws before, two after.

**THE PATROL.** Four waypoints at (15,11) (22,16) (4,−24) (26,−6) — furthest **27.20** against a
`TC_RING` of 30, so the whole loop ran *inside the farm ring*, through its own corn, past its own
kingsguard. Those offsets predate the ring; v134.1 pushed every other sampler out and missed this
one. A ring at `TC_RING+6` now, short-legged on the rear side so the long side is the side an
attacker crosses. (My first cut put the rear waypoint back at 18 — the gate caught it.)

---

## 3. A v134.6 bug of mine, found while measuring

Having dealt the towers onto the lanes I went to measure the improvement and found nothing to
measure: across four seeded campaigns and eight armies, `findSpot` placed **zero** screen towers.
Every Guard Tower standing at the whistle had come from the v134.6 bazaar ring.

`need("tower", …)` counts with `countBld(team,"tower")` — **every** Guard Tower, including the ones
raised over the squares. So a personality's tower budget was spent by a building it never asked for:
rush and boom carry `towers:2`, and one bazaar tower plus one more fills the cap. **Holding a square
quietly disarmed the town behind it.** Bazaar towers are tagged at birth now and the town's budget
counts only the untagged.

⚠ **And the screen fix is still latent, which I have to say plainly.** Even with the budget freed,
`need("tower", …)` sits at the bottom of the want chain behind siege workshops, temples and houses,
and below age 3. Instrumented over two campaigns, the reasons it was refused:

```
seed 42     605 age · 370 age+preempted:house · 327 age+preempted:siege_workshop · 160 age+preempted:barracks
seed 12345  581 age+preempted:siege_workshop · 320 age · 255 preempted:temple · 142 age+afford
```

Re-ordering that chain is a balance call, not a stale constant — **it's yours.** *Should a Guard
Tower outrank a siege workshop?*

---

## 4. Five more benches that were measuring the neighbourhood

Same family as v134.8's, found the same way.

| bench | what it was actually measuring |
|---|---|
| my own v134.9 tower gate | Asserted two absolute counts as if the campaign owned no towers. It owned one. The claim is a **difference**; it reads one now. |
| the two relief benches | `isolateArea(…, 30, …)` while `manageBands` resets the contact clock from any enemy within **HOLD_WATCH = 48**. Probed: `quiet=0.0/18` with every other clause satisfied. It had staged 30 of the 48 the rule reads since v127 — an 18-unit annulus of luck. Derived from `HOLD_WATCH` now. |
| the creep-regen bench | Reported `cleared 0, still in ring 0, alive false`. The probe found **four red musketeers two to four units off the body** — the isolation is centred on the *camp* at 31.5 and the creep had wandered 29.6 out on its leash, so both of the bench's own diagnostics described the camp while the shooting happened at the creep. The body gets its own circle now, and the wave is held off so the pack isn't swapped mid-measurement. |
| the two ox benches | Took the **first** wood node with `amount>60`, wherever it was. On seed 777 that is (0,−54) — walkable, no building within 14, no camp — and an ox placed beside it drifted to (−7.0,−57.8) and never reached the gather point. Both then reported that an ox does not gather. The seam is chosen by trial and named in the message; reaching a tree is the movement layer's claim, with its own benches. |
| the kingsguard bench | See §1 — this is the one that was right. |

**No assertion was weakened.** Every bar is where it was.

---

## Verification

- **8 seeds** — default (0x5E1F), 42, 1, 777, 3, 99, 12345, 20260827 — all `ALL SMOKE TESTS PASSED`.
- **3 byte-identical runs** on the default seed.
- **Worldgen hash unmoved**: `all=0fadb0bd9cbfae78 · res=263053daf3631497`, 743 / 674 nodes.
- **VERSION and verstamp bumped together.**
- **826 → 834 assertions.**
- **Seven mutations, every one caught** (`tools/falsify.sh`):

| mutation | what it breaks | gates red |
|---|---|---|
| `m_road` | the gate guesses the road's z again | 1 |
| `m_screen` | towers scatter across ±33 | 1 |
| `m_curtain` | the 96-unit plan the slice truncates | 1 |
| `m_patrol` | the old box, back inside the corn | 1 |
| `m_budget` | bazaar towers spend the town's budget | 1 |
| `m_prune` | leaving a band no longer releases the soldier | 1 |
| `m_respawn` | the respawned keep a stale pointer | 1 |

⚠ `m_curtain` and `m_respawn` both came back **0 failures on their first run** — the curtain gate
was replaying arithmetic from a data table and never reading the planner, and the respawn line is
covered by the prune. Both gates were rewritten rather than the mutations discarded.

### The chain

Reproduces from pristine v133 byte-for-byte. v134.9's additions, in order:

```
… patch-smoketest-diffnormal-v134 ·
patch-mapderive-v134 · patch-towerbudget-v134 · patch-smoketest-mapderive-v134 ·
patch-smoketest-ambient2-v134 · patch-orphans-v134 · patch-smoketest-orphans-v134 ·
patch-smoketest-ambient3-v134
```

Files changed: `js/05-combat.js`, `js/07-ai.js`, `tools/smoketest.js`, `sw.js`, `index.html`, plus
`tools/mapdrift.js` (new) and the seven new `tools/patch-*.js`.

---

## Open

- **Should a Guard Tower outrank a siege workshop?** The want-chain order is why the screen is
  latent. Balance, and yours.
- **A bot villager hauls at a hardcoded 20**, not `carryCap(u)`, so Deep Satchel does nothing for a
  bot. Older than v134.4; makes a bot carry *less* than its cap, so it breaks no invariant.
- **The ⭐LV tag height** — y = 6.2 against a man of ~2.4; ~3.2 would sit the star above the helmet.
- **The Viking bay** — should the AI contest it? Flagged since v134.3.
- **Dials awaiting playtest:** `BAZ_TOWERS` at 1, the Guard Tower's age-3 gate, whether one ox still
  gathers too fast — and now whether NORMAL red plus a working band economy is too much at once.
