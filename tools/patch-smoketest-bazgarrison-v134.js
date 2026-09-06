#!/usr/bin/env node
/* patch-smoketest-bazgarrison-v134.js — the gates for v134.10's bazaar garrison.
 *
 * Four claims, and each is asked of the thing that decides it rather than of a number typed
 * somewhere else:
 *
 *  1. THE LEDGER. A capture is recorded against the team that LOST the square and nobody else —
 *     driven through the real flip (bazaarTaken), not by poking the field.
 *  2. THE RAMP. bazTowerWant reads 2 / 3 / 4 / 4 for 0 / 1 / 2 / 3 losses, per team per square,
 *     and one team's losses never size the other's garrison.
 *  3. THE RING IS A RING. Deal a square its full garrison through bazTowerSpot and measure the
 *     closest pair of bearings. Under the old rule — keep the legal spot nearest home — they huddle;
 *     under this one they take their share of the ring. The gate reports both.
 *  4. THE RESERVE IS DERIVED. BAZ_TOWER_STONE is the castle's own stone cost, so a garrison that
 *     can want twelve towers cannot eat the keep behind it.
 *
 * …and the v134.6 gate that asserted "STOPS at 1" is rewritten rather than left to pass by luck: a
 * fresh square wants 2 now, so `raised <= BAZ_TOWERS` would have gone on being true while meaning
 * something else entirely.
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

sub("the garrison names in the namespace",
`  "bazTowerSpot,BAZ_TOWERS,BAZ_TOWER_GAP,BAZ_TOWER_OUT,BAZ_TOWER_STONE,"+ // v134.6 towers on them`,
`  "bazTowerSpot,BAZ_TOWERS,BAZ_TOWER_GAP,BAZ_TOWER_OUT,BAZ_TOWER_STONE,"+ // v134.6 towers on them
  "bazTowerWant,BAZ_TOWERS_MIN,BAZ_TOWERS_MAX,bazaarTaken,"+              // v134.10 the garrison`);

// ---------------------------------------------------------------------------
// The v134.6 cap gate now reads the want, not the old single number.
// ---------------------------------------------------------------------------
sub("the v134.6 cap gate reads the want",
`    check("v134.6 towers: a marshal holding a square raises a Guard Tower over it and STOPS at "+
      G.BAZ_TOWERS+" ("+raised+" raised across eight think-clocks, "+onSq+" of them ringing the "+
      "square, none on the plaza: "+offPlaza+"). 250 stone apiece against 4,200 on the whole map "+
      "is why the cap is what it is",
      raised>=1&&raised<=G.BAZ_TOWERS&&onSq>=1&&offPlaza);`,
`    // v134.10: the cap is no longer one number for every square — it is what THIS square has
    // earned (bazTowerWant). Held and never lost, that is BAZ_TOWERS_MIN; the ramp is gated
    // separately below. Written against the want so the two cannot drift.
    const _capHere=G.bazTowerWant(team,held);
    check("v134.6/v134.10 towers: a marshal holding a square raises Guard Towers over it and stops "+
      "at the garrison that square has earned — "+_capHere+" here, it having been lost "+
      ((held.lost&&held.lost[team])||0)+" times ("+raised+" raised across eight think-clocks, "+
      onSq+" of them ringing the square, none on the plaza: "+offPlaza+"). 250 stone apiece against "+
      "4,200 on the whole map is why there is a cap at all",
      raised>=1&&raised<=_capHere&&onSq>=1&&offPlaza);`);

// ---------------------------------------------------------------------------
// The new block.
// ---------------------------------------------------------------------------
sub("the v134.10 block",
`// ==================== v134.9 A SOLDIER WHO DIES COMES BACK TO THE ARMY ====================`,
`// ==================== v134.10 WHAT IT COSTS TO KEEP A SQUARE ====================
{
  const G=global.__G;
  const NM=G.neutralMarkets;
  const fs4=require("fs"), path4=require("path");
  const ai4=fs4.readFileSync(path4.join(__dirname,"..","js","07-ai.js"),"utf8")
    .split(String.fromCharCode(10)).map(l=>{const i=l.indexOf("//");return i<0?l:l.slice(0,i);})
    .join(String.fromCharCode(10));

  // --- 1. THE LEDGER, written by the flip itself.
  {
    const m=NM[0];
    const keep={owner:m.owner,cap:m.cap,capTeam:m.capTeam,lost:(m.lost||[0,0]).slice()};
    m.lost=[0,0];
    // blue holds it; red takes it. The loss is BLUE's and only blue's.
    G.bazaarTaken(m,G.RED,G.BLUE);
    const afterRedTook=[m.lost[0],m.lost[1]];
    // …and blue takes it back off red.
    G.bazaarTaken(m,G.BLUE,G.RED);
    const afterBlueTook=[m.lost[0],m.lost[1]];
    // …and a NEUTRAL square being claimed is nobody's loss.
    G.bazaarTaken(m,G.BLUE,-1);
    const afterNeutral=[m.lost[0],m.lost[1]];
    m.owner=keep.owner; m.cap=keep.cap; m.capTeam=keep.capTeam; m.lost=keep.lost;
    check("v134.10 ledger: a capture is charged to the team that LOST the square and to nobody "+
      "else — red takes it off blue ["+afterRedTook.join(",")+"], blue takes it back ["+
      afterBlueTook.join(",")+"], and claiming a NEUTRAL square costs nobody anything ["+
      afterNeutral.join(",")+"]. \`was\` was already being passed to bazaarTaken and used for nothing",
      afterRedTook[0]===1&&afterRedTook[1]===0&&
      afterBlueTook[0]===1&&afterBlueTook[1]===1&&
      afterNeutral[0]===1&&afterNeutral[1]===1);
  }

  // --- 2. THE RAMP. John's ask, as arithmetic.
  {
    const m=NM[0], keep=(m.lost||[0,0]).slice();
    const row=[];
    for(let n=0;n<=4;n++){ m.lost=[n,0]; row.push(G.bazTowerWant(G.BLUE,m)); }
    m.lost=[3,0];
    const otherTeam=G.bazTowerWant(G.RED,m);   // blue's losses are not red's problem
    m.lost=keep;
    check("v134.10 garrison: a square this team has lost 0/1/2/3/4 times wants ["+row.join(", ")+
      "] towers — two on one you hold, one more for each time it has been taken off you, to "+
      G.BAZ_TOWERS_MAX+". Measured over four seeded 20-minute campaigns a team loses a given square "+
      "0 to 3 times (the Grand is where the churn is), so the ramp is scaled over what the map "+
      "actually produces. And one side's losses do not size the other's garrison ("+otherTeam+
      " for the team that never lost it)",
      row[0]===G.BAZ_TOWERS_MIN&&row[1]===3&&row[2]===4&&row[3]===4&&row[4]===4&&
      otherTeam===G.BAZ_TOWERS_MIN&&G.BAZ_TOWERS_MIN===2&&G.BAZ_TOWERS_MAX===4);
  }

  // --- 3. THE RING IS A RING, not a huddle on the home-facing arc.
  {
    // Deal one square its full garrison through the shipped spot-finder, standing each tower as it
    // is returned so the next call can see it. Then measure the closest pair of bearings.
    const team=G.BLUE, m=NM.find(q=>!q.grand)||NM[0];
    const own0=NM.map(q=>q.owner), lost0=NM.map(q=>(q.lost||[0,0]).slice());
    // ⚠ AND THE GROUND ROUND THE SQUARE IS CLEARED FIRST. The first cut of this gate reported "0 of
    // 4" and the probe said why: an earlier bench had left a TOWN CENTRE standing 22 units from the
    // west bazaar, and tcRingReason refuses every non-farm plot within TC_RING of one — which is the
    // whole ring, so all 36 swept bearings came back illegal. The claim here is about the
    // spot-finder, not about what the benches above happened to leave lying around. Same trick the
    // v134.4 far-side benches use, and the radius is TC_RING past the ring's outer edge because
    // that is the reach of the rule that bit.
    const _plaza=(m.plaza||8.6);
    const _outer=Math.max(_plaza+G.BAZ_TOWER_GAP+1,
      Math.min(_plaza+G.BAZ_TOWER_GAP+G.BAZ_TOWER_OUT,((G.BLD.tower.atk&&G.BLD.tower.atk.rng)||18)-1.5));
    const _hid=[];
    for(const b of G.buildings)
      if(b.alive&&Math.hypot(b.x-m.x,b.z-m.z)<_outer+G.TC_RING+6){b.alive=false;_hid.push(b);}
    // ⚠ AND THE AGE IS STAGED, because the ring's CAPACITY depends on it. A Guard Tower's footprint
    // grows at Enlightenment — BLD.tower.fxA/fzA go from 4.20x6.30 to 8.96x9.03 — and validFor
    // spaces buildings by 0.75 of the smaller one's width. Swept offline at 720 bearings x 9 radii
    // with the ground clear, a bazaar ring holds FOUR towers at ages 3 and 4 and TWO at age 5.
    // Reading whatever age the campaign happened to reach made this gate a coin flip; it is asked
    // at age 4, where the answer is four, and the age-5 case is asserted separately below.
    const _age0=[G.teamAge[0],G.teamAge[1]];
    G.teamAge[0]=4; G.teamAge[1]=4;
    for(const q of NM)q.owner=-1;
    m.owner=team; m.lost=[2,0];                       // lost twice -> a garrison of four
    const want=G.bazTowerWant(team,m);
    const put=[];
    for(let i=0;i<want;i++){
      const sp=G.bazTowerSpot(team,m);
      if(!sp)break;
      put.push(G.makeBuilding(team,"tower",sp.x,sp.z,true));
    }
    const bear=put.map(b=>Math.atan2(b.z-m.z,b.x-m.x));
    const sepOf=(list)=>{
      let worst=Math.PI;
      for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
        const g=Math.abs(((list[i]-list[j]+Math.PI*3)%(Math.PI*2))-Math.PI);
        if(g<worst)worst=g;
      }
      return list.length>1?worst:Math.PI;
    };
    const sep=sepOf(bear)*180/Math.PI;
    // ⚠ THE BAR IS THREE QUARTERS OF AN EVEN SHARE, and it has to be, because validFor's own
    // spacing already forces some separation for free: with the scoring reverted to "nearest home
    // wins" (falsify b_huddle) four towers still land 56 degrees apart, so a bar of 0.6 (54) would
    // have been satisfied by the bug and the gate would have been resting entirely on its source
    // read. Measured: 82 degrees with the scoring in, 56 with it out, against a bar of 67.5.
    const minSep=0.75*(360/Math.max(1,want));
    // …and every one of them still off the plaza and inside its own reach, which v134.6 asked for
    const plaza=(m.plaza||8.6), rng=(G.BLD.tower.atk&&G.BLD.tower.atk.rng)||18;
    let offPlaza=true, inReach=true;
    for(const b of put){
      const d=Math.hypot(b.x-m.x,b.z-m.z);
      if(d<plaza+G.BAZ_TOWER_GAP-0.01)offPlaza=false;
      if(d>rng-1.4)inReach=false;
    }
    // …and the same ring at Enlightenment, where the tower is twice the building. The marshal must
    // take what fits and not stall: bazTowerSpot returns null and the war room moves on.
    for(const b of put)b.alive=false;
    G.teamAge[0]=5; G.teamAge[1]=5;
    const put5=[];
    for(let i=0;i<want;i++){
      const sp=G.bazTowerSpot(team,m);
      if(!sp)break;
      put5.push(G.makeBuilding(team,"tower",sp.x,sp.z,true));
    }
    const fit5=put5.length;
    for(const b of put5)b.alive=false;
    G.teamAge[0]=_age0[0]; G.teamAge[1]=_age0[1];
    for(const b of _hid)b.alive=true;
    for(let i=0;i<NM.length;i++){NM[i].owner=own0[i];NM[i].lost=lost0[i];}
    const spreads=ai4.indexOf("const score=sep-Math.sqrt(d)*0.0008;")>=0;
    const fallback=ai4.indexOf("return best||near;")>=0;
    check("v134.10 ring: a square lost twice is given "+put.length+" of "+want+" towers ("+
      _hid.length+" buildings stood aside first) and they "+
      "stand ROUND it — closest pair "+sep.toFixed(0)+"deg against a bar of "+minSep.toFixed(0)+
      "deg, three quarters of an even share (the spacing rule alone gives 56)"+
      ", all off the plaza ("+offPlaza+") and inside a tower's own reach of "+rng+" ("+inReach+
      "). Keeping the spot nearest home is right for ONE tower and would put four on the same "+
      "home-facing arc; separation is MAXIMISED now — each tower goes in the middle of the widest "+
      "gap — with home as the tie-break ("+spreads+"), and the old rule kept as the fallback so a "+
      "marshal that cannot build tidily still builds ("+fallback+")",
      put.length===want&&sep>=minSep&&offPlaza&&inReach&&spreads&&fallback);
    check("v134.10 ring: …and at Enlightenment the same ring holds "+fit5+", not "+want+" — a Guard "+
      "Tower's footprint goes from 4.20x6.30 to 8.96x9.03 at age 5 and validFor spaces buildings by "+
      "0.75 of the smaller one's width, so a 12.1-to-16.5 ring runs out of room. Swept offline at "+
      "720 bearings x 9 radii on clear ground: four fit at ages 3 and 4, two at age 5. The marshal "+
      "takes what fits and does not stall — bazTowerSpot answers null and the war room moves on",
      fit5>=1&&fit5<want);
  }

  // --- 4. THE RESERVE IS THE KEEP'S OWN PRICE.
  {
    const castle=(G.BLD.castle.cost&&G.BLD.castle.cost.stone)||0;
    const tower=(G.BLD.tower.cost&&G.BLD.tower.cost.stone)||0;
    check("v134.10 reserve: BAZ_TOWER_STONE is the CASTLE's own stone cost ("+G.BAZ_TOWER_STONE+
      " against "+castle+"), so a garrison that can want "+(3*G.BAZ_TOWERS_MAX)+" towers at "+tower+
      " stone apiece cannot eat the keep behind it. It was 150 — a floor set when the feature was "+
      "one tower a square and 750 was the most it could ever cost. Derived, so the two cannot drift",
      G.BAZ_TOWER_STONE===castle&&castle>0&&G.BAZ_TOWER_STONE>tower/2);
  }
}

// ==================== v134.9 A SOLDIER WHO DIES COMES BACK TO THE ARMY ====================`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(S,s);
console.log("patch-smoketest-bazgarrison-v134: OK");
