#!/usr/bin/env node
/* patch-baztowers-v134.js — v134.6, part two: the squares get teeth.
 *
 * John, after the first playtest of v134.5: "There wasn't really much of a fight at any bazaars
 * that I saw. Each team should defend their respective bazaars with guard towers as well, say
 * place 3-4 guard towers around each bazaar."
 *
 * ⚠ THE ARITHMETIC FIRST, BECAUSE 3-4 EACH CANNOT BE PAID FOR. A Guard Tower is 250 STONE and 100
 * wood (BLD.tower, dmg 9 / range 18 / age 3). The whole map holds 4,200 stone in six piles —
 * 500+500, 700+700, 900, 900 — and that is the supply for BOTH armies and the player, against a
 * castle at 500 and a stone wall segment at 100. So:
 *
 *     3 towers x 3 squares = 2,250 stone   = 54% of all the stone on the map, for ONE team
 *     4 towers x 3 squares = 3,000 stone   = 71%, and both teams want it
 *
 * "Stone needs to remain scarce" is John's own rule about this map and the suite asserts the six
 * piles. So the dial ships at ONE tower per held square — 750 stone for a swept map, which a team
 * can actually pay — with the number named and the cost written down here, so it is one edit to
 * take it to two once we know what a game with any towers at all plays like. Reporting the price
 * rather than quietly picking his number and starving the rest of the build order.
 *
 * WHAT IT DOES: for each square this team HOLDS, once the age allows a Guard Tower and the team can
 * pay while keeping a stone reserve, it stands one up in a ring around the square — outside the
 * plaza, inside the tower's own 18 of range, and on the side facing this throne so the builders do
 * not walk across the map. One site at a time.
 *
 * ⚠ AND THE PLAZA IS EXCLUDED BY HAND, because validFor does not know about it: the bazaars are in
 * neutralMarkets, not in `buildings`, so nothing in the placement rules stops a tower being dropped
 * ON the square it is meant to guard — which would sit on the capture ground. The ring is
 * plaza+3.5 out at the tightest. (That the PLAYER can still do this is a separate question and
 * John's to answer; this patch does not change what a person may build.)
 */
const fs=require("fs"),path=require("path");
const R=path.join(__dirname,"..");
const F=path.join(R,"js","07-ai.js");
let s=fs.readFileSync(F,"utf8");
let sw=fs.readFileSync(path.join(R,"sw.js"),"utf8");
let ix=fs.readFileSync(path.join(R,"index.html"),"utf8");
let failed=[];
function sub(name,from,to){
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
}

sub("the tower dials",
`function bandHoldPoint(team,idx){ // the square that pays most, held or not, then the road`,
`// ---- v134.6 THE SQUARES GET TEETH ----
// BAZ_TOWERS: Guard Towers a team will raise around each square it HOLDS. John asked for 3-4; the
//   map holds 4,200 stone in six piles and a Guard Tower is 250 of it, so 3 each on a swept map is
//   2,250 — 54% of every pile on the board, for one of the two armies. One each is 750, which a
//   team can pay for out of a corner of its mining without giving up its castle. The number is
//   here, alone on a line, when we know what one plays like.
// BAZ_TOWER_GAP / BAZ_TOWER_OUT: where the ring sits, measured from the plaza's edge rather than
//   the square's centre — the Grand's plaza is 11.4 and the pair on the Viking roads are 8.6, so a
//   fixed radius would be inside one and out of range of the others. A Guard Tower reaches 18.
// BAZ_TOWER_STONE: …and it keeps this much stone in the ground for everything else.
const BAZ_TOWERS=1, BAZ_TOWER_GAP=3.5, BAZ_TOWER_OUT=7, BAZ_TOWER_STONE=150;
function bazTowerSpot(team,m){
  // a legal plot in the ring, preferring the side this throne is on: the villagers who build it
  // walk from home, and a tower on the far face is a two-minute march through the enemy's half.
  const tc=TCPOS[team], plaza=(m.plaza||8.6);
  // ⚠ AND THE OUTER EDGE IS THE TOWER'S OWN REACH, not a fixed distance from the plaza. The Grand's
  // plaza is 11.4 against 8.6 for the pair on the Viking roads, so plaza+3.5+7 puts a tower 21.9
  // out — past the 18 it can shoot, guarding the square by standing near it and watching. Caught by
  // the gate the moment it was written: "nearest 12.1, furthest 21.7 ... and a range of 18".
  const inner=plaza+BAZ_TOWER_GAP;
  const outer=Math.max(inner+1,Math.min(inner+BAZ_TOWER_OUT,(BLD.tower.atk.rng||18)-1.5));
  let best=null,bd=1e12;
  for(let i=0;i<36;i++){
    const a=Math.random()*Math.PI*2, r=inner+Math.random()*(outer-inner);
    const x=m.x+Math.cos(a)*r, z=m.z+Math.sin(a)*r;
    if(Math.abs(x)>MAP.x-6||Math.abs(z)>MAP.z-6)continue;
    if(!validFor("tower",x,z,team))continue;
    const d=dist2(x,z,tc[0],tc[1]);
    if(d<bd){bd=d;best={x,z};}
  }
  return best;
}
function bandHoldPoint(team,idx){ // the square that pays most, held or not, then the road`);

sub("the towers rise on what the team holds",
`  // --- crew the construction sites (2 builders each) ---`,
`  // --- v134.6 a Guard Tower rises on each square this team holds ---
  // The band standing on a square goes home when the tour is up; a tower does not. 400 hp, 9 damage
  // at 18 — it will not hold a square against an army, and it is not meant to: it makes taking one
  // cost something, which measured at nothing before this. Age 3 (BLD.tower.age), one site at a
  // time, and a stone floor so the castle and the walls are not eaten by the frontier.
  if(typeof neutralMarkets!=="undefined"&&(BLD.tower.age||0)<=ag&&pendingBld(team).length<2&&
     !pendingBld(team).some(b=>b.type==="tower")&&
     affordKeep(team,BLD.tower.cost,0,0)&&stock[team].stone>=BLD.tower.cost.stone+BAZ_TOWER_STONE){
    for(const m of neutralMarkets){
      if(m.owner!==team)continue;
      let have=0;
      for(const b of buildings)
        if(b.alive&&b.team===team&&b.type==="tower"&&
           dist2(b.x,b.z,m.x,m.z)<Math.pow((m.plaza||8.6)+BAZ_TOWER_GAP+BAZ_TOWER_OUT+2,2))have++;
      if(have>=BAZ_TOWERS)continue;
      const s=bazTowerSpot(team,m);
      if(s){
        pay(team,BLD.tower.cost);
        makeBuilding(team,"tower",s.x,s.z,false);
        if(team===BLUE)msg("A guard tower is raised over your bazaar.","blue");
      }
      break; // one square a think: the builders have to walk out there
    }
  }
  // --- crew the construction sites (2 builders each) ---`);

// ---------------------------------------------------------------------------
// The version pair. INVARIANT #4 — a smoketest gate enforces it.
// ---------------------------------------------------------------------------
{
  const a1=`const VERSION="v134.5";`, b1=`const VERSION="v134.6";`;
  const a2=`<p class="verstamp">v134.5 — WHAT THE SQUARES PAY</p>`,
        b2=`<p class="verstamp">v134.6 — TOWERS ON THE SQUARES</p>`;
  if(sw.split(a1).length-1!==1)failed.push("sw.js VERSION (need exactly 1)");
  else sw=sw.split(a1).join(b1);
  if(ix.split(a2).length-1!==1)failed.push("index.html verstamp (need exactly 1)");
  else ix=ix.split(a2).join(b2);
}

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(F,s);
fs.writeFileSync(path.join(R,"sw.js"),sw);
fs.writeFileSync(path.join(R,"index.html"),ix);
console.log("patch-baztowers-v134: OK");
