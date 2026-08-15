#!/usr/bin/env node
/* patch-buffs-B.js — v132.32 BATCH B: five buffs and ONE new system — timed self-modifiers.
 *
 * KILLING FRENZY · BLOODRUSH · SURVIVAL INSTINCT · LONG STRIDER · HUNTER'S STEP
 *
 * ── THE SYSTEM ──────────────────────────────────────────────────────────────────────────────
 * Batch A could hook existing code because every one of its buffs answered "what happens right
 * now". These five answer "and for the next N seconds", which nothing in this game could express.
 * `u._tmods` is a small array of {k, mag, t, dur, fade} — one entry per KIND, refreshed rather
 * than duplicated, so a player killing five things in a row does not accumulate five timers.
 *
 * Two accessors because the two shapes compose differently:
 *   · tmodSum — ADDITIVE, for flat damage. Two sources add.
 *   · tmodMul — MULTIPLICATIVE, for move speed. Two sources compound rather than summing past
 *     the point of absurdity; +50% and +40% is ×2.1, not +90% of a base that other buffs also
 *     touch.
 * `fade:true` scales the magnitude by the fraction of life remaining, which is what "fading over
 * 2 seconds" means and what a plain expiry cannot express.
 *
 * ── WHERE IT TICKS ──────────────────────────────────────────────────────────────────────────
 * questTick. It already walks exactly `isHuman(u) && u.alive` every frame, host-only, and these
 * are host-authoritative like every other buff (dealDamage returns early on a guest). A guest's
 * local movement PREDICTION will not include a speed modifier — position is host-authoritative
 * and the snapshot corrects it, so the cost is a hair of prediction error on the buffed player's
 * own screen, not a desync.
 *
 * ── LONG STRIDER IS NOT A TIMER ─────────────────────────────────────────────────────────────
 * "Leaving combat boosts move speed" is a STATE, not a duration: it is true whenever you have not
 * been hit recently. It reads `u._lastHurt`, the field Second Skin already uses, at the same 5s
 * threshold — one definition of "out of combat" in the game rather than two that drift.
 *
 * ── SURVIVAL INSTINCT NEEDS A LATCH ─────────────────────────────────────────────────────────
 * "Falling below 25%" is an EDGE, not a level. Without a latch it would re-arm on every single
 * blow landed while under a quarter health, which is a permanent speed buff wearing a trigger's
 * clothing. `_lowLatch` is set on the crossing and cleared in the per-frame tick once the unit is
 * back above the line — cleared THERE and not in dealDamage, because healing back up never calls
 * dealDamage and the latch would stick for the rest of the life.
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
         combat:path.join(__dirname,"..","js","05-combat.js"),
         main:path.join(__dirname,"..","js","09-main.js")};
const d={o:fs.readFileSync(P.data,"utf8")}, c={o:fs.readFileSync(P.combat,"utf8")},
      m={o:fs.readFileSync(P.main,"utf8")};
const subD=mk(d), subC=mk(c), subM=mk(m);

// ---------------- the table ----------------
subD("batch B buffs",
`  {id:"kguard", name:"King's Guard",     desc:"+10% damage and −10% damage taken near your King",max:1}
];`,
`  {id:"kguard", name:"King's Guard",     desc:"+10% damage and −10% damage taken near your King",max:1},
  // ---- v132.32 BATCH B: five that need the timed-modifier system ----
  {id:"frenzy", name:"Killing Frenzy",   desc:"+2 damage per kill, to +10, for 7s",          max:1},
  {id:"surge",  name:"Bloodrush",        desc:"+50% move speed on a kill, fading over 2s",   max:1},
  {id:"flight", name:"Survival Instinct",desc:"+40% move speed for 5s when you drop below 25% HP",max:1},
  {id:"stride", name:"Long Strider",     desc:"+30% move speed while out of combat",         max:1},
  {id:"hunt",   name:"Hunter's Step",    desc:"(melee) +10% move speed for 2s when you land a blow",max:1}
];`);

// ---------------- the system ----------------
subC("tmod system",
`// ---- v132.30 BATCH A helpers ----`,
`// ---------- v132.32 TIMED SELF-MODIFIERS ----------
// One entry per KIND, refreshed rather than duplicated — five kills in a row must not leave five
// timers behind. \`fade\` scales the magnitude by the life remaining, which is what "fading over
// two seconds" means and what a plain expiry cannot say.
const TMOD_OOC=5;      // seconds unhit before LONG STRIDER opens up — the same threshold, and the
                       // same field, Second Skin already uses, so the game has ONE definition of
                       // "out of combat" rather than two that drift apart.
const TMOD_LOW=0.25;   // the SURVIVAL INSTINCT line
function tmodAdd(u,k,mag,dur,fade,cap){
  if(!u)return;
  if(!u._tmods)u._tmods=[];
  for(const e of u._tmods){
    if(e.k!==k)continue;
    e.mag=cap?Math.min(cap,e.mag+mag):Math.max(e.mag,mag);   // accumulate to a cap, or refresh
    e.t=dur; e.dur=dur; e.fade=!!fade;
    return;
  }
  u._tmods.push({k:k,mag:mag,t:dur,dur:dur,fade:!!fade});
}
function tmodSum(u,k){ // ADDITIVE kinds (flat damage): two sources add
  const a=u&&u._tmods; if(!a)return 0;
  let s=0;
  for(const e of a)if(e.k===k)s+=e.fade?e.mag*(e.t/e.dur):e.mag;
  return s;
}
function tmodMul(u,k){ // MULTIPLICATIVE kinds (move speed): two sources compound
  const a=u&&u._tmods; if(!a)return 1;
  let m=1;
  for(const e of a)if(e.k===k)m*=1+(e.fade?e.mag*(e.t/e.dur):e.mag);
  return m;
}
function tmodTick(u,dt){
  const a=u&&u._tmods;
  if(a&&a.length){
    for(let i=a.length-1;i>=0;i--){a[i].t-=dt;if(a[i].t<=0)a.splice(i,1);}
    if(!a.length)u._tmods=null;
  }
  // SURVIVAL INSTINCT's latch is released HERE and not in dealDamage: healing back over the line
  // never calls dealDamage, so a latch cleared there would stick for the rest of the life.
  if(u._lowLatch&&u.maxHp>0&&u.hp>=u.maxHp*TMOD_LOW)u._lowLatch=false;
}
// ---- v132.30 BATCH A helpers ----`);

// ---------------- KILLING FRENZY: flat damage, before the multipliers ----------------
subC("frenzy damage",
`    let m=1+0.05*buffSt(attU,"dmg");                               // HONED EDGE`,
`    if(attU._tmods)dmg+=tmodSum(attU,"dmgflat");                   // KILLING FRENZY — flat, and
                                                                   // added before the multipliers
                                                                   // so a crit doubles it too
    let m=1+0.05*buffSt(attU,"dmg");                               // HONED EDGE`);

// ---------------- SURVIVAL INSTINCT + HUNTER'S STEP, at the blow ----------------
subC("flight + hunt",
`  // BRAMBLE MAIL: a melee attacker takes it back. att.hp is touched DIRECTLY — recursing into`,
`  // SURVIVAL INSTINCT: an EDGE, not a level. The latch stops it re-arming on every blow landed
  // while already under a quarter health, which would be a permanent speed buff in disguise.
  if(isHuman(victim)&&victim.alive&&buffSt(victim,"flight")&&victim.maxHp>0&&
     victim.hp>0&&victim.hp<victim.maxHp*TMOD_LOW&&!victim._lowLatch){
    victim._lowLatch=true;
    tmodAdd(victim,"spdmul",0.40*buffSt(victim,"flight"),5,false);
  }
  // HUNTER'S STEP: a landed MELEE blow quickens the step.
  if(attU&&isHuman(attU)&&buffSt(attU,"hunt")&&CLS[attU.cls]&&!CLS[attU.cls].ranged&&
     attU.team!==victim.team){
    tmodAdd(attU,"spdmul",0.10*buffSt(attU,"hunt"),2,false);
  }
  // BRAMBLE MAIL: a melee attacker takes it back. att.hp is touched DIRECTLY — recursing into`);

// ---------------- KILLING FRENZY + BLOODRUSH, on the kill ----------------
subC("frenzy + surge on kill",
`      const tr=buffSt(attU,"trophy");                                 // TROPHY HUNTER — permanent,`,
`      const fr=buffSt(attU,"frenzy");                                 // KILLING FRENZY
      if(fr)tmodAdd(attU,"dmgflat",2*fr,7,false,10*fr);                // +2 a kill, capped at +10
      const su=buffSt(attU,"surge");                                   // BLOODRUSH
      if(su)tmodAdd(attU,"spdmul",0.50*su,2,true);                     // …and it FADES over the 2s
      const tr=buffSt(attU,"trophy");                                 // TROPHY HUNTER — permanent,`);

// ---------------- movement ----------------
subC("speed modifiers in moveUnit",
`  let _spd=u.spd;
  const _mu=(typeof buffSt==="function")?buffSt(u,"mule"):0;`,
`  let _spd=u.spd;
  // v132.32: the timed speed modifiers (BLOODRUSH, SURVIVAL INSTINCT, HUNTER'S STEP) compound
  // here, and LONG STRIDER rides the same line as a STATE rather than a timer.
  if(u._tmods)_spd*=tmodMul(u,"spdmul");
  if(typeof buffSt==="function"&&buffSt(u,"stride")&&
     typeof T!=="undefined"&&T-(u._lastHurt||-99)>TMOD_OOC)
    _spd*=1+0.30*buffSt(u,"stride");
  const _mu=(typeof buffSt==="function")?buffSt(u,"mule"):0;`);

// ---------------- the tick ----------------
subM("tmodTick in questTick",
`  for(const u of units){
    if(!isHuman(u)||!u.alive)continue;
    // ---- v132.28.2 ONE REROLL PER QUEST OPPORTUNITY, capped at QUEST_REROLL_MAX ----`,
`  for(const u of units){
    if(!isHuman(u)||!u.alive)continue;
    if(typeof tmodTick==="function")tmodTick(u,dt); // v132.32: expire the timed self-modifiers
    // ---- v132.28.2 ONE REROLL PER QUEST OPPORTUNITY, capped at QUEST_REROLL_MAX ----`);

// ---------------- death clears them ----------------
subC("wipe tmods on death",
`    u.hpBonus=0;      // v132.30: TROPHY HUNTER is a buff's earnings — death takes it with the buffs`,
`    u.hpBonus=0;      // v132.30: TROPHY HUNTER is a buff's earnings — death takes it with the buffs
    u._tmods=null; u._lowLatch=false; // v132.32: and the timed modifiers die with the body`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(P.data,d.o); fs.writeFileSync(P.combat,c.o); fs.writeFileSync(P.main,m.o);
console.log("patched — batch B: the timed-modifier system and its five buffs");
