#!/usr/bin/env node
/* v132.50 — two small instrument upgrades the gates need to make honest claims.
   1) auraSpread(u) takes an OPTIONAL owner. Without it a gate measuring "the trail" is really
      measuring the whole scene, and any other stationary levelled unit would carry it to a PASS
      while the subject emitted nothing at all. That is exactly the class of vacuous gate this
      session keeps finding.
   2) an EMISSION COUNTER. The rate curve is a claim about emissions per second, and there is no
      way to observe emissions from outside — live-mote counts confound rate with lifetime, and
      lifetime is now level-scaled too, so a count would move even if the rate never did.
*/
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
`let _auraOff=null,_auraOwn=null,_auraL0=null;   // v132.50: offset-from-owner, owner, birth-life`,
`let _auraOff=null,_auraOwn=null,_auraL0=null;   // v132.50: offset-from-owner, owner, birth-life
let _auraEmits=0;                               // lifetime emissions — the only observable RATE`,
'05-combat: emission counter declaration');

sub('js/05-combat.js',
`  _auraLife[i]=life; _auraL0[i]=life;
}`,
`  _auraLife[i]=life; _auraL0[i]=life;
  _auraEmits++;
}`,
'05-combat: count every emission');

sub('js/05-combat.js',
`function auraSpread(){
  if(!_auraPts)return 0;
  let worst=0;
  for(let i=0;i<AURA_MAX;i++){
    if(_auraLife[i]<=0)continue;
    const own=_auraOwn[i]; if(!own||!own.alive||!own.root)continue;`,
`function auraSpread(only){   // pass a unit to measure ONLY its motes — see patch-aura-emits.js
  if(!_auraPts)return 0;
  let worst=0;
  for(let i=0;i<AURA_MAX;i++){
    if(_auraLife[i]<=0)continue;
    const own=_auraOwn[i]; if(!own||!own.alive||!own.root)continue;
    if(only&&own!==only)continue;`,
'05-combat: auraSpread takes an optional owner');

sub('js/05-combat.js',
`  geo:_auraGeo,mat:_auraMat,pts:_auraPts,spread:auraSpread()};}`,
`  geo:_auraGeo,mat:_auraMat,pts:_auraPts,spread:auraSpread(),emits:_auraEmits};}`,
'05-combat: auraStats reports emits');

console.log('v132.50 aura-emits: '+edits+' edits applied');
