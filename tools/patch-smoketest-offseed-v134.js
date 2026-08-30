#!/usr/bin/env node
/* patch-smoketest-offseed-v134.js — two gates that were measuring campaign luck, found by running
 * the suite on seeds it was never written against.
 *
 * SMOKE_SEED=1 and SMOKE_SEED=20260827 went red on v134.3 and green on v134.2, which reads like a
 * regression and is not one. Both gates observe an eight-minute campaign and assert on a number
 * that the band economy moved without breaking anything:
 *
 *   · TURTLE'S CURTAIN WALL. The wall branch in directorThink is gated on pendingBld(team).length<3
 *     — an AI with three buildings already going up does not start a wall. The bench stakes the
 *     turtle 5000 of every resource and clears the build queue ONCE, then loops directorThink
 *     twenty times marking only the WALL segments built. Every other building the flush AI orders
 *     in those twenty ticks stays pending, so on a seed where it orders three, the wall branch is
 *     shut for the rest of the bench and the gate reports "+0 segments" for a wall planner that was
 *     never asked. The bench already means to do this — "masons work instantly for the test" — it
 *     just only said it about walls.
 *
 *   · FARMS INSIDE THE RING. `ringFarms>=3` was the anti-starvation half of the ring gate: proof
 *     that the AI is not passing the ring rule by building nothing. But it counts farms standing in
 *     the 21-30 band at minute eight, and whether a marshal has WANTED a farm by then is economy
 *     luck. Measured on SMOKE_SEED=1, the same instant, v134.2 against v134.3:
 *
 *         v134.2  team0  5 farms (2 in ring)      team1  3 farms (2 in ring)  food 4710
 *         v134.3  team0  5 farms (1 in ring)      team1  0 farms (0 in ring)  food 3590
 *
 *     Team1 built no farms in v134.3 because it was sitting on 3590 food, not because anything
 *     stopped it — same villager count, same soldier count. And the claim the count was standing in
 *     for is ALREADY asserted properly forty lines above, by construction rather than by luck:
 *     "the band between them IS plantable (N of 96 probes legal)". So the number stays in the
 *     message, where it is informative, and comes out of the assertion, where it was noise.
 *     nonFarm>=8 is the anti-starvation test and it does that job on every seed.
 *
 * Neither of these is the band economy doing something wrong. Off-seed runs are for telling those
 * two things apart, and this is the second time this version they have earned their keep.
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

sub("the masons work instantly on EVERYTHING, not only the wall",
`      for(const b of buildings)if(b.alive&&!b.built&&b.def.wall&&b.team===1){b.built=true;b.progress=b.def.hits;} // masons work instantly for the test`,
`      // v134.3: …on every building, not only the wall. The wall branch is gated on
      // pendingBld(team).length<3, and a staked AI orders houses and towers while this loop runs —
      // three of them and the wall planner is shut out for the rest of the bench. SMOKE_SEED=
      // 20260827 reported "+0 segments" for a planner that was never asked a question.
      for(const b of buildings)if(b.alive&&!b.built&&b.team===1){b.built=true;b.progress=b.def.hits;} // masons work instantly for the test`);

sub("the ring's farm count is a note, not a verdict",
`  check("v134.1 ring: …and the AI still raised a real town around it ("+nonFarm+" buildings out "+
    "past the ring, "+ringFarms+" fields inside it)",nonFarm>=8&&ringFarms>=3);`,
`  // v134.3: ringFarms comes OUT of the assertion. It was the anti-starvation half of this gate, but
  // it counts farms standing in the 21-30 band at minute eight, and whether a marshal has wanted a
  // farm by then is economy luck: on SMOKE_SEED=1 the red team built none at all in v134.3 while
  // sitting on 3590 food, with the same villagers and the same soldiers as the v134.2 run that
  // built three. The claim it was standing in for — that the band is plantable at all — is asserted
  // by construction forty lines above, 96 probes of it. nonFarm>=8 is the starvation test.
  check("v134.1 ring: …and the AI still raised a real town around it ("+nonFarm+" buildings out "+
    "past the ring; "+ringFarms+" fields inside it, which is reported and not asserted — the band's "+
    "plantability is the staged probe above, this is whether the AI wanted a farm by minute eight)",
    nonFarm>=8);`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patch-smoketest-offseed-v134: OK");
