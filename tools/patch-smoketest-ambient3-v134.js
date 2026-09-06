#!/usr/bin/env node
/* patch-smoketest-ambient3-v134.js — v134.9: two benches isolate the radius the RULE reads.
 *
 * Both of these are the same defect as the constants this version is about, one layer up: a bench
 * carrying a number that was derived from a rule and stopped agreeing with it.
 *
 * ── 1. THE TWO RELIEF BENCHES ─────────────────────────────────────────────────────────────────
 *   SMOKE_SEED=12345
 *   FAIL — v113 relief: a hold band with a spent tour and a cold field takes a new mission (hold)
 *   FAIL — v132.26 relief: a band MID-CAPTURE is not relieved … (hold holding vs hold relieved)
 *
 * Probed at the branch itself:
 *
 *   [rl] band 9001 role=hold T=576.1 holdUntil=575.1 quiet=0.0/18 taking=false guard=false
 *
 * Every clause the bench stages is correct — the tour is spent, nothing is being captured, it is
 * not the last guard. `quiet` is 0.0 against a HOLD_QUIET of 18: the CONTACT clock was reset in the
 * same call, because manageBands looks for an enemy within HOLD_WATCH (48) of the band's centre and
 * found one. The bench isolates a radius of 30. It has isolated the wrong circle since v127 — the
 * comment above it is explicit that a cold field must be STAGED rather than hoped for, and then
 * stages 30 of the 48 the rule reads. It only bites when an enemy happens to stand in the 18-unit
 * annulus between the two, which is luck, which is why moving the AI found it.
 *
 * Derived from HOLD_WATCH now, so it moves when the rule does.
 *
 * ── 2. THE CREEP REGEN BENCH ──────────────────────────────────────────────────────────────────
 *   SMOKE_SEED=3
 *   FAIL — calm creeps regenerate (+-99 hp of 155, T+3.0s, cleared 0, still in ring 0, alive false)
 *
 * "Nothing in the ring" and "cleared 0" — and a probe at the body itself:
 *
 *   [cr] wounded @(19,147) d(camp)=29.6 ringR=31.5 alive=false hp=-37
 *        non-neutral within 70: musketeer(1)@3 musketeer(1)@4 musketeer(1)@2 musketeer(1)@3 …
 *
 * FOUR RED MUSKETEERS standing two to four units off it. The isolation is centred on the CAMP and
 * reaches 31.5; the creep had wandered 29.6 out on its leash, so the fight was at the rim of the
 * circle and the shooters were outside it — and "still in ring 0" agreed, because that ring is the
 * aggro radius round the camp, not the ground the body is standing on. Two numbers about the camp,
 * describing an event at the creep.
 *
 * So the body gets its own circle, wide enough for a musket and three seconds of walking, on top of
 * the camp's. The wave is also held off for the duration, because a camp whose respawn comes due
 * mid-measurement swaps the pack and leaves the watched object behind — "a calm camp knits its
 * wounded" is a claim about neither respawn timing nor a firefight.
 */
const fs=require("fs"),path=require("path");
const R=path.join(__dirname,"..");
const S=path.join(R,"tools","smoketest.js");
let s=fs.readFileSync(S,"utf8");
let failed=[];
const subAll=(name,from,to,want)=>{
  const n=s.split(from).length-1;
  if(n!==want){failed.push(name+" (matched "+n+" times, need exactly "+want+")");return;}
  s=s.split(from).join(to);
};

// ---------------------------------------------------------------------------
// 1. The relief benches isolate HOLD_WATCH, not 30.
// ---------------------------------------------------------------------------
// All three sites are the same call and all three are wrong the same way, so all three move.
subAll("the relief benches isolate the watch radius",
`isolateArea(-200,-118,30,{team:1-team,keep:[cold]})`,
`isolateArea(-200,-118,(global.__G.HOLD_WATCH||48)+6,{team:1-team,keep:[cold]})`,3);

subAll("…and the v113 bench says which radius it cleared",
`    check("v113 relief: a hold band with a spent tour and a cold field takes a new mission ("+hb.role+
      ", field cleared of "+cellar.moved+")",`,
`    // v134.9: the radius is HOLD_WATCH+6, not 30. manageBands resets the contact clock from any
    // enemy within HOLD_WATCH of the band's centre, so clearing 30 of it left an 18-unit annulus
    // where one raider standing still made the field hot — measured on SMOKE_SEED=12345 as
    // quiet=0.0 against a HOLD_QUIET of 18, with every other clause of the relief rule satisfied.
    check("v113 relief: a hold band with a spent tour and a cold field takes a new mission ("+hb.role+
      ", field cleared of "+cellar.moved+" within "+((global.__G.HOLD_WATCH||48)+6)+")",`,1);

// ---------------------------------------------------------------------------
// 2. The regen bench holds the wave off.
// ---------------------------------------------------------------------------
subAll("the pack is not replaced mid-measurement",
`  wounded.hp=wounded.maxHp*0.4; // bloody one by hand — the camp is calm, so it must knit
  const wh=wounded.hp;
  const regenT0=global.__G.getT();
  warTicks(90);`,
`  wounded.hp=wounded.maxHp*0.4; // bloody one by hand — the camp is calm, so it must knit
  const wh=wounded.hp;
  const regenT0=global.__G.getT();
  // v134.9 …AND THE PACK IS NOT REPLACED UNDERNEATH IT. On SMOKE_SEED=3 this reported "-99 hp,
  // cleared 0, still in ring 0, alive false": nothing was near it and nothing killed it — the
  // camp's own respawn came due inside these 90 ticks, campNewWave built a fresh pack, and the body
  // being watched was left behind by the camp it belonged to. v127 taught this bench to stand a
  // body up when the pack was wiped; this stops the pack being swapped mid-measurement. Restored
  // straight afterwards, because a camp that never respawns is a different world for what follows.
  const _wv=north.respawnAt, _wt=north.waiting;
  north.waiting=false; north.respawnAt=1e9;
  // …and a circle round the BODY, not only round the camp. A creep on its leash stands up to 26
  // from the centre, so the camp's 31.5 leaves the rim of its own wander unguarded: on
  // SMOKE_SEED=3 the wounded creep sat 29.6 out with four red musketeers two to four units away,
  // and both of the bench's own diagnostics — "cleared 0" and "still in ring 0" — were reporting
  // on the camp while the shooting happened at the creep. 45 covers a musket and three seconds of
  // approach.
  const calmBody=isolateArea(wounded.root.position.x,wounded.root.position.z,45,
    {keep:north.creeps,keepNeutral:true});
  warTicks(90);
  calmBody.restore();
  north.respawnAt=_wv; north.waiting=_wt;`,1);

subAll("…and the regen message reports both circles",
`  check("calm creeps regenerate"+(_revived?" (PACK WAS DEAD — one stood back up for this)":"")+
    " (+"+Math.round(wounded.hp-wh)+" hp of "+Math.round(wounded.maxHp)+
    ", T+"+(global.__G.getT()-regenT0).toFixed(1)+"s, cleared "+calm.moved+", still in ring "+inRing+`,
`  check("calm creeps regenerate"+(_revived?" (PACK WAS DEAD — one stood back up for this)":"")+
    " (+"+Math.round(wounded.hp-wh)+" hp of "+Math.round(wounded.maxHp)+
    ", T+"+(global.__G.getT()-regenT0).toFixed(1)+"s, cleared "+calm.moved+" round the camp and "+
    calmBody.moved+" round the body, still in ring "+inRing+`,1);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(S,s);
console.log("patch-smoketest-ambient3-v134: OK");
