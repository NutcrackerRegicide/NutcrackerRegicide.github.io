#!/usr/bin/env node
/* patch-campband-v134.js — v134.3, part two: the AI goes into the wilds.
 *
 * Nine camps sit on the map. Each wild one guards a 300-resource chest on a 180-second cycle, and
 * since v134.2 the pack is also worth levels to whoever breaks it. The AI has never gone near one:
 * there is no band role for it, bandTargetEcon only scans the enemy, campStates is not read by any
 * director function, and 05-combat.js:1680 goes out of its way to make sure a mauled villager never
 * calls a rescue band into the wilds ("camp creeps never bait rescue bands into the wilds — the AI
 * leaves camps alone"). Every chest on the map has always been a human prize by default rather than
 * by contest.
 *
 * A `camp` band, dealt like any other mission, with three guards on it:
 *
 *  · WILD CAMPS ONLY. The Viking bay is eleven raiders and a chieftain guarding two 500-chests; a
 *    band of seven would feed it. Whether the AI should race you to the shore is a set-piece
 *    decision and John's to make, not something to slip in under a refactor — flagged, not taken.
 *  · NOT WHILE THE THRONE IS THREATENED. threat is already computed above for the kingsguard; a
 *    marshal sending seven soldiers into the woods while its king is being hunted is not ambitious,
 *    it is broken.
 *  · NOT WITH A SMALL ARMY. Camps cost bodies. Below a real roster the same soldiers are worth more
 *    on the frontier, and an AI that trades its opening army for a chest loses the match it won.
 *
 * ONE BAND PER CAMP — bands claim their target, so two do not walk into the same pocket and neither
 * brings enough to clear it.
 *
 * The chest needs no code: campTick already gives it to any non-neutral body within 2.6 of the
 * centre, and a band that just killed the pack is standing there. What the band does need is to
 * WAIT for it — the pack dies, the chest appears on the same frame, and a band relieved on the
 * instant of the kill would walk away from the whole point of going.
 */
const fs=require("fs"),path=require("path");
const F=path.join(__dirname,"..","js","07-ai.js");
let s=fs.readFileSync(F,"utf8");
let failed=[];
function sub(name,from,to){
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
}

sub("bandCampTarget",
`// v113: how long a hold band stands its ground, and what counts as "nothing is happening here"
const HOLD_TOUR=45, HOLD_QUIET=18, HOLD_WATCH=48;`,
`// v113: how long a hold band stands its ground, and what counts as "nothing is happening here"
const HOLD_TOUR=45, HOLD_QUIET=18, HOLD_WATCH=48;
// ---- v134.3 THE WILDS ARE WORTH TAKING ----
// CAMP_MIN_MIL: soldiers a team must field before it can spare a band for the woods. Camps cost
//   bodies, and an army that trades its opening force for a chest loses the match it won.
// CAMP_MAX_THREAT: a marshal does not send seven men after treasure while its king is being hunted.
//   Same threat figure the kingsguard sizes itself from.
// CAMP_LOOT_WAIT: the pack dies and the chest appears on that same frame. A band relieved on the
//   instant of the kill walks away from the entire reason it came.
const CAMP_MIN_MIL=16, CAMP_MAX_THREAT=2.5, CAMP_LOOT_WAIT=25;
function bandCampTarget(D,team){
  // the nearest live WILD camp no other band of this army has already claimed. The Viking bay is
  // deliberately not in this pool — see the note at the head of tools/patch-campband-v134.js.
  const taken=new Set();
  for(const b of D.bands)if(b.role==="camp"&&b.camp)taken.add(b.camp);
  let best=null,bd=1e12;
  for(const st of campStates){
    if(st.boss||st.waiting||taken.has(st))continue;
    let alive=0; for(const c of st.creeps)if(c.alive)alive++;
    if(!alive)continue;
    const d=dist2(st.x,st.z,TCPOS[team][0],TCPOS[team][1]);
    if(d<bd){bd=d;best=st;}
  }
  return best;
}`);

sub("the wilds join the mission roster",
`    {const _free=(typeof neutralMarkets!=="undefined")
        ?neutralMarkets.filter(m=>m.owner!==team).length:0;
     for(let i=1;i<_free&&wantRoles.length<9;i++)wantRoles.push("hold");}`,
`    {const _free=(typeof neutralMarkets!=="undefined")
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
       bandCampTarget(D,team))wantRoles.push("camp");`);

sub("a relieved hold band goes to the wilds",
`      if(T>bd.holdUntil&&T-(bd.lastContact||0)>HOLD_QUIET&&!_taking){ // relieved — march on
        let role="econ",least=1e9;
        for(const r of ["econ","patrol","assassin"]){`,
`      if(T>bd.holdUntil&&T-(bd.lastContact||0)>HOLD_QUIET&&!_taking){ // relieved — march on
        // v134.3 …AND THE WILDS ARE ONE OF THE MISSIONS IT CAN TAKE. Measured: a marshal forms one
        // or two mission bands in a whole twenty-minute campaign — the kingsguard absorbs the army
        // (kgBase plus threat, up to 14) and the loose pool reaches five only five or six times a
        // match. So a NEW role competing for that slot loses to hold every time and never runs at
        // all. A band with nothing left to hold is exactly the band that should be in the woods,
        // and reusing it costs no slot.
        // ⚠ AND IT HAS TO BE AN EXPLICIT PREFERENCE, not a tie-break. The loop below takes the
        // FIRST role with the lowest count, so with econ at 0 and camp at 0 econ wins every time and
        // camp never runs — the same "first wins ties" shape as the wantRoles bug this version
        // already fixed. A band that has just finished taking a square, with a live pack on the map
        // and nobody in the woods, goes to the woods.
        let role="econ",least=1e9;
        if(bandCampTarget(D,team)&&!D.bands.some(b=>b.role==="camp")){
          bd.role="camp"; bd.point=null; bd.camp=null; bd.lootUntil=0; assignLane(D,bd);
          continue;
        }
        for(const r of ["econ","patrol","assassin"]){`);

sub("mission control for the camp band",
`    if(bd.role==="patrol"){
      if(!bd.wps){`,
`    if(bd.role==="camp"){
      // keep a live target; a pack that was wiped by somebody else is not worth walking to
      if(bd.camp){
        let alive=0; for(const c of bd.camp.creeps)if(c.alive)alive++;
        if(!alive&&!bd.camp.chest)bd.lootUntil=bd.lootUntil||T+CAMP_LOOT_WAIT;
        if(bd.camp.waiting&&!bd.camp.chest&&T>(bd.lootUntil||0)){bd.camp=null;bd.lootUntil=0;}
      }
      if(!bd.camp){
        bd.camp=bandCampTarget(D,team);
        bd.lootUntil=0;
        if(!bd.camp){ // the wilds are quiet: back to the war, the way a relieved hold band goes
          let role="econ",least=1e9;
          for(const r of ["econ","patrol","assassin"]){
            const n=D.bands.filter(b=>b.role===r).length;
            if(n<least){least=n;role=r;}
          }
          bd.role=role; bd.point=null; bd.target=null; assignLane(D,bd);
        }
      }
      // the throne outranks the treasure, always — bd.defend is already set above from threat
    }
    if(bd.role==="patrol"){
      if(!bd.wps){`);

sub("the camp band's soldiers",
`    if(bd.role==="econ"){ // wolves among the sheep`,
`    if(bd.role==="camp"){ // into the wilds, and stand on the loot when the pack is down
      const st=bd.camp;
      if(st){
        // The pack aggros on proximity, so walking in IS the attack. Stand at the centre once it is
        // down: campTick hands the chest to any non-neutral body within 2.6 of it, so collecting is
        // a matter of being there rather than of code.
        if(!engageNearest(u,dt,16))
          moveToward(u,st.x+u.spread*0.25,st.z+u.spread*0.25,dt,st.chest?1.6:4);
      }else if(!engageNearest(u,dt,14)){
        const k=kings[u.team];
        moveToward(u,k.root.position.x+u.spread*0.4,k.root.position.z+u.spread*0.4,dt,5);
      }
      return;
    }
    if(bd.role==="econ"){ // wolves among the sheep`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patch-campband-v134: OK");
