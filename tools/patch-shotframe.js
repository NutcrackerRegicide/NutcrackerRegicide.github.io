#!/usr/bin/env node
/* v132.18 — THE WALL'S HEIGHT WAS IN THE WRONG FRAME
   --------------------------------------------------
   node tools/patch-shotframe.js        (idempotent: re-running reports NOTHING WRITTEN)

   John, on v132.17: "standing on top of wall cannot see my projectile shoot from here, am i hitting
   invisible wall or something?"

   Yes. v132.17 gave the projectile test a ceiling and then compared it in the wrong space:

       if(pos.y > wallTopY(b)) return true;      // pos.y is WORLD; wallTopY returns MODEL-LOCAL

   wallTopY hands back 5.2 for an age-5 curtain — the parapet's height ABOVE THE WALL'S OWN BASE,
   which is what tools/shootover.js measured off a model. pos.y is the projectile's height above
   SEA LEVEL. The two only agree where a wall happens to stand at y = 0.

   AND THAT IS EXACTLY WHERE MY TEST BUILT ITS WALL. The gate put its curtain at (0, 40) on ground
   that sits near zero, so the arrow's world y and its height above the wall's base were the same
   number to within a decimal, all three checks passed, and the bug shipped. A gate that only tests
   the one case where two frames coincide is not testing the frame at all.

   In play the terrain runs about -2.5 to +2. On low ground the arrow's world y falls BELOW 5.2 and
   the shot dies against its own parapet, which is what John is looking at. On high ground the
   comparison passes too easily and arrows sail through merlons that should stop them. Both are the
   same missing term.

       return b.root.position.y + <the measured local height>

   THE GATE NOW BUILDS ON GROUND THAT IS NOT ZERO, and reports the wall's base height so the next
   person can see at a glance whether the case was even exercised.                                */
const fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
let total=0,failed=0;
const F={};
const load=f=>(F[f]=F[f]!==undefined?F[f]:fs.readFileSync(path.join(ROOT,"js",f),"utf8"));
function sub(file,from,to,why){
  const s=load(file), n=s.split(from).length-1;
  if(n!==1){console.log("  !! "+file+" expected 1, found "+n+"  <<"+from.slice(0,64).replace(/\n/g,"\\n")+">>");failed++;return;}
  F[file]=s.split(from).join(to); total++; console.log("  ok  "+why);
}
if(load("05-combat.js").indexOf("_wallTopLocal")>=0){console.log("already applied — NOTHING WRITTEN");process.exit(0);}

sub("05-combat.js",
`function wallTopY(b){
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
}`,
`// v132.18 …AND IT IS A HEIGHT ABOVE THE WALL'S OWN BASE, so the caller has to add the base. These
// numbers were measured off a MODEL; a projectile's y is measured from sea level. v132.17 compared
// the two directly and it only works where a wall stands at y = 0 — which is precisely where the
// gate built its test curtain, so all three checks passed and John got a shot that still died on
// his own parapet. Terrain in play runs about -2.5 to +2: on low ground the arrow's world y falls
// under 5.2 and is eaten by the wall it is standing on, and on high ground it sails through merlons
// that should stop it. Split in two so the frame is impossible to get wrong at a glance.
function _wallTopLocal(b){
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
function wallTopY(b){                            // WORLD height of the top of this wall
  if(!b||!b.def||!b.def.wall)return Infinity;
  return b.root.position.y+_wallTopLocal(b);
}`,
  "05-combat.js: wallTopY returns a WORLD height, not a model-local one");

if(failed){console.log("\n"+failed+" site(s) did not match — NOTHING WRITTEN.");process.exit(1);}
for(const f in F)fs.writeFileSync(path.join(ROOT,"js",f),F[f]);
console.log("\n"+total+" written.\n");
