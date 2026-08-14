#!/usr/bin/env node
/* patch-smoketest-timber.js — the timber gate passed without testing anything.
 *
 * The differential form from patch-smoketest-quests.js printed "false -> false": the tree it
 * sampled sits on the King road, so the plot was blocked with the timber AND without it. The
 * equality held for a reason that has nothing to do with the claim. That is precisely the §2
 * failure mode — wallslip, wallpop and nodefair all passed this way before they told the truth.
 *
 * Fix: stop sampling. Sweep EVERY candidate tree and assert the equality across all of them,
 * then separately assert the sweep is not vacuous by requiring that a large majority of those
 * sites really are buildable. A gate that can only go green by finding blocked ground now fails.
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

sub("timber sweep",
  '    const woodAmt=live.amount; live.amount=0;\n'+
  '    const withoutWood=G.validFor("house",live.x,live.z,0);\n'+
  '    live.amount=woodAmt;\n'+
  '    const withWood=G.validFor("house",live.x,live.z,0);\n',
  '    // SWEEP, not a sample: every candidate tree, timber on vs timber off.\n'+
  '    const cands=trees.filter(t=>t.amount>0&&Math.abs(t.x)<MAPX-20&&Math.abs(t.z)<MAPZ-20&&\n'+
  '      !G.buildings.some(b=>b.alive&&Math.hypot(b.x-t.x,b.z-t.z)<R+b.def.r+4)&&\n'+
  '      !N.some(n=>n.type!=="wood"&&n.amount>0&&Math.hypot(n.x-t.x,n.z-t.z)<R+5)&&\n'+
  '      !G.townBoards.some(tb=>Math.hypot(tb.x-t.x,tb.z-t.z)<R+5));\n'+
  '    let differ=0,buildable=0;\n'+
  '    for(const t of cands){\n'+
  '      const a=G.validFor("house",t.x,t.z,0);\n'+
  '      const amt=t.amount; t.amount=0;\n'+
  '      const b=G.validFor("house",t.x,t.z,0);\n'+
  '      t.amount=amt;\n'+
  '      if(a!==b)differ++;\n'+
  '      if(a===true)buildable++;\n'+
  '    }\n'+
  '    check("v114 clearing: TIMBER is never what blocks a plot — swept "+cands.length+\n'+
  '      " tree sites, felling changed the verdict on "+differ,differ===0);\n'+
  '    check("v114 clearing: …and that sweep is NOT vacuous — "+buildable+"/"+cands.length+\n'+
  '      " of those sites are genuinely buildable",cands.length>200&&buildable>cands.length*0.8);\n'+
  '    const withoutWood=true,withWood=true; // superseded by the sweep above\n');

sub("drop the dead single-sample check",
  '    check("v114 clearing: TIMBER is never what blocks a plot (felling it changes nothing: "+withWood+" -> "+withoutWood+")",\n'+
  '      withWood===withoutWood);\n','');

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");failed.forEach(f=>console.error("  - "+f));process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — timber sweep");
