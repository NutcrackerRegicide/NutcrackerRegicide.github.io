#!/usr/bin/env node
/* patch-smoketest-farmrot-v134.js — the gates for v134.8 THE BARNS TURN OUT.
 *
 * The v134.1 "barn and the box" block was written to state a compromise honestly: TC_FARM_MIN 21
 * clears the Town Center's box at age 2 alone, the overlap that leaves is bounded at 2.81, and the
 * cure — turning the barns away — "needs a shot before it ships, not a derivation." It ends with:
 *
 *     "if a future change clears more ages — rotating the barns would clear all five — this goes
 *      red and whoever reads it gets to delete a caveat instead of inheriting a stale one."
 *
 * That is this change, so this is that deletion. What replaces it is not a weaker claim: the
 * as-built table stays pinned (it is the geometry tripwire and it is WHY the rotation exists), a
 * second pinned table says what turning buys, and the campaign bound goes from "no worse than 2.81"
 * to ZERO — which is the strongest form the claim has ever had and the one that goes red the
 * instant anybody drops the rotation.
 *
 * THE THREE NEW GATES, and why each is the discriminating question rather than a restatement:
 *
 *  1. THE RING SWEEP, on the live campaign Town Center with its live anchors. 72 bearings across
 *     four radii spanning the whole legal band, asking the only question that matters: does any
 *     barn disc touch the box. Zero is the claim. Run against the rotation
 *     removed it reports a nonzero count (the gate prints it), so it discriminates.
 *
 *  2. THE PIT TRAP, which is the one that tests the DESIGN rather than the arithmetic. Stage a
 *     Storage Pit at TC_RING+1 — the closest one may legally stand — and sweep again. Under "face
 *     away from the NEAREST anchor", the obvious rule and the one the first draft of farmFacing
 *     had, the fields between the pit and the throne turn their backs on the PIT and drive their
 *     barns into the box; offline that rule laps MORE plots than not turning at all. Under the
 *     shipped rule — try every anchor's facing, keep the roomiest, throne's box a hard gate — it
 *     stays zero. The gate reports both counts, so the choice is measured and not asserted.
 *
 *  3. THE PLAYER GETS THE SAME FIELD. A source read of 06-input.js, the same instrument the v134.7
 *     menu gate uses on index.html: the auto-facing has to be in updateGhostFollow (so it follows
 *     the anchor as he walks), it has to be skippable (rotManual), and R has to set that flag —
 *     an auto-orientation with no override is a bug wearing a feature's coat. It cannot be driven
 *     end-to-end here: updateGhostFollow returns early without a ghost, and a ghost is a mesh.
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

// ---------------------------------------------------------------------------
// 0. The namespace.
// ---------------------------------------------------------------------------
sub("farmFacing in the namespace",
`  "bazTowerSpot,BAZ_TOWERS,BAZ_TOWER_GAP,BAZ_TOWER_OUT,BAZ_TOWER_STONE,"+ // v134.6 towers on them`,
`  "bazTowerSpot,BAZ_TOWERS,BAZ_TOWER_GAP,BAZ_TOWER_OUT,BAZ_TOWER_STONE,"+ // v134.6 towers on them
  "farmFacing,"+                                       // v134.8 which way a barn faces`);

// ---------------------------------------------------------------------------
// 1. The caveat the v134.1 block invited its successor to delete.
// ---------------------------------------------------------------------------
sub("the barn block's header",
`// THE REAL CURE, when someone wants it: rotate each field so its barn faces AWAY from the Town
// Center. The barn's offset is fixed in world space only because a farm is never rotated;
// makeBuilding already takes a rot and the collider, the apron and the mesh all honour it. Then the
// overlap vanishes at any distance, TC_FARM_MIN can stay where it is, and the barns face the town —
// which is also how a farm ought to look. It needs a shot before it ships, not a derivation.`,
`// THE REAL CURE, TAKEN IN v134.8: each field turns its barn AWAY from the thing it rings
// (farmFacing, 07-ai.js). The barn's offset was fixed in world space only because a farm was never
// rotated; makeBuilding has always taken a rot and the collider, the apron and the mesh all honour
// it — shot from three angles before it shipped, in shots/farm-rotation-side-by-side.png. So the
// paragraph above is now HISTORY, not policy: it is why TC_FARM_MIN is 21 and why it did not have
// to become 27, and the two tables below say what each choice buys. The compromise is gone and the
// bound on the campaign's overlap is no longer "small" — it is zero.`);

// ---------------------------------------------------------------------------
// 2. The second table, and the claim it supports.
// ---------------------------------------------------------------------------
sub("the turned table",
`  const clearAt=(A)=>{ // the least farm-centre distance with no barn disc touching the TC box
    const hx=((tcDef.fxA&&tcDef.fxA[A])||tcDef.fx)+0.7, hz=((tcDef.fzA&&tcDef.fzA[A])||tcDef.fz)+0.7;
    for(let D=16;D<=44;D+=0.05){
      let ok=true;
      for(let i=0;i<720&&ok;i++){
        const th=i/720*Math.PI*2, fx=Math.cos(th)*D, fz=Math.sin(th)*D;
        for(const q of P){
          if(q.minAge!==undefined&&A<q.minAge)continue;
          if(q.maxAge!==undefined&&A>q.maxAge)continue;
          const wx=fx+q.x*bs, wz=fz+q.z*bs, qr=q.r*bs+0.7;
          const gx=Math.max(0,Math.abs(wx)-hx), gz=Math.max(0,Math.abs(wz)-hz);
          if(gx*gx+gz*gz<qr*qr){ok=false;break;}
        }
      }
      if(ok)return D;
    }
    return 99;
  };
  const tbl=[1,2,3,4,5].map(A=>({A,d:clearAt(A)}));`,
`  // v134.8: the same solver, now asked BOTH questions. \`rotOf\` is the field's rotation as a
  // function of its bearing from the Town Center — () => 0 is a farm as v134.7 built them, and
  // -(th+PI/2) is what farmFacing computes. One solver, two answers, so the pair cannot drift.
  const clearAt=(A,rotOf)=>{ // the least farm-centre distance with no barn disc touching the TC box
    const hx=((tcDef.fxA&&tcDef.fxA[A])||tcDef.fx)+0.7, hz=((tcDef.fzA&&tcDef.fzA[A])||tcDef.fz)+0.7;
    for(let D=6;D<=44;D+=0.05){
      let ok=true;
      for(let i=0;i<720&&ok;i++){
        const th=i/720*Math.PI*2, fx=Math.cos(th)*D, fz=Math.sin(th)*D;
        const rot=rotOf(th), c=Math.cos(rot), sn=Math.sin(rot);
        for(const q of P){
          if(q.minAge!==undefined&&A<q.minAge)continue;
          if(q.maxAge!==undefined&&A>q.maxAge)continue;
          const qx=q.x*bs, qz=q.z*bs, qr=q.r*bs+0.7;
          const wx=fx+qx*c+qz*sn, wz=fz-qx*sn+qz*c;  // the collider's own local -> world
          const gx=Math.max(0,Math.abs(wx)-hx), gz=Math.max(0,Math.abs(wz)-hz);
          if(gx*gx+gz*gz<qr*qr){ok=false;break;}
        }
      }
      if(ok)return D;
    }
    return 99;
  };
  const tbl=[1,2,3,4,5].map(A=>({A,d:clearAt(A,()=>0)}));`);

sub("the turned-table checks",
`  const shortAt=tbl.filter(r=>G.TC_FARM_MIN<r.d).map(r=>"age"+r.A);
  check("v134.1 barn: TC_FARM_MIN ("+G.TC_FARM_MIN+") clears the box at age 2 ALONE — short at "+
    shortAt.join(",")+", because clearing them all needs 26.75 against a ring of "+G.TC_RING+
    ". The overlap is bounded below, no body ends up in it, and the cure is to rotate the barns "+
    "to face away — which needs a shot before it ships",
    shortAt.join(",")==="age1,age3,age4,age5");`,
`  const shortAt=tbl.filter(r=>G.TC_FARM_MIN<r.d).map(r=>"age"+r.A);
  // v134.8 THE SECOND TABLE. Same solver, the field turned so its local -z — the barn's face —
  // points out along its own bearing. Both tables are pinned, because the interesting number is
  // the DIFFERENCE and a pin on one half of a comparison is not a pin.
  const away=(th)=>-(th+Math.PI/2);
  const tbl2=[1,2,3,4,5].map(A=>({A,d:clearAt(A,away)}));
  const shown2=tbl2.map(r=>"age"+r.A+" "+r.d.toFixed(2)).join(" · ");
  const expect2={1:13.40,2:10.60,3:13.50,4:15.90,5:11.95};
  const drift2=tbl2.filter(r=>Math.abs(r.d-expect2[r.A])>0.1)
                   .map(r=>"age"+r.A+" "+r.d.toFixed(2)+" not "+expect2[r.A]);
  const worstNow=Math.max(...tbl.map(r=>r.d)), worstAway=Math.max(...tbl2.map(r=>r.d));
  check("v134.8 barn: turning the barn outward drops the clearance the ring needs from "+
    worstNow.toFixed(2)+" to "+worstAway.toFixed(2)+" ("+shown2+") — so TC_FARM_MIN ("+G.TC_FARM_MIN+
    ") clears the Town Center's box at EVERY age with "+(G.TC_FARM_MIN-worstAway).toFixed(2)+
    " to spare, where AS BUILT it was short at "+shortAt.join(",")+". That is why the fields turn: "+
    "the alternative was TC_FARM_MIN 27 inside a TC_RING of 30, a three-unit band for a field "+
    "thirteen wide"+(drift2.length?" — DRIFTED: "+drift2.join(" · "):""),
    drift2.length===0&&worstAway<=G.TC_FARM_MIN&&shortAt.join(",")==="age1,age3,age4,age5");`);

// ---------------------------------------------------------------------------
// 3. The campaign bound goes to zero.
// ---------------------------------------------------------------------------
sub("the campaign bound",
`  let worst=0;
  for(const t of [0,1]){
    const tc=G.buildings.find(b=>b.alive&&b.team===t&&b.type==="towncenter"); if(!tc)continue;
    const A=Math.max((tc.def.age||0),Math.min(5,G.teamAge[t]||0));
    const hx=((tc.def.fxA&&tc.def.fxA[A])||tc.def.fx)+0.7, hz=((tc.def.fzA&&tc.def.fzA[A])||tc.def.fz)+0.7;
    for(const f of G.buildings){
      if(!f.alive||f.team!==t||f.type!=="farm")continue;
      const rot=f.rot||0, c=Math.cos(rot), sn=Math.sin(rot);
      for(const q of P){
        if(q.minAge!==undefined&&A<q.minAge)continue;
        if(q.maxAge!==undefined&&A>q.maxAge)continue;
        const qx=q.x*bs, qz=q.z*bs, qr=q.r*bs+0.7;
        const wx=f.x+qx*c+qz*sn, wz=f.z-qx*sn+qz*c;   // the same local->world as the collider
        const gx=Math.max(0,Math.abs(wx-tc.x)-hx), gz=Math.max(0,Math.abs(wz-tc.z)-hz);
        const ov=qr-Math.hypot(gx,gz);
        if(ov>worst)worst=ov;
      }
    }
  }
  check("v134.1 barn: the worst overlap the campaign produced is "+worst.toFixed(2)+", within what "+
    "a farm at the ring's inner edge can reach (2.81) — deeper would mean the ring leaked",
    worst<=2.81);`,
`  // v134.8 AT EVERY AGE THE THRONE WILL REACH, and that is the whole change here. Read at the
  // town's CURRENT age this measured 0.00 on every seed tried — on v134.7 as well as on v134.8 —
  // so as a claim about the rotation it had no teeth at all: the bound of 2.81 was the deepest a
  // field at the ring's inner edge COULD reach, not a depth anything had been observed at, and a
  // ten-farm town rarely lands one in the 2.4% of the legal ring that laps. But a Town Center's
  // box GROWS: 8.50x7.75 at Classical, 11.88x11.90 at Medieval. A field planted at Bronze that
  // clears today is standing in the walls two ages later, and its rotation was chosen once, at
  // placement. Swept over all five ages the same campaign reads 0.47 deep on two part-ages with
  // the rotation removed and 0.00 with it in — so this now discriminates, which the version it
  // replaces did not.
  let worst=0, lapped=0;
  for(const t of [0,1]){
    const tc=G.buildings.find(b=>b.alive&&b.team===t&&b.type==="towncenter"); if(!tc)continue;
    for(const A of [1,2,3,4,5]){
      const hx=((tc.def.fxA&&tc.def.fxA[A])||tc.def.fx)+0.7, hz=((tc.def.fzA&&tc.def.fzA[A])||tc.def.fz)+0.7;
      for(const f of G.buildings){
        if(!f.alive||f.team!==t||f.type!=="farm")continue;
        const rot=f.rot||0, c=Math.cos(rot), sn=Math.sin(rot);
        for(const q of P){
          if(q.minAge!==undefined&&A<q.minAge)continue;
          if(q.maxAge!==undefined&&A>q.maxAge)continue;
          const qx=q.x*bs, qz=q.z*bs, qr=q.r*bs+0.7;
          const wx=f.x+qx*c+qz*sn, wz=f.z-qx*sn+qz*c;   // the same local->world as the collider
          const gx=Math.max(0,Math.abs(wx-tc.x)-hx), gz=Math.max(0,Math.abs(wz-tc.z)-hz);
          const ov=qr-Math.hypot(gx,gz);
          if(ov>0.0001)lapped++;
          if(ov>worst)worst=ov;
        }
      }
    }
  }
  check("v134.1/v134.8 barn: not one field either campaign planted laps its own Town Center at ANY "+
    "age that throne will reach ("+lapped+" lapping part-ages, worst "+worst.toFixed(2)+"). Read at "+
    "the CURRENT age this was 0.00 on v134.7 too and said nothing; the box grows with the age and "+
    "a field's rotation is chosen once, at placement",
    worst<=0.0001);`);

// ---------------------------------------------------------------------------
// 4. The new block: the sweep, the pit trap, and the player's ghost.
// ---------------------------------------------------------------------------
sub("the v134.8 block",
`console.log(fails?("\\n"+fails+" FAILURES"):"\\nALL SMOKE TESTS PASSED");`,
`// ==================== v134.8 THE BARNS TURN OUT ====================
{
  const G=global.__G;
  const P=G.BLD.farm.blockParts||[], bs=G.BSCALE.farm||1;
  const tc=G.teamTC(0);
  // Does a field planted at this bearing, turned the way farmFacing turns it, put any barn disc
  // inside the Town Center's box? \`rotOf\` lets the same sweep ask the question of a rule that is
  // NOT the shipped one, which is the only way the pit trap below can show its teeth.
  //
  // EVERY AGE, not the age this seed's town happens to have reached. A Town Center's box is
  // 11.26x10.75 at Stone, 8.50x7.75 at Classical, 11.88x11.90 at Medieval and 9.10 at
  // Enlightenment, so a field that laps at age 4 clears at age 2 — and a rotation is chosen ONCE,
  // at placement, for a field that stands through all of them. The first cut read teamAge and
  // reported 2 lapping plots on a seed whose blue was young against 23 on one whose blue was not,
  // which made a statement about geometry depend on how the campaign went.
  const RADII=[G.TC_FARM_MIN+0.5,24,26.5,G.TC_RING-1];
  const NPROBE=72*RADII.length*5;                 // …times all five ages
  const lap=(rotOf)=>{
    let bad=0;
    for(const A of [1,2,3,4,5]){
      const hx=((tc.def.fxA&&tc.def.fxA[A])||tc.def.fx)+0.7,
            hz=((tc.def.fzA&&tc.def.fzA[A])||tc.def.fz)+0.7;
      for(let i=0;i<72;i++)for(const r of RADII){
        const th=i/72*Math.PI*2;
        const fx=tc.x+Math.cos(th)*r, fz=tc.z+Math.sin(th)*r;
        const rot=rotOf(fx,fz), c=Math.cos(rot), sn=Math.sin(rot);
        for(const q of P){
          if(q.minAge!==undefined&&A<q.minAge)continue;
          if(q.maxAge!==undefined&&A>q.maxAge)continue;
          const qx=q.x*bs, qz=q.z*bs, qr=q.r*bs+0.7;
          const wx=fx+qx*c+qz*sn, wz=fz-qx*sn+qz*c;
          const gx=Math.max(0,Math.abs(wx-tc.x)-hx), gz=Math.max(0,Math.abs(wz-tc.z)-hz);
          if(gx*gx+gz*gz<qr*qr){bad++;break;}
        }
      }
    }
    return bad;
  };
  // "Face away from the NEAREST anchor" — the rule farmFacing does NOT use, evaluated over a
  // CONTROLLED set of anchors rather than whatever this seed's campaign built. That matters: on
  // SMOKE_SEED=20260827 blue already had a pit closer to the relevant arc than a staged one, so
  // the naive rule lapped nothing and a gate about the RULE reported on the town instead.
  const nearestOf=(anch)=>(x,z)=>{
    let ax=null,az=null,best=1e12;
    for(const an of anch){
      const d=Math.hypot(x-an.x,z-an.z);
      if(d<best){best=d;ax=an.x;az=an.z;}
    }
    return ax===null?0:-(Math.atan2(z-az,x-ax)+Math.PI/2);
  };
  // …and the shipped rule written out: try each anchor's facing, keep the one with the most room.
  // \`gate\` is the design decision itself — with it, a facing that would put the barn in the
  // THRONE's box is disqualified however much room it leaves elsewhere; without it, the throne is
  // one vote among several. This is a transcription of farmFacing (07-ai.js) and the second check
  // below asserts it agrees with the shipped function over the same anchors, so the copy cannot
  // quietly drift from the original — which is also what makes dropping the gate in the real
  // function visible from here.
  const roomiestOf=(anch,gate)=>(x,z)=>{
    let best=0,bestS=-1e9;
    for(const a of anch){
      const rot=-(Math.atan2(z-a.z,x-a.x)+Math.PI/2), c=Math.cos(rot), sn=Math.sin(rot);
      let room=1e9,throne=1e9;
      for(const q of P){
        const qx=q.x*bs, qz=q.z*bs, qr=q.r*bs+0.7;
        const wx=x+qx*c+qz*sn, wz=z-qx*sn+qz*c;
        for(const b of anch){
          const g=Math.hypot(wx-b.x,wz-b.z)-(b.def?G.bSurf(b.def)+1:0)-qr;
          if(g<room)room=g;
          if(b.type==="towncenter"&&g<throne)throne=g;
        }
      }
      const sc=(gate&&throne<0)?room-1000:room;
      if(sc>bestS){bestS=sc;best=rot;}
    }
    return best;
  };

  // --- 1. THE RING SWEEP. Every legal bearing at the ring's inner edge, against the live town.
  {
    const turned=lap((x,z)=>G.farmFacing(0,x,z));
    const flat=lap(()=>0);
    check("v134.8 sweep: over "+NPROBE+" plot-ages in the live town's ring (72 bearings x radii "+
      RADII.map(r=>r.toFixed(1)).join("/")+" x all five ages), "+turned+" put a barn disc inside "+
      "the Town Center's box. As v134.7 built them — barn fixed in world space — it is "+flat+
      " (by age 4 / 0 / 6 / 23 / 2). The ring's inner "+
      "edge finally means what the v134.1 comment always claimed it meant",
      turned===0&&flat>0);
  }

  // --- 2. THE TRAP TOWN: the design decision, made measurable, on ground we control.
  {
    // Three buildings staged around the live throne — a Storage Pit at the ring's edge (the
    // closest one may legally stand: findSpot samples TC_RING+1 .. TC_RING+18), a second pit and a
    // castle — and every OTHER anchor of blue's hidden for the duration, so farmAnchors returns
    // exactly this set and the comparison below is about the RULE rather than about whatever this
    // seed's campaign happened to build. Staged instant and retired again, the way the mill-layout
    // bench retires its ring.
    const hid=[];
    for(const b of G.buildings){
      if(!b.alive||b.team!==0)continue;
      if(b===tc)continue;
      if(b.type==="storage_pit"||b.type==="castle"||b.type==="towncenter"){b.alive=false;hid.push(b);}
    }
    const st=[G.makeBuilding(0,"storage_pit",tc.x+G.TC_RING+1,tc.z,true),
              G.makeBuilding(0,"storage_pit",tc.x-8,tc.z+33,true),
              G.makeBuilding(0,"castle",tc.x+20,tc.z-36,true)];
    const TOWN=G.farmAnchors(0).map(an=>({x:an.x,z:an.z,def:an.def,type:an.type}));
    const shipped=lap((x,z)=>G.farmFacing(0,x,z));
    const naive  =lap(nearestOf(TOWN));
    const nogate =lap(roomiestOf(TOWN,false));
    const gated  =lap(roomiestOf(TOWN,true));
    const flat   =lap(()=>0);
    // …and the transcription IS the shipped function, over these same anchors. Without this the
    // paragraph below would be about code that is not running.
    let apart=0, worstD=0;
    for(let i=0;i<72;i++)for(const r of RADII){
      const th=i/72*Math.PI*2;
      const x=tc.x+Math.cos(th)*r, z=tc.z+Math.sin(th)*r;
      const d=Math.abs((((roomiestOf(TOWN,true)(x,z)-G.farmFacing(0,x,z))%(Math.PI*2))+Math.PI*3)%(Math.PI*2)-Math.PI);
      if(d>1e-9){apart++; worstD=Math.max(worstD,d);}
    }
    for(const b of st)b.alive=false;
    for(const b of hid)b.alive=true;
    check("v134.8 anchors: a throne, a Storage Pit at TC_RING+1, a second pit and a castle — every "+
      "other anchor hidden so the rule is what is being measured. Over "+NPROBE+" plot-ages: not "+
      "turning at all laps "+flat+", turning away from the NEAREST anchor laps "+naive+" (WORSE — "+
      "the fields between the pit and the throne are nearer the PIT, so they turn their backs on "+
      "it and drive their barns into the box), trying every anchor's facing and keeping the "+
      "roomiest laps "+nogate+", and doing that with the throne's box as a HARD GATE rather than "+
      "one vote among several laps "+gated+". The shipped farmFacing laps "+shipped,
      shipped===0&&gated===0&&flat>0&&naive>0&&nogate>0);
    check("v134.8 anchors: …and the rule written out above IS farmFacing — same answer on all "+
      NPROBE/5+" plots of that town's ring over its "+TOWN.length+" anchors (worst disagreement "+
      worstD.toExponential(1)+" rad)",apart===0);
  }

  // --- 3. THE PLAYER'S FIELDS TURN TOO.
  {
    const fs2=require("fs"), path2=require("path");
    const inp=fs2.readFileSync(path2.join(__dirname,"..","js","06-input.js"),"utf8");
    // In updateGhostFollow, so it re-aims as he walks around the town; guarded by rotManual, so R
    // takes it back; and R must SET that flag or the ghost snaps home the moment he lets go.
    const inGhost=inp.indexOf('if(placing.type==="farm"&&!placing.rotManual)placing.rot=farmFacing(MYTEAM,')>=0;
    const rKey=/placing\\.rot=\\(\\(placing\\.rot\\|\\|0\\)\\+Math\\.PI\\/4\\)[\\s\\S]{0,400}?placing\\.rotManual=true/.test(inp);
    // …and the value has to land in placing.rot rather than straight on the mesh, because that is
    // the field the commit and the guest's build request both read (06-input.js:850/856).
    const commits=inp.indexOf('makeBuilding(MYTEAM,placing.type,x,z,false,placing.rot||0)')>=0;
    const guest=inp.indexOf('NET.guestAct({act:"build",type:placing.type,x:x,z:z,rot:placing.rot||0})')>=0;
    check("v134.8 ghost: a player's farm turns itself the same way the AI's do — in "+
      "updateGhostFollow ("+inGhost+"), overridable with R ("+rKey+"), and carried on placing.rot "+
      "so the host's own commit ("+commits+") and a guest's build request ("+guest+") both ship "+
      "the rotation without a second code path",
      inGhost&&rKey&&commits&&guest);
  }
}

console.log(fails?("\\n"+fails+" FAILURES"):"\\nALL SMOKE TESTS PASSED");`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(S,s);
console.log("patch-smoketest-farmrot-v134: OK");
