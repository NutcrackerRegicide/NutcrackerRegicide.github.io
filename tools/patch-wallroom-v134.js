#!/usr/bin/env node
/* patch-wallroom-v134.js — v134.4, part three: a turtle that has outgrown its own wall line.
 *
 * MEASURED on SMOKE_SEED=42, red playing turtle, with the v134.4 economy in: age 5, a plan of eight
 * curtain segments, and ALL EIGHT refused by validFor — not by the farm ring, just blocked ground.
 * The retry had already stepped the front from 34 to 44 and used itself up, so wallsDone was set
 * with zero segments standing. The gate that caught it says the whole story in its own numbers:
 * "+0 segments … and finishes with a gate (0)".
 *
 * The line that did it is v94's, and its comment is honest about what it assumed:
 *     "the whole line was inside the town: step 14 paces farther out, ONCE"
 * One step of fourteen was tuned against the town a turtle used to build. The v134.3 band economy
 * and the v134.4 haul fix both make that town bigger and older — seed 42's red reaches age 5 where
 * before it reached three — so one step is no longer enough to clear it, and the marshal gives up
 * rather than looking further out.
 *
 * THREE STEPS, not one. Nothing else changes: the same +14, the same "only if not one segment of
 * the line went up", the same stand-down when there is genuinely nowhere. A turtle that cannot find
 * room at 34, 48 or 62 has a town that fills its own frontage, and standing down is then correct.
 *
 * ⚠ It is a DIAL, and John's if he wants it turned: a curtain at 62 is further from the throne than
 * this game has ever put one. The alternative — a shorter line closer in — is a different design
 * decision about what a wall is for, and not one to make inside a bug fix.
 */
const fs=require("fs"),path=require("path");
const F=path.join(__dirname,"..","js","07-ai.js");
let s=fs.readFileSync(F,"utf8");
let failed=[];
function sub(name,from,to){
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
}

sub("the curtain looks further out than once",
`      if(!anyWall&&!D.wallRetry){ // the whole line was inside the town: step 14 paces farther out, once
        D.wallRetry=1; D.wallFront=(D.wallFront||30)+14; D.wallPlan=null;`,
`      // v134.4: THREE steps, not one. This was !D.wallRetry — a single boolean — and on SMOKE_SEED
      // =42 with the v134.4 economy a turtle at age 5 had all eight of its segments refused at 34
      // and all eight again at 44, then set wallsDone with nothing standing. A bigger, older town
      // needs the curtain further out than one step of fourteen; three steps reach 76 from the
      // throne, and a turtle that cannot find room at any of them is genuinely full and stands down.
      if(!anyWall&&(D.wallRetry||0)<3){ // the whole line was inside the town: step 14 paces out
        D.wallRetry=(D.wallRetry||0)+1; D.wallFront=(D.wallFront||30)+14; D.wallPlan=null;`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patch-wallroom-v134: OK");
