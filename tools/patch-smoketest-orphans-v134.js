#!/usr/bin/env node
/* patch-smoketest-orphans-v134.js — the gate that would have caught it.
 *
 * The suite has checked band consistency since v113:
 *
 *     D.bands.every(bd => bd.members.every(v => v.team===D.team && v.bandRef===bd))
 *
 * — members to pointer, and only that direction. The leak this version fixes lives entirely in the
 * other one: a soldier whose bandRef names a live band that does not list him. That is not an
 * academic asymmetry; it is exactly why a defect that costs a marshal one soldier per death stood
 * through twenty versions with a green suite, and it is why the "one mission band a match" symptom
 * v134.3 chased had a second cause underneath the one it fixed.
 *
 * So: BOTH directions, and a staged round trip that reproduces the mechanism in isolation — kill a
 * banded soldier, let the marshal prune, respawn him, and demand that the next deal can see him.
 * With either half of the fix reverted he is still invisible and this goes red.
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
// 1. The consistency check reads both ways.
// ---------------------------------------------------------------------------
sub("consistency is symmetric",
`  check(who+" band membership is consistent",
    D.bands.every(bd=>bd.members.every(v=>v.team===D.team&&v.bandRef===bd)));`,
`  // v134.9 BOTH DIRECTIONS. This checked members -> bandRef and nothing else, so a soldier
  // carrying a bandRef to a live band that does not list him was invisible to it — which is the
  // whole of the orphan leak: manageBands' loose pool skips anyone whose bandRef names a band in
  // D.bands, so an orphan is never dealt anywhere again. On SMOKE_SEED=777 before the fix, BLUE
  // ended with 16 of 23 soldiers pointing at a camp band that listed six.
  const _orph=units.filter(v=>v.alive&&v.team===D.team&&v.bot&&!v.isKing&&!v.remote&&
    v.bandRef&&D.bands.includes(v.bandRef)&&v.bandRef.members.indexOf(v)<0);
  check(who+" band membership is consistent BOTH WAYS — every member points at its band, and no "+
    "soldier points at a band that does not list him ("+_orph.length+" orphans)",
    D.bands.every(bd=>bd.members.every(v=>v.team===D.team&&v.bandRef===bd))&&_orph.length===0);`);

// ---------------------------------------------------------------------------
// 2. The round trip, staged.
// ---------------------------------------------------------------------------
sub("the death round trip",
`// ==================== v134.9 THE SCREEN FACES THE LANES ====================`,
`// ==================== v134.9 A SOLDIER WHO DIES COMES BACK TO THE ARMY ====================
{
  const G=global.__G;
  const team=G.RED, D=G.directors[team];
  const bands0=D.bands, nt0=D.nextThink;
  D.bands=[];
  // a full band's worth, so the deal has something to do and the kingsguard does not swallow them
  const made=[];
  for(let i=0;i<12;i++)made.push(G.makeUnit(team,"clubman",150+(i%6)*2,120+((i/6)|0)*2,
    {name:"Orphan"+i,bot:{role:"war"}}));
  for(const u of made)u.bandRef=null;
  G.manageBands(D);
  const dealt=made.filter(u=>u.bandRef&&D.bands.includes(u.bandRef)).length;
  // …now kill one of them, let the marshal tidy up, and bring him back.
  const v=made.find(u=>u.bandRef);
  const hisBand=v.bandRef;
  v.alive=false;
  G.manageBands(D);                       // the prune drops a dead member
  const refAfterPrune=v.bandRef;          // …and must have released him
  G.respawnUnit(v);                       // he comes back
  const refAfterRespawn=v.bandRef;
  // ⚠ AND HE COMES BACK A VILLAGER, by design since v134.2 (revokeProg, "used to come back a
  // villager holding a veteran's whole loadout") — and isWorker keeps villagers out of bands, quite
  // rightly. The first cut of this gate stopped here and reported that a respawned soldier is not
  // dealt back in, which is true and is not this bug. He takes up arms again, and THEN the deal
  // must be able to see him.
  G.setClass(v,"clubman");
  G.manageBands(D);                       // the next deal must be able to see him
  const backInABand=!!(v.bandRef&&D.bands.includes(v.bandRef)&&v.bandRef.members.indexOf(v)>=0);
  const orphans=made.filter(u=>u.alive&&u.bandRef&&D.bands.includes(u.bandRef)&&
    u.bandRef.members.indexOf(u)<0).length;
  // …and the respawn half on its own. In the sequence above the prune has already released him
  // before respawnUnit runs, so removing the respawn line changes nothing and no gate could see it
  // (falsify m_respawn: 0 failures on the first cut of this). manageBands always prunes before it
  // builds the roster, so the prune IS the fix; the respawn line is belt and braces and the reason
  // the comment beside it — "a respawned villager forgets the band" — is now true. This is the case
  // it covers, asked directly: a death and a respawn with no think in between.
  const w=made.find(u=>u!==v&&u.bandRef);
  w.alive=false; G.respawnUnit(w);
  const respawnClears=(w.bandRef===null);
  for(const u of made){u.bandRef=null;u.alive=false;}
  D.bands=bands0; D.nextThink=nt0;
  check("v134.9 orphans: a soldier dealt into a band ("+dealt+" of 12 dealt), killed, pruned and "+
    "respawned (as a villager, per v134.2) then re-armed is dealt back in — released by the prune ("+
    (refAfterPrune===null)+"), cleared by the respawn ("+(refAfterRespawn===null)+"), and back in a "+
    "band the band itself lists ("+backInABand+"), with "+orphans+" orphans left behind — and a "+
    "death with NO think in between still clears the pointer ("+respawnClears+"). Before this, the prune dropped him from "+
    "the roster without clearing bandRef and respawnUnit did not clear it either, so he came back "+
    "pointing at a live band that no longer held him — and manageBands' loose pool skips exactly "+
    "that, so he was invisible to every deal for the rest of the match. One soldier per death, and "+
    "the band economy v134.3 fixed was being drained underneath it",
    dealt>=8&&refAfterPrune===null&&refAfterRespawn===null&&backInABand&&orphans===0&&
    respawnClears&&hisBand!==undefined);
}

// ==================== v134.9 THE SCREEN FACES THE LANES ====================`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(S,s);
console.log("patch-smoketest-orphans-v134: OK");
