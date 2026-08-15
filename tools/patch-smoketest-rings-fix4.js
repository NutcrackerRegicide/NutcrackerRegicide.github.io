#!/usr/bin/env node
/* patch-smoketest-rings-fix4.js — v132.42 gave the ring pool a second tenant.
 *
 * KING'S GUARD draws a small gold ring at the feet of anyone standing in their king's light, and
 * it reuses _ringAt — so it lands in the same _ringOn counter the Batch D gates read. By the time
 * those gates run, the campaign has real humans holding kguard near real kings, and five
 * assertions started measuring somebody else's ring again.
 *
 * The block already parks every other unit's _fxMask for exactly this reason. It now parks their
 * BUFFS as well, because as of v132.42 a buff alone is enough to put a ring on the ground — which
 * was not true when the parking was written.
 *
 * ⚠ The lesson is not "park more things". It is that a shared pool makes every gate that counts
 * it a gate about the whole game rather than about its own subject, and each new tenant silently
 * widens what those gates are measuring. Worth remembering before a third one moves in.
 */
const fs=require("fs"),path=require("path");
const F=path.join(__dirname,"smoketest.js");
let s=fs.readFileSync(F,"utf8");
let failed=[];
function sub(name,from,to){
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
}

sub("park buffs as well as masks",
'        const _parked=[];\n'+
'        for(const u of G.units)if(u._fxMask){_parked.push([u,u._fxMask]);u._fxMask=0;}',
'        // ⚠ PARK THE BUFFS TOO, as of v132.42. KING\'S GUARD draws a ring at the feet of anyone\n'+
'        // in their king\'s light and reuses _ringAt, so it lands in the same counter these gates\n'+
'        // read — a buff alone is now enough to put a ring on the ground, which was not true when\n'+
'        // this parking was written. A shared pool quietly widens every gate that counts it.\n'+
'        const _parked=[], _parkedB=[];\n'+
'        for(const u of G.units){\n'+
'          if(u._fxMask){_parked.push([u,u._fxMask]);u._fxMask=0;}\n'+
'          if(u.buffs){_parkedB.push([u,u.buffs]);u.buffs={};}   // R is not created yet\n'+
'        }');

sub("restore them",
'        for(const [u,m] of _parked)u._fxMask=m;   // give the world its rings back',
'        for(const [u,m] of _parked)u._fxMask=m;   // give the world its rings back\n'+
'        for(const [u,b] of _parkedB)u.buffs=b;    // …and its loadouts');

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — ring gates isolated from the new look pass");
