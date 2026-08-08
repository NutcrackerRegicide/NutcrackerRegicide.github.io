/* REGICIDE PVP — 05-combat.js */
// ---------- effects / projectiles ----------
function puff(x,y,z,color,scale,life){
  const s=new THREE.Sprite(new THREE.SpriteMaterial({color,transparent:true,opacity:0.9}));
  s.position.set(x,y,z); const sc=scale||0.7; s.scale.set(sc,sc,1); scene.add(s);
  effects.push({s,t:life||0.35});
}
function cannonPlume(f,mx,my,mz){ // the gun speaks: a flash and a modest roll of smoke
  const dx=Math.sin(f),dz=Math.cos(f);
  puff(mx,my,mz,0xffe9a8,0.9,0.14); // the muzzle flash
  const tones=[0xe8e8e8,0xc4c4c4,0x9c9c9c,0x7c7c7c];
  for(let i=0;i<4;i++){
    const t=i/3, spread=0.22+t*0.42;
    puff(mx+dx*(0.45+t*1.6)+(Math.random()-0.5)*spread,
         my+0.12+t*0.5+(Math.random()-0.5)*0.26,
         mz+dz*(0.45+t*1.6)+(Math.random()-0.5)*spread,
         tones[i],0.65+t*0.7,0.35+t*0.25);
  }
}
function hitFlash(u){
  puff(u.root.position.x,(u.cls==="scout"?2.6:1.8)+u.root.position.y,u.root.position.z,0xff3b2f);
}
function shootArrow(att,target){
  const c=att.def?null:CLS[att.cls];
  const siege=c&&isSiege(att.cls);
  // v100 SOUND — projectile launch. Runs on host (via the wrapper) AND on guests (fx theatre
  // replays call the unwrapped shootArrow directly), so both sides hear ranged & siege.
  if(typeof Sound!=="undefined"){
    const _sx=att.root?att.root.position.x:att.x, _sz=att.root?att.root.position.z:att.z;
    // v102: cannon powder-blast · catapult creak · musket gunshot · bow twang
    let _k="bow";
    if(siege)_k=(c&&c.rig==="cannon")?"cannonfire":"siegefire";
    else if(c&&c.rig==="musket")_k="gun";
    Sound.play(_k,{x:_sx,z:_sz});
  }
  let m;
  if(siege){
    m=new THREE.Mesh(new THREE.SphereGeometry(c.rig==="cannon"?0.2:0.32,6,5),
      mat(c.rig==="cannon"?0x2b2b2b:0x8d8d8d));
    m.castShadow=false;
  }else{
    m=cyl(0.05,0.05,0.9,0x4a3826,4); m.castShadow=false;
  }
  const y=att.cls==="scout"?2.4:(att.def&&att.type==="tower"?8:1.8);
  const sx=att.root?att.root.position.x:att.x, sz=att.root?att.root.position.z:att.z;
  const gy=att.root?att.root.position.y:0;
  m.position.set(sx,(att.def?8:y)+gy,sz);
  scene.add(m);
  const tx0=target.root?target.root.position.x:target.x, tz0=target.root?target.root.position.z:target.z;
  const d0=Math.hypot(tx0-(att.root?att.root.position.x:att.x),tz0-(att.root?att.root.position.z:att.z));
  if(c&&c.rig==="cannon"){ // recoil + the full plume
    att._recoil=0.4;
    const f=att.facing||0;
    cannonPlume(f,sx+Math.sin(f)*5.0,gy+3.4,sz+Math.cos(f)*5.0);
  }
  projectiles.push({m,target,spd:siege?(c.rig==="treb"?19:(c.rig==="cannon"?69:23)):30,life:siege?4:2.2,att,
    dmg:att.def?att.def.atk.dmg:att.dmg,attCls:att.def?null:att.cls,baseY:m.position.y,ignoreB:att.garrison||null,
    splash:c&&c.splash,arcH:(c&&c.arc)?Math.min(9,d0*0.22):0,total:Math.max(1,d0),
    bMult:c?(c.bMult||1):1});
}
function splashDamage(att,x,z,r,dmg){ // the stone lands: everything nearby suffers
  for(const v of units){
    if(!v.alive||v.garrison||(att&&v.team===att.team))continue;
    const d=Math.sqrt(dist2(x,z,v.root.position.x,v.root.position.z));
    if(d<r)dealDamage(att,v,dmg*(1-0.6*d/r));
  }
  for(const b of buildings){
    if(!b.alive||(att&&b.team===att.team))continue;
    const d=Math.sqrt(dist2(x,z,b.x,b.z));
    if(d<r+b.def.r*0.6)damageBuilding(b,dmg*0.8,att);
  }
}
function launchLob(att,tx,tz,theatre){ // catapult & trebuchet skill shot
  const sx=att.root.position.x, sz=att.root.position.z;
  const dist=Math.hypot(tx-sx,tz-sz);
  const m=new THREE.Mesh(new THREE.SphereGeometry(att.cls==="trebuchet"?0.55:0.42,6,5),mat(0x8d8d8d));
  m.castShadow=false; m.position.set(sx,att.root.position.y+5,sz); scene.add(m);
  projectiles.push({lob:1,m,att:theatre?null:att,x0:sx,z0:sz,y0:att.root.position.y+5,tx,tz,
    t:0,dur:dist/17+0.85,peak:9+dist*0.24,dmg:att.dmg,life:20});
  att.swing=0.25; triggerAttackAnim(att);
  if(typeof Sound!=="undefined")Sound.play("siegefire",{x:att.root.position.x,z:att.root.position.z}); // v100
  if(typeof NET!=="undefined"&&NET.mode==="host"&&!theatre)
    NET.bcast({t:"lob",uid:att.id,tx:r1(tx),tz:r1(tz)});
}
function updateProjectiles(dt){
  for(let i=projectiles.length-1;i>=0;i--){
    const p=projectiles[i]; p.life-=dt;
    if(p.lob){ // the skill shot: a heavy stone on a fixed arc
      p.t+=dt;
      const k=Math.min(1,p.t/p.dur);
      p.m.position.x=p.x0+(p.tx-p.x0)*k;
      p.m.position.z=p.z0+(p.tz-p.z0)*k;
      const gy=terrainHeight(p.m.position.x,p.m.position.z);
      p.m.position.y=p.y0+(gy+0.3-p.y0)*k+Math.sin(k*Math.PI)*p.peak;
      p.m.rotation.x+=dt*4;
      if(k>=1){
        puff(p.tx,gy+0.6,p.tz,0x9a8a6a); puff(p.tx+0.7,gy+0.4,p.tz-0.5,0x7a6a4a); puff(p.tx-0.6,gy+0.5,p.tz+0.6,0x8a7a5a);
        if(p.att)splashDamage(p.att,p.tx,p.tz,4.5,p.dmg);
        scene.remove(p.m); projectiles.splice(i,1);
      }
      continue;
    }
    if(p.free){ // manually aimed straight shot
      // v128.5 THE ARROW USED TO STEP OVER PEOPLE. dt is clamped to 0.05 (09-main), and a
      // full-draw arrow flies at 36×1.6 = 57.6 u/s — up to 2.88 units per step against a hit
      // DIAMETER of 2.24. A single point-in-circle test per step therefore missed cleanly
      // through a body whenever the frame was long, and the host was measured pegged at that
      // clamp (17fps median), so this was the normal case rather than an edge one. Sweep the
      // segment the arrow actually travelled instead. Costs nothing and it fixes the host's
      // own shots as well as every guest's.
      const _px=p.m.position.x, _pz=p.m.position.z;
      p.m.position.addScaledVector(p.vel,dt);
      p.traveled+=p.spd*dt;
      let done=p.traveled>p.maxRange||p.life<=0;
      if(!done&&p.m.position.y<terrainHeight(p.m.position.x,p.m.position.z)+0.15){
        puff(p.m.position.x,p.m.position.y+0.3,p.m.position.z,0x9a8a6a); done=true;
      }
      if(!done)for(const v of units){
        if(v.team===p.att.team||!v.alive||v.garrison)continue;
        if(segDist2(_px,_pz,p.m.position.x,p.m.position.z,v.root.position.x,v.root.position.z)<ARROW_HIT2){
          dealDamage(p.att,v,p.dmg*rps(p.attCls,v.cls));done=true;break;
        }
      }
      // v131.6 rBlock, MEASURED. This 0.8 inset was sized against the pre-v131 models and the
      // arrow was dying deep inside the new ones: `node tools/_blockprobe.js --proj` puts the
      // median bearing 9.02 units inside a castle wall at r*0.8, 3.60 inside a forge and 2.10
      // inside a guard tower — the shot vanishes in the masonry instead of striking the face. At
      // rBlock*0.8 the same medians are 2.54 / 1.20 / 0.58. The one type that gets worse is the
      // house, whose rBlock is SMALLER than its r (3.8 against 4.6): its arrows now land 0.71
      // inside the wall instead of 0.07. Twelve types better, one 0.64 worse, and the shot now
      // agrees with the body — you cannot walk somewhere your own arrows fly through.
      if(!done)for(const b of buildings){
        if(!b.alive||b.def.flat)continue;
        if(b!==p.ignoreB&&segDist2(_px,_pz,p.m.position.x,p.m.position.z,b.x,b.z)<Math.pow(b.def.rBlock*0.8,2)){
          if(b.team!==p.att.team)damageBuilding(b,p.dmg,p.att);
          done=true;break;
        }
      }
      if(done){scene.remove(p.m);projectiles.splice(i,1);}
      continue;
    }
    const t=p.target;
    const isBld=!!t.def;
    let tx,ty,tz,deadTarget=!t.alive;
    if(isBld){ tx=t.x; ty=2.5+t.root.position.y; tz=t.z; }
    else { tx=t.root.position.x; ty=(t.cls==="scout"?2.2:1.5)+t.root.position.y; tz=t.root.position.z; }
    if(p.life<=0||deadTarget){ scene.remove(p.m); projectiles.splice(i,1); continue; }
    const dir=new THREE.Vector3(tx-p.m.position.x,ty-p.m.position.y,tz-p.m.position.z);
    const d=dir.length();
    if(d<(isBld?t.def.r:0.9)){
      scene.remove(p.m); projectiles.splice(i,1);
      if(isBld){ damageBuilding(t,p.dmg*(p.bMult||1),p.att); }
      else { dealDamage(p.att,t,p.dmg*(p.attCls?rps(p.attCls,t.cls):1)); }
      if(p.splash){ // boulders and shells burst on impact
        const ix=p.m.position.x,iz=p.m.position.z;
        puff(ix,1.5,iz,0xb0a080); puff(ix,2.4,iz,0x8d8d8d);
        for(const v of units){
          if(v.team===p.att.team||!v.alive||v===t||v.garrison)continue; // splash spares the tower crew
          if(dist2(ix,iz,v.root.position.x,v.root.position.z)<p.splash*p.splash)
            dealDamage(p.att,v,p.dmg*0.5*(p.attCls?rps(p.attCls,v.cls):1));
        }
      }
      continue;
    }
    dir.normalize();
    p.m.position.addScaledVector(dir,p.spd*dt);
    if(p.arcH){ // lobbed boulders sail in a high arc, launch height blending to impact height
      const prog=Math.min(1,1-Math.min(1,d/p.total));
      p.m.position.y=(1-prog)*p.baseY+prog*ty+p.arcH*Math.sin(Math.PI*prog);
    }
    if(!p.att.def&&!p.arcH){ // tower arrows and lobs sail over walls; flat shots don't
      let blk=null;
      for(const b of buildings){
        if(!b.alive||b===p.target||b.def.flat)continue;
        if(b!==p.ignoreB&&dist2(p.m.position.x,p.m.position.z,b.x,b.z)<Math.pow(b.def.rBlock*0.8,2)){blk=b;break;} // v131.6 rBlock — see :126
      }
      if(blk){
        if(blk.team!==p.att.team)damageBuilding(blk,p.dmg*0.5,p.att);
        puff(p.m.position.x,p.m.position.y,p.m.position.z,0xd8c49a);
        scene.remove(p.m);projectiles.splice(i,1);continue;
      }
    }
    p.m.lookAt(tx,ty,tz); p.m.rotateX(Math.PI/2);
  }
}
function updateEffects(dt){
  for(let i=effects.length-1;i>=0;i--){
    const e=effects[i]; e.t-=dt;
    e.s.scale.multiplyScalar(1+dt*4); e.s.material.opacity=Math.max(0,e.t*2.5);
    e.s.position.y+=dt*2;
    if(e.t<=0){scene.remove(e.s);effects.splice(i,1);}
  }
}

// ---------- line of sight ----------
function hasLOS(x1,z1,x2,z2,ignore){
  for(const b of buildings){
    if(!b.alive||b===ignore||b.def.flat)continue;
    const dx=x2-x1,dz=z2-z1,L2=dx*dx+dz*dz;
    if(L2<0.001)continue;
    let t=((b.x-x1)*dx+(b.z-z1)*dz)/L2;
    t=Math.max(0,Math.min(1,t));
    // v131.6 rBlock. SIGHT MUST AGREE WITH THE SHOT: this is what picks the target, and the arrow
    // is stopped by rBlock*0.8 twenty lines up. On r*0.85 an archer would happily choose a target
    // through 8.47 units of castle (measured, median bearing) and then watch every arrow burst on
    // the curtain wall. Same circle, same answer.
    const px=x1+dx*t,pz=z1+dz*t,rr=b.def.rBlock*0.85;
    if(dist2(px,pz,b.x,b.z)<rr*rr)return false;
  }
  return true;
}

// ---------- combat ----------
function dealDamage(att,victim,dmg){
  if(typeof NET!=="undefined"&&NET.mode==="guest")return; // host owns all damage
  if(!victim.alive||gameOver)return;
  if(victim.blocking){
    const meleeAtt=att&&att.cls&&!CLS[att.cls].ranged&&!att.def;
    if(meleeAtt&&T-(victim.blockStart||-9)<0.28+0.07*buffSt(victim,"parry")){ // DUELIST widens the window
      // PARRY: perfect-timing block negates and staggers
      puff(victim.root.position.x,1.9,victim.root.position.z,0xffe27a);
      if(att.atkT!==undefined)att.atkT=Math.max(att.atkT,1.2);
      if(victim.isPlayer)msg("PARRY! "+(att.name||"The enemy")+" staggers.","blue");
      if(typeof questProgress==="function")questProgress(victim,"parry");
      if(typeof Sound!=="undefined"){Sound.play("parry",{x:victim.root.position.x,z:victim.root.position.z}); // v102: the ringing shing
        Sound.play("veffort",{x:victim.root.position.x,z:victim.root.position.z});} // v109: the strain behind the steel
      return;
    }
    dmg*=0.3; // raised shield
    if(typeof Sound!=="undefined"){Sound.play("block",{x:victim.root.position.x,z:victim.root.position.z}); // v102: shield-up block
      Sound.play("veffort",{x:victim.root.position.x,z:victim.root.position.z});} // v109: the strain behind the shield
  }
  // ---- v87 BLACKSMITH BUFFS: attacker-side (humans only) ----
  const attU=att&&!att.def&&att.cls?att:null; // a unit, not a tower
  if(attU&&isHuman(attU)&&attU.team!==victim.team){
    let m=1+0.05*buffSt(attU,"dmg");                               // HONED EDGE
    if(victim.team===NEUTRAL)m*=1+0.15*buffSt(attU,"slayer");      // WILD SLAYER
    if(isSiege(attU.cls))m*=1+0.10*buffSt(attU,"siege");           // SIEGEWRIGHT
    const cs=buffSt(attU,"crit");                                  // KEEN EYE
    if(cs&&Math.random()<0.05*cs){
      m*=2; puff(victim.root.position.x,2.4,victim.root.position.z,0xffd24a,1.1);
      if(attU.isPlayer)msg("CRITICAL HIT!","gold");
    }
    dmg*=m;
  }
  // CAPTAIN'S BANNER: any friendly attacker fighting near a banner-bearer hits harder
  if(attU&&attU.team!==victim.team&&attU.team!==NEUTRAL&&typeof _captains!=="undefined"&&_captains.length){
    let cap=0;
    for(const h of _captains){
      if(h.team!==attU.team||h===attU||!h.alive)continue;
      if(dist2(attU.root.position.x,attU.root.position.z,h.root.position.x,h.root.position.z)<12*12)
        cap=Math.max(cap,buffSt(h,"captain"));
    }
    if(cap)dmg*=1+0.01*cap;
  }
  // ---- victim-side (humans only): dodge, then the tempered shield ----
  if(isHuman(victim)){
    const ds=buffSt(victim,"dodge");                               // SIXTH SENSE
    if(ds&&Math.random()<0.05*ds){
      puff(victim.root.position.x,1.6,victim.root.position.z,0x9fd8ff);
      if(victim.isPlayer)msg("Dodged!","blue");
      victim._lastHurt=T;
      return;
    }
    dmg*=1-0.05*buffSt(victim,"shield");                           // RAISED SHIELD (the buff)
  }
  victim._lastHurt=T; // Second Skin waits for quiet
  victim.hp-=dmg; hitFlash(victim);
  // v100 SOUND — impact, keyed to the attacker: siege thud · arrow strike · melee clash.
  // (host/solo only — dealDamage returns early on guests; their impacts ride swings & deaths)
  if(typeof Sound!=="undefined"){
    // v102: impact by attacker — cannon blast · siege boulder · arrow · spear thud · melee clash
    let _hk="hit";
    if(att&&att.def)_hk="arrowhit";
    else if(att&&att.cls&&isSiege(att.cls))_hk=(CLS[att.cls]&&CLS[att.cls].rig==="cannon")?"cannonhit":"siegehit";
    else if(att&&att.cls&&CLS[att.cls]&&CLS[att.cls].ranged)_hk="arrowhit";
    else if(att&&att.bot&&att.bot.camp&&att.bot.camp.kind==="wolf")_hk="wolfbite"; // v110: a wolf's blow IS the bite
    else if(att&&att.cls&&CLS[att.cls]&&CLS[att.cls].line==="anticav")_hk="spearhit";
    Sound.play(_hk,{x:victim.root.position.x,z:victim.root.position.z});
    // v109 THE VOICES: the struck cry out — ~1 in 3 non-lethal hits, graded by the blow
    // (host-side like impacts; a guest hears their OWN hits via the hp-drop hook in applySnap)
    if(victim.hp>0&&victim.alive&&!victim.def&&Math.random()<0.34&&
       !(victim.bot&&victim.bot.camp&&victim.bot.camp.kind==="wolf")) // v110: wolves don't cry like men
      Sound.vox(dmg<12?"painm":dmg<25?"pain":"painh",victim,{x:victim.root.position.x,z:victim.root.position.z});
  }
  if(attU&&isHuman(attU)&&attU.alive&&attU.team!==victim.team){    // BLOODTHIRST drinks
    const ls=buffSt(attU,"leech");
    if(ls&&attU.hp<attU.maxHp){
      attU.hp=Math.min(attU.maxHp,attU.hp+1*ls);
      setBar(attU.bar,attU.hp/attU.maxHp);
      if(attU.isPlayer)updatePlayerHud();
    }
  }
  setBar(victim.bar,victim.hp/victim.maxHp);
  // fleeing bots get poked awake
  if(victim.bot)victim.bot.lastHitT=T;
  // a worker under attack raises a DISTRESS call — the war room hears about it
  if(victim.bot&&(victim.cls==="villager"||victim.bot.role==="cart")&&
     att&&att.team!==undefined&&att.team!==victim.team&&
     !(att.bot&&att.bot.role==="creep")&& // camp creeps never bait rescue bands into the wilds — the AI leaves camps alone
     typeof directors!=="undefined"&&directors[victim.team]){
    directors[victim.team].distress={x:victim.root.position.x,z:victim.root.position.z,until:T+12};
  }
  if(victim.isKing&&victim.hp<victim.maxHp*0.5&&!victim.warned){
    victim.warned=true;
    msg(victim.team===BLUE?"⚠ YOUR KING IS BADLY WOUNDED — DEFEND HIM!":"Their king is wounded — press the attack!",
        victim.team===BLUE?"warn":"gold");
    if(typeof Sound!=="undefined"&&victim.team===MYTEAM)Sound.play("alert_attack"); // v100: under-attack horn
  }
  if(victim.hp<=0){
    awardPts(att,victim.cls==="villager"?10:costPts(CLS[victim.cls]&&CLS[victim.cls].cost)); // a kill is worth its cost; a villager, 10
    if(victim.isKing)awardPts(att,500);                           // the regicide bonus
    killUnit(victim,att);
  }
  if(victim.isPlayer)updatePlayerHud();
  if(victim.isKing)updateKingBars();
}
function killUnit(u,killer){
  // ---- v99 PLUNDER: a slain cart spills its cargo into the killer's TEAM stockpile ----
  // (before the corpse's pockets are emptied below — order matters)
  if(killer&&killer.team!==undefined&&killer.team!==u.team&&killer.team!==NEUTRAL&&u.team!==NEUTRAL){
    let loot=null;
    if(u.cls==="oxcart"&&u.carry&&u.carry.wood>0){
      stock[killer.team].wood+=u.carry.wood; loot=u.carry.wood+" wood";
    }else if(u.cls==="trader"&&u.tradeLoaded){ // the haul's earned value so far
      const g=Math.round(tradeGold(Math.hypot(u.root.position.x-u.tradeLoaded.x,u.root.position.z-u.tradeLoaded.z)));
      if(g>0){stock[killer.team].gold+=g; loot=g+" gold";}
    }else if(u.bot&&u.bot.role==="cart"&&u.tradePhase==="back"&&u.tradeTarget&&u.bot.home){
      const g=Math.round(tradeGold(Math.hypot(u.bot.home.x-u.tradeTarget.x,u.bot.home.z-u.tradeTarget.z)));
      if(g>0){stock[killer.team].gold+=g; loot=g+" gold";}
    }
    if(loot){
      updateResHud();
      if(typeof Sound!=="undefined")Sound.play("bighaul"); // v104: plunder is a big haul (was "plunder")
      const kn0=killer.isPlayer?"You":(killer.def?"A "+killer.def.name:killer.name);
      msg("💰 "+kn0+" plundered "+loot+" from the fallen cart!",killer.team===BLUE?"blue":"warn");
      if(typeof NET!=="undefined"&&NET.mode==="host")
        NET.bcast({t:"note",m:"💰 "+kn0.replace(/^You$/,"The host")+" plundered "+loot+" from a fallen cart!",tone:killer.team===BLUE?"blue":"warn"});
    }
  }
  u.alive=false; u.gathering=null; u.blocking=false; u.task=null;
  if(typeof Sound!=="undefined"&&!u.isKing){ // v102: death mix — armored units clatter; others fall, ~1/3 squish
    const _c=CLS[u.cls]||{},_arm=(_c.line==="cavalry")||((_c.line==="melee"||_c.line==="anticav")&&(_c.tier||0)>=3);
    const _p={x:u.root.position.x,z:u.root.position.z};
    Sound.play(_arm?(Math.random()<0.3?"gore":"deathheavy"):(Math.random()<0.33?"gore":"death"),_p);
    // v109 THE VOICES: ~70% of the fallen cry out as they go (YOU always do); 1 in 5 gets the long scream
    // (v110: wolf-camp creeps die without a human voice — their body-drop foley stands alone)
    if((u===player||Math.random()<0.7)&&!(u.bot&&u.bot.camp&&u.bot.camp.kind==="wolf"))
      Sound.vox(Math.random()<0.2?"deathi":"death",u,_p);
  }
  u.dieT=0.9; // fall over before vanishing
  u.bar.bg.visible=false; u.bar.fg.visible=false;
  u.carry.food=0;u.carry.gold=0;u.carry.stone=0;u.carry.wood=0;
  // ---- v87 QUEST CREDIT: the killing blow, sorted by what fell ----
  if(killer&&!killer.def&&isHuman(killer)&&killer.team!==u.team&&typeof questProgress==="function"){
    if(_pistolCtx)questProgress(killer,"pistol"); // the dragoon's sidearm spoke
    if(u.team===NEUTRAL)questProgress(killer,"kill_creep");
    else if(u.cls==="villager")questProgress(killer,"kill_vil");
    else if(!u.isKing&&MIL_LINES.includes(CLS[u.cls].line))questProgress(killer,"kill_mil");
  }
  // v109 THE VOICES: kill-streak bloodlust — a human's 3rd quick kill (8s window) draws a growl, self-heard
  if(killer&&!killer.def&&isHuman(killer)&&killer.team!==u.team&&typeof Sound!=="undefined"){
    killer._vstreak=(killer._vstreak||[]).filter(t2=>T-t2<8); killer._vstreak.push(T);
    if(killer._vstreak.length===3){
      if(killer===player)Sound.play("vgrowl");
      else if(typeof NET!=="undefined"&&NET.mode==="host")
        for(const _k2 in NET.remotes){const _rr=NET.remotes[_k2];
          if(_rr.unit===killer&&_rr.conn){try{_rr.conn.send({t:"snd",k:"vgrowl"});}catch(_){}break;}}
    }
  }
  const kn=killer? (killer.isPlayer?"You":(killer.def?killer.def.name:killer.name)) : "The wilds";
  if(u.isKing){ endGame(u.team===BLUE?RED:BLUE, kn); return; }
  if(u.bot&&u.bot.role==="cart"){ // NPC carts are plundered for good; the Market builds anew
    u.respawnT=Infinity;
    msg(u.team===BLUE?"⚠ Your trade cart was plundered by "+kn+"!":"Red trade cart plundered — their gold bleeds.",
        u.team===BLUE?"warn":"gold");
    return;
  }
  if(u.isPlayer||u.remote)u.tradeLoaded=null;
  if(isHuman(u)&&typeof releaseWarband==="function"&&releaseWarband(u)) // v95: the band answers no dead horn
    msg(u.isPlayer?"Your warband returns to guard the King.":u.name+"'s warband returns to the King.","warn");
  if(isHuman(u)&&((u.lvl||0)>0||(u.xp||0)>0||u.quest||(u.buffs&&Object.keys(u.buffs).length))){
    // ---- v87 DEATH TAKES ITS DUE: level, XP, quest and every blacksmith buff ----
    u.lvl=0; u.xp=0; u.buffs={}; u.quest=null; u.questDraft=null; u.qRerolls=0; u._scoutOut=false; u.smithOffer=null; // v99: death also wipes the standing draft + banked rerolls
    if(typeof questNotify==="function"){
      questNotify(u,"💀 Death takes its due — your level, XP and blacksmith buffs are lost.","warn");
      syncQuest(u); syncBuffs(u);
      if(u.isPlayer&&typeof updateQuestHud==="function")updateQuestHud();
    }
  }
  u.corpse=true; // the body lies in state where it fell until it respawns (or a priest raises it)
  if(u.bot&&u.bot.role==="creep"){ // camp creeps: the camp manager rules their rebirth
    u.respawnT=Infinity;
    if(killer===player)msg("You slew a "+CLS[u.cls].name+"!","gold");
    if(killer&&!killer.def&&isHuman(killer)&&u.bot.camp&&!u.bot.camp.waiting&&
       u.bot.camp.creeps.every(c=>!c.alive)&&typeof questProgress==="function")
      questProgress(killer,"camp_wipe"); // CAMP BREAKER: this blow felled the last of the pack
    return;
  }
  const involves=u.isPlayer||killer===player;
  const nearP=player&&dist2(u.root.position.x,u.root.position.z,player.root.position.x,player.root.position.z)<30*30;
  if(involves||(nearP&&Math.random()<0.55))
    msg(kn+" slew "+(u.isPlayer?"you":u.name)+" ("+CLS[u.cls].name+")",u.team===BLUE?"warn":"gold");
  u.respawnT=respawnDelay(u.team);
  if(u.isPlayer){
    document.getElementById("deathoverlay").style.display="flex";
    closeMenus(); cancelPlacing();
    if(document.exitPointerLock)document.exitPointerLock();
  }
}
function respawnUnit(u){
  const tc=teamTC(u.team);
  let hx=tc?tc.x:TCPOS[u.team][0], hz=tc?tc.z:TCPOS[u.team][1];
  { // spawn point: bots take the nearest; the PLAYER chooses with V (Town Center vs forward castle)
    const wantCastle=!u.isPlayer||(typeof spawnPref!=="undefined"&&spawnPref==="castle");
    if(wantCastle){
      let bd=u.isPlayer?Infinity:dist2(u.root.position.x,u.root.position.z,hx,hz);
      for(const b of buildings){
        if(b.team!==u.team||!b.alive||!b.built||b.type!=="castle")continue;
        const d=dist2(u.root.position.x,u.root.position.z,b.x,b.z);
        if(d<bd){bd=d;hx=b.x;hz=b.z;}
      }
    }
  }
  const a=Math.random()*Math.PI*2;
  u.root.position.set(hx+Math.cos(a)*14,0,hz+Math.sin(a)*14); // outside the 2x TC/castle footprint
  u.root.position.y=terrainHeight(u.root.position.x,u.root.position.z);
  u.cls="villager"; buildBodyFor(u); setClassStats(u);
  u.alive=true; u.root.visible=true; u.warned=false;
  u.corpse=false; u.body.rotation.x=0; // stand the reborn villager back up (buildBodyFor clears meshes but not the toppled tilt)
  u.chargeTo=null; u.rally=false; u.rallyBy=null; // the dead answer no horn — a respawned villager forgets the band
  if(u.isPlayer){
    document.getElementById("deathoverlay").style.display="none";
    updatePlayerHud(); msg("You respawn as a Villager. Re-arm at the Barracks.","blue");
  }
}
// ---------- THE PRIEST'S MIRACLE — resurrection ----------
const RES_CHARGE=2.0;   // seconds of channeling (holding LMB) before the rite is ready
const RES_CD=10;        // seconds of cooldown after a resurrection ("faith")
function resCdFor(u){return Math.max(3,RES_CD-1.5*buffSt(u,"zeal"));} // v87 ZEALOTRY
const RES_REACH=3.6;    // how close the priest must stand over a fallen ally
const RES_PTS=25;       // score reward for raising the dead
// restore a fallen ally to life right where they lie, keeping the class they died as
function resurrectUnit(u,by){
  if(!u||u.alive)return false;
  u.alive=true; u.corpse=false; u.dieT=0;
  u.root.visible=true; u.body.rotation.x=0;
  u.root.position.y=terrainHeight(u.root.position.x,u.root.position.z);
  u.hp=u.maxHp; if(u.bar){setBar(u.bar,1); u.bar.bg.visible=false; u.bar.fg.visible=false;} // bars reappear only when wounded again
  u.respawnT=0; u.warned=false; u.gathering=null; u.task=null; u.blocking=false;
  if(by){ by._resAt=(typeof T!=="undefined")?T:0; awardPts(by,RES_PTS);
    if(typeof questProgress==="function")questProgress(by,"res"); } // BATTLEFIELD MEDIC
  if(typeof puff==="function")puff(u.root.position.x,1.6,u.root.position.z,0xfff0b0); // a burst of holy light
  if(typeof Sound!=="undefined")Sound.play("res",{x:u.root.position.x,z:u.root.position.z}); // v103: heavenly choir
  if(typeof NET!=="undefined"&&NET.mode==="host")NET.bcast({t:"snd",k:"res",x:u.root.position.x,z:u.root.position.z}); // guests hear allied miracles
  const bn=by?(by.isPlayer?"You":by.name):"A priest";
  if(by&&by.isPlayer)msg("✝ You raise "+u.name+" ("+CLS[u.cls].name+") from the dead!","blue");
  else msg("✝ "+bn+" raised "+(u.isPlayer?"you":u.name)+" from the dead.","blue");
  if(u.isPlayer){ // a downed player pulled back into the fight mid-field
    const dov=document.getElementById("deathoverlay"); if(dov)dov.style.display="none";
    if(typeof updatePlayerHud==="function")updatePlayerHud();
  }
  if(typeof updateRoster==="function")updateRoster();
  return true;
}
function nearestEnemyBuilding(u,maxReach){
  let bb=null,bd=1e9;
  for(const b of buildings){
    if(b.team===u.team||!b.alive)continue;
    // v131.6 bSurf: reach is measured from the WALL. On plain `r` a swordsman shoved out to
    // rBlock+0.7 by a barracks reads 4.4 units of gap and never swings. See 00-data.js.
    const d=Math.sqrt(dist2(u.root.position.x,u.root.position.z,b.x,b.z))-bSurf(b.def);
    if(d<maxReach&&d<bd){bd=d;bb=b;}
  }
  return bb;
}
function tryMeleeAttack(u){
  if(u.atkT>0)return;
  if(isSiege(u.cls)){ // rams hunt structures before troops
    const bb=nearestEnemyBuilding(u,u.rng+0.6);
    if(bb){
      u.atkT=u.cd; u.swing=0.25; triggerAttackAnim(u);
      u.facing=Math.atan2(bb.x-u.root.position.x,bb.z-u.root.position.z);
      damageBuilding(bb,u.dmg*(CLS[u.cls].bMult||1),u);
      return true;
    }
  }
  // nearest enemy unit in reach, else enemy building
  let best=null,bd=1e9;
  for(const v of units){
    if(v.team===u.team||!v.alive||v.garrison)continue; // safe up in the tower
    const d=_rwT?rwDist(u,v):dist(u,v); // v128.5: as the acting guest saw it
    if(d<u.rng+0.8&&d<bd){bd=d;best=v;}
  }
  if(best){
    u.atkT=u.cd; u.swing=0.25; triggerAttackAnim(u);
    u.facing=Math.atan2(best.root.position.x-u.root.position.x,best.root.position.z-u.root.position.z);
    dealDamage(u,best,u.dmg*rps(u.cls,best.cls));
    return true;
  }
  let bb=null;bd=1e9;
  for(const b of buildings){
    if(b.team===u.team||!b.alive)continue;
    const d=Math.sqrt(dist2(u.root.position.x,u.root.position.z,b.x,b.z))-bSurf(b.def); // v131.6 from the wall — see :470
    if(d<u.rng+0.6&&d<bd){bd=d;bb=b;}
  }
  if(bb){
    u.atkT=u.cd; u.swing=0.25; triggerAttackAnim(u);
    // scout-line TRAMPLE wrecks crops; siege engines wreck everything
    const mult=(CLS[u.cls].line==="scoutline"&&bb.type==="farm")?4:(CLS[u.cls].bMult||1);
    damageBuilding(bb,u.dmg*mult,u);
    return true;
  }
  return false;
}
function tryRangedAttack(u){
  if(u.atkT>0)return;
  if(u.garrison)u.facing=u.facing; // (range boost applied on garrison entry)
  if(isSiege(u.cls)){ // artillery bombards structures first
    let bb=null,bd=1e9;
    for(const b of buildings){
      if(b.team===u.team||!b.alive)continue;
      const d=Math.sqrt(dist2(u.root.position.x,u.root.position.z,b.x,b.z));
      if(d<u.rng&&d<bd&&hasLOS(u.root.position.x,u.root.position.z,b.x,b.z,b)){bd=d;bb=b;}
    }
    if(bb){
      u.atkT=u.cd; u.swing=0.25; triggerAttackAnim(u);
      u.facing=Math.atan2(bb.x-u.root.position.x,bb.z-u.root.position.z);
      shootArrow(u,bb);
      if(CLS[u.cls].rig==="cannon"){puff(u.root.position.x+Math.sin(u.facing)*2,1.4,u.root.position.z+Math.cos(u.facing)*2,0xdddddd);
        puff(u.root.position.x+Math.sin(u.facing)*2.6,1.6,u.root.position.z+Math.cos(u.facing)*2.6,0x9a9a9a);}
      return true;
    }
  }
  let best=null,bd=1e9;
  for(const v of units){
    if(v.team===u.team||!v.alive||v.garrison)continue; // safe up in the tower
    const d=dist(u,v);
    if(d<u.rng&&d<bd&&hasLOS(u.root.position.x,u.root.position.z,v.root.position.x,v.root.position.z,null)){bd=d;best=v;}
  }
  if(!best){
    for(const b of buildings){
      if(b.team===u.team||!b.alive)continue;
      const d=Math.sqrt(dist2(u.root.position.x,u.root.position.z,b.x,b.z));
      if(d<u.rng&&d<bd&&hasLOS(u.root.position.x,u.root.position.z,b.x,b.z,b)){bd=d;best=b;}
    }
  }
  if(best){
    u.atkT=u.cd; u.swing=0.25; triggerAttackAnim(u);
    const tx=best.root?best.root.position.x:best.x, tz=best.root?best.root.position.z:best.z;
    u.facing=Math.atan2(tx-u.root.position.x,tz-u.root.position.z);
    shootArrow(u,best);
    if(CLS[u.cls].rig==="musket")puff(u.root.position.x+Math.sin(u.facing)*1.4,1.9,u.root.position.z+Math.cos(u.facing)*1.4,0xd8d8d8);
    return true;
  }
  return false;
}
// ==================== v128.5: LAG COMPENSATION, COMBAT SIDE ====================
// `_rwT` is the host-clock instant the acting guest was looking at, set by driveRemote around a
// target scan and cleared straight after. Zero means "no rewind" — the host player, every AI
// bot and the solo game all run through the same code with it at zero and behave identically.
let _rwT=0;
function setRewind(t){ _rwT=(typeof t==="number"&&t>0)?t:0; }
// The distance from `u` to `v` as the ACTOR saw it: the closest v came across the swing's active
// window, never worse than the present-tick answer. Sampling the window rather than one instant
// is what makes a swing connect when the target was crossing the arc — the "weapon sweep" half
// of the problem — and taking the min with the present means compensation can only ever add
// hits a fair player deserved, never take one away.
function rwDist(u,v){
  const ux=u.root.position.x, uz=u.root.position.z;
  let best=dist2(ux,uz,v.root.position.x,v.root.position.z);
  if(_rwT&&typeof NET!=="undefined"&&NET.histAt){
    const W=NET.MELEE_WINDOW_MS||120;
    for(let k=0;k<3;k++){
      if(NET.histAt(v,_rwT+W*k*0.5)){
        const d=dist2(ux,uz,NET._rwX,NET._rwZ);
        if(d<best)best=d;
      }
    }
  }
  return Math.sqrt(best);
}
function rwDist2(u,v){ const d=rwDist(u,v); return d*d; }
// Squared distance from point (cx,cz) to the segment (ax,az)-(bx,bz). Scalar, allocation-free —
// this runs inside the projectile loop.
function segDist2(ax,az,bx,bz,cx,cz){
  const dx=bx-ax, dz=bz-az, l2=dx*dx+dz*dz;
  if(l2<1e-9)return dist2(ax,az,cx,cz);
  let t=((cx-ax)*dx+(cz-az)*dz)/l2;
  if(t<0)t=0; else if(t>1)t=1;
  const px=ax+dx*t, pz=az+dz*t;
  return dist2(px,pz,cx,cz);
}
const ARROW_HIT2=1.25; // the historical point-test radius², now applied to a swept segment
function pistolTarget(u,rng,rwT){
  const prev=_rwT;                       // save/restore, never clobber: tryAttack also sets it
  if(rwT!==undefined)setRewind(rwT);
  let best=null,bd=rng*rng;
  for(const e of units){
    if(!e.alive||e.team===u.team)continue;
    const d=_rwT?rwDist2(u,e):dist2(e.root.position.x,e.root.position.z,u.root.position.x,u.root.position.z);
    if(d<bd){bd=d;best=e;}
  }
  _rwT=prev;
  return best;
}
let _pistolCtx=false; // v87: killUnit reads this to credit the "Last Shot" quest
function pistolShot(u,t){ // the dragoon's sidearm: loud, brutal, six rounds
  u.ammo--; u.ammoT=0; u.atkT=1.0; u.swing=0.25; triggerAttackAnim(u);
  u.facing=Math.atan2(t.root.position.x-u.root.position.x,t.root.position.z-u.root.position.z);
  _pistolCtx=true; dealDamage(u,t,55); _pistolCtx=false;
}
function tryAttack(u){ if(u.dmg<=0)return false;
  if(u.cls==="dragoon"&&(u.ammo||0)>0&&u.atkT<=0){ // powder before steel
    const t=pistolTarget(u,15);
    if(t){pistolShot(u,t);return true;}
  }
  if(u.cls==="musketeer"&&u.atkT<=0){ // v84 BAYONET: steel at arm's length before powder
    const by=CLS.musketeer.bayonet;
    let t=null,bd=(by.rng+0.6)*(by.rng+0.6);
    for(const v of units){
      if(v.team===u.team||!v.alive||v.garrison)continue;
      const dv=_rwT?rwDist2(u,v):dist2(u.root.position.x,u.root.position.z,v.root.position.x,v.root.position.z);
      if(dv<bd){bd=dv;t=v;}
    }
    if(t){
      u.atkT=by.cd; u.swing=0.25; triggerAttackAnim(u);
      u.facing=Math.atan2(t.root.position.x-u.root.position.x,t.root.position.z-u.root.position.z);
      const dl=CLS[t.cls].line; // the sword-line counters ride the blade, not the ball
      const m=dl==="ranged"?1.8:dl==="anticav"?1.25:isSiege(t.cls)?2.0:1.0;
      dealDamage(u,t,by.dmg*m);
      return true;
    }
    const bb=nearestEnemyBuilding(u,by.rng+0.6);
    if(bb){
      u.atkT=by.cd; u.swing=0.25; triggerAttackAnim(u);
      u.facing=Math.atan2(bb.x-u.root.position.x,bb.z-u.root.position.z);
      damageBuilding(bb,by.dmg*1.5,u); // a bayonet chews wood like any melee steel
      return true;
    }
  }
  return u.ranged?tryRangedAttack(u):tryMeleeAttack(u); }

// ---------- movement helpers ----------
function moveUnit(u,dx,dz,dt){
  const len=Math.hypot(dx,dz);
  if(len<0.001)return false;
  dx/=len; dz/=len;
  let nx=u.root.position.x+dx*u.spd*dt;
  let nz=u.root.position.z+dz*u.spd*dt;
  if(!walkable(nx,nz)){ // the wall stands at the MOUNTAINS: fringe apron + camp pockets are open ground
    nx=Math.max(-(MAP.x+BORDER_FRINGE),Math.min(MAP.x+BORDER_FRINGE,nx));
    nz=Math.max(-(MAP.z+BORDER_FRINGE),Math.min(MAP.z+BORDER_FRINGE,nz));
  }
  // push out of buildings (farm FIELDS are walkable; the barn standing on one is not)
  for(const b of buildings){
    if(!b.alive)continue;
    if(b.def.flat){
      // `flat` means the FIELD, and it has to keep meaning that: the crop rows are walked on by
      // every villager who harvests them and by 07-ai.js's farm logic. So the plot stays open and
      // the masses standing on it block individually — see BLD.farm.blockParts. Model-local
      // coordinates, so BSCALE and the plot's own rotation are applied here, once, in one place.
      const P=b.def.blockParts; if(!P)continue;
      const bs=(typeof BSCALE!=="undefined"&&BSCALE[b.type])||1;
      const rot=b.rot||0, c=Math.cos(rot), sn=Math.sin(rot);
      // THE SAME AGE THE MODEL USED, derived the same way. buildingMesh (03-buildings.js:1057)
      // does `age=max(BLD[type].age||0, min(5,age))`, and BLD.farm.age is 1 — a farm unlocks at
      // Bronze and is NEVER drawn at Stone. A collider that read teamAge raw would think a Stone
      // farm had no barn while the model drew one. Two derivations of the same number is how a
      // wall ends up standing somewhere the building isn't.
      const A=Math.max((b.def.age||0),
        Math.min(5,(typeof teamAge!=="undefined"&&teamAge[b.team])||0));
      for(const q of P){
        if(q.minAge!==undefined&&A<q.minAge)continue;   // the barn arrives at Bronze
        if(q.maxAge!==undefined&&A>q.maxAge)continue;   // the dovecote is Medieval only
        const qx=q.x*bs, qz=q.z*bs, qr=q.r*bs+0.7;
        // local -> world, the same convention the wall OBB below inverts (x' = x*cos + z*sin)
        const wx=b.x+qx*c+qz*sn, wz=b.z-qx*sn+qz*c;
        const dd=dist2(nx,nz,wx,wz);
        if(dd<qr*qr){const d=Math.sqrt(dd)||0.001;
          nx=wx+(nx-wx)/d*qr; nz=wz+(nz-wz)/d*qr;}
      }
      continue;
    }
    if(b.def.gate&&b.team===u.team)continue; // your own gates stand open for you
    if(b.def.wall){ // walls are LONG: oriented-box collision, not a circle
      const rot=b.rot||0,c=Math.cos(rot),sn=Math.sin(rot);
      const dx0=nx-b.x,dz0=nz-b.z;
      const lx=dx0*c-dz0*sn, lz=dx0*sn+dz0*c;
      const hl=6.25+0.55, hw=0.6+0.7;
      if(Math.abs(lx)<hl&&Math.abs(lz)<hw){
        const pz=(lz>=0?hw:-hw);
        // head-on shoves become wall-following: how much of the desired motion
        // points INTO the wall (vs along it) decides how hard we drift endward
        const tX=c, tZ=-sn;                       // the wall's long axis in world
        const along=dx*tX+dz*tZ;                  // tangential share of desired motion
        const into=1-Math.min(1,Math.abs(along)); // mostly head-on? drift more
        const s=(Math.abs(along)>0.25)?Math.sign(along):(lx>=0?1:-1); // keep momentum, else nearest end
        let gx=lx+s*u.spd*dt*(0.35+0.85*into);    // slide toward the chosen end
        nx=b.x+gx*c+pz*sn; nz=b.z-gx*sn+pz*c;
      }
      continue;
    }
    // v131.9 THE PUSH IS A BOX WHERE WE HAVE ONE. A circumscribing circle stands proud of a flat
    // wall by (corner - halfwidth) and proud of a diagonal by nothing, which is why it played as
    // an invisible wall that moved depending on which way you walked at it. Push out along the
    // axis of LEAST penetration, so a body sliding along a wall keeps sliding instead of being
    // flicked round a corner.
    if(b.def.fx!==undefined){
      const rot=b.rot||0, c=Math.cos(rot), sn=Math.sin(rot);
      const dx0=nx-b.x, dz0=nz-b.z;
      const lx=dx0*c-dz0*sn, lz=dx0*sn+dz0*c;
      const hx=b.def.fx+0.7, hz=b.def.fz+0.7;      // +0.7: the body's own half-width, as before
      const ax=Math.abs(lx), az=Math.abs(lz);
      if(ax<hx&&az<hz){
        let gx=lx, gz=lz;
        if(hx-ax<hz-az)gx=(lx>=0?hx:-hx); else gz=(lz>=0?hz:-hz);
        nx=b.x+gx*c+gz*sn; nz=b.z-gx*sn+gz*c;
      }
      continue;
    }
    // and the circle stays for the types that have no box yet — the castle, and anything new
    // whose footprint has not been measured. `r` is the SPACING radius as well as the physical one
    // (03-buildings.js:2985 has said so all along), so when the v131 models outgrew their blockers
    // and the fix was to grow `r`, the exclusion disc `r+r'+2.2` in validFor grew with it and the
    // AI stopped being able to place a stable, a market or a forge at all. One number cannot be
    // both the wall you cannot walk through and the elbow room between two plots. rBlock is the
    // wall; it defaults to r for anything without one (00-data.js, under the table).
    const dd=dist2(nx,nz,b.x,b.z), r=b.def.rBlock+0.7;
    if(dd<r*r){
      const d=Math.sqrt(dd)||0.001;
      nx=b.x+(nx-b.x)/d*r; nz=b.z+(nz-b.z)/d*r;
    }
  }
  const ox=u.root.position.x, oz=u.root.position.z;
  u.root.position.x=nx; u.root.position.z=nz;
  // face the REALIZED motion: sliding along a wall or a building's edge no longer
  // crab-walks the body sideways while it stares at the blocked heading
  const rx2=nx-ox, rz2=nz-oz, rl2=Math.hypot(rx2,rz2), step=u.spd*dt;
  if(rl2>step*0.15)u.facing=Math.atan2(rx2,rz2);
  else if(rl2<step*0.03){u.facing=Math.atan2(dx,dz);return false;} // pinned: face intent, legs stop
  else u.facing=Math.atan2(dx,dz);
  u.walkT+=dt*(3.5+u.spd*0.75)*Math.min(1,rl2/Math.max(0.0001,step)); // stride matches ground covered
  u.gathering=null; u.moving=true;
  u._mv=T; // timestamp survives animateUnit consuming the flag
  return true;
}
// ---- proactive avoidance: see the building coming, turn parallel to its edge ----
// Returns a (possibly redirected) unit heading. When the straight line to the goal
// clips a building's circle, the unit steers onto the tangent — walking around the
// edge — instead of shoving into the facade and hoping the collision push slides it.
function steerAroundBuildings(u,hx,hz,distT,tx2,tz2){
  const px=u.root.position.x, pz=u.root.position.z;
  const look=Math.min(distT,16); // only worry about what's actually on the way
  let blk=null,bd=1e9;
  if(u._avB&&u._avB.alive&&T<u._avT){blk=u._avB;} // committed: keep rounding the same edge
  else for(const b of buildings){
    if(!b.alive||b.def.flat||b.def.wall)continue; // walls slide endward in moveUnit already
    if(b.def.gate&&b.team===u.team)continue;      // own gates stand open
    const rr=bSteer(b.def)+1.4;     // v131.9 the EDGE we round is the box, where there is one
    if(dist2(tx2,tz2,b.x,b.z)<(rr+0.8)*(rr+0.8))continue; // that's our destination's building — walk up to it
    const ox=b.x-px, oz=b.z-pz;
    const proj=ox*hx+oz*hz;             // how far ahead along our heading
    if(proj<=0.1||proj-rr>look)continue; // behind us, or beyond the horizon
    const lat=ox*hz-oz*hx;              // signed lateral miss distance
    if(Math.abs(lat)>=rr)continue;      // heading already clears the edge
    if(proj<bd){bd=proj;blk=b;}
  }
  if(!blk){u._avB=null;return [hx,hz];}
  if(blk!==u._avB){u._avB=blk;u._avT=T+0.25;u._avS=0;} // fresh commitment to this edge
  const rx=px-blk.x, rz=pz-blk.z, RL=Math.hypot(rx,rz)||0.001;
  let s=u._avS||0;
  if(!s){s=((-rz/RL)*hx+(rx/RL)*hz>=0)?1:-1;u._avS=s;} // choose a side ONCE, stick with it
  let sx=-rz/RL*s, sz=rx/RL*s;
  const rr=bSteer(blk.def)+1.4;                  // v131.9 must agree with the box the push uses
  if(RL<rr+0.6){sx+=rx/RL*0.7;sz+=rz/RL*0.7;}    // pressed against the edge: ease outward too
  const SL=Math.hypot(sx,sz)||1;
  return [sx/SL,sz/SL];
}
// ---------- wall-line routing: nobody bounces off a wall they could walk around ----------
function wallInPath(u,hx,hz,look){ // the first wall segment the heading would strike
  const px=u.root.position.x, pz=u.root.position.z;
  for(let t=2;t<=look;t+=2){
    const sx=px+hx*t, sz=pz+hz*t;
    for(const b of buildings){
      if(!b.alive||!b.def.wall)continue;
      if(b.def.gate&&b.team===u.team)continue; // own gates stand open
      const rot=b.rot||0,c=Math.cos(rot),sn=Math.sin(rot);
      const dx0=sx-b.x,dz0=sz-b.z;
      const lx=dx0*c-dz0*sn, lz=dx0*sn+dz0*c;
      if(Math.abs(lx)<6.8&&Math.abs(lz)<2.3)return b; // true segment extent — joints are covered by neighbors
    }
  }
  return null;
}
function wallCrossPoint(u,hit,tx,tz){ // where to walk instead: our gate, or the line's end
  // gather the whole wall LINE the struck segment belongs to (chained same-team segments)
  const line=[hit], seen=new Set([hit.id]);
  for(let i=0;i<line.length;i++){
    const a=line[i];
    for(const b of buildings){
      if(!b.alive||!b.def.wall||b.team!==hit.team||seen.has(b.id))continue;
      if(dist2(a.x,a.z,b.x,b.z)<13.5*13.5){seen.add(b.id);line.push(b);}
    }
  }
  const px=u.root.position.x, pz=u.root.position.z;
  // our own wall with a gate? walk to the gate — it opens for us
  if(hit.team===u.team){
    let g=null,gd=1e12;
    for(const b of line)if(b.def.gate){const d=dist2(px,pz,b.x,b.z);if(d<gd){gd=d;g=b;}}
    if(g){
      if(gd<3.5*3.5)return null; // already in the doorway: walk on through
      return{x:g.x,z:g.z};
    }
  }
  // otherwise: find the line's open ENDS and round the cheaper one.
  // the waypoint sits past the tip AND on the TARGET's side of the wall — a
  // waypoint on the wall's own axis just parks the walker at the tip forever
  const ends=[];
  for(const a of line){
    const rot=a.rot||0, ax=Math.cos(rot), az=-Math.sin(rot);
    const pxp=-az, pzp=ax; // the wall's perpendicular
    const sideT=((tx-a.x)*pxp+(tz-a.z)*pzp)>=0?1:-1; // which side is the target on?
    for(const s of [1,-1]){
      const ex=a.x+ax*s*6.25, ez=a.z+az*s*6.25;
      let covered=false; // a tip another segment continues from is not an end
      for(const b of line){
        if(b===a)continue;
        if(dist2(ex,ez,b.x,b.z)<7.5*7.5){covered=true;break;}
      }
      if(!covered)ends.push({
        x:a.x+ax*s*(6.25+3.2)+pxp*sideT*3.2,
        z:a.z+az*s*(6.25+3.2)+pzp*sideT*3.2});
    }
  }
  if(!ends.length)return null; // a closed ring: nothing to round (that is what siege is for)
  let bestP=null,bd=1e12;
  for(const p of ends){
    if(Math.hypot(px-p.x,pz-p.z)<3)continue; // already there: not a useful crossing target
    const d=Math.hypot(px-p.x,pz-p.z)+Math.hypot(tx-p.x,tz-p.z); // shortest total detour
    if(d<bd){bd=d;bestP=p;}
  }
  return bestP;
}
function moveToward(u,x,z,dt,stopDist){
  const dx=x-u.root.position.x, dz=z-u.root.position.z;
  const distT=Math.hypot(dx,dz);
  if(distT<=(stopDist||0.5)){u._stk=0;u._det=null;u._stkN=0;u._wwp=null;return true;}
  // a detour in progress takes priority — walk it out
  if(u._det&&T<u._det.until){
    moveUnit(u,u._det.x-u.root.position.x,u._det.z-u.root.position.z,dt);
    return false;
  }
  // an active wall waypoint (a gate, or the wall line's end) comes next
  if(u._wwp&&T<u._wwp.until){
    if(dist2(u.root.position.x,u.root.position.z,u._wwp.x,u._wwp.z)<2.5*2.5)u._wwp=null;
    else{
      moveUnit(u,u._wwp.x-u.root.position.x,u._wwp.z-u.root.position.z,dt);
      return false;
    }
  }
  // would the straight line strike a wall? route through a gate or around the end instead
  const wHit=wallInPath(u,dx/(distT||1),dz/(distT||1),Math.min(distT,14));
  if(wHit){
    const wp=wallCrossPoint(u,wHit,x,z);
    if(wp){
      u._wwp={x:wp.x,z:wp.z,until:T+3};
      moveUnit(u,wp.x-u.root.position.x,wp.z-u.root.position.z,dt);
      return false;
    }
  }
  const px=u.root.position.x, pz=u.root.position.z;
  const [sx,sz]=steerAroundBuildings(u,dx/(distT||1),dz/(distT||1),distT,x,z);
  moveUnit(u,sx,sz,dt);
  const moved=Math.hypot(u.root.position.x-px,u.root.position.z-pz);
  if(moved<u.spd*dt*0.25){ // pressing forward, going nowhere: something's in the way
    u._stk=(u._stk||0)+dt;
    if(u._stk>0.9){
      u._stk=0;
      const eb=nearestEnemyBuilding(u,Math.max(3.5,u.rng+1.5));
      if(eb&&u.dmg>0){ // an enemy wall bars the road? tear it down
        u.facing=Math.atan2(eb.x-px,eb.z-pz);
        tryAttack(u);
      }else{ // friendly obstruction: sidestep — wider every failed attempt
        u._detSide=-(u._detSide||1);
        u._stkN=Math.min(4,(u._stkN||0)+1);
        const L=Math.hypot(dx,dz)||1, D=8+7*u._stkN;
        u._det={x:px+dx/L*4-dz/L*D*u._detSide,
                z:pz+dz/L*4+dx/L*D*u._detSide,
                until:T+1.1+0.45*u._stkN};
      }
    }
  }else u._stk=0;
  return false;
}

// ---------- v124 THE CONVERGENCE ----------
// John: "archer projectile does not quite line up with crosshair, probably same for
// musketeer/skirmisher." Right on both counts, and it was worse than a rounding error.
//
// The old code spawned the arrow a FULL UNIT off the right shoulder and then gave it a velocity
// PARALLEL to the camera ray. Parallel lines never meet: the shot tracked ~1 unit right of the
// crosshair at EVERY range, forever. On top of that sits third-person parallax — the crosshair is
// the CAMERA's ray and the camera stands behind and above the shoulder, so even a centred muzzle
// would not agree with it.
//
// The fix is what every shooter does: pick the point the crosshair is actually over, then aim the
// muzzle AT THAT POINT rather than along a parallel heading. The convergence distance is measured
// from the feet, not the lens, because the camera's stand-off would otherwise pull the aim point
// toward the player by however far the camera sits back.
function aimRay(range){
  const dir=new THREE.Vector3();
  camera.getWorldDirection(dir);
  return {dir,pt:aimPointFor(dir,range)};
}
function aimPointFor(dir,range){
  const cp=camera.position, pp=player.root.position;
  const back=Math.hypot(cp.x-pp.x,cp.z-pp.z);   // how far the camera stands off the shoulder
  const d=back+range;
  return new THREE.Vector3(cp.x+dir.x*d, cp.y+dir.y*d, cp.z+dir.z*d);
}
// aim a projectile from `muzzle` at `pt` — the whole point of the exercise
function convergeFrom(muzzle,pt){ return pt.clone().sub(muzzle).normalize(); }

// ---------- v124 THE DRAW ----------
// John: "archer aim will be reworked where it becomes a charged shot — the longer you hold down
// fire and release, the faster the projectile and more damage it does."
//
// WHICH CLASSES DRAW is an explicit list, and it has to be. Crossbowman and Skirmisher are tagged
// rig:"bow" for their ANIMATION rig, so the obvious `rig==="bow"` test would have handed the draw
// to exactly the two units John excluded. His rule: "crossbowman or musketeer, skirmisher... should
// just fire and reload."
//
// The consequence is a nice one: the draw is an early-and-mid-game skill that technology retires.
// Ages 0-3 archery is timing and commitment; from the Medieval Age the crossbow — whose whole
// historical selling point was needing no strength or training — and then the musket trade that
// skill away for a mechanism. The Slinger is in by judgement call: a sling is whirled rather than
// drawn, but excluding it would leave the Stone Age with no ranged skill expression at all.
const DRAW_CLASSES=new Set(["slinger","archer","imparcher","comparcher"]);
const DRAW_FULL=1.2;    // seconds to a full draw
const DRAW_DMG=[0.5,2.0];  // tap -> full, multiplied into the unit's base damage
const DRAW_SPD=[0.6,1.6];  // tap -> full, multiplied into the 36 u/s arrow
function isDrawClass(cls){ return DRAW_CLASSES.has(cls); }
// The fire-and-reload lines keep EXACTLY their old behaviour — the v113 aimed-shot bonus of 1.35x
// and the standard arrow speed. Nothing about crossbow/skirmisher/musket play changes in v124.
function drawScale(cls,lv){
  if(!isDrawClass(cls))return {dmg:1.35,spd:1};
  const t=Math.max(0,Math.min(1,lv||0));
  return {dmg:DRAW_DMG[0]+(DRAW_DMG[1]-DRAW_DMG[0])*t,
          spd:DRAW_SPD[0]+(DRAW_SPD[1]-DRAW_SPD[0])*t};
}
function drawLevel(){
  return isDrawClass(player.cls)?Math.min(1,(player._drawT||0)/DRAW_FULL):1;
}
// Called once per frame from updatePlayer (and the guest frame). Holding primary while aiming
// builds the draw; RELEASING looses it. A tap still looses — weak and slow — because a panicked
// press that produces no arrow at all reads as a broken button.
function tickDraw(dt){
  if(!player||!player.alive||!isDrawClass(player.cls)||!aiming){
    if(player)player._drawT=0;
    return;
  }
  if(lmbHeld){
    if(player.atkT<=0)player._drawT=(player._drawT||0)+dt;
  }else if(player._drawT>0){
    const lv=Math.min(1,player._drawT/DRAW_FULL);
    player._drawT=0;
    fireAimedShot(lv);
  }
}
// how full the bow is right now, 0..1 — the mobile FIRE ring and any future desktop meter read this
function drawFill(){
  return (player&&isDrawClass(player.cls)&&aiming)?Math.min(1,(player._drawT||0)/DRAW_FULL):0;
}

// The host resolving a GUEST's loosed arrow. Before v124 this did not exist: a guest's aimed shot
// was called locally from its own click handler while driveRemote saw only the `atk` bit and ran a
// plain auto-attack — the guest watched a free-aimed arrow, the host resolved a generic swing.
// Survivable while every shot did the same damage. Not survivable once the draw multiplies it.
// `dir` arrives ALREADY CONVERGED from the guest, so what the host launches is the line the guest
// actually saw leave the bow.
// v128.5 CATCH-UP. A guest's arrow is loosed at a world that is ~276ms in the host's past, so
// spawning it "now" means the shot was aimed at where the target USED to be — the measured
// error is 1.70 units at median ping against a hit radius of 1.118, i.e. the target has already
// left the cylinder before the arrow exists. Instead the arrow is born at the instant the guest
// saw and fast-forwarded to the present, tested each step as a SWEPT SEGMENT against positions
// rewound to that same step. If it connects during the catch-up it connects; if not it enters
// the world already at the position it should have reached, and continues normally from there.
// Returns true when the arrow was consumed (hit, spent, or buried) and must not be pushed.
function catchUpArrow(p,fromT,now){
  if(!(fromT>0)||!(fromT<now))return false;
  if(typeof NET==="undefined"||!NET.histAt)return false;
  const step=(NET.CATCHUP_STEP_MS||16.7)/1000;
  const vx=p.vel.x, vy=p.vel.y, vz=p.vel.z;
  let t=fromT;
  let guard=0;
  while(t<now&&guard++<64){
    const h=Math.min(step,(now-t)/1000);
    const x0=p.m.position.x, z0=p.m.position.z;
    p.m.position.x+=vx*h; p.m.position.y+=vy*h; p.m.position.z+=vz*h;
    p.traveled+=p.spd*h;
    t+=h*1000;
    if(p.traveled>p.maxRange)return true;
    if(p.m.position.y<terrainHeight(p.m.position.x,p.m.position.z)+0.15){
      puff(p.m.position.x,p.m.position.y+0.3,p.m.position.z,0x9a8a6a); return true;
    }
    for(const v of units){
      if(v.team===p.att.team||!v.alive||v.garrison)continue;
      NET.histAt(v,t); // writes _rwX/_rwZ, falling back to the present when it has no history
      if(segDist2(x0,z0,p.m.position.x,p.m.position.z,NET._rwX,NET._rwZ)<ARROW_HIT2){
        dealDamage(p.att,v,p.dmg*rps(p.attCls,v.cls));
        return true;
      }
    }
    for(const b of buildings){ // a wall in the way stops it in the past too
      if(!b.alive||b.def.flat)continue;
      if(b!==p.ignoreB&&segDist2(x0,z0,p.m.position.x,p.m.position.z,b.x,b.z)<Math.pow(b.def.rBlock*0.8,2)){ // v131.6 rBlock — the rewind must use the SAME circle as :126 or a guest's shot and the host's disagree
        if(b.team!==p.att.team)damageBuilding(b,p.dmg,p.att);
        return true;
      }
    }
  }
  return false;
}
function fireAimedFor(u,dir,lv,rwT){
  if(!u||!u.alive||u.atkT>0)return false;
  u.atkT=u.cd; u.swing=0.25; triggerAttackAnim(u);
  u.facing=Math.atan2(dir.x,dir.z);
  const D=drawScale(u.cls,lv);
  const right=new THREE.Vector3(-dir.z,0,dir.x);
  const muzzle=new THREE.Vector3(
    u.root.position.x+dir.x*0.8+right.x,
    u.root.position.y+1.7,
    u.root.position.z+dir.z*0.8+right.z);
  const m=cyl(0.05,0.05,0.9,0x4a3826,4);
  m.position.copy(muzzle);
  m.lookAt(muzzle.clone().add(dir)); m.rotateX(Math.PI/2);
  scene.add(m);
  const shot={m,free:true,vel:dir.clone().multiplyScalar(36*D.spd),spd:36*D.spd,traveled:0,
    maxRange:34,att:u,dmg:u.dmg*D.dmg,attCls:u.cls,life:3};
  // v128.5: a guest's arrow starts in the past and catches up before it joins the world
  if(rwT&&typeof NET!=="undefined"&&catchUpArrow(shot,rwT,NET.now())){
    scene.remove(m);
  }else projectiles.push(shot);
  if(typeof Sound!=="undefined"){
    const k=CLS[u.cls].rig==="musket"?"gun":"bow";
    Sound.play(k,{x:u.root.position.x,z:u.root.position.z});
    if(typeof NET!=="undefined"&&NET.mode==="host"&&NET.bcast)
      NET.bcast({t:"snd",k,x:u.root.position.x,z:u.root.position.z});
  }
  return true;
}

// player archer: manually aimed straight shot along the camera.
// lv is the draw level 0..1 for the drawing classes; the fire-and-reload lines ignore it.
function fireAimedShot(lv){
  if(player.atkT>0)return;
  player.atkT=player.cd; player.swing=0.25; triggerAttackAnim(player);
  // v113 THE SILENT ARCHER: manual aimed fire made NO sound — the launch foley lived in
  // shootArrow (the auto/AI path) and this hand-aimed branch never called it. Same key law as
  // shootArrow: bow twang · musket crack · powder blast. Host also broadcasts it positionally,
  // since a free-aimed shot doesn't ride the snapshot's _fx arrow theatre.
  if(typeof Sound!=="undefined"){
    const _r=CLS[player.cls].rig;
    const _k=_r==="cannon"?"cannonfire":_r==="musket"?"gun":"bow";
    const _sx=player.root.position.x,_sz=player.root.position.z;
    Sound.play(_k,{x:_sx,z:_sz});
    if(typeof NET!=="undefined"&&NET.mode==="host"&&NET.bcast)NET.bcast({t:"snd",k:_k,x:_sx,z:_sz});
  }
  if(CLS[player.cls].rig==="cannon"){ // gunnery = archery: the camera ray IS the shot, elevation clamped
    const dirC=new THREE.Vector3();
    camera.getWorldDirection(dirC);
    dirC.y=THREE.MathUtils.clamp(dirC.y,-0.12,0.45); dirC.normalize();
    player.facing=Math.atan2(dirC.x,dirC.z);
    const f=player.facing;
    const sx=player.root.position.x, sz=player.root.position.z, gy=player.root.position.y;
    player._recoil=0.4;
    cannonPlume(f,sx+Math.sin(f)*5.0,gy+3.2,sz+Math.cos(f)*5.0);
    const mC=new THREE.Mesh(new THREE.SphereGeometry(player.cls==="culverin"?0.16:0.22,6,5),mat(0x2b2b2b));
    mC.castShadow=false;
    // v124: the barrel sits 4.5 units out and 3.2 up — the widest muzzle offset in the game, so the
    // convergence matters most here. Aim the ball AT the crosshair point, not parallel to the ray.
    const muzC=new THREE.Vector3(sx+dirC.x*4.5,gy+3.2+dirC.y*4.5,sz+dirC.z*4.5);
    const velC=convergeFrom(muzC,aimPointFor(dirC,player.rng+28));
    mC.position.copy(muzC); scene.add(mC);
    projectiles.push({m:mC,free:true,vel:velC.multiplyScalar(100),spd:100,traveled:0,
      maxRange:player.rng+28,att:player,dmg:player.dmg*1.2,attCls:player.cls,life:2.5});
    return;
  }
  const {dir,pt}=aimRay(34);       // full 3D aim: down off the parapet, up at the walls
  player.facing=Math.atan2(dir.x,dir.z);
  // v124 THE DRAW — 0..1. tickDraw hands the released level in; a direct call (fire-and-reload
  // lines, or any older path) falls through to a full-strength shot.
  const draw=(typeof lv==="number")?lv:drawLevel();
  const D=drawScale(player.cls,draw);
  const right=new THREE.Vector3(-dir.z,0,dir.x); // shoulder offset matches the aim camera
  const m=cyl(0.05,0.05,0.9,0x4a3826,4);
  const muzzle=new THREE.Vector3(
    player.root.position.x+dir.x*0.8+right.x,
    player.root.position.y+1.7,
    player.root.position.z+dir.z*0.8+right.z);
  const vdir=convergeFrom(muzzle,pt);
  m.position.copy(muzzle);
  m.lookAt(muzzle.clone().add(vdir)); m.rotateX(Math.PI/2);
  scene.add(m);
  projectiles.push({m,free:true,vel:vdir.clone().multiplyScalar(36*D.spd),spd:36*D.spd,traveled:0,
    maxRange:34,att:player,dmg:player.dmg*D.dmg,attCls:player.cls,life:3});
  // v124: on a guest the arrow above is pure theatre — dealDamage returns early off the host — so
  // the loosed shot has to be REPORTED. It rides the next input packet the way the siege lob does.
  // The direction is already converged, so the host launches the exact line the guest watched.
  if(typeof NET!=="undefined"&&NET.mode==="guest")
    NET._pendingShot={dx:r3(vdir.x),dy:r3(vdir.y),dz:r3(vdir.z),lv:Math.round(draw*100)/100};
}
function r3(n){return Math.round(n*1000)/1000;}
