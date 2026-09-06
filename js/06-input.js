/* REGICIDE PVP — 06-input.js */
// ---------- player input (pointer-lock mouse-look) ----------
const keys={};
// ---------- v124 TRUE ANALOG MOVEMENT ----------
// The stick used to synthesise w/a/s/d, which made movement 8-way: circling an enemy snapped to
// 45 degrees and there was no walking, only running. Both control schemes now feed ONE vector.
// Desktop fills it from the keys (magnitude always 1 — a key is pressed or it isn't); touch writes
// a real direction and deflection into it. moveUnit normalises what it is handed, so the magnitude
// has to ride the dt argument rather than the direction.
const moveVec={x:0,z:0,analog:false};
const MOVE_DEAD=0.16;   // thumb noise
const MOVE_FLOOR=0.42;  // below this a nudge would crawl uselessly — walk, don't shuffle
function readMove(){
  if(!moveVec.analog){
    let mx=0,mz=0;
    if(keys.w)mz-=1; if(keys.s)mz+=1; if(keys.a)mx-=1; if(keys.d)mx+=1;
    return {mx,mz,mag:(mx||mz)?1:0};
  }
  const L=Math.hypot(moveVec.x,moveVec.z);
  if(L<MOVE_DEAD)return {mx:0,mz:0,mag:0};
  const t=Math.min(1,(L-MOVE_DEAD)/(1-MOVE_DEAD));
  return {mx:moveVec.x,mz:moveVec.z,mag:MOVE_FLOOR+(1-MOVE_FLOOR)*t};
}
let placing=null, ghost=null;
let menuOpen=null;
let mouseLocked=false, lmbHeld=false, rmbHeld=false, aiming=false;
function releaseAllKeys(){ // a blurred window eats keyups — never trust held state across focus loss
  for(const k in keys)keys[k]=false;
  lmbHeld=false; rmbHeld=false;
}
addEventListener("blur",releaseAllKeys);
addEventListener("keydown",e=>{
  if(e.key==="Tab"){e.preventDefault();showScoreboard(true);}
});
addEventListener("keyup",e=>{
  if(e.key==="Tab"){e.preventDefault();showScoreboard(false);}
});
document.addEventListener("pointerlockchange",()=>{if(!document.pointerLockElement)releaseAllKeys();});
const canvasEl=renderer.domElement;

function lockMouse(){ if(!mouseLocked&&!gameOver){ try{canvasEl.requestPointerLock();}catch(e){} } }
canvasEl.addEventListener("click",()=>{ if(!menuOpen)lockMouse(); });
document.addEventListener("pointerlockchange",()=>{
  mouseLocked=document.pointerLockElement===canvasEl;
  document.getElementById("lockhint").style.display=(mouseLocked||gameOver||menuOpen)?"none":"block";
  document.getElementById("crosshair").style.display=mouseLocked?"block":"none";
  if(!mouseLocked){lmbHeld=false;rmbHeld=false;}
});
addEventListener("mousemove",e=>{
  if(!mouseLocked)return;
  camYaw-=e.movementX*0.0032;
  camPitch=Math.max(-0.35,Math.min(1.25,camPitch+e.movementY*0.0028)); // negative = look up
});
addEventListener("mousedown",e=>{
  if(e.button===0)lmbHeld=true;
  if(e.button===2){
    rmbHeld=true;
    if(mouseLocked&&!gameOver&&player.alive&&player.cls==="dragoon"&&!placing){
      if((player.ammo||0)<=0){msg("Pistol empty — six rounds a life. Re-arm at the Stable for fresh powder.");}
      else if(player.atkT<=0){
        const t=pistolTarget(player,15);
        if(t){
          if(typeof NET!=="undefined"&&NET.mode==="guest"){ // theatre now, host lands it
            player.ammo--;player.atkT=1.0;player.swing=0.25;triggerAttackAnim(player);
          }else pistolShot(player,t);
          updatePlayerHud();
        }else msg("No target in pistol range.");
      }
      return;
    }
  }
  if(!mouseLocked||gameOver||!player.alive)return;
  if(e.button===0){
    if(placing){confirmPlace();return;}
    playerPrimary();
  }
});
addEventListener("mouseup",e=>{
  if(e.button===0)lmbHeld=false;
  if(e.button===2)rmbHeld=false;
});
addEventListener("wheel",e=>{camDist=Math.max(8,Math.min(46,camDist+e.deltaY*0.02));},{passive:true});
addEventListener("contextmenu",e=>e.preventDefault());
addEventListener("resize",()=>{
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
  if(composer)composer.setSize(innerWidth,innerHeight);
  // v128.1: the outline width is measured in DEVICE pixels, so it has to be recomputed whenever
  // the drawing buffer changes — a rotate or a saver toggle otherwise leaves every line at the
  // old weight, and on a shrinking buffer that means no line at all.
  if(window.__syncInk)window.__syncInk();
});

function playerPrimary(){
  if(siegeAim){ // the stone flies to the mark
    if(player.atkT>0)return;
    if(typeof NET!=="undefined"&&NET.mode==="guest"){
      NET._pendingLob={x:lobTarget.x,z:lobTarget.z}; // rides the next input packet
      player.atkT=player.cd; player.swing=0.25; triggerAttackAnim(player);
      return;
    }
    launchLob(player,lobTarget.x,lobTarget.z);
    player.atkT=player.cd;
    return;
  }
  if(player.blocking)return;          // shield up = no swinging
  if(aiming){
    // v124 THE DRAW: for the drawing classes the PRESS only starts the draw — tickDraw looses it
    // on release. The fire-and-reload lines (crossbow, skirmisher, musket) still shoot on press.
    if(!isDrawClass(player.cls))fireAimedShot();
    return;
  }
  if(!tryAttack(player)&&player.atkT<=0&&player.dmg>0){
    // WHIFF: swing at the air toward the camera — cheaper cooldown than a real hit
    player.atkT=player.cd*0.6;
    player.swing=0.25;
    player.facing=Math.atan2(-Math.sin(camYaw),-Math.cos(camYaw));
    triggerAttackAnim(player);
  }
}

// ---------- developer mode (backquote ` to toggle) ----------
let devMode=false;
function devAgeUp(team){
  const nxt=AGES[teamAge[team]+1];
  if(!nxt){msg("Dev: "+TEAMNAME[team]+" is already in the final age.");return;}
  ageUp(team); // v107: ageUp no longer pays (the cost rides startAgeResearch) — the dev cheat stays instant & free
}
// v131.33 F2 — AUTO AGE-UP, BOTH TEAMS. A toggle rather than a single step, because getting to
// Enlightenment to look at one building used to be five presses of F2 and five of F3.
// BOTH SIDES ON PURPOSE: half of what you are testing at a late age is what the enemy fields and
// what his units look like, and an Enlightenment player against Stone Age bots tests neither.
// 3 SECONDS AND NOT INSTANTLY: ageUp() queues a restyle wave that drainVisualQueue works off across
// several frames, so five age-ups in one frame would be measuring the queue, not the ages.
// The tick re-checks devMode / gameOver / inMenu every time rather than only at the press — a cheat
// that keeps running after it has been switched off is worse than no cheat at all.
let devAutoAge=null;
function devAutoAgeToggle(){
  if(devAutoAge){clearInterval(devAutoAge);devAutoAge=null;msg("Dev: auto age-up OFF.","gold");return;}
  const step=()=>{
    if(!devMode||(typeof gameOver!=="undefined"&&gameOver)||(typeof inMenu!=="undefined"&&inMenu)){
      clearInterval(devAutoAge); devAutoAge=null; return;
    }
    let moved=false;
    for(const t of [BLUE,RED]){ if(AGES[teamAge[t]+1]){ ageUp(t); moved=true; } }
    if(!moved){ clearInterval(devAutoAge); devAutoAge=null;
      msg("Dev: auto age-up finished — both teams are in the final age.","gold"); }
  };
  devAutoAge=setInterval(step,3000);
  msg("Dev: auto age-up ON — both teams advance one age every 3s. F2 again to stop.","gold");
  step();
}
addEventListener("keydown",e=>{
  const k=e.key.toLowerCase();
  keys[k]=true;
  if(e.repeat)return; // v95: held keys auto-repeat keydown ~30x/s — one press is ONE press (hold-E gather reads keys.e, not this)
  if(k==="f9"){ // v98: save the NET LOG — works mid-game, after the end screen, anywhere
    e.preventDefault();
    if(typeof NET!=="undefined"&&NET.saveLog)NET.saveLog();
    return;
  }
  if(k==="m"){ // v100: M opens the SOUND MENU (volume sliders + a MUTE ALL button) — works anywhere
    if(typeof toggleOptions==="function")toggleOptions();
    else if(typeof Sound!=="undefined")Sound.toggleMute();
    return;
  }
  if(k==="o"&&!(typeof placing!=="undefined"&&placing)){ // v100: O also opens the sound menu
    if(typeof toggleOptions==="function"){toggleOptions();return;}
  }
  if(typeof inMenu!=="undefined"&&inMenu)return; // the main menu eats hotkeys — no ghost rallies before the war
  if(gameOver)return;
  if(k==="\`"||k==="~"){
    devMode=!devMode;
    msg(devMode?"🛠 DEV MODE ON — F1 +1000 all · F2 AUTO age-up · F3 age RED · F4 heal · F5 force raids · F6 reveal fog · F7 age BLUE"
               :"Dev mode off.","gold");
    if(!devMode&&devAutoAge){clearInterval(devAutoAge);devAutoAge=null;}   // leaving dev mode stops it
    return;
  }
  if(devMode){
    // v131.33 ALL OF THEM. stock is {food, gold, stone, wood} and this named two, so the two you
    // actually run dry on while testing buildings — wood and stone — were the two it withheld.
    // Looped over the record's own keys, so a fifth resource is covered the day it is added.
    if(k==="f1"){e.preventDefault();
      const got=[]; for(const r in stock[BLUE]){stock[BLUE][r]+=1000;got.push(r);}
      updateResHud(); msg("Dev: +1000 "+got.join(", +1000 ")+".","blue");return;}
    if(k==="f2"){e.preventDefault();devAutoAgeToggle();return;}
    if(k==="f3"){e.preventDefault();devAgeUp(RED);return;}
    if(k==="f4"){e.preventDefault();if(player.alive){player.hp=player.maxHp;setBar(player.bar,1);updatePlayerHud();}
      msg("Dev: healed.","blue");return;}
    if(k==="f5"){e.preventDefault();for(const D of directors)D.nextRaid=T;
      msg("Dev: raid timers zeroed — armies march.","warn");return;}
    if(k==="f6"){e.preventDefault();FOW_REVEAL=!FOW_REVEAL;
      msg("Dev: fog of war "+(FOW_REVEAL?"REVEALED":"restored")+".","gold");return;}
    // v131.33 the single-step BLUE age-up that F2 used to be — kept, so "age one side and look at
    // the difference" is still two keys away
    if(k==="f7"){e.preventDefault();devAgeUp(BLUE);return;}
  }
  if(k==="v"&&!menuOpen&&!placing){
    spawnPref=spawnPref==="tc"?"castle":"tc";
    msg("Respawn point: "+(spawnPref==="tc"?"TOWN CENTER":"nearest CASTLE (forward)")+" — press V to switch.","gold");
    return;
  }
  if(placing&&k==="r"){ // rotate the foundation
    placing.rot=((placing.rot||0)+Math.PI/4)%(Math.PI*2);
    // v134.12 rotManual is GONE with the thing it guarded. It existed only to stop the per-frame
    // auto-facing snapping the ghost back the instant the key was released; with no auto-facing
    // there is nothing to hold off, and a flag that guards nothing is a trap for whoever reads it
    // next. Every placement is manual now, which is what it was before v134.8.
    if(ghost)ghost.rotation.y=placing.rot;
    return;
  }
  if(k==="h"){toggleHelp();}
  if(k==="p"){togglePixel();}
  if(menuOpen==="build"){
    if(k==="0"&&buildMenuCat){buildMenuCat=null;renderBuildMenu();return;}
    if(/^[1-9]$/.test(k)){
      if(!buildMenuCat){const c=Object.keys(BUILD_CATS)[+k-1];if(c){buildMenuCat=c;renderBuildMenu();}}
      else{
        const cat=BUILD_CATS[buildMenuCat];
        const shown=cat.items.filter(bId=>{
          const nxt=UPGRADE_NEXT[bId];
          return !(nxt&&teamAge[MYTEAM]>=BLD[nxt].age); // keyboard matches the display
        });
        const b=shown[+k-1]; if(b)pickBuild(b);
      }
      return;
    }
  }
  if(menuOpen==="class"&&/^[1-9]$/.test(k)){
    const opt=trainMenuOptions[+k-1];
    if(opt)pickTrain(opt);
    return;
  }
  if(menuOpen==="smith"&&/^[0-9]$/.test(k)){ // v93: 1-3 choose, 0 walks away
    if(k==="0"){closeMenus();lockMouse();return;}
    const id=smithMenuOffer[+k-1];
    if(id)pickSmith(id);
    return;
  }
  if(menuOpen==="board"){ // v99: 1-3 take a posting, R redraws, 0 walks away
    if(k==="0"){closeMenus();lockMouse();return;}
    if(k==="r"){redrawBoard();return;}
    if(/^[1-3]$/.test(k)){
      const qi=boardMenuOffer[+k-1];
      if(qi!==undefined)pickBoard(qi);
      return;
    }
  }
  if(k==="escape"){closeMenus();cancelPlacing();return;}
  if(!player.alive)return;
  if(k==="b"){
    if(player.cls!=="villager"){msg("Only Villagers can build. (Press R near a training building to change class.)");return;}
    if(menuOpen==="build")closeMenus();else openBuildMenu();
  }
  if(k==="r"){
    const tb=nearTrainingBuilding();
    if(!tb){msg("Stand near a Barracks, Archery Range, Stable, Temple, Market, Siege Workshop, or Storage Pit to change class.");return;}
    if(menuOpen==="class")closeMenus(); else openTrainMenu(tb);
  }
  if(k==="e"){
    // v128.4 THE TAP COUNTER. On a guest phone the auto-gather in 12-touch.js writes keys.e
    // every animation frame, before guestFrame samples it — so the USE button's press was
    // erased (no node in reach) or the bit was already pinned high (node in reach) and the
    // host's rising-edge test never fired. Counting real presses here catches both the
    // physical key and the synthetic keydown the touch button dispatches, and cannot be
    // clobbered by anything writing keys.e directly. e.repeat has already returned above,
    // so a held key counts once.
    if(typeof NET!=="undefined"&&NET.mode==="guest")NET._eTap=(NET._eTap||0)+1;
    // v87 E-PRIORITY: climbing down always wins; otherwise the NEAREST interactable
    // wins the keypress — no more being trapped in a tower by the barracks menu,
    // and the Town Board / Blacksmith stay reachable beside other buildings.
    const tb=player.garrison?null:nearTrainingBuilding();
    if(tb&&dist2(player.root.position.x,player.root.position.z,tb.x,tb.z)<=interactCandidateD2()){
      if(menuOpen==="class")closeMenus(); else openTrainMenu(tb);
    }else playerInteract();
  }
  if(k==="enter"&&placing)confirmPlace();
  if(k==="g")toggleRally();
  if(k==="f"&&!menuOpen&&!placing)soundCharge();
  if(k==="t")tryAgeUp();
});
addEventListener("keyup",e=>{keys[e.key.toLowerCase()]=false;});

// ---------- v124 WHAT CAN I DO RIGHT NOW ----------
// The organising rule of the mobile revamp, in John's own words about age-up: it "should only show
// up when it is available and team has resources to age up". Not "when you are near the building" —
// when PRESSING IT WOULD WORK. Every predicate below is the same test the action itself runs, so
// a button that exists can never be refused with a message.
//
// This lives in 06-input rather than 12-touch on purpose: the action and the test that gates it
// belong together, and a desktop hint layer can read exactly the same list later.
//
// NOTE the pre-existing team inconsistency: tryAgeUp() checks teamTC(BLUE) but reads
// teamAge[MYTEAM]. Harmless today because the local player is always BLUE (host-can't-play-RED is
// a known open thread), but this predicate uses MYTEAM throughout so it stays correct when that
// is finally fixed.
const ACTIONS=[
  {k:"t",label:"AGE UP",hint:"advance the age",can:()=>{
    const tc=teamTC(MYTEAM);
    if(!tc||dist2(player.root.position.x,player.root.position.z,tc.x,tc.z)>Math.pow(bStand(tc.def,12),2))return false;
    const nxt=AGES[teamAge[MYTEAM]+1];
    if(!nxt)return false;                       // already in the final age
    if(ageResT[MYTEAM]>0)return false;          // already advancing
    return canAfford(MYTEAM,nxt.cost);          // John's rule: only when the stockpile covers it
  }},
  {k:"r",label:"CLASS",hint:"change unit",can:()=>!!nearTrainingBuilding()},
  {k:"b",label:"BUILD",hint:"lay a foundation",can:()=>player.cls==="villager"&&!placing},
  {k:"e",label:"USE",hint:"board · harvest · forge",can:()=>
    !!player.garrison||interactCandidateD2()<Infinity},
  {k:"g",label:"RALLY",hint:"call your five nearest",can:()=>{
    if(typeof units==="undefined")return false;
    let n=0;
    for(const v of units){
      if(!v.alive||v.team!==player.team||v===player||v.isKing||v.cls==="villager")continue;
      if(dist2(player.root.position.x,player.root.position.z,v.root.position.x,v.root.position.z)<26*26&&++n>=1)return true;
    }
    return false;
  }}
];
// the rail is capped at three, so ACTIONS order IS the priority order
function availableActions(max){
  if(typeof player==="undefined"||!player||!player.alive||menuOpen||placing)return [];
  const out=[];
  for(const a of ACTIONS){
    let ok=false;
    try{ok=a.can();}catch(e){ok=false;}   // a half-built world must never take the pad down
    if(ok){out.push(a); if(out.length>=(max||3))break;}
  }
  return out;
}

function nearTrainingBuilding(){
  let best=null,bd=1e9;
  for(const t of TRAIN_BUILDINGS){
    const b=nearestBuilt(MYTEAM,t,player.root.position.x,player.root.position.z,bStand(BLD[t],9));
    if(b){const d=dist2(player.root.position.x,player.root.position.z,b.x,b.z);
      if(d<bd){bd=d;best=b;}}
  }
  return best;
}
// v87: squared distance to the nearest NON-menu E-interactable (Infinity if none).
// The keydown dispatcher compares this against the training building so the
// closest thing under your boots is what E actually talks to.
function interactCandidateD2(){
  if(player.garrison)return 0; // climbing down beats every menu
  const px=player.root.position.x, pz=player.root.position.z;
  let bd=Infinity;
  const c=(x,z,r)=>{const d=dist2(px,pz,x,z); if(d<r*r&&d<bd)bd=d;};
  for(const b of buildings){
    if(b.team!==MYTEAM||!b.alive)continue;
    if(!b.built){c(b.x,b.z,bSurf(b.def)+2.6);continue;}           // a foundation to raise
    if(b.type==="watch_tower"&&!CLS[player.cls].mounted&&!isSiege(player.cls))c(b.x,b.z,bSurf(b.def)+2.4);
    else if(b.type==="farm"&&b.crop>=1)c(b.x,b.z,bSurf(b.def)+2.5); // ripe corn
    else if(b.type==="blacksmith")c(b.x,b.z,bSurf(b.def)+2.6);
  }
  const brd=boardFor(MYTEAM); if(brd)c(brd.x,brd.z,BOARD_REACH);
  if(player.cls==="trader")for(const nm of neutralMarkets)c(nm.x,nm.z,7);
  for(const n of nodes)if(n.amount>0)c(n.x,n.z,4.2);
  return bd;
}
function nearestNode(){
  let best=null,bd=4.2*4.2;
  for(const n of nodes){
    if(n.amount<=0)continue;
    const d=dist2(player.root.position.x,player.root.position.z,n.x,n.z);
    if(d<bd){bd=d;best=n;}
  }
  return best;
}
function nearestFriendlySite(){
  let best=null,bd=1e12;
  for(const b of buildings){
    if(b.team!==MYTEAM||b.built||!b.alive)continue;
    const reach=bSurf(b.def)+2.6; // stand outside the footprint and still whack the foundation
    const d=dist2(player.root.position.x,player.root.position.z,b.x,b.z);
    if(d<reach*reach&&d<bd){bd=d;best=b;}
  }
  return best;
}
const UPGRADE_NEXT={wood_wall:"stone_wall",stone_wall:"fort_wall",wood_gate:"stone_gate",stone_gate:"fort_gate"};
function playerInteract(){
  if(typeof NET!=="undefined"&&NET.mode==="guest")return; // host drives gather/build via your E key
  const px=player.root.position.x, pz=player.root.position.z;
  if(player.garrison){ // climb down
    const b=player.garrison; player.garrison=null; player.deckX=player.deckZ=0;
    // v132.22 a wall puts you back at the foot of its own ladder, not off its side
    if(b.def.wall&&!b.def.gate){
      const _r=b.rot||0,_c=Math.cos(_r),_s=Math.sin(_r), _z=WALL_LADDER_Z-1.4;
      player.root.position.set(b.x+_z*_s,0,b.z+_z*_c);
    }else
    player.root.position.set(b.x+(bSurf(b.def)+1.6),0,b.z);
    player.root.position.y=terrainHeight(player.root.position.x,player.root.position.z);
    setClassStats(player); // restore base range
    if(typeof Sound!=="undefined"){Sound.play("garrison",{x:b.x,z:b.z}); // v104: tower clamber
      if(Math.random()<0.6)Sound.play("veffort",{x:b.x,z:b.z});} // v109: the climb takes a grunt
    msg(b.def.wall?"You climb down from the rampart.":"You climb down from the watch tower.");
    return;
  }
  // v132.22 CLIMB UP: MAN A WALL, at its ladder. John: "someone goes to ramp, presses E, boom they
  // are on top of the wall and can shoot down." Same machinery as the watch tower — the garrison
  // system already parks a unit on a platform, moves it with deckX/deckZ and carries it on the wire
  // — so this is a second building type answering the same key, not a second system.
  // AT THE LADDER, NOT ANYWHERE ALONG THE WALL. A curtain is 12.5 long and manning it from any
  // point would make the ladder a decoration. The foot is at the middle of the segment's rear face.
  for(const b of buildings){
    if(b.team!==MYTEAM||!b.alive||!b.built||!b.def.wall||b.def.gate)continue;
    if(!b.deck)continue;                                    // only the age-5 curtain has a walkway
    if(CLS[player.cls].mounted||isSiege(player.cls))continue;
    const _r=b.rot||0,_c=Math.cos(_r),_s=Math.sin(_r);
    const lxw=b.x+WALL_LADDER_Z*_s, lzw=b.z+WALL_LADDER_Z*_c;
    if(dist2(px,pz,lxw,lzw)<WALL_LADDER_R*WALL_LADDER_R){
      player.garrison=b; player.rng*=1.2; player.deckX=0; player.deckZ=0;
      if(typeof Sound!=="undefined"){Sound.play("garrison",{x:b.x,z:b.z});
        if(Math.random()<0.6)Sound.play("veffort",{x:b.x,z:b.z});}
      msg("You climb the ladder onto the rampart — shoot down from the wall. E climbs down.","blue");
      return;
    }
  }
  for(const b of buildings){ // climb up: man a watch tower
    if(b.team===MYTEAM&&b.alive&&b.built&&b.type==="watch_tower"&&
       dist2(px,pz,b.x,b.z)<Math.pow(bSurf(b.def)+2.4,2)&&!CLS[player.cls].mounted&&!isSiege(player.cls)){
      player.garrison=b; player.rng*=1.35; player.deckX=0; player.deckZ=0;
      if(typeof Sound!=="undefined"){Sound.play("garrison",{x:b.x,z:b.z}); // v104: tower clamber
      if(Math.random()<0.6)Sound.play("veffort",{x:b.x,z:b.z});} // v109: the climb takes a grunt
      msg("You man the watch tower — loose arrows from on high. E climbs down.","blue");
      return;
    }
  }
  for(const b of buildings){ // harvest ripe corn: +20 food, banked instantly
    if(b.team===MYTEAM&&b.alive&&b.built&&b.type==="farm"&&b.crop>=1&&
       dist2(px,pz,b.x,b.z)<Math.pow(bSurf(b.def)+2.5,2)){
      if(player.cls!=="villager"){msg("Only Villagers can harvest the corn.");return;}
      awardPts(player,20);
      questProgress(player,"harvest");    // REAPER
      questProgress(player,"dep_food",20); // banked food is banked food
      b.crop=0;
      if(b.cropMesh){b.cropMesh.scale.y=0.15;for(const t of b.tassels)t.visible=false;}
      stock[MYTEAM].food+=20;
      // RICH SOIL (v132.30): a bigger yield off the same field.
      if(typeof buffSt==="function"&&typeof player!=="undefined"&&buffSt(player,"reaping"))
        stock[MYTEAM].food+=20*buffSt(player,"reaping");
      updateResHud();
      if(typeof Sound!=="undefined")Sound.play("harvest",{x:b.x,z:b.z}); // v104: corn rustle
      msg("Harvested the corn: +20 food, straight to the stockpile.","blue");
      return;
    }
  }
  // traders load goods at neutral bazaars
  if(player.cls==="trader"){
    for(const nm of neutralMarkets){
      if(dist2(player.root.position.x,player.root.position.z,nm.x,nm.z)<7*7){
        if(player.tradeLoaded){msg("Your cart is already loaded — sell at YOUR Market first.");}
        else{player.tradeLoaded=nm;msg("Goods loaded! Haul them back to your Market to sell.","blue");updatePlayerHud();if(typeof Sound!=="undefined")Sound.play("bazaarload",{x:player.root.position.x,z:player.root.position.z});} // v104
        return;
      }
    }
  }
  { // v87 THE TOWN BOARD: quests (host/solo — a guest's E is handled by the host in driveRemote)
    const brd=boardFor(MYTEAM);
    if(brd&&dist2(px,pz,brd.x,brd.z)<BOARD_REACH*BOARD_REACH){useTownBoard(player);return;}
  }
  { // v87 THE BLACKSMITH: spend quest XP on a random buff
    const bs=nearestBuilt(MYTEAM,"blacksmith",px,pz,bSurf(BLD.blacksmith)+2.6);
    if(bs){useBlacksmith(player);return;}
  }
  const site=nearestFriendlySite();
  if(site)return; // handled by hold-E in update
  const n=nearestNode();
  if(n){
    if(player.cls==="oxcart"){ // v99: the ox hauls TIMBER, nothing else
      if(n.type!=="wood"){msg("The ox snorts — it hauls TIMBER only. Find a tree.");return;}
    }else if(player.cls!=="villager"){msg("Only Villagers can gather resources. (R at the Town Center to become one.)");return;}
    if(player.gathering===n){player.gathering=null;return;}
    const cap=(player.carry.food+player.carry.gold+player.carry.stone+player.carry.wood)>=carryCap(player);
    if(cap){msg("Hands full — deposit at the Town Center first.");return;}
    player.gathering=n; player.gatherT=0;
    player.facing=Math.atan2(n.x-player.root.position.x,n.z-player.root.position.z);
    msg("Gathering "+(n.type==="food"?"berries":n.type==="gold"?"gold":n.type==="stone"?"stone":"wood")+"… (move to stop)");
  }
}

// ---------- menus / building placement ----------
function openMenu(which){
  closeMenus();
  cancelPlacing(); // opening any menu abandons a pending foundation ghost
  if(document.exitPointerLock)document.exitPointerLock();
  menuOpen=which;
  document.getElementById(which+"menu").style.display="block";
  refreshMenuAfford();
}
function closeMenus(){
  menuOpen=null;
  document.getElementById("buildmenu").style.display="none";
  document.getElementById("classmenu").style.display="none";
  const sm=document.getElementById("smithmenu"); if(sm)sm.style.display="none";
}
// ---------- v93: the blacksmith's table — three buffs, choose one ----------
// v99 THE BOARD DRAFT MENU: three postings, take one — R spends a banked reroll.
let boardMenuOffer=[];
function openBoardMenu(offer){
  closeMenus(); cancelPlacing();
  if(document.exitPointerLock)document.exitPointerLock();
  menuOpen="board"; boardMenuOffer=offer.slice();
  if(typeof Sound!=="undefined")Sound.play("ui_open"); // v100
  const box=document.getElementById("smithmenu"); // the smith's panel shell fits the board too
  let html="<h3>📜 The Town Board posts THREE — take ONE</h3>";
  offer.forEach((qi,i)=>{
    const Q=QUESTS[qi];
    html+='<div class="opt" data-q="'+qi+'"><span><span class="key">'+(i+1)+'</span>'+Q.name+
      ' <small>('+Q.desc+')</small></span><span class="cost">'+(Q.xp>1?"+"+Q.xp+" LEVELS":"+1 level")+'</span></div>';
  });
  const rr=(typeof NET!=="undefined"&&NET.mode==="guest")?(NET._qrr||0):(player.qRerolls||0);
  html+='<div class="opt" data-q="_redraw"><span><span class="key">R</span>Wipe & repost</span><span class="cost">'+rr+' reroll'+(rr===1?'':'s')+' banked</span></div>';
  html+='<div class="opt" data-q="_walk"><span><span class="key">0</span>Walk away</span><span class="cost">the postings stand</span></div>';
  html+='<div class="hint">every LEVEL you gain banks one reroll · the same three wait until you choose</div>';
  box.innerHTML=html; box.style.display="block";
}
function pickBoard(qi){
  if(typeof Sound!=="undefined")Sound.play("ui_confirm"); // v100
  if(typeof NET!=="undefined"&&NET.mode==="guest"){NET.guestAct({act:"quest",pick:qi});closeMenus();lockMouse();return;}
  if(questPick(player,qi)){closeMenus();lockMouse();}
  else msg("That posting isn't on the board.","warn");
}
function redrawBoard(){
  if(typeof Sound!=="undefined")Sound.play("ui_tab"); // v100
  if(typeof NET!=="undefined"&&NET.mode==="guest"){NET.guestAct({act:"quest",redraw:1});return;} // the host re-lays the trio
  if(questRedraw(player))openBoardMenu(player.questDraft);
  else msg("No rerolls banked — gain a level to earn one.","warn");
}
let smithMenuOffer=[];
function openSmithMenu(offer){
  closeMenus(); cancelPlacing();
  if(document.exitPointerLock)document.exitPointerLock();
  menuOpen="smith"; smithMenuOffer=offer.slice();
  if(typeof Sound!=="undefined")Sound.play("ui_open"); // v100
  const box=document.getElementById("smithmenu");
  let html="<h3>🔨 The Blacksmith lays out THREE — choose ONE ("+(player.xp||0)+" XP)</h3>";
  offer.forEach((id,i)=>{
    const B=BUFFS.find(b=>b.id===id), st=buffSt(player,id);
    html+='<div class="opt" data-s="'+id+'"><span><span class="key">'+(i+1)+'</span>'+B.name+
      ' <small>('+B.desc+')</small></span><span class="cost">×'+st+' → ×'+(st+1)+'</span></div>';
  });
  html+='<div class="opt" data-s="_walk"><span><span class="key">0</span>Walk away</span><span class="cost">the offer stands</span></div>';
  html+='<div class="hint">1 XP buys one · the SAME three wait until you choose — no rerolling</div>';
  box.innerHTML=html; box.style.display="block";
}
function pickSmith(id){
  if(typeof Sound!=="undefined")Sound.play("ui_confirm"); // v100
  if(typeof NET!=="undefined"&&NET.mode==="guest"){ // the host holds the table — ask it
    NET.guestAct({act:"buff",pick:id});
    closeMenus(); lockMouse(); return;
  }
  if(smithPick(player,id)){closeMenus();lockMouse();}
  else msg("The smith shakes his head — that piece isn't on the table.","warn");
}
document.getElementById("smithmenu").addEventListener("click",e=>{
  const el2=e.target.closest(".opt"); if(!el2)return;
  if(el2.dataset.q!==undefined){ // v99: the board draft shares the panel
    if(el2.dataset.q==="_walk"){closeMenus();lockMouse();return;}
    if(el2.dataset.q==="_redraw"){redrawBoard();return;}
    pickBoard(+el2.dataset.q);
    return;
  }
  if(!el2.dataset.s)return;
  if(el2.dataset.s==="_walk"){closeMenus();lockMouse();return;}
  pickSmith(el2.dataset.s);
});
// v121 THE HONEST PRICE TAG. The train menu built its cost line as `cost.food+" food"+(gold?...)`
// — it only ever knew about two of the four resources. Every SIEGE unit costs gold + WOOD and no
// food at all, so the menu read "undefined food · 200 gold" and never mentioned the 200 wood
// (John caught it at a Siege Workshop on his phone). This lists whatever a thing actually costs.
function costText(cost){
  if(!cost)return "free";
  const parts=[];
  for(const [k,label] of [["food","food"],["wood","wood"],["gold","gold"],["stone","stone"]])
    if(cost[k])parts.push(cost[k]+" "+label);
  return parts.length?parts.join(" · "):"free";
}
// v121: the same message five times in a row is noise, not information — especially on a phone
// where the feed covers the battlefield. Identical text inside the window is swallowed.
const _msgLast={};
function msgOnce(text,kind,windowS){
  const now=(typeof performance!=="undefined")?performance.now():Date.now();
  if(_msgLast[text]&&now-_msgLast[text]<(windowS||4)*1000)return;
  _msgLast[text]=now; msg(text,kind);
}
function canAfford(team,cost){return !cost||(stock[team].food>=(cost.food||0)&&stock[team].gold>=(cost.gold||0)&&stock[team].stone>=(cost.stone||0)&&stock[team].wood>=(cost.wood||0));}
function pay(team,cost){if(cost){stock[team].food-=(cost.food||0);stock[team].gold-=(cost.gold||0);stock[team].stone-=(cost.stone||0);stock[team].wood-=(cost.wood||0);updateResHud();}}
function refreshMenuAfford(){
  if(menuOpen==="build")renderBuildMenu();
  document.querySelectorAll("#classmenu .opt[data-u]").forEach(el=>{
    el.classList.toggle("cant",!canAfford(MYTEAM,CLS[el.dataset.u].cost));
  });
}

document.getElementById("classmenu").addEventListener("click",e=>{
  const el=e.target.closest(".opt");
  if(el&&el.dataset.u)pickTrain(el.dataset.u);
});

function pickBuild(type){
  if((BLD[type].age||0)>teamAge[MYTEAM]){msg(BLD[type].name+" requires the "+AGES[BLD[type].age].name+". (T at your Town Center to advance)");return;}
  if(!canAfford(MYTEAM,bldCost(player,type))){msg("Not enough resources for a "+BLD[type].name+".");return;}
  // v134.8: say the second half out loud. Auto-orientation the player cannot see the reason for
  // reads as the game fighting his mouse.
  if(type==="farm")msg("Farms must border your Town Center or a Storage Pit. The barn turns itself outward — R overrides.");
  // v134.1: and the inverse, for everything else — the ring is invisible, so it has to be spoken.
  else if(!BLD[type].wall)msg("Keep it clear of the Town Center — that ground is for farms.");
  cancelPlacing(); // never stack a second ghost
  closeMenus();
  lockMouse();
  placing={type};
  if(BLD[type].gate)placing.gateMode=true;              // gates are SET INTO built walls
  else if(BLD[type].wall)placing.line={stage:0};        // walls are drawn as a LINE
  ghost=buildingMesh(type,MYTEAM);
  ghost.scale.setScalar(BSCALE[type]||1); // preview at true size — farms shrank, so must the outline
  ghost.traverse(o=>{if(o.material){o.material=o.material.clone();o.material.transparent=true;o.material.opacity=0.5;}});
  scene.add(ghost);
  msg(placing.gateMode?"Aim at one of your BUILT wall segments and click — the gate replaces it."
     :placing.line?"Click the ground at the wall's START point."
     :"Click or press Enter to place the "+BLD[type].name+" · Esc cancels");
}
let lineGhosts=[]; // extra translucent segments while drawing a wall line
function clearLineGhosts(){for(const m of lineGhosts)scene.remove(m);lineGhosts=[];}
function cancelPlacing(){ if(ghost)scene.remove(ghost); ghost=null; placing=null; clearLineGhosts(); }
function ghostAnchor(){ // the spot 7 paces ahead — where all placement aims
  return {x:player.root.position.x-Math.sin(camYaw)*7, z:player.root.position.z-Math.cos(camYaw)*7};
}
function wallLineSegments(type,x1,z1,x2,z2){ // even segments along the line, oriented to it
  const dx=x2-x1, dz=z2-z1, L=Math.hypot(dx,dz);
  if(L<4)return [];
  const rot=Math.atan2(-dz,dx), n=Math.min(14,Math.max(1,Math.round(L/10.9)));
  const ux=dx/L, uz=dz/L, step=L/n, out=[];
  for(let i=0;i<n;i++){const t=(i+0.5)*step;out.push({x:x1+ux*t,z:z1+uz*t,rot});}
  return out;
}
function snapToWallEnd(x,z){ // the tip of any friendly wall within reach — loops close here
  let best=null,bd=6*6;
  for(const b of buildings){
    if(!b.alive||b.team!==MYTEAM||!b.def.wall||b.def.gate)continue;
    const c=Math.cos(b.rot||0), sn=Math.sin(b.rot||0);
    for(const s of [1,-1]){
      const ex=b.x+s*6.25*c, ez=b.z-s*6.25*sn;
      const d=dist2(x,z,ex,ez);
      if(d<bd){bd=d;best={x:ex,z:ez};}
    }
  }
  return best;
}
function lineAnchor(){ // the aim point, magnetized to wall tips while drawing walls
  const a=ghostAnchor();
  if(placing&&placing.line){
    const s=snapToWallEnd(a.x,a.z);
    if(s)return {x:s.x,z:s.z,snapped:true};
  }
  return a;
}
function nearestGateableWall(x,z){ // a BUILT, friendly, non-gate wall segment nearby
  let best=null,bd=12*12;
  for(const b of buildings){
    if(!b.alive||!b.built||b.team!==MYTEAM||!b.def.wall||b.def.gate)continue;
    const d=dist2(x,z,b.x,b.z);
    if(d<bd){bd=d;best=b;}
  }
  return best;
}
function placeGateOnWall(w,type,team){ // the wall segment steps aside for its gate
  w.alive=false; scene.remove(w.root);
  return makeBuilding(team,type,w.x,w.z,false,w.rot||0);
}
function updateGhostFollow(){ // shared by host frame and guest frame
  if(!ghost||!placing)return;
  const a=ghostAnchor();
  if(placing.gateMode){
    const w=nearestGateableWall(a.x,a.z);
    placing.snapWall=w||null;
    if(w){ghost.position.set(w.x,terrainHeight(w.x,w.z),w.z);ghost.rotation.y=w.rot||0;}
    else{ghost.position.set(a.x,terrainHeight(a.x,a.z),a.z);ghost.rotation.y=placing.rot||0;}
    const ok=!!w&&canAfford(MYTEAM,bldCost(player,placing.type));
    ghost.traverse(o=>{if(o.material)o.material.opacity=ok?0.55:0.22;});
    return;
  }
  if(placing.line&&placing.line.stage===1){
    const e=lineAnchor();
    const segs=wallLineSegments(placing.type,placing.line.sx,placing.line.sz,e.x,e.z);
    while(lineGhosts.length<Math.max(0,segs.length-1)){
      const m=buildingMesh(placing.type,MYTEAM);
      m.traverse(o=>{if(o.material){o.material=o.material.clone();o.material.transparent=true;}});
      scene.add(m); lineGhosts.push(m);
    }
    while(lineGhosts.length>Math.max(0,segs.length-1)){scene.remove(lineGhosts.pop());}
    const all=[ghost,...lineGhosts];
    for(let i=0;i<all.length;i++){
      const s=segs[i]; if(!s){all[i].visible=false;continue;}
      all[i].visible=true;
      all[i].position.set(s.x,terrainHeight(s.x,s.z),s.z);
      all[i].rotation.y=s.rot;
      const ok=validFor(placing.type,s.x,s.z,MYTEAM);
      all[i].traverse(o=>{if(o.material)o.material.opacity=ok?0.5:0.18;});
    }
    return;
  }
  // stage-0 marker and every ordinary building: the classic follow
  // v134.12 THE PLAYER'S FIELDS DO NOT TURN THEMSELVES. v134.8 gave the ghost the AI's own facing
  // rule, recomputed every frame, on the reasoning that "a field he plants beside the AI's should
  // not be the one facing the wrong way". John playtested it: "not a fan of how the farms rotate
  // around town center, storage pits etc — can we revert them back to where I can manually rotate
  // them if I want to?" A convenience that re-aims a building under the cursor while you are
  // trying to line it up is not a convenience, whatever it is optimising.
  // So the ghost places square-on and R turns it, exactly as every other building has always
  // worked. THE AI KEEPS ITS FACING — John's call, and the measured one: without it the marshals'
  // barns lapped the Town Center and pit boxes 104 times a campaign, up to 0.47 deep. What was
  // wrong was applying a rule about a bot's unattended placement to a man with a mouse.
  // The rot PLUMBING stays: placing.rot still reaches makeBuilding and guestAct, which is what
  // makes R work for a farm at all, and for a guest.
  ghost.position.set(a.x,terrainHeight(a.x,a.z),a.z);
  ghost.rotation.y=placing.rot||0;
  const ok=placementValid(a.x,a.z);
  ghost.traverse(o=>{if(o.material)o.material.opacity=ok?0.55:0.25;});
}
function farmAdjacent(team,x,z){
  // STRICT: farms border the Town Center or a Storage Pit — nothing else.
  // (farm-borders-farm was removed: it let fields chain across the whole map)
  for(const b of buildings){
    if(!b.alive||b.team!==team)continue;
    // v134.1: 26 -> TC_RING. The ground a Town Center BLESSES for fields and the ground it
    // RESERVES for them are now the same ground, stated once. A blessing that stopped short of the
    // reservation would leave an annulus where nothing at all could be built.
    if(b.type==="towncenter"&&dist2(x,z,b.x,b.z)<TC_RING*TC_RING)return true;
    if(b.type==="storage_pit"&&b.built&&dist2(x,z,b.x,b.z)<20*20)return true; // room for the full 8-farm ring
    if(b.type==="castle"&&b.built&&dist2(x,z,b.x,b.z)<22*22)return true;
  }
  return false;
}
// v134.1 THE FARM RING, as a predicate of its own so that the refusal MESSAGE can name the real
// cause. "Can't build there — too close to something" is true of this and useless: a player who has
// just been refused four plots in a row around their own Town Center needs to be told the law, not
// reminded that a law exists.
// Returns "" when the ring is not what refuses this plot.
function tcRingReason(type,x,z,team){
  if(typeof teamTC!=="function")return "";
  const tc=teamTC(team); if(!tc)return "";           // the throne has fallen: the ring falls with it
  const d2=dist2(x,z,tc.x,tc.z);
  if(type==="farm")
    return d2<TC_FARM_MIN*TC_FARM_MIN
      ? "That field crowds the Town Center — its barn would stand in the walls. Plant it further out."
      : "";
  if(d2<TC_RING*TC_RING)
    return "Only FARMS may stand beside a Town Center. Build that further out.";
  return "";
}
function validFor(type,x,z,team){
  if(team===undefined)team=BLUE;
  if(tcRingReason(type,x,z,team))return false;   // v134.1 the farm ring — see tcRingReason above
  if(type==="market"||type==="blacksmith"){ // an economy runs on five markets; one forge serves a whole army
    const cap=type==="market"?5:1;
    let mc=0;
    for(const b of buildings)if(b.alive&&b.team===team&&b.type===type)mc++;
    if(mc>=cap)return false;
  }
  if(Math.abs(x)>MAP.x-3||Math.abs(z)>MAP.z-3)return false;
  const r=BLD[type].r;
  // v132.7 THE WILDS ARE NOT A BUILDING PLOT. This never came up because all six camps were border
  // pockets and the line above already refuses them — they are past |x| > MAP.x-3. The three
  // interior camps stand on ordinary buildable ground, and creeps target UNITS, never buildings,
  // and do not steer around them: a house dropped in a camp would be un-attackable AND un-blockable
  // and would settle the fight for the treasure before it started. Placement only — the footprint
  // is not otherwise special, and nothing stops you building right up against the rim.
  if(typeof CREEP_SITES!=="undefined")
    for(const C of CREEP_SITES)if(dist2(x,z,C.x,C.z)<Math.pow(C.r+r+2,2))return false;
  // v88: NOTHING may bury a Town Board — players AND the AI validate through here,
  // so the quest board keeps a clear yard on every side (it vanished under an
  // Iron-age building in John's game; boards aren't in `buildings`, so the
  // collision loop below never saw it)
  if(typeof townBoards!=="undefined")for(const tb of townBoards)
    if(dist2(x,z,tb.x,tb.z)<Math.pow(r+3.5,2))return false;
  // v131.23 THE GAP SCALES WITH THE BUILDINGS. John, on a block of houses: "they need to at least
  // be spaced 75% of a house apart." A flat 2.2 was the same corridor between two 4.5-wide huts and
  // two 24-wide castles, so on the thing he builds most it was nothing: a house is ~7.4 across at
  // most ages, and 2.2 of that is under a third of a house. Read as a fraction of what is being
  // spaced, 0.75 of the SMALLER building's width is the ask, and it is the right shape of rule --
  // a corridor should be judged against the things forming it, not against a constant.
  // CAPPED AT 6.0, because unbounded it spaces a town centre from a barracks by 0.75*20 = 15 and
  // empties the buildable yard -- which is exactly how v131.1 broke placement and cost a release.
  // 6.0 is comfortably more than a body (1.30) and holds the corridor open everywhere.
  const _gapFor=(dA,tA,dB,tB)=>{
    const wA=2*bSpace(dA,tA), wB=2*bSpace(dB,tB);
    return Math.max(2.2,Math.min(6.0,0.75*Math.min(wA,wB)));
  };
  const farmish=type==="farm";  // farms still pack snugly: a mill needs its fields close
  const wallish=!!BLD[type].wall;
  for(const b of buildings){
    if(!b.alive)continue;
    if(wallish&&b.def.wall&&b.team===team){ // walls chain end-to-end AND meet at corners
      if(dist2(x,z,b.x,b.z)<Math.pow(r+b.def.r-3.4,2))return false;
      continue;
    }
    // v131.21 SPACED BY THE FOOTPRINT, NOT BY r. See bSpace in 00-data.js: the collider has used
    // the measured footprint since v131.9 and placement was still using r, so a barracks whose
    // shell is 10.00 was being spaced as though it were 7.2 and the gap between two of them
    // vanished. The `gap` constant keeps its old meaning -- clear ground BETWEEN the footprints.
    const gap=farmish||b.def.flat?0.5:_gapFor(BLD[type],team,b.def,b.team);
    if(dist2(x,z,b.x,b.z)<Math.pow(bSpace(BLD[type],team)+bSpace(b.def,b.team)+gap,2))return false;
  }
  // v114 CLEARING THE LAND: with the map flush with forest, a wood node blocking placement
  // meant you could barely build outside your own yard. Trees no longer refuse a plot — the
  // footprint FELLS them instead (clearFootprint, called from makeBuilding). Stone, gold and
  // berries still hold their ground: those are finite prizes, not scrub to be bulldozed.
  for(const n of nodes){
    if(n.type==="wood")continue;
    if(n.amount>0&&dist2(x,z,n.x,n.z)<Math.pow(r+3,2))return false;
  }
  if(type==="farm"&&!farmAdjacent(team,x,z))return false;
  return true;
}
function placementValid(x,z){return validFor(placing.type,x,z,MYTEAM);}
function confirmPlace(){
  if(placing&&placing.gateMode){
    const w=placing.snapWall;
    if(!w){msg("No wall there — aim at one of your BUILT wall segments.");return;}
    if(!canAfford(MYTEAM,bldCost(player,placing.type))){msg("Not enough resources for the gate.");return;}
    if(typeof NET!=="undefined"&&NET.mode==="guest"){
      NET.guestAct({act:"gate",wid:w.id,type:placing.type});
      msg("Gate ordered — the wall will open for it.","blue");
      cancelPlacing();lockMouse();return;
    }
    pay(MYTEAM,bldCost(player,placing.type));
    placeGateOnWall(w,placing.type,MYTEAM);
    updateResHud();
    msg("⛏ Gate foundation set into the wall — hold E to raise it.");
    cancelPlacing();lockMouse();return;
  }
  if(placing&&placing.line){
    const a=lineAnchor();
    if(placing.line.stage===0){
      if(!a.snapped&&!placementValid(a.x,a.z)){msg("Can't start the wall there.");return;}
      placing.line={stage:1,sx:a.x,sz:a.z};
      msg(a.snapped?"⭐ Start snapped to the wall's end — aim the line and click."
                   :"Start set — walk or look to the END point and click.");
      return;
    }
    const segs=wallLineSegments(placing.type,placing.line.sx,placing.line.sz,a.x,a.z);
    if(!segs.length){msg("Too short — stretch the line further.");return;}
    let laid=0;
    for(const s of segs){
      if(!validFor(placing.type,s.x,s.z,MYTEAM))continue;
      if(!canAfford(MYTEAM,bldCost(player,placing.type)))break;
      if(typeof NET!=="undefined"&&NET.mode==="guest"){
        NET.guestAct({act:"build",type:placing.type,x:s.x,z:s.z,rot:s.rot});laid++;continue;
      }
      pay(MYTEAM,bldCost(player,placing.type));
      const wb=makeBuilding(MYTEAM,placing.type,s.x,s.z,false,s.rot); wb.qBy=player.id; laid++; // quest credit on completion
    }
    msg(laid?("⛏ "+laid+" wall foundation"+(laid>1?"s":"")+" laid — raise them with E."):"No valid ground along that line.");
    cancelPlacing();lockMouse();return;
  }
  if(!placing)return;
  const x=ghost.position.x,z=ghost.position.z;
  if(!placementValid(x,z)){
    // v134.1: name the real cause where we know it. A generic refusal in front of a rule the player
    // cannot see is how a rule reads as a bug.
    const why=tcRingReason(placing.type,x,z,MYTEAM);
    msg(why||"Can't build there — too close to something.");
    return;
  }
  if(!canAfford(MYTEAM,bldCost(player,placing.type))){msg("Not enough resources anymore.");cancelPlacing();return;}
  if(typeof NET!=="undefined"&&NET.mode==="guest"){
    NET.guestAct({act:"build",type:placing.type,x:x,z:z,rot:placing.rot||0});
    msg("Foundation ordered — hold E beside it once it appears.","blue");
    if(typeof Sound!=="undefined")Sound.play("place",{x:x,z:z}); // v100: foundation thunk (guest)
    cancelPlacing();lockMouse();return;
  }
  pay(MYTEAM,bldCost(player,placing.type));
  const nb=makeBuilding(MYTEAM,placing.type,x,z,false,placing.rot||0); nb.qBy=player.id; // quest credit on completion
  if(typeof Sound!=="undefined")Sound.play("place",{x:x,z:z}); // v100: foundation thunk
  msg("Foundation laid! Hold E next to it to build.","blue");
  cancelPlacing();
  lockMouse();
}
// two-step build menu: pick a category, then a building
const BUILD_CATS={
  economic:{name:"Economic",items:["house","storage_pit","farm","market","blacksmith"],
    desc:{house:"faster team respawn",storage_pit:"forward drop-off",farm:"0.5 food/sec passive + workable · must border TC/Pit",market:"trade carts fetch gold from neutral bazaars",
      blacksmith:"spend quest XP on random buffs (Iron) · one per team"}},
  military:{name:"Military",items:["barracks","archery_range","stable","temple","siege_workshop"],
    desc:{barracks:"melee & anti-cav lines",archery_range:"ranged line",stable:"cavalry & scout lines",temple:"healing aura, priests",siege_workshop:"rams & artillery — building killers"}},
  defense:{name:"Defense",items:["watch_tower","tower","wood_wall","wood_gate","stone_wall","stone_gate","fort_wall","fort_gate","castle"],
    desc:{watch_tower:"extends your fog-of-war vision (Bronze)",tower:"auto-fires at raiders · needs stone",
      wood_wall:"cheap palisade (Iron) · R rotates",wood_gate:"your troops pass, theirs don't (Iron)",
      stone_wall:"solid masonry (Classical) · R rotates",stone_gate:"stone gatehouse (Classical)",
      fort_wall:"the great curtain (Medieval) · R rotates",fort_gate:"fortified gatehouse (Medieval)",
      castle:"forward spawn · drop-off · rains arrows (Medieval)"}}
};
let buildMenuCat=null;
function openBuildMenu(){
  closeMenus(); cancelPlacing();
  if(document.exitPointerLock)document.exitPointerLock();
  menuOpen="build"; buildMenuCat=null;
  if(typeof Sound!=="undefined")Sound.play("ui_open"); // v100
  renderBuildMenu();
}
function fmtCost(c){if(!c)return"free";const p=[];if(c.food)p.push(c.food+" food");if(c.wood)p.push(c.wood+" wood");if(c.gold)p.push(c.gold+" gold");if(c.stone)p.push(c.stone+" stone");return p.join(" · ")||"free";}
function renderBuildMenu(){
  const box=document.getElementById("buildmenu"); let html;
  if(!buildMenuCat){
    html="<h3>🔨 Construct — pick a category</h3>";
    Object.keys(BUILD_CATS).forEach((c,i)=>{
      html+='<div class="opt" data-cat="'+c+'"><span><span class="key">'+(i+1)+'</span>'+BUILD_CATS[c].name+
            '</span><span class="cost">'+BUILD_CATS[c].items.length+' buildings</span></div>';
    });
    html+='<div class="hint">1–3 to pick · Esc to close</div>';
  }else{
    const cat=BUILD_CATS[buildMenuCat];
    html="<h3>🔨 "+cat.name+"</h3>";
    const shown=cat.items.filter(bId=>{
      const nxt=UPGRADE_NEXT[bId];
      return !(nxt&&teamAge[MYTEAM]>=BLD[nxt].age); // superseded walls & gates step aside
    });
    shown.forEach((bId,i)=>{
      const b=BLD[bId], locked=(b.age||0)>teamAge[MYTEAM];
      html+='<div class="opt'+((locked||!canAfford(MYTEAM,bldCostD(player,b)))?" cant":"")+'" data-b="'+bId+'"><span><span class="key">'+(i+1)+'</span>'+
            b.name+' <small>('+cat.desc[bId]+')</small></span><span class="cost">'+
            (locked?("🔒 "+AGES[b.age].name):fmtCost(b.cost))+'</span></div>';
    });
    html+='<div class="opt" data-back="1"><span><span class="key">0</span>◀ Back</span><span class="cost"></span></div>';
    html+='<div class="hint">Pick, then click / Enter to place · whack the foundation with E</div>';
  }
  box.innerHTML=html; box.style.display="block";
}
document.getElementById("buildmenu").addEventListener("click",e=>{
  const el=e.target.closest(".opt"); if(!el)return;
  if(el.dataset.cat){buildMenuCat=el.dataset.cat;renderBuildMenu();return;}
  if(el.dataset.back){buildMenuCat=null;renderBuildMenu();return;}
  if(el.dataset.b)pickBuild(el.dataset.b);
});

// training menus are built dynamically from the building's LINES + current age
let trainMenuOptions=[];
function openTrainMenu(building){
  closeMenus();
  cancelPlacing();
  if(document.exitPointerLock)document.exitPointerLock();
  menuOpen="class";
  if(typeof Sound!=="undefined")Sound.play("ui_open"); // v100
  trainMenuOptions=[];
  const box=document.getElementById("classmenu");
  let html="<h3>⚔ "+building.def.name+" — take up arms</h3>";
  let i=1;
  for(const line of linesAt(building.type,BLUE)){
    const uid=lineUnitFor(line,BLUE);
    if(!uid){ // line exists here but no tier at this age yet
      const firstAge=LINES[line].tiers.findIndex(t=>t);
      html+='<div class="opt cant"><span><span class="key">·</span>'+LINES[line].name+
            ' line</span><span class="cost">🔒 '+AGES[firstAge].name+'</span></div>';
      continue;
    }
    const c=CLS[uid], costTxt=costText(c.cost);
    trainMenuOptions.push(uid);
    html+='<div class="opt" data-u="'+uid+'"><span><span class="key">'+i+'</span>'+c.name+
          ' <small>('+LINES[line].name+' line)</small></span><span class="cost">'+costTxt+'</span></div>';
    i++;
  }
  if(building.type==="market"){
    const c=CLS.trader;
    trainMenuOptions.push("trader");
    html+='<div class="opt" data-u="trader"><span><span class="key">'+i+'</span>Trader <small>(run routes yourself — 4× cart gold)</small></span><span class="cost">'+costText(c.cost)+'</span></div>';
    i++;
  }
  if(building.type==="storage_pit"){ // v99: the pit yokes the OX
    const c=CLS.oxcart;
    trainMenuOptions.push("oxcart");
    html+='<div class="opt" data-u="oxcart"><span><span class="key">'+i+'</span>Ox Cart <small>(300 wood bed · chops 4× — timber only)</small></span><span class="cost">'+costText(c.cost)+'</span></div>';
    i++;
  }
  trainMenuOptions.push("villager");
  html+='<div class="opt" data-u="villager"><span><span class="key">'+i+'</span>Back to Villager</span><span class="cost">free</span></div>';
  html+='<div class="hint">Your team\'s AGE sets the tier you get · costs come from the TEAM stockpile</div>';
  box.innerHTML=html;
  box.style.display="block";
  refreshMenuAfford();
}
function armupFor(cls){ // v105: base arm-up cheer routed by unit type (combat cheers, civilian modest)
  const l=CLS[cls]&&CLS[cls].line;
  return (l==="cavalry"||l==="scoutline")?"armup_cavalry"
       :(l==="melee"||l==="anticav"||l==="ranged"||l==="meleesiege"||l==="rangedsiege")?"armup_infantry"
       :"armup_civilian";
}
function armupSig(cls){ // v106: a per-LINE signature layered over the base cheer, so each line sounds distinct
  const c=CLS[cls]||{},l=c.line;
  if(cls==="musketeer")return "gun";                            // powder crack
  if(l==="melee")return "parry";                                // ringing sword shing
  if(l==="anticav")return "spearhit";                           // spear thud
  if(l==="ranged")return "bow";                                 // bow twang
  if(l==="cavalry")return "neigh";                              // a warhorse (scouts ride the base cheer alone)
  if(l==="meleesiege"||l==="rangedsiege")return "siegefire";    // heavy engine rumble
  if(l==="healer")return "channel";                             // holy shimmer for the priest
  if(l==="trade")return "bazaarload";                           // a merchant's crate/coin
  return null;                                                  // scouts & villagers: base cheer only
}
function playArmup(cls){ // v106: base cheer + line signature, layered
  if(typeof Sound==="undefined")return;
  Sound.play(armupFor(cls));
  const s=armupSig(cls); if(s)Sound.play(s);
}
function pickTrain(uid){
  if(player.cls===uid){closeMenus();lockMouse();return;} // already this class — no arm-up
  if(typeof NET!=="undefined"&&NET.mode==="guest"){
    playArmup(uid); // v106: arm-up cheer + line signature (guest, local)
    NET.guestAct({act:"train",cls:uid});
    msg("Requesting "+CLS[uid].name+" from the quartermaster…");
    if(uid==="priest")msg("Priest: hold LMB 2s to channel, stand over a fallen ally, release to resurrect. 10s cooldown.","gold");
    closeMenus();lockMouse();return;
  }
  if(!canAfford(MYTEAM,CLS[uid].cost)){
    msgOnce("The team stockpile can't afford a "+CLS[uid].name+" ("+costText(CLS[uid].cost)+").","warn");return;}
  pay(MYTEAM,CLS[uid].cost);
  setClass(player,uid);
  playArmup(uid); // v106: arm-up cheer + line signature
  if(uid!=="villager")questProgress(player,"train"); // MASTER-AT-ARMS
  msg("You are now a "+CLS[uid].name+"!","blue");
  if(uid==="priest")msg("Priest: hold LMB 2s to channel, stand over a fallen ally, release to resurrect. 10s cooldown.","gold");
  closeMenus();
  lockMouse();
}
let rallyUnit=null; // legacy fallback leader — v95 soldiers follow their OWN v.rallyBy
function rallyCapFor(u){return RALLY_CAP+buffSt(u,"rally");} // BANNERMAN: +1 troop per stack
// v95 PERSONAL WARBANDS: every rallied soldier remembers WHO rallied them (v.rallyBy).
// G only toggles YOUR band; F only charges YOUR band; soldiers already marching
// under another leader's banner can never be poached. Two humans on one team each
// field their own 5 (plus Bannerman) with no bouncing and no accidental recalls.
function releaseWarband(ldr){ // leader died or disconnected — the band returns to guard the King
  let n=0;
  for(const v of units)if(v.rallyBy===ldr){v.rally=false;v.rallyBy=null;v.chargeTo=null;n++;}
  return n;
}
function rallyLeaderFor(v){ // whom does this soldier follow?
  const b=v.rallyBy;
  if(b&&b.alive&&b.team===v.team)return b;
  if(rallyUnit&&rallyUnit.alive&&rallyUnit.team===v.team)return rallyUnit; // legacy states only
  return null;
}
// Shared host/solo core — hostAct "rally" routes guests through the same rules.
function toggleRallyFor(u){
  rallyUnit=u;
  const mil=units.filter(v=>v.team===u.team&&v.bot&&!v.isKing&&v.alive&&v.cls!=="villager"&&!v.remote);
  if(!mil.length)return null;
  // only YOUR band counts toward the toggle — ownerless rallies (legacy states) adopt the horn-blower
  const mine=v=>v.rally&&(v.rallyBy===u||!v.rallyBy);
  const on=!mil.some(mine);
  for(const v of mil)if(mine(v)||v.rallyBy===u){v.rally=false;v.rallyBy=null;v.chargeTo=null;} // recall (or re-rally) clears only YOURS
  let n=0;
  if(on){
    const px=u.root.position.x,pz=u.root.position.z;
    const free=mil.filter(v=>!v.rally); // unclaimed soldiers only — no poaching a teammate's band
    if(!free.length)return null;
    free.sort((a,b)=>dist2(a.root.position.x,a.root.position.z,px,pz)-dist2(b.root.position.x,b.root.position.z,px,pz));
    n=Math.min(rallyCapFor(u),free.length);
    for(let i=0;i<n;i++){free[i].rally=true;free[i].rallyBy=u;free[i].chargeTo=null;}
  }
  return {on,n};
}
function toggleRally(){
  if(typeof NET!=="undefined"&&NET.mode==="guest"){NET.guestAct({act:"rally"});return;}
  const res=toggleRallyFor(player);
  if(!res){msg("No allied soldiers to rally yet.");return;}
  msg(res.on?"⚑ "+res.n+" soldier"+(res.n===1?"":"s")+" rally to YOU (cap "+rallyCapFor(player)+" — Bannerman adds more). G recalls · F to CHARGE."
            :"Soldiers return to guard the King.","blue");
}
function soundCharge(){ // F: hurl the rallied army forward along your gaze — attack-move, then hold the far ground
  if(gameOver||!player.alive)return;
  if(typeof NET!=="undefined"&&NET.mode==="guest"){
    if(typeof Sound!=="undefined")Sound.play("warhorn"); // v102: the charge horn (guest hears it locally)
    NET.guestAct({act:"charge",yaw:camYaw});return;
  }
  const n=orderCharge(player,camYaw);
  if(!n){msg("No rallied soldiers to charge — press G to rally them to you first.");return;}
  if(typeof Sound!=="undefined")Sound.play("warhorn"); // v102: the charge horn (only when a band actually storms)
  msg("⚔ CHARGE! Your "+n+" rallied soldiers storm ahead — they'll hold the far ground (G recalls them).","warn");
}
function toggleHelp(){
  const h=document.getElementById("help"),t=document.getElementById("helptoggle");
  const showing=h.style.display!=="none";
  h.style.display=showing?"none":"block";
  t.style.display=showing?"block":"none";
}
document.getElementById("helptoggle").addEventListener("click",toggleHelp);

// Megabonk crunch: low-res render upscaled with nearest-neighbor
// v124.13a: TWO fixes, both from the same misconception — that this function owns the pixel ratio.
//   1. CHUNK is expressed as a DIVISOR of whatever ratio the game is already running at, instead
//      of a hardcoded 0.3. Switching the filter off used to restore a flat 1.0, which threw away
//      the mobile Battery Saver's 0.7 every time — the filter was quietly undoing the toggle.
//   2. John: "can we make pixel mode half as pixelated?" The chunk was 1/0.3 = 3.33 screen pixels
//      per rendered one. Halved to 1.67, which stays unmistakably retro without turning a 50v50
//      battlefield into porridge. Expressed as a divisor so it means the same thing on a phone at
//      0.70 (-> 0.42) as on a desktop at 1.0 (-> 0.60).
const PIXEL_CHUNK=1.67;
let pixelMode=false;
function togglePixel(){
  pixelMode=!pixelMode;
  const base=(typeof window.__basePR==="number"&&window.__basePR>0)
    ? window.__basePR : Math.min(devicePixelRatio,1);
  const pr=pixelMode?base/PIXEL_CHUNK:base;
  renderer.setPixelRatio(pr);
  if(composer&&composer.setPixelRatio)composer.setPixelRatio(pr);
  renderer.domElement.style.imageRendering=pixelMode?"pixelated":"auto";
  msg(pixelMode?"Pixel mode ON — very Megabonk.":"Pixel mode OFF.");
}

// advance your team's age at the Town Center
function tryAgeUp(){
  if(!player.alive)return;
  if(typeof NET!=="undefined"&&NET.mode==="guest"){NET.guestAct({act:"ageup"});return;}
  const tc=teamTC(BLUE);
  if(!tc||dist2(player.root.position.x,player.root.position.z,tc.x,tc.z)>Math.pow(bStand(tc.def,12),2)){
    msg("Stand at your Town Center to advance the age (T).");return;
  }
  const nxt=AGES[teamAge[MYTEAM]+1];
  if(!nxt){msg("Your civilization has reached the "+AGES[teamAge[MYTEAM]].name+" — the final age.");return;}
  if(ageResT[MYTEAM]>0){msg("⏳ Your team is already advancing — "+Math.ceil(ageResT[MYTEAM])+"s to go.");return;}
  if(!canAfford(MYTEAM,nxt.cost)){
    msgOnce(nxt.name+" costs "+costText(nxt.cost)+". Keep gathering!");return;
  }
  startAgeResearch(BLUE); // v107: pay now — the age lands in 90 seconds
}
