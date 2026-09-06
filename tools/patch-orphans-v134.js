#!/usr/bin/env node
/* patch-orphans-v134.js — v134.9: a soldier who dies once is not lost to the band system forever.
 *
 * FOUND BY FOLLOWING A BENCH FAILURE DOWN INSTEAD OF PAPERING OVER IT. On SMOKE_SEED=777 with the
 * v134.9 AI, "BLUE kingsguard never disbands" read 0 strong with 23 soldiers alive. The first two
 * explanations were both wrong and both would have produced a bench edit instead of a fix — the
 * king is alive, and the band exists. The third probe is the one that mattered:
 *
 *   BLUE soldiers 23 -> king 1 · band:kingsguard 2 · band:camp 16 · nobot 4
 *                    | bands kingsguard:0, camp:6
 *
 * SIXTEEN soldiers carry bandRef pointing at the camp band. The camp band lists SIX. Two more point
 * at the kingsguard, which lists none. The pointer and the roster disagree, and the disagreement is
 * one-way: bd.members -> v.bandRef is checked by a gate that has passed since v113; v.bandRef ->
 * bd.members was never checked by anything.
 *
 * WHY IT HAPPENS. manageBands opens by pruning each band —
 *
 *     bd.members = bd.members.filter(v => v.alive && !v.remote && … && v.bandRef===bd);
 *
 * — and never clears the bandRef of anybody it drops. A dead soldier leaves the roster and keeps
 * the pointer. Then respawnUnit (05-combat.js:1928) brings him back with
 *
 *     u.chargeTo=null; u.rally=false; u.rallyBy=null; // the dead answer no horn — a respawned
 *                                                     // villager forgets the band
 *
 * — a comment that says exactly what this fix does, beside three lines that do not do it. He is now
 * alive, botted, in no band, and INVISIBLE to the deal: the roster is built from
 *
 *     if(!v.bandRef || !D.bands.includes(v.bandRef)) roster.push(v);
 *
 * and his bandRef is a band that is very much in D.bands. He will never be dealt into a band again
 * for the rest of the match. Every death that respawns adds one more, which is why it is sixteen of
 * twenty-three by minute twenty and why RED — the seed's rush, with a quieter war behind it — still
 * had a manned guard.
 *
 * HOW MUCH THIS EXPLAINS. v134.3's whole note is about a marshal that fields "one mission band or
 * none" in a twenty-minute campaign, diagnosed there as a doctrine bug and fixed as one. The
 * doctrine bug was real. This was underneath it the entire time, quietly draining the loose pool
 * that the doctrine deals from — a band economy fed by a roster that leaks a soldier per death.
 *
 * THE FIX IS THE PRUNE. manageBands always prunes before it builds the roster, so releasing there
 * closes it completely — and the respawn line is belt and braces, which the gate says out loud
 * rather than dressing up: falsify m_respawn came back 0 failures on the first cut, because by the
 * time respawnUnit runs the prune has already cleared the pointer. It is kept, and separately
 * gated, because the comment beside it has claimed for twenty versions that it does this:
 *   · the PRUNE releases whoever it drops — that covers the re-classed, the possessed and the ones
 *     v134.4 turned into wains, which never die and so never reach the respawn path;
 *   · the RESPAWN clears it at the source, which is where the comment already promised it.
 * And the consistency gate now reads BOTH directions, because a one-way check is what let this
 * stand for twenty versions.
 */
const fs=require("fs"),path=require("path");
const R=path.join(__dirname,"..");
const A=path.join(R,"js","07-ai.js"), C=path.join(R,"js","05-combat.js");
let a=fs.readFileSync(A,"utf8"), c=fs.readFileSync(C,"utf8");
let failed=[];
const sub=(name,src,from,to)=>{
  const n=src.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return src;}
  return src.split(from).join(to);
};

a=sub("the prune releases whoever it drops",a,
`  for(const bd of D.bands) // prune the dead, the possessed, the re-classed
    bd.members=bd.members.filter(v=>v.alive&&!v.remote&&v.team===team&&v.bot&&!v.isKing&&
      !isWorker(v)&&CLS[v.cls].line!=="healer"&&v.bandRef===bd); // v134.4: isWorker covers the cart role AND the ox`,
`  for(const bd of D.bands){ // prune the dead, the possessed, the re-classed
    const _keep=bd.members.filter(v=>v.alive&&!v.remote&&v.team===team&&v.bot&&!v.isKing&&
      !isWorker(v)&&CLS[v.cls].line!=="healer"&&v.bandRef===bd); // v134.4: isWorker covers the cart role AND the ox
    // v134.9 …AND LEAVING A BAND'S ROSTER RELEASES THE SOLDIER. This filtered and stopped. A body
    // dropped here kept bandRef pointing at a band it was no longer in, and the roster below is
    // built from `+"`!v.bandRef || !D.bands.includes(v.bandRef)`"+` — so a pointer at a live band it
    // is not a member of makes a soldier INVISIBLE to every deal for the rest of the match.
    // Measured on SMOKE_SEED=777: BLUE ended with 16 of 23 soldiers holding a bandRef to a camp
    // band that listed six of them, and a kingsguard that listed none. The death/respawn round trip
    // is the common path (see respawnUnit) but the re-class and the wain reach it without dying.
    for(const v of bd.members)if(_keep.indexOf(v)<0&&v.bandRef===bd)v.bandRef=null;
    bd.members=_keep;
  }`);

c=sub("the respawned forget the band for real",c,
`  u.chargeTo=null; u.rally=false; u.rallyBy=null; // the dead answer no horn — a respawned villager forgets the band`,
`  // v134.9 …AND THE BAND, WHICH THIS LINE HAS CLAIMED SINCE IT WAS WRITTEN. bandRef was not
  // cleared, so a respawned soldier came back pointing at a band whose roster had pruned him while
  // he was dead — and manageBands' loose pool skips anyone whose bandRef names a LIVE band, so he
  // was never dealt anywhere again. One soldier lost per death, compounding all match.
  u.chargeTo=null; u.rally=false; u.rallyBy=null; u.bandRef=null; // the dead answer no horn — a respawned villager forgets the band`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(A,a); fs.writeFileSync(C,c);
console.log("patch-orphans-v134: OK");
