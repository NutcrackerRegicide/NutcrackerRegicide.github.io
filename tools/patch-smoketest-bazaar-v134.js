#!/usr/bin/env node
/* patch-smoketest-bazaar-v134.js — gates for v134.3 part one, and a staging fix to my own v134.0 gate.
 *
 * THE STAGING FIX. The v132.26 mid-capture gate I added at v134.0 stages ONE bazaar mid-capture —
 * `neutralMarkets.find(m=>m.owner!==team)` — and then asserts the band posted to it is not relieved.
 * That worked only because bandHoldPoint happened to post the band to that same square. It sorts the
 * unheld pool Grand-first and deals it by band index, so which square a band gets depends on how
 * many hold bands exist, and v134.3 changes exactly that. The gate went red while the rule it tests
 * was working perfectly.
 *
 * A test that depends on which of three interchangeable objectives the code picks is testing the
 * wrong thing. It stages EVERY unheld square now, so whichever one the band is posted to is
 * mid-capture, and the assertion is about the rule rather than about the deal.
 *
 * THE NEW GATES:
 *   · an unheld square outranks a castle, and a castle wins again once every square is yours —
 *     both directions, because only testing the first would pass on "always return a bazaar";
 *   · the role picker COUNTS. A repeat in wantRoles could never win the old loop, which is why
 *     PERSONALITIES.rush.econHunters has been dead since v94. Staged with a rush director and a
 *     roster big enough to deal several bands.
 *
 * The campaign-wide effect is measured by tools/pathprobe.js rather than asserted here, because it
 * is a distribution and not an invariant. Twenty-minute campaigns, the SHIPPED v134.2 tree against
 * the SHIPPED v134.3 tree, square-seconds the three squares stood neutral (of 3600):
 *
 *     seed 11  64.8% -> 23.8%      seed 33  63.0% -> 14.3%      seed 44  47.3% -> 23.9%
 *   mean squares held  1.06 -> 2.29          1.11 -> 2.57          1.58 -> 2.28
 *   mean yield /sec    1.06 -> 2.46          1.11 -> 2.86          1.58 -> 2.41
 *
 * ⚠ These are the numbers with all three v134.3 changes in, not this one alone — the squares are
 * worth taking only if the army can spare a band to stand on one, and that is patch-bandecon's
 * doing. An intermediate reading of this same table, taken while the founding pass was still a
 * no-op, said 36.2 / 52.3 / 18.8. It is quoted here because a measurement is of a TREE and not of
 * an idea, and the tree moved after it was taken.
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

sub("export what the square gates need",
`  "renderSlainBy,BUFFS,"+                              // v134.2 the slain-by death screen`,
`  "renderSlainBy,BUFFS,"+                              // v134.2 the slain-by death screen
  "bazaarYield,BAZ_YIELD_BY_HELD,"+                    // v134.3 the squares`);

sub("stage EVERY unheld square, not one of them",
`      const bz=G2.neutralMarkets.find(m=>m.owner!==team);
      if(bz){`,
`      // v134.3: was neutralMarkets.find(m=>m.owner!==team) — ONE square, staged on the assumption
      // that bandHoldPoint would post the band to that one. It deals the unheld pool Grand-first by
      // band index, so which square a band gets depends on how many hold bands exist — and v134.3
      // changes that. Stage them ALL and the assertion is about the RULE rather than about the deal.
      const bz=G2.neutralMarkets.find(m=>m.owner!==team);
      if(bz){`);

sub("…and set the cap on all of them",
`        bz.cap=0.6; bz.capTeam=team;               // OUR band, six tenths of the way in`,
`        for(const m of G2.neutralMarkets)if(m.owner!==team){m.cap=0.6;m.capTeam=team;} // v134.3:
        bz.cap=0.6; bz.capTeam=team;               // whichever square it is posted to, it is ours
                                                   // and six tenths of the way in`);

sub("the bazaar bench",
`console.log(fails?("\\n"+fails+" FAILURES"):"\\nALL SMOKE TESTS PASSED");`,
`// ==================== v134.3 THE SQUARES ====================
{
  const G=global.__G;
  // --- 1. AN UNHELD SQUARE OUTRANKS A CASTLE — and a castle wins again when there is nothing left
  //        to take. Both directions: a rule that always answered "bazaar" would pass the first.
  {
    const team=G.BLUE;
    const own=G.neutralMarkets.map(m=>m.owner);
    let castle=G.buildings.find(b=>b.alive&&b.built&&b.team===team&&b.type==="castle");
    let made=null;
    if(!castle){ // stand one up somewhere legal behind the throne
      const tc=G.teamTC(team);
      for(let r=40;r<=90&&!made;r+=6)for(let a=0;a<12&&!made;a++){
        const th=a/12*Math.PI*2, x=tc.x+Math.cos(th)*r, z=tc.z+Math.sin(th)*r;
        if(G.validFor("castle",x,z,team))made=G.makeBuilding(team,"castle",x,z,true);
      }
      castle=made;
    }
    for(const m of G.neutralMarkets)m.owner=-1;              // everything up for grabs
    const withFree=G.bandHoldPoint(team,0);
    for(const m of G.neutralMarkets)m.owner=team;            // …and now the map is swept
    const swept=G.bandHoldPoint(team,0);
    for(let i=0;i<own.length;i++)G.neutralMarkets[i].owner=own[i];
    if(made)made.alive=false;
    check("v134.3 squares: with a castle standing, an UNHELD bazaar still gets the band ("+
      (withFree&&withFree.why)+") — and once every square is yours the castle posting is right "+
      "again ("+(swept&&swept.why)+"). Before this, a castle pre-empted every square from about "+
      "minute ten, and every doctrine builds a castle",
      !!castle&&withFree&&withFree.why==="bazaar"&&swept&&swept.why==="castle");
  }

  // --- 2. THE ROLE PICKER COUNTS. A repeat in wantRoles could never win the old loop, so
  //        PERSONALITIES.rush.econHunters — "rush lives on dead supply chains", v94 — has done
  //        nothing since the day it shipped. Staged: a rush marshal with a roster big enough to
  //        deal several bands, and the doctrine's econ raiders must actually appear.
  {
    const team=G.RED, D=G.directors[team], pers0=D.pers, bands0=D.bands;
    D.pers="rush"; D.bands=[];
    const made=[];
    for(let i=0;i<34;i++){
      const u=G.makeUnit(team,"clubman",150+(i%8)*2,-140-Math.floor(i/8)*2,
        {name:"Roster"+i,bot:{role:"war"}});
      u.bandRef=null; made.push(u);
    }
    for(let i=0;i<6;i++)G.manageBands(D);
    const byRole={};
    for(const b of D.bands)byRole[b.role]=(byRole[b.role]||0)+1;
    const econ=byRole.econ||0, want=1+(G.PERSONALITIES.rush.econHunters||0);
    D.pers=pers0; D.bands=bands0;
    for(const u of made){u.bandRef=null;u.alive=false;}
    check("v134.3 doctrine: the role picker reads wantRoles as a COUNT, so rush finally fields the "+
      "econ raiders its doctrine has claimed since v94 ("+econ+" econ bands of "+want+" wanted; "+
      JSON.stringify(byRole)+") — a repeat could never win the old loop, so the knob was dead",
      econ>=want);
  }
}

console.log(fails?("\\n"+fails+" FAILURES"):"\\nALL SMOKE TESTS PASSED");`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patch-smoketest-bazaar-v134: OK");
