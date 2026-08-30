#!/usr/bin/env node
/* patch-bandecon-v134.js — v134.3, part three: the army runs more than one mission.
 *
 * MEASURED. Twenty-minute campaigns, bands at the end, against 32 and 28 soldiers on the field:
 *
 *     seed 11   team0  kingsguard:8  patrol:8       team1  kingsguard:4
 *     seed 44   team0  kingsguard:5                 team1  kingsguard:7  patrol:6
 *
 * One team fielded no mission band at all. The other fielded one. Not one CAMP band — one band, of
 * any kind. Every doctrine in PERSONALITIES — raid bands, econ hunters, assassins, hold points — has
 * been describing an army structure that essentially never gets built, and both of the v134.3
 * changes before this one were pushing against that wall rather than against their own problem.
 *
 * THE MECHANISM, and it is three lines conspiring:
 *   1. the kingsguard fills FIRST and takes up to 14 (kgBase + threat*1.5);
 *   2. a new mission band needs FIVE loose soldiers standing around at the same instant;
 *   3. …and the straggler loop at the end hands every remaining loose body to an EXISTING band, up
 *      to eight members, before the pool can ever refill.
 * So the loose pool reaches five five or six times in a whole match (counted), and whatever role
 * wins that rare slot is the only mission the army ever runs. Reinforcement always beat formation.
 *
 * THE FIX is not to weaken the guard — that is a separate dial and John's to turn — but to let the
 * army OPEN a mission it is not running at all. A role with zero bands takes precedence over
 * reinforcing a band that already exists, because a fourth body in the patrol is worth less than the
 * first body in the econ raid the doctrine says this marshal wants.
 *
 *   BAND_MIN 4, not 5 — a band of four is a real band; five was never a considered number, it was
 *     the same literal as the "deal in sevens" size.
 *   BAND_SEED 3 — the stragglers may found a MISSING role with as few as three, and only a missing
 *     one. Anything else still reinforces exactly as before.
 *
 * ⚠ AND THE DOCTRINE HAS TO BE READ OUTSIDE THE DEAL BLOCK, which is the correction this patch went
 * back for. The first cut left the wanted-role map built inside "if(roster.length>=BAND_MIN)", so on
 * a trickle of three — the exact case the founding pass exists for — the map was undefined and the
 * pass did nothing at all. It only ever fired on the leftovers of a full deal. THE SMOKETEST GATE IS
 * WHAT SAID SO: it would not turn red with the pass mutated out, through two rewrites of the
 * staging, because the pass was not being defeated by the staging — it was doing nothing worth
 * mutating. The third reading of a stubbornly-green gate was the true one.
 *
 * MEASURED AFTER, the same three campaigns, bands standing at the twenty-minute mark:
 *
 *     seed 11   team0  kingsguard:6  econ:8  hold:4        team1  kingsguard:6
 *     seed 33   team0  kingsguard:3  camp:4  hold:6        team1  kingsguard:11  camp:8
 *     seed 44   team0  kingsguard:5  camp:6               team1  kingsguard:2   camp:2
 *
 * …and the squares that army can now stand on: square-seconds left neutral 64.8 -> 23.8, 63.0 ->
 * 14.3, 47.3 -> 23.9 per cent. Wild packs are being broken on two of the three seeds (four of the
 * eight pockets were respawning at the whistle on seed 44), which had never happened before v134.3.
 *
 * ⚠ AND THE ARMY IS SMALLER FOR IT, which John should see before he decides he likes this. Seed 44,
 * military alive at twenty minutes: 36/28 became 27/16. Soldiers standing in the woods and on
 * somebody else's square are soldiers that get killed; the same doctrine that pays 2.4 a second in
 * bazaar yield is spending bodies to earn it. That is a trade, not a free win, and it is his to
 * judge from a playtest rather than mine to judge from a table.
 *
 * ⚠ THIS IS THE LARGEST BEHAVIOURAL CHANGE IN THE v134 ARC. Every personality knob that has been
 * dormant wakes up at once — econHunters (already un-deadened this version), assassins, hold points,
 * and now the wilds. Measured across seeds before and after; the numbers are in the smoketest gate
 * and in the handoff. It wants a playtest more than it wants another number from me.
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

sub("the two thresholds, named",
`// v113: how long a hold band stands its ground, and what counts as "nothing is happening here"
const HOLD_TOUR=45, HOLD_QUIET=18, HOLD_WATCH=48;`,
`// v113: how long a hold band stands its ground, and what counts as "nothing is happening here"
const HOLD_TOUR=45, HOLD_QUIET=18, HOLD_WATCH=48;
// ---- v134.3 THE BAND ECONOMY ----
// BAND_MIN: loose soldiers needed to deal a new mission band. Was an unnamed 5, which was not a
//   considered number — it was the same literal as the "deal in sevens" band size.
// BAND_SEED: …and how few may FOUND a mission nobody is running at all. A fourth body in the patrol
//   is worth less than the first body in the econ raid this marshal's doctrine says it wants.
const BAND_MIN=4, BAND_SEED=3;`);

sub("the doctrine is read even when there is nobody to deal",
`  if(roster.length>=5){
    roster.sort((a,b)=>CLS[a.cls].line<CLS[b.cls].line?-1:1);
    const wantRoles=["patrol","econ","hold"];
    for(let i=0;i<(PB.econHunters||0);i++)wantRoles.push("econ"); // rush lives on dead supply chains
    if(roster.length>=20||D.raidUntil||((PB.assassins||0)&&roster.length>=10))wantRoles.push("assassin");
    // v134.3 ONE HOLD BAND PER SQUARE STILL UP FOR GRABS. Three bazaars pay 1, 2 and 4 a second of
    // food AND gold AND wood by count held; an army that fields one hold band can take one square.
    {const _free=(typeof neutralMarkets!=="undefined")
        ?neutralMarkets.filter(m=>m.owner!==team).length:0;
     for(let i=1;i<_free&&wantRoles.length<9;i++)wantRoles.push("hold");}
    // v134.3 …AND ONE BAND FOR THE WILDS, once there is an army to spare it from and the throne is
    // quiet. Nine camps, a 300-resource chest on a 180-second cycle, and since v134.2 a pack is
    // worth levels to whoever breaks it — and until now every one of them was a human prize by
    // default rather than by contest.
    // ⚠ roster.length>=5, not 8. The roster is the LOOSE soldiers at this instant, and the enclosing
    // block already requires 5; the first cut asked for 8 and measured ZERO camp bands across two
    // twenty-minute campaigns, because by the time bands are dealt the loose pool is rarely that
    // deep. A threshold above the one that gates the whole block is a feature that never runs.
    if(roster.length>=5&&threat<CAMP_MAX_THREAT&&
       units.filter(v=>v.alive&&v.team===team&&v.bot&&!v.isKing&&v.cls!=="villager").length>=CAMP_MIN_MIL&&
       bandCampTarget(D,team))wantRoles.push("camp");
    // v134.3 …AND THE PICKER CAN COUNT NOW. It used to be:
    //     let role=wantRoles[0],least=1e9;
    //     for(const r of wantRoles){const n=bands(r).length; if(n<least){least=n;role=r;}}
    // — which reads the list as a SET. A repeat computes the same n as its first occurrence and
    // n<least is false, so no repeat could ever win, so PERSONALITIES.rush.econHunters ("rush lives
    // on dead supply chains", v94) has done precisely nothing since the day it shipped and rush has
    // raided supply lines exactly as hard as turtle. Weight = how many times the role is asked for;
    // pick the biggest DEFICIT. ⚠ This is a real balance change for rush and expand.
    const _want={};
    for(const r of wantRoles)_want[r]=(_want[r]||0)+1;
    while(roster.length>=5){`,
`  // v134.3 ⚠ THE DOCTRINE IS READ EVEN WHEN THERE IS NOBODY LEFT TO DEAL. All of this used to sit
  // inside the roster.length>=5 block, which was harmless while its only consumer was the deal loop
  // in the same block — and quietly fatal to the founding pass below, whose entire purpose is to
  // fire on a TRICKLE of three. With the wanted-role map undefined whenever the loose pool is short
  // of a full band, three reinforcements fell straight past the pass into the straggler loop, and
  // the fix was a no-op in precisely the case its own comment describes.
  // The order of this list is a PRIORITY as well as a set: the founding pass opens the first role
  // nobody is running. A square pays 1, 2 or 4 a second of three resources; a patrol loop around
  // one's own town pays nothing. Squares first, then the enemy's supply lines, then the patrol.
  const wantRoles=["hold","econ","patrol"];
  for(let i=0;i<(PB.econHunters||0);i++)wantRoles.push("econ"); // rush lives on dead supply chains
  if(roster.length>=20||D.raidUntil||((PB.assassins||0)&&roster.length>=10))wantRoles.push("assassin");
  // v134.3 ONE HOLD BAND PER SQUARE STILL UP FOR GRABS. Three bazaars pay 1, 2 and 4 a second of
  // food AND gold AND wood by count held; an army that fields one hold band can take one square.
  {const _free=(typeof neutralMarkets!=="undefined")
      ?neutralMarkets.filter(m=>m.owner!==team).length:0;
   for(let i=1;i<_free&&wantRoles.length<9;i++)wantRoles.push("hold");}
  // v134.3 …AND ONE BAND FOR THE WILDS, once there is an army to spare it from and the throne is
  // quiet. Nine camps, a 300-resource chest on a 180-second cycle, and since v134.2 a pack is
  // worth levels to whoever breaks it — and until now every one of them was a human prize by
  // default rather than by contest.
  // ⚠ BAND_MIN loose soldiers, not eight. The first cut asked for eight and measured ZERO camp
  // bands across two twenty-minute campaigns, because by the time bands are dealt the loose pool is
  // rarely that deep. This is also the one mission a trickle may NOT found — camps cost bodies, and
  // three soldiers walking into a pack of five is a donation.
  if(roster.length>=BAND_MIN&&threat<CAMP_MAX_THREAT&&
     units.filter(v=>v.alive&&v.team===team&&v.bot&&!v.isKing&&v.cls!=="villager").length>=CAMP_MIN_MIL&&
     bandCampTarget(D,team))wantRoles.push("camp");
  // v134.3 …AND THE PICKER CAN COUNT NOW. It used to be:
  //     let role=wantRoles[0],least=1e9;
  //     for(const r of wantRoles){const n=bands(r).length; if(n<least){least=n;role=r;}}
  // — which reads the list as a SET. A repeat computes the same n as its first occurrence and
  // n<least is false, so no repeat could ever win, so PERSONALITIES.rush.econHunters ("rush lives
  // on dead supply chains", v94) has done precisely nothing since the day it shipped and rush has
  // raided supply lines exactly as hard as turtle. Weight = how many times the role is asked for;
  // pick the biggest DEFICIT. ⚠ This is a real balance change for rush and expand.
  const _want={};
  for(const r of wantRoles)_want[r]=(_want[r]||0)+1;
  if(roster.length>=BAND_MIN){
    roster.sort((a,b)=>CLS[a.cls].line<CLS[b.cls].line?-1:1);
    while(roster.length>=BAND_MIN){`);

sub("stragglers may FOUND a missing mission",
`  for(const v of roster){ // stragglers reinforce the weakest mission band, not the throne
    let bd=null,bs=99;
    for(const b of D.bands)
      if(b.role!=="kingsguard"&&b.role!=="siege"&&b.members.length<8&&b.members.length<bs){bs=b.members.length;bd=b;}
    if(!bd)bd=kg;
    v.bandRef=bd; bd.members.push(v);
  }`,
`  // v134.3 …BUT FIRST, A MISSION NOBODY IS RUNNING GETS OPENED. The loop below used to hand every
  // loose body to an existing band, up to eight, which meant REINFORCEMENT ALWAYS BEAT FORMATION:
  // whatever bands existed after the first few think-clocks were the only bands the army ever had,
  // and a twenty-minute match ended with one mission band or none (measured, both teams, several
  // seeds). Every doctrine knob in PERSONALITIES was describing an army that never got built.
  // BAND_SEED, not BAND_MIN: three is fewer than a band should be, and a great deal more than the
  // nothing that was previously in the woods, on the squares, and on the enemy's supply lines.
  while(roster.length>=BAND_SEED){
    let missing=null;
    for(const r in _want)if(!D.bands.some(b=>b.role===r)){missing=r;break;}
    if(!missing)break;
    const bd={id:BAND_ID++,role:missing,members:[]};
    D.bands.push(bd);
    const n=Math.min(roster.length,7);
    for(let i=0;i<n;i++){const v=(i%2?roster.pop():roster.shift());v.bandRef=bd;bd.members.push(v);}
  }
  for(const v of roster){ // stragglers reinforce the weakest mission band, not the throne
    let bd=null,bs=99;
    for(const b of D.bands)
      if(b.role!=="kingsguard"&&b.role!=="siege"&&b.members.length<8&&b.members.length<bs){bs=b.members.length;bd=b;}
    if(!bd)bd=kg;
    v.bandRef=bd; bd.members.push(v);
  }`);

// ---------------------------------------------------------------------------
// The version pair. INVARIANT #4 — a smoketest gate enforces it.
// ---------------------------------------------------------------------------
{
  const a1=`const VERSION="v134.2";`, b1=`const VERSION="v134.3";`;
  const a2=`<p class="verstamp">v134.2 — THE VETERANS</p>`,
        b2=`<p class="verstamp">v134.3 — THE MARSHAL'S ARMY</p>`;
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
console.log("patch-bandecon-v134: OK");
