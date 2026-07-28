/* REGICIDE PVP — 10-net.js
   Host-authoritative P2P multiplayer over the free PeerJS broker.
   The HOST runs the whole simulation (AI, economy, combat, physics).
   GUESTS are thin clients: they render host snapshots (12 Hz), send their
   inputs (20 Hz), and take over the body of a living Blue bot on admit —
   disconnecting hands the body straight back to the AI. Solo is untouched. */

var NET={
  mode:"solo",          // "solo" | "host" | "guest"
  PROTO:25,             // bumped whenever the wire format changes OR the generated world does.
                        // v107: the 90s age research (`ares` in snaps + world). v114: the map went
                        // flush with forest — `nodes` is indexed by position in a DETERMINISTIC
                        // world build, so a v113 client and a v114 client disagree about which
                        // tree index 300 is. Same bytes, different world: it has to be gated.
                        // v115: the forest was replanted as STANDS (680 trees, not 590) — same
                        // rule, same reason, so the number moves again.
  peer:null,
  conns:[],             // host: every open guest RELIABLE connection
  conn:null,            // guest: the reliable pipe (events, world, acts)
  fast:null,            // guest: the unreliable pipe (inputs up, snapshots down)
  remotes:{},           // host: peerId -> {conn,fast,unit,input,inputAt,oldName,name,rtt}
  myUid:-1,
  snapT:0, inputT:0, _snapN:0, _q:0, lastQ:-1,
  gapAvg:83, lastArr:0,
  roomCode:"",
  SNAP_HZ:15, INPUT_HZ:20, // deltas made snaps small — spend some savings on freshness
  // ---- v95: the netcode overhaul ----
  BUF_FAST_MAX:16384,   // skip a fast-lane snap when >16KB is still unflushed (v97: was 32KB — that's ¼s of queue on a 1Mbps cable uplink; skip EARLY, stay fresh)
  BUF_REL_MAX:16384,    // NEVER queue a snap behind a reliable-lane backlog — that backlog was THE freeze
  AOI_NEAR:60,          // units within 60 of any guest body refresh every snap…
  AOI_FAR_EVERY:4,      // …distant ones every 4th (structural changes — death/class/garrison — always ship at once)
  INPUT_STALE_MS:600,   // a guest whose inputs stop arriving stops walking (no runaway ghosts)
  AUTH_FRESH_S:0.6,     // authority older than this (vs the guest's clock) may not yank the player — backlog ≠ truth
  estT:null, ping:0, _fx:[],
  // ---- v92: identity + host options + the HALL (serverless server browser) ----
  myName:"Warrior",     // set on the name screen; the host's tag & scoreboard name
  gameMode:"pvp",       // "pvp" | "coop" — co-op admits every joiner to BLUE vs the Red AI
  isPublic:true,        // public halls announce to the hall registry; private ones hide
  password:"",          // private halls demand this in the hello
  hall:{role:"none",peer:null,conn:null,servers:{},hbT:null}, // role: none|registry|client
};
// THE HALL: a well-known PeerJS id acts as the server directory. The first public
// host to claim it BECOMES the registry (serving lists while playing); later hosts
// report to it with heartbeats; browsers query it. No backend, no Netlify involvement.
// If the registry's tab closes, the next heartbeat elects a new one.
var HALL_ID="regicide-hall-v1";
// v97: OPTIONAL TURN relay — the rescue lane for pairs whose routers refuse direct P2P
// (permanent 🐢 or no connection at all — matters most once strangers join via THE HALL).
// Stand up coturn per docs/TURN-SERVER-GUIDE.md, then fill in this ONE line:
NET.TURN=null; // e.g. {urls:"turn:YOUR.VPS.IP:3478",username:"regicide",credential:"YOUR-SECRET"}
NET.peerOpts=function(){
  const ice=[{urls:"stun:stun.l.google.com:19302"}];
  if(NET.TURN)ice.push(NET.TURN);
  return {config:{iceServers:ice}};
};
const CLS_KEYS=Object.keys(CLS), CLS_IDX={};
CLS_KEYS.forEach((k,i)=>CLS_IDX[k]=i);

// ---------- tiny helpers ----------
NET.bcast=function(o){for(const c of NET.conns){try{if(c.open)c.send(o);}catch(_){}}};
NET.laneBuf=function(c){ // bytes sitting UNSENT in a lane's pipe — the honest congestion signal
  try{const dc=c&&c.dataChannel;return(dc&&typeof dc.bufferedAmount==="number")?dc.bufferedAmount:0;}
  catch(_){return 0;}
};
NET.bcastFast=function(o){ // unreliable when healthy, never starving — and NEVER queueing behind a backlog.
  // v95 CONGESTION CONTROL: the old code fired snaps into the pipe blind. On a weak
  // uplink the reliable lane buffered SECONDS of stale snapshots; when they finally
  // drained, each one re-armed the guest's leash and dragged them back through the
  // past — the "world frozen, can't walk" freeze. Now a lane only gets a snap when
  // its buffer is close to empty: a choked pipe skips frames and the guest gets the
  // FRESHEST world the moment it drains, not a replay of everything it missed.
  for(const k in NET.remotes){
    const r=NET.remotes[k];
    try{
      const fastUp=r.fast&&r.fast.open;
      if(fastUp){
        if(NET.laneBuf(r.fast)<NET.BUF_FAST_MAX){r.fast.send(o);r.sentF=(r.sentF||0)+1;}
        else r.skipF=(r.skipF||0)+1;
      }
      if(r.conn&&r.conn.open&&(!fastUp||(o.t==="snap"&&o.q%4===0))){
        if(NET.laneBuf(r.conn)<NET.BUF_REL_MAX)r.conn.send(o);
        else r.skipR=(r.skipR||0)+1;
      }
    }catch(_){}
  }
};
// ---- v98 THE NET LOG: a rolling flight recorder for multiplayer sessions ----
// 1 row/second on both host and guest + a small event stream. F9 downloads it as
// JSON; John drops the file into the chat and the numbers do the arguing.
NET.LOG={rows:[],events:[],max:2400};
NET.logEvent=function(k,d){
  try{NET.LOG.events.push({t:Date.now(),T:(typeof T==="number")?r1(T):0,k,d:d===undefined?null:d});
    if(NET.LOG.events.length>400)NET.LOG.events.shift();}catch(_){}
};
NET.logRow=function(row){NET.LOG.rows.push(row);if(NET.LOG.rows.length>NET.LOG.max)NET.LOG.rows.shift();};
NET.saveLog=function(){
  const payload={meta:{game:"REGICIDE",ver:"v98",proto:NET.PROTO,role:NET.mode,name:NET.myName,
    room:NET.roomCode||"",saved:new Date().toISOString(),
    ua:(typeof navigator!=="undefined"&&navigator.userAgent)||"",
    snapHz:NET.SNAP_HZ,bufFast:NET.BUF_FAST_MAX,bufRel:NET.BUF_REL_MAX,aoiNear:NET.AOI_NEAR},
    rows:NET.LOG.rows,events:NET.LOG.events};
  try{
    const blob=new Blob([JSON.stringify(payload)],{type:"application/json"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download="regicide-netlog-"+NET.mode+"-"+(NET.myName||"warrior").replace(/[^a-z0-9]/gi,"")+
      "-"+new Date().toISOString().slice(11,19).replace(/:/g,"")+".json";
    document.body.appendChild(a); a.click();
    setTimeout(()=>{try{URL.revokeObjectURL(a.href);a.remove();}catch(_){}},2000);
    msg("📊 Net log saved — "+NET.LOG.rows.length+"s of data. Send the file to Claude.","gold");
  }catch(_){/* headless or download blocked — the payload still returns for tests */}
  return payload;
};
NET.unitById=function(id){for(const u of units)if(u.id===id)return u;return null;};
NET.bldById=function(id){for(const b of buildings)if(b.id===id)return b;return null;};
function r1(v){return Math.round(v*10)/10;}
function r2(v){return Math.round(v*100)/100;} // v124: the analog move vector — 2dp is ~0.6 degrees
NET.status=function(txt,show){
  const el=document.getElementById("netstatus");
  el.style.display=show===false?"none":"block";
  el.innerHTML=txt;
};

// ---------- monkeypatched event broadcasts ----------
// Wrapped once at load; they only speak when we are the host, so the guest's
// bnew handler can safely call makeBuilding without echoing it back out.
const _real_makeBuilding=makeBuilding;
makeBuilding=function(team,type,x,z,instant,rot){
  const b=_real_makeBuilding(team,type,x,z,instant,rot);
  if(NET.mode==="host")
    NET.bcast({t:"bnew",id:b.id,team,type,x:r1(x),z:r1(z),rot:rot||0,built:instant?1:0});
  return b;
};
const _real_makeUnit=makeUnit;
makeUnit=function(team,cls,x,z,opts){
  const u=_real_makeUnit(team,cls,x,z,opts);
  if(NET.mode==="host")
    NET.bcast({t:"unew",id:u.id,team,cls,x:r1(x),z:r1(z),name:u.name});
  return u;
};
const _real_shootArrow=shootArrow;
shootArrow=function(att,target){
  _real_shootArrow(att,target);
  // v95: arrow theatre used to ride the RELIABLE lane one message per arrow — in a
  // mass battle that flooded the same pipe the snapshots need (head-of-line blocking).
  // Now shots batch into the next snapshot; a dropped packet drops only cosmetics.
  if(NET.mode==="host"&&NET._fx.length<60)
    NET._fx.push([att.def?-1:att.id,att.def?att.id:-1,target.def?-1:target.id,target.def?target.id:-1]);
};
const _real_depleteNode=depleteNode;
depleteNode=function(n){
  _real_depleteNode(n);
  if(typeof Sound!=="undefined"&&n)Sound.play(n.type==="wood"?"treefall":n.type==="food"?"harvest":"stonecrumble",{x:n.x,z:n.z}); // v104: node exhausted (host/solo)
  if(NET.mode==="host")NET.bcast({t:"ndep",i:nodes.indexOf(n)});
};
const _real_endGame=endGame;
endGame=function(winner,killerName){
  if(NET.mode==="host")NET.bcast({t:"end",w:winner,k:killerName});
  _real_endGame(winner,killerName);
};

// ============================================================ HOST ==========
NET.uiShowHost=function(){ // the HOST button reveals the options row
  const jr=document.getElementById("joinrow"), sl=document.getElementById("serverlist");
  if(jr)jr.style.display="none"; if(sl)sl.style.display="none";
  const hr=document.getElementById("hostrow");
  if(hr)hr.style.display=hr.style.display==="flex"?"none":"flex";
  if(hr&&hr.style.display==="flex"&&NET._reveal)NET._reveal(hr); // v124.1
};
NET.uiHost=function(){
  if(typeof Peer==="undefined"){msg("PeerJS failed to load — check your internet connection.","warn");return;}
  if(NET.peer)return;
  if(!NET.isPublic){ // a private hall must have its word set
    NET.password=String((document.getElementById("hostpw")||{value:""}).value||"").slice(0,16);
    if(!NET.password){msg("A PRIVATE hall needs a password — type one, or go PUBLIC.","warn");return;}
  }else NET.password="";
  const abc="abcdefghjkmnpqrstuvwxyz23456789";
  let code="regicide-";for(let i=0;i<4;i++)code+=abc[(Math.random()*abc.length)|0];
  NET.roomCode=code;
  NET.status("Opening the gates…");
  const peer=new Peer(code,NET.peerOpts()); NET.peer=peer;
  peer.on("open",()=>{
    NET.mode="host";
    inMenu=false; // the host walks the world while the lobby gathers
    document.getElementById("startmenu").style.display="none";
    NET.lobby();
    NET.hallJoin(); // stand in the hall (or become it) so browsers can find public games
    msg("You are HOSTING a "+(NET.gameMode==="coop"?"CO-OP":"PvP")+" "+(NET.isPublic?"public":"private")+" hall. Room code: "+code,"gold");
  });
  peer.on("error",e=>{
    msg("Host error: "+e.type+" — try again (the code may be taken).","warn");
    NET.status("Broker error: "+e.type);
    NET.peer=null;
  });
  peer.on("connection",c=>{
    if(c.metadata&&c.metadata.ch==="fast"){ // the guest's second, unreliable lane
      const r=NET.remotes[c.peer];
      if(r){r.fast=c;c.on("data",d=>NET.hostData(r.conn,d));}
      c.on("close",()=>{const rr=NET.remotes[c.peer];if(rr)rr.fast=null;});
      return;
    }
    c.on("data",d=>NET.hostData(c,d));
    c.on("close",()=>NET.hostDrop(c));
    c.on("error",()=>NET.hostDrop(c));
  });
};
NET.lobby=function(){
  const n=NET.conns.length;
  let diag=""; // v95: the host sees each guest's health at a glance — lane, ping, backlog
  for(const k in NET.remotes){
    const r=NET.remotes[k]; if(!r.unit)continue;
    const fastUp=r.fast&&r.fast.open;
    const buf=NET.laneBuf(fastUp?r.fast:r.conn);
    const inAge=r.inputAt?Math.round(performance.now()-r.inputAt):-1;
    diag+="<br><span class='netsub'>"+String(r.name).replace(/[<>&]/g,"")+": "+(fastUp?"⚡":"🐢")+
      " · ping "+(r.rtt?r.rtt+"ms":"—")+" · sent "+(r.sentF||0)+"/s"+ // v97: compare with the guest's received/s — the gap IS the diagnosis
      ((r.skipF||r.skipR)?" · skip "+((r.skipF||0)+(r.skipR||0)):"")+
      (buf>2048?" · ⚠ backlog "+Math.round(buf/1024)+"KB":"")+
      (inAge>NET.INPUT_STALE_MS?" · ⚠ inputs stalled":"")+"</span>";
  }
  NET.status("⚑ ROOM CODE <span class='netcode'>"+NET.roomCode+"</span>"+
    "<button class='copybtn' onclick='NET.copyCode(this)'>COPY</button><br>"+
    "<span class='netsub'>"+(NET.gameMode==="coop"?"🤝 CO-OP vs "+(AI_DIFF[aiDifficulty]||AI_DIFF.easy).name.toUpperCase()+" AI":"⚔ PvP")+" · "+
    (NET.isPublic?"🌐 public — listed in the hall":"🔒 private — code + password only")+" · "+
    n+" warrior"+(n===1?"":"s")+" joined · keep this window visible!</span>"+diag);
};
NET.copyCode=function(btn){
  try{navigator.clipboard.writeText(NET.roomCode);btn.textContent="COPIED ✓";
    setTimeout(()=>btn.textContent="COPY",1400);}
  catch(_){btn.textContent=NET.roomCode;}
};
// a minimized host window is a frozen world — warn everyone, honestly
document.addEventListener("visibilitychange",()=>{
  if(NET.mode!=="host")return;
  NET.bcast({t:"note",m:document.hidden?"⚠ The host minimized their window — the world is paused!"
                                       :"The host returns — the war resumes.",tone:"warn"});
});
NET.hostData=function(c,d){
  if(!d||!d.t)return;
  if(d.t==="hello"){
    if(d.proto!==NET.PROTO){try{c.send({t:"deny",m:"Version mismatch — everyone must run the same REGICIDE build."});}catch(_){}return;}
    if(NET.password&&String(d.pw||"")!==NET.password){ // v92: private halls demand the word
      try{c.send({t:"deny",m:"Wrong password for this hall."});}catch(_){}return;}
    return NET.hostAdmit(c,String(d.name||"Warrior").slice(0,14),d.team||"auto");
  }
  const r=NET.remotes[c.peer];
  if(!r)return;
  if(d.t==="input"){if((d.seq||0)>=(r.input&&r.input.seq||0)){r.input=d;r.inputAt=performance.now();}return;}
  if(d.t==="ping"){ // v95: echo straight back (prefer the fast lane) — the guest measures its RTT
    r.rtt=d.rtt||0; // …and reports the last measurement so the HOST can see each guest's ping too
    const lane=(r.fast&&r.fast.open)?r.fast:r.conn;
    try{if(lane&&lane.open)lane.send({t:"pong",ts:d.ts});}catch(_){}
    return;
  }
  if(d.t==="act")return NET.hostAct(r,d);
};
NET.hostAdmit=function(c,name,pref){
  // pick the team: honor the request, or balance humans on "auto".
  // v92 CO-OP: every joiner fights for BLUE — the Red AI is the enemy.
  if(NET.gameMode==="coop")pref="blue";
  let team=pref==="red"?RED:pref==="blue"?BLUE:null;
  if(team===null){
    let nb=1,nr=0; // the host is blue
    for(const k in NET.remotes){const t=NET.remotes[k].unit&&NET.remotes[k].unit.team;if(t===RED)nr++;else nb++;}
    team=nr<nb?RED:BLUE;
  }
  // v95: joiners take the field as a VILLAGER — prefer a real villager body,
  // then any living bot (re-classed on possession), then a respawning body (respawn is villager anyway).
  let u=null;
  for(const v of units)
    if(v.team===team&&v.bot&&!v.isKing&&!v.isPlayer&&!v.remote&&v.bot.role!=="cart"&&v.alive&&v.cls==="villager"){u=v;break;}
  if(!u)for(const v of units)
    if(v.team===team&&v.bot&&!v.isKing&&!v.isPlayer&&!v.remote&&v.bot.role!=="cart"&&v.alive){u=v;break;}
  if(!u)for(const v of units) // everyone's dead? hand over a respawning body
    if(v.team===team&&v.bot&&!v.isKing&&!v.isPlayer&&!v.remote&&v.bot.role!=="cart"){u=v;break;}
  if(!u){try{c.send({t:"deny",m:"That army is full."});}catch(_){}return;}
  NET.remotes[c.peer]={conn:c,unit:u,input:{},oldName:u.name,name};
  u.remote=c.peer; u.rally=false; u.rallyBy=null; u.name=name;
  if(u.alive&&u.cls!=="villager"){setClass(u,"villager");if(u.bot)u.bot.role="citizen";} // fresh boots, fresh hands
  NET.conns.push(c);
  c.send({t:"admit",uid:u.id});
  c.send(NET.packWorld(u.id));
  msg("⚔ "+name+" joins the "+TEAMNAME[u.team]+" army as "+u.name+"!",u.team===BLUE?"blue":"warn");
  NET.logEvent("join",name);
  NET.lobby();
};
NET.hostDrop=function(c){
  const r=NET.remotes[c.peer];
  if(r){
    if(r.unit){r.unit.remote=null;r.unit.name=r.oldName; // the AI takes the reins back
      const u=r.unit; u.lvl=0;u.xp=0;u.buffs={};u.quest=null;u.questDraft=null;u.qRerolls=0;u.smithOffer=null; // …but not the deserter's legend
      if(typeof applyBuffStats==="function")applyBuffStats(u);
      if(typeof releaseWarband==="function")releaseWarband(u); // v95: the deserter's band returns to the King
      if(u.alive&&u.cls==="oxcart")setClass(u,"villager");} // v99: the AI can't drive an ox — hand it a villager's tools
    msg(r.name+" left — "+r.oldName+" fights on (AI).","warn");
    NET.logEvent("drop",r.name);
    delete NET.remotes[c.peer];
  }
  NET.conns=NET.conns.filter(x=>x!==c);
  if(NET.mode==="host")NET.lobby();
};
// ==================== v92: THE HALL — serverless server browser ====================
NET.hallEntryOwn=function(){ // our own listing (public halls only)
  return {code:NET.roomCode,name:NET.myName,mode:NET.gameMode,
    players:1+NET.conns.length,proto:NET.PROTO,t:(typeof performance!=="undefined"?performance.now():0)};
};
NET.hallData=function(c,d){ // the registry's whole brain — runs on whichever host holds HALL_ID
  if(!d||!d.t)return;
  const now=(typeof performance!=="undefined"?performance.now():0);
  if(d.t==="announce"&&d.s&&d.s.code){d.s.t=now;NET.hall.servers[d.s.code]=d.s;return;}
  if(d.t==="bye"&&d.code){delete NET.hall.servers[d.code];return;}
  if(d.t==="list"){
    const out=[];
    for(const k in NET.hall.servers){
      const s=NET.hall.servers[k];
      if(now-s.t>45000){delete NET.hall.servers[k];continue;} // heartbeats are 20s: two misses = gone
      out.push(s);
    }
    if(NET.mode==="host"&&NET.roomCode&&NET.isPublic)out.push(NET.hallEntryOwn());
    try{c.send({t:"servers",list:out});}catch(_){}
  }
};
NET.hallJoin=function(){ // hosting has begun: claim the hall, or report our game to it
  if(typeof Peer==="undefined")return;
  const tryServe=()=>{ // attempt to BECOME the registry
    if(NET.mode!=="host"||NET.hall.role!=="none")return;
    let hp=null;
    try{hp=new Peer(HALL_ID,NET.peerOpts());}catch(_){return;}
    hp.on("open",()=>{NET.hall.role="registry";NET.hall.peer=hp;});
    hp.on("connection",c=>{c.on("data",d=>NET.hallData(c,d));});
    hp.on("error",()=>{ // the hall already has a keeper (or the broker hiccuped)
      try{hp.destroy();}catch(_){}
      if(NET.hall.role!=="registry"){NET.hall.role="none";tryReport();}
    });
  };
  const tryReport=()=>{ // announce our public game to whoever keeps the hall
    if(NET.mode!=="host"||NET.hall.role!=="none"||!NET.isPublic)return;
    try{
      const c=NET.peer.connect(HALL_ID,{reliable:true});
      c.on("open",()=>{NET.hall.role="client";NET.hall.conn=c;
        try{c.send({t:"announce",s:NET.hallEntryOwn()});}catch(_){}});
      c.on("close",()=>{if(NET.hall.conn===c){NET.hall.role="none";NET.hall.conn=null;}});
      c.on("error",()=>{if(NET.hall.conn===c||NET.hall.role==="none"){NET.hall.role="none";NET.hall.conn=null;}});
    }catch(_){}
  };
  tryServe(); // private hosts still keep the hall for others — they just never list themselves
  NET.hall.hbT=setInterval(()=>{ // heartbeat: refresh our listing; re-elect a fallen hall
    if(NET.mode!=="host"){clearInterval(NET.hall.hbT);return;}
    if(NET.hall.role==="client"&&NET.hall.conn&&NET.hall.conn.open){
      if(NET.isPublic)try{NET.hall.conn.send({t:"announce",s:NET.hallEntryOwn()});}catch(_){}
    }else if(NET.hall.role!=="registry"){NET.hall.role="none";tryServe();}
  },20000);
};
// -------- the browser side: query the hall, paint the rows --------
NET.uiBrowse=function(){
  if(typeof Peer==="undefined"){msg("PeerJS failed to load — check your internet connection.","warn");return;}
  const box=document.getElementById("serverlist");
  box.style.display="block";
  box.innerHTML="<div class='svrow svempty'>🔭 Scanning the realm…</div>";
  let answered=false;
  const finish=list=>{if(answered)return;answered=true;NET.renderServers(list);};
  try{
    if(!NET._browsePeer){
      NET._browsePeer=new Peer(NET.peerOpts());
      NET._browsePeer.on("error",e=>{if(e&&e.type==="peer-unavailable")finish([]);});
    }
    const bp=NET._browsePeer;
    const go=()=>{
      const c=bp.connect(HALL_ID,{reliable:true});
      c.on("open",()=>{try{c.send({t:"list"});}catch(_){}});
      c.on("data",d=>{if(d&&d.t==="servers"){finish(d.list||[]);try{c.close();}catch(_){}}});
      c.on("error",()=>finish([]));
    };
    if(bp.open)go(); else bp.on("open",go);
  }catch(_){finish([]);}
  setTimeout(()=>finish([]),7000); // an empty realm answers with silence
};
NET.renderServers=function(list){
  const box=document.getElementById("serverlist"); if(!box)return;
  box.style.display="block";
  if(!list||!list.length){
    box.innerHTML="<div class='svrow svempty'>No open halls right now — HOST one, or join by code.</div>";
    return;
  }
  let html="";
  for(const s of list){
    const stale=s.proto!==NET.PROTO;
    html+="<div class='svrow"+(stale?" svold":"")+"' data-code='"+String(s.code||"").replace(/[^a-z0-9-]/g,"")+"'>"+
      "<span class='svname'>"+String(s.name||"Warrior").slice(0,14).replace(/[<>&]/g,"")+"'s hall</span>"+
      "<span class='svmeta'>"+(s.mode==="coop"?"🤝 CO-OP":"⚔ PvP")+"</span>"+
      "<span class='svmeta'>"+(s.players|0)+" playing</span>"+
      (stale?"<span class='svmeta'>⚠ other version</span>":"<span class='svmeta'>JOIN ▸</span>")+
      "</div>";
  }
  box.innerHTML=html+"<div class='svrow svempty'>🔭 click BROWSE again to refresh</div>";
  box.querySelectorAll(".svrow[data-code]").forEach(row=>{
    row.onclick=()=>{
      if(row.classList.contains("svold"))return;
      document.getElementById("joincode").value=row.dataset.code;
      NET.uiJoin();
    };
  });
};
// -------- host: drive possessed bodies from their owners' inputs --------
NET.hostFrame=function(dt){
  NET._cFrames=(NET._cFrames||0)+1; // fps for the net log
  NET._tagT=(NET._tagT||0)+dt;
  if(NET._tagT>1){NET._tagT=0;
    const sc=[[NET.myName,0,player.team,player.id,player.lvl||0]];
    for(const k in NET.remotes){const rr=NET.remotes[k];if(rr.unit)sc.push([rr.name,0,rr.unit.team,rr.unit.id,rr.unit.lvl||0]);}
    syncNameTags(sc);
  }
  for(const k in NET.remotes)NET.driveRemote(NET.remotes[k],dt);
  NET.snapT+=dt;
  if(NET.snapT>=1/NET.SNAP_HZ){
    // v97: carry the remainder instead of resetting — a 20fps host used to quietly
    // drop to 10 snaps/s (the interval only lined up with whole frames)
    NET.snapT=Math.min(NET.snapT-1/NET.SNAP_HZ,1/NET.SNAP_HZ);
    NET.bcastFast(NET.packSnap());
  }
  NET._diagT=(NET._diagT||0)+dt; // v95: refresh the per-guest health line each second
  if(NET._diagT>=1){
    NET._diagT=0;
    { // v98: one net-log row per second — sample BEFORE the windows reset
      const g={};
      for(const k in NET.remotes){const rr=NET.remotes[k];if(!rr.unit)continue;
        const fu=rr.fast&&rr.fast.open;
        g[rr.name]={ping:rr.rtt||0,sent:rr.sentF||0,skipF:rr.skipF||0,skipR:rr.skipR||0,
          buf:NET.laneBuf(fu?rr.fast:rr.conn),
          inAge:rr.inputAt?Math.round(performance.now()-rr.inputAt):-1,fast:fu?1:0};}
      NET.logRow({t:Date.now(),T:r1(T),role:"h",fps:NET._cFrames||0,
        units:units.length,blds:buildings.length,g});
      NET._cFrames=0;
    }
    NET.lobby();
    for(const k in NET.remotes){const rr=NET.remotes[k];rr.sentF=0;rr.skipF=0;rr.skipR=0;} // per-second windows
  }
};
NET.note=function(r,m,tone){try{r.conn.send({t:"note",m,tone});}catch(_){}};
NET.driveRemote=function(r,dt){
  const u=r.unit;
  // v95: inputs older than INPUT_STALE_MS are DEAD inputs — when a guest's uplink
  // clogs, their body stops in its tracks instead of ghost-walking on the last keys.
  const stale=r.inputAt&&(performance.now()-r.inputAt>NET.INPUT_STALE_MS);
  const i=(stale?{}:r.input)||{};
  if(!u||!u.alive){r.lastE=!!i.e;return;}
  // stances
  if((u.cls==="catapult"||u.cls==="trebuchet")&&typeof i.lobx==="number"){
    if(u.atkT<=0){
      const dx=i.lobx-u.root.position.x,dz=i.lobz-u.root.position.z,dd=Math.hypot(dx,dz);
      const maxD=u.cls==="trebuchet"?u.rng+8:46; // v97: the SAME reach the aiming UI shows (catapults were clamped 8 short for guests)
      const cl=Math.min(1,maxD/Math.max(1,dd));
      launchLob(u,u.root.position.x+dx*cl,u.root.position.z+dz*cl);
      u.atkT=u.cd;
    }
    i.lobx=undefined;
  }
  // ---- v124 THE DRAW, host-authoritative ----
  // The host watches the guest hold, so the guest can never claim more charge than it actually
  // built. `blk` is what aiming looks like on the wire for a ranged class, and a stale/dropped
  // packet simply stops the clock rather than granting free charge.
  const _lobber=(u.cls==="catapult"||u.cls==="trebuchet");
  const _rangedAim=!!i.blk&&!!u.ranged&&!_lobber;
  if(_rangedAim&&i.atk&&isDrawClass(u.cls)&&u.atkT<=0)r.drawT=(r.drawT||0)+dt;
  else if(!i.atk)r.drawT=0;
  if(i.shot&&typeof i.shot.dx==="number"){
    const d=new THREE.Vector3(i.shot.dx,i.shot.dy,i.shot.dz);
    if(d.lengthSq()>0.0001){
      d.normalize();
      // clamp the CLAIM to the hold the host observed — this is the whole point of the exercise
      const seen=Math.min(1,(r.drawT||0)/DRAW_FULL);
      const lv=isDrawClass(u.cls)?Math.min(Number(i.shot.lv)||0,seen):1;
      fireAimedFor(u,d,lv);
      r.drawT=0;
    }
    i.shot=undefined;
  }
  if(u.cls==="dragoon"){
    u.blocking=false;
    if(i.blk&&!r.blkUsed&&(u.ammo||0)>0&&u.atkT<=0){
      const t=pistolTarget(u,12); if(t)pistolShot(u,t);
    }
    r.blkUsed=!!i.blk; // edge-trigger: one shot per press
  }else u.blocking=!!i.blk&&canBlock(u);
  // ---- E TAP: garrison / harvest / trade — mirrors playerInteract ----
  const px0=u.root.position.x, pz0=u.root.position.z;
  if(i.e&&!r.lastE){
    r.eUsed=false;
    if(u.garrison){ // climb down
      const b=u.garrison; u.garrison=null; setClassStats(u); u.deckX=u.deckZ=0;
      u.root.position.set(b.x+(b.def.r+1.6),0,b.z);
      u.root.position.y=terrainHeight(u.root.position.x,u.root.position.z);
      NET.note(r,"You climb down from the watch tower.");
      try{r.conn.send({t:"snd",k:"garrison",x:b.x,z:b.z});}catch(_){} // v104: the acting guest hears it
      r.eUsed=true;
    }
    if(!r.eUsed)for(const b of buildings){ // climb up
      if(b.team===u.team&&b.alive&&b.built&&b.type==="watch_tower"&&
         dist2(px0,pz0,b.x,b.z)<Math.pow(b.def.r+2.4,2)&&!CLS[u.cls].mounted&&!isSiege(u.cls)){
        u.garrison=b; u.rng*=1.35; u.gathering=null;
        NET.note(r,"You man the watch tower — loose arrows from on high. E climbs down.","blue");
        try{r.conn.send({t:"snd",k:"garrison",x:b.x,z:b.z});}catch(_){} // v104
        r.eUsed=true;break;
      }
    }
    if(!r.eUsed)for(const b of buildings){ // harvest ripe corn
      if(b.team===u.team&&b.alive&&b.built&&b.type==="farm"&&b.crop>=1&&u.cls==="villager"&&
         dist2(px0,pz0,b.x,b.z)<Math.pow(b.def.r+2.5,2)){
        b.crop=0;
        awardPts(u,20);
        questProgress(u,"harvest");      // REAPER
        questProgress(u,"dep_food",20);  // banked food is banked food
        if(b.cropMesh){b.cropMesh.scale.y=0.15;for(const t of b.tassels)t.visible=false;}
        stock[u.team].food+=20; updateResHud();
        NET.note(r,"Harvested the corn: +20 food, straight to the stockpile.","blue");
        try{r.conn.send({t:"snd",k:"harvest",x:b.x,z:b.z});}catch(_){} // v104
        r.eUsed=true;break;
      }
    }
    if(!r.eUsed&&u.cls==="trader")for(const nm of neutralMarkets){ // load goods
      if(dist2(px0,pz0,nm.x,nm.z)<7*7){
        if(u.tradeLoaded)NET.note(r,"Your cart is already loaded — sell at YOUR Market first.");
        else{u.tradeLoaded=nm;NET.note(r,"Goods loaded! Haul them back to your Market to sell.","blue");try{r.conn.send({t:"snd",k:"bazaarload",x:u.root.position.x,z:u.root.position.z});}catch(_){}} // v104
        r.eUsed=true;break;
      }
    }
    if(!r.eUsed){ // v87 THE TOWN BOARD: the host reads the guest their quest
      const brd=boardFor(u.team);
      if(brd&&dist2(px0,pz0,brd.x,brd.z)<BOARD_REACH*BOARD_REACH){useTownBoard(u);r.eUsed=true;}
    }
    if(!r.eUsed){ // v87 THE BLACKSMITH: the guest's XP is spent host-side, validated by proximity
      const bs=nearestBuilt(u.team,"blacksmith",px0,pz0,BLD.blacksmith.r+2.6);
      if(bs){useBlacksmith(u);r.eUsed=true;}
    }
  }
  r.lastE=!!i.e; if(!i.e)r.eUsed=false;
  // v96 FACING RELAY: the guest's body facing arrives with every input packet.
  // The old leash glided the FEET but never the FACE — a guest circling the host
  // stared one way until an attack happened to reset it. Host-side actions
  // (attack whiff, deck strides) may still override within a frame — exactly as
  // they do on the guest's own screen — and the next packet re-syncs.
  if(typeof i.f==="number"&&isFinite(i.f))u.facing=i.f;
  // ---- garrisoned: walk the deck, rain arrows — same freedom the host player gets ----
  if(u.garrison){
    const gb=u.garrison;
    if(!gb.alive){
      u.garrison=null; setClassStats(u);
      u.root.position.y=terrainHeight(u.root.position.x,u.root.position.z);
      NET.note(r,"The watch tower falls from under you!","warn");
    }else{
      const deck=gb.deck||{y:7.15,r:2.4};
      let gmx=0,gmz=0;
      if(i.w)gmz-=1; if(i.s)gmz+=1; if(i.a)gmx-=1; if(i.d)gmx+=1;
      if(gmx||gmz){
        const dir=new THREE.Vector3(gmx,0,gmz).applyAxisAngle(new THREE.Vector3(0,1,0),i.yaw||0);
        const L=Math.hypot(dir.x,dir.z)||1;
        u.deckX=(u.deckX||0)+dir.x/L*u.spd*dt*0.7;
        u.deckZ=(u.deckZ||0)+dir.z/L*u.spd*dt*0.7;
        const dd=Math.hypot(u.deckX,u.deckZ);
        if(dd>deck.r){u.deckX*=deck.r/dd;u.deckZ*=deck.r/dd;}
        u.facing=Math.atan2(dir.x,dir.z); u.moving=true; u._mv=T; u.walkT+=dt*5;
      }else u.moving=false;
      u.root.position.set(gb.x+(u.deckX||0),gb.root.position.y+deck.y,gb.z+(u.deckZ||0));
      if(i.atk)tryAttack(u);
      return; // no gathering or depositing from up there
    }
  }
  // ---- trader auto-sell at their own Market (4× cart rates) ----
  if(u.cls==="trader"&&u.tradeLoaded){
    const mk=nearestBuilt(u.team,"market",px0,pz0,8);
    if(mk){
      const d=Math.hypot(mk.x-u.tradeLoaded.x,mk.z-u.tradeLoaded.z);
      // v87: 2.5× — the same premium the host player gets (was 4×, a v84 leftover)
      const g=Math.round(2.5*tradeGold(d)*(1+0.10*buffSt(u,"trade"))); // DEEP POCKETS
      awardPts(u,g);
      questTradeSale(u,u.tradeLoaded); // the route quests count the sale
      stock[u.team].gold+=g; updateResHud();
      NET.note(r,"Sold your goods: +"+g+" gold! (trader premium)","blue");
      u.tradeLoaded=null;
    }
  }
  // THE LEASH: the guest already ran this movement through the same collision
  // code — within 6 units, their reported feet ARE the truth. Melee range now
  // matches what they see, and the authority echo cancels the rubber band.
  let trusted=false, moved=false;
  if(typeof i.px==="number"&&!u.garrison){
    let dl=Math.hypot(i.px-u.root.position.x,i.pz-u.root.position.z);
    if(dl>=6&&dl<14){ // stretched leash: adopt the guest's feet ONCE and carry on —
      u.root.position.x=i.px; u.root.position.z=i.pz; dl=0; // never fight a second simulation
    }
    if(dl<6){
      if(dl>0.02){
        const gk=Math.min(1,dt*16); // glide between 20Hz inputs — no 20Hz stepping
        u.root.position.x+=(i.px-u.root.position.x)*gk;
        u.root.position.z+=(i.pz-u.root.position.z)*gk;
        moved=dl>u.spd*dt*0.4;
      }
      trusted=true;
      u.moving=!!(i.w||i.a||i.s||i.d);
      if(u.moving){u._mv=T;u.walkT+=dt*(3.5+(u.spd||3)*0.75);} // stride even without moveUnit
      u._lpx=i.px;u._lpz=i.pz;
    }
  }
  // fallback: outside the leash (or old clients), the host walks the body itself
  let mx=0,mz=0,mag=1;
  // v124: prefer the guest's ANALOG vector when it sent one; fall back to the bits when it did not
  // (a v123 client, or a desktop player on keys). Either way this path only runs outside the leash.
  if(typeof i.mx==="number"&&(i.mx||i.mz)){
    mx=i.mx; mz=i.mz;
    const L=Math.hypot(mx,mz);
    mag=Math.max(0,Math.min(1,L));      // never let a guest claim more than full deflection
  }else{
    if(i.w)mz-=1; if(i.s)mz+=1; if(i.a)mx-=1; if(i.d)mx+=1;
  }
  if(!trusted){
    if((mx||mz)&&!u.garrison){
      const dir=new THREE.Vector3(mx,0,mz).applyAxisAngle(new THREE.Vector3(0,1,0),i.yaw||0);
      moved=moveUnit(u,dir.x,dir.z,dt*mag*(u.blocking?0.55:1));
    }else u.moving=false;
  }
  // attack: auto-target like the player's primary, whiff included.
  // v124: a drawing archer holding primary is NOT swinging — it is nocking. Without this guard the
  // held atk bit would auto-fire an arrow every cooldown all the way through the draw.
  if(i.atk&&!u.blocking&&!(_rangedAim&&isDrawClass(u.cls))){
    if(!tryAttack(u)&&u.atkT<=0&&u.dmg>0){
      u.atkT=u.cd*0.35; u.swing=0.25;
      u.facing=Math.atan2(-Math.sin(i.yaw||0),-Math.cos(i.yaw||0));
      triggerAttackAnim(u);
    }
  }
  const px=u.root.position.x, pz=u.root.position.z;
  // hold-E: construction first (villager), then gathering — mirrors updatePlayer
  if(i.e&&!moved&&!r.eUsed){
    let site=null,sd=1e12;
    for(const b of buildings){
      if(b.team!==u.team||!b.alive||b.built)continue;
      const reach=b.def.r+2.6; // stand at the 2x footprint's edge and still build — same as the host player
      const d=dist2(px,pz,b.x,b.z);
      if(d<reach*reach&&d<sd){sd=d;site=b;}
    }
    if(site&&u.cls==="villager"){
      u.gathering=null;
      u.buildT=(u.buildT||0)+dt; u.swing=Math.max(u.swing||0,0.12);
      u.facing=Math.atan2(site.x-px,site.z-pz);
      if(u.buildT>0.45){u.buildT=0;addConstructionHit(site,u);}
    }else if(u.cls==="villager"||u.cls==="oxcart"){ // v99: the ox gathers too — timber only
      if(!u.gathering||u.gathering.amount<=0){
        let n=null,nd=3.4*3.4;
        for(const nn of nodes){
          if(nn.amount<=0)continue;
          if(u.cls==="oxcart"&&nn.type!=="wood")continue; // the ox snubs everything but trees
          const d=dist2(px,pz,nn.x,nn.z);
          if(d<nd){nd=d;n=nn;}
        }
        if(n){u.gathering=n;u.gatherT=0;}
      }
      const n=u.gathering;
      if(n){
        u.gatherT+=dt; u.swing=Math.max(u.swing||0,0.12);
        u.facing=Math.atan2(n.x-px,n.z-pz);
        if(u.gatherT>(0.6-0.1*buffSt(u,"gather"))*(n.slow||1)){ // PRACTICED HANDS
          u.gatherT=0;
          const cap=carryCap(u); // DEEP SATCHEL (the ox bed holds 300)
          const total=u.carry.food+u.carry.gold+u.carry.stone+u.carry.wood;
          if(total>=cap)u.gathering=null;
          else{
            const tk=Math.min(u.cls==="oxcart"?4:1,n.amount,cap-u.carry[n.type]); // v99: four swings' worth for the ox
            if(tk>0){n.amount-=tk; u.carry[n.type]+=tk;} // the guest's pack is just as finite
            puff(n.x,1.5+(n.y||0),n.z,n.type==="food"?0xd23c2f:n.type==="gold"?0xe0a92e:n.type==="stone"?0x9aa2ad:0x8a6a3f);
            if(n.amount<=0)depleteNode(n);
          }
        }
      }
    }
  }
  // auto-deposit at TC / Storage Pit / Castle — same radii as the host player
  if(u.carry.food||u.carry.gold||u.carry.stone||u.carry.wood){
    let dep=nearestBuilt(u.team,"castle",px,pz,BLD.castle.r+3.5)||nearestBuilt(u.team,"storage_pit",px,pz,BLD.storage_pit.r+3.5);
    const tc=teamTC(u.team);
    if(!dep&&tc&&dist2(px,pz,tc.x,tc.z)<Math.pow(tc.def.r+3.5,2))dep=tc;
    if(dep){
      awardPts(u,u.carry.food+u.carry.gold+u.carry.stone+u.carry.wood);
      questDeposit(u,u.carry.food,u.carry.gold,u.carry.stone,u.carry.wood); // the collection quests
      stock[u.team].food+=u.carry.food;stock[u.team].gold+=u.carry.gold;
      stock[u.team].stone+=u.carry.stone;stock[u.team].wood+=u.carry.wood;
      u.carry.food=0;u.carry.gold=0;u.carry.stone=0;u.carry.wood=0;
      updateResHud();
    }
  }
};
// -------- host: validated guest actions (team stock pays, host decides) ----
NET.hostAct=function(r,a){
  const u=r.unit, deny=m=>{try{r.conn.send({t:"deny",m});}catch(_){}};
  if(!u||!u.alive)return deny("You are down — wait for your respawn.");
  if(a.act==="resurrect"){
    if(u.cls!=="priest")return deny("Only a priest can raise the dead.");
    const tgt=NET.unitById(a.id);
    if(!tgt||tgt.alive||!tgt.corpse||tgt.team!==u.team)return deny("No fallen ally to raise there.");
    if(isSiege(tgt.cls))return deny("Faith moves flesh, not cold iron — siege engines stay dead.");
    const d=dist2(u.root.position.x,u.root.position.z,tgt.root.position.x,tgt.root.position.z);
    const reach=RES_REACH+2.0; // a little slack for guest/host position drift
    if(d>reach*reach)return deny("Stand over the body to raise it.");
    if(T-(u._resAt||-1e9)<resCdFor(u)-0.3)return deny("Not enough faith yet."); // ZEALOTRY honored host-side
    resurrectUnit(tgt,u);
    return;
  }
  if(a.act==="train"){
    const d=CLS[a.cls];
    // v95: the old check (`!d.cost`) rejected every FREE class — so a guest who armed
    // up could NEVER go back to Villager (cost:null → "Unknown class"). Validate the
    // way the host's own menu does instead: villager and trader always, otherwise the
    // class must be what a training line actually offers at this team's age. That also
    // slams the door on hand-crafted acts training wilds (wolf, vikingboss…).
    const legit=d&&(a.cls==="villager"||a.cls==="trader"||a.cls==="oxcart"||
      Object.keys(LINES).some(l=>lineUnitFor(l,u.team)===a.cls));
    if(!legit)return deny("Unknown class.");
    if(d.cost&&!canAfford(u.team,d.cost))return deny("The team stockpile can't afford a "+d.name+".");
    if(d.cost)pay(u.team,d.cost);
    setClass(u,a.cls); updateResHud();
    if(a.cls!=="villager")questProgress(u,"train"); // MASTER-AT-ARMS
    msg(r.name+(a.cls==="villager"?" returns to the fields as a Villager.":" armed up as a "+d.name+"."),"blue");
    return;
  }
  if(a.act==="build"){
    const d=BLD[a.type]; if(!d)return deny("Unknown building.");
    if(!validFor(a.type,a.x,a.z,u.team))return deny("Can't build there — too close to something.");
    if(!canAfford(u.team,d.cost))return deny("Not enough resources for a "+d.name+".");
    pay(u.team,d.cost);
    const nb=makeBuilding(u.team,a.type,a.x,a.z,false,a.rot||0); nb.qBy=u.id; // quest credit on completion
    updateResHud();
    msg(r.name+" laid a "+d.name+" foundation.","blue");
    return;
  }
  if(a.act==="quest"){ // v99: the guest's pick (or redraw) at the Town Board draft
    const brd=boardFor(u.team);
    if(!brd||dist2(u.root.position.x,u.root.position.z,brd.x,brd.z)>Math.pow(BOARD_REACH+2,2))
      return deny("Stand at the Town Board.");
    if(a.redraw){
      if(!questRedraw(u))return deny("No rerolls banked — gain a level to earn one.");
      try{r.conn.send({t:"qdraft",offer:u.questDraft.slice(),rr:u.qRerolls||0});}catch(_){} // re-lay the fresh trio
      return;
    }
    if(!questPick(u,a.pick|0))return deny("That posting isn't on the board — press E to read it.");
    return;
  }
  if(a.act==="buff"){ // v93: the guest chose one of the three on the smith's table
    const bs=nearestBuilt(u.team,"blacksmith",u.root.position.x,u.root.position.z,BLD.blacksmith.r+4.6); // +2 drift slack
    if(!bs)return deny("Stand at the Blacksmith to trade XP for steel.");
    if((u.xp||0)<1)return deny("No XP to spend — finish Town Board quests.");
    if(!smithPick(u,String(a.pick||"")))return deny("That piece isn't on the table — press E at the forge for the standing offer.");
    return;
  }
  if(a.act==="charge"){ // F: the guest hurls the rallied line down their own gaze
    const n=orderCharge(u,typeof a.yaw==="number"?a.yaw:0);
    if(!n)return deny("No rallied soldiers to charge — press G to rally them first.");
    msg(r.name+" sounds the CHARGE!","warn");
    NET.note(r,"⚔ CHARGE! Your rallied soldiers storm ahead — they'll hold the far ground (G recalls them).","gold");
    return;
  }
  if(a.act==="rally"){ // v89: the same cap-aware horn the host blows (Bannerman honored host-side)
    const res=toggleRallyFor(u);
    if(!res)return deny("No allied soldiers to rally yet.");
    msg(res.on?"⚑ "+r.name+" rallies "+res.n+" soldiers!":r.name+" sends the soldiers home.","blue");
    NET.note(r,res.on?"⚑ "+res.n+" soldiers rally to YOU (cap "+rallyCapFor(u)+" — Bannerman adds more). G recalls · F charges."
                     :"Soldiers return to guard the King.","blue");
    return;
  }
  if(a.act==="gate"){
    const w=NET.bldById(a.wid), d=BLD[a.type];
    if(!w||!w.alive||!w.built||w.team!==u.team||!w.def.wall||w.def.gate)return deny("Aim at one of your BUILT wall segments.");
    if(!d||!d.gate)return deny("That is not a gate.");
    if(!canAfford(u.team,d.cost))return deny("The stockpile can't afford a "+d.name+".");
    pay(u.team,d.cost); placeGateOnWall(w,a.type,u.team); updateResHud();
    msg(r.name+" set a gate into the wall.","blue");
    return;
  }
  if(a.act==="ageup"){
    const tc=teamTC(u.team);
    if(!tc||dist2(u.root.position.x,u.root.position.z,tc.x,tc.z)>12*12)
      return deny("Stand at your Town Center to advance the age (T).");
    const nxt=AGES[teamAge[u.team]+1];
    if(!nxt)return deny("Your civilization is already in the final age.");
    if(ageResT[u.team]>0)return deny("⏳ Your team is already advancing — "+Math.ceil(ageResT[u.team])+"s to go.");
    if(!canAfford(u.team,nxt.cost))return deny(nxt.name+" costs "+costText(nxt.cost)+".");
    startAgeResearch(u.team); // v107: the guest pays now too — the countdown rides every snap
    return;
  }
};
// -------- host: the wire format --------
NET.packWorld=function(uid){
  return {t:"world",uid,T:r1(T),ages:[teamAge[BLUE],teamAge[RED]],
    ares:[r1(ageResT[BLUE]),r1(ageResT[RED])], // v107: a late joiner sees the running countdown
    stock0:{f:Math.floor(stock[BLUE].food),g:Math.floor(stock[BLUE].gold),
            s:Math.floor(stock[BLUE].stone),w:Math.floor(stock[BLUE].wood)},
    stock1:{f:Math.floor(stock[RED].food),g:Math.floor(stock[RED].gold),
            s:Math.floor(stock[RED].stone),w:Math.floor(stock[RED].wood)},
    units:units.map(u=>[u.id,u.cls,u.alive?1:0,r1(u.root.position.x),r1(u.root.position.z),
      r1(u.facing),Math.round(u.hp),Math.round(u.maxHp),u.isPlayer?"Host":u.name,u.team]),
    blds:buildings.map(b=>[b.id,b.team,b.type,r1(b.x),r1(b.z),r1(b.rot||0),
      b.built?1:0,b.progress,Math.round(b.hp),b.alive?1:0,r1(b.crop||0)]),
    nodes:nodes.map(n=>Math.max(0,Math.round(n.amount))),
    camps:campStates.map(s=>[s.chest?s.chestKind:null,s.chestB?s.chestKindB:null])}; // standing chests (both slots) for the late joiner
};
// ---- v95 THE WIRE DIET (v99: +the cargo byte) ----
// Unit rows travel as PACKED BINARY: 18 bytes each in one ArrayBuffer instead of a
// ~45-byte JSON array — PeerJS's BinaryPack ships raw buffers untouched. Layout:
//   u16 id · u8 clsIdx · u8 flags(1 alive|2 moving|4 swing|pulse<<3) ·
//   i16 x*10 · i16 z*10 · i16 facing*100 · i16 hp · i16 maxHp · u8 respawn ·
//   u16 garrisonId+1 · u8 cargo*100 (v99: every client SEES what a cart hauls)
const SNAP_ROW_B=18;
NET.packRows=function(rows){
  const buf=new ArrayBuffer(rows.length*SNAP_ROW_B), dv=new DataView(buf);
  let o=0;
  for(const w of rows){
    dv.setUint16(o,w[0]); dv.setUint8(o+2,w[1]); dv.setUint8(o+3,w[2]);
    dv.setInt16(o+4,w[3]); dv.setInt16(o+6,w[4]); dv.setInt16(o+8,w[5]);
    dv.setInt16(o+10,w[6]); dv.setInt16(o+12,w[7]); dv.setUint8(o+14,w[8]);
    dv.setUint16(o+15,w[9]); dv.setUint8(o+17,w[10]||0); o+=SNAP_ROW_B;
  }
  return buf;
};
NET.readSnapRows=function(s){ // shared by applySnap and the smoketest — one decoder, no drift
  if(!s.ub)return s.units||[];
  let ab=s.ub, off=0, len=0;
  if(ab.buffer){off=ab.byteOffset||0;len=ab.byteLength;ab=ab.buffer;} // some transports hand back a view
  else len=ab.byteLength;
  const dv=new DataView(ab,off,len), n=Math.min(s.un||0,Math.floor(len/SNAP_ROW_B)), out=[];
  for(let i=0;i<n;i++){
    const o=i*SNAP_ROW_B;
    out.push([dv.getUint16(o),dv.getUint8(o+2),dv.getUint8(o+3),dv.getInt16(o+4),dv.getInt16(o+6),
      dv.getInt16(o+8),dv.getInt16(o+10),dv.getInt16(o+12),dv.getUint8(o+14),dv.getUint16(o+15),
      dv.getUint8(o+17)]);
  }
  return out;
};
// v97: building rows go binary too — 8 bytes each (u16 id · u16 hp · u8 flags[1 built|2 alive] ·
// u16 progress · u8 crop*10). During heavy construction the old JSON rows (~28B each, with a FULL
// set every second) were the fattest thing on the wire — the "everyone's building, ping hits 1000"
// spike was the host's uplink drowning in them.
const BLD_ROW_B=8;
NET.packBldRows=function(brows){
  const buf=new ArrayBuffer(brows.length*BLD_ROW_B), dv=new DataView(buf);
  let o=0;
  for(const w of brows){
    dv.setUint16(o,w[0]); dv.setUint16(o+2,Math.max(0,Math.min(65535,w[1])));
    dv.setUint8(o+4,(w[2]?1:0)|(w[4]?2:0));
    dv.setUint16(o+5,Math.max(0,Math.min(65535,Math.round(w[3]||0))));
    dv.setUint8(o+7,Math.max(0,Math.min(250,Math.round((w[5]||0)*10)))); o+=BLD_ROW_B;
  }
  return buf;
};
NET.readBldRows=function(s){ // → [id,hp,built,progress,alive,crop] — the shape applySnap always ate
  if(!s.bb)return s.blds||[];
  let ab=s.bb, off=0, len=0;
  if(ab.buffer){off=ab.byteOffset||0;len=ab.byteLength;ab=ab.buffer;}
  else len=ab.byteLength;
  const dv=new DataView(ab,off,len), n=Math.min(s.bn||0,Math.floor(len/BLD_ROW_B)), out=[];
  for(let i=0;i<n;i++){
    const o=i*BLD_ROW_B, fl=dv.getUint8(o+4);
    out.push([dv.getUint16(o),dv.getUint16(o+2),fl&1,dv.getUint16(o+5),(fl&2)?1:0,dv.getUint8(o+7)/10]);
  }
  return out;
};
NET.packSnap=function(){
  const carry={}, centers=[];
  for(const k in NET.remotes){
    const u=NET.remotes[k].unit;
    if(u){carry[u.id]=[u.carry.food,u.carry.gold,u.carry.stone,u.carry.wood,u.tradeLoaded?1:0];
      if(u.alive)centers.push(u.root.position);} // AOI centers: the guests' own eyes
  }
  NET._snapN++;
  // DELTA ROWS: a unit ships only when its row actually changed since the last SENT copy.
  // Idle crowds cost nothing. Every 15th snap is a full refresh (the fast lane drops packets),
  // and player bodies + kings ride EVERY snap so the authority echo never goes stale.
  // v95 AOI: position-only changes on units far from EVERY guest ship at quarter rate —
  // distant skirmishes glide at 4Hz nobody can tell apart at that range; structural
  // changes (death, class, garrison) always ship immediately, however far.
  const init=!NET._lastRow;
  const full=init||(NET._snapN%15===0);
  const bfull=init||(NET._snapN%45===0); // v97: building drops heal in 3s, not 1 — fulls were pure overhead most seconds
  if(init){NET._lastRow={};NET._lastStruct={};NET._lastBld={};}
  const playerIds={}; playerIds[player.id]=1;
  for(const k in NET.remotes){const rr=NET.remotes[k];if(rr.unit)playerIds[rr.unit.id]=1;}
  const rows=[], NEAR2=NET.AOI_NEAR*NET.AOI_NEAR;
  for(const u of units){
    const p=u.root.position, working=(u.swing>0.05||u.attackAnimT>0);
    const pulse=working?(Math.floor(T*2)&3):0; // v95 WORK PULSE: stationary swings re-announce every 0.5s
    const flags=(u.alive?1:0)|((T-(u._mv||-9)<0.15)?2:0)|(working?4:0)|(pulse<<3);
    const row=[u.id,CLS_IDX[u.cls]||0,flags,
      Math.round(p.x*10),Math.round(p.z*10),
      Math.round(u.facing*100),Math.round(u.hp),Math.round(u.maxHp),
      u.alive?0:Math.ceil(Math.min(99,u.respawnT||0)),u.garrison?u.garrison.id+1:0,
      Math.round(cargoFrac(u)*100)]; // v99: the cargo byte
    const key=row.join(",");
    let ship=full||playerIds[u.id]||u.isKing;
    if(!ship&&NET._lastRow[u.id]!==key){
      ship=true;
      if(centers.length){
        const struct=row[1]+","+(flags&1)+","+row[9]; // class | alive | garrison
        if(NET._lastStruct[u.id]===struct){ // nothing structural — this is motion/anim only
          let near=false;
          for(const c of centers)if(dist2(p.x,p.z,c.x,c.z)<NEAR2){near=true;break;}
          if(!near&&((NET._snapN+u.id)%NET.AOI_FAR_EVERY)!==0)ship=false; // staggered far-rate
        }
      }
    }
    if(ship){rows.push(row);NET._lastRow[u.id]=key;NET._lastStruct[u.id]=row[1]+","+(flags&1)+","+row[9];}
  }
  const ub=NET.packRows(rows);
  const s={t:"snap",q:NET._q++,T:r1(T),ages:[teamAge[BLUE],teamAge[RED]],
    ares:[r1(ageResT[BLUE]),r1(ageResT[RED])],over:gameOver?1:0, // v107: the 90s advance countdown
    stock0:{f:Math.floor(stock[BLUE].food),g:Math.floor(stock[BLUE].gold),
            s:Math.floor(stock[BLUE].stone),w:Math.floor(stock[BLUE].wood)},
    stock1:{f:Math.floor(stock[RED].food),g:Math.floor(stock[RED].gold),
            s:Math.floor(stock[RED].stone),w:Math.floor(stock[RED].wood)},
    ub,un:rows.length,
    carry};
  if(NET._snapN%3===0){ // 5Hz is plenty for scores/levels — tags cache by text anyway
    s.sc=[[NET.myName,Math.round(player.score||0),player.team,player.id,player.lvl||0]];
    for(const k in NET.remotes){const rr=NET.remotes[k];if(rr.unit)s.sc.push([rr.name,Math.round(rr.unit.score||0),rr.unit.team,rr.unit.id,rr.unit.lvl||0]);}
  }
  { // v95: buildings ship as DELTAS — only rows that changed (usually none), full set on refresh.
    // v97: rows are BINARY (8B) and the delta key IS the quantized wire row — sub-quantum
    // wiggles (crop growing 1%, fractional hp decay) no longer re-ship a building.
    const brows=[];
    for(const b of buildings){
      const brow=[b.id,Math.round(b.hp),b.built?1:0,Math.round(b.progress||0),b.alive?1:0,r1(b.crop||0)];
      const bkey=brow.join(",");
      if(bfull||NET._lastBld[b.id]!==bkey){brows.push(brow);NET._lastBld[b.id]=bkey;}
    }
    if(brows.length){s.bb=NET.packBldRows(brows);s.bn=brows.length;}
  }
  if(NET._fx.length)s.fx=NET._fx.splice(0,NET._fx.length); // batched arrow theatre rides the snap
  s.bs=ub.byteLength+(s.bb?s.bb.byteLength:0)+(s.sc?s.sc.length*22:0)+(s.fx?s.fx.length*10:0)+140; // wire-size estimate for the guest's readout
  return s;
};

// =========================================================== GUEST ==========
NET.uiJoin=function(){
  if(typeof Peer==="undefined"){msg("PeerJS failed to load — check your internet connection.","warn");return;}
  if(NET.peer)return;
  const code=(document.getElementById("joincode").value||"").trim().toLowerCase();
  NET._code=code;
  const name=NET.myName||"Warrior"; // v92: the name screen already asked
  if(!/^regicide-[a-z0-9]{4}$/.test(code)){msg("That's not a room code — it looks like regicide-abcd.","warn");return;}
  NET.status("Riding to "+code+"…");
  const peer=new Peer(NET.peerOpts()); NET.peer=peer;
  peer.on("error",e=>{msg("Join error: "+e.type,"warn");NET.status("Broker error: "+e.type);NET.peer=null;});
  peer.on("open",()=>{
    const c=peer.connect(code,{reliable:true}); NET.conn=c;
    c.on("open",()=>c.send({t:"hello",name,proto:NET.PROTO,
      team:(document.getElementById("jointeam")||{value:"auto"}).value,
      pw:String((document.getElementById("joinpw")||{value:""}).value||"").slice(0,16)})); // private halls check the word
    c.on("data",d=>NET.guestData(d));
    c.on("close",()=>{
      NET.status("⚠ CONNECTION LOST — refresh the page to rejoin.");
      msg("Connection to the host was lost. Refresh to rejoin.","warn");
    });
    setTimeout(()=>{if(NET.mode!=="guest"&&!NET._admitted)NET.status("No answer from "+code+" — is the host still up?");},8000);
  });
};
NET.dialFast=function(){ // the unreliable lane: dropped packets never dam the stream
  try{
    const f=NET.peer.connect(NET._code,{reliable:false,metadata:{ch:"fast"}});
    f.on("open",()=>{NET.fast=f;});
    f.on("data",dd=>NET.guestData(dd));
    f.on("close",()=>{NET.fast=null;});
    f.on("error",()=>{NET.fast=null;});
  }catch(_){}
};
NET.guestData=function(d){
  if(!d||!d.t)return;
  if(d.t==="admit"){
    NET._admitted=true;NET.myUid=d.uid;
    NET.dialFast();
    setInterval(()=>{if(NET.mode==="guest"&&(!NET.fast||!NET.fast.open))NET.dialFast();},5000);
    return;
  }
  if(d.t==="world")return NET.applyWorld(d);
  if(d.t==="snap")return NET.applySnap(d);
  if(d.t==="bnew"){
    // call makeBuilding DIRECTLY (the wrapper only broadcasts on the host) and adopt the host's id
    const b=makeBuilding(d.team,d.type,d.x,d.z,!!d.built,d.rot);
    b.id=d.id;
    return;
  }
  if(d.t==="unew"){
    if(!NET.unitById(d.id)){ // carts and any future late spawns
      const u=makeUnit(d.team,d.cls,d.x,d.z,{name:d.name,bot:{role:"net"}});
      u.id=d.id; u.netPX=d.x; u.netPZ=d.z; u.netX=d.x; u.netZ=d.z; u.netF=0; u.netAt=performance.now();
    }
    return;
  }
  if(d.t==="lob"){ // theatre: the same arc the host computed
    const a=NET.unitById(d.uid);
    if(a)launchLob(a,d.tx,d.tz,true);
    return;
  }
  if(d.t==="shot"){ // cosmetic: damage is suppressed on guests, so this is pure theatre
    const att=d.aU>=0?NET.unitById(d.aU):NET.bldById(d.aB);
    const tgt=d.tU>=0?NET.unitById(d.tU):NET.bldById(d.tB);
    if(att&&tgt&&(tgt.def?tgt.alive:tgt.alive))_real_shootArrow(att,tgt);
    return;
  }
  if(d.t==="chest"){ // camp treasure appears (k = "food"|"gold") or vanishes (k = null); s=1 is the shore's second chest
    const st=campStates[d.i];
    if(st){ if(d.k)_chestShow(st,d.k,!!d.s); else _chestHide(st,!!d.s); }
    return;
  }
  if(d.t==="qst"){ // v87: OUR quest/level state, as the host rules it
    if(typeof Sound!=="undefined"&&d.l>(player.lvl||0))Sound.play("alert_quest"); // v100: a level gained = a quest cleared
    player.lvl=d.l; player.xp=d.x;
    player.quest=(d.qi>=0&&QUESTS[d.qi])?{i:d.qi,prog:d.qp}:null;
    updateQuestHud();
    return;
  }
  if(d.t==="smith"){ // v93: the host lays the trio on OUR screen
    player.xp=d.xp;
    if(d.offer&&d.offer.length)openSmithMenu(d.offer);
    return;
  }
  if(d.t==="qdraft"){ // v99: the Town Board's three postings arrive on OUR screen
    NET._qrr=d.rr||0;
    if(d.offer&&d.offer.length)openBoardMenu(d.offer);
    return;
  }
  if(d.t==="bff"){ // v87: OUR blacksmith buffs — prediction needs the real speed
    if(typeof Sound!=="undefined"){const _nb=d.b?Object.keys(d.b).length:0,_ob=player.buffs?Object.keys(player.buffs).length:0;if(_nb>_ob)Sound.play("alert_buff");} // v100: buff gained (silent on death-wipe)
    player.buffs=d.b||{}; player.xp=d.x;
    applyBuffStats(player);
    updateQuestHud(); updatePlayerHud();
    return;
  }
  if(d.t==="pong"){ // v95: our ping, measured on the wire we actually ride
    const rtt=performance.now()-(d.ts||0);
    if(rtt>=0&&rtt<10000)NET.ping=NET.ping?NET.ping*0.6+rtt*0.4:rtt;
    return;
  }
  if(d.t==="note")return msg(d.m,d.tone||"");
  if(d.t==="ndep"){const n=nodes[d.i];if(n){n.amount=0;_real_depleteNode(n);if(typeof Sound!=="undefined")Sound.play(n.type==="wood"?"treefall":n.type==="food"?"harvest":"stonecrumble",{x:n.x,z:n.z});}return;} // v104 guest node-exhaust
  if(d.t==="snd"){ // v103: host-driven global/team sound events (raid, base alarm, allied resurrection)
    if(typeof Sound!=="undefined"&&(d.team===undefined||d.team===MYTEAM)){
      if(d.k==="__chorus"){if(Sound.voxChorus)Sound.voxChorus(d.x,d.z);} // v109: a relayed war-cry chorus
      else Sound.play(d.k,(d.x!==undefined)?{x:d.x,z:d.z}:undefined);
    }
    return;
  }
  if(d.t==="end")return endGame(d.w,d.k);
  if(d.t==="deny")return msg(d.m,"warn");
};
NET.applyWorld=function(w){
  NET.mode="guest";           // freezes the local sim from the very next frame
  NET.myUid=w.uid;
  NET.estT=w.T;               // v95: the guest's clock starts on the host's time
  T=w.T; teamAge[BLUE]=w.ages[0]; teamAge[RED]=w.ages[1];
  if(w.ares){ageResT[BLUE]=w.ares[0];ageResT[RED]=w.ares[1];} // v107: pick up a countdown already running
  stock[BLUE].food=w.stock0.f;stock[BLUE].gold=w.stock0.g;stock[BLUE].stone=w.stock0.s;stock[BLUE].wood=w.stock0.w;
  if(w.stock1){stock[RED].food=w.stock1.f;stock[RED].gold=w.stock1.g;stock[RED].stone=w.stock1.s;stock[RED].wood=w.stock1.w;}
  // ---- units: overwrite our locally-spawned 100 with the host's truth ----
  const wasPlayer=player;
  for(const rec of w.units){
    const [id,cls,alive,x,z,f,hp,maxHp,name,team]=rec;
    let u=NET.unitById(id);
    if(!u){u=makeUnit(team,cls,x,z,{name,bot:{role:"net"}});u.id=id;}
    u.name=name;
    if(u.cls!==cls)setClass(u,cls);
    u.root.position.set(x,terrainHeight(x,z),z);
    u.netPX=x;u.netPZ=z;u.netX=x;u.netZ=z;u.netF=f;u.netAt=performance.now();
    u.authX=x;u.authZ=z;u.facing=f;
    u.hp=hp;u.maxHp=maxHp;setBar(u.bar,u.hp/u.maxHp);
    u.alive=!!alive; u.dieT=0;
    u.root.visible=u.alive; u.body.rotation.x=0;
  }
  // ---- possession: our old "player" becomes just another blue bot ----
  if(wasPlayer){
    wasPlayer.isPlayer=false;
    wasPlayer.ring.material.color.setHex(TEAMCOL[wasPlayer.team]);
    wasPlayer.bar.bg.visible=wasPlayer.bar.fg.visible=true;
  }
  const pu=NET.unitById(NET.myUid);
  pu.isPlayer=true; player=pu;
  MYTEAM=pu.team; // the world is seen through MY team's eyes now
  if(MYTEAM===RED){ // flip the king bars: MY king first
    const l0=document.querySelector("#kb0 .lbl"), l1=document.querySelector("#kb1 .lbl");
    if(l0)l0.textContent="♚ KING OSRIC (SLAY HIM)";
    if(l1)l1.textContent="♔ KING VARGUS (YOUR KING)";
  }
  pu.ring.material.color.setHex(0xffffff);
  pu.bar.bg.visible=pu.bar.fg.visible=false;
  // ---- buildings: raze the local guesswork, rebuild from the host list ----
  for(const b of buildings)scene.remove(b.root);
  buildings.length=0;
  for(const rec of w.blds){
    const [id,team,type,x,z,rot,built,progress,hp,alive,crop]=rec;
    const b=makeBuilding(team,type,x,z,!!built,rot);
    b.id=id; b.hp=hp; b.progress=progress;
    if(!built){b.body.scale.y=0.15+0.85*(progress/b.def.hits);}
    if(typeof crop==="number"&&b.cropMesh){
      b.crop=crop; b.cropMesh.scale.y=0.15+0.85*crop;
      if(crop>=1&&b.tassels)for(const t of b.tassels)t.visible=true;
    }
    if(!alive){b.alive=false;scene.remove(b.root);}
  }
  // ---- nodes ----
  for(let i=0;i<w.nodes.length&&i<nodes.length;i++){
    nodes[i].amount=w.nodes[i];
    if(w.nodes[i]<=0)_real_depleteNode(nodes[i]);
  }
  if(w.camps)for(let i=0;i<w.camps.length&&i<campStates.length;i++){ // standing chests greet the joiner
    const [kA,kB]=w.camps[i]||[null,null];
    if(kA)_chestShow(campStates[i],kA,false); else _chestHide(campStates[i],false);
    if(kB)_chestShow(campStates[i],kB,true);  else _chestHide(campStates[i],true);
  }
  inMenu=false; // the guest steps out of the menu into the host's world
  document.getElementById("startmenu").style.display="none";
  closeMenus();cancelPlacing();
  updateResHud();updateAgeHud();updateKingBars();updatePlayerHud();
  NET.connectedTxt="⚑ CONNECTED — you fight as <b>"+player.name+"</b><br><span class='netsub'>the host runs the war · your body answers instantly</span>";
  NET.lastSnapAt=performance.now();
  NET.status(NET.connectedTxt);
  msg("You've joined the "+TEAMNAME[MYTEAM]+" army as "+player.name+". Slay King "+(MYTEAM===BLUE?"Vargus":"Osric")+"!","gold");
};
NET.applySnap=function(s){
  if(NET.mode!=="guest")return; // world first, then snapshots
  if(typeof s.q==="number"){ // unordered lane: never apply the past
    if(s.q<=NET.lastQ){NET._cDup=(NET._cDup||0)+1;return;} // net log: late/duplicate arrivals
    if(NET.lastQ>=0)NET._cGap=(NET._cGap||0)+Math.min(99,s.q-NET.lastQ-1); // …and sequence holes (loss OR host-side skips — read with the host's sent/s)
    NET.lastQ=s.q;
  }
  const nowP=performance.now();
  if(NET.lastArr)NET.gapAvg=Math.min(1200,Math.max(60,NET.gapAvg*0.8+(nowP-NET.lastArr)*0.2));
  NET.lastArr=nowP;
  // v95 STALE-AUTHORITY GUARD: estT is OUR clock — the newest sim time we've seen,
  // advanced locally between snaps. A snapshot whose T lags it was born seconds ago
  // (a draining backlog). Its WORLD state still applies — stale truth beats no truth —
  // but it may NOT leash-yank our own body: that yank-to-the-past was the
  // "can look around but can't walk" freeze. If the lag exceeds 5s (host tabbed out,
  // resumed), we adopt the new timeline instead of distrusting it forever.
  if(typeof NET.estT!=="number")NET.estT=s.T;
  const lagT=NET.estT-s.T;
  const freshAuth=lagT<NET.AUTH_FRESH_S;
  if(!freshAuth)NET._cStale=(NET._cStale||0)+1; // net log: backlog snapshots this second
  if(s.T>NET.estT||lagT>5)NET.estT=s.T;
  NET._dSnaps=(NET._dSnaps||0)+1; NET._dBytes=(NET._dBytes||0)+(s.bs||0); // the readout's raw feed
  T=s.T;
  if(teamAge[BLUE]!==s.ages[0]||teamAge[RED]!==s.ages[1]){
    const mineUp=s.ages[MYTEAM]>teamAge[MYTEAM];
    const reB=teamAge[BLUE]!==s.ages[0], reR=teamAge[RED]!==s.ages[1];
    teamAge[BLUE]=s.ages[0];teamAge[RED]=s.ages[1];
    if(reB){restyleBuildings(BLUE,true);restyleUnits(BLUE,true);}
    if(reR){restyleBuildings(RED,true);restyleUnits(RED,true);}
    updateAgeHud();
    if(mineUp)msg("⬆ YOUR TEAM ADVANCES TO THE "+AGES[teamAge[MYTEAM]].name.toUpperCase()+"!","blue");
    if(typeof Sound!=="undefined"&&mineUp)Sound.play("ageup"); // v100: guest age-up fanfare
  }
  if(s.ares){ // v107: the host's advance countdown — authoritative overwrite of the guest's local tick
    const wasSec=Math.ceil(ageResT[MYTEAM]||0);
    ageResT[BLUE]=s.ares[0];ageResT[RED]=s.ares[1];
    if(Math.ceil(ageResT[MYTEAM])!==wasSec)updateAgeHud();
  }
  stock[BLUE].food=s.stock0.f;stock[BLUE].gold=s.stock0.g;stock[BLUE].stone=s.stock0.s;stock[BLUE].wood=s.stock0.w;
  if(s.stock1){stock[RED].food=s.stock1.f;stock[RED].gold=s.stock1.g;stock[RED].stone=s.stock1.s;stock[RED].wood=s.stock1.w;}
  for(const rec of NET.readSnapRows(s)){ // v95: rows arrive as packed binary
    const [id,ci,fl,x10,z10,f100,hp,maxHp,rT,gar1,cg]=rec;
    const cls=CLS_KEYS[ci]||"villager", alive=fl&1, mv=fl&2, sw=fl&4, pulse=(fl>>3)&3, gar=gar1-1;
    const x=x10/10, z=z10/10, f=f100/100;
    const u=NET.unitById(id); if(!u)continue;
    if(u.cls!==cls){setClass(u,cls);if(u===player)msg("You are now a "+CLS[cls].name+"!","blue");}
    if(u!==player)u._cargo=(cg||0)/100; // v99: their cargo through the wire; OUR OWN load computes locally
    if(u===player){ // OUR body: we predict, the host corrects — but only with FRESH truth
      if(freshAuth){u.authX=x;u.authZ=z;u.authAt=nowP;}
    }else{ // everyone else glides from WHERE THEY'RE DRAWN to the new truth —
           // a burst of late snapshots can never teleport them
      if(typeof u.netX!=="number"||dist2(u.root.position.x,u.root.position.z,x,z)>24*24){
        u.netPX=x;u.netPZ=z; // genuine teleport/respawn: snap
      }else{u.netPX=u.root.position.x;u.netPZ=u.root.position.z;}
      u.netX=x;u.netZ=z;u.netF=f;u.netAt=nowP;
    }
    // v109 THE VOICES: the guest FEELS the hit — host-side impacts/pain never reach us, so a
    // real hp drop on OUR OWN body cries out here (~1 in 3, graded by how hard it landed)
    if(u===player&&alive&&hp>0&&hp<u.hp-1&&typeof Sound!=="undefined"&&Sound.vox&&Math.random()<0.34){
      const _pd=u.hp-hp;
      Sound.vox(_pd<12?"painm":_pd<25?"pain":"painh",u,{});
    }
    u.hp=hp;u.maxHp=maxHp;
    if(u!==player)setBar(u.bar,u.hp/Math.max(1,u.maxHp));
    u.gmv=!!mv; // held between snapshots — animateUnit consumes u.moving every frame
    if(u!==player&&sw){ // own swings are predicted locally — echoes would loop the arm
      // v95 WORK PULSE: a stationary miner/fighter's row used to stop shipping (no delta),
      // so their arm froze mid-swing on guests. The pulse ticks every 0.5s of work —
      // each tick re-triggers the animation and the statue swings again.
      if(u.swing<=0.05||u._pulse!==pulse){u.swing=0.25;triggerAttackAnim(u);}
      u._pulse=pulse;
    }
    if(u.alive&&!alive){ // fell this instant: topple locally
      u.alive=false;u.dieT=0.9;u.corpse=true;
      if(typeof Sound!=="undefined"&&!u.isKing){ // v102: guest death mix parity
        const _dc=CLS[u.cls]||{},_darm=(_dc.line==="cavalry")||((_dc.line==="melee"||_dc.line==="anticav")&&(_dc.tier||0)>=3);
        const _dp={x:u.root.position.x,z:u.root.position.z};
        Sound.play(_darm?(Math.random()<0.3?"gore":"deathheavy"):(Math.random()<0.33?"gore":"death"),_dp);
        // v109 THE VOICES: guest death-cry parity (local roll — flavor needn't match the host's)
        // v110: guests can't see camp kind (no bot on replicas) — NEUTRAL deaths stay voiceless
        // here so wolves never scream like men (barbarian death cries are host-audible only)
        if(Sound.vox&&(u===player||Math.random()<0.7)&&u.team!==NEUTRAL)
          Sound.vox(Math.random()<0.2?"deathi":"death",u,_dp);
      }

      u.bar.bg.visible=u.bar.fg.visible=false;
      u.gathering=null;
      if(u===player){
        document.getElementById("deathoverlay").style.display="flex";
        closeMenus();cancelPlacing();
        if(document.exitPointerLock)document.exitPointerLock();
      }
    }else if(!u.alive&&alive){ // reborn at a spawn point (or raised by a priest)
      u.alive=true;u.dieT=0;u.corpse=false;u.root.visible=true;u.body.rotation.x=0;
      u.root.position.set(x,terrainHeight(x,z),z);
      if(u!==player){u.bar.bg.visible=u.bar.fg.visible=true;setBar(u.bar,1);}
      else{
        document.getElementById("deathoverlay").style.display="none";
        msg("You respawn as a Villager. Re-arm at the Barracks.","blue");
      }
    }
    if(!u.alive)u.respawnT=rT;
    const gWas=u.garrison;
    u.garrison=(gar>=0)?NET.bldById(gar):null; // rendered on the deck in guestFrame (wire is id+1; 0 = none)
    if(gWas!==u.garrison){u.deckX=u.deckZ=0;}
  }
  if(s.fx)for(const f of s.fx){ // v95: batched arrow theatre — damage is host-only, this is the show
    const att=f[0]>=0?NET.unitById(f[0]):NET.bldById(f[1]);
    const tgt=f[2]>=0?NET.unitById(f[2]):NET.bldById(f[3]);
    if(att&&tgt&&(tgt.def?tgt.alive:tgt.alive))_real_shootArrow(att,tgt);
  }
  for(const rec of NET.readBldRows(s)){ // v97: building deltas arrive as packed binary
    const [id,hp,built,progress,alive,crop]=rec;
    const b=NET.bldById(id); if(!b)continue;
    b.hp=hp;
    if(alive&&!b.alive){b.alive=true;scene.add(b.root);} // shouldn't happen, but heal the drift
    if(!alive&&b.alive){b.alive=false;scene.remove(b.root);if(typeof Sound!=="undefined")Sound.play("raze",{x:b.x,z:b.z});} // v102: guest raze parity
    if(built&&!b.built){
      b.built=true;b.progress=progress;b.body.scale.y=1;
      if(typeof Sound!=="undefined")Sound.play("complete",{x:b.x,z:b.z}); // v100: guest completion chime
      b.body.traverse(o=>{if(o.material){o.material.opacity=1;o.material.transparent=false;}});
      if(typeof roadEligible==="function"&&roadEligible(b))markRoadsDirty(b.team); // streets follow the growing town on guests too (coalesced)
    }else if(!built){
      b.progress=progress;b.body.scale.y=0.15+0.85*(progress/b.def.hits);
    }
    if(typeof crop==="number"&&b.cropMesh){
      b.crop=crop;b.cropMesh.scale.y=0.15+0.85*Math.min(1,crop);
      if(b.tassels)for(const t of b.tassels)t.visible=crop>=1;
    }
  }
  if(s.sc){NET.scores=s.sc;syncNameTags(s.sc);}
  if(s.carry&&s.carry[NET.myUid]){
    const c=s.carry[NET.myUid];
    player.carry.food=c[0];player.carry.gold=c[1];player.carry.stone=c[2];player.carry.wood=c[3];
    player.tradeLoaded=c[4]?(player.tradeLoaded||{x:0,z:0}):null;
  }
  if(s.over&&!gameOver){/* end event carries the details; this is the belt to its suspenders */}
  NET.lastSnapAt=performance.now();
  updateResHud();updatePlayerHud();updateKingBars();
};
// -------- guest: the thin frame (predict self, interpolate others) --------
NET.guestFrame=function(dt){
  NET._cFrames=(NET._cFrames||0)+1; // fps for the net log
  // v95: our clock marches between snapshots (frozen while the feed is stale, so a
  // paused host doesn't poison the lag estimate) — applySnap compares arrivals to it
  if(typeof NET.estT==="number"&&!NET._stale)NET.estT+=dt;
  for(const u of units){
    if(!u.alive){
      if(u.dieT>0){ // same topple as the host sim
        u.dieT-=dt;
        const fF=1-Math.max(0,u.dieT)/0.9;
        const gy=terrainHeight(u.root.position.x,u.root.position.z);
        u.body.rotation.x=-fF*Math.PI/2;
        u.root.position.y=gy-fF*0.3;
        if(u.dieT<=0){
          if(u.corpse){u.body.rotation.x=-Math.PI/2;u.root.position.y=gy;} // lie in state on the guest too
          else{u.root.visible=false;u.body.rotation.x=0;u.root.position.y=gy;}
        }
      }
      if(u===player){
        u.respawnT=Math.max(0,(u.respawnT||0)-dt);
        document.getElementById("deathtimer").textContent=Math.ceil(u.respawnT);
      }
      continue;
    }
    if(u!==player&&typeof u.netX==="number"){
      // glide from the drawn position to the newest truth over one smoothed
      // arrival interval — packet bursts stretch the glide instead of snapping it
      const a=Math.min(1,(performance.now()-(u.netAt||0))/NET.gapAvg);
      u.root.position.x=u.netPX+(u.netX-u.netPX)*a;
      u.root.position.z=u.netPZ+(u.netZ-u.netPZ)*a;
      u.facing=u.netF;
    }
    if(u.garrison&&u.garrison.alive){ // sentries walk the deck: snapshot x/z, deck height
      const gd=u.garrison.deck||{y:7.15,r:2.4};
      if(u!==player){ // clamp drift to the platform; height comes from the deck
        const ddx=u.root.position.x-u.garrison.x, ddz=u.root.position.z-u.garrison.z;
        const dl=Math.hypot(ddx,ddz);
        if(dl>gd.r){u.root.position.x=u.garrison.x+ddx/dl*gd.r;u.root.position.z=u.garrison.z+ddz/dl*gd.r;}
        u.root.position.y=u.garrison.root.position.y+gd.y;
      }
    }else if(u.garrison){u.garrison=null;u.deckX=u.deckZ=0;}
    if(u!==player)u.moving=!!u.gmv; // refresh the consumable flag every frame
    if(u.moving&&u!==player)u.walkT+=dt*(3.5+(u.spd||3)*0.75);
    updateUnitCommon(u,dt); // terrain hug + smooth facing + animateUnit
  }
  // ---- PREDICTION-LITE: our own body moves the instant we press a key ----
  // The host stays authoritative; we walk freely inside a small dead zone and
  // get pulled back smoothly only when the host disagrees (collisions, blocks).
  if(player.alive&&player.garrison&&player.garrison.alive){
    const gb=player.garrison, deck=gb.deck||{y:7.15,r:2.4};
    let mx=0,mz=0;
    if(keys.w)mz-=1; if(keys.s)mz+=1; if(keys.a)mx-=1; if(keys.d)mx+=1;
    if(mx||mz){
      const dir=new THREE.Vector3(mx,0,mz).applyAxisAngle(new THREE.Vector3(0,1,0),camYaw);
      const L=Math.hypot(dir.x,dir.z)||1;
      player.deckX=(player.deckX||0)+dir.x/L*player.spd*dt*0.7;
      player.deckZ=(player.deckZ||0)+dir.z/L*player.spd*dt*0.7;
      const dd=Math.hypot(player.deckX,player.deckZ);
      if(dd>deck.r){player.deckX*=deck.r/dd;player.deckZ*=deck.r/dd;}
      player.facing=Math.atan2(dir.x,dir.z); player.moving=true; player.walkT+=dt*5;
    }else player.moving=false;
    player.root.position.set(gb.x+(player.deckX||0),gb.root.position.y+deck.y,gb.z+(player.deckZ||0));
  }
  if(player.alive&&!player.garrison){
    let mx=0,mz=0;
    if(keys.w)mz-=1; if(keys.s)mz+=1; if(keys.a)mx-=1; if(keys.d)mx+=1;
    if(mx||mz){
      const dir=new THREE.Vector3(mx,0,mz).applyAxisAngle(new THREE.Vector3(0,1,0),camYaw);
      moveUnit(player,dir.x,dir.z,dt*(player.blocking?0.55:1));
    }else player.moving=false;
    if(typeof player.authX==="number"&&performance.now()-(player.authAt||0)<600){
      // never let STALE authority yank us — if snapshots pause, prediction free-runs
      const p=player.root.position;
      const ex=player.authX-p.x, ez=player.authZ-p.z, e=Math.hypot(ex,ez);
      const dead=3.2+(NET.gapAvg-83)*0.02; // lag widens the leash instead of the rubber band
      if(e>25){p.x=player.authX;p.z=player.authZ;NET._cLeash=(NET._cLeash||0)+1;} // hard desync: snap home (logged)
      else if(e>dead){const f=(e-dead)/e*Math.min(1,dt*4.5);p.x+=ex*f;p.z+=ez*f;}
    }
    // PRIEST: channel/cast runs client-side; the resurrection itself goes through the host
    if(player.cls==="priest")updatePriestChannel(dt,lmbHeld&&mouseLocked&&!placing&&!menuOpen);
    // local attack theatre: swing NOW, the host lands the real blow
    else if(((lmbHeld&&mouseLocked)||keys[" "])&&!placing&&!player.blocking&&player.atkT<=0&&player.dmg>0){
      if(siegeAim)playerPrimary(); // v97: the skill shot — queues the lob; it rides the next input packet
      else{
        player.atkT=player.cd; player.swing=0.25; triggerAttackAnim(player);
        if(!player.moving)player.facing=Math.atan2(-Math.sin(camYaw),-Math.cos(camYaw));
      }
    }
    // v95 GATHER THEATRE: the host does the REAL mining off our held E — but our own
    // body used to stand rigid while it happened (own swings are never echoed back).
    // Swing the pick and puff the node locally; resources stay 100% host-authoritative.
    if((player.cls==="villager"||player.cls==="oxcart")&&keys.e&&!menuOpen&&!placing&&!player.moving){
      const px=player.root.position.x,pz=player.root.position.z;
      let tx,tz,ty=1.6,col=0xd8c9a3,site=null,sd=1e12,found=false;
      if(player.cls==="villager")for(const b of buildings){ // the ox builds nothing
        if(b.team!==player.team||!b.alive||b.built)continue;
        const reach=b.def.r+2.6, d=dist2(px,pz,b.x,b.z);
        if(d<reach*reach&&d<sd){sd=d;site=b;}
      }
      if(site){tx=site.x;tz=site.z;found=true;}
      else{
        let n=null,nd=3.4*3.4;
        for(const nn of nodes){
          if(nn.amount<=0)continue;
          if(player.cls==="oxcart"&&nn.type!=="wood")continue; // timber only, even in the theatre
          const d=dist2(px,pz,nn.x,nn.z);
          if(d<nd){nd=d;n=nn;}
        }
        if(n){tx=n.x;tz=n.z;ty=1.5+(n.y||0);found=true;
          col=n.type==="food"?0xd23c2f:n.type==="gold"?0xe0a92e:n.type==="stone"?0x9aa2ad:0x8a6a3f;}
      }
      if(found){
        player.swing=Math.max(player.swing||0,0.12);
        player.facing=Math.atan2(tx-px,tz-pz);
        player._gfxT=(player._gfxT||0)+dt;
        if(player._gfxT>0.55){player._gfxT=0;puff(tx,ty,tz,col);triggerAttackAnim(player);
          player._gsw=((player._gsw||0)+1)&1; // v113: gather foley on every OTHER swing (build keeps every hit)
          if(typeof Sound!=="undefined"){var _gk=site?"build":(col===0x8a6a3f?"chop":col===0xd23c2f?"farm":"mine");
            if(_gk==="build"||!player._gsw)Sound.play(_gk,{x:tx,z:tz});
            if(_gk==="build"&&Math.random()<0.12)Sound.play("veffort",{x:tx,z:tz});}} // v100: guest gather/build parity (v111: grunts on BUILD only — gather grunts read as harm)
      }
    }
  }
  drainVisualQueue(); // restyle wave + coalesced roads on the guest too
  updateEffects(dt);
  updateProjectiles(dt); // pure theatre — damage is host-only
  if(typeof tickAgeResearch==="function")tickAgeResearch(dt,false); // v107: smooth countdown between snaps (display only)
  if(typeof Sound!=="undefined")Sound.tick(dt); // v100: ambience bed + nearby-march on the guest too
  // stale-feed watchdog + the v95 FIELD READOUT (lane · ping · snaps/s · KB/s):
  // one honest line, refreshed each second — next playtest, the numbers do the triage.
  const fastUp=!!(NET.fast&&NET.fast.open);
  NET._pingT=(NET._pingT||0)+dt;
  if(NET._pingT>=1){
    NET._pingT=0;
    const lane=fastUp?NET.fast:(NET.conn&&NET.conn.open?NET.conn:null);
    if(lane)try{lane.send({t:"ping",ts:performance.now(),rtt:Math.round(NET.ping||0)});}catch(_){}
    if(NET.connectedTxt&&!NET._stale){
      NET.status(NET.connectedTxt+"<br><span class='netsub'>"+
        (fastUp?"⚡ fast lane":"🐢 relay lane — retrying the fast lane…")+
        " · ping "+(NET.ping?Math.round(NET.ping)+"ms":"—")+
        " · "+(NET._dSnaps||0)+" snaps/s · "+(((NET._dBytes||0)/1024).toFixed(1))+" KB/s</span>");
    }
    // v98: one net-log row per second — sampled before the windows reset
    NET.logRow({t:Date.now(),T:r1(typeof T==="number"?T:0),role:"g",fps:NET._cFrames||0,
      ping:Math.round(NET.ping||0),snaps:NET._dSnaps||0,
      kb:Math.round((NET._dBytes||0)/102.4)/10,gapAvg:Math.round(NET.gapAvg),
      fast:fastUp?1:0,qgap:NET._cGap||0,dup:NET._cDup||0,stale:NET._cStale||0,leash:NET._cLeash||0});
    NET._cFrames=0;NET._cGap=0;NET._cDup=0;NET._cStale=0;NET._cLeash=0;
    if(NET._logLane!==fastUp){ // lane transitions land in the event stream
      if(NET._logLane!==undefined)NET.logEvent(fastUp?"fast-up":"fast-down");
      NET._logLane=fastUp;
    }
    NET._dSnaps=0;NET._dBytes=0;
  }
  if(NET.lastSnapAt&&performance.now()-NET.lastSnapAt>1200&&NET.fast&&NET.fast.open){
    try{NET.fast.close();}catch(_){}
    NET.fast=null; NET.dialFast(); // the lane CLAIMED open while packets died — start over
    NET.logEvent("redial");
  }
  if(NET.lastSnapAt&&performance.now()-NET.lastSnapAt>1500){
    if(!NET._stale){NET._stale=true;NET.logEvent("stall-start");NET.status("⏳ Waiting for the host… (their window may be minimized)");}
  }else if(NET._stale){NET._stale=false;NET._laneShown=undefined;NET.logEvent("stall-end");if(NET.connectedTxt)NET.status(NET.connectedTxt);}
  // local cosmetics: blocking pose + ghost placement preview
  // v97: guests get THE SKILL SHOT too — the old guest frame never computed siegeAim,
  // so a guest catapult's RMB fell through to the archer aim-zoom (nose in the wheels).
  player.blocking=rmbHeld&&canBlock(player)&&!placing&&player.cls!=="dragoon";
  const lobber=player.cls==="catapult"||player.cls==="trebuchet";
  siegeAim=rmbHeld&&lobber&&player.alive&&!placing;
  aiming=rmbHeld&&!!player.ranged&&!lobber;
  document.getElementById("crosshair").classList.toggle("aim",aiming||siegeAim);
  tickDraw(dt); // v124 THE DRAW — the guest looses locally for feel and reports it below
  if(ghost)updateGhostFollow(); // shared: classic follow, wall lines, gate snapping
  // ship our inputs to the host @20 Hz
  NET.inputT+=dt;
  if(NET.inputT>=1/NET.INPUT_HZ){
    const lane=(NET.fast&&NET.fast.open)?NET.fast:(NET.conn&&NET.conn.open?NET.conn:null);
    if(lane){
      NET.inputT=0;
      NET._inSeq=(NET._inSeq||0)+1;
      lane.send({t:"input",seq:NET._inSeq,
        w:keys.w?1:0,a:keys.a?1:0,s:keys.s?1:0,d:keys.d?1:0,
        e:keys.e?1:0,atk:((lmbHeld&&mouseLocked)||keys[" "])?1:0,
        blk:rmbHeld?1:0,yaw:r1(camYaw),
        px:r1(player.root.position.x),pz:r1(player.root.position.z),
        f:r1(player.facing), // v96: the host mirrors our TRUE facing, not just our feet
        // v124 ANALOG: mx/mz are OPTIONAL and additive. An old host ignores them and walks us with
        // the w/a/s/d bits above, while px/pz carries our true position either way — so this
        // degrades to the v123 behaviour instead of breaking it. No PROTO bump.
        ...(moveVec.analog?{mx:r2(moveVec.x),mz:r2(moveVec.z)}:{}),
        ...(NET._pendingLob?{lobx:r1(NET._pendingLob.x),lobz:r1(NET._pendingLob.z)}:{}),
        ...(NET._pendingShot?{shot:NET._pendingShot}:{})}); // v124 THE DRAW: a loosed arrow
      NET._pendingLob=null;
      NET._pendingShot=null;
    }
  }
  rosterAccum+=dt; if(rosterAccum>0.5){rosterAccum=0;updateRoster();}
  drawMinimap();
};
NET.guestAct=function(a){
  if(NET.conn&&NET.conn.open)NET.conn.send({t:"act",...a});
};

// ========================================================= START MENU =======
NET.uiSolo=function(){
  inMenu=false; // the horns sound — the solo war begins NOW
  document.getElementById("startmenu").style.display="none";
  msg("The kings are crowned. The war begins.","gold");
};
NET.uiShowJoin=function(){
  const hr=document.getElementById("hostrow"); if(hr)hr.style.display="none";
  const jr=document.getElementById("joinrow");
  jr.style.display="flex";
  NET.uiBrowse(); // v92: opening JOIN scans the hall right away — the code box stays for private halls
  if(NET._reveal)NET._reveal(jr); // v124.1
  // v124.1: focusing the code box summons the keyboard over the whole menu on a phone before the
  // player has even decided to type. Let them tap the field themselves.
  if(!document.documentElement.classList.contains("touch-mode"))
    document.getElementById("joincode").focus();
};
NET.uiName=function(){ // v92: the name screen — first thing a warrior does
  const v=String((document.getElementById("playername")||{value:""}).value||"").trim().slice(0,28);
  NET.myName=v||NET.rollName();
  try{localStorage.setItem("regicideName",NET.myName);}catch(_){}
  const ns=document.getElementById("namescreen"); if(ns)ns.style.display="none";
  const sm=document.getElementById("startmenu"); if(sm)sm.style.display="flex";
  NET.showWhoAmI();
};
// v124: the name gate is gone. Typing on a phone before you have seen the game is a real drop-off
// point, and the name only matters once other people can read it. You are auto-titled in John's
// format — "Alexander the Great" — and can rename yourself from the menu or the action grid.
NET.rollName=function(){
  const i=Math.floor(Math.random()*NAMES.length*EPITHETS.length);
  return NAMES[i%NAMES.length]+" "+EPITHETS[Math.floor(i/NAMES.length)%EPITHETS.length];
};
NET.showWhoAmI=function(){
  const el=document.getElementById("myname");
  if(el)el.textContent=NET.myName||"—";
};
NET.uiRename=function(){
  const v=prompt("Your name, warrior:",NET.myName||"");
  if(v===null)return;
  NET.myName=String(v).trim().slice(0,28)||NET.rollName();
  try{localStorage.setItem("regicideName",NET.myName);}catch(_){}
  NET.showWhoAmI();
  if(typeof player!=="undefined"&&player&&!player.isKing)player.name=NET.myName;
};
NET.uiHowTo=function(show){
  document.getElementById("howto").style.display=show?"flex":"none";
};
(function wireMenu(){
  const el=id=>document.getElementById(id);
  if(el("btnsolo"))el("btnsolo").onclick=NET.uiSolo;
  // v124: multiplayer moves behind one disclosure, so PLAY owns the screen
  // v124.1: a disclosure that pushes itself off the bottom of a phone screen is no disclosure at
  // all. The menu scrolls now, but the row also brings itself into view so nobody has to find out
  // that it scrolls.
  NET._reveal=function(elm){
    if(!elm)return;
    setTimeout(()=>{try{elm.scrollIntoView({block:"nearest",behavior:"smooth"});}catch(_){}},60);
  };
  if(el("btnfriends"))el("btnfriends").onclick=()=>{
    const r=el("friendsrow");
    if(r){r.style.display=r.style.display==="none"?"block":"none";
      if(r.style.display!=="none")NET._reveal(r);}
  };
  if(el("btnrename"))el("btnrename").onclick=NET.uiRename;
  // v124.1: the dice. Typing a name on a phone means summoning a keyboard over the menu — rolling
  // one is a single tap, and the pools are good enough that most people will just keep tapping.
  if(el("btnreroll"))el("btnreroll").onclick=()=>{
    NET.myName=NET.rollName();
    try{localStorage.setItem("regicideName",NET.myName);}catch(_){}
    NET.showWhoAmI();
    if(typeof player!=="undefined"&&player&&!player.isKing)player.name=NET.myName;
    if(typeof Sound!=="undefined")Sound.play("ui_select");
  };
  if(el("btnhost"))el("btnhost").onclick=NET.uiShowHost; // v92: HOST reveals the options row
  if(el("btnhostgo"))el("btnhostgo").onclick=NET.uiHost;
  if(el("btnjoin"))el("btnjoin").onclick=NET.uiShowJoin;
  if(el("btnbrowse"))el("btnbrowse").onclick=NET.uiBrowse;
  if(el("btnhow"))el("btnhow").onclick=()=>NET.uiHowTo(true);
  if(el("btnhowback"))el("btnhowback").onclick=()=>NET.uiHowTo(false);
  if(el("btnjoingo"))el("btnjoingo").onclick=NET.uiJoin;
  if(el("joincode"))el("joincode").addEventListener("keydown",e=>{if(e.key==="Enter")NET.uiJoin();e.stopPropagation();});
  if(el("joinpw"))el("joinpw").addEventListener("keydown",e=>{if(e.key==="Enter")NET.uiJoin();e.stopPropagation();});
  if(el("hostpw"))el("hostpw").addEventListener("keydown",e=>{if(e.key==="Enter")NET.uiHost();e.stopPropagation();});
  // v92: the name screen
  if(el("btnname"))el("btnname").onclick=NET.uiName;
  if(el("playername")){
    el("playername").addEventListener("keydown",e=>{if(e.key==="Enter")NET.uiName();e.stopPropagation();});
    try{const n=localStorage.getItem("regicideName");if(n)el("playername").value=n;}catch(_){}
  }
  // v124: skip the name screen entirely — auto-title and go straight to PLAY.
  (function autoName(){
    let n=null; try{n=localStorage.getItem("regicideName");}catch(_){}
    NET.myName=n||NET.rollName();
    try{localStorage.setItem("regicideName",NET.myName);}catch(_){}
    const ns=el("namescreen"); if(ns)ns.style.display="none";
    const sm=el("startmenu"); if(sm)sm.style.display="flex";
    NET.showWhoAmI();
  })();
  // v92: host option toggles
  const pickPair=(idA,idB,set)=>{
    if(!el(idA)||!el(idB))return;
    el(idA).onclick=()=>{el(idA).classList.add("on");el(idB).classList.remove("on");set(true);};
    el(idB).onclick=()=>{el(idB).classList.add("on");el(idA).classList.remove("on");set(false);};
  };
  pickPair("hmPvp","hmCoop",v=>{NET.gameMode=v?"pvp":"coop";
    const dl=el("hdiffline"); if(dl)dl.style.display=v?"none":"flex";}); // the AI dial matters when the AI is the enemy
  pickPair("sdEasy","sdHard",v=>{aiDifficulty=v?"easy":"hard";
    // the two dials mirror each other — one setting, two doors
    if(el("hdEasy")&&el("hdHard")){el("hdEasy").classList.toggle("on",v);el("hdHard").classList.toggle("on",!v);}});
  pickPair("hdEasy","hdHard",v=>{aiDifficulty=v?"easy":"hard";
    if(el("sdEasy")&&el("sdHard")){el("sdEasy").classList.toggle("on",v);el("sdHard").classList.toggle("on",!v);}});
  pickPair("hvPub","hvPriv",v=>{NET.isPublic=v;
    const pw=el("hostpw"); if(pw)pw.style.display=v?"none":"block";
    if(!v&&pw)pw.focus();});
})();
