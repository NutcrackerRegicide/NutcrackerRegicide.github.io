/* REGICIDE PVP — 11-audio.js — THE SOUNDSCAPE (v100)
   Client-side audio: 4 gain buses (sfx / ambience / music / voip), hybrid 2D+3D
   positional playback, voice-cap + per-category throttle, mute (M) + per-bus volume.
   Pure client-side — NO wire format, PROTO unchanged. Guests trigger off the same
   host-driven anim/theatre data they already receive (RED-guest parity).
   Headless-safe: with no AudioContext (node smoketest) every play() no-ops, but the
   DECISION helpers (_decide/_panFor/_gainForDist/_resolve) stay pure & testable. */
const Sound=(function(){
  // key -> [busCode(0 sfx,1 ambience), spatial(1=3D), loop, gain]
  const DEFS={"swing1":[0,1,0,0.8],"swing2":[0,1,0,0.8],"swing3":[0,1,0,0.8],"swing4":[0,1,0,0.8],"hit1":[0,1,0,0.9],"hit2":[0,1,0,0.9],"hit3":[0,1,0,0.85],"hit4":[0,1,0,0.9],"death1":[0,1,0,0.9],"death2":[0,1,0,0.9],"bow1":[0,1,0,0.85],"bow2":[0,1,0,0.85],"arrowhit1":[0,1,0,0.8],"arrowhit2":[0,1,0,0.8],"siegefire":[0,1,0,1.0],"siegehit":[0,1,0,1.0],"march":[0,1,1,0.5],"mine":[0,1,1,0.8],"chop":[0,1,1,0.8],"farm":[0,1,1,0.8],"deposit":[0,0,0,0.9],"pickup":[0,1,0,0.8],"chest":[0,1,0,0.95],"plunder":[0,0,0,1.0],"place":[0,1,0,0.85],"build":[0,1,1,0.7],"complete":[0,1,0,0.9],"blacksmith":[0,1,0,0.9],"ui_open":[0,0,0,0.7],"ui_select":[0,0,0,0.6],"ui_confirm":[0,0,0,0.7],"ui_back":[0,0,0,0.6],"ui_cancel":[0,0,0,0.65],"ui_tab":[0,0,0,0.6],"alert_attack":[0,0,0,0.9],"alert_quest":[0,0,0,0.8],"alert_level":[0,0,0,0.85],"alert_buff":[0,0,0,0.8],"ageup":[0,0,0,1.0],"regicide_win":[0,0,0,1.0],"regicide_lose":[0,0,0,1.0],
    "swingheavy1":[0,1,0,0.85],"swingheavy2":[0,1,0,0.85],"swinglight1":[0,1,0,0.75],"swinglight2":[0,1,0,0.75],
    "spearhit":[0,1,0,0.85],"bldhit":[0,1,0,0.8],"bldhitwood":[0,1,0,0.8],"gore1":[0,1,0,0.8],"gore2":[0,1,0,0.8],
    "deathheavy":[0,1,0,0.9],"block":[0,1,0,0.85],"parry":[0,1,0,0.95],"gun":[0,1,0,1.0],
    "cannonfire":[0,1,0,1.0],"cannonhit":[0,1,0,1.0],"hooves":[0,1,0,0.6],"neigh":[0,1,0,0.7],
    "warhorn":[0,0,0,0.9],"raze":[0,1,0,0.95],
    "res":[0,1,0,0.85],"channel":[0,1,0,0.6],"raid":[0,0,0,1.0],"basealarm":[0,0,0,0.85],
    "wildsdrone":[1,0,1,0.26],"water":[1,0,1,0.4], // v112: drone trimmed (was 0.35 — read as loud)
    "treefall":[0,1,0,0.85],"stonecrumble":[0,1,0,0.8],"tradepay":[0,1,0,0.8],"bighaul":[0,0,0,0.95],
    "harvest":[0,1,0,0.75],"gate_wood":[0,1,0,0.8],"gate_stone":[0,1,0,0.85],"garrison":[0,1,0,0.75],"bazaarload":[0,1,0,0.7],
    "armup_infantry":[0,0,0,0.9],"armup_cavalry":[0,0,0,0.9],"armup_civilian":[0,0,0,0.8],
    "ambience":[1,0,1,0.15]};
  // v109 THE VOICES — 58 Gamemaster Audio human vocals. Soldier voices b/c/d (pack's Male B/C/D);
  // civilian voices a/e/f/g (Male A's wordless grunts + Females A/B/C). Keys end in a digit so
  // the GROUPS pass below folds them into per-voice variant pools (vatk_b1/2 → group "vatk_b").
  for(const v of ["b","c","d"]){ // the three full soldier voices: attack/pain(3 grades)/death(+intense)/shout
    DEFS["vatk_"+v+"1"]=[0,1,0,0.7];  DEFS["vatk_"+v+"2"]=[0,1,0,0.7];
    DEFS["vpainm_"+v+"1"]=[0,1,0,0.75];
    DEFS["vpain_"+v+"1"]=[0,1,0,0.8]; DEFS["vpain_"+v+"2"]=[0,1,0,0.8];
    DEFS["vpainh_"+v+"1"]=[0,1,0,0.85];
    DEFS["vdeath_"+v+"1"]=[0,1,0,0.85]; DEFS["vdeath_"+v+"2"]=[0,1,0,0.85];
    DEFS["vdeathi_"+v+"1"]=[0,1,0,0.9];
    DEFS["vshout_"+v+"1"]=[0,1,0,0.85]; DEFS["vshout_"+v+"2"]=[0,1,0,0.85];
  }
  for(const v of ["a","e","f","g"]){ // civilian pool: pain + death only (no war-cries from farmers)
    DEFS["vpain_"+v+"1"]=[0,1,0,0.8]; DEFS["vpain_"+v+"2"]=[0,1,0,0.8];
    DEFS["vdeath_"+v+"1"]=[0,1,0,0.85]; DEFS["vdeath_"+v+"2"]=[0,1,0,0.85];
  }
  DEFS["vking1"]=[0,0,0,1.0];                         // the regicide scream — 2D, uncapped, always lands
  DEFS["veffort1"]=[0,1,0,0.7];DEFS["veffort2"]=[0,1,0,0.7];DEFS["veffort3"]=[0,1,0,0.7];DEFS["veffort4"]=[0,1,0,0.7];
  DEFS["vgrowl1"]=[0,1,0,0.85];DEFS["vgrowl2"]=[0,1,0,0.85];DEFS["vgrowl3"]=[0,1,0,0.85];
  DEFS["vbreath"]=[0,0,1,0.45];                       // wounded breathing loop (self, 2D)
  // v110 THE WOLVES — John's two wolf recordings, pre-attenuated −6/−4 dB at conversion
  // (source ran ~5 LU hotter than the foley) + modest gains here: they sit UNDER combat.
  DEFS["wolfhowl"]=[0,1,0,0.55];                      // long howl — wolf camps, idle & hunting
  DEFS["wolfbite"]=[0,1,0,0.7];                       // snap — a wolf-camp creep's melee impact
  const BUSNAME=["sfx","ambience"]; // busCode -> bus name (music/voip exist as buses but no v100 assets)
  const DIR="audio/sfx/";
  // groups: play("swing") picks a random loaded variant; single keys are their own group
  const GROUPS={};
  for(const k in DEFS){const base=k.replace(/[0-9]+$/,"");(GROUPS[base]=GROUPS[base]||[]).push(k);}
  // per-category throttle (ms) + which categories are voice-capped (combat spam) vs always-important
  const THROTTLE={swing:70,hit:45,death:55,bow:55,arrowhit:45,siegefire:130,siegehit:90,march:900,mine:120,chop:120,farm:120,build:70,pickup:110,
    swingheavy:70,swinglight:70,spearhit:45,bldhit:70,bldhitwood:70,gore:55,deathheavy:55,block:50,gun:90,cannonfire:130,cannonhit:90,hooves:700,neigh:1500,warhorn:300,
    res:200,channel:300,basealarm:60000, // v113: was 4000 — a bombardment rang the town bell nonstop; one toll a minute
    treefall:150,stonecrumble:150,tradepay:800,bighaul:200,harvest:150,gate_wood:2000,gate_stone:2000,garrison:300,bazaarload:400,
    wolfhowl:6000,wolfbite:300, // v110: one howl at a time (7s file); bites ride the combat cadence
    armup_infantry:300,armup_cavalry:300,armup_civilian:300};
  const CAPPED={swing:1,hit:1,death:1,bow:1,arrowhit:1,siegefire:1,siegehit:1,march:1,build:1,mine:1,chop:1,farm:1,pickup:1,
    swingheavy:1,swinglight:1,spearhit:1,bldhit:1,bldhitwood:1,gore:1,deathheavy:1,block:1,gun:1,cannonfire:1,cannonhit:1,hooves:1,neigh:1,
    wolfbite:1}; // v110: bites join the cap; the HOWL stays uncapped — atmosphere that always lands
  // v109: every vocal category gets a medium-density throttle and joins the voice cap —
  // EXCEPT vking (the regicide scream bypasses everything, like the stings do)
  for(const _k in DEFS){
    if(_k[0]!=="v"||_k.slice(0,2)==="vo"||DEFS[_k][2])continue; // vocal one-shots only (skips vbreath loop)
    const _cat=_k.replace(/[0-9]+$/,"");
    if(_cat==="vking")continue;
    if(THROTTLE[_cat]===undefined)
      THROTTLE[_cat]=_cat.indexOf("vshout")===0?300:_cat.indexOf("vgrowl")===0?900:_cat.indexOf("veffort")===0?350:_cat.indexOf("vatk")===0?250:200;
    CAPPED[_cat]=1;
  }
  const NEAR=8, FAR=72, PANWIDTH=16, MAXVOICES=24; // v101: tighter pan for clearer combat localization

  const S={ctx:null,master:null,bus:{},buf:{},active:[],last:{},loops:{},ready:false,loading:false,
    mute:false,vol:{master:0.8,sfx:1.0,ambience:0.6,music:0.4,voip:1.0},_ambWant:false}; // v111: music default 40% — post-mix-fix SFX are louder, the bed can breathe

  // ---- persistence (localStorage is undefined in node — the game try/catches it everywhere) ----
  // v111: key bumped v3→v4 — sliders tuned against the v100-v108 double-gain bug (like John's
  // 10% music) are stale readings of a broken mix; everyone restarts from honest defaults
  function loadPrefs(){try{const j=localStorage.getItem("reg_snd_v4");if(j){const o=JSON.parse(j);
    if(o&&o.vol)for(const b in o.vol)if(typeof o.vol[b]==="number")S.vol[b]=o.vol[b];
    if(typeof o.mute==="boolean")S.mute=o.mute;}}catch(_){}}
  function savePrefs(){try{localStorage.setItem("reg_snd_v4",JSON.stringify({vol:S.vol,mute:S.mute}));}catch(_){}}

  // ---- PURE helpers (unit-tested headless) ----
  function catOf(name){return name.replace(/[0-9]+$/,"");}
  function resolve(name){ // name -> concrete key (random variant) or null
    if(DEFS[name])return name;
    const g=GROUPS[name]; if(g&&g.length)return g[(Math.random()*g.length)|0];
    return null;
  }
  function panFor(sx,sz,lx,lz,yaw){ // stereo pan -1..1 in CAMERA space
    // v101 FIX: the camera's screen-RIGHT is the D-key direction = (cos yaw, -sin yaw).
    // The old axis was negated, so sources on your right panned LEFT — the "weird" localization.
    const dx=sx-lx, dz=sz-lz;
    const rx=Math.cos(yaw), rz=-Math.sin(yaw);
    let p=(dx*rx+dz*rz)/PANWIDTH;
    return p<-1?-1:p>1?1:p;
  }
  function gainForDist(sx,sz,lx,lz){ // distance rolloff 0..1
    const d=Math.hypot(sx-lx,sz-lz);
    if(d<=NEAR)return 1; if(d>=FAR)return 0;
    return (FAR-d)/(FAR-NEAR);
  }
  // decide whether a play should fire (throttle + voice cap + distance cull). Pure given nowMs+listener.
  function decide(name,opts,nowMs){
    const key=resolve(name); if(!key)return {play:false,reason:"unknown"};
    const d=DEFS[key], cat=catOf(key), busVol=S.vol[BUSNAME[d[0]]]!==undefined?S.vol[BUSNAME[d[0]]]:1;
    let g=d[3]*busVol*S.vol.master*(S.mute?0:1), local=d[3]; // v109: see decideConcrete
    let pan=0;
    if(d[1]&&opts&&typeof opts.x==="number"){ // spatial: fold in distance + pan
      const L=opts._listener;
      const lx=L?L.x:0, lz=L?L.z:0, yaw=L?L.yaw:0;
      const dg=gainForDist(opts.x,opts.z,lx,lz);
      if(dg<=0)return {play:false,reason:"far",key,cat};
      g*=dg; local*=dg; pan=panFor(opts.x,opts.z,lx,lz,yaw);
    }
    if(opts&&typeof opts.gain==="number"){g*=opts.gain;local*=opts.gain;}
    if(g<=0.0009)return {play:false,reason:"silent",key,cat};
    // throttle (per category)
    const th=THROTTLE[cat]||0;
    if(th){const t=S.last[cat]||-1e9; if(nowMs-t<th)return {play:false,reason:"throttle",key,cat};}
    // voice cap (combat spam only; important cues bypass)
    if(CAPPED[cat]){
      let live=0; for(const a of S.active)if(a.until>nowMs)live++;
      if(live>=MAXVOICES)return {play:false,reason:"cap",key,cat};
    }
    return {play:true,key,cat,gain:g,local,pan};
  }

  // ---- listener snapshot from the globals the game already keeps ----
  function listener(){
    if(typeof player!=="undefined"&&player&&player.root&&player.alive!==false){
      return {x:player.root.position.x,z:player.root.position.z,
        yaw:(typeof camYaw!=="undefined")?camYaw:0};
    }
    return {x:0,z:0,yaw:0};
  }

  // ---- audio graph (only built when a real AudioContext exists) ----
  function ensureGraph(){
    if(S.ctx||typeof window==="undefined")return;
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC)return;
    try{
      S.ctx=new AC();
      S.master=S.ctx.createGain(); S.master.gain.value=S.mute?0:S.vol.master; S.master.connect(S.ctx.destination);
      for(const b of ["sfx","ambience","music","voip"]){
        const g=S.ctx.createGain(); g.gain.value=S.vol[b]!==undefined?S.vol[b]:1; g.connect(S.master); S.bus[b]=g;
      }
    }catch(_){S.ctx=null;}
  }
  function b64buf(b64){ // base64 → ArrayBuffer (no network — works from file:// AND http)
    const bin=atob(b64), n=bin.length, u=new Uint8Array(n);
    for(let i=0;i<n;i++)u[i]=bin.charCodeAt(i);
    return u.buffer;
  }
  function loadAll(){
    if(S.loading||S.ready||!S.ctx)return;
    const haveData=(typeof SND_DATA!=="undefined"&&SND_DATA);
    const haveFetch=(typeof fetch!=="undefined"&&typeof location!=="undefined"&&location.protocol!=="file:");
    if(!haveData&&!haveFetch)return;   // headless / file:// with no embedded data → stay silent, no throw
    S.loading=true; let left=0;
    const done=()=>{if(--left<=0){S.ready=true;S.loading=false;if(S._ambWant)startAmbience();}};
    for(const k in DEFS){
      left++;
      if(haveData&&SND_DATA[k]){        // preferred: decode the embedded OGG
        try{S.ctx.decodeAudioData(b64buf(SND_DATA[k]),b=>{S.buf[k]=b;done();},_=>done());}
        catch(_){done();}
      }else if(haveFetch){              // fallback: fetch the file (http only)
        fetch(DIR+k+".ogg").then(r=>r.arrayBuffer())
          .then(ab=>new Promise((res,rej)=>S.ctx.decodeAudioData(ab,b=>{S.buf[k]=b;res();},rej)))
          .catch(_=>{}).then(done);
      }else done();
    }
    if(left===0){S.ready=true;S.loading=false;}
  }
  function resume(){ // must follow a user gesture (autoplay policy)
    ensureGraph();
    if(S.ctx&&S.ctx.state==="suspended")S.ctx.resume().catch(()=>{});
    loadAll();
  }

  function nodeFor(key,gain,pan,loop){ // build a one source graph, return {src} or null
    if(!S.ctx||!S.buf[key])return null;
    const src=S.ctx.createBufferSource(); src.buffer=S.buf[key]; src.loop=!!loop;
    let node=src;
    const bus=S.bus[BUSNAME[DEFS[key][0]]]||S.master;
    const g=S.ctx.createGain(); g.gain.value=gain;
    if(pan&&S.ctx.createStereoPanner){const p=S.ctx.createStereoPanner();p.pan.value=pan;src.connect(p);p.connect(g);}
    else src.connect(g);
    g.connect(bus);
    return {src,g};
  }

  function play(name,opts){
    opts=opts||{};
    const key=resolve(name); if(!key)return false;          // random variant, chosen once
    if(DEFS[key][1]&&opts._listener===undefined&&typeof opts.x==="number")opts._listener=listener();
    const t=now();
    const dec=decideConcrete(key,opts,t);
    if(!dec.play)return false;
    S.last[dec.cat]=t;
    if(!S.ready||!S.ctx)return true;   // decision made (headless / still loading): counts as "would play"
    const ng=nodeFor(dec.key,dec.local,dec.pan,false); // v109: node gets LOCAL gain — sliders live on the bus/master nodes
    if(!ng)return true;
    const dur=(S.buf[dec.key]?S.buf[dec.key].duration:0.3);
    S.active.push({key:dec.key,until:t+dur*1000+40});
    if(S.active.length>64)S.active=S.active.filter(a=>a.until>now());
    try{ng.src.start();}catch(_){}
    return true;
  }
  // decide for an already-resolved concrete key (skips the random pick so gain/throttle line up)
  // v109 MIX FIX: `gain` (full chain, incl. bus×master×mute) drives the PLAY/SILENT decision;
  // `local` (def gain × distance × opts.gain ONLY) is what the source node gets — the live
  // bus & master gain NODES apply the sliders. v100-v108 applied bus×master in BOTH places,
  // squaring the sliders: at 50%/50% every SFX sat 12 dB under where the sliders said.
  function decideConcrete(key,opts,nowMs){
    const d=DEFS[key], cat=catOf(key), busVol=S.vol[BUSNAME[d[0]]]!==undefined?S.vol[BUSNAME[d[0]]]:1;
    let g=d[3]*busVol*S.vol.master*(S.mute?0:1), pan=0, local=d[3];
    if(d[1]&&opts&&typeof opts.x==="number"){
      const L=opts._listener||listener();
      const dg=gainForDist(opts.x,opts.z,L.x,L.z);
      if(dg<=0)return {play:false,reason:"far",key,cat};
      g*=dg; local*=dg; pan=panFor(opts.x,opts.z,L.x,L.z,L.yaw);
    }
    if(opts&&typeof opts.gain==="number"){g*=opts.gain;local*=opts.gain;}
    if(g<=0.0009)return {play:false,reason:"silent",key,cat};
    const th=THROTTLE[cat]||0;
    if(th){const t=S.last[cat]||-1e9; if(nowMs-t<th)return {play:false,reason:"throttle",key,cat};}
    if(CAPPED[cat]){let live=0;for(const a of S.active)if(a.until>nowMs)live++;
      if(live>=MAXVOICES)return {play:false,reason:"cap",key,cat};}
    return {play:true,key,cat,gain:g,local,pan};
  }

  function now(){return (S.ctx&&S.ctx.currentTime!=null)?S.ctx.currentTime*1000
    :(typeof performance!=="undefined"&&performance.now?performance.now():0);}

  // ---- persistent loops (ambience bed) ----
  function startLoop(key){
    if(S.loops[key]||!S.ready||!S.ctx||!S.buf[key])return;
    const d=DEFS[key];
    const ng=nodeFor(key,d[3],0,true); if(!ng)return; // v109: def gain only — the bus node holds the slider
    try{ng.src.start();}catch(_){}
    S.loops[key]=ng;
  }
  function stopLoop(key){const l=S.loops[key];if(l){try{l.src.stop();}catch(_){}delete S.loops[key];}}
  function startAmbience(){S._ambWant=true;startLoop("ambience");}
  function stopAmbience(){S._ambWant=false;stopLoop("ambience");}

  // ---- v109 THE VOICES: per-unit voice identity + event router ----
  // Every unit keeps ONE voice for life, picked from its id — deterministic, so host and
  // guests agree without a byte on the wire. Soldiers draw from the 3 full voices (b/c/d);
  // villagers/traders draw from the mixed civilian pool (a=male grunts, e/f/g=female).
  const SOLDIER_V=["b","c","d"], CIVIL_V=["a","e","f","g"];
  function isCivilCls(cls){const c=(typeof CLS!=="undefined"&&CLS[cls])||null;return !!c&&(c.line==="civil"||c.line==="trade");}
  function voxVoice(u){
    const id=(u&&u.id)||0;
    return isCivilCls(u&&u.cls)?CIVIL_V[id%4]:SOLDIER_V[id%3];
  }
  function voxKeyFor(kind,u){ // kind: atk | painm | pain | painh | death | deathi | shout
    const v=voxVoice(u), civ=CIVIL_V.indexOf(v)>=0;
    if(civ&&(kind==="atk"||kind==="shout"))return null;     // farmers don't war-cry
    if(kind==="painm"||kind==="painh")return civ?("vpain_"+v):((kind==="painm"?"vpainm_":"vpainh_")+v);
    if(kind==="deathi"&&civ)return "vdeath_"+v;             // civilians have one death pool
    return "v"+kind+"_"+v;
  }
  function vox(kind,u,opts){const k=voxKeyFor(kind,u);return k?play(k,opts||{}):false;}
  function voxChorus(x,z,n){ // a ragged war-cry: 2-3 distinct voices, staggered ~150 ms
    n=n||(2+((Math.random()*2)|0));
    const vs=SOLDIER_V.slice().sort(()=>Math.random()-0.5).slice(0,Math.min(3,Math.max(1,n)));
    for(let i=0;i<vs.length;i++){
      const key="vshout_"+vs[i], opts=(typeof x==="number")?{x:x,z:z}:{};
      if(i===0)play(key,opts);
      else if(typeof setTimeout!=="undefined")setTimeout(()=>play(key,opts),140*i+((Math.random()*60)|0));
    }
  }

  // ---- v107 THE SCORE: per-age anthems ----
  // 6 Suno tracks, one per age (audio/music/age0-5.ogg). Your TEAM's anthem plays ONCE at
  // match start (Stone) and once each time your age lands; then silence — the nature bed
  // swells back. While an anthem plays the ambience bus DUCKS to a third. When your team's
  // 90s advance enters its last 15 seconds, the old anthem fades out under the countdown.
  // Streamed via <audio> (NOT decoded buffers — ~54 min of music would eat RAM, and media
  // elements play fine from file:// where fetch cannot). The music slider + mute apply live.
  const MUSDIR="audio/music/", MUSFADE_S=15, MUSDUCK=0.33;
  const MUSTRIM=0.42; // v113: was 0.6 (v109). John's v112 field test — music "still a little loud
                     // compared to other sounds", so the baked trim deepens −4.4 dB → −7.5 dB. Suno
                     // masters run ~4 LU hotter than the Empire foley AND the v109 double-gain fix
                     // made SFX up to 12 dB louder, so the anthem needed to come down twice.
  const MU={el:null,age:-1,playing:false,fade:1,duck:1};
  function musTrackFor(age){age=age|0;if(age<0)age=0;if(age>5)age=5;return MUSDIR+"age"+age+".ogg";}
  function musFadeFor(remain){ // research seconds remaining -> anthem fade 0..1
    if(!(remain>0))return 1;            // no advance running → full voice
    return remain>=MUSFADE_S?1:remain/MUSFADE_S; // 15s→1 … 0s→0
  }
  function musVol(fade){
    let v=S.vol.master*S.vol.music*MUSTRIM*(S.mute?0:1)*(fade===undefined?1:fade);
    return v<0?0:v>1?1:v;
  }
  function musTick(active,dt){
    if(!active){ // menu / game over: the anthem rests and re-arms for the next match
      if(MU.playing&&MU.el){try{MU.el.pause();}catch(_){}}
      MU.playing=false;MU.age=-1;MU.fade=1;
      applyDuck(1,dt);
      return;
    }
    const myAge=(typeof teamAge!=="undefined"&&typeof MYTEAM!=="undefined")?(teamAge[MYTEAM]|0):0;
    if(MU.age!==myAge&&!MU.dead){ // match start, your age landing, or a late join — the anthem plays once
      MU.age=myAge;MU.fade=1;
      if(typeof Audio!=="undefined"){
        try{
          if(!MU.el){MU.el=new Audio();MU.el.preload="auto";
            MU.el.addEventListener("ended",()=>{MU.playing=false;});
            // v111 DIAGNOSTIC: a missing/broken track is LOUD about it — the code zip ships
            // without audio/music/ (size cap), so a fresh extract or a zip-dragged Netlify
            // deploy has no anthems; this line is how John finds out instead of hearing silence
            MU.el.addEventListener("error",()=>{MU.playing=false;MU.dead=true;
              if(typeof msg==="function")msg("♪ MUSIC FILES NOT FOUND — this copy has no audio/music/ folder. The anthems ship separately (music zips) or live in your main project folder.","warn");});}
          MU.el.src=musTrackFor(myAge);MU.el.loop=false;MU.el.volume=musVol(1);
          MU.playing=true;
          const p=MU.el.play();
          if(p&&p.then)p.then(()=>{MU.tries=0;
            if(typeof msg==="function"&&typeof AGES!=="undefined"&&AGES[myAge]) // v111: proof-of-life + a nudge at the M menu
              msg("♪ "+AGES[myAge].name+" anthem (M adjusts music volume)","gold");
          }).catch(()=>{MU.playing=false;
            // v111: an autoplay refusal (no user gesture yet) re-arms — up to 3 retries on later ticks
            MU.tries=(MU.tries||0)+1; if(MU.tries<=3&&!MU.dead)MU.age=-1;
          });
        }catch(_){MU.playing=false;}
      }
    }
    const remain=(typeof ageResT!=="undefined"&&typeof MYTEAM!=="undefined")?ageResT[MYTEAM]:0;
    MU.fade=musFadeFor(remain);
    if(MU.playing&&MU.el){
      try{MU.el.volume=musVol(MU.fade);}catch(_){}
      if(MU.el.ended)MU.playing=false;
    }
    applyDuck(MU.playing?MUSDUCK:1,dt); // duck under the anthem, swell back in the gaps
  }
  function applyDuck(target,dt){ // ~1s smooth ramp on the ambience bus (gain = slider × duck)
    const k=1-Math.exp(-3*(dt||0.016));
    MU.duck+=(target-MU.duck)*k;
    if(Math.abs(target-MU.duck)<0.01)MU.duck=target;
    if(S.bus.ambience)S.bus.ambience.gain.value=S.vol.ambience*MU.duck;
  }

  // ---- v129.3 THE MENU BED — audio/music/menu.ogg ----
  // The three menu screens get their own looping track, and it hands the room over to the age
  // anthem the moment the war starts.
  //
  // WHY IT CANNOT RIDE musTick(). Sound.tick is called from exactly two places: tickBody's
  // `if(!gameOver)` block and NET.guestFrame. NEITHER runs while inMenu — 09-main returns at
  // its menu branch several lines before either one. musTick's `!active` case has therefore
  // never actually executed in a menu; it only ever fires on game over. So the menu bed is
  // driven from renderFrame, the one function all three frame paths provably call. That is the
  // same reasoning that moved the objective fade in v128.8, and the same trap (#12) behind it.
  //
  // AUTOPLAY. At first launch there has been no user gesture, so play() is refused. Rather than
  // give up (the anthem's 3-try budget assumes a match is already running, so a gesture has
  // certainly happened), this retries every MENURETRY_S until it takes — the player is about to
  // click the dice, the name box or a shield, and the music should come up the instant they do.
  // A genuinely missing/broken file fires `error`, which sets MM.dead and stops the retries for
  // good, so a copy without audio/music/ costs nothing.
  const MUSMENU=MUSDIR+"menu.ogg", MENUFADE_S=0.9, MENURETRY_S=0.6;
  const MM={el:null,on:false,playing:false,fade:0,dead:false,wait:0};
  function musMenuVol(){
    const v=S.vol.master*S.vol.music*MUSTRIM*(S.mute?0:1)*MM.fade;
    return v<0?0:v>1?1:v;
  }
  function musMenuTick(on,dt){
    MM.on=!!on; dt=dt>0?dt:0;
    const step=dt/MENUFADE_S;                       // fade in on arrival, out on the way to war
    if(MM.on){if(MM.fade<1){MM.fade+=step;if(MM.fade>1)MM.fade=1;}}
    else{if(MM.fade>0){MM.fade-=step;if(MM.fade<0)MM.fade=0;}}
    if(MM.el){
      try{MM.el.volume=musMenuVol();}catch(_){}
      // hold the element until the fade has actually finished, so leaving the menu is a
      // crossfade under the starting anthem rather than a cut
      if(!MM.on&&MM.fade<=0&&MM.playing){try{MM.el.pause();}catch(_){}MM.playing=false;}
    }
    if(!MM.on||MM.dead||MM.playing)return;
    if(MM.wait>0){MM.wait-=dt;return;}
    MM.wait=MENURETRY_S;
    if(typeof Audio==="undefined")return;           // node smoketest: the state machine still runs
    try{
      if(!MM.el){
        MM.el=new Audio();MM.el.preload="auto";MM.el.loop=true;
        MM.el.addEventListener("error",()=>{MM.playing=false;MM.dead=true;});
        MM.el.src=MUSMENU;
      }
      MM.el.volume=musMenuVol();
      MM.playing=true;
      const p=MM.el.play();
      if(p&&p.then)p.catch(()=>{MM.playing=false;}); // autoplay refusal — the next tick tries again
    }catch(_){MM.playing=false;}
  }

  // ---- per-frame ambient driver (called from tickBody + guestFrame beside tickBoardBang) ----
  let _marchT=0,_hoofT=0,_gateT=0;
  function tick(dt){
    const active=(typeof gameOver==="undefined"||!gameOver)&&(typeof inMenu==="undefined"||!inMenu)
      &&(typeof player!=="undefined"&&player);
    musTick(active,dt); // v107: anthems stream via <audio> — no buffers needed, runs even pre-decode
    if(!S.ready)return;
    if(active&&!S._ambWant)startAmbience();
    else if(!active&&S._ambWant)stopAmbience();
    if(!active){stopLoop("wildsdrone");stopLoop("water");stopLoop("vbreath");return;}
    // v109: wounded breathing — YOUR ragged breath while under a quarter health
    if(typeof player!=="undefined"&&player&&player.alive&&player.maxHp>0&&player.hp/player.maxHp<0.25)startLoop("vbreath");
    else stopLoop("vbreath");
    // v103: zone ambiences — dread in the wilds, water at the shore/bay
    // v112: WOLF grounds are exempt from the dark-hiss drone (John: loud/unfitting there) —
    // the howls carry the wolf camps' atmosphere; barbarian & viking grounds keep the dread
    if(typeof player!=="undefined"&&player&&player.root){
      const zx=player.root.position.x,zz=player.root.position.z;
      let inW=false,nearWater=false;
      if(typeof campStates!=="undefined")for(const st of campStates){
        const dx=zx-st.x,dz=zz-st.z,d2=dx*dx+dz*dz;
        if(st.r&&d2<st.r*st.r&&st.kind!=="wolf")inW=true;
        if(st.boss&&d2<48*48)nearWater=true;
      }
      if(inW)startLoop("wildsdrone");else stopLoop("wildsdrone");
      if(nearWater)startLoop("water");else stopLoop("water");
    }
    // subtle nearby marching: a soft crowd footfall when a mass of units moves near you
    _marchT+=dt;
    if(_marchT>=1.3){
      _marchT=0;
      if(typeof units!=="undefined"&&typeof player!=="undefined"&&player&&player.root){
        const px=player.root.position.x,pz=player.root.position.z; let near=0,cx=0,cz=0;
        for(const u of units){ if(!u.alive||!u.gmv&&!u.moving||u===player)continue;
          const dx=u.root.position.x-px,dz=u.root.position.z-pz;
          if(dx*dx+dz*dz<34*34){near++;cx+=u.root.position.x;cz+=u.root.position.z;}
        }
        if(near>=6)play("march",{x:cx/near,z:cz/near,gain:Math.min(1,near/16)});
      }
    }
    // v102: galloping hooves (+ occasional neigh) when a cavalry mass moves near you
    _hoofT+=dt;
    if(_hoofT>=1.0){
      _hoofT=0;
      if(typeof units!=="undefined"&&typeof CLS!=="undefined"&&typeof player!=="undefined"&&player&&player.root){
        const px=player.root.position.x,pz=player.root.position.z; let nh=0,hx=0,hz=0;
        for(const u of units){ if(!u.alive||(!u.gmv&&!u.moving)||u===player||!CLS[u.cls]||!CLS[u.cls].mounted)continue;
          const dx=u.root.position.x-px,dz=u.root.position.z-pz;
          if(dx*dx+dz*dz<34*34){nh++;hx+=u.root.position.x;hz+=u.root.position.z;}
        }
        if(nh>=3){play("hooves",{x:hx/nh,z:hz/nh,gain:Math.min(1,nh/10)});
          if(nh>=4)play("neigh",{x:hx/nh,z:hz/nh});}
      }
    }
    // v104: gate creak when you pass through one of YOUR gates (no open/close event — proximity, throttled)
    _gateT+=dt;
    if(_gateT>=0.25){
      _gateT=0;
      if(typeof buildings!=="undefined"&&typeof MYTEAM!=="undefined"&&player&&player.root&&(player.moving||player.gmv)){
        const gx=player.root.position.x,gz=player.root.position.z;
        for(const b of buildings){
          if(!b.alive||!b.def||!b.def.gate||b.team!==MYTEAM)continue;
          const dx=b.x-gx,dz=b.z-gz;
          if(dx*dx+dz*dz<4.5*4.5){play(b.type==="wood_gate"?"gate_wood":"gate_stone",{x:b.x,z:b.z});break;}
        }
      }
    }
  }

  // ---- volume / mute API ----
  function setVol(bus,v){v=v<0?0:v>1?1:v;S.vol[bus]=v;
    if(bus==="master"&&S.master)S.master.gain.value=S.mute?0:v;
    else if(S.bus[bus])S.bus[bus].gain.value=(bus==="ambience"?v*MU.duck:v); // v107: the ambience slider respects the music duck
    if((bus==="master"||bus==="music")&&MU.playing&&MU.el)try{MU.el.volume=musVol(MU.fade);}catch(_){} // v107: the anthem follows the sliders live
    if((bus==="master"||bus==="music")&&MM.el)try{MM.el.volume=musMenuVol();}catch(_){} // v129.3: and so does the menu bed — the Settings shield is IN the menu
    savePrefs();}
  function getVol(bus){return S.vol[bus];}
  function setMute(m){S.mute=!!m;if(S.master)S.master.gain.value=S.mute?0:S.vol.master;
    if(MU.el)try{MU.el.volume=musVol(MU.fade);}catch(_){} // v107: mute silences the anthem too (audio el is outside the graph)
    if(MM.el)try{MM.el.volume=musMenuVol();}catch(_){} // v129.3: …and the menu bed, same reason
    savePrefs();return S.mute;}
  function toggleMute(){return setMute(!S.mute);}
  function isMuted(){return S.mute;}

  loadPrefs();
  // self-wire the autoplay-unlock gesture (no other file needs to call resume)
  if(typeof window!=="undefined"&&window.addEventListener){
    const unlock=()=>{resume();};
    window.addEventListener("pointerdown",unlock);
    window.addEventListener("keydown",unlock);
    window.addEventListener("click",unlock);
  }

  return {play,tick,resume,startAmbience,stopAmbience,startLoop,stopLoop,
    menuTick:musMenuTick, // v129.3: driven from renderFrame — see the note above musMenuTick
    setVol,getVol,setMute,toggleMute,isMuted,
    vox,voxChorus,_voxVoice:voxVoice,_voxKeyFor:voxKeyFor, // v109 THE VOICES
    // test surface (headless-pure):
    _defs:DEFS,_groups:GROUPS,_state:S,_decide:decide,_decideKey:decideConcrete,
    _resolve:resolve,_catOf:catOf,_panFor:panFor,_gainForDist:gainForDist,_throttle:THROTTLE,_capped:CAPPED,
    _mus:MU,_musTick:musTick,_musTrackFor:musTrackFor,_musFadeFor:musFadeFor,_musVol:musVol, // v107
    _mm:MM,_musMenuTick:musMenuTick,_musMenuVol:musMenuVol, // v129.3 the menu bed
    NEAR,FAR,PANWIDTH,MAXVOICES,MUSFADE_S,MUSDUCK,MUSTRIM,MUSMENU,MENUFADE_S,MENURETRY_S};
})();

// ---- options panel (global — 06-input's O key & M key call these) ----
function syncOptionsUI(){
  if(typeof document==="undefined")return;
  const set=(id,bus)=>{const el=document.getElementById(id);if(el)el.value=Math.round(Sound.getVol(bus)*100);
    const lab=document.getElementById(id+"v");if(lab)lab.textContent=Math.round(Sound.getVol(bus)*100)+"%";};
  set("volmaster","master");set("volsfx","sfx");set("volambience","ambience");
  set("volmusic","music");set("volvoip","voip");
  const mb=document.getElementById("btnmute");if(mb)mb.textContent=Sound.isMuted()?"🔇 MUTED — click to unmute":"🔊 MUTE ALL";
}
function toggleOptions(){
  if(typeof document==="undefined")return;
  const ov=document.getElementById("optionsscreen");if(!ov)return;
  const showing=ov.style.display&&ov.style.display!=="none";
  if(showing)ov.style.display="none";
  else{syncOptionsUI();ov.style.display="flex";if(document.exitPointerLock)document.exitPointerLock();}
}
function initOptions(){
  if(typeof document==="undefined"||!document.getElementById)return;
  const bind=(id,bus)=>{const el=document.getElementById(id);if(el&&!el._sb){el._sb=1;
    el.addEventListener("input",()=>{Sound.setVol(bus,(+el.value||0)/100);
      const lab=document.getElementById(id+"v");if(lab)lab.textContent=(el.value|0)+"%";});}};
  bind("volmaster","master");bind("volsfx","sfx");bind("volambience","ambience");
  bind("volmusic","music"); // v107: the Music slider goes LIVE (the per-age anthems)
  const mb=document.getElementById("btnmute");if(mb&&!mb._sb){mb._sb=1;mb.addEventListener("click",()=>{Sound.toggleMute();syncOptionsUI();});}
  const bk=document.getElementById("btnoptback");if(bk&&!bk._sb){bk._sb=1;bk.addEventListener("click",()=>toggleOptions());}
  const ob=document.getElementById("btnoptions");if(ob&&!ob._sb){ob._sb=1;ob.addEventListener("click",()=>toggleOptions());}
  syncOptionsUI();
}
if(typeof document!=="undefined"&&document.getElementById){try{initOptions();}catch(_){}}
