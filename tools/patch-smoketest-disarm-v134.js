#!/usr/bin/env node
/* patch-smoketest-disarm-v134.js — v134.8: the v127 disarm, closed at the last site that had it.
 *
 * FOUND ON SMOKE_SEED=20260827 with the v134.8 economy:
 *
 *   PASS — the raid lands: a chieftain and ten raiders ashore
 *   FAIL — breaking the raid drops TWIN chests: 500 FOOD and 500 GOLD
 *   FAIL — twin chests split between RIVAL teams in one instant (blue scored 0, red 0)
 *
 * and the probe says why: after the bench deals 999,999 to each of the eleven raiders, ALL ELEVEN
 * ARE STILL ALIVE. This is the v127 disarm, whose note sits at the top of this file:
 *
 *     05-combat.js:196 — `if(!victim.alive||gameOver)return;` — makes dealDamage a NO-OP once a
 *     king has fallen … Patching individual sites was tried first and does not scale: the disarm
 *     resurfaced in the splash-damage check and the deposit-scoring check, in blocks nowhere near
 *     the ones already fixed. There are ~20 staged-damage sites and any new test would silently
 *     join them.
 *
 * v127 fixed it by wrapping the harness's TICK to hold gameOver down. That covers every tick loop
 * and it is why this is rare — but it clears the flag at the START of a tick, and a regicide landing
 * INSIDE that tick leaves it set on the way out. Any dealDamage between that tick and the next is
 * disarmed. Here the gap is four lines: `shore.respawnAt=-1; tick();` lands the raid, the bench
 * checks the landing, then it kills eleven raiders. With the enemy marshal on NORMAL (v134.8) a
 * regicide inside that particular tick stopped being unlikely.
 *
 * SO THE WRAP GOES ROUND dealDamage TOO, which is the "one place" the v127 note argued for and did
 * not quite reach. Both bindings: `global.__G.dealDamage` for the 26 `G.dealDamage(…)` call sites
 * and the global binding the bundle's own function declaration created, for the bare ones. Nothing
 * about the campaign changes — the tick wrapper already clears the flag every frame, so this only
 * covers the gap BETWEEN frames, where nothing but the harness itself acts.
 *
 * Why not just add setGameOver(false) to the shore block: because that is patching one of ~20 sites
 * again, and the note above is a record of that having been tried.
 */
const fs=require("fs"),path=require("path");
const R=path.join(__dirname,"..");
const S=path.join(R,"tools","smoketest.js");
let s=fs.readFileSync(S,"utf8");
let failed=[];
const sub=(name,from,to)=>{
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
};

sub("dealDamage holds the war open too",
`{
  const _rawTick=global.__G.tick;
  global.__G.tick=function(dt){
    global.__G.setGameOver(false);
    // a razed TC invalidates hundreds of later checks that have nothing to do with who won
    for(const b of global.__G.buildings)
      if(b.type==="towncenter"&&!b.alive){b.alive=true;b.hp=Math.max(1,(b.def&&b.def.hp||1000)*0.5);}
    return _rawTick(dt);
  };
}`,
`{
  const _rawTick=global.__G.tick;
  global.__G.tick=function(dt){
    global.__G.setGameOver(false);
    // a razed TC invalidates hundreds of later checks that have nothing to do with who won
    for(const b of global.__G.buildings)
      if(b.type==="towncenter"&&!b.alive){b.alive=true;b.hp=Math.max(1,(b.def&&b.def.hp||1000)*0.5);}
    return _rawTick(dt);
  };
  // v134.8 …AND ROUND dealDamage ITSELF, which is where the note above was heading. The tick wrap
  // clears the flag on the way IN, so a regicide landing inside a tick leaves it set on the way
  // out, and every staged kill between that tick and the next is silently a no-op. On
  // SMOKE_SEED=20260827 that gap is four lines wide — land the raid, check the landing, kill the
  // eleven raiders — and the eleven survived 999,999 damage apiece. Both bindings are wrapped: the
  // export for the 26 G.dealDamage sites, and the bundle's own global function declaration for the
  // bare ones. This only covers the space BETWEEN frames, where nothing but this harness acts, so
  // it cannot let the campaign run on the way the rejected "hold it down globally" fix did.
  const _rawDmg=global.__G.dealDamage;
  const _armed=function(){ global.__G.setGameOver(false); return _rawDmg.apply(null,arguments); };
  global.__G.dealDamage=_armed;
  try{ global.dealDamage=_armed; }catch(e){}
}`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(S,s);
console.log("patch-smoketest-disarm-v134: OK");
