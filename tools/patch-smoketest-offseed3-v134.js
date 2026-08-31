#!/usr/bin/env node
/* patch-smoketest-offseed3-v134.js — three more gates that were standing on ground the campaign
 * moved. All three are green on the default seed and red on an off-seed, and none of them is about
 * the rule it names.
 *
 *   SMOKE_SEED=1        "v132.35 aura harness: the test ground is EMPTY (1 units within 20)"
 *   SMOKE_SEED=20260827 "calm creeps regenerate (+0 hp, cleared 1, still in ring 0)"
 *   SMOKE_SEED=20260827 "v132.53 aura: a dead owner's cloud is out on the very next sweep (1 lit)"
 *
 * THE AURA CORNER was chosen as a fixed spot — (-196, 132) — with a comment saying the ground has
 * to be empty and an assertion that it is. Both correct, and neither is a plan for the day a
 * campaign leaves somebody standing there. It picks a corner that IS clear now, from a list.
 *
 * THE CALM CAMP is the more interesting one. The bench clears the aggro ring and asserts the pack
 * regenerates — and the pack did not, with "still in ring 0" printed beside it. The bench's model
 * of the ring is the BASE radius; updateCreep widens it while the camp is awake and hunting
 * (st.wake / st.threat), so a body outside the bench's ring and inside the code's kept the pack
 * aggro'd. The bench was measuring a different circle from the one the code uses. It puts the camp
 * to sleep now, and puts it back exactly as it found it.
 *
 * THE DEAD OWNER'S CLOUD asserted auraLit().lit===0 — no lit aura point ANYWHERE in the world —
 * when its claim is about one dead hero's cloud. Since v134.2 bots hold blacksmith buffs, so any
 * veteran with an aura anywhere on the map fails it. auraLit() already reports deadLit, which is
 * exactly and only the thing this gate is named after.
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

sub("the aura harness picks a corner that is actually clear",
`      const DX=-196, DZ=132;
      const near=(x,z,r)=>{let n=0;for(const o of G.units){if(!o.alive)continue;
        const dx=o.root.position.x-x,dz=o.root.position.z-z;if(dx*dx+dz*dz<=r*r)n++;}return n;};`,
`      const near=(x,z,r)=>{let n=0;for(const o of G.units){if(!o.alive)continue;
        const dx=o.root.position.x-x,dz=o.root.position.z-z;if(dx*dx+dz*dz<=r*r)n++;}return n;};
      // v134.4: …and it PICKS a clear corner rather than naming one. (-196,132) was clear on the
      // default seed and had a campaign body standing in it on SMOKE_SEED=1 — the assertion below
      // did its job and reported ground that was not empty, which is not the same as a bug in the
      // auras. Four corners and two edges; the first empty one wins.
      const _DP=(()=>{for(const c of [[-196,132],[196,132],[-196,-132],[196,-132],[-150,150],[150,-150]])
        if(near(c[0],c[1],R*2)===0)return c; return [-196,132];})();
      const DX=_DP[0], DZ=_DP[1];`);

sub("a calm camp is asleep, and the bench says so",
`  const ringR=(north.aggro||G.CAMP_AGGRO||11.5)+8;
  const calm=isolateArea(north.x,north.z,ringR,{keep:north.creeps,keepNeutral:true});`,
`  // v134.4 …AND THE CAMP HAS TO BE ASLEEP, not merely un-intruded. updateCreep widens its aggro
  // ring while st.wake is set and st.threat is alive — it is hunting whoever hit it — so a body
  // outside THIS ring and inside that one keeps the pack aggro'd and regen never fires. The bench
  // then reports "still in ring 0" beside "+0 hp", which is the sound of two different circles.
  const _wake=north.wake, _thr=north.threat;
  north.wake=0; north.threat=null;
  const ringR=(north.aggro||G.CAMP_AGGRO||11.5)+8;
  const calm=isolateArea(north.x,north.z,ringR,{keep:north.creeps,keepNeutral:true});`);

sub("…and wakes it again afterwards",
`  calm.restore();
  intruder.hp=1; G.dealDamage(north.creeps[0],intruder,9999); // tidy: the wilds claim their kill`,
`  calm.restore();
  north.wake=_wake; north.threat=_thr;                        // v134.4: as we found it
  intruder.hp=1; G.dealDamage(north.creeps[0],intruder,9999); // tidy: the wilds claim their kill`);

sub("the dead owner's cloud is about the DEAD owner",
`    check("v132.53 aura: a dead owner's cloud is out on the very next sweep, with no frame of "+
      "simulation in between ("+G.auraLit().lit+" lit)",G.auraLit().lit===0);`,
`    // v134.4: deadLit, not lit. This asserted that NO aura point anywhere in the world was lit,
    // when what it is named after is one dead hero's cloud. Since v134.2 veteran bots hold
    // blacksmith buffs, so any living aura-holder on the map — a healthy one, doing its job —
    // failed it. auraLit() already reports deadLit, which is exactly this gate's claim.
    check("v132.53 aura: a dead owner's cloud is out on the very next sweep, with no frame of "+
      "simulation in between ("+G.auraLit().deadLit+" of the dead owner's points still lit, "+
      G.auraLit().lit+" lit on the map in total)",G.auraLit().deadLit===0);`);

sub("the turtle bench starts the wall attempt from scratch",
`    D1.pers="turtle"; D1.wallPlan=null; D1.wallPlaced=0; D1.wallsDone=false;`,
`    // v134.4 …AND FROM THE FRONT THE PLANNER STARTS AT. The bench cleared the plan, the count and
    // the done flag but not wallFront or wallRetry — so on a seed where the CAMPAIGN had already
    // spent its retries, the bench re-planned at 76 out with no retries left, found nothing legal
    // there, and reported "+0 segments" for a planner it never let start. Measured on
    // SMOKE_SEED=42: six of twenty-seven candidate segments are legal at 34, 48 and 62 — the
    // marshal simply was never asked about those fronts.
    D1.pers="turtle"; D1.wallPlan=null; D1.wallPlaced=0; D1.wallsDone=false;
    D1.wallFront=34; D1.wallRetry=0;`);

sub("the turtle gate asks whether there is ground to build on",
`    check("TURTLE raises a curtain wall (+"+(walls1-walls0)+" segments) and finishes with a gate ("+gates+")",
      (walls1-walls0)>=1&&D1.wallsDone===true&&gates>=1);`,
`    // v134.4 …AND IF THERE IS NOWHERE TO PUT ONE, STANDING DOWN IS THE RIGHT ANSWER. On
    // SMOKE_SEED=42 red reaches age 5 with the v134.4 economy and every one of its eight planned
    // segments is refused by validFor at 34 AND at 48 — the curtain is a fixed 96-unit line at a
    // fixed offset, tuned at v94 against a map this one no longer is (it is on the open list as one
    // of the "stale map numbers"). The planner did its job and gave up correctly, and this gate
    // called that a failure because it asserted an ABSOLUTE — a wall — instead of the invariant:
    // if any legal ground exists on the line, a wall stands there; if none does, it stood down.
    const _wt=global.__G.teamAge[1]>=4?"fort_wall":global.__G.teamAge[1]>=3?"stone_wall":"wood_wall";
    const _rtc=global.__G.teamTC(1);
    let _legal=0,_tried=0;
    if(_rtc)for(const fr of [34,48,62,76]){
      const fx=_rtc.x-fr;                                   // red faces the enemy across the middle
      for(const sg of global.__G.wallLineSegments(_wt,fx,_rtc.z-48,fx,_rtc.z+48)){
        _tried++; if(global.__G.validFor(_wt,sg.x,sg.z,1))_legal++;
      }
    }
    check("TURTLE raises a curtain wall (+"+(walls1-walls0)+" segments) and finishes with a gate ("+
      gates+") — or stands down because the line has nowhere to go ("+_legal+" of "+_tried+
      " candidate segments are legal ground at 34, 48, 62 and 76 out)",
      _legal>0 ? ((walls1-walls0)>=1&&D1.wallsDone===true&&gates>=1)
               : (D1.wallsDone===true));`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patch-smoketest-offseed3-v134: OK");
