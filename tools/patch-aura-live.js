#!/usr/bin/env node
/* v132.50 — auraLive(): the world positions of the motes actually IN THE AIR.
   Why this exists: the first version of the owner-dies gate read the raw position buffer and
   counted 320 "positions near the corpse" out of 320 slots — dead slots keep their last
   coordinates (only the COLOUR is zeroed on expiry), and every earlier subject in the block had
   stood on that same spot. The gate was reading the graveyard, not the air. Any assertion about
   where motes ARE has to start from the life array.
   ALLOCATES — an instrument for gates and tools only, never for the frame path. */
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
const rd=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const wr=(f,s)=>fs.writeFileSync(path.join(ROOT,f),s);
let edits=0;
function sub(file,find,repl,label){
  const src=rd(file); const n=src.split(find).length-1;
  if(n!==1){console.error('ABORT ['+label+'] matched '+n+' times, expected 1');process.exit(1);}
  wr(file,src.replace(find,repl)); edits++; console.log('  ok  '+label);
}

sub('js/05-combat.js',
`function auraStats(){return{live:_auraLive,max:AURA_MAX,built:!!_auraPts,`,
`function auraLive(){ // ALLOCATES. Gates and tools only — never call this from a frame.
  const out=[];
  if(!_auraPts)return out;
  for(let i=0;i<AURA_MAX;i++){
    if(_auraLife[i]<=0)continue;   // a dead slot keeps its last coordinates; only colour is zeroed
    out.push({x:_auraPos[i*3],y:_auraPos[i*3+1],z:_auraPos[i*3+2],owned:!!_auraOwn[i]});
  }
  return out;
}
function auraStats(){return{live:_auraLive,max:AURA_MAX,built:!!_auraPts,`,
'05-combat: auraLive()');

sub('tools/smoketest.js',
`auraTick,auraStats,auraTint,auraSpread,auraShape,`,
`auraTick,auraStats,auraTint,auraSpread,auraShape,auraLive,`,
'smoketest: export auraLive');

sub('tools/smoketest.js',
`    const g=ST().geo.attributes.position.array; let stray=0, seen=0;
    for(let i=0;i<G.AURA_MAX;i++){
      const x=g[i*3],z=g[i*3+2];
      if(x===0&&z===0)continue;
      seen++; const d=Math.hypot(x-px,z-pz); if(d>4)stray++;
    }
    check("v132.50 aura: a mote whose owner dies mid-flight finishes where it is — it does NOT "+
      "snap to the world origin ("+beforeDeath+" aloft at the moment of death, "+seen+
      " positions still near the corpse, "+stray+" stray)",beforeDeath>0&&seen>0&&stray===0);`,
`    // read the LIFE array, not the position buffer: a dead slot keeps its last coordinates, so
    // the raw buffer reported 320 of 320 "near the corpse" and could not have failed.
    const orphans=G.auraLive().filter(m=>!m.owned);   // exactly the dead man's motes, detached
    let stray=0;
    for(const m of orphans)if(Math.hypot(m.x-px,m.z-pz)>4)stray++;
    check("v132.50 aura: a mote whose owner dies mid-flight finishes where it is — it does NOT "+
      "snap to the world origin ("+beforeDeath+" aloft at the moment of death, "+orphans.length+
      " now ownerless, "+stray+" of them stray)",beforeDeath>0&&orphans.length>=10&&stray===0);`,
'smoketest: the death gate reads live motes, not the graveyard');

console.log('v132.50 aura-live: '+edits+' edits applied');
