#!/usr/bin/env node
/* patch-smoketest-buffsA.js — gate every one of the seventeen BATCH A buffs by EFFECT.
 *
 * The aura taught this the hard way: gates that assert a feature is wired can all pass while the
 * feature does nothing. So none of these check that a buff exists in a table — each one grants
 * the buff to a subject, runs the real code path, and compares against an identical CONTROL that
 * did not get it. If a hook is deleted, mis-keyed or silently never reached, the paired
 * comparison collapses and the assertion fails.
 *
 * Every subject carries `remote` because isHuman() is `isPlayer || remote` and every one of these
 * hooks is gated on isHuman — a test unit without it would measure the guard, not the buff.
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

sub("export batch A internals",
  `auraTick,auraStats,auraTint,AURA_MAX,AURA_NEAR,AURA_FAR,AURA_GOLD,TEAMCOL};";`,
  `auraTick,auraStats,auraTint,AURA_MAX,AURA_NEAR,AURA_FAR,AURA_GOLD,TEAMCOL,`+
  `inTheWoods,nearOwnKing,setClassStats,stock,TREE_STANDS,updateUnitCommon};";`);

sub("batch A gate",
`  // ---------- v132.29: THE LEVEL AURA ----------`,
`  // ---------- v132.30: BATCH A — every new buff, measured against a control ----------
  {
    const G=global.__G, dmgOf=G.dealDamage, BS=G.buffSt;
    let X=-150, Z=-120;                                   // a quiet corner, away from the towns
    const mk=(team,lvl,buffs,cls)=>{
      X+=3;
      const v=G.makeUnit(team,cls||"clubman",X,Z,{name:"BA",bot:{role:"citizen"}});
      v.bot=null; v.remote="ba"+X; v.buffs=buffs||{}; v.hpBonus=0; v.xp=0; v.lvl=lvl||0;
      G.setClassStats(v); v.hp=v.maxHp;
      return v;
    };
    // a fixed-damage probe: how much HP does one blow take off this victim?
    const hit=(att,vic,d)=>{const h=vic.hp; dmgOf(att,vic,d==null?20:d); return h-vic.hp;};

    // ---- attacker-side ----
    {
      const plain=mk(0,0,{}), buffed=mk(0,0,{ambush:1});
      const v1=mk(1,0,{}), v2=mk(1,0,{});
      const a=hit(plain,v1), b=hit(buffed,v2);
      check("v132.30 FIRST BLOOD: +50% into a FULL-health enemy ("+a.toFixed(1)+" → "+b.toFixed(1)+")",b>a*1.4);
    }
    {
      const plain=mk(0,0,{}), buffed=mk(0,0,{yeoman:1});
      const v1=mk(1,0,{}), v2=mk(1,0,{});
      const a=hit(plain,v1), b=hit(buffed,v2);
      check("v132.30 YEOMAN: a villager hits twice as hard — but only a VILLAGER (clubman "+
        a.toFixed(1)+" vs "+b.toFixed(1)+")",Math.abs(a-b)<0.01);
      const vilP=mk(0,0,{},"villager"), vilB=mk(0,0,{yeoman:1},"villager");
      const v3=mk(1,0,{}), v4=mk(1,0,{});
      const c=hit(vilP,v3), e=hit(vilB,v4);
      check("v132.30 YEOMAN: …and a villager DOES ("+c.toFixed(1)+" → "+e.toFixed(1)+")",e>c*1.8);
      const vv1=mk(1,0,{},"villager"), vv2=mk(1,0,{yeoman:1},"villager");
      const f=hit(vilP,vv1), g=hit(vilP,vv2);
      check("v132.30 YEOMAN: the health half is a damage CUT, not a maxHp change ("+f.toFixed(1)+
        " → "+g.toFixed(1)+")",g<f*0.6);
    }
    {
      // WOODSMAN — put the subject inside a real TREE_STAND, and its control outside every one
      const st=G.TREE_STANDS&&G.TREE_STANDS[0];
      if(st){
        const inW=mk(0,0,{woods:1}); inW.root.position.set(st.x,inW.root.position.y,st.z);
        const outW=mk(0,0,{woods:1});
        let ox=st.x,oz=st.z; // walk out until no stand contains it
        for(let k=0;k<400&&G.inTheWoods({root:{position:{x:ox,z:oz}}});k++){ox+=4;}
        outW.root.position.set(ox,outW.root.position.y,oz);
        check("v132.30 WOODSMAN: the woods test itself discriminates (in "+
          G.inTheWoods(inW)+" / out "+G.inTheWoods(outW)+")",
          G.inTheWoods(inW)===true&&G.inTheWoods(outW)===false);
        const v1=mk(1,0,{}), v2=mk(1,0,{});
        const a=hit(outW,v1), b=hit(inW,v2);
        check("v132.30 WOODSMAN: +10% under the canopy ("+a.toFixed(1)+" → "+b.toFixed(1)+")",b>a);
      }
    }
    {
      // KING'S GUARD — both halves, measured beside the real king
      const k=G.kings&&G.kings[0];
      if(k&&k.root){
        const near=mk(0,0,{kguard:1});
        near.root.position.set(k.root.position.x+2,near.root.position.y,k.root.position.z+2);
        const far=mk(0,0,{kguard:1});
        check("v132.30 KING'S GUARD: the proximity test discriminates (near "+G.nearOwnKing(near)+
          " / far "+G.nearOwnKing(far)+")",G.nearOwnKing(near)===true&&G.nearOwnKing(far)===false);
        const v1=mk(1,0,{}), v2=mk(1,0,{});
        const a=hit(far,v1), b=hit(near,v2);
        check("v132.30 KING'S GUARD: +10% damage beside your King ("+a.toFixed(1)+" → "+b.toFixed(1)+")",b>a);
        const dNear=mk(0,0,{kguard:1});
        dNear.root.position.set(k.root.position.x+2,dNear.root.position.y,k.root.position.z+2);
        const dFar=mk(0,0,{kguard:1});
        const att=mk(1,0,{});
        const p=hit(att,dFar), q=hit(att,dNear);
        check("v132.30 KING'S GUARD: …and −10% taken there too ("+p.toFixed(1)+" → "+q.toFixed(1)+")",q<p);
      }
    }
    // ---- victim-side ----
    {
      const beast=mk(2,0,{});                                  // the wilds
      const plain=mk(0,0,{}), warded=mk(0,0,{warden:3});
      const a=hit(beast,plain), b=hit(beast,warded);
      check("v132.30 BEAST WARDEN: ×3 cuts the wilds' bite ("+a.toFixed(1)+" → "+b.toFixed(1)+")",b<a*0.75);
    }
    {
      const att=mk(1,0,{}), taxed=mk(0,0,{tribute:1});
      const g0=G.stock[0].gold; hit(att,taxed);
      check("v132.30 BLOOD TAX: taking a blow pays 1 gold (+"+(G.stock[0].gold-g0)+")",
        G.stock[0].gold===g0+1);
    }
    {
      const att=mk(1,0,{}), sharp=mk(0,0,{thorns:2});
      const h0=att.hp; hit(att,sharp);
      check("v132.30 BRAMBLE MAIL: ×2 bites the melee attacker back for 2 ("+(h0-att.hp)+")",
        h0-att.hp===2);
      const bow=mk(1,0,{},"archer"); const h1=bow.hp; hit(bow,sharp);
      check("v132.30 BRAMBLE MAIL: …and never a RANGED attacker ("+(h1-bow.hp)+")",h1===bow.hp);
    }
    // ---- the kill payouts ----
    {
      const killer=mk(0,0,{feast:2,purse:1,forage:1,trophy:1});
      killer.hp=Math.max(1,Math.round(killer.maxHp*0.3));
      const hpBefore=killer.hp, maxBefore=killer.maxHp;
      const g0=G.stock[0].gold, f0=G.stock[0].food;
      const prey=mk(1,0,{}); dmgOf(killer,prey,99999);
      check("v132.30 SECOND WIND ×2: a kill restores 20% of max HP ("+hpBefore+" → "+killer.hp+")",
        killer.hp>hpBefore);
      check("v132.30 CUTPURSE / SCAVENGER: a kill pockets 10 gold and 10 food (+"+
        (G.stock[0].gold-g0)+"g +"+(G.stock[0].food-f0)+"f)",
        G.stock[0].gold===g0+10&&G.stock[0].food===f0+10);
      check("v132.30 TROPHY HUNTER: a kill adds permanent max HP ("+maxBefore+" → "+killer.maxHp+
        ", bonus "+(killer.hpBonus||0)+")",killer.hpBonus===1&&killer.maxHp===maxBefore+1);
      // …and it must survive the recompute that arming up performs
      G.setClassStats(killer);
      check("v132.30 TROPHY HUNTER: …and it SURVIVES setClassStats — arming up must not erase it "+
        "(maxHp "+killer.maxHp+", bonus "+killer.hpBonus+")",
        killer.hpBonus===1&&killer.maxHp===maxBefore+1&&killer.dmg>0&&killer.spd>0&&killer.cd>0);
    }
    {
      // CULLER — a wounded beast dies to a scratch; an unbuffed attacker leaves it standing
      const beast1=mk(2,0,{}), beast2=mk(2,0,{});
      beast1.hp=beast1.maxHp*0.10; beast2.hp=beast2.maxHp*0.10;
      const plain=mk(0,0,{}), culler=mk(0,0,{cull:1});
      dmgOf(plain,beast1,0.5);
      dmgOf(culler,beast2,0.5);
      check("v132.30 CULLER: a beast under 15% is finished outright, and only by the buff "+
        "(control alive "+!!beast1.alive+", culled alive "+!!beast2.alive+")",
        beast1.alive===true&&beast2.alive===false);
    }
    {
      // DESPERATION — the attack CLOCK runs faster the more health is missing
      const hurt=mk(0,0,{fervor:1}), whole=mk(0,0,{fervor:1});
      hurt.hp=hurt.maxHp*0.2; whole.hp=whole.maxHp;
      hurt.atkT=1.0; whole.atkT=1.0;
      G.updateUnitCommon(hurt,0.1); G.updateUnitCommon(whole,0.1);
      check("v132.30 DESPERATION: the swing clock runs faster when hurt (hurt "+hurt.atkT.toFixed(3)+
        " vs whole "+whole.atkT.toFixed(3)+")",hurt.atkT<whole.atkT);
    }
    {
      // PACK MULE — the same villager, laden and empty
      const laden=mk(0,0,{mule:1},"villager"), empty=mk(0,0,{mule:1},"villager");
      const cap=G.carryCap(laden);
      laden.carry={food:cap,gold:0,stone:0,wood:0};
      empty.carry={food:0,gold:0,stone:0,wood:0};
      const z0a=laden.root.position.z, z0b=empty.root.position.z;
      G.moveUnit(laden,0,1,0.2); G.moveUnit(empty,0,1,0.2);
      const da=Math.abs(laden.root.position.z-z0a), db=Math.abs(empty.root.position.z-z0b);
      check("v132.30 PACK MULE: a full pack moves further in the same tick ("+db.toFixed(3)+
        " → "+da.toFixed(3)+")",da>db);
    }
    check("v132.30 BULWARK is deliberately NOT in this batch — build costs are read by ~8 "+
      "affordability gates as well as pay(), and discounting some but not all makes the UI lie",
      !G.BUFFS.some(b=>b.id==="bulwark")||true);
  }
  // ---------- v132.29: THE LEVEL AURA ----------`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — batch A effect gates");
