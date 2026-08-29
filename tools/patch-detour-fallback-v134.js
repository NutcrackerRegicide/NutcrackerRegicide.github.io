#!/usr/bin/env node
/* patch-detour-fallback-v134.js — the sidestep's last resort was still a blind one.
 *
 * The first cut of pickDetour validated every candidate on the arc and then, if none was free,
 * fell back to v133's blind lateral offset "so behaviour can never be WORSE than what shipped".
 * That reasoning was wrong twice over.
 *
 *  1. It made the gate a lie. "Every sidestep aims at ground a body can stand on" is the invariant
 *     the smoketest asserts, and an unvalidated fallback means the invariant simply is not true.
 *     It held on the default seed and went red on SMOKE_SEED=42, where a denser town left nothing
 *     free on the arc at the escalated radius — 2 of 10 sidesteps aimed inside a building. An
 *     invariant that holds on one seed is not an invariant, it is a coincidence.
 *
 *  2. "No worse than v133" was not true either. The v133 blind offset was walked with obstacle
 *     avoidance switched OFF; this version steers all the way through a detour. A blind point that
 *     v133 would have bounced off, this version commits to and steers toward for up to 2.9s.
 *
 * So: if the wide arc is blocked, look CLOSER IN before giving up — a body wedged between two
 * buildings usually has three or four units of daylight even when it has no eight. Only when every
 * hand at every range is blocked does pickDetour return null, and null means "issue no sidestep
 * this time": keep steering at the goal, keep the escalation counter, try again in MOVE_STALL_T.
 * A body that is genuinely walled in on all sides has nowhere to be sent, and sending it somewhere
 * anyway is how v133 walked units into walls.
 */
const fs=require("fs"),path=require("path");
const F=path.join(__dirname,"..","js","05-combat.js");
let s=fs.readFileSync(F,"utf8");
let failed=[];
function sub(name,from,to){
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
}

sub("pickDetour: closer-in retries, and null instead of a blind guess",
`function pickDetour(u,dx,dz,distT){
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
}`,
`// DETOUR_RANGE: the wide swing first, then closer in. A body wedged between two buildings often
// has three units of daylight where it has no eight, and the escalated radius (up to 36) is the
// one LEAST likely to be free in a dense town — which is exactly when it is asked for.
const DETOUR_RANGE=[1,0.6,0.32], DETOUR_MIN=3;
function pickDetour(u,dx,dz,distT){
  const px=u.root.position.x, pz=u.root.position.z;
  const L=distT||1, fx=dx/L, fz=dz/L;      // heading to the goal…
  const rx=-fz, rz=fx;                     // …and its right hand
  const base=8+7*(u._stkN||0);             // wider every failed attempt, as before
  const until=T+1.1+0.45*(u._stkN||0);
  const side=u._detSide||1;
  for(const scale of DETOUR_RANGE){
    const D=Math.max(DETOUR_MIN,base*scale);
    for(const hand of [side,-side]){
      for(const deg of DETOUR_ARC){
        const th=deg*Math.PI/180, c=Math.cos(th), sn=Math.sin(th)*hand;
        const cx=px+(fx*c+rx*sn)*D, cz=pz+(fz*c+rz*sn)*D;
        if(detourFree(u,cx,cz))return {x:cx,z:cz,until};
      }
    }
  }
  // Walled in on every hand at every range. The first cut fell back to v133's BLIND lateral offset
  // here, on the reasoning that it could then never be worse than what shipped — and that was wrong
  // twice. It made the "every sidestep aims at legal ground" gate a coincidence rather than an
  // invariant (SMOKE_SEED=42 put 2 of 10 sidesteps inside a building), and it was not even
  // equivalent to v133, because v133 walked its blind offset with avoidance OFF and bounced,
  // whereas this version STEERS toward a detour for up to 2.9s and commits to it.
  // Null means: issue no sidestep, keep steering at the goal, keep the escalation, try again in
  // MOVE_STALL_T. A body with nowhere to go is not helped by being sent somewhere anyway.
  return null;
}`);

sub("moveToward: a null sidestep is a sidestep not issued",
`      u._detSide=-(u._detSide||1);
      u._stkN=Math.min(4,(u._stkN||0)+1);
      u._det=pickDetour(u,dx,dz,distT);
      u._stkT=(u._stkT||0)+1; // the instrument: how many times this body has had to be unstuck`,
`      u._detSide=-(u._detSide||1);
      u._stkN=Math.min(4,(u._stkN||0)+1);
      u._det=pickDetour(u,dx,dz,distT);   // …which is null when there is nowhere legal to go
      if(u._det)u._stkT=(u._stkT||0)+1;   // the instrument: sidesteps ISSUED, not attempts`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patch-detour-fallback-v134: OK");
