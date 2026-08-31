#!/usr/bin/env node
/* patch-smoketest-oxcart-v134.js — gates for v134.4: the far side, and the ox.
 *
 * THE ONE THAT MATTERS. Three approaches in 07-ai.js walked to a fixed corner of a building and
 * declared arrival inside a tolerance that only the near side could satisfy. The suite HAD a gate
 * aimed straight at this — "the gates that aim off-centre are physically satisfiable" — and it
 * passed, every run, because it computed `best = ring - off`: the LUCKY approach. The honest
 * question is `ring + off`, and nobody ever asked it. So the gates below are benches, not
 * arithmetic: they stand the body on the FAR side and watch whether it ever arrives. A bench cannot
 * quietly test the favourable case.
 *
 * The three of them go red on v134.3 — 0 wood banked, 0 conversions, 0 gold delivered in a full
 * sim-minute apiece — and green after. That is what the falsify runs are for, and it is why the
 * old arithmetic gate is retired here rather than repaired: it certified a coin flip.
 *
 * THE OX GATES are mostly about what an ox must NOT be. It is a civilian on bot.role "citizen", so
 * every rule that spells "civilian" as cls==="villager" would have swept it up: into a mission
 * band, into the raid-wave count, into veteran progression. Those are the assertions with teeth.
 *
 * AND FOUR EXISTING GATES that were reading the shorthand or standing on ground the campaign now
 * uses differently: the 20-carry cap (an ox bed holds 300, by design), the v124 roster hand-count
 * (a trade cart is a civilian now), and the three camp gates that wipe camp 0 and expect a chest —
 * which need the pack ALIVE to wipe, and the v134.3 camp bands may have got there first.
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

sub("export the v134.4 layer",
`  "bandCampTarget,CAMP_MIN_MIL,CAMP_MAX_THREAT,BAND_MIN,BAND_SEED,campStates,"+ // v134.3 the wilds`,
`  "bandCampTarget,CAMP_MIN_MIL,CAMP_MAX_THREAT,BAND_MIN,BAND_SEED,campStates,"+ // v134.3 the wilds
  "isWorker,OX_MAX,OX_MIN_VILLS,OX_MIN_CUTTERS,OX_WOOD_WANT,OX_WOOD_FULL,manageBands,"+ // v134.4 the ox`);

sub("the carry cap is the UNIT's, not a flat 20",
`check("no unit ever exceeds the 20-carry cap",
  units.every(u=>u.carry.food+u.carry.gold+u.carry.stone+u.carry.wood<=20));`,
`// v134.4: the cap is carryCap(u), not the flat 20 this asserted. A villager's is 20 (more with
// Deep Satchel); AN OX BED HOLDS 300, which is the entire point of yoking one, and this gate would
// have called the feature working as designed a bug. Assert the rule the game actually enforces.
{
  const over=units.filter(u=>u.carry.food+u.carry.gold+u.carry.stone+u.carry.wood>global.__G.carryCap(u)+0.001);
  const ox=units.filter(u=>u.cls==="oxcart");
  let most=0; for(const u of units)most=Math.max(most,u.carry.food+u.carry.gold+u.carry.stone+u.carry.wood);
  check("no unit ever exceeds ITS OWN carry cap (heaviest load seen "+Math.round(most)+
    ", oxen on the field "+ox.length+" at a cap of "+(ox.length?global.__G.carryCap(ox[0]):300)+")",
    over.length===0);
}`);

sub("the roster hand-count knows a civilian when it sees one",
`  for(const u of G.units){
    if(!u.alive||u.isKing)continue;
    if(u.team===G.BLUE)u.cls==="villager"?bv++:bm++;
    else if(u.team===G.RED)u.cls==="villager"?rv++:rm++;
  }`,
`  for(const u of G.units){
    if(!u.alive||u.isKing)continue;
    // v134.4: the hand-count has to use the same DEFINITION as the HUD or it is testing a different
    // question. A trade cart and an ox carry no weapon; they are counted with the villagers now.
    if(u.team===G.BLUE)G.isWorker(u)?bv++:bm++;
    else if(u.team===G.RED)G.isWorker(u)?rv++:rm++;
  }`);

sub("the camp to be wiped is staged alive",
`  const camp0=CS[0], slayer=G.makeUnit(0,"clubman",camp0.x,camp0.z,{name:"Slayer",bot:{role:"citizen"}});`,
`  // v134.4: …AND THE PACK HAS TO BE STANDING BEFORE YOU CAN WIPE IT. Since v134.3 the AI sends
  // camp bands into the wilds, so by the time this runs the pack may already be dead and the pocket
  // WAITING — and then "a wiped camp drops a treasure chest" fails on a camp nobody wiped, taking
  // the chest-type and first-boot gates with it. Three reds for a feature working as designed.
  const camp0=CS[0];
  if(camp0.waiting||!camp0.creeps.some(c=>c.alive)){
    camp0.waiting=false;
    for(const c of camp0.creeps){c.alive=true;c.hp=c.maxHp;}
    camp0.chest=null;
  }
  const slayer=G.makeUnit(0,"clubman",camp0.x,camp0.z,{name:"Slayer",bot:{role:"citizen"}});`);

sub("the off-centre harness keeps only the aim that is still off-centre",
`  const haul =lift("hauler drop-off stop","07-ai.js","if(moveToward(u,dp.x+2.5,dp.z+2,dt,",")",["dp"]);
  const arm  =lift("citizen arm-up stop", "07-ai.js","if(moveToward(u,bar.x+3,bar.z+3,dt,",")",["bar"]);
  const ageUp=lift("age-up radius","06-input.js",`,
`  // v134.4 THE HAULER AND THE ARM-UP ARE GONE FROM THIS HARNESS, and not because they were fixed
  // quietly — because this harness is what let them ship broken. It computed best = ring - off, the
  // approach from the side the offset points at, and asked whether THAT cleared the tolerance. It
  // did. From the other three quarters of the circle the same arithmetic reads ring + off:
  //     hauler at a pit        stop  8.34   near 4.40   FAR 10.80
  //     hauler at a castle     stop 17.10   near 16.60  FAR 23.00
  //     citizen at a barracks  stop  9.96   near 7.36   FAR 15.84
  //     trade cart at a market stop 11.60   near 6.20   FAR 23.20
  // All four unreachable from the far side, all four certified green here for the whole of v131 to
  // v134.3. Both approaches now walk to the nearest point of the ring, so there is no "off" left to
  // gate — and the replacement is not more arithmetic, it is the three BENCHES at the end of this
  // file that stand a body on the wrong side and watch whether it ever arrives.
  const ageUp=lift("age-up radius","06-input.js",`);

sub("…and only gates what is left",
`  const H=Math.hypot(2.5,2);                                   // 07-ai.js:969's drop point offset
  gate("hauler banks at a town centre",haul,{def:BLD.towncenter,type:"towncenter"}, H,false);
  gate("hauler banks at a castle",     haul,{def:BLD.castle,     type:"castle"},     H,false);
  gate("hauler banks at a storage pit",haul,{def:BLD.storage_pit,type:"storage_pit"},H,false);
  gate("citizen arms up at a barracks",arm, {def:BLD.barracks},   Math.hypot(3,3),false); // 07-ai.js:917
  gate("player advances the age",      ageUp,{def:BLD.towncenter},0,true);                // 06-input.js:981`,
`  gate("player advances the age",      ageUp,{def:BLD.towncenter},0,true);                // 06-input.js:981`);

sub("…and says what it still covers",
`  check("the off-centre gates found the expressions they test ("+
        (missing.length?"MISSING: "+missing.join(" · "):"hauler, arm-up and age-up all lifted from source")+")",
        missing.length===0);`,
`  check("the off-centre gates found the expressions they test ("+
        (missing.length?"MISSING: "+missing.join(" · "):"the age-up radius, the last aim in the game "+
         "that is still a fixed distance from a centre, lifted from source")+")",
        missing.length===0);`);

sub("the v134.4 bench",
`console.log(fails?("\\n"+fails+" FAILURES"):"\\nALL SMOKE TESTS PASSED");`,
`// ==================== v134.4 THE FAR SIDE, AND THE OX ====================
{
  const G=global.__G;
  // Clear ground to build on: these benches are about ONE building and one body, and the campaign
  // has been building all over the map for eight minutes. Same trick the v134.0 benches use.
  const clearGround=(x,z,r)=>{const hid=[];
    for(const b of G.buildings)if(b.alive&&Math.hypot(b.x-x,b.z-z)<r){b.alive=false;hid.push(b);}
    return ()=>{for(const b of hid)b.alive=true;};};
  const spot=(()=>{ // a patch of open ground behind blue's lines
    for(let z=-140;z<=-40;z+=20)for(let x=-200;x<=-60;x+=20)
      if(G.walkable(x,z)&&!G.buildings.some(b=>b.alive&&Math.hypot(b.x-x,b.z-z)<26))return {x,z};
    return {x:-150,z:-100};
  })();
  const run=(u,secs)=>{for(let i=0;i<Math.round(secs*30);i++){G.updateBot(u,1/30);G.advanceT(1/30);}};

  // --- 1. THE HAUL, FROM THE FAR SIDE. The old aim point was (dp.x+2.5, dp.z+2); a body standing
  //        WEST of the store can never get within the tolerance of a point east of its centre, so
  //        it stalls nine paces out, sidesteps, comes back, and carries the load all match.
  //        Benched on v134.3 and on pristine v133: 0 wood banked in five minutes.
  {
    const restore=clearGround(spot.x,spot.z,30);
    const pit=G.makeBuilding(0,"storage_pit",spot.x,spot.z,true);
    const u=G.makeUnit(0,"villager",pit.x-13,pit.z,{name:"FarHauler",bot:{role:"citizen",res:"wood"}});
    u.carry.wood=20; u.bot.haul=true; u.bot.node=null;
    const w0=G.stock[0].wood;
    run(u,45);
    const banked=G.stock[0].wood-w0, d=Math.hypot(u.root.position.x-pit.x,u.root.position.z-pit.z);
    const steps=u._stkT||0;
    u.alive=false; pit.alive=false; restore();
    check("v134.4 far side: a hauler standing WEST of a Storage Pit banks its twenty logs ("+
      Math.round(banked)+" banked, ended "+d.toFixed(1)+" from the store). The aim used to be a "+
      "fixed corner INSIDE the collider — reachable from the north-east and from nowhere else, "+
      "which benched at 0 banked in five minutes on v134.3 and on pristine v133 alike. It walks "+
      "straight in: "+steps+" sidesteps issued",
      banked>=20&&steps===0);
  }

  // --- 2. THE ARM-UP, FROM THE FAR SIDE. Same bug, more expensive: the team has already PAID for
  //        the conversion when the citizen sets off.
  {
    const restore=clearGround(spot.x,spot.z,34);
    const bar=G.makeBuilding(0,"barracks",spot.x,spot.z,true);
    const u=G.makeUnit(0,"villager",bar.x-16,bar.z,{name:"FarRecruit",bot:{role:"citizen",res:"food"}});
    u.convertTo="clubman"; u.convertAt="barracks";
    run(u,30);
    const cls=u.cls, d=Math.hypot(u.root.position.x-bar.x,u.root.position.z-bar.z);
    const steps=u._stkT||0;
    u.alive=false; bar.alive=false; restore();
    check("v134.4 far side: a citizen approaching a barracks from the WEST completes its arm-up "+
      "(ended a "+cls+", "+d.toFixed(1)+" from the door). The old aim was (bar.x+3, bar.z+3) "+
      "against a stop of 9.96 — near side 7.36, far side 15.84 — and the food and gold were spent "+
      "the moment it set off. ⚠ ARRIVAL ALONE IS NOT THE TEST: given a minute, a body with a "+
      "watchdog behind it can sidestep its way round a building and stumble onto the lucky side, "+
      "which is how the first cut of this bench passed with the old aim restored. It has to walk "+
      "STRAIGHT in — "+steps+" sidesteps issued",
      cls==="clubman"&&steps===0);
  }

  // --- 3. THE TRADE CART, FROM THE FAR SIDE. Worst of the three by the arithmetic: a fixed point
  //        bSurf+2 EAST of the market, 14.7 off centre, against a stop of 11.60.
  {
    const restore=clearGround(spot.x,spot.z,34);
    const mk=G.makeBuilding(0,"market",spot.x,spot.z,true);
    const u=G.makeUnit(0,"tradecart",mk.x-18,mk.z,{name:"FarCart",bot:{role:"cart",home:mk}});
    u.tradeTarget={x:mk.x-60,z:mk.z}; u.tradePhase="back";
    const g0=G.stock[0].gold;
    // ⚠ WHERE IT PAYS, NOT HOW FAST. Two weaker versions of this bench passed with the bug put
    // back: "it eventually pays" (given forty-five seconds a cart orbits its market and stumbles
    // onto the lucky side) and "it pays within twelve" (twelve seconds is ninety paces for a cart —
    // still enough to go round). The sidestep count that catches the other two benches is no good
    // here either: a cart is wide and takes a legitimate step or two rounding its own market. What
    // cannot be faked is WHICH SIDE it is standing on when the gold lands. The cart comes from the
    // west; the fix aims it at the ring point in the direction it came, so it pays on the west
    // side. The old fixed aim was a spot EAST of the market, so paying there means it drove round.
    let paid=0, payX=null;
    for(let i=0;i<30*45&&paid<=0;i++){
      G.updateBot(u,1/30); G.advanceT(1/30);
      paid=G.stock[0].gold-g0;
      if(paid>0)payX=u.root.position.x-mk.x;
    }
    const phase=u.tradePhase;
    const steps=u._stkT||0;
    u.alive=false; mk.alive=false; restore();
    check("v134.4 far side: a trade cart whose bazaar lies WEST of its market delivers its gold (+"+
      Math.round(paid)+", phase now "+phase+"). v104 shipped this aiming at a fixed spot east of "+
      "the market; a cart on the wrong side orbited its own home for the rest of the match. It "+
      "delivers on the side it came from (+"+Math.round(paid)+" gold, paid standing "+
      (payX===null?"nowhere":(Math.abs(payX).toFixed(1)+" "+(payX<0?"WEST":"east")+" of the market"))+
      ", "+steps+" sidesteps on the way)",
      paid>0&&payX!==null&&payX<0); // …and NOT the phase, which by then may already be the next run
  }

  // --- 4. WHAT AN OX IS NOT. It is a civilian riding bot.role "citizen", so every rule that spells
  //        "civilian" as cls==="villager" would sweep it up. These are the assertions with teeth.
  {
    const team=G.RED, D=G.directors[team], bands0=D.bands;
    D.bands=[];
    const made=[];
    for(let i=0;i<12;i++)made.push(G.makeUnit(team,"clubman",140+(i%6)*2,-150-((i/6)|0)*2,
      {name:"OxBand"+i,bot:{role:"war"}}));
    const ox=G.makeUnit(team,"oxcart",142,-152,{name:"BenchOx",bot:{role:"citizen",res:"wood"}});
    made.push(ox);
    for(const u of made)u.bandRef=null;
    G.manageBands(D);
    const drafted=!!ox.bandRef||D.bands.some(b=>b.members.includes(ox));
    const prog=G.hasProg(ox);
    const worker=G.isWorker(ox), cartWorker=G.isWorker({cls:"tradecart"}), soldier=G.isWorker(made[0]);
    D.bands=bands0;
    for(const u of made){u.bandRef=null;u.alive=false;}
    check("v134.4 the ox is a CIVILIAN: never dealt into a band ("+(drafted?"DRAFTED":"left alone")+
      "), earns no veteran levels (hasProg "+prog+"), and isWorker reads ox "+worker+" / trade cart "+
      cartWorker+" / clubman "+soldier+". Every 'cls!==villager' in the marshal's file meant this, "+
      "and a trade cart has quietly failed four of these tests since v99",
      !drafted&&!prog&&worker&&cartWorker&&!soldier);
  }

  // --- 5. THE OX AT WORK: four logs a swing into a bed of 300, and it will not touch anything else.
  {
    const wood=G.nodes.find(n=>n.type==="wood"&&n.amount>60);
    const gold=G.nodes.find(n=>n.type==="gold"&&n.amount>0);
    const ox=G.makeUnit(0,"oxcart",wood.x+1.5,wood.z+1.5,{name:"WorkOx",bot:{role:"citizen",res:"wood"}});
    ox.bot.node=wood; ox.bot.off={x:0.5,z:0.5};
    const a0=wood.amount;
    run(ox,20);
    const took=a0-wood.amount, carried=ox.carry.wood;
    // …and offered nothing but gold, it waits rather than rotating onto a vein it cannot touch
    const ox2=G.makeUnit(0,"oxcart",gold.x+1.5,gold.z+1.5,{name:"SnubOx",bot:{role:"citizen",res:"wood"}});
    ox2.bot.node=null;
    const seams=G.nodes.filter(n=>n.type==="wood"&&n.amount>0).map(n=>n.amount);
    for(const n of G.nodes)if(n.type==="wood")n.amount=0;   // the world is out of timber
    run(ox2,4);
    const res2=ox2.bot.res, node2=ox2.bot.node?ox2.bot.node.type:"none";
    {let i=0;for(const n of G.nodes)if(n.type==="wood")n.amount=seams[i++];}
    ox.alive=false; ox2.alive=false;
    check("v134.4 the ox works timber and only timber: "+took+" logs off the seam in 20s carrying "+
      Math.round(carried)+" of a 300 bed (a villager takes one a swing and walks home at 20) — and "+
      "with every seam in the world empty it WAITS rather than rotating onto gold it cannot touch "+
      "(res "+res2+", node "+node2+")",
      took>=40&&carried>=40&&res2==="wood"&&node2==="none");
  }

  // --- 6. THE MARSHAL'S RULE: yoke when timber is short, unyoke when the stores are full.
  {
    const team=G.RED, D=G.directors[team];
    const w0=G.stock[team].food, g0=G.stock[team].gold, wd0=G.stock[team].wood;
    // stand a pit up and make sure there are hands to spare and seams being worked
    const pit=G.makeBuilding(team,"storage_pit",160,-150,true);
    const made=[];
    const seam=G.nodes.find(n=>n.type==="wood"&&n.amount>0);
    for(let i=0;i<14;i++){
      const v=G.makeUnit(team,"villager",150+(i%7)*2,-150-((i/7)|0)*2,{name:"Hands"+i,bot:{role:"citizen",res:"wood"}});
      if(i<4)v.bot.node=seam;
      made.push(v);
    }
    G.stock[team].food=4000; G.stock[team].gold=4000; G.stock[team].wood=OX_SHORT();
    // ⚠ AND THE TEAM HAS TO BE UNDER ITS OWN CAP, or this gate tests nothing. The campaign above
    // yokes oxen of its own — RED had three standing when this first ran — so oxen<OX_MAX was
    // already false and the marshal was right to order none. Take the standing ones off the board
    // for the length of the bench and put them back after.
    const standing=G.units.filter(u=>u.alive&&u.team===team&&u.cls==="oxcart");
    for(const u of standing)u.alive=false;
    let ordered=0;
    for(let i=0;i<6&&!ordered;i++){ // directorThink has a think clock of its own
      D.oxT=0; G.stock[team].wood=OX_SHORT();
      G.directorThink(D);
      // ⚠ ANY villager of this team, not just the ones this bench made. idleCitizen returns the
      // first idle body it finds, which is as likely to be one the campaign raised — the first cut
      // counted only its own and reported "0 ordered" on a marshal that had just yoked an ox.
      ordered=G.units.filter(v=>v.alive&&v.team===team&&v.convertTo==="oxcart").length;
    }
    for(const u of standing)u.alive=true;
    // …and now the stores are full: an ox already standing is stood down
    const ox=G.makeUnit(team,"oxcart",160,-155,{name:"FullOx",bot:{role:"citizen",res:"wood"}});
    let stoodDown=false;
    for(let i=0;i<6&&!stoodDown;i++){
      G.stock[team].wood=G.OX_WOOD_FULL+500; D.oxT=0;
      G.directorThink(D);
      stoodDown=ox.cls==="villager";
    }
    // …and a LOADED bed is never stood down: the same ox, holding logs, keeps its yoke
    const ox2=G.makeUnit(team,"oxcart",162,-155,{name:"LoadedOx",bot:{role:"citizen",res:"wood"}});
    ox2.carry.wood=120;
    for(let i=0;i<4;i++){G.stock[team].wood=G.OX_WOOD_FULL+500; D.oxT=0; G.directorThink(D);}
    const keptLoaded=ox2.cls==="oxcart";
    ox2.alive=false;
    G.stock[team].food=w0; G.stock[team].gold=g0; G.stock[team].wood=wd0;
    ox.alive=false; pit.alive=false; for(const v of made){v.convertTo=null;v.alive=false;}
    for(const v of G.units)if(v.team===team&&v.convertTo==="oxcart"){v.convertTo=null;v.convertAt=null;}
    check("v134.4 the marshal yokes an ox when timber is short ("+ordered+" ordered at a wood stock "+
      "under "+G.OX_WOOD_WANT+") and UNYOKES one when the stores are full over "+G.OX_WOOD_FULL+
      " ("+(stoodDown?"stood down":"still yoked")+"). Measured: two oxen that were never stood down "+
      "filled a team's stores to 14,012 wood it had nothing to spend on, with two bodies off the "+
      "fields to do it. A LOADED ox keeps its yoke ("+(keptLoaded?"kept":"STOOD DOWN LOADED")+
      ") — standing one down at 280 logs would leave a villager carrying fourteen times its cap",
      ordered>=1&&stoodDown&&keptLoaded);
  }
}

console.log(fails?("\\n"+fails+" FAILURES"):"\\nALL SMOKE TESTS PASSED");`);

// the shorthand the yoke gate needs: a wood stock the marshal will call short
s=s.replace(`// ==================== v134.4 THE FAR SIDE, AND THE OX ====================`,
`function OX_SHORT(){return Math.max(0,global.__G.OX_WOOD_WANT-200);}
// ==================== v134.4 THE FAR SIDE, AND THE OX ====================`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patch-smoketest-oxcart-v134: OK");
