#!/usr/bin/env node
/* v132.10 — A CAMP THAT IS BEING SHOT AT NOTICES
   ----------------------------------------------
   node tools/patch-creepaggro.js       (idempotent: re-running reports NOTHING WRITTEN)

   John, playtesting: "slingers attacking wolves and wolves not aggroing." His screenshot shows four
   slingers standing on the camp's rim, stones in the air, and five wolves standing in the dirt
   doing nothing at all.

   THE TEST WAS ASKING THE WRONG DISTANCE. updateCreep scans for intruders like this:

       if(dist2(e.x, e.z, st.x, st.z) > agg*agg) continue;      // st is the CAMP CENTRE

   — the intruder's distance from the CAMP'S CENTRE, never from the creep, and never mind that the
   intruder is currently killing it. So the safe standoff is `aggro` from the middle of the camp,
   and the numbers make that trivial:

       camp                aggro   creep sits at   a shooter can stand at   slinger range
       border pocket r26    23.5      9.1 - 13.5        23.6 from centre         16
       interior r16         13.5      5.6 -  8.3        13.6 from centre         16

   In both cases a slinger outranges the ring while standing OUTSIDE it. At the border pockets it
   needed care; at the interior camps the shooter barely has to leave the trampled dirt. And John
   has asked for those camps to shrink another 30% (r 11, aggro 8.5), which would have made every
   ranged unit in the game — slinger 16 through skirmisher 25, cannon 30 — free XP forever.

   SO THE RULE THAT WAS MISSING IS THE OBVIOUS ONE: BEING HIT COUNTS. A pack that is taking fire
   wakes, and it wakes as a PACK — st.wake lives on the camp state, so one stone brings all five.

   THE THREE NUMBERS, and why they are not just "make aggro bigger":
     CAMP_WAKE 9s          how long the camp stays angry after the last hit lands. Long enough to
                           cross its own ground, short enough that it settles if you walk away.
     CAMP_WAKE_REACH 22    the CAP on how far the woken scan extends — and it extends only to just
                           past whoever is actually hitting them (threat distance + 4), not to the
                           cap. That distinction matters: a flat +22 on an interior camp would
                           reach 35 from centre and pull the pack onto the Viking road 29.7 away,
                           so poking a camp would set wolves on a passing trade cart. Reaching
                           exactly as far as the attacker cannot do that.
     CAMP_WAKE_CHASE 12    how much further the hard leash gives while woken. THE LEASH IS THE
                           REASON THIS IS NOT JUST "AGGRO MORE": seeing the slinger is useless if
                           the paws still stop at r-1.2. 9.8 becomes 21.8 on an interior camp and
                           24.8 becomes 36.8 on a pocket, and then it snaps back and they walk home.

   WHAT THIS DELIBERATELY DOES NOT DO: it does not let them catch a skirmisher at 25 or a cannon at
   30. Kiting a leashed melee pack with a long-ranged unit is a legitimate counter and it costs the
   player position and time. What it stops is the pack standing still while it dies.

   NOT WOKEN BY TOWERS. `att.def` is a building, and creeps have no attack against buildings — a
   tower plinking a camp would set the pack charging something it can never hurt, for ever.

   HOST-ONLY, FOR FREE: dealDamage returns immediately on a guest, and 09-main.js never calls
   updateBot on a guest either, so st.wake only ever exists where the simulation is authoritative.
   Nothing new goes on the wire.                                                                  */
const fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
let total=0,failed=0;
const F={};
const load=f=>(F[f]=F[f]!==undefined?F[f]:fs.readFileSync(path.join(ROOT,"js",f),"utf8"));
function sub(file,from,to,why){
  const s=load(file), n=s.split(from).length-1;
  if(n!==1){console.log("  !! "+file+" expected 1, found "+n+"  <<"+from.slice(0,64).replace(/\n/g,"\\n")+">>");failed++;return;}
  F[file]=s.split(from).join(to); total++; console.log("  ok  "+why);
}
if(load("00-data.js").indexOf("CAMP_WAKE")>=0){console.log("already applied — NOTHING WRITTEN");process.exit(0);}

// ---- the three constants, next to the camp numbers they extend --------------------------------
sub("00-data.js",
`const CAMP_CHEST=300;   // the treasure: 300 food (wolves) or 300 gold (barbarians)`,
`const CAMP_CHEST=300;   // the treasure: 300 food (wolves) or 300 gold (barbarians)
// v132.10 BEING HIT COUNTS. updateCreep measured an intruder's distance from the CAMP CENTRE, so a
// shooter standing one aggro-radius out was invisible no matter how many stones it put into the pack — and
// every ranged unit in the game outranges every camp's ring from a standing start (slinger 16 vs a
// 13.5 interior ring; skirmisher 25 and cannon 30 vs a pocket's 23.5). John's screenshot: four
// slingers on the rim, five wolves doing nothing.
// The wake lives on the CAMP, not the creep, so one stone brings the whole pack.
const CAMP_WAKE=9;        // seconds of anger after the last hit lands
const CAMP_WAKE_REACH=22; // CAP on the woken scan. It extends to just past the actual attacker and
                          // no further — a flat +22 would reach 35 from an interior camp's centre
                          // and set the pack on carts using the Viking road 29.7 away.
const CAMP_WAKE_CHASE=12; // …and the leash gives this much, or seeing him changes nothing`,
  "00-data.js: CAMP_WAKE / _REACH / _CHASE");

// ---- damage wakes the camp ---------------------------------------------------------------------
sub("05-combat.js",
`  victim._lastHurt=T; // Second Skin waits for quiet
  victim.hp-=dmg; hitFlash(victim);`,
`  victim._lastHurt=T; // Second Skin waits for quiet
  victim.hp-=dmg; hitFlash(victim);
  // v132.10 THE PACK NOTICES. Camps aggro'd on an intruder's distance from the camp CENTRE and on
  // nothing else, so anything with range could stand off and shoot them to death unopposed. Waking
  // on damage is the rule that was missing, and it wakes the whole camp because st.wake is on the
  // camp state. NOT for a tower (att.def): creeps have no attack against buildings, so that would
  // set them charging something they can never hurt, for ever.
  if(victim.bot&&victim.bot.camp&&att&&!att.def&&att.team!==undefined&&att.team!==NEUTRAL){
    victim.bot.camp.wake=T+CAMP_WAKE;
    victim.bot.camp.threat=att;
  }`,
  "05-combat.js: a hit on a creep wakes its whole camp");

// ---- the woken scan, and the woken leash --------------------------------------------------------
sub("07-ai.js",
`  let t=null,bd=1e9; // nearest intruder INSIDE the aggro ring (per-camp: the boss shore casts a wider net)
  const agg=st.aggro||CAMP_AGGRO;`,
`  let t=null,bd=1e9; // nearest intruder INSIDE the aggro ring (per-camp: the boss shore casts a wider net)
  // v132.10 …and a WOKEN camp reaches further, but only as far as whoever is hitting it. Extending
  // by the flat CAMP_WAKE_REACH would put an interior camp's scan at 35 from centre — past the
  // Viking road at 29.7 — so poking a camp would set the pack on a passing trade cart. Reaching to
  // the threat's own distance plus 4, capped, cannot.
  const woke=st.wake&&T<st.wake;
  let agg=st.aggro||CAMP_AGGRO;
  if(woke&&st.threat&&st.threat.alive){
    const td=Math.hypot(st.threat.root.position.x-st.x,st.threat.root.position.z-st.z);
    agg=Math.max(agg,Math.min(td+4,agg+CAMP_WAKE_REACH));
  }`,
  "07-ai.js: a woken pack scans out to whoever is shooting it");

sub("07-ai.js",
`  // the hard leash: paws never leave the camp circle, no matter the shoving
  const dx=u.root.position.x-st.x,dz=u.root.position.z-st.z,dd=Math.hypot(dx,dz);
  const lim=(st.r||CAMP_R)-1.2;`,
`  // the hard leash: paws never leave the camp circle, no matter the shoving
  // v132.10 …except while the camp is awake, when it gives CAMP_WAKE_CHASE. Seeing the slinger is
  // worth nothing if the paws still stop at r-1.2: on an interior camp the leash is 9.8 and a
  // slinger shooting from 18 would be watched, angrily, from inside the fence. 21.8 reaches him.
  // It snaps back the moment the camp settles, and the calm branch above walks them home.
  const dx=u.root.position.x-st.x,dz=u.root.position.z-st.z,dd=Math.hypot(dx,dz);
  const lim=(st.r||CAMP_R)-1.2+(woke?CAMP_WAKE_CHASE:0);`,
  "07-ai.js: the leash gives while the camp is awake, then takes it back");

if(failed){console.log("\n"+failed+" site(s) did not match — NOTHING WRITTEN.");process.exit(1);}
for(const f in F)fs.writeFileSync(path.join(ROOT,"js",f),F[f]);
console.log("\n"+total+" written.\n");
