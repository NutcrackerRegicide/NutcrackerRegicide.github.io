#!/usr/bin/env node
/* patch-smoketest-offseed4-v134.js — two older benches that v134.5 walked into.
 *
 * THE v113 RELIEF GATE stages a hold band with a spent tour on cold ground and asserts it takes a
 * new mission. Since v134.5 a band standing on a square its team HOLDS, with no other hold band on
 * the board, is deliberately NOT relieved — an unguarded bazaar looks exactly like quiet ground —
 * so on a seed where the campaign happened to leave that team holding the square the band was
 * posted to, the gate read the new rule as a broken tour. It stages the ownership now, the same way
 * v134.0 taught it to stage the capture state, and for the same reason.
 *
 * THE TURTLE BENCH loops directorThink twenty times and the wall branch places at most ONE segment
 * per think — and it spends a think on each segment it REFUSES too. A plan is eight or nine
 * segments and the planner may walk three fronts before it finds room, so twenty is short by half
 * on any seed where the first front is blocked. SMOKE_SEED=777: "+0 segments" with fourteen of
 * thirty-six candidate segments legal. Sixty thinks is enough for three full fronts.
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

sub("the relief gate stages who owns the squares",
`    const bazHold=G2.neutralMarkets.map(m=>({m,cap:m.cap,capTeam:m.capTeam}));
    for(const m of G2.neutralMarkets){m.cap=0;m.capTeam=-1;}`,
`    // v134.5 …AND WHO OWNS THEM, not only how far along a capture is. A band posted to a square
    // this team already HOLDS is the last guard on it, and v134.5 does not march the last guard off
    // — correctly. This bench is about the tour clock, so it stages the squares as nobody's and
    // puts the owners back afterwards.
    const bazHold=G2.neutralMarkets.map(m=>({m,cap:m.cap,capTeam:m.capTeam,owner:m.owner}));
    for(const m of G2.neutralMarkets){m.cap=0;m.capTeam=-1;m.owner=-1;}`);

sub("…and puts the owners back with the caps",
`    cellar.restore();
    for(const e of bazHold){e.m.cap=e.cap;e.m.capTeam=e.capTeam;}`,
`    cellar.restore();
    for(const e of bazHold){e.m.cap=e.cap;e.m.capTeam=e.capTeam;e.m.owner=e.owner;} // v134.5: owners too`);

sub("the turtle bench thinks long enough to walk three fronts",
`    for(let i=0;i<20&&!D1.wallsDone;i++){`,
`    // v134.5: SIXTY thinks, not twenty. The wall branch places at most one segment per think and
    // spends a think on each one it refuses, so a nine-segment plan that has to walk three fronts
    // needs twenty-seven at the very least. SMOKE_SEED=777 reported "+0 segments" with fourteen of
    // thirty-six candidates legal — the planner was still working when the bench stopped asking.
    for(let i=0;i<60&&!D1.wallsDone;i++){`);

sub("the levy bench stages villagers the marshal can actually call up",
` for(let k=0;k<3;k++)vills.push(global.__G.makeUnit(0,"villager",tcB.x-10-k*2,tcB.z+6,{name:"Levy "+k}));`,
` // v134.5: …WITH A BOT, or they cannot be levied. The levy loop skips any body that has none
 // (07-ai.js: "!v.bot ... continue"), so these three have never been eligible and this bench has
 // always been riding on whatever villagers the CAMPAIGN happened to leave within 45 of the Town
 // Center. On SMOKE_SEED=1 with the v134.5 economy that number is zero, and the gate reported a
 // working levy rule as a broken one. Measured at the moment it fires: 13 foes against 9 defenders,
 // so the rule's own test passed — and not one villager it was allowed to call up.
 for(let k=0;k<3;k++)vills.push(global.__G.makeUnit(0,"villager",tcB.x-10-k*2,tcB.z+6,
   {name:"Levy "+k,bot:{role:"citizen",res:"food"}}));`);

sub("the charge bench keeps the war room out of it",
` let razedAt=-1;
  for(let i=0;i<1400;i++){ tick(); if(razedAt<0&&!shack.alive)razedAt=i; }`,
` let razedAt=-1;
  // v134.5 …AND THE MARSHAL DOES NOT RE-TASK THE HORN MID-CHARGE. These three are ordinary bots
  // with a role, so across 1400 frames the war room is free to deal them into a band and march
  // them off on a mission — which is not a bug, it is the AI doing its job, and it has nothing to
  // do with whether a charge takes and holds its ground. This bench has always been riding on the
  // campaign happening not to want them for 23 sim-seconds; the v134.5 want-list wants more bands,
  // so it started wanting them. directorThink is gated on D.nextThink: push it past the end of the
  // bench and put it back afterwards.
  const _nt=directors.map(D=>D.nextThink);
  for(const D of directors)D.nextThink=1e9;
  for(let i=0;i<1400;i++){ tick(); if(razedAt<0&&!shack.alive)razedAt=i; }
  for(let i=0;i<_nt.length;i++)directors[i].nextThink=_nt[i];`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patch-smoketest-offseed4-v134: OK");
