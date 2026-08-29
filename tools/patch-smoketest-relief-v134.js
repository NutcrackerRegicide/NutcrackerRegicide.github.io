#!/usr/bin/env node
/* patch-smoketest-relief-v134.js — the v113 RELIEF test's "cold field" was only half staged.
 *
 * The v134.0 pathing work turned this red, and the code is right: the band was standing on the red
 * bazaar with cap 0.70 and capTeam RED — i.e. the enemy was mid-capture underneath it — so
 * manageBands's `_taking` guard (v132.26) correctly refused to march the band off contested ground.
 * Nothing about that is a regression. Bands reach bazaars more often now that they are not wedged
 * against buildings on the way, which is the whole point of the change, and it turned a latent
 * hole in the test into a red.
 *
 * The hole is the same one the v127 comment three lines above already calls out for the OTHER half
 * of the premise: "a cold field was HOPED for, not established". The enemy count was staged; the
 * SQUARE's capture state never was. So this stages it — cap and capTeam stashed and restored the
 * same way isolateArea stashes positions — and the assertion goes back to testing the one thing it
 * is named for: a spent tour over quiet ground is relieved.
 *
 * AND IT GAINS THE GATE IT WAS ACCIDENTALLY ACTING AS. The `_taking` rule shipped at v132.26 with
 * no test of its own — the failure above was the first time anything exercised it, by luck. It gets
 * a deliberate one now: same spent tour, same cold field, but the band's own square 60% taken, and
 * the band must stay. That is strictly more coverage than before, not less.
 */
const fs=require("fs"),path=require("path");
const F=path.join(__dirname,"..","tools","smoketest.js");
let s=fs.readFileSync(F,"utf8");
let failed=[];
function sub(name,from,to){
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
}

sub("stage the square as well as the field",
`    const cellar=isolateArea(-200,-118,30,{team:1-team,keep:[cold]});
    cold.bandRef=hb; D.bands.push(hb);
    G2.manageBands(D);
    cellar.restore();`,
`    const cellar=isolateArea(-200,-118,30,{team:1-team,keep:[cold]});
    // v134.0 …AND THE SQUARE IS PART OF THE FIELD. bandHoldPoint posts a hold band ON a bazaar, and
    // manageBands refuses to relieve a band standing on one that is mid-capture (the v132.26
    // \`_taking\` rule) — by EITHER side, because a square the enemy is taking under your feet is not
    // quiet ground either. So a campaign that leaves any bazaar part-captured makes this assertion
    // fail while the code does exactly the right thing. The enemy count was staged here from v127;
    // the capture state was not. Both now are.
    const bazHold=G2.neutralMarkets.map(m=>({m,cap:m.cap,capTeam:m.capTeam}));
    for(const m of G2.neutralMarkets){m.cap=0;m.capTeam=-1;}
    cold.bandRef=hb; D.bands.push(hb);
    G2.manageBands(D);
    cellar.restore();
    for(const e of bazHold){e.m.cap=e.cap;e.m.capTeam=e.capTeam;}`);

sub("gate the mid-capture rule itself",
`    // A HOT POSTING: the same spent tour, but an enemy standing on it — the ground still matters`,
`    // v134.0 A SQUARE HALF TAKEN IS NOT QUIET GROUND. The v132.26 \`_taking\` rule — "a band
    // mid-capture is not relieved", John's point being that marching a band off a bazaar at 59%
    // hands the square straight back — shipped without a test and was never once exercised until
    // the v134.0 pathing work tripped it by accident. This is that test, run the same way the
    // relief case above is: everything identical, one field moved.
    {
      const bz=G2.neutralMarkets.find(m=>m.owner!==team);
      if(bz){
        const hb3={id:9003,role:"hold",members:[cold],holdUntil:NOWT-1,lastContact:NOWT-9999,laneZ:0,laneUntil:NOWT+999};
        const keep3=G2.neutralMarkets.map(m=>({m,cap:m.cap,capTeam:m.capTeam}));
        for(const m of G2.neutralMarkets){m.cap=0;m.capTeam=-1;}
        bz.cap=0.6; bz.capTeam=team;               // OUR band, six tenths of the way in
        const cell3=isolateArea(-200,-118,30,{team:1-team,keep:[cold]});
        cold.bandRef=hb3; D.bands.push(hb3);
        G2.manageBands(D);
        cell3.restore();
        const held=hb3.role==="hold";
        // …and prove the harness is not simply refusing to relieve anything: the same band, the
        // same everything, with the capture wound back to zero, IS relieved.
        const hb4={id:9004,role:"hold",members:[cold],holdUntil:NOWT-1,lastContact:NOWT-9999,laneZ:0,laneUntil:NOWT+999};
        for(const m of G2.neutralMarkets){m.cap=0;m.capTeam=-1;}
        const cell4=isolateArea(-200,-118,30,{team:1-team,keep:[cold]});
        cold.bandRef=hb4; D.bands.push(hb4);
        G2.manageBands(D);
        cell4.restore();
        for(const e of keep3){e.m.cap=e.cap;e.m.capTeam=e.capTeam;}
        check("v132.26 relief: a band MID-CAPTURE is not relieved, and the same band with the "+
          "square at zero is ("+hb3.role+" holding vs "+hb4.role+" relieved)",
          held&&hb4.role!=="hold");
        D.bands=D.bands.filter(b=>b!==hb3&&b!==hb4);
      }
    }
    // A HOT POSTING: the same spent tour, but an enemy standing on it — the ground still matters`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patch-smoketest-relief-v134: OK");
