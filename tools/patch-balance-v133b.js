#!/usr/bin/env node
/* v133.0 — the tail of the balance pass. */
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
let n=0;
function sub(file,find,repl,label){
  const p=path.join(ROOT,file), src=fs.readFileSync(p,'utf8'), c=src.split(find).length-1;
  if(c!==1){console.error('ABORT ['+label+'] matched '+c+', expected 1');process.exit(1);}
  fs.writeFileSync(p,src.replace(find,repl)); n++; console.log('  ok  '+label);
}
sub('js/03-buildings.js',`    dmg*=1+0.10*buffSt(att,"wreck"); // WRECKER: human demolition specialists`,
                          `    dmg*=1+0.15*buffSt(att,"wreck"); // WRECKER: human demolition specialists`,'03-buildings: Wrecker 15%');
sub('js/09-main.js',`      const g=Math.round(2.5*tradeGold(d)*(1+0.10*buffSt(player,"trade"))); // DEEP POCKETS`,
                      `      const g=Math.round(2.5*tradeGold(d)*(1+0.15*buffSt(player,"trade"))); // DEEP POCKETS`,'09-main: Deep Pockets 15%');
sub('js/10-net.js',`      const g=Math.round(2.5*tradeGold(d)*(1+0.10*buffSt(u,"trade"))); // DEEP POCKETS`,
                     `      const g=Math.round(2.5*tradeGold(d)*(1+0.15*buffSt(u,"trade"))); // DEEP POCKETS`,'10-net: Deep Pockets 15% (guest mirror)');
// the chevrons counted +2 a kill; Killing Frenzy pays +3 now, so five chevrons is +15
sub('js/05-combat.js',`      if(fl>0){const nch=Math.min(5,Math.round(fl/2));`,
                        `      if(fl>0){const nch=Math.min(5,Math.round(fl/3));   // v133.0: +3 a kill, so a chevron is 3`,
  '05-combat: frenzy chevrons re-scaled to +3 a kill');
console.log('v133.0 tail: '+n+' edits applied');
