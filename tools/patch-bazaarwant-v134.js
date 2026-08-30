#!/usr/bin/env node
/* patch-bazaarwant-v134.js — v134.3, part one: the AI stops walking away from 12 resources a second.
 *
 * MEASURED FIRST, twenty-minute solo campaigns:
 *   seed 11   grand:BLUE  team:neutral  team:RED   — yield 1/1, and a square left NEUTRAL all match
 *   seed 33   grand:RED   team:BLUE     team:RED   — yield 1/2
 * Three squares paying 1/2/4 of food AND gold AND wood per second by count held, and neither army
 * ever takes more than two. Nobody sweeps. A square sat unclaimed for twenty minutes.
 *
 * TWO CAUSES, and the second one turned out to be a bug with a much wider blast radius.
 *
 * 1. A CASTLE PRE-EMPTS EVERY SQUARE. bandHoldPoint's first line returns a castle posting if the
 *    team owns one, and EVERY personality builds a castle (rush 1, boom 1, expand 2, turtle 2). So
 *    from the moment the first castle finishes, no hold band is ever posted to a bazaar again — the
 *    v132.26 work that taught bands to stand ON the square instead of three units outside it stopped
 *    being reachable at roughly minute ten. Standing in your own courtyard is not worth more than
 *    the thing that pays 4 a second, so an UNHELD square now outranks a castle; once every square is
 *    yours the castle posting is exactly right again, and that is what it falls back to.
 *
 * 2. …AND THE ARMY ONLY EVER WANTED ONE HOLD BAND — because the role-picker CANNOT COUNT.
 *
 *      let role=wantRoles[0],least=1e9;
 *      for(const r of wantRoles){
 *        const n=D.bands.filter(b=>b.role===r).length;
 *        if(n<least){least=n;role=r;}
 *      }
 *
 *    wantRoles is a list with REPEATS in it — `for(let i=0;i<PB.econHunters;i++)wantRoles.push("econ")`,
 *    with the comment "rush lives on dead supply chains". But a repeat cannot win this loop: the
 *    second "econ" computes the same n as the first and `n<least` is false. So the repeats have
 *    never done anything, and PERSONALITIES.rush.econHunters — a doctrine knob shipped at v94 — has
 *    been dead the whole time. rush has raided supply lines exactly as hard as turtle.
 *
 *    Fixed the way the list clearly meant: count how many bands a role is WANTED for, subtract how
 *    many exist, and take the largest deficit. That makes econHunters live for the first time AND
 *    lets the army want one hold band per square still up for grabs.
 *
 * ⚠ THIS IS A BALANCE CHANGE, and a bigger one than it looks: rush and expand get the econ raiders
 * their doctrine always said they had. Flagged to John rather than buried — it is the kind of thing
 * that should be felt in a playtest, not discovered later.
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

sub("an unheld square outranks a castle",
`function bandHoldPoint(team,idx){ // castles first, then denying a bazaar, then the road
  const own=buildings.filter(b=>b.alive&&b.built&&b.team===team&&b.type==="castle");
  if(own.length){const c=own[idx%own.length];const hr=(bSurf(c.def)+3)*0.7071; // +4,+4 was 5.66 out; a castle blocks to 19.8
    return {x:c.x+hr,z:c.z+hr,why:"castle"};}`,
`function bandHoldPoint(team,idx){ // an unheld SQUARE first, then a castle, then the road
  // v134.3 THE CASTLE USED TO COME FIRST, AND EVERY DOCTRINE BUILDS A CASTLE. From the moment the
  // first one finished, no band was ever posted to a bazaar again — which quietly retired the whole
  // v132.26 change below at about minute ten, and left squares paying 4 a second standing neutral
  // for a whole match (measured: seed 11, twenty minutes, one square never claimed by anybody).
  // Standing in your own courtyard is not worth more than the thing that pays. Once every square IS
  // yours the castle posting is right again, and that is exactly what this falls through to.
  const _free=(typeof neutralMarkets!=="undefined")?neutralMarkets.filter(m=>m.owner!==team):[];
  const own=buildings.filter(b=>b.alive&&b.built&&b.team===team&&b.type==="castle");
  if(own.length&&!_free.length){const c=own[idx%own.length];const hr=(bSurf(c.def)+3)*0.7071; // +4,+4 was 5.66 out; a castle blocks to 19.8
    return {x:c.x+hr,z:c.z+hr,why:"castle"};}`);

sub("the role picker learns to count",
`    const wantRoles=["patrol","econ","hold"];
    for(let i=0;i<(PB.econHunters||0);i++)wantRoles.push("econ"); // rush lives on dead supply chains
    if(roster.length>=20||D.raidUntil||((PB.assassins||0)&&roster.length>=10))wantRoles.push("assassin");
    while(roster.length>=5){
      // found the mission we're SHORTEST on — a persistent, self-balancing rotation
      let role=wantRoles[0],least=1e9;
      for(const r of wantRoles){
        const n=D.bands.filter(b=>b.role===r).length;
        if(n<least){least=n;role=r;}
      }`,
`    const wantRoles=["patrol","econ","hold"];
    for(let i=0;i<(PB.econHunters||0);i++)wantRoles.push("econ"); // rush lives on dead supply chains
    if(roster.length>=20||D.raidUntil||((PB.assassins||0)&&roster.length>=10))wantRoles.push("assassin");
    // v134.3 ONE HOLD BAND PER SQUARE STILL UP FOR GRABS. Three bazaars pay 1, 2 and 4 a second of
    // food AND gold AND wood by count held; an army that fields one hold band can take one square.
    {const _free=(typeof neutralMarkets!=="undefined")
        ?neutralMarkets.filter(m=>m.owner!==team).length:0;
     for(let i=1;i<_free&&wantRoles.length<9;i++)wantRoles.push("hold");}
    // v134.3 …AND THE PICKER CAN COUNT NOW. It used to be:
    //     let role=wantRoles[0],least=1e9;
    //     for(const r of wantRoles){const n=bands(r).length; if(n<least){least=n;role=r;}}
    // — which reads the list as a SET. A repeat computes the same n as its first occurrence and
    // n<least is false, so no repeat could ever win, so PERSONALITIES.rush.econHunters ("rush lives
    // on dead supply chains", v94) has done precisely nothing since the day it shipped and rush has
    // raided supply lines exactly as hard as turtle. Weight = how many times the role is asked for;
    // pick the biggest DEFICIT. ⚠ This is a real balance change for rush and expand.
    const _want={};
    for(const r of wantRoles)_want[r]=(_want[r]||0)+1;
    while(roster.length>=5){
      // the mission we are furthest SHORT on, counting how many of each the doctrine asked for
      let role=wantRoles[0],worst=-1e9;
      for(const r in _want){
        const def=_want[r]-D.bands.filter(b=>b.role===r).length;
        if(def>worst){worst=def;role=r;}
      }`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patch-bazaarwant-v134: OK");
