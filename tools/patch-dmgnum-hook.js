#!/usr/bin/env node
/* patch-dmgnum-hook.js — v132.46: hang the number on the one line where damage becomes real,
 * and get it to the person who swung.
 *
 * ── WHOSE NUMBER IS IT ──────────────────────────────────────────────────────────────────────
 * YOURS. In a 485-unit battle, drawing everybody's damage is a blizzard that tells you nothing;
 * the question a player is actually asking is "is MY forge working". So the number is drawn for
 * the attacker and for nobody else — which makes it, unusually for this session, a display effect
 * that must NOT be broadcast.
 *
 * ── AND THAT IS WHY IT IS A TARGETED SEND, NOT NET.bcast ────────────────────────────────────
 * dealDamage returns on its first line for a guest, so a guest computes no damage and would see
 * no numbers for its own blows — the same trap the sounds, the rings and the set-pieces all hit.
 * But the fix here is the opposite shape: the host sends {t:"dnum"} to the ONE connection that
 * threw the punch, exactly as syncBuffs and the garrison cue already do. Broadcasting would put
 * everyone's damage on everyone's screen, which is the thing being avoided.
 *
 * ── THE CRIT FLAG IS A LOCAL, AND IT CAN BE ─────────────────────────────────────────────────
 * KEEN EYE rolls at line ~1138 and the subtraction is at ~1211; dealDamage spans 1099-1406, so
 * they share a scope and a plain local carries it. No field on the unit, nothing to clear, nothing
 * to leak into the next blow.
 *
 * ⚠ THE READING IS TAKEN AT THE SUBTRACTION, NOT BEFORE IT. Everything upstream — every
 * multiplier, the dodge, both charge blocks, the shield — has already had its say by then. A
 * number computed anywhere earlier would be a number the game did not use.
 *
 * PROTO 45 → 46.
 */
const fs=require("fs"),path=require("path");
let failed=[];
function mk(box){return function(name,from,to){
  const n=box.o.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  box.o=box.o.split(from).join(to);};}
const P={comb:path.join(__dirname,"..","js","05-combat.js"),
         net:path.join(__dirname,"..","js","10-net.js")};
const c={o:fs.readFileSync(P.comb,"utf8")}, n={o:fs.readFileSync(P.net,"utf8")};
const subC=mk(c), subN=mk(n);

subC("remember the crit",
`      m*=2; puff(victim.root.position.x,2.4,victim.root.position.z,0xffd24a,1.1);`,
`      m*=2; _wasCrit=true;   // v132.46: a plain local — the roll and the subtraction share a scope
      puff(victim.root.position.x,2.4,victim.root.position.z,0xffd24a,1.1);`);

subC("declare it",
`function dealDamage(att,victim,dmg){`,
`function dealDamage(att,victim,dmg){
  let _wasCrit=false;   // v132.46: set by KEEN EYE below, read at the subtraction`);

subC("the reading, at the subtraction",
`  victim._lastHurt=T; // Second Skin waits for quiet
  victim.hp-=dmg; hitFlash(victim);`,
`  victim._lastHurt=T; // Second Skin waits for quiet
  victim.hp-=dmg; hitFlash(victim);
  // ---- v132.46 THE DAMAGE NUMBER. Read HERE and nowhere earlier: every multiplier, the dodge,
  // both charge blocks and the shield have already had their say by this line, so this is the
  // only place the figure is the one the game actually used. ----
  if(attU&&dmg>0){
    if(attU===player&&typeof dmgNum==="function")dmgNum(victim,dmg,_wasCrit);
    else if(attU.remote&&typeof NET!=="undefined"&&NET.mode==="host"&&NET.remotes[attU.remote]){
      // ⚠ TO THE ONE WHO SWUNG, not to everyone. Broadcasting would put every unit's damage on
      // every screen, which is the blizzard this is meant to replace. Same targeted shape as
      // syncBuffs and the garrison cue.
      const _r=NET.remotes[attU.remote];
      if(_r.conn){try{_r.conn.send({t:"dnum",i:victim.id,d:Math.round(dmg*100),c:_wasCrit?1:0});}catch(_){}}
    }
  }`);

subN("PROTO 46",
`  PROTO:45,             // v132.44 the thrown-knife kind. Was:`,
`  PROTO:46,             // v132.46 the damage-number message (dnum). Was:
                        // v132.44 the thrown-knife kind. Was:`);

subN("the guest draws its own",
`  if(d.t==="note")return msg(d.m,d.tone||"");`,
`  if(d.t==="dnum"){ // v132.46 YOUR damage, sent only to you — see patch-dmgnum-hook.js
    const v=NET.unitById(d.i);
    if(v&&typeof dmgNum==="function")dmgNum(v,(d.d||0)/100,!!d.c);
    return;
  }
  if(d.t==="note")return msg(d.m,d.tone||"");`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(P.comb,c.o); fs.writeFileSync(P.net,n.o);
console.log("patched — the number reaches whoever swung. PROTO 46.");
