#!/usr/bin/env node
/* patch-dropoff-v134.js — v134.4, part one: the haul that could never arrive.
 *
 * MEASURED, and it is the oldest bug this arc has turned up. A bench: one bot villager, one grove,
 * one Storage Pit thirteen paces away, five sim-minutes, nothing else on the map.
 *
 *     v134.3  villager: wood banked in 300s = 0     carry 20/20, haul flag set the whole time
 *     v133    villager: wood banked in 300s = 0     ← the same, so this is NOT a v134 regression
 *
 * It fills its pack in forty seconds, sets b.haul, walks to the store — and stops nine paces short,
 * forever. The frame-by-frame: it closes to d=9.5, stops making ground, the v134.0 watchdog fires,
 * it sidesteps, comes back, stalls at 9.5 again. Round and round for the rest of the match.
 *
 * WHY: the stand point is a FIXED CORNER of the building — (dp.x+2.5, dp.z+2) — and it sits INSIDE
 * the collider. A pit blocks to 6.9 and that point is 3.2 off-centre, so the nearest ground a body
 * may legally stand on is 3.7 from the target on the near side and 10.1 from it on the far side.
 * The arrival tolerance is bStand(def,6.5) ≈ 6.8. Approach from the north-east and you arrive;
 * approach from anywhere else and the geometry makes it impossible, forever, in silence.
 *
 * This is the SAME BUG the v134.0 work fixed for the builder's stand point, and the comment left
 * there says it in one line: "stand at the NEAREST point of the site's ring, from whichever side we
 * came — a fixed east-side stand point sat OFF THE MAP for red's border-town sites". The haul was
 * never given the same treatment. Every remote Storage Pit the marshal builds — and it builds them
 * exactly where the walk is long — is a coin flip on whether the villagers working that seam can
 * bank anything at all.
 *
 * ⚠ IT IS NOT A REACH BUFF. The aim point moves to the ring at bSurf+1.2 — bSurf is the CORNER
 * distance, so that point is outside the wall on every bearing and therefore legal ground to stand
 * on from wherever the body came. The tolerance drops from 6.8-to-14.8 to a flat 1.6. Bodies stand
 * closer to the store than they used to, not further; what changes is that they can arrive at all.
 *
 * ------------------------------------------------------------------------------------------------
 * AND IT IS THREE PLACES, NOT ONE. The same shape is written three times in 07-ai.js, and the
 * arithmetic says all three are unreachable from the far side. ring is where a body is held
 * (rBlock+0.7); off is how far the aim point sits from the centre; stop is the arrival tolerance:
 *
 *   HAUL   town centre   stop 14.82   near side  9.70   FAR SIDE 16.10   ✗
 *          castle        stop 17.10   near side 16.60   FAR SIDE 23.00   ✗ (and 0.50 of margin near)
 *          storage pit   stop  8.34   near side  4.40   FAR SIDE 10.80   ✗
 *   ARM-UP barracks      stop  9.96   near side  7.36   FAR SIDE 15.84   ✗  (07-ai.js:1138)
 *   CART   market        stop 11.60   near side  6.20   FAR SIDE 23.20   ✗  (07-ai.js:1091)
 *
 * So a citizen sent to arm up at a barracks it happens to approach from the wrong quarter never
 * becomes a soldier, and a trade cart whose market sits on the wrong side of its bazaar never pays
 * out its gold — it orbits its own market for the rest of the match. Same one-line fix, three
 * times: walk to the nearest point of the ring, the way v134.0 taught the BUILDER to.
 *
 * ⚠ THE SMOKETEST HAD A GATE FOR THIS AND IT PASSED. "the gates that aim off-centre are physically
 * satisfiable" computes best = ring - off and asks whether that clears the stop — the NEAR side,
 * the lucky approach. The honest question is ring + off, and it was never asked. A gate that tests
 * the favourable case is a gate that certifies a coin flip; the v134.4 gates bench the far side.
 */
const fs=require("fs"),path=require("path");
const F=path.join(__dirname,"..","js","07-ai.js");
let s=fs.readFileSync(F,"utf8");
let failed=[];
function sub(name,from,to){
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
}

sub("the haul stands on the near side of the store",
`      const dp=nearestDropoff(u);
      if(!dp)return;
      if(moveToward(u,dp.x+2.5,dp.z+2,dt,bStand(dp.def,dp.type==="storage_pit"?6.5:9))){`,
`      const dp=nearestDropoff(u);
      if(!dp)return;
      // v134.4 STAND ON THE NEAR SIDE OF THE STORE, WHICHEVER SIDE THAT IS. This read
      //     moveToward(u,dp.x+2.5,dp.z+2,dt,bStand(dp.def,dp.type==="storage_pit"?6.5:9))
      // — a fixed corner of the building, three paces off centre and INSIDE its collider. A pit
      // blocks to 6.9, so the nearest legal ground is 3.7 from that point on the north-east side
      // and 10.1 from it on the south-west, against a tolerance of about 6.8. Come at the store
      // from the wrong quarter and arrival is geometrically impossible: the hauler stalls nine
      // paces out, the v134.0 watchdog sidesteps it, it walks back and stalls again, and it carries
      // those twenty logs for the rest of the match. Benched at 0 wood banked in five minutes — and
      // 0 on pristine v133 as well, so this is an old bug that v134.0 only changed the sound of.
      // The builder's stand point three hundred lines up was given exactly this fix at v134.0.
      const _rdx=u.root.position.x-dp.x, _rdz=u.root.position.z-dp.z, _rl=Math.hypot(_rdx,_rdz)||1;
      const _sx=dp.x+_rdx/_rl*(bSurf(dp.def)+1.2), _sz=dp.z+_rdz/_rl*(bSurf(dp.def)+1.2);
      if(moveToward(u,_sx,_sz,dt,1.6)){`);

sub("the citizen arms up from whichever side it came",
`      if(moveToward(u,bar.x+3,bar.z+3,dt,bStand(bar.def,4))){`,
`      // v134.4 …AND THE ARM-UP HAD THE SAME BUG, worse. This aimed at (bar.x+3, bar.z+3) — 4.24
      // off centre, inside a barracks that blocks to 10.9 — and declared arrival within
      // bStand(def,4) = 9.96. Near side 7.36 clears it; FAR SIDE 15.84 does not, so a citizen that
      // walked up to its barracks from the wrong quarter stood outside it holding a paid-for
      // conversion for the rest of the match. The team's food and gold were already spent.
      const _adx=u.root.position.x-bar.x,_adz=u.root.position.z-bar.z,_al=Math.hypot(_adx,_adz)||1;
      if(moveToward(u,bar.x+_adx/_al*(bSurf(bar.def)+1.2),bar.z+_adz/_al*(bSurf(bar.def)+1.2),dt,1.6)){`);

sub("the trade cart pays from whichever side it came",
`      if(moveToward(u,home.x+bSurf(home.def)+2,home.z,dt,bStand(home.def,home.def.r*0.5+2.5))){`,
`      // v134.4 …AND SO DID THE TRADE CART, which is the worst of the three: the aim point was a
      // fixed EAST-of-the-market spot at bSurf+2 = 14.7 off centre against a stop of 11.60. Near
      // side 6.20, far side 23.20. A cart whose bazaar lies west of its market could never deliver
      // — it arrived, failed the test, and orbited its own market for the rest of the match with
      // the gold still on board. v104 shipped it and nothing has ever measured it.
      const _cdx=u.root.position.x-home.x,_cdz=u.root.position.z-home.z,_cl=Math.hypot(_cdx,_cdz)||1;
      if(moveToward(u,home.x+_cdx/_cl*(bSurf(home.def)+1.2),home.z+_cdz/_cl*(bSurf(home.def)+1.2),dt,1.6)){`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patch-dropoff-v134: OK");
