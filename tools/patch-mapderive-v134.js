#!/usr/bin/env node
/* patch-mapderive-v134.js — v134.9 THE SCREEN FACES THE LANES.
 *
 * Four numbers in the marshal's file encode a map shape, and the map has been reworked twice since
 * they were typed. They are not opinions that have aged; they are DERIVED values that stopped
 * agreeing with what they were derived from, and every one of them is recoverable from data the
 * game already carries. `tools/mapdrift.js` is the instrument; these are its readings.
 *
 * ── 1. THE TOWER SCREEN ───────────────────────────────────────────────────────────────────────
 * `z=(Math.random()-0.5)*66` puts a Guard Tower anywhere in z -33..+33 on a map 304 deep. Armies
 * do not march down the middle: LANE_Z is [0, 48, -48, 106, -106] and every raid, every band and
 * every loose soldier is dealt one of those five (assignLane). Sampled at 1 Hz over four seeded
 * 15-minute campaigns, enemy soldiers standing in an 8-wide slab at the defender's own wall line:
 *
 *     seed        1        42       777      12345      (team0 / team1)
 *     |z| <= 33   20.7/33.1  21.0/25.9  32.8/51.5  44.0/26.4     mean 31.9%
 *     |z| <= 48   39.4/45.2  38.7/67.0  55.8/67.9  68.5/44.8     mean 53.4%
 *     within 25 of a LANE_Z
 *                 90.4/93.5  93.5/94.7  95.0/96.3  97.3/90.8     mean 93.9%
 *
 * The lanes are where they walk — 94% of every sighting is within 25 of one — and the screen was
 * built for the middle of a map whose traffic is spread across five lanes with a heavy southern
 * bias (the two flanking bazaars sit at z -104.42; the Grand at +36).
 *
 * The end-to-end number is worse than the coverage figure suggests. Counting only sightings within
 * a Guard Tower's actual reach (18) of a tower the marshal actually built, across those eight
 * armies: 0.0 / 0.0 / 45.2 / 0.0 / 0.0 / 0.0 / 19.0 / 31.3 — mean 11.9%. The ceiling, if every
 * lane carried one, is ~73%.
 *
 * SO THE TOWERS ARE DEALT THE LANES, CENTRE-OUT, instead of scattered across a third of the map.
 * LANE_Z is already ordered [0, 48, -48, 106, -106], so the first tower screens the Kings Road,
 * the next two the flanks, and a turtle's fourth and fifth reach the far lanes. Two random draws
 * before, two after — the count is unchanged, so nothing about the seeded window moves.
 *
 * ⚠ AND THE WATCH TOWER IS LEFT ALONE, deliberately. It has no `atk` at all — it is `vision:80`,
 * a seeing building, and 80 units of sight from anywhere near the town already covers the frontage
 * the lanes run through. Moving it would be churn with no measurement behind it. The mapdrift
 * instrument counted both types in its first draft and I had to correct the number; the ~12% above
 * is Guard Towers only.
 *
 * ── 2. THE CURTAIN ────────────────────────────────────────────────────────────────────────────
 * `wallLineSegments(wt, front, tc[1]-48, front, tc[1]+48).slice(0, P.walls)` plans a 96-unit line.
 * wallLineSegments cuts that into round(96/10.9) = 9 segments — and then the slice throws the
 * ninth away, so a turtle that builds all eight of its walls ends with a curtain that has a
 * SEGMENT-WIDE HOLE at one end, every time, by construction. The length is now derived from what
 * the marshal can actually afford to build: P.walls segments at the same 10.9 the segmenter uses,
 * so the plan and the purse agree and every planned segment gets built. Only `turtle` walls
 * (walls:8; rush, boom and expand are all 0), which is why this is rare rather than wrong.
 *
 * ── 3. THE GATE ───────────────────────────────────────────────────────────────────────────────
 * `const d=Math.abs(b.z-6); // the road runs ~z 6 at the wall line`. It does not. roadPoint's x is
 * linear in t, so the road's z at any x is exact arithmetic, and at the four fronts the wall
 * planner actually uses (34, then 48/62/76 after v134.4's retries) it reads:
 *
 *     front   34      48      62      76
 *     road z  7.98   10.53   12.43   13.64        (literal 6, error 1.98 .. 7.64)
 *
 * Segments sit 10.9 apart, so an error of 7.64 is most of a segment: the gate goes into the wrong
 * one and the Kings Road runs through a wall. Inverted from roadPoint itself, which is the source
 * the plazas and the tree-clearing corridor already share.
 *
 * ── 4. THE PATROL BOX ─────────────────────────────────────────────────────────────────────────
 * Four waypoints at (15,11) (22,16) (4,-24) (26,-6) from the throne — the furthest 27.20 out,
 * against a TC_RING of 30. The entire loop is INSIDE the farm ring, so a patrol band walks circles
 * among its own corn. Those offsets predate the ring: v134.1 pushed every other sampler out with
 * it and this one was missed, the same way the curtain's middle segment was left sitting exactly
 * ON the ring until v134.1 moved it to 34. Re-derived as a ring at TC_RING+6, weighted to the
 * enemy side, so the loop is walked on the ground an attacker crosses instead of the ground the
 * kingsguard is already standing on. v134.5's held-bazaar waypoints are unchanged and still
 * appended.
 */
const fs=require("fs"),path=require("path");
const R=path.join(__dirname,"..");
const A=path.join(R,"js","07-ai.js");
let a=fs.readFileSync(A,"utf8");
let sw=fs.readFileSync(path.join(R,"sw.js"),"utf8"), h=fs.readFileSync(path.join(R,"index.html"),"utf8");
let failed=[];
const sub=(name,from,to)=>{
  const n=a.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  a=a.split(from).join(to);
};

// ---------------------------------------------------------------------------
// 0. The road's z at a given x, once, where both the wall planner and anyone after it can reach
//    it. roadPoint is the source; this is its inverse and nothing more.
// ---------------------------------------------------------------------------
sub("roadZAt",
`function findSpot(team,type){`,
`// v134.9 WHERE THE KINGS ROAD IS, AT A GIVEN x. roadPoint's x is LINEAR in t — it interpolates
// TCPOS[0][0] to TCPOS[1][0] — so t is recoverable by division and the z falls straight out of the
// same function the plazas, the tree-clearing corridor and the bazaar sites already share. The AI
// used to carry the answer as the literal 6, which was right for a map two reworks ago; it is 7.98
// at the wall line the turtle plans first and 13.64 at the last of its three retries. Two
// derivations of one number is how a gate ends up somewhere the road isn't.
function roadZAt(x){
  const A0=TCPOS[0],B0=TCPOS[1];
  const span=(B0[0]-A0[0])||1;
  const t=Math.max(0,Math.min(1,(x-A0[0])/span));
  return roadPoint(t).z;
}
function findSpot(team,type){`);

// ---------------------------------------------------------------------------
// 1. The screen stands on the lanes.
// ---------------------------------------------------------------------------
sub("towers are dealt the lanes",
`    if(type==="tower"){ // towers screen the approach to the base, from outside the fields
      x=tc[0]+(team===BLUE?1:-1)*(TC_RING+2+Math.random()*24); z=(Math.random()-0.5)*66;
    }else if(type==="farm"){ // the fields ARE the ring`,
`    if(type==="tower"){
      // v134.9 A SCREEN STANDS WHERE THEY WALK. This was z = (random-0.5)*66, i.e. anywhere in
      // -33..+33 on a map 304 deep, and a Guard Tower reaches 18. Measured over four seeded
      // campaigns, enemy soldiers crossing the defender's own wall line fall within |z| 33 only
      // 31.9% of the time and within 25 of a LANE_Z 93.9% of the time — the lanes ARE the traffic,
      // because assignLane deals every raid and every band one of the five. Counting sightings
      // actually inside a built tower's reach, the shipped screen intercepted 11.9%.
      // DEALT, NOT SAMPLED: LANE_Z is ordered centre-out [0, 48, -48, 106, -106], so the first
      // tower screens the Kings Road, the next two the flanks, and a turtle's last two reach the
      // far lanes. Random placement clusters; a deal spreads. The jitter keeps two towers on one
      // lane from stacking when the count laps the table.
      // Two draws here, two before — the seeded window (invariant #2) cannot move on a count.
      const _lane=LANE_Z[countBld(team,"tower")%LANE_Z.length];
      x=tc[0]+(team===BLUE?1:-1)*(TC_RING+2+Math.random()*24);
      z=_lane+(Math.random()-0.5)*20;   // LANE_Z is MAP z, not town-relative — laneTarget reads it the same way
    }else if(type==="farm"){ // the fields ARE the ring`);

// ---------------------------------------------------------------------------
// 2. The curtain is as long as the wall the marshal can pay for.
// ---------------------------------------------------------------------------
sub("the curtain's length is derived",
`      const tc=TCPOS[team], front=tc[0]+(team===BLUE?1:-1)*(D.wallFront||34);
      D.wallPlan=wallLineSegments(wt,front,tc[1]-48,front,tc[1]+48).slice(0,P.walls);
      D.wallPlaced=0;`,
`      const tc=TCPOS[team], front=tc[0]+(team===BLUE?1:-1)*(D.wallFront||34);
      // v134.9 AS LONG AS THE WALL HE CAN AFFORD, NOT 96 UNITS AND A SLICE. wallLineSegments cuts a
      // line into round(L/10.9) pieces, so a 96-unit plan became NINE segments and .slice(0,8) then
      // threw the ninth away: a turtle that built every wall it had still ended with a
      // segment-wide hole at one end, every game, by construction. Deriving the length from
      // P.walls makes the plan and the purse the same number — eight walls, eight segments, no
      // truncation. 10.9 is wallLineSegments' own step; keep them together.
      const _half=P.walls*10.9/2;
      D.wallPlan=wallLineSegments(wt,front,tc[1]-_half,front,tc[1]+_half).slice(0,P.walls);
      D.wallPlaced=0;`);

// ---------------------------------------------------------------------------
// 3. The gate goes where the road actually is.
// ---------------------------------------------------------------------------
sub("the gate finds the road",
`          const d=Math.abs(b.z-6); // the road runs ~z 6 at the wall line`,
`          // v134.9: was Math.abs(b.z-6), "the road runs ~z 6 at the wall line". It runs at 7.98
          // there and at 13.64 at the last of the three retry fronts, and segments are 10.9 apart —
          // so at the far fronts the literal picked the neighbouring segment and the Kings Road ran
          // through a wall instead of through the gate. roadZAt inverts roadPoint; one source.
          const d=Math.abs(b.z-roadZAt(b.x));`);

// ---------------------------------------------------------------------------
// 4. The patrol walks outside its own fields.
// ---------------------------------------------------------------------------
sub("the patrol ring is derived from the farm ring",
`        bd.wps=[{x:tc[0]+side*15,z:tc[1]+11},{x:tc[0]+side*22,z:tc[1]+16},{x:tc[0]+side*4,z:tc[1]-24},{x:tc[0]+side*26,z:tc[1]-6}];`,
`        // v134.9 OUTSIDE THE CORN. These four were (15,11) (22,16) (4,-24) (26,-6) from the
        // throne — the furthest 27.20 out against a TC_RING of 30 — so the whole loop ran INSIDE
        // the farm ring, through this team's own fields, past its own kingsguard. The offsets
        // predate the ring: v134.1 pushed every other sampler out with it and missed this one,
        // exactly as it found the curtain's middle segment sitting on the ring. Derived from
        // TC_RING now, so it moves when the ring does, and shortened on the rear leg (0.85) so the
        // long side of the loop is the side an attacker crosses. ⚠ 0.85, not 0.5: the first cut
        // weighted it 2:1 and put the rear waypoint at 18 from the throne — back inside the corn,
        // which is the very thing this change is about. The gate caught it.
        const _pr=TC_RING+6;
        bd.wps=[{x:tc[0]+side*_pr,      z:tc[1]},
                {x:tc[0]+side*_pr*0.7,  z:tc[1]+_pr*0.7},
                {x:tc[0]-side*_pr*0.85, z:tc[1]},
                {x:tc[0]+side*_pr*0.7,  z:tc[1]-_pr*0.7}];`);

// ---------------------------------------------------------------------------
// The version pair. INVARIANT #4 — a smoketest gate enforces it.
// ---------------------------------------------------------------------------
{
  const a1=`const VERSION="v134.8";`, b1=`const VERSION="v134.9";`;
  const a2=`<p class="verstamp">v134.8 — THE BARNS TURN OUT</p>`,
        b2=`<p class="verstamp">v134.9 — THE SCREEN FACES THE LANES</p>`;
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
fs.writeFileSync(A,a);
fs.writeFileSync(path.join(R,"sw.js"),sw);
fs.writeFileSync(path.join(R,"index.html"),h);
console.log("patch-mapderive-v134: OK");
