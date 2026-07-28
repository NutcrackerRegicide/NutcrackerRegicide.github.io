/* REGICIDE PVP — 07-ai.js */
// ---------- spawn the armies ----------
const NAMES=["Aldric","Berta","Cedric","Dagny","Edmund","Freya","Godwin","Hilda","Ivo","Jorunn","Kettil","Leofric","Maren","Nils","Oswin","Petra","Quenna","Ragnar","Sigrid","Torvald","Una","Vidar","Wyn","Ysolde","Zorka"];
// ---------- v124 "ALEXANDER THE GREAT" ----------
// John's format, and everyone on the field gets one — the kill feed reads properly now
// ("Aldric the Bold slew Cassius the Vigilant") and the scoreboard looks like a roll of warriors
// rather than a class register. Rolled once and FIXED for the match: an epithet that shifted as you
// advanced would leave teammates tracking a name that no longer exists.
//
// The epithet is chosen by the SAME index as the name, not independently, so a given warrior is the
// same warrior on every machine. That matters more than it looks: names ride the wire as strings on
// join, but bots are named locally from their unit id on host AND guest, and two machines disagreeing
// about who "Ragnar the Unbroken" is would show up in every kill message.
const EPITHETS=["the Great","the Bold","the Unbroken","the Vigilant","the Grim","the Swift",
  "the Stout","the Red","the Wanderer","the Younger","the Elder","the Fell","the Keen",
  "the Quiet","the Wolf","the Hammer","the Proud","the Lucky","the Sly","the Iron",
  "the Fearless","the Ready","the Stern","the Wise","the Bear","the Fair","the Hardy",
  "the Long-Armed","the Black","the Steadfast"];
function mkEpithet(i){return EPITHETS[i%EPITHETS.length];}
function mkName(i){
  const base=NAMES[i%NAMES.length];
  // the pools are coprime-ish in length (25 names, 30 epithets), so the pairing does not repeat
  // until 750 warriors — comfortably past a 100-unit field
  const ep=EPITHETS[(i*7+Math.floor(i/NAMES.length))%EPITHETS.length];
  return base+" "+ep;
}
function spawnTeam(team,count,nameOff){
  const tc=TCPOS[team];
  for(let i=0;i<count;i++){
    const a=Math.random()*Math.PI*2,r=13+Math.random()*12; // clear of the 2x TC
    const u=makeUnit(team,"villager",tc[0]+Math.cos(a)*r,tc[1]+Math.sin(a)*r,
      {name:mkName(i+nameOff),bot:{role:"citizen",res:(r=>r<0.45?"food":r<0.7?"wood":r<0.9?"gold":"stone")(Math.random())}});
    u.guardA=Math.random()*Math.PI*2; u.guardR=5+Math.random()*8; u.spread=(Math.random()-0.5)*26;
  }
}
player=makeUnit(BLUE,"villager",TCPOS[0][0]+12,6,{isPlayer:true,name:"You"});
kings[BLUE]=makeUnit(BLUE,"king",TCPOS[0][0]+8,-12,{isKing:true,name:"King Osric",bot:{role:"king"}});
kings[RED]=makeUnit(RED,"king",TCPOS[1][0]-8,12,{isKing:true,name:"King Vargus",bot:{role:"king"}});
spawnTeam(BLUE,48,0);   // + you + King Osric = 50
spawnTeam(RED,49,31);   // + King Vargus = 50

// ---------- THE WILDS: six creep camps ring the world's edge (v77) ----------
// Each camp always creates CREEP_N unit bodies so unit ids stay deterministic across
// host/guest; a 4-pack simply leaves the fifth dead. Pack type is rolled per machine
// and reconciled by applyWorld/snapshots — the HOST's roll is the truth.
const campStates=[];
for(let ci=0;ci<CAMPS.length;ci++){
  const C=CAMPS[ci];
  if(C.boss){ // THE SOUTHERN SHORE: starts as an empty wreck — the raid lands at 15:00
    const st={i:ci,x:C.x,z:C.z,r:C.r,aggro:C.r-2,boss:true,kind:"viking",
              waiting:true,respawnAt:BOSS_RESPAWN,chest:null,chestKind:null,chestB:null,chestKindB:null,creeps:[]};
    for(let k=0;k<BOSS_N;k++){ // body 0 is the chieftain; all start dead on the sand
      const isBoss=k===0;
      const a=((k-1)/(BOSS_N-1))*Math.PI*2, r=isBoss?0:(C.r*0.27+((k%2)*C.r*0.08)); // the war band rings its chieftain, scaled to the bay
      const u=makeUnit(NEUTRAL,isBoss?"vikingboss":"viking",C.x+Math.cos(a)*r,C.z+Math.sin(a)*r,
        {name:isBoss?"Viking Chieftain":"Viking Raider",bot:{role:"creep",camp:st,post:{a,r}}});
      u.respawnT=Infinity; u.alive=false; u.root.visible=false;
      st.creeps.push(u);
    }
    campStates.push(st); continue;
  }
  const st={i:ci,x:C.x,z:C.z,r:C.r,aggro:C.r-2.5,kind:Math.random()<0.5?"wolf":"barbarian",
            waiting:false,respawnAt:0,chest:null,chestKind:null,chestB:null,chestKindB:null,creeps:[]};
  const n=4+((Math.random()<0.5)?0:1);
  for(let k=0;k<CREEP_N;k++){
    const a=(k/CREEP_N)*Math.PI*2+0.6, r=C.r*0.35+(k%2)*(C.r*0.17); // the pack spreads through its doubled hollow
    const u=makeUnit(NEUTRAL,st.kind,C.x+Math.cos(a)*r,C.z+Math.sin(a)*r,
      {name:st.kind==="wolf"?"Wild Wolf":"Barbarian",bot:{role:"creep",camp:st,post:{a,r}}});
    u.respawnT=Infinity; // the camp manager rules creep rebirth, never the town clock
    if(k>=n){u.alive=false;u.root.visible=false;}
    st.creeps.push(u);
  }
  campStates.push(st);
}
// the treasure: a chest at the camp's heart — pure visuals here, state lives on st
function _chestShow(st,kind,slotB){ // slotB: the boss shore drops TWO chests, side by side
  _chestHide(st,slotB);
  const g=new THREE.Group();
  const base=new THREE.Mesh(new THREE.BoxGeometry(1.5,0.9,1.0),texturedMat("wood",0x7a5230)); base.position.y=0.45; base.castShadow=true; g.add(base);
  const lid=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,1.5,8,1,false,0,Math.PI),texturedMat("wood",0x8a6240)); lid.rotation.z=Math.PI/2; lid.position.y=0.9; g.add(lid);
  const band=new THREE.Mesh(new THREE.BoxGeometry(1.56,0.16,1.04),plainMat(0xe0c23a)); band.position.y=0.62; g.add(band);
  const lock=new THREE.Mesh(new THREE.BoxGeometry(0.24,0.3,0.1),plainMat(0xe0c23a)); lock.position.set(0,0.62,0.53); g.add(lock);
  const gleam=new THREE.Mesh(new THREE.SphereGeometry(0.22,6,5), // read the prize at a glance: red = food, gold = gold
    new THREE.MeshBasicMaterial({color:kind==="food"?0xd23c2f:0xffd24a})); gleam.position.y=1.35; g.add(gleam);
  const off=st.boss?(slotB?2.6:-2.6):0; // the shore's pair sit shoulder to shoulder at the fire ring
  g.position.set(st.x+off,terrainHeight(st.x+off,st.z),st.z);
  scene.add(g);
  if(slotB){st.chestB=g;st.chestKindB=kind;}else{st.chest=g;st.chestKind=kind;}
}
function _chestHide(st,slotB){
  if(slotB){ if(st.chestB){scene.remove(st.chestB);st.chestB=null;} st.chestKindB=null; }
  else     { if(st.chest){scene.remove(st.chest);st.chest=null;}   st.chestKind=null;  }
}
function spawnCampChest(st,kind,slotB){ // host/solo: show + tell the guests
  _chestShow(st,kind,slotB);
  if(typeof NET!=="undefined"&&NET.mode==="host")NET.bcast({t:"chest",i:st.i,k:kind,s:slotB?1:0});
}
function clearCampChest(st,slotB){
  _chestHide(st,slotB);
  if(typeof NET!=="undefined"&&NET.mode==="host")NET.bcast({t:"chest",i:st.i,k:null,s:slotB?1:0});
}
function collectCampChest(st,e,slotB){
  const kind=slotB?st.chestKindB:st.chestKind, amt=st.boss?BOSS_CHEST:CAMP_CHEST;
  stock[e.team][kind]+=amt;
  awardPts(e,amt); // same rate a deposit pays: a point per resource
  if(typeof questProgress==="function")questProgress(e,"chest"); // TREASURE HUNTER
  const who=e.isPlayer?"You":e.name;
  const txt=(e.team===MYTEAM?("⚑ "+who+" claimed a camp treasure: +"+amt+" "+kind+"!")
                            :("The "+TEAMNAME[e.team]+" army plundered a camp treasure (+"+amt+" "+kind+")."));
  msg(txt,e.team===MYTEAM?"blue":"gold");
  if(typeof Sound!=="undefined")Sound.play("chest",{x:st.x,z:st.z}); // v100: treasure-open reward
  if(typeof NET!=="undefined"&&NET.mode==="host")NET.bcast({t:"note",m:"⚑ "+who+" ("+TEAMNAME[e.team]+") claimed a camp treasure: +"+amt+" "+kind+"!",tone:"gold"});
  clearCampChest(st,slotB);
  updateResHud();
}
function campNewWave(st){ // fresh fangs: roll the pack anew
  st.waiting=false;
  if(st.boss){ // THE RAID LANDS: the chieftain and all ten raiders storm ashore
    for(let k=0;k<st.creeps.length;k++){
      const u=st.creeps[k], post=u.bot.post;
      if(u.hp!==u.maxHp||u.cls)setClassStats(u); // full war-strength (cls never changes here)
      u.alive=true;u.corpse=false;u.dieT=0;u.respawnT=Infinity;
      u.body.rotation.x=0;u.root.visible=true;
      const sx=st.x+Math.cos(post.a)*post.r, sz=st.z+Math.sin(post.a)*post.r;
      u.root.position.set(sx,terrainHeight(sx,sz),sz);
      puff(sx,1.6,sz,0xd8dde2);
    }
    const m="⚔ A VIKING RAID storms the SOUTHERN SHORE — a chieftain and his war band guard twin treasures!";
    msg(m,"warn");
    if(typeof Sound!=="undefined")Sound.play("raid"); // v103: the dark gong — a raid has landed
    if(typeof Sound!=="undefined"&&Sound.voxChorus)Sound.voxChorus(st.x,st.z,3); // v109: the war band roars ashore (positional — near the bay you HEAR them)
    if(typeof NET!=="undefined"&&NET.mode==="host"){NET.bcast({t:"note",m,tone:"warn"});NET.bcast({t:"snd",k:"raid"});NET.bcast({t:"snd",k:"__chorus",x:st.x,z:st.z});}
    return;
  }
  st.kind=Math.random()<0.5?"wolf":"barbarian";
  const n=4+((Math.random()<0.5)?0:1);
  for(let k=0;k<st.creeps.length;k++){
    const u=st.creeps[k], post=u.bot.post;
    if(k<n){
      u.name=st.kind==="wolf"?"Wild Wolf":"Barbarian";
      if(u.cls!==st.kind)setClass(u,st.kind); else setClassStats(u);
      u.alive=true;u.corpse=false;u.dieT=0;u.respawnT=Infinity;
      u.body.rotation.x=0;u.root.visible=true;
      const sx=st.x+Math.cos(post.a)*post.r, sz=st.z+Math.sin(post.a)*post.r;
      u.root.position.set(sx,terrainHeight(sx,sz),sz);
      puff(sx,1.4,sz,0x9a8f7a);
    }else{ // the pack came up short — this body stays in the earth
      u.alive=false;u.corpse=false;u.dieT=0;u.root.visible=false;u.respawnT=Infinity;
    }
  }
}
function campTick(dt){ // host/solo only — guests watch it all arrive by snapshot + event
  for(const st of campStates){
    for(const slotB of (st.boss?[false,true]:[false])){ // first boot on a treasure takes it — steals welcome
      if(!(slotB?st.chestB:st.chest))continue;
      const cx=st.boss?(st.x+(slotB?2.6:-2.6)):st.x;
      for(const e of units){
        if(!e.alive||e.team===NEUTRAL)continue;
        if(dist2(e.root.position.x,e.root.position.z,cx,st.z)<2.6*2.6){collectCampChest(st,e,slotB);break;}
      }
    }
    if(st.waiting){
      if(T>=st.respawnAt){
        if(st.chest)clearCampChest(st,false); // unclaimed treasure is dragged off by the new pack
        if(st.chestB)clearCampChest(st,true);
        campNewWave(st);
      }
      continue;
    }
    let alive=0; for(const c of st.creeps)if(c.alive)alive++;
    if(alive===0){ // pack wiped: drop the loot, start the clock
      st.waiting=true; st.respawnAt=T+(st.boss?BOSS_RESPAWN:CAMP_RESPAWN);
      if(st.boss){ // the raid is broken: TWIN chests — 500 food and 500 gold
        spawnCampChest(st,"food",false);
        spawnCampChest(st,"gold",true);
        const m="⚑ The VIKING RAID is broken! Twin chests of plunder lie by the wreck — first come, first served.";
        msg(m,"gold");
        if(typeof NET!=="undefined"&&NET.mode==="host")NET.bcast({t:"note",m,tone:"gold"});
      }else spawnCampChest(st,st.kind==="wolf"?"food":"gold",false);
    }
  }
}
// creep brain: guard the camp, savage intruders, never step past the pocket's edge
function updateCreep(u,dt){
  const st=u.bot.camp;
  const px=u.root.position.x,pz=u.root.position.z;
  let t=null,bd=1e9; // nearest intruder INSIDE the aggro ring (per-camp: the boss shore casts a wider net)
  const agg=st.aggro||CAMP_AGGRO;
  for(const e of units){
    if(!e.alive||e.team===NEUTRAL||e.garrison)continue;
    if(dist2(e.root.position.x,e.root.position.z,st.x,st.z)>agg*agg)continue;
    const d=dist2(px,pz,e.root.position.x,e.root.position.z);
    if(d<bd){bd=d;t=e;}
  }
  // v110 THE WOLVES: wolf camps HOWL — often on the hunt, rarely at rest (idle howls carry
  // the wilds' dread to anyone passing near). Human growls now belong to the human camps only.
  if(st.kind==="wolf"){
    if(!u._hwT||T>u._hwT){
      u._hwT=T+(t?(10+Math.random()*8):(25+Math.random()*35));
      if(typeof Sound!=="undefined")Sound.play("wolfhowl",{x:px,z:pz});
      if(typeof NET!=="undefined"&&NET.mode==="host")NET.bcast({t:"snd",k:"wolfhowl",x:px,z:pz});
    }
  }
  if(t){
    // v109 THE VOICES: the (human) wilds snarl while they hunt — one growl every ~6-10s per creep
    if(st.kind!=="wolf"&&(!u._grT||T>u._grT)){u._grT=T+6+Math.random()*4;
      if(typeof Sound!=="undefined")Sound.play("vgrowl",{x:px,z:pz});
      if(typeof NET!=="undefined"&&NET.mode==="host")NET.bcast({t:"snd",k:"vgrowl",x:px,z:pz});}
    const d=Math.sqrt(bd);
    if(d>u.rng*0.8)moveToward(u,t.root.position.x,t.root.position.z,dt,u.rng*0.7);
    else{
      u.facing=Math.atan2(t.root.position.x-px,t.root.position.z-pz);
      tryAttack(u);
    }
  }else{
    // calm: drift back to the post; wounds knit while nobody trespasses (anti-poke regen)
    const post=u.bot.post, hx=st.x+Math.cos(post.a)*post.r, hz=st.z+Math.sin(post.a)*post.r;
    if(dist2(px,pz,hx,hz)>2.2*2.2)moveToward(u,hx,hz,dt,1.4);
    else{u.moving=false; if(!u.bot.wt||T>u.bot.wt){u.bot.wt=T+2+Math.random()*3;u.facing=Math.random()*Math.PI*2;}}
    if(u.hp<u.maxHp){u.hp=Math.min(u.maxHp,u.hp+u.maxHp*0.08*dt);setBar(u.bar,u.hp/u.maxHp);}
  }
  // the hard leash: paws never leave the camp circle, no matter the shoving
  const dx=u.root.position.x-st.x,dz=u.root.position.z-st.z,dd=Math.hypot(dx,dz);
  const lim=(st.r||CAMP_R)-1.2;
  if(dd>lim){u.root.position.x=st.x+dx/dd*lim;u.root.position.z=st.z+dz/dd*lim;}
}

// ---------- team AI directors ----------
let rosterAccum=0;
// v94: humans on a team keep its marshal on the supportive "normal" brain;
// pure-AI teams answer to the solo/co-op difficulty dial.
function teamHasHuman(team){
  if(typeof player!=="undefined"&&player&&player.isPlayer&&player.team===team&&
     (typeof NET==="undefined"||NET.mode!=="guest"))return true;
  if(typeof NET!=="undefined"&&NET.mode==="host")
    for(const k in NET.remotes){const r=NET.remotes[k];if(r.unit&&r.unit.team===team)return true;}
  return false;
}
function diffFor(team){return teamHasHuman(team)?"normal":aiDifficulty;}
function mkDirector(team){ // v94: every marshal rolls a PERSONALITY
  const keys=Object.keys(PERSONALITIES);
  const pers=keys[(Math.random()*keys.length)|0];
  return{team,pers,nextThink:2+Math.random()*2,nextConv:40+Math.random()*8,
    nextRaid:PERSONALITIES[pers].raidAt+Math.random()*30,raidUntil:0};
}
const directors=[mkDirector(BLUE),mkDirector(RED)];
function countBld(team,type){let n=0;for(const b of buildings)if(b.alive&&b.built&&b.team===team&&b.type===type)n++;return n;}
function pendingBld(team){return buildings.filter(b=>b.alive&&b.team===team&&!b.built);}
function affordKeep(team,cost,rf,rg){
  return stock[team].food>=(cost.food||0)+rf&&stock[team].gold>=(cost.gold||0)+rg&&
    stock[team].stone>=(cost.stone||0)&&stock[team].wood>=(cost.wood||0);
}
function findSpot(team,type){
  const tc=TCPOS[team];
  for(let i=0;i<50;i++){
    let x,z;
    if(type==="tower"){ // towers screen the approach to the base
      x=tc[0]+(team===BLUE?1:-1)*(16+Math.random()*26); z=(Math.random()-0.5)*66;
    }else if(type==="farm"){ // big fields ring the Town Center
      const a=Math.random()*Math.PI*2,r=12+Math.random()*12;
      x=tc[0]+Math.cos(a)*r; z=tc[1]+Math.sin(a)*r;
    }else{
      const a=Math.random()*Math.PI*2,r=11+Math.random()*26;
      x=tc[0]+Math.cos(a)*r; z=tc[1]+Math.sin(a)*r*0.85;
    }
    const eg=BLD[type].r+2.6; // every side of the plot stays hammer-reachable
    x=Math.max(-MAP.x+eg,Math.min(MAP.x-eg,x)); z=Math.max(-MAP.z+eg,Math.min(MAP.z-eg,z));
    if(validFor(type,x,z,team))return{x,z};
  }
  return null;
}
function idleCitizen(team){
  for(const u of units)
    if(u.alive&&u.team===team&&u.bot&&!u.isKing&&!u.isPlayer&&!u.remote&&u.cls==="villager"&&!u.task&&!u.convertTo)return u;
  return null;
}
function findSpotNear(team,type,x,z){ // a legal plot in the neighbourhood
  const edge=BLD[type].r+2.6; // room to stand and swing a hammer on EVERY side
  for(let i=0;i<24;i++){
    const a=Math.random()*Math.PI*2, r=6+Math.random()*10;
    const sx=x+Math.cos(a)*r, sz=z+Math.sin(a)*r;
    if(Math.abs(sx)>MAP.x-edge||Math.abs(sz)>MAP.z-edge)continue;
    if(validFor(type,sx,sz,team))return {x:sx,z:sz};
  }
  return null;
}
// ---------- v94: FARM ECONOMY — fields ring the TC, every Storage Pit, and castles ----------
function farmAnchors(team){ // everywhere farmAdjacent will bless a field
  const list=[];
  for(const b of buildings){
    if(!b.alive||b.team!==team)continue;
    if(b.type==="towncenter")list.push({x:b.x,z:b.z,rMin:13,rMax:24});
    else if(b.built&&b.type==="storage_pit")list.push({x:b.x,z:b.z,rMin:13,rMax:19});
    else if(b.built&&b.type==="castle")list.push({x:b.x,z:b.z,rMin:15,rMax:21});
  }
  return list;
}
function findFarmSpot(team){ // sample rings around every anchor, not just the TC
  const anchors=farmAnchors(team);
  if(!anchors.length)return null;
  const eg=BLD.farm.r+2.6;
  for(let i=0;i<60;i++){
    const A=anchors[(Math.random()*anchors.length)|0];
    const a=Math.random()*Math.PI*2, r=A.rMin+Math.random()*(A.rMax-A.rMin);
    const x=Math.max(-MAP.x+eg,Math.min(MAP.x-eg,A.x+Math.cos(a)*r));
    const z=Math.max(-MAP.z+eg,Math.min(MAP.z-eg,A.z+Math.sin(a)*r));
    if(validFor("farm",x,z,team))return{x,z};
  }
  return null;
}
function findPitSpotForFarms(team){ // no room left? plant a NEW pit a field's walk out — fresh farm anchor
  const tc=TCPOS[team];
  const eg=BLD.storage_pit.r+2.6;
  for(let i=0;i<40;i++){
    const a=Math.random()*Math.PI*2, r=34+Math.random()*14;
    const x=Math.max(-MAP.x+eg,Math.min(MAP.x-eg,tc[0]+Math.cos(a)*r));
    const z=Math.max(-MAP.z+eg,Math.min(MAP.z-eg,tc[1]+Math.sin(a)*r*0.85));
    if(validFor("storage_pit",x,z,team))return{x,z};
  }
  return null;
}
// v94 HARD AI: read the enemy's army and weight the counter-lines off the RPS wheel
function counterWeights(team,base){
  let eM=0,eA=0,eR=0,eC=0,eS=0;
  for(const e of units){
    if(!e.alive||e.team!==1-team||e.isKing||e.cls==="villager")continue;
    const l=CLS[e.cls].line;
    if(CLS[e.cls].mounted)eC++;
    else if(l==="melee")eM++;
    else if(l==="anticav")eA++;
    else if(l==="ranged")eR++;
    else if(isSiege(e.cls))eS++;
  }
  const W=Object.assign({},base);
  W.anticav=(W.anticav||2)+eC*1.2;      // spears answer the horse (3.8x)
  W.ranged=(W.ranged||2)+eA*0.8;        // arrows answer the spear (1.8x)
  W.melee=(W.melee||2)+(eR+eS)*0.8;     // swords run down archers, dismantle engines
  W.cavalry=(W.cavalry||2)+eR*0.6+eM*0.5; // the horse tramples bow and blade
  return W;
}
function directorThink(D){
  manageBands(D);
  const team=D.team, P=PERSONALITIES[D.pers]||PERSONALITIES.expand, DF=AI_DIFF[diffFor(team)]||AI_DIFF.normal;
  const ag=teamAge[team];
  // --- the scouts read the enemy marshal's doctrine (~45s in) ---
  if(!D.annT&&T>45){
    D.annT=1;
    const mine=team===MYTEAM;
    msg(mine?("⚑ Your marshal's doctrine — "+P.name.toUpperCase()+": "+P.flavor+".")
            :("Scouts report: the "+TEAMNAME[team]+" marshal "+P.flavor+" — "+P.name.toUpperCase()+"."),
        mine?"blue":"warn");
    if(typeof NET!=="undefined"&&NET.mode==="host")
      NET.bcast({t:"note",m:"Scouts report: the "+TEAMNAME[team]+" marshal "+P.flavor+" — "+P.name.toUpperCase()+".",tone:"gold"});
  }
  // --- advance the age when the doctrine allows ---
  const nxt=AGES[ag+1];
  if(nxt){
    let bufF=P.ageBufF*DF.buf, bufG=P.ageBufG*DF.buf;
    if(teamHasHuman(team)){bufF=Math.max(bufF,380);bufG=Math.max(bufG,150);} // an attentive human gets to press T first
    if(stock[team].food>=nxt.cost.food+bufF&&stock[team].gold>=(nxt.cost.gold||0)+bufG)startAgeResearch(team); // v107: AI pays and waits the same 90s
  }
  // --- construction desires (personality caps; expand keeps three crews busy) ---
  const sites=pendingBld(team);
  if(sites.length<(D.pers==="expand"?3:2)){
    let want=null;
    const barCap=T>240?2:1;
    const need=(type,cap,rf,rg)=>(BLD[type].age||0)<=ag&&countBld(team,type)<cap&&
      !sites.some(x=>x.type===type)&&affordKeep(team,BLD[type].cost,rf,rg);
    const farmCap=P.farmsBase+P.farmsPerAge*ag;
    if(need("barracks",barCap,0,0))want="barracks";
    else if(need("farm",farmCap,40,0)){
      const fs=findFarmSpot(team); // TC ring, pit rings, castle rings
      if(fs){pay(team,BLD.farm.cost);makeBuilding(team,"farm",fs.x,fs.z,false);}
      else if(need("storage_pit",P.pits,80,0)){ // no room for fields: plant a pit to anchor a NEW cluster
        const ps=findPitSpotForFarms(team);
        if(ps){pay(team,BLD.storage_pit.cost);makeBuilding(team,"storage_pit",ps.x,ps.z,false);}
      }
    }
    else if(need("archery_range",1,60,0))want="archery_range";
    else if(need("stable",1,80,20))want="stable";
    else if(need("blacksmith",1,60,0))want="blacksmith"; // v87: the forge rises at Iron — every human gets a place to spend XP
    else if(need("house",Math.min(P.houses,1+Math.floor(T/55)),120+ag*40,0))want="house";
    else if(need("temple",1,150,80))want="temple";
    else if(need("siege_workshop",1,180,120))want="siege_workshop";
    else if(need("watch_tower",2,80,0))want="watch_tower";
    else if(need("castle",P.castles,350,120))want="castle";
    else if(need("market",Math.min(P.markets,(ag>=5?5:ag>=4?3:1)),200,100))want="market";
    else if(need("tower",Math.min(P.towers,Math.floor(T/95)),150+ag*40,60))want="tower";
    if(want){
      const s=findSpot(team,want);
      if(s){pay(team,BLD[want].cost);makeBuilding(team,want,s.x,s.z,false);}
    }
  }
  // --- v94 TURTLE: a wall line rises across the front, with a gate on the road ---
  if(P.walls&&ag>=2&&!D.wallsDone&&pendingBld(team).length<3){
    const wt=ag>=4?"fort_wall":ag>=3?"stone_wall":"wood_wall";
    const gt=ag>=4?"fort_gate":ag>=3?"stone_gate":"wood_gate";
    if(!D.wallPlan){ // one straight curtain facing the enemy (30 paces out; farther if the town swallowed it)
      const tc=TCPOS[team], front=tc[0]+(team===BLUE?1:-1)*(D.wallFront||30);
      D.wallPlan=wallLineSegments(wt,front,tc[1]-48,front,tc[1]+48).slice(0,P.walls);
      D.wallPlaced=0;
    }
    if(D.wallPlaced<D.wallPlan.length){
      const s=D.wallPlan[D.wallPlaced];
      if(affordKeep(team,BLD[wt].cost,60,0)&&validFor(wt,s.x,s.z,team)){
        pay(team,BLD[wt].cost);
        makeBuilding(team,wt,s.x,s.z,false,s.rot);
        D.wallPlaced++;
      }else if(!validFor(wt,s.x,s.z,team))D.wallPlaced++; // blocked ground: skip the segment
    }else{
      const anyWall=buildings.some(b=>b.team===team&&b.alive&&b.def.wall&&!b.def.gate);
      if(!anyWall&&!D.wallRetry){ // the whole line was inside the town: step 14 paces farther out, once
        D.wallRetry=1; D.wallFront=(D.wallFront||30)+14; D.wallPlan=null;
      }else{ // the curtain stands: set the gate into the segment nearest the Kings Road
        let g=null,gd=1e12;
        for(const b of buildings){
          if(b.team!==team||!b.alive||!b.built||!b.def.wall||b.def.gate)continue;
          const d=Math.abs(b.z-6); // the road runs ~z 6 at the wall line
          if(d<gd){gd=d;g=b;}
        }
        if(g&&affordKeep(team,BLD[gt].cost,0,0)){pay(team,BLD[gt].cost);placeGateOnWall(g,gt,team);D.wallsDone=true;}
        else if(!g)D.wallsDone=true; // hostile ground everywhere, twice over: stand down
      }
    }
  }
  // --- a storage pit rises wherever the haul has grown long ---
  if(pendingBld(team).length<2&&countBld(team,"storage_pit")<Math.max(3,P.pits)&&affordKeep(team,BLD.storage_pit.cost,0,0)){
    const tc=TCPOS[team];
    for(const u of units){
      if(!u.alive||u.team!==team||u.cls!=="villager"||!u.bot||!u.bot.node)continue;
      const n=u.bot.node;
      if(dist2(n.x,n.z,tc[0],tc[1])<55*55)continue; // close enough to walk
      let covered=false;
      for(const bl of buildings)
        if(bl.alive&&bl.team===team&&(bl.type==="storage_pit"||bl.type==="castle"||bl.type==="towncenter")&&
           dist2(n.x,n.z,bl.x,bl.z)<30*30){covered=true;break;}
      if(covered)continue;
      const s=findSpotNear(team,"storage_pit",n.x,n.z);
      if(s){pay(team,BLD.storage_pit.cost);makeBuilding(team,"storage_pit",s.x,s.z,false);}
      break;
    }
  }
  // --- crew the construction sites (2 builders each) ---
  for(const s of pendingBld(team)){
    let crew=0;
    for(const u of units)if(u.alive&&u.task&&u.task.site===s)crew++;
    while(crew<2){const c=idleCitizen(team);if(!c)break;c.task={site:s};crew++;}
  }
  // --- train soldiers from the shared stockpile (doctrine sets the mix & the tempo) ---
  if(T>D.nextConv&&countBld(team,"barracks")>0){
    D.nextConv=T+(P.trainMin+Math.random()*(P.trainMax-P.trainMin))*DF.trainMul;
    const pool=[];
    let priests=0;
    for(const u of units)if(u.alive&&u.team===team&&CLS[u.cls].line==="healer")priests++;
    let siegeAlive=0;
    for(const u of units)if(u.alive&&u.team===team&&isSiege(u.cls))siegeAlive++;
    let W=Object.assign({melee:3,anticav:3,ranged:3,cavalry:3,scoutline:1},P.trainW||{});
    if(DF.counter)W=counterWeights(team,W); // HARD reads the field and counters it
    W.healer=priests<2?1:0;
    W.meleesiege=siegeAlive<4?(W.meleesiege!==undefined?W.meleesiege:1):0;
    W.rangedsiege=siegeAlive<4?(W.rangedsiege!==undefined?W.rangedsiege:2):0;
    for(const type of TRAIN_BUILDINGS){
      if(!countBld(team,type))continue;
      for(const line of linesAt(type,team)){
        const uid=lineUnitFor(line,team);
        if(uid)for(let i=0;i<Math.round(W[line]||0);i++)pool.push({uid,at:type});
      }
    }
    if(pool.length){
      const pick=pool[(Math.random()*pool.length)|0], cls=pick.uid, cost=CLS[cls].cost;
      let vills=0;
      for(const u of units)if(u.alive&&u.team===team&&!u.isKing&&u.cls==="villager")vills++;
      // reserves scale with age AND doctrine — rush spends to the felt, boom banks the next age
      if(vills>P.minVills&&affordKeep(team,cost,P.reserveF+ag*40*DF.buf,P.reserveG+ag*15*DF.buf)){
        const c=idleCitizen(team);
        if(c){pay(team,cost);c.convertTo=cls;c.convertAt=pick.at;}
      }
    }
  }
  // --- markets dispatch trade carts (cap: 2 alive per market) ---
  for(const b of buildings){
    if(!b.alive||!b.built||b.team!==team||b.type!=="market")continue;
    b.cartT=(b.cartT===undefined?150:b.cartT+1);
    if(b.cartT>=180){
      let carts=0;
      for(const u of units)if(u.alive&&u.bot&&u.bot.role==="cart"&&u.bot.home===b)carts++;
      if(carts<2){
        b.cartT=0;
        makeUnit(team,"tradecart",b.x+9,b.z+5,{name:"Trade Cart",bot:{role:"cart",home:b}});
        if(team===BLUE)msg("A trade cart sets out from your Market.","blue");
      }else b.cartT=175; // wait for a slot to free up
    }
  }
  // --- raid waves: the doctrine sets when, how many, and how often ---
  const mil=units.filter(u=>u.alive&&u.team===team&&u.bot&&!u.isKing&&u.cls!=="villager");
  if(T>D.nextRaid&&mil.length>=P.raidMin){
    D.nextRaid=T+(P.raidEvery+Math.random()*P.raidJit)*DF.raidMul;
    D.raidUntil=T+55;
    const frac=Math.min(0.95,P.raidFrac*DF.raidFracMul);
    const party=mil.slice(0,Math.max(Math.min(P.raidMin,mil.length),Math.floor(mil.length*frac)));
    party.forEach(u=>u.raiding=true);
    if(team===RED)msg("⚠ RED ARMY ON THE MARCH — "+party.length+" raiders inbound!","warn");
    else msg("⚑ Your army marches on the Red base — "+party.length+" strong! (G to join the push)","blue");
  }
  if(D.raidUntil&&T>D.raidUntil){
    D.raidUntil=0;
    for(const u of units)if(u.team===team)u.raiding=false;
  }
}

// ---------- bot AI ----------
function nearestEnemyOf(u,maxD){
  let best=null,bd=(maxD||1e4)*(maxD||1e4);
  for(const v of units){
    if(v.team===u.team||!v.alive)continue;
    const d=dist2(u.root.position.x,u.root.position.z,v.root.position.x,v.root.position.z);
    if(d<bd){bd=d;best=v;}
  }
  return best;
}
function botFindNode(u,res){
  let best=null,bd=1e12;
  for(const n of nodes){
    if(n.amount<=0||n.type!==res)continue;
    const homeBias=(u.team===BLUE?(n.x<0?0:12000):(n.x>0?0:12000));
    let crowd=0;
    for(const q of units)if(q.alive&&q.bot&&q.bot.node===n)crowd++;
    const d=dist2(u.root.position.x,u.root.position.z,n.x,n.z)+homeBias+crowd*crowd*450;
    if(d<bd){bd=d;best=n;}
  }
  return best;
}
// ---------- THE CHARGE (v80): F converts a rally into an attack-move wave ----------
const CHARGE_DIST=85; // how far F hurls the rallied line down the commander's gaze (a dial)
function orderCharge(commander,yaw){
  // v95 PERSONAL WARBANDS: F hurls only the soldiers rallied by THIS commander
  const mil=units.filter(v=>v.alive&&v.team===commander.team&&v.bot&&!v.isKing&&!v.remote&&v.rally&&(v.rallyBy===commander||!v.rallyBy)&&v.cls!=="villager");
  if(!mil.length)return 0;
  const fx=-Math.sin(yaw),fz=-Math.cos(yaw);
  const sx=commander.root.position.x,sz=commander.root.position.z;
  let tx=sx,tz=sz;
  for(let d=CHARGE_DIST;d>=8;d-=4){ // farthest legal point along the gaze: any walkable ground (fringe and camps included)
    const cx2=sx+fx*d,cz2=sz+fz*d;
    if(walkable(cx2,cz2)){tx=cx2;tz=cz2;break;}
  }
  for(const v of mil)v.chargeTo={x:tx,z:tz};
  // v109 THE VOICES: the warband roars as it storms — a ragged 2-3 voice chorus from the
  // commander's position, host-local + relayed so every client (both teams) hears it coming
  if(typeof Sound!=="undefined"&&Sound.voxChorus)Sound.voxChorus(sx,sz);
  if(typeof NET!=="undefined"&&NET.mode==="host")NET.bcast({t:"snd",k:"__chorus",x:sx,z:sz});
  return mil.length;
}
function engageNearest(u,dt,leash){
  const e=nearestEnemyOf(u,leash||18);
  if(!e)return false;
  const d=dist(u,e);
  const want=u.ranged?u.rng-3:u.rng-0.4;
  if(d>want)moveToward(u,e.root.position.x,e.root.position.z,dt,want);
  else u.facing=Math.atan2(e.root.position.x-u.root.position.x,e.root.position.z-u.root.position.z);
  tryAttack(u);
  return true;
}
// ==================== v113 THE FLANKING LANES ====================
// Every battle used to happen on the King's Road — because the road IS the straight line
// between the two thrones, and every band walked exactly that line (John's field note).
// Each band now holds an APPROACH LANE: a z-corridor it runs down until it's within
// LANE_TURNIN of the objective's x, then it turns in and commits. Armies converge on a base
// from the north field, the south field and the map perimeter instead of one funnel.
// The lanes ROTATE, so a defender can't learn one axis and camp it.
const LANE_Z=[0,46,-46,88,-88];  // road · near flanks · deep perimeter (MAP.z half-extent is 125,
                                 // and the creep pockets all sit BEYOND 117 — 88 stays clear of them)
const LANE_TURNIN=62;            // inside this much x of the objective, stop sweeping and drive in
const LANE_EDGE=MAP.z-10;        // never steer into the border fringe
function laneFor(u){
  const bd=u.bandRef;
  if(bd&&bd.laneZ!==undefined)return bd.laneZ;
  return LANE_Z[(u.id||0)%LANE_Z.length]; // loose raiders with no band still fan out, by id
}
function laneTarget(u,tx,tz){ // where this unit should be heading RIGHT NOW to flank (x,z,lane)
  const L=laneFor(u);
  if(!L)return {x:tx,z:tz,lane:false};                       // this band takes the road
  const px=u.root.position.x,pz=u.root.position.z;
  if(Math.abs(px-tx)<LANE_TURNIN)return {x:tx,z:tz,lane:false}; // close enough — turn in
  const zc=Math.max(-LANE_EDGE,Math.min(LANE_EDGE,tz+L));
  if(Math.abs(pz-zc)<10)return {x:tx,z:zc,lane:true};        // ON the lane: run it down
  return {x:px+(tx-px)*0.35,z:zc,lane:true};                 // still cutting out to it
}
function assignLane(D,bd){ // deal the next lane; the two armies start on opposite hands
  D._laneN=(D._laneN||0)+1;
  const order=(D.team===BLUE)?[46,-46,88,0,-88]:[-46,46,-88,0,88];
  const base=order[D._laneN%order.length];
  bd.laneZ=base?base+((bd.id%7)-3)*3:0; // jitter the flanks so two bands never stack; the road stays the road
  bd.laneUntil=T+45+(bd.id%5)*9;
}
function raidEnemyBase(u,dt){
  if(!engageNearest(u,dt,17)){
    const etc=TCPOS[1-u.team];
    const _gx=etc[0]+(u.team===BLUE?12:-12);
    const _ap=laneTarget(u,_gx,etc[1]); // v113: swing wide down the lane before turning in
    if(_ap.lane){moveToward(u,_ap.x+u.spread*0.4,_ap.z+u.spread*0.6,dt,6);return;}
    if(moveToward(u,_gx+u.spread*0.4,etc[1]+u.spread,dt,9)){
      let bb=null,bd=1e9;
      for(const bl of buildings){
        if(bl.team===u.team||!bl.alive)continue;
        const d=dist2(u.root.position.x,u.root.position.z,bl.x,bl.z);
        if(d<bd){bd=d;bb=bl;}
      }
      if(bb&&CLS[u.cls].line==="scoutline"){ // trampling scouts hunt FARMS first
        let bf=null,bfd=1e9;
        for(const bl of buildings){
          if(bl.team===u.team||!bl.alive||bl.type!=="farm")continue;
          const d=dist2(u.root.position.x,u.root.position.z,bl.x,bl.z);
          if(d<bfd){bfd=d;bf=bl;}
        }
        if(bf)bb=bf;
      }
      if(bb){moveToward(u,bb.x,bb.z,dt,u.rng+bb.def.r-0.6);tryAttack(u);}
    }
  }
}
// ==================== WARBANDS: the coordination layer ====================
// Every soldier belongs to a band of ~7 with a mission. The kingsguard always
// exists; the rest patrol, raid the enemy economy, hunt the enemy king, hold
// key ground, or escort the siege train. Threat at the throne recalls them.
let BAND_ID=0;
function bandTargetEcon(team){ // juiciest target: carts and working villagers, then economy buildings
  const et=1-team; let best=null,bd=1e12;
  for(const v of units){
    if(!v.alive||v.team!==et)continue;
    const cart=v.bot&&v.bot.role==="cart";
    const vil=v.cls==="villager"&&dist2(v.root.position.x,v.root.position.z,TCPOS[et][0],TCPOS[et][1])>26*26;
    if(!cart&&!vil)continue;
    const d=dist2(v.root.position.x,v.root.position.z,TCPOS[team][0],TCPOS[team][1]);
    if(d<bd){bd=d;best=v;}
  }
  if(best)return {unit:best};
  let bb=null; bd=1e12;
  for(const bl of buildings){
    if(!bl.alive||bl.team!==et)continue;
    if(bl.type!=="market"&&bl.type!=="farm"&&bl.type!=="storage_pit")continue;
    const d=dist2(bl.x,bl.z,TCPOS[team][0],TCPOS[team][1]);
    if(d<bd){bd=d;bb=bl;}
  }
  return bb?{bld:bb}:null;
}
// v113: how long a hold band stands its ground, and what counts as "nothing is happening here"
const HOLD_TOUR=45, HOLD_QUIET=18, HOLD_WATCH=48;
function bandHoldPoint(team,idx){ // castles first, then denying a bazaar, then the road
  const own=buildings.filter(b=>b.alive&&b.built&&b.team===team&&b.type==="castle");
  if(own.length){const c=own[idx%own.length];return {x:c.x+4,z:c.z+4,why:"castle"};}
  if(neutralMarkets.length){const m=neutralMarkets[idx%neutralMarkets.length];return {x:m.x+3,z:m.z+3,why:"bazaar"};}
  const tc=TCPOS[team],et=TCPOS[1-team];
  return {x:tc[0]+(et[0]-tc[0])*0.35,z:tc[1]+(et[1]-tc[1])*0.35,why:"road"};
}
function manageBands(D){
  const team=D.team;
  D.bands=D.bands||[];
  for(const bd of D.bands) // prune the dead, the possessed, the re-classed
    bd.members=bd.members.filter(v=>v.alive&&!v.remote&&v.team===team&&v.bot&&!v.isKing&&
      v.cls!=="villager"&&v.bot.role!=="cart"&&CLS[v.cls].line!=="healer"&&v.bandRef===bd);
  D.bands=D.bands.filter(bd=>bd.members.length>0||bd.role==="kingsguard");
  const roster=[];
  for(const v of units){
    if(!v.alive||v.team!==team||!v.bot||v.isKing||v.remote)continue;
    if(v.cls==="villager"||v.bot.role==="cart"||CLS[v.cls].line==="healer")continue;
    if(!v.bandRef||!D.bands.includes(v.bandRef))roster.push(v);
  }
  // --- threat at the throne ---
  const k=kings[team]; let threat=0;
  for(const e of units){
    if(!e.alive||e.team===team||e.cls==="villager")continue;
    const d=Math.sqrt(dist2(e.root.position.x,e.root.position.z,k.root.position.x,k.root.position.z));
    if(d<42)threat+=(42-d)/42;
  }
  threat+=(1-k.hp/Math.max(1,k.maxHp))*3;
  D.threat=threat;
  // --- the kingsguard fills first and grows with the danger ---
  let kg=D.bands.find(b=>b.role==="kingsguard");
  if(!kg){kg={id:BAND_ID++,role:"kingsguard",members:[]};D.bands.push(kg);}
  const PB=PERSONALITIES[D.pers]||PERSONALITIES.expand; // v94: the doctrine staffs the guard
  const kgNeed=Math.min(14,(PB.kgBase||6)+Math.floor(threat*1.5));
  while(kg.members.length<kgNeed&&roster.length){const v=roster.pop();v.bandRef=kg;kg.members.push(v);}
  while(kg.members.length>kgNeed){ // peace releases the surplus to the war effort
    const v=kg.members.pop(); v.bandRef=null; roster.push(v);
  }
  // --- the siege train: engines plus an escort ---
  const looseSiege=roster.filter(v=>isSiege(v.cls));
  if(looseSiege.length){
    let st=D.bands.find(b=>b.role==="siege");
    if(!st){st={id:BAND_ID++,role:"siege",members:[]};D.bands.push(st);}
    for(const v of looseSiege){v.bandRef=st;st.members.push(v);roster.splice(roster.indexOf(v),1);}
    let esc=st.members.filter(v=>!isSiege(v.cls)).length;
    while(esc<4&&roster.length){const v=roster.shift();v.bandRef=st;st.members.push(v);esc++;}
  }
  // --- deal the rest into mission bands of ~7, line-sorted for mixed company ---
  if(roster.length>=5){
    roster.sort((a,b)=>CLS[a.cls].line<CLS[b.cls].line?-1:1);
    const wantRoles=["patrol","econ","hold"];
    for(let i=0;i<(PB.econHunters||0);i++)wantRoles.push("econ"); // rush lives on dead supply chains
    if(roster.length>=20||D.raidUntil||((PB.assassins||0)&&roster.length>=10))wantRoles.push("assassin");
    while(roster.length>=5){
      // found the mission we're SHORTEST on — a persistent, self-balancing rotation
      let role=wantRoles[0],least=1e9;
      for(const r of wantRoles){
        const n=D.bands.filter(b=>b.role===r).length;
        if(n<least){least=n;role=r;}
      }
      const size=Math.min(roster.length,7);
      let bd=D.bands.find(b=>b.role===role&&b.members.length<5);
      if(!bd){bd={id:BAND_ID++,role,members:[]};D.bands.push(bd);}
      for(let i=0;i<size;i++){const v=(i%2?roster.pop():roster.shift());v.bandRef=bd;bd.members.push(v);}
    }
  }
  for(const v of roster){ // stragglers reinforce the weakest mission band, not the throne
    let bd=null,bs=99;
    for(const b of D.bands)
      if(b.role!=="kingsguard"&&b.role!=="siege"&&b.members.length<8&&b.members.length<bs){bs=b.members.length;bd=b;}
    if(!bd)bd=kg;
    v.bandRef=bd; bd.members.push(v);
  }
  // --- mission control ---
  D.rolesSeen=D.rolesSeen||{};
  const side=team===BLUE?1:-1; let hi=0;
  for(const bd of D.bands){
    D.rolesSeen[bd.role]=1;
    bd.defend=threat>4.5; // the palace burns: everyone home
    if(bd.laneZ===undefined||T>(bd.laneUntil||0))assignLane(D,bd); // v113: fresh approach lane, rotated
    if(bd.role==="econ"&&(!bd.target||(bd.target.unit&&!bd.target.unit.alive)||(bd.target.bld&&!bd.target.bld.alive)))
      bd.target=bandTargetEcon(team);
    if(bd.role==="hold"){
      // v113 A POSTING IS NOT A CAREER. A hold band used to stand on its bazaar for the rest
      // of the match doing nothing (John: "AI units huddled up around the nearest bazaar").
      // It now serves a TOUR: once the ground has been quiet for HOLD_QUIET seconds and the
      // tour has run out, the band is relieved and takes whatever mission the army is
      // shortest on. Contact resets the clock, so a bazaar actually under threat is still held.
      bd.point=bandHoldPoint(team,hi++);
      if(bd.holdUntil===undefined){bd.holdUntil=T+HOLD_TOUR;bd.lastContact=T;}
      let cx=0,cz=0,cn=0;
      for(const v of bd.members){cx+=v.root.position.x;cz+=v.root.position.z;cn++;}
      if(cn){
        cx/=cn;cz/=cn;
        for(const e of units){ // only the ENEMY ARMY holds a posting — a nearby wild camp is
          // scenery, and letting creeps reset the clock is exactly how a band ends up parked forever
          if(!e.alive||e.team===team||e.team===NEUTRAL||e.cls==="villager")continue;
          if(dist2(e.root.position.x,e.root.position.z,cx,cz)<HOLD_WATCH*HOLD_WATCH){bd.lastContact=T;break;}
        }
      }
      if(T>bd.holdUntil&&T-(bd.lastContact||0)>HOLD_QUIET){ // relieved — march on
        let role="econ",least=1e9;
        for(const r of ["econ","patrol","assassin"]){
          const n=D.bands.filter(b=>b.role===r).length;
          if(n<least){least=n;role=r;}
        }
        bd.role=role; bd.point=null; bd.wps=null; bd.holdUntil=undefined; bd.target=null;
        assignLane(D,bd); // and it takes a NEW axis on the way out
      }
    }
    if(bd.role==="patrol"){
      if(!bd.wps){
        const tc=TCPOS[team];
        bd.wps=[{x:tc[0],z:tc[1]},{x:tc[0]+side*22,z:tc[1]+16},{x:tc[0]+side*4,z:tc[1]-24},{x:tc[0]+side*26,z:tc[1]-6}];
        bd.wi=0;
      }
      const wp=bd.wps[bd.wi]; let near=0;
      for(const v of bd.members)if(dist2(v.root.position.x,v.root.position.z,wp.x,wp.z)<10*10)near++;
      if(near>=bd.members.length*0.6)bd.wi=(bd.wi+1)%bd.wps.length;
    }
  }
  // --- a struck building calls the nearest patrol or hold band ---
  if(T-(D.lastAid||0)>6){
    for(const bl of buildings){
      if(bl.team!==team||!bl.alive||!bl.lastHit||T-bl.lastHit>5)continue;
      let best=null,bdd=1e12;
      for(const bd of D.bands){
        if(bd.role!=="patrol"&&bd.role!=="hold")continue;
        for(const v of bd.members){const d=dist2(v.root.position.x,v.root.position.z,bl.x,bl.z);if(d<bdd){bdd=d;best=bd;}}
      }
      if(best){best.aid={x:bl.x,z:bl.z,until:T+14};D.lastAid=T;}
      break;
    }
  }
  // --- a worker under attack screams: the fastest sabres ride to the rescue ---
  if(D.distress&&T<D.distress.until&&T-(D.lastRescue||0)>8){
    let best=null,bs=-1e15;
    for(const bd of D.bands){
      if(bd.role==="kingsguard"||bd.role==="siege")continue;
      let mounted=0,cx=0,cz=0,n=0;
      for(const v of bd.members){if(CLS[v.cls].mounted)mounted++;cx+=v.root.position.x;cz+=v.root.position.z;n++;}
      if(!n)continue;
      const d=Math.sqrt(dist2(cx/n,cz/n,D.distress.x,D.distress.z));
      const score=mounted*400-d; // cavalry first, then whoever is closest
      if(score>bs){bs=score;best=bd;}
    }
    if(best){
      best.aid={x:D.distress.x,z:D.distress.z,until:T+14};
      D.lastRescue=T; D.distress=null;
      if(team===RED)msg("Red riders wheel toward their workers…","gold");
      else msg("⚑ A band rides to defend your villagers!","blue");
    }
  }
  // --- overwhelmed at the Town Center: the villagers themselves take up arms ---
  const tcL=teamTC(team);
  if(tcL){
    let foes=0,defs=0;
    for(const e of units){
      if(!e.alive||e.cls==="villager"||e.isKing)continue;
      if(dist2(e.root.position.x,e.root.position.z,tcL.x,tcL.z)<34*34){
        if(e.team!==team)foes++; else defs++;
      }
    }
    if(foes>=3&&foes>defs+2&&T-(D.lastLevy||0)>10){
      const levyCls=lineUnitFor("melee",team)||"clubman";
      let levied=0, already=units.filter(v=>v.alive&&v.team===team&&v._levy).length;
      for(const v of units){
        if(already+levied>=6)break; // a militia, not the whole workforce
        if(!v.alive||v.team!==team||v.cls!=="villager"||!v.bot||v.remote||v.isPlayer||v.isKing)continue;
        if(dist2(v.root.position.x,v.root.position.z,tcL.x,tcL.z)>45*45)continue;
        setClass(v,levyCls); v._levy=true; v._levyClear=T; levied++;
      }
      if(levied>0){
        D.lastLevy=T;
        msg(team===BLUE?"⚔ Your villagers take up arms to defend the Town Center!"
                       :"The Red villagers arm themselves to hold their Town Center!",
            team===BLUE?"blue":"red");
      }
    }
    // stand down: ten quiet seconds and the militia returns to the fields
    for(const v of units){
      if(!v._levy||!v.alive||v.team!==team)continue;
      if(foes>0)v._levyClear=T;
      else if(T-(v._levyClear||0)>10){
        setClass(v,"villager"); v._levy=false; v.bandRef=null;
      }
    }
  }
}
function nearestDropoff(u){ // the closest place to bank a load
  const px=u.root.position.x,pz=u.root.position.z;
  let best=teamTC(u.team), bd=best?dist2(px,pz,best.x,best.z):1e12;
  for(const b of buildings){
    if(b.team!==u.team||!b.alive||!b.built)continue;
    if(b.type!=="storage_pit"&&b.type!=="castle")continue;
    const d=dist2(px,pz,b.x,b.z);
    if(d<bd){bd=d;best=b;}
  }
  return best;
}
function nearestNeutral(x,z){
  let best=null,bd=1e12;
  for(const m of neutralMarkets){const d=dist2(x,z,m.x,m.z);if(d<bd){bd=d;best=m;}}
  return best;
}
function updateBot(u,dt){
  if(u.remote)return; // a human wears this body — driveRemote owns it
  const b=u.bot;
  if(b.role==="creep")return updateCreep(u,dt); // the wilds answer to no director
  // TRADE CARTS: out to the bazaar, trade, haul the gold home — rain or raiders
  if(b.role==="cart"){
    const home=b.home;
    if(!home||!home.alive)return; // market burned: the cart is stranded
    if(!u.tradeTarget){u.tradeTarget=nearestNeutral(home.x,home.z);u.tradePhase="out";}
    if(u.tradePhase==="out"){
      if(moveToward(u,u.tradeTarget.x,u.tradeTarget.z,dt,3.2)){u.tradePhase="trading";u.tradeT=2;}
    }else if(u.tradePhase==="trading"){
      u.tradeT-=dt;
      if(u.tradeT<=0){u.tradePhase="back"; // v104: cart finished loading at the bazaar
        if(typeof Sound!=="undefined"&&u.team===MYTEAM)Sound.play("bazaarload",{x:u.root.position.x,z:u.root.position.z});
        if(typeof NET!=="undefined"&&NET.mode==="host"&&typeof teamHasHuman==="function"&&teamHasHuman(u.team))NET.bcast({t:"snd",k:"bazaarload",team:u.team,x:u.root.position.x,z:u.root.position.z});}
    }else{
      if(moveToward(u,home.x+home.def.r+2,home.z,dt,home.def.r*0.5+2.5)){
        const d=Math.hypot(home.x-u.tradeTarget.x,home.z-u.tradeTarget.z);
        const g=tradeGold(d);
        stock[u.team].gold+=g;
        if(typeof Sound!=="undefined"&&u.team===MYTEAM)Sound.play("tradepay",{x:u.root.position.x,z:u.root.position.z}); // v104: cart delivers gold
        if(typeof NET!=="undefined"&&NET.mode==="host"&&typeof teamHasHuman==="function"&&teamHasHuman(u.team))NET.bcast({t:"snd",k:"tradepay",team:u.team,x:u.root.position.x,z:u.root.position.z});
        if(u.team===BLUE){updateResHud();msg("Trade cart returned: +"+g+" gold.","blue");}
        u.tradePhase="out";u.tradeTarget=nearestNeutral(home.x,home.z);
      }
    }
    return;
  }
  // KING: hover the throne, flee attackers, swing when cornered
  if(b.role==="king"){
    const tc=teamTC(u.team);
    const hx=tc?tc.x:TCPOS[u.team][0],hz=tc?tc.z:TCPOS[u.team][1];
    const e=nearestEnemyOf(u,16);
    if(e){
      if(dist(u,e)<3)tryAttack(u);
      const fx=hx+(hx-e.root.position.x)*0.35,fz=hz+(hz-e.root.position.z)*0.35;
      moveToward(u,Math.max(-MAP.x,Math.min(MAP.x,fx)),Math.max(-MAP.z,Math.min(MAP.z,fz)),dt,1);
    }else{
      if(!b.wt||T>b.wt){b.wt=T+3+Math.random()*3;b.wx=hx+(Math.random()-0.5)*10;b.wz=hz+(Math.random()-0.5)*10;}
      moveToward(u,b.wx,b.wz,dt,0.8);
    }
    return;
  }
  // CITIZENS
  if(u.cls==="villager"){
    const threat=nearestEnemyOf(u,9);
    if(threat){ // scatter AWAY from the attacker with a homeward drift — no more conga lines
      const tc=TCPOS[u.team];
      let fx=u.root.position.x-threat.root.position.x, fz=u.root.position.z-threat.root.position.z;
      const fl=Math.hypot(fx,fz)||1; fx/=fl; fz/=fl;
      fx+=(tc[0]-u.root.position.x)*0.004+Math.sin(u.id*7.3)*0.35;
      fz+=(tc[1]-u.root.position.z)*0.004+Math.cos(u.id*5.1)*0.35;
      moveUnit(u,fx,fz,dt);
      return;
    }
    if(u.convertTo){
      const bar=nearestBuilt(u.team,u.convertAt||"barracks",u.root.position.x,u.root.position.z);
      if(!bar){ // barracks fell: refund the team
        stock[u.team].food+=CLS[u.convertTo].cost.food||0;
        stock[u.team].gold+=CLS[u.convertTo].cost.gold||0;
        if(u.team===BLUE)updateResHud();
        u.convertTo=null;return;
      }
      if(moveToward(u,bar.x+3,bar.z+3,dt,4)){
        setClass(u,u.convertTo);u.convertTo=null;u.convertAt=null;
        if(u.team===BLUE&&Math.random()<0.4&&dist(u,player)<50)
          msg(u.name+" armed up as a "+CLS[u.cls].name+".","blue");
      }
      return;
    }
    if(u.task){
      const s=u.task.site;
      if(!s.alive||s.built){u.task=null;return;}
      // stand at the NEAREST point of the site's ring, from whichever side we came —
      // a fixed east-side stand point sat OFF THE MAP for red's border-town sites
      const rdx=u.root.position.x-s.x, rdz=u.root.position.z-s.z, rl=Math.hypot(rdx,rdz)||1;
      const standX=s.x+rdx/rl*(s.def.r+0.9), standZ=s.z+rdz/rl*(s.def.r+0.9);
      if(moveToward(u,standX,standZ,dt,1.3)){
        u.facing=Math.atan2(s.x-u.root.position.x,s.z-u.root.position.z);
        u.buildT=(u.buildT||0)+dt;
        if(u.buildT>0.5){u.buildT=0;addConstructionHit(s,u);}
      }
      return;
    }
    // gather — but ripe corn beats berry-picking
    if(b.res==="food"){
      let rf=null,rd=40*40;
      for(const f of buildings){
        if(f.team!==u.team||!f.alive||!f.built||f.type!=="farm"||!(f.crop>=1))continue;
        const d=dist2(u.root.position.x,u.root.position.z,f.x,f.z);
        if(d<rd){rd=d;rf=f;}
      }
      if(rf){
        if(moveToward(u,rf.x+1.5,rf.z+1,dt,rf.def.r-1.5)&&rf.crop>=1){
          rf.crop=0;
          if(rf.cropMesh){rf.cropMesh.scale.y=0.15;for(const t of rf.tassels)t.visible=false;}
          stock[u.team].food+=20;
          if(u.team===BLUE)updateResHud();
        }
        return;
      }
    }
    // gather
    if(!b.node||b.node.amount<=0){
      b.node=botFindNode(u,b.res);
      if(!b.node){b.res=b.res==="food"?"wood":b.res==="wood"?"gold":b.res==="gold"?"stone":"food";b.node=botFindNode(u,b.res);}
      if(!b.node)return; // the land is bare
      b.off={x:(Math.random()-0.5)*3.5,z:(Math.random()-0.5)*3.5};
    }
    // hands full? haul the load home — no more telepathic deposits
    const ctot=u.carry.food+u.carry.gold+u.carry.stone+u.carry.wood;
    if(b.haul||ctot>=20){
      b.haul=true;
      const dp=nearestDropoff(u);
      if(!dp)return;
      if(moveToward(u,dp.x+2.5,dp.z+2,dt,dp.type==="towncenter"?9:6.5)){
        stock[u.team].food+=u.carry.food; stock[u.team].gold+=u.carry.gold;
        stock[u.team].stone+=u.carry.stone; stock[u.team].wood+=u.carry.wood;
        u.carry.food=0;u.carry.gold=0;u.carry.stone=0;u.carry.wood=0;
        if(u.team===BLUE)updateResHud();
        b.haul=false;
      }
      return;
    }
    if(moveToward(u,b.node.x+b.off.x,b.node.z+b.off.z,dt,0.9)){
      u.facing=Math.atan2(b.node.x-u.root.position.x,b.node.z-u.root.position.z);
      b.gT=(b.gT||0)+dt;
      if(b.gT>0.75*(b.node.slow||1)){
        b.gT=0;b.node.amount--;
        u.carry[b.node.type]++;
        u.swing=0.2;
        if(b.node.amount<=0){depleteNode(b.node);b.node=null;}
      }
    }
    return;
  }
  // PRIESTS: stay with the group; on a CHARGE they advance behind the line to mend it
  if(CLS[u.cls].line==="healer"){
    if(u.chargeTo&&u.rally){
      moveToward(u,u.chargeTo.x+(u.spread||0)*0.3,u.chargeTo.z+(u.spread||0)*0.3,dt,6);
      return;
    }
    {const ld=u.rally?rallyLeaderFor(u):null; // v95: follow YOUR leader, not whoever blew a horn last
    if(ld){
      if(dist(u,ld)>6)moveToward(u,ld.root.position.x+u.spread*0.2,ld.root.position.z+u.spread*0.2,dt,5);
      return;
    }}
    const k0=kings[u.team];
    const gx=k0.root.position.x+Math.cos(u.guardA)*u.guardR;
    const gz=k0.root.position.z+Math.sin(u.guardA)*u.guardR;
    moveToward(u,gx,gz,dt,1.6);
    return;
  }
  // SIEGE ENGINES: bombard structures, creep with the army, never chase troops
  if(isSiege(u.cls)){
    if(u.raiding&&u.hp<u.maxHp*0.2)u.raiding=false;
    if(u.raiding){
      const etc=TCPOS[1-u.team];
      if(!tryAttack(u))
        moveToward(u,etc[0]+(u.team===BLUE?14:-14)+u.spread*0.5,etc[1]+u.spread,dt,
          CLS[u.cls].line==="meleesiege"?6:16);
      return;
    }
    const sbd=u.bandRef; // the siege train rolls on the enemy base, escorts in tow
    if(sbd&&sbd.role==="siege"&&!sbd.defend&&u.hp>u.maxHp*0.25){
      const etc=TCPOS[1-u.team];
      const _sg=etc[0]+(u.team===BLUE?14:-14);
      const _sa=laneTarget(u,_sg,etc[1]); // v113: the train rolls up its band's lane, not the road
      if(!tryAttack(u))
        moveToward(u,_sa.x+u.spread*0.5,_sa.z+u.spread,dt,
          _sa.lane?6:(CLS[u.cls].line==="meleesiege"?6:16));
      return;
    }
    if(u.chargeTo&&u.rally){ // siege rolls with the charge and bombards whatever it meets
      if(!tryAttack(u))moveToward(u,u.chargeTo.x+(u.spread||0)*0.4,u.chargeTo.z+(u.spread||0)*0.4,dt,7);
      return;
    }
    {const ld=u.rally?rallyLeaderFor(u):null; // v95: the siege train follows ITS leader
    if(ld){
      if(!tryAttack(u)&&dist(u,ld)>9)
        moveToward(u,ld.root.position.x+u.spread*0.3,ld.root.position.z+u.spread*0.3,dt,8);
      return;
    }}
    const k=kings[u.team];
    const gx=k.root.position.x+Math.cos(u.guardA)*(u.guardR+6);
    const gz=k.root.position.z+Math.sin(u.guardA)*(u.guardR+6);
    if(!tryAttack(u))moveToward(u,gx,gz,dt,2);
    return;
  }
  // MILITARY
  if(u.raiding&&u.hp<u.maxHp*0.25)u.raiding=false;
  if(u.raiding){raidEnemyBase(u,dt);return;}
  if(u.chargeTo&&u.rally){ // THE CHARGE: attack-move — savage everything on the way, then HOLD the far ground
    if(!engageNearest(u,dt,16)){
      const bb=nearestEnemyBuilding(u,12); // buildings in the path fall too
      if(bb){moveToward(u,bb.x,bb.z,dt,u.rng+bb.def.r-0.6);tryAttack(u);}
      else moveToward(u,u.chargeTo.x+(u.spread||0)*0.25,u.chargeTo.z+(u.spread||0)*0.25,dt,4);
    }
    return;
  }
  {const ld=u.rally?rallyLeaderFor(u):null; // v95: soldiers march under THEIR OWN banner
  if(ld){
    if(!engageNearest(u,dt,16)){
      if(dist(u,ld)>6)
        moveToward(u,ld.root.position.x+u.spread*0.25,ld.root.position.z+u.spread*0.25,dt,5);
    }
    return;
  }}
  // ---------------- WARBAND MISSIONS ----------------
  const bd=u.bandRef;
  if(bd&&bd.role!=="kingsguard"){
    const px=u.root.position.x,pz=u.root.position.z;
    if(bd.defend){ // the throne calls
      if(!engageNearest(u,dt,15)){
        const k=kings[u.team];
        moveToward(u,k.root.position.x+u.spread*0.4,k.root.position.z+u.spread*0.4,dt,5);
      }
      return;
    }
    if(bd.aid&&T<bd.aid.until){ // answer the burning farm
      if(!engageNearest(u,dt,16))moveToward(u,bd.aid.x+u.spread*0.3,bd.aid.z+u.spread*0.3,dt,3);
      return;
    }
    if(bd.role==="patrol"){
      const wp=bd.wps?bd.wps[bd.wi]:null;
      if(wp&&!engageNearest(u,dt,14))moveToward(u,wp.x+u.spread*0.35,wp.z+u.spread*0.35,dt,3);
      return;
    }
    if(bd.role==="hold"){
      const p=bd.point;
      if(p){
        if(dist2(px,pz,p.x,p.z)>24*24)moveToward(u,p.x+u.spread*0.3,p.z+u.spread*0.3,dt,3); // leash first
        else if(!engageNearest(u,dt,16))moveToward(u,p.x+u.spread*0.35,p.z+u.spread*0.35,dt,2.5);
      }
      return;
    }
    if(bd.role==="econ"){ // wolves among the sheep
      const t=bd.target;
      if(t&&t.unit&&t.unit.alive){
        if(!engageNearest(u,dt,10)){
          moveToward(u,t.unit.root.position.x+u.spread*0.2,t.unit.root.position.z+u.spread*0.2,dt,1.4);
          tryAttack(u);
        }
      }else if(t&&t.bld&&t.bld.alive){
        if(!engageNearest(u,dt,12)){moveToward(u,t.bld.x,t.bld.z,dt,u.rng+t.bld.def.r-0.6);tryAttack(u);}
      }else if(!engageNearest(u,dt,14)){ // between jobs: prowl the frontier — ON THIS BAND'S LANE
        const et=TCPOS[1-u.team], mx=(TCPOS[u.team][0]+et[0])/2, mz=(TCPOS[u.team][1]+et[1])/2;
        const _ez=Math.max(-LANE_EDGE,Math.min(LANE_EDGE,mz+laneFor(u))); // v113: the frontier is a LINE, not a point
        moveToward(u,mx+u.spread,_ez+u.spread,dt,7);
      }
      return;
    }
    if(bd.role==="assassin"){ // regicide is the whole game
      const ek=kings[1-u.team];
      if(ek&&ek.alive){
        if(dist(u,ek)<14){
          moveToward(u,ek.root.position.x+u.spread*0.15,ek.root.position.z+u.spread*0.15,dt,1.4);
          tryAttack(u);
        }else if(!engageNearest(u,dt,11)){
          const _ka=laneTarget(u,ek.root.position.x,ek.root.position.z); // v113: killers come in off the flank too
          moveToward(u,_ka.x+u.spread*0.25,_ka.z+u.spread*0.25,dt,_ka.lane?6:2.2);
        }
      }
      return;
    }
    if(bd.role==="siege"){ // escorts shepherd the engines
      let cx=0,cz=0,n=0;
      for(const v of bd.members)if(isSiege(v.cls)&&v.alive){cx+=v.root.position.x;cz+=v.root.position.z;n++;}
      if(n){
        cx/=n;cz/=n;
        if(dist2(px,pz,cx,cz)>10*10)moveToward(u,cx+u.spread*0.4,cz+u.spread*0.4,dt,4);
        else engageNearest(u,dt,16);
      }else if(!engageNearest(u,dt,16))raidEnemyBase(u,dt); // engines lost: fight on
      return;
    }
  }
  // defend the crown AND the town — one raider can no longer hold the base hostage
  const k=kings[u.team];
  const tc0=teamTC(u.team);
  let homeThreat=nearestEnemyOf(k,26);
  if(!homeThreat&&tc0){
    for(const v of units){
      if(v.team===u.team||!v.alive)continue;
      if(dist2(tc0.x,tc0.z,v.root.position.x,v.root.position.z)<30*30){homeThreat=v;break;}
    }
  }
  if(homeThreat){engageNearest(u,dt,70);return;}
  if(!engageNearest(u,dt,14)){
    const gx=k.root.position.x+Math.cos(u.guardA)*u.guardR;
    const gz=k.root.position.z+Math.sin(u.guardA)*u.guardR;
    moveToward(u,gx,gz,dt,1.6);
  }
}

// ---------- crowd separation ----------
function separate(){
  for(let i=0;i<units.length;i++){
    const a=units[i];if(!a.alive)continue;
    const aAnchor=a.isPlayer||a.remote; // player bodies are anchors: crowds part around THEM
    const ap=a.root.position;
    for(let j=i+1;j<units.length;j++){
      const c=units[j];if(!c.alive)continue;
      const cAnchor=c.isPlayer||c.remote;
      if(aAnchor&&cAnchor)continue; // two players may stand shoulder to shoulder
      const cp=c.root.position;
      const dx=cp.x-ap.x,dz=cp.z-ap.z,d2=dx*dx+dz*dz;
      if(d2<1.69&&d2>0.0001){
        const d=Math.sqrt(d2),push=(1.3-d)*0.4,px=dx/d*push,pz=dz/d*push;
        // an unpredictable host-side shove on a player's body IS the rubber band —
        // so the full push lands on the NPC instead
        if(aAnchor){cp.x+=px*1.5;cp.z+=pz*1.5;}
        else if(cAnchor){ap.x-=px*1.5;ap.z-=pz*1.5;}
        else{ap.x-=px;ap.z-=pz;cp.x+=px;cp.z+=pz;}
      }
    }
  }
}
function updateRoster(){
  let bv=0,bm=0,rv=0,rm=0;
  for(const u of units){
    if(!u.alive||u.isKing)continue;
    // v124: there are THREE teams. The old two-way ternary sent every NEUTRAL creep — 24 live
    // barbarians, wolves and vikings — into RED's column, and since no creep is a villager they
    // all landed on RED's military count. John's field shots showed a constant 73-vs-49 gap that
    // was exactly the wilds population. The wilds belong to nobody: count them for neither crown.
    if(u.team===BLUE){u.cls==="villager"?bv++:bm++;}
    else if(u.team===RED){u.cls==="villager"?rv++:rm++;}
  }
  document.getElementById("roster").innerHTML=
    "<span style='color:#3d6ef2'>■</span> ⛏ "+bv+" · ⚔ "+bm+" · "+AGES[teamAge[BLUE]].name.split(" ")[0].toUpperCase()+
    " &nbsp;&nbsp;<span style='color:#d94a3d'>■</span> ⛏ "+rv+" · ⚔ "+rm+" · "+AGES[teamAge[RED]].name.split(" ")[0].toUpperCase();
}
