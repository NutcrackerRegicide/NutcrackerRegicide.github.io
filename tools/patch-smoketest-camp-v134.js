#!/usr/bin/env node
/* patch-smoketest-camp-v134.js — gates for the wilds and the band economy, and a vacuity fix.
 *
 * THE VACUITY FIX FIRST, because it is the more instructive failure. The v132.26 mid-capture gate
 * opens with `const bz=neutralMarkets.find(m=>m.owner!==team); if(bz){...}` — and after the band
 * economy fix the AI takes every square, so there was no unheld one, so the whole block stopped
 * running. The suite reported 799 passes instead of 800 and NOT ONE FAILURE: a gate had silently
 * left the building because the code got better. A conditional gate is a gate that can disappear,
 * and the count is the only thing that would ever have told you. It stages a square now instead of
 * hoping to find one.
 *
 * THE CAMP GATES are constructed rather than campaign-observed, deliberately. A twenty-minute
 * campaign does now send bands into the wilds — wild packs cleared went 1 -> 3 and 0 -> 4 on the two
 * seeds measured — but whether a given match has a spare band at a quiet moment is luck, and an
 * assertion on it would be the same brittleness this arc has spent its time removing.
 *
 * The negative halves are the ones that matter: the Viking bay must NEVER be targeted (eleven
 * raiders and a chieftain against a band of seven), and no band goes treasure-hunting while the
 * throne is under threat.
 */
const fs=require("fs"),path=require("path");
const F=path.join(__dirname,"..","tools","smoketest.js");
const FS=path.join(__dirname,"..","tools","falsify.sh");
let s=fs.readFileSync(F,"utf8");
let fsh=fs.readFileSync(FS,"utf8");
let failed=[];
function sub(name,from,to){
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
}

sub("export the wilds",
`  "bazaarYield,BAZ_YIELD_BY_HELD,"+                    // v134.3 the squares`,
`  "bazaarYield,BAZ_YIELD_BY_HELD,"+                    // v134.3 the squares
  "bandCampTarget,CAMP_MIN_MIL,CAMP_MAX_THREAT,BAND_MIN,BAND_SEED,campStates,"+ // v134.3 the wilds`);

sub("the mid-capture gate stages its own square",
`      const bz=G2.neutralMarkets.find(m=>m.owner!==team);
      if(bz){`,
`      // v134.3 …AND IT STAGES ONE RATHER THAN HOPING TO FIND ONE. This read
      //     const bz=neutralMarkets.find(m=>m.owner!==team); if(bz){...}
      // and once the band economy fix taught the AI to take every square, there was no unheld one,
      // so the whole block stopped running. The suite went from 800 passes to 799 with NO failure —
      // a gate had silently left the building because the code got better, and only the count would
      // ever have said so. A conditional gate is a gate that can disappear.
      const _bzOwn=G2.neutralMarkets.map(m=>m.owner);
      if(!G2.neutralMarkets.some(m=>m.owner!==team)&&G2.neutralMarkets.length)
        G2.neutralMarkets[0].owner=1-team;
      const bz=G2.neutralMarkets.find(m=>m.owner!==team);
      if(bz){`);

sub("…and puts the owners back",
`        check("v132.26 relief: a band MID-CAPTURE is not relieved, and the same band with the "+
          "square at zero is ("+hb3.role+" holding vs "+hb4.role+" relieved)",
          held&&hb4.role!=="hold");
        D.bands=D.bands.filter(b=>b!==hb3&&b!==hb4);`,
`        check("v132.26 relief: a band MID-CAPTURE is not relieved, and the same band with the "+
          "square at zero is ("+hb3.role+" holding vs "+hb4.role+" relieved)",
          held&&hb4.role!=="hold");
        D.bands=D.bands.filter(b=>b!==hb3&&b!==hb4);
        for(let i=0;i<_bzOwn.length;i++)G2.neutralMarkets[i].owner=_bzOwn[i]; // v134.3: as we found it`);

sub("a dead building is not a collider, and a bench clears its own ground",
`  const insideAny=(x,z)=>{for(const b of G.buildings)if(insideCollider(b,x,z))return b;return null;};`,
`  // v134.3: …and a building that is not STANDING is not a collider. pushOutOfBuildings skips !alive,
  // so counting one here would report a body inside something the game itself walks straight through.
  const insideAny=(x,z)=>{for(const b of G.buildings)if(b.alive&&insideCollider(b,x,z))return b;return null;};
  // v134.3 A BENCH HAS TO CLEAR ITS OWN GROUND. Both benches below stand a building at a fixed spot
  // behind blue's town and walk bodies around it — on ground the AI also builds on. The band economy
  // of this version changed what blue could afford by that minute, a storage pit went up 3.8 from the
  // haul stand point, and the gate reported 0 of 18 arrivals with nothing whatever wrong with the
  // code it tests. That is the same failure as the vacuous mid-capture gate above wearing the other
  // face: a constructed bench in a lived-in world either stages its neighbourhood or reports on it.
  const clearGround=(x,z,r)=>{const hid=[];
    for(const b of G.buildings)if(b.alive&&Math.hypot(b.x-x,b.z-z)<r){b.alive=false;hid.push(b);}
    return ()=>{for(const b of hid)b.alive=true;};};`);

sub("the shove bench clears its ground",
`    const b=pBld("barracks",-120,-60), face=faceZ(b);`,
`    const restore=clearGround(-120,-60,22);                    // v134.3: nobody else on this ground
    const b=pBld("barracks",-120,-60), face=faceZ(b);`);

sub("…and puts it back",
`      " of 24, deepest "+deepest.toFixed(2)+") — v133 put 3 in, 1.30 deep",
      inside===0&&deepest<0.01);
    wipe();`,
`      " of 24, deepest "+deepest.toFixed(2)+") — v133 put 3 in, 1.30 deep",
      inside===0&&deepest<0.01);
    restore(); wipe();`);

sub("the haul bench clears its ground",
`    const b=pBld("storage_pit",-120,-60);
    const goal={x:b.x,z:2*b.z-faceZ(b)-2.2};                   // the stand point on the north side`,
`    const restore=clearGround(-120,-64,26);                    // v134.3: the pit AND the stand point
    const b=pBld("storage_pit",-120,-60);
    const goal={x:b.x,z:2*b.z-faceZ(b)-2.2};                   // the stand point on the north side`);

sub("…and puts that back too",
`    if(sidesteps)note("v134.0 haul: "+sidesteps+" sidesteps issued clearing the queue");
    wipe();`,
`    if(sidesteps)note("v134.0 haul: "+sidesteps+" sidesteps issued clearing the queue");
    restore(); wipe();`);

sub("a dead pack does not get to take the whole suite down with it",
`  const wounded=north.creeps.find(c=>c.alive);
  wounded.hp=wounded.maxHp*0.4; // bloody one by hand — the camp is calm, so it must knit`,
`  // v134.3 …AND A PACK SOMETHING UPSTREAM HAS ALREADY KILLED DOES NOT GET TO TAKE THE SUITE DOWN
  // WITH IT. This dereferenced find(c=>c.alive) blind. Under one mutation run bodies blundered
  // through the wilds and wiped the north pack, node threw on undefined.maxHp at this line, the
  // process died a third of the way through the file — and tools/falsify.sh reported "0 total
  // failures", because no FAIL line ever printed. NO RUN AT ALL READS EXACTLY LIKE A CLEAN ONE.
  // falsify.sh now insists on a verdict; this stands a body back up rather than hoping for one, and
  // says so in the message, because a staged pack is a different claim from a standing one.
  let wounded=north.creeps.find(c=>c.alive), _revived=false;
  if(!wounded){wounded=north.creeps[0]; wounded.alive=true; wounded.hp=wounded.maxHp; _revived=true;}
  wounded.hp=wounded.maxHp*0.4; // bloody one by hand — the camp is calm, so it must knit`);

sub("…and the message says whether the pack was standing",
`  check("calm creeps regenerate (+"+Math.round(wounded.hp-wh)+" hp of "+Math.round(wounded.maxHp)+`,
`  check("calm creeps regenerate"+(_revived?" (PACK WAS DEAD — one stood back up for this)":"")+
    " (+"+Math.round(wounded.hp-wh)+" hp of "+Math.round(wounded.maxHp)+`);

sub("the wilds are a mission a relieved band may take",
`      hb.role!=="hold"&&["econ","patrol","assassin"].includes(hb.role)&&hb.point===null);`,
`      // v134.3: …and "camp" is one of the missions now. This whitelist was written at v113, when
      // the relief branch chose between three roles; the wilds became the fourth this version and
      // this line was not updated with it. On the default seed the marshal happened not to pick it
      // and the gate stayed green — SMOKE_SEED=42 put a live pack within reach at that instant and
      // the gate went red on a band doing exactly what v134.3 asks of it. Off-seed runs earn their
      // keep here: the same code, one different world, one whitelist nobody had revisited.
      hb.role!=="hold"&&["econ","patrol","assassin","camp"].includes(hb.role)&&hb.point===null);`);

sub("the wilds bench",
`console.log(fails?("\\n"+fails+" FAILURES"):"\\nALL SMOKE TESTS PASSED");`,
`// ==================== v134.3 THE WILDS, AND THE BAND ECONOMY ====================
{
  const G=global.__G;
  // --- 1. THE TARGET PICKER. Wild camps only, live packs only, one band per pocket.
  {
    const D={team:G.RED,bands:[]};
    const live=G.campStates.filter(c=>!c.boss&&!c.waiting&&c.creeps.some(x=>x.alive));
    const boss=G.campStates.find(c=>c.boss);
    const t1=G.bandCampTarget(D,G.RED);
    // …and a pocket another band already claimed is not offered twice
    D.bands.push({role:"camp",camp:t1});
    const t2=G.bandCampTarget(D,G.RED);
    check("v134.3 wilds: the picker takes a live WILD pack, never the Viking bay, and never the "+
      "pocket another band has already claimed ("+live.length+" live wild camps; first "+
      (t1?"("+t1.x.toFixed(0)+","+t1.z.toFixed(0)+")":"none")+", second "+
      (t2?"("+t2.x.toFixed(0)+","+t2.z.toFixed(0)+")":"none")+")",
      !!t1&&!t1.boss&&t1!==boss&&t2!==t1&&(!t2||!t2.boss));
    // THE NEGATIVE THAT MATTERS: eleven raiders and a chieftain guard the bay. Even with every wild
    // camp claimed, the answer is "nowhere to go", not "the bay".
    // ⚠ AND THE BAY HAS TO BE AWAKE FOR THIS TO MEAN ANYTHING. It starts as an empty wreck and the
    // raid does not land until 15:00 (BOSS_RESPAWN), so at the point this runs it is WAITING and
    // would be skipped by the live-pack test whether or not the boss test existed. Staged awake, the
    // gate turns red the moment somebody deletes the st.boss test — which is exactly what it is for.
    const Dall={team:G.RED,bands:G.campStates.filter(c=>!c.boss).map(c=>({role:"camp",camp:c}))};
    const _bw=boss?boss.waiting:null, _ba=boss?boss.creeps.map(c=>c.alive):null;
    if(boss){boss.waiting=false;for(const c of boss.creeps)c.alive=true;}
    const t3=G.bandCampTarget(Dall,G.RED);
    if(boss){boss.waiting=_bw;boss.creeps.forEach((c,i)=>{c.alive=_ba[i];});}
    check("v134.3 wilds: with every wild pocket claimed the picker answers NOWHERE rather than "+
      "sending seven soldiers at the Viking bay, even with the raid ashore and eleven raiders "+
      "standing ("+(t3?"offered "+(t3.boss?"THE BAY":"a camp"):"none")+")",
      !t3);
  }

  // --- 2. THE BAND ECONOMY, staged so that ONLY the founding pass can answer.
  //        ⚠ THREE CUTS OF THIS GATE PASSED WITH THE FIX MUTATED OUT, and the third one was
  //        telling the truth. The first handed the marshal forty soldiers at once — forty loose
  //        bodies deal several bands through the ordinary loop, so it proved nothing. The second
  //        trickled four, which is BAND_MIN, so the ordinary loop handled that too. The third
  //        trickled THREE and still passed, and at that point the gate was not the thing that was
  //        wrong: the founding pass could not fire on a trickle AT ALL, because the map of wanted
  //        roles was built inside the roster>=BAND_MIN block and was undefined whenever the pool was
  //        short. The pass was doing nothing worth mutating. Both are fixed; this is the staging
  //        that tells them apart, and it is a single think-clock rather than a hopeful campaign.
  //
  //        THE STAGE: a kingsguard already filled to its need, so it takes nothing more; exactly one
  //        mission band, of four, with room for four more; nobody loose. Then three reinforcements.
  //        Three is above BAND_SEED and below BAND_MIN, so the ordinary deal loop cannot fire, and
  //        the straggler loop would put all three into the band that exists. The only thing in the
  //        function that can open a second mission is the pass this version added.
  {
    const team=G.RED, D=G.directors[team], pers0=D.pers, bands0=D.bands;
    D.pers="expand"; D.bands=[];
    const made=[];
    const add=(n,tag)=>{for(let i=0;i<n;i++){
      const u=G.makeUnit(team,"clubman",120+(made.length%10)*2,-150-Math.floor(made.length/10)*2,
        {name:"Trickle"+tag+"_"+made.length,bot:{role:"war"}});
      u.bandRef=null; made.push(u);}};
    add(30,"seed"); G.manageBands(D);          // the guard fills, the rest deal into bands
    const kg=D.bands.find(b=>b.role==="kingsguard");
    const keep=D.bands.find(b=>b.role!=="kingsguard"&&b.role!=="siege");
    for(const b of D.bands)if(b!==kg&&b!==keep)for(const v of b.members)v.alive=false;
    if(keep)for(const v of keep.members.slice(4))v.alive=false;
    G.manageBands(D);                          // …and the dead are pruned back out of the bands
    const before=D.bands.filter(b=>b.role!=="kingsguard"&&b.role!=="siege").length;
    const kept=keep?keep.members.length:0;
    add(3,"tr"); G.manageBands(D);             // three men report for duty
    const after=D.bands.filter(b=>b.role!=="kingsguard"&&b.role!=="siege").length;
    const grew=keep?keep.members.length:0;
    const byRole=D.bands.reduce((m,b)=>{m[b.role]=(m[b.role]||0)+1;return m;},{});
    D.pers=pers0; D.bands=bands0;
    for(const u of made){u.bandRef=null;u.alive=false;}
    check("v134.3 bands: THREE reinforcements, a full kingsguard and one standing mission band of "+
      kept+" with room for four more — and the three OPEN A SECOND MISSION rather than swelling "+
      "the first ("+before+" mission band before, "+after+" after; the standing band went "+kept+
      " -> "+grew+"; "+JSON.stringify(byRole)+"). Before this the straggler loop handed every "+
      "reinforcement to a band that already existed, so a twenty-minute campaign ended with one "+
      "mission band or none on both teams",
      before===1&&after===2&&kept===4&&grew===4);
  }

  // --- 3. THE THRONE OUTRANKS THE TREASURE. Nothing goes hunting while the king is being hunted.
  {
    const team=G.RED, D=G.directors[team], pers0=D.pers, bands0=D.bands;
    D.pers="expand"; D.bands=[];
    const made=[];
    // ⚠ EIGHTY, not forty. The camp is the LAST role in the doctrine's want-list, and with forty
    // bodies the kingsguard took fourteen and the remaining twenty-six dealt four bands — three
    // holds and an econ — before the roster ran dry. So the mutation run that deleted the threat
    // test fielded no camp band either, and the gate reported green on a rule it was not reaching:
    // it was measuring the deal order, not the throne. Eighty bodies deal past every other mission,
    // so a camp band is what the marshal does next unless the throne stops it.
    for(let i=0;i<80;i++){
      const u=G.makeUnit(team,"clubman",120+(i%10)*2,-160-Math.floor(i/10)*2,
        {name:"Siege"+i,bot:{role:"war"}});
      u.bandRef=null; made.push(u);
    }
    // ⚠ AND A LIVE PACK HAS TO BE STANDING SOMEWHERE, or this gate passes because there was
    // nowhere to go rather than because the rule held — the same vacuity as the mid-capture gate
    // above, and the mutation run proved it: with the threat test deleted the camp bands cleared
    // the wilds during the EARLIER gates, so by the time this one ran bandCampTarget answered null
    // and the gate reported green on a rule it had just watched break. It stages a pack awake, and
    // it asserts that a target existed, out loud, in the same breath as the rule.
    const wild=G.campStates.find(c=>!c.boss);
    const _ww=wild?wild.waiting:null, _wa=wild?wild.creeps.map(c=>c.alive):null;
    if(wild){wild.waiting=false;for(const c of wild.creeps)c.alive=true;}
    const reachable=!!G.bandCampTarget({team,bands:[]},team);
    // stand a mob of enemies on the throne: threat is enemies within 42 of the king, weighted
    const king=G.kings[team], foes=[];
    for(let i=0;i<10;i++){
      const f=G.makeUnit(1-team,"clubman",king.root.position.x+2+i*0.6,king.root.position.z+2,
        {name:"Foe"+i,bot:{role:"war"}});
      foes.push(f);
    }
    for(let i=0;i<4;i++)G.manageBands(D);
    const camps=D.bands.filter(b=>b.role==="camp").length, thr=D.threat;
    if(wild){wild.waiting=_ww;wild.creeps.forEach((c,i)=>{c.alive=_wa[i];});} // as we found it
    D.pers=pers0; D.bands=bands0;
    for(const u of made.concat(foes)){u.bandRef=null;u.alive=false;}
    check("v134.3 wilds: no band goes treasure-hunting while the throne is under threat, WITH A "+
      "LIVE PACK STANDING TO GO AFTER (a target was reachable: "+reachable+"; threat "+
      (thr||0).toFixed(1)+" over the limit of "+G.CAMP_MAX_THREAT+", camp bands "+camps+")",
      reachable&&thr>G.CAMP_MAX_THREAT&&camps===0);
  }
}

console.log(fails?("\\n"+fails+" FAILURES"):"\\nALL SMOKE TESTS PASSED");`);

// ---------------------------------------------------------------------------
// …AND THE FALSIFIER LEARNS THE DIFFERENCE BETWEEN A GREEN RUN AND NO RUN.
// ---------------------------------------------------------------------------
{
  const from=`TOT=$(echo "$OUT" | grep -c "FAIL —")
echo "--- $NAME: $TOT total failures ---"`;
  const to=`TOT=$(echo "$OUT" | grep -c "FAIL —")
# v134.3 A RUN THAT NEVER REACHED ITS VERDICT IS NOT A PASS. A mutation that throws — or one written
# carelessly enough to take a line of real code out with its comment, which is exactly how this was
# found — kills the process partway through, prints no FAIL line at all, and was reported here as
# "0 total failures": the harness saying the gate did not notice, when the truth was that nothing
# had finished looking. Zero failures has to mean the suite ran to the end and found nothing.
if ! echo "$OUT" | grep -qE "ALL SMOKE TESTS PASSED|FAILURES"; then
  echo "--- $NAME: SUITE DID NOT FINISH (crash or timeout) — this is not a fair test of the gate ---"
  echo "$OUT" | tail -3 | sed 's/^/    /'
  exit 3
fi
echo "--- $NAME: $TOT total failures ---"`;
  const n=fsh.split(from).length-1;
  if(n!==1)failed.push("falsify.sh verdict check (matched "+n+" times, need exactly 1)");
  else fsh=fsh.split(from).join(to);
}

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(F,s);
fs.writeFileSync(FS,fsh);
console.log("patch-smoketest-camp-v134: OK");
