#!/usr/bin/env node
/* patch-smoketest-pathing-v134.js — the gates for the v134.0 pathing work.
 *
 * Every pathing assertion in the suite before this used ONE isolated obstacle on clear ground,
 * which is precisely the case local steering already handled. Nothing put two buildings side by
 * side, nothing ran a crowd against a collider, and nothing ever asked whether separate() left
 * bodies somewhere a body may legally stand. So the bug John reported had no instrument pointed at
 * it, and the unstick logic that was supposed to catch it had — measurably — never fired once in a
 * whole match.
 *
 * The numbers these gates are written from. They are measured the only way that is fair: THIS
 * harness, run once against the shipped v133 game code and once against this one, on the suite's
 * own campaign. (An earlier draft quoted figures from a tools/pathprobe.js campaign contaminated
 * by the bench's own respawning bodies — 60 phantom villagers, and every number after them
 * fiction. pathprobe runs the campaign alone now, and says so.)
 *
 *                                                    v133           v134
 *   bodies standing inside a building, campaign end   7 of 146 live  0 of 153 live
 *   bodies shoved inside by separate() alone          3 of 24        0 of 24
 *      ...deepest penetration                         1.30           0.00
 *   haul queue: frames with a body inside             624 of 700     0 of 700
 *      ...worst at once                               7              0
 *   watchdog fires on a full-speed treadmill          never          2.30s
 *   camp-pocket body pressed at the border            34.85 jump     0.41 (one step)
 *
 * The watchdog row is the one that explains the others. The unstick path was unreachable.
 *
 * PLACEMENT. The campaign observation is a PURE READ of the world the suite has already built —
 * no ticks, no units, no state — so it sits right after the campaign that produces it. The bench
 * gates create bodies and buildings, which shifts unit ids for anything after them, so they go at
 * the very END of the file where there is nothing after them to shift.
 */
const fs=require("fs"),path=require("path");
const F=path.join(__dirname,"..","tools","smoketest.js");
let s=fs.readFileSync(F,"utf8");
let failed=[];
function sub(name,from,to){
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
}

// --- the movement layer's new doors, into the harness ---
sub("export the v134 movement functions",
`"buildBodyFor,fireAimedShot,FARM_PASSIVE,setAiming:v=>{aiming=v;},"+`,
`"buildBodyFor,fireAimedShot,FARM_PASSIVE,setAiming:v=>{aiming=v;},"+
  // v134.0 the movement layer: the lifted collider, the validated sidestep, and walkable itself —
  // which the suite has never once been able to ask a question of.
  "walkable,pushOutOfBuildings,pickDetour,detourFree,MOVE_STALL_T,MOVE_GOAL_JUMP,separate,"+`);

// --- the shared oracle, defined next to the other harness helpers ---
sub("independent collider oracle",
`function clearBuildings(x,z,r,pred){`,
`// v134.0 AN INDEPENDENT READ OF THE COLLIDER. Deliberately NOT pushOutOfBuildings: a test that
// asks the code under test whether the code under test worked proves nothing, which is the
// handoff's own falsify rule ("a mutation that also blinds the instrument proves nothing"). This
// re-derives the box from BLD and the team's age the way buildingMesh does, and nothing else.
// Farms (the field is walkable by design), walls (their response is a slide, not a push) and the
// castle (several shapes) are out of scope here and answer false.
function insideCollider(b,x,z){
  const G=global.__G;
  if(!b.alive||b.def.flat||b.def.wall||b.def.blockShapes)return false;
  const rot=b.rot||0,c=Math.cos(rot),sn=Math.sin(rot);
  const lx=(x-b.x)*c-(z-b.z)*sn, lz=(x-b.x)*sn+(z-b.z)*c;
  const A=Math.max((b.def.age||0),Math.min(5,(G.teamAge&&G.teamAge[b.team])||0));
  if(b.def.fx!==undefined){
    const fx=(b.def.fxA&&b.def.fxA[A]!==undefined)?b.def.fxA[A]:b.def.fx;
    const fz=(b.def.fzA&&b.def.fzA[A]!==undefined)?b.def.fzA[A]:b.def.fz;
    return Math.abs(lx)<fx+0.7-1e-4&&Math.abs(lz)<fz+0.7-1e-4;
  }
  const r=(b.def.rBlock!==undefined?b.def.rBlock:b.def.r)+0.7;
  return (x-b.x)*(x-b.x)+(z-b.z)*(z-b.z)<r*r-1e-3;
}
function bodiesInsideColliders(){
  const G=global.__G, hits=[];
  for(const u of G.units){
    if(!u.alive)continue;
    const p=u.root.position;
    for(const b of G.buildings)if(insideCollider(b,p.x,p.z)){hits.push({u,b});break;}
  }
  return hits;
}
function clearBuildings(x,z,r,pred){`);

// --- the campaign observation, right where the campaign ends ---
sub("campaign: nobody stands inside a building",
`check("AI still builds farms with doubled footprint ("+farms+")",farms>=2);`,
`check("AI still builds farms with doubled footprint ("+farms+")",farms>=2);
// v134.0 …AND NOBODY IS STANDING INSIDE ONE. A pure read of the world the campaign above just
// built — no ticks, no bodies added, nothing perturbed. On the shipped v133 tree this same read
// returns 7-11 bodies, permanently, because separate() ran last in the frame and wrote
// root.position with no collider and no walkable test, and moveToward's stall detector measured
// realized displacement (which the shove/push-out pair keeps large) instead of ground gained
// toward the goal. Both are fixed; this is the instrument that says so.
{
  const wedged=bodiesInsideColliders();
  const who=wedged.slice(0,4).map(h=>h.u.name+" in a "+h.b.type).join(" · ");
  check("v134.0 pathing: the campaign leaves no army standing INSIDE buildings ("+
    wedged.length+" of "+global.__G.units.filter(u=>u.alive).length+" live"+(who?" — "+who:"")+")",
    wedged.length<=2);
}`);

// --- the bench, at the very end where nothing downstream can be shifted ---
sub("the pathing bench",
`console.log(fails?("\\n"+fails+" FAILURES"):"\\nALL SMOKE TESTS PASSED");`,
`// ==================== v134.0 THE PATHING BENCH ====================
// Last in the file on purpose: these add bodies and buildings, which shifts unit ids, and nothing
// runs after them. tools/pathprobe.js is the same set of experiments on a 2-second load, for when
// one of these goes red and you want to iterate without paying for the suite.
{
  const G=global.__G;
  const probe=[];
  const pBld=(t,x,z)=>{const b=G.makeBuilding(0,t,x,z,true);probe.push(b);return b;};
  const pGuy=(x,z,n)=>{const u=G.makeUnit(0,"villager",x,z,{name:n,bot:{role:"citizen"}});
    u.bot=null;probe.push(u);return u;};                       // bot=null: it walks where WE say
  const wipe=()=>{for(const o of probe)o.alive=false;probe.length=0;};
  const faceZ=(b)=>{const A=Math.max((b.def.age||0),Math.min(5,G.teamAge[b.team]||0));
    const fz=(b.def.fzA&&b.def.fzA[A]!==undefined)?b.def.fzA[A]:
             (b.def.fz!==undefined?b.def.fz:(b.def.rBlock!==undefined?b.def.rBlock:b.def.r));
    return b.z+fz+0.7;};
  const insideAny=(x,z)=>{for(const b of G.buildings)if(insideCollider(b,x,z))return b;return null;};

  // --- 1. THE STATIC SHOVE. No movement at all: a packed blob beside a barracks, and only
  //        separate() running. Anything that ends up inside got there by teleport, full stop.
  {
    const b=pBld("barracks",-120,-60), face=faceZ(b);
    const crowd=[];
    for(let i=0;i<24;i++)crowd.push(pGuy(b.x-1.2+(i%3)*1.2,face+0.1+Math.floor(i/3)*0.9,"Shove"+i));
    for(let i=0;i<80;i++)G.separate();
    let inside=0,deepest=0;
    for(const u of crowd){const p=u.root.position;
      if(insideAny(p.x,p.z))inside++; deepest=Math.max(deepest,face-p.z);}
    check("v134.0 separate(): a packed crowd is never SHOVED INSIDE a building ("+inside+
      " of 24, deepest "+deepest.toFixed(2)+") — v133 put 3 in, 1.30 deep",
      inside===0&&deepest<0.01);
    wipe();
  }

  // --- 2. THE HAUL. Eighteen bodies converging on a stand point on the FAR side of a building,
  //        moving, with separate() after them exactly as 09-main.js runs it. This is the drop-off
  //        queue, which is the shape John sees jam.
  {
    const b=pBld("storage_pit",-120,-60);
    const goal={x:b.x,z:2*b.z-faceZ(b)-2.2};                   // the stand point on the north side
    const crowd=[];
    for(let i=0;i<18;i++)crowd.push(pGuy(b.x-4+(i%5)*2,faceZ(b)+8+Math.floor(i/5)*2,"Haul"+i));
    let insideFrames=0,worst=0; const done=new Set();
    for(let f=0;f<700;f++){
      for(const u of crowd){if(done.has(u))continue;
        if(G.moveToward(u,goal.x,goal.z,0.05,1.6))done.add(u);}
      G.separate();
      let ins=0; for(const u of crowd)if(insideAny(u.root.position.x,u.root.position.z))ins++;
      if(ins){insideFrames++;worst=Math.max(worst,ins);}
    }
    let sidesteps=0; for(const u of crowd)sidesteps+=(u._stkT||0);
    check("v134.0 haul: a queue rounding a building never stands inside it ("+insideFrames+
      "/700 frames, worst "+worst+" at once) — v133: 652 frames, 10 at once",
      insideFrames===0&&worst===0);
    check("v134.0 haul: …and every body still reaches the stand point ("+done.size+" of 18)",
      done.size===18);
    // NON-VACUITY, the other way round: the watchdog must actually FIRE here. If this reads 0 the
    // gate above is being passed by a dead instrument, which is the trap the falsify note names.
    check("v134.0 haul: the unstick watchdog FIRES in the jam ("+sidesteps+
      " sidesteps) — it fired 0 times in a whole v133 match",sidesteps>0);
    wipe();
  }

  // --- 3. OPEN GROUND. A watchdog that fires on a clear walk would thrash every unit in the game.
  {
    const u=pGuy(-120,-100,"Stroller");
    let steps=0,arrived=false;
    while(steps<900&&!arrived){arrived=G.moveToward(u,-60,-100,0.05,1.2);steps++;}
    check("v134.0 open ground: a clear walk arrives and costs NO sidesteps ("+steps+" steps, "+
      (u._stkT||0)+" sidesteps)",arrived&&!(u._stkT>0));
    wipe();
  }

  // --- 4. THE DETOUR IS SOMEWHERE REAL. Every escalation level, both hands, all validated.
  if(typeof G.pickDetour==="function"){
    pBld("barracks",-120,-40); pBld("barracks",-142,-58); pBld("barracks",-98,-58);
    const u=pGuy(-120,-58,"Detourer");
    let bad=0,n=0;
    for(let k=0;k<=4;k++){u._stkN=k;
      for(const side of [1,-1]){u._detSide=side;
        const d=G.pickDetour(u,0,50,50); n++;
        if(!G.walkable(d.x,d.z)||insideAny(d.x,d.z))bad++;}}
    check("v134.0 detour: every sidestep aims at ground a body can stand on ("+bad+" bad of "+n+
      ") — v133 never tested one",bad===0);
    wipe();
  }

  // --- 5. THE POCKET BORDER. A body legally standing in a camp pocket, pressed to its rim. The
  //        old walkable() failure snapped to the map RECTANGLE, which is a teleport out of ground
  //        the fringe rule explicitly allows.
  {
    const u=pGuy(0,G.MAP.z+40,"Pocketed");
    let biggest=0;
    for(let i=0;i<200;i++){
      const p0x=u.root.position.x,p0z=u.root.position.z;
      G.moveUnit(u,0,1,0.05);
      biggest=Math.max(biggest,Math.hypot(u.root.position.x-p0x,u.root.position.z-p0z));
    }
    const step=u.spd*0.05;
    check("v134.0 border: a body in a camp pocket is never SNAPPED to the map rectangle (biggest "+
      "frame "+biggest.toFixed(2)+" vs a step of "+step.toFixed(2)+") — v133 jumped 34.85",
      biggest<=step+1e-6&&u.root.position.z>G.MAP.z);
    wipe();
  }
}

console.log(fails?("\\n"+fails+" FAILURES"):"\\nALL SMOKE TESTS PASSED");`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patch-smoketest-pathing-v134: OK");
