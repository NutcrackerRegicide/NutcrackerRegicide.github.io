#!/usr/bin/env node
/* v132.17 — AN ARROW ABOVE A WALL IS ABOVE IT
   -------------------------------------------
   node tools/patch-shootover.js        (idempotent: re-running reports NOTHING WRITTEN)

   John: "for the enlightenment walls i can climb them but cant shoot over them, my projectile does
   not appear."

   THE TEST HAD NO HEIGHT IN IT. updateProjectiles stops a shot like this:

       if(b!==p.ignoreB && segDist2(_px,_pz, x,z, b.x,b.z) < (b.def.rBlock*0.8)^2) { ...done }

   A circle in plan, and nothing else. A wall's rBlock defaults to its r of 5.5, so ANYTHING within
   4.4 of a wall segment's centre stops a shot at ANY altitude. Two consequences:

     · Standing on a terreplein you are inside your own wall's circle. tools/shootover.js drives the
       real fireAimedShot and the real updateProjectiles: the arrow is born at y=5.70 and is gone one
       frame later having travelled 0.0. That is "my projectile does not appear", exactly.
     · And nobody could shoot over a wall from the ground either. The lofted probe died 11.5 out,
       climbing, at y=6.55 — over a parapet whose top is 5.20.

   ================================ THE HEIGHT, MEASURED ================================
   A blocking height has to be the height the wall IS, so shootover.js raycasts down over each form
   and takes the 90th PERCENTILE of the top surface, not the maximum. The maximum is a lie: the
   age-5 profile reads 4.0 across the terreplein, 5.2 across the parapet and a single 11.0 spike at
   z=0 — a banner on a pole, one object wide. Keying off that would have put the ceiling of every
   wall above the parapet a man is standing behind, and fixed nothing.

       wall   wood a2 6.85 · wood a3-a5 7.11 · stone a3 8.20 · a4 10.40 · a5 5.20
       gate   wood a2-a3 8.40 · wood a4-a5 10.41 · stone a3 10.10 · a4 11.60 · a5 9.40

   Only the age-5 curtain is LOW (5.20), which is the star fort's whole design — §F.6's "the trade is
   firepower for height, AND THE DROP IN HEIGHT IS THE UPGRADE". It is also the only one you can
   walk on. So the wall you can stand on is the wall you can shoot over, and both of those are the
   same fact about the same 5.20.

   ================================ AND THROUGH A GATE ================================
   The same circle killed anything fired through your own gateway, which v132.15 had just widened to
   7.8 for nothing. A gate gets the lateral exemption the COLLIDER already has — GATE_PASS, the one
   constant — so a shot lined up with the opening goes through it the way a body does.

   ================================ ALL THREE SITES ================================
   The circle appears three times: the free shot, the homing shot, and the guest's rewind. 05-combat
   already warns at the third that "the rewind must use the SAME circle as :126 or a guest's shot and
   the host's disagree" — so the exemption is ONE function called from all three rather than a
   condition written out three times, which is how they would drift.

   WHAT THIS DOES NOT DO is let everything through: a flat shot into a wall from the ground still
   dies on the stonework, and shootover.js asserts that as its third check. A fix that stops walls
   blocking arrows has not fixed walls, it has deleted them.                                       */
const fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
let total=0,failed=0;
const F={};
const load=f=>(F[f]=F[f]!==undefined?F[f]:fs.readFileSync(path.join(ROOT,"js",f),"utf8"));
function sub(file,from,to,why){
  const s=load(file), n=s.split(from).length-1;
  if(n!==1){console.log("  !! "+file+" expected 1, found "+n+"  <<"+from.slice(0,64).replace(/\n/g,"\\n")+">>");failed++;return;}
  F[file]=s.split(from).join(to); total++; console.log("  ok  "+why);
}
if(load("05-combat.js").indexOf("_shotClears")>=0){console.log("already applied — NOTHING WRITTEN");process.exit(0);}

sub("05-combat.js",
`function _gatePassHX(b){`,
`// v132.17 HOW HIGH A WALL ACTUALLY STANDS, so a shot flying over one is not stopped by a circle
// drawn in plan. MEASURED by tools/shootover.js as the 90th PERCENTILE of the top surface and not
// the maximum: the age-5 profile is 4.0 across the terreplein, 5.2 across the parapet and a single
// 11.0 spike at z=0 which is a banner on a pole. A ceiling taken from the max would sit above the
// parapet the man is standing behind and fix nothing.
// Only the age-5 curtain is low, which is §F.6's whole argument — "the trade is firepower for
// height, and the drop in height is the upgrade" — and it is also the only one you can walk on. The
// wall you can stand on is the wall you can shoot over; that is one fact, not two.
function wallTopY(b){
  if(!b||!b.def||!b.def.wall)return Infinity;
  const a=Math.max((b.def.age||0),
    Math.min(5,(typeof teamAge!=="undefined"&&teamAge[b.team])||0));
  const wood=b.type.indexOf("wood")===0;
  const fort=(b.type.indexOf("fort")===0)||a>=4;
  if(b.def.gate){
    if(wood)return a<=3?8.4:10.5;
    return fort?(a>=5?9.4:11.6):10.1;
  }
  if(wood)return a<=2?6.9:7.2;
  return fort?(a>=5?5.2:10.4):8.2;
}
// …and the one place that decides whether a shot is stopped by a wall at all. ONE function, called
// from all three sites that carry the circle — the free shot, the homing shot and the guest's
// rewind — because 05-combat already warns that the rewind "must use the SAME circle as :126 or a
// guest's shot and the host's disagree", and three copies of a condition is how that happens.
function _shotClears(b,pos){
  if(!b.def.wall)return false;
  if(pos.y>wallTopY(b))return true;                    // over the top of it
  if(b.def.gate){                                      // …or straight through the gateway
    const r=b.rot||0, c=Math.cos(r), s=Math.sin(r);
    if(Math.abs((pos.x-b.x)*c-(pos.z-b.z)*s)<GATE_PASS/2-0.4)return true;
  }
  return false;
}
function _gatePassHX(b){`,
  "05-combat.js: wallTopY + _shotClears, measured and in one place");

sub("05-combat.js",
`        if(b!==p.ignoreB&&segDist2(_px,_pz,p.m.position.x,p.m.position.z,b.x,b.z)<Math.pow(b.def.rBlock*0.8,2)){
          if(b.team!==p.att.team)damageBuilding(b,p.dmg,p.att);
          done=true;break;
        }`,
`        if(b!==p.ignoreB&&!_shotClears(b,p.m.position)&&
           segDist2(_px,_pz,p.m.position.x,p.m.position.z,b.x,b.z)<Math.pow(b.def.rBlock*0.8,2)){
          if(b.team!==p.att.team)damageBuilding(b,p.dmg,p.att);
          done=true;break;
        }`,
  "05-combat.js: the free shot clears walls it is above");

sub("05-combat.js",
`        if(b!==p.ignoreB&&dist2(p.m.position.x,p.m.position.z,b.x,b.z)<Math.pow(b.def.rBlock*0.8,2)){blk=b;break;} // v131.6 rBlock — see :126`,
`        if(b!==p.ignoreB&&!_shotClears(b,p.m.position)&&
           dist2(p.m.position.x,p.m.position.z,b.x,b.z)<Math.pow(b.def.rBlock*0.8,2)){blk=b;break;} // v131.6 rBlock — see :126`,
  "05-combat.js: the homing shot too");

sub("05-combat.js",
`      if(b!==p.ignoreB&&segDist2(x0,z0,p.m.position.x,p.m.position.z,b.x,b.z)<Math.pow(b.def.rBlock*0.8,2)){ // v131.6 rBlock — the rewind must use the SAME circle as :126 or a guest's shot and the host's disagree`,
`      if(b!==p.ignoreB&&!_shotClears(b,p.m.position)&&
         segDist2(x0,z0,p.m.position.x,p.m.position.z,b.x,b.z)<Math.pow(b.def.rBlock*0.8,2)){ // v131.6 rBlock — the rewind must use the SAME circle as :126 or a guest's shot and the host's disagree`,
  "05-combat.js: …and the guest's rewind, which must agree with the host");

if(failed){console.log("\n"+failed+" site(s) did not match — NOTHING WRITTEN.");process.exit(1);}
for(const f in F)fs.writeFileSync(path.join(ROOT,"js",f),F[f]);
console.log("\n"+total+" written.\n");
