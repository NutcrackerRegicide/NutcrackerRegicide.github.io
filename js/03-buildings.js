/* REGICIDE PVP — 03-buildings.js */
// ---------- buildings: six ages of architecture, all 2x scale (v53) ----------
// Every building renders in the style of its team's CURRENT age and re-dresses on age-up.
// 0 Stone: hide-and-mammoth-bone lodges (Mezhirich). 1 Bronze: battered sandstone, Egypt/Minoa.
// 2 Iron: roundhouses & thatched longhouses. 3 Classical: marble, columns, pediments.
// 4 Medieval: Romanesque mass with gothic accents. 5 Enlightenment: white neoclassical grandeur.

// v128: the age palettes were all earth and ash. The ROOFS carry a stylised town — they are the
// one big block of non-green in a very green world — so each age's roof got pushed toward a
// saturated hue while the walls stayed pale, which is exactly the Pallet Town read: bright roof,
// clean wall, green everywhere else.
//
// v130 B2 — SAME IDEA, HONEST HEXES. Every row is now ART-DIRECTION §2.4, and the row that
// mattered was age 4: it was a GREY-BLUE town (0x99a2ac walls under 0x3f6d8c roofs, with a
// riveted "metal" weave on domestic plaster) in a game whose whole reference is Age of Empires,
// where the castle age is warm stone and red tile. Blue-grey is the one hue family that cannot
// win against a green field — it is the same value and the opposite temperature, so an age-4
// town went FLATTER than the age-3 one it replaced, in the age matches spend the longest in.
//
// The ladder these six rows draw, which is the thing a player should read from across the map:
//   0 smoked hide + bone frame    1 sandstone + reed        2 limewashed daub + shingle
//   3 white marble + terracotta   4 warm plaster + deep tile + grey stone + black timber
//   5 marble + verdigris copper
// Walls climb in value 0.30 → 0.91 across the ladder while the roofs stay dark, so an age-up
// reads as "the town got BRIGHTER, the roofs did not" — progression visible at 46px without
// resolving a single texture. Eyedroppered out of a render, roof-to-wall lands at 0.42 / 0.32 /
// 0.41 for ages 2 / 3 / 4, all clear of AD §2.4's 0.25 floor, roof darker in every pair.
//
// TRAP, and it is why these are constants and not literals at the call sites: `wallC` is read
// from ~forty places across `buildingMesh` and `ROADPAL` below was tuned against it. Change one
// and RE-RENDER — the post-grade pushes saturation, so a roof hex always comes out hotter on a
// screen than it looks in this table.
//
// v131 B — THE TABLE IS NOW AGES §F.0, HEX FOR HEX, AND IT CARRIES THE ROOF FORM AS WELL AS THE
// ROOF COLOUR. That second half is the whole point. The v130 rows were six colours poured into
// ONE shape: every age past 0 was a box under a 35-45° gable, so an age-up moved the paint and
// nothing else, which AD §5.7 says does not count at 46px and §H/A5 now fails outright. §F.0
// gives each age a FORM — cone, flat deck, low gable, low hip, steep gable, hip-plus-cupola —
// and `pitch` and `form` here are what `ageRoof` dispatches on, so a caller cannot get the
// colour of an age without also getting its silhouette.
//
// IT IS CALLED BPAL, NOT AGEPAL, AND THAT IS NOT COSMETIC. `AGEPAL` is now the UNIT age palette
// in js/00-data.js — two top-level `const AGEPAL` declarations in one document is a hard
// SyntaxError that takes the whole game down at parse, and the file that loads second loses.
// The building shell and the costume ladder are different tables with different jobs; naming
// them apart is what stops the next person merging them by accident.
//
// THE ROOF LADDER, MEASURED (CIEDE2000, D65, on the authored hexes — AGES §A.0). SEVEN ROOFS, NOT
// SIX: age 5 has two and §F.0's own table only laddered the civic copper, which is why the slate
// on five-sixths of a gunpowder town went unmeasured until §H/A5's town shot caught it at 9.2.
//   Stone/Iron 14.3 · Stone/Medvl 16.3 · Iron/Medvl 23.2 · Class/Medvl 32.7 · Medvl/E5slate 16.0
//   Iron/E5slate 20.4 · E5copper/E5slate 36.4 — worst of the 21 pairs = 14.3, floor is 12.
// ROOF/WALL |ΔV| (§5.5, floor 0.25): 0.320 / cornice 0.342 / 0.337 / 0.413 / 0.414 / 0.516.
//
// THE ONE HEX THAT IS NOT §F.0's: age 2's roof. §F.0 authors weathered oak shingle at #48453C and
// §F.6 puts slate #3E4650 back on the Enlightenment house and farm — and those two are ΔE00 11.8
// apart, i.e. an Iron roof and a gunpowder-age roof are the same dark grey. #5E4030 is #48453C
// warmed toward the age's OWN `age2.rust #7A4A32`: identical V (0.271, so §5.5's roof/wall break
// is untouched), Iron/Enlightenment-slate goes 11.8 -> 20.4, and Iron/Medieval goes 13.8 -> 20.9
// into the bargain. The age-5 hex is NOT the one that moved, deliberately — it is a §A.3 unit
// colour (`age5.metal`) as well as a roof, and moving it would move a musket barrel.
//
// TRAP, and it is why these are constants and not literals at the call sites: `wall` is read from
// ~forty places across `buildingMesh` and `ROADPAL` below was tuned against it. Change one and
// RE-RENDER — the post-grade pushes saturation, so a roof hex always comes out hotter on a screen
// than it looks in this table. And it must be re-rendered through tools/townages.js, which draws
// with composer.render(); a bare renderer.render() skips the bloom cliff at 0.86 (§G.6).
// THE SECOND HEX IN THE `stone` SLOT WAS NEVER LADDERED AGAINST THE ROOF ABOVE IT, AND THREE AGES
// FAILED §H/A6 FOR THAT ONE REASON. §F.0's "wall" column names two hexes per age and its roof/wall
// contrast column is quoted against the FIRST one only — daub 0.678, fieldstone 0.609, limewash
// 0.770 — so the ages look laddered on paper. But §H/A6 measures whatever wall the BUILDING has,
// and the town centre, the keep, the castle, the tower, the peel tower and the tithe barn are all
// built out of the SECOND hex. Authored, those pairs were: Stone drystone 0.523 over thatch 0.358
// = 0.165, Iron footing 0.523 over shingle 0.271 = 0.251, Medieval ashlar 0.588 over slate 0.356
// = 0.232. Three ages, nine rows, all of them under a floor of 0.25 before a single pixel was
// drawn — and no gate could see it, because §F.0's own table never quotes the second pair.
//
// AND THE DIRECTION IS THE OPPOSITE OF THE OBVIOUS ONE. The round-2 note prescribed taking the
// Medieval second hex DOWN about 0.12 V. That walks it INTO the roof: ashlar 0.588 minus 0.12 is
// 0.468 against a slate that renders 0.34-0.44, i.e. |dV| 0.03 and the castle disappears into its
// own turret caps. Every one of these walls is ALREADY the brighter half of its pair, so the only
// direction that opens the gap is UP — and up is also what §5.5 wants, since it keeps the roof the
// darker of the two, which is the rule for every age below 5.
const BPAL=[
  // 0 STONE — daub over wattle on drystone, dark thatch, CONE at 45°. No base course: §F.1 sinks
  // these into an earth mound, so the berm IS the ground line.
  // `stone` is PALE LIMESTONE, not the old mid-grey: the town centre's outer drystone ring is the
  // one wall face on that building the sun ever reaches (the daub cell inside it lives in the
  // cone's shadow by construction), and at 0x8E8478 it rendered 0.489 under a thatch cone at
  // 0.305 — a brown ring under a brown cone with a pale stripe pinched between them. Dry-stone
  // walling in limestone IS the paler material of the two; the old hex had it darker than the mud.
  {wall:0xB8AC94,stone:0xBCB0A0,roof:0x6E5A30,dark:0x4A3826,timber:0x8A6B45,trim:0xC9BBA0,
   pat:"hide", roofPat:"hide", eave:0.14, pitch:45, form:"cone", base:0},
  // 1 BRONZE — sun-dried mudbrick on an ashlar socle, FLAT deck with a parapet: the deliberate
  // opposite of the Stone cone. Deck 0.655 against wall 0.678 is only 0.023, so §F.0's exemption
  // applies and the 0.10 H CORNICE BAND is what carries the contrast. `dark` is that band.
  {wall:0xCBA97A,stone:0xC0B49C,roof:0xC4A470,dark:0x6E5230,timber:0x8A6B45,trim:0xCFB53B,
   pat:"cloth",roofPat:"cloth",eave:0.14, pitch:0,  form:"flat", base:0.3},
  // 2 IRON — fieldstone and timber frame under a LOW GABLE. 30°, not 25: §F.0 gives Iron 25-30
  // and Classical 22-28, which OVERLAP, and §H/A5 fails any adjacent pair within 6° of each
  // other. 30 against Classical's 23 is the 7° that clears it, and the forms differ too.
  // `stone` is the same pale limestone as age 0's and DELIBERATELY the same hex — the footing and
  // the watch tower's four piers are the only age-2 faces that use it, and sharing one (kind,hex)
  // pair with age 0 keeps this at ONE atlas cell instead of two (§G.4). Against the age's own
  // #5E4030 shingle it is 0.425 authored, up from a 0.251 that never cleared the floor.
  {wall:0xA39A90,stone:0xBCB0A0,roof:0x5E4030,dark:0x3A3A38,timber:0x5A4630,trim:0x7A4A32,
   pat:"metal",roofPat:"wood", eave:0.14, pitch:30, form:"gable",base:0.3},
  // 3 CLASSICAL — travertine and marble on a podium, terracotta LOW HIP at 23°.
  //
  // THE WALL IS §F.0's VALUE WITH ONLY THE RED CHANNEL CLAMPED, AND THAT IS §I OPEN QUESTION 2
  // ANSWERED WITH A MEASUREMENT. §F.0 authors travertine #E0CFA8 — (224,207,168), V 0.815 — and
  // the ceiling §G.6 derives, the one the shipped beard broke, is a MAX CHANNEL of 216; §A.3 says
  // it in as many words on age5.buff. Only the RED channel of #E0CFA8 is over it. Rendered through
  // composer.render(), a Classical town on the authored hex put 8,375 pixels ON 255 and 2,362
  // above 216 in ALL THREE channels, with the town centre's sunlit wall at (255,255,242) — two
  // channels pegged, every fold gone, on the largest flat surface in the age. v131.2 answered that
  // by dropping the WHOLE hex two values to #D8C8A2 (V 0.787), which is 0.028 of value this age
  // cannot spare and did not have to. #D8D2AC is (216,210,172): red held AT the ceiling, green and
  // blue carrying the value back to 0.818 — §F.0's 0.815 within a rounding step — and nothing over
  // 216. It is 4.4 ΔE00 off §F.0's hue, a shade less warm, and it BUYS age separation rather than
  // spending it: against the age-5 render #D2C8B4 it goes 5.71 -> 6.91 and against age-4 limewash
  // 3.34 -> 5.12. The marble stays at #D6CDB6 (214) — it is already under the ceiling.
  //
  // AND THE ROOF CAME DOWN 5%, WHICH LOOKS LIKE THE ONE MOVE §F.0 FORBIDS AND IS THE OPPOSITE OF
  // IT. READ THIS BEFORE PUTTING #B4543A BACK.
  // §F.0 authors this roof at V 0.402 and says Classical and Medieval sit within 0.03 of each
  // other on purpose — "a critic must not fix it by darkening one". #B4543A does not RENDER at
  // 0.402. Through composer.render() it comes back at 0.422-0.458 across the age's thirteen roofed
  // rows, up to 0.056 ABOVE the value the law states, and its red channel renders at 216 on the
  // farm, the stable and the storage pit and 218 on the market — the biggest roof plane in the
  // game sitting on §G.6's ceiling and being lifted by the bloom pass. Every other age's roof
  // renders within 0.02 of its authored value; this is the only hex in the set saturated enough to
  // climb the bloom cliff, and that climb is what ate §5.5's break. #AA5036 is the same colour 5%
  // down — ΔE00 2.48 off §F.0's hex, the same hue to the degree — and it steps off the cliff:
  // rendered red 216 -> 192, and the roof lands on V 0.401 on eleven of the thirteen rows. That is
  // §F.0's own 0.402. This is not darkening the roof; it is stopping the roof rendering brighter
  // than the law says it is, and the ladder gets MORE correct, not less — authored
  // Classical/Medieval goes 32.68 -> 31.68 ΔE00 and the pair §F.0 protects still separates by hue
  // and by 23° against 50° of pitch.
  //
  // WHY IT TOOK BOTH. Measured with tools/_a6probe.js, thirteen rows per candidate, against
  // §H/A6's floor of 0.25 with six rows under it (town centre 0.225, farm 0.202, stable 0.220,
  // storage pit 0.241, blacksmith 0.243, barracks 0.247):
  //   · WALL ALONE SATURATES. 0.787 -> 0.818 clears all six, but the worst row lands at 0.260 —
  //     0.010 of margin on an instrument whose thin rows move by that much. Pushing on to 0.830
  //     makes it WORSE, 0.255, because a brighter wall blooms into the roof pixels beside it.
  //     +0.03 of authored value is the entire lever and it buys about 0.035.
  //   · ROOF ALONE clears them at V 0.353, and THAT really would invert §F.0's pair. At 0.381 —
  //     the value whose render lands on 0.402 — it does not.
  //   · TOGETHER: 0 rows under the floor, worst 0.289, and the rendered roof spread collapses from
  //     0.422-0.458 to 0.380-0.408.
  //
  // AND THE STRUCTURAL REASON IT IS THIS AGE AND NOT ANOTHER — THE PART TO KEEP EVEN IF THE HEXES
  // MOVE AGAIN. The toon ramp's top break is at dotNL 0.52 (01-engine.js, AD §3.7). Under the
  // game's own sun a VERTICAL wall is dotNL 0.333 facing +x and 0.444 facing +z — both in the MID
  // cell, 146/255 — while a 23° hip is 0.593 to 0.939 on all four of its faces, the LIT cell, 255.
  // Classical is the only age whose roof has no face outside the top cell: the Stone cone wraps
  // through three cells, the Medieval 50° gable puts its back slope at 0.195, the Bronze deck is
  // flat and exempt. So this age alone pays a full band on the wall and nothing on the roof, and
  // §5.5's authored break compresses by ~0.13 of value before a single hex is chosen. There is no
  // geometry answer inside §F.0's 22-28° window — a face needs about 40° of pitch to fall out of
  // the top cell — so the two hexes ARE the lever, and both of them had to move.
  {wall:0xD8D2AC,stone:0xD6CDB6,roof:0xAA5036,dark:0x2A2018,timber:0x6B4A2E,trim:0xC9A03C,
   pat:"cloth",roofPat:"cloth",eave:0.18, pitch:23, form:"hip",  base:0.5},
  // 4 MEDIEVAL — limewash between dark oak on an ashlar plinth, green-grey slate, STEEP at 50°.
  // §F.0 notes Classical and Medieval sit within 0.03 of each other in VALUE and separate by hue
  // (terracotta vs slate, ΔE00 31) and by pitch (23 vs 50). That is deliberate. Do not "fix"
  // it by darkening one — you would break the roof/wall break at the same time.
  //
  // THE SECOND HEX THAT IS NOT §F.0's, AND IT IS THE SAME COLLISION AS AGE 2's, ONE RUNG UP.
  // §F.0 authors Medieval slate at BLUE-grey #5A6068 and §F.6 puts blued slate #3E4650 on the
  // Enlightenment house, farm, storehouse, foundry and arsenal. Those two are ΔE00 9.2 apart on
  // the authored hexes and 9.99 through composer.render() on tools/townages.js's roof band — the
  // worst of the 15 pairs, under §H/A5's floor of 12, i.e. a medieval town and a gunpowder town
  // are the same grey roof at one value's difference. §F.0's own ladder never caught it because
  // it measured age 5 as the civic COPPER; the slate five-sixths of that town is not in the table.
  // The age-5 hex is again NOT the one that moved, for the reason age 2 gives: it is `age5.metal`
  // and moving it would move a musket barrel.
  //
  // IT MOVED IN HUE, NOT IN VALUE, AND THAT IS FORCED. Stone's roof band sits at V 0.51 and
  // Enlightenment's at 0.29, so Medieval at 0.39 is sandwiched: lighten it and Stone/Medieval
  // falls to 10.8, darken it and the failing pair gets worse. Chroma is the only free axis, and
  // §A.2 already says so — "that is why the test in §H is ΔE00 and not ΔV alone". Two of the
  // three chroma directions are spoken for:
  //   · WARM is the trap the obvious fix walks into. Thatch on a second Medieval row renders at
  //     (121,93,41) and the Stone Age's cones render at (124,95,42) — ΔE00 1. The A5 auto number
  //     cannot see that collision (a cone's bbox band is half sky, so Stone reads as a washed
  //     #868470), but a critic doing A5's PRIMARY forced-choice looks at the crops and can.
  //   · PURPLE is the Classical king's private colour and §C claims it as "the only purple
  //     surface in the entire game". A town of it would make that sentence false.
  // Green-grey is what is left, and it is the honest material anyway: Westmorland and Cumbrian
  // slate are grey-GREEN and were on English roofs centuries before the blue Welsh slate that
  // #5A6068 is actually a picture of — that one is a railway-age material on a medieval building.
  // Measured through composer.render(): the failing pair goes 9.99 -> 15.90 and the worst of the
  // 15 town-band pairs goes 9.74 -> 15.03 — it is Stone/Medvl now, and it paid 0.8 of its old
  // 15.8 for that. On the authored hexes 9.2 -> 16.0. (Two runs put the failing pair at 15.9 and
  // 17.2: the band figure is a median over a rendered mixture and moves about a unit between
  // processes, so read it with a unit of slack and do not tune to the last decimal.) The band
  // lands at (90,99,76), V 0.374 — §F.0's own stated Medieval roof value, unchanged, because only
  // the hue moved. FOUR Medieval §H/A6 roof/wall rows crossed back over the 0.25 floor with it —
  // house, archery_range, stable and siege_workshop, Medieval rows under the floor 10 -> 6 — and
  // the six that are still under it are the ones measured against ASHLAR rather than limewash,
  // where §F.0's own pair is 0.232 and was never over the floor to begin with. C* 9.6 keeps it
  // reading as slate and not as grass — the roofs are still the one big non-green block in a very
  // green world. THIS IS A DEVIATION FROM §F.0 AND IT BELONGS IN §I: the ladder in §F.0 needs a
  // seventh entry for age 5's domestic slate, and then either this hex or that one is wrong.
  //
  // RE-MEASURED IN THREE FRESH PROCESSES AFTER THE MOVE, BECAUSE THE ROUND THAT SCORED THIS HEX
  // SCORED #5A6068 AND ITS NUMBERS ARE ABOUT A BUILD THAT NO LONGER EXISTS. townages.js, three
  // runs: Medvl/Enlightenment 16.41 / 17.18 / 15.35, worst of the 15 = Stone/Medvl 15.09 / 15.34
  // / 15.28, floor 12. The gate passes with margin on every run. What is left is NOT a second hex
  // move, and the next three paragraphs are the reason, written down so nobody has to rediscover
  // them by breaking a passing gate.
  //
  // THE RESIDUAL IS REAL, IT IS THE COPPER RATHER THAN THE SLATE, AND THE INSTRUMENT THAT SHOWS
  // IT CANNOT BE TRUSTED TO A DECIMAL. Crop the six towns WIDE instead — walls in, no roof
  // filter, one median over the whole building band, which is how the round-1 critic corroborated
  // its 6.04 — and the pair comes out 9.05 / 9.22 / 13.35 over the same three runs. Up from 6.04,
  // so the move did its work, but two of the three are still under 12. TWO SEPARATE THINGS ARE
  // GOING ON AND ONLY ONE IS ABOUT COLOUR. (a) §F.6's verdigris `civic` two rows below is green,
  // the town centre's hip is the biggest roof in the age, and a wide crop weights it: roofs-only
  // lands the age-5 median on SLATE (66,74,80, blue) while a wide crop drags it to (72,83,78),
  // green — closing the gap the slate opened. (b) The Medieval half of that wide crop is a coin
  // flip. Its median lands on (90,99,76) on one run and (97,108,83) on the next, because a wide
  // band over a Medieval town is ~50/50 slate roof and limewash wall and the median falls to
  // whichever side wins by a pixel. THAT is the 4-point swing, not the paint. Quote the wide crop
  // as a direction, never as a number, and do not tune anything to it.
  //
  // AND THE OBVIOUS FIX IS A TRAP TWICE OVER. "Extend one more warm roof to a second Medieval
  // row" (a) cannot move the gate's number at all — the band figure is a MEDIAN over every
  // sampled pixel in the town, and a minority roof does not move a median, only a mean — and
  // (b) spends the pair that is now genuinely tightest. Stone/Medvl is the worst of the 15 at
  // 15.09, and warming Medieval walks straight at it. The warm axis is boxed at BOTH ends anyway:
  // any hex far enough from Stone thatch #6E5A30 to clear 12 (#8A7448 is 10.0, #8E7A4A is 12.3)
  // is by then inside 15-17 of the Bronze deck #C4A470. There is no warm hex with room on both
  // sides. The farm barn's thatch is the ONE warm Medieval roof and it should stay the one.
  //
  // SO: DO NOT MOVE EITHER HEX AGAIN. §F.0's roof ladder has six rungs and the game has seven
  // roofs; the seventh is age 5's domestic slate and it was never laddered. That is an owner
  // ruling, not a lane's — until it lands, this hex is where the constraints put it.
  //
  // `stone` DID move, and it is the OTHER hex, not the roof. See the header note above BPAL: the
  // ashlar is what the keep, the castle, the round tower, the peel tower, the tithe barn and the
  // Gothic temple are made of — six of the age's eighteen rows and every big one — and at
  // #9A968A it was 0.232 above the slate, i.e. under §H/A6's floor as authored, with the castle
  // rendering at 0.190 because its turret CONES catch the sun at 0.444 while a gable reads 0.339.
  // Limewashed pale is the historical answer as well as the readable one: the White Tower was
  // whitewashed, and every Norman keep worth the name was rendered or limed. #B8BCC2 is 0.736,
  // 0.379 clear of the slate, and it is COOL where the limewash next door is warm — §A.2's
  // "desaturated, cool, matte" — so the keep and the timber-framed house still separate by hue at
  // a value they now share.
  // AND IT IS COOL FOR A SECOND REASON, WHICH IS THE ONE THAT WOULD HAVE BITTEN. The A5 roof band
  // takes the top 6-30% of each building's box, and the keep's turret heads live in that band; a
  // WARM pale ashlar would have been read as roof by tools/townages.js's onRoof() filter and
  // dragged the Medieval band median up into Stone's, which is already the worst A5 pair at 15.3.
  // A cool one is rejected by that filter's sky clause (B >= R-4 and V > 0.60) and never enters
  // the band at all. Measured after the move: Stone/Medvl 15.31 -> 15.51, band unmoved at V 0.374
  // on the same 48.5k pixels, i.e. the A5 ladder took the change and did not notice it.
  {wall:0xCFC4A8,stone:0xB8BCC2,roof:0x545E50,dark:0x1E1A16,timber:0x4A3A2A,trim:0x9A968A,
   pat:"cloth",roofPat:"cloth",eave:0.18, pitch:50, form:"gable",base:0.4},
  // 5 ENLIGHTENMENT — pale render and RED BRICK, slate HIP at 32°, copper on the civic roofs
  // ONLY. The last pass put verdigris on all eighteen and the whole age came back as one teal
  // lump; §F.6 gives slate to the house, the farm, the storehouse, the foundry and the arsenal
  // and keeps copper for the town centre and the temple, which is what makes the copper read as
  // civic rather than as the age's paint.
  {wall:0xD2C8B4,stone:0x9E5744,roof:0x3E4650,civic:0x4E9E88,lead:0x8A9099,dark:0x262A30,
   timber:0x6B4A2E,trim:0xCFB53B,
   pat:"cloth",roofPat:"wood", eave:0.18, pitch:32, form:"hip",  base:0.4}
];
// The shared vocabulary, also §2.4. MARBLE and WHITEWASH exist to kill pure white: `0xffffff`
// was on ~20 age-5 cornices, balustrades, pediments and sills, every one of them a flat panel
// bigger than 200px² — an automatic fail under AD §10.22/F1, and the surface that clips first
// under the corrected exposure. Off-white keeps the folds.
// BONE and IVORY came down a step for the same reason: at 0xe6ded0/0xefe8da the age-0 lodge's
// own frame was the brightest thing in the frame after the sky, and the hide under it went pale
// trying to compete. Warmer and one step darker, the bone stamps and the hide can be hide.
const BONE=0xdcd2c0, IVORY=0xe8dfca, GOLD=0xcfb53b, GOLDLIT=0xebd46a, MINOANRED=0xa8402e;
const THATCH=0x6E5A30, THATCHLIT=0x9A8250;                 // §F.0 dark thatch, and its lit face
const MARBLE=0xD6CDB6, WHITEWASH=0xD2C8B4;                 // §A.3 age3.marble (-2 values, §I q2) / §F.0 age5 render
// STONE TRACKS BPAL[0].stone / BPAL[2].stone AND MUST KEEP TRACKING IT. It is prewarmed below as
// its own texturedMat("metal", …) pair; let it drift off the two ages that actually use that hex
// and the prewarm mints a pair nothing ever draws — a wasted atlas cell out of ~130 (§G.4), and
// the kind that is invisible because everything still renders correctly.
// STONELIT does NOT track age 4 any more and that is deliberate: §F.4 gives the Classical
// stone_gate "grey sandstone ashlar #9A968A" in its own right, and the Porta Nigra and the Roman
// curtain wall are the only two things still drawing it now that the Medieval ashlar has gone pale.
const STONE=0xBCB0A0, STONELIT=0x9A968A, STONEDK=0x5c594f; // §F.0 drystone / §F.4 Roman sandstone
const BRICK=0x9E5744;                                      // §F.0 age5: base courses, quoins, chimneys
const TIMBER=0x4A3A2A, PLANK=0x8a6b45;                     // §A.3 age4.oak
// eave overhang as a fraction of footprint width (AD §5.5, and §F.0 states it per age). The single
// highest-value readability trick in the building set: it throws a hard shadow band that splits
// roof from wall at 46px.
function eaveOf(age){return BPAL[age].eave;}
// the roof material of the age. `pat` is the weave — dapples read as thatch bundles, plank seams
// as shingle and slate courses, the cloth weave as tile rows. Flat untextured colour is most of
// why a town read as stacked boxes.
function roofPat(age){return BPAL[age].roofPat;}
function aWall(age,shade){const p=BPAL[age];return texturedMat(p.pat,shade||p.wall);}
// The roof colour for a building of `type` in `age`. Age 5 is the only age that has two, and §F.6
// is explicit about which id gets which: the town centre and the temple are the civic pair that
// carry verdigris copper, everything domestic and industrial is slate. Spending copper on all
// eighteen is what made the last pass's Enlightenment read as one teal lump.
const CIVIC5={towncenter:1,temple:1};
function aRoof(age,type){const p=BPAL[age];return (age===5&&CIVIC5[type])?p.civic:p.roof;}

// ==================== TRAP 2: PRE-WARM EVERY TEXTURED PAIR AT BOOT (§G.4) ====================
// `_blocks()`, the 2px weave fill inside texturedMat, CALLS Math.random(). js/02-world.js runs its
// whole world build under one seeded stream (`Math.random=mulberry32(0x20260710)` at :190, handed
// back at :1706) and the netcode indexes `nodes` POSITIONALLY (js/10-net.js:1614) — so a single
// extra Math.random() call inside that window shifts every node's position AND ITS INDEX, and a
// v130 peer and a v131 peer then disagree about which tree is tree 300. Same bytes, different
// world. World-gen placement is on the wire at PROTO 26 and must not move.
//
// Today the load order protects us — 03-buildings.js is parsed AFTER 02-world.js has finished and
// handed Math.random back, so no building material can be minted inside the window. THAT IS A
// LOAD-ORDER ACCIDENT AND IT IS ONE `defer` AWAY FROM BEING FALSE. Pre-warming makes it not
// matter: every (kind, hex) pair the building set can ask for is minted ONCE, here, at file load,
// and a cached pair costs zero Math.random() calls on every later request for ever after.
//
// If you add a new textured pair to this file, ADD IT HERE TOO, and re-run tools/townages.js —
// it prints a hash of every resource node before and after, which is the canary for exactly this.
(function prewarmBuildingSkins(){
  if(typeof texturedMat!=="function")return;
  for(let a=0;a<6;a++){
    const p=BPAL[a];
    texturedMat(p.pat,p.wall);          // aWall
    texturedMat(p.roofPat,p.roof);      // ageRoof
    texturedMat("metal",p.stone);       // every base course, plinth, podium and ashlar face
    texturedMat("wood",p.timber);       // frames, palisades, posts, hoist beams
    texturedMat(p.pat,p.dark);          // the Bronze cornice band, and the age-0 berm's weave
  }
  texturedMat(BPAL[5].roofPat,BPAL[5].civic);   // the civic copper: town centre + temple
  texturedMat("metal",BPAL[5].lead);            // the steeple stages
  texturedMat("wood",BPAL[5].lead);             // the spire and the market cupola
  texturedMat("cloth",BPAL[1].wall);            // bDome on the beehive silos
  texturedMat("metal",BRICK);                   // §F.6's second colour, on ~30 surfaces
  texturedMat("metal",STONE); texturedMat("metal",STONELIT); texturedMat("metal",MARBLE);
  texturedMat("wood",PLANK); texturedMat("wood",0xb08a5a);   // crates
  texturedMat(BPAL[2].pat,0x7A4A32);            // the Iron Age bloomery shaft furnace
  texturedMat("metal",BPAL[1].stone);           // the Bronze pylon's lighter ashlar
})();

// -- shared construction vocabulary --
// v130.6 — THE HIDE SWATCH IS A UNIT SKIN, AND A WALL IS NOT A SHIELD BOSS. `texturedMat("hide")`
// is 16x16 with seven THREE-texel dapples on it, authored for the half-unit pelt on a scout's
// shoulder, and 04-units hangs it on nine more pelts, saddles and quivers where that is exactly
// right. Laned onto a town-centre panel the same dapple is 0.57 units across a 5.3 wall: at play
// distance a group of them reads as damp stains or as camouflage, one of them resolves as a
// painted letter, and none of it is AD §7.8's "hand-painted flat colour with minimal noise".
// So the buildings get their own at BUILDING scale. Flecks of two texels — 0.19 units on a wall
// panel, under the eyedropper at 46px — at half the old contrast, over a weave whose two tones
// are a hair apart, plus the lacing seam down each panel edge that is what this building actually
// is: hide laced to the uprights one panel at a time, which is the thing panelUV lanes.
// THE TOP AND BOTTOM ROWS ARE LEFT CLEAN ON PURPOSE. A panel's v runs 0..1, so its last row lands
// ON the eave line and its first row ON the ground line, and a half-fleck repeated across twelve
// identical panels is a row of teeth along the eave rather than mottle on a wall.
// TRAP: mergeBuildingBody frees every material isSharedMat does not recognise, and these are
// cached and shared by every lodge on the map — so they go in the same set texturedMat's own
// materials live in, or the first building to weld blanks all the others.
const _hideCache=new Map();
function hideSkin(hex){
  let m=_hideCache.get(hex);
  if(m)return m;
  const t=_tex(32,(c,s)=>{
    _blocks(c,s,[_shade(hex,0.012),_shade(hex,-0.012)]);              // the weave, two tones apart
    c.fillStyle=_shade(hex,-0.05);
    for(let i=0;i<9;i++){                                             // flecks: 2 texels, no blobs
      const x=(2+((Math.random()*(s-4))|0))&~1, y=(4+((Math.random()*(s-10))|0))&~1;
      c.fillRect(x,y,2,2);
    }
    c.fillStyle=_shade(hex,-0.07);
    c.fillRect(0,2,1,s-4); c.fillRect(s-1,2,1,s-4);                   // the seam at the upright
    c.fillStyle=_shade(hex,-0.045);
    for(let y=4;y<s-4;y+=5){c.fillRect(1,y,2,1);c.fillRect(s-3,y,2,1);} // and its cross-ties
  });
  m=toonMat({map:t}); _hideCache.set(hex,m); _skinMats.add(m); return m;
}
// hide dome, copper dome — half a sphere. `lane` re-lanes the skin panel by panel (see domeUV);
// it is opt-in because the small cloth cupolas would be laned down to 0.06 units per texel, and
// these swatches are NearestFilter with no mipmaps (AD §10.14), so a sub-pixel texel crawls.
const DOMESEG=10;
function bDome(r,pat,c,lane){
  const geo=new THREE.SphereGeometry(r,DOMESEG,6,0,Math.PI*2,0,Math.PI/2);
  const m=new THREE.Mesh(lane?domeUV(geo,DOMESEG):geo,pat==="hide"?hideSkin(c):texturedMat(pat,c));
  m.castShadow=true; return m;
}
// a few types read better a touch smaller than the blanket 2x — scaled via a wrapper
// so the construction-raise (which drives body.scale.y) still animates cleanly
const BSCALE={storage_pit:0.95,farm:0.6375,watch_tower:0.75};
// THE WATCH TOWER'S DECK MOVES WITH THE AGE, because the tower does. §F.6 makes the Enlightenment
// watch tower deliberately SQUAT — "designed to survive artillery rather than to loom" — and §F.5
// makes the peel tower taller than the timber scaffold it replaces, so a single hard-coded
// 14.25 would have units standing three units above an age-5 gun platform and sunk into an age-4
// one. Read the same numbers `buildingMesh` uses; the smoketest's 6 < y < 14 window covers all six.
function watchTowerH(age){return age>=5?9.2:(age===4?15.5:14);}
function watchDeck(age,bs){return {y:(watchTowerH(age|0)+0.25)*(bs||1),r:2.5};}
// v132.23 ONE CLAMP FOR EVERY DECK, IN THE DECK'S OWN FRAME. Four places hold a garrisoned body on
// its platform — the host's own player (09-main.js), a guest driven on the host and a remote sentry
// drawn from a snapshot and a guest PREDICTING ITSELF (all three in 10-net.js) — and v132.22 taught
// two of them that a wall's terreplein is a rectangle while the other two went on reading deck.r.
// That does not fail loudly: on a rectangular deck r is undefined, d > undefined is false for every
// d, and the clamp silently does nothing — so a guest predicted himself walking off the rampart
// at deck height until the host's next packet pulled him back. Four copies of a geometric rule is
// how two of them ended up believing every deck is a circle; there is one copy now.
//   deck   {y,r} a circle (watch towers) or {y,hx,z0,z1} a rectangle (the age-5 curtain)
//   rot    the building's yaw. The local frame is the one wallFloorAt and the wall collider use:
//          lx = dx·c - dz·s, lz = dx·s + dz·c, which is THREE's own rotation.y inverted.
//   ox/oz  the offset from the building's centre, in world units; the return is the same.
// d===0 falls out of the circular branch untouched (0 > r is false), so no division by zero.
function deckClamp(deck,rot,ox,oz){
  if(deck.hx===undefined){
    const d=Math.hypot(ox,oz);
    return (d>deck.r)?{x:ox*deck.r/d,z:oz*deck.r/d}:{x:ox,z:oz};
  }
  const c=Math.cos(rot||0),s=Math.sin(rot||0);
  let lx=ox*c-oz*s, lz=ox*s+oz*c;
  lx=Math.max(-deck.hx,Math.min(deck.hx,lx));
  lz=Math.max(deck.z0,Math.min(deck.z1,lz));
  return {x:lx*c+lz*s, z:-lx*s+lz*c};
}
// v131.24 THE WALL WALKWAY. John: "add ramps and make tops of walls walkable surface so people can
// shoot from the top", scoped by him to the PLAYER only -- no AI pathing onto walls, no attackers
// taking one. So this is a floor query and nothing else: no navmesh, no waypoints, no new unit
// state beyond the one field 09-main.js already keys terrain-hugging off.
//
// ONLY THE AGE-5 CURTAIN, and that is measured, not chosen (tools/wallspec.js, every age):
//   the Classical wall's walkway is 0.80 wide -- narrower than a 1.30 body, so nothing can stand
//   on it; the Medieval gate has NO deck at all, so a curtain run there breaks at every gate;
//   the Enlightenment rampart is 4.40 wide with its top at 4.00, because AGES §F.6 makes it squat
//   and thick "to survive artillery rather than to loom". The history and the gameplay agree.
//
// The numbers below are the model's own, from the age>=5 branch of the wall builder:
//   terreplein  box(12.5,0.6,4.4) at (0,3.7,-1.2)  -> top 4.00, x +/-6.25, z -3.40..1.00
//   ramp        rise 4.00 over run 8.00 at z -5.40..-3.40, from x -6.00 (ground) to x +2.00 (deck)
// Returns the world Y of the walkable surface at (x,z), or null for "there is no floor here".
const WALL_DECK_Y=4.0, WALL_DECK_HX=6.25, WALL_DECK_Z0=-3.4, WALL_DECK_Z1=1.0;
// The ramp band OVERLAPS the deck by 0.6 in z and its top 0.8 in x is FLAT, both deliberately.
// Measured on the first cut: the player climbed to +3.99 and then one more pace put him at +0.59,
// a four-unit drop off a knife edge, because the ramp ended exactly where the deck began and the
// two only touched along a line. A landing is what a real ramp has; this is the cheapest version
// of one -- clamp the rise at the top of the run, and let the two surfaces share a strip.
// v132.20 THE RAMP TURNED NINETY DEGREES (John: "rotate ramps so they are perpendicular to the
// wall"), so the band turns with it: it is now a RUN IN Z inside a narrow strip of X, where it used
// to be a run in x inside a strip of z.
//   WALL_RAMP_HX     half the ramp's width, centred on the segment
//   WALL_RAMP_ZTOP   where it meets the terreplein's inner edge (WALL_DECK_Z0)
//   WALL_RAMP_RUN    6.0, not 8.0: rise 4.0 over 6.0 is 1:1.5 at 33.7 degrees, so the tail behind
//                    the wall is 6.0 rather than the 8.0 the old run would have cost when stood up.
//                    The tail is the price of a ramp you can see is a ramp; this is the smaller bill.
const WALL_RAMP_HX=1.1, WALL_RAMP_ZTOP=-3.4, WALL_RAMP_RUN=6.0, WALL_RAMP_FLAT=0.8;
// v132.21 THE HIGHEST FLOOR UNDER YOU, NOT THE FIRST ONE IN THE ARRAY. Segments stand 10.9 apart
// and each claims a deck 12.5 wide, so consecutive decks OVERLAP by 1.6 — and each sits at its own
// base + 4.0, so over that strip there are two floors at two heights. Returning the first match
// returned them in PLACEMENT ORDER, which has nothing to do with which surface is under a body's
// feet: walking from a high segment into the overlap could hand you the low neighbour's floor, drop
// you onto it, and leave you standing inside the high segment's masonry. And moveUnit's exemption
// survived the drop — its tolerance is 1.2 and the measured base spread on FLAT ground is 1.07 —
// so the wall's collider stayed switched off and you walked on through the stonework. That is
// John's "i can slip through the wall base", and tools/wallslip.js caught it 11 times in 576 drives,
// every single one of them starting on the deck.
// It degrades the right way, too: where the spread EXCEEDS 1.2 the step up is too big to count as
// standing on it, the exemption fails and the collider fires. Stopped is correct; dropped inside is
// not.
// v132.22 THE LADDER'S FOOT, in the wall's own local frame: middle of the segment, just behind the
// terreplein's inner edge. E within WALL_LADDER_R of it mans the wall.
const WALL_LADDER_Z=WALL_DECK_Z0-0.55, WALL_LADDER_R=2.8;
// v132.22 NOTHING WALKS ON A WALL ANY MORE, so there is no floor up there to report. John: "the
// wall should act like a watch tower… someone goes to ramp, presses E, boom they are on top."
// This function used to hand back a surface in mid-air, which required a per-frame height hug in
// renderFrame AND an exemption in moveUnit that switched the wall's collider OFF while you stood on
// it. That exemption is the shape of thing that generates position disagreements between host and
// guest (v131.28), lets you pop onto a curtain without a ramp (v131.34), forces a gateway to be
// bricked up at deck height so there is something to stand on (v132.16), and is the only credible
// way into a wall's base (v132.21, never reproduced in 768 drives but never explained either).
// A garrisoned unit is not in the collision world at all. Returning null everywhere retires all of
// it: the exemption never fires, so a wall always collides.
// KEPT AS A FUNCTION rather than deleted because 05-combat.js and 09-main.js both call it, and a
// stub that always says "no floor" is a smaller, more obvious change than removing three call
// sites — and it leaves one place to look if walls are ever made walkable again.
function wallFloorAt(x,z){
  return null;
}
function _wallFloorAtRetired(x,z){
  if(typeof buildings==="undefined")return null;
  let _wfBest=null;
  for(const b of buildings){
    if(!b.alive||!b.built||!b.def.wall)continue;
    const a=Math.max((b.def.age||0),
      Math.min(5,(typeof teamAge!=="undefined"&&teamAge[b.team])||0));
    if(a<5)continue;                                  // only the star-fort curtain carries a deck
    // v132.16 AND A GATE IS NOT A PIECE OF WALL YOU WALK OVER. John: "it is treating the gate as
    // another mountable wall so you have this weird condition where units CLIMB OVER the gate to
    // get through it." v131.28 exempted the RAMP from gates and left the DECK, so a gate still
    // reported a floor at 4.00 across its whole width — including over the gateway, which then had
    // to be bricked up at deck height to stand on, which is what made the passage 3.1 tall.
    // A gate is the way THROUGH a wall. It has no deck, and its model no longer draws one.
    if(b.def.gate)continue;
    const rot=b.rot||0,c=Math.cos(rot),sn=Math.sin(rot);
    const dx=x-b.x,dz=z-b.z;
    const lx=dx*c-dz*sn, lz=dx*sn+dz*c;
    if(Math.abs(lx)<=WALL_DECK_HX&&lz>=WALL_DECK_Z0&&lz<=WALL_DECK_Z1){
      const f=b.root.position.y+WALL_DECK_Y;
      if(_wfBest===null||f>_wfBest)_wfBest=f;
      continue;                                       // a deck wins over this wall's own ramp
    }
    // v131.28 THE RAMP IS THE CURTAIN'S. Gate types carry wall:true and reach this loop, but the
    // gate branch of the model builds no ramp at all — only the curtain branch does. So every
    // age-5 gate has had an invisible slope behind it, lifting the player up a surface that is not
    // drawn and dropping him back off it.
    if(!b.def.gate&&Math.abs(lx)<=WALL_RAMP_HX&&
       lz>=WALL_RAMP_ZTOP-WALL_RAMP_RUN&&lz<=WALL_RAMP_ZTOP)
      // v131.34 …AND NEVER BELOW THE GROUND IT RISES OUT OF. The ramp is measured from the wall's
      // own base, and at its foot that is 0 — but the terrain under the foot is wherever the hill
      // is, up to a unit higher. Unclamped, stepping onto the ramp's bottom end SANK the body into
      // the hillside before it started climbing. A ramp emerges from the ground; it does not cut a
      // trench to reach it.
      {const f=Math.max(b.root.position.y+WALL_DECK_Y*
        Math.min(1,(lz-(WALL_RAMP_ZTOP-WALL_RAMP_RUN))/(WALL_RAMP_RUN-WALL_RAMP_FLAT)), // flat landing at the top
        terrainHeight(x,z));
       if(_wfBest===null||f>_wfBest)_wfBest=f;}
  }
  return _wfBest;
}
// v131.3 THE GARRISON SKIN. Hides the cap of the tower THIS client's player is standing in and
// restores the last one it touched. Purely render state — no simulation reads it — so a guest and
// the host may disagree about it for ever without desyncing; applyLOD already uses .visible as
// per-client state for exactly this reason. Driven once per frame rather than from the climb-up /
// climb-down hooks, so it stays correct across _restyleOneBuilding (which throws b.body away),
// age-up, the tower dying under you, and a guest adopting a garrison id from a snapshot. One call
// site, no event to miss, and idempotent so calling it every frame costs a pointer compare.
let _garrSkinned=null;
function setGarrisonView(b){
  if(_garrSkinned===b)return;
  const flip=(t,v)=>{ if(!t||!t.body)return;
    t.body.traverse(o=>{ if(o.userData.isCap)o.visible=v; }); };
  flip(_garrSkinned,true); flip(b,false); _garrSkinned=b;
}
// a properly ribbed mammoth-bone dome: hide skin, meridian bone arches, horizontal lashings
function ribbedDome(g,rx,ry,rz,wallC,nRibs,ringYs){
  const dome=bDome(1,"hide",wallC,true); dome.scale.set(rx,ry,rz); g.add(dome);
  const rr=Math.min(rx,rz);
  // v130 B2: the ribs were rr*0.05+0.12 thick and all of them converge on the crown, so the top
  // third of every lodge in the game was a solid ivory cap — which is precisely the "pale yurt"
  // read, and it was the FRAME doing it, not the hide. Thinner bone over darker hide: the lodge
  // now reads as a dark dome with a white skeleton on it, which is what it is.
  for(let i=0;i<nRibs;i++){ // longitudinal ribs hug the surface, rim to rim over the crown
    const rib=new THREE.Mesh(new THREE.TorusGeometry(rr*0.99,rr*0.032+0.09,6,14,Math.PI),plainMat(BONE));
    rib.scale.y=ry/rr; rib.rotation.y=i/nRibs*Math.PI; rib.castShadow=false; g.add(rib);
  }
  for(const hy of (ringYs||[])){ // horizontal bone rings lash the ribs together
    const rad=rx*Math.sqrt(Math.max(0.04,1-(hy/ry)*(hy/ry)));
    const ring=new THREE.Mesh(new THREE.TorusGeometry(rad*0.99,0.13,5,20),plainMat(0xc9bda6));
    // …and it must be squashed on LOCAL Y, not local Z. A torus is born in the XY plane, and the
    // rotation.x below is what lays it flat — so local Y is what ends up pointing along world Z,
    // and local Z is what ends up vertical. `scale.z` therefore thinned the TUBE and left the ring
    // a perfect circle of radius rx on a dome only rz deep, which on any lodge whose plan is not
    // round hung a bone hoop out in mid-air past the hide. Round domes (the town centre, the age-0
    // hut) never showed it because rx===rz made the wrong axis the right answer.
    ring.rotation.x=Math.PI/2; ring.scale.y=rz/rx; ring.position.y=hy; ring.castShadow=false; g.add(ring);
  }
}
// v130.4 — THE STITCHED WALL. A CylinderGeometry lanes ONE copy of the 16px swatch round the whole
// drum, so a 12-sided wall 37 units in circumference gets 1.3 texels per panel: every panel is a
// DIFFERENT vertical slice of the noise, its 2-texel value steps land at a different height from
// its neighbour's, and every upright has a jog in the shading beside it. At 400% that is a broken
// texture; at 46px it is a wall that will not sit still. One texel is also 2.3 units wide there,
// so a 2x2 dapple came out a 4.6-unit pale rectangle — the "hide" pattern was never visible as
// hide at all.
// Re-laning u so each panel spans the whole swatch fixes both at once: every panel gets identical
// rows, so the value steps line up all the way round, and the swatch lands at ~0.2 units per texel
// instead of 2.3. Alternate panels take it mirrored (u runs 1->0), which an EVEN segment count
// makes seamless and which is free — the pattern's structure is horizontal, so a mirror changes
// nothing about where the bands sit. It also happens to be what the building is: hide stretched
// panel by panel between the uprights, not one sheet wrapped round.
// TRAP: the caps must keep their disc mapping. Re-laning them smears the swatch across the eave
// gallery, which IS visible from the town and wide vantages. A cap vertex is the one whose normal
// points up or down — cheaper and more honest than counting on r128's torso-then-caps vertex order.
// These textures are ClampToEdge and the merge clamps to 0..1 anyway, so v stays inside the box:
// `vSpan` shortens it for a shallow band rather than tiling it.
// `capN` is the trap, and it only shows up once a course is a ROOF rather than a band. A cone's
// side normal is (Δr, Δy) normalised, so its y is cos(pitch) — every pitch AD §5.5 allows, 35° to
// 45°, comes out between 0.71 and 0.82 and sails straight past a 0.5 cap test. The eave then keeps
// CylinderGeometry's default wrap, which is the one-swatch-round-the-whole-drum smear this
// function exists to kill, and it is silent: the geometry is right, the shading is right, the
// texture is a two-unit stain. Anything with a real slope on it passes its own threshold.
function panelUV(geo,seg,vSpan,capN){
  const uv=geo.attributes.uv, nor=geo.attributes.normal, cn=capN===undefined?0.5:capN;
  for(let i=0;i<uv.count;i++){
    if(Math.abs(nor.getY(i))>cn)continue;
    uv.setXY(i,Math.round(uv.getX(i)*seg)%2,uv.getY(i)*(vSpan===undefined?1:vSpan));
  }
  uv.needsUpdate=true; return geo;
}
// v130.5 — AND THE ROOF NEVER GOT THE WALL'S FIX. panelUV re-laned the drum, the brim and the
// clerestory and left the DOME on SphereGeometry's default wrap: one copy of the 16px swatch
// round 36 units of circumference is 2.3 units per texel, so a 2x2 hide dapple came out a FIVE
// UNIT slab. Standing one above the other that reads as two different materials — the wall below
// is legibly stretched hide and the roof above is flat brown paint with three enormous stains on
// it, which at 400% is the same "broken texture" the wall was pulled up for and at 46px is a roof
// with no surface in it at all. Laned, the dome lands at ~0.23 units per texel against the wall's
// 0.19 and the two finally read as one building.
// Same rule as panelUV and the same reason the segment count must be EVEN: every panel spans the
// whole swatch, alternate panels take it mirrored, and the wrap closes on itself at the seam.
// TRAP: r128 shifts the pole ring's u by half a segment (`uOffset`, SphereGeometry.js:54) so the
// crown triangles fan. Round that half-step and it lands one lane OUT of phase with the ring
// below, and every sliver at the crown then sweeps the entire swatch — the crown goes to mush,
// which is the one part of the dome the smoke vent does not cover on the smaller lodges. Park the
// pole at 0.5 instead, the middle of whichever lane its own triangle spans.
// Vertical is left alone: v runs the quarter-arc, and there is nothing to be done about it while
// the merge clamps to 0..1 (a v over 1 would need RepeatWrapping, which _bMergeableMat rejects
// outright — a tiling map smears across every neighbour in the atlas).
function domeUV(geo,seg){
  const uv=geo.attributes.uv, nor=geo.attributes.normal;
  for(let i=0;i<uv.count;i++)uv.setX(i,nor.getY(i)>0.999?0.5:Math.round(uv.getX(i)*seg)%2);
  uv.needsUpdate=true; return geo;
}

// ---------- dirt roads: a town knits itself together as it grows ----------
// dirt→gravel→cobble→pale stone. v130 B2: retuned alongside AGEPAL, because these two palettes
// only work as a pair — the paving is the value the buildings are read AGAINST, and the age-4
// entry was a cold 0x6f6a5e that turned every medieval street grey under what are now warm
// plaster walls. All six rows sit in AD §2.2's road band so the town stays the brightest thing
// standing on its own ground, without the paving competing with the grass for saturation.
const ROADPAL=[0x7a6242,0x7a6242,0x8a7150,0xb0a288,0x827e72,0xd2c8b0];
const _roadMatCache=new Map();
function _roadShade(n,f){const r=Math.min(255,((n>>16)&255)*f|0),g2=Math.min(255,((n>>8)&255)*f|0),b=Math.min(255,(n&255)*f|0);
  return "rgb("+r+","+g2+","+b+")";}
function roadTexture(age){ // chunky 2px pixels, same dialect as the terrain
  const base=ROADPAL[age];
  const c=document.createElement("canvas"); c.width=c.height=64;
  const ctx=c.getContext("2d");
  ctx.fillStyle=_roadShade(base,1); ctx.fillRect(0,0,64,64);
  if(age<=1){ // packed dirt: mottle + two worn wheel ruts
    for(let i=0;i<240;i++){ctx.fillStyle=_roadShade(base,0.8+Math.random()*0.4);
      ctx.fillRect(((Math.random()*64)|0)&~1,((Math.random()*64)|0)&~1,2,2);}
    ctx.fillStyle=_roadShade(base,0.68);
    for(const rx of [16,44])for(let y=0;y<64;y+=2)ctx.fillRect(rx+((Math.sin(y*0.25)*2)|0),y,4,2);
  }else if(age===2){ // gravel: dense speckle of small stones
    for(let i=0;i<340;i++){ctx.fillStyle=_roadShade(base,0.7+Math.random()*0.6);
      const s=2+((Math.random()*2)|0)*2;
      ctx.fillRect(((Math.random()*64)|0)&~1,((Math.random()*64)|0)&~1,s,s);}
  }else if(age===3){ // sandy flagstones: offset blocks, darker mortar seams
    for(let i=0;i<140;i++){ctx.fillStyle=_roadShade(base,0.9+Math.random()*0.18);
      ctx.fillRect(((Math.random()*64)|0)&~1,((Math.random()*64)|0)&~1,4,4);}
    ctx.fillStyle=_roadShade(base,0.72);
    for(let y=0;y<=64;y+=16)ctx.fillRect(0,y-1,64,2);
    for(let y=0;y<64;y+=16){const off=((y/16)%2)*8;
      for(let x=off;x<=64;x+=16)ctx.fillRect(x-1,y,2,16);}
  }else if(age===4){ // grey cobbles: rounded stones in offset rows over dark grout
    ctx.fillStyle=_roadShade(base,0.6); ctx.fillRect(0,0,64,64);
    for(let y=0;y<64;y+=8){const off=((y/8)%2)*4;
      for(let x=-4;x<68;x+=8){ctx.fillStyle=_roadShade(base,0.85+Math.random()*0.35);
        ctx.fillRect(x+off+1,y+1,6,6);}}
  }else{ // pale dressed pavers: brick-laid, thin joints
    ctx.fillStyle=_roadShade(base,0.78); ctx.fillRect(0,0,64,64);
    for(let y=0;y<64;y+=8){const off=((y/8)%2)*8;
      for(let x=-8;x<68;x+=16){ctx.fillStyle=_roadShade(base,0.92+Math.random()*0.16);
        ctx.fillRect(x+off+1,y+1,14,6);}}
  }
  const t=new THREE.CanvasTexture(c);
  t.encoding=THREE.sRGBEncoding;
  t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter; t.generateMipmaps=false;
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  return t;
}
function roadMat(age){
  if(!_roadMatCache.has(age))_roadMatCache.set(age,new THREE.MeshLambertMaterial({map:roadTexture(age),
    polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2})); // beats the terrain in depth ties
  return _roadMatCache.get(age);
}
function _roadUV(geo,ux,uz){ // tile the texture at constant world density (one tile per ~6 units)
  const uv=geo.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*ux,uv.getY(i)*uz);
  uv.needsUpdate=true;
}
const roadGroups=[null,null];
function roadEligible(b){
  return b.alive&&b.built&&!b.def.wall&&b.type!=="farm"&&b.type!=="storage_pit";
}
// each paved element drapes over the terrain: its vertices are pushed to ground height,
// so slopes never swallow a road end. `lift` staggers heights so overlaps never z-fight.
function _drapedPlane(w,len,ang,cx,cy,cz,lift,mat,uw,ul){
  const pg=new THREE.PlaneGeometry(w,len,2,Math.max(2,Math.ceil(len/3)));
  _roadUV(pg,uw,ul);
  const pos=pg.attributes.position, cA=Math.cos(ang), sA=Math.sin(ang);
  for(let i=0;i<pos.count;i++){
    const vx=pos.getX(i), vy=pos.getY(i);
    const wx=cx+vx*cA-vy*sA, wz=cz-vx*sA-vy*cA;
    // v131.33 THE DRAWN GROUND, NOT THE FUNCTION. This read terrainHeight(wx,wz), and the ground
    // the player actually sees is a 150x120 PlaneGeometry SAMPLING that function — so between
    // lattice points it interpolates linearly while terrainHeight() curves, and across a crease the
    // mesh rides up to 0.12 ABOVE it. The creases are where the town-centre and bazaar flats begin,
    // which is exactly where the aprons and their paths are, so a decal lifted 0.06 was sitting a
    // twentieth of a unit INSIDE the hill it was meant to lie on. groundY() samples the same
    // lattice, the same triangulation and the same barycentric interpolation r128 will actually
    // run; kingsRoad has used it since v131.15 and this is the rest of the ground decals catching
    // up. Guarded because 02-world.js defines it and load order is by filename.
    pos.setZ(i,(typeof groundY==="function"?groundY(wx,wz):terrainHeight(wx,wz))+lift-cy);
  }
  pg.computeVertexNormals();
  const g=new THREE.Group(); g.position.set(cx,cy,cz); g.rotation.y=ang;
  const pl=new THREE.Mesh(pg,mat); pl.rotation.x=-Math.PI/2; pl.receiveShadow=true; g.add(pl);
  return g;
}
function layRoad(grp,x1,z1,x2,z2,w,mat,lift){
  const dx=x2-x1,dz=z2-z1,L=Math.hypot(dx,dz); if(L<1)return;
  const cx=(x1+x2)/2, cz=(z1+z2)/2;
  grp.add(_drapedPlane(w,L+0.6,Math.atan2(dx,dz),cx,terrainHeight(cx,cz)+lift,cz,lift,mat,w/6,L/6));
}
function layPad(grp,x,z,half,rot,mat,lift){ // a paved apron squared to the building's outline
  grp.add(_drapedPlane(half*2,half*2,rot||0,x,terrainHeight(x,z)+lift,z,lift,mat,half/3,half/3));
}
// grass pockets fully enclosed by paving become GARDENS: flowers and greenery move in
function layGardens(grp,tc,links,pads){
  let minX=1e9,maxX=-1e9,minZ=1e9,maxZ=-1e9;
  for(const p of pads){minX=Math.min(minX,p.x-p.h);maxX=Math.max(maxX,p.x+p.h);
    minZ=Math.min(minZ,p.z-p.h);maxZ=Math.max(maxZ,p.z+p.h);}
  for(const l of links){minX=Math.min(minX,l.x1,l.x2);maxX=Math.max(maxX,l.x1,l.x2);
    minZ=Math.min(minZ,l.z1,l.z2);maxZ=Math.max(maxZ,l.z1,l.z2);}
  if(minX>maxX)return;
  minX-=4;maxX+=4;minZ-=4;maxZ+=4;
  const CELL=2, NX=Math.min(96,Math.ceil((maxX-minX)/CELL)), NZ=Math.min(96,Math.ceil((maxZ-minZ)/CELL));
  if(NX<3||NZ<3)return;
  const paved=new Uint8Array(NX*NZ);
  const cxOf=i=>minX+(i+0.5)*CELL, czOf=j=>minZ+(j+0.5)*CELL;
  for(let i=0;i<NX;i++)for(let j=0;j<NZ;j++){
    const px=cxOf(i), pz=czOf(j);
    let hit=false;
    for(const b of buildings){ // no flowers inside anyone's footprint — farm plots included
      if(b.alive&&dist2(px,pz,b.x,b.z)<Math.pow(b.def.r*0.95+0.8,2)){hit=true;break;}}
    if(!hit)for(const p of pads){if(Math.abs(px-p.x)<p.h+0.8&&Math.abs(pz-p.z)<p.h+0.8){hit=true;break;}}
    if(!hit)for(const l of links){ // distance from cell to the alley's centerline
      const ax=px-l.x1, az=pz-l.z1, bx=l.x2-l.x1, bz=l.z2-l.z1, bl=bx*bx+bz*bz||1;
      const t=Math.max(0,Math.min(1,(ax*bx+az*bz)/bl));
      const qx=l.x1+bx*t-px, qz=l.z1+bz*t-pz;
      if(qx*qx+qz*qz<Math.pow(l.w/2+0.8,2)){hit=true;break;}
    }
    if(hit)paved[i*NZ+j]=1;
  }
  // flood the open world in from the border: whatever grass it can't reach is enclosed
  const seen=new Uint8Array(NX*NZ), q=[];
  for(let i=0;i<NX;i++)for(const j of [0,NZ-1])if(!paved[i*NZ+j]&&!seen[i*NZ+j]){seen[i*NZ+j]=1;q.push(i*NZ+j);}
  for(let j=0;j<NZ;j++)for(const i of [0,NX-1])if(!paved[i*NZ+j]&&!seen[i*NZ+j]){seen[i*NZ+j]=1;q.push(i*NZ+j);}
  while(q.length){
    const c=q.pop(), ci=(c/NZ)|0, cj=c%NZ;
    for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const ni=ci+di, nj=cj+dj;
      if(ni<0||nj<0||ni>=NX||nj>=NZ)continue;
      const n=ni*NZ+nj;
      if(!paved[n]&&!seen[n]){seen[n]=1;q.push(n);}
    }
  }
  const BLOOMS=[0xe66a8a,0xe6c84a,0xf0efe4,0xc23a3a,0x9a6ae6,0xe08a2e];
  let budget=80;
  for(let i=1;i<NX-1&&budget>0;i++)for(let j=1;j<NZ-1&&budget>0;j++){
    const c=i*NZ+j;
    if(paved[c]||seen[c])continue; // paved, or open country — not a courtyard
    const gx=cxOf(i), gz=czOf(j);
    if(dist2(gx,gz,tc.x,tc.z)>80*80)continue;
    const h=(((i*73856093)^(j*19349663))>>>0)%97; // deterministic sprinkle
    if(h>55)continue;
    const fx=gx+((h%7)-3)*0.22, fz=gz+(((h>>3)%7)-3)*0.22, fy=terrainHeight(fx,fz);
    const dec=new THREE.Group(); dec.position.set(fx,fy,fz); dec.userData.garden=true;
    if(h%5===0){ // a clipped little bush
      const bush=new THREE.Mesh(new THREE.ConeGeometry(0.55,0.85,6),plainMat(0x5f8a4a));
      bush.position.y=0.42; bush.castShadow=false; dec.add(bush);
    }else{ // a flower on its stem
      const stem=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.06,0.5,4),plainMat(0x4f7d2f));
      stem.position.y=0.25; stem.castShadow=false; dec.add(stem);
      const bloom=new THREE.Mesh(new THREE.BoxGeometry(0.24,0.18,0.24),plainMat(BLOOMS[h%BLOOMS.length]));
      bloom.position.y=0.55; bloom.castShadow=false; dec.add(bloom);
    }
    grp.add(dec); budget--;
  }
}
function rebuildRoads(team){
  let grp=roadGroups[team];
  if(!grp){grp=new THREE.Group(); roadGroups[team]=grp; if(typeof scene!=="undefined")scene.add(grp);}
  for(let i=grp.children.length-1;i>=0;i--){ // clear last age's streets
    const seg=grp.children[i]; seg.traverse(o=>{if(o.geometry)o.geometry.dispose();}); grp.remove(seg);
  }
  const tc=teamTC(team); if(!tc)return;
  const city=buildings.filter(b=>b.team===team&&roadEligible(b)&&b.type!=="towncenter"&&
    dist2(b.x,b.z,tc.x,tc.z)<80*80);
  if(city.length<1)return; // a lone Town Center has no streets yet
  const age=teamAge[team]||0, mat=roadMat(Math.min(5,age));
  let k=0; const lift=()=>0.06+((k++)%8)*0.014; // staggered heights: overlaps never z-fight
  const links=[], pads=[];
  const tcPadH=tc.def.r+3;
  layPad(grp,tc.x,tc.z,tcPadH,tc.rot||0,mat,lift()); pads.push({x:tc.x,z:tc.z,h:tcPadH});
  // grow a street tree out from the Town Center; only close buildings get linked.
  // links are ALLEYS: as wide as the smaller building, so neighbors pave the whole gap
  const MAXLINK=44, nodes2=[{x:tc.x,z:tc.z,r:tc.def.r}], pending=city.slice();
  let progress=true;
  while(pending.length&&progress){
    progress=false; let bestI=-1,bestJ=-1,bd=MAXLINK*MAXLINK;
    for(let i=0;i<pending.length;i++)for(let j=0;j<nodes2.length;j++){
      const d=dist2(pending[i].x,pending[i].z,nodes2[j].x,nodes2[j].z);
      if(d<bd){bd=d;bestI=i;bestJ=j;}
    }
    if(bestI>=0){
      const b=pending.splice(bestI,1)[0], n=nodes2[bestJ];
      const W=Math.max(5,Math.min(11,Math.min(b.def.r,n.r)*1.8));
      layRoad(grp,n.x,n.z,b.x,b.z,W,mat,lift()); links.push({x1:n.x,z1:n.z,x2:b.x,z2:b.z,w:W});
      const padH=b.def.r*0.95+1.5;
      layPad(grp,b.x,b.z,padH,b.rot||0,mat,lift()); pads.push({x:b.x,z:b.z,h:padH}); // apron hugs the building outline
      nodes2.push({x:b.x,z:b.z,r:b.def.r}); progress=true;
    }
  }
  layGardens(grp,tc,links,pads); // enclosed grass courts bloom into gardens
}
function frustum4(wBot,wTop,h,mesh_mat){ // square-plan battered mass, faces axis-aligned
  const m=new THREE.Mesh(new THREE.CylinderGeometry(wTop*0.7071,wBot*0.7071,h,4),mesh_mat);
  m.rotation.y=Math.PI/4; m.castShadow=true; return m;
}
function pedTri(w,h,c){ // flat triangle: pediments and gable infill (4-cone squashed on z)
  const t=cone(w/2,h,c,4); t.scale.z=0.1; t.castShadow=false; return t;
}
function boneArc(R){const m=new THREE.Mesh(new THREE.TorusGeometry(R,0.22,5,10,Math.PI),plainMat(BONE));m.castShadow=false;return m;}
function tuskArc(R){const m=new THREE.Mesh(new THREE.TorusGeometry(R,0.15,5,8,Math.PI*0.62),plainMat(IVORY));m.castShadow=false;return m;}
// v128.1: the roof is a building's silhouette — ink it and the whole town reads at a glance.
// Applied here rather than on every wall panel so a hall costs ~2 extra calls, not ~20.
//
// v130 B2 — THE EAVE. `w` is the WALL span; the slabs now hang `eave` world units past it on each
// side (AD §5.5: 14% of footprint, 18% from age 3) where the old roof cleared the wall by a flat
// 0.35 whatever its size. Getting this right is most of the difference between "a building" and
// "a box with a triangle on it", because the overhang is what casts the hard shadow band that
// separates roof from wall at 46px — and v129.5 finally made walls receive it.
//
// THE TRAP THAT ATE THE FIRST ATTEMPT: lengthening the slab while holding the ridge height flat
// pivots the eave OUT, not DOWN, which drops the pitch below AD §5.5's 35-45 window — a 41°
// cottage roof came out at 33° and read as a lean-to. The pitch is therefore measured to the WALL
// plane (`atan2(h, w/2)`), and the overhang follows that slope down, so the eave tip hangs `drop`
// BELOW the wall top exactly the way a real eave does. Slab length works out to `tip/cos(ang)`.
//
// `pat` textures the roof (see roofPat) and `tc`, when given, adds the two team-colour eave boards
// AD §5.7 asks for from age 2. Those boards are the only draw calls this function gained: +2 on a
// gabled building, against AD §2.5's 8-15% team-colour budget, and `building-merge` eats them.
function gableRoof(g,w,d,yBase,h,slabC,gableC,ov,eave,pat,tc){ // ridge along z, slopes across x
  ov=ov===undefined?0.6:ov; eave=eave||0;
  const hw=w/2, ang=Math.atan2(h,hw);
  const tip=hw+eave, drop=eave*Math.tan(ang), len=tip/Math.cos(ang)+0.1;
  const rmat=texturedMat(pat||"wood",slabC);
  for(const s of [-1,1]){
    const slab=new THREE.Mesh(new THREE.BoxGeometry(len,0.42,d+ov*2),rmat);
    slab.castShadow=true; slab.receiveShadow=true;
    // v128.3: 2.4 -> 1.8. The old number was written when the width meant DEVICE pixels and the
    // phone's 0.7 pixel ratio was quietly thinning it; now that it means CSS pixels the same
    // constant draws heavier than it used to on exactly the screen it was tuned for. Override on
    // the fly with ?ink=<n> — the dial is there so the person holding the phone picks the number.
    slab.rotation.z=-s*ang; slab.position.set(s*tip/2,yBase+(h-drop)/2,0); inkOutline(slab,1.8); g.add(slab);
  }
  const ridge=new THREE.Mesh(new THREE.BoxGeometry(0.55,0.4,d+ov*2),rmat);
  ridge.position.set(0,yBase+h+0.05,0); ridge.castShadow=false; ridge.receiveShadow=true; g.add(ridge);
  for(const s of [-1,1]){
    const tri=pedTri(w*0.98,h*0.96,gableC); tri.position.set(0,yBase+h*0.48,s*(d/2-0.35)); g.add(tri);
  }
  if(tc!==undefined)for(const s of [-1,1]){ // the eave board: whose town is this, readable at 46px
    const fas=box(0.34,0.4,d+ov*2,tc); fas.castShadow=false;
    fas.rotation.z=-s*ang; fas.position.set(s*(tip-0.12),yBase-drop-0.12,0); g.add(fas);
  }
}

// ==================== v131 B: THE SIX ROOF FORMS (AGES §F.0) ====================
// AD §5.7 and AGES §H/A5 both say the same thing and the v130 building set failed it: an age
// change has to move SILHOUETTE. Six colours poured into one gable is a texture change, and a
// texture change is invisible at 46px. §F.0 gives each age a FORM and a PITCH, and this is the
// one door every hall in the file goes through so that no caller can take an age's colour
// without also taking its shape:
//
//   0 STONE  CONE, 45°   — the strongest pitch in the set, and the thing the Bronze deck answers
//   1 BRONZE FLAT, 0°    — deck + parapet + a 0.10 H cornice band; §F.0's stated §5.5 exemption
//   2 IRON   GABLE, 30°  — low. 30 and not 25: §F.0 gives Iron 25-30 and Classical 22-28, which
//                          OVERLAP, and §H/A5 fails any adjacent pair inside 6° of each other
//   3 CLASS. HIP,   23°  — low hip, the first roof in the game with four faces
//   4 MEDVL  GABLE, 50°  — steep. 20° off Iron's gable, so the two gable ages never rhyme
//   5 ENLIG. HIP,   32°  — hipped, and the only age that stands a cupola or a lantern on top
// Adjacent pitch breaks: 45 / 30 / 7 / 27 / 18 degrees — all clear of A5's 6° floor.
//
// A HIP IS BUILT BY HAND AND THAT IS NOT PERVERSITY. r128's four-segment CylinderGeometry can
// only give a SQUARE top, and a hip's top is a LINE — a frustum scaled to a rectangle comes out
// as a pyramid with its apex smeared, which reads as a tent. Six triangles, non-indexed so the
// four faces keep their own flat normals in the GEOMETRY (never `flatShading:true`, which would
// drop the mesh out of mergeBuildingBody and cost a draw call per roof — §G.1).
function hipGeo(w,d,h,ridge){
  const hw=w/2, hd=d/2, hr=Math.max(0,Math.min(ridge,w-0.001))/2;
  const P=(x,y,z)=>[x,y,z];
  const A=P(-hw,0,-hd),B=P(hw,0,-hd),C=P(hw,0,hd),D=P(-hw,0,hd),
        E=P(-hr,h,0), F=P(hr,h,0);
  const tris=[ D,C,F, D,F,E,      // the +z slope
               B,A,E, B,E,F,      // the -z slope
               A,D,E,             // the -x hip end
               C,B,F ];           // the +x hip end
  // UVs run 0..1 per face. They MUST stay inside the box: _bMergeGeo clamps them into one atlas
  // cell, and a UV that overshoots on an unclamped path samples a neighbouring skin.
  const uvs=[ 0,0, 1,0, 1,1,  0,0, 1,1, 0,1,
              0,0, 1,0, 1,1,  0,0, 1,1, 0,1,
              0,0, 1,0, 0.5,1,
              0,0, 1,0, 0.5,1 ];
  const pos=new Float32Array(tris.length*3);
  for(let i=0;i<tris.length;i++){pos[i*3]=tris[i][0];pos[i*3+1]=tris[i][1];pos[i*3+2]=tris[i][2];}
  const geo=new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.BufferAttribute(pos,3));
  geo.setAttribute("uv",new THREE.BufferAttribute(new Float32Array(uvs),2));
  geo.computeVertexNormals();   // non-indexed: one normal per face, which is what a roof wants
  return geo;
}
// `w`/`d` are the WALL span. Everything about the eave, the pitch and the apex height is derived
// from the age, so a caller states its footprint and gets its age's roof. Returns the apex height
// in world units so a chimney, a finial or a cupola can stand ON the roof instead of near it.
//   opt.roofC   override the slab hex (age-5 civic copper; a temple's own tile)
//   opt.tc      team colour for the eave board (AD §5.7, from age 2). Omit for none.
//   opt.pat     override the weave
//   opt.long    "z" if the ridge should run along z instead of the longer axis
//   opt.pitch   override the age's pitch, in degrees
//   opt.trim    the tympanum / soffit / parapet hex; defaults to the age's stone
function ageRoof(g,age,w,d,yBase,type,opt){
  opt=opt||{};
  const P=BPAL[age], e=(opt.eave!==undefined?opt.eave:P.eave)*w;
  const pitch=(opt.pitch!==undefined?opt.pitch:P.pitch)*Math.PI/180;
  const rc=opt.roofC!==undefined?opt.roofC:aRoof(age,type);
  const pat=opt.pat||P.roofPat, trim=opt.trim!==undefined?opt.trim:P.stone;
  const form=opt.form||P.form;
  if(form==="cone"){
    // §F.1: conical thatch, 5-15 m across, the most readable silhouette at RTS zoom. A cone gets
    // §5.5's eave for free — its widest point is its lowest — so the overhang is a slope seen
    // end-on and never the fat brown ceiling a dome's rim becomes.
    const r=Math.max(w,d)/2+e, h=r*Math.tan(pitch);
    const c=new THREE.Mesh(new THREE.ConeGeometry(r,h,12),texturedMat(pat,rc));
    c.castShadow=true; c.receiveShadow=true; c.position.y=yBase+h/2;
    if(d!==w)c.scale.z=(d/2+e)/r;
    inkOutline(c,1.8); g.add(c);
    // the eave course: a thick bound rim of thatch, which is what stops the cone reading as a
    // paper party hat and is where the §5.5 shadow band lands
    const rim=new THREE.Mesh(new THREE.CylinderGeometry(r,r*1.02,0.55,12),texturedMat(pat,_dk(rc,0.06)));
    rim.castShadow=false; rim.position.y=yBase+0.1; if(d!==w)rim.scale.z=(d/2+e)/r; g.add(rim);
    return yBase+h;
  }
  if(form==="flat"){
    // §F.0's stated exemption. A flat roof has no pitch and therefore no roof/wall value break, so
    // the contrast rides on the CORNICE BAND — 0.10 of building height of `dark` at the parapet —
    // and it must be at least 0.075 H or the age reads as an unbroken sand-coloured lump.
    const bh=Math.max(1.0,(yBase)*0.10);
    const corn=new THREE.Mesh(new THREE.BoxGeometry(w+2*e+0.4,bh,d+2*e+0.4),texturedMat(P.pat,P.dark));
    corn.position.y=yBase+bh/2; corn.castShadow=true; corn.receiveShadow=true; g.add(corn);
    const deck=new THREE.Mesh(new THREE.BoxGeometry(w+2*e,0.4,d+2*e),texturedMat(pat,rc));
    deck.position.y=yBase+bh+0.2; deck.castShadow=true; deck.receiveShadow=true; g.add(deck);
    const ph=Math.max(0.7,w*0.09);                     // the parapet: the deck's own top profile
    for(const s of [-1,1]){
      const a=box(w+2*e,ph,0.42,trim); a.castShadow=false; a.position.set(0,yBase+bh+0.4+ph/2,s*(d/2+e-0.2)); g.add(a);
      const b=box(0.42,ph,d+2*e-0.8,trim); b.castShadow=false; b.position.set(s*(w/2+e-0.2),yBase+bh+0.4+ph/2,0); g.add(b);
    }
    if(opt.tc!==undefined){const pen=box(w*0.30,0.3,0.2,opt.tc); pen.castShadow=false;
      pen.position.set(0,yBase+bh+0.4+ph*0.6,d/2+e); g.add(pen);}
    return yBase+bh+0.4+ph;
  }
  if(form==="hip"){
    // Four faces meeting a ridge along the longer axis. The ridge length is (long - short), which
    // is the geometry a real hip has and is what keeps the end slopes at the same pitch as the
    // sides — a shorter ridge steepens the ends and the roof reads as a pyramid.
    let W=w+2*e, D=d+2*e, swap=false;
    if(D>W||opt.long==="z"){const t=W;W=D;D=t;swap=true;}
    const h=(D/2)*Math.tan(pitch);
    const m=new THREE.Mesh(hipGeo(W,D,h,Math.max(W*0.12,W-D)),texturedMat(pat,rc));
    m.castShadow=true; m.receiveShadow=true; m.position.y=yBase;
    if(swap)m.rotation.y=Math.PI/2;
    inkOutline(m,1.8); g.add(m);
    // the soffit closes the overhang. hipGeo has no underside, and a rim with open air under it
    // is a hole you can see sky through from any camera below the eave — which at 18% overhang is
    // 0.18 of the footprint of sky, per side, on every hipped building in two ages.
    const sof=box(w+2*e,0.3,d+2*e,_dk(rc,0.10)); sof.castShadow=false; sof.position.y=yBase-0.1; g.add(sof);
    if(opt.tc!==undefined){ // the eave board, AD §5.7's team band, on the long faces only
      for(const s of [-1,1]){
        const fas=box(swap?0.34:w+2*e,0.34,swap?d+2*e:0.34,opt.tc); fas.castShadow=false;
        fas.position.set(swap?s*(w/2+e):0,yBase-0.28,swap?0:s*(d/2+e)); g.add(fas);
      }
    }
    return yBase+h;
  }
  // gable — ages 2 and 4, at 30° and 50°. Ridge along z by default; `long:"x"` turns it.
  const span=(opt.long==="x")?d:w, dep=(opt.long==="x")?w:d;
  const h=(span/2)*Math.tan(pitch);
  const rg=(opt.long==="x")?new THREE.Group():g;
  gableRoof(rg,span,dep,(opt.long==="x")?0:yBase,h,rc,opt.trim!==undefined?opt.trim:P.wall,
            span*(opt.eave!==undefined?opt.eave:P.eave),span*(opt.eave!==undefined?opt.eave:P.eave),
            pat,opt.tc);
  if(opt.long==="x"){rg.rotation.y=Math.PI/2; rg.position.y=yBase; g.add(rg);}
  return yBase+h;
}
// one step darker, without minting a Color per call site
function _dk(hex,f){
  const r=Math.max(0,(((hex>>16)&255)*(1-f))|0), g=Math.max(0,(((hex>>8)&255)*(1-f))|0),
        b=Math.max(0,((hex&255)*(1-f))|0);
  return (r<<16)|(g<<8)|b;
}
function colAt(g,x,z,h,r,age){ // a column in the local dialect
  if(age===1){ // Minoan: red, tapering DOWNWARD, black cushion capital
    const c=cyl(r,r*0.7,h,MINOANRED,9); c.position.set(x,h/2+0.15,z); g.add(c);
    const cap=cyl(r*1.35,r*1.1,0.4,0x2a2018,9); cap.castShadow=false; cap.position.set(x,h+0.35,z); g.add(cap);
  }else{
    const white=age>=5?WHITEWASH:MARBLE;
    const c=cyl(r*0.82,r,h,white,9); c.position.set(x,h/2+0.15,z); g.add(c);
    const cap=box(r*2.5,0.3,r*2.5,age===4?STONELIT:GOLD); cap.castShadow=false; cap.position.set(x,h+0.3,z); g.add(cap);
    const base=box(r*2.4,0.3,r*2.4,white); base.castShadow=false; base.position.set(x,0.15,z); g.add(base);
  }
}
function archDoor(g,x,z,w,h,c){ // Romanesque: dark door under a rounded stone header
  const d=box(w,h,0.3,c); d.castShadow=false; d.position.set(x,h/2,z); g.add(d);
  const arch=cyl(w/2,w/2,0.34,c,10); arch.rotation.x=Math.PI/2; arch.castShadow=false; arch.position.set(x,h,z); g.add(arch);
  const frame=cyl(w/2+0.24,w/2+0.24,0.2,STONEDK,10); frame.rotation.x=Math.PI/2; frame.castShadow=false;
  frame.position.set(x,h,z-0.04); g.add(frame);
}
function balustrade(g,w,y,z,c){ // Enlightenment roofline posts + rail
  const n=Math.max(3,Math.floor(w/1.15));
  for(let i=0;i<=n;i++){const p=cyl(0.09,0.12,0.7,c,5);p.castShadow=false;p.position.set(-w/2+i*(w/n),y+0.35,z);g.add(p);}
  const rail=box(w+0.3,0.16,0.26,c); rail.castShadow=false; rail.position.set(0,y+0.78,z); g.add(rail);
}
function winGrid(g,cols,rows,y0,dy,zF,dark,sill){ // sash window rows
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const x=(c-(cols-1)/2)*2.0;
    const w=box(0.95,1.35,0.12,dark); w.castShadow=false; w.position.set(x,y0+r*dy,zF); g.add(w);
    if(sill!==undefined){const s=box(1.2,0.12,0.18,sill);s.castShadow=false;s.position.set(x,y0+r*dy-0.8,zF+0.02);g.add(s);}
  }
}
function horns(g,x,y,z){ // Minoan horns of consecration
  const b=box(1.5,0.35,0.55,0xd9cba4); b.castShadow=false; b.position.set(x,y,z); g.add(b);
  for(const s of [-1,1]){const h=cone(0.22,1.1,0xe7dcc0,5); h.rotation.z=-s*0.5; h.castShadow=false; h.position.set(x+s*0.55,y+0.62,z); g.add(h);}
}
function flagPole(g,x,y,z,h,tc,fw,fh){
  fw=fw||2; fh=fh||1;
  const p=cyl(0.09,0.11,h,0x6b4a2b,5); p.castShadow=false; p.position.set(x,y+h/2,z); g.add(p);
  const f=box(fw,fh,0.09,tc); f.castShadow=false; f.position.set(x+fw/2,y+h-fh*0.6,z); g.add(f);
}
function firePit(g,x,z){
  for(let i=0;i<4;i++){const st=box(0.5,0.35,0.4,0x8a8274); st.castShadow=false;
    st.position.set(x+Math.cos(i*1.57)*0.8,0.18,z+Math.sin(i*1.57)*0.8); st.rotation.y=i*0.7; g.add(st);}
  const fl=cone(0.35,0.8,0xe08a2e,5); fl.castShadow=false; fl.position.set(x,0.6,z); g.add(fl);
}
function brazier(g,x,z){
  const bowl=cyl(0.42,0.28,0.5,0x8d7a5a,7); bowl.castShadow=false; bowl.position.set(x,0.8,z); g.add(bowl);
  const fl=cone(0.28,0.6,0xe08a2e,5); fl.castShadow=false; fl.position.set(x,1.35,z); g.add(fl);
}

// -- the generic hall shell: walls + roof + door in the idiom of the age --
// footprint w (x) by d (z), wall height h; the door faces +z. Type props go on after.
//
// v131 B — REBUILT ONTO AGES §F.0. Every branch here used to invent its own wall stack and its
// own roof call, which is how the file ended up with six ages of gable and one age of dome. It
// now states its footprint and takes the age's SHELL: base course, wall, frame, roof form, eave.
// `type` is passed through so ageRoof can hand an age-5 civic building copper and everything
// else slate (§F.6), and so a caller that wants its own roof can override.
// Returns the roof apex, so a chimney or a cupola stands ON it (see the blacksmith's flue).
function agedShell(g,age,tc,w,h,d,type,opt){
  opt=opt||{};
  const p=BPAL[age];
  const e=p.eave*w;
  if(age===0){
    // §F.1: daub over a timber post ring, conical thatch, sunk into an earth mound. The BERM is
    // the base course this age does not have — §F.0 is explicit that Stone Age buildings have no
    // stone footing and are dug in instead, so the ground line is packed earth and the wall
    // starts out of it.
    // THE WALL IS A BOX AND THAT IS THE LOAD-BEARING DECISION, unchanged from v130.3: every
    // caller hangs its own props off `d/2` — the barracks' two shields sit at z=5.15 against a
    // d=10 hall — and a round drum pulls the daub away from that plane everywhere except dead
    // centre, which floats them. A flat front face is the only thing every caller can hang on.
    let berm;
    if(opt.oval){
      berm=new THREE.Mesh(new THREE.CylinderGeometry(1,1,0.8,16),texturedMat(p.pat,p.dark));
      berm.scale.set((w+1.0)/2,1,(d+1.0)/2);
    }else berm=box(w+1.0,0.8,d+1.0,p.dark);
    berm.position.y=0.3; g.add(berm);
    // v131.7 opt.oval: a round daub drum instead of the box, for callers whose age-0 roof is a
    // cone and whose body therefore reads square under a round hat. It is OPT-IN, and not the
    // default, for precisely the reason the paragraph above gives: an oval pulls the wall off the
    // z=d/2 plane everywhere except dead centre, so a caller that turns it on MUST move its own
    // front props onto the ellipse. The barracks does. Nothing else has asked.
    let wall;
    if(opt.oval){
      wall=new THREE.Mesh(new THREE.CylinderGeometry(1,1,h,16),aWall(0));
      wall.scale.set(w/2,1,d/2);
    }else wall=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),aWall(0));
    wall.position.y=h/2+0.5; wall.castShadow=true; wall.receiveShadow=true; g.add(wall);
    for(const sx of [-1,1])for(const sz of [-1,1]){   // the post ring, at the corners it frames
      const up=cyl(0.26,0.30,h,p.timber,5); up.castShadow=false;
      // on an oval there are no corners: a diagonal meets the ellipse at (a,b)/sqrt(2), so a post
      // left in the box corner would stand 2.6 clear of the daub it is supposed to be framing.
      const k=opt.oval?Math.SQRT1_2:1;
      up.position.set(sx*(w/2-0.06)*k,h/2+0.5,sz*(d/2-0.06)*k); g.add(up);}
    ageRoof(g,0,w,d,h+0.5,type,{tc:undefined});
    const mouth=box(w*0.24,h*0.62,0.45,p.dark); mouth.castShadow=false; mouth.position.set(0,h*0.31+0.5,d/2+0.1); g.add(mouth);
    const flap=box(w*0.19,h*0.52,0.2,tc); flap.castShadow=false; flap.rotation.x=-0.12; flap.position.set(0,h*0.28+0.5,d/2+0.34); g.add(flap);
    return h+0.5+(Math.max(w,d)/2+e);
  }
  if(age===1){
    // §F.2: mudbrick on an ashlar socle, flat deck with a parapet, light-wells. The cornice band
    // is inside ageRoof — it is §F.0's own answer to the §5.5 exemption and belongs with the roof.
    const soc=new THREE.Mesh(new THREE.BoxGeometry(w+0.8,p.base*2,d+0.8),texturedMat(p.pat,p.stone));
    soc.position.y=p.base; soc.castShadow=true; g.add(soc);
    const main=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),aWall(1));
    main.position.y=h/2+p.base*2; main.castShadow=true; g.add(main);
    const top=ageRoof(g,1,w,d,h+p.base*2,type,{tc});
    for(let i=0;i<3;i++){const viga=cyl(0.16,0.16,0.9,p.timber,5); viga.rotation.x=Math.PI/2; viga.castShadow=false;
      viga.position.set(-w*0.24+i*w*0.24,h*0.86,d/2+0.4); g.add(viga);}   // the beam ends
    const door=box(2.0,2.7,0.22,p.dark); door.castShadow=false; door.position.set(0,1.7,d/2+0.06); g.add(door);
    const lint=box(2.5,0.3,0.26,p.trim); lint.castShadow=false; lint.position.set(0,3.2,d/2+0.09); g.add(lint);
    return top;
  }
  if(age===2){
    // §F.3: fieldstone on a stone footing with an exposed TIMBER FRAME, low gable at 30°. The
    // frame is the age's drawing on top of the mass and it is what separates a fieldstone wall
    // from Classical travertine at 46px, since the two are only 0.2 of value apart.
    const foot=new THREE.Mesh(new THREE.BoxGeometry(w+0.6,p.base*2,d+0.6),texturedMat("metal",p.stone));
    foot.position.y=p.base; foot.castShadow=true; g.add(foot);
    const main=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),aWall(2));
    main.position.y=h/2+p.base*2; main.castShadow=true; g.add(main);
    for(const sx of [-1,1]){
      const post=new THREE.Mesh(new THREE.BoxGeometry(0.42,h,0.42),texturedMat("wood",p.timber));
      post.position.set(sx*(w/2-0.06),h/2+p.base*2,d/2-0.06); g.add(post);
    }
    const sill=box(w+0.1,0.34,0.22,p.timber); sill.castShadow=false; sill.position.set(0,h*0.66,d/2+0.05); g.add(sill);
    const top=ageRoof(g,2,w,d,h+p.base*2,type,{tc});
    const door=box(1.9,2.6,0.22,p.dark); door.castShadow=false; door.position.set(0,1.9,d/2+0.06); g.add(door);
    return top;
  }
  if(age===3){
    // §F.4: travertine on a 0.5 stone PODIUM, pilasters, a team frieze under the eave, low hip.
    const pod=new THREE.Mesh(new THREE.BoxGeometry(w+1.6,p.base*2,d+1.6),texturedMat("metal",p.stone));
    pod.position.y=p.base; pod.castShadow=true; g.add(pod);
    const main=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),aWall(3));
    main.position.y=h/2+p.base*2; main.castShadow=true; g.add(main);
    for(const px of [-w/2+1,0,w/2-1]){const pil=box(0.6,h,0.26,p.stone); pil.castShadow=false;
      pil.position.set(px,h/2+p.base*2,d/2+0.09); g.add(pil);}
    const ent=box(w+0.8,0.7,d+0.8,p.stone); ent.castShadow=false; ent.position.y=h+p.base*2+0.35; g.add(ent);
    const frieze=box(w+0.9,0.3,d+0.9,tc); frieze.castShadow=false; frieze.position.y=h+p.base*2+0.85; g.add(frieze);
    // no eave board: the frieze immediately below IS the age's team band, and two of them on one
    // roofline blows AD §2.5's 18% team-colour ceiling for a building.
    const top=ageRoof(g,3,w+0.8,d+0.8,h+p.base*2+1.0,type,{});
    const door=box(2.1,2.9,0.22,p.dark); door.castShadow=false; door.position.set(0,2.0,d/2+0.06); g.add(door);
    return top;
  }
  if(age===4){
    // §F.5: limewash infill in a DARK OAK BOX FRAME on an ashlar plinth, steep gable at 50°.
    // The half-timbering is the whole read — §F.0 names the oak frame in the wall column, not as
    // trim — so the studs and the mid-rail are structural here and not dressing.
    const pl=new THREE.Mesh(new THREE.BoxGeometry(w+1.0,p.base*2,d+1.0),texturedMat("metal",p.stone));
    pl.position.y=p.base; pl.castShadow=true; g.add(pl);
    const main=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),aWall(4));
    main.position.y=h/2+p.base*2; main.castShadow=true; g.add(main);
    for(const sx of [-1,1])for(const sz of [-1,1]){
      const post=new THREE.Mesh(new THREE.BoxGeometry(0.46,h,0.46),texturedMat("wood",p.timber));
      post.position.set(sx*(w/2-0.06),h/2+p.base*2,sz*(d/2-0.06)); g.add(post);
    }
    const beam=new THREE.Mesh(new THREE.BoxGeometry(w+0.12,0.44,d+0.12),texturedMat("wood",p.timber));
    beam.castShadow=false; beam.position.y=h*0.60+p.base*2; g.add(beam);
    for(const sx of [-1,0,1]){const stud=box(0.3,h*0.52,0.16,p.timber); stud.castShadow=false;
      stud.position.set(sx*(w*0.28),h*0.30+p.base*2,d/2+0.06); g.add(stud);}
    const top=ageRoof(g,4,w,d,h+p.base*2,type,{tc});
    archDoor(g,0,d/2+0.06,2,2.6,p.timber);
    const dband=box(2.1,0.16,0.1,STONEDK); dband.castShadow=false; dband.position.set(0,1.9,d/2+0.14); g.add(dband);
    for(const s of [-1,1]){const sl=box(0.26,1.1,0.12,p.dark); sl.castShadow=false; sl.position.set(s*(w/2-1.6),h*0.74,d/2+0.07); g.add(sl);}
    const ban=box(1.2,1.8,0.09,tc); ban.castShadow=false; ban.position.set(w/2-2.9,h*0.64,d/2+0.16); g.add(ban);
    return top;
  }
  // 5 ENLIGHTENMENT — §F.6: pale render over a RED BRICK base course, quoins and chimneys, even
  // rows of sash windows, dentil cornice, hipped slate. "The first building in the tech tree
  // designed to look ordered and rational rather than to survive a siege" — so the read is
  // symmetry and repetition, and the brick is what stops it going back to being a white box.
  const bb=new THREE.Mesh(new THREE.BoxGeometry(w+0.7,p.base*2,d+0.7),texturedMat("metal",BRICK));
  bb.position.y=p.base; bb.castShadow=true; g.add(bb);
  const main=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),aWall(5));
  main.position.y=h/2+p.base*2; main.castShadow=true; g.add(main);
  for(const s of [-1,1]){const q=box(0.55,h,0.55,BRICK); q.castShadow=false;
    q.position.set(s*(w/2-0.08),h/2+p.base*2,d/2-0.08); g.add(q);}       // brick quoins
  const cor=box(w+0.9,0.5,d+0.9,p.wall); cor.castShadow=false; cor.position.y=h+p.base*2+0.25; g.add(cor);
  for(let i=0;i<Math.max(4,Math.round(w/1.1));i++){                       // the dentil course
    const den=box(0.28,0.28,0.24,p.stone); den.castShadow=false;
    den.position.set(-w/2+0.4+i*(w-0.8)/Math.max(3,Math.round(w/1.1)-1),h+p.base*2-0.06,d/2+0.5); g.add(den);}
  const top=ageRoof(g,5,w,d,h+p.base*2+0.5,type,{tc});
  for(const s of [-1,1]){                                                 // chimneys at BOTH ends
    const ch=new THREE.Mesh(new THREE.BoxGeometry(0.9,2.4,0.9),texturedMat("metal",BRICK));
    ch.position.set(s*(w*0.40),top-1.0,0); ch.castShadow=true; g.add(ch);
    const cp=box(1.15,0.28,1.15,p.dark); cp.castShadow=false; cp.position.set(s*(w*0.40),top+0.32,0); g.add(cp);
  }
  winGrid(g,Math.max(2,Math.round(w/4.2)),1,h*0.62,0,d/2+0.07,p.dark,p.stone);
  const door=box(1.8,2.7,0.2,p.dark); door.castShadow=false; door.position.set(0,1.65,d/2+0.06); g.add(door);
  const dcase=box(2.4,0.34,0.24,p.wall); dcase.castShadow=false; dcase.position.set(0,3.15,d/2+0.09); g.add(dcase);
  const ped=pedTri(2.4,0.8,p.wall); ped.position.set(0,3.6,d/2+0.09); g.add(ped);
  flagPole(g,w/2-1.2,h+p.base*2+0.6,0,2.8,tc,1.3,0.7);
  return top;
}

// v130 B2 — DETERMINISTIC PER-INSTANCE VARIATION, AND WHY IT CANNOT BE Math.random().
// Three pixel-identical houses in a row is the age-4 town's most obvious tell that this is a
// spreadsheet and not a place. The seed is a hash of (x, z, type, age): `_restyleOneBuilding`
// throws the body away and rebuilds it from scratch on every age-up, so a random seed would
// reshuffle the entire town every time anyone advanced an age — and host and guest would reshuffle
// it DIFFERENTLY, which is a desync you can see from across the map (AD §10.15). Positions are
// quantised to quarter-units first so float drift in placement can never flip a variant.
// One avalanche round matters: without it neighbouring plots on a 4-unit grid rhyme, and a street
// comes out ABABAB instead of mixed.
function bHash(x,z,type,age){
  let h=(Math.round(x*4)*73856093)^(Math.round(z*4)*19349663)^((age+1)*83492791);
  for(let i=0;i<type.length;i++)h=(h*31+type.charCodeAt(i))|0;
  h^=h>>>15; h=Math.imul(h,0x2c1b3c6d); h^=h>>>13;
  return h>>>0;
}
// ---------- the building meshes themselves ----------
function buildingMesh(type,team,age,hx,hz){
  const g=new THREE.Group(); const tc=TEAMCOL[team];
  if(age===undefined)age=teamAge[team]||0;
  age=Math.max((BLD[type]&&BLD[type].age)||0,Math.min(5,age|0));
  g.userData.age=age;
  const P=BPAL[age];
  const V=bHash(hx||0,hz||0,type,age); // the placement ghost has no plot yet and gets variant 0
  if(type==="towncenter"){
    // ======================= THE TOWN CENTRE, AGES §F.1-§F.6 =======================
    // The most-looked-at building in the game and the one an AoE player names an age from at a
    // glance, so each of the six is built around the ONE hero prop §F names for it and nothing
    // else is allowed to compete with it:
    //   0 a low mounded stone HUMMOCK with a smoking roof vent — explicitly NOT a tower
    //   1 the MEGARON: a two-column entry porch inside cyclopean walls
    //   2 the LAMASSU: a pair of colossal winged human-headed bulls flanking the doorway
    //   3 the BASILICA: a TWO-TIER roof, higher over the nave with a clerestory, lower over aisles
    //   4 the STONE KEEP: square corner turrets with ONE round stair turret, and a forebuilding
    //   5 the GEORGIAN CIVIC BLOCK: Palladian symmetry under hipped copper — the first building in
    //     the whole tech tree designed to look ordered rather than to survive a siege
    if(age===0){
      // §F.1 — "A low mounded stone hummock with a smoking roof vent, NOT a tower. Oversized house
      // form, partly sunk into an earth mound, linked to smaller cells by covered stone passages."
      // v130 spent four revisions turning a mammoth-bone dome into a drum, a brim, a clerestory
      // and a vent and it still read as a beach ball in a cage, because a hemisphere carries its
      // widest point at the SPRING LINE — exactly where the eye looks for a wall head. §F.1 does
      // not ask for a dome at all. A DOUBLE-SKIN DRYSTONE WALL half sunk in a mound, under the
      // age's own 45° cone, is both the sourced building and the silhouette the age ladder needs:
      // it rhymes with the houses instead of contradicting them, and the cone is what says Stone.
      const mound=cyl(9.6,10.6,1.6,P.dark,14); mound.position.y=0.7; mound.receiveShadow=true; g.add(mound);
      const turf=cyl(9.0,9.6,0.5,0x6f8a3e,14); turf.castShadow=false; turf.position.y=1.7; g.add(turf);
      // the double skin: an outer drystone ring packed with clay and midden, and the daub cell
      // inside it. Two courses, not one, because "double-skin" is the sourced construction and a
      // 0.7 step between them is what makes the wall read as thick at 46px.
      const outer=new THREE.Mesh(panelUV(new THREE.CylinderGeometry(8.2,8.7,3.4,14),14),
        texturedMat("metal",P.stone));
      outer.position.y=3.0; outer.castShadow=true; outer.receiveShadow=true; g.add(outer);
      const inner=new THREE.Mesh(panelUV(new THREE.CylinderGeometry(6.9,7.1,5.6,14),14),aWall(0));
      inner.position.y=4.6; inner.castShadow=true; inner.receiveShadow=true; g.add(inner);
      for(let i=1;i<14;i++){const a=i*Math.PI/7;   // the timber post ring, out of step with the roof
        const up=cyl(0.22,0.26,5.4,P.timber,5); up.castShadow=false;
        up.position.set(Math.sin(a)*7.15,4.6,Math.cos(a)*7.15); g.add(up);}
      const apex=ageRoof(g,0,14.6,14.6,7.4,type,{});
      // the smoke vent — §F.1's own top profile, and the one thing above the cone
      const vcol=cyl(1.7,1.9,0.6,P.stone,8); vcol.castShadow=false; vcol.position.y=apex-0.5; g.add(vcol);
      const vent=cyl(1.3,1.5,1.2,P.dark,8); vent.castShadow=true; vent.position.y=apex+0.3; g.add(vent);
      const smoke=cyl(0.9,1.3,1.6,0xa8a49a,7); smoke.castShadow=false; smoke.position.y=apex+1.5; g.add(smoke);
      // THE DOORWAY. The recess is PAINTED, not cut: you cannot sink a panel into a convex drum,
      // so a near-black opening cut wider than the curtain is the shadow, and the team flap stands
      // 0.2 proud of it. Sized to the wall, and no wider — the first cut at 62% of the facet came
      // back reading as a barn with the door open.
      const jamb1=box(0.7,4.6,0.7,P.stone); jamb1.castShadow=false; jamb1.position.set(-2.0,4.0,6.6); g.add(jamb1);
      const jamb2=box(0.7,4.6,0.7,P.stone); jamb2.castShadow=false; jamb2.position.set(2.0,4.0,6.6); g.add(jamb2);
      const lintel=box(5.2,0.8,1.0,P.stone); lintel.castShadow=false; lintel.position.set(0,6.5,6.6); g.add(lintel);
      const mouth=box(3.4,4.0,0.5,P.dark); mouth.castShadow=false; mouth.position.set(0,3.7,6.75); g.add(mouth);
      const flap=box(2.7,3.4,0.2,tc); flap.castShadow=false; flap.rotation.x=-0.12; flap.position.set(0,3.5,7.0); g.add(flap);
      // "linked to smaller cells by covered stone passages" — the detail that separates this from
      // any other round building in the set, and the reason the plan is a hummock and not a hut
      for(const [cx,cz,ca] of [[-8.6,-5.0,0.9],[8.2,-5.6,-0.9]]){
        const pas=box(2.2,2.0,5.2,P.stone); pas.rotation.y=ca; pas.position.set(cx*0.62,1.1,cz*0.62); g.add(pas);
        const cell=cyl(2.5,2.8,2.4,P.stone,10); cell.position.set(cx,1.2,cz); cell.castShadow=true; g.add(cell);
        const lid=new THREE.Mesh(new THREE.ConeGeometry(3.3,2.0,10),texturedMat(P.roofPat,P.roof));
        lid.castShadow=true; lid.position.set(cx,3.4,cz); g.add(lid);
      }
      firePit(g,0,10.4);
      flagPole(g,9.6,1.4,5.2,12,tc,2.8,1.5);
    }else if(age===1){
      // §F.2 THE MEGARON inside CYCLOPEAN WALLS: two-column entry porch, vestibule, main hall with
      // four columns ringing a circular hearth, and a corbelled RELIEVING TRIANGLE over the gate.
      const soc=new THREE.Mesh(new THREE.BoxGeometry(17.5,0.9,15),texturedMat("metal",P.stone));
      soc.position.set(0,0.45,-1); soc.castShadow=true; g.add(soc);
      const hall=new THREE.Mesh(new THREE.BoxGeometry(15,6.2,10),aWall(1));
      hall.position.set(0,4.0,-3); hall.castShadow=true; hall.receiveShadow=true; g.add(hall);
      ageRoof(g,1,15,10,7.1,type,{tc});
      // the central OCULUS over the hearth — §F.2 names it, and it is a hole of sky in a flat deck
      const ocu=cyl(1.5,1.5,0.5,P.dark,10); ocu.castShadow=false; ocu.position.set(0,8.3,-3); g.add(ocu);
      // the porch: two columns in antis, which is what makes a megaron a megaron
      const porch=new THREE.Mesh(new THREE.BoxGeometry(9.0,0.6,5.4),texturedMat("metal",P.stone));
      porch.position.set(0,0.9,4.4); porch.castShadow=false; g.add(porch);
      for(const px of [-2.6,2.6])colAt(g,px,5.4,4.6,0.62,1);
      const arch=new THREE.Mesh(new THREE.BoxGeometry(9.4,1.5,6.0),aWall(1));
      arch.position.set(0,6.0,4.4); arch.castShadow=true; g.add(arch);
      const corn=box(10.0,0.6,6.6,P.stone); corn.castShadow=false; corn.position.set(0,7.0,4.4); g.add(corn);
      // the CYCLOPEAN wall: massive roughly-fitted boulders, and they must read as BOULDERS, so
      // they are different sizes at different heights and none of them line up
      for(const s of [-1,1])for(let i=0;i<5;i++){
        const r=1.5+((i*7+(s>0?3:0))%3)*0.42;
        const bo=new THREE.Mesh(new THREE.CylinderGeometry(r,r*1.08,r*1.35,6),texturedMat("metal",P.stone));
        bo.rotation.y=i*0.7; bo.position.set(s*8.6,r*0.7+ (i%2)*0.2,5.6-i*2.9); bo.castShadow=true; g.add(bo);
      }
      // the RELIEVING TRIANGLE over the gate — corbelled, and the one shape nothing else here has
      const rt=pedTri(4.6,2.2,P.dark); rt.position.set(0,6.6,7.5); g.add(rt);
      const gate=box(3.2,4.6,0.4,P.dark); gate.castShadow=false; gate.position.set(0,2.5,7.4); g.add(gate);
      const lin=box(4.4,0.5,0.6,P.trim); lin.castShadow=false; lin.position.set(0,5.0,7.5); g.add(lin);
      horns(g,0,8.6,1.5);
      flagPole(g,-8.6,1.0,7.6,7.0,tc,2.4,1.2);
    }else if(age===2){
      // §F.3 — "THE LAMASSU IS THE SILHOUETTE. Nothing else in the building set reads like two
      // monumental guardian figures in a gate. Build them as the age's hero prop."
      const foot=new THREE.Mesh(new THREE.BoxGeometry(17,0.7,12.6),texturedMat("metal",P.stone));
      foot.position.set(0,0.35,-1); foot.castShadow=true; g.add(foot);
      const hall=new THREE.Mesh(new THREE.BoxGeometry(15.4,6.4,10.4),aWall(2));
      hall.position.set(0,3.9,-2.2); hall.castShadow=true; hall.receiveShadow=true; g.add(hall);
      for(const sx of [-1,1])for(const sz of [-1,1]){
        const post=new THREE.Mesh(new THREE.BoxGeometry(0.5,6.4,0.5),texturedMat("wood",P.timber));
        post.position.set(sx*7.45,3.9,-2.2+sz*5.15); g.add(post);}
      // ANOTHER ageRoof AT THE GROUP ORIGIN. ageRoof draws at the origin of the group it is
      // handed, and this one was handed `g` while the hall it roofs stands at z=-2.2 — so the roof
      // was built 2.2 FORWARD of its own walls. Same fault and same fix as the Iron house's three
      // courtyard roofs, the storage pit's huts in ages 0/2/3, the barracks' centurion block and
      // the market's court soffits: translate, THEN roof.
      // long:"x" makes the SPAN the 10.4 depth, so §5.5's 14% eave is 10.4*0.14 = 1.456 and the
      // eave line falls 5.2+1.456 = 6.656 either side of the ridge. Against a hall running
      // z -7.4..+3.0 that was an overhang of MINUS 0.744 at the BACK — the rear wall and the
      // glazed band (z -7.5..+3.1) stood PROUD of the roof, so that elevation had none of the hard
      // shadow band §5.5 calls the single highest-value readability trick — and +3.656 at the
      // FRONT, 2.5x the authored figure. The front is where the hero prop is: at the lamassu
      // head's rear face, z=5.55, the slab occupied y 6.655..7.140 while the head runs 5.0..7.2
      // over x 2.65..4.55, and it crossed that unbroken out to z=6.804 — the roof plate ended
      // INSIDE the guardian's head, with the polos cap's rear rim (y 7.05, z 5.35..5.71) in the
      // slab and the cap standing on top of the roof. §F.3: the LAMASSU IS THE SILHOUETTE,
      // "flanking the doorway" — not wearing the roof.
      // On the hall's own z the roof lands at -2.2 +/- 6.656 = -8.856..+4.456: 1.456 of eave past
      // BOTH wall faces, and 0.746 of daylight between the outermost drawn slab corner
      // (-2.2+6.804 = 4.604) and the nearest lamassu part, the cap's rear rim at z=5.35. The ridge
      // does not move — 10.352 before and after — so §H/A5's silhouette ladder is untouched, and
      // nothing GROUNDED moves, so 00-data's measured fx/fz (11.88/11.90) still hold.
      // NOT "or be larger", John's other remedy: to reach z=-7.4 from a ridge stuck at 0 the span
      // has to go 10.4 -> 14.8, and ageRoof derives EVERYTHING from the span — apex 3.002 -> 4.272,
      // ridge 10.35 -> 11.62, eave 1.456 -> 2.072, front eave line out to z=9.47, i.e. 6.47 past
      // the front wall (4.4x the authored overhang). It still buries the lamassu, and it STILL
      // leaves the ridge 2.2 off the hall's centre. A bigger one is an off-centre roof with more
      // to be off by.
      const rsub=new THREE.Group(); rsub.position.set(0,0,-2.2); g.add(rsub);   // the hall's own z
      ageRoof(rsub,2,15.4,10.4,7.1,type,{tc,long:"x"});
      // the glazed-brick band: the one saturated course on an otherwise grey building
      const band=box(15.6,0.7,10.6,0x3A5A7A); band.castShadow=false; band.position.set(0,6.6,-2.2); g.add(band);
      // THE PAIR OF LAMASSU. Colossal, human-headed, winged, flanking the doorway — carved out of
      // the gate mass rather than standing free, which is both how they were built and the only
      // way to keep them from reading as two statues parked outside.
      for(const s of [-1,1]){
        const bulk=new THREE.Mesh(new THREE.BoxGeometry(2.4,5.0,5.6),texturedMat("metal",P.stone));
        bulk.position.set(s*3.6,2.5,4.6); bulk.castShadow=true; bulk.receiveShadow=true; g.add(bulk);
        const wing=box(0.5,2.6,4.2,P.stone); wing.rotation.x=-0.16; wing.castShadow=false;
        wing.position.set(s*4.75,3.6,4.4); g.add(wing);
        for(let f=0;f<4;f++){const fe=box(0.42,0.4,3.6,_dk(P.stone,0.16)); fe.castShadow=false;
          fe.rotation.x=-0.16; fe.position.set(s*5.02,2.9+f*0.52,4.4); g.add(fe);}   // the flight feathers
        const head=box(1.9,2.2,1.9,P.stone); head.position.set(s*3.6,6.1,6.5); head.castShadow=true; g.add(head);
        const beard=box(1.5,1.6,0.7,_dk(P.stone,0.24)); beard.castShadow=false; beard.position.set(s*3.6,5.4,7.5); g.add(beard);
        const cap=cyl(1.05,1.15,0.9,P.trim,8); cap.castShadow=false; cap.position.set(s*3.6,7.5,6.5); g.add(cap);
        for(const hs of [-1,1]){const hn=cone(0.24,0.9,P.trim,5); hn.rotation.z=-hs*0.7; hn.castShadow=false;
          hn.position.set(s*3.6+hs*0.95,7.2,6.5); g.add(hn);}
        const leg=box(1.9,2.4,0.9,P.stone); leg.castShadow=false; leg.position.set(s*3.6,1.2,7.3); g.add(leg);
      }
      const gate=box(4.2,5.2,0.5,P.dark); gate.castShadow=false; gate.position.set(0,2.6,4.4); g.add(gate);
      const gban=box(3.0,1.6,0.14,tc); gban.castShadow=false; gban.position.set(0,4.9,4.75); g.add(gban);
      flagPole(g,-8.8,0.7,7.4,7.4,tc,2.4,1.2);
    }else if(age===3){
      // §F.4 THE BASILICA, and its TWO-TIER ROOF is "the age's single strongest building read":
      // a long hall with nave and flanking aisles, an APSE at one end, and a higher roof over the
      // nave with a CLERESTORY of windows above the lower aisle roofs. Two roofs, two heights,
      // one silhouette that no other age in the set has.
      const pod=new THREE.Mesh(new THREE.BoxGeometry(19,1.0,14),texturedMat("metal",P.stone));
      pod.position.y=0.5; pod.castShadow=true; g.add(pod);
      for(let i=0;i<2;i++){ // the podium's own two steps: §F.0 gives Classical a 0.5 stone podium
        const st=box(20.4+i*1.4,0.34,15.4+i*1.4,P.stone); st.castShadow=false;
        st.position.y=0.5-i*0.34; g.add(st);}
      // the aisles, low and wide
      const aisle=new THREE.Mesh(new THREE.BoxGeometry(16.4,4.6,12),aWall(3));
      aisle.position.y=3.3; aisle.castShadow=true; aisle.receiveShadow=true; g.add(aisle);
      for(const px of [-7.0,-3.5,0,3.5,7.0])colAt(g,px,6.6,4.4,0.5,3);
      ageRoof(g,3,16.4,12,5.9,type,{long:"x"});
      // the nave, standing above the aisle roof with its clerestory band
      const nave=new THREE.Mesh(new THREE.BoxGeometry(9.0,4.4,12.4),aWall(3));
      nave.position.y=8.6; nave.castShadow=true; nave.receiveShadow=true; g.add(nave);
      for(let i=0;i<5;i++)for(const s of [-1,1]){    // THE CLERESTORY — the windows are the read
        const w=box(0.9,1.9,0.3,P.dark); w.castShadow=false; w.position.set(-4.4+i*2.2,9.2,s*6.25); g.add(w);
        const a=cyl(0.45,0.45,0.34,P.dark,9); a.rotation.x=Math.PI/2; a.castShadow=false;
        a.position.set(-4.4+i*2.2,10.15,s*6.25); g.add(a);}
      const ent=box(9.8,0.6,13.2,P.stone); ent.castShadow=false; ent.position.y=11.0; g.add(ent);
      const frieze=box(10.0,0.3,13.4,tc); frieze.castShadow=false; frieze.position.y=11.5; g.add(frieze);
      ageRoof(g,3,9.8,13.2,11.7,type,{long:"x"});
      // the APSE, semicircular, closing the far end
      const apse=new THREE.Mesh(new THREE.CylinderGeometry(4.4,4.6,5.2,12,1,false,0,Math.PI),aWall(3));
      // THE SAME ONE-TOKEN YAW BUG AS THE MEDIEVAL CHURCH'S APSE, one age down. thetaLength=PI
      // is r128's +X half and rotation.y=a slides it to [a, PI+a]; at PI the drum was the -X
      // half, measured x[-4.60,0.00] y[1.00,6.20] z[-10.80,-1.60] -- inside the 16.4 aisle, so
      // like the church it never showed on the flank, only as a rear-LEFT quarter with its open
      // theta cut on the centreline x=0. The SEMI-DOME above it never had the bug: a phiLength=PI
      // sphere spans the +Z half (SphereGeometry.js:68/70, x=-r*cos(phi)*sin(theta),
      // z=r*sin(phi)*sin(theta)), so its rotation.y=PI already put it over the REAR -- which is
      // exactly why the cap read as a dome hanging past the aisle roof with nothing under half of
      // it. PI/2 puts the drum at [PI/2, 3PI/2] = the -Z half: measured x[-4.60,4.60]
      // y[1.00,6.20] z[-10.80,-6.20] under the cap's x[-4.70,4.70] z[-10.90,-6.20] -- concentric,
      // dome equator y=6.2 on the drum top 3.6+5.2/2 = 6.2, and 4.7 over 4.4 = the 0.3 oversail a
      // roof should have. The cut plane z=-6.2 stands 0.2 PROUD of the aisle's rear face at -6.0
      // rather than flush in it, so it is occluded rather than sealed: the aisle body (top y=5.6)
      // and its roof hide the mouth from +Z, checked in a front elevation. acap's own
      // rotation.y=PI on the next line stays as it is.
      apse.rotation.y=Math.PI/2; apse.position.set(0,3.6,-6.2); apse.castShadow=true; g.add(apse);
      const acap=new THREE.Mesh(new THREE.SphereGeometry(4.7,12,5,0,Math.PI,0,Math.PI/2),
        texturedMat(P.roofPat,P.roof));
      acap.rotation.y=Math.PI; acap.castShadow=true; acap.position.set(0,6.2,-6.2); g.add(acap);
      archDoor(g,0,6.06,3.0,4.2,P.dark);
      for(const s of [-1,1]){const ac=box(0.5,0.6,0.4,GOLD); ac.castShadow=false; ac.position.set(s*4.6,11.9,6.4); g.add(ac);}
      flagPole(g,-9.6,1.0,7.0,7.6,tc,2.4,1.2);
    }else if(age===4){
      // §F.5 THE STONE KEEP: a massive rectangular tower, square corner turrets with ONE ROUND
      // STAIR TURRET, small high windows, and a FOREBUILDING covering the entrance stair up to
      // first-floor level. The odd round turret is the giveaway detail and it is cheap.
      const pl=new THREE.Mesh(new THREE.BoxGeometry(17.4,0.9,17.4),texturedMat("metal",P.stone));
      pl.position.y=0.45; pl.castShadow=true; g.add(pl);
      const keep=new THREE.Mesh(new THREE.BoxGeometry(14.4,13.6,14.4),texturedMat("metal",P.stone));
      keep.position.y=7.2; keep.castShadow=true; keep.receiveShadow=true; g.add(keep);
      const bat=new THREE.Mesh(new THREE.CylinderGeometry(7.5,8.4,2.2,4),texturedMat("metal",P.stone));
      bat.rotation.y=Math.PI/4; bat.position.y=1.4; bat.castShadow=true; g.add(bat);   // the plinth batter
      // three SQUARE turrets and one ROUND one — §F.5's own detail, and it is what makes this
      // silhouette impossible to confuse with the Classical basilica or the age-5 civic block
      const T=[[-7.2,-7.2,0],[7.2,-7.2,0],[-7.2,7.2,0],[7.2,7.2,1]];
      for(const [px,pz,round] of T){
        const tw=round
          ? new THREE.Mesh(new THREE.CylinderGeometry(2.3,2.5,17.4,10),texturedMat("metal",P.stone))
          : new THREE.Mesh(new THREE.BoxGeometry(4.0,16.2,4.0),texturedMat("metal",P.stone));
        tw.position.set(px,round?8.7:8.1,pz); tw.castShadow=true; tw.receiveShadow=true; g.add(tw);
        if(round)for(let i=0;i<7;i++){const sl=box(0.22,0.9,0.3,P.dark); sl.castShadow=false;
          sl.position.set(px+Math.sin(i*1.1)*2.4,3.0+i*1.9,pz+Math.cos(i*1.1)*2.4); sl.rotation.y=-i*1.1; g.add(sl);}
        const cap=new THREE.Mesh(new THREE.ConeGeometry(round?3.1:3.3,round?4.6:4.2,round?10:4),
          texturedMat(P.roofPat,P.roof));
        cap.castShadow=true; cap.receiveShadow=true; if(!round)cap.rotation.y=Math.PI/4;
        cap.position.set(px,(round?17.4:16.2)+ (round?2.3:2.1),pz); g.add(cap);
      }
      const mach=box(15.6,0.8,15.6,STONEDK); mach.castShadow=false; mach.position.y=13.4; g.add(mach);
      for(let i=0;i<5;i++)for(const s of [-1,1]){
        const cren=box(1.5,1.4,1.5,P.stone); cren.castShadow=false;
        cren.position.set(-4.6+i*2.3,14.5,s*7.0); g.add(cren);
        const cr2=box(1.5,1.4,1.5,P.stone); cr2.castShadow=false;
        cr2.position.set(s*7.0,14.5,-4.6+i*2.3); g.add(cr2);}
      for(const sy of [6.4,10.2])for(const sx of [-3.2,3.2]){    // small high windows, and only high
        const w=box(0.7,1.5,0.3,P.dark); w.castShadow=false; w.position.set(sx,sy,7.25); g.add(w);}
      // THE FOREBUILDING: the entrance is at first-floor level and this is the box that covers the
      // stair up to it. Nothing else in the set has a staircase hidden inside a smaller building.
      const fore=new THREE.Mesh(new THREE.BoxGeometry(5.4,8.6,5.0),texturedMat("metal",P.stone));
      fore.position.set(0,4.3,9.4); fore.castShadow=true; fore.receiveShadow=true; g.add(fore);
      const fcap=new THREE.Mesh(hipGeo(6.4,6.0,2.4,1.6),texturedMat(P.roofPat,P.roof));
      fcap.castShadow=true; fcap.position.set(0,8.6,9.4); g.add(fcap);
      for(let i=0;i<6;i++){const st=box(4.4,0.5,1.1,P.stone); st.castShadow=false;
        st.position.set(0,0.9+i*0.62,12.6-i*0.55); g.add(st);}
      archDoor(g,0,11.95,2.4,3.2,P.timber);
      const ban=box(2.6,3.4,0.14,tc); ban.castShadow=false; ban.position.set(0,10.4,7.35); g.add(ban);
      flagPole(g,-7.2,19.4,-7.2,4.0,tc,2.6,1.4);
    }else{
      // §F.6 THE GEORGIAN CIVIC BLOCK on Palladian proportion: symmetrical brick and render, EVEN
      // ROWS of sash windows, a dentil cornice, a central pedimented doorcase, PAIRED CHIMNEYS at
      // the gable ends, and hipped COPPER — the one roof in the age that is not slate, because
      // §F.6 keeps verdigris for the civic pair and the last pass's mistake was spending it on all
      // eighteen buildings and turning the whole age teal.
      const bb=new THREE.Mesh(new THREE.BoxGeometry(18.2,1.4,13.4),texturedMat("metal",BRICK));
      bb.position.y=0.7; bb.castShadow=true; g.add(bb);
      const main=new THREE.Mesh(new THREE.BoxGeometry(17,7.6,12),aWall(5));
      main.position.y=5.2; main.castShadow=true; main.receiveShadow=true; g.add(main);
      for(const s of [-1,1]){       // brick quoins at the corners, and brick is the age's second colour
        const q=new THREE.Mesh(new THREE.BoxGeometry(0.7,7.6,0.7),texturedMat("metal",BRICK));
        q.position.set(s*8.4,5.2,5.7); q.castShadow=false; g.add(q);}
      winGrid(g,5,2,4.2,3.0,6.07,P.dark,P.stone);
      const cor=box(18.0,0.6,13.0,P.wall); cor.castShadow=false; cor.position.y=9.3; g.add(cor);
      for(let i=0;i<16;i++){const den=box(0.34,0.34,0.3,P.stone); den.castShadow=false;
        den.position.set(-8.0+i*1.07,8.85,6.4); g.add(den);}                 // the dentil course
      const apex=ageRoof(g,5,18.0,13.0,9.6,type,{tc});
      // the central pedimented doorcase: four columns, an entablature and a triangle, dead centre
      const port=box(7.2,0.5,3.4,P.stone); port.castShadow=false; port.position.set(0,0.9,7.4); g.add(port);
      for(const px of [-2.7,-0.9,0.9,2.7])colAt(g,px,7.2,5.4,0.42,5);
      const pent=box(7.8,0.7,3.0,P.wall); pent.castShadow=false; pent.position.set(0,6.3,7.2); g.add(pent);
      const ped=pedTri(7.8,1.9,P.wall); ped.position.set(0,7.6,7.2); g.add(ped);
      const door=box(2.2,3.4,0.24,P.dark); door.castShadow=false; door.position.set(0,2.0,6.1); g.add(door);
      const fan=cyl(1.25,1.25,0.16,P.stone,10); fan.rotation.x=Math.PI/2; fan.castShadow=false;
      fan.position.set(0,3.8,6.08); g.add(fan);
      // PAIRED chimneys at the GABLE ENDS — §F.6 says paired, and a pair reads as deliberate where
      // a single one reads as a cottage
      for(const s of [-1,1])for(const o of [-1.7,1.7]){
        const ch=new THREE.Mesh(new THREE.BoxGeometry(1.0,3.0,1.0),texturedMat("metal",BRICK));
        ch.position.set(s*7.2,apex-1.2,o); ch.castShadow=true; g.add(ch);
        const cp=box(1.3,0.3,1.3,P.dark); cp.castShadow=false; cp.position.set(s*7.2,apex+0.45,o); g.add(cp);
      }
      flagPole(g,-9.0,1.4,7.0,7.4,tc,2.6,1.4);
    }
  }else if(type==="house"){
    // ============================ THE HOUSE, AGES §F.1-§F.6 ============================
    // Three or four of these stand in every town, so the house IS the town's roofline and it is
    // the building §H/A5 is really measuring. Each age gets the form §F names and nothing else:
    //   0 CONICAL THATCH at 45°, no smoke hole (smoke filters through the thatch)
    //   1 FLAT-ROOFED CUBIC MASSING with a STEPPED roofline — the deliberate opposite of the cone
    //   2 rooms round a COURTYARD, blank windowless walls to the street
    //   3 the DOMUS: atrium with a COMPLUVIUM opening over an impluvium basin
    //   4 JETTYING: each story cantilevers out past the one beneath on a bressummer beam
    //   5 symmetrical about a central door, sash bays, chimneys at BOTH gable ends
    if(age===0){
      const berm=cyl(4.3,4.7,0.7,P.dark,10); berm.position.y=0.3; berm.receiveShadow=true; g.add(berm);
      const wall=new THREE.Mesh(panelUV(new THREE.CylinderGeometry(3.3,3.45,2.7,10),10),aWall(0));
      wall.position.y=1.95; wall.castShadow=true; wall.receiveShadow=true; g.add(wall);
      for(let i=1;i<10;i++){const a=i*Math.PI/5;   // the timber post ring the daub is packed into
        const up=cyl(0.17,0.2,2.6,P.timber,5); up.castShadow=false;
        up.position.set(Math.sin(a)*3.48,1.95,Math.cos(a)*3.48); g.add(up);}
      // §F.1: NO SMOKE HOLE — smoke filters through the thatch — so the apex is closed and the
      // roof is a clean 45° cone. That absence is the detail, and it is why the age-0 town centre
      // is the only Stone building with a vent.
      ageRoof(g,0,6.9,6.9,3.3,type,{});
      const mouth=box(1.7,2.1,0.35,P.dark); mouth.castShadow=false; mouth.position.set(0,1.5,3.3); g.add(mouth);
      const flap=box(1.4,1.8,0.14,tc); flap.castShadow=false; flap.rotation.x=-0.15; flap.position.set(0,1.4,3.5); g.add(flap);
    }else if(age===1){
      // §F.2 FLAT-ROOFED CUBIC MASSING WITH A STEPPED ROOFLINE. Two boxes at two heights, and the
      // step between them is the whole silhouette — a single flat box is a crate.
      const soc=new THREE.Mesh(new THREE.BoxGeometry(7.4,0.6,7.0),texturedMat("metal",P.stone));
      soc.position.y=0.3; soc.castShadow=true; g.add(soc);
      const lo=new THREE.Mesh(new THREE.BoxGeometry(6.8,3.2,6.4),aWall(1));
      lo.position.y=2.2; lo.castShadow=true; lo.receiveShadow=true; g.add(lo);
      ageRoof(g,1,6.8,6.4,3.8,type,{tc});
      const hi=new THREE.Mesh(new THREE.BoxGeometry(4.2,2.6,4.2),aWall(1));   // the light-well storey
      hi.position.set((V&1)?-1.1:1.1,6.4,-1.0); hi.castShadow=true; hi.receiveShadow=true; g.add(hi);
      const hd=box(4.6,0.34,4.6,P.roof); hd.castShadow=false; hd.position.set((V&1)?-1.1:1.1,7.85,-1.0); g.add(hd);
      const hc=box(4.7,0.5,4.7,P.dark); hc.castShadow=false; hc.position.set((V&1)?-1.1:1.1,7.5,-1.0); g.add(hc);
      for(let i=0;i<3;i++){const viga=cyl(0.14,0.14,0.7,P.timber,5); viga.rotation.x=Math.PI/2;
        viga.castShadow=false; viga.position.set(-1.6+i*1.6,3.4,3.4); g.add(viga);}
      const door=box(1.5,2.2,0.16,P.dark); door.castShadow=false; door.position.set(-1.2,1.7,3.25); g.add(door);
      const awn=box(2.2,0.12,1.1,tc); awn.castShadow=false; awn.rotation.x=0.25; awn.position.set(-1.2,3.1,3.7); g.add(awn);
      const win=box(0.9,0.9,0.14,P.dark); win.castShadow=false; win.position.set(1.6,2.7,3.24); g.add(win);
    }else if(age===2){
      // §F.3 THE COURTYARD BOX with BLANK WINDOWLESS WALLS TO THE STREET, roofs used as living
      // space. §F.3 is explicit: pick courtyard-box OR thatch roundhouse per faction skin, NEVER
      // MIX THE TWO IN ONE SETTLEMENT — so this is the courtyard box for every Iron town, and the
      // roundhouse stays in age 0 where the cone belongs.
      const foot=new THREE.Mesh(new THREE.BoxGeometry(7.4,0.6,7.4),texturedMat("metal",P.stone));
      foot.position.y=0.3; foot.castShadow=true; g.add(foot);
      for(const [rx,rz,rw,rd] of [[0,-2.3,6.8,2.2],[-2.3,0.9,2.2,4.4],[2.3,0.9,2.2,4.4]]){
        const rm=new THREE.Mesh(new THREE.BoxGeometry(rw,3.4,rd),aWall(2));
        rm.position.set(rx,2.3,rz); rm.castShadow=true; rm.receiveShadow=true; g.add(rm);
        // THREE rooms, THREE roofs, and all three were drawn at (0,0) — stacked on each other
        // in the middle of the courtyard while the rooms stood at +/-2.3. That is why the door
        // and the disc read as floating outside the house: they are on a room the roof left.
        const rsub=new THREE.Group(); rsub.position.set(rx,0,rz); g.add(rsub);
        ageRoof(rsub,2,rw,rd,4.0,type,{tc:(rz<0?tc:undefined),long:rw>rd?"x":"z",eave:0.10});
      }
      const yard=box(4.4,0.24,4.4,_dk(P.stone,0.14)); yard.castShadow=false; yard.position.set(0,0.72,0.9); g.add(yard);
      // THE EXPOSED FRAME ON THE BLANK STREET WALL — and it was never on the street wall. At
      // z=-1.25 the post is inside the solid (the street range covers z<=-1.2, the wing covers
      // z>=-1.3), and the one face of it that ISN'T buried lands on |x| = 3.2 + 0.4/2 = 3.4 —
      // the SAME plane as the street range's side face (0 + 6.8/2 = 3.4) AND the wing's side
      // face (2.3 + 2.2/2 = 3.4). Three co-facing quads on one plane is not interpenetration,
      // it is z-fighting: 0.4 x 3.4 = 1.36 of timber strobing against mudbrick down each side
      // elevation. Put it where the comment always said it goes, ON the blank street face, the
      // plane z = -2.3 - 2.2/2 = -3.4, biting a quarter of its own depth in the way the age-3
      // pilaster does (0.06 of 0.24):
      //   z = -3.4 - 0.4/2 + 0.1 = -3.5  -> spans -3.7..-3.3, 0.3 proud, and the rail at -3.45
      //                                     now reads as let in between the two posts
      // and inset one full post width from the corner so no face touches |x| = 3.4:
      //   x = +/-(3.4 - 0.4) = +/-3.0    -> spans 2.8..3.2, clear of the wall's side plane
      // 3.4 tall centred at 2.3 is unchanged: footing top 0.6 to wall head 4.0, eave over it.
      for(const sx of [-1,1]){
        const post=new THREE.Mesh(new THREE.BoxGeometry(0.4,3.4,0.4),texturedMat("wood",P.timber));
        post.position.set(sx*3.0,2.3,-3.5); g.add(post);}
      const rail=box(6.9,0.3,0.2,P.timber); rail.castShadow=false; rail.position.set(0,3.4,-3.45); g.add(rail);
      const door=box(1.5,2.2,0.2,P.dark); door.castShadow=false; door.position.set(2.3,1.7,3.16); g.add(door);
      const sh=cyl(0.55,0.55,0.13,tc,9); sh.rotation.x=Math.PI/2; sh.castShadow=false;
      sh.position.set(((V>>2)&1)?2.3:-2.3,2.6,3.165); g.add(sh);
    }else if(age===3){
      // §F.4 THE DOMUS, and the detail it names is the ATRIUM: a COMPLUVIUM roof opening over an
      // IMPLUVIUM basin. That is a hole cut in the middle of a roof with a pool under it, which is
      // a silhouette nothing else in the set has, and it costs a ring of four low roof slabs.
      const pod=new THREE.Mesh(new THREE.BoxGeometry(7.8,0.7,7.4),texturedMat("metal",P.stone));
      pod.position.y=0.35; pod.castShadow=true; g.add(pod);
      const main=new THREE.Mesh(new THREE.BoxGeometry(7.0,3.6,6.6),aWall(3));
      main.position.y=2.5; main.castShadow=true; main.receiveShadow=true; g.add(main);
      const imp=box(2.0,0.2,2.0,0x5a7f86); imp.castShadow=false; imp.position.set(0,4.4,-0.2); g.add(imp);
      for(const [ox,oz,ow,od] of [[0,-2.5,7.6,2.4],[0,2.5,7.6,2.4],[-2.9,0,1.9,3.0],[2.9,0,1.9,3.0]]){
        // the four slopes of the atrium roof, all draining INWARD to the compluvium
        const sl=new THREE.Mesh(new THREE.BoxGeometry(ow,0.34,od),texturedMat(P.roofPat,P.roof));
        sl.castShadow=true; sl.receiveShadow=true;
        if(ow>od)sl.rotation.x=(oz<0?-1:1)*0.30; else sl.rotation.z=(ox<0?1:-1)*0.30;
        sl.position.set(ox,4.5,oz); g.add(sl);
      }
      const frieze=box(7.8,0.28,7.4,tc); frieze.castShadow=false; frieze.position.y=4.2; g.add(frieze);
      for(const s of [-1,1]){const pil=box(0.5,3.6,0.24,P.stone); pil.castShadow=false; pil.position.set(s*2.6,2.5,3.36); g.add(pil);}
      const door=box(1.6,2.5,0.18,P.dark); door.castShadow=false; door.position.set(0,1.95,3.34); g.add(door);
      const cur=box(1.8,0.5,0.1,tc); cur.castShadow=false; cur.position.set(0,3.45,3.4); g.add(cur);
      const win=box(0.9,0.9,0.12,P.dark); win.castShadow=false; win.position.set(((V>>4)&1)?-2.4:2.4,3.1,3.34); g.add(win);
    }else if(age===4){
      // §F.5 JETTYING — "the upper floor's joists cantilever out past the wall below on a
      // bressummer beam, with dragon beams turning the overhang at the corners, so each story
      // projects further than the one beneath. That stepped overhang is one of the most readable
      // silhouettes in the entire game." Two jetties, so the profile steps TWICE, and the roof is
      // the age's 50° gable standing on the widest storey.
      const pl=new THREE.Mesh(new THREE.BoxGeometry(6.4,0.8,6.2),texturedMat("metal",P.stone));
      pl.position.y=0.4; pl.castShadow=true; g.add(pl);
      const g0=new THREE.Mesh(new THREE.BoxGeometry(5.6,3.0,5.4),aWall(4));
      g0.position.y=2.3; g0.castShadow=true; g0.receiveShadow=true; g.add(g0);
      const bres=new THREE.Mesh(new THREE.BoxGeometry(6.6,0.45,6.4),texturedMat("wood",P.timber));
      bres.castShadow=true; bres.position.y=3.95; g.add(bres);       // THE BRESSUMMER
      const g1=new THREE.Mesh(new THREE.BoxGeometry(6.5,2.9,6.3),aWall(4));
      g1.position.y=5.6; g1.castShadow=true; g1.receiveShadow=true; g.add(g1);
      const bres2=new THREE.Mesh(new THREE.BoxGeometry(7.4,0.42,7.2),texturedMat("wood",P.timber));
      bres2.castShadow=true; bres2.position.y=7.2; g.add(bres2);
      const g2=new THREE.Mesh(new THREE.BoxGeometry(7.3,2.2,7.1),aWall(4));
      g2.position.y=8.4; g2.castShadow=true; g2.receiveShadow=true; g.add(g2);
      for(const sx of [-1,1])for(const sz of [-1,1]){                // the dragon beams at the corners
        const dr=box(0.36,0.36,1.5,P.timber); dr.castShadow=false; dr.rotation.y=sx*sz*0.78;
        dr.position.set(sx*3.1,7.15,sz*3.0); g.add(dr);}
      for(const [yy,ww] of [[2.3,5.6],[5.6,6.5],[8.4,7.3]]){         // the box frame on every storey
        for(const sx of [-1,1]){const post=box(0.36,yy===8.4?2.2:yy===5.6?2.9:3.0,0.36,P.timber);
          post.castShadow=false; post.position.set(sx*(ww/2-0.2),yy,(ww===7.3?3.35:ww===6.5?2.95:2.5)); g.add(post);}
        const br=box(0.26,1.7,0.14,P.timber); br.castShadow=false; br.rotation.z=0.52;
        br.position.set(-ww*0.24,yy-0.2,(ww===7.3?3.42:ww===6.5?3.02:2.58)); g.add(br);
        const br2=box(0.26,1.7,0.14,P.timber); br2.castShadow=false; br2.rotation.z=-0.52;
        br2.position.set(ww*0.24,yy-0.2,(ww===7.3?3.42:ww===6.5?3.02:2.58)); g.add(br2);
      }
      const apex=ageRoof(g,4,7.3,7.1,9.5,type,{tc});
      const cx4=((V>>4)&1)?-2.2:2.2;                                 // the tall chimney, either end
      const chim=new THREE.Mesh(new THREE.BoxGeometry(1.0,4.4,1.0),texturedMat("metal",P.stone));
      chim.position.set(cx4,apex-1.0,-1.6); chim.castShadow=true; g.add(chim);
      const cap=box(1.35,0.34,1.35,STONEDK); cap.castShadow=false; cap.position.set(cx4,apex+1.35,-1.6); g.add(cap);
      const shC=[0xa8402e,0x3a5a4a,0x3A5A7A,0x7a4a2e][V%4];          // painted shutters, four colours
      for(const wy of [5.6,8.4]){const win=box(0.9,1.0,0.12,P.dark); win.castShadow=false;
        win.position.set(0,wy,(wy===8.4?3.6:3.2)); g.add(win);
        for(const s of [-1,1]){const sh=box(0.38,1.0,0.1,shC); sh.castShadow=false;
          sh.position.set(s*0.72,wy,(wy===8.4?3.6:3.2)); g.add(sh);}}
      archDoor(g,-1.3,2.75,1.4,2.2,P.timber);
      const ban=box(0.9,1.3,0.08,tc); ban.castShadow=false; ban.position.set(2.3,2.6,2.78); g.add(ban);
    }else{
      // §F.6 — modest classical doorcase, sash windows in regular bays, dentil cornice, chimneys
      // at BOTH gable ends, hipped SLATE. Not copper: the house is domestic and §F.6 keeps
      // verdigris for the civic pair. Brick or clapboard by plot, which is free variety off bHash.
      const brickHouse=(V>>5)&1;
      const bb=new THREE.Mesh(new THREE.BoxGeometry(7.2,0.8,6.6),texturedMat("metal",BRICK));
      bb.position.y=0.4; bb.castShadow=true; g.add(bb);
      const main=new THREE.Mesh(new THREE.BoxGeometry(6.6,5.0,6.0),aWall(5));
      main.position.y=3.3; main.castShadow=true; main.receiveShadow=true; g.add(main);
      for(const s of [-1,1]){const q=box(0.5,5.0,0.5,BRICK); q.castShadow=false;
        q.position.set(s*3.25,3.3,2.95); g.add(q);}
      if(brickHouse)for(const wy of [2.6,4.7]){          // §F.6's "brick OR clapboard": the brick
        const bd=box(6.8,0.3,6.2,BRICK); bd.castShadow=false; bd.position.y=wy; g.add(bd);}
                                                        // variant keeps its red as string courses
      const cor=box(7.2,0.42,6.6,P.wall); cor.castShadow=false; cor.position.y=5.95; g.add(cor);
      for(let i=0;i<7;i++){const den=box(0.3,0.28,0.26,P.stone); den.castShadow=false;
        den.position.set(-2.7+i*0.9,5.62,3.4); g.add(den);}
      const apex=ageRoof(g,5,7.2,6.6,6.2,type,{tc});
      winGrid(g,2,2,2.6,2.1,3.07,P.dark,P.stone);
      const door=box(1.4,2.4,0.16,[0x2e4a6e,0x6e2e2e,0x2a3a2a,0x1e1a16][V%4]);
      door.castShadow=false; door.position.set(0,2.0,3.06); g.add(door);
      const dcase=box(2.0,0.3,0.22,P.wall); dcase.castShadow=false; dcase.position.set(0,3.45,3.1); g.add(dcase);
      const fan=cyl(0.75,0.75,0.12,P.stone,10); fan.rotation.x=Math.PI/2; fan.castShadow=false;
      fan.position.set(0,3.2,3.05); g.add(fan);
      for(const s of [-1,1]){                                        // chimneys at BOTH gable ends
        const ch=new THREE.Mesh(new THREE.BoxGeometry(0.85,2.4,0.85),texturedMat("metal",BRICK));
        ch.position.set(s*2.5,apex-0.5,0); ch.castShadow=true; g.add(ch);
        const cp=box(1.1,0.28,1.1,P.dark); cp.castShadow=false; cp.position.set(s*2.5,apex+0.85,0); g.add(cp);}
      flagPole(g,((V>>4)&1)?-2.9:2.9,5.9,-2.4,2.2,tc,1.1,0.6);
    }
  }else if(type==="barracks"){
    // ======= THE BARRACKS, AGES §F.1-§F.6 — AND FOUR OF THE SIX ARE FLAGGED INVENTIONS =======
    // §F is honest about this one: there is no Neolithic barracks, no confirmed Iron Age barracks
    // and no medieval barracks (the word and the building appear in the late 17th c.). Gameplay
    // needs the slot, so each age gets the closest real precedent, and the thing that MOVES is how
    // ORGANISED the plan looks — which is also the true story:
    //   0-2 a bigger version of the age's own hall, dressed with weapon racks and a hearth
    //   3   the first genuinely purpose-built barracks in the tree: LONG ROWS OF PAIRED ROOMS,
    //       "organized and relentlessly repetitive", with the centurion's larger quarters closing
    //       each block
    //   4   a bailey hall and guardroom — trestle tables and straw pallets, deliberately domestic
    //   5   the first REAL barracks (Berwick, Hawksmoor, 1717-21): repeating company quarters
    //       round a CENTRAL PARADE SQUARE behind a formal pedimented gate. §F.6: "regular,
    //       institutional and rectilinear — the visual opposite of the medieval bailey hall."
    // §F.1 gives the Stone barracks a conical thatch, and a box under a cone reads as a mistake —
    // which is what John saw. The oval drum matches the hat, and the shields move with it.
    const shellTop=agedShell(g,age,tc,12.8,5.6,10,type,{oval:age===0});
    // where the front wall actually IS at the shields. On the box it is a flat plane at d/2 = 5.0;
    // on the ellipse (a 6.4, b 5.0) at x = 4.4 it is 5.0*sqrt(1-(4.4/6.4)^2) = 3.631, and a shield
    // left at 5.15 would hang 1.52 clear of the daub.
    const _fz=(age===0)?5.0*Math.sqrt(1-Math.pow(4.4/6.4,2)):5.0;
    if(age===3){ // the contubernium doors: eight men to a room, and you can count them
      for(let i=0;i<6;i++){
        const dr=box(1.0,2.4,0.2,P.dark); dr.castShadow=false; dr.position.set(-5.0+i*2.0,1.7,5.06); g.add(dr);
        const lin=box(1.3,0.24,0.24,P.stone); lin.castShadow=false; lin.position.set(-5.0+i*2.0,3.05,5.1); g.add(lin);
      }
      const cent=new THREE.Mesh(new THREE.BoxGeometry(4.0,6.6,4.4),aWall(3));  // the centurion's end
      cent.position.set(-8.0,4.3,2.6); cent.castShadow=true; cent.receiveShadow=true; g.add(cent);
      // the centurion's end block sits at (-8.0,2.6) — the largest displacement of the four.
      const csub=new THREE.Group(); csub.position.set(-8.0,0,2.6); g.add(csub);
      ageRoof(csub,3,4.0,4.4,7.6,type,{});
    }else if(age===5){
      // the parade square: two flanking ranges and a formal gate, all rectilinear
      for(const s of [-1,1]){
        const wing=new THREE.Mesh(new THREE.BoxGeometry(3.6,5.0,8.0),aWall(5));
        wing.position.set(s*8.0,3.3,4.4); wing.castShadow=true; wing.receiveShadow=true; g.add(wing);
        const wb=new THREE.Mesh(new THREE.BoxGeometry(3.9,0.9,8.3),texturedMat("metal",BRICK));
        wb.position.set(s*8.0,0.45,4.4); wb.castShadow=true; g.add(wb);
        const sub=new THREE.Group(); sub.position.set(s*8.0,0,4.4); g.add(sub);
        ageRoof(sub,5,3.6,8.0,5.8,type,{tc});
        for(let f=0;f<2;f++)for(let i=0;i<3;i++){
          const w=box(0.7,1.1,0.16,P.dark); w.castShadow=false;
          w.position.set(s*9.85,2.4+f*2.0,1.6+i*2.4); w.rotation.y=Math.PI/2; g.add(w);}
      }
      const sq=box(12.0,0.3,8.0,_dk(P.stone,0.10)); sq.castShadow=false; sq.receiveShadow=true;
      sq.position.set(0,0.16,7.0); g.add(sq);                       // the parade square itself
      for(const s of [-1,1]){const pr=new THREE.Mesh(new THREE.BoxGeometry(1.2,4.4,1.2),
        texturedMat("metal",P.stone)); pr.position.set(s*3.0,2.2,11.0); pr.castShadow=true; g.add(pr);}
      const glint=box(7.4,0.8,1.3,P.stone); glint.castShadow=true; glint.position.set(0,4.8,11.0); g.add(glint);
      const gped=pedTri(7.4,1.9,P.wall); gped.position.set(0,6.0,11.0); g.add(gped);
    }
    for(const wx of [-4.4,4.4]){ // round shields hung on the front wall
      const sh=cyl(1.1,1.1,0.16,wx<0?tc:0xdcdcdc,10); sh.rotation.x=Math.PI/2; sh.castShadow=false;
      sh.position.set(wx,3.8,_fz+0.15); g.add(sh);
      const boss=box(0.4,0.4,0.12,GOLD); boss.castShadow=false; boss.position.set(wx,3.8,_fz+0.28); g.add(boss);
    }
    if(age<=2)firePit(g,6.6,7.4);          // the outdoor hearth §F.1 asks for, and the drill yard's
    const rackA=box(0.3,2.6,0.3,0x6b4a2b); rackA.position.set(-7.2,1.3,2.8); g.add(rackA);
    const rackB=box(0.3,2.6,0.3,0x6b4a2b); rackB.position.set(-7.2,1.3,-2.8); g.add(rackB);
    const rackBar=box(0.26,0.26,6,0x6b4a2b); rackBar.castShadow=false; rackBar.position.set(-7.2,2.6,0); g.add(rackBar);
    for(let i=0;i<3;i++){ // spears leaning in the rack
      const sp=cyl(0.09,0.09,5.2,PLANK,5); sp.rotation.x=0.18; sp.castShadow=false; sp.position.set(-7.24,2.3,-1.8+i*1.8); g.add(sp);
      const st=cone(0.17,0.6,0xdcdcdc,4); st.rotation.x=0.18; st.castShadow=false; st.position.set(-7.24,5.15,-1.28+i*1.8); g.add(st); // seated on the LEANED tip: tip = base + R(0.18)·(0,2.9,0)
    }
  }else if(type==="blacksmith"){
    // ======= BLACKSMITH -> ARSENAL, AGES §F.3-§F.6 =======
    // §F is unusually precise about this one and the detail it names is the ANVIL:
    //   2 IRON      a clay-lined hearth with a bag bellows, a bloomery shaft furnace, and a PLAIN
    //               RECTANGULAR anvil block set in a stump — NO HORN, NO HARDY HOLE
    //   3 CLASSICAL "the Roman upgrade is SCALE AND ORGANIZATION, not technique": racks of
    //               identical finished pieces, a TILED roof instead of thatch — STILL no horn
    //   4 MEDIEVAL  A HORNED ANVIL. This is the age the horn and the hardy hole appear, so it is a
    //               genuine detail upgrade and it is worth modelling. Farrier's stand, horseshoes.
    //   5 ENLIGHT.  the ARSENAL: brick ranges round a courtyard inside a WALLED PRECINCT, a powder
    //               magazine, a formal gate with the royal arms, shot pyramids and gun carriages
    const horned=age>=4;
    if(age>=5){
      // THE ARSENAL. A defended enclosure, not a shop — the wall round it is the read.
      const yard=box(15.6,0.5,13.0,_dk(P.stone,0.10)); yard.castShadow=false; yard.receiveShadow=true;
      yard.position.y=0.25; g.add(yard);
      for(const [wx,wz,ww,wd] of [[0,-6.4,15.6,0.9],[-7.6,0,0.9,13.0],[7.6,0,0.9,13.0]]){
        const w=new THREE.Mesh(new THREE.BoxGeometry(ww,3.6,wd),texturedMat("metal",BRICK));
        w.position.set(wx,1.8,wz); w.castShadow=true; w.receiveShadow=true; g.add(w);
        const cap=box(ww+0.3,0.3,wd+0.3,P.stone); cap.castShadow=false; cap.position.set(wx,3.75,wz); g.add(cap);
      }
      const range=new THREE.Mesh(new THREE.BoxGeometry(11.0,4.6,5.0),aWall(5));
      range.position.set(0,2.8,-3.6); range.castShadow=true; range.receiveShadow=true; g.add(range);
      const rbase=new THREE.Mesh(new THREE.BoxGeometry(11.3,1.2,5.3),texturedMat("metal",BRICK));
      rbase.position.set(0,1.1,-3.6); rbase.castShadow=true; g.add(rbase);
      for(const s2 of [-1,1]){const q=box(0.6,4.6,0.6,BRICK); q.castShadow=false;
        q.position.set(s2*5.2,2.8,-1.2); g.add(q);}
      const sub=new THREE.Group(); sub.position.set(0,0,-3.6); g.add(sub);
      ageRoof(sub,5,11.0,5.0,5.1,type,{tc});
      winGrid(g,4,1,3.4,0,-1.03,P.dark,P.stone);
      // the POWDER MAGAZINE: thick, low, its own little vaulted roof, kept away from the workshops
      const mag=new THREE.Mesh(new THREE.BoxGeometry(3.6,2.8,3.2),texturedMat("metal",P.stone));
      mag.position.set(-5.2,1.9,2.2); mag.castShadow=true; g.add(mag);
      const mcap=new THREE.Mesh(hipGeo(4.4,4.0,1.5,1.0),texturedMat("wood",P.roof));
      mcap.castShadow=true; mcap.position.set(-5.2,3.3,2.2); g.add(mcap);
      // the FORMAL GATE with the royal arms carved above it
      for(const s of [-1,1]){const pr=new THREE.Mesh(new THREE.BoxGeometry(1.2,4.6,1.2),texturedMat("metal",P.stone));
        pr.position.set(s*2.6,2.3,6.4); pr.castShadow=true; g.add(pr);
        const fin=cone(0.7,0.9,P.stone,4); fin.castShadow=false; fin.position.set(s*2.6,5.05,6.4); g.add(fin);}
      const lint=box(6.4,0.8,1.3,P.stone); lint.castShadow=true; lint.position.set(0,5.0,6.4); g.add(lint);
      const arms=box(1.6,1.0,0.2,GOLD); arms.castShadow=false; arms.position.set(0,5.8,6.4); g.add(arms);
      const gate=box(3.6,3.4,0.24,P.dark); gate.castShadow=false; gate.position.set(0,1.7,6.4); g.add(gate);
      // SHOT PYRAMIDS and gun carriages under an open shed — the yard dressing §F.6 asks for
      for(const [sx,sz] of [[4.4,2.4],[5.8,0.6]]){
        for(let r2=0;r2<3;r2++)for(let i=0;i<3-r2;i++)for(let j=0;j<3-r2;j++){
          const b2=new THREE.Mesh(new THREE.SphereGeometry(0.24,5,4),plainMat(0x3A3A38));
          b2.castShadow=false; b2.position.set(sx+(i-(2-r2)/2)*0.48,0.75+r2*0.42,sz+(j-(2-r2)/2)*0.48); g.add(b2);}
      }
      const carr=box(2.2,0.5,1.4,P.timber); carr.castShadow=false; carr.position.set(3.0,1.0,3.8); g.add(carr);
      const barrel=cyl(0.34,0.4,2.6,0x8A6A3A,8); barrel.rotation.x=0.16; barrel.castShadow=false;
      barrel.position.set(3.0,1.5,3.8); g.add(barrel);
      for(const s of [-1,1]){const wh=cyl(0.6,0.6,0.2,P.timber,8); wh.rotation.z=Math.PI/2; wh.castShadow=false;
        wh.position.set(3.0+s*0.9,0.8,3.8); g.add(wh);}
      // TALL BRICK CHIMNEYS: the age's industry, and the tallest thing on the precinct
      for(const cx of [-3.0,-1.2]){
        const ch=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.66,7.4,8),texturedMat("metal",BRICK));
        ch.position.set(cx,4.6,-4.6); ch.castShadow=true; g.add(ch);
        const cp=cyl(0.8,0.72,0.4,P.dark,8); cp.castShadow=false; cp.position.set(cx,8.5,-4.6); g.add(cp);
      }
      flagPole(g,-6.4,0.5,5.6,5.2,tc,2.0,1.1);
    }else{
      const slab=box(10.5,0.7,9,P.stone); slab.position.y=0.35; slab.castShadow=false; slab.receiveShadow=true; g.add(slab);
      const hall=new THREE.Mesh(new THREE.BoxGeometry(7.6,3.6,6.4),aWall(age));
      hall.position.set(-1,2.5,0); hall.castShadow=true; hall.receiveShadow=true; g.add(hall);
      const rg=new THREE.Group(); rg.position.set(-1,0,0); g.add(rg);
      ageRoof(rg,age,6.4,8.4,4.3,type,{tc,long:"x"});
      // the flue climbs with the age — height above the roofline is a silhouette event, a
      // different brick texture is not (AD §5.7)
      const chimH=age<=2?5.0:age===3?5.8:6.6;
      const chim=new THREE.Mesh(new THREE.BoxGeometry(1.3,chimH,1.3),texturedMat("metal",age>=3?P.stone:P.wall));
      chim.position.set(-3.2,chimH/2+0.7,-1.6); chim.castShadow=true; g.add(chim);
      const chimCap=box(1.7,0.3,1.7,P.dark); chimCap.castShadow=false; chimCap.position.set(-3.2,chimH+1,-1.6); g.add(chimCap);
      if(age<=2){ // the BLOOMERY SHAFT FURNACE — a separate clay stack, and the iron age's own tell
        const bl=new THREE.Mesh(new THREE.CylinderGeometry(0.7,1.1,3.0,8),texturedMat(P.pat,0x7A4A32));
        bl.position.set(-5.4,1.9,2.6); bl.castShadow=true; g.add(bl);
        const bmouth=box(0.6,0.7,0.3,P.dark); bmouth.castShadow=false; bmouth.position.set(-5.4,1.1,3.6); g.add(bmouth);
      }
      for(const pz of [-2.6,2.6]){const post=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.24,3.2,6),
        texturedMat("wood",P.timber)); post.position.set(3.6,1.6,pz); post.castShadow=true; g.add(post);}
      const porch=box(3.4,0.2,6.6,P.timber); porch.castShadow=false; porch.position.set(3.3,3.3,0); porch.rotation.z=0.12; g.add(porch);
      const anvBase=cyl(0.55,0.7,0.9,P.timber,7); anvBase.castShadow=false; anvBase.position.set(3.1,1.15,0.9); g.add(anvBase);
      const anvil=box(1.5,0.5,0.55,STONEDK); anvil.castShadow=false; anvil.position.set(3.1,1.85,0.9); g.add(anvil);
      if(horned){ // THE HORN, and the hardy hole beside it. Medieval only — §F.5 is explicit that
        // this is the age the refinement appears, and §F.3/§F.4 are equally explicit that the
        // ancient anvil is a plain rectangular block and must stay one.
        const horn=cone(0.24,0.8,STONEDK,5); horn.rotation.z=-Math.PI/2; horn.castShadow=false;
        horn.position.set(4.15,1.85,0.9); g.add(horn);
        const hardy=box(0.18,0.14,0.18,P.dark); hardy.castShadow=false; hardy.position.set(2.6,2.12,0.9); g.add(hardy);
        // the farrier's hoof stand and the horseshoes hung outside
        const stand=cyl(0.14,0.2,0.9,P.timber,5); stand.castShadow=false; stand.position.set(4.6,1.15,-1.6); g.add(stand);
        for(let i=0;i<3;i++){const sh=new THREE.Mesh(new THREE.TorusGeometry(0.24,0.07,4,8,Math.PI*1.4),
          plainMat(STONEDK)); sh.castShadow=false; sh.position.set(1.6,3.0-i*0.5,3.28); g.add(sh);}
      }else{ // the bag bellows: two boards and a hide bag, feeding the clay tuyere
        const bel=box(1.1,0.5,0.8,0xa8906b); bel.castShadow=false; bel.position.set(1.2,1.4,-2.2); g.add(bel);
        const tuy=cyl(0.12,0.16,1.1,0x7A4A32,6); tuy.rotation.z=Math.PI/2-0.3; tuy.castShadow=false;
        tuy.position.set(0.2,1.5,-2.2); g.add(tuy);
      }
      if(age>=3)for(let i=0;i<4;i++){ // §F.4's own upgrade: RACKS OF IDENTICAL FINISHED PIECES
        const bl2=box(0.16,1.5,0.4,STONEDK); bl2.castShadow=false; bl2.position.set(1.6+i*0.42,2.4,-3.0); g.add(bl2);}
      const barrel=cyl(0.6,0.68,1.1,P.timber,9); barrel.castShadow=false; barrel.position.set(3.2,1.25,-1.7); g.add(barrel);
      const hearth=new THREE.Mesh(new THREE.PlaneGeometry(1.6,1.1),
        new THREE.MeshBasicMaterial({color:0xff7a2f})); // the fire never sleeps
      hearth.position.set(-1,1.6,3.22); hearth.castShadow=false; g.add(hearth);
      const hammer=box(0.16,1,0.16,PLANK); hammer.castShadow=false; hammer.rotation.z=0.9; hammer.position.set(2.5,2.2,0.9); g.add(hammer);
      const hhead=box(0.5,0.3,0.3,STONEDK); hhead.castShadow=false; hhead.position.set(2.15,2.55,0.9); g.add(hhead);
      flagPole(g,-4.4,0.7,3.6,4.6,tc,1.8,1);
    }
  }else if(type==="farm"){
    const plot=box(18.8,0.34,18.8,0x6b4a2b); plot.position.y=0.17; plot.castShadow=false; plot.receiveShadow=true; g.add(plot);
    for(let i=0;i<5;i++){const row=box(17.2,0.3,1.8,0x7fae54); row.castShadow=false; row.position.set(0,0.42,-6.8+i*3.4); g.add(row);}
    flagPole(g,8.4,0.3,8.4,3,tc,1.4,0.8);
    // THE BARN, FROM THE BRONZE AGE ON, AND IT IS WHY THE FARM WAS THE FLATTEST BUILDING IN THE
    // SET. A farm was a flat plot with a fence on it: no roof, so no roofline, so nothing for §H/A5
    // to read and nothing for §5.5's roof/wall break to happen on. Every age past 0 has a barn in
    // §F — the Bronze threshing floor, the Iron enclosed field's ard shed, the Classical villa
    // rustica's PARS RUSTICA, the medieval timber barn and byre, and §F.6's THRESHING BARN with
    // opposed wagon doors aligned to the prevailing wind. It takes the age's own shell and its own
    // roof, so a farm now ages with the town instead of sitting outside the ladder.
    if(age>=1){
      const bg=new THREE.Group(); bg.position.set(-2.6,0,-7.4); g.add(bg);
      const bw=8.6, bd=4.6, bh=age===4?3.0:3.6;
      const foot=new THREE.Mesh(new THREE.BoxGeometry(bw+0.6,BPAL[age].base*2||0.5,bd+0.6),
        texturedMat("metal",P.stone));
      foot.position.y=(BPAL[age].base*2||0.5)/2; foot.castShadow=true; bg.add(foot);
      const barn=new THREE.Mesh(new THREE.BoxGeometry(bw,bh,bd),aWall(age));
      barn.position.y=bh/2+(BPAL[age].base*2||0.5); barn.castShadow=true; barn.receiveShadow=true; bg.add(barn);
      if(age===4)for(const sx of [-1,0,1]){   // the medieval barn is a TIMBER frame, not a wall
        const post=new THREE.Mesh(new THREE.BoxGeometry(0.4,bh,0.4),texturedMat("wood",P.timber));
        post.position.set(sx*(bw/2-0.2),bh/2+0.8,bd/2-0.2); bg.add(post);}
      // §F.5 gives the medieval farm "thatch/slate" and this takes the thatch, on purpose. Every
      // other Medieval roof in the set is blue-grey slate and every age-5 domestic roof is a
      // darker blue-grey slate — §F.0 authors them 9.2 ΔE00 apart, which is under §H/A5's floor of
      // 12 — so the two ages' ROOFLINES rhyme unless something in one of them is warm. §F.5 offers
      // exactly one warm roof and this is it.
      const bapex=ageRoof(bg,age,bw,bd,bh+(BPAL[age].base*2||0.5),type,
        {tc,long:"x",roofC:age===4?THATCH:undefined,pat:age===4?"hide":undefined});
      // the OPPOSED WAGON DOORS: a cart drives straight in and the draught winnows the grain on
      // the threshing floor. §F.5 gives them to the tithe barn and §F.6 to the threshing barn, and
      // they are the one farm detail that reads as a door and not as a shed.
      for(const sz of [-1,1]){
        const dr=box(2.6,bh*0.82,0.3,P.dark); dr.castShadow=false;
        dr.position.set(0,bh*0.41+(BPAL[age].base*2||0.5),sz*(bd/2+0.06)); bg.add(dr);
      }
      if(age>=5){ // §F.6's HORSE-GIN ROUNDHOUSE at the barn end: Meikle's 1786 threshing machine
        const gin=new THREE.Mesh(new THREE.CylinderGeometry(2.2,2.4,2.2,10),texturedMat("metal",BRICK));
        gin.position.set(bw/2+2.0,1.1,0); gin.castShadow=true; bg.add(gin);
        const gcap=new THREE.Mesh(new THREE.ConeGeometry(2.9,1.5,10),texturedMat(P.roofPat,P.roof));
        gcap.castShadow=true; gcap.position.set(bw/2+2.0,2.95,0); bg.add(gcap);
      }
      if(age===4){ // §F.5's DOVECOTE, and the granary raised on staddle stones beside it
        const dv=new THREE.Mesh(new THREE.BoxGeometry(2.0,3.2,2.0),aWall(4));
        dv.position.set(-bw/2-2.4,2.4,1.2); dv.castShadow=true; bg.add(dv);
        const dcap=new THREE.Mesh(new THREE.ConeGeometry(1.8,1.9,4),texturedMat(P.roofPat,P.roof));
        dcap.rotation.y=Math.PI/4; dcap.castShadow=true; dcap.position.set(-bw/2-2.4,4.9,1.2); bg.add(dcap);
        for(let i=0;i<4;i++){const hole=box(0.26,0.3,0.14,P.dark); hole.castShadow=false;
          hole.position.set(-bw/2-2.9+i*0.34,3.4,2.22); bg.add(hole);}
      }
    }
    if(age===0){ // bone fence posts and a hide-drying rack
      for(let i=0;i<3;i++){const bp=cyl(0.14,0.18,1.6,BONE,5); bp.castShadow=false; bp.position.set(-8.6,1.1,-5+i*5); g.add(bp);}
      for(const px of [-4,-1]){const rp=cyl(0.12,0.14,2.4,PLANK,5); rp.castShadow=false; rp.position.set(px,1.4,-8.4); g.add(rp);}
      const rb=box(3.6,0.14,0.14,PLANK); rb.castShadow=false; rb.position.set(-2.5,2.5,-8.4); g.add(rb);
      const pelt=box(2.6,1.5,0.1,0xa8906b); pelt.castShadow=false; pelt.position.set(-2.5,1.8,-8.4); g.add(pelt);
    }else if(age===1){ // a shaduf draws the water
      const sp=cyl(0.16,0.2,3,PLANK,5); sp.castShadow=false; sp.position.set(-8,1.7,-7.6); g.add(sp);
      const beam=box(5,0.2,0.2,0x6b4a2b); beam.rotation.z=0.45; beam.castShadow=false; beam.position.set(-7,3.4,-7.6); g.add(beam);
      const cw=box(0.8,0.8,0.8,0x8a8274); cw.castShadow=false; cw.position.set(-9.2,2.5,-7.6); g.add(cw);
      const rope=cyl(0.05,0.05,1.8,0x9a8a6a,4); rope.castShadow=false; rope.position.set(-4.8,3.4,-7.6); g.add(rope);
      const buck=box(0.7,0.5,0.7,PLANK); buck.castShadow=false; buck.position.set(-4.8,2.4,-7.6); g.add(buck);
      for(const s of [-1,1]){const mud=box(0.6,0.7,17,P.stone); mud.castShadow=false; mud.position.set(s*9.2,0.35,0); g.add(mud);}
    }else if(age===2){ // wattle fence + scarecrow
      for(let i=0;i<4;i++){const fp=cyl(0.11,0.13,1.5,0x6b4a2b,5); fp.castShadow=false; fp.position.set(-8.6,1,-6+i*4); g.add(fp);}
      for(const fy of [0.9,1.5]){const fr=box(0.14,0.14,12.6,PLANK); fr.castShadow=false; fr.position.set(-8.6,fy,0); g.add(fr);}
      const scare=box(1.2,1.6,0.5,0xc9a86a); scare.castShadow=false; scare.position.set(-7.2,2.2,-7.2); g.add(scare);
      const arms=box(2.8,0.3,0.3,PLANK); arms.castShadow=false; arms.position.set(-7.2,2.5,-7.2); g.add(arms);
    }else if(age===3){ // low marble boundary + amphora
      for(const [bx,bz,bw,bd] of [[-9.2,0,0.6,17],[0,-9.2,17,0.6]]){
        const wallb=box(bw,0.8,bd,MARBLE); wallb.castShadow=false; wallb.position.set(bx,0.4,bz); g.add(wallb);}
      const amp=cyl(0.55,0.35,1.4,0xb8603a,8); amp.castShadow=false; amp.position.set(-8,1,-8); g.add(amp);
      const ampn=cyl(0.22,0.35,0.5,0xb8603a,8); ampn.castShadow=false; ampn.position.set(-8,1.95,-8); g.add(ampn);
    }else if(age===4){ // timber rails + scarecrow
      for(let i=0;i<3;i++){const fp=cyl(0.13,0.15,1.7,0x6b4a2b,5); fp.castShadow=false; fp.position.set(-8.8,1.1,-6+i*6); g.add(fp);}
      for(const fy of [1,1.6]){const fr=box(0.16,0.16,13,PLANK); fr.castShadow=false; fr.position.set(-8.8,fy,0); g.add(fr);}
      const scare=box(1.2,1.6,0.5,0xc9a86a); scare.castShadow=false; scare.position.set(-7.2,2.2,-7.2); g.add(scare);
      const arms=box(2.8,0.3,0.3,PLANK); arms.castShadow=false; arms.position.set(-7.2,2.5,-7.2); g.add(arms);
    }else{ // white picket + haystack
      for(let i=0;i<6;i++){const pk=box(0.2,1.1,0.14,WHITEWASH); pk.castShadow=false; pk.position.set(-8.8,0.85,-7.5+i*3); g.add(pk);}
      const pr=box(0.14,0.16,16,WHITEWASH); pr.castShadow=false; pr.position.set(-8.8,1.15,0); g.add(pr);
      const hay=cone(1.5,1.8,0xcbb060,8); hay.castShadow=false; hay.position.set(-7,0.9,-7.4); g.add(hay);
    }
  }else if(type==="storage_pit"){
    // ======= STORAGE PIT -> STOREHOUSE, AGES §F.1-§F.6 =======
    // A replacement chain (§F.6: "STOREHOUSE replaces STORAGE PIT"), and every age's answer to
    // "keep grain off the damp and away from rodents" is a different shape:
    //   0 a small RAISED timber hut on stilts + bell-shaped pits with clay lids and a ladder
    //   1 freestanding DOMED BEEHIVE SILOS, loaded from a top opening by ladder
    //   2 the FOUR-POST GRANARY: a timber platform raised on four posts, capped pits round it
    //   3 the HORREUM: floors on short pillars (suspensurae) — SHOW THE PILLARS — high narrow
    //     windows, and RAMPS instead of stairs
    //   4 the TITHE BARN: from outside it is a long steep DOMINATING roof mass, with massive
    //     OPPOSED WAGON DOORS on both sides
    //   5 the STOREHOUSE: multi-story brick, a loading door on EVERY floor at the gable end under
    //     an external HOIST BEAM
    const yard=box(12,0.6,12,age<=1?P.dark:_dk(P.stone,0.10));
    yard.position.y=0.3; yard.castShadow=false; yard.receiveShadow=true; g.add(yard);
    for(let i=0;i<3;i++){const crate=new THREE.Mesh(new THREE.BoxGeometry(1.9,1.9,1.9),texturedMat("wood",0xb08a5a));
      crate.position.set(3.6+(i%2)*1.6,1.55+(i>1?1.9:0),3.0-(i%2)*2); crate.rotation.y=i*0.8; g.add(crate);}
    const sack=box(1.7,1.3,1.7,0xc9a86a); sack.castShadow=false; sack.position.set(4.4,1.25,-2.6); sack.rotation.y=0.5; g.add(sack);
    const grain=cone(0.8,0.8,0xe0c988,7); grain.castShadow=false; grain.position.set(4.4,2.25,-2.6); g.add(grain);
    flagPole(g,5.4,0.6,5.4,5.4,tc,2,1.2);
    if(age===0){
      for(const [px,pz] of [[-3.4,-2.6],[-1.0,-2.6],[-3.4,-0.2],[-1.0,-0.2]]){
        const st=cyl(0.24,0.3,1.7,P.timber,5); st.castShadow=false; st.position.set(px,1.45,pz); g.add(st);}
      const flr=box(3.6,0.4,3.4,P.timber); flr.castShadow=true; flr.position.set(-2.2,2.5,-1.4); g.add(flr);
      const hut=new THREE.Mesh(new THREE.BoxGeometry(3.0,1.9,2.8),aWall(0));
      hut.position.set(-2.2,3.65,-1.4); hut.castShadow=true; hut.receiveShadow=true; g.add(hut);
      // the hut stands at (-2.2,-1.4); ageRoof draws at the group ORIGIN, so this roof spent
      // its life 2.61 units off the shed. Same idiom as :1748 — translate, then roof.
      const hsub=new THREE.Group(); hsub.position.set(-2.2,0,-1.4); g.add(hsub);
      ageRoof(hsub,0,3.0,2.8,4.6,type,{});
      const lad=box(0.7,3.0,0.14,P.timber); lad.castShadow=false; lad.rotation.x=-0.34;
      lad.position.set(-2.2,1.5,0.9); g.add(lad);                       // the leaning ladder
      for(const [px,pz] of [[1.2,-3.4],[2.6,-0.6],[0.2,-1.0]]){         // BELL-SHAPED pits, clay-lidded
        const pit=cyl(0.95,0.62,0.9,P.dark,9); pit.castShadow=false; pit.position.set(px,0.9,pz); g.add(pit);
        const lid=cyl(1.05,1.05,0.24,P.wall,9); lid.castShadow=false; lid.position.set(px,1.45,pz); g.add(lid);
      }
    }else if(age===1){
      for(const [gx,gz,gr] of [[-3.0,-1.8,2.0],[0.4,-3.4,1.7]]){        // domed BEEHIVE silos
        const drum=new THREE.Mesh(new THREE.CylinderGeometry(gr,gr*1.06,2.2,10),aWall(1));
        drum.position.set(gx,1.7,gz); drum.castShadow=true; drum.receiveShadow=true; g.add(drum);
        const dome=bDome(gr,"cloth",BPAL[1].wall); dome.position.set(gx,2.8,gz); g.add(dome);
        const hatch=box(0.8,0.9,0.2,P.dark); hatch.castShadow=false; hatch.position.set(gx,1.5,gz+gr*1.02); g.add(hatch);
        const top=cyl(0.42,0.46,0.4,P.dark,8); top.castShadow=false; top.position.set(gx,2.8+gr*0.95,gz); g.add(top);
      }
      const lad=box(0.7,4.0,0.14,P.timber); lad.castShadow=false; lad.rotation.x=-0.30;
      lad.position.set(-3.0,2.6,0.6); g.add(lad);
    }else if(age===2){
      // THE FOUR-POST GRANARY. The raised box on stilts is the whole read, so the posts are tall
      // and the box is small: it must look lifted, not built.
      for(const [px,pz] of [[-3.8,-2.8],[-0.8,-2.8],[-3.8,0.2],[-0.8,0.2]]){
        const pp=new THREE.Mesh(new THREE.CylinderGeometry(0.26,0.32,2.6,6),texturedMat("wood",P.timber));
        pp.position.set(px,1.9,pz); pp.castShadow=true; g.add(pp);
        const cap=cyl(0.62,0.62,0.2,STONEDK,8); cap.castShadow=false; cap.position.set(px,3.3,pz); g.add(cap);} // staddle caps
      const flr=box(4.2,0.44,3.8,P.timber); flr.castShadow=true; flr.position.set(-2.3,3.6,-1.3); g.add(flr);
      const cab=new THREE.Mesh(new THREE.BoxGeometry(3.6,2.2,3.2),aWall(2));
      cab.position.set(-2.3,4.9,-1.3); cab.castShadow=true; cab.receiveShadow=true; g.add(cab);
      const sub=new THREE.Group(); sub.position.set(-2.3,0,-1.3); g.add(sub);
      ageRoof(sub,2,3.6,3.2,6.0,type,{eave:0.16});
      const lad=box(0.7,3.4,0.14,P.timber); lad.castShadow=false; lad.rotation.x=-0.32;
      lad.position.set(-2.3,2.2,1.1); g.add(lad);
      for(const [px,pz] of [[1.4,-3.6],[2.8,-1.0]]){                    // capped pits round its base
        const lid=cyl(0.9,0.9,0.24,P.stone,9); lid.castShadow=false; lid.position.set(px,0.72,pz); g.add(lid);}
    }else if(age===3){
      // THE HORREUM. §F.4: "floors raised on short pillars (suspensurae) so air circulates
      // underneath — SHOW THE PILLARS; narrow high windows sized to deter theft; RAMPS instead of
      // stairs." The gap of daylight under the floor is the detail, so the pillars are short and
      // there are a lot of them.
      const pod=new THREE.Mesh(new THREE.BoxGeometry(8.4,0.5,7.4),texturedMat("metal",P.stone));
      pod.position.set(-1.4,0.85,-1.0); pod.castShadow=true; g.add(pod);
      for(let i=0;i<4;i++)for(let j=0;j<3;j++){
        const pil=box(0.4,1.0,0.4,P.stone); pil.castShadow=false;
        pil.position.set(-4.2+i*1.9,1.6,-3.6+j*2.6); g.add(pil);}       // the suspensurae
      const flr=box(8.2,0.4,7.2,P.stone); flr.castShadow=true; flr.position.set(-1.4,2.3,-1.0); g.add(flr);
      const hall=new THREE.Mesh(new THREE.BoxGeometry(7.4,3.8,6.4),aWall(3));
      hall.position.set(-1.4,4.4,-1.0); hall.castShadow=true; hall.receiveShadow=true; g.add(hall);
      for(let i=0;i<4;i++){const w=box(0.5,1.0,0.24,P.dark); w.castShadow=false;    // narrow HIGH windows
        w.position.set(-3.9+i*1.7,5.5,2.28); g.add(w);}
      const sub=new THREE.Group(); sub.position.set(-1.4,0,-1.0); g.add(sub);
      ageRoof(sub,3,7.4,6.4,6.3,type,{});
      const ramp=box(2.6,0.3,3.4,P.stone); ramp.rotation.x=-0.34; ramp.castShadow=false;   // a RAMP, not stairs
      ramp.position.set(-1.4,1.6,3.6); g.add(ramp);
      const door=box(1.7,2.4,0.2,P.dark); door.castShadow=false; door.position.set(-1.4,3.7,2.26); g.add(door);
    }else if(age===4){
      // THE TITHE BARN. §F.5: "from outside it is a long, steep, DOMINATING roof mass — the roof
      // is most of the building." So the wall is deliberately short and the 50° roof is huge, and
      // the MASSIVE OPPOSED WAGON DOORS go on BOTH sides so a cart drives straight through.
      const pl=new THREE.Mesh(new THREE.BoxGeometry(11.0,0.7,7.4),texturedMat("metal",P.stone));
      pl.position.set(-0.6,0.35,-0.6); pl.castShadow=true; g.add(pl);
      const wall=new THREE.Mesh(new THREE.BoxGeometry(10.2,2.6,6.6),texturedMat("metal",P.stone));
      wall.position.set(-0.6,2.0,-0.6); wall.castShadow=true; wall.receiveShadow=true; g.add(wall);
      const sub=new THREE.Group(); sub.position.set(-0.6,0,-0.6); g.add(sub);
      ageRoof(sub,4,10.2,6.6,3.3,type,{tc,long:"x"});                   // ridge along the LONG axis
      for(const s of [-1,1]){                                           // OPPOSED wagon doors
        const dr=box(3.4,2.4,0.3,P.timber); dr.castShadow=false; dr.position.set(-0.6,1.9,-0.6+s*3.36); g.add(dr);
        const pk=pedTri(3.4,1.5,P.timber); pk.position.set(-0.6,3.6,-0.6+s*3.30); g.add(pk);
        for(const b2 of [-0.7,0.7]){const st=box(3.3,0.18,0.12,STONEDK); st.castShadow=false;
          st.position.set(-0.6,1.9+b2,-0.6+s*3.5); g.add(st);}
      }
      for(const s of [-1,1])for(let i=0;i<3;i++){                       // the cruck frame's buttresses
        const but=box(0.7,2.4,0.9,P.stone); but.castShadow=false;
        but.position.set(-4.4+i*3.8,1.2,-0.6+s*3.6); g.add(but);}
    }else{
      // THE STOREHOUSE. §F.6: "a loading door on EVERY floor at the gable end served by an
      // external HOIST BEAM and pulley. The hoist beam projecting from the gable is the readable
      // detail." Three floors, three doors, one beam sticking out over them.
      const bb=new THREE.Mesh(new THREE.BoxGeometry(7.4,0.9,6.6),texturedMat("metal",BRICK));
      bb.position.set(-1.2,0.45,-0.8); bb.castShadow=true; g.add(bb);
      const blk=new THREE.Mesh(new THREE.BoxGeometry(6.6,8.4,5.8),aWall(5));
      blk.position.set(-1.2,5.1,-0.8); blk.castShadow=true; blk.receiveShadow=true; g.add(blk);
      for(const s2 of [-1,1]){const q=new THREE.Mesh(new THREE.BoxGeometry(0.6,8.4,0.6),
        texturedMat("metal",BRICK)); q.position.set(-1.2+s2*3.0,5.1,2.6); q.castShadow=false; g.add(q);}
      for(const by of [3.6,6.2]){const bd=box(6.8,0.34,6.0,BRICK); bd.castShadow=false;
        bd.position.set(-1.2,by,-0.8); g.add(bd);}          // the brick floor bands
      const sub=new THREE.Group(); sub.position.set(-1.2,0,-0.8); g.add(sub);
      const apex=ageRoof(sub,5,6.6,5.8,9.3,type,{tc});
      for(let f=0;f<3;f++){                                             // A LOADING DOOR ON EVERY FLOOR
        const dr=box(1.5,2.0,0.24,P.timber); dr.castShadow=false; dr.position.set(-1.2,2.3+f*2.6,2.14); g.add(dr);
        for(const s of [-1,1]){const w=box(0.7,1.0,0.2,P.dark); w.castShadow=false;
          w.position.set(-1.2+s*2.1,2.5+f*2.6,2.12); g.add(w);}
      }
      // THE HOIST BEAM, projecting from the gable with its pulley and rope
      const beam=box(0.44,0.44,3.0,P.timber); beam.castShadow=true; beam.position.set(-1.2,apex-0.9,3.4); g.add(beam);
      const brk=box(0.34,1.4,0.34,P.timber); brk.castShadow=false; brk.rotation.x=-0.6;
      brk.position.set(-1.2,apex-1.6,2.6); g.add(brk);
      const pul=cyl(0.34,0.34,0.2,P.dark,8); pul.rotation.z=Math.PI/2; pul.castShadow=false;
      pul.position.set(-1.2,apex-1.2,4.7); g.add(pul);
      const rope=cyl(0.05,0.05,4.2,0x9a8a6a,4); rope.castShadow=false; rope.position.set(-1.2,apex-3.4,4.7); g.add(rope);
      const bale=box(1.0,0.9,1.0,0xc9a86a); bale.castShadow=false; bale.position.set(-1.2,apex-5.4,4.7); g.add(bale);
      for(const s of [-1,1]){const ch=new THREE.Mesh(new THREE.BoxGeometry(1.0,3.0,1.0),texturedMat("metal",BRICK));
        ch.position.set(-1.2+s*2.2,apex+0.1,-0.8); ch.castShadow=true; g.add(ch);
        const cp=box(1.3,0.3,1.3,P.dark); cp.castShadow=false; cp.position.set(-1.2+s*2.2,apex+1.75,-0.8); g.add(cp);}
    }
  }else if(type==="archery_range"){
    // ======= THE RANGE, AGES §F.2-§F.6 — the other flagged invention, and one real one =======
    //   1-3 straw bales and butts on frames; §F flags that no purpose-built range exists this
    //       early, and the Classical one gets a COVERED GALLERY as a reasonable inference
    //   4   "THIS IS FINALLY THE GENUINE HISTORICAL ARTICLE": a long fenced green with a pair of
    //       turf BUTT MOUNDS at either end. Practice was legally mandated.
    //   5   reskinned as a MUSKETRY range: a covered firing line and an EARTH BACKSTOP BUTT —
    //       archery is militarily obsolete this age, and the old turf butts stay in the corner as
    //       a decorative sporting range, which §F calls a nice wink that costs nothing
    agedShell(g,age,tc,11.2,5.2,8.8,type);
    if(age>=4){ // THE TURF BUTT MOUND — the one thing that makes this building real
      const butt=new THREE.Mesh(new THREE.CylinderGeometry(2.2,3.4,2.6,10),plainMat(0x6f8a3e));
      butt.position.set(-4.6,1.3,8.4); butt.castShadow=true; butt.receiveShadow=true; g.add(butt);
      const face=cyl(1.5,1.5,0.3,0xcbb060,12); face.rotation.x=Math.PI/2-0.22; face.castShadow=false;
      face.position.set(-4.6,2.2,10.0); g.add(face);
    }
    if(age>=5){ // the musketry line: a covered firing bench and an EARTH BACKSTOP behind the butt
      const bank=box(11.0,2.8,2.2,0x7a6a4a); bank.rotation.x=-0.16; bank.castShadow=true;
      bank.receiveShadow=true; bank.position.set(1.6,1.4,10.6); g.add(bank);
      for(const s of [-1,1]){const post=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.24,3.0,6),
        texturedMat("wood",P.timber)); post.position.set(2.0+s*3.4,1.5,5.6); post.castShadow=true; g.add(post);}
      const cov=box(8.0,0.34,2.4,P.roof); cov.castShadow=true; cov.rotation.x=0.12; cov.position.set(2.0,3.2,5.6); g.add(cov);
      const bench=box(7.4,0.4,0.9,P.timber); bench.castShadow=false; bench.position.set(2.0,1.4,5.9); g.add(bench);
      for(let i=0;i<3;i++){const mus=cyl(0.07,0.08,3.0,P.timber,4); mus.rotation.set(-0.5,0,0.12);
        mus.castShadow=false; mus.position.set(0.2+i*1.6,2.2,5.4); g.add(mus);}
    }else if(age>=1){ // straw bale targets on wooden frames, and the line of firing marks
      for(const bx of [-2.4,2.4]){
        const fr=box(2.2,0.3,0.3,P.timber); fr.castShadow=false; fr.position.set(bx,2.6,7.6); g.add(fr);
        for(const s of [-1,1]){const lg=cyl(0.14,0.16,2.6,P.timber,5); lg.castShadow=false;
          lg.position.set(bx+s*0.95,1.3,7.7); g.add(lg);}
      }
      if(age===3)for(const s of [-1,1]){ // the COVERED GALLERY for shooting in bad weather
        const post=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.26,3.2,6),texturedMat("metal",P.stone));
        post.position.set(s*4.4,1.6,6.4); post.castShadow=true; g.add(post);}
      if(age===3){const gal=box(10.0,0.4,2.6,P.roof); gal.castShadow=true; gal.rotation.x=0.14;
        gal.position.set(0,3.4,6.4); g.add(gal);}
    }
    // THE ROUNDEL GOES DOWNRANGE — +3.70 ON Z, AND NOTHING ELSE MOVES. Bolted to the shed's face at
    // z 4.6 it stood behind the Classical covered gallery, which is authored across the whole yard
    // in front of it: box(10,0.4,2.6) at (0,3.4,6.4) tipped 0.14 occupies y 3.021..3.779 over
    // z 5.085..7.715, so the gallery roof cut the roundel through the bull at every camera and the
    // MIDDLE ARROW drove through the slab — a triangle-level HIT, not an AABB overlap: the ay 3.6
    // shaft crosses the slab's wall-side face at slab-normal -0.010 and leaves through the top face,
    // its fletching sitting ON the roof, 0.261 of minimum translation. The other two shafts clear,
    // but by 0.332 and 0.035. Age 5 is worse than age 3 and the same root cause: the musketry cover
    // box(8,0.34,2.4) at (2.0,3.2,5.6) tipped 0.12 slices straight THROUGH the discs, 0.362 deep.
    // NO HEIGHT ON THE WALL FIXES IT: the roundel is 3.400 across and the slab leaves 5.800-3.779 =
    // 2.021 of air above it and 3.021 below it. Nor can the roundel rise, because 3.8 is itself
    // derived — 5.800 (the ages 0-2 eave soffit) - 1.700 - 0.300. Off the wall there is room, and
    // downrange is also where a target belongs: the age-3 gallery stands at z 6.4 and the age-5
    // firing bench at z 5.9, so at 4.6 the roundel sat BEHIND both shooting positions. The
    // gallery's downrange corner is 6.4 + 0.2*sin(0.14) + 1.3*cos(0.14) = 7.715, the roundel's
    // rearmost surface is the bull's back face at z-0.17, and 8.30 - 0.17 - 7.715 = 0.415 of
    // daylight. Everything stuck in the target moves by the same +3.70. Measured clear at all six
    // ages: 0.415 to the gallery, 0.387 to the butt frames it now stands in front of, 1.089 to the
    // Medieval turf mound, 0.811 to the Enlightenment backstop and 1.318 to the musketry cover.
    // The frontmost part is a fletching at 9.78, inside the fz 11.91 footprint, so it lands nowhere
    // a body could stand, and its underside at 2.10 is above footprint.js's 1.1 knee, so fz is
    // unchanged. COST, ACCEPTED: there is no wall behind the roundel now — at ages 1-4 the straw-
    // butt frames stand 0.387 back and read as its rack, and at ages 0 and 5 nothing does.
    const target=cyl(1.7,1.7,0.3,MARBLE,12); target.rotation.x=Math.PI/2; target.castShadow=false; target.position.set(0,3.8,8.3); g.add(target);
    const ring=cyl(1.2,1.2,0.34,0x27406e,12); ring.rotation.x=Math.PI/2; ring.castShadow=false; ring.position.set(0,3.8,8.31); g.add(ring);
    const bull=cyl(0.66,0.66,0.38,0xc23a3a,12); bull.rotation.x=Math.PI/2; bull.castShadow=false; bull.position.set(0,3.8,8.32); g.add(bull);
    for(const [ax,ay] of [[-0.3,4.2],[0.4,3.6],[0.1,3.9]]){ // arrows stuck in the target: 5.3+3.70
      const ar=cyl(0.06,0.06,1.3,PLANK,4); ar.rotation.x=Math.PI/2-0.15; ar.castShadow=false; ar.position.set(ax,ay,9.0); g.add(ar);
      const fl=box(0.18,0.18,0.26,MARBLE); fl.castShadow=false; fl.position.set(ax,ay+0.1,9.65); g.add(fl);
    }
    const hay=new THREE.Mesh(new THREE.BoxGeometry(2.6,2,1.8),plainMat(0xCBB060));
    hay.position.set(-4.4,1,5); hay.rotation.y=0.3; g.add(hay);
    const barrel=cyl(0.9,0.75,2,0x7a5a34,8); barrel.position.set(4.8,1,4.8); g.add(barrel);
    for(let i=0;i<3;i++){const qa=cyl(0.07,0.07,2.4,PLANK,4); qa.rotation.z=0.25-i*0.25; qa.castShadow=false;
      qa.position.set(4.6+i*0.24,2.5,4.8); g.add(qa);}
  }else if(type==="stable"){
    // ======= THE STABLE, AGES §F.2-§F.6 =======
    //   1 an open colonnaded STALL RUN with tether posts and FLOOR CISTERNS (Piramesse had ~460
    //     tether points, each paired with a cistern) — and NOT Megiddo's pillared design, which is
    //     Iron Age and is the age below's
    //   2 THE ROW OF STONE PILLARS WITH TETHERING HOLES BORED THROUGH THEM is the signature
    //   3-4 stall run divided by timber partitions, a hayloft with an external pitching door
    //   5 "the Georgian estate stable block was an architectural showpiece in a way no earlier
    //     stable ever was — THE CUPOLA OVER THE ARCHWAY IS THE WHOLE POINT"
    const shellTop=agedShell(g,age,tc,12.4,5.2,9.6,type);
    if(age===2){ // the pillars, bored through — six of them in a row, and you can see daylight
      for(let i=0;i<6;i++){
        const pil=new THREE.Mesh(new THREE.BoxGeometry(0.7,3.0,0.7),texturedMat("metal",P.stone));
        pil.position.set(-4.8+i*1.95,1.5,6.6); pil.castShadow=true; g.add(pil);
        const hole=box(0.26,0.26,0.8,P.dark); hole.castShadow=false;
        hole.position.set(-4.8+i*1.95,2.4,6.6); g.add(hole);          // the tethering hole
      }
      const lint=new THREE.Mesh(new THREE.BoxGeometry(11.4,0.44,0.8),texturedMat("metal",P.stone));
      lint.castShadow=true; lint.position.set(0.05,3.2,6.6); g.add(lint);
    }else if(age===1){ // tether posts each paired with its own floor cistern
      for(let i=0;i<5;i++){
        const tp=cyl(0.16,0.2,1.6,P.timber,5); tp.castShadow=false; tp.position.set(-4.4+i*2.2,0.8,6.6); g.add(tp);
        const cis=cyl(0.5,0.55,0.4,P.stone,8); cis.castShadow=false; cis.position.set(-4.4+i*2.2,0.2,7.5); g.add(cis);
      }
    }else if(age>=5){
      // THE CUPOLA over the CENTRAL ARCHWAY. §F.6 says it is the whole point of the building, so
      // it stands on the archway and not somewhere polite on the ridge.
      const arch=new THREE.Mesh(new THREE.BoxGeometry(5.0,6.4,3.2),aWall(5));
      arch.position.set(0,4.4,5.4); arch.castShadow=true; arch.receiveShadow=true; g.add(arch);
      const ab=new THREE.Mesh(new THREE.BoxGeometry(5.3,1.0,3.5),texturedMat("metal",BRICK));
      ab.position.set(0,1.0,5.4); ab.castShadow=true; g.add(ab);
      const ao=box(2.6,4.2,0.5,P.dark); ao.castShadow=false; ao.position.set(0,2.9,7.0); g.add(ao);
      const aa=cyl(1.3,1.3,0.5,P.dark,10); aa.rotation.x=Math.PI/2; aa.castShadow=false; aa.position.set(0,5.0,7.0); g.add(aa);
      const acor=box(5.6,0.4,3.8,P.wall); acor.castShadow=false; acor.position.set(0,7.8,5.4); g.add(acor);
      const drum=cyl(1.3,1.45,1.4,P.stone,8); drum.castShadow=true; drum.position.set(0,8.7,5.4); g.add(drum);
      for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;
        const op=box(0.5,0.9,0.5,P.dark); op.castShadow=false;
        op.position.set(Math.sin(a)*1.25,8.7,5.4+Math.cos(a)*1.25); op.rotation.y=-a; g.add(op);}
      const cd=bDome(1.4,"wood",P.civic); cd.position.set(0,9.4,5.4); g.add(cd);   // the copper cupola
      const clk=cyl(0.62,0.62,0.16,P.wall,10); clk.rotation.x=Math.PI/2; clk.castShadow=false;
      clk.position.set(0,8.0,7.32); g.add(clk);                                     // …and its clock
      const hand=box(0.08,0.44,0.06,P.dark); hand.castShadow=false; hand.position.set(0,8.16,7.42); g.add(hand);
      const fin=cone(0.26,0.7,GOLD,6); fin.castShadow=false; fin.position.set(0,11.1,5.4); g.add(fin);
    }else if(age>=3){ // the hayloft's external PITCHING DOOR, high in the gable
      const pd=box(1.5,1.7,0.24,P.timber); pd.castShadow=false; pd.position.set(-3.4,5.6,4.86); g.add(pd);
      const hb=box(0.34,0.34,1.6,P.timber); hb.castShadow=true; hb.position.set(-3.4,6.7,5.6); g.add(hb);
    }
    const hh=box(1,0.9,1.3,0x7a4c26); hh.castShadow=false; hh.position.set(3.2,4.4,5); g.add(hh); // the resident
    const hn=box(0.8,1.6,0.8,0x8a5a30); hn.castShadow=false; hn.position.set(3.2,3.5,4.7); hn.rotation.x=0.4; g.add(hn);
    for(let i=0;i<3;i++){ // paddock fence out front
      const fp=cyl(0.16,0.18,1.9,0x6b4a2b,5); fp.castShadow=false; fp.position.set(-5.2+i*3.2,0.95,6.8); g.add(fp);
    }
    const frail=box(7.2,0.2,0.2,PLANK); frail.castShadow=false; frail.position.set(-2,1.6,6.8); g.add(frail);
    const frail2=box(7.2,0.2,0.2,PLANK); frail2.castShadow=false; frail2.position.set(-2,0.85,6.8); g.add(frail2);
    const hayS=cone(1.7,1.9,0xcbb060,7); hayS.castShadow=false; hayS.position.set(5.2,0.95,6.4); g.add(hayS);
    const trough=box(2.6,0.7,1.1,TIMBER); trough.castShadow=false; trough.position.set(-5.2,0.35,4); g.add(trough);
  }else if(type==="watch_tower"){
    // ======= `watch_tower` IS THE OCCUPIABLE ONE. OWNER RULING. IT IS NOT A SMALL `tower`. =======
    // It carries `b.deck` (makeBuilding, below) and units stand on it, so §F.2/§F.3/§F.5 all say
    // the same thing about it: IT MUST READ AS CLIMBABLE. A visible external stair or ladder, an
    // open deck, a parapet you can see over. `tower` shoots, is permanently garrisoned, is bigger,
    // and is built into a wall circuit; the two are different buildings, not two sizes of one, and
    // the fastest way to tell them apart at 46px is that this one has something to climb on the
    // OUTSIDE of it.
    //
    // The mast is what changes with the age, and it changes SHAPE, never just hex (AD §5.7):
    //   0 lashed timber scaffold, thatch lid        3 burgus: ashlar base, timber fighting gallery
    //   1 migdol: BATTERED mudbrick, beacon brazier 4 peel tower: stone, entrance at FIRST FLOOR
    //   2 crenellated square, beacon basket            reached by a REMOVABLE LADDER
    //                                               5 martello: SQUAT, thick, flat gun platform
    const stony=age>=2, batter=age===1, peel=age===4, martello=age>=5;
    const frameMat=stony?texturedMat("metal",P.stone):texturedMat("wood",PLANK);
    // §F.6: "deliberately LOW profile — squat and thick-walled, designed to survive artillery
    // rather than to loom". The Enlightenment watch tower is the SHORT one, and that inversion is
    // the age's whole fortification story in one silhouette.
    const H=watchTowerH(age);
    const deckR=martello?5.2:3.9;
    if(batter||peel||martello){
      // one battered or straight masonry drum instead of four legs — the profile change §5.7 wants
      const body=martello
        ? new THREE.Mesh(new THREE.CylinderGeometry(4.6,5.4,H,10),frameMat)
        : new THREE.Mesh(new THREE.CylinderGeometry(peel?3.0:2.9,peel?3.3:4.0,H,peel?4:4),frameMat);
      if(!martello)body.rotation.y=Math.PI/4;
      body.position.y=H/2; body.castShadow=true; body.receiveShadow=true; g.add(body);
    }else{
      for(const [px,pz] of [[-2.6,-2.6],[2.6,-2.6],[-2.6,2.6],[2.6,2.6]]){
        const leg=new THREE.Mesh(stony?new THREE.BoxGeometry(1.1,H,1.1):new THREE.CylinderGeometry(0.32,0.4,H,6),frameMat);
        leg.position.set(px,H/2,pz); if(!stony)leg.rotation.z=px>0?-0.05:0.05; leg.castShadow=true; g.add(leg);
      }
      const brace=new THREE.Mesh(new THREE.BoxGeometry(6.2,0.3,6.2),frameMat);
      brace.position.y=H*0.49; brace.castShadow=false; g.add(brace);
    }
    const plat=new THREE.Mesh(new THREE.BoxGeometry(deckR*1.95,0.5,deckR*1.95),
      stony?frameMat:texturedMat("wood",PLANK));
    plat.position.y=H; plat.castShadow=true; plat.receiveShadow=true; g.add(plat);
    // THE CLIMB. This is the thing that says "occupiable" and it is on the outside where it can be
    // seen: rungs and rails at the early ages, a removable ladder standing off the wall at the
    // peel tower (§F.5's own read for the type), a stone stair at the martello.
    if(peel){
      const lad=box(1.5,H*0.62,0.24,PLANK); lad.rotation.z=0.0; lad.rotation.x=-0.18;
      lad.castShadow=false; lad.position.set(0,H*0.34,3.9); g.add(lad);
      for(let i=0;i<6;i++){const rung=box(1.5,0.16,0.16,0x6b4a2b); rung.castShadow=false;
        rung.position.set(0,1.4+i*1.5,3.9+i*0.16); g.add(rung);}
      const doorH=box(1.5,2.4,0.3,P.dark); doorH.castShadow=false; doorH.position.set(0,H*0.62,3.1); g.add(doorH);
    }else if(martello){
      for(let i=0;i<5;i++){const st=box(2.6,0.5,1.1-i*0.15,P.stone); st.castShadow=false;
        st.position.set(0,0.6+i*1.1,5.9-i*0.2); g.add(st);}          // the outside stair
      const doorM=box(1.6,2.2,0.3,P.dark); doorM.castShadow=false; doorM.position.set(0,6.4,4.7); g.add(doorM);
    }else{
      for(let i=0;i<6;i++){const rung=box(1.6,0.2,0.2,PLANK); rung.castShadow=false; rung.position.set(0,2+i*2.2,2.85); g.add(rung);}
      for(const rx of [-0.9,0.9]){const rail=box(0.18,H-0.6,0.18,0x6b4a2b); rail.castShadow=false; rail.position.set(rx,H*0.51,2.85); g.add(rail);}
    }
    // the parapet you can see over — solid stone from the classical age, an open rail before it
    const walled=age>=2;
    for(const [px,pz] of [[-deckR,0],[deckR,0],[0,-deckR],[0,deckR]]){
      const rh=walled?2.1:1.7;
      const rail=box(px?0.45:deckR*2,rh,pz?0.45:deckR*2,walled?P.stone:PLANK);
      rail.castShadow=false; rail.position.set(px,H+0.25+rh/2,pz); g.add(rail);
    }
    if(walled&&!martello)for(let i=0;i<4;i++){          // crenellated: gaps you shoot through
      const cr=box(1.1,0.9,0.5,P.stone); cr.castShadow=false;
      cr.position.set(-deckR*0.6+i*deckR*0.4,H+2.8,deckR); g.add(cr);
    }
    if(age===3){ // §F.4 BURGUS: a projecting TIMBER fighting gallery is the classical read, and it
      // is the one age whose deck oversails the wall below it
      const gal=new THREE.Mesh(new THREE.BoxGeometry(deckR*2.5,1.1,deckR*2.5),texturedMat("wood",P.timber));
      gal.position.y=H-0.55; gal.castShadow=true; g.add(gal);
      for(const s of [-1,1]){const brk=box(0.3,1.0,1.4,P.timber); brk.castShadow=false;
        brk.rotation.x=0.5; brk.position.set(s*deckR*0.7,H-1.5,deckR*0.9); g.add(brk);}
    }
    // THE CAP, and it walks the age ladder in FORM: thatch cone, open beacon deck, low gable,
    // tiled hip, steep spire, and finally NO CAP AT ALL because a martello's top is a gun platform.
    if(martello){
      const gun=cyl(0.42,0.5,2.6,0x8A6A3A,8); gun.rotation.x=-0.42; gun.castShadow=false;
      gun.position.set(0,H+1.9,1.4); g.add(gun);                      // the gun on its platform
      const carr=box(1.5,0.6,2.0,P.timber); carr.castShadow=false; carr.position.set(0,H+1.1,0.9); g.add(carr);
      // THE SIGNAL MAST STANDS ON THE GUN PLATFORM. Its foot was H+2.6-4.4/2 = H+0.4 while the
      // deck slab's top is H+0.25, so it hovered 0.15 above the platform it signals from — measured
      // on the UNMERGED factory as 0.149 down to the 10.14 x 0.5 x 10.14 deck, 0.000 after. A part
      // of height h resting on a surface at s has its centre at s+h/2 = H+0.25+2.2. The flag is
      // rigged to the mast, so it drops by the same 0.15 and keeps its authored hang.
      const mast=cyl(0.11,0.13,4.4,PLANK,5); mast.castShadow=false; mast.position.set(-3.0,H+0.25+2.2,-2.2); g.add(mast);
      const sig=box(1.2,0.7,0.08,tc); sig.castShadow=false; sig.position.set(-2.4,H+4.05,-2.2); g.add(sig);
    }else{
      // AGES:492 says the Iron cap is "flat, crenellated"; AGES:531 says the Medieval peel tower
      // is "crenellated, NO PITCH". Both shipped as gables. The 62-degree Medieval gable hung its
      // eave at 0.66 above the deck — knee height on a 2.406 man — and at ages 2 and 4 the sentry
      // could not see out AT ANY ELEVATION from -5 to +10 degrees, in any direction. Measured.
      // If a pitch is ever restored here, yBase must rise from H+2.6 to at least H+3.5+eave*tan(ang),
      // because the eave EDGE hangs below yBase by that much and that is what does the blocking.
      const capForm=age===0?"cone":age===1?"flat":age===2?"flat":age===3?"hip":"flat";
      const capMark=g.children.length;
      const top=ageRoof(g,age,deckR*2,deckR*2,H+2.6,type,
        {form:capForm,eave:age===0?0.14:0.10});
      // everything ageRoof just added IS the cap: keep it out of the weld so a garrisoned player's
      // own client can hide it. Costs ~3 draw calls per built tower; A10 watches the total.
      // A FLAG ON THE MESHES, NOT AN INDEX INTO g.children. The first cut stored capFrom as an
      // index and it was dead on arrival: mergeBuildingBody REMOVES every welded child and APPENDS
      // one merged mesh, so the index addresses something else by the time anyone reads it. It also
      // missed the meshes ageRoof nests inside its own sub-groups, which were welded regardless.
      // Traverse, and tag the meshes themselves — that survives the weld, a restyle and an age-up.
      for(let i=capMark;i<g.children.length;i++)
        g.children[i].traverse(o=>{o.userData.noWeld=true; o.userData.isCap=true;});
      // the beacon: a brazier at the ages that signalled with fire, a basket at the iron age
      if(age<=2){brazier(g,deckR*0.62,-deckR*0.62);}
      // THE POLE STANDS ON THE CAP SLAB, NOT ON THE COPING OF THE CAP'S OWN PARAPET. ageRoof's
      // `flat` branch returns yBase+bh+0.4+ph, the top of the parapet RAIL, and that rail only runs
      // round the rim at +-(w/2+e-0.2) = +-4.48. At (0,0), where this pole is planted, the surface
      // is the deck slab at yBase+bh+0.4 — ph = max(0.7, w*0.09) = 0.702 lower. Measured on the
      // UNMERGED factory: 0.702 of air under the foot at every flat-cap age (1, 2, 4), 0.000 after.
      // Age 3's hip returns its APEX, which IS the surface at (0,0) and measured 0.004 before and
      // after, so the correction is gated on the form that has a parapet.
      flagPole(g,0,capForm==="flat"?top-Math.max(0.7,(deckR*2)*0.09):top,0,2.4,tc,1.7,1);
    }
    // THE BANNER CLADS THE FRONT PARAPET — WHICH IS WHERE ITS z ALWAYS PUT IT. The front rail is
    // box(deckR*2, rh, 0.45) at z=deckR, so its outer face is deckR+0.225, and a 0.1 cloth whose
    // centre is deckR+0.245 beds 0.03 into it — within the 0.03-0.11 every other wall-mounted
    // banner in this file sits at, and erring INTO the masonry so there is no hairline. At deckR
    // 3.9 that is 4.145: EXACTLY the old deckR*0.55+2.0. The z was the parapet's; the y never was.
    // At H*0.80 the cloth measured 1.888 clear of the battered drum at age 1 and 1.931 clear of the
    // peel tower at age 4 — the two worst stand-offs of any banner in the game — and at ages 2-3 it
    // hung in OPEN AIR: that frame is four 1.1 legs at x=+-2.6 and the cloth only spans x=+-0.85,
    // so a -z ray from it hits nothing at any depth. At age 5 its foot was 0.15 INSIDE the martello
    // drum and its head 0.16 clear of it, because the drum is battered and the old expression only
    // equals deckR+0.245 at deckR 3.9 — the martello's deck is 5.2. It also covered the martello's
    // first-floor door, which AGES:556 makes the entrance.
    // So: the cloth is the parapet's outer face in team colour. Foot on the deck slab at H+0.25,
    // head at the coping H+0.25+rh, and the height has to BE rh or it floats off one end. That
    // also lands its head exactly on the crenellation sill (H+2.8-0.45 = H+2.35), so it never
    // rises into the embrasures a garrisoned sentry shoots through, and it clears the climb —
    // the rungs at z=2.85 that AGES:492/531 calls the occupiable read are no longer behind it.
    const banH=walled?2.1:1.7;                 // = the `rh` the parapet rail is built with, above
    const banW=box(1.7,banH,0.1,tc); banW.castShadow=false;
    banW.position.set(0,H+0.25+banH/2,deckR+0.245); g.add(banW);
  }else if(type==="wood_wall"||type==="stone_wall"||type==="fort_wall"){
    // ============ THE WALL LADDER IS THREE RUNGS, NOT FIVE — OWNER RULING, AGES §0a.1 ============
    // "stone_wall and stone_gate are FULLY REPLACED by fort_wall / fort_gate. They do not persist,
    // are not restyled, and must not render in the Medieval or Enlightenment ages." The draft of
    // §F had them surviving as restyled Classical shells in ages 4 and 5 and SIX ROWS ARE STRUCK.
    // The player must never see a Classical-dressed or "obsolete" wall standing in a gunpowder
    // town — and since the replacement is a BUILD-MENU replacement (an already-placed wall is
    // restyled by _restyleOneBuilding, not demolished), the enforcement has to be here, at the
    // mesh: a stone_wall asked for at age 4 or 5 builds the FORTIFIED form.
    //   wood (2-3) -> stone (3 ONLY) -> fortified (4-5)
    const rung=(type==="wood_wall")?"wood":(type==="fort_wall"||age>=4)?"fort":"stone";
    // …and the fortified rung is TWO DIFFERENT WALLS, which is the whole of §F.6's warning:
    // "IF YOUR WALLS STILL LOOK TALL AND CRENELLATED IN THIS AGE, THE AGE HAS NOT VISUALLY
    // LANDED." Medieval fortification answers ladders and goes TALL AND THIN; gunpowder
    // fortification answers round shot and goes LOW AND THICK behind a sloped glacis. The drop in
    // height IS the upgrade, so the age-5 wall is deliberately the shortest stone wall in the game.
    if(rung==="wood"){
      // §F.3 vs §F.5 vs §F.6 — the cheapest building in the set, and it separates three ages on
      // the direction its timber runs:
      //   IRON      murus gallicus: HORIZONTAL beam ends and iron spike heads through a stone face
      //   MEDIEVAL  VERTICAL split logs, sharpened, in explicit contrast to the above
      //   ENLIGHT.  SQUARED and pegged timber with an overhanging blockhouse story
      const gallic=age<=2, squared=age>=5;
      const tim=texturedMat("wood",P.timber);
      const h=gallic?6.4:(squared?5.6:6.8);
      if(gallic){
        const face=new THREE.Mesh(new THREE.BoxGeometry(12.5,h,2),texturedMat("metal",P.stone));
        face.position.y=h/2; face.castShadow=true; face.receiveShadow=true; g.add(face);
        for(let r=0;r<4;r++)for(let i=0;i<6;i++){       // the beam ends, laid lengthwise, pinned
          const be=cyl(0.3,0.3,0.5,P.timber,6); be.rotation.x=Math.PI/2; be.castShadow=false;
          be.position.set(-5.2+i*2.1,1.0+r*1.5,1.05); g.add(be);
          const spk=box(0.16,0.16,0.3,STONEDK); spk.castShadow=false;
          spk.position.set(-5.2+i*2.1,1.0+r*1.5,1.32); g.add(spk);   // the iron spike head
        }
        const cap=box(12.5,0.5,2.3,P.timber); cap.castShadow=false; cap.position.y=h+0.2; g.add(cap);
      }else if(squared){
        const seg=new THREE.Mesh(new THREE.BoxGeometry(12.5,h,1.9),tim);
        seg.position.y=h/2; seg.castShadow=true; seg.receiveShadow=true; g.add(seg);
        for(let i=0;i<7;i++){                           // squared and PEGGED: the pegs are the read
          const pg=cyl(0.13,0.13,0.28,P.dark,5); pg.rotation.x=Math.PI/2; pg.castShadow=false;
          pg.position.set(-5.4+i*1.8,h*0.62,1.0); g.add(pg);
        }
        const step=box(12.5,0.4,1.5,P.timber); step.castShadow=false; step.position.set(0,h*0.55,-1.5); g.add(step);
        const bank=box(12.5,h*0.5,2.6,0x6b5a3a); bank.castShadow=false; bank.position.set(0,h*0.25,-2.6); g.add(bank);
        const over=box(12.5,1.5,2.6,tim); over.castShadow=true; over.position.set(0,h+0.75,0); g.add(over);
        for(let i=0;i<5;i++){const lp=box(0.22,0.5,0.16,P.dark); lp.castShadow=false;
          lp.position.set(-4.8+i*2.4,h+0.9,1.32); g.add(lp);}        // loopholes
      }else{
        const seg=new THREE.Mesh(new THREE.BoxGeometry(12.5,h,2),tim);
        seg.position.y=h/2; seg.castShadow=true; seg.receiveShadow=true; g.add(seg);
        for(let i=0;i<12;i++){                          // VERTICAL split logs, sharpened
          const log=cyl(0.48,0.52,h+0.4,0x6b4a2b,6); log.castShadow=false;
          log.position.set(-5.5+i*1,h/2,0.85); g.add(log);
          const tip=cone(0.5,1.2,0x6b4a2b,5); tip.castShadow=false; tip.position.set(-5.5+i*1,h+0.75,0.85); g.add(tip);
        }
        const walk=box(12.5,0.35,1.6,PLANK); walk.castShadow=false; walk.position.set(0,h*0.66,-1.1); g.add(walk);
      }
    }else if(rung==="stone"){
      // §F.4, and it is the ONE age this rung exists in. "The Roman contribution is engineering,
      // not height" — mortar lets a wall stand thinner and straighter, and under the Pax Romana it
      // is as much display as defence, so it can afford the decorative brick band a fort_wall
      // never gets.
      const wmat=texturedMat("metal",STONELIT);
      const h=7.2;
      const seg=new THREE.Mesh(new THREE.BoxGeometry(12.5,h,1.7),wmat);
      seg.position.y=h/2; seg.castShadow=true; seg.receiveShadow=true; g.add(seg);
      const band=box(12.7,0.4,1.9,P.roof); band.castShadow=false; band.position.y=h*0.72; g.add(band);
      for(let i=0;i<10;i++){
        const cren=new THREE.Mesh(new THREE.BoxGeometry(0.8,1,1.7),wmat);
        cren.position.set(-5.4+i*1.2,h+0.5,0); cren.castShadow=false; g.add(cren);
      }
      const walk=box(12.5,0.3,2.4,STONEDK); walk.castShadow=false; walk.position.y=h-0.15; g.add(walk);
    }else if(age>=5){
      // §F.6 THE STAR-FORT CURTAIN. Height is deliberately minimal: a masonry revetment face over
      // a deep earth core, a terreplein wide enough to work guns on, and a sloped GLACIS in front
      // of the ditch to absorb shot. Total 4.6 against the Medieval wall's 9.4 — half the height,
      // twice the depth, and the drop is the upgrade.
      const rev=new THREE.Mesh(new THREE.BoxGeometry(12.5,3.4,2.2),aWall(age));
      rev.rotation.x=-0.12; rev.position.set(0,1.7,0.5); rev.castShadow=true; rev.receiveShadow=true; g.add(rev);
      const core=box(12.5,3.6,3.4,0x7a6a4a); core.castShadow=false; core.position.set(0,1.8,-1.9); g.add(core);
      const terre=box(12.5,0.6,4.4,0x8a7a58); terre.castShadow=false; terre.position.set(0,3.7,-1.2); g.add(terre);
      for(let i=0;i<6;i++){ // the parapet with EMBRASURES cut through it — not merlons, embrasures
        const mer=box(1.5,1.2,1.6,P.wall); mer.castShadow=false;
        mer.position.set(-5.2+i*2.1,4.6,0.9); g.add(mer);
      }
      const glac=box(12.5,1.4,5.0,0x7f8a4e); glac.rotation.x=0.22; glac.castShadow=false;
      glac.position.set(0,0.5,3.9); g.add(glac);                     // the sloped glacis
      const ban=box(1.1,1.5,0.1,tc); ban.castShadow=false; ban.position.set(0,4.0,1.9); g.add(ban);
      // v131.18 THE RAMP UP TO THE TERREPLEIN. John: "back of enlightenment fortified walls can you
      // add ramps and make tops of walls walkable surface so people can shoot from the top."
      //
      // The terreplein is already a real walkway and always was — `terre` above is 12.5 x 4.4 with
      // its top at 3.7+0.3 = 4.00, and 4.4 of standable width against a 1.30 body. What it never
      // had was a way up. Measured across all six ages (tools/wallspec.js), this is the ONLY age
      // where that is true: the Classical wall's walkway is 0.80 wide — narrower than a body — and
      // the Medieval gate has no deck at all, so a curtain run there would break at every gate.
      // §F.6's own logic is why: the star-fort curtain is squat and thick "to survive artillery
      // rather than to loom", so it is 4.6 tall where the Medieval wall is 9.4, and wide enough to
      // work guns on. The history and the gameplay want the same shape.
      //
      // v132.20 OUT THE BACK, PERPENDICULAR, which is what John asked for and overrides the note
      // that used to stand here ("a perpendicular ramp needs an 8.0 run behind the wall and every
      // segment of a curtain would grow a tail into its own courtyard"). The cost is real and it is
      // paid: a ramp lying ALONG the wall does not read as a way up, it reads as a slab leaning on
      // the masonry — and tools/wallpop.js already recorded that its first run "reported the ramp
      // broken, because a body walking AT the wall crosses the 2.6-deep ramp band in a fifth of a
      // second and never travels the 8 units of x the rise is spread over". A ramp you have to
      // approach sideways is a ramp nobody finds.
      // 6.0 OF RUN, NOT 8.0: rise 4.0 over 6.0 is 1:1.5 at 33.7 degrees, so the tail is 6.0 behind
      // the terreplein's inner edge instead of 8.0. Steeper, and the smaller bill.
      // THE SIGN IS THE TRAP. Rotation about +x sends +z DOWNWARD (y' = y cos - z sin), so the angle
      // has to be NEGATIVE for the +z end — the one that meets the deck — to rise. Positive buries
      // the ramp in the ground. Same family as the T-R-S trap this file has paid for three times.
      // Ends, checked: length hypot(6,4) = 7.2111 centred at z = ZTOP - RRUN/2 = -6.4, y = 2.0.
      // Local +z end (0,0,3.606) turns to (0,+2.0,+3.0) -> world (0, 4.0, -3.4) = the deck edge.
      // Local -z end turns to (0,-2.0,-3.0) -> world (0, 0.0, -9.4) = the ground.
      // v132.22 A LADDER, NOT A RAMP. John: "even better nix the ramps and put ladders up against
      // the wall." It is the smaller object in every direction — 0.9 wide against 2.2, and no 6.0
      // tail into the courtyard, which finally answers the objection the original along-the-wall
      // ramp was built around ("every segment of a curtain would grow a tail into its own
      // courtyard"). Climbing is an E press now, so the ladder does not have to be walkable, only
      // legible: this is what says "you can get up here".
      // Leaned by 0.16 rad with the TOP toward the wall — rotation about +x carries a point at +y
      // toward +z, so a positive angle tips the head in and the feet out, which is how a ladder
      // stands. Feet at the ladder's own z, head at the terreplein's inner edge.
      {const LAD=new THREE.Group();
       LAD.position.set(0,0,WALL_LADDER_Z-0.35); LAD.rotation.x=0.16;
       const wood=texturedMat("wood",P.timber);
       for(const ls of [-1,1]){
         const rail=new THREE.Mesh(new THREE.BoxGeometry(0.15,4.9,0.15),wood);
         rail.position.set(ls*0.42,2.45,0); rail.castShadow=true; LAD.add(rail);
       }
       for(let i=0;i<7;i++){
         const rung=new THREE.Mesh(new THREE.BoxGeometry(0.99,0.11,0.11),wood);
         rung.position.set(0,0.55+i*0.65,0); rung.castShadow=false; LAD.add(rung);
       }
       g.add(LAD);}
    }else{
      // §F.5 THE MEDIEVAL FORTIFIED WALL. "TALL AND THIN IS CORRECT FOR THIS AGE" — height beats
      // ladders and every siege answer is still muscle-powered. Sloping batter at the base,
      // alternating merlons and crenels, arrow loops through the merlons, machicolations on the
      // exposed stretches.
      const wmat=texturedMat("metal",P.stone);
      const h=9.4;
      // v131.28 ROTATE THE GEOMETRY, THEN SCALE THE MESH — NOT THE OTHER WAY ROUND. This was
      // `bat.rotation.y=Math.PI/4; bat.scale.x=6.25/1.7`, and r128 composes T·R·S, so the 3.68x
      // stretch was applied in the mesh's own axes and the yaw then swung it: a 12.5-long rhombic
      // prism lying at 45 degrees ACROSS the wall, corners at (+-4.42,-+4.42), standing 3.1 past a
      // collider 1.30 half-wide — and it is the only ground-level mass a Medieval wall has, so it
      // is the part a body walks into. Baking the turn into the geometry puts the stretch on the
      // wall's own long axis, where it was always meant to be.
      // v131.33 …AND THE FIX ABOVE LEFT A HOLE AT EVERY JOINT, WHICH IS JOHN'S "medieval walls
      // still have gaps in the bottom". Rotating the geometry was right; keeping `scale.x=6.25/1.7`
      // with it was not. That factor was calibrated against the RAW 4-gon, whose extreme vertex sits
      // on +X at radius r — so 6.25/1.7 put it at 6.25 and the batter spanned the segment's full
      // 12.5. After rotateY(PI/4) the extreme vertex is at r·cos45 = 0.707r, so the same factor
      // gives a half-length of 4.42 and a batter 8.84 long under a 12.5 wall. Segments chain at
      // 10.9, so every joint carried a 2.1 hole at grade widening to 4.2 at the knee, because the
      // frustum tapers in X as well as in Z. Measured before the fix (tools/wallbase.js):
      // 22.5% see-through at grade, 34.7% at knee, 25.7% at shoulder.
      //
      // A BATTER IS NOT A TAPERED BOX IN PLAN — IT IS FULL LENGTH TOP AND BOTTOM AND ONLY THICKENS
      // TOWARD THE GROUND. No single mesh scale can express that, because a cone frustum tapers on
      // both axes at once, so the length is set PER VERTEX after the turn: every rim vertex goes to
      // +-6.25 and only the thickness keeps the frustum's taper. Thickness runs 1.00 at the top —
      // flush with the segment box above it, which is 2 deep — out to 1.35 at grade, so the flare
      // reads without standing proud of the 1.30 the wall collider uses.
      const BAT_HL=6.25, BAT_TOP=1.00, BAT_BOT=1.35, K=Math.SQRT1_2;
      const _batG=new THREE.CylinderGeometry(BAT_TOP/K,BAT_BOT/K,2.6,4).toNonIndexed();
      _batG.rotateY(Math.PI/4);
      {const P=_batG.attributes.position;
       for(let i=0;i<P.count;i++){const x=P.getX(i);
         if(Math.abs(x)>1e-4)P.setX(i,x>0?BAT_HL:-BAT_HL);}}
      _batG.computeVertexNormals();   // non-indexed first, so this facets rather than smooths (§G.1)
      const bat=new THREE.Mesh(_batG,wmat);                                      // the batter
      bat.position.y=1.3; bat.castShadow=true; g.add(bat);
      const seg=new THREE.Mesh(new THREE.BoxGeometry(12.5,h-2.4,2),wmat);
      seg.position.y=2.6+(h-2.4)/2; seg.castShadow=true; seg.receiveShadow=true; g.add(seg);
      const mach=box(12.5,0.7,2.7,STONEDK); mach.castShadow=false; mach.position.y=h-0.9; g.add(mach);
      for(let i=0;i<7;i++){                                   // merlons ALTERNATING with crenels
        const cren=new THREE.Mesh(new THREE.BoxGeometry(1.0,1.3,2),wmat);
        cren.position.set(-5.4+i*1.8,h+0.35,0); cren.castShadow=false; g.add(cren);
        const loop=box(0.2,0.6,0.14,P.dark); loop.castShadow=false;
        loop.position.set(-5.4+i*1.8,h+0.35,1.05); g.add(loop);      // the arrow loop THROUGH it
      }
      const ban=box(1.2,1.8,0.1,tc); ban.castShadow=false; ban.position.set(0,h-2.6,1.15); g.add(ban);
    }
  }else if(type==="wood_gate"||type==="stone_gate"||type==="fort_gate"){
    // v132.15 A DOOR THAT IS OPEN, WHICH NONE OF THEM WERE. Every gate in the game drew its leaves
    // shut across the passage — 0.20 clear on the wood gate, 0.23 at age 5 — and units walked
    // through solid oak at every age. A leaf is hinged at the JAMB and swings back into the
    // passage: the group's origin is the hinge, the leaf hangs off it by half its own width, and
    // the group turns. Opened rather than deleted, because a gateway with no leaves is a hole in a
    // wall while a gateway with its leaves folded back is a gate somebody opened — and it keeps
    // the ironwork on the model where §F.3 and §F.5 want it.
    const _gateLeaves=(grp,hingeX,z,lw,lh,th,mat,strapMat)=>{
      for(const s of [-1,1]){
        const hinge=new THREE.Group();
        hinge.position.set(s*hingeX,0,z);
        // v132.16 83 DEGREES, NOT 110. A leaf hangs off its hinge along local +x, and rotation.y
        // maps that to (cos t, -sin t): at 1.92 the cosine is NEGATIVE, so the far end swings back
        // ACROSS the gateway — hinged at 4.0 it landed at 2.83 and took 2.5 off the passage. Doors
        // that open inward are still doors in the way. At 1.45 the far end is at 4.41, outboard of
        // its own hinge, and the leaf lies along the reveal where an opened door belongs.
        hinge.rotation.y=s*1.45;              // 83 deg: laid back along the reveal, clear of it
        const leaf=box(lw,lh,th,mat); leaf.castShadow=false;
        leaf.position.set(s*lw/2,lh/2,0); hinge.add(leaf);
        if(strapMat!==undefined)for(const by of [0.3,0.66]){
          const st=box(lw,0.2,th*0.45,strapMat); st.castShadow=false;
          st.position.set(s*lw/2,lh*by,th*0.8); hinge.add(st);
        }
        grp.add(hinge);
      }
    };
    // Same ladder, same owner ruling (§0a.1): a stone_gate at age 4 or 5 builds the fortified form.
    const rung=(type==="wood_gate")?"wood":(type==="fort_gate"||age>=4)?"fort":"stone";
    if(rung==="wood"){
      // §F.3 the INTURNED PASSAGE (Iron), §F.5 HOARDING BOARDS over the face (Medieval),
      // §F.6 two squared BLOCKHOUSES and a flagstaff (Enlightenment).
      const squared=age>=5, hoard=age===4;
      const tim=texturedMat("wood",P.timber);
      // v132.16 8.4, NOT 6.6. The lintel hangs 1.7 deep off the top, so at 6.6 its underside sat at
      // 4.90 — and a Club Man is 5.43 tall, a Knight 5.49 and an Ox Cart 6.18. Everything that used
      // this gate walked its head through the beam. 8.4 puts the underside at 6.70, which clears the
      // cart. Width was only half of "will it walk through it"; this is the other half.
      // v132.19 11.4. The lintel hangs 1.7 deep off the top so the underside is h-1.7: at 8.4 that
      // was 6.70, and a Cannon is 8.29 tall, a Catapult 9.26. 11.0 gave 9.30 — four hundredths over
      // the catapult, which is a coincidence and not a clearance. 11.4 gives 9.70.
      const h=11.4;
      for(const px of [-5.4,5.4]){
        const t=new THREE.Mesh(new THREE.BoxGeometry(2.8,h,squared?3.2:2.8),tim);
        t.position.set(px,h/2,0); t.castShadow=true; t.receiveShadow=true; g.add(t);
        if(squared){ // the overhanging upper story with loopholes
          const up=new THREE.Mesh(new THREE.BoxGeometry(3.6,1.9,4.0),tim);
          up.position.set(px,h+0.95,0); up.castShadow=true; g.add(up);
          for(const s of [-1,1]){const lp=box(0.22,0.5,0.16,P.dark); lp.castShadow=false;
            lp.position.set(px+s*0.9,h+1.0,2.05); g.add(lp);}
        }else if(hoard){ // hoarding boards: a timber gallery projecting out over the wall face
          const hb=new THREE.Mesh(new THREE.BoxGeometry(3.2,1.5,4.2),tim);
          hb.position.set(px,h+0.75,0.9); hb.castShadow=true; g.add(hb);
          for(let i=0;i<3;i++){const sl=box(0.7,0.16,0.5,P.dark); sl.castShadow=false;
            sl.position.set(px-0.9+i*0.9,h+0.02,2.7); g.add(sl);}    // the drop slots underneath
          const cap=cone(2.2,1.6,0x6b4a2b,4); cap.castShadow=false; cap.position.set(px,h+2.3,0.9); g.add(cap);
        }else{const tip=cone(1.0,1.5,0x6b4a2b,5); tip.castShadow=false; tip.position.set(px,h+0.7,0); g.add(tip);}
      }
      const lintel=new THREE.Mesh(new THREE.BoxGeometry(13,1.7,2.2),tim);
      lintel.position.y=h-0.85; lintel.castShadow=true; g.add(lintel);
      // v132.15 THE OAK LEAVES, OPEN. They were 2.9 wide at x = +-1.55, i.e. spanning +-(0.1..3.0)
      // across an opening the towers leave 8.0 wide — 0.20 of daylight, and every unit in the game
      // walked through them. Hinged at the tower faces (+-4.0) and swung back, the mesh finally
      // says what the collider always did.
      _gateLeaves(g,4.0,0.9,3.4,h-2.6,0.24,0x5A4630,STONEDK);
      if(squared){flagPole(g,0,h+2.0,0,3.2,tc,1.8,1.0);}
      else{const ban=box(1.8,1.1,0.09,tc); ban.castShadow=false; ban.position.set(0,h+0.6,0); g.add(ban);}
      if(age<=2){ // the inturned entrance: the passage walls fold back into a killing corridor
        // v132.15 …AT +-4.7, NOT +-3.2. At 3.2 with a 1.4 width they spanned +-(2.5..3.9) and
        // pinched the passage to 5.0 behind the doors — the corridor was narrower than the gate it
        // defends, which is a killing corridor for your own siege train. Aligned with the towers'
        // inner faces so the passage is one width from front to back.
        for(const s of [-1,1]){const inw=new THREE.Mesh(new THREE.BoxGeometry(1.4,h-1.4,4.6),tim);
          inw.position.set(s*4.7,(h-1.4)/2,-3.2); inw.castShadow=true; g.add(inw);}
      }
    }else if(rung==="stone"){
      // §F.4 PORTA NIGRA, the showpiece of the Classical set: twin FOUR-STORY towers projecting
      // as near-semicircles, rusticated unfinished block faces, a double passage. The round towers
      // are the building's identity and they survive the ladder.
      const wmat=texturedMat("metal",STONELIT);
      // v132.19 11.4: the lintel is 2.0 deep at h-1.0, so the underside is h-2.0 = 9.40.
      const h=11.4;
      // v132.15 THE DRUMS SLIM AND STEP OUT. 2.5/2.7 at +-5.2 left inner faces at +-2.5 and a 5.0
      // passage before the jambs below cut it to 1.6. 2.0/2.2 at +-6.0 leaves +-4.0 — GATE_PASS
      // with room — and the gate ends up 16.4 overall against the 15.4 it already was, so nothing
      // about how a gate sits in a wall line changes.
      for(const px of [-6.0,6.0]){
        const t=new THREE.Mesh(new THREE.CylinderGeometry(2.0,2.2,h,9,1,false,Math.PI*0.5,Math.PI*1.5),wmat);
        t.position.set(px,h/2,0.4); t.castShadow=true; t.receiveShadow=true; g.add(t);
        // v132.16 4.6, NOT 5.4. The bands are the drum's storeys and they have to be the drum's
        // SIZE: slimming it from 2.5/2.7 to 2.0/2.2 and leaving 5.4-wide bands left them standing
        // 0.5 proud of the tower on the passage side, and THEY became the pinch at 6.6 — a catapult
        // is 6.53. Sized off the drum, so the next time it moves they move.
        for(let s=0;s<4;s++){const bandy=box(4.6,0.22,4.6,P.stone); bandy.castShadow=false;
          bandy.position.set(px,1.9+s*2.2,0.4); g.add(bandy);}       // the four stories, banded
        for(let s=0;s<3;s++){const arc=box(0.7,1.3,0.3,P.dark); arc.castShadow=false;
          arc.position.set(px,2.7+s*2.2,3.0); g.add(arc);}            // arched windows
        const cap=box(5.2,0.5,5.2,P.roof); cap.castShadow=false; cap.position.set(px,h+0.25,0.4); g.add(cap);
      }
      const lintel=new THREE.Mesh(new THREE.BoxGeometry(12.4,2.0,2.4),wmat);
      lintel.position.y=h-1.0; lintel.castShadow=true; g.add(lintel);
      // v132.15 ONE ARCH, NOT TWO. §F.4's "double passage" is the historically right note and it is
      // what sealed this gate: two jambs 3.0 wide at x = +-2.3 span +-(0.8..3.8), leaving 1.6 down
      // the middle — narrower than a VILLAGER at 2.30, let alone the catapult at 6.53 the owner
      // asked to get through. Twin passages cannot be widened without pushing the drums past the
      // curtain, so the Classical gate keeps its round towers, its banding and its rustication —
      // the things §F.4 calls its identity — and gives up the pair of arches.
      // v132.16 THE REVEAL GOES ROUND THE OPENING, NOT ACROSS IT. v132.15 replaced the two 3.0-wide
      // jambs with ONE GATE_PASS-wide slab and re-sealed the gate at 0.88 — the dark panel that is
      // supposed to read as the inside of an arch was drawn over the whole doorway. Two narrow
      // jambs at the passage edges and a head band above it frame the opening and stand outside it.
      // …and the head band sits UNDER THE LINTEL, not at head height. At y=6.6 it spanned 6.2..7.0
      // and became the Classical gate's ceiling at 6.20 — against an Ox Cart 6.18 tall, which is
      // 0.02 of clearance and not a margin. 7.2 puts it at 6.80..7.60, flush with the lintel's
      // underside, where a reveal head belongs.
      // v132.19 the reveal grows with the gate: jambs to the lintel's underside at 9.40, head band
      // flush above it rather than hanging into the opening.
      for(const s of [-1,1]){const jb=box(0.6,9.4,0.4,P.dark); jb.castShadow=false;
        jb.position.set(s*(GATE_PASS/2+0.3),4.7,1.15); g.add(jb);}
      {const hd=box(GATE_PASS+1.2,0.7,0.4,P.dark); hd.castShadow=false;
       hd.position.set(0,9.75,1.15); g.add(hd);}
      const ban=box(1.8,1.1,0.09,tc); ban.castShadow=false; ban.position.set(0,h+0.7,1.2); g.add(ban);
    }else if(age>=5){
      // §F.6 — the gate is "often the only decorative masonry on the whole enceinte", a classical
      // rusticated PORTAL through a low rampart, reached across the ditch by a bridge. The siting
      // rule (a gate goes in a curtain face, never in a bastion) is a placement rule, not a mesh
      // one, but the low silhouette is this mesh's job: nothing here stands above 5.6.
      // v132.15 PGAP IS GATE_PASS NOW, and the piers slim from 2.5 to 2.2 to pay for it: the
      // lintel spans PGAP + 2*PW + 0.4, which at 7.8 and 2.2 is 12.6 against the 12.5 curtain
      // segment this gate splits. This is the ONE gate genuinely boxed in — the others simply
      // stepped their drums outward, because a gatehouse already stands wider than a curtain.
      // v132.19 11.8 AND DEEPER PIERS. John: "enlightenment age gate is tiny compared to cannone."
      // The lintel is 1.3 deep at GH-0.65, so the underside is GH-1.95 = 9.85. Piers 3.0 -> 3.6 deep
      // because height alone makes a tall thin frame and his word was "tiny" — mass reads as much as
      // height. Both stay inside the 12.5 curtain segment in plan, so wall placement is untouched,
      // and §F.6's low rampart with a monumental portal rising out of it is the contrast this
      // branch's own note argues for. It is now monumental rather than merely taller than a rampart.
      const GH=11.8, PW=2.2, PGAP=GATE_PASS;     // gatehouse height, pier width, clear passage
      // >>> v131.28 THE RAMPART IS SPLIT AROUND THE PASSAGE, AND UNTIL NOW IT WAS NOT. <<<
      // These two boxes were 12.5 wide and ran straight across the opening: rev topping out at 3.53
      // and core at 3.60, against a body 2.6 tall. The 3.4-wide "clear passage" the piers make was
      // a window starting 3.5 above the ground — you could see through this gate and not walk
      // through it, which is a worse failure than the solid slab it replaced, because it lies.
      // Nobody caught it because your own gate has no collider (05-combat.js) and the only probe
      // that walks a gate walks its OWNER through it.
      // Halved at exactly the offset the terreplein below already uses, so the three parts of this
      // gate that have to line up now do so by construction instead of by coincidence.
      const RHW=(12.5-PGAP)/2, ROFF=PGAP/2+RHW/2;
      for(const s of [-1,1]){
        const rev=new THREE.Mesh(new THREE.BoxGeometry(RHW,3.4,2.4),aWall(age));
        rev.rotation.x=-0.12; rev.position.set(s*ROFF,1.7,0.4); rev.castShadow=true; rev.receiveShadow=true; g.add(rev);
        const core=box(RHW,3.6,3.4,0x7a6a4a); core.castShadow=false; core.position.set(s*ROFF,1.8,-2.0); g.add(core);
      }
      // v131.25 JOHN, TWICE: "enlightenment fortified gate in general needs to be taller similar to
      // medieval fortified gate", and "gate solid and visually looks like you should not be able to
      // pass through it fix this". Both were literally true. The portal was ONE SOLID BOX
      // (5.2 x 5.0 x 2.9) with a flat dark disc and a flat dark slab stuck on its front face —
      // there was no opening anywhere in the mesh, and nothing on the gate stood above 5.6 while
      // the Medieval gatehouse it is supposed to succeed reaches 10.4.
      //
      // A MONUMENTAL GATE ON A LOW RAMPART IS THE HISTORICALLY RIGHT ANSWER, which is the happy
      // part: §F.6 already calls the gate "often the only decorative masonry on the whole
      // enceinte", and Vauban's gates ARE architectural set pieces standing proud of a curtain
      // deliberately kept flat. So the rampart keeps its low silhouette and the gatehouse rises
      // out of it — the contrast is the point, not a violation of it.
      //
      // AND IT IS BUILT AS A PASSAGE, NOT AS A FACE WITH A PICTURE OF ONE. Two piers with a real
      // gap between them, a lintel across, and the leaves set BACK inside the reveal so the
      // opening has visible depth from any angle. You can see through it, which is the only way a
      // player believes he can walk through it.
      // v131.28 THE SHAFTS ARE THE CURTAIN'S OWN ASHLAR, THE BANDS ARE THE BRICK. Built from
      // P.stone (BPAL[5] #9E5744, luma 0.395) the whole gatehouse was red brick against a #D2C8B4
      // rampart at luma 0.787 — 0.39 of value and a hue flip, so the gate read as a different
      // building set down in the wall. aWall(age) is the SAME CALL the curtain makes, so the two
      // cannot drift apart again; the rustication courses below keep the brick, which is what a
      // rusticated portal is and where the contrast belongs.
      for(const s of [-1,1]){
        const pier=new THREE.Mesh(new THREE.BoxGeometry(PW,GH,3.6),aWall(age));
        pier.position.set(s*(PGAP/2+PW/2),GH/2,0.4); pier.castShadow=true; pier.receiveShadow=true; g.add(pier);
        for(let i=0;i<7;i++){const rust=box(PW+0.2,0.3,3.2,_dk(P.stone,0.14)); rust.castShadow=false;
          rust.position.set(s*(PGAP/2+PW/2),0.9+i*1.2,0.4); g.add(rust);}   // rustication, per pier
      }
      const lint=new THREE.Mesh(new THREE.BoxGeometry(PGAP+2*PW+0.4,1.3,3.2),aWall(age));
      lint.position.set(0,GH-0.65,0.4); lint.castShadow=true; g.add(lint);
      // the reveal: a recessed head to the passage, set back from the front face so the opening
      // reads as a tunnel with depth rather than as a disc painted on a wall
      // v132.16 A BAND, NOT A DISC. This was a cylinder of radius PGAP/2 laid face-on: at PGAP 3.4
      // it spanned y 6.4..8.1 and nobody noticed, and at 7.8 it spans 4.2..12.0 and seals the
      // gateway from chest height up. Any decoration whose SIZE is tied to the passage will
      // eventually grow across the passage; a band cannot.
      const head=box(PGAP+0.6,0.7,0.5,_dk(P.stone,0.22)); head.castShadow=false;
      head.position.set(0,GH-1.75,0.1); g.add(head);
      // v132.15 THE LEAVES, ACTUALLY OPEN. "Left ajar" was a 0.22 rad YAW on a pair of leaves that
      // still met in the middle — it angled them without opening them, and the measured daylight
      // between them was 0.23. v131.25 fixed "the gate looks solid" as far as the reveal and this
      // is the rest of that same defect. Hinged at the jambs and folded back, like every other gate.
      _gateLeaves(g,PGAP/2,-0.55,PGAP/2-0.1,GH-2.6,0.22,P.dark);
      // v132.19 THE CEILING OF THIS GATE WAS A COAT OF ARMS. The lintel underside gives 9.85; the
      // 6.75 gatefit measured was this 0.9-tall plaque at GH-2.2, hanging in front of the opening.
      // Third time in this block that a decorative box has turned out to be the thing in the way.
      const arms=box(1.5,0.9,0.2,GOLD); arms.castShadow=false; arms.position.set(0,GH-1.2,2.35); g.add(arms);
      const bridge=box(PGAP,0.34,4.6,PLANK); bridge.castShadow=false; bridge.position.set(0,1.0,4.4); g.add(bridge);
      const ban=box(1.4,0.9,0.1,tc); ban.castShadow=false; ban.position.set(0,GH+0.6,0.6); g.add(ban);
      // AND THE WALKWAY RUNS THROUGH. The age-5 curtain carries a terreplein at 4.00 (see the wall
      // branch) and this gate had none at all, so a walkway would have ended at every gate — which
      // is the exact defect that ruled the Medieval gate out of being walkable in the first place.
      // Same height, same depth, split either side of the passage.
      for(const s of [-1,1]){
        const gt=box((12.5-PGAP)/2,0.6,4.4,0x8a7a58); gt.castShadow=false;
        gt.position.set(s*(PGAP/2+(12.5-PGAP)/4),3.7,-1.2); g.add(gt);
      }
      // v132.16 AND IT NO LONGER BRIDGES THE PASSAGE. v131.28 floored the gateway at deck height —
      // a 0.6 slab at y=3.7 — for a stated reason: "leaving the gateway open at deck level would
      // walk the player over the opening on nothing." The premise was that you can walk over a
      // gate, and that premise is John's other bug: "it is treating the gate as another mountable
      // wall so you have this weird condition where units CLIMB OVER the gate to get through it."
      // A gate is the way THROUGH a wall. wallFloorAt returns null for gates now, nothing walks
      // over the passage, and so nothing has to floor it — which also gives the passage back the
      // 5 units of headroom that slab was taking. One fix, both bugs.
      // The flanking stubs above stay: the curtain's walk runs up to the gatehouse and stops there,
      // which is what a walk meeting a tower has always done.
    }else{
      // §F.5 THE GREAT TWIN-TOWERED GATEHOUSE, and by this period the gatehouse and not the keep
      // is the strongest part of a castle: two projecting DRUM towers, a vaulted passage between
      // them, an iron-shod portcullis dropping in vertical stone grooves, MURDER HOLES in the
      // vault above, and a drawbridge on chains. None of those four appear on the Classical gate —
      // §F.5 is explicit that they are this rung's upgrade and must not leak downward.
      const wmat=texturedMat("metal",P.stone);
      // v132.19 11.8: the vault is 2.4 deep at h-1.2, so the underside is h-2.4 = 9.40.
      const h=11.8;
      // v132.15 THE DRUMS SLIM AND STEP OUT, same move as the Classical gate one rung down. 2.6/3.0
      // at +-5.0 put the inner faces at +-2.0 — a 4.0 passage on the rung §F.5 calls the strongest
      // part of a castle, and the one an army's siege train has to leave through. 2.2/2.5 at +-6.4
      // leaves +-3.9, and the gate is 17.8 overall against 16.0, so it still sits in a wall line
      // the way it always did.
      for(const px of [-6.4,6.4]){
        const t=new THREE.Mesh(new THREE.CylinderGeometry(2.2,2.5,h,10),wmat);
        t.position.set(px,h/2,0.8); t.castShadow=true; t.receiveShadow=true; g.add(t);
        for(let i=0;i<7;i++){const a=i*Math.PI/3.4-0.6;
          const mer=box(1.1,1.2,1.0,P.stone); mer.castShadow=false;
          mer.position.set(px+Math.sin(a)*2.3,h+0.6,0.8+Math.cos(a)*2.3); mer.rotation.y=-a; g.add(mer);}
        for(const sy of [3.4,6.6]){const loop=box(0.24,1.1,0.2,P.dark); loop.castShadow=false;
          loop.position.set(px,sy,3.6); g.add(loop);}
      }
      const vault=new THREE.Mesh(new THREE.BoxGeometry(13.2,2.4,3.2),wmat);
      vault.position.y=h-1.2; vault.castShadow=true; g.add(vault);
      for(let i=0;i<4;i++){const mh=box(0.4,0.3,0.4,P.dark); mh.castShadow=false;
        mh.position.set(-1.8+i*1.2,h-2.35,0.6); g.add(mh);}          // MURDER HOLES in the vault
      // v132.15 THE GROOVES, THE BARS AND THE VAULT ALL MOVE WITH THE PASSAGE. Widening the drums
      // and leaving these where they were would have re-sealed the gate 0.6 further in — the
      // grooves alone stood at +-2.6 and left 4.86. Every one of them is written off GATE_PASS now,
      // so the next time it moves they follow instead of quietly strangling the opening again.
      for(const s of [-1,1]){const grv=box(0.34,h-2.4,0.5,_dk(P.stone,0.2)); grv.castShadow=false;
        grv.position.set(s*(GATE_PASS/2+0.17),(h-2.4)/2,1.55); g.add(grv);}   // the portcullis grooves
      // …AND THE RAISED PORTCULLIS RIDES HIGHER. Its bars hung with their bottoms at 5.30 against
      // a body 5.43 tall: raised, and still decapitating the infantry. h-2.4 puts them at 6.50.
      // v132.19 …AND IT HAS TO BE RAISED INTO THE VAULT, not merely called raised. 3.0-tall bars at
      // h-2.4 hang from 7.90 once the vault rises — a "raised" portcullis still taking the head off
      // anything over 7.90. 2.2 at h-1.2 puts them at 9.50..11.70, inside the vault, which is where
      // a retracted portcullis physically goes.
      {const NB=13, sp=GATE_PASS/(NB-1);
       for(let i=0;i<NB;i++){const bar=box(0.22,2.2,0.16,STONEDK); bar.castShadow=false;
         bar.position.set(-GATE_PASS/2+i*sp,h-1.2,1.5); g.add(bar);}}        // the raised portcullis
      // §F.5's drawbridge, DOWN. rotation.x=-0.28 left the leaf's far underside at 1.90 and its
      // near underside at 0.57 with nothing under either — John's "sits partially up". A leaf lying
      // flat: 0.34 thick resting on grade puts its centre at 0.34/2=0.17, and the hinge belongs on
      // the face of the portcullis grooves, z=1.55+0.5/2=1.80, so the centre is 1.80+4.8/2=4.20,
      // the lifting end is z=6.60 and the deck top is 0.17+0.17=0.34.
      const draw=box(GATE_PASS,0.34,4.8,0x5A4630); draw.castShadow=false;
      draw.position.set(0,0.17,4.20); g.add(draw);
      // THE CHAINS, and now both ends land on something. Top: the head of the passage, i.e. the
      // vault's bottom-front edge — y=9.2-2.4/2=8.00, z=0+3.2/2=1.60. Bottom: the leaf's lifting
      // end — y=0.34, z=6.60. dy=8.00-0.34=7.66 and dz=6.60-1.60=5.00, so the chain is
      // sqrt(7.66^2+5.00^2)=9.147 long — 9.15 here, and the 0.003 of overshoot is bite, not gap —
      // centred at ((8.00+0.34)/2,(1.60+6.60)/2)=(4.17,4.10) and tilted -atan2(5.00,7.66)=-0.5783,
      // NEGATIVE because +rotation.x carries the cylinder's +Y end toward +Z and the head end has
      // to lean back toward the gate. x=+/-1.7 is 0.1 inside the leaf's 3.6/2 edge and clear of the
      // grooves at +/-2.6. Was a 4.6 stick from (y2.08,z1.30) to (y6.12,z3.50): neither end touched
      // the gate or the leaf.
      for(const s of [-1,1]){const ch=cyl(0.07,0.07,9.15,STONEDK,4); ch.rotation.x=-0.5783; ch.castShadow=false;
        ch.position.set(s*(GATE_PASS/2-0.1),4.17,4.10); g.add(ch);}   // the chains, on the leaf's edges
      const ban=box(1.8,1.2,0.09,tc); ban.castShadow=false; ban.position.set(0,h+0.4,1.7); g.add(ban);
    }
  }else if(type==="castle"){
    // ======= CASTLE -> BASTION, AGES §F.5 and §F.6 =======
    // BLD.castle.age is 4, so this only ever builds in two ages, and the two are the clearest
    // before/after in the whole document:
    //   4 CONCENTRIC, Edward I generation: two rings of curtain wall with the INNER RISING ABOVE
    //     THE OUTER so both can shoot at once, round mural towers at the angles, a moat, and — the
    //     thing §F.5 calls critical — a GREAT TWIN-TOWERED GATEHOUSE as the primary strongpoint,
    //     because by this period the gatehouse and not the keep is the strongest part of a castle.
    //   5 THE STAR FORT: DIAMOND-SHAPED BASTIONS at each corner replace round towers, a sloped
    //     earth GLACIS in front of the ditch, and a broad terreplein instead of a roof.
    //     "The trade is firepower for height, AND THE DROP IN HEIGHT IS THE UPGRADE."
    // Measured off the render, the age-4 castle stands 24.6 and the age-5 one 9.4. That inversion
    // is the age, and any future pass that makes the star fort taller has undone it.
    if(age<=4){
      const moat=cyl(19.5,20.5,0.8,0x3f5f6a,16); moat.castShadow=false; moat.receiveShadow=true;
      moat.position.y=0.2; g.add(moat);
      const ward=cyl(17.0,17.6,1.0,_dk(P.stone,0.12),16); ward.castShadow=false; ward.position.y=0.5; g.add(ward);
      // THE OUTER RING, low
      for(let i=0;i<8;i++){const a=i*Math.PI/4+Math.PI/8;
        // JOHN, on two screenshots: "medieval castle walls at odd angles same with head stone
        // pieces". The yaw was -a and it has to be +a. This ring places at (sin a, cos a)*15.4, so
        // its outward radial is (sin a, 0, cos a); three.js Ry(t) sends local +Z to (sin t, 0, cos t)
        // (measured live: Ry(0.7) -> (0.64422, 0.76484) == (sin .7, cos .7)). The slab's 1.8 is its
        // THICKNESS and must lie on that radial, so yaw = a. Proof the -a was a typo and not a
        // choice: the merlon row below is already laid out along (cos a, -sin a), which
        // IS Ry(+a) applied to local +X. The positions used +a and only the rotations used -a.
        // At -a every face stood -2a out, folded to +/-45 on all EIGHT by the box's own 180-degree
        // symmetry (22.5 -> -45, 67.5 -> -135 == +45, and so on round the ring). Not one face was
        // square: the outer ring drew as a pinwheel, and four of the eight joints — the four
        // carrying the mural towers — opened a 4.92 gap, so it was not a curtain at all.
        // The head stones were on the TRUE tangent while their slab was 45 degrees off it, so the
        // end merlon's centre sat 4.8*sin(2a) out of the wall's own mid-plane; 2a is an odd
        // multiple of 45 on every one of the eight, so that is 4.8*0.7071 = 3.39 everywhere. The
        // wall is 1.8 thick and the merlon 1.8 deep, so 3.39 - 0.9 - 0.9 = 1.59 of open air between
        // the merlon and the face it crowns — daylight, not an AABB overlap.
        // Both go to +a together. Measured on the patched file: face error 0.000 deg on all eight,
        // merlon skew 0.000, off-plane 0.000, every joint gap 0.00. The slab corner radius drops
        // 21.26 -> 17.66 = hypot(15.4+0.9, 6.8), which is the number 00-data.js's own castle note
        // has always quoted ("16.3 to the outer face, 17.66 at the corners") — the data file was
        // already documenting the square wall while the render drew the pinwheel. It also stops the
        // curtain lying across its own moat: 21.26 was 0.76 past the moat's outer edge of 20.5.
        // Nothing vertical moves: top 27.00 and bbox 41.00 x 44.26 (moat and drawbridge) identical
        // before and after, so the 24.6-vs-9.4 age inversion above is untouched.
        const seg=new THREE.Mesh(new THREE.BoxGeometry(13.6,6.4,1.8),texturedMat("metal",P.stone));
        seg.position.set(Math.sin(a)*15.4,3.2,Math.cos(a)*15.4); seg.rotation.y=a;
        seg.castShadow=true; seg.receiveShadow=true; g.add(seg);
        for(let m=0;m<5;m++){const cr=box(1.2,1.2,1.8,P.stone); cr.castShadow=false;
          cr.position.set(Math.sin(a)*15.4+Math.cos(a)*(-4.8+m*2.4),6.8,Math.cos(a)*15.4-Math.sin(a)*(-4.8+m*2.4));
          cr.rotation.y=a; g.add(cr);}
      }
      for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;   // round mural towers at the ANGLES
        const tw=new THREE.Mesh(new THREE.CylinderGeometry(2.6,3.0,9.0,10),texturedMat("metal",P.stone));
        tw.position.set(Math.sin(a)*15.4,4.5,Math.cos(a)*15.4); tw.castShadow=true; tw.receiveShadow=true; g.add(tw);
        const cap=new THREE.Mesh(new THREE.ConeGeometry(3.4,4.0,10),texturedMat(P.roofPat,P.roof));
        cap.castShadow=true; cap.receiveShadow=true; cap.position.set(Math.sin(a)*15.4,11.0,Math.cos(a)*15.4); g.add(cap);
      }
      // THE INNER RING, RISING ABOVE THE OUTER — the concentric principle, and the whole reason
      // the outer wall above is deliberately six units short
      const inner=new THREE.Mesh(new THREE.BoxGeometry(15.4,12.6,15.4),texturedMat("metal",P.stone));
      inner.position.y=6.8; inner.castShadow=true; inner.receiveShadow=true; g.add(inner);
      const mach=box(16.6,0.9,16.6,STONEDK); mach.castShadow=false; mach.position.y=12.6; g.add(mach);
      for(let i=0;i<16;i++){const sl=box(0.5,0.34,0.5,P.dark); sl.castShadow=false;   // the floor slots
        sl.position.set(-7.5+ (i%4)*5.0,12.15,(i<8?-8.2:8.2)+(i%2)*0.0); g.add(sl);}
      for(let i=0;i<5;i++)for(const s of [-1,1]){
        const cr=box(1.5,1.5,1.5,P.stone); cr.castShadow=false; cr.position.set(-5.0+i*2.5,13.8,s*7.5); g.add(cr);
        const cr2=box(1.5,1.5,1.5,P.stone); cr2.castShadow=false; cr2.position.set(s*7.5,13.8,-5.0+i*2.5); g.add(cr2);}
      for(const [px,pz] of [[-7.7,-7.7],[7.7,-7.7],[-7.7,7.7],[7.7,7.7]]){
        const tw=new THREE.Mesh(new THREE.CylinderGeometry(2.5,2.8,17.4,10),texturedMat("metal",P.stone));
        tw.position.set(px,8.7,pz); tw.castShadow=true; tw.receiveShadow=true; g.add(tw);
        const cap=new THREE.Mesh(new THREE.ConeGeometry(3.4,4.8,10),texturedMat(P.roofPat,P.roof));
        cap.castShadow=true; cap.receiveShadow=true; cap.position.set(px,19.8,pz); g.add(cap);
        const fin=cyl(0.1,0.1,1.3,GOLD,4); fin.castShadow=false; fin.position.set(px,22.7,pz); g.add(fin);
      }
      // THE GREAT TWIN-TOWERED GATEHOUSE — §F.5's "primary strongpoint", so it is the tallest
      // thing on the south face and it out-masses the keep behind it
      for(const s of [-1,1]){
        const dr=new THREE.Mesh(new THREE.CylinderGeometry(2.6,3.0,15.0,10),texturedMat("metal",P.stone));
        dr.position.set(s*4.0,7.5,15.6); dr.castShadow=true; dr.receiveShadow=true; g.add(dr);
        for(let i=0;i<7;i++){const a=i*Math.PI/3.4-0.6;
          // Same sign error on the gatehouse head stones, same derivation: the merlon sits at
          // (sin a, cos a)*2.7 off the drum's axis, so its 1.0 depth is the radial one and its yaw
          // must be +a, not -a. At -a the seven ran -2a out and folded to a scatter of +68.8,
          // -37.1, +37.0, -68.9, +5.2, +79.3 and -26.5 degrees around ONE drum head — 1.1 x 1.0 in
          // plan is near-square, so a 45-degree merlon presents (1.1+1.0)/sqrt(2) = 1.49 instead of
          // 1.1 and the ring reads as head stones of different sizes at different angles. That is
          // John's second shot. At +a all fourteen measure 0.000.
          const mer=box(1.1,1.3,1.0,P.stone); mer.castShadow=false;
          mer.position.set(s*4.0+Math.sin(a)*2.7,15.6,15.6+Math.cos(a)*2.7); mer.rotation.y=a; g.add(mer);}
        for(const sy of [5.6,10.4]){const lo=box(0.26,1.2,0.22,P.dark); lo.castShadow=false;
          lo.position.set(s*4.0,sy,18.4); g.add(lo);}
      }
      const gvault=new THREE.Mesh(new THREE.BoxGeometry(8.6,3.0,3.4),texturedMat("metal",P.stone));
      gvault.position.set(0,13.0,15.6); gvault.castShadow=true; g.add(gvault);
      for(let i=0;i<4;i++){const mh=box(0.4,0.3,0.4,P.dark); mh.castShadow=false;
        mh.position.set(-1.8+i*1.2,11.45,15.2); g.add(mh);}                // murder holes
      for(let i=0;i<9;i++){const bar=box(0.22,3.2,0.16,STONEDK); bar.castShadow=false;
        bar.position.set(-2.4+i*0.6,9.4,17.2); g.add(bar);}                // the raised portcullis
      // THE DRAWBRIDGE, and the sign on it was inverted: +rotation.x carries the leaf's +Z end to
      // -Y, so -0.24 LIFTED the end away from the castle to y=2.09 and dropped the end at the gate
      // to y=0.76 — John's "angled the wrong way". It falls outward instead. Hinge on the ward rim
      // at the gate axis (ward=cyl(17.0,17.6,1.0) at y=0.5, so its top face is y=0.5+1.0/2=1.0 at
      // top radius 17.0, and the 16-gon carries a vertex at exactly (0,y,17.0)); land the far end
      // on grade. A 1.0 drop over a 5.6 leaf is rotation.x=asin(1.0/5.6)=+0.1795, cos=0.98393,
      // sin=0.17854, so the run is 5.6*0.98393=5.510 and the far underside lands at z=17.0+5.510
      // =22.510. The centre is the midpoint of the two underside ends plus half the thickness along
      // the leaf's normal: y=(1.000+0.000)/2+0.18*0.98393=0.500+0.177=0.677 and
      // z=(17.000+22.510)/2+0.18*0.17854=19.755+0.032=19.787. Reach SHRINKS — the far top corner
      // was 23.76 and is now 22.574 — so nothing that cleared the old leaf fouls this one, and the
      // near corners at x=+/-1.9 stop inside the gatehouse drums' base footprint rather than
      // overhanging open water.
      const draw=box(3.8,0.36,5.6,0x5A4630); draw.rotation.x=0.1795; draw.castShadow=false;
      draw.position.set(0,0.677,19.787); g.add(draw);
      const ban=box(2.8,1.9,0.14,tc); ban.castShadow=false; ban.position.set(0,14.6,17.4); g.add(ban);
      flagPole(g,0,23.0,0,4.0,tc,3.0,1.6);
    }else{
      // THE STAR FORT. Everything here is LOW on purpose. §F.6: "a LOW masonry revetment backed by
      // a deep earth core... the trade is firepower for height, and the drop in height IS the
      // upgrade." So the tallest thing on it is a sentry box.
      const glac=cyl(21.5,24.0,1.4,0x7f8a4e,16); glac.castShadow=false; glac.receiveShadow=true;
      glac.position.y=0.5; g.add(glac);                                    // the sloped GLACIS
      const ditch=cyl(18.6,19.6,0.9,0x6b6a4a,16); ditch.castShadow=false; ditch.position.y=0.3; g.add(ditch);
      const plat=new THREE.Mesh(new THREE.BoxGeometry(20,3.6,20),aWall(age));
      plat.position.y=1.8; plat.castShadow=true; plat.receiveShadow=true; g.add(plat);
      const terre=box(19.4,0.7,19.4,0x8a7a58); terre.castShadow=false; terre.position.y=3.9; g.add(terre);
      for(const s of [[0,10.0],[0,-10.0],[10.0,0],[-10.0,0]]){             // the curtain parapets
        const par=box(s[1]?20.6:1.1,1.5,s[1]?1.1:20.6,P.stone); par.castShadow=false;
        par.position.set(s[0],4.6,s[1]); g.add(par);
        for(let i=0;i<4;i++){                                              // embrasures cut through
          const emb=box(s[1]?1.6:1.3,1.0,s[1]?1.3:1.6,P.dark); emb.castShadow=false;
          emb.position.set(s[0]?s[0]:-6.6+i*4.4,5.0,s[1]?s[1]:-6.6+i*4.4); g.add(emb);}
      }
      // DIAMOND BASTIONS: four-sided, pointed outward at the salient, and they REPLACE the round
      // towers rather than sitting alongside them — no dead ground, every wall face swept.
      for(const [px,pz] of [[-10.6,-10.6],[10.6,-10.6],[-10.6,10.6],[10.6,10.6]]){
        const bast=new THREE.Mesh(new THREE.CylinderGeometry(4.0,5.4,3.8,4),aWall(age));
        bast.rotation.y=Math.atan2(px,pz);
        bast.position.set(px,1.9,pz); bast.castShadow=true; bast.receiveShadow=true; g.add(bast);
        const bpar=new THREE.Mesh(new THREE.CylinderGeometry(4.2,4.2,1.2,4),plainMat(P.stone));
        bpar.rotation.y=Math.atan2(px,pz);
        bpar.position.set(px,4.4,pz); bpar.castShadow=false; g.add(bpar);
        const gun=cyl(0.42,0.5,2.8,0x8A6A3A,8); gun.rotation.set(-0.30,Math.atan2(px,pz),0);
        gun.castShadow=false; gun.position.set(px*1.12,5.2,pz*1.12); g.add(gun);
        const sen=box(1.2,2.0,1.2,P.wall); sen.castShadow=true; sen.position.set(px*1.28,5.9,pz*1.28); g.add(sen);
        const scap=cone(1.0,0.9,P.roof,6); scap.castShadow=false; scap.position.set(px*1.28,7.3,pz*1.28); g.add(scap);
      }
      // the barrack block on the terreplein: low, brick, and NOT a keep
      const blk=new THREE.Mesh(new THREE.BoxGeometry(11.0,3.6,7.0),texturedMat("metal",BRICK));
      blk.position.y=6.0; blk.castShadow=true; blk.receiveShadow=true; g.add(blk);
      winGrid(g,4,1,6.4,0,3.57,P.dark,P.stone);
      const apex=ageRoof(g,5,11.0,7.0,7.8,type,{tc});
      const gate=box(3.2,3.0,0.4,P.dark); gate.castShadow=false; gate.position.set(0,3.0,10.06); g.add(gate);
      const portal=new THREE.Mesh(new THREE.BoxGeometry(5.0,4.4,1.4),texturedMat("metal",P.stone));
      portal.position.set(0,2.2,10.3); portal.castShadow=true; g.add(portal);
      const arms=box(1.4,0.9,0.2,GOLD); arms.castShadow=false; arms.position.set(0,4.9,11.0); g.add(arms);
      const bridge=box(3.6,0.34,7.0,PLANK); bridge.castShadow=false; bridge.position.set(0,1.0,15.0); g.add(bridge);
      flagPole(g,0,apex,0,3.6,tc,2.4,1.3);
    }
  }else if(type==="siege_workshop"){
    // ======= SIEGE WORKSHOP -> FOUNDRY, AGES §F.3-§F.6 =======
    // §F flags the workshop as historically nonexistent in three of its four ages — Assyrian and
    // medieval engines were built in the field and abandoned there — and asks for A CARPENTER'S
    // YARD, NOT A FACTORY: sawpits, trestles, a rope walk, a half-finished engine on blocks,
    // wheels leaning on the posts. The Roman fabrica is the one that is real (Inchtuthil, 3,500 m²,
    // 82-83 AD) and it gets forges venting smoke and finished shields racked in rows.
    // Age 5 replaces the whole thing with the FOUNDRY, and §F.6 is emphatic: "the first building
    // in the entire set that is recognizably INDUSTRIAL and it should feel like it."
    if(age>=5){
      const yard=box(15.0,0.5,12.4,_dk(P.stone,0.10)); yard.castShadow=false; yard.receiveShadow=true;
      yard.position.y=0.25; g.add(yard);
      const shed=new THREE.Mesh(new THREE.BoxGeometry(11.0,5.4,7.0),aWall(5));
      shed.position.set(-1.4,3.2,-2.4); shed.castShadow=true; shed.receiveShadow=true; g.add(shed);
      const sbase=new THREE.Mesh(new THREE.BoxGeometry(11.3,1.4,7.3),texturedMat("metal",BRICK));
      sbase.position.set(-1.4,1.2,-2.4); sbase.castShadow=true; g.add(sbase);
      for(const s2 of [-1,1]){const q=box(0.6,5.4,0.6,BRICK); q.castShadow=false;
        q.position.set(-1.4+s2*5.2,3.2,1.0); g.add(q);}
      const sub=new THREE.Group(); sub.position.set(-1.4,0,-2.4); g.add(sub);
      ageRoof(sub,5,11.0,7.0,6.0,type,{tc});
      // THE REVERBERATORY FURNACE and its two TALL BRICK CHIMNEYS — the industrial silhouette
      for(const cx of [-5.0,-2.6]){
        const ch=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.78,9.4,8),texturedMat("metal",BRICK));
        ch.position.set(cx,5.4,-4.4); ch.castShadow=true; ch.receiveShadow=true; g.add(ch);
        const cp=cyl(0.95,0.85,0.44,P.dark,8); cp.castShadow=false; cp.position.set(cx,10.3,-4.4); g.add(cp);
        const smk=cyl(0.7,1.1,1.8,0xa8a49a,7); smk.castShadow=false; smk.position.set(cx,11.5,-4.4); g.add(smk);
      }
      // THE CASTING PIT with a CRANE GANTRY over it — the thing that makes this a foundry
      const pit=box(4.4,0.6,4.0,P.dark); pit.castShadow=false; pit.position.set(4.2,0.6,3.6); g.add(pit);
      for(const s of [-1,1]){const leg=new THREE.Mesh(new THREE.BoxGeometry(0.5,6.2,0.5),
        texturedMat("wood",P.timber)); leg.position.set(4.2+s*2.6,3.4,3.6); leg.castShadow=true; g.add(leg);}
      const gan=new THREE.Mesh(new THREE.BoxGeometry(6.6,0.55,0.55),texturedMat("wood",P.timber));
      gan.position.set(4.2,6.7,3.6); gan.castShadow=true; g.add(gan);
      const hoist=cyl(0.06,0.06,3.0,0x9a8a6a,4); hoist.castShadow=false; hoist.position.set(4.2,5.1,3.6); g.add(hoist);
      const cruc=cyl(0.9,0.7,1.2,0x5a4a3a,8); cruc.castShadow=false; cruc.position.set(4.2,3.1,3.6); g.add(cruc);
      const glow=new THREE.Mesh(new THREE.PlaneGeometry(1.5,1.0),
        new THREE.MeshBasicMaterial({color:0xff7a2f}));
      glow.rotation.x=-Math.PI/2; glow.position.set(4.2,0.95,3.6); glow.castShadow=false; g.add(glow);
      // FINISHED BARRELS RACKED IN ROWS in the yard — §F.6's own dressing, and the read that says
      // this place makes GUNS and not siege towers
      for(let i=0;i<4;i++){
        const br=cyl(0.3,0.38,3.4,0x8A6A3A,8); br.rotation.z=Math.PI/2; br.castShadow=false;
        br.position.set(-4.0,1.0,4.4-i*0.9); g.add(br);
        const br2=cyl(0.28,0.34,3.4,0x8A6A3A,8); br2.rotation.z=Math.PI/2; br2.castShadow=false;
        br2.position.set(-4.0,1.68,4.0-i*0.9); if(i<3)g.add(br2);
      }
      for(const s of [-1,1]){const rk=box(0.3,1.6,4.6,P.timber); rk.castShadow=false;
        rk.position.set(-4.0+s*1.9,0.9,3.6); g.add(rk);}
      const ore=cone(1.4,1.6,0x4a4238,7); ore.castShadow=false; ore.position.set(6.4,1.0,-4.2); g.add(ore);
      const coal=cone(1.4,1.5,0x2a2622,7); coal.castShadow=false; coal.position.set(3.6,0.95,-5.2); g.add(coal);
      flagPole(g,-6.6,0.5,4.8,5.0,tc,2.0,1.1);
    }else{
      agedShell(g,age,tc,12,5.2,9.6,type);
      // the yard, which is the building: sawpit, trestles, a rope walk and the engine on blocks
      const pitp=box(3.4,0.4,1.6,P.dark); pitp.castShadow=false; pitp.position.set(-4.4,0.2,5.6); g.add(pitp);
      for(const s of [-1,1]){const tre=box(0.3,1.2,0.3,P.timber); tre.castShadow=false;
        tre.position.set(-4.4+s*1.4,0.8,5.6); g.add(tre);}
      const saw=box(3.8,0.5,0.16,P.timber); saw.castShadow=false; saw.position.set(-4.4,1.5,5.6); g.add(saw);
      const coil=new THREE.Mesh(new THREE.TorusGeometry(0.7,0.2,5,8),plainMat(0x9a8a6a));
      coil.rotation.x=Math.PI/2; coil.castShadow=false; coil.position.set(-2.0,0.24,7.4); g.add(coil);
      for(const rx of [-1.0,1.6]){const rp=cyl(0.13,0.15,1.6,P.timber,5); rp.castShadow=false;
        rp.position.set(rx,0.8,7.9); g.add(rp);}                        // the rope walk's posts
      const rope=cyl(0.08,0.08,2.6,0x9a8a6a,4); rope.rotation.z=Math.PI/2; rope.castShadow=false;
      rope.position.set(0.3,1.5,7.9); g.add(rope);
      // THE HALF-FINISHED ENGINE ON BLOCKS: a ram housing in the ancient ages, a trebuchet arm in
      // the medieval one. §F.3 and §F.5 name different engines and the difference is visible.
      for(const lx of [-2.4,2.4]){const bl=box(0.6,1.0,1.4,P.timber); bl.castShadow=false;
        bl.position.set(lx,0.5,5.4); g.add(bl);}
      if(age>=4){
        const armb=box(0.55,0.55,8.4,P.timber); armb.rotation.x=0.42; armb.castShadow=true;
        armb.position.set(0,2.4,5.4); g.add(armb);                       // the trebuchet arm
        const cw=box(1.5,1.5,1.5,STONEDK); cw.castShadow=false; cw.position.set(0,1.4,3.0); g.add(cw);
      }else{
        const log=cyl(0.64,0.64,6.8,P.timber,7); log.rotation.z=Math.PI/2; log.castShadow=true;
        log.position.set(0,1.7,5.4); g.add(log);                         // the ram, in its housing
        const hous=box(6.4,0.4,1.8,P.timber); hous.castShadow=false; hous.position.set(0,2.6,5.4); g.add(hous);
      }
      const wheel=cyl(1.8,1.8,0.36,P.timber,10); wheel.rotation.x=0.25; wheel.castShadow=true;
      wheel.position.set(5.2,2.0,5.2); g.add(wheel);
      const wheel2=cyl(1.4,1.4,0.32,P.timber,10); wheel2.rotation.x=0.18; wheel2.castShadow=false;
      wheel2.position.set(6.4,1.6,4.0); g.add(wheel2);
      for(let i=0;i<3;i++){const bm=cyl(0.24,0.24,5.6,P.timber,6); bm.rotation.z=Math.PI/2;
        bm.castShadow=false; bm.position.set(-3.0,0.3+i*0.5,-4.4+i*0.1); g.add(bm);}  // the beam stack
      if(age===3)for(let i=0;i<4;i++){ // §F.4's fabrica: finished shields RACKED IN ROWS
        const sh=cyl(0.8,0.8,0.14,i%2?tc:P.trim,10); sh.rotation.x=Math.PI/2-0.2; sh.castShadow=false;
        sh.position.set(3.0+i*1.0,1.5,-4.6); g.add(sh);}
    }
  }else if(type==="market"){
    // ===================== THE MARKET, AGES §F.4-§F.6 =====================
    // Only three ages have one (BLD.market.age = 3), and §F gives each a different PLAN, which is
    // rarer and more useful than a different colour:
    //   3 the MACELLUM — a circular columned THOLOS standing in a square colonnaded court. The
    //     only round-inside-square plan in the whole building set.
    //   4 OPEN BELOW, ENCLOSED ABOVE — an arcade you can see through with the guild room on top,
    //     and a stepped market cross alongside.
    //   5 the same open-below logic in classical dress, with a lead-coated CUPOLA. §F.6 calls that
    //     out as what makes it an UPGRADE of the medieval hall rather than a different building.
    if(age===3){
      const pod=new THREE.Mesh(new THREE.BoxGeometry(15.6,1.0,14.0),texturedMat("metal",P.stone));
      pod.position.y=0.5; pod.castShadow=true; g.add(pod);
      for(const [sx,sz,sw,sd] of [[0,-5.6,14.4,2.6],[-6.0,0.6,2.6,9.0],[6.0,0.6,2.6,9.0]]){
        const bay=new THREE.Mesh(new THREE.BoxGeometry(sw,4.4,sd),aWall(3));
        bay.position.set(sx,3.2,sz); bay.castShadow=true; bay.receiveShadow=true; g.add(bay);
        // the worst one in the whole sweep: three bays at (0,-5.6) and (+/-6.0,0.6), and three
        // IDENTICAL soffits welded on top of one another in the middle of the court, 6.03 from
        // the nearest wall they were meant to cover.
        const bsub=new THREE.Group(); bsub.position.set(sx,0,sz); g.add(bsub);
        ageRoof(bsub,3,sw,sd,5.4,type,{long:sw>sd?"x":"z",eave:0.12});
      }
      for(const px of [-5.2,-1.75,1.75,5.2])colAt(g,px,5.4,4.4,0.44,3);   // the court's own colonnade
      // colAt tops its capital at h+0.45, so this colonnade (h 4.4) ends at 4.85 and a 0.6-thick
      // lintel centres at 5.15 — not 6.2. It read as seated only because three misplaced bay roofs
      // were stacked in the court underneath it; moving them onto their bays exposed the 1.05 gap.
      const arch=box(12.4,0.6,1.6,P.stone); arch.castShadow=false; arch.position.set(0,5.15,5.4); g.add(arch);
      const frieze=box(12.6,0.3,1.8,tc); frieze.castShadow=false; frieze.position.set(0,5.60,5.4); g.add(frieze);
      // THE THOLOS: round, columned, conical tile roof, dead centre of a square court
      const step=cyl(3.6,3.9,0.5,P.stone,12); step.castShadow=false; step.position.set(0,1.25,0.4); g.add(step);
      for(let i=0;i<8;i++){const a=i*Math.PI/4;
        colAt(g,Math.sin(a)*2.7,0.4+Math.cos(a)*2.7,3.6,0.34,3);}
      // the tholos: eight columns at h 3.6 cap out at 4.05, so its entablature centres at 4.35.
      const tent=cyl(3.3,3.3,0.6,P.stone,12); tent.castShadow=false; tent.position.set(0,4.35,0.4); g.add(tent);
      const tcap=new THREE.Mesh(new THREE.ConeGeometry(3.9,2.6,12),texturedMat(P.roofPat,P.roof));
      tcap.castShadow=true; tcap.receiveShadow=true; tcap.position.set(0,5.95,0.4); g.add(tcap);
      const fin=cyl(0.14,0.14,1.0,GOLD,5); fin.castShadow=false; fin.position.set(0,7.75,0.4); g.add(fin);
      const basin=cyl(1.3,1.5,0.6,P.stone,10); basin.castShadow=false; basin.position.set(0,1.8,0.4); g.add(basin);
      for(let i=0;i<3;i++){const amp=cyl(0.5,0.34,1.3,0xb8603a,8); amp.castShadow=false;
        amp.position.set(-3.6+i*1.6,1.65,5.0); g.add(amp);}
    }else if(age===4){
      // OPEN BELOW: timber posts and NO WALLS on the trading floor, so you see straight through it.
      // That transparency is the read, and it is why the guild room above has to be solid.
      const pl=new THREE.Mesh(new THREE.BoxGeometry(13.4,0.7,10.6),texturedMat("metal",P.stone));
      pl.position.y=0.35; pl.castShadow=true; g.add(pl);
      for(const px of [-5.4,-1.8,1.8,5.4])for(const pz of [-4.0,4.0]){
        const post=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.4,4.4,6),texturedMat("wood",P.timber));
        post.position.set(px,2.9,pz); post.castShadow=true; g.add(post);
        const brk=box(0.9,0.5,0.28,P.timber); brk.castShadow=false; brk.position.set(px,4.9,pz*0.86); g.add(brk);
      }
      const floor=box(12.4,0.4,9.6,P.timber); floor.castShadow=false; floor.position.y=0.9; g.add(floor);
      const bres=new THREE.Mesh(new THREE.BoxGeometry(13.6,0.5,10.8),texturedMat("wood",P.timber));
      bres.castShadow=true; bres.position.y=5.4; g.add(bres);
      const guild=new THREE.Mesh(new THREE.BoxGeometry(12.8,3.6,10.0),aWall(4));
      guild.position.y=7.45; guild.castShadow=true; guild.receiveShadow=true; g.add(guild);
      for(const sx of [-1,1])for(const sz of [-1,1]){
        const post=box(0.42,3.6,0.42,P.timber); post.castShadow=false;
        post.position.set(sx*6.2,7.45,sz*4.8); g.add(post);}
      const beam=box(12.9,0.36,10.1,P.timber); beam.castShadow=false; beam.position.y=8.4; g.add(beam);
      ageRoof(g,4,12.8,10.0,9.25,type,{tc,long:"x"});
      for(let i=0;i<3;i++){const w=box(1.0,1.2,0.14,P.dark); w.castShadow=false;
        w.position.set(-3.2+i*3.2,7.6,5.06); g.add(w);}
      // the STEPPED MARKET CROSS alongside — a small, tall, unmistakable civic object
      for(let i=0;i<3;i++){const st=cyl(2.0-i*0.45,2.2-i*0.45,0.42,P.stone,8); st.castShadow=false;
        st.position.set(-8.4,0.5+i*0.42,4.4); g.add(st);}
      const shaft=cyl(0.28,0.36,3.4,P.stone,8); shaft.castShadow=true; shaft.position.set(-8.4,3.5,4.4); g.add(shaft);
      const head=box(1.0,1.0,0.4,P.stone); head.castShadow=false; head.position.set(-8.4,5.5,4.4); g.add(head);
      const stall=new THREE.Mesh(new THREE.BoxGeometry(5.2,0.4,2.0),texturedMat("wood",PLANK));
      stall.castShadow=false; stall.position.set(2.4,1.3,3.2); g.add(stall);
      const awn=box(5.6,0.16,2.6,tc); awn.rotation.x=0.16; awn.castShadow=false; awn.position.set(2.4,2.4,3.4); g.add(awn);
      const goods=box(4.0,0.7,1.4,0xe0a92e); goods.castShadow=false; goods.position.set(2.4,1.85,3.2); g.add(goods);
      for(let i=0;i<2;i++){const bar=cyl(0.62,0.7,1.4,0x7a5a34,8); bar.castShadow=false;
        bar.position.set(-3.6+i*1.5,1.6,3.6); g.add(bar);}
    }else{
      // §F.6 — the same building in classical dress: Flemish-bond brick arcade below, enclosed
      // assembly room above, a classical portico, a parapet, and a LEAD-COATED CUPOLA. The cupola
      // is not decoration: it and the temple's steeple are the two pale masses that keep the
      // Enlightenment roofline off the Medieval one, which is otherwise the same blue-grey.
      const pl=new THREE.Mesh(new THREE.BoxGeometry(13.8,1.0,11.0),texturedMat("metal",BRICK));
      pl.position.y=0.5; pl.castShadow=true; g.add(pl);
      for(const px of [-5.4,-1.8,1.8,5.4])for(const pz of [-4.2,4.2]){
        const pier=new THREE.Mesh(new THREE.BoxGeometry(0.9,4.6,0.9),texturedMat("metal",BRICK));
        pier.position.set(px,3.3,pz); pier.castShadow=true; g.add(pier);
        const arc=cyl(1.2,1.2,0.7,P.dark,10); arc.rotation.x=Math.PI/2; arc.castShadow=false;
        arc.position.set(px+1.8,5.0,pz); if(px<5)g.add(arc);
      }
      const floor=box(12.8,0.4,10.0,P.stone); floor.castShadow=false; floor.position.y=1.2; g.add(floor);
      const band=box(13.6,0.7,10.8,P.wall); band.castShadow=true; band.position.y=5.9; g.add(band);
      const room=new THREE.Mesh(new THREE.BoxGeometry(13.0,3.8,10.2),aWall(5));
      room.position.y=8.2; room.castShadow=true; room.receiveShadow=true; g.add(room);
      for(const s2 of [-1,1]){const q=box(0.6,3.8,0.6,BRICK); q.castShadow=false;
        q.position.set(s2*6.1,8.2,4.7); g.add(q);}          // the brick keeps the quoins
      winGrid(g,4,1,8.4,0,5.17,P.dark,P.stone);
      const cor=box(13.8,0.5,11.0,P.wall); cor.castShadow=false; cor.position.y=10.3; g.add(cor);
      const apex=ageRoof(g,5,13.4,10.6,10.6,type,{tc});
      // the portico, and the parapet §F.6 asks for on top of it
      const port=box(6.4,0.5,3.0,P.stone); port.castShadow=false; port.position.set(0,1.4,6.2); g.add(port);
      for(const px of [-2.4,-0.8,0.8,2.4])colAt(g,px,6.0,4.8,0.38,5);
      const pent=box(7.0,0.7,2.6,P.wall); pent.castShadow=false; pent.position.set(0,5.6,6.0); g.add(pent);
      balustrade(g,6.4,6.0,6.0,P.stone);
      // THE CUPOLA, lead-coated: an octagonal drum, a lantern and a little dome, all in §F.6's
      // lead #8A9099 rather than verdigris — copper is the town centre's and the temple's.
      // the cupola sat on the hipped APEX — a point, not a plane — so a 2.4-radius drum had 0.99 of
      // mean air under it (A11 PERCH). The whole stack drops 1.0 so the drum meets roof, not ridge.
      const drum=cyl(2.4,2.6,2.0,P.stone,8); drum.castShadow=true; drum.position.y=apex-0.2; g.add(drum);
      for(let i=0;i<8;i++){const a=i*Math.PI/4;
        const op=box(0.5,1.0,0.5,P.dark); op.castShadow=false;
        op.position.set(Math.sin(a)*2.3,apex-0.2,Math.cos(a)*2.3); op.rotation.y=-a; g.add(op);}
      const cdome=bDome(2.6,"wood",P.lead); cdome.position.y=apex+0.8; g.add(cdome);
      const lant=cyl(0.7,0.75,1.4,P.stone,8); lant.castShadow=false; lant.position.y=apex+3.1; g.add(lant);
      const lfin=cone(0.4,1.0,GOLD,6); lfin.castShadow=false; lfin.position.y=apex+4.3; g.add(lfin);
      const stall=new THREE.Mesh(new THREE.BoxGeometry(5.0,0.4,1.9),texturedMat("wood",PLANK));
      stall.castShadow=false; stall.position.set(2.0,1.6,3.4); g.add(stall);
      const goods=box(3.8,0.7,1.3,0xe0a92e); goods.castShadow=false; goods.position.set(2.0,2.15,3.4); g.add(goods);
      const awn=box(5.4,0.16,2.4,tc); awn.rotation.x=0.16; awn.castShadow=false; awn.position.set(2.0,2.7,3.6); g.add(awn);
    }
  }else if(type==="temple"){
    // ===================== THE TEMPLE, AGES §F.4-§F.6 =====================
    // BLD.temple.age is 3, so ages 0-2 clamp up and never render — §F only writes the temple from
    // the Classical age on, and this branch matches it. Three buildings, three orders of magnitude
    // of ambition, and each is the tallest thing in its age:
    //   3 the DORIC peripteral temple on a podium — "the ORDER is the whole read and it is decided
    //     at the capital: plain convex cushion, no base = Doric, and Doric is the boldest at low
    //     poly", with a PEDIMENTED GABLE
    //   4 GOTHIC: pointed arches, FLYING BUTTRESSES carrying the thrust outside, a tall SPIRE
    //   5 the TIERED STEEPLE — "the tallest and most readable silhouette in the whole age": three
    //     stacked classical stages of decreasing width, each with its own cornice, then the spire
    if(age===3){
      const base=new THREE.Mesh(new THREE.BoxGeometry(11.0,1.2,8.6),texturedMat("metal",P.stone));
      base.position.y=0.6; base.castShadow=true; g.add(base);
      for(let i=0;i<2;i++){const st=box(12.2+i*1.3,0.4,9.8+i*1.3,P.stone); st.castShadow=false;
        st.position.y=0.6-i*0.4; g.add(st);}
      const cella=new THREE.Mesh(new THREE.BoxGeometry(7.0,5.0,5.6),aWall(3));
      cella.position.y=3.7; cella.castShadow=true; cella.receiveShadow=true; g.add(cella);
      const colG=new THREE.Group(); colG.position.y=1.2; g.add(colG);
      for(const cx of [-4.0,-1.35,1.35,4.0]){colAt(colG,cx,2.9,5.4,0.6,3); colAt(colG,cx,-2.9,5.4,0.6,3);}
      const arch=new THREE.Mesh(new THREE.BoxGeometry(11.4,1.2,9.0),texturedMat("metal",P.stone));
      arch.position.y=7.5; arch.castShadow=false; g.add(arch);
      const trig=box(11.6,0.34,9.2,P.trim); trig.castShadow=false; trig.position.y=8.25; g.add(trig);
      // PEDIMENTED GABLE, not a hip: §F.4 gives the temple the one gabled roof in an age of hips,
      // which is exactly why a Classical town still reads as one building type per top profile.
      ageRoof(g,3,11.0,8.6,8.4,type,{form:"gable",pitch:24,long:"z",trim:P.stone});
      const ped=pedTri(10.4,2.3,P.stone); ped.position.set(0,9.6,4.35); g.add(ped);
      const sun=cyl(1.0,1.0,0.2,GOLD,10); sun.rotation.x=Math.PI/2; sun.castShadow=false;
      sun.position.set(0,9.9,4.5); g.add(sun);
      for(const s of [-1,1]){const ac=box(0.5,0.7,0.4,GOLD); ac.castShadow=false; ac.position.set(s*5.4,8.6,4.35); g.add(ac);}
      const door=box(2.0,3.2,0.2,P.dark); door.castShadow=false; door.position.set(0,2.8,2.86); g.add(door);
      brazier(g,-4.6,5.6); brazier(g,4.6,5.6);
    }else if(age===4){
      // GOTHIC. §F.5: "if the Temple should visibly upgrade within the age, the Romanesque->Gothic
      // shift is the cleanest way" — pointed arches, enormous windows in thin walls, and the
      // FLYING BUTTRESSES that carry the vault's thrust outside the building. The buttresses are
      // the read: they are the only building in the game whose structure stands outside its walls.
      const pl=new THREE.Mesh(new THREE.BoxGeometry(9.8,1.0,8.2),texturedMat("metal",P.stone));
      pl.position.y=0.5; pl.castShadow=true; g.add(pl);
      const nave=new THREE.Mesh(new THREE.BoxGeometry(7.4,7.6,6.6),texturedMat("metal",P.stone));
      nave.position.y=4.8; nave.castShadow=true; nave.receiveShadow=true; g.add(nave);
      const apse=new THREE.Mesh(new THREE.CylinderGeometry(2.5,2.7,7.6,10,1,false,0,Math.PI),
        texturedMat("metal",P.stone));
      // THE APSE WAS YAWED 90 DEGREES OFF THE BACK. r128 lays a cylinder's theta from +Z toward
      // +X (CylinderGeometry.js:94/96, x=r*sinTheta z=r*cosTheta), so thetaLength=PI is the +X
      // half, and rotation.y=a slides the solid arc to [a, PI+a]. At PI that was [PI, 2PI] = the
      // -X half: measured x[-2.70,0.00] y[1.00,8.60] z[-6.00,-0.60]. Note what that is NOT --
      // 2.70 is inside the 7.4 nave's own 3.70, so nothing ever showed on the flank (the left
      // elevation is pixel-identical either way). All that escaped the rear wall was the rear
      // LEFT quarter, and the open theta cut lay on the centreline x=0 with its backfaces culled,
      // so from the rear RIGHT the apse vanished outright. PI/2 gives [PI/2, 3PI/2] = the -Z
      // half. Measured after: x[-2.70,2.70] y[1.00,8.60] z[-6.00,-3.30], which is the hand
      // figure: the nave is 6.6 deep about z=0 so its rear face is -6.6/2 = -3.3, exactly the
      // plane the flat cut now lands on -- both cut edges have local x=0, so the 2.7->2.5 taper
      // does not tilt it -- and the nave wall seals it. The drum's 7.6 about y=4.8 already gave
      // 1.0..8.6, the nave's own. Nothing above moves: acap is a full 360 cone concentric on
      // (0,-3.3) with its base at 9.9-2.6/2 = 8.6 = the drum top 4.8+7.6/2, so it caps the drum
      // at either yaw. Merged AABB, merged mesh count and BLD.temple.fx/fz are all unchanged --
      // z still bottoms out at the cone's -6.4, inside fz=6.80.
      apse.rotation.y=Math.PI/2; apse.position.set(0,4.8,-3.3); apse.castShadow=true; g.add(apse);
      const acap=new THREE.Mesh(new THREE.ConeGeometry(3.1,2.6,10),texturedMat(P.roofPat,P.roof));
      acap.castShadow=true; acap.position.set(0,9.9,-3.3); g.add(acap);
      ageRoof(g,4,7.4,6.6,8.6,type,{tc,long:"z"});
      // POINTED arches, which is the one shape a Romanesque chapel cannot have
      for(const s of [-1,1])for(const wz of [-1.6,1.6]){
        const w=box(0.34,3.4,1.1,P.dark); w.castShadow=false; w.position.set(s*3.72,5.4,wz); g.add(w);
        const pt=cone(0.62,1.3,P.dark,4); pt.rotation.z=Math.PI/2; pt.rotation.y=Math.PI/4;
        pt.castShadow=false; pt.position.set(s*3.72,7.6,wz); g.add(pt);
      }
      // THE FLYING BUTTRESSES: a pier standing clear of the wall, and an arch leaping back to it
      for(const s of [-1,1])for(const bz of [-2.0,2.0]){
        const pier=new THREE.Mesh(new THREE.BoxGeometry(1.0,6.0,1.2),texturedMat("metal",P.stone));
        pier.position.set(s*5.9,3.0,bz); pier.castShadow=true; g.add(pier);
        const pin=cone(0.6,1.6,P.stone,4); pin.castShadow=false; pin.position.set(s*5.9,6.8,bz); g.add(pin);
        const fly=box(2.7,0.42,0.6,P.stone); fly.rotation.z=s*0.42; fly.castShadow=false;
        fly.position.set(s*4.75,7.0,bz); g.add(fly);
      }
      const rose=cyl(1.25,1.25,0.16,P.stone,12); rose.rotation.x=Math.PI/2; rose.castShadow=false;
      rose.position.set(0,7.0,3.36); g.add(rose);
      const roseC=cyl(0.8,0.8,0.2,tc,12); roseC.rotation.x=Math.PI/2; roseC.castShadow=false;
      roseC.position.set(0,7.0,3.4); g.add(roseC);
      // the SPIRE, tall and thin, in the age's own slate
      const spb=new THREE.Mesh(new THREE.BoxGeometry(2.6,2.4,2.6),texturedMat("metal",P.stone));
      spb.position.set(0,12.2,0); spb.castShadow=true; g.add(spb);
      const spire=new THREE.Mesh(new THREE.ConeGeometry(1.9,7.2,8),texturedMat(P.roofPat,P.roof));
      spire.castShadow=true; spire.receiveShadow=true; spire.position.set(0,17.0,0); g.add(spire);
      for(const s of [-1,1]){const pin2=cone(0.4,1.6,P.stone,4); pin2.castShadow=false;
        pin2.position.set(s*1.2,14.2,1.2); g.add(pin2);}
      const fin=cyl(0.09,0.09,1.2,GOLD,4); fin.castShadow=false; fin.position.y=21.2; g.add(fin);
      archDoor(g,0,3.36,1.9,2.6,P.dark);
      brazier(g,-2.9,4.9); brazier(g,2.9,4.9);
    }else{
      // §F.6 THE TIERED STEEPLE, lead-sheathed, on a brick preaching hall with Palladian windows
      // and a classical portico. Wren's post-1666 pattern: THREE stacked classical stages of
      // DECREASING width, each with its own cornice, then the spire. The stages are the whole
      // point — one tapering cone is a medieval spire, and three cornices is what makes it 1700.
      const bb=new THREE.Mesh(new THREE.BoxGeometry(11.0,1.0,9.0),texturedMat("metal",BRICK));
      bb.position.y=0.5; bb.castShadow=true; g.add(bb);
      const hall=new THREE.Mesh(new THREE.BoxGeometry(9.6,5.6,7.8),aWall(5));
      hall.position.y=3.8; hall.castShadow=true; hall.receiveShadow=true; g.add(hall);
      for(const s of [-1,1]){const q=box(0.55,5.6,0.55,BRICK); q.castShadow=false; q.position.set(s*4.75,3.8,3.75); g.add(q);}
      // ROUND-ARCHED / Palladian windows — tall, round-topped, and regularly spaced
      for(const s of [-1,1])for(const wz of [-2.0,0,2.0]){
        const w=box(0.3,2.6,1.1,P.dark); w.castShadow=false; w.position.set(s*4.82,4.0,wz); g.add(w);
        const a=cyl(0.55,0.55,0.34,P.dark,9); a.rotation.z=Math.PI/2; a.castShadow=false;
        a.position.set(s*4.82,5.4,wz); g.add(a);
      }
      const cor=box(10.4,0.5,8.6,P.wall); cor.castShadow=false; cor.position.y=6.85; g.add(cor);
      for(let i=0;i<10;i++){const den=box(0.3,0.3,0.26,P.stone); den.castShadow=false;
        den.position.set(-4.3+i*0.96,6.45,4.5); g.add(den);}
      // the hall's own roof is CIVIC COPPER — aRoof() gives the temple verdigris, and it and the
      // town centre are the only two that get it (§F.6). That copper plus the pale lead steeple is
      // what keeps an Enlightenment roofline off a Medieval one, which is otherwise the same slate.
      const apex=ageRoof(g,5,10.4,8.6,7.1,type,{});
      // the portico
      const port=box(6.0,0.5,2.8,P.stone); port.castShadow=false; port.position.set(0,1.2,5.4); g.add(port);
      for(const px of [-2.2,-0.75,0.75,2.2])colAt(g,px,5.2,4.6,0.36,5);
      const pent=box(6.6,0.7,2.4,P.wall); pent.castShadow=false; pent.position.set(0,5.4,5.2); g.add(pent);
      const ped=pedTri(6.6,1.7,P.wall); ped.position.set(0,6.5,5.2); g.add(ped);
      const door=box(1.9,2.9,0.2,P.dark); door.castShadow=false; door.position.set(0,1.95,3.96); g.add(door);
      // THE STEEPLE. Tower, then three diminishing stages, then the spire.
      let y=apex-0.6, wStage=4.6;
      const tow=new THREE.Mesh(new THREE.BoxGeometry(wStage,5.0,wStage),texturedMat("metal",BRICK));
      tow.position.set(0,y+2.5,-1.4); tow.castShadow=true; tow.receiveShadow=true; g.add(tow);
      const twc=box(wStage+0.7,0.42,wStage+0.7,P.wall); twc.castShadow=false; twc.position.set(0,y+5.2,-1.4); g.add(twc);
      y+=5.5;
      for(let s=0;s<3;s++){
        const w2=wStage-0.55-s*0.62, h2=3.0-s*0.35;
        const st=(s===0)
          ? new THREE.Mesh(new THREE.BoxGeometry(w2,h2,w2),texturedMat("metal",P.lead))
          : new THREE.Mesh(new THREE.CylinderGeometry(w2*0.62,w2*0.66,h2,8),texturedMat("metal",P.lead));
        st.position.set(0,y+h2/2,-1.4); st.castShadow=true; g.add(st);
        for(const sa of [0,Math.PI/2]){       // the belfry openings, so a stage is not a plain block
          const op=box(w2*0.34,h2*0.6,w2*0.34,P.dark); op.castShadow=false;
          op.position.set(Math.sin(sa)*w2*0.5,y+h2/2,-1.4+Math.cos(sa)*w2*0.5); g.add(op);}
        const cc=(s===0)?box(w2+0.6,0.36,w2+0.6,P.wall)
                        :cyl(w2*0.62+0.34,w2*0.62+0.34,0.34,P.wall,8);
        cc.castShadow=false; cc.position.set(0,y+h2+0.18,-1.4); g.add(cc);   // EACH STAGE ITS CORNICE
        y+=h2+0.36; wStage=w2;
      }
      const spire=new THREE.Mesh(new THREE.ConeGeometry(wStage*0.68,8.0,8),texturedMat("wood",P.lead));
      spire.castShadow=true; spire.receiveShadow=true; spire.position.set(0,y+4.0,-1.4); g.add(spire);
      const fin=cyl(0.09,0.09,1.3,GOLD,4); fin.castShadow=false; fin.position.set(0,y+8.6,-1.4); g.add(fin);
      const vane=box(0.9,0.5,0.06,GOLD); vane.castShadow=false; vane.position.set(0.45,y+9.0,-1.4); g.add(vane);
      brazier(g,-3.6,5.8); brazier(g,3.6,5.8);
    }
  }else if(type==="tower"){
    // ====== `tower` SHOOTS. OWNER RULING: IT IS NOT AN UPGRADE OF `watch_tower`. ======
    // §F.4 is explicit — "tower is larger, permanently garrisoned, and built into a wall circuit;
    // watch_tower is isolated and climbable". So this one has NO external stair and NO open deck:
    // its top is a weapon platform, and the thing on it is the read.
    //   3 CLASSICAL  a mural tower PROJECTING OUTWARD from the wall line so defenders shoot along
    //                the wall face — the flanking principle — with a SCORPIO bolt-thrower on top
    //   4 MEDIEVAL   ROUND, not square: round towers deflect missiles and resist undermining, and
    //                that is a real engineering reason for a shape change, so the shape changes
    //   5 ENLIGHT.   a BASTION-MOUNTED GUN POSITION, not a tower at all. §F.6: "going tall in
    //                stone here would contradict everything the age's fortification is about."
    if(age>=5){
      const rev=new THREE.Mesh(new THREE.CylinderGeometry(5.4,6.6,4.2,5),aWall(age));
      rev.rotation.y=Math.PI/5; rev.position.y=2.1; rev.castShadow=true; rev.receiveShadow=true; g.add(rev);
      const terre=new THREE.Mesh(new THREE.CylinderGeometry(5.6,5.6,0.6,5),plainMat(0x8a7a58));
      terre.rotation.y=Math.PI/5; terre.castShadow=false; terre.position.y=4.4; g.add(terre);
      // THE PARAPET COURSE IS SQUARED TO THE PENTAGON UNDER IT. CylinderGeometry(...,5) stands its
      // five corners at 72k deg, and rev/terre are both twisted Math.PI/5 = 36 deg, so the FLAT
      // FACES below look out along 0/72/144/216/288 — one of them squarely on +z. So a=i*72 deg
      // with NO offset (the shipped +0.3 rad = 17.19 deg put every block's centre halfway to a
      // corner), and rotation.y=+a, because a mesh's local +z leaves at azimuth rotation.y: the
      // shipped -a skewed block i by 144i+17.19 deg, which stood block 3 at 89.19 — broadside
      // across its own face. Radius: the terreplein apothem is 5.6*cos(36 deg) = 4.5305, less
      // half the 0.9 depth = 4.0805, rounded IN to 4.08 so the outer face lands 0.0005 behind the
      // face below instead of coplanar with it. At the shipped 5.2 only 14-35% of each block's
      // footprint was over the deck at all, and block 3 sat 0.74 inside the sentry box. 3.4 of
      // merlon on a 6.58 face (2*5.6*sin 36) leaves 1.59 at each end, so the EMBRASURES open at
      // the five corners — which is where the two guns already stand, at 35 deg. Blocks 1 and 4
      // then meet a gun carriage 0.13 deep on the carriage's short axis: a butt joint, on purpose.
      for(let i=0;i<5;i++){const a=i*Math.PI*0.4;      // the parapet, cut with EMBRASURES for guns
        const par=box(3.4,1.5,0.9,P.stone); par.castShadow=false;
        par.position.set(Math.sin(a)*4.08,5.4,Math.cos(a)*4.08); par.rotation.y=a; g.add(par);}
      for(const s of [-1,1]){                            // two guns, laid to sweep the curtain faces
        const gun=cyl(0.4,0.48,3.0,0x8A6A3A,8); gun.rotation.set(-0.34,s*0.7,0); gun.castShadow=false;
        gun.position.set(s*2.4,5.6,3.4); g.add(gun);
        const carr=box(1.4,0.7,2.2,P.timber); carr.castShadow=false; carr.rotation.y=s*0.7;
        carr.position.set(s*2.4,4.9,3.0); g.add(carr);
      }
      const mag=box(2.4,1.8,2.4,texturedMat("metal",BRICK)); mag.castShadow=true; mag.position.set(0,1.6,-3.2); g.add(mag);
      const sentry=box(1.3,2.2,1.3,P.wall); sentry.castShadow=true; sentry.position.set(-4.2,5.9,-4.2); g.add(sentry);
      const scap=cone(1.1,1.0,P.roof,6); scap.castShadow=false; scap.position.set(-4.2,7.4,-4.2); g.add(scap);
      // THE LOOKOUT MAST STANDS ON THE TERREPLEIN. AGES:557 asks for "a slender timber lookout
      // mast with signal flags" and this one was planted OFF THE BASTION. The terreplein is a
      // pentagon of circumradius 5.6 turned PI/5, so its faces stand at 5.6*cos(PI/5) = 4.531 from
      // the axis; (4.4,-3.4) is radius 5.561 on bearing 127.7 deg, and the rim on that bearing is
      // 4.531/cos(144-127.7) = 4.720 — the foot was 0.84 past the edge, over nothing. Measured on
      // the UNMERGED factory: 4.645 of air under it, down to the revetment's battered face, and
      // 0.000 after. Same bearing, pulled in to radius 4.0, which puts the foot's OUTER EDGE 0.59
      // inside the rim: x = 4.0*sin(127.7) = 3.17, z = 4.0*cos(127.7) = -2.45. Nearest embrasure
      // block is 1.80 away, so nothing new is interpenetrated. The foot's HEIGHT was already
      // right: 8.2-7.0/2 = 4.7 is the terreplein's top face (4.4+0.6/2).
      const mast=cyl(0.11,0.13,7.0,PLANK,5); mast.castShadow=false; mast.position.set(3.17,8.2,-2.45); g.add(mast);
      // the flag rides the mast: inner edge stays on the mast axis (3.17+2.0/2), height unchanged.
      const flag=box(2.0,1.1,0.09,tc); flag.castShadow=false; flag.position.set(4.17,10.6,-2.45); g.add(flag);
    }else if(age>=4){
      // ROUND. 3-4 stories, arrow loops at each level, machicolations on corbels with floor slots.
      const bodyMat=texturedMat("metal",P.stone);
      const t=new THREE.Mesh(new THREE.CylinderGeometry(3.4,4.0,16,12),bodyMat);
      t.position.y=8; t.castShadow=true; t.receiveShadow=true; g.add(t);
      for(const sy of [5.0,9.0,13.0])for(const sa of [0,2.1,4.2]){    // arrow loops at each level
        const loop=box(0.28,1.4,0.24,P.dark); loop.castShadow=false;
        loop.position.set(Math.sin(sa)*3.5,sy,Math.cos(sa)*3.5); loop.rotation.y=-sa; g.add(loop);}
      const cor=new THREE.Mesh(new THREE.CylinderGeometry(4.5,3.5,1.2,12),bodyMat);
      cor.position.y=16.6; cor.castShadow=true; g.add(cor);            // machicolations on corbels
      const band=cyl(4.6,4.6,0.5,P.dark,12); band.castShadow=false; band.position.y=17.4; g.add(band);
      for(let i=0;i<12;i++){const a=i*Math.PI/6;
        const slot=box(0.5,0.3,0.5,P.dark); slot.castShadow=false;
        slot.position.set(Math.sin(a)*4.1,16.05,Math.cos(a)*4.1); g.add(slot);}
      for(let i=0;i<8;i++){const a=i*Math.PI/4;
        const mer=box(1.3,1.5,0.9,P.stone); mer.castShadow=false;
        mer.position.set(Math.sin(a)*4.1,18.0,Math.cos(a)*4.1); mer.rotation.y=-a; g.add(mer);}
      const spire=new THREE.Mesh(new THREE.ConeGeometry(4.0,5.2,12),texturedMat(roofPat(4),P.roof));
      spire.castShadow=true; spire.receiveShadow=true; spire.position.y=20.6; g.add(spire);
      // THE BANNER LIES ON THE DRUM. The drum is CylinderGeometry(3.4,4.0,16,12) centred at y=8 and
      // a 12-gon's vertex 0 sits on +z, so +z is the widest it ever gets: r = 4.0-0.0375y, which is
      // 3.58 at the cloth's foot (11.2) and 3.49 at its head (13.6). At z=4.3 the back face stood at
      // 4.25 and the measured daylight behind it was 0.63 at the centre (to the arrow loop, which
      // stands 0.12 proud of the r=3.5 line it is set on) and 0.67 to 0.95 to the drum itself.
      // The cloth hangs vertically off a wall that leans away going up, so it takes contact at its
      // WIDEST point — the foot: back face on 3.58, centre 3.58+0.1/2 = 3.63. Measured after:
      // 0.001 / 0.044 / 0.088 at foot / mid / head, which IS the batter, and 0.19 to 0.28 at the
      // corners, which is the chord a 12-gon leaves under a flat 1.6 cloth. Both are geometry, not
      // a gap. The arrow loop at (0,13,3.5) ends up 0.04 inside the cloth's back face and stays
      // 0.06 BEHIND its front face, so it is buried and hidden — 0.06 is far outside depth-buffer
      // resolution at this range, and a shallower bed would have left the loop poking through.
      const ban=box(1.6,2.4,0.1,tc); ban.castShadow=false; ban.position.set(0,12.4,3.63); g.add(ban);
      flagPole(g,0,23.0,0,2.4,tc,1.9,1.1);
    }else{
      // CLASSICAL: SQUARE and PROJECTING. It stands proud of the wall line on purpose — a mural
      // tower's whole job is to let the defenders enfilade the wall face — so the plan is a
      // rectangle pushed out along +z, not a drum, and that alone separates it from the Medieval
      // round tower at 46px with the colour thrown away.
      const bodyMat=aWall(age);
      const t=new THREE.Mesh(new THREE.BoxGeometry(7.2,14,8.6),bodyMat);
      t.position.set(0,7,1.4); t.castShadow=true; t.receiveShadow=true; g.add(t);
      const pod=new THREE.Mesh(new THREE.BoxGeometry(8.4,1.0,9.8),texturedMat("metal",P.stone));
      pod.position.set(0,0.5,1.4); pod.castShadow=true; g.add(pod);
      for(const sy of [5.2,9.4]){for(const sx of [-1.9,1.9]){          // arched embrasures
        const emb=box(1.0,2.0,0.3,P.dark); emb.castShadow=false; emb.position.set(sx,sy,5.75); g.add(emb);
        const arc=cyl(0.5,0.5,0.34,P.dark,9); arc.rotation.x=Math.PI/2; arc.castShadow=false;
        arc.position.set(sx,sy+1.0,5.75); g.add(arc);}}
      const cor=box(8.6,0.7,10.0,P.stone); cor.castShadow=false; cor.position.set(0,14.3,1.4); g.add(cor);
      const frieze=box(8.8,0.3,10.2,tc); frieze.castShadow=false; frieze.position.set(0,14.85,1.4); g.add(frieze);
      const plat=box(8.0,0.5,9.4,P.stone); plat.castShadow=false; plat.position.set(0,15.3,1.4); g.add(plat);
      for(const s of [-1,1]){const par=box(0.5,1.3,9.4,P.stone); par.castShadow=false;
        par.position.set(s*3.75,16.2,1.4); g.add(par);}
      const parF=box(8.0,1.3,0.5,P.stone); parF.castShadow=false; parF.position.set(0,16.2,5.9); g.add(parF);
      // THE SCORPIO. A bolt-thrower on the top platform is the age's own weapon and it is the
      // silhouette event that says "this one shoots" — it is the difference between this and the
      // burgus, which has a gallery instead.
      const frame=box(1.5,0.9,2.2,P.timber); frame.castShadow=false; frame.position.set(0,16.3,2.4); g.add(frame);
      const bow=box(3.6,0.28,0.28,P.timber); bow.castShadow=false; bow.position.set(0,16.9,3.2); g.add(bow);
      const stock=box(0.3,0.3,3.0,P.timber); stock.castShadow=false; stock.rotation.x=-0.22;
      stock.position.set(0,17.0,2.2); g.add(stock);
      const roofc=new THREE.Mesh(hipGeo(8.4,9.8,(9.8/2)*Math.tan(23*Math.PI/180),8.4-9.8>0?8.4-9.8:2.0),
        texturedMat(roofPat(3),P.roof));
      roofc.castShadow=true; roofc.receiveShadow=true; roofc.rotation.y=Math.PI/2; roofc.position.set(0,17.6,1.4);
      inkOutline(roofc,1.8); g.add(roofc);
      flagPole(g,-3.4,17.8,-2.2,3.0,tc,1.9,1.1);
    }
  }
  return g;
}
function makeBar(parent,y,w,frontColor){
  const bg=new THREE.Sprite(new THREE.SpriteMaterial({color:0x1c130a}));
  bg.scale.set(w,0.22,1); bg.position.y=y; bg.center.set(0.5,0.5); parent.add(bg);
  const fg=new THREE.Sprite(new THREE.SpriteMaterial({color:frontColor}));
  fg.scale.set(w-0.08,0.15,1); fg.position.y=y; fg.center.set(0,0.5);
  fg.position.x=-(w-0.08)/2; parent.add(fg);
  return {bg,fg,w:w-0.08};
}
function setBar(bar,frac){ bar.fg.scale.x=Math.max(0.001,bar.w*Math.max(0,frac)); }

// health-bar heights sized for the tallest age variant of each type
// v130 B2: the town centre's went 16 -> 17. The classical hall's pediment climbed from a 19-degree
// lid to a real 33-degree roof (AD §5.5), which carried its ridge and therefore its mast up with
// it — leaving the bar buried in the flag. This entry moves with the tallest variant, always.
const BARH={towncenter:17,house:8,barracks:13,farm:5,storage_pit:7,archery_range:13,stable:13,
  watch_tower:20,tower:23,temple:15,market:13,siege_workshop:13,castle:23,blacksmith:10,
  wood_wall:9,stone_wall:10,fort_wall:11,wood_gate:10,stone_gate:11,fort_gate:12};

// ==================== v130 B1: THE BUILDING MERGE ====================
// Measured before this landed: a 12-building base cost 227 draw calls — 18.9 per building, for
// 3,433 triangles. Sixteen triangles per draw call is the worst ratio in the game, worse even
// than the ground decals, and it got worse with age: an age-5 town centre is 71 meshes carrying
// 69 materials because box()/cyl()/cone() route through 01-engine's `mat()`, which caches
// NOTHING. Every plank, sill and finial was its own mesh with its own MeshToonMaterial.
//
// Buildings are the easy case the unit merge was not. They are 100% static — no rig, no animated
// node, nothing that moves relative to anything else — so the whole body folds into ONE mesh
// instead of the eleven rigid clusters `mergeUnitBody` needs (04-units.js:196, and read that
// comment before touching this one; every trap it lists applies here).
//
// THE PART THAT IS NOT OPTIONAL: a merged mesh still costs ONE DRAW PER MATERIAL, so welding the
// geometry alone would have taken a town centre from 71 draws to 69 and achieved nothing. The
// materials have to collapse too, and they cannot collapse to vertex colours alone because the
// large surfaces — every wall, every roof slab, every stone course — are TEXTURED, and those
// weaves are most of what stops a town reading as stacked boxes. So this reuses the unit skin
// atlas: a textured part gets an atlas cell and a white vertex colour, a flat part gets its hex
// baked to vertex colour and points at the atlas's white cell. One material, one draw.
//
// WHY THIS DUPLICATES _mergeGeo INSTEAD OF CALLING IT: the two town centres are built at the
// BOTTOM OF THIS FILE, at script load, and 04-units.js has not been parsed yet at that moment —
// `_mergeGeo` is simply not defined when the first building in the game is raised. The
// duplication is load-order, not taste. (It also keeps a building's outline policy out of the
// unit merge's hands, which matters while `ink-coverage` is still to land.)
function _bMergeableMat(m){
  // Same shape of filter as _mergeableMat (04-units.js:150) and for the same reason: name the
  // PROPERTIES that make a material foldable, never the exceptions. This automatically leaves out
  // the blacksmith hearth's MeshBasicMaterial, the healing aura, every ink hull's ShaderMaterial
  // and the construction ghost's translucent clone, and it stays correct when the next age adds a
  // material nobody here anticipated. The RepeatWrapping test is the one clause units do not
  // need: the atlas is a shared canvas with ClampToEdge neighbours, so a tiling texture would
  // smear across every cell around it. Nothing on a building tiles today — roadMat is Lambert and
  // lives on the road group — but a tiling wall texture is an obvious future move.
  return !!m&&m.isMeshToonMaterial===true&&!m.transparent&&!m.flatShading&&m.side===THREE.FrontSide
    &&!(m.map&&(m.map.wrapS===THREE.RepeatWrapping||m.map.wrapT===THREE.RepeatWrapping));
}
function _bMergeGeo(parts){
  let n=0; const bufs=[];
  for(const p of parts){
    const g=p.geo.index?p.geo.toNonIndexed():p.geo.clone();
    // applyMatrix4 carries normals through the normal matrix, so the hide domes and the cone
    // granaries keep the smooth shading their geometry gave them. Recomputing normals after the
    // weld would flat-shade every facet — the exact mistake _mergeColored's comment warns about,
    // and on a building it shows up as a faceted dome, which is the one shape here that has any.
    g.applyMatrix4(p.m4);
    n+=g.attributes.position.count;
    bufs.push({g,slot:p.slot,col:p.col});
  }
  const pos=new Float32Array(n*3), nor=new Float32Array(n*3),
        uv=new Float32Array(n*2), col=new Float32Array(n*3);
  let o=0;
  for(const b of bufs){
    const a=b.g.attributes, k=a.position.count;
    pos.set(a.position.array,o*3);
    if(a.normal)nor.set(a.normal.array,o*3);
    const s=b.slot, su=a.uv&&a.uv.array;
    for(let i=0;i<k;i++){
      // r128's SphereGeometry runs its pole UVs out past the 0..1 box, which on a 16x16 atlas
      // cell would reach into a NEIGHBOURING skin. Every building texture is ClampToEdge today,
      // so clamping here reproduces the exact texel it samples before the merge.
      let U=su?su[i*2]:0.5, V=su?su[i*2+1]:0.5;
      U=U<0?0:U>1?1:U; V=V<0?0:V>1?1:V;
      uv[(o+i)*2]=s.u0+U*s.us;
      uv[(o+i)*2+1]=s.v0+V*s.vs;
      col[(o+i)*3]=b.col.r; col[(o+i)*3+1]=b.col.g; col[(o+i)*3+2]=b.col.b;
    }
    o+=k;
    b.g.dispose(); // the working copy only; the SOURCE geometry is freed by the caller
  }
  const out=new THREE.BufferGeometry();
  out.setAttribute("position",new THREE.BufferAttribute(pos,3));
  out.setAttribute("normal",new THREE.BufferAttribute(nor,3));
  out.setAttribute("uv",new THREE.BufferAttribute(uv,2));
  out.setAttribute("color",new THREE.BufferAttribute(col,3));
  out.computeBoundingSphere();
  return out;
}
// Weld a body group IN PLACE. In place matters: `b.body` keeps its identity, its rotation, its
// scale.y (the construction raise animates it) and its userData.age, so every caller and every
// smoketest assertion that reads those keeps working, and `buildingMesh` itself stays unmerged
// for the placement ghost and for the six-ages structural checks that count its children.
function mergeBuildingBody(g){
  if(!g||g.userData.bMerged||typeof UATLAS==="undefined")return 0;
  const parts=[], keep=[];
  (function walk(o,m4){
    for(const c of o.children){
      if(c.matrixAutoUpdate)c.updateMatrix(); // .matrix is stale until a render pass; ink hulls
      const cm=new THREE.Matrix4().multiplyMatrices(m4,c.matrix); // opt out and are already baked
      if(c.isMesh&&c.geometry&&c.visible!==false&&!c.userData.noWeld&&_bMergeableMat(c.material)){
        const t=c.material.map;
        parts.push({obj:c,geo:c.geometry,m4:cm,col:c.material.color,
          slot:t?UATLAS.slot(t):UATLAS.whiteSlot(),cast:!!c.castShadow});
        // Anything hanging off a mesh we are about to delete has to be rescued: today that is
        // gableRoof's two ink hulls, which are children of the slab AND SHARE ITS GEOMETRY. Drop
        // them and the only outlines in the game vanish; dispose the slab's geometry and they
        // render nothing. Re-hang them on the body with the slab's accumulated transform baked
        // into .matrix — they already run matrixAutoUpdate=false, so that is all they need.
        for(const k of c.children.slice())keep.push({obj:k,m4:cm});
      }
      if(c.children.length)walk(c,cm);
    }
  })(g,new THREE.Matrix4());
  if(parts.length<2)return 0;                        // nothing to gain from welding one mesh
  // ONE BUCKET, AND IT RECEIVES. This used to split on receiveShadow and pay a second draw call to
  // keep the big wall masses OUT of the shadow map, because they are raised with a bare
  // `new THREE.Mesh` (which defaults the flag off) while box()/cyl()/cone() have received since
  // v129.5, and welding the two together at the rig of the day — 1024 over a ±70 box, 0.137 world
  // units per texel — turned every eave into a hatched band of acne. That condition is the one the
  // old comment named as the price of admission and it has since been paid: the rig is 2048 over
  // ±52 (AD §3.8), 0.051 units per texel, 2.7x finer, with normalBias 0.10 already on it. Rendered
  // at that resolution the same eave comes back as §5.5's shadow band with a one-texel comb on its
  // lower edge, which is a shadow, not acne.
  // So the split is gone and §3.8 gets what it asks for — "everything that stands on the ground
  // receives shadow… buildings" — and the merge gets CHEAPER for it: every building in the game
  // drops from two draws to one, which is 30-60 calls back in a real base.
  // castShadow still takes the union for its own reason: the parts that gain it are finials,
  // banners and studs sitting inside or against a mass that already casts, so the silhouette in
  // the shadow map is unchanged — and the shadow pass drops from ~8 draws per building to 1.
  const mesh=new THREE.Mesh(_bMergeGeo(parts),UATLAS.material());
  mesh.castShadow=parts.some(p=>p.cast); mesh.receiveShadow=true;
  g.add(mesh);
  // premultiply, NOT copy().multiply(). The first cut of this line read
  // `matrix.copy(k.m4).multiply(matrix)`, which multiplies the destination by ITSELF the moment
  // copy() lands — so every rescued hull came out with its transform SQUARED, and the roof
  // outlines stood up as house-sized black planks leaning through the town. premultiply(m) is
  // `this = m * this`, and Matrix4 reads both operands into locals before writing, so it is
  // alias-safe by construction.
  // …and a child that was itself welded is NOT a survivor. Nothing in the file nests a mergeable
  // mesh under another one today, so this filter never fires — it is here so that the first person
  // who does gets a correct merge instead of a mesh that is drawn twice, once welded and once loose.
  const welded=new Set(parts.map(p=>p.obj)), rescued=keep.filter(k=>!welded.has(k.obj));
  for(const k of rescued){ k.obj.matrixAutoUpdate=false; k.obj.matrix.premultiply(k.m4); g.add(k.obj); }
  const alive=new Set(rescued.map(k=>k.obj.geometry)); // geometry a rescued hull still points at
  for(const p of parts){
    if(p.obj.parent)p.obj.parent.remove(p.obj);
    if(!alive.has(p.geo))p.geo.dispose();
    // …and free the MATERIAL if this mesh minted it. This is the leak the item exists to fix:
    // box()/cyl()/cone() go through the uncached mat(), so ~26 MeshToonMaterials per house and
    // ~69 per age-5 town centre were orphaned on the GPU by every single age-up. isSharedMat
    // (01-engine.js:805) is the arbiter — texturedMat/plainMat come out of _skinCache and are
    // shared by every building on the map, and disposing one of those blanks a whole town.
    if(!isSharedMat(p.obj.material))p.obj.material.dispose();
  }
  g.userData.bMerged=parts.length;
  return parts.length;
}
// The construction ghost has to CLONE its material, and the clone has to be per building: the
// completion path (addConstructionHit below, and 10-net's bbuilt handler) turns the site opaque by
// writing opacity/transparent straight onto whatever material it finds, and after the merge that
// material is the atlas's — shared by every building in the world. One shared ghost material would
// mean finishing one house pops every other site on the map to full opacity.
function _bGhost(body){
  body.traverse(o=>{if(o.material){
    o.userData.bMat=o.material;               // …and remember what to hand back, so completion
    o.material=o.material.clone();             // can free the clone instead of orphaning it
    o.material.transparent=true; o.material.opacity=0.55;
  }});
}

// ---------- THE APRON: the mesh that stops a building floating (AD §3.8, §8.9, §2.2) ----------
// §8.9 — "contact shadows visible where trunks and boots meet ground: this is what stops the world
// floating" — was met for props and for units and unmet for the LARGEST objects in the frame. It
// could not be met by casting, either, and that is structural rather than a tuning miss: §3.1 pins
// the sun at (look+120, 168, look+80), so every shadow in this game falls toward −x−z, and five of
// the six vantages look that way — a 14.8-unit town centre throws its whole shadow behind itself.
//
// The mesh to do it with was already there and was working against the picture. Every building
// carried a "foundation plinth", `CylinderGeometry(r*0.92, r*1.05, 3.6, 10)` in raw un-decoded
// 0x7a6242, and it drew three separate defects out of one draw call:
//   · IT WAS PALER THAN THE LAWN IT SAT ON. A bright plate under a building is the exact inverse of
//     a contact shadow; it is most of why the town centre reads as a model on a stand.
//   · IT DID NOT FOLLOW THE GROUND. A rigid disc on 0.12-per-unit hillside is a dinner plate, and
//     the 3.6 of buried depth was there to hide the downhill gap it opened — the symptom, not it.
//   · TEN SEGMENTS ACROSS 20 UNITS is a countable decagon in the hero shot.
// So it becomes the pool: same mesh, same ONE draw call per building (§9.2 prices a building at 16
// tris per call — the geometry below is free), draped on the terrain, vertex-coloured, darkest
// where the building meets the ground and stepping out to the surface it lies on. TWO HARD STOPS,
// NOT A GRADIENT: this world's ground takes its shape from a terminator (§3.7), and a soft blob
// under a hard-edged building reads as a mud stain.
//
// A SHADOW IS THE COLOUR OF WHAT IT FALLS ON (02-world.js:2085 says it first). The apron is the one
// decal in the game that can lie across TWO surfaces at once — the packed earth a building stands
// on, open lawn or paving past it — so the palette is picked per RING, not per building. That is
// what keeps the town centre's and the castle's court: on those types the earth zone is the whole
// apron, so it comes out as the dirt plaza it has been since v53, now with a dark seam where the
// berm lands in it. On a house the earth zone shrinks to a collar the wall covers and the pool is
// grass.shadow on grass, which is what §8.9 asks for.
const APRON_SEG=18;
// [contact, mid, the surface's own base]. The lawn and paving triples are 02-world's OWN pool stops
// (paintContactShadows, :2085) rather than §2.2's raw hexes, and copying them is the point: a
// building now stands in the same pool the world already paints under every shrub, tree and boulder
// on the map, and 04-units puts its boots in. The rim especially has to be the tuned one — the
// first cut of this used §2.2's authored grass.base and the render came back with a pale ring
// around every house, because the lawn is a TEXTURED surface under a vertex tint and measures
// (123,155,69) where the raw swatch renders (114,148,41): same value, half the blue, and a flat
// patch that differs from the lawn only in saturation reads as a patch.
const APRON_PAL={
  dirt :[0x574433,0x6A5540,0x7A6242],      // §2.2 dirt.shadow / half step / dirt.base: a worked court
  grass:[0x3F5A22,0x577132,0x709443],
  road :[0x4E4529,0x6B563C,0x8A7150]
};
const APRON_COURT={towncenter:1,castle:1,farm:1,storage_pit:1,market:1}; // the types with a worked yard
// GROUND_FOG, not the scene curve: an untextured decal that fades on the stock curve sits at pure
// fog.colour on top of a ground that deliberately keeps ~12% of itself past the cull line, which is
// how 02-world got 195 pale lily pads in the deep field (drapedDecal, :73). One material for every
// apron in the game, so they all compile to the one program that clamp's cache key names.
const _APRON_MAT=(function(){
  const m=toonMat({color:0xffffff,vertexColors:true});
  return (typeof _fogClamp==="function"&&typeof GROUND_FOG==="string")?_fogClamp(m,GROUND_FOG):m;
})();
// what is the OPEN ground on this plot — lawn, or the King's Road? Same closed form the road's own
// vertex tint uses (02-world.js:1365), so a building standing on the highway does not get a lawn-
// green pool painted across the paving (§8.7's undergrowth-through-the-plaza, in decal form).
function _apronGround(x,z){
  if(typeof TCPOS==="undefined")return APRON_PAL.grass;
  const A=TCPOS[0],B=TCPOS[1],u=(x-A[0])/(B[0]-A[0]);
  if(u<-0.02||u>1.02)return APRON_PAL.grass;
  const zc=A[1]+(B[1]-A[1])*u+Math.sin(u*Math.PI)*16+Math.sin(u*Math.PI*3)*4;
  return Math.abs(z-zc)<5.4?APRON_PAL.road:APRON_PAL.grass; // the ribbon is 4.55-5.10 discs, overlapped
}
// HOW WIDE IS THE BUILDING, not how wide is its PLOT. def.r is a spacing radius — 11 for a town
// centre whose widest hide is 7.5 — so sizing the pool off it paints a lawn instead of a seam. The
// merged body knows the truth, and the answer is per AXIS: half of these types are long halls, and
// a circle drawn round a 16x9 longhouse leaves both gable ends standing in open grass.
// EVERY VERTEX IS NOT ONE VOTE. The first cut of this binned vertices by angle and took the median
// bin, which is wrong twice over: a BoxGeometry carries eight vertices and nothing in between, so
// twelve of sixteen bins on a boxy building come back empty and the median reads a building half
// its size (the age-5 house measured 1.78 against a 3.6 half-width). Weighting by TRIANGLE AREA
// fixes both that and the thing the binning was there for — the lodge's flagpole is planted 8.8 out
// on its own apron and the fire pit 7.4, and between them they are a few percent of the surface, so
// the area gate below throws them out and keeps the 7.5 brim that matters. Cut at 0.62 of the height
// because that is the eave line on most types, which is the drip line the eye reads as the edge of
// the building. Unmerged bodies (the placement ghost) never get here; if one does, the caller falls
// back to def.r rather than reading vertices with transforms still hanging off them.
function _bFootprint(body,bs){
  if(!body||!body.userData.bMerged)return null;
  const geos=[];
  body.traverse(o=>{if(o.isMesh&&o.geometry&&o.material&&o.material.isMeshToonMaterial&&
    o.geometry.attributes&&o.geometry.attributes.position)geos.push(o.geometry);});
  let top=0;
  for(const g of geos){const p=g.attributes.position;for(let i=0;i<p.count;i++){const y=p.getY(i);if(y>top)top=y;}}
  const cut=top*0.62, T=[]; let A=0;
  for(const g of geos){
    const p=g.attributes.position, ix=g.index, n=ix?ix.count:p.count;
    for(let i=0;i+2<n;i+=3){
      const a=ix?ix.getX(i):i, b=ix?ix.getX(i+1):i+1, c=ix?ix.getX(i+2):i+2;
      const ay=p.getY(a),by=p.getY(b),cy=p.getY(c);
      if(ay>cut&&by>cut&&cy>cut)continue;
      const ax=p.getX(a),bx=p.getX(b),cx=p.getX(c),az=p.getZ(a),bz=p.getZ(b),cz=p.getZ(c);
      const ux=bx-ax,uy=by-ay,uz=bz-az,vx=cx-ax,vy=cy-ay,vz=cz-az;
      const w=Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)*0.5;
      if(!(w>1e-6))continue;
      T.push([w,Math.max(Math.abs(ax),Math.abs(bx),Math.abs(cx)),Math.max(Math.abs(az),Math.abs(bz),Math.abs(cz))]);
      A+=w;
    }
  }
  if(!A)return null;
  // TWO STAGES, because a percentile alone is wrong in both directions. 85% of the area is a gate,
  // not an answer: a dome carries its surface over every radius from 0 to its rim, so the percentile
  // lands INSIDE it and the seam would be painted under the building. So the percentile only says
  // what counts as an outlier (anything past 1.25x it — the mast, the fire pit), and the width is
  // the outermost thing that is not one. On the lodge that is the 7.5 brim, which is the drip line.
  const edge=k=>{
    const s=T.slice().sort((p,q)=>p[k]-q[k]); let acc=0, gate=s[s.length-1][k];
    for(const t of s){acc+=t[0]; if(acc>=A*0.85){gate=t[k]*1.25;break;}}
    let m=0; for(const t of s){if(t[k]<=gate&&t[k]>m)m=t[k];}
    return m;
  };
  return {x:edge(1)*bs,z:edge(2)*bs};
}
// One ring plan for both shapes. `straight` is the half-length of a wall footing's spine: every
// ring is then a stadium rather than a circle, because a round pad under a 12.5-long, 2-wide
// palisade pokes out sideways like a dinner plate under a ruler (the note the old box footing
// carried, and it is still true).
function _apronGeo(fx,fz,plazaR,x,z,y0,rot,lift,straight){
  // every ring is an ELLIPSE on the building's own aspect: `fp` is the mean half-width and carries
  // the ring plan, and each vertex is stretched back out to fx/fz. A long hall in a round pool has
  // both its gable ends standing in open grass, which is the defect this is here to fix.
  const fp=(fx+fz)*0.5, ex=fx/fp, ez=fz/fp;
  const pool=fp*1.34, outer=Math.max(plazaR,pool), N=APRON_SEG;
  const ground=_apronGround(x,z), band=t=>fp+t*(pool-fp);
  // 45% of the skirt is the dark, 30% the mid, the rest is the ground coming back. The first cut
  // spent 20% on the dark and the render came back with a hairline: the pool is only a third of a
  // footprint wide to begin with, so a fifth of that is under a pixel at play distance.
  const kOf=r=>r<=band(0.45)+1e-4?0:r<=band(0.75)+1e-4?1:2;
  const rs=[0,fp*0.72,band(0.45),band(0.48),band(0.75),band(0.78),pool];
  if(outer>pool+0.03)rs.push(outer);
  // the plaza's edge is a HUE change and it has to stay an edge: a vertex colour interpolates, so
  // two rings 0.02 apart is what "hard" costs here. Without it the earth court bleeds into the
  // lawn over two units and the town centre grows a khaki halo.
  if(plazaR>0.08&&plazaR<outer-0.08)rs.push(plazaR-0.02,plazaR);
  rs.sort((a,b)=>a-b);
  const rings=[];
  for(const r0 of rs){
    const r=Math.min(r0,outer);
    if(rings.length&&r-rings[rings.length-1].r<0.012)continue;
    rings.push({r,pal:r>plazaR-0.01?ground:APRON_PAL.dirt,k:kOf(r)});
  }
  const cs=Math.cos(rot||0), sn=Math.sin(rot||0);
  // THE STOPS LEAN DOWN-SUN; THE OUTLINE DOES NOT. A concentric ring is the same ring whichever way
  // the sun points, which is what a bulb directly overhead would draw — 02-world.js:2063 found that
  // and pulled its 1,300 pools into teardrops. A building cannot take the same treatment whole,
  // because this mesh is also the plaza and a lopsided court reads as a mistake, so the OUTERMOST
  // ring stays a circle and only the VALUE breaks are dragged: the dark reaches ~16% further on the
  // shaded side and pulls in on the side the camera is on (§3.1 puts the sun behind the camera in
  // five of six vantages, so the tight crescent is most of what the player ever sees). Direction is
  // READ from _SUN_OFF, never written out again here — the shadow map already uses that vector, and
  // a second copy of (120,80) points the painted shadows one way and the cast ones the other the
  // first time somebody tunes the rig by a few degrees.
  let sux=-0.832, suz=-0.555;                   // ground projection of the sun, negated: where shade lies
  if(typeof _SUN_OFF!=="undefined"){const L=Math.hypot(_SUN_OFF.x,_SUN_OFF.z)||1; sux=-_SUN_OFF.x/L; suz=-_SUN_OFF.z/L;}
  const slx=sux*cs-suz*sn, slz=sux*sn+suz*cs;   // …in the mesh's own frame, which a wall footing yaws
  // …and the radii are then forced to STAY IN ORDER down each column. A ring that leans 16% out
  // while the ring outside it holds still will overtake it — the geometry turns inside out and the
  // pool draws a bow-tie. Clamping per column keeps the lean everywhere there is room for it and
  // degenerates it to nothing where there is not, which is the down-sun edge of a court.
  const nR=rings.length, RAD=[];
  for(let i=0;i<nR;i++)RAD.push(new Float64Array(N));
  for(let j=0;j<N;j++){
    const a=j/N*Math.PI*2, d=Math.sin(a)*slx+Math.cos(a)*slz;
    let prev=-1e9;
    for(let i=0;i<nR;i++){
      let rr=i<nR-1&&rings[i].r>fp*0.5?rings[i].r*(1+0.16*d):rings[i].r;
      if(rr<prev+0.004)rr=prev+0.004;
      prev=RAD[i][j]=rr;
    }
  }
  const pos=[],col=[],idx=[];
  const ring=(i,pal,k,drop)=>{
    const c=srgb(pal[k]);                       // §7.4: a vertex colour is LINEAR albedo
    for(let j=0;j<N;j++){
      const a=j/N*Math.PI*2, si=Math.sin(a), co=Math.cos(a);
      const rr=i<0?RAD[nR-1][j]+0.55:RAD[i][j];
      let lx=rr*si*ex; const lz=rr*co*ez;
      if(straight)lx+=si>=0?straight:-straight;
      const wx=x+lx*cs+lz*sn, wz=z-lx*sn+lz*cs;  // the wall footing turns with its wall; the drape must not
      let y=terrainHeight(wx,wz)-y0+lift;
      // under the building the drape is capped: a plot that rises 0.4 across its own footprint would
      // otherwise push earth up through the floor and out of the doorway.
      if(drop)y-=3.4; else if(rr<fp*1.02&&y>0.16)y=0.16;
      pos.push(lx,y,lz); col.push(c.r,c.g,c.b);
    }
  };
  for(let i=0;i<nR;i++)ring(i,rings[i].pal,rings[i].k,false);
  // the skirt, buried: the drape samples 18 points a ring and the terrain grid is finer than that in
  // places, so the rim still needs something hanging under it or a hillside pokes through the pool.
  const last=rings[nR-1];
  ring(-1,last.pal,last.k,true);
  const R=nR+1;
  for(let i=0;i<R-1;i++)for(let j=0;j<N;j++){
    const jn=(j+1)%N, a=i*N+j, b2=i*N+jn, c=(i+1)*N+jn, d=(i+1)*N+j;
    idx.push(a,d,c, a,c,b2);                    // wound so the cap faces the sky, the skirt faces out
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute("color",new THREE.Float32BufferAttribute(col,3));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
// Build or re-fit a building's apron. Re-fit matters: `_restyleOneBuilding` throws the body away on
// every age-up and an age-5 town centre is a different footprint from the age-0 lodge, so a pool
// sized once at foundation time would end up a ring around thin air four ages later.
function fitApron(b){
  const def=b.def, bs=BSCALE[b.type]||1, f=def.wall?null:_bFootprint(b.body,bs);
  const fx=def.wall?1.5:Math.max(1.4,(f&&f.x)||def.r*0.62),
        fz=def.wall?1.5:Math.max(1.4,(f&&f.z)||def.r*0.62), fp=(fx+fz)*0.5;
  // the lift steps four ways by plot so two overlapping aprons are rarely coplanar. Aprons DO
  // overlap: wall footings run into one continuous course by design, and several types are wider
  // than the def.r the placement rules space them by. Two flat surfaces at one height over a
  // 534-unit plane is the z-fight the road decals stagger for (02-world.js:1372). bHash, not
  // Math.random(): §10.7, and the guest has to lay the same course.
  const lift=0.10+(bHash(b.x,b.z,b.type,0)&3)*0.015;
  // the earth court, where the type has one. §2.2 keeps dirt.base for "camp floors", and the town
  // centre, the castle and the farm have stood on one since v53 — that is the "plaza" the pool takes
  // dirt.shadow on. Everything else stands on the lawn and takes grass.shadow, per §8.9.
  // A LIST, NOT A RATIO. The obvious test is def.r against the measured mesh, and it is unstable
  // exactly where it matters: a house's plot is within 5% of its own walls at some ages and 40%
  // wider at others, so a ratio flips the ground out from under a building when it ages up.
  const plaza=def.wall?fp*0.98:(APRON_COURT[b.type]?def.r*0.92:fp*0.98);
  const geo=_apronGeo(fx,fz,plaza,b.x,b.z,b.root.position.y,b.rot||0,lift,def.wall?5.2:0);
  if(b.apron){b.apron.geometry.dispose(); b.apron.geometry=geo;}
  else{
    b.apron=new THREE.Mesh(geo,_APRON_MAT);
    // §3.8 again, and this is the half of it the critic measured: the apron IS ground, so the
    // building's own cast shadow, and every unit standing on its plaza, finally land on something.
    b.apron.castShadow=false; b.apron.receiveShadow=true;
    b.apron.rotation.y=def.wall?(b.rot||0):0;   // the footing follows the wall; a round pool needs no yaw
    b.root.add(b.apron);
  }
}

let BID=0; // network-stable building ids: host-assigned, guests adopt via bnew
function makeBuilding(team,type,x,z,instant,rot){
  const def=BLD[type];
  const root=new THREE.Group(); root.position.set(x,terrainHeight(x,z),z);
  const wrap=new THREE.Group(); const bs=BSCALE[type]||1; wrap.scale.setScalar(bs); root.add(wrap);
  // the plot's own coordinates seed this building's variant — see bHash. Deterministic, so the
  // guest builds the same house on the same ground and an age-up does not reshuffle the street.
  const body=buildingMesh(type,team,undefined,x,z); mergeBuildingBody(body); // ~26 meshes -> 1
  if(rot)body.rotation.y=rot; wrap.add(body); scene.add(root);
  const b={id:BID++,team,type,def,x,z,root,body,wrap,rot:rot||0,hp:def.hp,maxHp:def.hp,
    built:!!instant,progress:instant?def.hits:0,alive:true,atkT:0};
  fitApron(b); // the foundation, the plaza and the contact shadow, in the one mesh they used to fight over
  if(type==="watch_tower")b.deck=watchDeck(b.body.userData.age,bs);
  // v132.22 …and an age-5 curtain carries one too, but RECTANGULAR: a terreplein is 12.5 by 4.4,
  // not a tower top. z0/z1 rather than r, clamped in the wall's own local frame so a curtain at any
  // rotation is clamped along ITS length.
  // v132.23 AGE-GATED FOR REAL. The line above said "age 5 only" and did not test the age, while
  // the terreplein and the ladder are drawn only in the age>=5 branch of the wall builder. A
  // palisade is 5.0 tall with a plank walk at 3.30 and a Medieval curtain is 9.4 and solid: both
  // would have offered a deck at 4.00 with no ladder to reach it, which is standing in mid-air
  // beside the one and inside five units of masonry on the other. The MESH's own age, which is the
  // field watchDeck is handed one line up — so a wall that ages into a star fort gains its deck on
  // the restyle below, and one that has not reached §F.6 has none.
  if(b.def.wall&&!b.def.gate&&(b.body.userData.age|0)>=5)
    b.deck={y:WALL_DECK_Y,hx:WALL_DECK_HX-0.7,z0:WALL_DECK_Z0+0.7,z1:WALL_DECK_Z1-0.7};
  b.bar=makeBar(root,BARH[type]||10,4,0x4caf50);
  if(def.heal){ // visible healing aura
    const aura=new THREE.Mesh(new THREE.RingGeometry(def.heal.rng-0.35,def.heal.rng,40),
      new THREE.MeshBasicMaterial({color:0x6fdc7a,transparent:true,opacity:0.18,side:THREE.DoubleSide}));
    aura.rotation.x=-Math.PI/2; aura.position.y=0.07; root.add(aura);
  }
  b.bar.bg.visible=b.bar.fg.visible=false;
  if(!instant){
    body.scale.y=0.15;
    _bGhost(body);
  }
  // the crop hangs off `wrap`, NOT off `body`, and that is load-bearing now: b.tassels flips the
  // nine golden heads visible one at a time as the field ripens, so those meshes can never be
  // welded into anything. Keeping the merge scoped to `body` bars them by construction, the way
  // 04-units bars R.logs (:236) rather than by naming them.
  if(type==="farm"){ // corn stalks: they grow, and golden tassels mean HARVEST ME
    const crop=new THREE.Group();
    b.tassels=[];
    // …AND THE JITTER IS HASHED, NOT RANDOM. AGES §G.5 / AD §10.15: building appearance is a pure
    // function of (x, z, type, age) and never Math.random(). These nine stalks were the last place
    // in the file still rolling dice — the host and every guest laid the same farm out DIFFERENTLY,
    // and unlike a wrong colour a desynced building cannot be spotted in a screenshot. Two more
    // avalanche rounds off bHash give each stalk its own pair of offsets from the plot's own seed.
    const cropSeed=bHash(x,z,"crop",0);
    for(let gx=-1;gx<=1;gx++)for(let gz=-1;gz<=1;gz++){
      const k=(gx+1)*3+(gz+1);
      let hs=(cropSeed^Math.imul(k+1,0x9E3779B1))>>>0;
      hs^=hs>>>15; hs=Math.imul(hs,0x2c1b3c6d)>>>0; hs^=hs>>>13;
      const jx=((hs&1023)/1023-0.5)*1.6, jz=(((hs>>>10)&1023)/1023-0.5)*1.6;
      const st=new THREE.Mesh(new THREE.BoxGeometry(0.26,2.2,0.26),plainMat(0x4f7d2f));
      st.position.set(gx*5.2+jx,1.1,gz*5.2+jz);
      st.castShadow=false; crop.add(st);
      const tas=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.6,0.28),plainMat(0xe8c53a));
      tas.position.set(st.position.x,2.4,st.position.z);
      tas.castShadow=false; tas.visible=false; crop.add(tas); b.tassels.push(tas);
    }
    crop.scale.y=0.15; wrap.add(crop);
    b.cropMesh=crop; b.crop=0;
  }
  clearFootprint(b); // v114: the plot is cleared of standing timber the moment it's laid out
  // v131.30 A BUILDING CLEARS THE GROUND IT STANDS ON. No world-gen exclusion can cover this: the
  // foliage is sown once at load and this barracks is being placed minutes later, so §8.7's "zero
  // props within 1.5 tiles of any building footprint" is a RUNTIME rule for everything except the
  // Town Centres. The radius is the building's own physical extent — bSteer is the longest half
  // extent it will ever have and rBlock is what a body is pushed out to — plus a tile of margin, so
  // the clearing matches the footprint rather than a guess about it.
  // Display only: nothing in the simulation reads an instance matrix (10.6 / §G), so this cannot
  // desync, and it is deliberately one-way — ground somebody has built on stays cleared.
  if(typeof clearFoliageAt==="function"){
    const _fr=Math.max((typeof bSteer==="function")?bSteer(b.def):0,b.def.rBlock||b.def.r||0)
      *((typeof BSCALE!=="undefined"&&BSCALE[type])||1)+1.5;
    clearFoliageAt(b.x,b.z,_fr);
  }
  buildings.push(b); return b;
}
// v114: fell every live tree under a new building's footprint. Wood nodes no longer refuse a
// plot (see validFor), so SOMETHING has to remove them or a house would grow through a spruce.
// Host-authoritative: guests get the same fell through the existing {t:"ndep"} message, and a
// guest calling this locally is harmless because it clears the same deterministic node indices.
function clearFootprint(b){
  if(typeof nodes==="undefined"||typeof depleteNode!=="function")return;
  const reach=b.def.r+(b.def.wall?1.6:2.2); // walls sit tight; everything else wants elbow room
  for(const n of nodes){
    if(n.type!=="wood"||n.amount<=0)continue;
    const dx=b.x-n.x, dz=b.z-n.z;            // dist2() lives in 04-units, which may not be loaded
    if(dx*dx+dz*dz>reach*reach)continue;      // yet when the starting town centres go down
    n.amount=0;
    depleteNode(n); // the 10-net WRAPPER: plays the treefall and bcasts {t:"ndep"} for free,
                    // so guests fell exactly the same node indices with no new wire format.
                    // The stump ring it leaves around a woodland outpost is deliberate — that
                    // ground was cleared, and it reads that way.
  }
}
// when a team advances, every standing building re-dresses in the new age's architecture.
// GAMEPLAY callers pass defer=true: jobs queue up and drain a few per frame, so an age-up
// re-dresses the town in a quick visible wave instead of one snapshot-stalling hitch.
const _restyleQ=[];
const _roadsDirty=[false,false];
function markRoadsDirty(team){_roadsDirty[team]=true;}
function _restyleOneBuilding(b){
  if(!b.alive)return;
  const nb=buildingMesh(b.type,b.team,teamAge[b.team],b.x,b.z); mergeBuildingBody(nb);
  nb.rotation.y=b.rot||0;
  if(!b.built){ // under-construction sites keep their scaffolding look
    nb.scale.y=0.15+0.85*(b.progress/b.def.hits);
    _bGhost(nb);
  }
  (b.wrap||b.root).remove(b.body);
  // v130 B1 THE LEAK. "materials are cached and shared — leave them be" was copied from the unit
  // disposer and it was never true here: units draw on _skinCache, buildings draw on box()/cyl()/
  // cone(), which route through 01-engine's UNCACHED mat(). So every age-up threw away a town
  // centre's worth of MeshToonMaterials — ~69 of them — and Three.js frees no GPU program or
  // uniform buffer on remove(). Four ages into a long match that is thousands of orphans, which is
  // the same shape as the v122 unit-geometry leak that took John's phone out.
  // The merge above now frees the bulk of them at weld time; this sweeps up what a merged body
  // still carries of its own — the blacksmith's hearth material, and a construction ghost's clone
  // if the site never finished. isSharedMat guards the atlas and the _skinCache; ink hulls are
  // cached in 01-engine's INK_MATS and are the only ShaderMaterial a building has, so skipping
  // them by that test needs no list to keep up to date.
  // The ghost clone is checked FIRST and by identity: a site re-dressed mid-raise carries a cloned
  // INK material, and ink is a ShaderMaterial, so the general test below would nurse it forever.
  b.body.traverse(o=>{
    if(o.geometry)o.geometry.dispose();
    const m=o.material; if(!m)return;
    if(o.userData.bMat&&o.userData.bMat!==m)m.dispose();
    else if(!isSharedMat(m)&&!m.isShaderMaterial)m.dispose();
  });
  b.body=nb; (b.wrap||b.root).add(nb);
  // the deck is a property of the MESH, and _restyleOneBuilding just threw the mesh away. §F.6's
  // Enlightenment watch tower is 6.3 units shorter than the Medieval one it replaces, so a garrison
  // that aged up without this line would be standing in mid-air over its own gun platform.
  if(b.type==="watch_tower")b.deck=watchDeck(nb.userData.age,BSCALE[b.type]||1);
  // v132.23 …and the restyle is where a curtain GAINS one: it is rebuilt at the new age, so the
  // test is the new mesh's age and the else clears a deck the old mesh had. Assigning
  // unconditionally, as v132.22 did, gave a Bronze palisade a rampart at 4.00.
  if(b.def.wall&&!b.def.gate)
    b.deck=((nb.userData.age|0)>=5)?
      {y:WALL_DECK_Y,hx:WALL_DECK_HX-0.7,z0:WALL_DECK_Z0+0.7,z1:WALL_DECK_Z1-0.7}:null;
  fitApron(b); // the new age is a new footprint; a pool sized to the old one is a ring around air
  puff(b.x+(Math.random()-0.5)*3,2.5,b.z+(Math.random()-0.5)*3,0xffe27a,1.4,0.8);
}
function drainVisualQueue(){ // a few jobs per frame: the wave sweeps the town in ~a quarter second
  let budget=5;
  while(budget>0&&_restyleQ.length){
    const j=_restyleQ.shift();
    if(j.kind==="b")_restyleOneBuilding(j.b);
    // v131.11 THE SAME FILTER LIVED HERE TOO, which is why fixing restyleUnits alone did
    // nothing: the king was enqueued and then dropped on the way out. If a job reached this
    // queue something decided it needed re-dressing, so trust that decision and just check the
    // unit is still alive.
    else if(j.kind==="u"&&j.u.alive)buildBodyFor(j.u);
    budget--;
  }
  if(_restyleQ.length)return; // roads repave once the wave has passed
  for(const team of [0,1])if(_roadsDirty[team]){_roadsDirty[team]=false;rebuildRoads(team);}
}
function restyleBuildings(team,defer){
  for(const b of buildings){
    if(!b.alive||b.team!==team)continue;
    if(defer)_restyleQ.push({kind:"b",b});
    else _restyleOneBuilding(b);
  }
  if(defer)markRoadsDirty(team);
  else rebuildRoads(team); // streets repave themselves in the new age's surface
}
function addConstructionHit(b,who){
  awardPts(who,costPts(b.def.cost)/(3*b.def.hits)); // a third of the value, spread over the raising
  if(b.built)return;
  if(who&&isHuman(who)){ // MASTER BUILDER: your first swing on a site counts extra — once per site
    const bst=buffSt(who,"builder");
    if(bst){b._mb=b._mb||{}; if(!b._mb[who.id]){b._mb[who.id]=1; b.progress+=bst;}}
  }
  b.progress++;
  const f=b.progress/b.def.hits;
  b.body.scale.y=0.15+0.85*f;
  puff(b.x+(Math.random()-0.5)*2,1+f*3,b.z+(Math.random()-0.5)*2,0xd8c49a);
  if(typeof Sound!=="undefined"){Sound.play("build",{x:b.x,z:b.z}); // v100: hammer/construction on each swing
    if(Math.random()<0.12)Sound.play("veffort",{x:b.x,z:b.z});} // v109: sparse work grunts under the hammer
  if(b.progress>=b.def.hits){
    b.built=true; b.body.scale.y=1;
    if(typeof Sound!=="undefined")Sound.play("complete",{x:b.x,z:b.z}); // v100: completion chime
    if(b.qBy!==undefined){ // quest credit goes to the human who PLACED the foundation
      const ow=units.find(u=>u.id===b.qBy);
      if(ow&&isHuman(ow)&&typeof questProgress==="function")
        questProgress(ow,(b.def.wall&&!b.def.gate)?"build_wall":"build_"+b.type);
    }
    // (farms grow corn now — see the crop cycle in makeBuilding/economyTick)
    // Hand the shared material back and free the ghost's clone. The old line just wrote opacity=1
    // onto the clone and walked away, which orphaned one material per mesh per site raised —
    // ~26 a house before the merge, one after it, and zero now. The in-place opacity write stays
    // as the fallback for a body that has no stashed original (a guest's bbuilt handler in
    // 10-net.js takes that path, and it must keep working unchanged).
    b.body.traverse(o=>{
      if(!o.material)return;
      const orig=o.userData.bMat;
      if(orig&&orig!==o.material){const ghost=o.material; o.material=orig; o.userData.bMat=undefined; ghost.dispose();}
      else {o.material.opacity=1; o.material.transparent=false;}
    });
    if(roadEligible(b))markRoadsDirty(b.team); // a new building extends the street grid (coalesced)
    const nearP=player&&player.alive&&dist2(b.x,b.z,player.root.position.x,player.root.position.z)<45*45;
    if(who&&who.isPlayer){
      msg("You finished the "+b.def.name+"!","blue");
      if(b.type==="house")msg("Blue respawn time reduced.","blue");
    }else if(b.team===BLUE&&b.type==="barracks"){
      msg("Your team raised a Barracks — stand beside it and press R to arm up!","blue");
    }else if(b.team===RED&&b.type==="barracks"&&!window._redBar){
      window._redBar=true;
      msg("Scouts report: the Red team raised a Barracks…","red");
    }else if(b.team===BLUE&&nearP&&b.type!=="house"){
      msg((who?who.name:"The team")+" finished a "+b.def.name+".","blue");
    }
  }
}
function damageBuilding(b,dmg,att){
  if(typeof NET!=="undefined"&&NET.mode==="guest")return; // host owns all damage
  if(!b.alive)return;
  if(att&&!att.def&&isHuman(att)&&att.team!==b.team)
    dmg*=1+0.10*buffSt(att,"wreck"); // WRECKER: human demolition specialists
  b.lastHit=T; // patrol bands answer struck buildings
  b.hp-=dmg; b.bar.bg.visible=b.bar.fg.visible=true; setBar(b.bar,b.hp/b.maxHp);
  if(typeof Sound!=="undefined")Sound.play((b.type&&b.type.indexOf("wood")>=0)?"bldhitwood":"bldhit",{x:b.x,z:b.z}); // v102: structural crunch
  // v113: the alarm is a WARNING, not a metronome — under a sustained bombardment the old 4 s
  // gate rang the bell nonstop (John's v112 note). One toll per minute per team now.
  if(typeof Sound!=="undefined"&&b.team===MYTEAM)Sound.play("basealarm"); // v103: your base under attack (mgr throttles to BASEALARM_CD)
  if(typeof NET!=="undefined"&&NET.mode==="host"&&typeof teamHasHuman==="function"&&teamHasHuman(b.team)){
    window._baT=window._baT||{}; if(T-(window._baT[b.team]||-999)>60){window._baT[b.team]=T;NET.bcast({t:"snd",k:"basealarm",team:b.team});}
  }
  if(b.hp<=0){
    awardPts(att,costPts(b.def.cost)); // razing pays the building's full cost
    if(att&&!att.def&&isHuman(att)&&att.team!==b.team&&typeof questProgress==="function")
      questProgress(att,b.type==="farm"?"raze_farm":"raze_bld");
    b.alive=false; scene.remove(b.root);
    if(typeof Sound!=="undefined")Sound.play("raze",{x:b.x,z:b.z}); // v102: the building falls
    if(b.node){b.node.amount=0;b.node.mesh.visible=false;} // burnt farm feeds no one
    if(!b.def.wall&&b.type!=="farm"&&b.type!=="storage_pit")markRoadsDirty(b.team); // streets re-route (coalesced)
    msg(TEAMNAME[b.team]+" "+b.def.name+" destroyed!", b.team===BLUE?"warn":"gold");
  }
}
function teamHouses(team){return buildings.filter(b=>b.alive&&b.built&&b.team===team&&b.type==="house").length;}
function respawnDelay(team){return Math.max(10,30-1*teamHouses(team));} // v84: slower base, gentler house scaling, higher floor
function nearestBuilt(team,type,x,z,maxD){
  let best=null,bd=(maxD||1e6)*(maxD||1e6);
  for(const b of buildings){
    if(!b.alive||!b.built||b.team!==team||b.type!==type)continue;
    const d=dist2(x,z,b.x,b.z);
    if(d<bd){bd=d;best=b;}
  }
  return best;
}
function teamTC(team){return buildings.find(b=>b.alive&&b.team===team&&b.type==="towncenter");}

// pre-built town centers
makeBuilding(BLUE,"towncenter",TCPOS[0][0],TCPOS[0][1],true);
makeBuilding(RED,"towncenter",TCPOS[1][0],TCPOS[1][1],true);
