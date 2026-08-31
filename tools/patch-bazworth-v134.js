#!/usr/bin/env node
/* patch-bazworth-v134.js — v134.5: a square is worth what it pays, and what you hold you keep.
 *
 * THE YIELD TABLE IS KEYED ON THE COUNT AND NOTHING ELSE — 0 / 1 / 2 / 4 a second of each of food,
 * gold and wood (00-data.js, v132.27: "THE GRAND NO LONGER PAYS MORE THAN EITHER OF THE OTHERS").
 * So what a particular square is worth is a MARGIN, not a property of the square:
 *
 *     your first  square   +1/sec of three resources
 *     your second square   +1/sec
 *     your THIRD  square   +2/sec  — the sweep DOUBLES, so the last one is worth two of the first
 *     one taken from THEM  pays twice: your gain and their loss, on the same march
 *
 * MEASURED on the shipped v134.4 tree, three twenty-minute campaigns:
 *
 *     seed 11   blue took 3 lost 1, held 921 sq-s (546 of it the Grand)   mean total yield 1.84
 *     seed 33   blue took 3 lost 2, held 1756 (971 Grand)                                  2.44
 *     seed 44   blue took 4 lost 2, held 2925 (888 Grand)                                  3.26
 *
 * Two things in those rows. First, THEY LOSE A THIRD TO A HALF OF WHAT THEY TAKE — 10 takes against
 * 5 losses for blue across the three — because once a square is held nothing guards it: the want
 * list asks for a hold band per square still up for grabs, so a swept map asks for none, and
 * bandHoldPoint sends the last band to a CASTLE. An army standing in its own courtyard while the
 * thing that pays 12 a second sits unattended.
 *
 * Second, THE GRAND IS THE MAJORITY OF THE HOLDING, because bandHoldPoint sorts Grand-first. That
 * sort is a v132.26 fossil — the Grand paid a premium then. Today it is the biggest plaza (11.4
 * against 8.6), in the middle of the map, the hardest of the three to take and to keep, for exactly
 * the same pay as either of the others.
 *
 * SO: bazaarWorth() computes the margin, the posting is ranked by it, a square already held is
 * posted to once the ones that are not are spoken for, the doctrine asks for a band to guard what
 * it holds, and the last guard is not marched off by the tour clock.
 *
 * ⚠ THE CASTLE POSTING IS GONE, and it was mine, from v134.3 ("once every square is yours the
 * castle posting is right again"). It was wrong. A swept map is the biggest prize on the board and
 * the moment it is swept is the moment it is worth defending, not the moment to go home.
 */
const fs=require("fs"),path=require("path");
const R=path.join(__dirname,"..");
const F=path.join(R,"js","07-ai.js");
let s=fs.readFileSync(F,"utf8");
let sw=fs.readFileSync(path.join(R,"sw.js"),"utf8");
let ix=fs.readFileSync(path.join(R,"index.html"),"utf8");
let failed=[];
function sub(name,from,to){
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
}

sub("what a square is worth",
`function bandHoldPoint(team,idx){ // an unheld SQUARE first, then a castle, then the road`,
`// ---- v134.5 WHAT A SQUARE IS WORTH, IN RESOURCES A SECOND, TO THIS TEAM, RIGHT NOW ----
// BAZ_YIELD_BY_HELD is indexed by the COUNT held: 0/1/2/4 of each of three resources. The value of
// one square is therefore a MARGIN and it moves as the board moves — your third is worth two of
// your first, and one taken from the enemy pays your gain AND their loss on the same march.
// ⚠ IT IS NOT A PROPERTY OF THE BUILDING. The Grand's premium ended at v132.27; what survived it
// was a Grand-first sort in the posting, which spent most of this AI's square-seconds on the
// hardest square of the three (11.4 of plaza, in the middle of the map) for identical pay.
function bazaarWorth(team,m){
  if(!m)return 0;
  const B=BAZ_YIELD_BY_HELD, cap=B.length-1;
  const at=(n)=>B[Math.max(0,Math.min(n,cap))]||0;
  let mine=0,theirs=0;
  for(const q of neutralMarkets){if(q.owner===team)mine++;else if(q.owner===1-team)theirs++;}
  if(m.owner===team)return (at(mine)-at(mine-1))*3;      // what LOSING this one would cost us
  const gain=at(mine+1)-at(mine);                        // …what taking it would pay
  const deny=(m.owner===1-team)?(at(theirs)-at(theirs-1)):0; // …and what it costs them to lose it
  return (gain+deny)*3;                                  // three resources, so three times over
}
function bandHoldPoint(team,idx){ // the square that pays most, held or not, then the road`);

sub("the posting is ranked by what it pays",
`  const _free=(typeof neutralMarkets!=="undefined")?neutralMarkets.filter(m=>m.owner!==team):[];
  const own=buildings.filter(b=>b.alive&&b.built&&b.team===team&&b.type==="castle");
  if(own.length&&!_free.length){const c=own[idx%own.length];const hr=(bSurf(c.def)+3)*0.7071; // +4,+4 was 5.66 out; a castle blocks to 19.8
    return {x:c.x+hr,z:c.z+hr,why:"castle"};}`,
`  // v134.5 THE CASTLE POSTING IS GONE. v134.3 put the castle back for a swept map — "once every
  // square is yours the castle posting is right again" — and that was wrong twice over: a swept map
  // pays 12 a second, the largest income in the game, and the instant it is swept is the instant it
  // is worth guarding. Measured on v134.4: blue took ten squares across three campaigns and lost
  // five of them, because the doctrine asked for a hold band per square STILL UP FOR GRABS, so a
  // team that held them all asked for none and the last band went home to stand in its courtyard.
  // A castle guards itself; it has walls, towers and a garrison. A bazaar has a plinth.`);

sub("…and a square you hold is a posting too",
`  if(neutralMarkets.length){
    const want=neutralMarkets.filter(m=>m.owner!==team);
    const pool=want.length?want:neutralMarkets;
    pool.sort((a,b)=>(b.grand?1:0)-(a.grand?1:0)||
      dist2(a.x,a.z,TCPOS[team][0],TCPOS[team][1])-dist2(b.x,b.z,TCPOS[team][0],TCPOS[team][1]));
    const m=pool[idx%pool.length];
    return {x:m.x,z:m.z,why:"bazaar",baz:m};
  }`,
`  if(neutralMarkets.length){
    // v134.5 RANKED BY WHAT IT PAYS, then by which one this throne can realistically keep. The old
    // sort was (b.grand?1:0)-(a.grand?1:0) || nearest — Grand first, and the Grand has paid exactly
    // what the other two pay since v132.27. On the three seeds measured it took 546 of blue's 921
    // square-seconds, 971 of 1756 and 888 of 2925: most of this army's holding, spent on the one
    // square hardest to hold, for no premium at all.
    const _rank=(a,b)=>bazaarWorth(team,b)-bazaarWorth(team,a)||
      dist2(a.x,a.z,TCPOS[team][0],TCPOS[team][1])-dist2(b.x,b.z,TCPOS[team][0],TCPOS[team][1]);
    // …and the ones we do NOT hold are spoken for first: a band that takes a square earns more than
    // a band that stands on one we already have. Guarding is what the spare bands are for.
    const want=neutralMarkets.filter(m=>m.owner!==team).sort(_rank);
    const mine=neutralMarkets.filter(m=>m.owner===team).sort(_rank);
    const order=want.concat(mine);
    const m=order[idx%order.length];
    return {x:m.x,z:m.z,why:m.owner===team?"guard":"bazaar",baz:m};
  }`);

sub("the doctrine asks for a guard, and for the sweep",
`  {const _free=(typeof neutralMarkets!=="undefined")
      ?neutralMarkets.filter(m=>m.owner!==team).length:0;
   for(let i=1;i<_free&&wantRoles.length<9;i++)wantRoles.push("hold");}`,
`  {const _nm=(typeof neutralMarkets!=="undefined")?neutralMarkets:[];
   const _free=_nm.filter(m=>m.owner!==team).length, _held=_nm.filter(m=>m.owner===team).length;
   for(let i=1;i<_free&&wantRoles.length<9;i++)wantRoles.push("hold");
   // v134.5 …AND ONE MORE WHEN THE NEXT SQUARE COMPLETES THE SWEEP. The table doubles at three
   // (1/2/4), so the last square is worth two of the first — the one moment in this game where the
   // marginal objective is worth MORE than the one before it, and the AI has been treating them
   // all alike. Measured: the two armies together collected a mean of 1.84, 2.44 and 3.26 of a
   // possible 4 over three campaigns, so the doubling was very nearly never collected by anybody.
   if(_free>0&&_held===_nm.length-1&&wantRoles.length<9)wantRoles.push("hold");
   // v134.5 …AND ONE TO GUARD WHAT IS ALREADY HELD. This list asked only for squares still up for
   // grabs, so a team that held some asked for nothing to keep them and lost a third to a half of
   // everything it took (10 taken, 5 lost, blue, three seeds).
   if(_held>0&&wantRoles.length<9)wantRoles.push("hold");}`);

sub("the last guard is not marched off",
`      const _bz=bd.point&&bd.point.baz;
      const _taking=_bz&&(_bz.owner!==team)&&(_bz.capTeam===team||_bz.cap>0.02);
      if(T>bd.holdUntil&&T-(bd.lastContact||0)>HOLD_QUIET&&!_taking){ // relieved — march on`,
`      const _bz=bd.point&&bd.point.baz;
      const _taking=_bz&&(_bz.owner!==team)&&(_bz.capTeam===team||_bz.cap>0.02);
      // v134.5 …AND THE LAST GUARD ON A SQUARE WE HOLD DOES NOT WALK AWAY FROM IT. The tour clock
      // exists so a band does not stand on quiet ground for ever, and quiet ground is exactly what
      // an unguarded bazaar looks like right up until somebody strolls onto it. One band may be
      // pinned this way, never more: with a second hold band on the board the tour runs as usual.
      const _guard=_bz&&_bz.owner===team&&D.bands.filter(b=>b.role==="hold").length<=1;
      if(T>bd.holdUntil&&T-(bd.lastContact||0)>HOLD_QUIET&&!_taking&&!_guard){ // relieved — march on`);

sub("the patrol sweeps what the team holds",
`      if(!bd.wps){
        const tc=TCPOS[team];
        bd.wps=[{x:tc[0]+side*15,z:tc[1]+11},{x:tc[0]+side*22,z:tc[1]+16},{x:tc[0]+side*4,z:tc[1]-24},{x:tc[0]+side*26,z:tc[1]-6}];
        bd.wi=0;
      }`,
`      // v134.5 THE PATROL SWEEPS THE SQUARES TOO. These four waypoints are a box within 26 of the
      // town centre — a loop around ground that already has a Town Center, a kingsguard and every
      // building this team owns standing on it. Meanwhile the thing that pays 12 a second sits out
      // on the road with at most one band on it. A patrol is the cheapest defence in the game and
      // it was walking circles in the safest place on the map.
      // ⚠ AND THE LIST IS REBUILT WHEN THE BOARD CHANGES. bd.wps was set once and kept for the
      // life of the band, so a square taken after the band formed would never have been walked.
      const _hk=(typeof neutralMarkets!=="undefined")?neutralMarkets.map(m=>m.owner).join(""):"";
      if(!bd.wps||bd.wpKey!==_hk){
        const tc=TCPOS[team];
        bd.wps=[{x:tc[0]+side*15,z:tc[1]+11},{x:tc[0]+side*22,z:tc[1]+16},{x:tc[0]+side*4,z:tc[1]-24},{x:tc[0]+side*26,z:tc[1]-6}];
        if(typeof neutralMarkets!=="undefined")
          for(const m of neutralMarkets)if(m.owner===team)bd.wps.push({x:m.x,z:m.z});
        bd.wpKey=_hk;
        bd.wi=0;
      }`);

// ---------------------------------------------------------------------------
// The version pair. INVARIANT #4 — a smoketest gate enforces it.
// ---------------------------------------------------------------------------
{
  const a1=`const VERSION="v134.4";`, b1=`const VERSION="v134.5";`;
  const a2=`<p class="verstamp">v134.4 — THE OX AT THE PIT</p>`,
        b2=`<p class="verstamp">v134.5 — WHAT THE SQUARES PAY</p>`;
  if(sw.split(a1).length-1!==1)failed.push("sw.js VERSION (need exactly 1)");
  else sw=sw.split(a1).join(b1);
  if(ix.split(a2).length-1!==1)failed.push("index.html verstamp (need exactly 1)");
  else ix=ix.split(a2).join(b2);
}

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(F,s);
fs.writeFileSync(path.join(R,"sw.js"),sw);
fs.writeFileSync(path.join(R,"index.html"),ix);
console.log("patch-bazworth-v134: OK");
