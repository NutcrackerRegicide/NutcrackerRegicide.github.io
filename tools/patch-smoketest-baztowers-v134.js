#!/usr/bin/env node
/* patch-smoketest-baztowers-v134.js — gates for v134.6, and one more aura gate that was counting
 * the whole scene when its claim is about one dead unit.
 *
 * THE TOWER GATES are constructed, because the campaign cannot be relied on to reach the age: a
 * Guard Tower is BLD.tower.age 3 and a twenty-minute AI game usually ends at age 2. Measured across
 * three seeds with this version in: seed 33 (ages 0/2) built NONE, seed 11 (age ~2) built one, and
 * seed 44 (ages 3/3) built three for blue and one for red — one per held square, exactly as asked,
 * and blue finished holding all three squares. So the behaviour is right and the OPPORTUNITY is
 * rare; the gates stage the age rather than hoping for it.
 *
 * THE ONE WITH TEETH is the plaza. validFor knows nothing about bazaars — they live in
 * neutralMarkets, not in `buildings` — so nothing in the placement rules stops a tower being
 * dropped ON the square it is meant to guard, which would stand on the capture ground itself.
 * The ring is enforced by hand in bazTowerSpot and this is what proves it.
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

sub("export the tower dials",
`  "bazaarWorth,HOLD_TOUR,"+                            // v134.5 what the squares pay`,
`  "bazaarWorth,HOLD_TOUR,"+                            // v134.5 what the squares pay
  "bazTowerSpot,BAZ_TOWERS,BAZ_TOWER_GAP,BAZ_TOWER_OUT,BAZ_TOWER_STONE,"+ // v134.6 towers on them`);

sub("the dead owner's cloud is about the DEAD OWNER, here too",
`      beforeDeath>=25&&orphans===0&&stillHis===0);`,
`      // v134.6: orphans, not the whole sky. stillHis counts every mote alive ANYWHERE, and since
      // v134.2 veteran bots hold blacksmith buffs — so one healthy aura-holder somewhere on the
      // map, doing its job, failed a gate about a DEAD unit's cloud. Same correction as the
      // v132.53 lit/deadLit gate took in v134.5. stillHis stays in the message, where it is
      // informative, and comes out of the verdict, where it was somebody else's business.
      beforeDeath>=25&&orphans===0);`);

sub("the band bench parks the strays before it trickles",
`    G.manageBands(D);                          // …and the dead are pruned back out of the bands
    const before=D.bands.filter(b=>b.role!=="kingsguard"&&b.role!=="siege").length;`,
`    G.manageBands(D);                          // …and the dead are pruned back out of the bands
    // v134.6 …AND NOBODY IS LEFT LOOSE. The whole point of this staging is that THREE is below
    // BAND_MIN, so the ordinary deal loop cannot fire and only the founding pass can answer. One
    // stray campaign body loose on the board makes the trickle FOUR, the deal loop fires, and it
    // reinforces the standing band because that band has room — which is correct behaviour and a
    // dead gate. It went red the moment v134.5 made "hold" the deepest deficit: "the standing band
    // went 4 -> 8". Park whatever is loose into the standing band first, then trickle exactly three.
    if(keep)for(const v of G.units){
      if(!v.alive||v.team!==team||!v.bot||v.isKing||G.isWorker(v))continue;
      if(G.CLS[v.cls].line==="healer")continue;
      if(v.bandRef&&D.bands.includes(v.bandRef))continue;
      v.bandRef=keep; keep.members.push(v);
    }
    const before=D.bands.filter(b=>b.role!=="kingsguard"&&b.role!=="siege").length;`);

sub("…and the band bench measures the band it actually staged",
`      before===1&&after===2&&kept===4&&grew===4);`,
`      // v134.6: kept is whatever the staging ended up with — four of its own plus any strays it
      // parked — so the verdict is that the standing band did not GROW, not that it holds a
      // particular number. A literal 4 here was the staging leaking into the claim.
      before===1&&after===2&&kept>=4&&grew===kept);`);

sub("the watchdog treadmill clears its ground too",
`  {
    const u=pGuy(-120,-100,"Treadmill");
    const home={x:u.root.position.x,z:u.root.position.z};`,
`  {
    // v134.6: …AND THIS ONE CLEARS ITS GROUND AS WELL. Benches 1 and 2 were given clearGround at
    // v134.4 and this one was missed. On SMOKE_SEED=1 the campaign now builds at (-120,-100), the
    // treadmill body started INSIDE a collider, and pushOutOfBuildings shoved it 2.38 a frame —
    // six times a villager's own step — so the bench measured a body being ejected from a wall
    // rather than a body on a treadmill, and reported the watchdog as never firing.
    const _twr=clearGround(-120,-100,24);
    const u=pGuy(-120,-100,"Treadmill");
    const home={x:u.root.position.x,z:u.root.position.z};`);

sub("…and puts the treadmill's ground back",
`      fired>0&&fired<=G.MOVE_STALL_T+0.3&&realMotion>0.1);
    wipe();`,
`      fired>0&&fired<=G.MOVE_STALL_T+0.3&&realMotion>0.1);
    _twr(); wipe();                                   // v134.6: the neighbours stand back up`);

sub("the rewind ring is staged away from the origin",
`    const spot=(()=>{
      for(let x=-120;x<=120;x+=15)for(let z=-120;z<=120;z+=15){`,
`    // v134.6 ⚠ AND NOT AT THE ORIGIN. The clamp test below reads "the rewound x is far from 0" as
    // its proof that the ring returned the OLDEST SAMPLE rather than falling back to the world
    // origin — and if the empty corner it stages in happens to be x=0 those two are the same point,
    // so the gate cannot pass however correctly the ring behaves. SMOKE_SEED=1 found that corner.
    const spot=(()=>{
      for(let x=-120;x<=120;x+=15)for(let z=-120;z<=120;z+=15){
        if(Math.abs(x)<30)continue;`);

sub("the v134.6 bench",
`console.log(fails?("\\n"+fails+" FAILURES"):"\\nALL SMOKE TESTS PASSED");`,
`// ==================== v134.6 TOWERS ON THE SQUARES ====================
{
  const G=global.__G;
  const NM=G.neutralMarkets, own0=NM.map(m=>m.owner);
  const setOwn=(a)=>{for(let i=0;i<NM.length;i++)NM[i].owner=a[i];};

  // --- 1. THE RING. A tower must stand OFF the plaza it guards and inside its own 18 of range.
  //        validFor cannot see a bazaar at all — they are not in the buildings list — so nothing but
  //        rule keeps a tower off the capture ground.
  {
    const team=G.BLUE;
    let bad=0, tried=0, near=1e9, far=0;
    for(const m of NM){
      for(let i=0;i<12;i++){
        const s=G.bazTowerSpot(team,m);
        if(!s)continue;
        tried++;
        const d=Math.hypot(s.x-m.x,s.z-m.z), plaza=(m.plaza||8.6);
        if(d<plaza+G.BAZ_TOWER_GAP-0.01)bad++;          // on the square itself
        if(d>G.BLD.tower.atk.rng)bad++;                 // …or too far out to shoot over it
        near=Math.min(near,d); far=Math.max(far,d);
      }
    }
    check("v134.6 towers: every spot the marshal picks is OFF the plaza and inside the tower's own "+
      "reach ("+tried+" spots sampled across the three squares, nearest "+near.toFixed(1)+
      ", furthest "+far.toFixed(1)+", against plazas of "+NM.map(m=>(m.plaza||8.6)).join("/")+
      " and a range of "+G.BLD.tower.atk.rng+"). validFor knows nothing about bazaars — they are "+
      "not in the buildings list — so a tower on the capture ground is refused by this rule or by nothing",
      tried>=6&&bad===0);
  }

  // --- 2. IT RAISES ONE OVER A SQUARE IT HOLDS, and stops at BAZ_TOWERS. Staged, because the
  //        opportunity is rare: a Guard Tower is age 3 and a twenty-minute AI game ends at age 2.
  {
    const team=G.RED, D=G.directors[team];
    const age0=G.teamAge[team], st0={food:G.stock[team].food,gold:G.stock[team].gold,
      stone:G.stock[team].stone,wood:G.stock[team].wood};
    const before=G.buildings.filter(b=>b.alive&&b.team===team&&b.type==="tower");
    for(const b of before)b.alive=false;              // a clean board for the count
    const pend=G.buildings.filter(b=>b.alive&&b.team===team&&!b.built);
    for(const b of pend)b.built=true;                 // …and no queue in the way
    G.teamAge[team]=Math.max(3,age0);
    G.stock[team].stone=4000; G.stock[team].wood=4000; G.stock[team].food=4000; G.stock[team].gold=4000;
    setOwn([team,-1,-1]);
    const held=NM[0];
    let raised=0;
    for(let i=0;i<8;i++){ D.nextThink=0; G.directorThink(D); }
    const mine=G.buildings.filter(b=>b.alive&&b.team===team&&b.type==="tower");
    let onSq=0, offPlaza=true;
    for(const b of mine){
      const d=Math.hypot(b.x-held.x,b.z-held.z);
      if(d<(held.plaza||8.6)+G.BAZ_TOWER_GAP-0.01)offPlaza=false;
      if(d<(held.plaza||8.6)+G.BAZ_TOWER_GAP+G.BAZ_TOWER_OUT+2)onSq++;
    }
    raised=mine.length;
    for(const b of mine)b.alive=false;
    for(const b of before)b.alive=true;
    for(const b of pend)b.built=false;
    G.teamAge[team]=age0;
    G.stock[team].food=st0.food; G.stock[team].gold=st0.gold;
    G.stock[team].stone=st0.stone; G.stock[team].wood=st0.wood;
    setOwn(own0);
    check("v134.6 towers: a marshal holding a square raises a Guard Tower over it and STOPS at "+
      G.BAZ_TOWERS+" ("+raised+" raised across eight think-clocks, "+onSq+" of them ringing the "+
      "square, none on the plaza: "+offPlaza+"). 250 stone apiece against 4,200 on the whole map "+
      "is why the cap is what it is",
      raised>=1&&raised<=G.BAZ_TOWERS&&onSq>=1&&offPlaza);
  }

  // --- 3. THE OX CAP, which is John's dial and the reason this version exists. One ox, not two.
  {
    const team=G.RED, D=G.directors[team];
    const st0={food:G.stock[team].food,gold:G.stock[team].gold,wood:G.stock[team].wood};
    const standing=G.units.filter(u=>u.alive&&u.team===team&&u.cls==="oxcart");
    for(const u of standing)u.alive=false;
    const pit=G.makeBuilding(team,"storage_pit",164,-146,true);
    const made=[]; const seam=G.nodes.find(n=>n.type==="wood"&&n.amount>0);
    for(let i=0;i<14;i++){
      const v=G.makeUnit(team,"villager",152+(i%7)*2,-146-((i/7)|0)*2,
        {name:"Cap"+i,bot:{role:"citizen",res:"wood"}});
      if(i<4)v.bot.node=seam;
      made.push(v);
    }
    const ox=G.makeUnit(team,"oxcart",164,-150,{name:"CapOx",bot:{role:"citizen",res:"wood"}});
    G.stock[team].food=4000; G.stock[team].gold=4000; G.stock[team].wood=G.OX_WOOD_WANT-200;
    let ordered=0;
    for(let i=0;i<6;i++){ D.oxT=0; G.stock[team].wood=G.OX_WOOD_WANT-200; G.directorThink(D);
      ordered=G.units.filter(v=>v.alive&&v.team===team&&v.convertTo==="oxcart").length; }
    for(const v of G.units)if(v.team===team&&v.convertTo==="oxcart"){v.convertTo=null;v.convertAt=null;}
    ox.alive=false; pit.alive=false; for(const v of made)v.alive=false;
    for(const u of standing)u.alive=true;
    G.stock[team].food=st0.food; G.stock[team].gold=st0.gold; G.stock[team].wood=st0.wood;
    check("v134.6 ox: with ONE ox already yoked and timber still short, the marshal orders no "+
      "second ("+ordered+" ordered, cap "+G.OX_MAX+"). John, after the first playtest of v134.4: "+
      "\\"wood is being gathered extremely fast with two NPC oxcarts. Could reduce this to one\\" — "+
      "an ox is four times the axe AND a fifteenth of the walking, so the second one is worth "+
      "closer to fifteen villagers than to one",
      G.OX_MAX===1&&ordered===0);
  }
}

console.log(fails?("\\n"+fails+" FAILURES"):"\\nALL SMOKE TESTS PASSED");`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patch-smoketest-baztowers-v134: OK");
