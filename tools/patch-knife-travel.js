#!/usr/bin/env node
/* patch-knife-travel.js — "it draws a flight" was counting particles, not motion.
 *
 * Setting the knife's velocity to zero — so it sits where it was thrown, which is the three-static-
 * puffs behaviour the whole change exists to replace — left the gate GREEN. It asserted that three
 * particles appeared, and three particles appear either way.
 *
 * This is the same shape as every other vacuity found this session: the assertion measured
 * something ADJACENT to its sentence. "Draws a flight" is a claim about DISPLACEMENT, so the gate
 * now reads where the sprite actually is after a few frames and requires it to have covered most
 * of the distance to its mark. fxStats() gains a `pos` view for that, the same way buffFxStats()
 * gained `live` for the ring radii.
 *
 * ⚠ And the patch that fixes it first hit the OTHER documented trap: a backtick inside a template
 * literal, from writing the field name as `pos` in a comment delimited by backticks. node --check
 * caught it before anything was written. Both traps in one patch is a fair summary of the file.
 *
 * ⚠ The tally, since it is now a pattern rather than an incident: counters, presence and adjacency
 * are all easy to assert and none of them is ever the claim. If the sentence says MOVES, measure
 * position. If it says VANISHES, count what is visible. If it says TIGHTENS, measure the radius.
 */
const fs=require("fs"),path=require("path");
let failed=[];
function mk(box){return function(name,from,to){
  const n=box.o.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  box.o=box.o.split(from).join(to);};}
const P={comb:path.join(__dirname,"..","js","05-combat.js"),
         st:path.join(__dirname,"smoketest.js")};
const c={o:fs.readFileSync(P.comb,"utf8")}, t={o:fs.readFileSync(P.st,"utf8")};
const subC=mk(c), subT=mk(t);

subC("expose where the particles ARE",
`function fxStats(){return {live:_fxLive.length,sprites:_fxsPool?_fxsPool.length:0,`,
`// The 'pos' view is where the live sprites actually are. A count can say something was drawn; only this
// can say it MOVED — and "the knife flies" is a claim about displacement, not about population.
function fxStats(){return {pos:_fxLive.filter(e=>e.kind==="s").map(e=>({x:e.m.position.x,z:e.m.position.z})),
  live:_fxLive.length,sprites:_fxsPool?_fxsPool.length:0,`);

subT("measure displacement, not population",
'          settle();\n'+
'          G.vfxPlay([13,500,500,700,700]);\n'+
'          const st0=G.fxStats().live;\n'+
'          const probe=()=>{const a=[];for(const m of []){}return a;};\n'+
'          for(let i=0;i<6;i++)G.fxTick(0.016);\n'+
'          check("v132.44 KNIFE FIGHTER: the throw draws a flight, not a dotted line — one sprite "+\n'+
'            "plus a short trail, launched along the bearing ("+st0+" particles)",st0===3);\n'+
'          settle();',
'          settle();\n'+
'          G.vfxPlay([13,500,500,700,700]);            // from (50,50) to (70,70)\n'+
'          const st0=G.fxStats().live;\n'+
'          const p0=G.fxStats().pos.slice();\n'+
'          for(let i=0;i<12;i++)G.fxTick(0.016);       // ~0.2s of flight\n'+
'          const p1=G.fxStats().pos;\n'+
'          // ⚠ DISPLACEMENT, not population. The first version of this counted three particles —\n'+
'          // and three appear whether the knife flies or sits where it was thrown, so it stayed\n'+
'          // GREEN with the velocity zeroed, which is exactly the behaviour being replaced.\n'+
'          const far=p1.length?Math.max.apply(null,p1.map(q=>Math.hypot(q.x-50,q.z-50))):0;\n'+
'          const dist=Math.hypot(20,20);\n'+
'          check("v132.44 KNIFE FIGHTER: the knife TRAVELS — after 0.2s the lead sprite has covered "+\n'+
'            far.toFixed(1)+" of the "+dist.toFixed(1)+" units to its mark. Three static puffs read "+\n'+
'            "as three things happening in a row rather than one thing flying, which was the whole "+\n'+
'            "complaint ("+st0+" particles launched from "+(p0.length?"the thrower":"nowhere")+")",\n'+
'            st0===3&&far>dist*0.5);\n'+
'          settle();');

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(P.comb,c.o); fs.writeFileSync(P.st,t.o);
console.log("patched — the knife gate measures displacement");
