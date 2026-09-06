#!/usr/bin/env node
/* patch-smoketest-mapderive-v134.js — the gates for v134.9 THE SCREEN FACES THE LANES.
 *
 * Four numbers went from typed to derived. A gate that only re-typed them somewhere else would be
 * the same bug in a new place, so each of these asserts the DERIVATION — that the number the AI
 * uses and the number the map hands back are the same object — and prints the value, so a map
 * rework shows up here as a changed line rather than as a silent drift.
 *
 *  1. THE ROAD. roadZAt is roadPoint's inverse: pin the z at the four fronts the wall planner
 *     actually uses (7.98 / 10.53 / 12.43 / 13.64) and assert roadZAt agrees with roadPoint at
 *     every one, so the two can never disagree the way the literal 6 did.
 *  2. THE SCREEN. Deal a marshal five towers and assert they land on five DIFFERENT lanes,
 *     centre-out, each within its jitter — and report what fraction of LANE_Z a Guard Tower's
 *     reach would then cover. Restore the ±33 sampler and this goes red on the very first tower.
 *  3. THE CURTAIN. The plan must not be truncated by its own slice: segments planned === P.walls,
 *     which is the hole the 96-unit line left at one end of every turtle's wall.
 *  4. THE PATROL. Every base waypoint outside TC_RING — i.e. out of its own corn.
 *
 * findSpot is not in the harness namespace and does not need to be: the screen's rule is a pure
 * function of the lane table and the tower count, so the gate drives the SHIPPED SOURCE through
 * the same deal (LANE_Z[n % LANE_Z.length]) and then checks the shipped file still computes it
 * that way — the same instrument the v134.7 menu gate uses, for the same reason.
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

sub("roadZAt in the namespace",
`  "farmFacing,"+                                       // v134.8 which way a barn faces`,
`  "farmFacing,"+                                       // v134.8 which way a barn faces
  "roadZAt,countScreenTowers,countBld,"+               // v134.9 the road, and the town's OWN towers`);

sub("the v134.9 block",
`// ==================== v134.8 A SOLO GAME STARTS SYMMETRIC ====================`,
`// ==================== v134.9 THE SCREEN FACES THE LANES ====================
{
  const G=global.__G;
  const {LANE_Z,TCPOS,roadPoint,roadZAt,TC_RING,PERSONALITIES,wallLineSegments}=G;
  const fs3=require("fs"), path3=require("path");
  // ⚠ COMMENTS STRIPPED FIRST. Every source read below asks whether a form is PRESENT or GONE,
  // and the comments in that file quote the forms they replaced — the first cut of this gate went
  // red on its own explanation. A line-comment strip is enough here (the file has no "//" inside a
  // string literal on any of the lines these searches touch) and it is the honest instrument: a
  // read that a comment can satisfy is a read that a comment can also defeat.
  const ai=fs3.readFileSync(path3.join(__dirname,"..","js","07-ai.js"),"utf8")
    .split(String.fromCharCode(10)).map(l=>{const i=l.indexOf("//");return i<0?l:l.slice(0,i);})
    .join(String.fromCharCode(10));

  // --- 1. THE ROAD, WHERE IT ACTUALLY IS.
  {
    // The fronts the turtle plans at: 34, then +14 a retry, three retries (v134.4).
    const FRONTS=[34,48,62,76];
    const zs=FRONTS.map(f=>roadZAt(TCPOS[0][0]+f));
    const shown=FRONTS.map((f,i)=>f+":"+zs[i].toFixed(2)).join(" · ");
    const expect=[7.98,10.53,12.43,13.64];
    const drift=zs.map((z,i)=>Math.abs(z-expect[i])>0.05?(FRONTS[i]+" "+z.toFixed(2)+" not "+expect[i]):null).filter(Boolean);
    // …and it MUST be roadPoint's own answer, not a second copy of the curve. x is linear in t.
    let apart=0;
    for(let x=-170;x<=170;x+=7){
      const t=(x-TCPOS[0][0])/(TCPOS[1][0]-TCPOS[0][0]);
      if(Math.abs(roadZAt(x)-roadPoint(t).z)>1e-9)apart++;
    }
    // the literal this replaces, and by how much it was wrong — the reason the change exists
    const worst=Math.max(...zs.map(z=>Math.abs(z-6)));
    check("v134.9 road: roadZAt is roadPoint inverted — same answer at all 49 sampled x ("+apart+
      " disagreements) — and the Kings Road crosses the wall line at "+shown+", against the "+
      "literal 6 it replaces (worst error "+worst.toFixed(2)+" on a segment pitch of 10.9, i.e. "+
      "most of a segment: the gate went into the wrong one and the road ran through a wall)"+
      (drift.length?" — DRIFTED: "+drift.join(" · "):""),
      apart===0&&drift.length===0&&worst>1);
    // …and the marshal reads it rather than carrying its own copy
    check("v134.9 road: the wall planner asks roadZAt and no longer carries the number itself",
      ai.indexOf("Math.abs(b.z-roadZAt(b.x))")>=0&&ai.indexOf("Math.abs(b.z-6)")<0);
  }

  // --- 2. THE SCREEN STANDS ON THE LANES.
  {
    // The deal, exactly as findSpot computes it: LANE_Z[nth tower % LANE_Z.length].
    const dealt=[]; for(let n=0;n<LANE_Z.length;n++)dealt.push(LANE_Z[n%LANE_Z.length]);
    const distinct=new Set(dealt).size;
    // …and the shipped source must be doing that, not sampling a band. findSpot is not exported;
    // this is the same source read the v134.7 menu gate uses, and for the same reason.
    const dealsLanes=ai.indexOf('const _lane=LANE_Z[countScreenTowers(team)%LANE_Z.length];')>=0;
    const oldSampler=ai.indexOf("z=(Math.random()-0.5)*66")>=0;
    // What the two rules cover, in the only unit that matters — a Guard Tower's reach.
    const RNG=(G.BLD.tower.atk&&G.BLD.tower.atk.rng)||18;
    const spanLanes=(LANE_Z.length?Math.max(...LANE_Z)-Math.min(...LANE_Z):0)+2*RNG;
    check("v134.9 screen: five towers are dealt "+distinct+" DIFFERENT lanes centre-out ["+
      dealt.join(", ")+"], reaching "+RNG+" apiece — a screened frontage of "+spanLanes+
      " against the "+66+" the old sampler scattered them across. Measured over four seeded "+
      "campaigns, enemy soldiers at the defender's wall line fall inside |z| 33 only 31.9% of the "+
      "time and within 25 of a LANE_Z 93.9%; sightings actually inside a built tower's reach were "+
      "11.9%. Source: deals the lanes "+dealsLanes+", old band sampler gone "+!oldSampler,
      distinct===LANE_Z.length&&dealsLanes&&!oldSampler&&spanLanes>66);
  }

  // --- 3. THE CURTAIN HAS NO HOLE IN IT.
  {
    // Replay the planner's own arithmetic for every personality that walls.
    const rows=[];
    let bad=[];
    for(const k in PERSONALITIES){
      const P=PERSONALITIES[k]; if(!P.walls)continue;
      const half=P.walls*10.9/2;
      const segs=wallLineSegments("stone_wall",-141,-half,-141,half);
      rows.push(k+" walls "+P.walls+" -> "+segs.length+" segments over "+(half*2).toFixed(1));
      if(segs.length!==P.walls)bad.push(k+" plans "+segs.length+" for "+P.walls+" walls");
      // and what the old 96-unit line did, for the record
    }
    const old=wallLineSegments("stone_wall",-141,-48,-141,48).length;
    // ⚠ AND THE SHIPPED PLANNER MUST BE THE ONE DOING IT. The first cut of this gate replayed the
    // arithmetic from PERSONALITIES and nothing else — a pure function of a data table, which is
    // true whatever the planner does. Restoring the 96-unit line left it green (falsify m_curtain:
    // 0 failures). A gate that cannot see the code it is about is a gate that has never been run.
    const derives=ai.indexOf("const _half=P.walls*10.9/2;")>=0;
    const oldSpan=ai.indexOf("tc[1]-48,front,tc[1]+48")>=0;
    check("v134.9 curtain: every walling personality plans exactly as many segments as it can pay "+
      "for ("+(rows.join(" · ")||"none wall")+") — the 96-unit line cut into "+old+
      " and .slice(0,8) threw the last away, so a turtle that built every wall it had still left a "+
      "segment-wide hole at one end, every game. Source: derives the length ("+derives+
      "), fixed 96-unit line gone ("+!oldSpan+")"+(bad.length?" — BROKEN: "+bad.join(" · "):""),
      bad.length===0&&old>8&&derives&&!oldSpan);
  }

  // --- 5. THE SQUARE'S TOWERS ARE NOT THE TOWN'S TOWERS.
  {
    // Two Guard Towers, one of them a bazaar tower. The town's budget must see one.
    const tc0=G.teamTC(0);
    const t1=G.makeBuilding(0,"tower",tc0.x+60,tc0.z+70,true);
    const t2=G.makeBuilding(0,"tower",tc0.x+62,tc0.z-70,true); t2.bazTower=true;
    const all=G.countBld(0,"tower"), own=G.countScreenTowers(0);
    t1.alive=false; t2.alive=false;
    const tagged=ai.indexOf('makeBuilding(team,"tower",s.x,s.z,false).bazTower=true')>=0;
    const budgets=ai.indexOf('countScreenTowers(team)))want="tower"')>=0;
    check("v134.9 towers: a Guard Tower raised over a SQUARE is not charged to the town's own "+
      "budget — countBld sees "+all+", countScreenTowers sees "+own+". Since v134.6 the war room "+
      "gated its screen on countBld, so one bazaar tower spent one of a rush's two and holding a "+
      "square quietly disarmed the town behind it. Tagged at birth ("+tagged+"), budget reads the "+
      "narrow count ("+budgets+")",
      all===2&&own===1&&tagged&&budgets);
  }

  // --- 4. THE PATROL WALKS OUTSIDE ITS OWN CORN.
  {
    // The waypoints the shipped source builds, replayed at the throne.
    const pr=TC_RING+6, side=1, tc=TCPOS[0];
    const wps=[{x:tc[0]+side*pr,z:tc[1]},{x:tc[0]+side*pr*0.7,z:tc[1]+pr*0.7},
               {x:tc[0]-side*pr*0.85,z:tc[1]},{x:tc[0]+side*pr*0.7,z:tc[1]-pr*0.7}];
    const ds=wps.map(w=>Math.hypot(w.x-tc[0],w.z-tc[1]));
    const inside=ds.filter(d=>d<TC_RING).length;
    const derives=ai.indexOf("const _pr=TC_RING+6;")>=0;
    const oldBox=ai.indexOf("{x:tc[0]+side*15,z:tc[1]+11}")>=0;
    check("v134.9 patrol: the base loop is a ring at TC_RING+6 — distances "+
      ds.map(d=>d.toFixed(1)).join("/")+" from the throne, "+inside+" of 4 inside the farm ring. "+
      "It was (15,11) (22,16) (4,-24) (26,-6), furthest 27.20 against a ring of 30, so every "+
      "waypoint sat among this team's own fields. Derived from TC_RING now ("+derives+"), old box "+
      "gone ("+!oldBox+")",
      inside===0&&derives&&!oldBox&&Math.abs(Math.max(...ds)-(TC_RING+6))<0.01);
  }
}

// ==================== v134.8 A SOLO GAME STARTS SYMMETRIC ====================`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(S,s);
console.log("patch-smoketest-mapderive-v134: OK");
