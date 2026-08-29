#!/usr/bin/env node
/* patch-idle-settle-v134.js — the last hole: a body inside a building that is NOT WALKING.
 *
 * The v134.0 work resolves a body against the collider in two places: moveUnit, when it is trying
 * to move, and separate()'s settle pass, when a crowd has just shoved it. Both are about bodies in
 * motion. Nothing touches a body that is standing inside geometry and staying there, and there are
 * at least three ways to become one:
 *
 *   · SPAWNED INSIDE. spawnTeam scatters the opening fifty on a RADIUS — "a=rand*2PI, r=13+rand*12,
 *     clear of the 2x TC" — while the Town Center's collider is a BOX whose half-extents reach
 *     11.96 x 11.45 at Stone and 12.58 at the Enlightenment. A circle of radius 13 is not clear of
 *     that box at the corners: its half-diagonal is 16.56. Bodies start life inside the wall.
 *   · AGED INTO. fxA is indexed by the team's live age, so a building's box GROWS under whoever is
 *     standing beside it — a Classical to Medieval barracks goes from 6.70 to 10.00, a market from
 *     7.80 to 10.60, an archery range's fz from 6.24 to 11.80. Everyone in that annulus is
 *     instantaneously indoors.
 *   · IDLED THERE. A villager whose resource runs dry returns from updateBot without moving at all,
 *     and if it was inside something when that happened it stays inside for the rest of the match.
 *
 * The campaign gate caught exactly one of these (a villager in a Town Center) after the sidestep
 * fallback changed, which is the honest reason this exists: the previous run read 0 not because
 * nothing could get wedged but because the bodies that were wedged happened to be walking.
 *
 * The sweep is round-robin, a tenth of the army a frame, and skips anything moveUnit already owns
 * (moved within 0.3s), the player and guest bodies (a host-side shove on a player's body IS the
 * rubber band, per separate()'s own note), and garrisoned bodies (they are inside a tower because
 * they climbed it).
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

sub("the idle settle sweep",
`  if(!pre)return;
  for(const [v,p0] of pre){
    const p=v.root.position;
    const q=pushOutOfBuildings(v,p.x,p.z,0,0,0); // dt 0: eject, do not slide — nobody is walking
    if(walkable(q[0],q[1])){p.x=q[0];p.z=q[1];}
    else{p.x=p0.x;p.z=p0.z;} // the crowd shoved this body off the world: it keeps its ground
  }
}`,
`  if(pre)for(const [v,p0] of pre){
    const p=v.root.position;
    const q=pushOutOfBuildings(v,p.x,p.z,0,0,0); // dt 0: eject, do not slide — nobody is walking
    if(walkable(q[0],q[1])){p.x=q[0];p.z=q[1];}
    else{p.x=p0.x;p.z=p0.z;} // the crowd shoved this body off the world: it keeps its ground
  }
  settleIdle();
}
// v134.0 THE IDLE ARE SETTLED TOO. moveUnit resolves a body that is TRYING TO MOVE and the pass
// above resolves a body a crowd has just SHOVED. Nothing touched a body standing inside geometry
// and staying there — and bodies get there without walking: spawnTeam scatters the opening fifty on
// a radius of 13-25 while a Town Center's box half-diagonal is 16.56, a building's box GROWS under
// its neighbours as the town ages (a Classical->Medieval barracks: 6.70 -> 10.00), and a villager
// whose resource runs dry returns from updateBot without moving at all. Any of those and the body
// is indoors for the rest of the match.
//
// A tenth of the army a frame, round-robin: the full collider loop is O(buildings), and paying it
// for every idle body every frame would cost more than the problem. Nothing here is random, so the
// order is the same on every machine and in every replay.
let _settleAt=0;
const SETTLE_SLICE=10;      // frames to walk the whole roster in — 1/3 of a second at 30fps
const SETTLE_QUIET=0.3;     // moved this recently? moveUnit owns it, leave it alone
function settleIdle(){
  const N=units.length; if(!N)return;
  const slice=Math.max(1,Math.ceil(N/SETTLE_SLICE));
  for(let k=0;k<slice;k++){
    const v=units[(_settleAt+k)%N];
    if(!v||!v.alive||v.isPlayer||v.remote||v.garrison)continue; // a player's body is never ours to
    if(T-(v._mv||-1e4)<SETTLE_QUIET)continue;                   // shove; a garrison CLIMBED in
    const p=v.root.position;
    const q=pushOutOfBuildings(v,p.x,p.z,0,0,0);
    if(q[0]===p.x&&q[1]===p.z)continue;                         // already standing somewhere legal
    if(walkable(q[0],q[1])){p.x=q[0];p.z=q[1];}
  }
  _settleAt=(_settleAt+slice)%N;
}`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patch-idle-settle-v134: OK");
