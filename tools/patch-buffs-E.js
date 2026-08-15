#!/usr/bin/env node
/* patch-buffs-E.js — v132.36 BATCH E, the last one: five buffs, procs and charges.
 *
 * EARTHSHAKER · KNIFE FIGHTER · RAPID VOLLEY · ARROW WARD · IRON GUARD
 *
 * This completes John's CSV: 39 new buffs across five batches, 60 in the forge.
 *
 * ── CHARGES ARE A COOLDOWN, NOT A COUNTER ───────────────────────────────────────────────────
 * "Block one projectile every 30 seconds" is naturally read as a stored charge, but a counter
 * needs a refill tick and a cap and somewhere to live. A LAST-USED STAMP says the same thing in
 * one field: ready when T − stamp ≥ the cooldown. Stacking shortens the cooldown rather than
 * granting parallel charges (30 / stacks), so ×3 is a block every ten seconds — the same power
 * curve without a second mechanism.
 *
 * ── THE TWO BLOCKS NEGATE, THEY DO NOT REDUCE ───────────────────────────────────────────────
 * They return out of dealDamage exactly as SIXTH SENSE's dodge does, and they sit right beside it
 * for that reason. A "block" that merely subtracts would be a worse Raised Shield; a block that
 * cancels the blow is a different thing, and it is the thing John wrote down.
 *   ⚠ They are checked BEFORE the shield/warden multipliers so a blocked blow costs no charge
 *   accounting elsewhere, and AFTER the dodge so two evasions cannot both fire on one blow.
 *
 * ── RAPID VOLLEY IS THREE BLOWS, NOT TRIPLE DAMAGE ──────────────────────────────────────────
 * Tripling the number would be simpler and wrong: the buffs already in the game read the BLOW
 * (Bloodthirst heals per hit, Serrated Edge rolls per hit, Bramble Mail answers per hit). Three
 * separate applications keep every one of those honest. It re-enters dealDamage, so `_volleyIn`
 * guards the recursion — without it the extra shots would each roll their own volley.
 *
 * ── EARTHSHAKER USES THE AURA RADIUS ────────────────────────────────────────────────────────
 * Rather than inventing a third idea of "near", it borrows AURA_BR. One number, one meaning.
 *
 * ── THE KNIFE IS NOT A PROJECTILE ───────────────────────────────────────────────────────────
 * A real flying knife would need a projectile kind, a mesh, a travel path and lag compensation —
 * a Batch F, not a line. It resolves instantly against the nearest enemy in range with a puff
 * along the line, which is honest about what it is. If it should actually fly, that is a
 * deliberate follow-up and not a small one.
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

subD("batch E buffs",
`  {id:"steward",name:"Steward",         desc:"(villager) mend nearby friendly buildings, 0.5 HP a second",max:1}
];`,
`  {id:"steward",name:"Steward",         desc:"(villager) mend nearby friendly buildings, 0.5 HP a second",max:1},
  // ---- v132.36 BATCH E: procs and charges — the last of John's CSV ----
  {id:"quake",  name:"Earthshaker",     desc:"(melee) 5% chance on hit to slam the ground for area damage",max:1},
  {id:"knives", name:"Knife Fighter",   desc:"10% chance every 2s to hurl a knife at a nearby enemy",max:2},
  {id:"volley", name:"Rapid Volley",    desc:"(ranged) 5% chance to loose THREE shots, once every 10s",max:1},
  {id:"ward",   name:"Arrow Ward",      desc:"block one ranged attack every 30s (faster per stack)",max:3},
  {id:"guardup",name:"Iron Guard",      desc:"block one melee attack every 30s (faster per stack)",  max:3}
];`);

// ---------------- the two blocks, beside the dodge ----------------
subC("arrow ward + iron guard",
`    dmg*=1-0.05*buffSt(victim,"shield");                           // RAISED SHIELD (the buff)`,
`    // ---- v132.36 THE CHARGES. A last-used STAMP is the whole mechanism: ready when enough time
    // has passed. Stacking shortens the cooldown (30/stacks) rather than granting parallel
    // charges, which is the same curve without a second system. Placed AFTER the dodge so two
    // evasions cannot both fire on one blow, and BEFORE the multipliers because a blocked blow
    // is cancelled, not reduced.
    {
      const rangedBlow=!!(att&&(att.def||(att.cls&&CLS[att.cls]&&CLS[att.cls].ranged)));
      const wd=buffSt(victim,"ward"), gd=buffSt(victim,"guardup");
      if(rangedBlow&&wd&&T-(victim._wardT||-999)>=30/wd){
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
      }
    }
    dmg*=1-0.05*buffSt(victim,"shield");                           // RAISED SHIELD (the buff)`);

// ---------------- earthshaker + rapid volley, at the blow ----------------
subC("quake + volley",
`  // ---- v132.34 BATCH C: what the blow leaves BEHIND on the victim ----`,
`  // ---- v132.36 BATCH E: EARTHSHAKER and RAPID VOLLEY ----
  if(attU&&isHuman(attU)&&attU.team!==victim.team&&!_volleyIn){
    const meleeE=CLS[attU.cls]&&!CLS[attU.cls].ranged;
    const qk=buffSt(attU,"quake");
    if(qk&&meleeE&&Math.random()<0.05*qk){                 // EARTHSHAKER — borrows AURA_BR rather
      const R=(typeof AURA_BR!=="undefined"?AURA_BR:10);   // than inventing a third idea of "near"
      const R2=R*R, px=attU.root.position.x, pz=attU.root.position.z;
      puff(px,0.6,pz,0xc9a06a,2.2);
      for(const o of units){
        if(!o.alive||o===attU||o===victim||o.team===attU.team)continue;
        const dx=o.root.position.x-px, dz=o.root.position.z-pz;
        if(dx*dx+dz*dz>R2)continue;
        _volleyIn=true; dealDamage(attU,o,(attU.dmg||5)*0.5*qk); _volleyIn=false;
      }
    }
    const vo=buffSt(attU,"volley");
    if(vo&&!meleeE&&T-(attU._volleyT||-999)>=10&&Math.random()<0.05*vo){
      attU._volleyT=T;                                     // RAPID VOLLEY — THREE BLOWS, not triple
      _volleyIn=true;                                      // damage, so per-hit buffs stay honest
      for(let k=0;k<2&&victim.alive;k++)dealDamage(attU,victim,dmg);
      _volleyIn=false;
      if(attU.isPlayer&&typeof msg==="function")msg("Rapid volley!","gold");
    }
  }
  // ---- v132.34 BATCH C: what the blow leaves BEHIND on the victim ----`);

// ---------------- the recursion guard + the knife tick ----------------
subC("volley guard + knife",
`// ---------- v132.35 RADIUS AURAS ----------`,
`// v132.36: RAPID VOLLEY and EARTHSHAKER both re-enter dealDamage. Without this the extra shots
// would each roll their own volley and the slam would chain off its own splash.
let _volleyIn=false;
// KNIFE FIGHTER. Its own 2-second clock, holders only, host-side. It is NOT a flying projectile:
// that would need a projectile kind, a mesh, a travel path and lag compensation. It resolves
// against the nearest enemy in range with a puff along the line, which is honest about what it is.
const KNIFE_R=14, KNIFE_EVERY=2;
function knifeTick(u,dt){
  const st=(typeof buffSt==="function")?buffSt(u,"knives"):0;
  if(!st||!u.alive)return;
  u._knifeT=(u._knifeT||0)+dt;
  if(u._knifeT<KNIFE_EVERY)return;
  u._knifeT=0;
  if(Math.random()>=0.10*st)return;
  const px=u.root.position.x, pz=u.root.position.z, R2=KNIFE_R*KNIFE_R;
  let best=null,bd=R2;
  for(const o of units){
    if(!o.alive||o.team===u.team||o.team===undefined)continue;
    const dx=o.root.position.x-px, dz=o.root.position.z-pz;
    const d2=dx*dx+dz*dz;
    if(d2<bd){bd=d2;best=o;}
  }
  if(!best)return;
  for(let k=1;k<=3;k++)                                   // a line of puffs stands in for the flight
    puff(px+(best.root.position.x-px)*k/4,1.6,pz+(best.root.position.z-pz)*k/4,0xd8dde2,0.35);
  dealDamage(u,best,(u.dmg||5)*0.6*st);
}
// ---------- v132.35 RADIUS AURAS ----------`);

subC("drive knifeTick",
`  if(typeof auraBuffTick==="function")auraBuffTick(u,dt); // v132.35 radius auras — holders only`,
`  if(typeof auraBuffTick==="function")auraBuffTick(u,dt); // v132.35 radius auras — holders only
  if(typeof knifeTick==="function"&&isHuman(u))knifeTick(u,dt); // v132.36 KNIFE FIGHTER`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(P.data,d.o); fs.writeFileSync(P.combat,c.o);
console.log("patched — batch E: procs and charges. John's CSV is complete.");
