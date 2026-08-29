#!/usr/bin/env node
/* patch-pathing-v134.js — v134.0 THE ANVIL: why the AI wedges against buildings.
 *
 * John's report: "AI also tends to get severely stuck around all buildings due to pathing issues."
 * Five separate faults, all of which have to go together, because each one hides the next.
 *
 *  1. separate() (07-ai.js) writes root.position DIRECTLY — no walkable test, no building push-out,
 *     no clamp of any kind — and it is the LAST thing that happens each frame, after every bot has
 *     moved. So the final act of every frame was to teleport NPC bodies into building footprints.
 *     moveUnit squirted them out next frame, separate() shoved them back in, and the pair ran
 *     forever. That is the stuck report, and it is the whole reason the rest went unnoticed.
 *
 *  2. …and the reason it went unnoticed is that moveToward's stall detector measures REALIZED
 *     DISPLACEMENT. The push-out/shove pair moves a body a long way every frame while it goes
 *     nowhere, so `moved` was large, `u._stk` was reset to 0 on every single frame, and the unstick
 *     logic could never fire. The same blindness covers three other zero-progress motions the
 *     engine produces on purpose: the tangential steer in steerAroundBuildings (a pure tangent with
 *     no goal blend — a unit CAN orbit a barracks at full speed forever), the endward wall slide in
 *     moveUnit (which by construction always registers as moving), and the least-penetration box
 *     push oscillating between two faces at a corner. The watchdog now measures DISTANCE TO THE
 *     GOAL, which is the thing we actually care about, and none of those four can fool it.
 *
 *  3. The remedy, when it did fire, was a BLIND lateral offset: u._det was never tested against
 *     walkable(), against a building, or against a wall. It could and did point straight into the
 *     obstacle the unit was stuck on. Detour points are now sampled on an arc and validated
 *     against the very same collider the push-out uses — one derivation, not two. The old blind
 *     offset survives as the last resort, so behaviour can never be WORSE than v133.
 *
 *  4. The _det and _wwp walks called moveUnit directly, i.e. with obstacle avoidance switched OFF,
 *     for up to 2.9s and 3s respectively. A gate sitting behind a barracks meant walking into the
 *     barracks for the whole waypoint life and then re-issuing the identical waypoint — a
 *     permanent loop. Both now steer.
 *
 *  5. The walkable() failure clamped into the map RECTANGLE. A body standing legally inside a camp
 *     pocket at z 185 that stepped to illegal ground was flung to z 161 — a 24-unit teleport, out
 *     of a pocket the fringe rule explicitly says it may stand in. It slides along the line now.
 *
 * THE STRUCTURAL CHANGE: the building push-out is lifted out of moveUnit verbatim into
 * pushOutOfBuildings(u,nx,nz,dx,dz,dt) — MOVED, not copied. Three callers need the same collider
 * and "two derivations of the same number is how a wall ends up standing somewhere the building
 * isn't" (00-data.js's own note) applies here more than anywhere. dt<=0 means "resolve in place":
 * every collider still ejects, the wall's endward slide simply contributes nothing.
 */
const fs=require("fs"),path=require("path");
const R=path.join(__dirname,"..");
const F5=path.join(R,"js","05-combat.js"), F7=path.join(R,"js","07-ai.js");
let s5=fs.readFileSync(F5,"utf8"), s7=fs.readFileSync(F7,"utf8");
let failed=[];
function sub(store,name,from,to){
  const s=store===5?s5:s7;
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  if(store===5)s5=s5.split(from).join(to); else s7=s7.split(from).join(to);
}

// ---------------------------------------------------------------------------
// 1. LIFT the push-out loop out of moveUnit, verbatim, into its own function.
// ---------------------------------------------------------------------------
const PO_HEAD=`  // push out of buildings (farm FIELDS are walkable; the barn standing on one is not)
  for(const b of buildings){`;
const PO_TAIL=`      nx=b.x+(nx-b.x)/d*r; nz=b.z+(nz-b.z)/d*r;
    }
  }
`;
{
  const nH=s5.split(PO_HEAD).length-1, nT=s5.split(PO_TAIL).length-1;
  if(nH!==1||nT!==1){
    failed.push("push-out block anchors (head "+nH+", tail "+nT+", need 1 and 1)");
  }else{
    const iH=s5.indexOf(PO_HEAD), iT=s5.indexOf(PO_TAIL)+PO_TAIL.length;
    if(iT<=iH){failed.push("push-out block: tail precedes head");}
    else{
      const block=s5.slice(iH,iT);
      const fn=
`// ---- v134.0 THE PUSH-OUT, LIFTED OUT OF moveUnit ----
// It was inline in moveUnit and three callers now need it: moveUnit itself, separate() (which used
// to shove bodies straight into buildings with nothing to catch them), and the detour validator.
// MOVED here, not copied — 00-data.js's own note that "two derivations of the same number is how a
// wall ends up standing somewhere the building isn't" is the whole argument.
//
// (dx,dz) is the desired heading and is read ONLY by the wall branch, whose response is not a
// push but an endward slide scaled by u.spd*dt. Pass dx=dz=0, dt=0 to mean "resolve this point in
// place": every collider still ejects — the wall included, perpendicular to its face — and only
// the slide contributes nothing, which is exactly right for a body that is not walking anywhere.
//
// ONE PASS, deliberately. Two overlapping colliders cannot both be satisfied, and iterating to a
// fixpoint on a town that legally leaves 0.8 of corridor (06-input.js _gapFor) would spend the
// budget without converging. A body left touching one collider is a body moveToward can walk out
// of; the failure this replaces was a body teleported INSIDE one every frame.
function pushOutOfBuildings(u,nx,nz,dx,dz,dt){
${block}  return [nx,nz];
}
`;
      s5=s5.slice(0,iH)+
`  // v134.0: the collider lives in pushOutOfBuildings now — separate() and the detour validator
  // have to agree with it exactly, and the only way to guarantee that is one copy.
  {const _po=pushOutOfBuildings(u,nx,nz,dx,dz,dt); nx=_po[0]; nz=_po[1];}
  // …and nothing may push a body onto ground it is not allowed to stand on. The push-out is a
  // shove out of a footprint with no notion of the border, so a building near the fringe could
  // park a body permanently outside the world. If the shove lands somewhere illegal and the body
  // was standing somewhere legal, it keeps what it had.
  if(!walkable(nx,nz)&&walkable(u.root.position.x,u.root.position.z)){
    nx=u.root.position.x; nz=u.root.position.z;
  }
`+s5.slice(iT);
      const mi=s5.indexOf("function moveUnit(u,dx,dz,dt){");
      if(mi<0)failed.push("moveUnit not found for function insertion");
      else s5=s5.slice(0,mi)+fn+s5.slice(mi);
    }
  }
}

// ---------------------------------------------------------------------------
// 2. walkable(): slide along the line instead of snapping to the rectangle.
// ---------------------------------------------------------------------------
sub(5,"walkable slide, not snap",
`  if(!walkable(nx,nz)){ // the wall stands at the MOUNTAINS: fringe apron + camp pockets are open ground
    nx=Math.max(-(MAP.x+BORDER_FRINGE),Math.min(MAP.x+BORDER_FRINGE,nx));
    nz=Math.max(-(MAP.z+BORDER_FRINGE),Math.min(MAP.z+BORDER_FRINGE,nz));
  }`,
`  if(!walkable(nx,nz)){ // the wall stands at the MOUNTAINS: fringe apron + camp pockets are open ground
    // v134.0 SLIDE ALONG THE LINE, DO NOT SNAP TO THE RECTANGLE. This clamp was unconditional, and
    // walkable() is deliberately NOT the rectangle — the camp pockets sit outside it and a body is
    // explicitly allowed to stand in one (smoketest: "a unit may stand OUTSIDE the border inside a
    // camp pocket"). So a creep-fighter at z 185 who stepped one pace to illegal ground was flung
    // to z 161: a 24-unit teleport out of legal ground, produced by the code meant to keep him on
    // it. Try each axis alone first — pressing north at the mountain line now WALKS along it, which
    // is what the clamp did for the rectangle and did to nobody standing in a pocket.
    const _ox=u.root.position.x,_oz=u.root.position.z;
    if(walkable(nx,_oz))nz=_oz;
    else if(walkable(_ox,nz))nx=_ox;
    else{nx=_ox;nz=_oz;}
  }`);

// ---------------------------------------------------------------------------
// 3. moveToward: goal-progress watchdog, validated detours, steering throughout.
// ---------------------------------------------------------------------------
const OLD_MT=`function moveToward(u,x,z,dt,stopDist){
  const dx=x-u.root.position.x, dz=z-u.root.position.z;
  const distT=Math.hypot(dx,dz);
  if(distT<=(stopDist||0.5)){u._stk=0;u._det=null;u._stkN=0;u._wwp=null;return true;}
  // a detour in progress takes priority — walk it out
  if(u._det&&T<u._det.until){
    moveUnit(u,u._det.x-u.root.position.x,u._det.z-u.root.position.z,dt);
    return false;
  }
  // an active wall waypoint (a gate, or the wall line's end) comes next
  if(u._wwp&&T<u._wwp.until){
    if(dist2(u.root.position.x,u.root.position.z,u._wwp.x,u._wwp.z)<2.5*2.5)u._wwp=null;
    else{
      moveUnit(u,u._wwp.x-u.root.position.x,u._wwp.z-u.root.position.z,dt);
      return false;
    }
  }
  // would the straight line strike a wall? route through a gate or around the end instead
  const wHit=wallInPath(u,dx/(distT||1),dz/(distT||1),Math.min(distT,14));
  if(wHit){
    const wp=wallCrossPoint(u,wHit,x,z);
    if(wp){
      u._wwp={x:wp.x,z:wp.z,until:T+3};
      moveUnit(u,wp.x-u.root.position.x,wp.z-u.root.position.z,dt);
      return false;
    }
  }
  const px=u.root.position.x, pz=u.root.position.z;
  const [sx,sz]=steerAroundBuildings(u,dx/(distT||1),dz/(distT||1),distT,x,z);
  moveUnit(u,sx,sz,dt);
  const moved=Math.hypot(u.root.position.x-px,u.root.position.z-pz);
  if(moved<u.spd*dt*0.25){ // pressing forward, going nowhere: something's in the way
    u._stk=(u._stk||0)+dt;
    if(u._stk>0.9){
      u._stk=0;
      const eb=nearestEnemyBuilding(u,Math.max(3.5,u.rng+1.5));
      if(eb&&u.dmg>0){ // an enemy wall bars the road? tear it down
        u.facing=Math.atan2(eb.x-px,eb.z-pz);
        tryAttack(u);
      }else{ // friendly obstruction: sidestep — wider every failed attempt
        u._detSide=-(u._detSide||1);
        u._stkN=Math.min(4,(u._stkN||0)+1);
        const L=Math.hypot(dx,dz)||1, D=8+7*u._stkN;
        u._det={x:px+dx/L*4-dz/L*D*u._detSide,
                z:pz+dz/L*4+dx/L*D*u._detSide,
                until:T+1.1+0.45*u._stkN};
      }
    }
  }else u._stk=0;
  return false;
}`;

const NEW_MT=`// ---- v134.0 THE GOAL-PROGRESS WATCHDOG, and the validated detour ----
// MOVE_GOAL_JUMP: how far the caller's target may move before it counts as a NEW errand and the
//   watchdog starts over. Bands re-aim at a running enemy every frame, and a watchdog that reset on
//   every re-aim would never fire; one that never reset would fire on every chase. 9 is comfortably
//   past a frame's worth of a fleeing body and well short of a change of mission.
// MOVE_GOAL_EPS: ground gained that counts as gained. Below this is noise off the collider.
// MOVE_STALL_T: seconds of no ground gained before we call it stuck. Long enough to walk the far
//   side of a castle (the widest legal detour is ~36 units at 7 spd ≈ 5s of arc, but the watchdog
//   is suspended while a detour runs, so this measures only unassisted circling).
const MOVE_GOAL_JUMP=9, MOVE_GOAL_EPS=0.35, MOVE_STALL_T=2.2;
// Where a sidestep is allowed to aim, in degrees off the heading to the goal. Tried in order, on
// the chosen hand first and the other hand second: square across, then progressively backwards.
// Fixed and ordered — NOT rolled — because a random draw here would consume the seeded window
// (invariant #2) and move every tree.
const DETOUR_ARC=[90,65,115,45,135,25,155,10,170];
function detourFree(u,x,z){ // is this a spot a body could actually stand?
  if(!walkable(x,z))return false;
  const p=pushOutOfBuildings(u,x,z,0,0,0); // the SAME collider the push uses — see its note
  return dist2(p[0],p[1],x,z)<0.01;        // unmoved by the resolve == not inside anything
}
function pickDetour(u,dx,dz,distT){
  const px=u.root.position.x, pz=u.root.position.z;
  const L=distT||1, fx=dx/L, fz=dz/L;      // heading to the goal…
  const rx=-fz, rz=fx;                     // …and its right hand
  const D=8+7*(u._stkN||0);                // wider every failed attempt, as before
  const until=T+1.1+0.45*(u._stkN||0);
  const side=u._detSide||1;
  for(const hand of [side,-side]){
    for(const deg of DETOUR_ARC){
      const th=deg*Math.PI/180, c=Math.cos(th), sn=Math.sin(th)*hand;
      const cx=px+(fx*c+rx*sn)*D, cz=pz+(fz*c+rz*sn)*D;
      if(detourFree(u,cx,cz))return {x:cx,z:cz,until};
    }
  }
  // Nothing on either hand is provably free — a body deep inside a town block, say. Fall back to
  // the v133 blind sidestep rather than standing still: it is what shipped, so this can only ever
  // be as bad as what shipped, never worse.
  return {x:px+fx*4-fz*D*side, z:pz+fz*4+fx*D*side, until};
}
function moveToward(u,x,z,dt,stopDist){
  const dx=x-u.root.position.x, dz=z-u.root.position.z;
  const distT=Math.hypot(dx,dz);
  if(distT<=(stopDist||0.5)){u._stk=0;u._det=null;u._stkN=0;u._wwp=null;u._pgBest=undefined;return true;}
  // --- the watchdog: DISTANCE TO THE GOAL, not ground covered ---
  // v134.0. This tested \`moved\`, the realized displacement, and the engine produces four separate
  // zero-progress motions at full speed: the pure tangent out of steerAroundBuildings (no goal
  // blend — a unit orbits a barracks forever at full stride), the endward wall slide (which by
  // construction always registers as moving), the least-penetration box push flipping between two
  // faces at a corner, and — the big one — separate() shoving a body into a footprint that the next
  // frame's push-out shoves it back out of. All four reset u._stk to 0 every frame, so the unstick
  // logic below was unreachable in exactly the situations it exists for.
  if(u._pgBest===undefined||dist2(x,z,u._pgx,u._pgz)>MOVE_GOAL_JUMP*MOVE_GOAL_JUMP){
    u._pgBest=distT; u._pgT=T; u._stkN=0;   // a new errand: fresh slate, and drop the escalation
  }else if(distT<u._pgBest-MOVE_GOAL_EPS){
    u._pgBest=distT; u._pgT=T;              // real ground gained toward the goal
  }
  u._pgx=x; u._pgz=z;
  const px=u.root.position.x, pz=u.root.position.z;
  let sx,sz,onDetour=false;
  // a detour in progress takes priority — walk it out
  if(u._det&&T<u._det.until){
    onDetour=true;
    // v134.0 …WITH AVOIDANCE ON. This called moveUnit directly, so for up to 2.9s a unit walking
    // its way out of trouble had no obstacle avoidance at all — and the detour it was walking had
    // never been tested against a building either. Two blindnesses that compounded.
    const ddx=u._det.x-px, ddz=u._det.z-pz, dl=Math.hypot(ddx,ddz)||1;
    const st=steerAroundBuildings(u,ddx/dl,ddz/dl,dl,u._det.x,u._det.z);
    sx=st[0]; sz=st[1];
  }else{
    // the detour is spent. Give the goal a fresh clock: it may well be reachable now, and firing
    // another sidestep on the strength of the stall the detour was ANSWERING would never converge.
    if(u._det){u._det=null; u._pgT=T; u._pgBest=distT;}
    if(u._wwp&&T>=u._wwp.until)u._wwp=null;
    if(u._wwp&&dist2(px,pz,u._wwp.x,u._wwp.z)<2.5*2.5){u._wwp=null;u._pgT=T;u._pgBest=distT;}
    if(!u._wwp){ // would the straight line strike a wall? route through a gate or around the end
      const wHit=wallInPath(u,dx/(distT||1),dz/(distT||1),Math.min(distT,14));
      if(wHit){
        const wp=wallCrossPoint(u,wHit,x,z);
        if(wp)u._wwp={x:wp.x,z:wp.z,until:T+3};
      }
    }
    if(u._wwp){ // v134.0 the walk to a gate steers too — a gate behind a barracks used to mean
      const wdx=u._wwp.x-px, wdz=u._wwp.z-pz, wl=Math.hypot(wdx,wdz)||1; // walking into the
      const st=steerAroundBuildings(u,wdx/wl,wdz/wl,wl,u._wwp.x,u._wwp.z); // barracks for 3s and
      sx=st[0]; sz=st[1];                                                  // re-issuing the same
    }else{                                                                 // waypoint, forever
      const st=steerAroundBuildings(u,dx/(distT||1),dz/(distT||1),distT,x,z);
      sx=st[0]; sz=st[1];
    }
  }
  moveUnit(u,sx,sz,dt);
  const moved=Math.hypot(u.root.position.x-px,u.root.position.z-pz);
  if(moved<u.spd*dt*0.25)u._stk=(u._stk||0)+dt; else u._stk=0; // still the fast pin detector
  // A detour is BY DEFINITION not progress toward the goal, so the stale test is suspended while
  // one runs — the pin test is not, because a body can absolutely wedge on its own sidestep.
  const stale=!onDetour&&(T-(u._pgT||T))>MOVE_STALL_T;
  if(u._stk>0.9||stale){
    u._stk=0; u._pgT=T; u._pgBest=distT;
    const eb=nearestEnemyBuilding(u,Math.max(3.5,u.rng+1.5));
    if(eb&&u.dmg>0){ // an enemy wall bars the road? tear it down
      u.facing=Math.atan2(eb.x-px,eb.z-pz);
      tryAttack(u);
    }else{ // friendly obstruction: sidestep — wider every failed attempt, and AIMED SOMEWHERE REAL
      u._detSide=-(u._detSide||1);
      u._stkN=Math.min(4,(u._stkN||0)+1);
      u._det=pickDetour(u,dx,dz,distT);
      u._stkT=(u._stkT||0)+1; // the instrument: how many times this body has had to be unstuck
    }
  }
  return false;
}`;
sub(5,"moveToward: goal-progress watchdog + validated detour",OLD_MT,NEW_MT);

// ---------------------------------------------------------------------------
// 4. separate(): resolve everyone it shoves against the world.
// ---------------------------------------------------------------------------
const OLD_SEP=`function separate(){
  for(let i=0;i<units.length;i++){
    const a=units[i];if(!a.alive)continue;
    const aAnchor=a.isPlayer||a.remote; // player bodies are anchors: crowds part around THEM
    const ap=a.root.position;
    for(let j=i+1;j<units.length;j++){
      const c=units[j];if(!c.alive)continue;
      const cAnchor=c.isPlayer||c.remote;
      if(aAnchor&&cAnchor)continue; // two players may stand shoulder to shoulder
      const cp=c.root.position;
      const dx=cp.x-ap.x,dz=cp.z-ap.z,d2=dx*dx+dz*dz;
      if(d2<1.69&&d2>0.0001){
        const d=Math.sqrt(d2),push=(1.3-d)*0.4,px=dx/d*push,pz=dz/d*push;
        // an unpredictable host-side shove on a player's body IS the rubber band —
        // so the full push lands on the NPC instead
        if(aAnchor){cp.x+=px*1.5;cp.z+=pz*1.5;}
        else if(cAnchor){ap.x-=px*1.5;ap.z-=pz*1.5;}
        else{ap.x-=px;ap.z-=pz;cp.x+=px;cp.z+=pz;}
      }
    }
  }
}`;
const NEW_SEP=`function separate(){
  // v134.0 …AND WHAT IT SHOVES, IT SETTLES. This wrote root.position directly — no walkable test,
  // no building push-out, no clamp — and it is the LAST thing in the frame, after every bot has
  // moved (09-main.js). So the closing act of every frame was to teleport NPC bodies INTO building
  // footprints; moveUnit squirted them out on the next; separate() put them back. A ten-deep queue
  // of villagers at a Town Center can carry a body several units in one pass, far past the 0.7 the
  // collider allows, and the pair ran forever. This is John's "AI gets severely stuck around all
  // buildings", and it is why the stall detector never fired: net progress was zero while realized
  // displacement was large, which is precisely the case the old detector could not see.
  //
  // The shoves themselves are untouched — the crowd still parts, players are still anchors. What
  // changes is that every body the pass MOVED is then resolved against the same collider moveUnit
  // uses, and a body that cannot be resolved onto legal ground is put back where it stood. The map
  // is built lazily: on a quiet frame nothing overlaps and nothing is allocated.
  let pre=null;
  const mark=(v)=>{if(!pre)pre=new Map();
    if(!pre.has(v))pre.set(v,{x:v.root.position.x,z:v.root.position.z});};
  for(let i=0;i<units.length;i++){
    const a=units[i];if(!a.alive)continue;
    const aAnchor=a.isPlayer||a.remote; // player bodies are anchors: crowds part around THEM
    const ap=a.root.position;
    for(let j=i+1;j<units.length;j++){
      const c=units[j];if(!c.alive)continue;
      const cAnchor=c.isPlayer||c.remote;
      if(aAnchor&&cAnchor)continue; // two players may stand shoulder to shoulder
      const cp=c.root.position;
      const dx=cp.x-ap.x,dz=cp.z-ap.z,d2=dx*dx+dz*dz;
      if(d2<1.69&&d2>0.0001){
        const d=Math.sqrt(d2),push=(1.3-d)*0.4,px=dx/d*push,pz=dz/d*push;
        // an unpredictable host-side shove on a player's body IS the rubber band —
        // so the full push lands on the NPC instead
        if(aAnchor){mark(c);cp.x+=px*1.5;cp.z+=pz*1.5;}
        else if(cAnchor){mark(a);ap.x-=px*1.5;ap.z-=pz*1.5;}
        else{mark(a);mark(c);ap.x-=px;ap.z-=pz;cp.x+=px;cp.z+=pz;}
      }
    }
  }
  if(!pre)return;
  for(const [v,p0] of pre){
    const p=v.root.position;
    const q=pushOutOfBuildings(v,p.x,p.z,0,0,0); // dt 0: eject, do not slide — nobody is walking
    if(walkable(q[0],q[1])){p.x=q[0];p.z=q[1];}
    else{p.x=p0.x;p.z=p0.z;} // the crowd shoved this body off the world: it keeps its ground
  }
}`;
sub(7,"separate(): settle every body it shoves",OLD_SEP,NEW_SEP);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(F5,s5);
fs.writeFileSync(F7,s7);
console.log("patch-pathing-v134: OK — 05-combat.js and 07-ai.js written");
