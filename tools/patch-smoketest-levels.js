#!/usr/bin/env node
/* patch-smoketest-levels.js — gate participation paying LEVEL as well as XP.
 *
 * The existing block asserted XP only, so it would pass unchanged against code that paid no
 * levels at all — which is exactly what it was written against. Levels get their own assertions,
 * and the CAP CLAMP gets one of its own because it is the part with a real failure mode: an
 * unclamped +15 would push a player past XP_MAX_LVL, and `lvl` is read by questPick's cap gate
 * and printed over every player's head by syncNameTags.
 *
 * The clamp test seeds a participant near the cap deliberately. Awarding 15 to someone at 20 must
 * land on 25, not 35, while their XP — uncapped by design — still rises by the full 15.
 */
const fs=require("fs"),path=require("path");
const F=path.join(__dirname,"smoketest.js");
let s=fs.readFileSync(F,"utf8");
let failed=[];
function sub(name,from,to){
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
}

// seed a near-cap participant alongside the others, before the raid is broken
sub("near-cap participant",
`    G.dealDamage(poker,raiders[0],1);
    G.dealDamage(ghost,raiders[0],1);
    G.dealDamage(drone,raiders[0],1);`,
`    const capped=mkHuman(0,shore.x+3,shore.z,"Capped","k-peer");
    capped.lvl=20; capped.xp=0;                    // 5 short of the cap, about to be paid 15
    G.dealDamage(poker,raiders[0],1);
    G.dealDamage(ghost,raiders[0],1);
    G.dealDamage(drone,raiders[0],1);
    G.dealDamage(capped,raiders[0],1);`);

sub("level assertions",
`    check("v132.28 participation: the list is CLEARED on payout, so a second tick cannot double-pay",`,
`    check("v132.28 raid: participation pays LEVELS as well as XP — the poker went to level "+
      (poker.lvl||0)+" on "+(poker.xp||0)+" XP",(poker.lvl||0)===15&&(poker.xp||0)===15);
    check("v132.28 raid: level is CLAMPED at the cap ("+XP_MAX_LVL+") — a level-20 participant "+
      "paid 15 landed on "+(capped.lvl||0)+", not 35",(capped.lvl||0)===XP_MAX_LVL);
    check("v132.28 raid: …but XP is NOT clamped, so the forge stays reachable at the cap "+
      "(capped player holds "+(capped.xp||0)+" XP)",(capped.xp||0)===15);
    check("v132.28 participation: the list is CLEARED on payout, so a second tick cannot double-pay",`);

sub("wild camp level assertion",
`    check("v132.28 wild camp: a participant is paid 1 XP ("+(ender.xp||0)+")",(ender.xp||0)>=1);`,
`    check("v132.28 wild camp: a participant is paid 1 XP and 1 LEVEL (xp "+(ender.xp||0)+
      ", lvl "+(ender.lvl||0)+")",(ender.xp||0)>=1&&(ender.lvl||0)>=1);`);

sub("tidy the extra actor",
`    poker.alive=false; closer.alive=false; helper.alive=false; ender.alive=false; drone.alive=false;`,
`    poker.alive=false; closer.alive=false; helper.alive=false; ender.alive=false;
    drone.alive=false; capped.alive=false;`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — participation level + cap-clamp gate");
