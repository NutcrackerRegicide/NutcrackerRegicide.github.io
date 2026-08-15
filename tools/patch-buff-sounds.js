#!/usr/bin/env node
/* patch-buff-sounds.js — v132.37: give every triggered buff its own voice.
 *
 * Twelve new Epic Stock Media cues, embedded by tools/sfxadd.js, wired to the twelve procs that
 * shipped silent across batches C, D and E. John's instruction: no reuse — so every one of these
 * is a distinct file, and none of them is a sound the game already plays.
 *
 * ── WHAT DELIBERATELY STAYS SILENT ──────────────────────────────────────────────────────────
 * Not every buff should make a noise. These are CONTINUOUS, not triggered, and a per-tick cue
 * would be a drone rather than feedback:
 *     UNBOWED · PHALANX      — passive damage modifiers with no discrete moment at all
 *     KINSHIP · STEWARD      — heal/repair a fraction of a point at a time, 4× a second
 *     DEEP GASH              — rides EVERY blow you land; a cue would fire as often as the hit
 *                              sound already does, and would just thicken it
 * SEARING PRESENCE burns continuously too, so its cue is THROTTLED to once every ~2.5s rather
 * than played per scan — audible as a periodic sizzle, not a buzz.
 *
 * ── POSITIONAL, AND HOST-BROADCAST WHERE IT MATTERS ─────────────────────────────────────────
 * Every call passes {x,z} so the existing panner places it in the world. The two BLOCKS also
 * ride NET.bcast for the same reason the game already broadcasts a parry: the person who was
 * blocked should hear that their blow was turned aside, and on their screen the event happened
 * to someone else.
 */
const fs=require("fs"),path=require("path");
let failed=[];
function mk(box){
  return function sub(name,from,to){
    const n=box.o.split(from).length-1;
    if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
    box.o=box.o.split(from).join(to);
  };
}
const P={combat:path.join(__dirname,"..","js","05-combat.js")};
const c={o:fs.readFileSync(P.combat,"utf8")};
const subC=mk(c);

const SND='const _sfxAt=(k,u)=>{if(typeof Sound!=="undefined"&&u&&u.root)Sound.play(k,{x:u.root.position.x,z:u.root.position.z});};';

subC("the sfx helper",
`// v132.36: RAPID VOLLEY and EARTHSHAKER both re-enter dealDamage.`,
`// v132.37: every triggered buff has its own cue. Positional, so the existing panner places it.
${SND}
// v132.36: RAPID VOLLEY and EARTHSHAKER both re-enter dealDamage.`);

// ---- batch C ----
subC("bleed cue",
`      tmodAdd(victim,"bleed",1,20,false); victim._dotBy=attU;
      puff(victim.root.position.x,2.0,victim.root.position.z,0xb3262a,0.7);`,
`      tmodAdd(victim,"bleed",1,20,false); victim._dotBy=attU;
      puff(victim.root.position.x,2.0,victim.root.position.z,0xb3262a,0.7);
      _sfxAt("bleedhit",victim);`);

subC("venom cue",
`      tmodAdd(victim,"spdmul",-0.5,10,false);           // a NEGATIVE spdmul is the whole slow
      puff(victim.root.position.x,2.0,victim.root.position.z,0x8fd45a,0.8);`,
`      tmodAdd(victim,"spdmul",-0.5,10,false);           // a NEGATIVE spdmul is the whole slow
      puff(victim.root.position.x,2.0,victim.root.position.z,0x8fd45a,0.8);
      _sfxAt("venomhit",victim);`);

subC("stun cue — replaces the borrowed hit",
`      puff(victim.root.position.x,2.8,victim.root.position.z,0xffe9a8,1.1);
      if(typeof Sound!=="undefined")Sound.play("hit",{x:victim.root.position.x,z:victim.root.position.z});`,
`      puff(victim.root.position.x,2.8,victim.root.position.z,0xffe9a8,1.1);
      _sfxAt("stunhit",victim);   // v132.37: its own cue. It borrowed the generic "hit" before,
                                  // which made the game's biggest melee moment sound like a jab.`);

subC("shrug cue",
`    if(shedDebuffs(victim)&&victim.isPlayer&&typeof msg==="function")msg("You shrug it off!","blue");`,
`    if(shedDebuffs(victim)){
      _sfxAt("shrugoff",victim);
      if(victim.isPlayer&&typeof msg==="function")msg("You shrug it off!","blue");
    }`);

// ---- batch D ----
subC("sanctuary cue — on the OPENING, not per tick",
`  const zoneOpen=sanct&&u._stillT>=AURA_STILL;`,
`  const zoneOpen=sanct&&u._stillT>=AURA_STILL;
  // the cue belongs to the MOMENT the zone opens, not to every scan while it is open
  if(zoneOpen&&!u._zoneWasOpen)_sfxAt("sanctuary",u);
  u._zoneWasOpen=zoneOpen;`);

subC("searing cue — throttled",
`      if(brand&&typeof dealDamage==="function")dealDamage(u,o,1*brand*step); // SEARING PRESENCE`,
`      if(brand&&typeof dealDamage==="function"){
        dealDamage(u,o,1*brand*step);                    // SEARING PRESENCE
        // continuous damage, so the cue is THROTTLED — a sizzle every ~2.5s, not a buzz
        if(typeof T!=="undefined"&&T-(u._searT||-999)>2.5){u._searT=T;_sfxAt("sear",u);}
      }`);

// ---- batch E ----
subC("quake cue",
`      puff(px,0.6,pz,0xc9a06a,2.2);`,
`      puff(px,0.6,pz,0xc9a06a,2.2);
      _sfxAt("quakeslam",attU);`);

subC("volley cue",
`      _volleyIn=false;
      if(attU.isPlayer&&typeof msg==="function")msg("Rapid volley!","gold");`,
`      _volleyIn=false;
      _sfxAt("volleyshot",attU);
      if(attU.isPlayer&&typeof msg==="function")msg("Rapid volley!","gold");`);

subC("knife cue",
`  dealDamage(u,best,(u.dmg||5)*0.6*st);`,
`  _sfxAt("knifethrow",u);
  dealDamage(u,best,(u.dmg||5)*0.6*st);`);

subC("ward + guard cues",
`      if(rangedBlow&&wd&&T-(victim._wardT||-999)>=30/wd){
        victim._wardT=T; victim._lastHurt=T;
        puff(victim.root.position.x,2.2,victim.root.position.z,0x9fd8ff,1.0);
        if(victim.isPlayer&&typeof msg==="function")msg("Arrow warded!","blue");
        return;
      }
      if(!rangedBlow&&gd&&att&&att.cls&&T-(victim._guardT||-999)>=30/gd){
        victim._guardT=T; victim._lastHurt=T;
        puff(victim.root.position.x,2.2,victim.root.position.z,0xd8dde2,1.0);
        if(victim.isPlayer&&typeof msg==="function")msg("Blow turned aside!","blue");
        return;
      }`,
`      if(rangedBlow&&wd&&T-(victim._wardT||-999)>=30/wd){
        victim._wardT=T; victim._lastHurt=T;
        puff(victim.root.position.x,2.2,victim.root.position.z,0x9fd8ff,1.0);
        _sfxAt("wardblock",victim);
        // broadcast, for the same reason a parry is: the archer whose shot was stopped should
        // hear it, and on their screen it happened to somebody else.
        if(typeof NET!=="undefined"&&NET.mode==="host")
          NET.bcast({t:"snd",k:"wardblock",x:victim.root.position.x,z:victim.root.position.z});
        if(victim.isPlayer&&typeof msg==="function")msg("Arrow warded!","blue");
        return;
      }
      if(!rangedBlow&&gd&&att&&att.cls&&T-(victim._guardT||-999)>=30/gd){
        victim._guardT=T; victim._lastHurt=T;
        puff(victim.root.position.x,2.2,victim.root.position.z,0xd8dde2,1.0);
        _sfxAt("guardblock",victim);
        if(typeof NET!=="undefined"&&NET.mode==="host")
          NET.bcast({t:"snd",k:"guardblock",x:victim.root.position.x,z:victim.root.position.z});
        if(victim.isPlayer&&typeof msg==="function")msg("Blow turned aside!","blue");
        return;
      }`);

// DEEP GASH keeps its own cue but only on the FIRST application, not every blow
subC("gash cue — only when it lands fresh",
`    if(buffSt(attU,"gash"))tmodAdd(victim,"healblock",1,3,false); // DEEP GASH`,
`    if(buffSt(attU,"gash")){                                      // DEEP GASH
      // …but the cue only when it lands FRESH. It rides every blow you throw, so a sound per hit
      // would simply thicken the impact that already plays.
      if(!(victim._tmods&&tmodSum(victim,"healblock")>0))_sfxAt("gashcut",victim);
      tmodAdd(victim,"healblock",1,3,false);
    }`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(P.combat,c.o);
console.log("patched js/05-combat.js — twelve triggered buffs, twelve distinct cues");
