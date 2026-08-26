#!/usr/bin/env node
/* v133.0 — the gates that hardcoded the old balance numbers, brought onto the new sheet.
   One of them needed rethinking rather than renumbering: RAPID VOLLEY proved "three separate
   blows, not one tripled" by counting Bloodthirst's flat 1 HP a hit. Bloodthirst is a PERCENTAGE
   of damage now, so one blow of triple damage heals exactly what three blows heal, and the gate
   could no longer tell the two apart — it would have passed on the very implementation it exists
   to reject. It counts damage-number emissions instead, which is one per landed blow by
   construction. */
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
const F=path.join(ROOT,'tools/smoketest.js');
let n=0;
function sub(find,repl,label){
  const src=fs.readFileSync(F,'utf8'), c=src.split(find).length-1;
  if(c!==1){console.error('ABORT ['+label+'] matched '+c+', expected 1');process.exit(1);}
  fs.writeFileSync(F,src.replace(find,repl)); n++; console.log('  ok  '+label);
}

sub(`    const wantHp=Math.round(cb.hp*ageBuff(0)*(1+0.05*bm("hp")));
    const wantSpd=cb.spd+0.5*bm("spd");
    const wantCd=Math.max(0.2,cb.cd-0.1*bm("atkspd"));`,
`    const wantHp=Math.round(cb.hp*ageBuff(0)*(1+0.10*bm("hp")));
    const wantSpd=cb.spd+1.0*bm("spd");
    // v133.0 Quick Hands is a PERCENTAGE now — a flat −0.1s was worth 10% to a 1.0s clubman and
    // 40% to a 0.25s skirmisher, i.e. a different buff depending on who bought it.
    const wantCd=Math.max(0.2,cb.cd*(1-0.10*bm("atkspd")));`,'stat sheet: hp 10%, spd +1, cd percentage');

sub(`  check("Honed Edge ×3 = +15% damage (dealt "+(h0-tgt.hp)+")",Math.abs((h0-tgt.hp)-115)<1e-6);`,
    `  check("Honed Edge ×3 = +21% damage (dealt "+(h0-tgt.hp)+")",Math.abs((h0-tgt.hp)-121)<1e-6);`,'Honed Edge 7%');

sub(`  check("Raised Shield ×3 takes 15% off (took "+(h0-vh.hp)+")",Math.abs((h0-vh.hp)-85)<1e-6);`,
    `  check("Raised Shield ×3 takes 21% off (took "+(h0-vh.hp)+")",Math.abs((h0-vh.hp)-79)<1e-6);`,'Raised Shield 7%');

sub(`  check("Bloodthirst drinks 2 HP on the hit",Math.abs(dh.hp-(h0+2))<1e-6);`,
`  // v133.0 a SHARE of the blow: 50 damage × 7% × 2 stacks = 7 HP. The old flat 1-a-stack was
  // noise on a heavy swing and a lifeline on a light one.
  check("Bloodthirst ×2 drinks 7 HP from a 50-damage blow (got "+(dh.hp-h0).toFixed(2)+")",
    Math.abs(dh.hp-(h0+7))<1e-6);`,'Bloodthirst 7% of damage');

sub(`  check("Captain's Banner ×3: the nearby ally hits +3% (dealt "+(h0-foe.hp)+")",Math.abs((h0-foe.hp)-103)<1e-6);`,
    `  check("Captain's Banner ×3: the nearby ally hits +15% (dealt "+(h0-foe.hp)+")",Math.abs((h0-foe.hp)-115)<1e-6);`,'Captain’s Banner 5%');

sub(`  check("Second Skin knits +1.5 HP/s after the quiet",Math.abs(vh.hp-501.5)<1e-6);`,
    `  check("Second Skin ×3 knits +6 HP/s after the quiet",Math.abs(vh.hp-506)<1e-6);`,'Second Skin 2 HP/s');

sub(`  check("Deep Satchel: 20 → 50 carry",(dh.buffs={carry:3},carryCap(dh)===50)&&carryCap(ally)===20);`,
    `  check("Deep Satchel ×3: 20 → 80 carry",(dh.buffs={carry:3},carryCap(dh)===80)&&carryCap(ally)===20);`,'Deep Satchel +20');

sub(`        ", bonus "+(killer.hpBonus||0)+")",killer.hpBonus===1&&killer.maxHp===maxBefore+1);`,
    `        ", bonus "+(killer.hpBonus||0)+")",killer.hpBonus===5&&killer.maxHp===maxBefore+5);`,'Trophy Hunter +5');
sub(`        killer.hpBonus===1&&killer.maxHp===maxBefore+1&&killer.dmg>0&&killer.spd>0&&killer.cd>0);`,
    `        killer.hpBonus===5&&killer.maxHp===maxBefore+5&&killer.dmg>0&&killer.spd>0&&killer.cd>0);`,'Trophy Hunter survives recompute');

sub(`      check("v132.32 KILLING FRENZY: a kill grants +2 flat damage (+"+G.tmodSum(k1,"dmgflat")+")",
        G.tmodSum(k1,"dmgflat")===2);`,
`      check("v133.0 KILLING FRENZY: a kill grants +3 flat damage (+"+G.tmodSum(k1,"dmgflat")+")",
        G.tmodSum(k1,"dmgflat")===3);`,'Killing Frenzy +3');
sub(`      check("v132.32 KILLING FRENZY: …accumulating to a ceiling of +10 (+"+G.tmodSum(k1,"dmgflat")+")",
        G.tmodSum(k1,"dmgflat")===10);`,
`      check("v133.0 KILLING FRENZY: …accumulating to a ceiling of +15 (+"+G.tmodSum(k1,"dmgflat")+")",
        G.tmodSum(k1,"dmgflat")===15);`,'Killing Frenzy cap +15');
sub(`      G.tmodTick(k1,8);
      check("v132.32 KILLING FRENZY: …and it is gone after its 7 seconds (+"+
        G.tmodSum(k1,"dmgflat")+")",G.tmodSum(k1,"dmgflat")===0);`,
`      G.tmodTick(k1,11);   // v133.0: the window is TEN seconds now — ticking 8 would leave it up
      check("v133.0 KILLING FRENZY: …and it is gone after its 10 seconds (+"+
        G.tmodSum(k1,"dmgflat")+")",G.tmodSum(k1,"dmgflat")===0);`,'Killing Frenzy 10s window');

sub(`          // Bloodthirst heals 1 HP per landed hit — so the heal COUNTS the blows. A "triple
          // damage" implementation would pass a damage-total test and fail this one.
          const archer=put(0,{volley:1,leech:1},"archer",0,45);
          const tgt=put(1,{},"clubman",2,45);
          archer.hp=Math.max(1,archer.maxHp-10);
          archer._volleyT=-999;
          const a0=archer.hp;
          forceE(()=>dmgOf(archer,tgt,5));
          const healed=archer.hp-a0;
          check("v132.36 RAPID VOLLEY: THREE separate blows land, not one tripled — Bloodthirst "+
            "healed "+healed.toFixed(0)+" (one per hit)",healed>=3);`,
`          // v133.0 COUNT THE BLOWS, NOT THE HEALING. This used Bloodthirst's flat 1 HP a hit as a
          // blow counter — but Bloodthirst is a PERCENTAGE of damage now, so one blow of triple
          // damage heals precisely what three blows heal and the gate could no longer tell them
          // apart. It would have passed on the exact implementation it exists to reject. A damage
          // number is emitted once per landed blow, which is a count by construction.
          const archer=put(0,{volley:1},"archer",0,45);
          const tgt=put(1,{},"clubman",2,45);
          archer._volleyT=-999;
          const e0=G.dnumStats().emits;
          forceE(()=>dmgOf(archer,tgt,5));
          const blows=G.dnumStats().emits-e0;
          check("v132.36 RAPID VOLLEY: THREE separate blows land, not one tripled — "+blows+
            " damage numbers were emitted, one per landed blow",blows===3);`,'Rapid Volley counts blows, not healing');

sub(`          K._tmods=[{k:"dmgflat",mag:4,t:5,dur:7,fade:false}];   // +4 = two kills
          FX(0.016); const two=S().lookVis-base;
          K._tmods=[{k:"dmgflat",mag:10,t:5,dur:7,fade:false}];  // +10 = the cap`,
`          K._tmods=[{k:"dmgflat",mag:6,t:5,dur:10,fade:false}];  // v133.0: +6 = two kills at +3
          FX(0.016); const two=S().lookVis-base;
          K._tmods=[{k:"dmgflat",mag:15,t:5,dur:10,fade:false}]; // +15 = the cap`,'frenzy chevrons at +3 a kill');

console.log('v133.0 gate updates: '+n+' edits applied');
