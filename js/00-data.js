/* REGICIDE PVP — 00-data.js */
"use strict";
/* ============================================================
   KINGSLAYER — single-file vertical slice
   You are one villager among many. Gather, build, take up arms,
   and slay the enemy king. Bots stand in for the other players.
   ============================================================ */

// ---------- data ----------
const BLUE=0, RED=1, NEUTRAL=2; // team 2: the wilds — creep camps, hostile to both crowns
// ART-DIRECTION §2.5. The old blue/red pair (0x3d6ef2 / 0xd94a3d) were both light and both
// desaturated, so at 40px the two armies were one grey smear; these are darker and further apart
// in hue, which is what lets a coat carry the team read without a banner. The wilds move off olive
// because olive IS the grass — a neutral creep was camouflaged against the map it stands on.
const TEAMCOL=[0x2E5FD8,0xD62B2B,0x9AA0A8];
const TEAMNAME=["Blue","Red","Wilds"];

// THE NUTCRACKER PALETTE — ART-DIRECTION §2.6, fixed and not negotiable.
// Every part of a unit that carries the five-band value ladder (hat / beard / coat / trousers /
// boots) reads its hex from here. The point of centralising it is that the barcode cannot drift
// one class at a time: the measured baseline was 0.35→0.72→0.90→0.72→0.88→0.72→0.35, i.e. one
// skin tone with two white spots, precisely because eighteen hat blocks each picked their own grey.
// Only `coat` is team-driven — swapping its hue leaves every other band's VALUE untouched, which
// is the whole reason the coat is where team colour goes (§6.6).
const NC={
  black:0x252525, blackD:0x131315,          // shako, boots, belt — never #000000, it kills the ramp
  gold:0xCFB53B, goldD:0x8C6D2B, goldH:0xEBD46A,
  trouser:0xEDE7D3, trouserD:0xBDB49A,
  // v130.7 THE BEARD WAS 100% OF THIS GAME'S CLIPPING, AND IT WAS MEASURED THROUGH THE WRONG RENDER.
  // §2.6 authors #F7F3E8 (luma 0.953) and v130.6 dutifully divided it by the ramp's LIT gain so it
  // would land back on that swatch. It does — under `renderer.render()`. But the game and vista.js
  // both draw through `composer.render()`, and UnrealBloomPass's high pass is
  // smoothstep(0.86, 0.87, luma), so at 0.949 the beard sat ON the cliff, self-composited, and came
  // out (255,255,247) — two channels pegged, ~6,900 flat pixels per figure, 2,682 clipped px in the
  // town shot and 5,905 in the crowd shot with this surface as the top colour in both. A clipped
  // surface has no form by definition, which is the whole reason the beard read as a folded paper
  // bib instead of hair.
  // The engine lane hit the identical cliff on the clouds and wrote the answer down (01-engine.js,
  // CLOUD_TOP): "218 is the ceiling the buffer prints, not a preference — luma 0.853, and the bloom
  // cliff is at 0.86." This is that ceiling, applied to 136 bodies. Dropping 0.12 of luma is safe
  // for §6.2's ladder because the head+beard band's median is carried by the FACE facet at
  // 0.62-0.65, not by the beard — all four adjacent deltas stay above 0.25 with margin.
  // CALIBRATE THROUGH THE COMPOSER. Any future re-derivation of these whites that uses
  // `renderer.render()` will "prove" the bright value is fine and put the clipping straight back.
  // v131 …AND THE ANSWER WAS NEVER A DARKER WHITE. v130.7 read the clipping correctly and then
  // treated it as a brightness problem, so the beard went from #F7F3E8 to #D8D4C4 and stayed a
  // pale slab. §2.6a says what it actually is: every beard in docs/ref/nutcracker-reference.png is
  // WARM CARVED WOOD — chestnut, auburn, walnut, one golden blonde — and not one of them is white.
  // A brown beard is nowhere near the 0.86 bloom cliff, so the art direction and the bug have the
  // same answer and neither of these two keys has a reader left. They stay only so that a future
  // grep for `nc.beard` lands here and reads why, rather than finding nothing and reinventing it.
  beard:0x6B4A2E, beardD:0x4D3521,          // SUPERSEDED by BEARD_TONES below — see §2.6a
  face:0xEFC49A, faceD:0xC2916A, cheek:0xD9584E,
  teeth:0xFFFFFF,                           // the ONLY pure white permitted anywhere in the game
  mouth:0x1A1210, eye:0x14100E,
  brow:0x2A1D12                             // §6.3b.3: heavy dark brows, warm — not the eye's black
};

// THE BEARD IS CARVED WOOD AND IT VARIES PER UNIT — ART-DIRECTION §2.6a — **AND PER AGE**.
//
// v131.2 THE BEARD WAS THE BIGGEST CONSTANT IN §H A2'S OWN CROP, AND IT IS MEASURED.
// The previous table was five warm browns picked by `u.id % 5` with no age term at all. Measured
// through the composer with the beard left IN the crop the way the written gate has it, the beard
// was 22–52% of A2's 28–58% band on every age (Stone 52%, Classical 51%, Iron 46%) and it came
// back the same brown at hue 28–40° on all six: #523B23 / #897250 / #7E5D42 / #8F764A / #695A44 /
// #6E5A31, worst pair ΔE00 **3.1** against a floor of 12, all five adjacent |ΔV| under 0.25 and
// the Medieval/Enlightenment pair at 0.001. That is the same defect as the gold epaulettes that
// were correctly taken OFF all six shoulders — a constant sitting in the middle of the one region
// the gate looks at — except the beard is three times the area. The small one was fixed and the
// big one shipped.
//
// >>> THE SELECTION IS `BEARD_TONES[unitAge(u)*3 + u.id % 3]`. AGE-MAJOR, THREE TONES PER AGE. <<<
// The array stays FLAT and stays an array of plain ints on purpose: tools/agecheck.js flags the
// beard for measurement by overwriting every slot with a green sentinel and re-shooting, so a
// nested table would silently blind the only tool that can see this surface.
//
// §G.5 still binds and is not weakened by this: `(u.id, age)` is a pure function of state every
// peer already agrees on — a class's age is fixed in CLS, and the villager's and the king's is
// `teamAge[u.team]`, which is sim state. NEVER Math.random(): a beard drawn from the casino makes
// the host and every guest render the same soldier differently, and unlike a wrong colour a
// desynced one is invisible in a screenshot — you only ever find it in the source.
//
// THE LADDER, and why it is shaped this way. It AMPLIFIES each age instead of averaging it:
//   0 Stone   dark walnut, warm      V 0.15-0.20  under a dark warm hide  → pushes the age darker
//   1 Bronze  flaxen honey, YELLOW   V 0.50-0.56  under cream linen       → the pale rung
//   2 Iron    auburn rust, RED       V 0.29-0.38  under cool grey scale   → the only red beard
//   3 Classical silvered ash, NEUTRAL V 0.51-0.56 under bright steel      → light like Bronze and
//       separated from it by CHROMA, which is exactly the mechanism §A.2 uses for its own two
//       deliberate collisions. Do not "fix" this pair by pulling one of them on value.
//   4 Medieval dark grey-brown       V 0.23-0.28  under matte mail
//   5 Enlight. near-black            V 0.12-0.17  under black felt
//
// CEILING: §2.6a caps a beard at luma 0.62 and §H A8 fails on any beard PIXEL above it. Measured
// through composer.render(), a beard's brightest pixel comes back at ~1.06x its authored luma and
// its mesh mean at ~0.80x, so the authored ceiling is 0.58 and the lightest tone here is 0.564.
// Authored luma is not the number that matters and never was; the whole 6,900-clipped-pixels-per-
// figure episode happened because someone measured through `renderer.render()`.
// These are FLAT colours: plainMat() costs no atlas cell and makes no Math.random() call, so
// eighteen beards are eighteen free hexes rather than eighteen of the ~27 cells left (§G.4).
// v131.4 AGE 3 GOES DARK WALNUT AND AGE 2 GOES DEEPER, AND BOTH ARE §6.3c AND NOT §H A2.
// §6.3c's acceptance test is "at 40px greyscale it must read as a TRIANGLE", i.e. it is about a
// value EDGE against whatever the beard hangs in front of — and it failed on all six ages for two
// rounds. Measured through the composer against a 3px ring: Classical came back beard 0.442 vs
// surround 0.446, FOUR THOUSANDTHS, because a silvered-ash beard was placed against polished-steel
// armour; Iron 0.132. The silvered ash was chosen so this age would sit apart from Bronze on
// CHROMA rather than value — a §H A2 argument — but §H A2's crop masks the beard out, so that
// argument was buying nothing while §6.3c paid for it. Age 3's armour is the brightest surface in
// the game, so its beard is the darkest: #2.6a's own dark walnut, which the amendment describes as
// "reads almost black at 40px — good, it deepens the ladder".
const BEARD_TONES=[
  0x322416,0x3C2A1A,0x2C2013,   // 0 STONE — walnut-black; unkempt, and it reads as the hat's twin
  0x6E5228,0x624820,0x786030,   // 1 BRONZE — dark honey. §6.3c is a VALUE EDGE and the flaxen tone
                                //   measured 0.163 against the cream it hangs on; the age is pale,
                                //   the beard on it is not, and that IS the edge.
  0x562C16,0x4C2712,0x60341A,   // 2 IRON — deep auburn rust; the one red beard in the game
  0x4A3524,0x412E1F,0x533B29,   // 3 CLASSICAL — §2.6a's dark walnut, under the brightest armour
  0x3A322C,0x342D28,0x413830,   // 4 MEDIEVAL — dark grey-brown, matte, no warmth to speak of
  0x24262A,0x1E2024,0x2A2C30    // 5 ENLIGHTENMENT — near-black, and the one COOL beard: §H A2
                                //   cannot separate this age on value (its crop is ~45% face), so it
                                //   is separated on chroma, the way §A.2 separates its own two
                                //   deliberate collisions. Never #000000 (§2.6).
];
// §2.6a: "Pair the moustache one step darker than the beard, as a separate bar." Same age-major
// layout, index for index. Authored as literals rather than derived with offsetHSL at load: a
// float HSL round-trip can hand back two hexes one byte apart for what is meant to be one colour,
// and every distinct hex that reaches texturedMat costs an atlas cell (the same trap _TEAM_JERKIN
// in 04-units.js is memoised against).
const MOUSTACHE_TONES=[
  0x241A0F,0x2C1E12,0x1E160D,
  0x503A1C,0x473317,0x584523,
  0x3E2010,0x371B0D,0x452513,
  0x2A2420,0x25201C,0x2F2822,
  0x352E28,0x2F2A25,0x3B322A,
  0x191B1E,0x151719,0x1E2023
];
// §2.6b THE ELDERS. One nutcracker in five is an old man, chosen by `u.id % 5 === 2` — the same
// kind of rule SKIN_TONES uses, deterministic, never Math.random(), and coprime with both the
// beard slot (%3) and the skin slot (%4) so greyness does not track either.
// ONE TONE PER AGE, AND TWO OF THEM ARE DELIBERATELY DARK. §6.3c is a VALUE edge, not a hue: the
// beard has to read as a triangle at 40px greyscale against whatever is behind it. Bronze hangs
// on a cream tunic and Classical under the brightest armour in the game, so a white beard on
// either would dissolve into its own chest — the table above already records those two failing at
// 0.163 and 0.004 for exactly that reason. Grey in CHROMA on all six; light or dark in VALUE
// according to what it hangs on. Never #FFFFFF, for the same reason §2.6 bars #000000.
const ELDER_TONES=[
  0xBFB9AE,   // 0 STONE          light ash, against dark hide and timber
  0x6E6B65,   // 1 BRONZE         mid-DARK grey: the age is pale and the beard must not be
  0xB0AAA1,   // 2 IRON           light warm grey over the rust ladder
  0x585249,   // 3 CLASSICAL      DARK grey: polished steel is behind it
  0xB2ACA2,   // 4 MEDIEVAL       light grey on matte cloth
  0xBCBEC2    // 5 ENLIGHTENMENT  cool silver — the one cool age keeps its chroma direction
];
// §2.6a: 'pair the moustache one step darker than the beard, as a separate bar.' Same rule here,
// authored as literals rather than derived, for the reason MOUSTACHE_TONES gives above: an HSL
// round-trip hands back hexes a byte apart and every distinct hex is another cached material.
const ELDER_MOUSTACHE=[0xA79F94,0x5B5852,0x97918A,0x46413A,0x99938B,0xA2A4A8];
// The age a beard belongs to, given a unit. Kept beside the table so the one indexing rule lives
// with the data it indexes; 04-units.js calls this and never does the arithmetic itself.
const BEARD_PER_AGE=3;

// ============ THE SIX AGES AS A PALETTE LADDER — AGES §A.3, hex for hex ============
// THE FAILURE THIS EXISTS TO FIX IS MEASURED, TWICE. The v130.7 build's six torsos came out
// #785a41 / #957650 / #886c4a / #8a735e / #7d6755 / #7d6140 — six browns, worst pair ΔE00 3.8
// against §H A2's floor of 12, all fifteen pairs failing; the build before it had every age's cap
// in the same near-black felt. Both happened for the same reason: each class picked its own hexes
// at its own call site, so "the age" was never a thing any one file owned and drift was invisible
// until someone downsampled the army. It is one table now, and a class may override the SHAPE of
// a garment but never its colour.
//
// TWO CARRIERS DO THE WORK (§A.1) and both are gated: `crown` is the headwear mass, `dominant` is
// the largest NON-TEAM body surface. Team colour lives on the coat and therefore cannot carry the
// age — §H A2 masks every pixel within ΔE00 12 of TEAMCOL before it measures, which is exactly the
// trap a six-blue-coats build falls into.
//
// THE LADDER, as authored (Rec.709 on encoded bytes, §A.0):
//   crown     0.287 → 0.797 → 0.454 → 0.727 → 0.417 → 0.127
//   dominant  0.374 → 0.789 → 0.458 → 0.727 → 0.378 → 0.127
// Adjacent |ΔV| ≥ 0.25 on both, worst pairwise ΔE00 14.5 / 12.8 — the design has 2.5 and 0.8 of
// headroom on §H's floor of 12 and NOT MORE, so an implementer who "warms up" one of these by a
// few values is spending margin that is not there.
//
// TWO COLLISIONS ARE DELIBERATE AND A CRITIC MUST NOT "FIX" THEM: Iron 0.454 sits near Medieval
// 0.417, and Stone 0.374 near Medieval 0.378. They are separated by CHROMA — Iron's crown is warm
// gold-bronze at C* ≈ 38, Medieval's is neutral grey at C* ≈ 4 — which is why §H tests ΔE00 and
// not ΔV alone. Pulling either apart on value would break the adjacent-ΔV chain that does pass.
//
// EVERY ONE OF THESE IS A FLAT COLOUR. plainMat() costs no atlas cell and makes no Math.random()
// call, so fifty-four hexes are fifty-four free colours rather than fifty-four of the ~27 cells
// left in the atlas (§G.4). Only where §A.3 names a PATTERN — the Otzi stripe, iron scale, mail —
// does anything here reach texturedMat.
//
// age0.metal IS DELIBERATELY ABSENT. §A.3: "Nothing metal on any Stone Age unit. This is the age's
// hardest rule." The key is present and set to the rawhide hex so that a shared builder asking for
// `metal` on age 0 gets leather rather than a crash or, worse, a bronze fitting.
const AGEPAL=[
  { name:"Stone",                                     // "Bear-hide and greenstone."
    crown:0x5A4636, dominant:0x7A5B3C, light:0xA88A62, // Otzi's cap; stitched hide + its light stripe
    metal:0x8C6B45, metalD:0x6E5334,                   // §A.3: THERE IS NO METAL. Rawhide stands in.
    leather:0x8C6B45, accent:0xC9BBA0, wood:0x8A6B45, stone:0x5F7355,
    trim:0xC9BBA0, dark:0x3A2E24, patt:"hide" },
  { name:"Bronze",                                    // "Linen and brown-gold." The pale rung.
    // §A.3 authors age1.crown at #DCCFAA — max channel 220, and §G.6 flags it as OVER the 216 the
    // buffer prints (CLOUD_TOP, luma 0.853, against UnrealBloomPass's 0.86 cliff). §I open
    // question 2 says the same. Held at 216 exactly rather than shipped two values into the bloom:
    // this is the surface the whole age is named for and a blown ivory helmet is the beard defect
    // wearing a different hat. V 0.797 against the ladder's 0.812 — the rung is unmoved.
    crown:0xD8CBA6, dominant:0xD6C9A4, light:0xE0D6BC,
    metal:0xA87A3A, metalD:0x8A6430, metalLit:0xC29A52,
    leather:0x9A7A50, accent:0xD8CDAE, wood:0x8A6B45, faience:0x3E8C8A,
    trim:0xC29A52, dark:0x5A4630, patt:"cloth" },
  { name:"Iron",                                      // "Cold grey and rust." The temperature flip.
    crown:0x95712E, dominant:0x6E767E, light:0x8A9099,
    metal:0x8A9099, metalD:0x5A6068, metalLit:0x8A9099,
    leather:0x5A4630, accent:0x7A4A32, wood:0x7A6242, rust:0x7A4A32,
    check:[0x9A4234,0xB49A3C,0x3A5A7A,0x7A6242],       // civilian only; woad ≤5% (§A.4)
    trim:0x95712E, dark:0x3A3A38, patt:"metal" },
  { name:"Classical",                                 // "Polished steel, brass and marble."
    crown:0xB4BAC2, dominant:0xB4BAC2, light:0xC9CFD6,
    metal:0xC9A03C, metalD:0x9A7A2E, metalLit:0xC29A4E,
    // §A.3 authors age3.marble at #DDD4BE — max channel 221, and §G.6 flags it with age1.crown as
    // OVER the 216 the buffer prints. Rendered, the Classical villager's pilos came back with a
    // bloom halo round it: 221 x the LIT cell's 1.046 x the grade's 1.02 is 236 before the high
    // pass even looks at it.
    // v131.2 AND 216 WAS STILL NOT LOW ENOUGH. Re-measured over the pilos region of the age-3
    // villager, #D8CFB8 (luma 0.813) came back with max luma 0.992 at (255,255,227), 1,107 px at
    // or above 254 in some channel and a visible white halo bleeding past the silhouette into the
    // key — the beard's own defect on a new surface. The arithmetic says why: 0.813 x 1.046 x 1.02
    // = 0.867, and UnrealBloomPass's high pass is smoothstep(0.86, 0.87). The ceiling is not a
    // channel value, it is 0.86 / 1.046 / 1.02 = 0.806 of AUTHORED luma; #D2C9B2 is 0.790 and
    // lands at 0.843, under the cliff with margin. §I's own recommendation was #D6CDB6 (0.805),
    // which sits exactly ON it.
    leather:0x6B4A2E, accent:0xD2C9B2, wood:0x8A6B45, crimson:0xA83228,
    trim:0xC9A03C, dark:0x4A4A4E, patt:"metal" },
  { name:"Medieval",                                  // "Matte mail and deep wool." No gleam.
    crown:0x6E6A62, dominant:0x5E6258, light:0x767068,
    // v131.4 #C2C8CE COMES DOWN TO #BAC0C6 AND §H A8 IS WHY. age4.plate.bright is authored at
    // luma 0.780; on the knight's lit cuirass and pauldrons the ramp's LIT cell (x1.046) and the
    // grade (x1.02) put every channel over 216 across a CONTIGUOUS 385px region — §H A8's second
    // clause fails at 200px². The composer's real ceiling is 0.806 of authored luma (§G.6) and a
    // large curved plate that catches the sun spends most of that on the gain alone. 0.755 lands
    // the lit face at ~212/218/224 → under the clause with the age's material contrast intact:
    // bright plate against matte mail at 0.378 is still ΔV 0.38. Nothing outside js/04-units.js
    // reads this key (js/03-buildings.js has its own BPAL, and says so at :42).
    metal:0xBAC0C6, metalD:0x8A9098, metalLit:0xBAC0C6, // plate.bright — knight and pikeman ONLY
    leather:0x3A2E24, accent:0xD6CBB0, wood:0x4A3A2A, green:0x3F5A32,
    trim:0x767068, dark:0x2E2A24, patt:"metal" },
  { name:"Enlight.",                                  // "Black felt, white lace and gold."
    crown:0x22201E, dominant:0x22201E, light:0x3A3630,
    metal:0x3E4650, metalD:0x2A3038, metalLit:0x8A9099,
    leather:0x221E1A, accent:0xD8CFB8, wood:0x6B4A2E,
    gunbronze:0x8A6A3A, patina:0x6E7250, buff:0xD8CFB8, rifleGreen:0x3A5233,
    trim:0xCFB53B, dark:0x14130F, patt:"cloth" }
];
// The age a unit DRESSES for. A class's `age` field is fixed (a Legionaire is Classical wherever he
// stands); the villager, the king and the trade line follow their team's current age instead, which
// is what makes a town's people change with its buildings. Clamped, because teamAge is a live sim
// value and a body built during an age-up transition must never index off the end of the table.
function unitAge(u){
  const d=CLS[u.cls];
  if(d.rig==="villager"||d.rig==="king")
    return Math.max(0,Math.min(5,(typeof teamAge!=="undefined"&&teamAge[u.team])||0));
  return Math.max(0,Math.min(5,d.age||0));
}

const CLS={
  villager:   {name:"Villager",hp:60,dmg:6,spd:8.2,rng:2.4,cd:0.7,cost:null,col:0xd9b38c,line:"civil",rig:"villager",tier:0,age:0},
  king:       {name:"King",hp:320,dmg:13,spd:8,rng:2.6,cd:0.8,cost:null,col:0xc9a227,line:"royal",rig:"king",tier:0,age:0},
  // ---- Primary Melee Line (Barracks) ----
  clubman:    {name:"Club Man",hp:100,dmg:10,spd:8,rng:2.4,cd:0.8,cost:{food:40,gold:0},bMult:1.5,col:0x9c7b5a,line:"melee",rig:"sword",tier:0,age:0},
  shortsword: {name:"Short Swordsman",hp:130,dmg:13,spd:8,rng:2.5,cd:0.8,cost:{food:50,gold:15},bMult:1.5,col:0x9aa2ad,line:"melee",rig:"sword",tier:1,age:1},
  broadsword: {name:"Broad Swordsman",hp:155,dmg:16,spd:8,rng:2.6,cd:0.8,cost:{food:60,gold:20},bMult:1.5,col:0xa8b0ba,line:"melee",rig:"sword",tier:2,age:2},
  legionaire: {name:"Legionaire",hp:185,dmg:19,spd:8,rng:2.6,cd:0.8,cost:{food:70,gold:30},bMult:1.5,col:0xb03a3a,line:"melee",rig:"sword",tier:3,age:3},
  vanguard:   {name:"Vanguard",hp:220,dmg:23,spd:8,rng:2.6,cd:0.8,cost:{food:85,gold:40},bMult:1.5,col:0x5a6578,line:"melee",rig:"sword",tier:4,age:4},
  musketeer:  {name:"Musketeer",hp:110,dmg:30,spd:7.6,rng:26,cd:2.2,cost:{food:70,gold:90},col:0x35455e,line:"melee",rig:"musket",tier:5,age:5,ranged:true,bayonet:{dmg:14,rng:2.6,cd:0.8}},
  // ---- Primary Anti-Cavalry Line (Barracks) ----
  spearman:    {name:"Spear Man",hp:90,dmg:9,spd:8,rng:3.2,cd:0.9,cost:{food:35,gold:0},col:0x8a7a58,line:"anticav",rig:"pike",tier:0,age:0},
  spearfighter:{name:"Spearfighter",hp:115,dmg:11,spd:8,rng:3.2,cd:0.9,cost:{food:45,wood:10},col:0x8f7f5d,line:"anticav",rig:"pike",tier:1,age:1},
  impspear:    {name:"Improved Spearfighter",hp:135,dmg:13,spd:8,rng:3.3,cd:0.9,cost:{food:55,wood:15},col:0x93875f,line:"anticav",rig:"pike",tier:2,age:2},
  hoplite:     {name:"Hoplite",hp:160,dmg:16,spd:7.8,rng:3.4,cd:0.9,cost:{food:65,wood:25},col:0xb08a3f,line:"anticav",rig:"pike",tier:3,age:3},
  pikeman:     {name:"Pikeman",hp:190,dmg:19,spd:7.6,rng:3.5,cd:0.9,cost:{food:75,wood:35},col:0x7a6a4f,line:"anticav",rig:"pike",tier:4,age:4},
  halberdier:  {name:"Halberdier",hp:225,dmg:23,spd:7.6,rng:3.6,cd:0.9,cost:{food:90,wood:45},col:0x4e5a3a,line:"anticav",rig:"pike",tier:5,age:5},
  // ---- Primary Ranged Line (Archery Range; Slingers muster at the Barracks in the Stone Age) ----
  slinger:     {name:"Slinger",hp:70,dmg:8,spd:8.2,rng:16,cd:1.2,cost:{gold:10,wood:30},col:0x6b8a4a,line:"ranged",rig:"bow",tier:0,age:0,ranged:true},
  archer:      {name:"Archer",hp:85,dmg:11,spd:8,rng:21,cd:1.25,cost:{gold:40,wood:40},col:0x5d7a4a,line:"ranged",rig:"bow",tier:1,age:1,ranged:true},
  imparcher:   {name:"Improved Archer",hp:95,dmg:13,spd:8,rng:22,cd:1.25,cost:{gold:45,wood:45},col:0x567a44,line:"ranged",rig:"bow",tier:2,age:2,ranged:true},
  comparcher:  {name:"Composite Archer",hp:110,dmg:15,spd:8,rng:23,cd:1.2,cost:{gold:55,wood:50},col:0x4e7a3e,line:"ranged",rig:"bow",tier:3,age:3,ranged:true},
  crossbowman: {name:"Crossbowman",hp:125,dmg:19,spd:7.8,rng:24,cd:1.5,cost:{gold:65,wood:60},col:0x46603a,line:"ranged",rig:"bow",tier:4,age:4,ranged:true},
  skirmisher:  {name:"Skirmisher",hp:140,dmg:23,spd:9,rng:25,cd:1.3,cost:{gold:80,wood:70},col:0x3e5a44,line:"ranged",rig:"bow",tier:5,age:5,ranged:true},
  // ---- Primary Cavalry Line (Stable) ----
  chariot:     {name:"Chariot",hp:150,dmg:13,spd:11,rng:2.8,cd:0.85,cost:{food:90,gold:40},col:0xa8703d,line:"cavalry",rig:"cavalry",tier:1,age:1,mounted:true},
  heavycav:    {name:"Heavy Cavalry",hp:180,dmg:16,spd:12,rng:2.8,cd:0.85,cost:{food:105,gold:55},col:0x9a6a3a,line:"cavalry",rig:"cavalry",tier:2,age:2,mounted:true},
  cataphract:  {name:"Cataphract",hp:215,dmg:19,spd:13,rng:2.8,cd:0.85,cost:{food:120,gold:70},col:0xb08a3f,line:"cavalry",rig:"cavalry",tier:3,age:3,mounted:true},
  knight:      {name:"Knight",hp:250,dmg:23,spd:13.5,rng:2.8,cd:0.85,cost:{food:135,gold:85},col:0xb9c0c9,line:"cavalry",rig:"cavalry",tier:4,age:4,mounted:true},
  dragoon:     {name:"Dragoon",hp:270,dmg:26,spd:14,rng:2.8,cd:0.85,cost:{food:150,gold:100},col:0x3a4a6e,line:"cavalry",rig:"cavalry",tier:5,age:5,mounted:true},
  // ---- Scout Line (Stable) ----
  scout:       {name:"Scout",hp:125,dmg:9,spd:14.5,rng:2.8,cd:0.7,cost:{food:80,gold:0},col:0xa8703d,line:"scoutline",rig:"scout",tier:1,age:1,mounted:true},
  elitescout:  {name:"Elite Scout Cavalry",hp:170,dmg:13,spd:15.5,rng:2.8,cd:0.7,cost:{food:100,gold:20},col:0xc9a86a,line:"scoutline",rig:"scout",tier:4,age:4,mounted:true},
  // ---- Siege (Siege Workshop) — devastate buildings, feeble vs troops ----
  batteringram:{name:"Battering Ram",hp:420,dmg:12,spd:4.5,rng:3.0,cd:1.2,cost:{gold:200,wood:200},col:0x6b4a2b,line:"meleesiege",rig:"ram",tier:2,age:2,bMult:8,uMult:0.25},
  cannon:      {name:"Cannon",hp:180,dmg:65,spd:5,rng:30,cd:4.2,cost:{gold:300,wood:300},col:0x2b2b2b,line:"meleesiege",rig:"cannon",tier:5,age:5,ranged:true,bMult:3,splash:2.2},
  catapult:    {name:"Catapult",hp:200,dmg:45,spd:4.5,rng:30,cd:5,cost:{gold:200,wood:200},col:0x8a6a3f,line:"rangedsiege",rig:"catapult",tier:2,age:2,ranged:true,bMult:3,splash:3,arc:true},
  trebuchet:   {name:"Trebuchet",hp:220,dmg:70,spd:3.8,rng:54,cd:6.5,cost:{gold:250,wood:250},col:0x7a5a34,line:"rangedsiege",rig:"treb",tier:4,age:4,ranged:true,bMult:3.5,splash:3.5,arc:true},
  culverin:    {name:"Culverin",hp:190,dmg:60,spd:5.2,rng:32,cd:4,cost:{gold:150,wood:250},col:0x3a3a42,line:"rangedsiege",rig:"cannon",tier:5,age:5,ranged:true,bMult:3,splash:2},
  // ---- Trade (Market) ----
  tradecart:  {name:"Trade Cart",hp:80, dmg:0,spd:7.5,rng:2,cd:1,cost:null,          col:0x8a6a3f,line:"trade",rig:"cart",tier:0,age:3},
  trader:     {name:"Trader",    hp:130,dmg:0,spd:9.5,rng:2,cd:1,cost:{food:25,gold:100},col:0xc9a227,line:"trade",rig:"cart",tier:0,age:3},
  oxcart:     {name:"Ox Cart",   hp:220,dmg:0,spd:7,  rng:2,cd:1,cost:{food:75,gold:75}, col:0x8a6a3f,line:"trade",rig:"oxcart",tier:0,age:0}, // v99: the heavy timber hauler — trained at Storage Pits, human-only
  // ---- Healer Line (Temple) ----
  priest:      {name:"Priest",hp:90,dmg:0,spd:8,rng:2,cd:1,cost:{food:60,gold:100},col:0xe8e2d0,line:"healer",rig:"priest",tier:3,age:3,heal:{rng:16,rate:4}},
  // ---- The Wilds (creep camps) — appended LAST so CLS_KEYS snapshot indices stay stable ----
  // cost = the kill bounty (costPts). Packs of 4-5 are tuned so 2-3 grouped players clear a camp; one alone dies.
  wolf:      {name:"Wild Wolf",hp:155,dmg:14,spd:11,rng:2.2,cd:0.9, cost:{food:30},col:0x8a8f96,line:"wilds",rig:"wolf",tier:0,age:0},
  barbarian: {name:"Barbarian",hp:155,dmg:18,spd:8.5,rng:2.5,cd:0.95,cost:{gold:40},col:0x8a5a3a,line:"wilds",rig:"barbarian",tier:0,age:0,beardTone:0x45311F},
  // the shore raid (v79) — bounties: 40 pts a viking, 300 for the chieftain's head
  viking:    {name:"Viking Raider",hp:160,dmg:20,spd:8.5,rng:2.5,cd:0.9,cost:{food:20,gold:20},col:0x6a7a8c,line:"wilds",rig:"viking",tier:0,age:0,beardTone:0xB08640},
  vikingboss:{name:"Viking Chieftain",hp:500,dmg:42,spd:7.5,rng:3.2,cd:1.4,cost:{food:150,gold:150},col:0x4a5a6c,line:"wilds",rig:"vikingboss",tier:0,age:0,beardTone:0xB08640}
};

// unit lines: pick a LINE at its building; your team's AGE decides the tier you get
const LINES={
  melee:    {name:"Melee",building:"barracks",tiers:["clubman","shortsword","broadsword","legionaire","vanguard","musketeer"]},
  anticav:  {name:"Anti-Cavalry",building:"barracks",tiers:["spearman","spearfighter","impspear","hoplite","pikeman","halberdier"]},
  ranged:   {name:"Ranged",building:"archery_range",tiers:["slinger","archer","imparcher","comparcher","crossbowman","skirmisher"]},
  cavalry:  {name:"Cavalry",building:"stable",tiers:[null,"chariot","heavycav","cataphract","knight","dragoon"]},
  scoutline:{name:"Scout",building:"stable",tiers:[null,"scout",null,null,"elitescout",null]},
  meleesiege:{name:"Melee Siege",building:"siege_workshop",tiers:[null,null,"batteringram",null,null,"cannon"]},
  rangedsiege:{name:"Ranged Siege",building:"siege_workshop",tiers:[null,null,"catapult",null,"trebuchet","culverin"]},
  healer:   {name:"Healer",building:"temple",tiers:[null,null,null,"priest",null,null]}
};
function lineUnitFor(line,team){
  const t=LINES[line].tiers;
  for(let a=Math.min(teamAge[team],5);a>=0;a--)if(t[a])return t[a];
  return null;
}
function linesAt(type,team){
  const ls=Object.keys(LINES).filter(l=>LINES[l].building===type);
  if(type==="barracks"&&teamAge[team]===0)ls.push("ranged"); // Stone Age slingers
  return ls;
}
const TRAIN_BUILDINGS=["barracks","archery_range","stable","temple","market","siege_workshop","storage_pit"]; // v99: pits train the Ox Cart
function canBlock(u){
  return !u.ranged&&(["melee","anticav","cavalry","scoutline","royal"].includes(CLS[u.cls].line));
}
// rock–paper–scissors by LINE
function isSiege(cls){const l=CLS[cls].line;return l==="meleesiege"||l==="rangedsiege";}
function rps(attCls,defCls){ // ---- the v84 wheel ----
  if(CLS[attCls].uMult!==undefined)return CLS[attCls].uMult; // rams stay clumsy vs troops (artillery hits FULL since v84)
  const a=CLS[attCls].line,d=CLS[defCls].line;
  const dMounted=!!CLS[defCls].mounted, dSiege=isSiege(defCls);
  if((a==="ranged"||attCls==="musketeer")&&dSiege)return 0.15; // arrows & musket balls barely scratch war engines
  if(a==="anticav"&&dMounted)return 3.8;   // scouts die in 3 spear hits, same-age cavalry in 4
  if(a==="ranged"&&d==="anticav")return 1.8;
  if(a==="melee"&&!CLS[attCls].ranged){    // the SWORD tiers (the musket shot is a projectile; its bayonet has its own path)
    if(d==="ranged")return 1.8;
    if(d==="anticav")return 1.25;          // swords push through spear lines
    if(dSiege)return 2.0;                  // and DISMANTLE war engines
  }
  if(a==="cavalry"){                       // cavalry DOMINATES all but the spear
    if(d==="ranged")return 1.8;
    if(d==="melee")return 1.5;
    if(dSiege)return 1.5;
  }
  if(a==="scoutline"){
    if(d==="ranged")return 1.5;
    if(defCls==="villager"||defCls==="trader"||defCls==="tradecart")return 4.85; // economy killers: traders die in exactly 3 scout hits, villagers & carts in 2
  }
  return 1.0;
}
// ============ BUILDING RADII — v131.6, AND THE FIELD IS NOW SPLIT IN TWO ============
// ONE NUMBER WAS DOING THREE JOBS AND IT COULD NOT DO ALL THREE. `r` was the building's collision
// circle AND its spacing circle AND the distance every reach test measured from:
//   PHYSICAL   the hard push out of the wall (05-combat.js:663, `r+0.7`), the steer that walks a
//              unit around the edge (:694 and :709, `r+1.4`), the shots that must not pass through
//              masonry (:126/:167/:951, `r*0.8`) and the sight line that picks the target (:195,
//              `r*0.85`).                                        —> these are `rBlock` now.
//   REACH      melee and siege against a structure (:470/:502, `dist - r`), every interact prompt
//              (06-input.js:315-318, 338, 350, 360, 370 and the 10-net mirrors at :978/:986/:995/
//              :1135/:2027), the bot builder's stand point (07-ai.js:930) and how close an attacker
//              walks to a wall (:617/:1052/:1101).                —> these are `bSurf` now.
//   SPACING    validFor (06-input.js:674/677) refuses any plot within `r + b.def.r + 2.2`, and
//              findSpot/findSpotNear keep `r+2.6` of hammer room (07-ai.js:266/:278).
//   AND THE REST, all still plain `r`: splash against a structure (05-combat.js:70, `r*0.6`), the
//              plaza disc for the APRON_COURT types (03-buildings.js:3143, `r*0.92`), the road plan
//              (:639/:643/:653/:655), the tree fell radius (:3217, `r+2.2`), the deposit prompt
//              (09-main.js:170 and 10-net.js:1178, `r+3.5`) and the arrival test for a shot aimed
//              AT a building (05-combat.js:150).
// 03-buildings.js:2985 has said so in as many words the whole time: "def.r is a spacing radius —
// 11 for a town centre whose widest hide is 7.5".
//
// THE BUG. The v131 buildings pass rewrote 2,168 lines and ~590 geometry calls across six ages and
// changed NOT ONE `r:`. Every rebuilt model blocked against the circle its PREVIOUS model needed —
// the owner's report was "a lot of new models, specifically with the buildings and mountains, that
// have a new footprint but I can walk through them", and that is exactly what it was.
//
// AND THE FIRST FIX MADE IT WORSE. Growing `r` to the measured footprint fixed the walking-through
// and broke the building: the exclusion disc goes as `(r + r' + 2.2)^2`, so the buildable yard
// shrinks QUADRATICALLY in a number that was only ever meant to describe masonry. Measured with the
// game's own findSpot() in a real AI-built town (`node tools/_plotroom.js`), placement success went
// stable 8.5-11.1% -> 0.0-0.7%, market 2.9-6.2% -> 0.0-0.3%, siege_workshop 3.0-6.0% -> 0.0-0.1%,
// archery_range 16.6-20.1% -> 3.3%, temple 33.3-42.6% -> 10.5-11.5%. The AI's desire ladder
// (07-ai.js:364-392) is a bare `else if` chain with NO FALLBACK — once it wants a stable it can
// never place, `need()` stays true forever and the ladder never reaches the blacksmith — so the
// smoketest's "the AI directors raise a blacksmith at Iron" went red 6 runs in 12. Deterministic,
// not flake. Three types (barracks 10.9, blacksmith 8.6, castle 19.1) could not be spent as `r` at
// ALL: the castle's own exclusion against the town centre alone would leave a 3.5-wide annulus in
// the ring findSpot samples, i.e. 0/400 legal plots on an EMPTY map.
//
// SO: `rBlock` IS THE PHYSICAL FOOTPRINT AND NOTHING ELSE, and `r` IS BACK TO ITS PRE-v131.5 VALUE
// ON EVERY SINGLE TYPE — the table below is the shipped v131 table, digit for digit. THE PLACEMENT
// RULES NEVER SEE rBlock, so the AI's yard is not merely similar to what it was, it is IDENTICAL:
// `node tools/_plotsame.js` freezes one AI-built town to a file, rebuilds it in two working trees
// and SEEDS Math.random before asking findSpot, and the reverted-r tree and this one return the
// same number in every cell of the table — 2165 legal plots out of 11200 samples in a 57-building
// town, 7543 in a 31-building one, in both. The v131.5 radii scored 1871 and 7776 on the same two
// towns with the same dice.
// rBlock DEFAULTS TO r when absent (the loop under the table), so anything without one — walls,
// gates, the farm, and anything added later — behaves exactly as before.
// THE ONE THING THAT IS NOT FREE is REACH, and it has its own note at bSurf below: a body shoved
// out by a bigger wall has to still be able to touch the building. That cost is paid there.
//
// HOW THESE WERE DERIVED, AND VERIFIED TWICE BECAUSE FOUR TOOLS HAVE LIED IN THIS PROJECT.
//   1. `node tools/_bldfoot.js --ages` builds every (type, age, plot), merges the body, CLIPS every
//      triangle to the player's own height band (y 1.30-2.40 on a 2.6-tall figure) and area-gates
//      outliers at 85%/1.25x the way _bFootprint gates the apron, so a flagpole planted 8.8 out on
//      its own yard cannot size a blocker. Its header names the two bugs it had: whole-triangle
//      extents reported the star fort's sloped GLACIS at its 24.0 base radius, and a band floor
//      under 1.3 swallowed every moat, ditch and plinth in the file.
//   2. `node tools/_blockprobe.js` measures the same thing with NOTHING in common but buildingMesh:
//      THREE.Raycaster fired inward from 60 units out along 72 bearings at 12 heights, first hit
//      wins, outliers trimmed by BEARING COUNT rather than by area. The two instruments agree to
//      0.15 on ten of the fourteen (house 4.81 vs 4.81, castle 23.84 vs 23.76, watch tower 4.73
//      vs 4.70, temple 7.43 vs 7.38); where they part it is the gate, not the geometry — the
//      market's age-3 canopy corner is 9.97 by area gate and 10.60 by bearing count.
//   3. `node tools/_blockprobe.js --sim` throws away geometry altogether and drives a real unit
//      into a real placed building with the game's own moveUnit() from 72 bearings: every type
//      stops at exactly rBlock+0.7, which is the collision system agreeing in its own words.
// THE RULE: block = min( circumscribing - 0.35*(circumscribing - inscribed), inscribed + 1.2 ),
// then rBlock = block - 0.7. Circumscribing, because a player must not stand inside rendered
// geometry; minus a third of the corner excess, because a circle on the exact corner radius stops
// you in open air along the middle of every flat face; capped at inscribed + 1.2, because half the
// v131 types are a shell with a yard feature bolted to ONE side and a circle chasing that
// appendage blocks a body-width of nothing on the opposite side.
//
// WHAT A CIRCLE STILL CANNOT DO, now that spacing is no longer the excuse:
//   · the AGE SPREAD is up to 2x on one type. The Enlightenment guard tower is 11.8 x 12.5 and the
//     Medieval one a 7.9-wide drum, so an rBlock that fits age 5 stands ~2.6 off the age-4 wall.
//   · the ARCHERY RANGE'S BACKSTOP is an appendage and is deliberately NOT collided — see its line.
//   · the CASTLE is two concentric rings and then a star; 19.1 is the best single circle and it is
//     still the wrong primitive. See its line.
//   · WALLS AND GATES are not this circle at all — see the note above BLD.wood_wall.
const BLD={
  // rBlock 12.2 against a spacing r of 11. Measured 11.2 x 12.6 half-extents, corners at 13.01;
  // the old blocker stood at 11.7 and let you into the age-4 keep's forebuilding. Worst age is 4.
  // `r` STAYS 11 — it is the earth court (`r*0.92`, 03-buildings.js:3143), the deposit prompt
  // (09-main.js:170, `r+3.5`) and the widest exclusion disc on the map.
  towncenter:{name:"Town Center",hp:1500,r:11,  rBlock:12.2,cost:null,hits:0},
  // rBlock 3.8 against a spacing r of 4.6 — THE ONLY ONE THAT SHRINKS, and it is a fix. Every age
  // of the house measures 2.8-3.8 half-width with corners at 4.81, and the blocker at 5.3 was 1.5
  // units of phantom wall around the most numerous building in the game. Houses still SPACE at
  // 4.6, so no town re-plans itself over this.
  house:     {name:"House",      hp:220, r:4.6, rBlock:3.8, cost:{wood:40}, hits:8},
  // rBlock 10.9 against a spacing r of 7.2, and this is one of the three that could not ship at all
  // as a single number. Measured: ages 0-4 are 14.7 x 11.1, the Enlightenment drill hall 19.9 x
  // 20.8 with corners at 13.12, so the old blocker at 7.9 was inside the wall of EVERY age and
  // melee troops stood in the middle of a barracks to hit it. Barracks come 2-4 to a town and their
  // exclusion is `r + r' + 2.2` against everything else: at 10.9 the same yard went from 414 legal
  // plots in 800 samples to 0. Physical 10.9, spacing 7.2, and both are now true at once.
  barracks:  {name:"Barracks",   hp:480, r:7.2, rBlock:10.9,cost:{gold:30,wood:100},hits:14},
  // rBlock 5.9 against a spacing r of 4.0. Classical is a 7.2 x 11.4 hall, Medieval a 7.9 drum,
  // Enlightenment 11.8 x 12.5 — the old 4.7 blocker sat inside all three. Age 4 is the drum and
  // gets ~2.0 of air out of the age spread; that is the price of one circle for six models.
  tower:     {name:"Guard Tower",hp:400, r:4.0, rBlock:5.9, cost:{stone:250,wood:100},hits:10,atk:{dmg:9,rng:18,cd:1.1}}
};
// rBlock 6.9 against a spacing r of 6.6. Barely moves: the pit is 13.1 x 10.5 at its widest (age 4)
// and the old circle was already close. Its plaza is `r*0.92` and stays exactly where it was.
BLD.storage_pit={name:"Storage Pit",hp:250,r:6.6,rBlock:6.9,cost:{wood:75},hits:8};
// rBlock 7.0, SIZED TO THE SHELL AND NOT TO THE BUTTS — the one place the measured number is
// deliberately NOT spent even though rBlock is free. The worst case measures 13.71, and the mesh
// says exactly where it comes from: the SHELL is one box, x -5.60..5.60 by z -4.40..4.40 (11.2 x
// 8.8) with corner posts out to 5.77 / 4.57, and everything past z 4.6 is YARD — the ages-4/5 turf
// butt, a 6.5 x 6.8 mound 2.6 tall centred at (-4.6, 8.4), and the age-5 earth backstop, an
// 11.0 x 2.6 bank centred at (1.6, 10.6). Both stand entirely at +z with open grass at -z past 4.4.
// A 13.7 circle would stop a player 8.5 units short of the south wall in order to block a prop, and
// being stopped by nothing is a worse bug than walking through a mound of turf. So: sized to the
// shell, and the butts stay walkable BY DESIGN. Measured with `node tools/_blockprobe.js --type
// archery_range`: at 7.0 the ages 1-3 range has ONE bearing of 72 poking in, by 0.38; ages 4 and 5
// have 10 and 15, all of them the mound and the bank. Fixing those wants a second, OFFSET circle —
// the same shape of change as the wall OBB, and the same answer: not this round.
BLD.archery_range={name:"Archery Range",hp:420,r:6.4,rBlock:7.0,cost:{wood:125},hits:12};
BLD.stable={name:"Stable",hp:450,r:6.8,rBlock:7.6,cost:{wood:125},hits:12};   // 12.8 x 14.6, corners 8.89
BLD.temple={name:"Temple",hp:380,r:5.6,rBlock:6.5,cost:{wood:150},hits:12,heal:{rng:10,rate:2}}; // 12.8 x 13.6, corners 7.43
// FARM IS `flat:true` — 05-combat.js skips it before the circle is ever tested. That was right when
// a farm WAS a flat plot: crop rows you walk over and a fence. It stopped being right the moment
// §F gave every age past Stone a BARN (03-buildings.js:1622) — a solid 8.6 x 4.6 shed with a roof,
// opposed wagon doors, and at Medieval a dovecote, at Enlightenment a horse-gin roundhouse. John
// walked through all of it. Its `r` is still placement spacing (farms pack at gap 0.5), the
// ripe-corn prompt (`r+2.5`) and the plaza disc, and none of those is a wall.
//
// SO THE FARM BLOCKS IN PARTS, NOT AS A DISC. The crop MUST stay walkable — villagers harvest by
// standing on it and 07-ai.js's farm logic reaches for the rows — so `flat` stays and the barn gets
// its own colliders. Coordinates are MODEL-LOCAL, exactly as 03-buildings.js writes them, and the
// consumer applies BSCALE.farm (0.6375) and the plot's rotation; keeping them in model space means
// they can be checked against the source line that draws the mass instead of against a conversion.
//
// TWO CIRCLES FOR THE BARN, NOT ONE. One circumscribing disc round an 8.6 x 4.6 box needs r 4.876
// and over-blocks the long flanks by 2.58 — which is precisely the mistake that made a castle
// unapproachable at rBlock 19.1 and cost a release. Two circles on the long axis need r 3.15 and
// over-cover by 0.85 at worst. The barn spans local x -6.9..1.7, z -9.7..-5.1; the pair covers
// x -7.9..2.7 and z -10.55..-4.25, so the box is inside the union with room and nothing else is.
BLD.farm={name:"Farm",hp:150,r:6.6,cost:{wood:75},hits:8,flat:true,blockParts:[
  {x:-4.75,z:-7.4,r:3.30,minAge:1},   // barn, west half   (03-buildings.js:1628)
  {x:-0.45,z:-7.4,r:3.30,minAge:1},   // barn, east half
  {x:-9.30,z:-6.2,r:1.90,minAge:4,maxAge:4}, // §F.5 dovecote (:1654) — r covers its CONE cap (1.8), not just the 2.0 box
  {x: 3.70,z:-7.4,r:2.50,minAge:5}    // §F.6 horse-gin roundhouse (:1648)
]};
BLD.market={name:"Market",hp:520,r:7.2,rBlock:7.8,cost:{gold:25,stone:25,wood:125},hits:14}; // 14.6 x 13.6, corners 9.97 (the age-3 canopy corner still clips by 1.5)
BLD.siege_workshop={name:"Siege Workshop",hp:480,r:7.2,rBlock:8.0,cost:{wood:200},hits:14};  // 15.5 x 14, corners 9.29
// rBlock 4.0 against a spacing r of 2.4. BSCALE shrinks this one to 0.75 and even so the
// Enlightenment tower measures 7.5 x 9.3 against a 3.1 blocker — you could stand in the middle of
// the stair. NOTE the garrison spit-out is `r+1.6` (06-input.js:350, 10-net.js:978) and stays on
// `r`: it is a gameplay position, and at 4.0 it would drop the rider two units further out.
BLD.watch_tower={name:"Watch Tower",hp:220,r:2.4,rBlock:4.0,cost:{stone:50,wood:50},hits:6,vision:80};
// rBlock 8.6 against a spacing r of 5.6, and the SECOND of the three that could not ship as one
// number. Measured: ages 2-3 are 11.9 x 7.5, age 4 is 11.4 x 11.7 and the Enlightenment forge is
// 16.1 x 14 with corners at 10.38, so the old blocker at 6.3 was inside the age-4 and age-5 walls.
// There is exactly ONE forge per team and it is placed LATE into a yard that is already full, so it
// is the type whose own radius most directly gates its own plot: `node tools/_plotroom.js 16200
// --sweep blacksmith 5.6,6.4,7,7.6,8.6` in a 51-building town returns 59 / 25 / 0 / 0 / 0 legal
// plots out of 400. As rBlock it costs nothing at all.
BLD.blacksmith={name:"Blacksmith",hp:420,r:5.6,rBlock:8.6,cost:{wood:100},hits:12}; // v87: spend quest XP here (E) — max 1 per team
// WALLS AND GATES DO NOT USE THIS CIRCLE AT ALL, so they get NO rBlock and nothing here moves.
// Anything with `wall:true` is blocked by an ORIENTED BOX in 05-combat.js:645-660 whose half-
// extents are hard-coded there — `hl=6.25+0.55, hw=0.6+0.7` — and `r` only feeds placement chaining
// (06-input.js:672, `r+r-3.4`) and the wall-line router. The 6.25 is exactly right: every wall
// segment in the file measures 6.25 of half-length. THE 0.6 HALF-WIDTH IS NOT:
//     wood_wall   a2 1.30  a3-a4 1.36   a5 3.90     stone/fort_wall  a3 0.85  a4 3.51  a5 3.60
//     wood_gate   a2 5.50   a3-a5 1.40-1.60           stone/fort_gate  a3 3.15  a4 5.95  a5 3.70
// i.e. the Enlightenment palisade is 3x wider than the box that blocks it, the age-2 wood gate is
// 4.2x wider, and the gate towers stand 7.90 out along the wall's OWN axis against a 6.80 half-
// length. (The age-4 stone/fort curtain is stranger still: its wall proper starts at y 2.60, ABOVE
// a 2.6-tall figure's head, and the only thing standing in the band is a battered rampart of half-
// extent 3.51 on BOTH axes — so along the wall's length the box currently blocks more than the
// model has, and across it, less.) That fix belongs in the OBB in 05-combat.js — it wants per-type
// half-extents, not a radius — so it is reported and NOT half-done here. Measured with
// `node tools/_blockprobe.js --walls`, which clips to the band and does NOT apply an area gate: a
// percentile gate is right for sizing a circle and wrong for sizing a box, and _bldfoot's gate cuts
// the age-4 curtain's own length off (it reports 3.51 x 3.51 for a 12.5-long segment).
BLD.wood_wall={name:"Wood Wall",hp:650,r:5.5,cost:{wood:55},hits:6,wall:true};
// v132.15 THE CLEAR PASSAGE EVERY GATE MUST LEAVE, in one place, read by all four model branches
// in 03-buildings.js AND by _gatePassHX in 05-combat.js. Measured, not chosen: tools/gatefit.js
// puts a caliper across every unit at PIER HEIGHT (a bounding box is not what passes a doorway —
// a trebuchet is 16.8 tall and most of that is an arm in the air) and the widest thing that has to
// walk through a gate is a catapult at 6.53, with a trebuchet equal to it. 7.8 leaves 1.27.
// IT HAS TO BE ONE NUMBER. The passage governs the piers, the lintel span, the vault, the
// portcullis grooves, the drawbridge, the rampart split and the collider's own half-width; typed
// twice it goes stale in one of them and the gate seals itself somewhere nobody is looking. That
// is not hypothetical — it is what shipped: 3.4 in the model, 3.4 re-typed in the collider, and
// door leaves nobody had measured leaving 0.23 between them.
const GATE_PASS=7.8;
BLD.wood_gate={name:"Wood Gate",hp:560,r:5.8,cost:{wood:85},hits:7,wall:true,gate:true};
BLD.stone_wall={name:"Stone Wall",hp:1700,r:5.5,cost:{stone:100},hits:8,wall:true};
BLD.stone_gate={name:"Stone Gate",hp:1400,r:5.8,cost:{stone:75},hits:8,wall:true,gate:true};
BLD.fort_wall={name:"Fortified Wall",hp:3400,r:5.5,cost:{stone:200},hits:10,wall:true};
BLD.fort_gate={name:"Fortified Gate",hp:2800,r:5.8,cost:{stone:75},hits:10,wall:true,gate:true};
// rBlock 19.1 against a spacing r of 11 — THE LARGEST MISS IN THE FILE, by a factor of two, and the
// THIRD that could not ship as one number. §F.5's age-4 concentric castle is TWO rings: an outer
// curtain of eight 13.6-long segments standing at radius 15.4 (16.3 to the outer face, 17.66 at the
// corners) round an inner keep, with a twin-towered gatehouse whose drawbridge reaches 23.8 to +z.
// §F.6's age-5 star fort is a 20x20 terreplein with four diamond BASTIONS whose salients reach 19.9
// on the diagonals. The blocker at 11.7 was inside the outer curtain of one and inside the bastion
// ring of the other: you walked through 33 units of masonry and stood in the ward. As `r` this was
// unshippable — findSpot samples a ring 11-37 from the town centre and the castle's exclusion
// against the TC alone (19.1+11+2.2 = 32.3) leaves barely any annulus, measured 0/400 legal plots
// on an EMPTY yard against 214/400 at 11. As rBlock it costs nothing. It is still ONE CIRCLE round
// TWO RINGS: the gatehouse drawbridge at 23.8 and the age-4 corner turrets past 19.8 stay clippable,
// and the honest fix is four bastion circles plus an oriented box. 19.1 is the best single number.
BLD.castle={name:"Castle",hp:3000,r:11,rBlock:19.1,cost:{stone:500,wood:150},hits:30,
  atk:{dmg:14,rng:22,cd:4.5,volley:5,vcd:0.15},vision:75}; // v84: five arrows in rapid succession, then the long wind-down (DPS-neutral with the old 0.9s single shots)
// THE DEFAULT, AND IT IS WHY THIS SPLIT IS SAFE. Anything without an explicit rBlock — every wall,
// every gate, the farm, and anything added to this table tomorrow — gets its own `r` and therefore
// behaves EXACTLY as it did before the field existed. There is no third state to reason about, and
// 05-combat can read `def.rBlock` unguarded.
for(const _k in BLD)if(BLD[_k].rBlock===undefined)BLD[_k].rBlock=BLD[_k].r;

// ---- bSurf: HOW FAR IS THE WALL? THE THIRD THING `r` WAS DOING, AND THE ONE THAT BITES BACK ----
// Splitting the blocker out of `r` is not free, and this is the bill. A dozen tests in the game ask
// "how far is this body from the BUILDING" and spell it `dist - def.r` or `def.r + k`:
//     05-combat.js:470/:502   melee and siege reach against a structure   (dist - r < rng + 0.6)
//     06-input.js:315-318/338 the E prompt and the builder's hammer       (r + 2.4 … r + 2.6)
//     06-input.js:350         where a garrison spits you out             (r + 1.6)
//     07-ai.js:930            where a bot builder STANDS to swing        (r + 0.9, arrive within 1.3)
//     07-ai.js:617/1052/1101  how close an attacker walks to a wall      (rng + r - 0.6)
// Every one of them is measured from the SURFACE. While `r` was also the blocker they were exact,
// because a body pressed against a building sat at `r + 0.7` and 0.7 is inside every one of those
// constants. The moment the blocker became rBlock they stopped being exact, and where rBlock ran
// far ahead of r they stopped being SATISFIABLE: a villager shoved out to 9.3 by a blacksmith
// cannot reach a hammer radius of 8.2, so it walks up, gets pushed off, walks up again and the
// foundation never rises. That is not theory — the first cut of this change failed the smoketest's
// "the AI directors raise a blacksmith at Iron (0 ever built)" on every single run, because
// 07-ai.js:930 wants the builder within 1.3 of `r + 0.9` and the wall now stands 3.0 further out.
// Broken by construction for barracks (rBlock-r 3.7), blacksmith (3.0), castle (8.1) and, by a
// tenth, the guard tower (1.9).
// SO: THE WALL IS max(r, rBlock), AND ONLY REACH USES IT. It never shrinks anything — the house is
// the only type whose rBlock is smaller than its r, and its prompt and gather radii stay at 4.6
// exactly as before — and it never touches SPACING (validFor, findSpot), the apron, the plaza, the
// road plan, the tree fell or the splash disc, all of which are still plain `r`.
// v131.9 THE FOUNDATION BOX. Half-extents in model space, measured off the UNMERGED geometry by
// tools/footprint.js as the connected main mass — the shell and anything touching it, but not the
// yard furniture. The barracks' fire pit at (6.6,7.4) and its weapon rack at x=-7.2 are grounded
// and have plan area and are NOT walls; taking every grounded part made the barracks read 11.6
// deep when its shell is 8.55. Re-measure with `node tools/footprint.js` after any model change.
// Roof eaves are excluded on purpose: you walk under an eave, not into it.
// v131.19 PER AGE, AND THAT IS THE WHOLE POINT. v131.9 replaced the circumscribing circle with
// a box and baked ONE box per type: the MAXIMUM over all six ages. That is a second invisible
// wall wearing different clothes, and John found it immediately. A Bronze guard tower was
// blocking a box sized for its Enlightenment bastion -- 8.96 against a real shell of 4.20, so
// 5.03 units of nothing. Measured over-block from the max-over-ages shortcut:
//    tower 5.03 · archery_range 5.67 · towncenter 4.15 · market 3.70 · barracks 3.30
//    blacksmith 2.80 · watch_tower 2.48 · siege_workshop 2.95 · temple 1.85 · house 1.60
// which is the same order of magnitude as the circle it replaced. A building restyles as the
// town ages, so its blocker has to age with it.
// Index by the age the MODEL used -- max(def.age||0, min(5,teamAge)) -- exactly as buildingMesh
// derives it (03-buildings.js:1057). Two derivations of one number is how a wall ends up
// somewhere the building is not; the farm learned that in v131.4.
// Re-measure with `node tools/footprint.js` after ANY model change.
BLD.towncenter.fxA=[11.26,11.46,8.50,9.50,11.88,9.10]; BLD.towncenter.fzA=[10.75,8.56,7.75,10.80,11.90,9.10];
BLD.house.fxA=[4.47,3.70,3.70,3.90,3.20,3.60]; BLD.house.fzA=[4.70,3.50,3.70,3.70,3.10,3.30];
BLD.barracks.fxA=[6.90,6.80,6.70,10.00,6.90,9.95]; BLD.barracks.fzA=[5.50,5.40,5.30,5.80,5.50,8.55];
BLD.tower.fxA=[4.20,4.20,4.20,4.20,4.00,8.96]; BLD.tower.fzA=[6.30,6.30,6.30,6.30,4.00,9.03];
BLD.storage_pit.fxA=[6.22,6.22,6.22,6.22,6.22,6.22]; BLD.storage_pit.fzA=[5.70,5.70,5.70,5.70,5.70,5.70];
BLD.archery_range.fxA=[6.00,6.00,5.91,6.40,7.83,7.83]; BLD.archery_range.fzA=[6.24,6.24,6.24,6.24,11.80,11.91];
BLD.stable.fxA=[6.86,6.86,6.86,7.00,6.86,6.86]; BLD.stable.fzA=[8.10,8.10,8.10,8.10,8.10,8.10];
BLD.temple.fxA=[6.75,6.75,6.75,6.75,4.90,5.50]; BLD.temple.fzA=[6.02,6.02,6.02,6.02,6.00,6.80];
BLD.farm.fxA=[4.59,4.59,4.59,4.59,4.59,5.42]; BLD.farm.fzA=[6.37,6.37,6.37,6.37,6.37,6.37];
BLD.market.fxA=[7.80,7.80,7.80,7.80,10.60,6.90]; BLD.market.fzA=[7.00,7.00,7.00,7.00,6.60,5.50];
BLD.siege_workshop.fxA=[6.30,6.30,6.30,6.80,6.50,7.76]; BLD.siege_workshop.fzA=[6.40,6.40,6.40,6.40,9.35,6.46];
BLD.watch_tower.fxA=[4.24,4.24,2.36,2.36,3.50,3.85]; BLD.watch_tower.fzA=[4.24,4.24,2.36,2.36,3.66,4.84];
BLD.blacksmith.fxA=[6.50,6.50,6.50,5.25,5.25,8.05]; BLD.blacksmith.fzA=[4.50,4.50,4.50,4.50,4.50,7.00];
BLD.castle.fxA=[20.50,20.50,20.50,20.50,20.50,24.00]; BLD.castle.fzA=[22.57,22.57,22.57,22.57,22.57,24.00];
BLD.towncenter.fx=11.88; BLD.towncenter.fz=11.90;
BLD.house.fx=4.47;       BLD.house.fz=4.70;
BLD.barracks.fx=10.00;   BLD.barracks.fz=8.55;
BLD.tower.fx=8.96;       BLD.tower.fz=9.03;    // blocker was INSIDE the walls: 2.36 of walk-through
BLD.storage_pit.fx=6.22; BLD.storage_pit.fz=5.70;
BLD.archery_range.fx=7.83; BLD.archery_range.fz=11.91; // the age 4-5 gallery
BLD.stable.fx=7.00;      BLD.stable.fz=8.10;
BLD.temple.fx=6.75;      BLD.temple.fz=6.80;
BLD.market.fx=10.60;     BLD.market.fz=7.00;   // the age-4 hall is wide
BLD.siege_workshop.fx=7.76; BLD.siege_workshop.fz=9.35;
BLD.watch_tower.fx=4.24; BLD.watch_tower.fz=4.84;
BLD.blacksmith.fx=8.05;  BLD.blacksmith.fz=7.00;
// castle: NO BOX ON PURPOSE. Its curtain, gatehouse and towers are one connected mass 48 units
// across; a single box would fill the courtyard solid. It wants several boxes and keeps rBlock
// until they exist. farm keeps blockParts (v131.4) — its field must stay walkable.

// bSurf answers ONE question — how far from the centre is the wall — and it is used only by
// REACH. With a box the honest answer varies by bearing, so it returns the CORNER: the furthest
// the wall can be. That makes every reach test in the game satisfiable by construction, because a
// body stopped by the box can never sit further from the centre than the corner it was measured
// against. Erring generous here is free; erring tight is what made age-up, the class menu, the
// forge and four buildable types unreachable in v131.1.
function bSurf(def){
  if(def.fx!==undefined)return Math.sqrt(def.fx*def.fx+def.fz*def.fz);
  return def.rBlock>def.r?def.rBlock:def.r;
}
// ---- bStand: AND THE HARD-CODED STOP DISTANCES MOVE WITH THE WALL BY THE SAME AMOUNT ----
// Not every approach in the file is written as `def.r + k`. Two of them aim at a point a few units
// off a building's centre and declare arrival inside a bare literal, and both literals were tuned
// against the blocker as it stood:
//     07-ai.js:917  a citizen converting to a soldier walks to (bar.x+3, bar.z+3) and must get
//                   within 4. A barracks blocker at 7.9 puts the nearest reachable point 3.66 from
//                   that target — it cleared the literal by 0.34.
//     07-ai.js:972  a hauler banks its load at (dp.x+2.5, dp.z+2) and must get within 9 at a town
//                   centre. A TC blocker at 11.7 puts the nearest reachable point 8.498 away
//                   (11.7 - hypot(2.5,2)), so it cleared the literal by 0.502 — NOT the 0.02 an
//                   earlier draft of this comment claimed. The conclusion is unchanged and the
//                   arithmetic below is what matters: at a ring of 12.9 the best reachable point
//                   is 9.698 and the stop is 9, so it fails by 0.698 and the hauler NEVER banks.
// Move the wall out and both stop dead: measured, a hauler at the v131.5 town-centre radius NEVER
// DEPOSITS (closest approach 9.82 against a stop of 9), which is a silent economy failure that
// nothing in the smoketest names. So the rule is arithmetic, not judgement: the wall moved out by
// bSurf-r, so a stop distance measured against that wall moves out by exactly bSurf-r. Anything
// that worked before still works; anything that was already broken (a castle used as a drop-off
// has been unreachable at 6.5 since long before this change) stays broken and stays reportable.
function bStand(def,want){return want+bSurf(def)-def.r;}
// bSteer answers a THIRD question, and it is not the same as either of the other two: how wide a
// berth should a mover give this building while pathing round it. steerAroundBuildings is circle
// based, so a boxed type hands it the box's LONGEST half-extent — never smaller than the box, or a
// unit would steer straight into the wall it is trying to avoid, and never the corner, which would
// re-introduce the wide swerve the box exists to remove.
// bSpace: HOW MUCH ROOM DOES THIS BUILDING NEED BESIDE ANOTHER ONE. The fourth radius, and the
// last one -- r for the plaza and the road plan, bSurf for reach, bSteer for pathing, bSpace for
// PLACEMENT. John, on a Classical town: "buildings are so close together its creating a barrier i
// cant walk through." validFor spaced plots by `r`, but v131.9/.19 made buildings BLOCK at their
// measured footprint, and for several types the drawn building is far bigger than r:
//     barracks a3  r 7.2 -> 10.00     market a4  r 7.2 -> 10.60
//     towncenter a4 r 11 -> 11.88     archery_range a5  r 6.4 -> 7.83
// so two LEGALLY placed neighbours could end up with their boxes touching, or overlapping, and
// the corridor between them was gone. Spacing has to be measured against the same footprint the
// collider uses or the two disagree, and the player is the one who finds out.
// max(fx,fz) rather than the corner: the corner is hypot(fx,fz) and using it re-inflates spacing
// the way the circumscribing circle did -- which is what emptied the buildable yard at v131.1 and
// cost a release. This is the tightest radius that cannot leave two boxes overlapping.
function bSpace(def,team){
  const a=Math.max((def.age||0),
    Math.min(5,(typeof teamAge!=="undefined"&&teamAge[team])||0));
  if(def.fxA&&def.fxA[a]!==undefined)return Math.max(def.fxA[a],def.fzA[a]);
  return def.rBlock!==undefined?def.rBlock:def.r;
}
function bSteer(def){
  if(def.fx!==undefined)return def.fx>def.fz?def.fx:def.fz;
  return def.rBlock!==undefined?def.rBlock:def.r;
}
BLD.towncenter.age=0; BLD.house.age=0; BLD.storage_pit.age=0; BLD.barracks.age=0;
BLD.archery_range.age=1; BLD.stable.age=1; BLD.farm.age=1; BLD.watch_tower.age=1;
BLD.siege_workshop.age=2; BLD.wood_wall.age=2; BLD.wood_gate.age=2; BLD.blacksmith.age=2;
BLD.tower.age=3; BLD.temple.age=3; BLD.market.age=3; BLD.stone_wall.age=3; BLD.stone_gate.age=3;
BLD.castle.age=4;
// v131.28 THE CASTLE'S REAL OUTLINE, as a per-age list of model-space shapes. See
// tools/patch-castlebox.js for the measurement and tools/castlewalk.js for the gate that holds it.
// Built from the SAME expressions 03-buildings.js draws from, so a mesh edit that forgets this
// list shows up as a diff on one file and not the other.
//   {x,z,hx,hz,yaw} is a slab   ·   {x,z,r} is a drum   ·   model space, pre-BSCALE (which is 1 here)
BLD.castle.blockShapes=(function(){
  const a4=[], a5=[];
  for(let i=0;i<8;i++){const a=i*Math.PI/4+Math.PI/8;          // the curtain: 13.6 x 1.8, yaw = a
    a4.push({x:Math.sin(a)*15.4,z:Math.cos(a)*15.4,hx:6.8,hz:0.9,yaw:a});}
  for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;          // mural towers, on the angles
    a4.push({x:Math.sin(a)*15.4,z:Math.cos(a)*15.4,r:2.95});}
  a4.push({x:-4.0,z:15.6,r:3.0},{x:4.0,z:15.6,r:3.0});         // the twin gatehouse drums
  a4.push({x:0,z:0,hx:7.7,hz:7.7,yaw:0});                      // the keep — BoxGeometry(15.4,·,15.4)
  for(const px of [-7.7,7.7])for(const pz of [-7.7,7.7])a4.push({x:px,z:pz,r:2.8});
  a5.push({x:0,z:0,hx:10.0,hz:10.0,yaw:0});                    // the platform — BoxGeometry(20,·,20)
  // the bastions are 4-gons yawed by atan2(px,pz), which puts their CORNERS on the diagonals and
  // their flats on the axes: the half-width is the apothem, and the frustum's radius at the body
  // band's mid height (y 1.3 of 3.8) is 4.921, so 4.921/sqrt(2) = 3.48.
  for(const px of [-10.6,10.6])for(const pz of [-10.6,10.6])a5.push({x:px,z:pz,hx:3.48,hz:3.48,yaw:0});
  a5.push({x:0,z:10.3,hx:2.5,hz:0.7,yaw:0});                   // the portal block
  return {0:a4,1:a4,2:a4,3:a4,4:a4,5:a5};                      // BLD.castle.age is 4: only 4 and 5 build
})(); BLD.fort_wall.age=4; BLD.fort_gate.age=4;

// ---------- the seven ages ----------
// v132.47: the last age, by INDEX rather than by name — AGES is the one definition of the ladder,
// so the trickle gate reads its length instead of hard-coding a 5 that would silently point at the
// wrong age the day a sixth is added.
// v132.48 (John, playtesting): "Losing all levels and xp at death is too harsh." Death now takes
// HALF the level and hands that half back as spendable XP — level 20 rises at 10 with 10 XP. The
// buffs still go entirely, which is where the teeth are.
const DEATH_KEEP=0.5;        // the fraction of your level you rise with
const ENLIGHTENMENT_AGE=5;   // asserted against AGES.length-1 in the smoketest
const ENLIGHTEN_TRICKLE=1;   // 1 food, 1 wood, 1 gold a second. No stone — John's list, verbatim.
const AGES=[
  {name:"Stone Age"},
  {name:"Bronze Age",    cost:{food:600, gold:0}},
  {name:"Iron Age",      cost:{food:1200,gold:150}},
  {name:"Classical Age", cost:{food:1800,gold:300}},
  {name:"Medieval Age",  cost:{food:2400,gold:500}},
  {name:"Enlightenment Age",cost:{food:3000,gold:1000}}
];
const teamAge=[0,0,0]; // [2] is the wilds: ageless — keeps ageBuff/setClassStats sane for creeps
// v107: T at the Town Center no longer flips the age instantly — it starts a 90-second
// ADVANCE (pay now, no cancel). The age lands when the research timer does.
const AGE_RESEARCH_S=90;
const ageResT=[0,0,0];  // remaining research seconds per team ([2] wilds: always 0)
// units trained in later ages are stronger; Enlightenment adds a capstone
function ageBuff(team){return 1+0.06*teamAge[team]+(teamAge[team]>=5?0.15:0);} // Enlightenment curbstomps

// v132.0 DEPTH HEAVILY, WIDTH SLIGHTLY (John's ruling). 424x250 -> 440x304, +26.2% of area, and
// TCPOS stays at (+-175, 0) so base-to-base is still exactly 350 — raid timers, unit speed and
// trade-cart round trips are all tuned against that number and a spacing problem is no reason to
// disturb them. The extra 8 of half-width is building room BEHIND each base; the depth is for the
// Viking road, which has to climb out to the camp and back while the King's Road and three interior
// camps share the other half. See claude/REGICIDE-MAP-REWORK.md.
const MAP={x:220,z:152};                // half-extents (+25% in v34)
const TCPOS=[[-175,0],[175,0]];        // blue, red town centers

// ---------- neutral creep camps (v77) ----------
// Six pockets of ground BUMPED OUT past the map border: one at each corner,
// two at the midpoints of the long (north/south) edges. Units may walk outside
// the border only inside these circles; creeps never leave them.
const CAMP_R=26;        // pocket radius — DOUBLED in v82: each camp is a proper hollow in the mountains
const CAMP_AGGRO=11.5;  // (legacy fallback — per-camp aggro is set from the pocket radius now)
const CREEP_N=5;        // creep bodies per camp (a 4-pack leaves the fifth dead) — fixed for net id order
const CAMP_RESPAWN=180; // seconds from pack wipe to the next wave (runs even if the chest sits)
const CAMP_CHEST=300;   // the treasure: 300 food (wolves) or 300 gold (barbarians)
// v132.10 BEING HIT COUNTS. updateCreep measured an intruder's distance from the CAMP CENTRE, so a
// shooter standing one aggro-radius out was invisible no matter how many stones it put into the pack — and
// every ranged unit in the game outranges every camp's ring from a standing start (slinger 16 vs a
// 13.5 interior ring; skirmisher 25 and cannon 30 vs a pocket's 23.5). John's screenshot: four
// slingers on the rim, five wolves doing nothing.
// The wake lives on the CAMP, not the creep, so one stone brings the whole pack.
const CAMP_WAKE=9;        // seconds of anger after the last hit lands
const CAMP_WAKE_REACH=22; // CAP on the woken scan. It extends to just past the actual attacker and
                          // no further — a flat +22 would reach 35 from an interior camp's centre
                          // and set the pack on carts using the Viking road 29.7 away.
const CAMP_WAKE_CHASE=12; // …and the leash gives this much, or seeing him changes nothing
// ---- the RAID BOSS shore (v79): the south-mid camp is a DOUBLE-size beachfront ----
const BOSS_R=52;        // twice a (doubled) camp — a whole bay
const BOSS_N=11;        // 1 Viking chieftain + 10 vikings, fixed body count for net id order
const BOSS_RESPAWN=900; // the raid lands at 15:00, and 15 minutes after every wipe
const BOSS_CHEST=500;   // TWO chests: 500 food AND 500 gold
// centers sit r-8 beyond the border: each pocket opens onto the map through a ~8-unit mouth,
// with the bulk of the hollow carved DEEP into the mountain ring
const CAMPS=[
  {x:-(MAP.x+CAMP_R-8),z:-(MAP.z+CAMP_R-8),r:CAMP_R},{x:MAP.x+CAMP_R-8,z:-(MAP.z+CAMP_R-8),r:CAMP_R}, // south corners
  {x:-(MAP.x+CAMP_R-8),z:MAP.z+CAMP_R-8,r:CAMP_R},{x:MAP.x+CAMP_R-8,z:MAP.z+CAMP_R-8,r:CAMP_R},       // north corners
  {x:0,z:-(MAP.z+BOSS_R-8),r:BOSS_R,boss:true},                                                       // SOUTH SHORE: the Viking bay
  {x:0,z:MAP.z+CAMP_R-8,r:CAMP_R}                                                                     // north-mid: a normal camp
];
function inCampGround(x,z){ // is this spot on a camp pocket's ground?
  for(const C of CAMPS){const dx=x-C.x,dz=z-C.z;if(dx*dx+dz*dz<C.r*C.r)return true;}
  return false;
}
// ==================== v132.7 CAMPS IS THE BORDER POCKETS. CREEP_SITES IS WHERE CREEPS LIVE. ====================
// They were one array because for fifty versions every camp was both. John's three new ones are in
// the OPEN INTERIOR — contested ground you cross, not a safe pocket you farm — and the moment those
// exist the two meanings come apart:
//   CAMPS       inCampGround() (the holes in the invisible wall), nearCamp() (keep the mountain ring
//               out of the hollows), the bay flat, raidShore. Every one of those is a question about
//               ground OUTSIDE the border, and none of them is about creeps. An interior camp in
//               here would make nearCamp push mountains away from map centre, where there are none.
//   CREEP_SITES 07-ai.js's spawn loop, creepCampGrounds' scenery, the tree clearance, the foliage
//               exclusion, validFor.
// THE THREE ARE APPENDED, AND THAT IS LOAD-BEARING: campStates[i] is indexed by chest events
// ({t:"chest", i:st.i}) and by the late joiner's w.camps[], and each camp mints CREEP_N unit bodies
// in sequence, so unit ids depend on this order. Appending leaves 0-5 and every existing id alone.
//
// RADIUS 16 AGAINST THE POCKETS' 26 — a clearing, not a hollow carved into a mountain range. It also
// sets the fight, because 07-ai.js derives both numbers from r: the hard leash at r-1.2 = 14.8 and
// the aggro ring at r-2.5 = 13.5, which sits just inside the 14.5 trampled disc. Stepping onto the
// dirt is what wakes them; marching past on a road 30-47 away is not.
//
// THE SITES ARE MEASURED, NOT TYPED — tools/campsite.js, which walks the whole field against the
// roads, the thrones, the plazas, the ponds, the border pockets and the ground itself:
//                     to King's Rd   to Viking   ground spread
//     (0, 55)            43.0          147.9        1.12        its own mirror
//     (+-79, -33)        47.3           29.7        1.45 / 1.46 a mirrored pair
// MIRRORED ABOUT x=0, which is the ROADS' convention (roadPoint: "z(t) === z(1-t)") and NOT the
// 180-degree one TREE_STANDS uses. Both live in this world; they are not interchangeable. And the
// pair was validated on BOTH halves because the terrain is noise and noise does not mirror — 1.45
// against 1.46 is the measured result of asking rather than assuming.
// v132.12 r 16 -> 11, John's "reduce by 30%". It is not only a footprint: 07-ai.js derives the
// trampled disc (r-1.5 -> 9.5), the hard leash (r-1.2 -> 9.8) and the aggro ring (r-2.5 -> 8.5)
// from it, and an 8.5 ring is why v132.10's wake-on-damage had to land first — a slinger's range is
// 16, so without it the whole pack could be shot to death from outside its own awareness.
const CREEP_R_INNER=11;
// v132.12 AND THE LAYOUT WAS MIRRORED. John: "facing down kings road toward red base, there should
// be TWO new camps on the RIGHT side of kings road and ONE on the left. right now it is the
// opposite." Blue faces +x with +y up, so right = cross(forward,up) = +z — and the sketch says the
// same thing independently, because its "up" is the VIKINGS and the bay is at z = -196: the lone
// camp sits between the Viking arc and the King's Road (-z), the pair on the far side (+z).
// Sited by tools/campsite.js against the v132.9 roads and the v132.11 bazaars:
//                  to King's Rd   to Viking   ground spread
//     (0, -72)        84.0           75.5       0.57        its own mirror
//     (+-65, 77)      62.9          134.3       1.19 / 1.19 both halves measured, not assumed
const CREEP_SITES=CAMPS.concat([
  {x: 0,z:-72,r:CREEP_R_INNER,inner:true},   // the lone camp, between the Kings Road and the arc
  {x: 65,z: 77,r:CREEP_R_INNER,inner:true},  // the pair, on the far side of the Kings Road…
  {x:-65,z: 77,r:CREEP_R_INNER,inner:true},  // …mirrored about x=0, so neither team owns one
]);
// v83: the invisible wall sits at the MOUNTAINS, not the map line — a walkable apron
// rings the whole field (the ground between the border and the peaks' feet), and the
// camp pockets open straight off it. No more bumping into thin air on open grass.
const BORDER_FRINGE=9; // how far past the border the apron runs (the foothill line)
function walkable(x,z){
  if(Math.abs(x)<=MAP.x+BORDER_FRINGE&&Math.abs(z)<=MAP.z+BORDER_FRINGE)return true;
  return inCampGround(x,z);
}

// ---------- state ----------
let scene,camera,renderer,clock;
const units=[],buildings=[],nodes=[],projectiles=[],effects=[];
const stock=[{food:150,gold:50,stone:0,wood:75},{food:150,gold:50,stone:0,wood:75}];
let player=null;
const kings=[null,null];
let T=0, gameOver=false;
function setGameOver(v){gameOver=v;} // the test harness needs to reopen a finished war
function costPts(c){return c?((c.food||0)+(c.gold||0)+(c.stone||0)+(c.wood||0)):0;}
function awardPts(u,n){ // humans only: the host player and possessed guests
  // v133.0 BOUNTY HUNTER RETIRED. Score is now flat. The id is deliberately still tolerated
  // everywhere else: a player mid-match holds it in u.buffs, syncBuffs puts it on the wire, and
  // BUFF_BY_ID lookups must not throw on it — it simply stops being dealt and stops paying.
  if(u&&(u.isPlayer||u.remote)&&n>0)u.score=(u.score||0)+n;
}
function isHuman(u){return !!(u&&(u.isPlayer||u.remote));}

// ---------- QUESTING & THE BLACKSMITH (v87) ----------
// The Town Board by each Town Center hands out random quests (E). A finished quest
// pays +1 Level and +1 XP (the monsters pay 2). XP is the ONLY player-personal
// currency: spend it at the Blacksmith (Iron Age) for a random stacking buff.
// Death wipes level, XP and every buff. Max level 25. Bots never quest.
// v132.28: every quest carries an `age` — the earliest AGES index the board may post it at.
// The board deals only from what your team's age has unlocked, so the Stone Age never offers
// "Build a Castle". Ages: 0 Stone · 1 Bronze · 2 Iron · 3 Classical · 4 Medieval · 5 Enlightenment.
const XP_MAX_LVL=25, BUFF_MAX_STACK=3, BOARD_REACH=5, QUEST_REROLL_MAX=3;
// v133.0 the charge cooldowns, one entry per stack — John's sheet, not a formula
const WARD_CD =[24,18,12,6,3];   // ARROW WARD  — seconds between blocked ranged attacks
const GUARD_CD=[25,20,15,10,5];  // IRON GUARD  — seconds between blocked melee attacks
// ---------- v132.29 THE LEVEL AURA — every dial in one place ----------
// Rising motes off a levelled player: team-tinted at low level, gold at the cap. Cosmetic only,
// never on the wire, never simulation. See tools/patch-aura.js for the reasoning.
const AURA_MAX=640,        // mote slots for the WHOLE scene — one pooled Points, one draw call.
                           // 320 until v132.50; a capped player now wears ~110 of them alone.
      AURA_NEAR=34,        // full strength within this distance of the camera
      AURA_FAR=62,         // invisible beyond it — John: you should have to get close (v125)
      // v132.50 (John, playtesting again): "It leaves a glowing trail behind me long after I've
      // left an area... The emphasis on the aura also does not change much from lvl 1 to 25."
      // THE TRAIL was structural, not a duration: a mote was emitted at a world POSITION, so a
      // walking player painted a line BY CONSTRUCTION and v132.47's shorter life could only
      // shorten the line. Motes now carry an offset from their owner and are re-anchored to it
      // every frame (05-combat.js auraTick), so the cloud travels WITH the body. That is what
      // frees the life to grow again below - a long-lived mote is only a smear if it is left.
      // THE EMPHASIS was a shape problem: level 1 and the cap differed in DENSITY and HUE alone,
      // same radius, same climb, same life, so the cap was a busier version of the same puff.
      // All four dials now ride one superlinear curve.
      AURA_RATE_LO=1.4,    // motes/sec at level 1 (was 2.6 - start sparser so the climb reads)
      AURA_RATE_HI=105.0,  // motes/sec at the cap (was 34.0). 54 was the first attempt and it
                           // photographed as a light sparkle, not an aura: 54/s x 1.05s of life
                           // is 57 motes spread over a column two and a half units tall, and at
                           // arm's length that is a dusting. 105/s holds ~110 and reads as a
                           // swarm. The pool below carries it.
      AURA_CURVE=1.35,     // superlinear: the low levels stay quiet and the last third earns the
                           // spectacle. t^1.35 puts level 13 at 0.40 of the ramp, not 0.52.
      AURA_R_LO=0.34,      // emission radius, level 1 -> cap   (was a flat 0.78)
      AURA_R_HI=1.15,
      AURA_RISE_LO=0.75,   // units/sec climbed, level 1 -> cap (was a flat 0.90)
      AURA_RISE_HI=2.40,
      AURA_LIFE_LO=0.40,   // seconds a mote lives, level 1 -> cap (was a flat 0.55). The cap is
      AURA_LIFE_HI=1.05,   // safe ONLY because motes now follow the body - see above.
      // v132.47 (John, playtesting): "the aura lingers too long… it needs to go away much much
      // quicker". A mote is emitted at a POSITION and then rises on its own — it does not follow
      // the unit. At 1.45s and 1.55u/s each one travelled 2.2 units, so a walking player dragged a
      // two-unit smear behind them and a player who had walked away left it hanging over empty
      // ground, which is what his screenshot shows above the houses.
      // Life and climb only. The RATE is untouched: level 25 should be no less dense, it should
      // simply not smear.
      AURA_GOLD=0xFFC64A,  // the cap colour — warm, agrees with the §2 palette
      AURA_HOT=1.70,       // cap multiplier: just past the 0.86 bloom threshold (§4.6) and NO
                           // further — 3.2 clipped every channel and rendered the gold as white
      // v132.51 THE LEASH. John: "level sparkles ... should only be at the leveled unit."
      // Nothing may render further than this from the body that owns it. The horizontal figure
      // is a little over the cap's emission radius (1.15); the vertical one clears the cap's
      // column (0.85 birth + 2.40 x 1.05 climb = 3.37) with room and no more.
      AURA_LEASH=1.8,      // metres, horizontal — a smear cannot exceed this by construction
      AURA_LEASH_Y=4.2,    // metres, vertical — the column is the effect, so this is generous
      AURA_SIZE=13.0;      // SCREEN-space mote size, in pixels (sizeAttenuation is OFF).
                           // The tuning history matters: 0.42 world-space was flatly
                           // invisible, 0.9 was thin, and 1.3 read ONLY in extreme close-up. Sizing
                           // for the FAR end (2.3) then blew the near end out: with the composer off
                           // — which is every mobile player, 12-touch.js:191 — the raw discs washed
                           // over the nutcracker faces and broke the §5 silhouette priority.
                           // A world-space mote cannot serve both ends of a 34..62 range gate, so
                           // it is screen-space now: a constant pixel footprint that reads at the
                           // far edge without swallowing the unit at the near one.
// v99: the reroll cooldown died — the board DRAFTS three and you take ONE.
// v132.28.2: rerolls are banked ONCE PER QUEST OPPORTUNITY (start of a life, finishing a quest,
// respawning), to a ceiling of QUEST_REROLL_MAX. The old "one per LEVEL gained" rule is retired —
// participation now grants levels, and that rule would have paid 15 rerolls for one Viking raid.
const RALLY_CAP=5; // v89: G rallies your five NEAREST soldiers — the Bannerman buff adds one per stack
const QUESTS=[ // {id,name,desc,ev,n,xp,age} — ev is the progress event; xp doubles as levels gained
  {id:"food100", name:"Provisioner",         desc:"Bank 100 food",                          ev:"dep_food",  n:100,xp:1,age:0},
  {id:"wood100", name:"Lumberjack",          desc:"Bank 100 wood",                          ev:"dep_wood",  n:100,xp:1,age:0},
  {id:"stone100",name:"Quarryman",           desc:"Bank 100 stone",                         ev:"dep_stone", n:100,xp:2,age:0},
  {id:"gold100", name:"Prospector",          desc:"Bank 100 gold",                          ev:"dep_gold",  n:100,xp:1,age:0},
  {id:"farm5",   name:"Green Thumb",         desc:"Build 5 farms",                          ev:"build_farm",n:5,  xp:1,age:1},
  {id:"house5",  name:"Town Planner",        desc:"Build 5 houses",                         ev:"build_house",n:5, xp:1,age:0},
  {id:"market1", name:"Merchant Prince",     desc:"Build a Market",                         ev:"build_market",n:1,xp:1,age:3},
  {id:"castle1", name:"Castellan",           desc:"Build a Castle",                         ev:"build_castle",n:1,xp:2,age:4},
  {id:"walls4",  name:"Mason of the Line",   desc:"Build 4 wall segments",                  ev:"build_wall",n:4,  xp:1,age:2},
  {id:"burn3",   name:"Crop Burner",         desc:"Raze 3 enemy farms",                     ev:"raze_farm", n:3,  xp:1,age:0},
  {id:"raze3",   name:"Demolitionist",       desc:"Raze 3 enemy buildings (farms aside)",   ev:"raze_bld",  n:3,  xp:2,age:0},
  {id:"vil3",    name:"Terror of the Fields",desc:"Kill 3 enemy villagers",                 ev:"kill_vil",  n:3,  xp:1,age:0},
  {id:"mil3",    name:"Soldier's Work",      desc:"Kill 3 enemy military units",            ev:"kill_mil",  n:3,  xp:1,age:0},
  {id:"creep5",  name:"Wolfsbane",           desc:"Slay 5 wild creatures",                  ev:"kill_creep",n:5,  xp:1,age:0},
  {id:"camp1",   name:"Camp Breaker",        desc:"Participate in defeating a wild creep camp", ev:"camp_wipe", n:1, xp:1,age:0},
  {id:"chest1",  name:"Treasure Hunter",     desc:"Claim a camp chest (steals count)",      ev:"chest",     n:1,  xp:1,age:0},
  {id:"trade3s", name:"Peddler",             desc:"Sell 3 loads from the NEAREST bazaar",   ev:"trade_short",n:3, xp:1,age:3},
  {id:"trade2m", name:"Caravan Master",      desc:"Sell 2 loads from the GRAND bazaar",     ev:"trade_mid", n:2,  xp:2,age:3},
  {id:"trade1l", name:"Silk Road",           desc:"Sell a load from the FARTHEST bazaar",   ev:"trade_long",n:1,  xp:2,age:3},
  {id:"harv5",   name:"Reaper",              desc:"Harvest 5 ripe farm crops",              ev:"harvest",   n:5,  xp:1,age:1},
  {id:"train5",  name:"Master-at-Arms",      desc:"Take up arms 5 times (any class)",       ev:"train",     n:5,  xp:1,age:0},
  {id:"res2",    name:"Battlefield Medic",   desc:"Resurrect 2 fallen allies (Priest)",     ev:"res",       n:2,  xp:2,age:3},
  {id:"pistol1", name:"Last Shot",           desc:"Kill an enemy with the dragoon pistol",  ev:"pistol",    n:1,  xp:1,age:5},
  {id:"scout1",  name:"Eyes on the Throne",  desc:"Get within 25 of the enemy Town Center, then return home ALIVE", ev:"scout", n:1, xp:2,age:0},
  // ---- v132.28: the seven new postings (ids/names mine; desc, n, xp and age are John's) ----
  {id:"oxplun1", name:"Highwayman",          desc:"Plunder an enemy ox cart",               ev:"plunder_ox",n:1,  xp:2,age:0},
  {id:"trplun1", name:"Road Agent",          desc:"Plunder an enemy trader or trade cart",  ev:"plunder_tr",n:1,  xp:2,age:3},
  {id:"oxwood",  name:"Timber Haul",         desc:"Gather 300 wood with an ox cart",        ev:"ox_wood",   n:300,xp:1,age:0},
  {id:"grand1",  name:"Lord of the Crossroads",desc:"Capture the Grand Bazaar",             ev:"cap_grand", n:1,  xp:3,age:0},
  {id:"heal200", name:"Field Surgeon",       desc:"Heal 200 HP of allies (Priest)",         ev:"heal_hp",   n:200,xp:2,age:3},
  {id:"horse1",  name:"Horsebane",           desc:"Cut down a mounted enemy with a spear line unit", ev:"counter_cav",n:1,xp:1,age:0},
  {id:"tower2",  name:"Watchwarden",         desc:"Build 2 Guard Towers",                   ev:"build_tower",n:2, xp:1,age:3}
];
const BUFFS=[ // random at the Blacksmith, 1 XP each. `max` is the per-buff stack ceiling
  // ---- the original twenty-one, rebalanced in v133.0. BOUNTY HUNTER retired here ----
  {id:"dmg",    name:"Honed Edge",       desc:"+7% damage",                                  max:5},
  {id:"atkspd", name:"Quick Hands",      desc:"−10% attack cooldown",                        max:5},
  {id:"crit",   name:"Keen Eye",         desc:"+7% chance of a CRITICAL (2× damage)",        max:3},
  {id:"shield", name:"Raised Shield",    desc:"−7% damage taken",                            max:5},
  {id:"hp",     name:"Stout Heart",      desc:"+10% max HP",                                 max:5},
  {id:"dodge",  name:"Sixth Sense",      desc:"5% chance to dodge any blow",                 max:3},
  {id:"spd",    name:"Fleet Foot",       desc:"+1 move speed",                               max:3},
  {id:"carry",  name:"Deep Satchel",     desc:"+20 carry capacity",                          max:5},
  {id:"gather", name:"Practiced Hands",  desc:"gather 20% faster",                           max:5},
  {id:"builder",name:"Master Builder",   desc:"buildings need fewer hits from you",          max:4},
  {id:"slayer", name:"Wild Slayer",      desc:"+15% damage vs the wilds' creatures",         max:5},
  {id:"captain",name:"Captain's Banner", desc:"+5% damage to allies fighting near you",      max:3},
  {id:"leech",  name:"Bloodthirst",      desc:"heal 7% of the damage you deal",              max:5},
  {id:"regen",  name:"Second Skin",      desc:"+2 HP/s after 5s out of combat",              max:5},
  {id:"zeal",   name:"Zealotry",         desc:"−2s priest resurrect cooldown",               max:3},
  {id:"trade",  name:"Deep Pockets",     desc:"+15% trade-sell payout",                      max:3},
  {id:"parry",  name:"Duelist",          desc:"+0.07s parry window",                         max:3},
  {id:"siege",  name:"Siegewright",      desc:"+15% damage crewing siege engines",           max:3},
  {id:"wreck",  name:"Wrecker",          desc:"+15% damage vs buildings",                    max:3},
  {id:"rally",  name:"Bannerman",        desc:"rally one additional troop",                  max:3},
  // ---- v132.30 BATCH A: eighteen that hook existing code and need no new system ----
  {id:"ambush", name:"First Blood",      desc:"+50% damage to enemies at FULL health",       max:1},
  {id:"trophy", name:"Trophy Hunter",    desc:"+5 max HP with every kill, up to +100",       max:1},
  {id:"cull",   name:"Culler",           desc:"instantly slay wild creatures below 15% HP",  max:1},
  {id:"feast",  name:"Second Wind",      desc:"restore 10% of your HP on a kill",            max:3},
  {id:"fervor", name:"Desperation",      desc:"+1% attack speed per 1% of health missing",   max:1},
  {id:"purse",  name:"Cutpurse",         desc:"pocket 10 gold on a kill",                    max:3},
  {id:"forage", name:"Scavenger",        desc:"pocket 10 food on a kill",                    max:3},
  {id:"mule",   name:"Pack Mule",        desc:"(villager) a fuller load moves faster, to +10%",max:1},
  {id:"thorns", name:"Bramble Mail",     desc:"deal 1 damage back to a melee attacker",      max:3},
  {id:"tribute",name:"Blood Tax",        desc:"gain 1 gold whenever you take damage",        max:1},
  {id:"alchemy",name:"Gilded Harvest",   desc:"mining gold also feeds your team",            max:1},
  {id:"reaping",name:"Rich Soil",        desc:"+20 extra food when you harvest a farm",      max:1},
  {id:"bulwark",name:"Bulwark",          desc:"defensive structures cost you half",          max:1},
  {id:"enginebane",name:"Enginebane",    desc:"(ranged) +50% damage to siege engines",       max:1},
  {id:"woods",  name:"Woodsman",         desc:"+30% damage while fighting in the woods",     max:1},
  {id:"warden", name:"Beast Warden",     desc:"take 10% less damage from the wilds",         max:3},
  {id:"yeoman", name:"Yeoman",           desc:"(villager) double health and double damage",  max:1},
  {id:"kguard", name:"King's Guard",     desc:"+10% damage and −10% damage taken near your King",max:1},
  // ---- v132.32 BATCH B: five that need the timed-modifier system ----
  {id:"frenzy", name:"Killing Frenzy",   desc:"+3 damage per kill, to +15, for 10s",         max:1},
  {id:"surge",  name:"Bloodrush",        desc:"+50% move speed on a kill, fading over 2s",   max:1},
  {id:"flight", name:"Survival Instinct",desc:"+40% move speed for 5s when you drop below 25% HP",max:1},
  {id:"stride", name:"Long Strider",     desc:"+30% move speed while out of combat",         max:1},
  {id:"hunt",   name:"Hunter's Step",    desc:"(melee) +10% move speed for 2s when you land a blow",max:1},
  // ---- v132.34 BATCH C: five that put state on the ENEMY ----
  {id:"bleed",  name:"Serrated Edge",   desc:"15% chance on hit to bleed an enemy — bleeds layer to 60 HP over 20s",max:3},
  {id:"venom",  name:"Venomous",        desc:"15% chance on hit to poison — 10 HP and half speed over 10s",max:1},
  {id:"concuss",name:"Concussive Blow", desc:"(melee) 15% chance on hit to STUN, once every 10s",max:1},
  {id:"gash",   name:"Deep Gash",       desc:"your damage stops an enemy healing for 5s",     max:1},
  {id:"shrug",  name:"Shrug It Off",    desc:"20% chance when struck to shed every debuff",   max:1},
  // ---- v132.35 BATCH D: six that work on everything standing near you ----
  {id:"sanctuary",name:"Sanctuary",     desc:"stand still 3s to open a healing zone — 3% HP a second",max:1},
  {id:"brand",  name:"Searing Presence",desc:"nearby enemies burn for 2 HP a second",         max:3},
  {id:"resolve",name:"Unbowed",         desc:"−5% damage taken for every enemy near you, to −25%",max:1},
  {id:"phalanx",name:"Phalanx",         desc:"+5% damage for every ally beside you, to +20%",  max:1},
  {id:"kinship",name:"Kinship",         desc:"mend 0.5% of max HP a second per soldier of your own kind nearby, to 5%",max:1},
  {id:"steward",name:"Steward",         desc:"(villager) mend nearby friendly buildings, 10 HP a second",max:1},
  // ---- v132.36 BATCH E: procs and charges — the last of John's CSV ----
  {id:"quake",  name:"Earthshaker",     desc:"(melee) 15% chance on hit to slam the ground for area damage",max:1},
  {id:"knives", name:"Knife Fighter",   desc:"15% chance every 2s to hurl a knife for half your damage",max:2},
  {id:"volley", name:"Rapid Volley",    desc:"(ranged) 5% chance to loose THREE shots, once every 10s",max:1},
  {id:"ward",   name:"Arrow Ward",      desc:"block one ranged attack every 24s — 18/12/6/3s as it stacks",max:5},
  {id:"guardup",name:"Iron Guard",      desc:"block one melee attack every 25s — 20/15/10/5s as it stacks",max:5},
  // ---- v133.0 BATCH F ----
  {id:"timber", name:"Timberwright",    desc:"(villager · ox cart) chop timber twice as fast", max:1}
];
// one lookup, built once. BUFFS.find() per call was fine at 21 entries and is the wrong shape
// at 39 and heading for 63.
const BUFF_BY_ID={}; for(const _b of BUFFS)BUFF_BY_ID[_b.id]=_b;
// the per-buff ceiling. A buff with no `max` falls back to the old global, so an omitted field
// degrades to the previous behaviour instead of to zero.
function buffMax(id){const B=BUFF_BY_ID[id];return (B&&B.max)||BUFF_MAX_STACK;}
function buffSt(u,id){return (u&&u.buffs&&u.buffs[id])||0;} // stack count, 0..buffMax(id)
// ---------- v132.31 BULWARK: defensive structures cost half ----------
// "Defensive" is derived from flags already on the building, not from a hand-kept list that could
// drift out of step with BLD: wall:true is every wall and gate, atk is the Guard Tower and the
// Castle, vision is the Watch Tower. Nothing else in BLD carries any of the three.
function isDefensiveDef(dd){return !!(dd&&(dd.wall||dd.atk||dd.vision));}
// THE ONE DOOR. Every build-cost read goes through here — the affordability GATE as well as the
// charge — because if only one of them is discounted the UI and the till disagree and the menu
// greys out a wall the player can afford.
function bldCostD(u,dd){
  const c=dd&&dd.cost;
  if(!c)return c;
  const st=(typeof buffSt==="function")?buffSt(u,"bulwark"):0;
  if(!st||!isDefensiveDef(dd))return c;          // no allocation in the overwhelmingly common case
  const f=Math.pow(0.5,st);
  return {food:Math.ceil((c.food||0)*f),gold:Math.ceil((c.gold||0)*f),
          stone:Math.ceil((c.stone||0)*f),wood:Math.ceil((c.wood||0)*f)};
}
function bldCost(u,type){return bldCostD(u,BLD[type]);}
function carryCap(u){return u&&u.cls==="oxcart"?300:20+20*buffSt(u,"carry");} // Deep Satchel · v99: the ox bed takes 300
// v133.0 THE SWING CLOCK, in one place, because two frame paths compute it — 09-main for the host
// and 10-net for a guest — and they drifted apart the last time a buff touched gathering.
// PRACTICED HANDS compounds at 20% a stack (John's call): 0.6 → 0.48 / 0.38 / 0.31 / 0.25 / 0.20s,
// a 3x rate at full stack. It was −0.1s flat, which reached 0.1s and a SIX-fold rate.
// TIMBERWRIGHT halves it again, for wood, for the two classes that haul it.
function gatherSwing(u,node){
  let t=0.6*Math.pow(0.8,buffSt(u,"gather"));
  if(node&&node.type==="wood"&&u&&(u.cls==="villager"||u.cls==="oxcart")&&buffSt(u,"timber"))t*=0.5;
  return t*((node&&node.slow)||1);
}
const townBoards=[]; // {team,x,z,mesh} — stood up beside each Town Center by world gen
const MIL_LINES=["melee","anticav","ranged","cavalry","scoutline","meleesiege","rangedsiege"];

// ---------- v94: AI DIRECTOR PERSONALITIES ----------
// Every AI marshal rolls one at game start (announced by scouts ~45s in). Pure data —
// the exporter reads this table, so keep it closures-free. farms = farmsBase + farmsPerAge*age.
// trainW overrides the line weights when composing the army (base weights fill the gaps).
const PERSONALITIES={
  rush:{name:"Rush",flavor:"sharpens crude spears for early, relentless waves",
    ageBufF:900,ageBufG:400, farmsBase:2,farmsPerAge:1, pits:2,
    houses:8,towers:2,castles:1,markets:1,walls:0,
    raidAt:80,raidEvery:45,raidJit:25,raidMin:5,raidFrac:0.75,
    trainMin:2.2,trainMax:4, minVills:9, reserveF:40,reserveG:15, kgBase:4,
    econHunters:2,assassins:1,
    trainW:{melee:5,anticav:4,ranged:2,cavalry:2,scoutline:3,rangedsiege:1,meleesiege:0}},
  boom:{name:"Boom",flavor:"hoards grain and gold, racing for the Enlightenment",
    ageBufF:60,ageBufG:25, farmsBase:4,farmsPerAge:2, pits:4,
    houses:10,towers:2,castles:1,markets:3,walls:0,
    raidAt:400,raidEvery:110,raidJit:40,raidMin:12,raidFrac:0.5,
    trainMin:4,trainMax:5, minVills:14, reserveF:220,reserveG:90, kgBase:7,
    econHunters:0,assassins:0,
    trainW:{melee:3,anticav:3,ranged:3,cavalry:3,scoutline:1,rangedsiege:3,meleesiege:1}},
  turtle:{name:"Turtle",flavor:"piles stone on stone — walls, towers and patience",
    ageBufF:300,ageBufG:120, farmsBase:3,farmsPerAge:1, pits:2,
    houses:8,towers:4,castles:2,markets:1,walls:8,
    raidAt:600,raidEvery:150,raidJit:60,raidMin:16,raidFrac:0.85,
    trainMin:3,trainMax:4.5, minVills:12, reserveF:120,reserveG:60, kgBase:9,
    econHunters:0,assassins:0,
    trainW:{melee:2,anticav:3,ranged:5,cavalry:1,scoutline:1,rangedsiege:3,meleesiege:1}},
  expand:{name:"Expansionist",flavor:"builds wide — pits, markets and fields without end",
    ageBufF:200,ageBufG:80, farmsBase:3,farmsPerAge:2, pits:5,
    houses:14,towers:3,castles:2,markets:5,walls:0,
    raidAt:280,raidEvery:90,raidJit:40,raidMin:9,raidFrac:0.55,
    trainMin:3,trainMax:4.5, minVills:13, reserveF:140,reserveG:60, kgBase:6,
    econHunters:1,assassins:0,
    trainW:{melee:3,anticav:3,ranged:3,cavalry:3,scoutline:2,rangedsiege:2,meleesiege:1}}
};
// ---------- v94: AI DIFFICULTY (applies to teams with NO human players) ----------
// easy/hard are the co-op & solo dials; "normal" is the supportive brain human teams keep.
const AI_DIFF={
  easy:  {name:"Easy",  think:2.2, eco:1.0, raidMul:1.6,  raidFracMul:0.6, trainMul:1.6, buf:1.5, counter:false},
  normal:{name:"Normal",think:1.0, eco:1.0, raidMul:1.0,  raidFracMul:1.0, trainMul:1.0, buf:1.0, counter:false},
  hard:  {name:"Hard",  think:0.6, eco:1.2, raidMul:0.75, raidFracMul:1.1, trainMul:0.7, buf:0.8, counter:true}
};
let aiDifficulty="easy"; // the solo/co-op dial (EASY|HARD in the menus); human teams always run "normal"
let MYTEAM=BLUE; // the LOCAL player's team — red guests flip this on join
let inMenu=true, menuOrbitT=0; // v81: the war WAITS at the main menu — the world idles as a cinematic backdrop
let siegeAim=false, lobTarget={x:0,z:0}, lobRing=null; // the catapult/trebuchet skill shot
let camYaw=Math.PI/2, camPitch=0.62, camDist=18;

// ---------- optional character models ----------
// Drop rigged .glb files into assets/models/ and register them here.
// Classes WITHOUT an entry keep the built-in blocky rig. See
// assets/models/README-ASSETS.md for free CC0 sources and tips.
// Example:
//   man_at_arms:{file:"assets/models/knight.glb", scale:1.2, y:0, rotY:Math.PI},
const MODEL_MANIFEST={}; // imported models retired — characters use generated pixel skins.
// The Tripo→Mixamo pipeline (tools/autorig.py, tools/mixamo_merge.py) still works if
// a hero model is ever wanted: register it here and it overrides the generated look.

// ---------- trade ----------
// neutral bazaars: near / center / deep — risk scales with distance, gold scales harder
const neutralMarkets=[]; // populated by world gen: {x,z,grand,plaza,owner,cap,capTeam}
// ==================== v132.26 THE CAPTURABLE BAZAARS ====================
// John: "stand in plaza as you recommend but it doesn't decay back to neutral. But the opposing
// team can come and capture it." And: "hold your bazaar, plus 1 of every resource per second. Hold
// the grand bazaar - plus 3. Hold all 3 bazaars - plus 8."
//
// STICKY OWNERSHIP IS THE DESIGN AND IT SHAPES THE REST. A control point that bleeds back to
// neutral asks you to garrison ground you already took, which on a map this size means parking a
// band on a plaza for the whole match — the exact behaviour v113 wrote HOLD_TOUR to stop the AI
// doing. So you keep a bazaar until somebody comes and takes it. The price is that a capture has to
// be REVERSIBLE while it is running, or a defender who arrives at 90% can only watch it fall:
//   one team alone, not theirs   -> cap climbs; at 1.0 it flips
//   one team alone, already theirs -> cap FALLS. This is the only thing that lowers it.
//   both teams present           -> frozen. Contested means contested.
//   nobody                       -> frozen, per the ruling.
// BAZ_CAP_R is a MARGIN on the plaza's own radius, not a radius of its own: the Grand's plaza is
// 11.4 and the two on the Viking roads are 8.6, so a fixed number would make the big one easier to
// stand outside of and the small ones easier to hold. Each bazaar is captured from its own square.
const BAZ_CAP_T=12;      // seconds of uncontested presence to flip one
const BAZ_CAP_R=1.5;     // …standing this far outside the plinth still counts as being on the square
// v132.27 KEYED ON THE COUNT, NOT ON WHICH ONES. John: "the bazaar trickle rates feel way
// overtuned — hold 1 bazaar 1 wood, food, gold per second; hold 2, 2; hold all 3, 4."
// v132.26 paid per bazaar and weighted the Grand (side 1, Grand 3, all three 8). This is indexed by
// how many you hold and nothing else, so a swept map pays 12 resources a second where it paid 32.
// THE GRAND NO LONGER PAYS MORE THAN EITHER OF THE OTHERS, and that is a design change rather than
// a number: it is still the bigger building, still at the middle of the map and still the hardest
// of the three to hold, and it is now worth exactly what the pair on the Viking roads are worth.
// If it should keep a premium, this array is the place to say so.
// STILL SUPERLINEAR, which is the part worth keeping: 1 / 2 / 4 DOUBLES at the sweep rather than
// adding a third, so taking the last bazaar is worth more than taking the second. An objective that
// pays linearly in how much of it you hold is one nobody contests the last of.
const BAZ_YIELD_BY_HELD=[0,1,2,4];
// AND STONE IS NOT IN IT. "Stone needs to remain scarce" (John) is a rule this file already states
// about the map — placeNodes calls it "a scarce critical mineral" and tools/smoketest.js asserts
// there are exactly six piles on the whole map, one of them deep on the axis so that somebody has
// to march for it. A tap that pays stone for standing still is that rule cancelled: at v132.26's
// +8 a swept map paid 480 stone a minute against 4,200 on the entire map. Food, gold and timber.
const BAZ_YIELD_RES=["food","gold","wood"];
function bazaarYield(team){
  if(!neutralMarkets.length)return 0;
  let held=0;
  for(const m of neutralMarkets)if(m.owner===team)held++;
  return BAZ_YIELD_BY_HELD[Math.min(held,BAZ_YIELD_BY_HELD.length-1)]||0;
}
// ==================== v132.1 THE TWO ROUTES, AND THE ONE LIST OF BAZAAR SITES ====================
// These live in 00-data rather than 02-world for one reason: 01-engine's terrainHeight() has to
// FLATTEN the ground under every plaza, and it used to do that from three hand-typed coordinates
// that were the old bazaar positions. That is the drift tools/mapconst.js exists to catch. Defined
// ahead of both consumers, they cannot disagree.
// roadPoint is mirror-symmetric about x=0 — z(t) === z(1-t) — so anything placed at t and 1-t is
// EXACTLY as far from one throne as from the other. Keep it that way.
function roadPoint(t){
  const A=TCPOS[0],B=TCPOS[1];
  return {x:A[0]+(B[0]-A[0])*t,
          z:A[1]+(B[1]-A[1])*t+Math.sin(t*Math.PI)*16+Math.sin(t*Math.PI*3)*4};
}
// THE VIKING ROAD: one branch per team, throne -> the boss pocket's MOUTH. The bay is centred
// (0, -196) with r 52 so it spans z -248..-144, while the walkable border is |z| <= MAP.z+9; -150
// is inside the mouth and outside the boss's own ground. The bow is what stops it reading as a
// ruler: it swings away from the King's Road on the way out.
const VIKING_END={x:0,z:-150};
// v132.9 THE BOW HAD THE WRONG SIGN AND THE COMMENT ABOVE IT WAS DESCRIBING WHAT IT MEANT TO DO.
// A.z is 0 and B.z is -150, so the straight line runs NEGATIVE — and the z term added a POSITIVE
// sin(t*PI)*18, pulling the road back UP towards z=0, which is where the King's Road is. Measured
// on the shipped build, 18.7 / 20.0 / 25.8 units apart at t = 0.10 / 0.15 / 0.20.
// TWENTY UNITS IS NOT THE PROBLEM BY ITSELF — the ribbons are only 5.9 and 3.2 of half-width. The
// TREE CLEARANCE is: 21 for the King's Road plus 12 for this one is 33 against a 20-unit gap, so
// the two cleared corridors merged into one bare avenue with a stripe of lawn up the middle. That
// is John's "too close together": not the roads, the wood that was no longer between them.
// -30 swings it AWAY, southward, as the comment always claimed; 0.55 gives +-14.3 of lateral swing
// instead of +-9.1 on a 231-unit road. Separation becomes 27.6 / 34.9 / 54.0 against a 33 sum.
// KEEP THE MIRRORING. z(team 0) === z(team 1) and x mirrors about 0, so neither branch is shorter
// and the two team bazaars — which are DEFINED as vikingPoint(team, 0.42) and so move with this —
// stay exactly as far from their own thrones as each other.
function vikingPoint(team,t){
  const A=TCPOS[team], B=VIKING_END;
  const bow=Math.sin(t*Math.PI)*(team===0?-26:26);   // mirrored, so neither team's path is shorter
  return {x:A[0]+(B.x-A[0])*t+bow*0.55,
          z:A[1]+(B.z-A[1])*t-Math.sin(t*Math.PI)*30};
}
// v132.11 A MARKET BESIDE A ROAD, NOT ON IT. John: "grand bazaar should be to the right of kings
// road while the other two bazaars should be to the left of vikings roads. right now all bazaars
// are directly on top of the roads." The Grand had an offset of 3.2 against a plaza of 11.4 and a
// ribbon reaching 5.86 of half-width, so the road ran 8.2 units inside its outer step; the team
// bazaars had NO offset — they were the spine itself, with the track through the flagstones.
//   Grand  11.4 + 5.86 + 6 of visible lawn = 23.3 -> 24
//   team    8.6 + 3.22 + 6                 = 17.8 -> 18
// WHICH SIDE IS NOT ARBITRARY. Blue faces +x down the King's Road, so right = cross(forward,up) =
// +z, and the sketch agrees on both counts: the Grand Bazaar is drawn on the far side of the King's
// Road from the Vikings (+z), and both team bazaars sit OUTSIDE the Viking arc (-z).
// THE TEAM OFFSET RIDES THE SPINE'S OWN NORMAL, not z. The Viking road runs diagonally and its
// bearing turns along its length, so a flat +-z offset would swing the plaza from beside the road
// to in front of it. Take the across-track normal from a central difference and keep the one
// pointing away from the King's Road — the same construction the ribbon uses for its cross-sections.
function vikingOffset(team,t,off){
  const e=0.004;
  const a=vikingPoint(team,Math.max(0,t-e)), b=vikingPoint(team,Math.min(1,t+e));
  let tx=b.x-a.x, tz=b.z-a.z; const tl=Math.hypot(tx,tz)||1; tx/=tl; tz/=tl;
  let nx=-tz, nz=tx;
  if(nz>0){nx=-nx; nz=-nz;}                       // away from the King's Road
  const c=vikingPoint(team,t);
  return {x:c.x+nx*off, z:c.z+nz*off};
}
// The three sites, and everything downstream reads THIS. `plaza` is the plinth's outer step, which
// is what the terrain has to be level across and what the foliage has to keep off.
const BAZAAR_SITES=[
  {what:"grand", grand:true,  scale:1.32, plaza:11.4, p:()=>{const q=roadPoint(0.5); return {x:q.x,z:q.z+24};}},
  {what:"blue",  team:0,      scale:1.00, plaza:8.6,  p:()=>vikingOffset(0,0.42,18)},
  {what:"red",   team:1,      scale:1.00, plaza:8.6,  p:()=>vikingOffset(1,0.42,18)},
];
function tradeGold(d){return Math.round(0.35*d+0.002*d*d);} // superlinear: risk pays a premium
