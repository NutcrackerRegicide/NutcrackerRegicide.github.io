#!/usr/bin/env node
/* patch-smoketest-E.js — gate the procs and charges.
 *
 * THE RECURSION GUARD IS THE ASSERTION THAT MATTERS. Earthshaker's slam calls dealDamage on every
 * enemy in radius, and each of those calls re-enters the same block. Without `_volleyIn` a slam
 * splashes onto a neighbour, which slams, which splashes back — and with the proc forced the
 * recursion is unbounded. That is not a balance bug, it is a stack overflow in a live match, and
 * the only way to see it is to force every roll to succeed and put several bodies in range.
 *
 * The rest are paired discriminations, so none can pass vacuously:
 *   · ARROW WARD blocks a RANGED blow and must NOT block a melee one; IRON GUARD the reverse.
 *     Two buffs that both blocked everything would look identical in play and be wrong.
 *   · A block NEGATES — the victim takes nothing at all, not merely less.
 *   · The charge really is spent: a second blow inside the window lands in full.
 *   · Stacking shortens the cooldown, so ×3 is ready when ×1 is not.
 *   · RAPID VOLLEY lands THREE blows, which is measured by a per-hit effect firing three times
 *     rather than by the damage total — tripling the number would pass a total-damage test and
 *     silently break every per-hit buff in the game.
 */
const fs=require("fs"),path=require("path");
const F=path.join(__dirname,"smoketest.js");
let s=fs.readFileSync(F,"utf8");
let failed=[];
function sub(name,from,to){
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
}

sub("export batch E",
  `auraBuffTick,AURA_BR,AURA_SCAN,AURA_STILL,buildings,makeBuilding};";`,
  `auraBuffTick,AURA_BR,AURA_SCAN,AURA_STILL,buildings,makeBuilding,knifeTick,KNIFE_R,getT:()=>T};";`);

sub("batch E gate",
`    // ---- v132.35: BATCH D — radius auras ----`,
`      // ---- v132.36: BATCH E — procs and charges ----
      {
        const forceE=(fn)=>{const MR=Math.random;Math.random=()=>0;try{return fn();}finally{Math.random=MR;}};
        const EX=-196, EZ=-140;
        const put=(team,buffs,cls,dx,dz)=>{
          const u=G.makeUnit(team,cls||"clubman",EX+(dx||0),EZ+(dz||0),{name:"E",bot:{role:"citizen"}});
          u.bot=null; u.remote="e"+(dx||0)+"_"+(dz||0)+"_"+team; u.buffs=buffs||{}; u._tmods=null;
          G.setClassStats(u); u.hp=u.maxHp; return u;
        };
        // ---- THE RECURSION GUARD ----
        {
          const slam=put(0,{quake:1},"clubman",0,0);
          const mob=[];
          for(let i=0;i<6;i++)mob.push(put(1,{},"clubman",1+i*0.5,1));
          let ok=true, err="";
          try{ forceE(()=>dmgOf(slam,mob[0],5)); }catch(e){ ok=false; err=e.message; }
          check("v132.36 EARTHSHAKER: a forced slam with six bodies in range COMPLETES — without "+
            "the recursion guard each splash slams again and it is a stack overflow, not a "+
            "balance bug"+(ok?"":" ["+err+"]"),ok);
          const hurt=mob.filter(m=>m.hp<m.maxHp).length;
          check("v132.36 EARTHSHAKER: …and it splashed the crowd ("+hurt+" of "+mob.length+
            " wounded)",hurt>=2);
          for(const m of mob)m.alive=false;
          slam.alive=false;
        }
        // ---- ARROW WARD / IRON GUARD: the discrimination, and the negation ----
        {
          const warded=put(0,{ward:1},"clubman",0,20);
          const bow=put(1,{},"archer",2,20);
          const fist=put(1,{},"clubman",3,20);
          warded._wardT=-999; warded._guardT=-999;
          const h0=warded.hp; dmgOf(bow,warded,20);
          check("v132.36 ARROW WARD: a ranged blow is NEGATED, not reduced ("+h0.toFixed(1)+" → "+
            warded.hp.toFixed(1)+")",Math.abs(warded.hp-h0)<1e-9);
          const h1=warded.hp; dmgOf(bow,warded,20);
          check("v132.36 ARROW WARD: …the charge is SPENT — the next arrow lands in full ("+
            h1.toFixed(1)+" → "+warded.hp.toFixed(1)+")",warded.hp<h1);
          warded.hp=warded.maxHp;
          const h2=warded.hp; dmgOf(fist,warded,20);
          check("v132.36 ARROW WARD: …and it does NOT stop a MELEE blow ("+h2.toFixed(1)+" → "+
            warded.hp.toFixed(1)+")",warded.hp<h2);
          const ironed=put(0,{guardup:1},"clubman",0,25);
          ironed._wardT=-999; ironed._guardT=-999;
          const g0=ironed.hp; dmgOf(fist,ironed,20);
          check("v132.36 IRON GUARD: a melee blow is negated ("+g0.toFixed(1)+" → "+
            ironed.hp.toFixed(1)+")",Math.abs(ironed.hp-g0)<1e-9);
          const g1=ironed.hp; dmgOf(bow,ironed,20);
          check("v132.36 IRON GUARD: …and it does NOT stop an ARROW ("+g1.toFixed(1)+" → "+
            ironed.hp.toFixed(1)+")",ironed.hp<g1);
          // stacking shortens the cooldown
          const one=put(0,{ward:1},"clubman",0,30), three=put(0,{ward:3},"clubman",0,35);
          const now=G.getT();
          one._wardT=now-12; three._wardT=now-12;   // 12s ago: ×1 needs 30, ×3 needs 10
          const o0=one.hp; dmgOf(bow,one,20);
          const t0=three.hp; dmgOf(bow,three,20);
          check("v132.36 THE CHARGE: stacking shortens the cooldown — 12s after a block, x1 is "+
            "still spent ("+(one.hp<o0?"took the hit":"blocked")+") and x3 is ready ("+
            (Math.abs(three.hp-t0)<1e-9?"blocked":"took the hit")+")",
            one.hp<o0&&Math.abs(three.hp-t0)<1e-9);
          bow.alive=false; fist.alive=false; warded.alive=false; ironed.alive=false;
          one.alive=false; three.alive=false;
        }
        // ---- RAPID VOLLEY: three BLOWS, measured by a per-hit effect ----
        {
          // Bloodthirst heals 1 HP per landed hit — so the heal COUNTS the blows. A "triple
          // damage" implementation would pass a damage-total test and fail this one.
          const archer=put(0,{volley:1,leech:1},"archer",0,45);
          const tgt=put(1,{},"clubman",2,45);
          archer.hp=Math.max(1,archer.maxHp-10);
          archer._volleyT=-999;
          const a0=archer.hp;
          forceE(()=>dmgOf(archer,tgt,5));
          const healed=archer.hp-a0;
          check("v132.36 RAPID VOLLEY: THREE separate blows land, not one tripled — Bloodthirst "+
            "healed "+healed.toFixed(0)+" (one per hit)",healed>=3);
          archer.alive=false; tgt.alive=false;
        }
        // ---- KNIFE FIGHTER ----
        {
          const thrower=put(0,{knives:2},"clubman",0,60);
          const mark=put(1,{},"clubman",4,60);
          const m0=mark.hp;
          forceE(()=>{for(let i=0;i<3;i++)G.knifeTick(thrower,1.0);}); // past the 2s clock
          check("v132.36 KNIFE FIGHTER: the knife finds the nearest enemy in range ("+
            m0.toFixed(1)+" → "+mark.hp.toFixed(1)+")",mark.hp<m0);
          const far=put(1,{},"clubman",G.KNIFE_R+25,60);
          const f0=far.hp;
          forceE(()=>{for(let i=0;i<3;i++)G.knifeTick(thrower,1.0);});
          check("v132.36 KNIFE FIGHTER: …and never one beyond its "+G.KNIFE_R+"-unit reach ("+
            f0.toFixed(1)+" → "+far.hp.toFixed(1)+")",Math.abs(far.hp-f0)<1e-9);
          thrower.alive=false; mark.alive=false; far.alive=false;
        }
      }
    // ---- v132.35: BATCH D — radius auras ----`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — batch E gates");
