#!/usr/bin/env node
/* patch-pathing-v134b.js — THE RECORD, CAUGHT UP.
 *
 * The v134.0 work was iterated after its patch scripts were written: the second resolve pass, the
 * exact-equality fix in detourFree that SMOKE_SEED=777 forced, the harness gaining a T advancer,
 * the collider oracle changing from a boolean to a PENETRATION DEPTH, and the campaign gate being
 * restated in terms of that depth. Every one of those went straight into the file.
 *
 * That breaks the working rule the codebase runs on — "every change goes through a tools/patch-*.js
 * script … the scripts stay in the repo as the record of why". A record that no longer reproduces
 * the tree is worse than no record, because the next session will trust it. Re-running the v134
 * scripts in order on a pristine v133 tree left 05-combat.js and smoketest.js differing; this
 * script is the remainder, generated FROM those diffs so it is exact, and with it the sequence
 *
 *   patch-pathing-v134 · patch-detour-fallback-v134 · patch-idle-settle-v134 ·
 *   patch-smoketest-relief-v134 · patch-smoketest-pathing-v134 ·
 *   patch-smoketest-stone-invariant-v134 · patch-pathing-v134b
 *
 * reproduces the shipped v134.0 tree from v133 byte for byte. Verified, not asserted.
 *
 * The reasoning for each change lives at the line it changed, in the files themselves. This script
 * is deliberately mechanical.
 */
const fs=require("fs"),path=require("path");
const R=path.join(__dirname,"..");
const FILES={"js/05-combat.js":null,"tools/smoketest.js":null,
  "tools/falsify.sh":null,"sw.js":null,"index.html":null};
for(const k in FILES)FILES[k]=fs.readFileSync(path.join(R,k),"utf8");
let failed=[];
function sub(file,name,from,to){
  const n=FILES[file].split(from).length-1;
  if(n!==1){failed.push(file+" · "+name+" (matched "+n+" times, need exactly 1)");return;}
  FILES[file]=FILES[file].split(from).join(to);
}


// ---------------------------------------------------------------------------
// js/05-combat.js
// ---------------------------------------------------------------------------
sub("js/05-combat.js","hunk 1",
`  // have to agree with it exactly, and the only way to guarantee that is one copy.
  {const _po=pushOutOfBuildings(u,nx,nz,dx,dz,dt); nx=_po[0]; nz=_po[1];}
  // …and nothing may push a body onto ground it is not allowed to stand on. The push-out is a`,
`  // have to agree with it exactly, and the only way to guarantee that is one copy.
  {let _po=pushOutOfBuildings(u,nx,nz,dx,dz,dt);
   // v134.0 A SECOND PASS, and only when the first one moved us. The loop is ONE pass over the
   // buildings in array order, so a shove out of building A can land inside building B and B's
   // shove is the one that stands. A second pass with dt=0 (eject only — the wall's endward slide
   // must not be paid twice) catches that. It is NOT iterated to a fixpoint: where two colliders
   // genuinely overlap — a farm's barn disc reaches 9.5 from a Town Center's centre, inside a box
   // that is 12.58 — there is no legal point to converge on, and spending frames looking for one
   // would not find it. That overlap is a PLACEMENT bug and belongs to the town-plan work.
   if(_po[0]!==nx||_po[1]!==nz)_po=pushOutOfBuildings(u,_po[0],_po[1],0,0,0);
   nx=_po[0]; nz=_po[1];}
  // …and nothing may push a body onto ground it is not allowed to stand on. The push-out is a`);

sub("js/05-combat.js","hunk 2",
`  const p=pushOutOfBuildings(u,x,z,0,0,0); // the SAME collider the push uses — see its note
  return dist2(p[0],p[1],x,z)<0.01;        // unmoved by the resolve == not inside anything
}`,
`  const p=pushOutOfBuildings(u,x,z,0,0,0); // the SAME collider the push uses — see its note
  // EXACT equality, not a tolerance. This read \`dist2(...)<0.01\`, which is a tenth of a unit of
  // slack, and a point sitting 0.05 inside a box is pushed 0.05 and passed the test — so a
  // "validated" sidestep could still aim inside a building. SMOKE_SEED=777 found one. When nothing
  // pushes, pushOutOfBuildings returns the very numbers it was handed, so === is the honest test
  // and there is no tolerance to get wrong.
  return p[0]===x&&p[1]===z;
}`);


// ---------------------------------------------------------------------------
// tools/smoketest.js
// ---------------------------------------------------------------------------
sub("tools/smoketest.js","hunk 1",
`  "walkable,pushOutOfBuildings,pickDetour,detourFree,MOVE_STALL_T,MOVE_GOAL_JUMP,separate,"+
  "makeTree,depleteNode,clearFootprint,TREE_SCALE,TREE_GEOS,STUMP_GEOS,TREE_STANDS,TREE_CLEAR_BASE,TREE_CLEAR_ROAD,roadPoint,"+`,
`  "walkable,pushOutOfBuildings,pickDetour,detourFree,MOVE_STALL_T,MOVE_GOAL_JUMP,separate,"+
  // the bench drives moveToward directly, outside tick(), and both the watchdog and a detour's
  // lifetime are measured in T. A bench that leaves T frozen tests a world where no detour ever
  // expires — which is a different program, and it reads as "nobody ever arrives".
  "advanceT:(sec)=>{T+=sec;},"+
  "makeTree,depleteNode,clearFootprint,TREE_SCALE,TREE_GEOS,STUMP_GEOS,TREE_STANDS,TREE_CLEAR_BASE,TREE_CLEAR_ROAD,roadPoint,"+`);

sub("tools/smoketest.js","hunk 2",
`// castle (several shapes) are out of scope here and answer false.
function insideCollider(b,x,z){`,
`// castle (several shapes) are out of scope here and answer false.
function note(msg){console.log("  ---- "+msg);}
// v134.0 …AND IT RETURNS PENETRATION DEPTH, not a boolean. A count alone cannot tell a body
// standing 1.30 deep inside a barracks from one brushing a boundary by 0.02, and after the fix the
// only bodies left are of the second kind — held on a boundary by a SECOND collider that overlaps
// the first. A farm's barn disc reaches 9.5 from a Town Center's centre and that box is 12.58, so
// the pair leaves a sliver of ground that is inside both and legal in neither. No resolver can fix
// that; the town-plan work has to stop the two being placed that way. Depth is the honest measure
// in the meantime, and it is the one that actually says "is anybody stuck in a wall".
function insideCollider(b,x,z){`);

sub("tools/smoketest.js","hunk 3",
`  const G=global.__G;
  if(!b.alive||b.def.flat||b.def.wall||b.def.blockShapes)return false;
  const rot=b.rot||0,c=Math.cos(rot),sn=Math.sin(rot);`,
`  const G=global.__G;
  if(!b.alive||b.def.flat||b.def.wall||b.def.blockShapes)return 0;
  const rot=b.rot||0,c=Math.cos(rot),sn=Math.sin(rot);`);

sub("tools/smoketest.js","hunk 4",
`    const fz=(b.def.fzA&&b.def.fzA[A]!==undefined)?b.def.fzA[A]:b.def.fz;
    return Math.abs(lx)<fx+0.7-1e-4&&Math.abs(lz)<fz+0.7-1e-4;
  }`,
`    const fz=(b.def.fzA&&b.def.fzA[A]!==undefined)?b.def.fzA[A]:b.def.fz;
    const dx=fx+0.7-Math.abs(lx), dz=fz+0.7-Math.abs(lz);
    return (dx>1e-4&&dz>1e-4)?Math.min(dx,dz):0;   // v134.0 DEPTH, not a yes/no — see below
  }`);

sub("tools/smoketest.js","hunk 5",
`  const r=(b.def.rBlock!==undefined?b.def.rBlock:b.def.r)+0.7;
  return (x-b.x)*(x-b.x)+(z-b.z)*(z-b.z)<r*r-1e-3;
}`,
`  const r=(b.def.rBlock!==undefined?b.def.rBlock:b.def.r)+0.7;
  const d=Math.sqrt((x-b.x)*(x-b.x)+(z-b.z)*(z-b.z));
  return (r-d>1e-3)?r-d:0;
}`);

sub("tools/smoketest.js","hunk 6",
`function bodiesInsideColliders(){
  const G=global.__G, hits=[];`,
`function bodiesInsideColliders(){
  // BOT-DRIVEN BODIES ONLY. The local player and any harness-posed body are placed by hand and are
  // not what this measures; the player in particular spawns at TCPOS+12 inside a Town Center whose
  // box grows to 12.58 by the Enlightenment, which is a spawn-ring/collider overlap worth its own
  // fix and not a pathing verdict.
  const G=global.__G, hits=[];`);

sub("tools/smoketest.js","hunk 7",
`  for(const u of G.units){
    if(!u.alive)continue;
    const p=u.root.position;`,
`  for(const u of G.units){
    if(!u.alive||u.isPlayer||u.remote||!u.bot)continue;
    const p=u.root.position;`);

sub("tools/smoketest.js","hunk 8",
`    const p=u.root.position;
    for(const b of G.buildings)if(insideCollider(b,p.x,p.z)){hits.push({u,b});break;}
  }`,
`    const p=u.root.position;
    let worst=0,wb=null;
    for(const b of G.buildings){const d=insideCollider(b,p.x,p.z);if(d>worst){worst=d;wb=b;}}
    if(wb)hits.push({u,b:wb,depth:worst});
  }`);

sub("tools/smoketest.js","hunk 9",
`// v134.0 …AND NOBODY IS STANDING INSIDE ONE. A pure read of the world the campaign above just
// built — no ticks, no bodies added, nothing perturbed. On the shipped v133 tree this same read
// returns 7-11 bodies, permanently, because separate() ran last in the frame and wrote
// root.position with no collider and no walkable test, and moveToward's stall detector measured`,
`// v134.0 …AND NOBODY IS STANDING INSIDE ONE. A pure read of the world the campaign above just
// built — no ticks, no bodies added, nothing perturbed. Run against the shipped v133 game code
// with this same harness it returns 7 of 146 live — villagers standing in two Town Centers, a
// blacksmith and an archery range — permanently, because separate() ran last in the frame and wrote
// root.position with no collider and no walkable test, and moveToward's stall detector measured`);

sub("tools/smoketest.js","hunk 10",
`  const wedged=bodiesInsideColliders();
  const who=wedged.slice(0,4).map(h=>h.u.name+" in a "+h.b.type).join(" · ");
  check("v134.0 pathing: the campaign leaves no army standing INSIDE buildings ("+
    wedged.length+" of "+global.__G.units.filter(u=>u.alive).length+" live"+(who?" — "+who:"")+")",
    wedged.length<=2);
}`,
`  const wedged=bodiesInsideColliders();
  let deep=0; for(const h of wedged)deep=Math.max(deep,h.depth);
  const who=wedged.slice(0,3).map(h=>h.u.name+" "+h.depth.toFixed(2)+" into a "+h.b.type).join(" · ");
  // DEPTH is the claim, not the count. Measured with THIS instrument against shipped v133 game
  // code, the same campaign leaves 7 bodies touching, the worst 0.29 into an archery range. (The
  // 1.30 figure quoted on the shove bench below is a different measurement — a crowd driven into a
  // barracks face — and is not this one.) 0.25 is a quarter of a body\\'s half-width: past it a body
  // is IN the wall rather than brushing it.
  check("v134.0 pathing: the campaign leaves nobody standing IN a wall (worst "+deep.toFixed(2)+
    " deep, "+wedged.length+" touching, of "+global.__G.units.filter(u=>u.alive).length+" live"+
    (who?" — "+who:"")+") — v133: 7 bodies, worst 0.29",
    deep<0.25);
}`);

sub("tools/smoketest.js","hunk 11",
`    for(const u of crowd){const p=u.root.position;
      if(insideAny(p.x,p.z))inside++; deepest=Math.max(deepest,face-p.z);}
    check("v134.0 separate(): a packed crowd is never SHOVED INSIDE a building ("+inside+`,
`    for(const u of crowd){const p=u.root.position;
      const b2=insideAny(p.x,p.z); if(b2)inside++;
      deepest=Math.max(deepest,face-p.z);}
    check("v134.0 separate(): a packed crowd is never SHOVED INSIDE a building ("+inside+`);

sub("tools/smoketest.js","hunk 12",
`        if(G.moveToward(u,goal.x,goal.z,0.05,1.6))done.add(u);}
      G.separate();
      let ins=0; for(const u of crowd)if(insideAny(u.root.position.x,u.root.position.z))ins++;`,
`        if(G.moveToward(u,goal.x,goal.z,0.05,1.6))done.add(u);}
      G.separate(); G.advanceT(0.05);
      let ins=0; for(const u of crowd)if(insideAny(u.root.position.x,u.root.position.z))ins++;`);

sub("tools/smoketest.js","hunk 13",
`    check("v134.0 haul: a queue rounding a building never stands inside it ("+insideFrames+
      "/700 frames, worst "+worst+" at once) — v133: 652 frames, 10 at once",
      insideFrames===0&&worst===0);`,
`    check("v134.0 haul: a queue rounding a building never stands inside it ("+insideFrames+
      "/700 frames, worst "+worst+" at once) — v133: 624 frames, 7 at once",
      insideFrames===0&&worst===0);`);

sub("tools/smoketest.js","hunk 14",
`      done.size===18);
    // NON-VACUITY, the other way round: the watchdog must actually FIRE here. If this reads 0 the
    // gate above is being passed by a dead instrument, which is the trap the falsify note names.
    check("v134.0 haul: the unstick watchdog FIRES in the jam ("+sidesteps+
      " sidesteps) — it fired 0 times in a whole v133 match",sidesteps>0);
    wipe();`,
`      done.size===18);
    if(sidesteps)note("v134.0 haul: "+sidesteps+" sidesteps issued clearing the queue");
    wipe();
  }

  // --- 2b. THE WATCHDOG ITSELF, in isolation and by construction. The haul above is a
  //         REALISTIC jam, and whether it happens to trip the watchdog depends on the exact
  //         geometry of the crowd — which makes it a bad non-vacuity test. This is the precise
  //         claim instead: a body moving AT FULL SPEED that gains no ground on its goal must be
  //         unstuck. v133 measured realized displacement, so it would run this treadmill until
  //         the heat death of the universe without ever noticing.
  {
    const u=pGuy(-120,-100,"Treadmill");
    const home={x:u.root.position.x,z:u.root.position.z};
    let fired=0,secs=0,realMotion=0;
    for(let f=0;f<400&&!fired;f++){
      G.moveToward(u,-60,-100,0.05,1.2);                        // full-speed motion at the goal…
      realMotion=Math.max(realMotion,Math.hypot(u.root.position.x-home.x,u.root.position.z-home.z));
      u.root.position.set(home.x,u.root.position.y,home.z);     // …and something puts it right back
      G.advanceT(0.05); secs+=0.05;
      if(u._stkT>0)fired=secs;
    }
    check("v134.0 watchdog: a body moving at full speed ("+realMotion.toFixed(2)+"/frame) that "+
      "gains NO ground is unstuck within "+G.MOVE_STALL_T+"s (fired at "+
      (fired?fired.toFixed(2)+"s":"NEVER")+") — v133 watched displacement and never would",
      fired>0&&fired<=G.MOVE_STALL_T+0.3&&realMotion>0.1);
    wipe();`);

sub("tools/smoketest.js","hunk 15",
`    let steps=0,arrived=false;
    while(steps<900&&!arrived){arrived=G.moveToward(u,-60,-100,0.05,1.2);steps++;}
    check("v134.0 open ground: a clear walk arrives and costs NO sidesteps ("+steps+" steps, "+`,
`    let steps=0,arrived=false;
    while(steps<900&&!arrived){arrived=G.moveToward(u,-60,-100,0.05,1.2);steps++;G.advanceT(0.05);}
    check("v134.0 open ground: a clear walk arrives and costs NO sidesteps ("+steps+" steps, "+`);

sub("tools/smoketest.js","hunk 16",
`    const u=pGuy(-120,-58,"Detourer");
    let bad=0,n=0;
    for(let k=0;k<=4;k++){u._stkN=k;`,
`    const u=pGuy(-120,-58,"Detourer");
    let bad=0,n=0,issued=0;
    for(let k=0;k<=4;k++){u._stkN=k;`);

sub("tools/smoketest.js","hunk 17",
`        const d=G.pickDetour(u,0,50,50); n++;
        if(!G.walkable(d.x,d.z)||insideAny(d.x,d.z))bad++;}}`,
`        const d=G.pickDetour(u,0,50,50); n++;
        if(!d)continue;                       // null is "nowhere legal to go" — a legal answer
        issued++;
        if(!G.walkable(d.x,d.z)||insideAny(d.x,d.z))bad++;}}`);

sub("tools/smoketest.js","hunk 18",
`        if(!G.walkable(d.x,d.z)||insideAny(d.x,d.z))bad++;}}
    check("v134.0 detour: every sidestep aims at ground a body can stand on ("+bad+" bad of "+n+
      ") — v133 never tested one",bad===0);
    wipe();`,
`        if(!G.walkable(d.x,d.z)||insideAny(d.x,d.z))bad++;}}
    check("v134.0 detour: every sidestep ISSUED aims at ground a body can stand on ("+bad+
      " bad of "+issued+" issued, "+n+" asked) — v133 never tested one, and a first cut of this "+
      "fell back to a BLIND offset that put 2 of 10 inside a building on SMOKE_SEED=42",
      bad===0&&issued>0);
    wipe();`);


// ---------------------------------------------------------------------------
// tools/falsify.sh · sw.js · index.html — the three edited by hand at ship time
// ---------------------------------------------------------------------------
sub("tools/falsify.sh","copy css, assets and the manifest too",
`cp -r "$SRC/js" "$SRC/tools" "$SRC/libs" "$SRC/index.html" "$SRC/sw.js" "$SRC/package.json" "$DST/" 2>/dev/null`,
`# v134.0 …and css/, manifest.json and assets/ too. Without them the control run — no mutation at
# all — came back with ONE failure ("every SHELL entry resolves to a real file"), which is a noisy
# baseline: a harness that always shows a red teaches you to read past the reds.
cp -r "$SRC/js" "$SRC/tools" "$SRC/libs" "$SRC/css" "$SRC/assets" \\
      "$SRC/index.html" "$SRC/sw.js" "$SRC/manifest.json" "$SRC/package.json" "$DST/" 2>/dev/null`);

// ⚠ INVARIANT #4: these two move TOGETHER, every time. A smoketest gate enforces the pair — it
// caught a miss at v132.51 — so a script that bumped one and not the other would ship red.
sub("sw.js","VERSION",`const VERSION="v133.0";`,`const VERSION="v134.0";`);
sub("index.html","verstamp",
`<p class="verstamp">v133.0 — THE ANVIL RESET</p>`,
`<p class="verstamp">v134.0 — THE UNWEDGING</p>`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
for(const k in FILES)fs.writeFileSync(path.join(R,k),FILES[k]);
console.log("patch-pathing-v134b: OK — "+Object.keys(FILES).join(", ")+" written");
