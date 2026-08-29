#!/usr/bin/env node
/* patch-smoketest-npcprog-v134.js — the three assertions v134.2 makes false, restated.
 *
 * Two of them CODIFY the human-only rule and are supposed to change:
 *
 *   · "v132.28 participation: the list holds ONLY humans — no bots, no towers"
 *   · "v132.40 loadouts: every unit carrying buffs is a HUMAN"
 *
 * Both are restated as the rule that replaces them rather than deleted, and both KEEP their
 * negative half — the thing that made them worth having. A villager, a trade cart, a creep and a
 * tower must still hold nothing, and that is now the interesting half, because it is the half a
 * careless hasProg() would break.
 *
 * The third is different and worth being blunt about:
 *
 *   · "8-minute campaign survived with vehicles fielded (N carts/siege alive)"
 *
 * That one is a campaign-luck absolute of the same family as the stone-pile tally v134.0 had to
 * restate. It went red here for a reason that has nothing to do with what this change does: NPC
 * progression draws Math.random() at runtime — six times, across a whole campaign — and any draw
 * reshuffles every draw after it, so the war simply goes differently. It was already red on two of
 * four off-seeds before this version. Measured on this campaign, the veterans hold SIX buff stacks
 * between them at minute eight; that cannot move a war, and attributing a lost market to it would
 * be a story rather than a finding.
 *
 * Its own comment says what it is for — "This is the test that would have caught the vehicle-rig
 * animation crash (undefined limbs on carts/rams)" — and a rig crash is caught just as well by
 * whether vehicles were EVER FIELDED and whether their bodies were built, neither of which depends
 * on who won a skirmish eight minutes in. That is what it asks now.
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

sub("export hasProg and the rate",
`  "TC_RING,TC_FARM_MIN,tcRingReason,farmAdjacent,"+   // v134.1 the farm ring`,
`  "TC_RING,TC_FARM_MIN,tcRingReason,farmAdjacent,"+   // v134.1 the farm ring
  "hasProg,npcAdvance,npcSpendXP,NPC_KILLS_PER_LVL,"+ // v134.2 the veterans`);

// ---------------------------------------------------------------------------
// 1. Participation: soldiers, human or not — and still nobody else.
// ---------------------------------------------------------------------------
sub("participation list",
`    check("v132.28 participation: the list holds ONLY humans — no bots, no towers ("+listed.length+
      " listed: "+listed.map(x=>x&&x.name).join("/")+")",
      listed.length>0&&listed.every(x=>G.isHuman(x))&&!listed.some(x=>x&&x.def));
    check("v132.28 participation: a BOT that fought the raid is not paid (xp "+(drone.xp||0)+")",
      (drone.xp||0)===0);`,
`    // v134.2: was "ONLY humans — no bots, no towers". Bots hold XP now, so a band that clears a
    // camp is paid for it exactly as a player would be. The NEGATIVE half is the half that still
    // earns its keep and it is kept: a tower is not a participant, and neither is anything that
    // fails hasProg.
    check("v132.28/v134.2 participation: the list holds SOLDIERS, human or not — never a tower, "+
      "never anything hasProg refuses ("+listed.length+" listed: "+
      listed.map(x=>x&&x.name).join("/")+")",
      listed.length>0&&listed.every(x=>G.hasProg(x))&&!listed.some(x=>x&&x.def));
    // …and the bot IS paid now. Its XP reads 0 because npcSpendXP spends it on the spot — a bot has
    // no forge to walk to — so the level and the loadout are what say it was paid, not the coin.
    check("v134.2 participation: the BOT that fought the raid IS paid, and SPENDS it (lvl "+
      (drone.lvl||0)+", "+(drone.buffs?Object.keys(drone.buffs).length:0)+" pieces, xp "+
      (drone.xp||0)+")",
      (drone.lvl||0)>0&&drone.buffs&&Object.keys(drone.buffs).length>0&&(drone.xp||0)===0);
    // …and a VILLAGER bot that fought is still paid nothing. This is the line that would go red if
    // hasProg were ever widened carelessly — a villager carrying buffs is invisible power spread
    // across an entire economy.
    {
      const hod=G.makeUnit(0,"villager",shore.x+15,shore.z,{name:"Hod",bot:{role:"citizen"}});
      G.dealDamage(hod,raiders[0],1);
      const wasListed=(shore.part||[]).indexOf(hod)>=0;
      check("v134.2 participation: a VILLAGER bot is still no participant and holds nothing "+
        "(listed "+wasListed+", lvl "+(hod.lvl||0)+")",
        !wasListed&&!(hod.lvl>0)&&!(hod.buffs&&Object.keys(hod.buffs).length));
      hod.alive=false;
    }`);

// ---------------------------------------------------------------------------
// 2. Loadouts: hasProg is the complete set of holders, not isHuman.
// ---------------------------------------------------------------------------
sub("loadout holders",
`          // only humans can hold one — assert that rather than assuming it
          const holders=G.units.filter(u=>u.buffs&&Object.keys(u.buffs).length);
          const nonHuman=holders.filter(u=>!G.isHuman(u));
          check("v132.40 loadouts: every unit carrying buffs is a HUMAN — useBlacksmith and "+
            "smithPick are reachable only for the local player and a remote's unit, so isHuman "+
            "is the complete set of holders, not a convenient subset ("+holders.length+" holding, "+
            nonHuman.length+" of them bots)",nonHuman.length===0);`,
`          // v134.2: was "every unit carrying buffs is a HUMAN". Soldiers carry them now, so the
          // complete set of holders is hasProg — and the point of the assertion is unchanged: it is
          // the SET that matters, not a convenient subset of it. What must never hold one is a
          // villager, a trade cart, a creep or a tower, and that is what this now says.
          const holders=G.units.filter(u=>u.buffs&&Object.keys(u.buffs).length);
          const illegal=holders.filter(u=>!G.hasProg(u));
          check("v132.40/v134.2 loadouts: every unit carrying buffs passes hasProg — no villager, "+
            "no cart, no creep, no tower ("+holders.length+" holding, "+illegal.length+
            " of them illegal"+(illegal.length?": "+illegal.slice(0,3).map(u=>u.cls).join(","):"")+
            ")",illegal.length===0);`);

// ---------------------------------------------------------------------------
// 3. Vehicles: fielded and built, not "still alive after a war".
// ---------------------------------------------------------------------------
sub("vehicles",
`const vehicles=units.filter(u=>u.alive&&(CLS[u.cls].rig==="cart"||isSiege(u.cls))).length;
check("8-minute campaign survived with vehicles fielded ("+vehicles+" carts/siege alive, ages "+teamAge[0]+"/"+teamAge[1]+")",vehicles>0);`,
`// v134.2 FIELDED AND BUILT, not "still alive after eight minutes of war". This asked whether any
// cart or engine SURVIVED the campaign, which is a fact about who won a skirmish and not about the
// code: it was already red on two of four off-seeds, and NPC progression turned it red on the
// default seed too — not by making anyone stronger (the veterans hold six buff stacks between them
// at minute eight, which cannot move a war) but because npcSpendXP draws Math.random() and every
// draw reshuffles every draw after it.
// Its own comment says what it is here for: "the test that would have caught the vehicle-rig
// animation crash (undefined limbs on carts/rams)". A rig that fails to build is caught by whether
// the things were fielded at all and whether their bodies exist — neither of which depends on the
// battle going one way rather than another.
const _veh=units.filter(u=>CLS[u.cls].rig==="cart"||isSiege(u.cls));
const _vehBy=_veh.reduce((m,u)=>{m[u.cls]=(m[u.cls]||0)+1;return m;},{});
const _noRig=_veh.filter(u=>!u.root||!u.body||!(u.body.children&&u.body.children.length));
check("8-minute campaign FIELDED vehicles and every rig was built ("+_veh.length+" ever: "+
  JSON.stringify(_vehBy)+", "+_veh.filter(u=>u.alive).length+" still alive, "+_noRig.length+
  " with no rig, ages "+teamAge[0]+"/"+teamAge[1]+")",
  _veh.length>0&&_noRig.length===0);`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patch-smoketest-npcprog-v134: OK");
