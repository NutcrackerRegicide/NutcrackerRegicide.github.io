#!/usr/bin/env node
/* patch-fx-tmod-looks.js — v132.43: the two effects v132.42 deferred, now that they can work.
 *
 * KILLING FRENZY and BLOODRUSH are both read off a timed modifier, and until this version those
 * went to one connection — so building them then would have drawn for you and for nobody else.
 * That was the stated reason for deferring them, and it is now gone.
 *
 * ── KILLING FRENZY: THE STACK IS THE POINT ──────────────────────────────────────────────────
 * +2 damage a kill to a cap of +10, over a seven-second window, and neither the stack count nor
 * the window has ever been visible. A chevron per +2 above the head says both at once: how many
 * you have, and — as they wink out one at a time — how long you have left.
 *
 * ── THE TRAIL IS "HASTENED", NOT "BLOODRUSH", AND THAT IS DELIBERATE ────────────────────────
 * I described this as Bloodrush's trail. Three buffs push spdmul positive — BLOODRUSH on a kill,
 * HUNTER'S STEP on a landed blow, SURVIVAL INSTINCT under a quarter health — and drawing a trail
 * for one of them while the other two move you just as fast would be a lie about what you are
 * seeing. So it reads the MODIFIER rather than the buff: this unit is moving faster than it
 * should be. That is the true statement, and it is more useful than the narrower one.
 *
 * ⚠ Both ride buffFxTick's human pass, so they inherit its hide-all-then-re-arm rule and cost
 * nothing on the 480 units that can never have either.
 */
const fs=require("fs"),path=require("path");
const F=path.join(__dirname,"..","js","05-combat.js");
let s=fs.readFileSync(F,"utf8");
let failed=[];
function sub(name,from,to){
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
}

sub("frenzy chevrons + the haste trail",
`    const rg=buffSt(u,"regen");                            // SECOND SKIN — one mote every two`,
`    // v132.43 KILLING FRENZY — a chevron per +2 damage. The stack count and the seven-second
    // window were both invisible; this shows the first directly and the second by winking out.
    if(typeof tmodSum==="function"&&u._tmods){
      const fl=tmodSum(u,"dmgflat");
      if(fl>0){const nch=Math.min(5,Math.round(fl/2));
        for(let i=0;i<nch;i++)_lookAt(u,3.6+i*0.34,0xE05A3A,0.42,0.9);}
      // …and a trail while the unit is moving faster than it should be. This reads the MODIFIER,
      // not BLOODRUSH: HUNTER'S STEP and SURVIVAL INSTINCT push the same value, and drawing a
      // trail for one of three things that move you would be a lie about what you are seeing.
      if(typeof tmodMul==="function"&&typeof fxs==="function"&&tmodMul(u,"spdmul")>1.05&&u.moving){
        u._trailT=(u._trailT||0)+dt;
        if(u._trailT>=0.055){u._trailT=0;
          fxs(u.root.position.x,u.root.position.y+0.85,u.root.position.z,0xBFD8FF,0.34,0.30,
              0,0.5,0,0,0.7,0.42);}
      }
    }
    const rg=buffSt(u,"regen");                            // SECOND SKIN — one mote every two`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched js/05-combat.js — Killing Frenzy and the haste trail");
