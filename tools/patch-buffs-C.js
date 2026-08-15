#!/usr/bin/env node
/* patch-buffs-C.js — v132.34 BATCH C: five buffs and ONE new idea — state on the ENEMY.
 *
 * SERRATED EDGE · VENOMOUS · CONCUSSIVE BLOW · DEEP GASH · SHRUG IT OFF
 *
 * ── IT REUSES THE BATCH B SYSTEM RATHER THAN INVENTING A SECOND ONE ─────────────────────────
 * Every one of these is "a thing that is true of a unit for N seconds", which is exactly what
 * `_tmods` already models. So a debuff is a tmod on the VICTIM instead of a buff on the attacker,
 * and four new kinds carry the lot:
 *     bleed / poison  — damage per second, applied host-side
 *     stun            — cannot move, cannot swing
 *     healblock       — cannot be healed
 * The SLOW needs no new kind at all: it is a NEGATIVE "spdmul", so 1+(−0.5) is half speed through
 * the multiplier that already exists.
 *
 * Two things fall out of that for free, and both would have been real work otherwise:
 *   · A slowed or stunned GUEST predicts it correctly, because tmodAdd already syncs to the owner
 *     (v132.33) and the guest already ticks its own clock. A debuff that only the host knew about
 *     would put the victim's own body ahead of the truth — the same class of bug .33 just fixed,
 *     but worse, because a stunned player would keep walking on their own screen.
 *   · Duration, refresh-not-duplicate, fade and expiry are all already gated.
 *
 * ── WHERE THE DAMAGE TICKS, AND WHY NOT WHERE YOU WOULD EXPECT ──────────────────────────────
 * `updateUnitCommon` looks like the obvious home — it already walks every unit every frame. It is
 * the WRONG one: 10-net.js:2057 calls it on the GUEST too, so a damage-over-time there would be
 * applied twice for one tick and applied by a peer that owns no damage at all. The host's own unit
 * loop (09-main.js) is host-only, so `statusTick` goes there.
 *   And `tmodTick` had to MOVE out of questTick at the same time. questTick walks humans only —
 * fine while modifiers were self-buffs, wrong the moment an enemy creep can be poisoned — and
 * leaving it there while also calling it from the unit loop would tick every human twice, halving
 * every duration in Batch B.
 *
 * ── THE STUN COOLDOWN IS ON THE ATTACKER ────────────────────────────────────────────────────
 * "5% chance, 30 second cooldown" is a limit on the WIELDER, not on the victim — otherwise one
 * player could stun-lock a crowd by rotating targets. `_stunCd` is stamped on the attacker.
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
subD("batch C buffs",
`  {id:"hunt",   name:"Hunter's Step",    desc:"(melee) +10% move speed for 2s when you land a blow",max:1}
];`,
`  {id:"hunt",   name:"Hunter's Step",    desc:"(melee) +10% move speed for 2s when you land a blow",max:1},
  // ---- v132.34 BATCH C: five that put state on the ENEMY ----
  {id:"bleed",  name:"Serrated Edge",   desc:"5% chance on hit to bleed an enemy for 20 HP over 20s",max:1},
  {id:"venom",  name:"Venomous",        desc:"5% chance on hit to poison — 10 HP and half speed over 10s",max:1},
  {id:"concuss",name:"Concussive Blow", desc:"(melee) 5% chance on hit to STUN, once every 30s",max:1},
  {id:"gash",   name:"Deep Gash",       desc:"your damage stops an enemy healing for 3s",     max:1},
  {id:"shrug",  name:"Shrug It Off",    desc:"10% chance when struck to shed every debuff",   max:1}
];`);

// ---------------- the status tick ----------------
subC("statusTick",
`function tmodTick(u,dt){`,
`// ---------- v132.34: the DEBUFF half of the timed system ----------
// Damage-over-time is applied HERE and only here, from the host's own unit loop. It deliberately
// does not live in updateUnitCommon: 10-net.js calls that on the guest too, and a guest owns no
// damage (05-combat.js returns early for exactly this reason).
const DOT_KINDS=["bleed","poison"];
function statusTick(u,dt){
  tmodTick(u,dt);
  if(!u.alive||!u._tmods)return;
  let dps=0;
  for(const k of DOT_KINDS)dps+=tmodSum(u,k);
  if(dps>0){
    u.hp-=dps*dt;
    if(u.bar&&typeof setBar==="function")setBar(u.bar,Math.max(0,u.hp/u.maxHp));
    if(Math.random()<dt*2)puff(u.root.position.x,1.7,u.root.position.z,
      tmodSum(u,"poison")>0?0x8fd45a:0xb3262a,0.5);
    if(u.hp<=0&&typeof killUnit==="function"){u.hp=0;killUnit(u,u._dotBy||null);}
    else if(u.isPlayer&&typeof updatePlayerHud==="function")updatePlayerHud();
  }
}
function isStunned(u){return !!(u&&u._tmods&&tmodSum(u,"stun")>0);}
function healBlocked(u){return !!(u&&u._tmods&&tmodSum(u,"healblock")>0);}
// SHRUG IT OFF sheds everything an enemy put on you — and nothing you earned yourself.
const DEBUFF_KINDS=["bleed","poison","stun","healblock"];
function shedDebuffs(u){
  if(!u||!u._tmods)return 0;
  let n=0;
  for(let i=u._tmods.length-1;i>=0;i--){
    const e=u._tmods[i];
    const bad=DEBUFF_KINDS.indexOf(e.k)>=0||(e.k==="spdmul"&&e.mag<0);
    if(bad){u._tmods.splice(i,1);n++;}
  }
  if(!u._tmods.length)u._tmods=null;
  if(n&&typeof tmodSyncClear==="function"&&u.remote)tmodSyncClear(u); // the owner's screen too
  return n;
}
function tmodTick(u,dt){`);

// ---------------- application, at the blow ----------------
subC("batch C procs",
`  // BRAMBLE MAIL: a melee attacker takes it back. att.hp is touched DIRECTLY — recursing into`,
`  // ---- v132.34 BATCH C: what the blow leaves BEHIND on the victim ----
  if(attU&&isHuman(attU)&&attU.team!==victim.team&&victim.alive){
    const melee=CLS[attU.cls]&&!CLS[attU.cls].ranged;
    const bl=buffSt(attU,"bleed");
    if(bl&&Math.random()<0.05*bl){                      // SERRATED EDGE — 1 HP/s for 20s = 20 HP
      tmodAdd(victim,"bleed",1,20,false); victim._dotBy=attU;
      puff(victim.root.position.x,2.0,victim.root.position.z,0xb3262a,0.7);
    }
    const vn=buffSt(attU,"venom");
    if(vn&&Math.random()<0.05*vn){                      // VENOMOUS — 10 HP over 10s, and half speed
      tmodAdd(victim,"poison",1,10,false); victim._dotBy=attU;
      tmodAdd(victim,"spdmul",-0.5,10,false);           // a NEGATIVE spdmul is the whole slow
      puff(victim.root.position.x,2.0,victim.root.position.z,0x8fd45a,0.8);
    }
    const cc=buffSt(attU,"concuss");
    if(cc&&melee&&T-(attU._stunCd||-999)>=30&&Math.random()<0.05*cc){
      attU._stunCd=T;                                   // the 30s belongs to the WIELDER, or one
      tmodAdd(victim,"stun",1,1.5,false);               // player stun-locks a crowd by rotating
      puff(victim.root.position.x,2.8,victim.root.position.z,0xffe9a8,1.1);
      if(typeof Sound!=="undefined")Sound.play("hit",{x:victim.root.position.x,z:victim.root.position.z});
    }
    if(buffSt(attU,"gash"))tmodAdd(victim,"healblock",1,3,false); // DEEP GASH
  }
  // SHRUG IT OFF: struck, and everything the enemy put on you falls away.
  if(isHuman(victim)&&victim._tmods&&buffSt(victim,"shrug")&&
     Math.random()<0.10*buffSt(victim,"shrug")){
    if(shedDebuffs(victim)&&victim.isPlayer&&typeof msg==="function")msg("You shrug it off!","blue");
  }
  // BRAMBLE MAIL: a melee attacker takes it back. att.hp is touched DIRECTLY — recursing into`);

// ---------------- stun blocks movement ----------------
subC("stun blocks movement",
`function moveUnit(u,dx,dz,dt){
  const len=Math.hypot(dx,dz);
  if(len<0.001)return false;`,
`function moveUnit(u,dx,dz,dt){
  if(u&&u._tmods&&typeof isStunned==="function"&&isStunned(u))return false; // v132.34 CONCUSSIVE BLOW
  const len=Math.hypot(dx,dz);
  if(len<0.001)return false;`);

// ---------------- the host loop drives it; questTick stops double-ticking ----------------
subM("statusTick in the host unit loop",
`      updateUnitCommon(u,dt);`,
`      updateUnitCommon(u,dt);
      // v132.34: the timed system ticks for EVERY unit here — host-only, once per frame. It used
      // to run inside questTick, which walks humans alone; a poisoned creep would never have
      // burned down. Ticking in both places would halve every duration in Batch B.
      if(typeof statusTick==="function")statusTick(u,dt);
      if(typeof isStunned==="function"&&isStunned(u))u.atkT=Math.max(u.atkT,tmodSum(u,"stun")>0?0.2:0);`);

subM("questTick no longer ticks",
`    if(typeof tmodTick==="function")tmodTick(u,dt); // v132.32: expire the timed self-modifiers`,
`    // v132.34: tmodTick MOVED to the host unit loop (statusTick) so debuffs reach non-humans.
    // Ticking here as well would run every human's clock twice a frame.`);

// ---------------- heal block ----------------
subM("heal block",
`    if(!u.alive||u.hp>=u.maxHp)continue;`,
`    if(!u.alive||u.hp>=u.maxHp)continue;
    if(typeof healBlocked==="function"&&healBlocked(u))continue; // v132.34 DEEP GASH`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(P.data,d.o); fs.writeFileSync(P.combat,c.o); fs.writeFileSync(P.main,m.o);
console.log("patched — batch C: debuffs on the enemy, riding the Batch B system");
