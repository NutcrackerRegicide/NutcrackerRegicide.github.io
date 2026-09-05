#!/usr/bin/env node
/* patch-farmrot-v134.js — v134.8 THE BARNS TURN OUT.
 *
 * This is the cure the v134.1 farm-ring note pointed at and deliberately did not take:
 *   "rotate each field so its barn faces AWAY from the Town Center. The barn's offset is fixed in
 *    world space only because a farm is never rotated; makeBuilding already takes a rot and the
 *    collider, the apron and the mesh all honour it. It needs a shot before it ships, not a
 *    derivation."
 * It has now had both. The shots are in shots/farm-rotation-side-by-side.png (rot 0 beside rot 90
 * from overhead — barn, plot, fence and crop rows all turn together, nothing left behind in world
 * space) and shots/farm-ring-barns-turned.png (eight fields at 22.5 from the throne).
 *
 * THE MEASUREMENT. Same method as the shipped gate — 720 bearings, the collider's own local->world
 * (wx = x + qx*cos + qz*sin, wz = z - qx*sin + qz*cos) — solving for the least farm-centre distance
 * at which no barn disc touches the Town Center's box:
 *
 *     age            1       2       3       4       5
 *     as built    23.45   20.80   23.75   26.75   22.20
 *     turned out  13.40   10.60   13.50   15.90   11.95
 *
 * Against TC_FARM_MIN 21 the as-built ring clears at age 2 ALONE. Turned, the worst age needs 15.90
 * and clears with 5.10 to spare. The overlap does not shrink; it disappears. TC_FARM_MIN and
 * TC_RING both stay exactly where they are, which is the point — the alternative was TC_FARM_MIN 27
 * against a TC_RING of 30, a three-unit band for a field thirteen wide.
 *
 * WHICH WAY IS "AWAY". The barn hangs off the field's local -z face. Under the collider's transform
 * a local (0,-1) maps to world (-sin(rot), -cos(rot)), so rot = -(bearing + PI/2) sends it to
 * (cos(bearing), sin(bearing)) — straight out along the bearing from the anchor. One line, no new
 * random draws, so the seeded window (invariant #2) cannot move.
 *
 * AND WHICH ANCHOR TO TURN AWAY FROM — the one real design decision here, and it took three
 * measured tries. Fields ring three things (farmAnchors: the Town Center, every built Storage Pit,
 * every built Castle), so "away" is ambiguous the moment a town has more than one. Swept over every
 * legal plot in the ring (360 bearings x every radius from TC_FARM_MIN+0.5 to TC_RING-1, checked
 * against the Town Center's box at all five ages), with one Storage Pit standing at the given
 * distance from the throne — pits sample TC_RING+1 .. TC_RING+18, so 30-32 is the near end of
 * ordinary, not a contrivance:
 *
 *     pit at        30     31     32     34     38    42      (plots swept: 5,760 each)
 *     unrotated    101     --     83     --      0     0
 *     nearest      104    103    103     --      6     0      <- WORSE than not turning at all
 *     nearest coll  26     23     13      0      0     0
 *     best facing    0      0      0      0      0     0
 *
 * "Nearest anchor" is the obvious rule and it is the worst of the three: a field ringing a pit just
 * outside TC_RING is nearer the pit than the throne, so it turns its back on the pit and drives its
 * barn straight into the Town Center. Weighting by REACH (dist - bSurf, i.e. which collider is this
 * barn closest to touching) fixes most of it and still leaves 26. What clears it everywhere is to
 * stop guessing and MEASURE the candidates: turn away from each anchor in turn, keep the facing
 * that leaves the barn the most room against all of them — with the Town Center's box as a hard
 * gate rather than one vote among several, because turning away from the throne ALWAYS clears the
 * throne (the second table above: 15.90 worst against a ring of 21) so a legal answer always
 * exists. On a mature town — throne, two pits and a castle — the by-vote version still lapped 9
 * plots in 11,520 and the gated version laps none.
 *
 * THE +1.0 ON EVERY REACH is not slack. bSurf returns the UNPADDED corner (hypot(fx,fz)) while the
 * collider pads every face by 0.7, and a padded box reaches hypot(fx+0.7,fz+0.7) at its corner —
 * 17.79 against 16.82 for a Town Center. Treating the box as a disc of bSurf is therefore NOT
 * conservative, and those nine plots were exactly the ones in that 0.97 shell.
 *
 * THE PLAYER GETS IT TOO, because the ring binds him identically (validFor is the one choke point,
 * v134.1) and his barns lap the same box. But it is a DEFAULT, not a law: R still rotates a
 * foundation, and pressing it sets placing.rotManual so the auto-facing stops fighting the key.
 * Nothing about the guest path changes — the rot already travels in guestAct and the host already
 * passes act.rot to makeBuilding (10-net.js:1318).
 */
const fs=require("fs"),path=require("path");
const R=path.join(__dirname,"..");
const A=path.join(R,"js","07-ai.js"), I=path.join(R,"js","06-input.js");
let a=fs.readFileSync(A,"utf8"), i=fs.readFileSync(I,"utf8");
let sw=fs.readFileSync(path.join(R,"sw.js"),"utf8"), h=fs.readFileSync(path.join(R,"index.html"),"utf8");
let failed=[];
const sub=(name,src,from,to)=>{
  const n=src.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return src;}
  return src.split(from).join(to);
};

// ---------------------------------------------------------------------------
// 1. farmAnchors carries the building it came from, so the facing rule can ask how far that
//    anchor's COLLIDER reaches. Two derivations of "the things a field rings" is how a new anchor
//    type ends up blessed for placement and forgotten by the rotation.
// ---------------------------------------------------------------------------
a=sub("farmAnchors carries def",a,
`    if(b.type==="towncenter")list.push({x:b.x,z:b.z,rMin:TC_FARM_MIN+0.5,rMax:TC_RING-1});
    else if(b.built&&b.type==="storage_pit")list.push({x:b.x,z:b.z,rMin:13,rMax:19});
    else if(b.built&&b.type==="castle")list.push({x:b.x,z:b.z,rMin:15,rMax:21});`,
`    // v134.8: each anchor now carries its own def, because farmFacing has to weigh anchors by how
    // far their COLLIDER reaches and not by how far their centre is. Placement never reads it.
    if(b.type==="towncenter")list.push({x:b.x,z:b.z,rMin:TC_FARM_MIN+0.5,rMax:TC_RING-1,def:b.def,type:b.type});
    else if(b.built&&b.type==="storage_pit")list.push({x:b.x,z:b.z,rMin:13,rMax:19,def:b.def,type:b.type});
    else if(b.built&&b.type==="castle")list.push({x:b.x,z:b.z,rMin:15,rMax:21,def:b.def,type:b.type});`);

// ---------------------------------------------------------------------------
// 2. The rule itself, beside the anchors it reads.
// ---------------------------------------------------------------------------
a=sub("farmFacing",a,
`function findFarmSpot(team){ // sample rings around every anchor, not just the TC`,
`// v134.8 THE BARN TURNS ITS BACK ON THE THING THE FIELD RINGS. A farm is \`flat\` — the plot is
// walkable and the only collider it owns is the barn, two discs hanging off the field's local -z
// face at (-4.75,-7.4) r 3.30 x BSCALE 0.6375. Because a farm was never rotated, that offset was
// fixed in WORLD space: every field in the ring pointed its barn the same way, and the ones on the
// wrong arc drove it into the Town Center's box. Measured, the least farm-centre distance clearing
// that box runs 23.45 / 20.80 / 23.75 / 26.75 / 22.20 by age against a ring minimum of 21 — clear
// at age 2 alone. Turned, the same five ages need 13.40 / 10.60 / 13.50 / 15.90 / 11.95.
//
// The transform is the collider's (05-combat.js:2251): local (0,-1) lands at (-sin r, -cos r), so
// rot = -(bearing + PI/2) sends the barn out along the bearing. Pure arithmetic on (x,z) — no
// random draw, so the seeded window is untouched.
//
// MEASURED, NOT GUESSED, once a town has more than one anchor. "Away" is ambiguous the moment a
// field rings both the throne and a Storage Pit, and the obvious rule — face away from the NEAREST
// anchor — is worse than not turning at all: a field ringing a pit just outside TC_RING is nearer
// the pit than the throne, so it turns its back on the pit and drives its barn into the box. Swept
// over every legal plot in the ring with a pit at 30 from the throne, against the box at all five
// ages: unrotated laps 101 of 5,760, nearest-anchor 104, nearest-COLLIDER 26, and the rule below
// none. So the barn does not pick an anchor by distance; it TRIES each anchor's facing and keeps
// the one that leaves it the most room against all of them.
//
// …with the throne as a hard gate rather than one vote among several. Turning away from the Town
// Center always clears the Town Center — that is the second table above, 15.90 needed at the worst
// age against a ring of 21 — so a legal answer always exists, and a facing that would put the barn
// in the throne's box is disqualified however much room it leaves elsewhere. Without that gate a
// mature town (throne, two pits, a castle) still lapped 9 plots in 11,520.
//
// EVERY blockPart, ignoring the age gates: a field planted at Bronze grows a dovecote at Medieval
// and a horse-gin at Enlightenment, and this rotation is chosen ONCE, at placement.
//
// +1.0 ON EVERY REACH because bSurf returns the UNPADDED corner while the collider pads each face
// by 0.7 — a padded box reaches 0.97 further at its corner than bSurf says, and those nine plots
// lived in exactly that shell.
function farmFacing(team,x,z){
  const anch=farmAnchors(team);
  if(!anch.length)return 0;                    // no anchor yet: leave it as it always was
  const PARTS=BLD.farm.blockParts||[], bs=(typeof BSCALE!=="undefined"&&BSCALE.farm)||1;
  let best=0,bestS=-1e9;
  for(const a of anch){
    const rot=-(Math.atan2(z-a.z,x-a.x)+Math.PI/2);
    const c=Math.cos(rot), sn=Math.sin(rot);
    let room=1e9, throne=1e9;
    for(const q of PARTS){
      const qx=q.x*bs, qz=q.z*bs, qr=q.r*bs+0.7;
      const wx=x+qx*c+qz*sn, wz=z-qx*sn+qz*c;  // the collider's own local -> world
      for(const b of anch){
        const g=Math.hypot(wx-b.x,wz-b.z)-(b.def?bSurf(b.def)+1:0)-qr;
        if(g<room)room=g;
        if(b.type==="towncenter"&&g<throne)throne=g;
      }
    }
    const sc=(throne<0)?room-1000:room;        // the throne's box is not one vote among several
    if(sc>bestS){bestS=sc;best=rot;}
  }
  return best;
}
function findFarmSpot(team){ // sample rings around every anchor, not just the TC`);

// ---------------------------------------------------------------------------
// 3. The AI's one farm placement. (findSpot's type==="farm" branch is never reached — the war
//    room's `want` chain never names a farm — so this is the only site.)
// ---------------------------------------------------------------------------
a=sub("the AI plants a turned field",a,
`      if(fs){pay(team,BLD.farm.cost);makeBuilding(team,"farm",fs.x,fs.z,false);}`,
`      // v134.8: …facing out. makeBuilding has taken a rot since walls needed one; a farm is the
      // first thing to ask for it that is not a wall.
      if(fs){pay(team,BLD.farm.cost);makeBuilding(team,"farm",fs.x,fs.z,false,farmFacing(team,fs.x,fs.z));}`);

// ---------------------------------------------------------------------------
// 4. The player's ghost snaps the same way — until he says otherwise.
// ---------------------------------------------------------------------------
i=sub("R takes the wheel",i,
`  if(placing&&k==="r"){ // rotate the foundation
    placing.rot=((placing.rot||0)+Math.PI/4)%(Math.PI*2);
    if(ghost)ghost.rotation.y=placing.rot;
    return;
  }`,
`  if(placing&&k==="r"){ // rotate the foundation
    placing.rot=((placing.rot||0)+Math.PI/4)%(Math.PI*2);
    // v134.8: and from here on this placement is HIS. A farm's ghost turns its barn outward on
    // every frame (updateGhostFollow), which without this flag would snap back the instant he let
    // go of the key — an auto-orientation that cannot be overridden is a bug, not a convenience.
    placing.rotManual=true;
    if(ghost)ghost.rotation.y=placing.rot;
    return;
  }`);

i=sub("the ghost faces out",i,
`  // stage-0 marker and every ordinary building: the classic follow
  ghost.position.set(a.x,terrainHeight(a.x,a.z),a.z);
  ghost.rotation.y=placing.rot||0;`,
`  // stage-0 marker and every ordinary building: the classic follow
  // v134.8 …and a FARM turns its barn away from whatever it is ringing, exactly as the AI's do.
  // The ring binds the player identically — validFor is the one choke point — so his barns lap the
  // same Town Center box, and a field he plants beside the AI's should not be the one facing the
  // wrong way. Recomputed per frame because the anchor changes as he walks around the town; R
  // stops it (rotManual), and the value lands in placing.rot so the commit and the guest's
  // build request both carry it without a second code path.
  if(placing.type==="farm"&&!placing.rotManual)placing.rot=farmFacing(MYTEAM,a.x,a.z);
  ghost.position.set(a.x,terrainHeight(a.x,a.z),a.z);
  ghost.rotation.y=placing.rot||0;`);

i=sub("the farm hint mentions the barn",i,
`  if(type==="farm")msg("Farms must border your Town Center or a Storage Pit.");`,
`  // v134.8: say the second half out loud. Auto-orientation the player cannot see the reason for
  // reads as the game fighting his mouse.
  if(type==="farm")msg("Farms must border your Town Center or a Storage Pit. The barn turns itself outward — R overrides.");`);

// ---------------------------------------------------------------------------
// The version pair. INVARIANT #4 — a smoketest gate enforces it.
// ---------------------------------------------------------------------------
{
  const a1=`const VERSION="v134.7";`, b1=`const VERSION="v134.8";`;
  const a2=`<p class="verstamp">v134.7 — THE MIDDLE DOOR</p>`,
        b2=`<p class="verstamp">v134.8 — THE BARNS TURN OUT</p>`;
  if(sw.split(a1).length-1!==1)failed.push("sw.js VERSION (need exactly 1)");
  else sw=sw.split(a1).join(b1);
  if(h.split(a2).length-1!==1)failed.push("index.html verstamp (need exactly 1)");
  else h=h.split(a2).join(b2);
}

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(A,a); fs.writeFileSync(I,i);
fs.writeFileSync(path.join(R,"sw.js"),sw);
fs.writeFileSync(path.join(R,"index.html"),h);
console.log("patch-farmrot-v134: OK");
