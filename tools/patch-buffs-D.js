#!/usr/bin/env node
/* patch-buffs-D.js — v132.35 BATCH D: six buffs and ONE new system — radius auras.
 *
 * SANCTUARY · SEARING PRESENCE · UNBOWED · PHALANX · KINSHIP · STEWARD
 *
 * ── THE COST PROBLEM COMES FIRST ────────────────────────────────────────────────────────────
 * "A radius around you" is the one buff shape that can quietly wreck the tick budget: done
 * naively it is every holder × every unit, every frame, and this game runs ~485 units. Three
 * things keep it cheap, and they are the design:
 *   1. ONLY HOLDERS SCAN. The whole block returns immediately unless the unit actually carries
 *      one of the six. Buffs are human-only, so in a two-player match that is at most two units.
 *   2. 4 Hz, NOT 60. Auras accumulate dt and scan every AURA_SCAN seconds, applying the whole
 *      accumulated step at once. A heal-over-time does not care whether it arrives in 16ms or
 *      250ms slices; the tick budget cares a great deal.
 *   3. ONE PASS SERVES ALL SIX. A single walk over `units` counts allies, counts enemies, burns
 *      enemies and mends kin — rather than six independent scans.
 *
 * ── THE TWO THAT ARE READ AT DAMAGE TIME, NOT APPLIED ───────────────────────────────────────
 * UNBOWED (−5% per enemy near you) and PHALANX (+5% per ally) are not periodic effects — they
 * modify a blow that may land at any instant. Recomputing a radius inside dealDamage would put an
 * O(units) walk on the hottest path in the game. So the scan CACHES the counts on the unit and
 * dealDamage reads the cached number. That is exactly how Captain's Banner already works via the
 * `_captains` cache, so it is the house pattern rather than a new idea.
 *   The cost of caching is staleness of up to AURA_SCAN — a quarter second. For "how many people
 * are standing near me" that is invisible.
 *
 * ── SANCTUARY NEEDS A STILLNESS CLOCK ───────────────────────────────────────────────────────
 * "After standing still for 3 seconds" is a state with a build-up. `u.moving` already exists and
 * is maintained for the walk animation, so the clock rides it: reset on movement, accumulate
 * otherwise. It is deliberately NOT reset by taking damage — standing your ground under fire is
 * the fantasy.
 *
 * ── WHAT COUNTS AS AN ENEMY FOR UNBOWED ─────────────────────────────────────────────────────
 * The wilds count. Being surrounded is being surrounded, and a wolf pack is the clearest case of
 * the thing the buff is about.
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
const P={data:path.join(__dirname,"..","js","00-data.js"),
         combat:path.join(__dirname,"..","js","05-combat.js")};
const d={o:fs.readFileSync(P.data,"utf8")}, c={o:fs.readFileSync(P.combat,"utf8")};
const subD=mk(d), subC=mk(c);

// ---------------- the table ----------------
subD("batch D buffs",
`  {id:"shrug",  name:"Shrug It Off",    desc:"10% chance when struck to shed every debuff",   max:1}
];`,
`  {id:"shrug",  name:"Shrug It Off",    desc:"10% chance when struck to shed every debuff",   max:1},
  // ---- v132.35 BATCH D: six that work on everything standing near you ----
  {id:"sanctuary",name:"Sanctuary",     desc:"stand still 3s to open a healing zone — 3% HP a second",max:1},
  {id:"brand",  name:"Searing Presence",desc:"nearby enemies burn for 1 HP a second",         max:1},
  {id:"resolve",name:"Unbowed",         desc:"−5% damage taken for every enemy near you, to −25%",max:1},
  {id:"phalanx",name:"Phalanx",         desc:"+5% damage for every ally beside you, to +20%",  max:1},
  {id:"kinship",name:"Kinship",         desc:"mend while a soldier of your own kind stands near",max:1},
  {id:"steward",name:"Steward",         desc:"(villager) mend nearby friendly buildings, 0.5 HP a second",max:1}
];`);

// ---------------- the system ----------------
subC("aura system",
`// ---------- v132.34: the DEBUFF half of the timed system ----------`,
`// ---------- v132.35 RADIUS AURAS ----------
// The one buff shape that can wreck the tick budget. Three rules keep it cheap: only HOLDERS
// scan, they scan at 4 Hz rather than per frame, and ONE pass over units serves all six effects.
const AURA_BR=10;        // the radius they share — the Temple's heal reach, so the game has one
                         // idea of "near you" rather than six
const AURA_SCAN=0.25;    // seconds between scans. A heal-over-time cannot tell; the budget can.
const AURA_STILL=3;      // SANCTUARY's stillness clock
function auraBuffTick(u,dt){
  if(!u.alive||typeof isHuman!=="function"||!isHuman(u))return;
  const sanct=buffSt(u,"sanctuary"), brand=buffSt(u,"brand"), kin=buffSt(u,"kinship"),
        stew=buffSt(u,"steward"), res=buffSt(u,"resolve"), pha=buffSt(u,"phalanx");
  if(!(sanct||brand||kin||stew||res||pha)){u._auraE=0;u._auraA=0;u._stillT=0;return;}
  // SANCTUARY's clock. Deliberately not reset by taking damage — standing your ground under fire
  // is the whole fantasy.
  u._stillT=u.moving?0:(u._stillT||0)+dt;
  u._auraW=(u._auraW||0)+dt;
  if(u._auraW<AURA_SCAN)return;
  const step=u._auraW; u._auraW=0;
  const R2=AURA_BR*AURA_BR, px=u.root.position.x, pz=u.root.position.z;
  const zoneOpen=sanct&&u._stillT>=AURA_STILL;
  let allies=0, enemies=0, kinNear=false;
  // ONE pass. Six effects.
  for(const o of units){
    if(!o.alive||o===u)continue;
    const dx=o.root.position.x-px, dz=o.root.position.z-pz;
    if(dx*dx+dz*dz>R2)continue;
    if(o.team===u.team){
      allies++;
      if(kin&&!kinNear&&o.cls===u.cls&&!o.isKing)kinNear=true;
      if(zoneOpen&&o.hp<o.maxHp){                       // SANCTUARY mends the whole warband
        o.hp=Math.min(o.maxHp,o.hp+u.maxHp*0.03*sanct*step);
        if(o.bar&&typeof setBar==="function")setBar(o.bar,o.hp/o.maxHp);
      }
    }else{
      enemies++;                                         // the wilds count: surrounded is surrounded
      if(brand&&typeof dealDamage==="function")dealDamage(u,o,1*brand*step); // SEARING PRESENCE
    }
  }
  u._auraA=allies; u._auraE=enemies;                     // cached for the damage-time readers
  if(zoneOpen&&u.hp<u.maxHp){                            // …and it mends the one who opened it
    u.hp=Math.min(u.maxHp,u.hp+u.maxHp*0.03*sanct*step);
    if(u.isPlayer&&typeof updatePlayerHud==="function")updatePlayerHud();
  }
  if(kin&&kinNear&&u.hp<u.maxHp){                        // KINSHIP
    u.hp=Math.min(u.maxHp,u.hp+1.0*kin*step);
    if(u.bar&&typeof setBar==="function")setBar(u.bar,u.hp/u.maxHp);
  }
  if(stew&&u.cls==="villager"&&typeof buildings!=="undefined"){ // STEWARD
    for(const b of buildings){
      if(!b.alive||b.team!==u.team||!b.built||b.hp>=b.def.hp)continue;
      const bx=b.x-px, bz=b.z-pz;
      if(bx*bx+bz*bz>R2)continue;
      b.hp=Math.min(b.def.hp,b.hp+0.5*stew*step);
    }
  }
}
// ---------- v132.34: the DEBUFF half of the timed system ----------`);

// ---------------- drive it from the host-only status tick ----------------
subC("drive auraBuffTick",
`function statusTick(u,dt){
  tmodTick(u,dt);`,
`function statusTick(u,dt){
  tmodTick(u,dt);
  if(typeof auraBuffTick==="function")auraBuffTick(u,dt); // v132.35 radius auras — holders only`);

// ---------------- the two damage-time readers ----------------
subC("phalanx at the blow",
`    if(buffSt(attU,"kguard")&&nearOwnKing(attU))m*=1+0.10*buffSt(attU,"kguard"); // KING'S GUARD — damage half`,
`    if(buffSt(attU,"kguard")&&nearOwnKing(attU))m*=1+0.10*buffSt(attU,"kguard"); // KING'S GUARD — damage half
    if(buffSt(attU,"phalanx"))                                     // PHALANX — reads the CACHED
      m*=1+Math.min(0.20,0.05*buffSt(attU,"phalanx")*(attU._auraA||0)); // count, never a fresh scan`);

subC("unbowed at the blow",
`    if(buffSt(victim,"kguard")&&nearOwnKing(victim))dmg*=1-0.10*buffSt(victim,"kguard"); // KING'S GUARD`,
`    if(buffSt(victim,"kguard")&&nearOwnKing(victim))dmg*=1-0.10*buffSt(victim,"kguard"); // KING'S GUARD
    if(buffSt(victim,"resolve"))                                   // UNBOWED — the more of them
      dmg*=1-Math.min(0.25,0.05*buffSt(victim,"resolve")*(victim._auraE||0)); // there are, the harder`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(P.data,d.o); fs.writeFileSync(P.combat,c.o);
console.log("patched — batch D: radius auras, one pass at 4Hz, holders only");
