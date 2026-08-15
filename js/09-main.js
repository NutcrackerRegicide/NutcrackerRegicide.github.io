/* REGICIDE PVP — 09-main.js */
// tutorial drip
const hints=[
  [1,  "You are ONE of 50 Blue players. Gather, build, arm up — and slay King Vargus."],
  [5,  "Click to capture the mouse. WASD moves, the camera follows your mouse. LMB attacks."],
  [16, "Carry up to 20 — bank it at the Town Center or a forward Storage Pit."],
  [24, "STONE is scarce — five piles on the entire map. Towers demand it; castles will devour it. Claim the midpoint piles!"],
  [34, "FOG OF WAR: the enemy and their base stay hidden until your troops scout them. What you can't see can kill you."],
  [44, "Chop FORESTS for wood — palisades at Iron, stone walls at Classical. Gates open only for your team."],
  [215,"Medieval: the CASTLE. Forward spawn, drop-off, and a rain of arrows. Its walls are why siege exists."],
  [32, "The Barracks trains the Melee & Anti-Cavalry lines. Your team's AGE decides the tier you get."],
  [50, "Bank food and press T at your Town Center to advance the age — Bronze unlocks the Archery Range, Stable & FARMS."],
  [58, "Farms trickle 0.5 food/sec on their own — work them for more. They must border your Town Center or a Storage Pit."],
  [70, "Six ages: Stone → Bronze → Iron → Classical → Medieval → ENLIGHTENMENT. Reach the last one first and crush them."],
  [64, "A TOWN BOARD stands beside your Town Center — press E there for a QUEST. Each one completed: +1 LEVEL and +1 XP (the hardest pay 2)."],
  [200,"Iron age: the BLACKSMITH (100 wood). Press E there: THREE random buffs on the table — choose ONE per XP (max ×3 of each). DEATH wipes level, XP and buffs!"],
  [85, "WILD CAMPS: six lurk in nooks beyond the map's edge, THREE STAND IN THE OPEN FIELD — wolves hoard FOOD, barbarians hoard GOLD. Their chests can be STOLEN. Bring 2-3 allies; the packs tear loners apart."],
  [110,"A wrecked longship rots on the SOUTHERN SHORE. At 15:00 a VIKING RAID lands there — break it with a WAR PARTY and twin chests of 500 food and 500 gold are yours… if nobody steals them first."],
  [95, "The wheel: SPEARS alone stop the horse — cavalry tramples swords, archers and siege. Swords raze buildings and dismantle war engines; arrows bounce off them. Choose your counter."],
  [118,"Melee: hold RMB to block — tap it RIGHT as a blow lands to PARRY and stagger them."],
  [132,"Ranged units: hold RMB to aim down the camera and LMB for a stronger skill shot."],
  [145,"Classical age: build a Temple — Priests and its aura mend your wounded."],
  [160,"Press G to rally your FIVE nearest soldiers to you (the Bannerman blacksmith buff adds more). Time it with a raid wave to crack their base."],
  [168,"Rallied troops answer F — the CHARGE: they attack-move down your gaze, slaying and razing everything in the path, then HOLD that ground until you recall them with G."],
  [175,"Medieval: build a MARKET. Carts haul gold from neutral bazaars — the deeper the route, the richer. Escort yours; plunder theirs."],
  [190,"Scout-line cavalry TRAMPLE farms (4× damage) and hunt trade carts. Guard your economy."],
  [205,"Iron age: the SIEGE WORKSHOP. Rams and catapults crack buildings that armies can't — escort them or lose them."]
];
let hintI=0;

function endGame(winner,killerName){
  if(gameOver)return;
  gameOver=true;
  if(typeof Sound!=="undefined"){Sound.play(winner===MYTEAM?"regicide_win":"regicide_lose"); // v100: the regicide sting
    Sound.play("vking");} // v109: the king's long dying scream under the sting — every client runs endGame
  if(typeof NET!=="undefined"&&NET.mode!=="solo"&&NET.logEvent){ // v98: the flight recorder marks the end
    NET.logEvent("end",{w:winner});
    msg("📊 Battle over — press F9 to save the NET LOG (both players!) and send the files to Claude.","gold");
  }
  closeMenus();cancelPlacing();
  if(document.exitPointerLock)document.exitPointerLock();
  document.getElementById("deathoverlay").style.display="none";
  const ov=document.getElementById("endoverlay");
  const title=document.getElementById("endtitle"),text=document.getElementById("endtext");
  if(winner===BLUE){
    title.textContent="⚔ VICTORY ⚔";
    title.style.color="#7ea1ff";
    text.textContent="King Vargus has fallen"+(killerName==="You"?" — by YOUR hand!":" to "+killerName+"!")+" The Red banners burn. Your civilization stands.";
  }else{
    title.textContent="DEFEAT";
    title.style.color="#ff9b90";
    text.textContent="King Osric has been slain by "+killerName+". Without a crown, the Blue banners fall. Guard him better next time — castles and garrisons exist for a reason.";
  }
  ov.style.display="flex";
}

// ---------- main loop ----------
function updatePlayer(dt){
  if(!player.alive){
    document.getElementById("deathtimer").textContent=Math.ceil(player.respawnT);
    return;
  }
  // stances
  const wasBlock=player.blocking;
  player.blocking=rmbHeld&&canBlock(player)&&!placing&&player.cls!=="dragoon";
  if(player.blocking&&!wasBlock)player.blockStart=T;
  const lobber=player.cls==="catapult"||player.cls==="trebuchet";
  siegeAim=rmbHeld&&lobber&&player.alive&&!placing;
  aiming=rmbHeld&&!!player.ranged&&!lobber;
  document.getElementById("crosshair").classList.toggle("aim",aiming||siegeAim);
  tickDraw(dt); // v124 THE DRAW — builds while primary is held, looses on release
  // movement (camera-relative; blocking slows you)
  const _mv=readMove();               // v124: one vector, keys or stick
  let mx=_mv.mx, mz=_mv.mz;
  const mag=_mv.mag;
  if(player.garrison){ // up in the tower: walk the deck, rain arrows from on high
    const gb=player.garrison;
    if(!gb.alive){
      player.garrison=null; setClassStats(player);
      player.root.position.y=terrainHeight(player.root.position.x,player.root.position.z);
      msg("The watch tower falls from under you!","warn");
    }else{
      const deck=gb.deck||{y:7.15,r:2.4};
      if(mx||mz){ // stroll around the platform, clamped inside the railings
        const dir=new THREE.Vector3(mx,0,mz).applyAxisAngle(new THREE.Vector3(0,1,0),camYaw);
        const L=Math.hypot(dir.x,dir.z)||1;
        player.deckX=(player.deckX||0)+dir.x/L*player.spd*dt*0.7;
        player.deckZ=(player.deckZ||0)+dir.z/L*player.spd*dt*0.7;
        // v132.23 one clamp, in 03-buildings.js, shared by all four sites — see deckClamp
        {const _cl=deckClamp(deck,gb.rot,player.deckX,player.deckZ);
         player.deckX=_cl.x; player.deckZ=_cl.z;}
        player.facing=Math.atan2(dir.x,dir.z); player.moving=true; player.walkT+=dt*5;
      }else player.moving=false;
      player.root.position.set(gb.x+(player.deckX||0),gb.root.position.y+deck.y,gb.z+(player.deckZ||0));
      mx=0; mz=0;
    }
  }
  if(!player.garrison&&(mx||mz)){
    const dir=new THREE.Vector3(mx,0,mz).applyAxisAngle(new THREE.Vector3(0,1,0),camYaw);
    // moveUnit normalises the direction, so the analog deflection rides dt
    moveUnit(player,dir.x,dir.z,dt*mag*(player.blocking?0.55:1));
  }
  if(player.cls==="priest")updatePriestChannel(dt,lmbHeld&&mouseLocked&&!placing&&!menuOpen);
  else if(((lmbHeld&&mouseLocked)||keys[" "])&&!placing)playerPrimary();
  if(aiming)player.facing=Math.atan2(-Math.sin(camYaw),-Math.cos(camYaw));
  // gathering tick
  if(player.gathering){
    const n=player.gathering;
    if(n.amount<=0){player.gathering=null;}
    else{
      player.gatherT+=dt; player.swing=Math.max(player.swing||0,0.12);
      if(player.gatherT>(0.6-0.1*buffSt(player,"gather"))*(n.slow||1)){ // PRACTICED HANDS swing faster
        player.gatherT=0;
        const cap=carryCap(player); // DEEP SATCHEL carries more (and stone/wood count now too)
        const total=player.carry.food+player.carry.gold+player.carry.stone+player.carry.wood;
        if(total>=cap){player.gathering=null;msg("Hands full! Deposit at the Town Center.");}
        else{
          // v99: the ox takes FOUR swings' worth of timber a tick — but never more than the node or the bed holds
          const tk=Math.min(player.cls==="oxcart"?4:1,n.amount,cap-player.carry[n.type]);
          if(tk>0){n.amount-=tk; player.carry[n.type]+=tk;} // FULL means full — the node stops draining too
          // GILDED HARVEST (v132.30): gold ore also feeds the team. Paid straight to the
          // stockpile rather than into the pack, so it is not subject to carry capacity.
          if(tk>0&&n.type==="gold"&&buffSt(player,"alchemy")&&typeof stock!=="undefined"&&stock[player.team]){
            stock[player.team].food+=tk*buffSt(player,"alchemy");
            if(typeof updateResHud==="function")updateResHud();
          }
          // v132.28 TIMBER HAUL: counts wood actually taken, not swings taken.
          if(tk>0&&player.cls==="oxcart"&&n.type==="wood"&&typeof questProgress==="function")
            questProgress(player,"ox_wood",tk);
          // v113: EVERY OTHER SWING makes a noise (John: gather sounds needn't hit every tick) — the
          // arm still moves each tick, the axe just isn't miked for all of them.
          player._gsw=((player._gsw||0)+1)&1;
          if(tk>0&&!player._gsw&&typeof Sound!=="undefined")Sound.play(n.type==="wood"?"chop":n.type==="food"?"farm":"mine",{x:n.x,z:n.z}); // v100: gather work, matched to the swing
          // (v111: the v109 gather grunt is GONE — it read as villagers being hurt, John's call)
          puff(n.x,1.5+(n.y||0),n.z,n.type==="food"?0xd23c2f:n.type==="gold"?0xe0a92e:n.type==="stone"?0x9aa2ad:0x8a6a3f);
          if(n.amount<=0){depleteNode(n);msg(n.type==="wood"?"Timber! That tree is felled.":"That "+(n.type==="food"?"bush":n.type==="gold"?"gold pile":"stone pile")+" is spent.");}
          updatePlayerHud();
        }
      }
    }
  }
  // hold-E construction
  const site=nearestFriendlySite();
  if(site&&keys.e&&player.cls==="villager"){
    player.buildT+=dt; player.swing=Math.max(player.swing||0,0.12);
    player.facing=Math.atan2(site.x-player.root.position.x,site.z-player.root.position.z);
    if(player.buildT>0.45){player.buildT=0;addConstructionHit(site,player);}
  }
  // traders sell loaded goods at their own Market — 2.5× the NPC rate (v84)
  if(player.cls==="trader"&&player.tradeLoaded){
    const mk=nearestBuilt(MYTEAM,"market",player.root.position.x,player.root.position.z,bSurf(BLD.market)+2.6);
    if(mk){
      const d=Math.hypot(mk.x-player.tradeLoaded.x,mk.z-player.tradeLoaded.z);
      const g=Math.round(2.5*tradeGold(d)*(1+0.10*buffSt(player,"trade"))); // DEEP POCKETS
      stock[BLUE].gold+=g;updateResHud();
      awardPts(player,g);
      questTradeSale(player,player.tradeLoaded); // the route quests count the sale
      msg("Sold your goods: +"+g+" gold! (trader premium)","blue");
      if(typeof Sound!=="undefined")Sound.play("bighaul"); // v104: trader sells are a big haul
      player.tradeLoaded=null;updatePlayerHud();
    }
  }
  // castles accept deposits like a forward Town Center
  if(player.carry.food||player.carry.gold||player.carry.stone||player.carry.wood){
    const ca=nearestBuilt(MYTEAM,"castle",player.root.position.x,player.root.position.z,bSurf(BLD.castle)+3.5);
    if(ca){
      awardPts(player,player.carry.food+player.carry.gold+player.carry.stone+player.carry.wood);
      questDeposit(player,player.carry.food,player.carry.gold,player.carry.stone,player.carry.wood);
      stock[BLUE].food+=player.carry.food;stock[BLUE].gold+=player.carry.gold;
      stock[BLUE].stone+=player.carry.stone;stock[BLUE].wood+=player.carry.wood;
      player.carry.food=0;player.carry.gold=0;player.carry.stone=0;player.carry.wood=0;
      updateResHud();msg("Deposited at the castle.","blue");updatePlayerHud();
      if(typeof Sound!=="undefined")Sound.play("deposit"); // v100
    }
  }
  // auto-deposit at the Town Center OR any Storage Pit
  let tc=teamTC(BLUE);
  const pit=nearestBuilt(MYTEAM,"storage_pit",player.root.position.x,player.root.position.z,bSurf(BLD.storage_pit)+3.5);
  if(pit)tc=pit;
  if(tc&&(player.carry.food||player.carry.gold||player.carry.stone||player.carry.wood)&&dist2(player.root.position.x,player.root.position.z,tc.x,tc.z)<Math.pow(bSurf(tc.def)+3.5,2)){
    const f=player.carry.food,g=player.carry.gold,st=player.carry.stone,w=player.carry.wood;
    awardPts(player,f+g+st+w);
    questDeposit(player,f,g,st,w);
    stock[BLUE].food+=f;stock[BLUE].gold+=g;stock[BLUE].stone+=st;stock[BLUE].wood+=w;
    player.carry.food=0;player.carry.gold=0;player.carry.stone=0;player.carry.wood=0;
    msg("Deposited "+(f?f+" food ":"")+(g?g+" gold ":"")+(st?st+" stone ":"")+(w?w+" wood":"")+" to the team stockpile.","blue");
    updateResHud();updatePlayerHud();
    if(typeof Sound!=="undefined")Sound.play("deposit"); // v100
  }
  // ghost placement follows player
  if(ghost){ // foundation ghost follows where the camera looks
    updateGhostFollow(); // shared: classic follow, wall lines, gate snapping
  }
}
// ---------- THE PRIEST: hold LMB to channel a resurrection ----------
// Shared by the host/solo sim (updatePlayer) and the guest frame — John often plays a RED guest.
function updatePriestChannel(dt,holding){
  const p=player;
  if(p._resCd>0)p._resCd=Math.max(0,p._resCd-dt); // faith always recovers
  if(holding&&p.alive){
    if(p._resCd>0){
      if(!p._resNag){p._resNag=true;msg("Not enough faith, wait "+Math.ceil(p._resCd)+" seconds.","warn");}
      p._resCharge=0; p._resReady=false;
    }else{
      if(typeof Sound!=="undefined"&&!(p._resCharge>0))Sound.play("channel",{x:p.root.position.x,z:p.root.position.z}); // v103: rising holy hum on channel start
      p._resCharge=Math.min(RES_CHARGE,(p._resCharge||0)+dt);
      if(p._resCharge>=RES_CHARGE&&!p._resReady){
        p._resReady=true;
        msg("✝ Faith fully channeled — step onto a fallen ally and release to resurrect.","gold");
      }
    }
  }else{ // mouse released (or lost focus): cast if charged, otherwise the rite dissipates
    if(p._resReady){
      if(tryResurrect())p._resCd=resCdFor(p); // ZEALOTRY shortens the wait
      else msg("No fallen ally beneath you — stand over a body and release.","warn");
    }
    p._resCharge=0; p._resReady=false; p._resNag=false;
  }
  p._resPhase=(p._resPhase||0)+dt;
  updateResVisual();
}
// find the nearest friendly corpse under the priest and raise it (host does it; guest asks the host)
function tryResurrect(){
  const px=player.root.position.x, pz=player.root.position.z;
  let best=null,bd=RES_REACH*RES_REACH;
  for(const u of units){
    if(u.alive||!u.corpse||u===player||u.team!==player.team)continue;
    if(isSiege(u.cls))continue; // faith moves flesh, not cold iron — siege engines stay dead
    const d=dist2(px,pz,u.root.position.x,u.root.position.z);
    if(d<bd){bd=d;best=u;}
  }
  if(!best)return false;
  if(typeof NET!=="undefined"&&NET.mode==="guest"){
    NET.guestAct({act:"resurrect",id:best.id});         // host validates + broadcasts the revival
    if(typeof puff==="function")puff(best.root.position.x,1.6,best.root.position.z,0xfff0b0); // local light; host confirms
  }else resurrectUnit(best,player);
  return true;
}
// the channeling visual: an orb + halo over the priest and a ring at their feet
function ensureResFX(){
  if(player._resFX||!player.root)return;
  const g=new THREE.Group();
  const orb=new THREE.Mesh(new THREE.SphereGeometry(0.42,12,10),
    new THREE.MeshBasicMaterial({color:0x9fd8ff,transparent:true,opacity:0.85}));
  orb.position.y=2.75;
  const halo=new THREE.Mesh(new THREE.TorusGeometry(0.85,0.09,8,26),
    new THREE.MeshBasicMaterial({color:0x9fd8ff,transparent:true,opacity:0.8}));
  halo.rotation.x=-Math.PI/2; halo.position.y=2.75;
  const ring=new THREE.Mesh(new THREE.RingGeometry(1.2,1.55,28),
    new THREE.MeshBasicMaterial({color:0x9fd8ff,transparent:true,opacity:0.5,side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2; ring.position.y=0.1;
  g.add(orb); g.add(halo); g.add(ring); g.visible=false;
  player.root.add(g);
  player._resFX={g,orb,halo,ring};
}
function updateResVisual(){
  ensureResFX();
  const fx=player._resFX; if(!fx)return;
  const on=player.cls==="priest"&&player.alive&&(((player._resCharge||0)>0)||player._resReady);
  fx.g.visible=on;
  if(!on)return;
  const frac=player._resReady?1:Math.min(1,(player._resCharge||0)/RES_CHARGE);
  const c=new THREE.Color(0x9fd8ff).lerp(new THREE.Color(0xffd94a),frac); // pale blue → holy gold
  const ph=player._resPhase||0;
  fx.orb.material.color.copy(c); fx.halo.material.color.copy(c); fx.ring.material.color.copy(c);
  fx.orb.scale.setScalar(0.6+frac*0.8);
  fx.halo.scale.setScalar(0.7+frac*0.6); fx.halo.rotation.z=ph*1.5;
  fx.ring.scale.setScalar(0.5+frac*0.7); fx.ring.material.opacity=0.25+frac*0.45;
  if(player._resReady){ // fully charged: a bright golden pulse + faster spin
    const puls=0.85+0.15*Math.sin(ph*7);
    fx.orb.scale.setScalar(1.35+0.14*Math.sin(ph*7));
    fx.orb.material.opacity=puls; fx.halo.material.opacity=puls;
    fx.halo.rotation.z=ph*3.2; fx.ring.material.opacity=0.55+0.2*Math.sin(ph*7);
  }else fx.orb.material.opacity=0.6+0.3*frac;
}
// ---------- level-of-detail + FOG OF WAR ----------
// Enemies exist only where your troops can see; the far world fades into the haze.
let lodT=0, FOW_REVEAL=false, frameNo=0, spawnPref="tc";
const FOW_VISION=70, BAR_D=60; // vision up: no more point-blank ambush pop-in
// v116: HIDE_D is a `let` with a setter so the mobile spike (12-touch.js) can pull the cull line
// in without touching this file. Desktop never calls it and the value is unchanged.
let HIDE_D=150;
// v130.3 THE CULL LINE AND THE FOG ARE ONE NUMBER NOW, and this setter is where that becomes true.
// ART-DIRECTION §4.2: fog.far must EQUAL HIDE_D and fog.near must be half of it, because the fog
// is the only thing hiding the cull. They were maintained independently and they drifted — fog ran
// 104 → 182 while this setter pulls the line to 105 (mobile) or 88 (battery saver). At 88 the fog
// factor is 0.01, so a phone player watched whole stands of trees APPEAR AT FULL SATURATION ninety
// units away every time the camera moved; desktop was subtler and still wrong, deleting trees at
// 41% opacity. Bind them and the saver can put the cull line wherever the battery needs it while
// the seam stays invisible on every device, with no second number for anyone to remember.
// __setFogRange (01-engine.js) writes scene.fog AND the ink shader's private copy of the range in
// the same call — the outlines reimplement linear fog by hand and will fog on a different curve
// from their own bodies if they are missed (§10.13).
function setHideD(v){
  HIDE_D=Math.max(40,Math.min(400,v));
  if(window.__setFogRange)window.__setFogRange(HIDE_D);
}
// Desktop never calls the setter, so apply the desktop case once at load — otherwise the two
// numbers only ever agree on a phone, and 01-engine.js's constants are a second copy waiting to
// rot rather than a default.
if(window.__setFogRange)window.__setFogRange(HIDE_D);
function applyLOD(){
  const cx=camera.position.x, cz=camera.position.z;
  const blues=[], bblds=[];
  for(const u of units)if(u.alive&&u.team===MYTEAM)blues.push({x:u.root.position.x,z:u.root.position.z,vr:u.isPlayer?84:FOW_VISION});
  for(const b of buildings)if(b.alive&&b.team===MYTEAM)bblds.push(b);
  const seen=(x,z)=>{
    if(FOW_REVEAL)return true;
    for(const p of blues)if(dist2(x,z,p.x,p.z)<p.vr*p.vr)return true;
    for(const b of bblds){
      const vr=(b.built&&b.def.vision)?b.def.vision:FOW_VISION+6; // watch towers & castles see far
      if(dist2(x,z,b.x,b.z)<vr*vr)return true;
    }
    return false;
  };
  for(const u of units){
    const p=u.root.position;
    const dc=dist2(cx,cz,p.x,p.z);
    u.fow=u.team===BLUE?true:seen(p.x,p.z);
    // STRICT booleans: three.js only culls on visible===false — a truthiness leak here once
    // rendered the shore's unspawned raiders as standing, unattackable ghosts (v82 fix)
    const vis=!!(u.fow&&dc<HIDE_D*HIDE_D&&(u.alive||u.dieT>0||u.corpse));
    u.root.visible=vis;
    u.lodSkipAnim=!vis; // if you can see them, they move
    if(u.bar)u.bar.visible=!!(vis&&dc<BAR_D*BAR_D);
  }
  for(const b of buildings){
    if(!b.alive)continue;
    b.fow=b.team===BLUE?true:(FOW_REVEAL||seen(b.x,b.z));
    b.root.visible=b.fow; // the enemy base stays dark until scouted
  }
  for(const t of worldDeco)
    t.visible=dist2(cx,cz,t.position.x,t.position.z)<HIDE_D*HIDE_D;
}
function updateUnitCommon(u,dt){
  // combat clocks are SIMULATION, not animation: they tick for every unit,
  // seen or unseen — a frozen atkT once locked far-away fights solid
  // DESPERATION (v132.30): +0.5% attack speed per 1% of health missing. This scales the CLOCK,
  // not u.cd — u.cd is a STAT recomputed by applyBuffStats and cannot see live HP, and the
  // "u.atkT=u.cd" reset appears at ten separate call sites. One place, once.
  {
    const fv=buffSt(u,"fervor");
    let _sw=dt;
    if(fv&&u.maxHp>0&&u.hp<u.maxHp)_sw=dt*(1+0.5*fv*(1-u.hp/u.maxHp));
    u.atkT=Math.max(0,u.atkT-_sw);
  }
  if(u.cls==="dragoon"){ // powder trickles back: one round per five seconds
    if(u.ammo===undefined)u.ammo=6; // v84: NO regen — six rounds a life; re-arming as a dragoon reloads
  }
  if(u.swing>0)u.swing-=dt;
  if(u.attackAnimT>0)u.attackAnimT-=dt;
  if(!u.garrison){
    // v131.24 …unless the player is on a wall walkway, which is a floor the terrain knows nothing
    // about. Same exemption shape the garrison already uses, and player-only by the owner's scoping.
    // >>> v131.34 YOU HAVE TO BE ABLE TO REACH A SURFACE TO STAND ON IT. <<<
    // John: "the ramps on the walls dont even have to be used, you can kind of just walk up to wall
    // and pop up on to the top of it which is kind of janky."
    // The COLLIDER has a step tolerance -- 05-combat.js only waives the wall for a body already
    // within 1.2 of the deck -- and this line, which is what actually MOVES the body, had none. It
    // took whatever wallFloorAt returned, unconditionally. wallFloorAt returns the deck height 4.0
    // across the deck's whole XZ footprint, and that footprint runs from z -3.4 to +1.0 while the
    // wall's collision box is only +-1.30 -- so there is a two-unit strip behind every curtain that
    // is inside the deck and outside the blocker. Walk into it at ground level and this line
    // teleported you from 0.14 to 4.00 in one frame. That is the pop, and the ramp was decorative.
    // Same test as the collider, in the same words, so the two cannot drift: a floor you could not
    // step onto is not a floor, and you fall through to the terrain instead.
    let _wf=((u.isPlayer||u.remote)&&typeof wallFloorAt==="function")?wallFloorAt(u.root.position.x,u.root.position.z):null;
    if(_wf!==null&&!(u.root.position.y>_wf-1.2))_wf=null;   // 05-combat.js:735, verbatim
    u.root.position.y=(_wf!==null)?_wf:terrainHeight(u.root.position.x,u.root.position.z); // hug the hills
  }
  if(u.bar&&!u.isPlayer){ // bars earn their place: only the wounded show one
    const show=u.alive&&u.hp<u.maxHp-0.5;
    u.bar.bg.visible=u.bar.fg.visible=show;
  }
  // smooth facing
  let da=u.facing-u.body.rotation.y;
  while(da>Math.PI)da-=Math.PI*2; while(da<-Math.PI)da+=Math.PI*2;
  u.body.rotation.y+=da*Math.min(1,dt*12);
  if(!u.lodSkipAnim)animateUnit(u,dt);
  if(u.rig&&(u.rig.goods||u.rig.logs))updateCargoVisual(u); // v99: carts wear their cargo
}
// ============================================================
// QUESTING & THE BLACKSMITH (v87) — host/solo authoritative.
// Humans only (the host player and possessed guests). Guests interact through
// the host's E handling in driveRemote; their HUD rides "qst"/"bff" events.
// ============================================================
function questNotify(u,m,tone){ // a quest message finds its owner, wherever they sit
  if(u.isPlayer)msg(m,tone);
  else if(u.remote&&typeof NET!=="undefined"&&NET.mode==="host"){
    const r=NET.remotes[u.remote]; if(r)NET.note(r,m,tone);
  }
}
function syncQuest(u){ // the owner's private quest/level state → their HUD
  if(typeof NET==="undefined"||NET.mode!=="host"||!u.remote)return;
  const r=NET.remotes[u.remote]; if(!r)return;
  try{r.conn.send({t:"qst",l:u.lvl||0,x:u.xp||0,qi:u.quest?u.quest.i:-1,qp:u.quest?u.quest.prog:0});}catch(_){}
}
function syncBuffs(u){
  if(typeof NET==="undefined"||NET.mode!=="host"||!u.remote)return;
  const r=NET.remotes[u.remote]; if(!r)return;
  try{r.conn.send({t:"bff",b:u.buffs||{},x:u.xp||0});}catch(_){}
}
// v99 THE QUEST DRAFT: the board posts THREE random quests — you take ONE. The trio
// STANDS until a choice is made (no walking away to fish). Rerolls are BANKED, one
// per level gained, and a redraw wipes the board for a fresh trio.
function questDraft(u){ // roll, or recall, the standing trio
  // v132.28: guard on NON-EMPTY, not on ===3. Once the bag is age-filtered a short board is
  // possible, and a ===3 guard would re-roll the trio on every call — the posting would shift
  // under the player and the v99 "the trio STANDS until you choose" contract would be gone.
  if(u.questDraft&&u.questDraft.length)return u.questDraft;
  // v132.28: deal only what this team's age has unlocked. teamAge is an ARRAY (00-data.js:751).
  const age=Math.max(0,Math.min(5,(typeof teamAge!=="undefined"&&teamAge[u.team])||0));
  let bag=[];
  for(let i=0;i<QUESTS.length;i++)if((QUESTS[i].age||0)<=age)bag.push(i);
  if(!bag.length)for(let i=0;i<QUESTS.length;i++)bag.push(i); // never hand back an empty board
  const picks=[];
  while(picks.length<3&&bag.length)picks.push(bag.splice((Math.random()*bag.length)|0,1)[0]);
  u.questDraft=picks;
  return picks;
}
function questPick(u,qi){ // take one of the three postings — host/solo authoritative
  if(u.quest||!QUESTS[qi])return false;
  if(!u.questDraft||u.questDraft.indexOf(qi)<0)return false; // only what's posted
  if((u.lvl||0)>=XP_MAX_LVL)return false;
  u.questDraft=null;
  u.quest={i:qi,prog:0}; u._scoutOut=false;
  const Q=QUESTS[qi];
  questNotify(u,"📜 QUEST TAKEN — "+Q.name+": "+Q.desc+(Q.xp>1?" (worth "+Q.xp+" LEVELS!)":""),"gold");
  syncQuest(u); if(u.isPlayer)updateQuestHud();
  return true;
}
function questRedraw(u){ // spend a banked reroll on a fresh trio
  if((u.qRerolls||0)<1)return false;
  u.qRerolls--; u.questDraft=null; questDraft(u);
  questNotify(u,"📜 The board is wiped and reposted — "+u.qRerolls+" reroll"+(u.qRerolls===1?"":"s")+" banked.","gold");
  return true;
}
function questProgress(u,ev,n){ // host/solo: bump the active quest if the event matches
  if(!isHuman(u)||!u.alive||!u.quest)return;
  const Q=QUESTS[u.quest.i]; if(Q.ev!==ev)return;
  u.quest.prog+=(n||1);
  if(u.quest.prog>=Q.n)completeQuest(u);
  else{
    if((n||1)===1||Q.n<=20) // counting quests chirp every tick; the 200-resource grinds stay quiet
      questNotify(u,"📜 "+Q.name+": "+Math.min(u.quest.prog,Q.n)+"/"+Q.n,"blue");
    syncQuest(u); if(u.isPlayer)updateQuestHud();
  }
}
function completeQuest(u){
  const Q=QUESTS[u.quest.i];
  u.quest=null;
  u.xp=(u.xp||0)+Q.xp; u.lvl=Math.min(XP_MAX_LVL,(u.lvl||0)+Q.xp);
  // v132.28.2: rerolls are NO LONGER banked per level. questTick grants one each time the player
  // becomes free to take a posting, capped at QUEST_REROLL_MAX. Clearing u.quest above is what
  // arms that grant, so finishing a quest still earns one — just by the general rule, and without
  // camp/raid participation levels minting rerolls as a side effect.
  awardPts(u,25*Q.xp); // deeds are honored on the scoreboard too
  questNotify(u,"🏅 QUEST COMPLETE — "+Q.name+"! +"+Q.xp+" level"+(Q.xp>1?"s":"")+" & +"+Q.xp+" XP (spend it at the Blacksmith). The Town Board has more work.","gold");
  if(typeof Sound!=="undefined"&&u.isPlayer)Sound.play("alert_quest"); // v100: quest-complete fanfare
  syncQuest(u); if(u.isPlayer)updateQuestHud();
}
function questDeposit(u,f,g,s,w){ // banked resources feed the collection quests
  if(f)questProgress(u,"dep_food",f);
  if(g)questProgress(u,"dep_gold",g);
  if(s)questProgress(u,"dep_stone",s);
  if(w)questProgress(u,"dep_wood",w);
}
function boardFor(team){for(const b of townBoards)if(b.team===team)return b;return null;}
function useTownBoard(u){ // E at the board (host/solo; guests arrive via driveRemote)
  if(u.quest){ // a posting in hand: E reads the progress
    const Q=QUESTS[u.quest.i];
    questNotify(u,"📜 "+Q.name+": "+u.quest.prog+"/"+Q.n+" — "+Q.desc+".","blue");
    return;
  }
  if((u.lvl||0)>=XP_MAX_LVL){questNotify(u,"⭐ MAX LEVEL ("+XP_MAX_LVL+") — the board has nothing left to teach you.","gold");return;}
  const offer=questDraft(u); // v99: the board POSTS three — the menu takes it from here
  if(u.isPlayer)openBoardMenu(offer);
  else if(u.remote&&typeof NET!=="undefined"&&NET.mode==="host"){
    const r=NET.remotes[u.remote];
    if(r)try{r.conn.send({t:"qdraft",offer:offer.slice(),rr:u.qRerolls||0});}catch(_){}
  }
}
// v99: the yellow "!" over YOUR team's Town Board whenever you stand questless.
let _boardBang=null,_bangT=0;
function tickBoardBang(dt){
  if(typeof boardFor!=="function"||typeof MYTEAM==="undefined")return;
  const brd=boardFor(MYTEAM); if(!brd)return;
  if(!_boardBang){
    const g=new THREE.Group();
    const m=new THREE.MeshBasicMaterial({color:0xf2c94c});
    const bar=new THREE.Mesh(new THREE.BoxGeometry(0.34,1.2,0.34),m); bar.position.y=0.85; g.add(bar);
    const dot=new THREE.Mesh(new THREE.BoxGeometry(0.36,0.32,0.36),m); dot.position.y=-0.12; g.add(dot);
    scene.add(g); _boardBang=g;
  }
  _bangT+=dt;
  _boardBang.position.set(brd.x,terrainHeight(brd.x,brd.z)+5.0+Math.sin(_bangT*3)*0.25,brd.z); // MYTEAM flips on possession — follow the right board
  _boardBang.rotation.y+=dt*1.3;
  _boardBang.visible=!!(player&&player.alive&&!player.quest&&(player.lvl||0)<XP_MAX_LVL&&!gameOver&&!inMenu);
}
// v93: the forge deals THREE random buffs — you choose ONE. The trio STANDS until a
// choice is made (walking away and returning shows the same three — no E-spam fishing).
function smithOffer(u){ // roll, or recall, the standing offer
  if((u.xp||0)<1)return null;
  const pool=BUFFS.filter(b=>buffSt(u,b.id)<buffMax(b.id)); // maxed buffs never deal in
  if(!pool.length)return null;
  if(u.smithOffer&&u.smithOffer.length){ // the standing offer — pruned of anything since maxed
    u.smithOffer=u.smithOffer.filter(id=>buffSt(u,id)<buffMax(id));
    if(u.smithOffer.length)return u.smithOffer;
  }
  const bag=pool.slice(), picks=[];
  while(picks.length<3&&bag.length)picks.push(bag.splice((Math.random()*bag.length)|0,1)[0].id);
  u.smithOffer=picks;
  return u.smithOffer;
}
function smithPick(u,id){ // spend 1 XP on ONE of the three on the table — host/solo authoritative
  if((u.xp||0)<1)return false;
  if(!u.smithOffer||u.smithOffer.indexOf(id)<0)return false; // only what's on the table
  if(buffSt(u,id)>=buffMax(id))return false;
  const B=BUFFS.find(b=>b.id===id); if(!B)return false;
  u.xp--; u.buffs=u.buffs||{};
  u.buffs[id]=Math.min(buffMax(id),(u.buffs[id]||0)+1);
  u.smithOffer=null; // chosen: the next visit deals a fresh trio
  applyBuffStats(u);
  questNotify(u,"🔨 "+B.name+" — "+B.desc+" (stack "+u.buffs[id]+"/"+buffMax(id)+"). XP left: "+u.xp,"gold");
  if(typeof Sound!=="undefined"&&u.isPlayer)Sound.play("alert_buff"); // v100: buff-gained shing
  syncBuffs(u); syncQuest(u); if(u.isPlayer){updateQuestHud();updatePlayerHud();}
  return true;
}
function useBlacksmith(u){ // E at the forge: put the trio on the table
  if((u.xp||0)<1){questNotify(u,"🔨 The smith wants XP — finish Town Board quests to earn it.","warn");return;}
  const offer=smithOffer(u);
  if(!offer){questNotify(u,"🔨 Every buff already rings at full strength — a living legend.","gold");return;}
  if(u.isPlayer)openSmithMenu(offer); // host/solo: the menu opens right here
  else if(u.remote&&typeof NET!=="undefined"&&NET.mode==="host"){ // guest: ship the trio to their screen
    const r=NET.remotes[u.remote];
    if(r)try{r.conn.send({t:"smith",offer:offer.slice(),xp:u.xp});}catch(_){}
  }
}
function grantBuff(u,id){ // direct grant (tests & future scripted rewards)
  u.buffs=u.buffs||{};
  u.buffs[id]=Math.min(buffMax(id),(u.buffs[id]||0)+1);
  applyBuffStats(u); syncBuffs(u);
}
function bazaarTier(team,nm){ // 0 = nearest bazaar to YOUR throne, 1 = middle, 2 = farthest
  const d=dist2(TCPOS[team][0],TCPOS[team][1],nm.x,nm.z);
  let tier=0;
  for(const m of neutralMarkets)if(dist2(TCPOS[team][0],TCPOS[team][1],m.x,m.z)<d-0.01)tier++;
  return tier;
}
function questTradeSale(u,nm){ // a trader's sale advances the route quests
  const tier=bazaarTier(u.team,nm);
  questProgress(u,tier===0?"trade_short":tier===1?"trade_mid":"trade_long");
}
let _captains=[]; // cache: humans carrying the Captain's Banner (refreshed each questTick)
function questTick(dt){ // host/solo: scout-quest geometry, Second Skin regen, captain cache
  _captains.length=0;
  for(const u of units){
    if(!isHuman(u)||!u.alive)continue;
    // v132.34: tmodTick MOVED to the host unit loop (statusTick) so debuffs reach non-humans.
    // Ticking here as well would run every human's clock twice a frame.
    // ---- v132.28.2 ONE REROLL PER QUEST OPPORTUNITY, capped at QUEST_REROLL_MAX ----
    // Fires on the TRANSITION into questlessness, so it covers a fresh life, a finished quest and
    // a respawn with one rule, and cannot pay twice for the same opportunity.
    if(!u.quest){
      if(!u._rrCycle){
        u._rrCycle=true;
        if((u.qRerolls||0)<QUEST_REROLL_MAX){
          u.qRerolls=(u.qRerolls||0)+1;
          questNotify(u,"📜 The board has fresh work — "+u.qRerolls+" reroll"+
            (u.qRerolls===1?"":"s")+" banked"+((u.qRerolls>=QUEST_REROLL_MAX)?" (full)":"")+".","blue");
          syncQuest(u);
        }
      }
    }else u._rrCycle=false;
    if(buffSt(u,"captain"))_captains.push(u);
    const rst=buffSt(u,"regen"); // SECOND SKIN: knit closed after 5 quiet seconds
    if(rst&&u.hp<u.maxHp&&T-(u._lastHurt||-99)>5){
      u.hp=Math.min(u.maxHp,u.hp+0.5*rst*dt);
      setBar(u.bar,u.hp/u.maxHp);
      if(u.isPlayer)updatePlayerHud();
    }
    if(u.quest&&QUESTS[u.quest.i].ev==="scout"){ // EYES ON THE THRONE
      const px=u.root.position.x,pz=u.root.position.z;
      const etc=teamTC(u.team===BLUE?RED:BLUE), otc=teamTC(u.team);
      if(!u._scoutOut){
        if(etc&&dist2(px,pz,etc.x,etc.z)<25*25){
          u._scoutOut=true;
          questNotify(u,"👁 You have SEEN the enemy throne — now get home ALIVE!","gold");
        }
      }else if(otc&&dist2(px,pz,otc.x,otc.z)<40*40)questProgress(u,"scout");
    }
  }
}
// team economy trickle: each age grants +1/sec of EVERY resource (Stone=1 … Enlightenment=6),
// plus 0.5 food/sec from every standing farm — worked farms add gathering on top
const FARM_PASSIVE=2/3; // v113: 2 food every 3 seconds (John's call — v86's 0.5/sec cut too deep).
                        // Still under the pre-v86 1/sec; harvesting on top is untouched.
let ecoAccum=0, cropAccum=0;
function economyTick(dt){
  ecoAccum+=dt; if(ecoAccum<0.5)return;
  const step=ecoAccum; ecoAccum=0;
  // v94: a pure-AI team on HARD runs its economy 20% hot (the classic RTS handicap)
  const ecoMul=[
    (AI_DIFF[diffFor(BLUE)]||AI_DIFF.normal).eco,
    (AI_DIFF[diffFor(RED)]||AI_DIFF.normal).eco];
  for(const t of [BLUE,RED]){
    const r=(teamAge[t]+1)*step*ecoMul[t];
    stock[t].food+=r; stock[t].gold+=r; stock[t].stone+=r; stock[t].wood+=r;
  }
  cropAccum+=step;
  const growNow=cropAccum>=5?cropAccum:0; if(growNow)cropAccum=0;
  for(const b of buildings)
    if(b.alive&&b.built&&b.type==="farm"){
      stock[b.team].food+=step*FARM_PASSIVE*(ecoMul[b.team]||1);
      if(growNow&&b.crop<1){ // the corn grows in 5-second strides — same 45s to ripen
        b.crop=Math.min(1,(b.crop||0)+growNow/45);
        if(b.cropMesh)b.cropMesh.scale.y=0.15+0.85*b.crop;
        if(b.crop>=1&&b.tassels)for(const t of b.tassels)t.visible=true;
      }
    }
  updateResHud();
}
// temples and priests slowly mend nearby allies
let healAccum=0;
function healTick(dt){
  healAccum+=dt; if(healAccum<0.5)return;
  const step=healAccum; healAccum=0;
  const sources=[];
  for(const b of buildings)
    if(b.alive&&b.built&&b.def.heal)sources.push({team:b.team,x:b.x,z:b.z,rng:b.def.heal.rng,rate:b.def.heal.rate});
  for(const u of units)
    if(u.alive&&CLS[u.cls].heal)sources.push({team:u.team,x:u.root.position.x,z:u.root.position.z,
      rng:CLS[u.cls].heal.rng,rate:CLS[u.cls].heal.rate,unit:u});
  if(!sources.length)return;
  for(const u of units){
    if(!u.alive||u.hp>=u.maxHp)continue;
    if(typeof healBlocked==="function"&&healBlocked(u))continue; // v132.34 DEEP GASH
    if(u.isKing)continue; // no priest can mend a king — regicide must stick
    for(const s of sources){
      if(s.team!==u.team)continue;
      if(dist2(u.root.position.x,u.root.position.z,s.x,s.z)<s.rng*s.rng){
        const healed=Math.min(u.maxHp,u.hp+s.rate*step)-u.hp;
        u.hp+=healed;
        if(s.unit)awardPts(s.unit,healed); // a point per HP mended
        // v132.28 FIELD SURGEON. `healed` is already clamped against maxHp above, so overheal
        // cannot inflate it. n:200 sits above the chirp threshold (Q.n<=20), so the fractions
        // accumulate without spamming the notifier.
        if(s.unit&&healed>0&&typeof questProgress==="function")questProgress(s.unit,"heal_hp",healed);
        setBar(u.bar,u.hp/u.maxHp);
        if(Math.random()<0.5)puff(u.root.position.x,2.7,u.root.position.z,0x6fdc7a);
        if(u.isPlayer)updatePlayerHud();
        if(u.isKing)updateKingBars();
        break;
      }
    }
  }
}
function towerTarget(b){ // nearest enemy in the works' range
  let best=null,bd=b.def.atk.rng*b.def.atk.rng;
  for(const v of units){
    if(v.team===b.team||!v.alive||v.garrison)continue; // castles can't pick off tower sentries
    const d=dist2(b.x,b.z,v.root.position.x,v.root.position.z);
    if(d<bd){bd=d;best=v;}
  }
  return best;
}
function updateTowers(dt){
  for(const b of buildings){
    if(!b.alive||!b.built||!b.def.atk)continue; // guard towers AND castles fire
    b.atkT=Math.max(0,b.atkT-dt);
    const A=b.def.atk;
    if(A.volley){ // v84 CASTLE: five arrows in rapid succession, then the long wind-down
      if(b.vLeft>0){
        b.vT=Math.max(0,(b.vT||0)-dt);
        if(b.vT<=0){
          const t=towerTarget(b); // re-acquired per arrow — the volley sweeps across the crowd
          if(t){shootArrow(b,t); b.vLeft--; b.vT=A.vcd;}
          else b.vLeft=0; // nothing left standing: the volley dies early
          if(b.vLeft<=0)b.atkT=A.cd;
        }
        continue;
      }
      if(b.atkT>0)continue;
      if(towerTarget(b)){b.vLeft=A.volley;b.vT=0;} // the murder-holes open
      continue;
    }
    if(b.atkT>0)continue;
    const best=towerTarget(b);
    if(best){b.atkT=A.cd;shootArrow(b,best);}
  }
}
// crash reporter: an error no longer freezes the game — it reports and carries on
let crashReported=false;
function reportCrash(e){
  console.error("GAME ERROR:",e);
  if(crashReported)return;
  crashReported=true;
  try{msg("⚠ GAME ERROR: "+(e&&e.message||e)+" — press F12, screenshot the red text in Console, and send it!","warn");}catch(_){}
}
addEventListener("error",ev=>reportCrash(ev.error||ev.message));
let lastRAF=0;
// Chrome throttles rAF in OCCLUDED windows (even un-minimized ones) to ~1-4fps.
// A hosting window must never stop the world: this heartbeat keeps the sim
// running at 30Hz whenever rAF goes quiet, so guests keep getting snapshots.
setInterval(()=>{
  if(typeof NET==="undefined"||NET.mode!=="host")return;
  if(performance.now()-lastRAF>120)tickBody(true); // sim only — no wasted draws
},33);
function tick(){
  requestAnimationFrame(tick);
  lastRAF=performance.now();
  try{tickBody();}catch(e){reportCrash(e);}
}
function tickBody(skipRender){
  const dt=Math.min(0.05,clock.getDelta());
  // MULTIPLAYER — guests do not simulate: the host's snapshots are the truth.
  if(typeof NET!=="undefined"&&NET.mode==="guest"){NET.guestFrame(dt);renderFrame(dt);return;}
  // MAIN MENU — the whole war holds its breath until a mode is chosen
  if(inMenu){if(!skipRender)renderFrame(dt);return;}
  if(!gameOver){
    T+=dt;
    // team AI directors (economy, construction, training, raids) — HARD thinks faster, EASY slower (v94)
    for(const D of directors){ if(T>D.nextThink){D.nextThink=T+(AI_DIFF[diffFor(D.team)]||AI_DIFF.normal).think; directorThink(D);} }
    // hints
    while(hintI<hints.length&&T>hints[hintI][0]){msg(hints[hintI][1]);hintI++;}
    updatePlayer(dt);
    for(const u of units){
      if(!u.alive){
        if(u.dieT>0){ // topple and sink into the hillside
          u.dieT-=dt;
          const f=1-Math.max(0,u.dieT)/0.9;
          const gy=terrainHeight(u.root.position.x,u.root.position.z);
          u.body.rotation.x=-f*Math.PI/2;
          u.root.position.y=gy-f*0.3;
          if(u.dieT<=0){
            if(u.corpse){u.body.rotation.x=-Math.PI/2;u.root.position.y=gy;} // lie flat on the field, still visible
            else{u.root.visible=false;u.body.rotation.x=0;u.root.position.y=gy;} // carts & the like just vanish
          }
        }
        u.respawnT-=dt;
        if(u.respawnT<=0)respawnUnit(u);
        continue;
      }
      updateUnitCommon(u,dt);
      // v132.34: the timed system ticks for EVERY unit here — host-only, once per frame. It used
      // to run inside questTick, which walks humans alone; a poisoned creep would never have
      // burned down. Ticking in both places would halve every duration in Batch B.
      if(typeof statusTick==="function")statusTick(u,dt);
      if(typeof isStunned==="function"&&isStunned(u))u.atkT=Math.max(u.atkT,tmodSum(u,"stun")>0?0.2:0);
      if(u.bot&&!u.isPlayer)updateBot(u,dt);
    }
    separate();
    drainVisualQueue(); // restyle wave + coalesced road rebuilds, a few jobs a frame
    economyTick(dt);
    tickAgeResearch(dt,true); // v107: the 90s advance — authoritative on host/solo, the age fires at 0
    healTick(dt);
    questTick(dt); // v87: scout-quest geometry, Second Skin regen, captain cache
    tickBoardBang(dt); // v99: the questless "!" over the board
    if(typeof Sound!=="undefined")Sound.tick(dt); // v100: ambience bed + nearby-march driver
    campTick(dt); // creep camps: chests, steals, the three-minute clock
    bazaarTick(dt); // v132.26 the three bazaars change hands, and pay whoever holds them
    updateTowers(dt);
    updateProjectiles(dt);
    updateEffects(dt);
    rosterAccum+=dt; if(rosterAccum>0.5){rosterAccum=0;updateRoster();}
    drawMinimap();
    // MULTIPLAYER — host drives guest bodies and broadcasts snapshots
    if(typeof NET!=="undefined"&&NET.mode==="host")NET.hostFrame(dt);
  }
  if(!skipRender)renderFrame(dt);
}
// v128.8 THE BANNER THAT NEVER LEFT. The objective ribbon's fade lived inside tickBody's
// `if(!gameOver)` block — which a GUEST NEVER REACHES, because tickBody returns at the guest
// branch above and hands the frame to NET.guestFrame. So "⚔ Slay the enemy King before yours
// falls" sat across the top of the screen for the entire match on every guest, host and mobile
// alike. Trap #12 in the handoff, word for word: anything display-only added to the host branch
// must be added to guestFrame too.
//
// It lives in renderFrame now, which is the ONE function all three frame paths provably call —
// guest (631), menu (633) and host (678) — so it cannot fall out of step again.
//
// And it counts WALL time, not sim time. `T` is the match clock, which a guest adopts from the
// host's snapshots: a guest joining a ten-minute-old match arrives with T=600 and would never
// see the banner at all. Twenty real seconds from the moment this client entered the war is the
// same for everyone.
function tickObjectiveFade(){
  if(window._objFaded||inMenu)return;
  const now=(typeof NET!=="undefined"&&NET.now)?NET.now():Date.now();
  if(!window._objAt){window._objAt=now;return;}
  if(now-window._objAt<20000)return;
  window._objFaded=true;
  const o=document.getElementById("objective");
  if(!o)return;
  o.style.opacity="0";
  setTimeout(()=>{o.style.display="none";},1100);
}
// camera chase + atmosphere + draw — shared by the host/solo sim and the guest's thin frame
function renderFrame(dt){
  tickObjectiveFade();
  // v129.3 THE MENU BED. Same reasoning as the fade above, and the same reason it lives HERE:
  // Sound.tick never runs while inMenu (tickBody returns at the menu branch below), so the menu
  // track cannot ride musTick. renderFrame is the one function all three frame paths call.
  // v129.4: …and it does not play on the NAME screen. NET.wantMenuBed() is the latch — see
  // NET.uiScreen. The typeof guards keep this honest against an older 10-net.js.
  if(typeof Sound!=="undefined"&&Sound.menuTick){
    const bed=inMenu&&(typeof NET==="undefined"||typeof NET.wantMenuBed!=="function"||NET.wantMenuBed());
    Sound.menuTick(bed,dt);
  }
  if(inMenu){ // MAIN MENU: a slow cinematic orbit over the sleeping kingdoms
    menuOrbitT+=dt;
    const ma=menuOrbitT*0.045;
    camera.position.lerp(new THREE.Vector3(Math.cos(ma)*135,60,Math.sin(ma)*88),0.02);
    camera.lookAt(0,2,0);
    // (the sky dome, the cloud field, the dust box and the sun disc all pin themselves to the
    //  camera from scene.onBeforeRender in 01-engine.js — see the note there for why they moved)
    lodT-=dt; if(lodT<=0){lodT=0.15;applyLOD();}
    frameNo++;
    for(const c of clouds){c.position.x+=0.6*(1/60); if(c.position.x>CLOUD_WRAP)c.position.x=-CLOUD_WRAP;} // the sky never waits
    if(composer)composer.render(); else renderer.render(scene,camera);
    return;
  }
  const p=player.root.position;
  if(typeof bazaarDraw==="function")bazaarDraw(); // v132.26 pure render state, host and guest alike
  if(typeof setGarrisonView==="function")setGarrisonView(player.garrison||null); // see 03-buildings.js
  if(siegeAim){ // THE SKILL SHOT: rise above the engine, mark the fall of the stone
    const fx=-Math.sin(camYaw),fz=-Math.cos(camYaw);
    const maxD=player.cls==="trebuchet"?player.rng+8:46;
    const dist=THREE.MathUtils.clamp((1.25-camPitch)*(maxD*0.78)+14,10,maxD);
    lobTarget.x=p.x+fx*dist; lobTarget.z=p.z+fz*dist;
    if(!lobRing){
      lobRing=new THREE.Group();
      const ring=new THREE.Mesh(new THREE.TorusGeometry(4.5,0.22,5,20),
        new THREE.MeshBasicMaterial({color:0xd23c3c}));
      ring.rotation.x=-Math.PI/2; lobRing.add(ring);
      const dot=new THREE.Mesh(new THREE.CircleGeometry(0.8,10),
        new THREE.MeshBasicMaterial({color:0xd23c3c,transparent:true,opacity:0.55}));
      dot.rotation.x=-Math.PI/2; dot.position.y=0.02; lobRing.add(dot);
      scene.add(lobRing);
    }
    lobRing.visible=true;
    lobRing.position.set(lobTarget.x,terrainHeight(lobTarget.x,lobTarget.z)+0.15,lobTarget.z);
    camera.position.lerp(new THREE.Vector3(p.x-fx*7,p.y+35,p.z-fz*7),0.055); // a gentle climb
    camera.lookAt(p.x+fx*dist*0.6,p.y,p.z+fz*dist*0.6);
  }else if(aiming&&player.alive&&(player.cls==="cannon"||player.cls==="culverin")){
    // the archer's aim model, but dead-centre over the gun's line
    if(lobRing)lobRing.visible=false;
    const fx=-Math.sin(camYaw),fz=-Math.cos(camYaw);
    const cpos=new THREE.Vector3(
      p.x-fx*8.5,
      p.y+Math.max(3.2,6.2+(camPitch-0.55)*5.5),
      p.z-fz*8.5);
    camera.position.lerp(cpos,0.4);
    camera.lookAt(p.x+fx*20, p.y+3.2+(0.55-camPitch)*9, p.z+fz*20);
  }else if(aiming&&player.alive){
    if(lobRing)lobRing.visible=false;
    // over-the-shoulder: camera sits behind-RIGHT and looks past you,
    // so your body sits left of frame and the crosshair stays clear
    const fx=-Math.sin(camYaw),fz=-Math.cos(camYaw);
    const rx=-fz,rz=fx;
    const cpos=new THREE.Vector3(
      p.x-fx*7.4+rx*2.4,
      p.y+Math.max(player.garrison?3.8:1.3,3.2+(camPitch-0.55)*5.5),
      p.z-fz*7.4+rz*2.4);
    camera.position.lerp(cpos,0.45);
    // On the ground p.y+1.9 at 17 out is a chest-high line. From a deck 11.8 up it tilts the aim
    // 11.3 degrees ABOVE the horizon: of 360 ground targets sampled on the 80-unit ring, ZERO
    // projected into the middle ninth of the frame while garrisoned. You were aiming at sky.
    camera.lookAt(p.x+fx*17+rx*2.4, p.y+(player.garrison?-1.6:1.9)+(0.55-camPitch)*8, p.z+fz*17+rz*2.4);
  }else{
    if(lobRing)lobRing.visible=false;
    const cx=p.x+camDist*Math.sin(camYaw)*Math.cos(camPitch);
    // 1.1 is right on the ground and wrong on a tower deck: it parks the lens 0.475 BELOW the
    // parapet crest (1.575) and under a cap seated at 1.7625, which is the whole complaint. The
    // measured eye height needed to see a man at 80 units with the cap hidden, worst age, runs
    // 3.55 at camDist 8 to 10.25 at 46; 2.2+0.18*camDist covers all 30 measured cells, worst
    // margin 0.23 (tools/towerfloor.js).
    const _floor=player.garrison?(2.2+0.18*camDist):1.1;
    const cy=p.y+Math.max(_floor,camDist*Math.sin(camPitch)+2); // ride the terrain, stay above grass
    const cz=p.z+camDist*Math.cos(camYaw)*Math.cos(camPitch);
    camera.position.lerp(new THREE.Vector3(cx,cy,cz),0.35);
    camera.lookAt(p.x,p.y+2,p.z);
  }
  // v130.3 THE SKY USED TO TRAVEL WITH YOU FROM HERE, AND ONLY FROM HERE — which meant it did not
  // travel at all in any tool that freezes the loop, i.e. in every render this overhaul is judged
  // on. It pins itself from scene.onBeforeRender now (01-engine.js), one call site for the dome,
  // the clouds, the dust and the sun disc, driven by whichever camera is actually rendering.
  lodT-=dt; if(lodT<=0){lodT=0.15;applyLOD();}
  frameNo++;
  renderer.shadowMap.needsUpdate=(frameNo%2===0); // shadows at half rate
  // v130.4 THE SUN'S SHADOW BOX USED TO BE AIMED FROM HERE, AT THE PLAYER'S FEET.
  // It left for the same reason the sky did: this function does not run inside tools/vista.js, so
  // every render the art pass is judged on was shot with the box parked wherever the player was
  // standing — 175 units from the town vantage, 200 from the forest one, i.e. off frame, i.e. no
  // shadows at all in the pictures the critic scores. ART-DIRECTION §3.8 wants it on the VIEW
  // anyway (the camera stands behind the player and looks past him), so it is `aimShadow` in
  // 01-engine.js now, called from scene.onBeforeRender off whichever camera is doing the rendering.
  // Do not re-add a player-parked sun here: two owners writing sun.position is how it drifted out
  // of agreement with the painted disc in the first place.
  // living atmosphere: clouds drift, dust motes swirl through the light
  // The wrap has to be WIDER than the field is, and it was not: the clouds are seeded on a ring of
  // radius 110–340 (01-engine.js), so every cloud that started past x=300 teleported to the far
  // side of the sky on the first frame of play — in plain view, since the field is pinned to the
  // camera. 360 clears the ring.
  for(const c of clouds){c.position.x+=0.6*(1/60); if(c.position.x>CLOUD_WRAP)c.position.x=-CLOUD_WRAP;}
  if(dustPts){
    const a=dustPts.geometry.attributes.position, tt=clock.elapsedTime;
    for(let i=0;i<a.count;i+=3){ // update a third per frame — plenty at mote speed
      a.array[i*3+1]+=Math.sin(tt*0.8+i)*0.004;
      a.array[i*3]+=Math.cos(tt*0.5+i*1.7)*0.006;
    }
    a.needsUpdate=true;
  }
  if(composer)composer.render(); else renderer.render(scene,camera);
}
updateResHud();updatePlayerHud();updateKingBars();updateAgeHud();
// (the "war begins" horn now sounds when a mode is chosen at the main menu)
tick();
