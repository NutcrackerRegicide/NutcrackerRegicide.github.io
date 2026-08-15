#!/usr/bin/env node
/* patch-buffs-A-combat.js — v132.30 BATCH A, the combat half: thirteen of the eighteen.
 *
 * All of these ride the existing attacker-side and victim-side buff blocks in dealDamage, or the
 * kill site. Every one is host-only by construction (dealDamage returns early on a guest).
 *
 * DECISIONS, each of which could have gone another way:
 *
 * · FIRST BLOOD reads `victim.hp>=victim.maxHp` in the ATTACKER block, which runs before
 *   `victim.hp-=dmg`. Read it after and it would never fire on the blow that breaks full health,
 *   which is the only blow it is about.
 *
 * · TROPHY HUNTER is a PERMANENT stat, and permanent stats are where this codebase loses things.
 *   `setClassStats` recomputes maxHp from the class table on every class change and respawn, and
 *   `applyBuffStats` recomputes it whenever a buff lands — so the bonus is stored as `u.hpBonus`
 *   and ADDED IN BOTH, or arming up at the barracks would silently delete it. It is wiped by the
 *   death wipe alongside the buffs, because it is a buff's earnings and death takes those.
 *
 * · CULLER executes below 15% — placed AFTER the dodge/shield block so a dodged blow cannot
 *   execute, and it works by setting hp to 0 rather than calling killUnit directly, so the normal
 *   kill path (loot, quests, participation, score) runs exactly once and unchanged.
 *
 * · WOODSMAN: there is no "in the woods" test in this game and scanning 674 wood nodes per hit
 *   would be absurd. `TREE_STANDS` is the answer — 25 circles with a radius, the same structures
 *   the v115 forest gates assert against. A 25-iteration loop, only for units holding the buff.
 *
 * · BRAMBLE MAIL touches `att.hp` DIRECTLY rather than recursing into dealDamage. Re-entering
 *   would re-run the whole modifier chain — including the victim's own thorns — and two units
 *   both wearing it would bounce a blow between them until the stack ran out.
 *
 * · KING'S GUARD and YEOMAN apply their HP half as a DAMAGE-REDUCTION multiplier, not as maxHp.
 *   applyBuffStats preserves the hp FRACTION across a recompute, so raising maxHp mid-fight
 *   silently heals the unit; a reduction multiplier is the same defensive value with none of that.
 *   (Yeoman's doubling is large enough that this matters more, not less.)
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
const P={combat:path.join(__dirname,"..","js","05-combat.js"),
         units:path.join(__dirname,"..","js","04-units.js"),
         main:path.join(__dirname,"..","js","09-main.js")};
const c={o:fs.readFileSync(P.combat,"utf8")}, u={o:fs.readFileSync(P.units,"utf8")},
      m={o:fs.readFileSync(P.main,"utf8")};
const subC=mk(c), subU=mk(u), subM=mk(m);

// ---------- attacker-side multipliers ----------
subC("attacker-side batch A",
`    const cs=buffSt(attU,"crit");                                  // KEEN EYE`,
`    if(victim.hp>=victim.maxHp)m*=1+0.50*buffSt(attU,"ambush");    // FIRST BLOOD — read BEFORE the hp subtraction below
    if(CLS[attU.cls]&&CLS[attU.cls].ranged&&victim.cls&&isSiege(victim.cls))
      m*=1+0.50*buffSt(attU,"enginebane");                         // ENGINEBANE
    if(attU.cls==="villager")m*=1+1.00*buffSt(attU,"yeoman");       // YEOMAN — the damage half
    if(buffSt(attU,"fervor")){                                     // DESPERATION is attack SPEED,
      // …handled in updateUnitCommon; nothing to do to damage here.
    }
    if(buffSt(attU,"woods")&&inTheWoods(attU))m*=1+0.10*buffSt(attU,"woods"); // WOODSMAN
    if(buffSt(attU,"kguard")&&nearOwnKing(attU))m*=1+0.10*buffSt(attU,"kguard"); // KING'S GUARD — damage half
    const cs=buffSt(attU,"crit");                                  // KEEN EYE`);

// ---------- victim-side ----------
subC("victim-side batch A",
`    dmg*=1-0.05*buffSt(victim,"shield");                           // RAISED SHIELD (the buff)
  }`,
`    dmg*=1-0.05*buffSt(victim,"shield");                           // RAISED SHIELD (the buff)
    if(att&&att.team===NEUTRAL)dmg*=1-0.10*buffSt(victim,"warden"); // BEAST WARDEN
    if(victim.cls==="villager")dmg*=Math.pow(0.5,buffSt(victim,"yeoman")); // YEOMAN — the health half,
      // as a reduction rather than a maxHp change: applyBuffStats preserves the hp FRACTION across a
      // recompute, so doubling maxHp mid-fight would silently heal the villager.
    if(buffSt(victim,"kguard")&&nearOwnKing(victim))dmg*=1-0.10*buffSt(victim,"kguard"); // KING'S GUARD
    if(buffSt(victim,"tribute")&&typeof stock!=="undefined"&&stock[victim.team]){         // BLOOD TAX
      stock[victim.team].gold+=1*buffSt(victim,"tribute");
      if(typeof updateResHud==="function")updateResHud();
    }
  }`);

// ---------- execute + thorns, after the hp subtraction ----------
subC("culler + thorns",
`  victim._lastHurt=T; // Second Skin waits for quiet
  victim.hp-=dmg; hitFlash(victim);`,
`  victim._lastHurt=T; // Second Skin waits for quiet
  victim.hp-=dmg; hitFlash(victim);
  // CULLER: finish a wounded beast outright. Sets hp to 0 rather than calling killUnit, so the
  // ordinary kill path below runs once and unchanged — loot, quests, participation and score all
  // stay on their single road.
  if(victim.team===NEUTRAL&&victim.hp>0&&attU&&buffSt(attU,"cull")&&
     victim.hp<victim.maxHp*0.15){
    victim.hp=0;
    puff(victim.root.position.x,1.8,victim.root.position.z,0xd8e070,1.2);
  }
  // BRAMBLE MAIL: a melee attacker takes it back. att.hp is touched DIRECTLY — recursing into
  // dealDamage would re-run every modifier including the attacker's own thorns, and two units
  // both wearing it would volley a blow back and forth.
  if(isHuman(victim)&&buffSt(victim,"thorns")&&att&&!att.def&&att.cls&&
     CLS[att.cls]&&!CLS[att.cls].ranged&&att.alive&&att.team!==victim.team){
    att.hp-=1*buffSt(victim,"thorns");
    if(att.hp<=0&&typeof killUnit==="function"){att.hp=0;killUnit(att,victim);}
  }`);

// ---------- the kill site ----------
subC("on-kill batch A",
`    awardPts(att,victim.cls==="villager"?10:costPts(CLS[victim.cls]&&CLS[victim.cls].cost)); // a kill is worth its cost; a villager, 10`,
`    // ---- v132.30 BATCH A: what a kill pays the killer ----
    if(attU&&isHuman(attU)&&attU.alive&&attU.team!==victim.team){
      const fe=buffSt(attU,"feast");                                  // SECOND WIND
      if(fe)attU.hp=Math.min(attU.maxHp,attU.hp+attU.maxHp*0.10*fe);
      const tr=buffSt(attU,"trophy");                                 // TROPHY HUNTER — permanent,
      if(tr){                                                         // and it must survive a recompute
        attU.hpBonus=Math.min(100,(attU.hpBonus||0)+1*tr);
        if(typeof applyBuffStats==="function")applyBuffStats(attU);
      }
      if(typeof stock!=="undefined"&&stock[attU.team]){
        const pu=buffSt(attU,"purse"), fo=buffSt(attU,"forage");      // CUTPURSE · SCAVENGER
        if(pu)stock[attU.team].gold+=10*pu;
        if(fo)stock[attU.team].food+=10*fo;
        if((pu||fo)&&typeof updateResHud==="function")updateResHud();
      }
    }
    awardPts(att,victim.cls==="villager"?10:costPts(CLS[victim.cls]&&CLS[victim.cls].cost)); // a kill is worth its cost; a villager, 10`);

// ---------- the two spatial helpers ----------
subC("spatial helpers",
`function puff(x,y,z,color,scale,life){`,
`// ---- v132.30 BATCH A helpers ----
// WOODSMAN. There is no "in the woods" test in this game and scanning 674 wood nodes per blow
// would be absurd. TREE_STANDS is 25 circles with a radius — the same structures the v115 forest
// gates assert against — so this is a 25-iteration loop, run only for a unit holding the buff.
function inTheWoods(u){
  if(typeof TREE_STANDS==="undefined"||!TREE_STANDS.length||!u||!u.root)return false;
  const x=u.root.position.x,z=u.root.position.z;
  for(const s of TREE_STANDS){
    const dx=x-s.x,dz=z-s.z;
    if(dx*dx+dz*dz<s.r*s.r)return true;
  }
  return false;
}
const KGUARD_R=18; // how close "near your King" is
function nearOwnKing(u){
  if(typeof kings==="undefined"||!u||!u.root)return false;
  const k=kings[u.team];
  if(!k||!k.alive||!k.root)return false;
  const dx=u.root.position.x-k.root.position.x, dz=u.root.position.z-k.root.position.z;
  return dx*dx+dz*dz<KGUARD_R*KGUARD_R;
}
function puff(x,y,z,color,scale,life){`);

// ---------- DESPERATION: the per-swing clock ----------
subM("desperation",
`  u.atkT=Math.max(0,u.atkT-dt);`,
`  // DESPERATION (v132.30): +0.5% attack speed per 1% of health missing. This scales the CLOCK,
  // not u.cd — u.cd is a STAT recomputed by applyBuffStats and cannot see live HP, and the
  // "u.atkT=u.cd" reset appears at ten separate call sites. One place, once.
  {
    const fv=buffSt(u,"fervor");
    let _sw=dt;
    if(fv&&u.maxHp>0&&u.hp<u.maxHp)_sw=dt*(1+0.5*fv*(1-u.hp/u.maxHp));
    u.atkT=Math.max(0,u.atkT-_sw);
  }`);

// ---------- TROPHY HUNTER must survive both recomputes ----------
subU("hpBonus in applyBuffStats",
`  u.maxHp=Math.round(d.hp*ageBuff(u.team)*(1+0.05*buffSt(u,"hp")));`,
`  u.maxHp=Math.round(d.hp*ageBuff(u.team)*(1+0.05*buffSt(u,"hp")))+(u.hpBonus||0); // +TROPHY HUNTER`);

subU("hpBonus in setClassStats",
`  u.maxHp=Math.round(d.hp*b); u.hp=u.maxHp;`,
`  // v132.30: +(u.hpBonus||0) is TROPHY HUNTER, which must survive a class change.\n  u.maxHp=Math.round(d.hp*b)+(u.hpBonus||0); u.hp=u.maxHp;`);

// ---------- and it dies with the rest ----------
subC("wipe hpBonus on death",
`    u._rrCycle=false; // v132.28.2: re-arm the reroll grant, or a player who died QUESTLESS would`,
`    u.hpBonus=0;      // v132.30: TROPHY HUNTER is a buff's earnings — death takes it with the buffs
    u._rrCycle=false; // v132.28.2: re-arm the reroll grant, or a player who died QUESTLESS would`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(P.combat,c.o); fs.writeFileSync(P.units,u.o); fs.writeFileSync(P.main,m.o);
console.log("patched — batch A combat hooks (13 of 18)");
