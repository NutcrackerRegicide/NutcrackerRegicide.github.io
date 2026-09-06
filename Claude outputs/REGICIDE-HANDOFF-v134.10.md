# v134.10 — WHAT IT COSTS TO KEEP A SQUARE

**Status: built, verified, not pushed.** `sw.js` VERSION and `index.html` verstamp both read
`v134.10 — WHAT IT COSTS TO KEEP A SQUARE`.

John: *"They should prioritize towering up at least two to four towers to defend their own bazaar
depending on how the game is going and how much pressure — e.g. how many times their bazaar has been
captured during the game. If they are losing their bazaar a lot they should be more inclined to
protect it."*

This is the number v134.6 deliberately left alone. Its own note reads: *"John asked for 3-4 … The
number is here, alone on a line, when we know what one plays like."* We know now, and the answer
turned out not to be a bigger constant but a constant that reads the game.

---

## 1. What "a lot" is, measured

Four seeded 20-minute campaigns, counting how many times each team **lost** each square:

| seed | grand (blue/red) | west (blue/red) | east (blue/red) |
|---|---|---|---|
| 1 | **3 / 2** | 0 / 0 | 0 / 0 |
| 42 | 2 / 2 | 1 / 1 | 1 / 1 |
| 777 | 0 / 0 | 0 / 1 | 1 / 1 |
| 12345 | 1 / 1 | 1 / 1 | 0 / 0 |

The range is **0 to 3**, and the Grand — on the Kings Road, worth the most, reachable from both
thrones — is where nearly all the churn is. So the ramp is scaled over what the map actually
produces rather than over an imagined double figure:

> **two towers on a square you hold, one more for each time it has been taken off you, to four.**

A marshal that never loses a square never spends past the floor. One side's losses never size the
other's garrison.

The signal is a per-square, per-team counter written by the flip itself — `bazaarTaken(m, team, was)`
already had `was`, the previous owner, and was using it for nothing.

## 2. Whether the stone is there

Same runs. Stone mined in twenty minutes, per team: **120 · 1785 · 1185 · 2100 · 1300 · 1200 · 960 ·
1420**. Stone still **in hand** at the whistle: 20 · 1785 · 1085 · 2020 · 1300 · 1100 · 860 · 570 —
with 405 to 1762 still in the six piles. **The marshals are sitting on it.** Two towers on each of
three squares is 1,500; four on each is 3,000.

⚠ **So the reserve had to move, and that part is not John's ask — it falls out of it.**
`BAZ_TOWER_STONE` was **150**, a floor set when the whole feature was one tower a square (750 at the
very most). Against a garrison that can now want twelve, 150 protects nothing: a **castle is 500
stone** and a turtle's eight fort walls are 1,600. A frontier that eats the keep behind it is not a
defence. The floor is now `BLD.castle.cost.stone`, derived rather than typed.

## 3. How many the ring actually holds — a hard limit, not a choice

Worth knowing before promising four. Swept offline at 720 bearings × 9 radii on cleared ground,
against the game's own `validFor`:

| age | 3 | 4 | 5 |
|---|---|---|---|
| towers that fit | **4** | **4** | **2** |

A Guard Tower's footprint grows at Enlightenment — `BLD.tower.fxA/fzA` go from 4.20×6.30 to
8.96×9.03 — and `validFor` spaces buildings by 0.75 of the smaller one's width, so a ring of
12.1–16.5 runs out of room. The Guard Tower unlocks at age 3, so **two-to-four is available for the
whole window it exists in except the last age**, where a square holds two.

Nothing is done about that: the age-5 tower is a bigger building on purpose. The marshal takes what
fits and does not stall (`bazTowerSpot` answers null, the war room moves on), and **both** numbers
are gated so neither becomes folklore.

## 4. And they stand round the square

`bazTowerSpot` kept the legal spot **nearest home** — right for one tower (v134.6: *"the villagers
who build it walk from home"*), and wrong for four, which all land on the same home-facing arc and
leave the far face of the plaza covered by nothing. Separation is now **maximised** — each new tower
goes in the middle of the widest gap — with home as the tie-break, weighted so it decides between
equals and never overrides the ring.

Measured on a cleared ring at age 4: **82° between the closest pair** of four towers, against 56°
with the scoring reverted. (A *threshold* was tried first and the gate caught it: three towers
landed at 112/124/124°, the fourth needed a 62° slot, the bar refused everything, and a square that
had earned four got three.)

⚠ The sampler also had to stop sprinkling. 36 independent random bearings cover a ring the way
buckshot covers a wall, and once one tower stands `validFor` refuses everything within 14 of it — so
the second call came back empty. It sweeps the ring with a one-slot jitter now. Same two draws an
iteration, so the seeded window is untouched.

---

## Verification

- **8 seeds** — default (0x5E1F), 42, 1, 777, 3, 99, 12345, 20260827 — all `ALL SMOKE TESTS PASSED`.
- **3 byte-identical runs** on the default seed — `rep1`/`rep2`/`rep3` and the seed run itself all
  md5 `ddf5e4e37ea18b2915d6067d0dc937a2`.
- **Worldgen hash unmoved**: `all=0fadb0bd9cbfae78 · res=263053daf3631497`, 743 / 674 nodes. The
  ledger is two integers on each market and consumes no random draw.
- **VERSION and verstamp bumped together** — both `v134.10`.
- **The chain still reproduces the live repo byte-for-byte** from pristine v133 (`js/02-world.js`,
  `js/05-combat.js`, `js/07-ai.js`, `tools/smoketest.js`, `sw.js`, `index.html` all `cmp`-clean).
- **834 → 839 assertions.**
- **Four mutations, every one caught:**

| mutation | what it breaks | gates red |
|---|---|---|
| `b_flat` | the garrison stops reading the pressure | 2 |
| `b_ledger` | a capture is charged to nobody | 1 |
| `b_huddle` | back to keeping the spot nearest home | 1 |
| `b_reserve` | the reserve returns to 150 | 1 |

⚠ `b_huddle` came back green on its first run against a bar of 0.6 of an even share — `validFor`'s
own spacing forces 56° for free, so the bug cleared the bar and the gate was resting entirely on a
source read. The bar is three quarters of a share (67.5°) now: 82 clean, 56 mutated.

### Three more benches that were reading the neighbourhood

Same family as v134.8's and v134.9's, and by now it is a pattern worth naming.

| bench | what it was actually measuring |
|---|---|
| my own v134.10 ring gate | Reported "0 of 4" — an earlier bench had left a **Town Centre 22 units from the west bazaar**, and `tcRingReason` refuses every non-farm plot within `TC_RING` of one, so all 36 swept bearings were illegal. It clears the ground now, and stages the **age**, because the ring's capacity depends on it. |
| the kingsguard bench | *"0 strong, 4 soldiers left"* on seed 42. Probed: all four survivors were **botless, three of them remote** — bodies `manageBands` skips by construction. The excuse clause counted `dmg>0 && cls!=="villager"`; it counts with the roster's own predicate now. Third pass over this bench in two versions, same mistake in different clothes. |
| the v128.5 lag-compensation duels | Both **arrow** checks failed on seed 1 while the melee ones passed — the signature of a collider in the flight path. The "empty corner" search looks for units within 45 and had never looked for **buildings**: there was a storage pit five units away. |

**The lesson, for whoever writes the next one:** name the population the *rule* reads, and clear
that. The relief benches cleared units at 30 when the rule reads 48; the creep-regen bench cleared
round the camp while the fight was at the creep; the ring gate cleared nothing and met a Town Centre;
the duel corner cleared people and met a storage pit. Every one of them isolated one population and
forgot the other.

### The chain

Reproduces from pristine v133 byte-for-byte. v134.10's additions, in order:

```
… patch-smoketest-ambient3-v134 ·
patch-bazgarrison-v134 · patch-smoketest-bazgarrison-v134 ·
patch-smoketest-kgcount-v134 · patch-smoketest-emptycorner-v134
```

Files changed: `js/02-world.js`, `js/05-combat.js`, `js/07-ai.js`, `tools/smoketest.js`, `sw.js`,
`index.html`, plus the four new `tools/patch-*.js`.

---

## Open

- **Should a Guard Tower outrank a siege workshop?** Unchanged from v134.9 and still the biggest
  open question: `need("tower", …)` sits last in the want chain, so the *town's* screen is rarely
  built at all. The bazaar garrison is a separate code path and is not affected — but a marshal that
  reaches age 3 will now spend its stone on squares before it ever spends it on a home screen.
- **A bot villager hauls at a hardcoded 20**, not `carryCap(u)` — Deep Satchel does nothing for a bot.
- **The ⭐LV tag height** — y = 6.2 against a man of ~2.4.
- **The Viking bay** — should the AI contest it? Flagged since v134.3.
- **Dials awaiting playtest:** the 2→4 ramp itself, NORMAL red, whether one ox still gathers too fast.
