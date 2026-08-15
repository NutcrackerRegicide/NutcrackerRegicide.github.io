#!/usr/bin/env node
/* patch-smoketest-B.js — gate the timed-modifier system and its five buffs.
 *
 * The system carries three properties that, if broken, turn a TIMED buff into a PERMANENT one —
 * which is the failure mode that would never look like a bug in play, only like the game being
 * slightly too generous. Each gets its own assertion:
 *
 *   · EXPIRY — a modifier must actually leave. Ticked past its duration, it is gone.
 *   · REFRESH, NOT DUPLICATE — five kills in a row must leave ONE entry, not five. Five stacked
 *     timers would each expire separately and the effect would outlive its duration many times
 *     over.
 *   · THE LATCH — Survival Instinct fires on CROSSING below a quarter health. Without the latch
 *     it re-arms on every blow landed while already under the line, which is a permanent speed
 *     buff wearing a trigger's clothing. Gated by hitting a low-health unit repeatedly and
 *     asserting the modifier does NOT refresh.
 *
 * And the latch RELEASE is gated too, because a latch that never clears is the mirror bug: the
 * buff would fire once per life and never again.
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

sub("export the tmod system",
  `bldCost,bldCostD,isDefensiveDef,canAfford,pay,BLD};";`,
  `bldCost,bldCostD,isDefensiveDef,canAfford,pay,BLD,`+
  `tmodAdd,tmodSum,tmodMul,tmodTick,TMOD_OOC,TMOD_LOW,moveUnit};";`);

sub("batch B gate",
`  // ---------- v132.29: THE LEVEL AURA ----------`,
`  // ---------- v132.32: BATCH B — the timed-modifier system ----------
  {
    const G=global.__G, dmgOf=G.dealDamage;
    const _mB=G.NET.mode; G.NET.mode="host"; G.setGameOver(false);
    let BX=-150, BZ=-95;
    const mkB=(team,buffs,cls)=>{
      BX+=3;
      const v=G.makeUnit(team,cls||"clubman",BX,BZ,{name:"TB",bot:{role:"citizen"}});
      v.bot=null; v.remote="tb"+BX; v.buffs=buffs||{}; v._tmods=null; v._lowLatch=false;
      G.setClassStats(v); v.hp=v.maxHp; return v;
    };
    // ---- the system itself ----
    {
      const u=mkB(0,{});
      G.tmodAdd(u,"spdmul",0.5,2,false);
      check("v132.32 tmod: a modifier is live while its clock runs ("+G.tmodMul(u,"spdmul").toFixed(2)+"×)",
        Math.abs(G.tmodMul(u,"spdmul")-1.5)<1e-9);
      G.tmodTick(u,3);
      check("v132.32 tmod: …and it EXPIRES — ticked past its duration it is gone ("+
        G.tmodMul(u,"spdmul").toFixed(2)+"×, entries "+((u._tmods&&u._tmods.length)||0)+")",
        Math.abs(G.tmodMul(u,"spdmul")-1)<1e-9&&!u._tmods);
      // REFRESH, NOT DUPLICATE
      for(let k=0;k<5;k++)G.tmodAdd(u,"spdmul",0.5,2,false);
      check("v132.32 tmod: five applications leave ONE entry, refreshed — not five timers ("+
        u._tmods.length+")",u._tmods.length===1);
      // FADE
      const f=mkB(0,{});
      G.tmodAdd(f,"spdmul",1.0,2,true);
      const at0=G.tmodMul(f,"spdmul"); G.tmodTick(f,1); const at1=G.tmodMul(f,"spdmul");
      check("v132.32 tmod: a FADING modifier decays with its clock ("+at0.toFixed(2)+"× → "+
        at1.toFixed(2)+"×)",at0>at1&&at1>1);
      // a CAP that accumulates
      const cp=mkB(0,{});
      for(let k=0;k<12;k++)G.tmodAdd(cp,"dmgflat",2,7,false,10);
      check("v132.32 tmod: an accumulating modifier stops at its cap (+"+G.tmodSum(cp,"dmgflat")+")",
        G.tmodSum(cp,"dmgflat")===10);
    }
    // ---- KILLING FRENZY ----
    {
      const k1=mkB(0,{frenzy:1});
      const p1=mkB(1,{}); dmgOf(k1,p1,99999);
      check("v132.32 KILLING FRENZY: a kill grants +2 flat damage (+"+G.tmodSum(k1,"dmgflat")+")",
        G.tmodSum(k1,"dmgflat")===2);
      for(let k=0;k<8;k++){const p=mkB(1,{});dmgOf(k1,p,99999);}
      check("v132.32 KILLING FRENZY: …accumulating to a ceiling of +10 (+"+G.tmodSum(k1,"dmgflat")+")",
        G.tmodSum(k1,"dmgflat")===10);
      const plain=mkB(0,{}), v1=mkB(1,{}), v2=mkB(1,{});
      const hA=v1.hp; dmgOf(plain,v1,20); const dA=hA-v1.hp;
      const hB=v2.hp; dmgOf(k1,v2,20);    const dB=hB-v2.hp;
      check("v132.32 KILLING FRENZY: and the flat bonus reaches the blow ("+dA.toFixed(1)+" → "+
        dB.toFixed(1)+")",dB>dA);
      G.tmodTick(k1,8);
      check("v132.32 KILLING FRENZY: …and it is gone after its 7 seconds (+"+
        G.tmodSum(k1,"dmgflat")+")",G.tmodSum(k1,"dmgflat")===0);
    }
    // ---- BLOODRUSH ----
    {
      const r=mkB(0,{surge:1}), prey=mkB(1,{});
      dmgOf(r,prey,99999);
      const m0=G.tmodMul(r,"spdmul");
      G.tmodTick(r,1);
      const m1=G.tmodMul(r,"spdmul");
      check("v132.32 BLOODRUSH: a kill quickens the step, and it FADES ("+m0.toFixed(2)+"× → "+
        m1.toFixed(2)+"×)",m0>1.4&&m1<m0&&m1>1);
    }
    // ---- SURVIVAL INSTINCT: the latch is the whole assertion ----
    {
      const s1=mkB(0,{flight:1}), att=mkB(1,{});
      s1.hp=s1.maxHp; dmgOf(att,s1,s1.maxHp*0.8);          // one blow takes it under the line
      check("v132.32 SURVIVAL INSTINCT: crossing below "+(G.TMOD_LOW*100)+"% arms it ("+
        G.tmodMul(s1,"spdmul").toFixed(2)+"×, latched "+!!s1._lowLatch+")",
        G.tmodMul(s1,"spdmul")>1.3&&s1._lowLatch===true);
      G.tmodTick(s1,2);                                     // part-spent
      const mid=G.tmodMul(s1,"spdmul");
      dmgOf(att,s1,1); dmgOf(att,s1,1);                     // more blows, still under the line
      check("v132.32 SURVIVAL INSTINCT: further blows under the line do NOT re-arm it — the latch "+
        "is what stops a trigger becoming a permanent buff ("+mid.toFixed(3)+"× → "+
        G.tmodMul(s1,"spdmul").toFixed(3)+"×)",Math.abs(G.tmodMul(s1,"spdmul")-mid)<1e-9);
      s1.hp=s1.maxHp; G.tmodTick(s1,0.1);                   // healed back over the line
      check("v132.32 SURVIVAL INSTINCT: …and healing past the line RELEASES the latch, so it can "+
        "fire again (latched "+!!s1._lowLatch+")",s1._lowLatch===false);
    }
    // ---- LONG STRIDER ----
    {
      const st=mkB(0,{stride:1}), hot=mkB(0,{stride:1});
      st._lastHurt=-999;                                    // long out of combat
      hot._lastHurt=G.getT();                               // just hit
      const z0=st.root.position.z, z1=hot.root.position.z;
      G.moveUnit(st,0,1,0.2); G.moveUnit(hot,0,1,0.2);
      const dS=Math.abs(st.root.position.z-z0), dH=Math.abs(hot.root.position.z-z1);
      check("v132.32 LONG STRIDER: faster out of combat, ordinary in it ("+dH.toFixed(3)+
        " → "+dS.toFixed(3)+")",dS>dH);
    }
    // ---- HUNTER'S STEP ----
    {
      const mel=mkB(0,{hunt:1}), bow=mkB(0,{hunt:1},"archer");
      const v1=mkB(1,{}), v2=mkB(1,{});
      dmgOf(mel,v1,5); dmgOf(bow,v2,5);
      check("v132.32 HUNTER'S STEP: a MELEE blow quickens the step ("+
        G.tmodMul(mel,"spdmul").toFixed(2)+"×)",G.tmodMul(mel,"spdmul")>1.05);
      check("v132.32 HUNTER'S STEP: …and a RANGED one does not ("+
        G.tmodMul(bow,"spdmul").toFixed(2)+"×)",Math.abs(G.tmodMul(bow,"spdmul")-1)<1e-9);
    }
    G.NET.mode=_mB;
  }
  // ---------- v132.29: THE LEVEL AURA ----------`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — batch B gates");
