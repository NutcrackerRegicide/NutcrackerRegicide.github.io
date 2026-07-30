#!/usr/bin/env node
/* REGICIDE PVP — tools/netprofile.js — WHAT IS ACTUALLY ON THE WIRE (v127)
   ------------------------------------------------------------------------
   node tools/netprofile.js [--guests N] [--sep UNITS] [--snaps N]

   The v126 field logs said the host's send buffer sat at or over BUF_FAST_MAX for 11–13% of
   seconds and dropped 2,991 snapshots between the two guests. That is a BYTE problem, and
   `s.bs` — the only size number the game ever reported — is a hand-written estimate that
   omits `carry` entirely and guesses the envelope at a flat 140. So it cannot answer "where
   do the bytes go?", which is the only question worth asking before optimising anything.

   This packs real snapshots from a real world through PeerJS's OWN serializer
   (peerjs-js-binarypack — the same BinaryPack the DataConnection uses) and measures each field
   by DELETION: pack the snapshot, delete one field, pack again, and the difference is that
   field's true cost including its key name. No estimating, no double-counting.

   --guests sets how many remotes exist; --sep is how far apart their bodies stand, which is
   the number that decides how much the shared AOI set overlaps. Both matter: AOI_NEAR is
   evaluated against EVERY guest's position and one snapshot is built for all of them, so two
   guests standing apart each receive the other's neighbourhood at full rate.                */

const fs=require("fs"),path=require("path");
const ROOT=path.join(__dirname,"..");
let bp;try{bp=require("peerjs-js-binarypack");}catch(e){
  console.error("needs the same serializer PeerJS uses:  npm i peerjs-js-binarypack");process.exit(2);}
const pack=bp.pack;
const size=o=>{const b=pack(o);return b.byteLength!==undefined?b.byteLength:b.size;};

const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>0?Number(process.argv[i+1]):d;};
const N_GUESTS=arg("--guests",2), SEP=arg("--sep",90), N_SNAPS=arg("--snaps",300);

// ---- the same stubbed browser the smoketest builds ----
global.window=global;
const THREE=require("three"); global.THREE=THREE;
function mkEl(){return{style:{},classList:{toggle(){},add(){},remove(){}},innerHTML:"",textContent:"",
  dataset:{},children:[],firstChild:null,addEventListener(){},appendChild(){},removeChild(){},
  querySelector:()=>mkEl(),querySelectorAll:()=>[],
  getContext:()=>new Proxy({},{get:(t,k)=>(typeof t[k]!=="undefined")?t[k]:()=>{}}),width:0,height:0};}
const elems={};
global.document={getElementById:id=>elems[id]||(elems[id]=mkEl()),createElement:()=>mkEl(),
  querySelector:()=>mkEl(),querySelectorAll:()=>[],addEventListener(){},body:{appendChild(){}},
  exitPointerLock(){},pointerLockElement:null};
global.addEventListener=()=>{};
global.innerWidth=1280;global.innerHeight=720;global.devicePixelRatio=1;
global.location={reload(){}};
global.atob=s=>Buffer.from(s,"base64").toString("binary");
global.requestAnimationFrame=()=>{};
THREE.WebGLRenderer=function(){return{setSize(){},setPixelRatio(){},render(){},shadowMap:{},domElement:mkEl()}};

const order=["00-data","01-engine","02-world","03-buildings","04-units","05-combat",
  "06-input","07-ai","08-ui","09-main","10-net","11-audio","12-touch","13-deskui"];
let bundle=order.map(f=>fs.readFileSync(path.join(ROOT,"js",f+".js"),"utf8")).join("\n");
bundle+="\n;global.__P={units,buildings,makeUnit,NET,player,tick,clock,BLUE,RED,setClass,"+
  "terrainHeight,getT:()=>T,SNAP_ROW_B:(typeof SNAP_ROW_B!=='undefined'?SNAP_ROW_B:18)};";
const origLog=console.log; console.log=()=>{};        // the boot chatter is not the report
try{(0,eval)(bundle);}finally{console.log=origLog;}
const P=global.__P, NET=P.NET;

// wall clock in lockstep with the fixed timestep — same reasoning as the smoketest
let wall=1e6;
P.clock.getDelta=()=>{wall+=1000/30;return 1/30;};
NET.now=()=>wall;

// ---- stand up N guests, SEP apart, and let the host drive them ----
NET.mode="host";
const lanes=[];
for(let i=0;i<N_GUESTS;i++){
  const ang=(i/Math.max(1,N_GUESTS))*Math.PI*2;
  const gx=Math.cos(ang)*SEP/2, gz=Math.sin(ang)*SEP/2;
  const u=P.makeUnit(P.BLUE,"villager",gx,gz,{name:"Guest"+i,bot:null});
  u.alive=true; u.remote="peer"+i;
  const lane={open:true,sent:0,bytes:0,dataChannel:{bufferedAmount:0},
    send(o){lane.sent++;lane.bytes+=size(o);},close(){}};
  lanes.push(lane);
  NET.remotes["peer"+i]={conn:lane,fast:lane,unit:u,input:{},name:"Guest"+i,rtt:60};
}

// warm the sim so the world is in motion — an idle field understates every row count
for(let i=0;i<240;i++)P.tick();

// ---- collect ----
const FIELDS=["ub","carry","stock0","stock1","sc","bb","fx","ares","ages","ht","T","q","over","un","bn","t"];
const tot={}, rowsPer=[], bytesPer=[], bsPer=[];
FIELDS.forEach(f=>tot[f]=0);
let snaps=0, rowsTotal=0, sameStock=0, sameCarry=0;
let lastStock="",lastCarry="";
for(let i=0;i<N_SNAPS;i++){
  P.tick();                                  // the world moves between snapshots
  const s=NET.packSnap();
  const whole=size(s);
  bytesPer.push(whole); bsPer.push(s.bs||0);
  rowsPer.push(s.un||0); rowsTotal+=s.un||0;
  for(const f of FIELDS){
    if(s[f]===undefined)continue;
    const keep=s[f]; delete s[f];
    tot[f]+=whole-size(s);                   // deletion delta = the field's true cost, key included
    s[f]=keep;
  }
  const stk=JSON.stringify([s.stock0,s.stock1]); if(stk===lastStock)sameStock++; lastStock=stk;
  const cry=JSON.stringify(s.carry);          if(cry===lastCarry)sameCarry++; lastCarry=cry;
  snaps++;
}
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
const med=a=>{const v=a.slice().sort((x,y)=>x-y);return v[v.length>>1];};
const HZ=NET.SNAP_HZ;
const meanBytes=mean(bytesPer);

const R=[];
const say=s=>R.push(s);
say("=".repeat(78));
say("REGICIDE SNAPSHOT PROFILE — "+N_GUESTS+" guest(s), "+SEP+" units apart, "+snaps+" snapshots");
say("  units alive "+P.units.filter(u=>u.alive).length+" of "+P.units.length+
    "   buildings "+P.buildings.length+"   AOI_NEAR "+NET.AOI_NEAR+"   SNAP_HZ "+HZ);
say("  serializer: peerjs-js-binarypack (what the DataConnection actually uses)");
say("=".repeat(78));
say("");
say("TOTAL  mean "+Math.round(meanBytes)+" B/snap   med "+med(bytesPer)+
    "   →  "+(meanBytes*HZ/1024).toFixed(1)+" KB/s per guest at "+HZ+"Hz");
say("       the game's own s.bs estimate: mean "+Math.round(mean(bsPer))+" B  ("+
    (mean(bsPer)>meanBytes?"over":"UNDER")+"-reports by "+
    Math.abs(Math.round(100*(mean(bsPer)-meanBytes)/meanBytes))+"%)");
say("       unit rows: mean "+ (rowsTotal/snaps).toFixed(1)+" of "+P.units.length+
    " units  ("+Math.round(100*(rowsTotal/snaps)/P.units.length)+"% of the field, every snap)");
say("");
say("WHERE THE BYTES GO  (measured by deletion — key names included)");
const ranked=FIELDS.filter(f=>tot[f]>0).sort((a,b)=>tot[b]-tot[a]);
for(const f of ranked){
  const per=tot[f]/snaps;
  say("  "+f.padEnd(7)+String(Math.round(per)).padStart(5)+" B/snap  "+
      String(Math.round(100*per/meanBytes)).padStart(3)+"%   "+
      (per*HZ/1024).toFixed(2)+" KB/s   "+"█".repeat(Math.max(0,Math.round(40*per/meanBytes))));
}
say("");
say("REDUNDANCY  — fields resent unchanged, at "+HZ+" times a second");
say("  stock0+stock1 identical to the previous snapshot: "+sameStock+" of "+snaps+
    " ("+Math.round(100*sameStock/snaps)+"%)  costing "+
    Math.round((tot.stock0+tot.stock1)/snaps)+" B/snap regardless");
say("  carry identical to the previous snapshot:         "+sameCarry+" of "+snaps+
    " ("+Math.round(100*sameCarry/snaps)+"%)  costing "+
    Math.round(tot.carry/snaps)+" B/snap regardless");
const envelope=meanBytes-(tot.ub+tot.bb)/snaps;
say("");
say("  rows (ub+bb) "+Math.round((tot.ub+tot.bb)/snaps)+" B/snap · everything else "+
    Math.round(envelope)+" B/snap ("+Math.round(100*envelope/meanBytes)+"%)");
say("");
say("HEADROOM  — each line is an independent change, measured not guessed");
const rowsMean=rowsTotal/snaps;
const cand=[
  ["delta stock0/stock1 (send only when changed)", (tot.stock0+tot.stock1)/snaps*(sameStock/snaps)],
  ["delta carry (send only when changed)",          tot.carry/snaps*(sameCarry/snaps)],
  ["drop maxHp from routine rows (2B × rows)",      rowsMean*2],
  ["drop `un`/`bn` (derivable from buffer length)", (tot.un+tot.bn)/snaps],
  ["ares at 2Hz instead of "+HZ+"Hz",               (tot.ares/snaps)*(1-2/HZ)],
];
let sum=0;
for(const [name,b] of cand){if(b<=0)continue;sum+=b;
  say("  "+String(Math.round(b)).padStart(4)+" B/snap  "+String(Math.round(100*b/meanBytes)).padStart(2)+
      "%   "+name);}
say("  ".padEnd(3)+"----");
say("  "+String(Math.round(sum)).padStart(4)+" B/snap  "+Math.round(100*sum/meanBytes)+
    "%   TOTAL, taking mean/snap from "+Math.round(meanBytes)+" to "+Math.round(meanBytes-sum)+
    " ("+((meanBytes-sum)*HZ/1024).toFixed(1)+" KB/s)");
say("");
say("PER-GUEST AOI  — one snapshot is built for ALL guests, and AOI_NEAR is tested against");
say("  every guest's body, so each guest receives every other guest's neighbourhood at full");
say("  rate. Re-run with --guests 1 and compare rows/snap to see what the sharing costs at");
say("  this separation; --sep 0 (bodies together) is the case where sharing is free.");
say("=".repeat(78));
console.log(R.join("\n"));
process.exit(0); // the game installs setInterval timers that would keep the event loop alive for ever
