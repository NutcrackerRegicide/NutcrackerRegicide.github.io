#!/usr/bin/env node
/* v132.5 — THE VIKING ROAD WAS ASH, NOT EARTH
   -------------------------------------------
   node tools/patch-vikingpalette.js    (idempotent: re-running reports NOTHING WRITTEN)

   With the tearing fixed there was finally something worth metering. tools/vikingshot.js walks a
   scanline square across each track — same camera rig, same post stack, same frame-space, both
   roads — and the two numbers that matter came back:

                                  VIKING    KING'S ROAD
       lawn beside it              0.320    0.366 / 0.374
       where it MEETS the lawn     0.340    0.434 / 0.448
       step at the boundary        0.020    0.068 / 0.074      <- KEEP THIS
       centre of the track         0.579    0.457 / 0.484      <- FIX THIS

   THE BOUNDARY IS RIGHT AND IS NOT BEING TOUCHED. This was the one real risk in inverting the
   profile: v130.4 put the King's Road's biggest value step exactly on the grass boundary and it
   read as an outline you could trace round the whole road, and a track whose margin is its darkest
   stop is that arrangement by construction. It came out at 0.020 against the King's Road's own
   0.068-0.074 — a THIRD of the step of the road that shipped. There is no cut line. The margin
   stop moves by half a byte here and only to carry hue.

   THE CENTRE IS WRONG IN TWO WAYS AT ONCE, which is why it took a picture as well as a meter:
     · TOO BRIGHT. 0.579 against a 0.320 lawn is 1.81x; the King's Road runs 1.25x. A path is not
       supposed to be the brightest thing in the frame after the sky. It drew the eye straight down
       its length, which is the opposite of a track you come across in the woods.
     · TOO GREY. blue at 0.625 of red against the King's Road crown's 0.538. Through a neutral grit
       map that lands as ASH — see _viking/viking-play-mid.png before this patch, where it reads as
       gravel or cinders beside a bazaar apron that is visibly warmer earth.
   The second one is the one I would not have found with a meter. Luminance was in range for
   "pale"; nothing measured says "wrong material".

       stop        was              now         b/r     target sRGB lum
       centre   [152,129,95]   [128,106,74]    0.578        0.426
       flank    [127,105,75]   [116, 94,64]    0.552        0.375
       margin   [103, 85,61]   [104, 83,57]    0.548        0.327

   SATURATION STILL RISES WITH DARKNESS — 0.578 / 0.552 / 0.548 — which is what earth does and what
   kingsRoad's palette note demands: dry dust at the top of the profile is pale and washed out, the
   damp compacted floor of a hollow is a deep warm brown. A road whose stops are one hue at three
   brightnesses is a painted stripe with a gradient on it.

   THE PROFILE STAYS INVERTED. Lowering the level does not cost the distinction the inversion was
   for — the King's Road is two dark rut lines on a pale field, this is one pale worn strip on a
   darker field, and at 0.155 of spread against the King's Road's ~0.18 both are still legible at
   range. What it buys is that the two roads now live in the same value range and are told apart by
   WIDTH, PROFILE SHAPE and EDGE CHARACTER rather than by one of them being lit up.

   THE PIPELINE RUNS ~0.07 HOT AGAINST THE AUTHORED TARGET at this vantage — the old centre was
   authored at 0.508 and measured 0.579 — so the new stops are expected to meter around 0.49 / 0.335
   rather than at their targets. That offset is the _RGAIN correction not being exact off-axis; it is
   recorded here rather than tuned out, because chasing it would mean authoring numbers that are
   wrong on purpose at every OTHER vantage.                                                        */
const fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
let total=0,failed=0;
const F={};
const load=f=>(F[f]=F[f]!==undefined?F[f]:fs.readFileSync(path.join(ROOT,"js",f),"utf8"));
function sub(file,from,to,why){
  const s=load(file), n=s.split(from).length-1;
  if(n!==1){console.log("  !! "+file+" expected 1, found "+n+"  <<"+from.slice(0,64).replace(/\n/g,"\\n")+">>");failed++;return;}
  F[file]=s.split(from).join(to); total++; console.log("  ok  "+why);
}
if(load("02-world.js").indexOf("[128,106,74]")>=0){console.log("already applied — NOTHING WRITTEN");process.exit(0);}

sub("02-world.js",
`  const _TGT=[[152,129,95],[127,105,75],[103,85,61]];   // trodden centre / flank / shaded margin`,
`  // v132.5 MEASURED DOWN, AND WARMED. The first cut metered at 0.579 in-frame against a 0.320 lawn
  // — 1.81x, where the King's Road runs 1.25x — so the track was the brightest thing in the frame
  // after the sky and pulled the eye straight down its length. And at blue 0.625 of red against the
  // King's crown's 0.538 it read as ASH through the neutral grit map, not earth: gravel beside a
  // bazaar apron that was visibly warmer than the road leaving it. Saturation still RISES with
  // darkness (b/r 0.578 / 0.552 / 0.548), which is what earth does. tools/vikingshot.js is the
  // meter; the boundary step it reports (0.020 against the King's Road's 0.068) is what the margin
  // stop is protecting and is why that one barely moves.
  const _TGT=[[128,106,74],[116,94,64],[104,83,57]];   // trodden centre / flank / shaded margin`,
  "02-world.js: the palette comes down and warms — earth, not ash");

if(failed){console.log("\n"+failed+" site(s) did not match — NOTHING WRITTEN.");process.exit(1);}
for(const f in F)fs.writeFileSync(path.join(ROOT,"js",f),F[f]);
console.log("\n"+total+" written.\n");
