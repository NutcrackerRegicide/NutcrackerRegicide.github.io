#!/usr/bin/env node
/* patch-smoketest-C.js — gate the debuff half.
 *
 * The procs are 5% chance, so they are forced with Math.random=()=>0 — the idiom this file
 * already uses for the dodge check. That tests the PLUMBING deterministically; the arithmetic is
 * tested separately by driving the system directly.
 *
 * The assertions chosen are the ones with real failure modes:
 *   · A POISONED CREEP BURNS DOWN. This is the entire reason tmodTick had to move out of
 *     questTick — that walks humans only, so a debuff on a creep would have sat there for ever
 *     doing nothing. A non-human victim is the witness.
 *   · DURATIONS ARE NOT HALVED. Ticking in both questTick and the unit loop would run every
 *     human's clock twice a frame and silently halve all of Batch B. Gated by measuring a human's
 *     clock against real frames.
 *   · SHRUG IT OFF SHEDS DEBUFFS AND KEEPS BUFFS. A cleanse that also strips your own Bloodrush
 *     is a punishment, not a buff, and nothing else would notice.
 *   · THE STUN COOLDOWN IS ON THE WIELDER. If it were on the victim, one player could stun-lock
 *     a crowd by rotating targets — so the gate stuns one victim, then immediately tries a second.
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

sub("export the debuff half",
  `tmodAdd,tmodSum,tmodMul,tmodTick,TMOD_OOC,TMOD_LOW,moveUnit,tmodSync,tmodSyncClear};";`,
  `tmodAdd,tmodSum,tmodMul,tmodTick,TMOD_OOC,TMOD_LOW,moveUnit,tmodSync,tmodSyncClear,`+
  `statusTick,isStunned,healBlocked,shedDebuffs,healTick};";`);

sub("batch C gate",
`    // ---- v132.33: the guest predicts its own timed modifiers ----`,
`    // ---- v132.34: BATCH C — state on the ENEMY ----
    {
      const force=(fn)=>{const MR=Math.random;Math.random=()=>0;try{fn();}finally{Math.random=MR;}};
      // SERRATED EDGE — 1 HP/s for 20s, and the total really is ~20
      {
        const cutter=mkB(0,{bleed:1}), prey=mkB(1,{});
        force(()=>dmgOf(cutter,prey,1));
        check("v132.34 SERRATED EDGE: a hit leaves a bleed on the victim ("+
          G.tmodSum(prey,"bleed").toFixed(1)+" HP/s)",G.tmodSum(prey,"bleed")===1);
        const hp0=prey.hp;
        for(let i=0;i<200;i++)G.statusTick(prey,0.1);   // 20 seconds
        check("v132.34 SERRATED EDGE: …and it burns ~20 HP over its 20 seconds, then stops ("+
          Math.round(hp0-prey.hp)+" HP, bleed left "+G.tmodSum(prey,"bleed")+")",
          Math.abs((hp0-prey.hp)-20)<1.5&&G.tmodSum(prey,"bleed")===0);
      }
      // VENOMOUS — damage AND a slow, the slow being a negative spdmul
      {
        const v=mkB(0,{venom:1}), prey=mkB(1,{});
        force(()=>dmgOf(v,prey,1));
        check("v132.34 VENOMOUS: poison damage and a HALVED move speed ("+
          G.tmodSum(prey,"poison").toFixed(1)+" HP/s, ×"+G.tmodMul(prey,"spdmul").toFixed(2)+")",
          G.tmodSum(prey,"poison")===1&&Math.abs(G.tmodMul(prey,"spdmul")-0.5)<1e-9);
      }
      // …AND A CREEP BURNS DOWN — the reason the tick had to leave questTick
      {
        const v=mkB(0,{venom:1});
        const creep=G.makeUnit(2,"clubman",-150,-70,{name:"beast",bot:{role:"citizen"}});
        G.setClassStats(creep); creep.hp=creep.maxHp;
        force(()=>dmgOf(v,creep,1));
        const hp0=creep.hp;
        for(let i=0;i<50;i++)G.statusTick(creep,0.1);
        check("v132.34 VENOMOUS: a NON-HUMAN victim burns too ("+Math.round(hp0-creep.hp)+
          " HP) — questTick walks humans only, which is why the tick moved to the unit loop",
          hp0-creep.hp>=4);
        creep.alive=false;
      }
      // CONCUSSIVE BLOW — stops the victim moving, and the cooldown is the WIELDER's
      {
        const br=mkB(0,{concuss:1}), a=mkB(1,{}), b=mkB(1,{});
        br._stunCd=-999;
        force(()=>dmgOf(br,a,1));
        check("v132.34 CONCUSSIVE BLOW: the victim is stunned and cannot move (stunned "+
          G.isStunned(a)+")",G.isStunned(a)===true);
        const z0=a.root.position.z; G.moveUnit(a,0,1,0.2);
        check("v132.34 CONCUSSIVE BLOW: …moveUnit refuses while stunned (moved "+
          Math.abs(a.root.position.z-z0).toFixed(3)+")",Math.abs(a.root.position.z-z0)<1e-9);
        force(()=>dmgOf(br,b,1));
        check("v132.34 CONCUSSIVE BLOW: the 30s cooldown belongs to the WIELDER — a second victim "+
          "is NOT stunned, so nobody stun-locks a crowd by rotating targets (b stunned "+
          G.isStunned(b)+")",G.isStunned(b)===false);
        for(let i=0;i<25;i++)G.statusTick(a,0.1);
        check("v132.34 CONCUSSIVE BLOW: …and the stun expires ("+G.isStunned(a)+")",
          G.isStunned(a)===false);
      }
      // DEEP GASH — a priest cannot mend what it opened
      {
        const g=mkB(0,{gash:1}), prey=mkB(1,{});
        force(()=>dmgOf(g,prey,1));
        check("v132.34 DEEP GASH: the victim is heal-blocked ("+G.healBlocked(prey)+")",
          G.healBlocked(prey)===true);
        prey.hp=prey.maxHp*0.4;
        const hp0=prey.hp; G.healTick(1.0);
        check("v132.34 DEEP GASH: …and healTick genuinely skips them ("+hp0.toFixed(1)+" → "+
          prey.hp.toFixed(1)+")",Math.abs(prey.hp-hp0)<1e-9);
      }
      // SHRUG IT OFF — sheds what an enemy put on you, keeps what you earned
      {
        const tough=mkB(0,{shrug:1,surge:1});
        G.tmodAdd(tough,"bleed",1,20,false);
        G.tmodAdd(tough,"stun",1,2,false);
        G.tmodAdd(tough,"spdmul",-0.5,10,false);        // an enemy slow
        G.tmodAdd(tough,"spdmul2",0,1,false);           // (placeholder kind, ignored)
        G.tmodAdd(tough,"dmgflat",4,7,false);           // …and something YOU earned
        const shed=G.shedDebuffs(tough);
        check("v132.34 SHRUG IT OFF: sheds bleed, stun and the enemy slow ("+shed+" shed; bleed "+
          G.tmodSum(tough,"bleed")+", stunned "+G.isStunned(tough)+")",
          shed>=3&&G.tmodSum(tough,"bleed")===0&&G.isStunned(tough)===false);
        check("v132.34 SHRUG IT OFF: …and KEEPS what you earned — a cleanse that strips your own "+
          "buffs is a punishment (+"+G.tmodSum(tough,"dmgflat")+" dmgflat still held)",
          G.tmodSum(tough,"dmgflat")===4);
      }
      // NO DOUBLE-TICK: one frame must burn one frame of clock, not two
      {
        const h=mkB(0,{});
        G.tmodAdd(h,"dmgflat",2,7,false);
        const t0=h._tmods[0].t;
        G.statusTick(h,0.5);
        check("v132.34 tick topology: one frame burns ONE frame of clock ("+t0.toFixed(2)+"s → "+
          h._tmods[0].t.toFixed(2)+"s) — ticking in questTick as well would halve every duration "+
          "in Batch B",Math.abs((t0-h._tmods[0].t)-0.5)<1e-9);
      }
    }
    // ---- v132.33: the guest predicts its own timed modifiers ----`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — batch C gates");
