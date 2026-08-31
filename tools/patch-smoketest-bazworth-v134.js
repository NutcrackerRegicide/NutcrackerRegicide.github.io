#!/usr/bin/env node
/* patch-smoketest-bazworth-v134.js — gates for v134.5, and one of my own rules retired.
 *
 * THE RETIREMENT FIRST. The v134.3 gate asserted that a swept map sends the hold band to a CASTLE —
 * "once every square is yours the castle posting is right again" — and that was my sentence, tested
 * in both directions, green all through v134.4. It was still wrong. A swept map pays 12 a second,
 * the largest income in the game, and the moment it is swept is the moment it is worth guarding.
 * The gate keeps both directions; the second one now asserts the band GUARDS a square instead.
 *
 * THE NEW GATES are mostly arithmetic, because the margin is arithmetic: the first square pays 3 a
 * second across three resources, the second 3, the THIRD 6, and one taken from the enemy pays your
 * gain plus their loss. The behavioural halves are the two that were actually costing squares — a
 * doctrine that asked for nothing to guard what it held, and a tour clock that walked the last
 * guard off a square nobody else was watching.
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

sub("export the worth",
`  "isWorker,OX_MAX,OX_MIN_VILLS,OX_MIN_CUTTERS,OX_WOOD_WANT,OX_WOOD_FULL,manageBands,"+ // v134.4 the ox`,
`  "isWorker,OX_MAX,OX_MIN_VILLS,OX_MIN_CUTTERS,OX_WOOD_WANT,OX_WOOD_FULL,manageBands,"+ // v134.4 the ox
  "bazaarWorth,HOLD_TOUR,"+                            // v134.5 what the squares pay`);

sub("a swept map is guarded, not abandoned",
`    check("v134.3 squares: with a castle standing, an UNHELD bazaar still gets the band ("+
      (withFree&&withFree.why)+") — and once every square is yours the castle posting is right "+
      "again ("+(swept&&swept.why)+"). Before this, a castle pre-empted every square from about "+
      "minute ten, and every doctrine builds a castle",
      !!castle&&withFree&&withFree.why==="bazaar"&&swept&&swept.why==="castle");`,
`    // v134.5: …AND THE SECOND HALF OF THIS GATE WAS WRONG, and it was mine. It asserted that a
    // swept map sends the band to a CASTLE, which is what v134.3 shipped and what this gate has
    // certified ever since. A swept map pays 12 a second — the largest income in the game — and a
    // castle has walls, towers and a garrison to look after itself. Measured on v134.4: blue took
    // ten squares across three campaigns and lost five, because nothing was ever posted to keep
    // one. The band GUARDS the square it holds now, and "why" says which of the two it is doing.
    check("v134.3 squares: with a castle standing, an UNHELD bazaar still gets the band ("+
      (withFree&&withFree.why)+") — and once every square is yours the band GUARDS one rather than "+
      "going home to the courtyard ("+(swept&&swept.why)+"). Before v134.3 a castle pre-empted "+
      "every square from about minute ten; before v134.5 it took the band back the moment the map "+
      "was swept, which is the moment there is most to lose",
      !!castle&&withFree&&withFree.why==="bazaar"&&swept&&swept.why==="guard"&&!!(swept&&swept.baz));`);

sub("the v134.5 bench",
`console.log(fails?("\\n"+fails+" FAILURES"):"\\nALL SMOKE TESTS PASSED");`,
`// ==================== v134.5 WHAT THE SQUARES PAY ====================
{
  const G=global.__G;
  const NM=G.neutralMarkets;
  const own0=NM.map(m=>m.owner);
  const setOwn=(a)=>{for(let i=0;i<NM.length;i++)NM[i].owner=a[i];};

  // --- 1. THE MARGIN. BAZ_YIELD_BY_HELD is 0/1/2/4 by COUNT, so the third square is worth two of
  //        the first and a steal pays twice. Pure arithmetic, read off the shipped table.
  {
    const team=G.BLUE, foe=G.RED;
    setOwn([-1,-1,-1]);            const first =G.bazaarWorth(team,NM[0]);
    setOwn([team,-1,-1]);          const second=G.bazaarWorth(team,NM[1]);
    setOwn([team,team,-1]);        const third =G.bazaarWorth(team,NM[2]);
    setOwn([team,team,team]);      const hold3 =G.bazaarWorth(team,NM[2]);   // what losing it costs
    setOwn([foe,foe,foe]);         const steal =G.bazaarWorth(team,NM[2]);   // their THIRD: 1 + 2
    setOwn([-1,-1,foe]);           const steal1=G.bazaarWorth(team,NM[2]);   // their only one: 1 + 1
    setOwn(own0);
    check("v134.5 worth: the table doubles at the sweep, so the marginal square is not a constant — "+
      "first "+first+"/sec, second "+second+", THIRD "+third+", and holding that third is worth "+
      hold3+" to keep. A steal from an enemy holding one pays "+steal1+", and prising the THIRD "+
      "out of an enemy who holds all three pays "+steal+" — your gain and their loss at once",
      first===3&&second===3&&third===6&&hold3===6&&steal1===6&&steal===9);
  }

  // --- 2. THE POSTING IS RANKED BY WORTH, AND THE GRAND DOES NOT WIN BY BEING GRAND. The old sort
  //        was Grand-first, a v132.26 fossil: the Grand's premium ended at v132.27 and it is the
  //        biggest plaza in the middle of the map — the hardest of the three to hold, same pay.
  {
    const team=G.BLUE;
    setOwn([-1,-1,-1]);
    const p=G.bandHoldPoint(team,0);
    const grand=NM.find(m=>m.grand);
    // ⚠ THE SAME ORIGIN THE CODE RANKS FROM. bandHoldPoint measures from TCPOS — the throne's
    // FIXED position — and this gate measured from teamTC(), the Town Center building, which on
    // SMOKE_SEED=1 the campaign had razed and rebuilt somewhere else. Two different origins, one
    // red gate, nothing wrong with either piece of code.
    const tc={x:G.TCPOS[team][0],z:G.TCPOS[team][1]};
    const nearest=NM.slice().sort((a,b)=>
      Math.hypot(a.x-tc.x,a.z-tc.z)-Math.hypot(b.x-tc.x,b.z-tc.z))[0];
    // …and with two already held, the LAST one outranks everything, wherever it sits
    setOwn([team,team,-1]);
    const sweep=G.bandHoldPoint(team,0);
    // ⚠ READ THE VERDICT BEFORE PUTTING THE BOARD BACK. The first cut asked
    // "sweep.baz.owner!==team" inside the check() call — which runs AFTER setOwn(own0) — so on any
    // seed where the campaign really did own that square, the gate reported the staged answer as a
    // held one and went red on a posting that was correct. Take the reading while the staging
    // is still standing.
    const sweepUnheld=!!(sweep.baz&&sweep.baz.owner!==team);
    const sweepWorth=G.bazaarWorth(team,sweep.baz);
    setOwn(own0);
    check("v134.5 posting: with everything up for grabs the band takes the square this throne can "+
      "keep — the nearest, not the Grand ("+(p.baz===grand?"THE GRAND":"a road square")+", "+
      (p.baz===nearest?"nearest":"not nearest")+") — and with two held it goes for the one that "+
      "COMPLETES THE SWEEP ("+(sweepUnheld?"the unheld one":"a held one")+
      ", worth "+sweepWorth+"/sec against 3 for either of the others)",
      p.baz===nearest&&p.baz!==grand&&sweepUnheld&&sweepWorth===6);
  }

  // --- 3. THE DOCTRINE ASKS FOR A GUARD. Before this the want-list counted only squares still up
  //        for grabs, so a team holding two asked for one band and a team holding all three asked
  //        for none — and then wondered where they went.
  {
    const team=G.RED, D=G.directors[team], pers0=D.pers, bands0=D.bands;
    D.pers="expand"; D.bands=[];
    const made=[];
    for(let i=0;i<40;i++){
      const u=G.makeUnit(team,"clubman",120+(i%10)*2,-170-((i/10)|0)*2,{name:"Guard"+i,bot:{role:"war"}});
      u.bandRef=null; made.push(u);
    }
    setOwn([team,team,team]);                         // the map is swept: everything to lose
    for(let i=0;i<4;i++)G.manageBands(D);
    const holds=D.bands.filter(b=>b.role==="hold");
    let onSquare=0;
    for(const b of holds)if(b.point&&b.point.baz&&b.point.baz.owner===team)onSquare++;
    setOwn(own0);
    D.pers=pers0; D.bands=bands0;
    for(const u of made){u.bandRef=null;u.alive=false;}
    // ⚠ TWO, NOT ONE. The want-list always carried a single base "hold" entry, so a swept map still
    // dealt ONE hold band and the first cut of this gate passed with the guard entry mutated out —
    // it was asserting the base entry. What v134.5 adds is a hold band FOR WHAT IS HELD, on top of
    // the ones asked for by what is still up for grabs, and a count is the only way to see it.
    check("v134.5 guard: with all three squares held the doctrine asks for a band to KEEP them — "+
      holds.length+" hold bands dealt, "+onSquare+" of them standing on a square this team owns. "+
      "The want-list used to count only squares still up for grabs, so a swept map asked for the "+
      "one base entry and everything else went raiding",
      holds.length>=2&&onSquare>=2);
  }

  // --- 4. THE LAST GUARD IS NOT MARCHED OFF. Same staging as the v113 relief gate — a spent tour
  //        and a cold field — but standing on a square this team HOLDS, with no other hold band.
  {
    const team=G.BLUE, D=G.directors[team], bands0=D.bands, NOWT=G.getT();
    D.bands=D.bands.filter(b=>b.role!=="hold");
    // ⚠ THE MAP HAS TO BE SWEPT FOR THE GUARD CASE TO EXIST AT ALL. The first cut staged one held
    // square and two up for grabs, and bandHoldPoint quite rightly posted the band to one of the
    // two it did NOT have — so it was never guarding anything and the tour marched it off exactly
    // as it should. A band only guards when there is nothing left to take.
    setOwn([team,team,team]);
    const held=NM[0];
    const cold=G.makeUnit(team,"clubman",held.x,held.z,{name:"Sentry45",bot:{role:"war"}});
    const hb={id:9451,role:"hold",members:[cold],holdUntil:NOWT-1,lastContact:NOWT-9999,
              laneZ:0,laneUntil:NOWT+999};
    cold.bandRef=hb; D.bands.push(hb);
    // HOLD_WATCH is 48: an enemy inside that resets the contact clock and the band is right not to
    // be relieved. Isolating 40 left a band of them in the 40-48 ring on SMOKE_SEED=42 and the
    // second half of this gate read a working contact rule as a broken tour.
    const cellar=isolateArea(held.x,held.z,G.HOLD_WATCH+8,{team:1-team,keep:[cold]});
    const capWas=NM.map(m=>({m,cap:m.cap,capTeam:m.capTeam}));
    for(const m of NM){m.cap=0;m.capTeam=-1;}          // nothing mid-capture: only the guard rule
    G.manageBands(D);
    const stayed=hb.role==="hold"&&hb.point&&hb.point.baz&&hb.point.baz.owner===team;
    // …and with a SECOND hold band on the board the tour runs as it always did
    const cold2=G.makeUnit(team,"clubman",held.x+3,held.z+3,{name:"Sentry45b",bot:{role:"war"}});
    const hb2={id:9452,role:"hold",members:[cold2],holdUntil:NOWT-1,lastContact:NOWT-9999,
               laneZ:0,laneUntil:NOWT+999};
    cold2.bandRef=hb2; D.bands.push(hb2);
    G.manageBands(D);
    const relieved=D.bands.filter(b=>(b===hb||b===hb2)&&b.role!=="hold").length;
    cellar.restore();
    for(const e of capWas){e.m.cap=e.cap;e.m.capTeam=e.capTeam;}
    setOwn(own0);
    D.bands=bands0; cold.alive=false; cold2.alive=false; cold.bandRef=null; cold2.bandRef=null;
    check("v134.5 guard: the LAST band on a square we hold is not relieved by the tour clock ("+
      (stayed?"held its ground":"WALKED OFF")+") — an unguarded bazaar looks exactly like quiet "+
      "ground right up until somebody strolls onto it — and with a second hold band on the board "+
      "the tour runs as usual ("+relieved+" of the two relieved)",
      stayed&&relieved>=1);
  }

  // --- 5. THE PATROL WALKS THE SQUARES. Four waypoints in a box within 26 of the town centre, on
  //        the safest ground on the map, while the thing that pays 12 a second sits out on the road.
  {
    const team=G.RED, D=G.directors[team];
    setOwn([team,-1,team]);
    const bd={id:9460,role:"patrol",members:[],laneZ:0,laneUntil:G.getT()+999};
    const u=G.makeUnit(team,"clubman",130,-160,{name:"Walker",bot:{role:"war"}});
    u.bandRef=bd; bd.members.push(u);
    D.bands.push(bd);
    G.manageBands(D);
    const wps1=(bd.wps||[]).length;
    let onSq=0;
    for(const w of (bd.wps||[]))for(const m of NM)
      if(m.owner===team&&Math.hypot(w.x-m.x,w.z-m.z)<0.01)onSq++;
    // …and the round is rebuilt when the board changes: take the third square and it joins the walk
    setOwn([team,team,team]);
    G.manageBands(D);
    const wps2=(bd.wps||[]).length;
    setOwn(own0);
    D.bands=D.bands.filter(b=>b!==bd);
    u.bandRef=null; u.alive=false;
    check("v134.5 patrol: the round takes in the squares this team holds ("+wps1+" waypoints, "+
      onSq+" of them ON a held square) and is REBUILT when the board changes (took a third square: "+
      wps1+" -> "+wps2+" waypoints). It was four points in a box within 26 of the town centre, set "+
      "once for the life of the band",
      onSq===2&&wps2===wps1+1);
  }
}

console.log(fails?("\\n"+fails+" FAILURES"):"\\nALL SMOKE TESTS PASSED");`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patch-smoketest-bazworth-v134: OK");
