# v134.11 / v134.12 — THE WALL THAT WAS NOT THERE · THE FIELDS STOP AIMING THEMSELVES

**Status: built, verified, not pushed.** `sw.js` VERSION and `index.html` verstamp both read
`v134.12 — THE FIELDS STOP AIMING THEMSELVES`. Two versions in one delivery: v134.11 is the bazaar
work John asked for, v134.12 is the farm-ghost revert he asked for after playtesting it.

Three asks from John, and the third one answered the other two.

> *"I would actually say two to 5 towers."*
>
> *"Also how a marshal handles the guard towers at the bazaar should be in alignment with the
> marshal personality. For example the turtle marshal would be more inclined to defend their bazaar
> while the rushing marshal is going to be more inclined to captured the enemies bazaar vs
> defending their own."*
>
> *"All guard towers should be the same size regardless of age to prevent that issue from happening.
> Or at least have the same footprint."*

---

## 1. The third ask is not an art change

`tools/towerbox.js` (new) measures every type in the footprint table against its own model — every
vertex, in the frame the collider actually works in, because `05-combat.js:2352` rotates the body
into the building's **own** frame before testing the box.

| type · age | table | model | over |
|---|---|---|---|
| tower a3 | 4.20 × 6.30 | 4.90 × 6.50 | — |
| tower a4 | 4.00 × 4.00 | 4.60 × 4.60 | — |
| **tower a5** | **8.96 × 9.03** | **6.28 × 6.60** | **2.68 / 2.43** |

The Enlightenment bastion is `CylinderGeometry(5.4, 6.6, 4.2, 5)` turned `PI/5` — a pentagon of
circumradius 6.6. **8.96 × 9.03 is that pentagon's axis-aligned box pushed through the same
rotation:** its box is x ±6.277, z −5.339…6.6, and turning the corners 36° gives
6.277·cos36 + 6.6·sin36 = **8.957** and 6.277·sin36 + 6.6·cos36 = **9.029**. Both to the hundredth.
Somebody measured the box and rotated it instead of rotating the shape.

So **every Guard Tower past Industrial has stood inside 2.7 units of wall that is not there**, and
that — not the art — is what collapsed the bazaar ring at Enlightenment. It is the same mistake
v131.19 exists to fix, surviving inside its own fix: that note measured the over-block of one baked
maximum and never asked whether the maximum was real.

**Guard towers are already nearly the same footprint:** 4.20 × 6.30 at Classical against
6.28 × 6.60 at Enlightenment. The table was wrong, not the model.

⚠ **Two other entries over-block and are deliberately left alone.** Town centre age 4 by 1.73 in x,
watch tower age 1 by 0.58. The town centre's number feeds `bSurf`, and `bSurf` feeds the hauler's
deposit stop, which the note above `bStand` says is on a knife edge — *"a hauler at the v131.5
town-centre radius NEVER DEPOSITS"*. That is its own version, not a passenger on this one. The
instrument is in the repo and names both.

## 2. What the ring then holds

`tools/ringfit.js` (new), 40 trials a cell, cleared ground, driving the real `validFor`:

|  | age 3 | age 4 | age 5 |
|---|---|---|---|
| shipped box, shipped sampler | 4 | 4 | **2** |
| corrected box, shipped sampler | 4 | 4 | **4** |
| corrected box, **lattice** | **5** | **5** | **5** |

The correction alone buys back age 5. Five needed one more thing, and it was not a bigger ring.

**v134.10 put each new tower in the middle of the widest gap** — right for the tower being placed
and wrong for the one after it. Two towers seated opposite each other can never grow into five:
each 180° arc then takes exactly one more, because five towers want 72° between neighbours and a
180° arc holds one at 71.2°. That is arithmetic, not luck, and it is why the sweep topped out at
four however the radius was sampled.

**So the slots are cut once, for `BAZ_TOWERS_MAX`, and the garrison size decides how many are
FILLED — never where they are.** A square that earns its fifth tower in the twentieth minute puts it
in a slot left standing empty for it in the third. The radius is the one the spacing needs at that
slot count **at the largest the building ever gets** — a lattice laid at the Classical footprint
(18.6 between centres) stops accepting towers the moment the town reaches Enlightenment, which wants
19.2, so the ring would quietly shrink by one at the age it is needed most.

⚠ **And the radius only ever wanders outward.** `_rLat` is the radius at which the slot count
*exactly* fits, so a candidate half a unit inside it has a shorter chord than the spacing needs and
the last tower is refused. Measured: a symmetric wobble of ±0.085 cost the fifth tower at age 5 on
both squares; the same sampler biased outward seats five at every age. The gate reads
**closest pair 19.21 against the 19.20 `validFor` actually refuses at** — the ring rides exactly on
its constraint, and the 19.20 is *probed* by walking a second tower in, not restated from `_gapFor`.

## 3. Two to five, and the doctrine sets the floor

`BAZ_TOWERS_MAX` 4 → 5. The floor is **`PERSONALITIES[…].towers`**, which the table already says:

| doctrine | floor | after 1 loss | after 3 |
|---|---|---|---|
| rush | 2 | 3 | 5 |
| boom | 2 | 3 | 5 |
| expansionist | 3 | 4 | 5 |
| turtle | 4 | 5 | 5 |

A second per-personality number would be a copy of the first that nothing keeps in step. This is the
same statement — *how tower-minded is this doctrine* — spent on a different budget, and the budgets
have been separate since v134.9, when `countScreenTowers` stopped charging bazaar towers against the
town's screen.

## 4. …and the doctrine reached the bazaars through nothing at all

This is the find. `bandHoldPoint` ranked the squares by what they pay, and then:

```js
const order = want.concat(mine);   // everything we do NOT hold, then everything we do
```

**Unconditional, for all four doctrines.** A turtle sent its first bands at the enemy's squares
exactly like a rush. `bazaarWorth` could not have carried the personality either — it only sorts
*within* each group, and the groups are hard-ordered above it. There was no lever.

There is now: **a square this doctrine has already been thrown off is guarded ahead of one it could
take**, and how many losses earn that promotion is derived from `raidAt` — the hour a marshal first
goes at the enemy, and the plainest statement of aggression in the table.

| doctrine | raidAt | losses before it guards |
|---|---|---|
| turtle | 600 | **1** |
| boom | 400 | 2 |
| expansionist | 280 | 3 |
| rush | 80 | **4** — which is to say never |

Against a measured 0–3 losses a square, a rush would rather take yours than sit on its own. The ends
of the scale are read off `PERSONALITIES` itself so a fifth doctrine cannot silently fall off either
end of a pair of typed constants.

**The bar is losses, not taste.** An unpressed turtle still goes and takes: sitting on a square that
pays nothing extra while the enemy sweeps the board is not defence, and the gate asserts that too.

## 5. v134.12 — the player's fields stop aiming themselves

John, after a playtest: *"not a fan of how the farms rotate around town center, storage pits etc can
we revert them back to where I can manually rotate them if I want to?"* — and, asked which half he
meant: **just his.**

v134.8 gave the placement ghost the AI's own facing rule, recomputed every frame, and argued for it
like this: *"a field he plants beside the AI's should not be the one facing the wrong way."* That
reasoning is about a town. The thing it was applied to is a man lining a building up with a mouse. A
ghost that re-aims itself under the cursor is not a convenience however good its arithmetic, and
R-to-override does not rescue it — you have to fight it before you can use it.

**So the player half goes and the AI half stays.** Reverting the AI too would bring back what v134.8
fixed: barns lapping the Town Centre and storage-pit boxes 104 times a campaign, up to 0.47 units
deep. A bot places unattended and cannot be asked to press R; a player can.

- The per-frame auto-facing is gone from `updateGhostFollow`. A farm places square-on and **R turns
  it**, exactly as every other building always has.
- `placing.rotManual` goes with it. It existed for one reason — to stop the auto-facing snapping the
  ghost back when the key was released — and a flag that guards nothing is a trap for the next
  reader. The gate asserts its absence.
- **The rot plumbing stays.** `placing.rot` still reaches `makeBuilding` and `NET.guestAct`, which is
  what makes R work for a farm at all, and for a guest. That was v134.8's other half and nobody
  objected to it.

⚠ The gate went red on its own explanation first — the comment saying *why* `rotManual` is gone
names it. Fixed the way this file already does it: strip line comments before a source read. *A read
a comment can satisfy is a read a comment can also defeat.*

---

## 6. What a real campaign does with all of this

`tools/mapdrift.js` now records **when each team reaches each age**, because a Guard Tower is an age
3 building and nothing measured whether a marshal ever gets there.

| team | age 1 | age 2 | age 3 | age 4 | age 5 |
|---|---|---|---|---|---|
| A | 2 min | 4 min | **21 min** | — | — |
| B | 3 min | 6 min | **17 min** | 27 min | 43 min |
| C | 2 min | 4 min | — | — | — |
| D | 3 min | 7 min | **23 min** | — | — |

**Classical lands at 17–23 minutes.** That is why four seeded *twenty*-minute campaigns found one
team of eight at age 3 and two still at age 0, and why every square in them read `wants 4, has 0`.
The bazaar garrison is not a mid-game feature; it is a feature of games that run past twenty minutes.

And when they do run that long, it works end to end. On seed 12345, at **Enlightenment**, where the
shipped code could seat two:

```
team1 [age 5]: mined 2353 stone, 543 in hand · 5 Guard Towers (5 ringing a square) · 2 wall segments
   grand  owner 1  lost by this team 4  -> wants 5, has 5
          bearings [-12, -84, 132, 60, -156]   closest pair 72deg
```

Five towers, the full ramp fired by four losses, seated on the lattice at exactly 72°, in a live
campaign rather than a staged bench — and 543 stone still in hand, so the `BAZ_TOWER_STONE` reserve
did its job. Seed 42's team1 reached `wants 5, has 4` at age 3 with 619 spare, still climbing when
the whistle went.

⚠ **And zero castles, in every run, including the one that reached Enlightenment with 543 stone
spare.** John asked what the AI does with castles: it wants one (`need("castle", P.castles, 350,
120)`, ninth in the want chain, behind two watch towers), places it on a random bearing 31–48 units
from the throne, shoots from it, banks resources at it and rings it with farms — and **never
garrisons it**, because `u.garrison` exists only for the player and for remote units. In practice it
never builds one at all. That is now measured rather than suspected, and it deserves its own version.


---

## Verification

- **8 seeds** — 42, 1, 777, 3, 99, 12345, 20260827 and the default 0x5E1F — all
  `ALL SMOKE TESTS PASSED`, at v134.11 and again at v134.12.
- **3 byte-identical runs** on the default seed — all md5 `ea7b5d66108a2163b712e9856133a5dd`.
- **Worldgen hash unmoved**: `all=0fadb0bd9cbfae78 · res=263053daf3631497`, 743 / 674 nodes. The
  lattice runs at placement time and draws twice an iteration exactly as the sweep did.
- **VERSION and verstamp bumped together** — both `v134.12`.
- **839 → 843 assertions.**
- **Eleven mutations, every one caught:**

| mutation | what it breaks | gates red |
|---|---|---|
| `m_box` | the age-5 footprint goes back to the rotated box | 2 |
| `m_maxbox` | the table is fixed but `BLD.tower.fx/fz` is not | 1 |
| `m_lattice` | back to v134.10's sweep of the whole ring | 3 |
| `m_rjit` | the radius wobbles inward as well as out | 1 |
| `m_ceiling` | the ceiling returns to four | 1 |
| `m_floor` | the garrison stops reading the doctrine | 1 |
| `m_order` | take-before-guard goes back to unconditional | 1 |
| `m_guardat` | every doctrine guards at one loss | 1 |
| `m_ghostback` | the player's ghost aims itself again | 1 |
| `m_aiflat` | the AI's farms stop turning | 2 |
| `m_rkey` | R no longer rotates the foundation | 1 |

### A bench that walked into the warning three benches above it

The v134.5 posting bench went red, and the first read of it was "the doctrine change broke the
posting". It had not. The bench staged **ownership** and left the **loss ledger** alone — which was
fine until this version made the ordering read that ledger, so on any seed where the campaign had
already cost BLUE a square, a correct posting was reported as a regression. Sixth bench in three
versions to isolate one population and forget the other.

And then the new doctrine bench did it again, differently: it read its verdict **after** putting the
board back. `baz` is a live reference to the market object, so `rGo.baz.owner` asked after the
restore reports whatever the campaign left there, not what the posting was made against — it read
*"a rush guards"* on a rush that had correctly gone to take. The identity half of the same check
survives a restore, which is exactly why the turtle half passed and hid it. **The file already
carries that warning, in capitals, three benches above the one I wrote.**

### The chain

Reproduces from pristine v133 byte-for-byte. v134.11's additions:

```
… patch-smoketest-emptycorner-v134 ·
patch-bazdoctrine-v134 · patch-smoketest-bazdoctrine-v134 · patch-farmghost-v134
```

Files changed: `js/00-data.js`, `js/06-input.js`, `js/07-ai.js`, `tools/smoketest.js`, `sw.js`,
`index.html`, plus three new `tools/patch-*.js`. The instruments — `tools/towerbox.js` and
`tools/ringfit.js` (new) and `tools/mapdrift.js` (extended with the age timeline, and pointed at the
real `bazTowerWant` instead of a restatement of it) — are delivered alongside but are not part of the
chain, which covers `js/`, `tools/smoketest.js`, `sw.js` and `index.html`.

---

## Open

- **⚠ THE AI REACHES CLASSICAL AT 17–23 MINUTES, AND MOSTLY NEVER GETS FURTHER.** Measured above.
  Everything from age 3 up — the Guard Tower, the temple, the market, stone walls, the castle at 4 —
  exists only in long games. This is upstream of every feature built on top of it and is probably
  the biggest open item in the file.
- **The castle is budgeted for and never built** — zero across every campaign measured, including one
  at Enlightenment with 543 stone spare. And no AI unit has ever garrisoned one: `u.garrison` is
  player- and remote-only, so v134.5's reason for not posting a band to a castle — *"a castle guards
  itself; it has walls, towers and a garrison"* — is half true for a bot.
- **The other two over-blocks** — town centre age 4 (1.73 in x), watch tower age 1 (0.58). Wants its
  own version because the town centre's box feeds the hauler's deposit distance.
- **Should a Guard Tower outrank a siege workshop?** Unchanged since v134.9 and still the biggest
  open question: `need("tower", …)` sits last in the want chain, so the *town's* screen is rarely
  built at all.
- **A bot villager hauls at a hardcoded 20**, not `carryCap(u)` — Deep Satchel does nothing for a bot.
- **The ⭐LV tag height** — y = 6.2 against a man of ~2.4.
- **The Viking bay** — should the AI contest it? Flagged since v134.3.
- **Dials awaiting playtest:** the 2→5 ramp, the doctrine floors (a turtle now wants four round every
  square it holds — 3,000 stone on a swept map, against 570–2,020 measured sitting unspent), and
  whether a rush that never guards its own squares actually wins more.
