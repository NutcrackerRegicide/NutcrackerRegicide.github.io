# REGICIDE — ART DIRECTION: THE SIX AGES

**Companion to `ART-DIRECTION.md`. That document is the law; this one is the law applied to 40 unit
classes, 20 building ids and 6 ages.** Where the two disagree, `ART-DIRECTION.md` wins on every
global rule (palette discipline, silhouette, budget, prohibitions) and this document wins on which
hex goes on which class in which age.

Sources this document is derived from, and which an implementer should keep open:

- `docs/unit_appearance_units.csv` — 37 researched entries. The owner's intent.
- `docs/unit_appearance_buildings.csv` — 76 researched entries across six ages.
- `docs/ref/nutcracker-reference.png` — the single best statement of the target look. Three figures:
  a blue-and-gold armoured soldier, a crowned king in red and gold, a Norse figure in scale and mail.
- `ART-DIRECTION.md` §2 (palette), §5 (silhouette), §6 (the nutcracker spec), and the amendments
  §2.6a, §6.1a, §6.3a, §6.3b.

---

## 0. THE GOVERNING TENSION, STATED ONCE

The CSV is history. The reference art is a toy. They disagree on the very first unit and they keep
disagreeing.

> **THE RULE: the nutcracker canon wins on SILHOUETTE, the history wins on MATERIAL and COLOUR.**

Concretely, and this is not negotiable:

| The canon owns | The history owns |
|---|---|
| ~~A hat mass of **≥ 0.20 H** on every unit~~ **⚠ WITHDRAWN — see `ART-DIRECTION.md` §6.5b.** The floor is now on **hat + head together = 0.46–0.54 H**; the split between them is the age's business. The per-hat floor stretched every helmet to shako height and broke §6.5a. | What that hat is *made of*, what colour it is, **and how tall it is** |
| A **carved-wood beard** below the chin (§2.6a) on every humanoid | Its tone, from `BEARD_TONES` |
| **Rigid column posture**, arms vertical, 0° abduction (§5.3c) | Which prop the arms hold |
| **Big head**: hat + head = 0.46–0.54 H (§6.1a) | The face's skin tone and the brow shape |
| A **dark boot plinth** at 0.12 H even on barefoot units | Whether it is painted as a bark-net wrap, a caliga lattice or a jackboot |
| Faceted normals, turned-cylinder limbs (§6.3a) | Whether the cylinder is bronze, mail or wool |

**Worked example — `clubman`.** A Neolithic man cannot wear a shako, and the CSV correctly puts him
in a stitched bearskin cap, a hide loincloth and bare feet. The canon requires a tall dark hat mass,
a boot plinth and a beard. The resolution is not a compromise, it is a *reading*: the bearskin cap is
built at 0.22 H — taller than a real cap, exactly as tall as a shako — because a nutcracker's hat is
always oversized; the bare feet are built as the 0.12 H plinth and *painted* as Otzi's bark-net-and-
grass shoe; the loincloth stays a loincloth. Nothing historical was thrown away. The *proportions*
were nutcracker and the *materials* were Neolithic. Do that everywhere.

**Worked example — `vanguard`, the hard one.** A great helm has no face. The face is the nutcracker.
The resolution: the helm's bottom edge stops **0.06 H above the chin line**, exactly as a real great
helm sat over a coif, and **the carved beard hangs out beneath it**. The unit loses its eyes and its
mouth and keeps its beard, which is the larger silhouette carrier of the two. The reference art's
Norse figure does precisely this under a mail coif — look at it. Any unit whose historical headgear
would swallow the beard is built this way.

**Worked example — `priest`.** The CSV wants a shaved head. Shaved is not a silhouette. He gets the
sem-priest's sidelock built as a 0.16 H braided mass over the right ear *plus* a 0.20 H wig block, so
the hat-mass floor is met with a shape that is still historically the right one.

---

## §0a — OWNER RULINGS. THESE OVERRIDE ANYTHING BELOW THEM.

Answered directly by the project owner after this document was drafted. Where a row further down
contradicts one of these, **the ruling wins** and the row is wrong.

1. **`stone_wall` and `stone_gate` are FULLY REPLACED by `fort_wall` / `fort_gate`.** They do not
   persist, are not restyled, and must not render in the Medieval or Enlightenment ages. The draft
   of this document had them surviving as restyled shells in ages 4 and 5 — that reading is
   withdrawn. Six rows in §F carried it and are struck. Practically: whatever the age-up path does
   to a placed wall, the player must never see a Classical-dressed or "obsolete" wall standing in a
   gunpowder-age town. The visual ladder for walls is therefore three rungs, not five:
   **wood → stone (age 3 only) → fortified (ages 4–5).**

2. **The horned helm applies to BOTH `viking` and `vikingboss`.** §I question 3 is closed: the
   reference art wins over the historical record here — this is a nutcracker game, not a museum,
   and the horns are the silhouette that makes a raider read as a raider at 40px. §D already
   specifies them on both; that specification stands and is now confirmed rather than provisional.

## §A — THE SIX AGES AS A PALETTE LADDER

**This is the most important section in the document.** The failure it exists to fix is measurable
today: every age's cap is the same near-black felt, so at gameplay distance a Stone Age army and an
Enlightenment army are the same silhouette in the same colours. The ages must be distinguishable at
**40 pixels, by colour alone, with all silhouette detail gone.**

### A.0 The measurement convention — stated so the tests are reproducible

`ART-DIRECTION.md` quotes "screen value" numbers that are not all from one formula (`grass.lit
#86A63F` is listed at 0.39; Rec.709 on the encoded bytes gives 0.595 and on linearised bytes gives
0.327 — neither matches). That ambiguity cannot be inherited into a pass/fail test. **For this
document only, and for every test in §H:**

```
V(hex) = (0.2126·R + 0.7152·G + 0.0722·B) / 255      // Rec.709 luma on the ENCODED sRGB bytes
ΔE00   = CIEDE2000 between two sRGB colours, D65
```

Every V figure below is computed with that formula. See §I open question 1.

### A.1 The two carriers

Team colour occupies **20–30% of a unit** (§2.5) and it lives on the coat. **The coat therefore
cannot carry the age.** Everything the age ladder is made of must live on non-team surfaces. Two
carriers do the work, and both are tested:

1. **CROWN** — the headwear mass. It is 0.24–0.28 H, the second-largest mass in the figure, and the
   thing you see first from above at an RTS camera. It is the primary carrier.
2. **DOMINANT** — the largest non-team body surface: hide, linen, scale, plate, mail, felt.

Metal, leather and accent are supporting and are *not* required to be six-way distinct — leather is a
deliberate monotonic darkening (an army getting better shod), and gold is a deliberate constant.

### A.2 THE LADDER — one line per age

> **0 · STONE — "Bear-hide and greenstone."** Dark warm brown, zero metal, one grey-green stone accent. `V(crown) 0.287`
> **1 · BRONZE — "Linen and brown-gold."** The pale rung: ivory head, cream linen, warm beaten bronze. `V(crown) 0.812`
> **2 · IRON — "Cold grey and rust."** Temperature flips: cool grey scale and rust-brown recesses under a dark bronze helm. `V(crown) 0.454`
> **3 · CLASSICAL — "Polished steel, brass and marble."** The bright, high-key, polished rung. `V(crown) 0.727`
> **4 · MEDIEVAL — "Matte mail and deep wool."** Desaturated, cool, matte — the least shiny age in the game. `V(crown) 0.417`
> **5 · ENLIGHTENMENT — "Black felt, white lace and gold."** Near-black crown, buff-white legs, gold lace: the highest internal contrast. `V(crown) 0.127`

Crown ladder, measured: **0.287 → 0.812 → 0.454 → 0.727 → 0.417 → 0.127.**
Adjacent |ΔV| = 0.525 / 0.358 / 0.272 / 0.310 / 0.290 — **all ≥ 0.25.**
Worst pairwise ΔE00 across all 15 pairs = **14.5** (Stone/Medieval) — **all ≥ 12.**

Dominant ladder, measured: **0.374 → 0.789 → 0.458 → 0.727 → 0.378 → 0.127.**
Adjacent |ΔV| = 0.415 / 0.330 / 0.268 / 0.349 / 0.252 — **all ≥ 0.25.**
Worst pairwise ΔE00 = **12.8** (Iron/Medieval) — **all ≥ 12.**

Note the two collisions that are resolved by chroma rather than value, because a critic will find
them and must not "fix" them: **Iron (0.454) and Medieval (0.417) sit close in value** — they are
separated by chroma (Iron's crown is warm gold-bronze, C\* ≈ 38; Medieval's is neutral grey,
C\* ≈ 4), and **Stone (0.374) and Medieval (0.378) sit close in value** — separated the same way.
That is why the test in §H is ΔE00 and not ΔV alone.

### A.3 The full per-age palette

Every hex is exact. Every one of these is a **flat colour** unless a pattern is named, because flat
colours are free and patterns are not — see §G.4.

#### AGE 0 — STONE

| Role | Hex | V | Note |
|---|---|---|---|
| `age0.crown` bear-fur cap | `#5A4636` | 0.287 | Otzi's bearskin cap. Hemispherical, stitched panels. |
| `age0.dominant` stitched hide | `#7A5B3C` | 0.374 | Otzi stripe: alternate with `#A88A62` in bands of 0.045 H. |
| `age0.hide.light` | `#A88A62` | 0.581 | The light stripe. Alternating dark/light IS the age's texture read and it costs zero polygons. |
| `age0.metal` — **there is none** | — | — | Nothing metal on any Stone Age unit. This is the age's hardest rule. |
| `age0.stone` polished greenstone | `#5F7355` | 0.426 | Macehead, flint knife blade edge. |
| `age0.flint` | `#4A463E` | 0.276 | Vary per unit across `#4A463E` / `#3A3A38` / `#8A6E3E` / `#B8A882` by `u.id % 4` — the CSV notes flint is grey, black, honey-brown or translucent. |
| `age0.leather` rawhide | `#8C6B45` | 0.436 | Belts, lacing, foot-wraps. |
| `age0.accent` bone / antler | `#C9BBA0` | 0.737 | Never above `#DCD2C0`. |
| `age0.wood` raw ash haft | `#8A6B45` | 0.446 | |

#### AGE 1 — BRONZE

| Role | Hex | V | Note |
|---|---|---|---|
| `age1.crown` boar's-tusk ivory | `#DCCFAA` | 0.812 | **Max channel 220 — at the ceiling.** See §G.6. |
| `age1.dominant` undyed linen | `#D6C9A4` | 0.789 | Off-white and cream. **Never bleached white.** |
| `age1.metal` beaten bronze | `#A87A3A` | 0.499 | Brown-gold. **NOT yellow-gold** (`#CFB53B` is gold and is reserved for the King and for trim), **NOT green patina.** |
| `age1.metal.lit` | `#C29A52` | 0.622 | Collar, shoulder-guard top faces. |
| `age1.leather` light tan | `#9A7A50` | 0.493 | |
| `age1.accent` tusk / ivory | `#D8CDAE` | 0.804 | |
| `age1.faience` blue-green | `#3E8C8A` | 0.489 | Royal and priestly only, **≤ 4% of unit surface.** |

#### AGE 2 — IRON

| Role | Hex | V | Note |
|---|---|---|---|
| `age2.crown` dark bronze helm | `#95712E` | 0.454 | Negau dome (infantry) or tall pointed cone (archer, cavalry, siege crew). |
| `age2.dominant` iron scale | `#6E767E` | 0.458 | Cool grey. The temperature flip off Bronze is the age's whole signal. |
| `age2.metal.lit` grey iron | `#8A9099` | 0.562 | |
| `age2.rust` | `#7A4A32` | 0.323 | **In the recesses only.** Iron rusts brown, never green — that is the separation from Bronze. |
| `age2.leather` dark laced boot | `#5A4630` | 0.285 | Tall, laced, mid-calf. |
| `age2.check.madder` | `#9A4234` | 0.352 | Civilian check/stripe only. |
| `age2.check.weld` | `#B49A3C` | 0.615 | Civilian check/stripe only. |
| `age2.check.woad` | `#3A5A7A` | 0.328 | Civilian check/stripe only, **≤ 5% area** — see the team-hue rule in A.4. |

#### AGE 3 — CLASSICAL

| Role | Hex | V | Note |
|---|---|---|---|
| `age3.crown` polished steel | `#B4BAC2` | 0.727 | Imperial Gallic, Corinthian, cataphract mask. |
| `age3.dominant` bright steel | `#B4BAC2` | 0.727 | Segmentata, scale, mask. Brighter and smoother than any earlier metal. |
| `age3.bronze.bright` | `#C29A4E` | 0.629 | Hoplite bell cuirass and Corinthian helm — deliberately brighter than `age1.metal`. |
| `age3.brass` | `#C9A03C` | 0.633 | Legionary fittings, buckles, boss rosettes. Brass, not gold. |
| `age3.marble` bleached linen | `#DDD4BE` | 0.833 | Priest's kilt, pilos, exomis. **Max channel 221.** |
| `age3.leather` | `#6B4A2E` | 0.310 | Caligae, baldrics, cingulum straps. |
| `age3.crimson` crest / focale | `#A83228` | 0.302 | **HARD CAP: 6% of unit surface.** See A.4. |

#### AGE 4 — MEDIEVAL

| Role | Hex | V | Note |
|---|---|---|---|
| `age4.crown` matte dull steel | `#6E6A62` | 0.417 | Great helm, bascinet, kettle hat, morion. **Matte. No chrome, no gleam streaks.** |
| `age4.dominant` riveted mail | `#5E6258` | 0.378 | Flat, desaturated, reading as heavy dense fabric — not as metal. |
| `age4.mail.lit` | `#767068` | 0.442 | |
| `age4.plate.bright` | `#C2C8CE` | 0.780 | **`knight` only** (and the `pikeman`'s cuirass). Bright plate against matte mail is the material contrast that sells the age. |
| `age4.leather` | `#3A2E24` | 0.188 | |
| `age4.heraldic.white` surcoat | `#D6CBB0` | 0.798 | **Max channel 214.** |
| `age4.lincoln.green` | `#3F5A32` | 0.301 | `crossbowman` accent. |
| `age4.oak` | `#4A3A2A` | 0.240 | Timber, hafts, trebuchet frame. |

#### AGE 5 — ENLIGHTENMENT

| Role | Hex | V | Note |
|---|---|---|---|
| `age5.crown` black felt | `#22201E` | 0.127 | Tricorne, burgonet, jockey cap. **Never `#000000`** (§2.6). |
| `age5.dominant` black felt / blackened steel | `#22201E` | 0.127 | |
| `age5.metal` blued steel | `#3E4650` | 0.271 | Musket barrels, halberd heads, gold-etched bands over it. |
| `age5.gunbronze` | `#8A6A3A` | 0.446 | Cannon and culverin barrels — warm amber-brown, patinating toward `#6E7250`. **Not toy-gold, not rust-brown.** The most common cannon error in games. |
| `age5.gunbronze.patina` | `#6E7250` | 0.436 | The olive shoulder of the same barrel. |
| `age5.buff` breeches / stockings | `#D8CFB8` | 0.813 | **Max channel 216 — the ceiling.** |
| `age5.gold` lace | `#CFB53B` | 0.697 | The one hex shared with `nc.gold` (§2.6). |
| `age5.rifle.green` | `#3A5233` | 0.276 | `skirmisher` base coat. |
| `age5.leather` | `#221E1A` | 0.120 | |

### A.4 The team-hue exclusion — a rule that will bite

Team hues are Blue `#2E5FD8` (h ≈ 222°) and Red `#D62B2B` (h ≈ 0°).

> **No age's DOMINANT or CROWN may sit within 25° of either team hue at chroma C\* > 20.**

Two colours in this document sit inside that window and are therefore area-capped rather than
banned, because both are historically load-bearing:

- `age3.crimson #A83228` (h ≈ 7°) — the Roman crest and focale, the hoplite crest, the cataphract
  tabard band. **Capped at 6% of unit surface.** A red-team legionary must not read as one colour.
- `age2.check.woad #3A5A7A` (h ≈ 207°) — Iron Age civilian textile. **Capped at 5%, villagers only.**

`age5.metal #3E4650` sits at h ≈ 215° but at C\* ≈ 7 it is grey, not blue, and is exempt.

---

## §B — UNITS, PER CLASS

**How to read the geometry.** All dimensions are fractions of **H**, the figure height sole-to-hat-
crown, `H = 3.90` for a foot unit (§5.3). Mounted riders use the same H for the rider; the horse adds
below. Primitives are the codebase's own: `box(w,h,d)`, `cone(r,h,seg)`, `cyl(rTop,rBot,h,seg)`.
Segment counts follow §6.3a — **12 minimum on anything read as turned, 16 preferred.**

**Every row inherits these, and they are not repeated per row:**

- **Hat + head together 0.46–0.54 H** (§6.1a); the hat's own height follows §6.5a's ABSOLUTE ratio target for that age's form — see `ART-DIRECTION.md` §6.5b. Head 0.22–0.26 H. Torso 0.26–0.30 H. Legs+boots
  0.22–0.26 H. `headWidth / torsoWidth` = 1.00–1.15 (§6.1a).
- Carved-wood beard from `BEARD_TONES` (§2.6a), selected `u.id % BEARD_TONES.length`, hanging
  0.10 H below the chin, `topW = 0.90 × headWidth`, `bottomW = 1.15 × headWidth`.
- Rosy cheeks `#D9584E`, bared teeth `#FFFFFF` over mouth `#1A1210`, heavy dark brows, wood grain
  at ±6 values on all large flat areas (§6.3b).
- Boots: a dark plinth, `0.09 H × 0.11 H × 0.12 H`, wider than the shins.
- **Exactly two silhouette events on the body** (§6.3): the brim/crown notch and the epaulette or
  shoulder-guard overhang. **A held prop is not a silhouette event** and is budgeted separately:
  **at most one long prop plus one hip prop per unit.**
- Team colour 20–30% of surface, on the coat/tunic field (§6.6).
- Any band, stripe or trim is **≥ 0.075 H** (3px at 40px) or it aliases into mud (§5.2).

### B.1 Primary melee line

| id | age | headwear (geometry + hex) | body / leg / foot | signature prop | THE 40px CUE |
|---|---|---|---|---|---|
| `clubman` | 0 Stone | Bear-hide cap: `cyl(0.19,0.21,0.22,8)` `#5A4636` capped by `cone(0.19,0.06,8)`; 6–8 sided dome, no horns, no skulls. TC hide brow band `cyl(h 0.035)`. Chin strap `box(0.012,0.10,0.012)` `#8C6B45`. | Bare torso: painted wood, `SKIN_TONES[u.id%4]`, wood-grain striation. Hide loincloth of stitched strips `box(0.26,0.14,0.24)` `#7A5B3C`/`#A88A62` alternating. Calfskin belt `cyl(h 0.04)` `#8C6B45` + tool pouch `box(0.05,0.06,0.04)`. Plinth painted as bark-net shoe `#7A5B3C` laced `#8C6B45`. | War club: haft `cyl(0.018,0.018,0.60,8)` `#8A6B45` protruding **both** ends; pierced greenstone head `cyl(0.075,0.075,0.11,8)` scaled z 0.80 `#5F7355` — **3× the current stick tip**. Flint knife `box(0.02,0.07,0.008)` at belt. No shield. | **The greenstone lump.** The only grey-green prop in the game. It must ride **above the shoulder line** in idle so it silhouettes against sky, not against grass. |
| `shortsword` | 1 Bronze | Boar's-tusk helmet: `cone(0.21,0.26,12)` `#DCCFAA`; **four** tusk courses as `cyl(h 0.045,14)` rings, adjacent rings rotated ±8° in Y, alternating `#D8CDAE` / `#C6B894`. Hinged cheek pieces `box(0.03,0.10,0.07)` `#8C6B45`. Leather neck flap `box(0.16,0.09,0.02)` rot x −0.4. TC chin + brow band. | Dendra panoply: capsule `cyl(0.135,0.150,0.26,12)` `#A87A3A`; deep collar `cyl(h 0.045)` `#C29A52`; **stacked boxy** shoulder guards, 2 per side, `box(0.075,0.045,0.075)` stepped out 0.012 each; **three** thigh-band rings `cyl(h 0.028)`. TC wool at neck and below the bands. Open greaves `cyl(0.055,0.065,0.12,10)` `#A87A3A`. Sandals `#9A7A50`. | Naue II sword: blade `box(0.035,0.17,0.010)` `#C29A52`, **no crossguard** — flanged hilt `box(0.022,0.05,0.014)` flows straight into the blade; half-moon pommel `cyl(0.026,0.026,0.014,6)`; 5 rivet dots. Bronze dagger at hip. **No shield.** | **Pale ribbed cone over a warm brown-gold barrel.** The only pale-head / warm-body unit in the game. |
| `broadsword` | 2 Iron | Negau helmet: dome `cyl(0.14,0.20,0.15,12)` `#95712E`; fore-aft medial keel `box(0.022,0.045,0.42)`; **flat right-angle brim** disc `cyl(0.28,0.28,0.012,16)` all the way round. Open face, no cheek pieces. TC cord tied at the ridge. | Lamellar corslet: **four** stacked courses `box(0.24,0.038,0.22)` `#6E767E`, each inset 0.008, with `#7A4A32` rust in the 0.006 recess line. Torso only — arms and legs free. Knee-length TC tunic `cyl(0.150,0.170,0.14,12)` + TC waist sash `cyl(h 0.035)`. Tall laced boots `#5A4630`, lacing `#8C6B45`. | Hallstatt/La Tène iron sword: blade `box(0.045,0.21,0.012)` `#8A9099` — **visibly wider AND longer** than `shortsword`'s. Iron scabbard on a hip strap. Round Italic parma `cyl(0.16,0.16,0.02,12)`, TC face, iron boss `cyl(0.04,0.05,0.03,8)`. | **The hard horizontal brim line** — a flat dark disc cutting straight across the head. Unique in the set. |
| `legionaire` | 3 Classical | Imperial Gallic: bowl `cyl(0.15,0.19,0.14,14)` `#B4BAC2`; flared neck guard `box(0.26,0.02,0.10)` rot x −0.5; hinged cheeks `box(0.028,0.09,0.06)`; brass brow band `cyl(h 0.02)` `#C9A03C` with **3** boss rosettes and embossed eyebrow motifs in texture. TC transverse crest `box(0.024,0.075,0.24)`. | Lorica segmentata: **seven** girdle bands `cyl(0.145,0.148,0.026,12)` `#B4BAC2`, each separated by a 0.006 dark gap; 3 layered shoulder guards per side; brass buckles and lobate hinges `#C9A03C`. TC tunic at sleeve and hem; TC focale ring `cyl(h 0.025)` at the throat. Cingulum apron: **four** straps `box(0.016,0.11,0.008)` `#6B4A2E` with `#C9A03C` studs. Caligae as an **open lattice**, not closed shoes. | Scutum: curved rectangle — a 3-segment `cyl` shell arc, `0.20 × 0.30 × 0.018` — TC face, thunderbolt-and-wing blazon in `#C9A03C` (texture, never geometry), boss `cyl(0.045,0.045,0.03,8)`. Pompeii gladius: blade `box(0.038,0.13,0.010)`, **parallel edges, no waist**, short triangular tip. Pugio on the opposite hip. | **Seven light horizontal lines with dark gaps on a bright silver torso.** The only striped-metal torso in the game. |
| `vanguard` | 4 Medieval | **Great helm**: flat-topped barrel `cyl(0.185,0.20,0.24,12)` `#6E6A62`, matte. **ONE** vision slit `box(0.22,0.014,0.004)` `#1A1210` and a cross of breath holes on the right side. **No face.** Mail coif under it, `cyl(0.17,0.175,0.05,12)` `#5E6258`, so the neck reads thick. Helm bottom edge stops **0.06 H above the chin — the beard hangs out beneath it** (see §0). TC torse at the crown. | Mail hauberk `cyl(0.155,0.160,0.24,12)` `#5E6258`, **matte** — must not receive the `metal` pattern's gleam streaks. White sleeveless surcoat `box(0.20,0.22,0.16)` `#D6CBB0` with a red cross pattée `#A83228` (arms 0.075 H wide, ≤ 4% area) and a broad TC quartering. Mail chausses `#5E6258`, boots `#3A2E24`, prick spurs. | Greatsword: blade `box(0.030,0.36,0.010)` `#767068`; long unsharpened ricasso `box(0.026,0.07,0.012)` wrapped `#3A2E24`; **parierhaken** lugs `box(0.05,0.012,0.012)` above it; straight quillons `box(0.12,0.014,0.014)`; wheel pommel `cyl(0.026,0.026,0.016,8)`. **No shield.** | **The featureless blank face.** One bright slit on a dead matte head. The strongest head silhouette in the game and the only unit with no eyes. |
| `musketeer` | 5 Enlight. | Tricorne: crown `cyl(0.15,0.17,0.14,12)` `#22201E`; brim as **three** cocked panels `box(0.24,0.016,0.09)` at 120°, each rot x +0.35 so all three points read; `#CFB53B` lace edge strip 0.010 thick. TC cockade `cyl(0.035,0.035,0.012,8)` at the **left** cock. White feather `cone(0.012,0.07,4)` `#D8CFB8`. Crisp and upright. | Soubreveste over a doublet: TC field `box(0.21,0.20,0.17)` carrying a white-silver cross `#D8CFB8`, **arms 0.075 H wide**, front, back and both sleeves; gold fleur-de-lis `#CFB53B` at each of the four arm-ends; red flame burst `#A83228` at the centre. Gold braid edging 0.012. Knee breeches + white stockings `#D8CFB8`. Buckled shoes `#221E1A` with `#CFB53B` buckles. Leather baldric `box(0.024,0.30,0.010)` diagonal, `#6B4A2E`. | Charleville flintlock: stock `box(0.026,0.30,0.030)` `#6B4A2E`; barrel `cyl(0.010,0.010,0.34,8)` `#3E4650`; **three** barrel bands `cyl(h 0.012)` `#8A9099`. Socket bayonet at the belt, cartridge box on a crossbelt. Upright drill stance. | **The white cross on the coat.** A three-pixel-wide light cross on a saturated team field, held dead vertical. |

### B.2 Primary anti-cavalry line

| id | age | headwear | body / leg / foot | signature prop | THE 40px CUE |
|---|---|---|---|---|---|
| `spearman` | 0 Stone | **Flat-topped** hide skullcap `cyl(0.20,0.21,0.20,10)` `#5A4636`, **no chin strap** — deliberately a flat cylinder against `clubman`'s dome so the two Stone Age melee units separate at zoom. TC hide brow band. | Bare torso, painted wood. **One** hide shoulder strap `box(0.045,0.24,0.012)` crossing the chest at 28° — the separator from `clubman`. TC hide loincloth. Grass-and-bark foot wraps as the plinth `#8C6B45`. | Fire-hardened spear: shaft `cyl(0.013,0.017,0.62,8)` `#8A6B45`, **thickest through the forward third**, tip charred `#3A2E22` over `#4A463E`. **No metal anywhere on this unit.** Spare javelin slung on the back. No shield. | **Flat-top head + one diagonal chest strap.** The only diagonal on any Stone Age unit. |
| `spearfighter` | 1 Bronze | Boar's-tusk helmet as `shortsword` but with a **plain leather neck flap and NO cheek pieces** — that absence is how the two Bronze units read apart. TC chin + brow band. | Lighter Dendra: collar + capsule `cyl(0.135,0.150,0.26,12)` `#A87A3A`; **single-piece** shoulder guards `box(0.085,0.038,0.080)` (not stacked); **two** thigh-band rings. TC tunic at neck and hem. Open greaves. | Bronze thrusting spear: ash shaft `cyl(0.013,0.013,0.72,8)` `#8A6B45` — **clearly longer than the Stone spear**; small socketed leaf head `cone(0.022,0.075,6)` `#A87A3A` (do NOT inflate it) **plus a sauroter butt-spike** `cone(0.016,0.05,6)` at the rear. Bronze dagger at hip. No shield. | **Metal glinting at BOTH ends of the shaft.** Period-correct and unique. |
| `impspear` | 2 Iron | Negau helmet matching `broadsword`, plus a **short TC horsehair tuft** `box(0.05,0.09,0.14)` seated in the medial ridge — the tuft is the anti-cav line marker. | Iron scale corslet `#6E767E` over a knee-length TC tunic with a **fringed hem** (`box(0.014,0.035,0.010)` × 12 around the hem). Wide TC waist sash `cyl(h 0.04)`. Tall laced boots `#5A4630`. | Iron spear: shaft `cyl(0.013,0.013,0.75,8)`, head `cone(0.018,0.09,6)` `#8A9099` — **longer and narrower** than the bronze; dark iron butt-cap. **Round parma shield**, TC face, iron boss — the Bronze tier has no shield, **so the shield IS the visible upgrade.** | **Brimmed helm with a tuft + a round shield.** The tuft is what splits it from `broadsword` at the same distance. |
| `hoplite` | 3 Classical | **Corinthian helmet**: one hammered piece `cyl(0.175,0.20,0.26,14)` `#C29A4E` covering the entire head and face; only **eye slits** `box(0.045,0.020,0.006)` ×2 and a narrow nose bar `box(0.018,0.10,0.012)`. Tall TC-dyed horsehair crest in a crest box `box(0.030,0.10,0.30)`; TC band at the rim. | **Bronze bell cuirass**: `cyl(0.130,0.165,0.24,14)` `#C29A4E` — flaring OUTWARD at the waist into a bell skirt, with stylized abstract musculature in texture. TC exomis beneath, showing at the shoulder and as a short skirt. Greaves **sprung** onto the calves, no straps. Sandals or bare feet on the plinth. | **Aspis**: deeply dished round shield `cyl(0.24,0.24,0.03,16)` with the face bowed — **> 0.90 m scale, the biggest round shield in the game** — wood core `#8A6B45`, bronze rim ring `cyl(h 0.012)` `#C29A4E`, TC face with **one bold blazon**. Doru: shaft `cyl(0.013,0.013,0.62,8)`, iron leaf head, bronze sauroter. Xiphos or kopis on a baldric under the left arm. | **The full-face blank + the huge dished disc.** Two blanks at once — enormously readable at low poly. Lean on it. |
| `pikeman` | 4 Medieval | **Morion**: skull `cyl(0.155,0.19,0.17,14)` `#C2C8CE` rising to a point at **both** front and back; tall fore-aft comb `box(0.024,0.075,0.32)`; narrow brim `cyl(0.26,0.26,0.014,16)` turned up into a peak at each end. **Always open-faced** — a morion cannot close. TC plume socket at the side + TC band. | Steel cuirass (breast + back) `cyl(0.140,0.155,0.20,14)` `#C2C8CE` over a heavy padded TC gambeson whose sleeves and skirt show below. **Tassets**: overlapping plate thigh flaps `box(0.075,0.055,0.030)` ×2 per side hanging from the fauld. TC sash at the waist. High boots to the knee `#3A2E24`. | Pike: plain ash shaft `cyl(0.010,0.012,1.40,8)` `#8A6B45` — **the longest prop in the game**; small steel head `cone(0.014,0.055,6)`; brass langets `box(0.010,0.10,0.010)` running down below the head; TC-and-gold tassel at the join. Sword at hip. | **The pike itself** — a vertical line 1.4 H tall. At 40px it is the only unit whose prop is taller than the figure. |
| `halberdier` | 5 Enlight. | **Burgonet with a falling buffe**: comb `box(0.022,0.070,0.30)` over the crown; peak over the brow `box(0.22,0.014,0.075)` rot x −0.3; hinged cheek pieces; **face plate closing the front** `box(0.15,0.11,0.012)`. Blackened steel `#22201E` with heavy `#CFB53B` etched bands 0.012 thick. TC plume at the comb. (This — not a morion — is the historically real way to get the closed face.) | **Brigandine**: TC velvet shell `box(0.21,0.20,0.17)` with a dense grid of gold rivet heads — texture, **2 texels minimum**, never geometry — in tight rows, `#CFB53B` lace edging. Steel pauldrons `box(0.075,0.040,0.075)` `#3E4650` with gold etching. Slashed-and-puffed sleeves in TC + gold. Knee breeches, stockings `#D8CFB8`, buckled shoes `#221E1A`. | Halberd: shaft `cyl(0.012,0.014,0.62,8)`; **broad axe blade** `box(0.008,0.13,0.11)` one side; straight thrusting spike `cone(0.016,0.10,6)` continuing the shaft line at the top; **rear fluke/beak** `box(0.008,0.05,0.06)` opposite the blade. Blued `#3E4650` with gold etching, brass langets, TC-and-gold tassel. No shield. | **The asymmetric axe head silhouetted at 0.62 H up the shaft** — blade one side, beak the other. Nothing else in the game has that profile. |

### B.3 Primary ranged line

| id | age | headwear | body / leg / foot | signature prop | THE 40px CUE |
|---|---|---|---|---|---|
| `slinger` | 0 Stone | Low hide skullcap `cyl(0.185,0.195,0.20,10)` `#5A4636` with a TC leather headband. **The CSV says "or bare-headed" — bare-headed is FORBIDDEN** (§0 hat floor). The cap is held to the 0.20 H floor and no higher, so the sling's arc owns the silhouette. Coiled sling cord `cyl(0.20,0.20,0.02,12)` `#8C6B45` wrapped round the crown to make up mass. | Bare torso, painted wood. TC hide loincloth. **Leather ammo pouch** `box(0.09,0.10,0.06)` `#8C6B45` slung across the body on a 0.030-wide strap — **the pouch is the unit's read when idle.** Bare feet on the plinth. | Sling: **TWO** long braided cords `cyl(0.006,0.006,0.30,5)` `#C9BBA0`, one ending in a wrist loop, the other in a release tab, meeting at a small **diamond** leather pouch `box(0.05,0.06,0.012)`. **It must NOT be a Y-frame slingshot** — that is a 19th-century AD invention and the single most common error in this weapon. River stones `#8A8078` in the belt pouch. | **The low flat head plus the hanging pouch bulge at hip height.** The lowest hat in the game — that is the cue. |
| `archer` | 1 Bronze | Leather cap: close-fitting `cyl(0.19,0.205,0.21,12)` `#8C6B45`, stitched panels, short neck flap `box(0.15,0.06,0.02)`; TC brow band. **White cloth headband** `cyl(h 0.030)` `#D6C9A4` over the cap as the accent. Black tight-curled hair beneath, `HAIR_TONES[0]`. | Bare torso, painted wood. Wrapped **linen kilt** over a woven belt: `#D6C9A4` natural cream with a **TC geometric centre flap** `box(0.075,0.14,0.012)` and TC hem band — the flap is where team colour lives. Skin-and-wool mantle over **one** shoulder `box(0.10,0.13,0.030)` `#7A5B3C`. Small leather bracer `cyl(h 0.045)` on the LEFT forearm. Bead collar `cyl(h 0.025)` `#3E8C8A`. Barefoot plinth. | Self bow `cyl(0.008,0.008,0.34,6)` `#8A6B45`, plain wood, **double-curved decurved tips**. Tapered capped quiver tube `cyl(0.035,0.045,0.20,8)` `#8C6B45` on the back, fletching showing. **Bundle of spare arrows held in the off hand** for idle. Bronze dagger. | **The cream kilt with a single TC vertical flap down the middle.** The only unit whose team colour is a narrow vertical stripe. |
| `imparcher` | 2 Iron | **Tall pointed bronze conical helmet**: smooth `cone(0.185,0.30,12)` `#95712E`; short neck flap; TC-dyed plume `cone(0.020,0.11,5)` at the tip; TC band at the rim. This hard pointed cone is the Assyrian signature and separates the tier from Bronze's leather cap instantly. | Knee-length TC tunic with a **heavy fringed hem** and a wide TC waist sash. Iron scale corslet `#6E767E` over **chest and back ONLY** — limbs completely free. Tall laced boots `#5A4630` to mid-calf. **Cool grey iron scale under a warm bronze helm — two metals on one unit, and it costs nothing.** | Angular composite bow: limbs meet in a **shallow V** `box(0.008,0.16,0.010)` ×2 at ±26°, with **reflexed tips** `cyl` curving back — distinct from a smooth C-curve. Back quiver, second bow case at the hip. Iron dagger. No shield. | **The tall smooth cone.** The sharpest point on any head in the game — a triangle, not a dome. |
| `comparcher` | 3 Classical | **Pilos**: brimless conical **FELT** cap `cone(0.175,0.22,12)` `#DDD4BE` (or TC-dyed), **leaning forward 0.12 rad**, soft-looking. Kept soft and brimless so it contrasts against Iron's hard metal cone. | **Exomis**: short tunic with the **RIGHT shoulder seam unpinned** — build it as an asymmetric `box(0.20,0.19,0.16)` with the right shoulder cut back 0.055. TC linen or crimson wool (crimson ≤ 6%), belted, hem at mid-thigh. **No armour at all** — mobility is the read. Bare legs, light sandals. | Composite bow `cyl(0.008,0.008,0.30,6)` with deep recurve, wood core / horn belly / sinew back read as three tone bands `#8A6B45` / `#C9BBA0` / `#DDD4BE`. Small round shield `cyl(0.115,0.115,0.02,12)` **SLUNG at the hip or on the back, not carried in hand**, TC face. Light axe or xiphos. Hip quiver. | **The asymmetric shoulder** — one square shoulder, one cut away. The only broken-symmetry torso in the game. |
| `crossbowman` | 4 Medieval | **Chaperon hood** in Lincoln green `#3F5A32`: hood `cone(0.20,0.24,10)` rot x −0.18 with a **long liripipe tail** `cyl(0.028,0.018,0.34,6)` hanging down the back, over a small TC coif. The pointed hood plus trailing tail does the Robin Hood job better than a hat. | Green wool cotehardie `#3F5A32` to mid-thigh over a **TC gambeson body** — put TC in a bold quartering so the team read survives the green. TC belt with a hanging pouch. Hose in a contrasting `#6B5A42`. Ankle turnshoes `#3A2E24`. Short green shoulder mantle. | Steel-prod crossbow: stock `box(0.030,0.026,0.24)` `#4A3A2A`, prod `box(0.26,0.010,0.014)` `#767068`, **foot STIRRUP** `cyl(0.030,0.030,0.010,8)` at the muzzle, **goat's-foot lever** hooked on the belt. **Boxy belt-mounted bolt quiver** `box(0.07,0.08,0.05)` — **NOT a long back quiver.** Falchion at hip. | **The liripipe tail** — a hanging line off the back of the head. The only trailing element on any head. |
| `skirmisher` | 5 Enlight. | **Cut-down tricorne** as the hero read: crown `cyl(0.15,0.17,0.13,12)` `#22201E`, brim panels **0.06 deep** (vs `musketeer`'s 0.09) and cocked **less crisply** — rot x +0.18, not +0.35 — plus a TC plume `cone(0.014,0.09,5)`. Vary by `u.id % 3` between the cut-down tricorne, a jockey cap `cyl(0.185,0.195,0.16,12)` with a `box` peak, and a Scotch bonnet `cyl(0.21,0.21,0.11,14)`. **Irregularity is the accurate look.** | **Short** green coat / sleeved waistcoat `box(0.20,0.16,0.16)` `#3A5233`, double-breasted, white-metal buttons `#B4BAC2`, cut close. **GREEN as the base with TC on facings, cuffs, collar and a TC sash — the exact inverse of `musketeer`, whose whole torso is TC.** Green leggings buttoned up the outside; moccasins `#6B4A2E`. Blanket roll `cyl(0.045,0.045,0.18,8)` across the back. | Short flintlock — barrel `cyl(0.010,0.010,0.26,8)`, **shorter than `musketeer`'s 0.34**. Tomahawk `box(0.008,0.06,0.055)` at the belt, scalping knife, powder horn under the **RIGHT** arm `cyl(0.022,0.035,0.11,8)` `#C9BBA0`, bullet bag at the waist. No bayonet. **Pose low and half-crouched** against the musketeer's upright drill. | **Green torso with TC only at the edges** — the colour inverse of the musketeer, read at the same distance. |

### B.4 Cavalry lines

Riders follow every rule above. Horses are specified once, per age, because the horse is half the
silhouette.

**HORSE, common.** Rebuild per the CSV: deeper chest, defined croup, real neck crest, 8-sided leg
tapers, mane and tail as flat alpha cards or low-poly strips. Scale to a **modern 15–16 hand riding
horse** — it reads big and heroic next to the historical 12–13 hand pony and stays defensible.
Coat varies by `u.id % 4` across `#6B4A2E` / `#4A3A2A` / `#8A7058` / `#3A322A`.
**No stirrups before age 4.** They are a Chinese invention c. 302 AD reaching Europe in the 7th–8th c.

| id | age | headwear | body / leg / foot | mount + prop | THE 40px CUE |
|---|---|---|---|---|---|
| `scout` | 1 Bronze | Simple low leather cap `cyl(0.185,0.195,0.20,12)` `#8C6B45`, close-fitting, stitched, TC band. **Nothing metal anywhere on the head.** | Sleeveless leather jerkin `box(0.19,0.17,0.15)` `#8C6B45` over a short TC tunic. Bare arms. Short leather boots. **Everything trimmed close — no hanging cloth.** Speed reads from the outline alone. | Light javelin `cyl(0.011,0.013,0.46,8)` with a small bronze tip. Hide water skin, small pack. No shield, no armour. **HORSE: bareback or a folded cloth pad — no saddle tree, NO STIRRUPS.** Rope halter, simple bit. | **A bare-armed rider on a bare-backed horse.** The only unit in the game with no armour and no saddle. |
| `chariot` | 1 Bronze | **Both crewmen deliberately low-profile so the chariot owns the silhouette.** Linen headband `cyl(h 0.030)` `#D6C9A4` with a TC band, or a short striped cloth head covering `box(0.19,0.10,0.19)` `#D6C9A4`/`#A87A3A`; bare-headed with a black wig `HAIR_TONES[0]` is equally correct. **No hat mass floor on this unit — the vehicle carries the read.** | Crew: pleated natural-linen kilt `#D6C9A4` over a TC sash, bare torso in painted wood with a broad beaded collar `cyl(h 0.035)` `#3E8C8A`, leather cross-straps on the archer for the quiver rig. Sandals or bare feet. **Deliberately UNARMOURED** — the light chariot is a speed platform. | Two-horse light chariot. **SIX-SPOKE wheels** `cyl(0.22,0.22,0.030,12)` with six `box(0.010,0.20,0.010)` spokes. **Axle at the EXTREME REAR of the cab** — the diagnostic Egyptian trait; it widens the stance and reads fast. D-shaped open cab of bent-wood frame `#8A6B45` with stretched **WOVEN-LEATHER MESH** sides `#9A7A50` (texture, a real mesh weave) and a woven strip floor; **no seat, both crew stand.** Central draft pole curving up to a yoke bar across both horses' necks. **Two crossed leather quiver cases mounted OUTSIDE the cab** in TC. Crew of two: driver with reins, archer with a composite bow. TC on cab panel, quiver cases and horse plumes. | **The rear-set axle.** The wheels sit behind the crew, not under them — the only vehicle in the game whose axle is not centred. |
| `heavycav` | 2 Iron | Tall pointed bronze conical helmet `cone(0.185,0.28,12)` `#95712E` with a short neck guard and hinged flaps. TC plume at the apex, TC band at the rim. | Iron scale corslet `#6E767E` over a knee-length TC tunic with a fringed hem; wide TC sash; tall laced boots. **TORSO ARMOUR ONLY** — arms and legs bare or cloth-covered. Trim, banded, angular; nothing hangs loose. | Long lance held **OVERHAND** (no stirrups ⇒ no couched charge) `cyl(0.012,0.012,0.80,8)`. Composite bow + hip quiver. Akinakes at the belt. **HORSE: completely UNARMOURED** — saddle CLOTH only, fringed and TC-patterned, bridle with bronze bosses, forehead plume. **This is the critical contrast against `cataphract`.** | **Overhand lance grip on an unarmoured horse.** The arm is above the shoulder — the only raised arm permitted, and it is why this unit is legible. |
| `cataphract` | 3 Classical | **Full face-covering mask**: smooth `cyl(0.175,0.185,0.24,14)` `#B4BAC2` with narrow eye slits `box(0.05,0.016,0.006)` and a nose ridge; mail aventail `cyl(0.19,0.23,0.07,14)` `#5E6258` to the shoulders. **Blank and inhuman — that is the entire point.** TC crest at the crown, TC edging on the aventail. | **Head-to-ankle scale**: torso, **ARMS AND LEGS**, uniformly geometric — no exposed cloth or skin anywhere. Build the scale as 6 stacked `cyl(h 0.032,14)` courses on the torso and 3 per limb, `#B4BAC2` with `#6E767E` in the recess. TC tabard band across the chest + TC sash. Scale boots. | Kontos `cyl(0.013,0.013,1.05,8)` gripped **TWO-HANDED, so NO SHIELD.** A strap runs from the horse's harness to the rider. Sword and mace at the belt. **HORSE: SECTIONAL scale barding** — four distinct panels (chamfron, neck, chest, flanks), **not one continuous suit** — TC caparison edging, TC plume on the chamfron. | **Rider and horse both uniformly scaled, face blank.** The most alien silhouette in the game. Nothing shows skin. |
| `elitescout` | 4 Medieval | Open-faced **kettle hat**: wide-brimmed war hat, skull `cyl(0.165,0.185,0.15,12)` `#6E6A62` + brim `cyl(0.28,0.28,0.014,16)` sloping down 0.10 rad, over a mail coif. **Open face**, so it reads clearly apart from `knight`'s closed visor. TC brim band, small TC pennon at the crown. | Mail haubergeon to mid-thigh — **shorter and lighter than `vanguard`'s hauberk** — `#5E6258` matte, over a TC quilted gambeson whose sleeves and skirt show. Short TC surcoat with side slits. Riding boots, prick spurs. **Deliberately NO plate anywhere on this unit.** | Light lance `cyl(0.010,0.010,0.72,8)` with a **TC pennon** `box(0.001,0.075,0.16)` — **the pennon is the unit's read at distance.** Sword at hip, small heater shield in TC. **HORSE: no caparison, plain leather harness, TC saddle cloth only. Lighter and leggier than `knight`'s.** | **The pennon streaming off the lance tip.** A small TC flag well above the head — the only flag on a unit. |
| `knight` | 4 Medieval | **Bascinet with a hounskull visor**: skull `cyl(0.155,0.185,0.17,14)` `#C2C8CE` + a **pointed snout** `cone(0.10,0.13,8)` rot x 1.4 projecting forward 0.09; mail aventail over the shoulders. The snout gives a sharper, more aggressive read than `vanguard`'s flat helm, so the two medieval heavies stay distinct. TC crest, TC aventail border. | Full plate harness: cuirass `cyl(0.140,0.155,0.20,14)` `#C2C8CE`, fauld + tassets, pauldrons, articulated arm and leg harness, sabatons. **Bright polished steel — brighter and smoother than any earlier armour in the game.** TC jupon fitted over the breastplate, TC belt. **Matte grey mail voiders `#5E6258` showing at armpits and groin** — that matte/bright contrast is what sells the material. | Couched lance `cyl(0.012,0.012,0.90,8)` with a **vamplate** `cone(0.055,0.075,10)` hand-guard, painted in a TC-and-heraldic spiral. Arming sword + rondel dagger. Small heater shield, TC, **one bold charge**. **HORSE: full heraldic caparison in TC to the fetlocks, steel chamfron, TC plume. Biggest, heaviest mount in the game.** | **The pointed snout + the fully skirted horse.** The horse's outline becomes a TC trapezoid — the only mount whose legs are hidden. |
| `dragoon` | 5 Enlight. | Tricorne `#22201E` with TC cockade and `#CFB53B` lace edging, over a **queued wig** `cyl(0.19,0.20,0.09,12)` `#B8B0A0` with a queue `cyl(0.022,0.016,0.13,6)` down the back. (Late alternative, 1762+ only: crested brass helmet with fur turban and horsehair mane. Do not use it for anything earlier.) | Long-skirted TC coat `box(0.21,0.24,0.17)` with contrasting facings on cuffs and lapels, gold buttons **in pairs**; TC waistcoat; buff leather breeches `#C9B48A`. **HEAVY THIGH-HIGH BLACK RIDING BOOTS** `cyl(0.075,0.085,0.26,10)` `#221E1A` with spurs — **the single clearest mounted-infantry tell against `musketeer`'s buckled shoes.** White crossbelts `#D8CFB8` over the chest. | Short carbine on a shoulder-belt swivel `cyl(0.009,0.009,0.22,8)`. Straight sword at hip, pistols in pommel holsters. **HORSE: military saddle with pommel holsters, valise at the cantle, TC shabraque with gold lace edging. NO barding — this age's cavalry is fast and unarmoured.** | **Thigh-high black boots on a bare horse.** The dark column from knee to hip is unique in the mounted set. |

### B.5 Siege

Siege engines are **vehicles with crew**, not nutcrackers. Crew figures follow every unit rule and
**must match their age's infantry exactly** so the age reads as one army. Engine dimensions are given
as multiples of a foot unit's `H = 3.90`.

| id | age | crew head | crew body | the engine | THE 40px CUE |
|---|---|---|---|---|---|
| `batteringram` | 2 Iron | Tall pointed bronze conical helmets `#95712E` with TC plumes — **including the archer in the turret**. | Knee-length fringed TC tunics, iron scale corslets `#6E767E` torso-only, tall laced boots `#5A4630`. | **Six-wheeled** timber housing, 1.15 H tall, domed/pitched roof, clad in **TAN BASKET-WEAVE WICKER** `#B49A62` — the woven texture is the entire material read, give it a proper tiling pattern, never flat planks — with greyish hide `#8A8078` over the frame. Open turret rising **0.75 H above the roof** with an archer inside. A 1.3 H ram beam **HANGING ON ROPES** from the roof frame, swinging pendulum-style, **not pushed rigid**. Head is a metal-plated **CHISEL/BLADE** for prying mudbrick courses — **not a blunt knob, not a ram's-head casting.** TC on roof banner, turret shield panel and hide side-curtains. | **The turret above the roofline with a head in it.** The only siege engine with a second storey. |
| `catapult` | 2 Iron | As `batteringram`, so the siege tier reads as one set. | As `batteringram`. | Two-armed torsion stone-thrower. Heavy tan-brown weathered timber A-frame `#7A6242`, **TWO VERTICAL SPRING FRAMES** each holding a thick bundle of off-white twisted sinew rope `cyl(0.09,0.09,0.30,10)` `#C9BBA0` — **give those bundles real geometry, the twisted rope IS the visual identity of a torsion engine.** Two arms swinging inward to a central bowstring; long stock/slider with winch and pawl at the rear; stone ball `#8A8078` in the cradle. Iron fittings `#3A3A38`. TC on painted frame panels + rear banner. | **Two pale vertical rope drums** flanking the stock. Nothing else in the game has a pair of light cylinders standing upright. |
| `trebuchet` | 4 Medieval | Chaperon hoods in TC wool; the master carpenter in a coif and flat cap. | TC wool tunics to the knee, hose, leather aprons `#6B4A2E`, turnshoes. **Engineers and carpenters, not soldiers** — no armour, no helmets. | Counterweight trebuchet. Tall stout timber A-frame `#4A3A2A` weathered grey-brown with **dark iron-strapped joints** `#3A3A38`. Beam **3.8 H** pivoting on a high axle; short end carries a large **iron-banded COUNTERWEIGHT BOX**, hinged so it swings, `box(0.5H,0.5H,0.5H)`; long end carries a hemp sling with a fixed release hook. Winch, rope and pawl at the base, ladder up the frame. TC on frame panels, counterweight face and the A-frame banner. **Not a traction trebuchet — no fan of pull-ropes, no hauling crew.** | **The hinged weight box high on the short arm.** A dark cube in the sky at the top of an A-frame. |
| `cannon` | 5 Enlight. | Tricorne `#22201E` with TC cockade; gunner in a leather apron `#6B4A2E`. | TC coat with contrasting facings, waistcoat, knee breeches, **black** campaign gaiters `#221E1A` buttoned up the outside. (White gaiters are parade dress; black hid dirt in the field.) | Gribeauval field gun. **Tapered cast BRONZE barrel** `cyl(0.055,0.075,0.62,12)` `#8A6A3A` warm amber-brown patinating to `#6E7250` olive — **NOT bright toy-gold, NOT rust-brown.** Integral trunnions seated in the carriage cheeks; **elevating SCREW at the breech.** Two-wheeled carriage, wheels 0.37 H with iron tyres, long trail. Separate two-wheeled limber with an ammo chest. Rammer, sponge, worm and linstock racked on the carriage; shot pyramid alongside. TC on carriage woodwork, limber chest, crew coats. | **A short thick warm-brown tube on two big wheels.** The tube is shorter than the wheels are tall. |
| `culverin` | 5 Enlight. | As `cannon`. | As `cannon`, plus the gunner's leather apron. | **LONG, SLENDER gun — barrel length is the entire read.** `cyl(0.040,0.048,1.15,12)` — **25–32 calibres, visibly thinner and nearly twice as long as `cannon`'s**, so the two never get confused. Cast bronze `#8A6A3A` with olive patina, or matte `#2E3238` cast iron for the cheap variant. Reinforcing rings `cyl(h 0.02)` and **dolphin lifting handles** along the barrel; trunnions at the balance point. Heavier siege carriage with larger wheels. **QUOIN WEDGE under the breech, not an elevating screw.** TC on carriage timbers. | **The barrel is longer than the carriage.** The one gun whose tube overhangs its own wheels front and back. |

### B.6 Healer

| id | age | headwear | body / leg / foot | signature prop | THE 40px CUE |
|---|---|---|---|---|---|
| `priest` | 3 Classical | Shaved head — **but shaved is not a silhouette**, so: a 0.20 H wig block `cyl(0.19,0.20,0.20,14)` in `HAIR_TONES[3]` `#2b2b2b` reading as a close crop, PLUS **ONE long braided sidelock** `cyl(0.030,0.024,0.16,6)` hanging over the **right** ear to the shoulder — the sem-priest's mark. TC ribbon binding the sidelock. | **Leopard pelt draped over the LEFT shoulder**, paws tied across the chest, head and tail hanging: `box(0.11,0.26,0.030)` rot z 0.22, tawny `#C9A03C` with black rosettes `#2b2b2b` in texture. **The asymmetric drape is the silhouette.** Beneath it a bleached pleated linen kilt `#DDD4BE` to mid-calf and a broad beaded collar `cyl(h 0.035)`. TC on the sash under the pelt and in the collar's bead rows. Bare feet / papyrus sandals. | Was-staff `cyl(0.011,0.011,0.62,8)` `#8A6B45` with a forked base and an animal-head fork at the top — **or** a long ritual censer whose curling smoke wisp doubles as the heal VFX anchor. Small libation vessel at the belt. **Nothing weaponlike anywhere. No shield.** | **The spotted pelt over one shoulder.** The only patterned, asymmetric torso covering in the game. Pelt + sidelock + staff says holy man at any zoom. |

### B.7 Villager — one row per age

The villager is one class id driven by `teamAge[team]`. It keeps beard, big head and column posture
(§6.5) and adds a **low rounded cap 0.12–0.20 H, no epaulettes, jacket at 0.75× saturation.**

| age | headwear | body / leg / foot | tools | THE 40px CUE |
|---|---|---|---|---|
| 0 Stone | Hide skullcap `cyl(0.18,0.19,0.20,10)` `#5A4636`, or bare head with a TC hide headband; hair loose and matted. | **Stitched hide tunic of ALTERNATING DARK AND LIGHT STRIPS** — the Otzi stripe, `#7A5B3C` / `#A88A62` in bands of 0.045 H, belted. Separate hide leggings lashed to the belt. TC belt-cloth. Bark-net and hide shoes stuffed with grass. **Visibly mended — the single-draped-pelt caveman look is a myth.** | Antler pick `#C9BBA0`, flint axe, woven grass carry-basket `#B49A62`, birch-bark container, digging stick. | **Horizontal light/dark banding on the torso.** The only striped cloth in the game. |
| 1 Bronze | Bare head, short cropped dark hair, or a folded linen head-cloth `box(0.19,0.09,0.19)` `#D6C9A4` with a TC band. | Natural **CREAM linen wrap kilt (schenti)** `#D6C9A4` belted, plain and short, with a TC sash and TC-patterned hem band. Bare torso. Barefoot plinth. **Keep the linen off-white and undyed, never bleached bright.** | Bronze sickle `#A87A3A`, hoe, reed basket, shoulder yoke with two water jars, amphora, mudbrick mould. | **The palest, barest villager.** Cream from waist to knee, wood from waist up. |
| 2 Iron | Undyed wool cap `cyl(0.185,0.195,0.19,12)` `#8A8078` or a simple hood; TC cap band. | Knee-length wool tunic, undyed or madder `#9A4234`, **TC waist sash, fringed hem**; wool trousers; laced leather shoes `#5A4630`. **A CHECKED cloak pinned at ONE shoulder with a bronze fibula** — check in `#9A4234` / `#B49A3C` / `#3A5A7A` / `#7A6242`, 0.075 H squares. Woven check is a real Iron Age textile signature and reads beautifully at low resolution. | Iron sickle `#8A9099`, iron-shod spade, hand quern, distaff and spindle, iron axe, wicker hurdles. | **The checked cloak on one shoulder.** The only plaid in the game. |
| 3 Classical | Conical brimless **pilos** `cone(0.175,0.20,12)` `#DDD4BE`, or a broad straw sun hat `cyl(0.30,0.30,0.014,16)` `#B49A62` for field workers. TC band. | **Exomis** — right shoulder unpinned, asymmetric `box(0.19,0.18,0.15)` cut back 0.055 on the right — in natural linen or TC wool, belted, hem at mid-thigh. Bare legs, sandals. | Iron sickle and pruning hook, mattock, amphora, wicker basket, handcart, mason's mallet and chisel, surveyor's groma for the builder variant. | **The cut-back right shoulder**, shared with `comparcher` — the age's working-dress signature. |
| 4 Medieval | Chaperon hood `cone(0.19,0.21,10)` with a short liripipe, or a coif tied under the chin; straw hat for harvest. TC on the hood. | Wool cotehardie to the knee over a linen shirt, **TC field**, leather belt with a hanging pouch; wool hose; ankle turnshoes `#3A2E24`. Apron on craft variants. **Visible patching and mending is accurate and free.** | Scythe, flail, bucket yoke, axe and adze, carpenter's saw, handcart, grain sack. | **The pointed hood.** A soft cone with a tail, against three ages of hard hats. |
| 5 Enlight. | Round-crowned felt hat `cyl(0.165,0.175,0.13,12)` `#4A3E30` + brim `cyl(0.25,0.25,0.014,16)`, or a knitted wool cap. TC hat band. | TC wool waistcoat over a linen shirt with **sleeves rolled**; knee breeches, wool stockings `#D8CFB8`, buckled leather shoes `#221E1A`; **canvas or leather work apron** `box(0.16,0.20,0.012)` `#C9B48A`. | Iron-shod spade, scythe, flail, wheelbarrow, winnowing fan, cooper's tools and barrel, seed drill. | **The apron** — a pale rectangle hung on the front, plus white stockings under a dark hat. |

### B.8 Coverage

**32 class ids, 37 rows** in §B (`villager` is one id across six ages).
Melee 6 · anti-cav 6 · ranged 6 · cavalry 7 · siege 5 · healer 1 · villager 1 id / 6 rows.

With **§C `king` (1 id, 6 rows)**, **§D neutrals (4 ids)** and **§E trade (3 ids)** that is
**all 40 ids in `CLS` (`js/00-data.js:51`), in 50 rows.** The ages assigned here are the `age:` field
already on each class in `CLS` and the `LINES[].tiers` index — they were not chosen by this document
and must not be changed by it.

---

## §C — THE KING, PER AGE

**Owner ruling: the King ages with his town.** He is the win condition and the most-looked-at unit
in the game. The reference art's centre figure is a king — that is the target.

**THE CONSTANT.** Gold `#CFB53B` (highlight `#EBD46A`, shadow `#8C6D2B`) is on the crown in every
single age. **The crown is always gold. The age changes the crown's FORM and the cap inside it, never
its metal.** That is what makes the six kings one king.

**Structural rules that hold in all six ages** (from §6.5, and they are what make a king readable at
40px before you see a single colour):

- **Robe to 0.12 H above ground. The leg/boot split VANISHES** — the king reads as a solid trapezoid
  below the belt where every soldier reads as a split column. That difference survives to 40px and it
  is the only silhouette-level unit-class distinction in the game. Do not break it.
- Bounding box widens to **0.37 H**. Crown band 0.10 H + points 0.10 H — the crown is **0.20 H
  minimum**, and it stacks *on top of* the 0.22–0.26 H head, so the king is the tallest foot figure.
- Beard: `BEARD_TONES` auburn `#7A4526` at ages 0–3 (the reference king's tone), **iron grey
  `#6E665C` at ages 4–5** — the king visibly ages across the game.
- Gold belt with a **square buckle**, gold cuff rings at the wrists, gold orb finial on the crown.
  All three are in the reference art on the centre figure. Copy them.

| age | crown (form — always `#CFB53B` gold) | cap inside the crown | robe / mantle | regalia | THE 40px CUE |
|---|---|---|---|---|---|
| **0 Stone** — *the Chieftain* | **Hammered sheet-gold brow band**, 0.10 H tall, plain, with **five Varna-style gold discs** `cyl(0.030,0.030,0.006,10)` riveted along it and **two antler tines** `cone(0.022,0.16,5)` `#C9BBA0` rising from the sides. (Gold at 4600 BC is defensible — Varna. It is the earliest worked gold in Europe.) | Bear-fur cap `#5A4636`, 0.16 H, under the band. | **Bear pelt mantle to the ankle** `#4A3826`, head and paws over the shoulders, over a TC hide tunic. | Greenstone macehead sceptre `cyl(0.085,0.085,0.13,8)` `#5F7355` on an ash haft. Bone gorget `#C9BBA0`. | **Two antler tines flanking a gold band.** The only horned crown. |
| **1 Bronze** — *the Wanax* | **Gold diadem** with a raised central plate and **seven rising gold rays** `box(0.020,0.09,0.010)` — the Aegean/Egyptian form, flat and radiant rather than pointed. | Striped linen headcloth `#D6C9A4` / `#A87A3A` falling to the shoulders behind, 0.20 H. | Cream pleated linen robe `#D6C9A4` to the ankle with a **broad gold usekh pectoral collar** `cyl(0.24,0.26,0.06,16)` `#CFB53B` and TC sash. | Gold-hilted Naue II sword. Faience-inlaid `#3E8C8A` gold armlets. Crook and flail optional. | **The wide flat gold collar** — a gold disc across the chest, the widest gold area of any king. |
| **2 Iron** — *the Great King* | **Truncated conical gold tiara (polos)**, `cyl(0.17,0.20,0.20,14)` `#CFB53B`, with a small **apex peak** `cone(0.05,0.05,8)` and three bands of embossed rosettes. Assyrian, and unmistakably a *hat* rather than a circlet. | Wound dark fillet `#5A4630` visible at the rim. | Long fringed robe `#9A4234` madder over TC, with **gold rosette bands** at hem, cuff and shoulder; wide TC sash. Long square-cut curled beard, iron-grey ready. | Gold mace of office `cyl(0.05,0.05,0.09,10)`. Gold armlets with lion-head terminals. | **A tall solid gold cylinder on the head.** The only king whose crown is a closed drum. |
| **3 Classical** — *the Basileus* | **Gold laurel wreath**, 0.14 H: two `cyl(0.20,0.20,0.010,16)` rings with **eleven** leaf pairs `box(0.016,0.040,0.006)` angled 25°. Low, open, and the only crown you can see the head through. | None — bare carved crown, dark hair `HAIR_TONES[0]`. | **Tyrian purple `#5B2A50` paludamentum** over a bleached white tunic `#DDD4BE`, gold-bordered, pinned at the right shoulder with a gold fibula. **Purple is used by no other age and no other unit — it is this king's private colour.** | Gold-hilted parazonium. Ivory sceptre `#DCCFAA` with a gold eagle. Gold-and-purple boots. | **Purple.** The only purple surface in the entire game, under an open gold wreath. |
| **4 Medieval** — *the Rex* | **Open arched crown**: gold band 0.10 H + **five fleurons** `box(0.030,0.10,0.012)` with trefoil tops, plus **four pearls** `cyl(0.018,0.018,0.018,8)` `#D6CBB0` between them. This is the reference art's crown — build it from the image. | **Crimson velvet cap `#8A2A28`** filling the crown, domed, with a gold orb finial `cyl(0.026,0.026,0.026,10)` at the top. Exactly as in the reference. | Full TC mantle to the ankle with **gold damask scrollwork in TEXTURE, never geometry** (§6.3b.5), **ermine lining** showing at the throat and front edge: `#D6CBB0` with `#2b2b2b` tail-flecks. Gold belt, square buckle. | Gold sceptre with a cross finial, gold orb in the off hand, gold-hilted arming sword. | **Five gold points around a red dome.** The reference art's exact head, and the most-looked-at 40 pixels in the game. |
| **5 Enlight.** — *the Sovereign* | **Closed imperial crown**: gold band 0.10 H + four fleurons + **two crossed gold arches** rising to a **gold orb-and-cross finial** at 0.14 H above the band. Closed, not open — the visible difference from the Medieval crown, and the correct one. | Crimson velvet cap `#8A2A28` beneath the arches. | Long gold-laced TC court coat to the calf; **broad silk sash of the order across the chest** `box(0.030,0.32,0.008)` `#CFB53B`-edged; gold gorget `cyl(h 0.035)` at the throat; buff breeches, **red-heeled shoes** `#8A2A28`. | Gold-hilted small-sword, gold-topped cane, gold star of the order on the left breast. Powdered wig: **two side-rolls** `cyl(0.055,0.055,0.075,10)` + a queue, `#B8B0A0` — **not white**, and it never covers the iron-grey beard. | **A closed crown with a cross on top, over pale side-rolls.** The only crown with an arch. |

**Anti-drift note.** All six crowns must reduce to a **gold mass ≥ 0.10 H tall spanning ≥ 0.90 ×
headWidth** at 40px. If a critic can crop the top 0.20 H of any king and not see gold, that king
has failed regardless of how correct its history is.

---

## §D — NEUTRALS

**Owner ruling: `barbarian`, `viking`, `vikingboss`, `wolf` DO NOT age.** They are teamless camp
units (`TEAMCOL[2] = #9AA0A8`). **They must still be restyled to the new look** so they do not read
as leftovers from the old build: turned-cylinder limbs, faceted normals, carved beard, big head,
rosy cheeks, bared teeth, wood grain (§6.3a, §6.3b).

Their palette is deliberately **outside every age ladder** — colder and darker than any team unit —
so that "not one of the two armies" is legible before anything else about them is.

| id | headwear | body / leg / foot | prop | THE 40px CUE |
|---|---|---|---|---|
| `viking` | **Horned helm**: iron dome `cyl(0.165,0.195,0.17,12)` `#4A4E54` with a riveted brow band `cyl(h 0.028)` `#8A8078` and rivet dots, plus **two curved horns** `cone(0.035,0.20,7)` `#4A3A2A` sweeping out and up at 40°. Dark **mail coif** `cyl(0.20,0.24,0.10,14)` `#3A3E44` falling to the shoulders in a zigzag weave texture. | Dark iron **scale** hauberk: 5 stacked `cyl(h 0.036,14)` courses `#4A4E54` over a dark mail body `#3A3E44`. Grey-team accent `#9AA0A8` on the shield and belt only. Leather cross-straps `#4A3A2A`, wrapped leg bindings, dark boots `#221E1A`. **Golden-blonde beard `#8A6A34`** — the reference's Norse figure, and the lightest permitted beard tone. | **Bearded axe**: haft `cyl(0.014,0.014,0.42,8)` `#6B4A2E` with a bulbous pale pommel knob `cyl(0.040,0.040,0.05,10)` `#C9A97E`; head `box(0.010,0.13,0.10)` `#8A8078` with the beard hooking down. Round shield `cyl(0.155,0.155,0.02,12)` `#9AA0A8` with a dark iron boss. | **Horns.** Nothing else in the game has them, and the reference art puts them there. See §I open question 3. |
| `vikingboss` | As `viking` at **1.15× scale**, plus a **gold-inlaid brow band** `#CFB53B` and gold rivet heads, and a **wolf-pelt mantle hood** `#6B5F52` over the coif. | As `viking` at 1.15×, plus a **wolf-pelt mantle** over both shoulders `#6B5F52` with the head hanging on the chest, **three gold arm-rings** `cyl(h 0.020)` `#CFB53B` per arm, and a heavier gold-buckled belt. Beard `#8A6A34`, longer: hangs 0.14 H below the chin. | **Two-handed Dane axe**: haft `cyl(0.016,0.016,0.68,8)`, head `box(0.012,0.20,0.15)` `#8A8078` with gold etching. **No shield** — both hands on the haft. | **Bigger, and gold on a grey unit.** The only neutral with gold, and the only one at 1.15× scale. |
| `barbarian` | **Lime-washed spiked hair** — `cone(0.030,0.14,5)` `#D8D0BC` ×5 splayed at 20–35° from a low `cyl(0.18,0.19,0.09,12)` scalp. **Max channel 216.** No helmet. This is the strongest cheap silhouette available and it is genuinely Celtic. | Bare torso in painted wood with **woad spiral tattoos `#3A5A7A` in texture, ≤ 5% area** (§A.4). Grey-team `#9AA0A8` check cloak over one shoulder, pinned with a bronze fibula. Fur-trimmed `#6B5F52` trousers, rawhide boots `#5A4630`. Beard: dark walnut `#4A3524`. | Long iron slashing sword `box(0.045,0.22,0.012)` `#8A9099`, or a heavy spear. Long oval Celtic shield `box(0.18,0.34,0.022)` `#9AA0A8` with a vertical spine boss — **oval, against every other shield's round or heater.** | **The white spiked crown of hair.** The only unit with no headgear at all and the only spiked head. |
| `wolf` | — | **A carved-wood wolf, not a nutcracker.** Body `cyl(0.11,0.13,0.34,10)` horizontal `#7A756E` with a darker saddle `#4A4640` down the spine and a pale `#B8B0A0` chest and muzzle underside. Legs as 8-sided tapers. Ears `cone(0.028,0.06,5)`. Tail `cyl(0.035,0.018,0.20,8)` low. Faceted normals and wood grain like every other model — **it must read as carved, not as fur.** | Amber eyes `#C98A2E` with `#14100E` pupils; bared white teeth `#FFFFFF` in a `#1A1210` slot — the same mouth pair as every nutcracker, which is what ties it to the set. | **Horizontal, four-legged, low.** The only unit in the game whose long axis is horizontal. That alone is the read; the colour only has to say "not a team". |

---

## §E — TRADE

**Owner ruling: one look across all ages.** These never restyle on age-up, which also means
`_restyleOneBuilding`'s hazards do not apply and their materials can be minted once at boot.

| id | look | THE 40px CUE |
|---|---|---|
| `oxcart` | **The heavy timber hauler.** Bed `box(0.62,0.13,0.34)` `#6E5230` planked, with `#4A4640` iron strapping at every corner. **Solid-disc wooden wheels** `cyl(0.24,0.24,0.045,14)` `#6E5230` with a `#4A4640` iron tyre ring and three `#8A6B45` cleats — the earliest and most timeless cart wheel, deliberately not spoked. Draft pole `cyl(0.018,0.018,0.44,8)` to a yoke bar across two oxen `#7A6A56` with `#4A3A2A` horns `cone(0.020,0.11,6)` and a `#6B4A2E` yoke. Load: stacked logs `#6E5230` or cut stone `#8A8078`. Drover: a villager-rig nutcracker in a low cap `#4A3E30` and team colour. | **Two oxen and solid disc wheels.** The only draught pair and the only unspoked wheel. |
| `tradecart` | **Light two-horse cart.** Bed `box(0.44,0.10,0.28)` `#8A6B45` under a **canvas tilt** over five hoops: `cyl(0.19,0.19,0.40,12)` half-shell `#C9BCA4` — **max channel 201, never white.** Spoked wheels `cyl(0.20,0.20,0.035,12)` with **eight** spokes `box(0.012,0.18,0.012)` `#8A6B45` and iron tyres `#4A4640`. Two horses `#6B4A2E` in plain harness. Cargo showing at the tail: amphora `#B49A62`, crates `#6E5230`, a wool bale `#C9BBA0`. Gold-corded team banner `#CFB53B` on a short staff at the front board. | **The pale canvas arch.** The only curved light-value roof on any moving object. |
| `trader` | **A walking merchant nutcracker.** Tall brimmed felt hat: crown `cyl(0.155,0.175,0.20,12)` `#4A3E30` + brim `cyl(0.28,0.28,0.014,16)` — **the tallest civilian hat in the game.** Long travelling coat to 0.14 H above ground `box(0.21,0.26,0.17)`, TC field with `#CFB53B` frogging and a `#7A5A38` fur-trimmed collar. **Strongbox on the back** `box(0.15,0.13,0.09)` `#6E5230` with `#CFB53B` corner bands and a `#4A4640` hasp. Coin scale `cyl(0.05,0.05,0.006,10)` ×2 on a beam in one hand. Gold chain of office `cyl(h 0.020)` `#CFB53B`. Boots `#4A3A2A`. | **The strongbox hump on the back.** The only unit with a load above the shoulders behind the head. |

---

## §F — BUILDINGS, PER AGE

**The governing rule is AoE's, and `ART-DIRECTION.md` §5.5 already states it:** a building must be
identifiable by **roof shape and colour alone** at distance. §5.7 adds that an age change must move
**silhouette**, not texture — a tier change that is texture-only is invisible at 46px and does not
count.

### F.0 The age's building shell — inherited by every row below

| age | wall (hex, V) | roof (hex, V) | roof form + pitch | trim / dark | base course | eave |
|---|---|---|---|---|---|---|
| 0 Stone | daub over wattle `#B8AC94` 0.678; drystone `#8E8478` 0.523 | **dark thatch `#6E5A30`** 0.358 | **CONE, 45°** — the strongest pitch, confirmed by experimental archaeology | `#4A3826` | none, buildings are **sunk into an earth mound** | 14% |
| 1 Bronze | sun-dried mudbrick `#CBA97A` 0.678; ashlar socle `#C0B49C` | **flat mudbrick deck `#C4A470`** 0.655 | **FLAT, 0°, with a parapet** — the deliberate opposite of the Stone cone | cornice band `#6E5230` 0.10 H tall | ashlar socle 0.3 | 14% |
| 2 Iron | fieldstone `#A39A90` 0.609 + timber frame `#5A4630` | **weathered oak shingle `#48453C`** 0.271 | **LOW GABLE, 25–30°** | `#3A3A38` | stone footing 0.3 | 14% |
| 3 Classical | travertine / plaster `#E0CFA8` 0.815; marble `#DDD4BE` 0.833 | **terracotta tile `#B4543A`** 0.402 | **LOW HIP or PEDIMENTED GABLE, 22–28°**, clerestory on the two-tier ones | `#2A2018` | stone podium 0.5 | **18%** |
| 4 Medieval | limewash `#CFC4A8` 0.770 + **dark oak frame `#4A3A2A`**; ashlar `#9A968A` | **blue-grey slate `#5A6068`** 0.374 | **STEEP GABLE, 45–55°** | `#1E1A16` | stone plinth 0.4 | **18%** |
| 5 Enlight. | pale render / ashlar `#D2C8B4` 0.787; **red brick `#9E5744`** on base course, quoins, chimneys | **verdigris copper `#4E9E88`** 0.547 civic/religious; **slate `#3E4650`** 0.271 on houses and farm | **HIPPED, 30–35°, + cupola / lantern / steeple** | `#262A30` | brick base course 0.4 | **18%** |

**Roof ladder, measured.** All 15 pairwise ΔE00 among the six primary roofs: minimum **13.8**
(Iron/Medieval), maximum 49 (Classical/Enlightenment). **All ≥ 12 — PASS.**
Note that **Classical (V 0.402) and Medieval (V 0.374) are nearly identical in value**: they separate
by hue (terracotta red vs blue-grey, ΔE00 = 29) and by pitch (24° vs 48°). That is deliberate. A
critic must not "fix" it by darkening one.

**Roof/wall contrast (§5.5, ≥ 0.25 and roof darker below age 5):**
Stone 0.320 ✓ · Bronze **exempt, see below** · Iron 0.338 ✓ · Classical 0.413 ✓ · Medieval 0.396 ✓ ·
Enlightenment 0.516 ✓ (slate) / 0.240 (copper — **ornament exemption**, and age 5 is exempt from the
darker-of-the-pair direction anyway).

> **BRONZE AGE EXEMPTION, stated because it is the one place the §5.5 rule cannot apply.** A flat
> mudbrick roof has no pitch and therefore no roof/wall value break. Bronze substitutes a **0.10 H
> dark cornice band `#6E5230` at the parapet** plus the parapet's own cast shadow. Deck 0.655 vs wall
> 0.678 is only 0.023 — **the cornice band, not the deck, is what carries the contrast**, and it
> must be at least 0.075 of building height or the age reads as an unbroken sand-coloured lump.

### F.1 Stone Age — 4 buildings

| id | wall | roof | silhouette cue that announces the age | chain |
|---|---|---|---|---|
| `towncenter` | drystone `#8E8478` double-skin, core packed with clay and midden | thatch `#6E5A30` | **A low mounded stone hummock with a smoking roof vent, NOT a tower.** Oversized house form, partly sunk into an earth mound, linked to smaller cells by covered stone passages. | — |
| `house` | daub `#B8AC94` over a timber post ring | thatch `#6E5A30` | **Conical thatch at 45°**, 5–15 m across, central hearth, **NO smoke hole** — smoke filters through the thatch. The cone is the most readable silhouette at RTS zoom. | — |
| `storage_pit` | timber joists `#8A6B45` | thatch `#6E5A30` | **A small raised timber-floored hut** on stilts holding grain above damp and rodents, **plus two or three bell-shaped pits with clay lids** `#B8AC94` and a leaning ladder. | — |
| `barracks` | daub `#B8AC94`, larger ring | thatch `#6E5A30` | Larger roundhouse. Dressed with **weapon racks, hides drying on frames, a knapping floor of flint debris and an outdoor hearth.** ⚠ **FLAG: there is no Neolithic barracks.** Fighters lived in ordinary houses; the workshop (Skara Brae House 8) is the closest real precedent. Gameplay needs the slot. | — |

### F.2 Bronze Age — 8 buildings

| id | wall | roof | silhouette cue | chain |
|---|---|---|---|---|
| `towncenter` | mudbrick on a stone socle, heavy timber framing, frescoed plaster `#C0B49C` | flat deck `#C4A470` with a **central oculus** over the hearth | **Megaron**: two-column entry porch → vestibule → main hall with **four columns ringing a circular hearth**. Set inside **cyclopean walls** — massive roughly-fitted boulders — with a **corbelled relieving triangle** over the gate. | — |
| `house` | ashlar lower courses `#C0B49C`, mudbrick above `#CBA97A`, timber tie-beams | flat `#C4A470` | **Flat-roofed cubic massing with a stepped roofline** — a deliberate contrast against the Stone cone. Light-wells. | — |
| `storage_pit` | mudbrick `#CBA97A` | domed | **Freestanding domed beehive silos** `cyl`→dome, loaded from a top opening by ladder, emptied through a small base door. Alt: peaked storage cells round a courtyard with a scribe. | — |
| `barracks` | mudbrick `#CBA97A`, **deliberately thinner-walled** than the granary | flat `#C4A470` | **A low mudbrick range of repeating door bays** under a flat roof, with a shaded colonnade and weapon racks outside. Standardized three-room plan. | — |
| `farm` | mudbrick `#CBA97A` | flat `#C4A470` | **The shaduf** — a counterweighted lever with a bucket on a rope — is the single most readable animated prop available. Crisscross earthen levees, threshing floor, nilometer, emmer and barley rows. | — |
| `archery_range` | mudbrick shed `#CBA97A` + shade canopy | flat `#C4A470` | Open training ground: bow-maker's bench with staves and horn strips, **straw bale targets on wooden frames**, a line of firing marks. ⚠ **FLAG: no purpose-built range exists this early.** | — |
| `stable` | mudbrick range `#CBA97A` | flat `#C4A470` | **Open colonnaded stall run** with tether posts and **floor cisterns** (Piramesse had ~460 tether points, each paired with a cistern), chariots parked under an awning. **Do not borrow Megiddo's pillared design — that is Iron Age.** | — |
| `watch_tower` | mudbrick on a **battered (sloping) base** `#CBA97A` | flat `#C4A470` | **Migdol**: square, two or three stories, crenellated parapet, external stair, **beacon brazier on top.** ⚠ **`watch_tower` is the OCCUPIABLE one** — it carries `b.deck` — and must read as climbable: visible external stair, open deck, parapet you can see over. | — |

### F.3 Iron Age — 12 buildings

| id | wall | roof | silhouette cue | chain |
|---|---|---|---|---|
| `towncenter` | mudbrick faced with carved stone `#A39A90` and glazed brick | low gable `#48453C` | **The LAMASSU is the silhouette** — a pair of colossal winged human-headed bulls flanking the doorway. Nothing else in the building set reads like two monumental guardian figures in a gate. Build them as the age's hero prop. | — |
| `house` | mudbrick on a stone footing `#A39A90`, **blank windowless walls to the street** | low gable / flat hybrid `#48453C` | Rooms wrapped round a **central open courtyard**, roofs used as living space. Pick courtyard-box **or** thatch roundhouse per faction skin — **never mix the two in one settlement.** | — |
| `storage_pit` | timber `#5A4630` | low gable `#48453C` | **The four-post granary**: a small timber platform raised on four or six posts. Raised box on stilts is the read; scatter capped pits and clay lids round its base. | — |
| `barracks` | mudbrick `#A39A90` | low gable `#48453C` | Repeating three-room units under a flat roofline, colonnaded drill porch, spear racks, smith's lean-to at one end. ⚠ **FLAG: no dedicated Iron Age barracks is confirmed anywhere.** Reuses the Bronze fortress template. | — |
| `farm` | fieldstone + timber `#A39A90` | shingle `#48453C` | **Enclosed Celtic field systems** — small rectangular plots bounded by lynchets and banks — give a strong readable ground pattern round the building. Ard drawn by oxen, hand quern by the door. | — |
| `archery_range` | timber shed `#5A4630`, fenced compound | shingle `#48453C` | Composite bow-making racks with horn and sinew drying, straw butts on posts, spent arrows downrange, and **tall standing pavise shields propped against the fence** — the authentic Assyrian detail. | — |
| `stable` | stone pillars `#A39A90`, lime-plastered floors | low gable `#48453C` | **The row of stone pillars with tethering holes bored through them** is the signature. Central aisle, side aisles, cobbled aisle, attached grain silo. (Megiddo Stratum IVA, early 8th c. — **not** Solomon's.) | — |
| `watch_tower` | mudbrick or fieldstone `#A39A90` | flat, crenellated | Square, three stories, crenellated top, **beacon basket**. Rural variant: a simple stone cylinder with a ladder. Occupiable — keep the external ladder visible. | — |
| `siege_workshop` | open timber frame `#5A4630` | shingle `#48453C` | **A carpenter's yard, not a factory**: sawpits and trestles, stacked beams and hide bundles, a rope walk, **a half-finished ram housing on blocks**, wheels leaning on the posts. ⚠ **FLAG: no fixed siege workshop existed** — Assyrian trains were built in the field. | — |
| `blacksmith` | open-sided under thatch/shingle `#48453C` | shingle `#48453C` | **Clay-lined hearth with a clay tuyere and bag bellows; a plain RECTANGULAR anvil block set in a stump — NO horn, NO hardy hole** (those are a medieval refinement). Quench trough, plus a separate **bloomery shaft furnace**. Open-sided so the forge glow reads at night. | — |
| `wood_wall` | **murus gallicus** `#A39A90` stone face | — | **HORIZONTAL beam ends and iron spike heads on the face** — timber beams laid lengthwise, pinned crosswise, front faced with stone, interior packed with earth. That face is the whole read, and it is the deliberate opposite of the Medieval palisade's vertical logs. | — |
| `wood_gate` | as `wood_wall`, flanked by two timber towers on stone footings | shingle `#48453C` | **Inturned entrance passage** forcing an attacker into a killing corridor. Heavy oak leaves `#5A4630` with iron strapping, fighting platform over the passage, walkway linking the towers. | — |

### F.4 Classical Age — 16 buildings

| id | wall | roof | silhouette cue | chain |
|---|---|---|---|---|
| `towncenter` | stone and concrete `#E0CFA8` | terracotta `#B4543A`, **TWO-TIER** | **The basilica**: long hall with nave and flanking aisles, an **apse** at one or both ends, and a **two-tier roof — higher over the nave with a clerestory of windows, lower over the aisles.** The two-tier roof is the age's single strongest building read. | — |
| `house` | brick and concrete `#E0CFA8`; ground-floor **tabernae** with wide arched doorways | terracotta `#B4543A` | **Insula** for density: 4–6 stories, few windows above, timber floors. **Domus** for the wealthy quarter: single story, **atrium with a compluvium roof opening over an impluvium basin**, peristyle garden. Use both. | — |
| `storage_pit` | **walls up to a metre thick** `#E0CFA8` | terracotta `#B4543A` | **Horreum**: floors raised on short pillars (suspensurae) so air circulates underneath — **show the pillars**; narrow high windows sized to deter theft; **ramps instead of stairs.** Blocky utilitarian ranges round a courtyard. | — |
| `barracks` | stone `#E0CFA8` | terracotta `#B4543A` | **Long rows of PAIRED rooms** — each contubernium of eight shares a front arma and a rear papilio — with the centurion's larger quarters closing each block. **This is the first genuinely purpose-built barracks in the tech tree: make it look organized and relentlessly repetitive to sell that.** | — |
| `farm` | stone / concrete `#E0CFA8` | terracotta `#B4543A` | **Villa rustica: show BOTH halves and the seam between them** — the pars urbana with higher finish and mosaic, the pars rustica with barns, presses, stables. That contrast is the building's whole character. | — |
| `archery_range` | walled exercise yard `#E0CFA8` | terracotta portico `#B4543A` | Tiled-roof equipment portico, bow racks, straw-and-wicker targets, **drill posts (pali)**, and a **covered gallery** for shooting in bad weather. ⚠ **FLAG: still no attested purpose-built range**; the covered gallery is a reasonable inference. | — |
| `stable` | stone `#E0CFA8` | terracotta `#B4543A` | Long building, **open stall run divided by timber partitions**, tack rooms, water trough along the front, hayloft above. | — |
| `watch_tower` | ashlar base `#E0CFA8` | tile `#B4543A` | **Burgus**: square, 1–3 stories, small arched windows, **a projecting timber fighting gallery at the top**, signal beacon. Occupiable — the gallery is the deck. | — |
| `tower` | ashlar or concrete faced with brick `#E0CFA8` | tile `#B4543A` | **Mural tower PROJECTING OUTWARD from the wall line** so defenders shoot along the wall face — the flanking principle. 2–3 stories, arched embrasures, **a scorpio bolt-thrower on the top platform.** ⚠ **`tower` SHOOTS and `watch_tower` is OCCUPIED. They are two distinct buildings, not an upgrade of one another** — `tower` is larger, permanently garrisoned, and built into a wall circuit; `watch_tower` is isolated and climbable. | — |
| `siege_workshop` | courtyard building `#E0CFA8` | tile `#B4543A` | **The fabrica — and unlike every earlier age this one is REAL, permanent and well evidenced** (Inchtuthil, 3,500 m², 82–83 AD). Open-sided working bays, **forges venting smoke**, timber stacks, a bolt-thrower on trestles mid-assembly, finished shields racked in rows. | — |
| `blacksmith` | taberna or fabrica bay `#E0CFA8` | tile `#B4543A` | **The Roman upgrade over the Iron Age forge is SCALE AND ORGANIZATION, not technique**: standardized output, racks of identical finished pieces, a **tiled roof instead of thatch**, and a paved floor. **Still a plain anvil block — no horn.** | — |
| `market` | **macellum**: open colonnaded court `#E0CFA8` with shop bays round it | tile `#B4543A` + a **central round THOLOS** | The Roman covered food market. **A circular columned tholos with a conical tile roof standing in the middle of a square colonnaded court** — the only round-inside-square plan in the building set, and the age's cleanest market read against the medieval hall's open arcade. Dress with trestles, amphorae, a weighing beam and a fountain basin. | — |
| `temple` | raised **podium**, columned portico `#DDD4BE` marble | tile `#B4543A`, **pedimented gable** | **The ORDER is the whole read and it is decided at the capital.** Plain convex cushion, no base = **DORIC** (4–8 diameters, 20 shallow flutes, triglyph/metope frieze) — **use Doric: it is the boldest at low poly.** Paired scroll volutes + base = Ionic. Acanthus bell = Corinthian, the clearest upgrade if it ever tiers. | — |
| `wood_wall` | timber palisade on an earth rampart, **V-profile ditch** | — | **Sharpened stake tops, continuous earth bank behind, a walkway. Neat, regular and ENGINEERED** — deliberately against the Iron Age murus gallicus's rough beam-and-stone face. | — |
| `wood_gate` | two timber towers, rampart ends **overlapping** | shingle | **The clavicula** — the overlap forces an angled approach so attackers expose their unshielded right side. Oak doubles with iron strapping, fighting platform bridging the towers, **a vexillum standard above the passage.** | — |
| `stone_wall` | mortared ashlar / concrete faced with brick `#E0CFA8` | — | Curtain walls linking projecting towers at regular intervals, wall-walk behind a parapet. **The Roman contribution is engineering, not height** — mortar lets walls stand thinner and straighter. Under the Pax Romana they are as much display as defence, so they can afford to look decorative. | — |
| `stone_gate` | grey sandstone ashlar `#9A968A`, **no mortar**, iron and lead cramps | tile `#B4543A` | **Porta Nigra**: twin FOUR-STORY towers projecting as near-semicircles flanking a double passage, **rusticated unfinished block faces**, an inner courtyard trapping attackers between two sets of doors. **This is the showpiece of the Classical set — treat it as one.** | — |

### F.5 Medieval Age — 18 buildings

| id | wall | roof | silhouette cue | chain |
|---|---|---|---|---|
| `towncenter` | coursed ashlar `#9A968A` with dressed-stone quoins, **walls thick enough to hold stairs inside them** | slate `#5A6068` | **The stone keep**: massive rectangular tower, **square corner turrets with ONE round stair turret**, small high windows, and a **forebuilding covering the entrance stair at first-floor level.** | — |
| `house` | oak box frame `#4A3A2A` with wattle-and-daub or brick infill `#CFC4A8` | steep tile/thatch `#5A6068` | **JETTYING — the upper floor's joists cantilever out past the wall below on a bressummer beam, with dragon beams turning the overhang at the corners, so each story projects further than the one beneath.** That stepped overhang is one of the most readable silhouettes in the entire game. Ornamented corner posts, tall chimney. | — |
| `storage_pit` | high-quality ashlar `#9A968A` | **enormous cruck-framed** slate `#5A6068` | **The tithe barn**: from outside it is **a long, steep, DOMINATING roof mass** — the roof is most of the building. **Massive opposed wagon doors on both sides** so a cart drives straight in and the draft winnows grain on the threshing floor. | — |
| `barracks` | timber-framed or stone hall `#CFC4A8` / `#4A3A2A` | steep slate `#5A6068` | **A bailey hall and guardroom**: long hall with a central hearth, trestle tables, straw pallets, arms racks, and a small stone guardroom by the gate. ⚠ **FLAG: there is no medieval barracks.** The word and the building appear in the late 17th c. (first English use 1669). Garrisons lived in the keep or were billeted. | — |
| `farm` | timber frame `#4A3A2A` + daub `#CFC4A8` | thatch/slate `#5A6068` | Timber barn and byre round a **muddy yard**, a **dovecote**, a granary **raised on staddle stones**, fenced toft and croft, open strip fields beyond. Feature the **heavy mouldboard plough with a coulter** drawn by an ox team — the real medieval advance. | — |
| `archery_range` | timber-framed bowyer's shed `#4A3A2A` | slate `#5A6068` | **This is finally the genuine historical article.** A long fenced green with **a pair of turf BUTT MOUNDS at either end**, roundel targets, bow staves, goose feathers and glue pots, archers at the shooting line. Practice was legally mandated. | — |
| `stable` | timber-framed or stone `#CFC4A8` | steep slate `#5A6068` | Stall run divided by timber partitions, cobbled drained central aisle, **hayloft above reached by an external pitching door**, tack room, mounting block and trough outside. **Match its material to the castle it serves** — it is a standard bailey building, not a distinct type. | — |
| `watch_tower` | stone `#9A968A` | crenellated, no pitch | **Peel tower**: 2–3 stories, ground-floor store with **NO external door**, **entrance at first-floor level reached by a REMOVABLE LADDER**, arrow loops, crenellated parapet, beacon basket. The removable ladder is the occupiable read. | — |
| `tower` | ashlar with rubble core `#9A968A` | crenellated + machicolations | **ROUND**, not square — round towers deflect missiles and resist undermining, and that is a real engineering reason for the shape change, so the shape change should be visible. 3–4 stories, arrow loops at each level, spiral stair in the wall thickness. | — |
| `siege_workshop` | open timber frame `#4A3A2A` | shingle `#48453C` | Carpenter's yard: sawpits, trestles, rope walk, stacked beams and iron strapping, **a half-assembled trebuchet arm resting on blocks**, finished wheels and axles against the posts. ⚠ **FLAG: no standing siege workshop existed** — engines were built on site and abandoned. | — |
| `blacksmith` | timber-framed, **wide open front so the forge glow spills into the street** | steep slate `#5A6068` | **A HORNED ANVIL on a timber stump — this is the age the horn and hardy hole appear, so it is a genuine detail upgrade over the ancient anvil block and it is worth modeling.** Great bellows, quench trough, tool wall, farrier's hoof stand and horseshoes hung outside. | — |
| `wood_wall` | **VERTICAL split logs sharpened at the top**, set in a trench on an earth bank | — | **Vertical logs, in explicit contrast to the Iron Age murus gallicus's horizontal beam ends — the two ages must separate at a glance on the cheapest building in the set.** Walkway and breastwork behind. | — |
| `wood_gate` | timber gate tower straddling the palisade | shingle | **HOARDING BOARDS projecting out over the face** to allow dropping onto attackers at the wall base. Oak leaves with heavy iron strapping and a drawbar, a **removable or pivoting ditch bridge — not a proper chained drawbridge yet.** | — |
| `temple` | ashlar `#9A968A`, thin walls, **enormous windows** | steep slate `#5A6068` + **SPIRE** | **The style tells the era at a glance.** ROMANESQUE (c. 1000–1150): round arches, thick walls, small windows, massive cylindrical piers, squat towers — heavy and dark. **GOTHIC (from 1144): pointed arches, ribbed vaults, FLYING BUTTRESSES carrying the thrust outside, tall spires, tracery.** If the Temple should visibly upgrade within the age, that Romanesque→Gothic shift is the cleanest way. | — |
| `market` | **open arcaded ground floor — timber posts or stone piers, NO WALLS** — with an enclosed upper room | slate `#5A6068` | **Open below, enclosed above.** The trading floor is a colonnade you can see through; the guild room sits on top. Plus a **stepped market cross** alongside. Dress with awnings, trestle stalls, barrels, a weighing beam. | — |
| `castle` | two rings of curtain wall, **inner rising above outer so both can shoot at once** `#9A968A` | crenellated + machicolations | **Concentric, Edward I generation.** Round mural towers at the angles, a moat, and — critically — **a GREAT TWIN-TOWERED GATEHOUSE as the primary strongpoint: by this period the gatehouse, not the keep, is the strongest part of the castle.** Machicolations project on corbels with floor slots. | — |
| `stone_wall` | mortared ashlar `#9A968A` re-dressed to the Medieval shell — **rougher coursing, no decorative facing** | crenellated parapet | A wall placed in the Classical age and still standing. Restyled to Medieval: the Roman decorative face is dropped, coursing goes rubble-cored with dressed stone only at the openings, and a **plain crenellated parapet replaces the Roman walkway**. Deliberately **plainer than `fort_wall`** — no batter, no machicolations — so the upgrade is visible side by side. | ⛔ **FULLY REPLACED by `fort_wall` — owner ruling, see §0a. This row does not render in this age.** |
| `stone_gate` | grey ashlar `#9A968A` | slate `#5A6068` | The Classical Porta Nigra restyled: **the twin near-semicircular towers stay** (they are the building's identity) but lose their rusticated Roman faces and gain a plain crenellated top and a drawbar. **No portcullis, no murder holes, no drawbridge — those are `fort_gate`'s upgrade and must not appear here.** | ⛔ **FULLY REPLACED by `fort_gate` — owner ruling, see §0a. This row does not render in this age.** |
| `fort_wall` | full mortared stone `#9A968A`, **sloping batter at the base** | crenellated parapet | **Alternating merlons and crenels**, arrow loops through the merlons, machicolations at the exposed stretches. **TALL AND THIN IS CORRECT FOR THIS AGE** — height beats ladders and every siege answer is still muscle-powered. | **replaces `stone_wall`** |
| `fort_gate` | twin projecting DRUM towers `#9A968A` | crenellated | Vaulted passage between two drums, **iron-shod oak portcullis dropping in vertical stone grooves**, **murder holes in the vault above**, arrow loops, a **drawbridge on chains** over the moat. Often two portcullises with the space between them as a deliberate trap. | **replaces `stone_gate`** |

### F.6 Enlightenment Age — 18 buildings

| id | wall | roof | silhouette cue | chain |
|---|---|---|---|---|
| `towncenter` | symmetrical brick `#9E5744` / render `#D2C8B4`, **even rows of sash windows**, dentil cornice | hipped copper `#4E9E88` | **Georgian civic building on Palladian proportion**: central pedimented doorcase, paired chimneys at the gable ends. **This is the first building in the entire tech tree designed primarily to look ORDERED AND RATIONAL rather than to survive a siege, which is the whole story of the age in one silhouette.** | — |
| `house` | brick `#9E5744` or clapboard `#D2C8B4`, **symmetrical about a central door**, sash windows in regular bays | slate `#3E4650` | Modest classical doorcase, dentil cornice, **chimneys at BOTH gable ends**. Simple, repeatable, easy to vary by material and window count to get density without new models. | — |
| `storage_pit` | multi-story brick `#9E5744`, load-bearing, small regularly spaced windows | slate `#3E4650` | **Storehouse**: a **loading door on EVERY floor at the gable end served by an external HOIST BEAM and pulley.** The hoist beam projecting from the gable is the readable detail. Same logic as the Roman horreum, executed in brick. | **STOREHOUSE replaces STORAGE PIT** |
| `barracks` | multi-story stone or brick ranges `#D2C8B4` round a **central parade square** | hipped slate `#3E4650` | **The first purpose-built barracks in the whole progression** (Berwick-upon-Tweed, Hawksmoor, 1717–21). Paired-room company quarters repeating along each floor, separate mess and latrine blocks, **a formal pedimented gate. Regular, institutional and rectilinear — the visual opposite of the medieval bailey hall.** | — |
| `farm` | brick and stone ranges `#D2C8B4` round a yard | slate `#3E4650` | **The threshing barn**: a large aisled barn with **opposed wagon doors deliberately aligned to the prevailing wind**, raised granary loft above. Planned enclosure-era byres and cart sheds. **A horse-gin roundhouse attached to the barn end** hints at Meikle's 1786 threshing machine. | — |
| `archery_range` | brick equipment store `#9E5744` | shingle / slate `#3E4650` | **Reskin as a MUSKETRY range**: covered firing line under a shingle roof, an **earth backstop butt**, target frames, powder and ball store, cleaning benches. ⚠ **FLAG: archery is militarily obsolete this age.** Keeping the old turf butts in the corner as a decorative sporting range is a nice wink and costs nothing. | — |
| `stable` | brick or stone range `#D2C8B4` | slate `#3E4650` + **CUPOLA or CLOCK over the central archway** | **The Georgian estate stable block was an architectural showpiece in a way no earlier stable ever was** — the cupola over the archway is the whole point. Loose boxes off a cobbled aisle, hayloft with a pitching door, carriage house, cobbled yard with a mounting block and pump. | — |
| `watch_tower` | thick masonry `#D2C8B4`, round or square, **deliberately LOW profile** | flat gun platform behind a parapet | **Squat and thick-walled, designed to survive artillery rather than to loom.** Entrance at first-floor level, small magazine below, signal mast or beacon. The Martello pattern is where this logic ends up. Occupiable — the gun platform is the deck. | — |
| `tower` | low masonry platform with **embrasures for cannon** `#D2C8B4` | none — thick parapet | **A BASTION-MOUNTED GUN POSITION, not a tower.** Expense magazine below, sentry box at the salient angle. **If vertical read is needed for gameplay, add a slender timber lookout mast with signal flags — going tall in stone here would contradict everything the age's fortification is about.** | — |
| `siege_workshop` | brick or stone sheds `#9E5744`, **tall brick chimneys** | slate `#3E4650` | **Foundry**: a reverberatory furnace, a **casting pit with a crane gantry over it**, a horizontal boring machine, a proof yard outside for test-firing, charcoal and ore stacks, **finished barrels racked in rows in the yard.** **This is the first building in the entire set that is recognizably INDUSTRIAL and it should feel like it.** | **FOUNDRY replaces SIEGE WORKSHOP** |
| `blacksmith` | brick ranges `#9E5744` round courtyards inside a **walled precinct** | slate `#3E4650` | **Arsenal**: storehouses, armory, workshops, a rope walk and a **powder magazine** inside a defended enclosure. Regular window bays, **a formal gate with the royal arms carved above it.** Dress the yard with musket racks, shot pyramids, gun carriages under an open shed. | **ARSENAL replaces BLACKSMITH** |
| `wood_wall` | sharpened logs `#5A4630`, sloped earth bank behind | — | Firing step, and **CORNER BLOCKHOUSES of SQUARED timber with an OVERHANGING upper story and loopholes.** **Squared and pegged, against the medieval palisade's rough split logs**, so the two ages read differently even at the cheap tier. Against artillery it is completely obsolete — which is exactly why it is the age's cheap wall. | — |
| `wood_gate` | heavy braced plank doors between two blockhouses | shingle | Drawbar, firing platform above, **and a flagstaff.** Squared timber throughout. | — |
| `temple` | brick or stone preaching hall `#D2C8B4`, **round-arched or Palladian windows**, classical portico | **TIERED STEEPLE**, lead-sheathed `#8A9099`, tapering to a spire | **The tiered steeple is the tallest and most readable silhouette in the whole age.** Build it as 3–4 stacked classical stages of decreasing width, each with its own cornice, then the spire. Wren's post-1666 London churches set the pattern and it carried straight into colonial America. | — |
| `market` | **open arcaded ground floor as the trading piazza, enclosed assembly room above** `#9E5744` Flemish-bond brick | hipped `#3E4650` + **lead-coated CUPOLA/LANTERN** | **Exactly the same open-below, enclosed-above logic as the medieval market hall, now dressed in classical architecture — which is what makes it a great visual UPGRADE of the same building rather than a different one.** Add a classical portico and a parapet. | — |
| `stone_wall` | ashlar `#9A968A`, **an earth bank heaped against the inner face** | crenellated parapet, **partly cut down** | An old wall still standing in the gunpowder age, and it should look obsolete. Restyle: **the parapet is cut down in places to gun-platform height** and a raw earth backing bank is heaped against the inside — the cheap real-world retrofit. Keep it visibly taller and thinner than `fort_wall`, because that is now a liability rather than a virtue. | ⛔ **FULLY REPLACED by `fort_wall` — owner ruling, see §0a. This row does not render in this age.** |
| `stone_gate` | grey ashlar `#9A968A` | slate `#3E4650` | The twin drum towers survive but are **capped flat and mounted with a gun** rather than crenellated, and the passage gets a plain rusticated portal. Obsolete but serviceable. | ⛔ **FULLY REPLACED by `fort_gate` — owner ruling, see §0a. This row does not render in this age.** |
| `castle` | **LOW** masonry revetment backed by a deep earth core `#D2C8B4` | none — broad terreplein | **The star fort.** **DIAMOND-SHAPED BASTIONS at each corner replace round towers**, eliminating dead ground and letting defenders sweep every wall face with overlapping fire. A **sloped earth GLACIS** in front of the ditch absorbs shot. **The trade is firepower for height, and the drop in height IS the upgrade.** | **BASTION replaces CASTLE** |
| `fort_wall` | masonry revetment face, deep earth core `#D2C8B4` | terreplein wide enough to work guns | **Height is deliberately minimal.** Parapet with embrasures, ditch, sloped glacis rising to the covered way. **⚠ IF YOUR WALLS STILL LOOK TALL AND CRENELLATED IN THIS AGE, THE AGE HAS NOT VISUALLY LANDED.** | **replaces `stone_wall`** (and supersedes the Medieval fortified wall's tall crenellated form) |
| `fort_gate` | stone-faced passage through the rampart, **classical or rusticated portal** | — | Reached across the ditch by a bridge with a removable or drawbridge span. **Often the only decorative masonry on the whole enceinte** — carry the royal arms and a date stone. Guard rooms flank the passage. **SITING RULE: the gate always goes in a CURTAIN face covered by two adjacent bastions, never in a bastion itself.** | **replaces `stone_gate`** |

### F.7 Coverage

**81 (age, building id) rows** across **20 building ids**, every one written out above:

| age | new this age | carried forward | rows |
|---|---|---|---|
| 0 Stone | `towncenter` `house` `storage_pit` `barracks` | — | **4** |
| 1 Bronze | `archery_range` `stable` `farm` `watch_tower` | 4 | **8** |
| 2 Iron | `siege_workshop` `wood_wall` `wood_gate` `blacksmith` | 8 | **12** |
| 3 Classical | `tower` `temple` `market` `stone_wall` `stone_gate` | 12 | **17** |
| 4 Medieval | `castle` `fort_wall` `fort_gate` | 17 | **20** |
| 5 Enlight. | — (three replacements, no new ids) | 20 | **20** |
| | | | **81** |

Every row inherits its age's shell from **F.0** — wall hex, roof hex, roof pitch, trim, base course
and eave — and states only what is specific to that building in that age.

**Unlock ages are `BLD.<id>.age` in `js/00-data.js:178-182` and this table matches them.** Note that
`market.age = 3`, so the Market appears in the Classical age even though the CSV only documents it
from the Medieval age on; the Roman macellum in F.4 is derived, not sourced, and is flagged as such.

`stone_wall` / `stone_gate` are specified for ages 3–5 because an already-placed wall persists and is
restyled by `_restyleOneBuilding` even after `fort_wall` unlocks — **the replacement chain is a
build-menu replacement, not a demolition.** See §I open question 5 if that reading is wrong.

---

## §G — WHAT MUST NOT MOVE

Everything in this section already binds. It is restated here in full so that **an implementer who
reads only this document cannot violate one of them.** Each has burned this codebase or is
documented as about to.

### G.1 The 11-cluster merge, and one material per unit

Units were 86% of the scene's draw calls at 22.8–33.4 per unit. `_mergeCluster` (`js/04-units.js`)
welds each animated node's rigid subtree into **one mesh on `UATLAS.material()`**. The clusters are
`_MERGE_NODES`: `legL, shinL, legR, shinR, torso, head, armL, faL, armR, faR` plus the beast and
siege extras (`musketG, bowG, goods, horseG, horseNeck, arm, barrel, gunSG, log`). **Eleven is the
floor without moving to skinning** — knees and elbows rotate independently, so a leg is two clusters
and an arm is two.

> **EVERY new costume part in this document must parent into an EXISTING cluster. Zero new draw
> calls. A new part that needs its own animated transform is out of scope, not a design decision.**

- `_mergeCluster` bails at `parts.length < 2` — a lone mesh ships unmerged with its own material.
- **Do NOT add a twelfth animated rig node** (§10.11). No hinged jaw. It is +1 draw call per unit
  × up to 136 bodies and it breaks the `fm <= 12` assertion at `tools/smoketest.js:2196`.
- **Do NOT set `castShadow` on anything parented to `R.head`** (§10.12). `_mergeCluster` does
  `castShadow = parts.some(p => p.shadow)`, so one shadow-casting hat silently turns the head cluster
  into a shadow caster for all 136 bodies. **This document adds a hat to every unit — this is the
  single most likely way to regress performance while implementing it.** Use the existing `_noSh()` /
  `noShadow()` wrappers on every part in §B and §C.
- Only plain toon materials fold into the atlas: `_mergeableMat` requires
  `isMeshToonMaterial && !transparent && !flatShading && side === FrontSide`. **A part authored with
  `flatShading: true` silently drops out of the merge and costs a draw call.** §6.3a's "faceted
  normals" means *more facets in the geometry*, not `flatShading` on the material.

### G.2 Merged geometry is per-unit and is never cached per class

`_mergeGeo` bakes the team colour and the id-derived skin/beard tone into the geometry's **vertex
`color` attribute**. Two soldiers of the same class have different beard tones and possibly different
teams, so **their merged geometries are not interchangeable.** Caching a merged geometry by class id
would give every unit of that class one beard, one skin tone and one team. Merge per unit.

### G.3 `_skinCache` materials are shared and are never disposed

`texturedMat`, `headMaterials`, `heraldryMat` and `plainMat` all write into `_skinCache` and register
into `_skinMats`. `isSharedMat()` is the arbiter (`js/01-engine.js:1157`). The merge disposes the
materials it owns — the ones minted by `mat()` / `box()` / `cyl()` / `cone()`, which cache nothing —
and **must not** dispose a shared one. **Do not add a disposal path for anything `isSharedMat()`
returns true for.**

### G.4 New colours are free. New TEXTURES are not — and neither is minting them at the wrong time

Two separate budgets, and this document's 50 unit rows and 81 building rows can blow both:

1. **Atlas cells.** `_mergeCluster` uses `UATLAS.slot(t)` for a mapped material and
   `UATLAS.whiteSlot()` for an unmapped one. **An untextured material costs NO atlas cell** — its
   colour rides in the vertex attribute. **The atlas budget is ~130 and it is at 103.**
   > **HARD CAP: the whole age overhaul may add at most 20 new `texturedMat(kind, hex)` pairs**,
   > leaving 7 cells of headroom. Everything else uses `plainMat(hex)` or `mat(hex)`, which are free.
   > That is why §A.3 says "every hex is a flat colour unless a pattern is named."
2. **The seeded `Math.random()` window — this is the sharp one.** `_blocks()`, the 2px weave fill
   inside `texturedMat`, **calls `Math.random()`**. §10.7 forbids changing the *number* of
   `Math.random()` calls at or before `plantForests()` in `js/02-world.js`: the seeded window
   (`js/02-world.js:18-19` → `:628`) places `nodes[]`, and the netcode indexes nodes **positionally**
   (`js/10-net.js:1614`). Buildings are constructed during world gen and `aWall(age)` →
   `texturedMat` → `_blocks` → `Math.random()`.
   > **Any new `(kind, hex)` pair that can first be minted inside the seeded window shifts every
   > resource node position and index on every peer and forces a PROTO bump.** World-gen placement
   > is on the wire at **PROTO = 26** and must not change.
   > **THE FIX IS PRE-WARMING: mint every new textured pair once, at boot, before the seeded window
   > opens.** A cached pair costs zero `Math.random()` calls on every later request.

### G.5 Unit appearance is a pure function of `u.id` — never `Math.random()`

`SKIN_TONES[u.id % SKIN_TONES.length]` (`js/04-units.js:1030`) is the established pattern, and
`[…][u.id % 4]` appears at `:500` and `:912`. Every per-unit variation this document introduces —
`BEARD_TONES`, `age0.flint`'s four stones, horse coats, the `skirmisher`'s three hats — **must use
it.**

> **`Math.random()` in unit appearance desyncs peers, and unlike a wrong colour a desynced one
> cannot be spotted in a screenshot.** Host and guest render the same soldier differently and nothing
> in the sim notices.

For buildings the equivalent rule is §10.15: **hash `(x, z, type, age)`, never `Math.random()`.**
`_restyleOneBuilding` rebuilds the mesh from scratch on every age-up, so a random seed reshuffles the
whole town on every age and host and guest render different towns.

### G.6 ALL COLOUR CALIBRATION GOES THROUGH `composer.render()`. NEVER `renderer.render()`

**This is the most important line in this section, and there is a live defect behind it.**

The shipped beard clipped to `(255,255,247)` — ~6,900 flat pixels per figure, red and green both
pegged, every fold gone, 100% of the game's clipping — because `nc.beard #F7F3E8` (luma 0.949) was
calibrated through `renderer.render()`, while the game and `tools/vista.js` both draw through
`composer.render()`, whose `UnrealBloomPass` high pass is `smoothstep(0.86, 0.87, luma)`. The colour
was *provably correct* under the wrong render.

**The tools that would be used to calibrate 42 new costumes have the same bug today:**

- **`tools/unitshot.js:53` — `for(let i=0;i<3;i++)renderer.render(scene,camera);`**
- **`tools/cartshot.js:49` — `renderer.render(scene,camera);`**

`tools/vista.js:75`, `tools/phoneshot.js:79` and `tools/inkweight.js:42` all do it correctly:
`if(typeof composer!=="undefined"&&composer)composer.render(); else renderer.render(scene,camera);`

> **BLOCKER: `tools/unitshot.js` and `tools/cartshot.js` must be moved onto the composer BEFORE a
> single costume in this document is calibrated.** `unitshot.js` is *the* per-class screenshot tool
> and `cartshot.js` is the tool for §E. Authoring 42 costumes and 3 carts against `renderer.render()`
> would bake the beard's exact mistake into every unit in the game, and it would do it invisibly,
> because every screenshot would look correct.

Derived hard limits, which are what the composer actually enforces:

- **No large flat surface may exceed 216 in any channel.** That is the ceiling the buffer prints
  (`CLOUD_TOP`, luma 0.853, against the 0.86 bloom cliff). Every hex in §A.3 respects it; the tightest
  are `age1.crown #DCCFAA` (220 — **this one is over and is flagged in §I open question 2**),
  `age3.marble #DDD4BE` (221 — **also over**), `age5.buff #D8CFB8` (216, exactly at it).
- **No beard tone may exceed luma 0.62** (§2.6a).
- **No pure white anywhere except unit teeth** (§10.22 / F1).

### G.7 Everything else that still binds

- **Ink hulls: do NOT add them to unmerged buildings** (§10.19). +1 draw call per outlined mesh ×
  ~26 meshes per building undoes the entire merge win.
- **Do NOT create a material per unit or per unit-part** (§10.6).
- **Do NOT set `vertexColors: true` on geometry with no `color` attribute** (§10.8) — it renders
  black.
- **Do NOT change `makePixelTexture()` to add mipmaps** (§10.14) — it is shared by every 16px unit
  skin, building skin and heraldry texture.
- **Do NOT raise `BARH` or `BSCALE` without checking `tools/smoketest.js:338`** (§10.20).
- **HUD headroom** (§5.4): the health bar and name tag move with the silhouette. This document puts a
  hat mass on **every** unit including the ones that had none; `OX_BAR_Y` / `OX_TAG_Y`
  (`js/04-units.js:37-38`) is the established mechanism and the king — the tallest figure in the
  game at head + 0.20 H of crown — is the one to size against.
- **Building age changes must move silhouette, not texture** (§5.7). `blacksmith`, `watch_tower`,
  `tower`, `castle` (ages 0–4) and walls currently ignore age entirely and are brought onto the
  ladder by §F.

---

## §H — HOW A RENDER IS SCORED FOR AGE

These are additions to `ART-DIRECTION.md` §11's F1–F11, numbered from A1 so they do not collide.
**They are written so they can FAIL.** Each states its input, its procedure and its threshold.

> **PRECONDITION FOR EVERY TEST BELOW: the render must come from `composer.render()`.** A test run
> through `renderer.render()` is void, and §G.6 must be discharged first.

### A1 — THE SIX-AGE CROWN TEST (the primary gate)

**Input.** `tools/unitshot.js`, composer-fixed, one unit per age from the same line — use the melee
line: `clubman, shortsword, broadsword, legionaire, vanguard, musketeer`, all team Blue, `u.id = 0`.

**Procedure.**
1. Crop each shot to the figure's bounding box.
2. Crop the **top 28% of that box** (the crown region).
3. Downsample the crop to a **single pixel** (area average), giving one sRGB triple per age.
4. Compute CIEDE2000 between all **15** pairs.

**Threshold. FAIL if any pair is below ΔE00 = 12.**
Reference values from §A.2 are 14.5 minimum, so the design has 2.5 of headroom; anything under 12 in
a render means a costume has drifted or the ramp is crushing chroma.

### A1b — THE SIX-AGE CROWN **SILHOUETTE** TEST (added v1.4 — the gate A1 could not catch)

**Why this exists.** A1 measures ΔE00 on a colour crop. The v130.7 build passed it at 12.7 — and was
still wrong, because **every age's headwear was `kitShako()` with different hexes**: a flared
truncated cone plus a brim disc plus a band, six times, with a decoration bolted on. Six shakos in
six colours score beautifully on a colour test. The owner caught it by looking; the spec could not.
**A1 and A1b must BOTH pass.** See `ART-DIRECTION.md` §6.5a for the six required forms.

**Input.** The same six melee units as A1, rendered head-on through `composer.render()` against a
flat background of known colour.

**Procedure.**
1. Crop each figure's **head region** — from the chin line to the top of the hat.
2. Threshold against the background into a **binary mask**. Colour is now gone entirely; only shape
   remains. This is the whole point of the test.
3. Normalise each mask to the same bounding-box height (the hats differ in size, and that is a
   legitimate difference, not the one being measured here).
4. For all **15 pairs**, compute **IoU** (intersection over union) of the two masks.
5. Separately record each hat's **height / width ratio**.

**FAIL if:**
- **any pair has IoU > 0.70** — two hats that overlap by more than 70% of their combined area are
  the same shape wearing different paint; **or**
- **any ADJACENT pair's height/width ratio differs by less than 0.15.** §6.5a's targets are
  dome 0.55 · cone 1.25 · bell 0.80 · Gallic 0.70 · great helm 1.05 · shako 1.15; **or**
- **more than one age has a flat horizontal brim disc.** The brim is Enlightenment's alone — it is
  the single strongest silhouette cue in the set and spending it on all six is what flattened them.
  Stone, Bronze and Medieval have no brim at all; Iron has an *everted rim*, which is a different
  shape; Classical has a rear neck guard instead.

**Report the 15 IoU values and the 6 ratios in full.** A summary sentence is not a result — the whole
reason this test exists is that a summary ("the ages are distinct") was true of colour and false of
shape at the same time.

### A2 — THE SIX-AGE DOMINANT TEST

Same inputs. Crop the **torso band, 28%–58% of the figure's height**, excluding the team-coloured
coat panel by masking pixels within ΔE00 12 of `TEAMCOL[0]`. Downsample to one pixel per age.

**FAIL if any of the 15 pairs is below ΔE00 = 12, or if any ADJACENT pair (0-1, 1-2, 2-3, 3-4, 4-5)
differs by less than |ΔV| = 0.25**, with `V` as defined in §A.0.

### A3 — THE 40px GREYSCALE STRIP

**Input.** All six melee units composited into one strip, each scaled to **40px tall**, converted to
greyscale (`V`), then blurred with a 1px Gaussian to simulate the phone buffer.

**FAIL if:**
- any two of the six are within **|ΔV| = 0.10** on their **whole-figure mean**, **AND** within
  **ΔE00 = 12** on their full-colour mean (i.e. they are indistinguishable both ways); or
- any single unit's own **five-band ladder** (hat / head+beard / coat / trousers / boots) has an
  adjacent pair under **0.25** (this is §6.2 / F3, applied per age).

**This test is allowed to pass on value alone OR on chroma alone, but not on neither.** That
asymmetry is deliberate — see the Iron/Medieval and Stone/Medieval collisions noted in §A.2.

### A4 — THE INTRA-AGE SEPARATION TEST

An age that reads as one age but whose units read as one unit has failed differently. **Input:** all
units of a single age, e.g. age 2 = `broadsword, impspear, imparcher, heavycav, batteringram,
catapult, villager`.

**FAIL if any two are within ΔE00 = 8 on their whole-figure mean AND indistinguishable as 40px black
silhouettes** (§5.2.1). The CSV is explicit about which pairs are at risk and how they are separated:
`clubman`/`spearman` by dome-vs-flat-top plus the diagonal strap; `shortsword`/`spearfighter` by the
presence of cheek pieces and stacked vs single shoulder guards; `broadsword`/`impspear` by the
horsehair tuft and the shield; `vanguard`/`knight` by flat helm vs pointed snout;
`musketeer`/`skirmisher` by the TC/green inversion; `cannon`/`culverin` by barrel length.

### A5 — THE TOWN ROOFLINE TEST (the AoE rule, made failable)

**Input.** `tools/vista.js`, one shot per age of the same town from the same vantage, at the same
time of day. Crop each to the roofs only — everything above the eave line — and downsample so the
largest roof is **40px across**.

**Procedure.** Present the six crops to a critic in randomised order with the six age names, as a
forced-choice matching task.

**FAIL at fewer than 6/6 correct.** Five out of six is a fail: it means two ages are being told apart
by elimination, not by looking.

**Secondary, automatic:** compute the mean colour of each roof crop.
**FAIL if any pair is below ΔE00 = 12** (design minimum is 13.8 — see §F.0), **or if the measured
roof pitch of any two adjacent ages is within 6°** of each other.

### A6 — THE ROOF/WALL CONTRAST SWEEP

For each of the 81 (age, building) pairs, eyedropper the roof's sunlit face and the wall's sunlit
face. **FAIL if |ΔV| < 0.25**, with the two stated exemptions and no others:
- **Bronze Age flat roofs** — measure the 0.10 H cornice band against the wall instead.
- **Age 5 copper ornament** (cupolas, steeples, domes) — exempt as ornament; measure the building's
  primary slate roof instead.

### A7 — THE KING GATE

**Input.** Six `unitshot` frames of `king` at `teamAge` 0–5, Blue and Red.

**FAIL if:**
- the top **0.20 H** of any king does not contain a contiguous `#CFB53B`-family region (within ΔE00
  10 of gold) at least **0.10 H tall and 0.90 × headWidth wide**; or
- any king's silhouette below the belt **splits into two legs** at 40px — the robe must read as one
  solid trapezoid (§6.5); or
- the six crowns are not mutually distinguishable at 40px by form alone as pure black silhouettes.

### A8 — THE CLIPPING AND CEILING SWEEP

Over the whole unit strip and the six vista shots, through the composer:

- **FAIL if more than 2% of pixels are clipped to 255 in any channel** (§3.6 / F8).
- **FAIL if any surface other than unit teeth reads above 216 in all three channels over a region
  larger than 200px²** (§10.22 / F1 tightened to the buffer's real ceiling).
- **FAIL if any beard pixel exceeds luma 0.62** (§2.6a).

### A9 — THE DETERMINISM SWEEP

Render `unitshot` for every class twice, in **two separate processes**, and diff.

**FAIL on any byte difference in the unit region.** This catches a `Math.random()` that reached unit
appearance (§G.5). Run it once per costume batch — it is cheap and it is the only test that catches a
desync, because a desynced unit looks perfectly correct in any single screenshot.

### A10 — THE DRAW-CALL **AND TRIANGLE** SWEEP

`tools/unitshot.js` already reports `meshes/materials` per class. **FAIL if any class reports more
than 12 meshes after merge**, or if `tools/drawcost.js` shows camera-pass draw calls above baseline
(678 start / 975 base) at the same vantage (§9.3 / F9). Run before and after each costume batch —
**the most likely regression while implementing §B and §C is a hat that quietly costs a draw call**
(a lone unmerged mesh, a `flatShading` material, or a `castShadow` on a head part).

**AND THE TRIANGLES, added v1.5, because nobody owned them.** Draw calls went *down* 64 across the
v130.7 batch while per-frame vertex cost went up, and no lane reported the second number: the units
lane reported tris/unit, the buildings lane reported calls and atlas cells, and the static scene had
no owner at all. A gate that only counts calls will approve a build that halves the frame rate on
the host in the field logs, because r128 submits a 60,000-triangle merged mesh in one call.

**Input.** `tools/artcheck.js <label>`, which now prints both halves and writes them to
`metrics.json`. Both come from `tools/drawcost.js` at ONE vantage.

**FAIL if:**
- the **static scene** (`drawcost` "scene WITHOUT units") is more than **15% above the recorded
  baseline** — `BASE_METRICS.drawcostBase.staticTris` in `tools/artcheck.js`; or
- **tris per unit** is more than **15% above** `drawcostBase.trisPerUnit` without the owner
  accepting it in the same round.

> **DO NOT COMPARE A `drawcost` TRIANGLE COUNT WITH A `vista` ONE.** This is not pedantry; it is the
> bug this clause was written to close. `vista.js`'s read-out is the composer at the 06-wide camera
> and `drawcost.js`'s is `renderer.render` at a Town Centre closeup — different frustum, different
> viewport, different cull. `artcheck.js` used to subtract one from the other and print the result
> as `delta.tris`, which reported **+197,366 triangles** for a batch whose static scene had in fact
> gone **down 402**. A critic scored a lane on that number. Each baseline is now labelled with the
> tool that can reproduce it, and the gate reads only the one that has a camera it drives.

**Re-baselining is an owner decision, not a lane's.** When a batch legitimately spends triangles,
update `drawcostBase` in the same commit that spends them and say what bought it — otherwise the
next batch inherits the spend as free headroom, which is how a budget stops being one.

---

## §I — OPEN QUESTIONS FOR THE OWNER

These are the things I could not resolve without inventing an answer. They are listed rather than
guessed.

1. **`ART-DIRECTION.md`'s "screen value" column is not from one formula.** `grass.lit #86A63F` is
   listed at 0.39; Rec.709 on encoded bytes gives 0.595, on linearised bytes 0.327, HSL lightness
   0.449 — none match, while `sand.base #CFB98C` at 0.72 matches encoded Rec.709 (0.731) exactly. I
   have defined `V` explicitly in §A.0 so this document's tests are reproducible, but **§2.2/§2.3 of
   the parent document should be recomputed against one formula**, and until that happens a critic
   comparing a §2 number with a §A number is comparing two different quantities.

2. **Three colours sit at or over the 216-per-channel ceiling and I have not silently darkened them.**
   `age1.crown #DCCFAA` (max channel 220) and `age3.marble #DDD4BE` (221) are both over; `age5.buff
   #D8CFB8` (216) is exactly at it. All three are large flat garment areas. Dropping them to 214
   costs about 0.02 of V and keeps every ladder passing — but the Bronze crown is the top rung of the
   crown ladder and I would rather the owner make that call than take 0.02 off the brightest thing in
   the age. **Recommendation: drop `age1.crown` to `#D6C9A4` and `age3.marble` to `#D6CDB6`, and
   re-run A1.**

3. ~~**The viking's horns.**~~ ✅ **RESOLVED — see §0a.2.** Put to the owner explicitly and confirmed:
   **horns on BOTH `viking` and `vikingboss`.** Yes, the horned helmet is a 19th-century opera
   invention with no archaeological basis — and this document is strict about the CSV's history
   everywhere else. It loses here on purpose. This is a game whose soldiers are Christmas
   nutcrackers; §0's rule that canon wins on silhouette is exactly what this case is for, and the
   horns are what makes a raider read as a raider at 40px. The spangenhelm alternative is withdrawn.

4. **Classical crimson vs team red.** `age3.crimson #A83228` is 7° off team red at high chroma. I have
   capped it at 6% of unit surface, which keeps a red-team legionary legible, but the Roman crest
   really wants to be a large saturated red mass and the cap makes it a thin one. **If the owner
   would rather have the big crest, the alternative is to move the Classical crest to
   `age3.brass #C9A03C` gold-yellow horsehair** — less canonical, no team conflict, and it would
   strengthen the age's brass read. I did not make that call.

5. ~~**`stone_wall` / `stone_gate` after age 4.**~~ ✅ **RESOLVED — see §0a.1.** The owner's answer is
   *fully replaced*. The 6 age-4 and age-5 rows I wrote for these two ids are **dead** and are struck
   in §F. The wall ladder is three rungs, not five: **wood → stone (age 3 only) → fortified (4–5).**
   Nothing Classical-dressed or "obsolete" may stand in a gunpowder-age town.

6. **The Bronze Age flat roof and §5.5.** A flat roof cannot satisfy "roof is 45–60% of building
   height" or "roof pitch 35–45°", and the CSV is emphatic that flat-roofed cubic massing is the
   Bronze Age's whole contrast against the Stone cone. I have written the exemption in §F.0 and moved
   the contrast onto a cornice band. **This is a real amendment to §5.5 and should be blessed as one**
   — or the Bronze Age gets a low pitched roof it did not historically have, and loses its silhouette
   contrast with both its neighbours.

7. **`archery_range` and `barracks` are flagged as historically nonexistent in four of six ages**
   (Neolithic barracks, Bronze/Iron/Classical archery ranges, medieval barracks, Enlightenment
   archery range). The CSV proposes an honest stand-in for each and I have specified those. **They
   will still look like inventions to anyone who knows the period.** If that matters more than
   gameplay slot continuity, the alternative is to let those two buildings share one generic
   "training compound" form across the ages where no precedent exists — which is cheaper and less
   pretending. I have assumed gameplay continuity wins.

8. **Villager gender variants.** The CSV specifies women's dress for four of the six ages (linen
   sheath dress, kirtle and apron, mob cap and petticoat, wimple). The `villager` class has no gender
   field and adding one is a data change, not an art change. I have specified the male line only.
   **Should `u.id % 2` drive a gender variant?** It would be free (it is already the id-derived
   pattern) and it would roughly double villager variety, but it is a scope decision.
