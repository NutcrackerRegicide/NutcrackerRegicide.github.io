#!/usr/bin/env node
/* v132.3 — THE VIKING ROAD, RE-TUNED AGAINST WHAT IT MEASURED
   -----------------------------------------------------------
   node tools/patch-vikingtune.js       (idempotent: re-running reports NOTHING WRITTEN)

   v132.2 authored the ribbon. tools/vikingroad.js then measured it against the King's Road in the
   same run — which is the whole point of that gate: it does not carry invented thresholds, it
   carries the shipped road's own numbers. Two of them came back wrong, and neither was visible by
   eye in a wireframe:

   ------------------------------------------------------------------------------------------------
   1. IT LURCHED.                                        VIKING      KING'S ROAD
        half-width min                                     1.42            3.84
        half-width max                                     3.49            5.86
        max/min                                            2.46            1.53
   A track 2.8 wide in one place and 7.0 in the next is not a worn path, it is a lumpy one. The
   King's Road breathes by 1.53x and reads as a road; 2.46x reads as a mistake. The cause was
   arithmetic and obvious once the numbers were on the page: I had scaled the King's Road's edge
   wander DOWN by a third (+-0.82 -> +-0.67) while scaling the half-width it perturbs down by HALF
   (4.8 -> 2.45), so the wander went from 17% of the width to 27% of it. Relative wander has to be
   held, not absolute wander.
     base       2.45 -> 2.55     (the mean width comes up from 4.94 to 5.1)
     breathing  +-0.48 -> +-0.22
     wander     +-0.67 -> +-0.48
   -> 1.85..3.25, a track 3.7-6.5 wide that breathes 1.76x. Still scruffier than the King's Road,
   which is the character; no longer lurching, which was not.

   ------------------------------------------------------------------------------------------------
   2. GREENERY STOOD 1.47 OUTSIDE THE DIRT — and a contact-shadow pool reaches 1.85 behind its prop
   (02-world.js's NEAR/FAR pool geometry), so a lawn-green pool was landing on brown earth. That is
   §8.7's artefact by name, and the King's Road keeps 2.8 of margin at its worst.
   THE KEEP-OFF RADIUS WAS NOT THE BUG — the SAMPLING WAS. _FOL_VIKING tested 34 points per branch,
   6.8 units apart, so between two samples the cleared band pinches to sqrt(6^2 - 3.4^2) = 4.9 and
   the margin collapses to 4.9 - 3.49 = 1.4. Which is exactly what the gate found. Raising the
   radius alone would have papered over a hole that would reopen the next time the spine got longer.
     samples  34 -> 60 per branch  (3.9 apart: the band now pinches to 6.3, not 4.9)
     radius   6.0 -> 6.4
   -> 6.31 - 3.25 = 3.06 of margin at the worst pinch, against the King's Road's 2.8. Held to the
   shipped road's own number rather than to the 1.85 the pool needs, because "no worse than the
   thing we already looked at and liked" is a fact and 1.85 is a floor.

   COLOUR IS NOT TOUCHED HERE. The gate's cut-line check was invalid and has been withdrawn from it:
   it compared the ROAD's vertex colours against the TERRAIN's, and terrain vertex colours are
   MULTIPLIERS around 1.0 on a green base, not absolute colours — hence a "lawn luminance" of 1.239,
   which is not a luminance at all. That question can only be answered in a rendered frame and it is
   tools/vikingshot.js's job now. Retuning a palette against a broken meter is how v130.4 shipped a
   road with the value order inverted.                                                             */
const fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
let total=0,failed=0;
const F={};
const load=f=>(F[f]=F[f]!==undefined?F[f]:fs.readFileSync(path.join(ROOT,"js",f),"utf8"));
function sub(file,from,to,why){
  const s=load(file), n=s.split(from).length-1;
  if(n!==1){console.log("  !! "+file+" expected 1, found "+n+"  <<"+from.slice(0,64).replace(/\n/g,"\\n")+">>");failed++;return;}
  F[file]=s.split(from).join(to); total++; console.log("  ok  "+why);
}
if(load("02-world.js").indexOf("HW0=2.55")>=0){console.log("already applied — NOTHING WRITTEN");process.exit(0);}

// ---- 1. the width stops lurching ---------------------------------------------------------------
sub("02-world.js",
`  const N=40, SUB=6, M=N*SUB, TILE=11.5, HW0=2.45;`,
`  const N=40, SUB=6, M=N*SUB, TILE=11.5, HW0=2.55;`,
  "02-world.js: base half-width 2.45 -> 2.55");

sub("02-world.js",
`      const hw=HW0+0.30*Math.sin(t*17.3+team*2.1)+0.18*Math.sin(t*41.7-team*1.3);`,
`      // v132.3 +-0.22, not +-0.48. RELATIVE wander is what has to be held against the King's Road,
      // not absolute: scaling its numbers down by a third while halving the width they perturb took
      // the breathing from 17% of the half-width to 27% and the road came out lumpy. Measured
      // max/min was 2.46 against the King's Road's 1.53; this is 1.76.
      const hw=HW0+0.14*Math.sin(t*17.3+team*2.1)+0.08*Math.sin(t*41.7-team*1.3);`,
  "02-world.js: the half-width breathes 1.76x instead of lurching 2.46x");

sub("02-world.js",
`        w[k]=Math.max(0.25,(hw+0.34*Math.sin(ex*0.77+ez*0.53)
                              +0.21*Math.sin(ex*1.61-ez*1.07)
                              +0.12*Math.sin(ex*3.30+ez*2.40))*tap);`,
`        w[k]=Math.max(0.25,(hw+0.24*Math.sin(ex*0.77+ez*0.53)
                              +0.15*Math.sin(ex*1.61-ez*1.07)
                              +0.09*Math.sin(ex*3.30+ez*2.40))*tap);`,
  "02-world.js: edge wander +-0.67 -> +-0.48 (19% of the half-width, against the road's 17%)");

// ---- 2. the foliage exclusion stops pinching ----------------------------------------------------
sub("02-world.js",
`// v132.2 …and the Viking track, both branches. 34 samples per branch is 6.8 units apart, so with a
// 6.0 keep-off the cleared band never pinches below 4.9 half-width between samples — against a path
// edge that reaches 3.12 at its widest.
const _FOL_VIKING=[];
for(const _vt of [0,1])for(let i=0;i<=33;i++)_FOL_VIKING.push(vikingPoint(_vt,i/33));`,
`// v132.2 …and the Viking track, both branches.
// v132.3 60 SAMPLES, NOT 34, AND THE RADIUS IS THE SMALLER HALF OF THE FIX. At 34 the samples were
// 6.8 units apart, so between two of them a 6.0 keep-off pinches to sqrt(6^2-3.4^2) = 4.9 and the
// clear margin outside the road collapsed to 1.4 — less than the 1.85 a contact-shadow pool reaches
// behind its prop, which is §8.7's artefact (a lawn-green pool on brown earth). Measured, not
// predicted: tools/vikingroad.js found it at (-18, -137). Raising the radius alone would have
// papered over a sampling hole that reopens the next time the spine gets longer.
// 60 samples is 3.9 apart, so 6.4 pinches to 6.31 — 3.06 of margin against the King's Road's 2.8.
const _FOL_VIKING=[];
for(const _vt of [0,1])for(let i=0;i<=59;i++)_FOL_VIKING.push(vikingPoint(_vt,i/59));`,
  "02-world.js: 60 samples a branch — the cleared band stops pinching between them");

sub("02-world.js",
`  // v132.2 6.0 for the Viking track against 9.0 for the King's Road — it is half the width and the
  // woods are SUPPOSED to crowd it. It still leaves margin for the artefact §8.7 names: a contact
  // shadow pool reaches 1.85 behind its prop, so the nearest one can land is 6.0-1.85 = 4.15 off
  // the spine, against a path edge at 3.12. No lawn-green pool on the dirt.
  for(const r of _FOL_VIKING){const dx=x-r.x,dz=z-r.z;if(dx*dx+dz*dz<6*6)return false;}`,
`  // v132.2/.3 6.4 for the Viking track against 9.0 for the King's Road — it is half the width and
  // the woods are SUPPOSED to crowd it. The number that matters is not this one but the margin it
  // leaves OUTSIDE the dirt once the sampling pinch above is accounted for: 6.31 - 3.25 = 3.06,
  // against the King's Road's measured 2.8, and against the 1.85 a contact-shadow pool reaches
  // behind its prop. No lawn-green pool lands on brown earth. tools/vikingroad.js check 5.
  for(const r of _FOL_VIKING){const dx=x-r.x,dz=z-r.z;if(dx*dx+dz*dz<6.4*6.4)return false;}`,
  "02-world.js: keep-off 6.0 -> 6.4, and the margin is now stated as the measured one");

if(failed){console.log("\n"+failed+" site(s) did not match — NOTHING WRITTEN.");process.exit(1);}
for(const f in F)fs.writeFileSync(path.join(ROOT,"js",f),F[f]);
console.log("\n"+total+" written.\n");
