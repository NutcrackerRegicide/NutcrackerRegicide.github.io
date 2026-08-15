#!/usr/bin/env node
/* patch-smoketest-D.js — gate the radius auras.
 *
 * For this system the COST properties matter as much as the effects, because the failure mode is
 * not "the buff does nothing" — it is "the buff works and the tick budget quietly doubles". So
 * two of the assertions are about work not done:
 *   · A NON-HOLDER NEVER SCANS. If the early-out were removed, all 485 units would walk all 485
 *     units every frame. Gated by asserting a unit without any of the six never gets a count.
 *   · THE SCAN IS THROTTLED. Removing the 4 Hz gate is invisible in play and 15× the cost.
 *
 * And the effect assertions are all paired against a control or a boundary, so none of them can
 * pass vacuously:
 *   · SANCTUARY must NOT heal before its 3 seconds, and movement must reset the clock — a zone
 *     that opens instantly is a different buff.
 *   · SEARING PRESENCE must burn enemies and NOT allies.
 *   · KINSHIP needs a soldier OF YOUR OWN KIND — any-ally would be a different buff entirely.
 *   · UNBOWED and PHALANX must both SCALE with the count and STOP at their caps.
 *   · Everything must respect the radius: a unit just outside is untouched.
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

sub("export the aura system",
  `statusTick,isStunned,healBlocked,shedDebuffs,healTick};";`,
  `statusTick,isStunned,healBlocked,shedDebuffs,healTick,auraBuffTick,AURA_BR,AURA_SCAN,AURA_STILL,buildings,makeBuilding};";`);

sub("batch D gate",
`    // ---- v132.34: BATCH C — state on the ENEMY ----`,
`    // ---- v132.35: BATCH D — radius auras ----
    {
      const AB=G.auraBuffTick, R=G.AURA_BR;
      const scan=(u,secs)=>{for(let i=0;i<Math.ceil(secs/0.05);i++)AB(u,0.05);};
      // THE COST PROPERTIES FIRST — they are the ones that fail silently
      {
        const idle=mkB(0,{});                       // holds NONE of the six
        idle._auraA=-1; idle._auraE=-1;
        scan(idle,2);
        check("v132.35 aura cost: a unit holding none of the six NEVER scans — the early-out is "+
          "what stops 485 units walking 485 units every frame (counts untouched: "+idle._auraA+
          "/"+idle._auraE+")",idle._auraA===-1&&idle._auraE===-1);
        const holder=mkB(0,{phalanx:1});
        holder._auraA=-1; AB(holder,0.05);          // one frame, well under AURA_SCAN
        check("v132.35 aura cost: a holder does NOT scan every frame — 4 Hz, not 60 (after one "+
          "16ms frame the count is still "+holder._auraA+")",holder._auraA===-1);
        scan(holder,0.4);
        check("v132.35 aura cost: …but it DOES scan once the "+G.AURA_SCAN+"s window elapses ("+
          holder._auraA+")",holder._auraA>=0);
      }
      // SANCTUARY — the stillness clock, then the zone
      {
        const heal=mkB(0,{sanctuary:1});
        const friend=mkB(0,{}); friend.root.position.set(heal.root.position.x+2,0,heal.root.position.z);
        friend.hp=friend.maxHp*0.5; const f0=friend.hp;
        heal.moving=true; scan(heal,4);
        check("v132.35 SANCTUARY: no zone while you are MOVING ("+f0.toFixed(1)+" → "+
          friend.hp.toFixed(1)+")",Math.abs(friend.hp-f0)<1e-9);
        heal.moving=false; scan(heal,2);            // still under the 3s clock
        check("v132.35 SANCTUARY: …and none before the "+G.AURA_STILL+"s of stillness are up ("+
          friend.hp.toFixed(1)+")",Math.abs(friend.hp-f0)<1e-9);
        scan(heal,3);                               // now past it
        check("v132.35 SANCTUARY: …then it opens and mends the warband ("+f0.toFixed(1)+" → "+
          friend.hp.toFixed(1)+")",friend.hp>f0);
        // and the radius bounds it
        const far=mkB(0,{}); far.root.position.set(heal.root.position.x+R+15,0,heal.root.position.z);
        far.hp=far.maxHp*0.5; const x0=far.hp; scan(heal,2);
        check("v132.35 SANCTUARY: …but not someone outside the "+R+"-unit radius ("+
          x0.toFixed(1)+" → "+far.hp.toFixed(1)+")",Math.abs(far.hp-x0)<1e-9);
        far.alive=false; friend.alive=false;
      }
      // SEARING PRESENCE — enemies only
      {
        const burn=mkB(0,{brand:1});
        const foe=mkB(1,{}); foe.root.position.set(burn.root.position.x+2,0,burn.root.position.z);
        const pal=mkB(0,{}); pal.root.position.set(burn.root.position.x+2,0,burn.root.position.z+1);
        const e0=foe.hp, a0=pal.hp;
        scan(burn,2);
        check("v132.35 SEARING PRESENCE: nearby enemies burn ("+e0.toFixed(1)+" → "+
          foe.hp.toFixed(1)+")",foe.hp<e0);
        check("v132.35 SEARING PRESENCE: …and allies do NOT ("+a0.toFixed(1)+" → "+
          pal.hp.toFixed(1)+")",Math.abs(pal.hp-a0)<1e-9);
        foe.alive=false; pal.alive=false;
      }
      // KINSHIP — a soldier of your OWN KIND, not merely any ally
      {
        const kinA=mkB(0,{kinship:1},"clubman"); kinA.hp=kinA.maxHp*0.5;
        const other=mkB(0,{},"archer");
        other.root.position.set(kinA.root.position.x+2,0,kinA.root.position.z);
        const h0=kinA.hp; scan(kinA,2);
        check("v132.35 KINSHIP: a DIFFERENT class nearby mends nothing ("+h0.toFixed(1)+" → "+
          kinA.hp.toFixed(1)+")",Math.abs(kinA.hp-h0)<1e-9);
        const same=mkB(0,{},"clubman");
        same.root.position.set(kinA.root.position.x+2,0,kinA.root.position.z);
        scan(kinA,2);
        check("v132.35 KINSHIP: …a soldier of your own kind does ("+h0.toFixed(1)+" → "+
          kinA.hp.toFixed(1)+")",kinA.hp>h0);
        other.alive=false; same.alive=false;
      }
      // UNBOWED and PHALANX — scale with the count, stop at the cap
      {
        const stout=mkB(0,{resolve:1}), hitter=mkB(1,{});
        const probe=(n)=>{
          stout._auraE=n;
          const v=stout.hp; dmgOf(hitter,stout,20); const d=v-stout.hp; stout.hp=stout.maxHp; return d;
        };
        const d0=probe(0), d2=probe(2), d9=probe(9), d20=probe(20);
        check("v132.35 UNBOWED: the more enemies around you the less it hurts ("+d0.toFixed(1)+
          " → "+d2.toFixed(1)+" → "+d9.toFixed(1)+")",d2<d0&&d9<d2);
        check("v132.35 UNBOWED: …and it STOPS at −25% ("+d9.toFixed(1)+" vs 20 enemies "+
          d20.toFixed(1)+", floor "+(20*0.75).toFixed(1)+")",
          Math.abs(d9-d20)<1e-9&&Math.abs(d20-15)<0.01);
        const spear=mkB(0,{phalanx:1}), tgt=mkB(1,{});
        const pr=(n)=>{spear._auraA=n;const v=tgt.hp;dmgOf(spear,tgt,20);const d=v-tgt.hp;tgt.hp=tgt.maxHp;return d;};
        const p0=pr(0), p2=pr(2), p8=pr(8), p30=pr(30);
        check("v132.35 PHALANX: the more allies beside you the harder you hit ("+p0.toFixed(1)+
          " → "+p2.toFixed(1)+" → "+p8.toFixed(1)+")",p2>p0&&p8>p2);
        check("v132.35 PHALANX: …and it STOPS at +20% ("+p8.toFixed(1)+" vs 30 allies "+
          p30.toFixed(1)+", ceiling "+(20*1.2).toFixed(1)+")",
          Math.abs(p8-p30)<1e-9&&Math.abs(p30-24)<0.01);
        hitter.alive=false; tgt.alive=false;
      }
      // STEWARD — a villager mends the stones
      {
        const stew=mkB(0,{steward:1},"villager");
        const hut=G.makeBuilding(0,"house",stew.root.position.x+3,stew.root.position.z,true);
        hut.hp=hut.def.hp*0.5; const b0=hut.hp;
        scan(stew,2);
        check("v132.35 STEWARD: a villager mends a wounded friendly building ("+b0.toFixed(1)+
          " → "+hut.hp.toFixed(1)+")",hut.hp>b0);
        hut.alive=false;
      }
    }
    // ---- v132.34: BATCH C — state on the ENEMY ----`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — batch D gates");
