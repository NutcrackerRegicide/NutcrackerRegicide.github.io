#!/usr/bin/env node
/* patch-towerbudget-v134.js — v134.9: the bazaar's towers stop eating the town's.
 *
 * FOUND WHILE MEASURING THE SCREEN, not while looking for it. Having dealt the Guard Towers onto
 * the lanes, I went to measure the improvement and found there was nothing to measure: across four
 * seeded 15-minute campaigns and eight armies, findSpot placed ZERO screen towers. Every Guard
 * Tower standing at the whistle had come from the v134.6 bazaar ring — seed 12345's pair sat at
 * z -89.31 and +33.94, which is the flanking square at -104.42 and the Grand at +36, not lane 0
 * and lane 48.
 *
 * THE CAUSE IS MINE, from v134.6. The war room gates its own towers on
 *
 *     need("tower", Math.min(P.towers, Math.floor(T/95)), 150+ag*40, 60)
 *
 * and `need` counts with countBld(team,"tower") — which counts EVERY Guard Tower on the board,
 * including the ones raised over the squares. So a personality's tower budget is spent by a
 * building it never asked for: rush and boom carry towers:2, and one bazaar tower plus one more
 * fills the cap, leaving the town with no screen at all. Two separate allowances — P.towers for
 * the marshal's own defence, BAZ_TOWERS for each square it holds, with its own BAZ_TOWER_STONE
 * floor — sharing one counter. v134.6 never said that was the intent, because I never noticed it.
 *
 * A tower over a bazaar is now TAGGED at birth and the town's budget counts only the untagged. It
 * is one flag and one predicate, and the flag is set where the building is made rather than
 * inferred later from geometry: a tower's distance to a square changes when the square changes
 * hands, and a budget that quietly re-classifies buildings as the map turns is worse than the bug.
 *
 * THE LANE DEAL COUNTS THE SAME WAY, for the same reason: the screen is dealt LANE_Z centre-out by
 * how many screen towers already stand, and a bazaar tower rotating that deal would push the first
 * real screen tower off the Kings Road and onto a flank for no reason anybody chose.
 *
 * ⚠ NOT A BALANCE CHANGE, and worth being clear about: this raises the number of Guard Towers a
 * holding marshal can build, because it stops one budget paying for two things. The stone floors
 * are untouched — BAZ_TOWER_STONE still keeps 150 in the ground for everything else, and the
 * town's own line still wants 150+ag*40 food and 60 gold spare. What changes is that holding a
 * square no longer disarms the town behind it.
 */
const fs=require("fs"),path=require("path");
const R=path.join(__dirname,"..");
const A=path.join(R,"js","07-ai.js");
let a=fs.readFileSync(A,"utf8");
let failed=[];
const sub=(name,from,to)=>{
  const n=a.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  a=a.split(from).join(to);
};

// ---------------------------------------------------------------------------
// 1. The predicate, beside countBld which it narrows.
// ---------------------------------------------------------------------------
sub("countScreenTowers",
`function pendingBld(team){return buildings.filter(b=>b.alive&&b.team===team&&!b.built);}`,
`// v134.9 THE TOWN'S OWN TOWERS, WHICH IS NOT THE SAME SET AS "every Guard Tower this team owns".
// A tower raised over a square (v134.6) carries bazTower and is paid for out of a different
// allowance with a different stone floor; counting it against P.towers spends the town's budget on
// the frontier's building. Includes sites still under construction, exactly as countBld does —
// a marshal that has one going up should not order a second.
function countScreenTowers(team){
  let n=0;
  for(const b of buildings)if(b.alive&&b.team===team&&b.type==="tower"&&!b.bazTower)n++;
  return n;
}
function pendingBld(team){return buildings.filter(b=>b.alive&&b.team===team&&!b.built);}`);

// ---------------------------------------------------------------------------
// 2. The tag, at birth.
// ---------------------------------------------------------------------------
sub("the bazaar tower is tagged",
`        pay(team,BLD.tower.cost);
        makeBuilding(team,"tower",s.x,s.z,false);
        if(team===BLUE)msg("A guard tower is raised over your bazaar.","blue");`,
`        pay(team,BLD.tower.cost);
        // v134.9 TAGGED AT BIRTH, not inferred from geometry later: a square changes hands and a
        // tower's distance to it does not, so a budget that re-derives "is this a bazaar tower?"
        // from position would reclassify buildings as the map turns. See countScreenTowers.
        makeBuilding(team,"tower",s.x,s.z,false).bazTower=true;
        if(team===BLUE)msg("A guard tower is raised over your bazaar.","blue");`);

// ---------------------------------------------------------------------------
// 3. The town's budget counts only its own.
// ---------------------------------------------------------------------------
sub("need takes a count override",
`    const need=(type,cap,rf,rg)=>(BLD[type].age||0)<=ag&&countBld(team,type)<cap&&
      !sites.some(x=>x.type===type)&&affordKeep(team,BLD[type].cost,rf,rg);`,
`    // v134.9 `+"`have`"+` overrides the count for the one type whose buildings come out of two
    // different purses. Everything else keeps countBld.
    const need=(type,cap,rf,rg,have)=>(BLD[type].age||0)<=ag&&
      ((have===undefined?countBld(team,type):have)<cap)&&
      !sites.some(x=>x.type===type)&&affordKeep(team,BLD[type].cost,rf,rg);`);

sub("the tower line counts screen towers",
`    else if(need("tower",Math.min(P.towers,Math.floor(T/95)),150+ag*40,60))want="tower";`,
`    // v134.9: …counting the town's OWN towers. This read countBld(team,"tower") through need, so
    // every Guard Tower raised over a square since v134.6 spent one of these. Measured: across four
    // seeded campaigns and eight armies, findSpot placed no screen tower at all.
    else if(need("tower",Math.min(P.towers,Math.floor(T/95)),150+ag*40,60,countScreenTowers(team)))want="tower";`);

// ---------------------------------------------------------------------------
// 4. …and so does the lane deal.
// ---------------------------------------------------------------------------
sub("the lane deal counts screen towers",
`      const _lane=LANE_Z[countBld(team,"tower")%LANE_Z.length];`,
`      const _lane=LANE_Z[countScreenTowers(team)%LANE_Z.length];`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(A,a);
console.log("patch-towerbudget-v134: OK");
