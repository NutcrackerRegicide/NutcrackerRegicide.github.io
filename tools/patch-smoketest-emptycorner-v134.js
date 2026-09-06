#!/usr/bin/env node
/* patch-smoketest-emptycorner-v134.js — v134.10: the v128.5 duels get a corner that is empty of
 * BUILDINGS as well as of people.
 *
 *   SMOKE_SEED=1
 *   FAIL — v128.5 tunnel: a swept arrow hits a target a point sample would step clean over (9999 → 9999)
 *   FAIL — v128.5 catch-up: WITH the rewind the arrow finds the target the guest aimed at (9999 → 9999)
 *
 * Probed:
 *
 *   [tu] spot (-120,-120)  walkable true/true  buildings<30: storage_pit(0)@5
 *
 * A storage pit five units from the corner both duels are staged in. The arrow flies 6.8 units to
 * its target and never gets there. The melee half of the block passes, because a sword swing does
 * not care what is standing nearby; only the two projectile checks fail, which is exactly the
 * signature of a collider in the flight path.
 *
 * The corner's own search says what it is for — "an empty corner exists to stage the duels in (no
 * bystander can score them)" — and then looks only for UNITS within 45. v134.6 already had to
 * teach it one thing it had not been told (not at x=0, where "clamped to the oldest sample" and
 * "clamped to the origin" are the same point; SMOKE_SEED=1 found that corner too). This is the
 * second: a bystander does not have to be alive to spoil a shot.
 *
 * ⚠ AND IT IS THE SAME MISTAKE AS FIVE OTHERS THIS SESSION. Benches that stage on a live campaign
 * map keep isolating one population and forgetting the other — the relief benches cleared units at
 * 30 when the rule reads 48, the creep-regen bench cleared round the camp while the fight was at
 * the creep, the ring gate cleared nothing and met a Town Centre, this one clears people and meets
 * a storage pit. Worth stating plainly for whoever writes the next one: name the population the
 * RULE reads, and clear that.
 */
const fs=require("fs"),path=require("path");
const R=path.join(__dirname,"..");
const S=path.join(R,"tools","smoketest.js");
let s=fs.readFileSync(S,"utf8");
let failed=[];
const sub=(name,from,to)=>{
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
};

sub("the empty corner is empty of buildings too",
`    const spot=(()=>{
      for(let x=-120;x<=120;x+=15)for(let z=-120;z<=120;z+=15){
        if(Math.abs(x)<30)continue;
        let clear=true;
        for(const v of G.units){if(v.alive&&G.dist2(v.root.position.x,v.root.position.z,x,z)<45*45){clear=false;break;}}
        if(clear)return {x,z};
      }
      return null;
    })();
    check("v128.5 setup: an empty corner exists to stage the duels in (no bystander can score them)",!!spot);`,
`    // v134.10 ⚠ AND EMPTY OF BUILDINGS. Two of the four duels below are ARROWS, and an arrow stops
    // at a collider. On SMOKE_SEED=1 this corner had a storage pit five units away: the melee half
    // passed (a swing does not care what is standing nearby) and both projectile checks failed with
    // the target untouched, which is the signature of something in the flight path rather than of a
    // broken rewind. The search says "an empty corner" and looked only for people.
    const spot=(()=>{
      for(let x=-120;x<=120;x+=15)for(let z=-120;z<=120;z+=15){
        if(Math.abs(x)<30)continue;
        let clear=true;
        for(const v of G.units){if(v.alive&&G.dist2(v.root.position.x,v.root.position.z,x,z)<45*45){clear=false;break;}}
        if(clear)for(const b of G.buildings){if(b.alive&&G.dist2(b.x,b.z,x,z)<45*45){clear=false;break;}}
        if(clear)return {x,z};
      }
      return null;
    })();
    check("v128.5 setup: an empty corner exists to stage the duels in — no bystander to score them "+
      "and no collider to eat an arrow"+(spot?(" ("+spot.x+","+spot.z+")"):""),!!spot);`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(S,s);
console.log("patch-smoketest-emptycorner-v134: OK");
