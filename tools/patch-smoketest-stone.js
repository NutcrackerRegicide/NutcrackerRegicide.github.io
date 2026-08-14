#!/usr/bin/env node
/* patch-smoketest-stone.js — my own "sole reason" clause was false. Correcting it.
 *
 * Measured (tools/_probe3.js), validFor at each pile, with the pile and with amount zeroed:
 *   stone(148,26)   false -> false      ring at 12/18/26/34 buildable
 *   stone(-148,26)  false -> false
 *   stone(88,32)    false -> false
 *   stone(-88,32)   false -> false
 *   stone(0,-30)    false -> TRUE
 *   stone(0,-132)   false -> TRUE
 *
 * So validFor DOES read amount — the two axis piles flip. The four off-axis piles do not,
 * because v132.24 sited them inside resource CLUSTERS: zero the stone and a neighbouring pile
 * is still inside the footprint. "The stone is the sole reason" is therefore true only of the
 * piles that stand alone, and asserting it of all six failed a correct game — the same mistake,
 * one layer up, that the tree gate made. The claim worth gating is the one that is actually true:
 * every pile blocks, the standalone piles prove stone is what does the blocking, and the ground
 * around each pile is open so the refusal is local to the prize rather than regional terrain.
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

sub("stone claim",
  '    const stoneAmt=stone.amount; stone.amount=0;\n'+
  '    const withoutStone=G.validFor("house",stone.x,stone.z,0);\n'+
  '    stone.amount=stoneAmt;\n'+
  '    const withStone=G.validFor("house",stone.x,stone.z,0);\n',
  '    // every pile, not one: which of them block, and on which is the stone provably the cause?\n'+
  '    const piles=N.filter(n=>n.type==="stone");\n'+
  '    let blocked=0,freedByRemoval=0,openAround=0;\n'+
  '    for(const st of piles){\n'+
  '      if(G.validFor("house",st.x,st.z,0)===false)blocked++;\n'+
  '      const amt=st.amount; st.amount=0;\n'+
  '      if(G.validFor("house",st.x,st.z,0)===true)freedByRemoval++;\n'+
  '      st.amount=amt;\n'+
  '      let ok=0;\n'+
  '      for(const d of [12,18,26,34])for(const ang of [0,Math.PI/2,Math.PI,3*Math.PI/2])\n'+
  '        if(G.validFor("house",st.x+Math.cos(ang)*d,st.z+Math.sin(ang)*d,0)===true)ok++;\n'+
  '      if(ok>0)openAround++;\n'+
  '    }\n',
  );

sub("stone check text",
  '    check("v114 clearing: a STONE pile always blocks one, and is the sole reason it is blocked ("+withStone+" -> "+withoutStone+")",\n'+
  '      withStone===false&&withoutStone===true);',
  '    check("v114 clearing: EVERY stone pile refuses a plot ("+blocked+"/"+piles.length+")",\n'+
  '      blocked===piles.length&&piles.length===6);\n'+
  '    check("v114 clearing: …and on the standalone piles the stone is provably the cause — "+\n'+
  '      freedByRemoval+" of "+piles.length+" free up when the pile is removed (the other four sit\\n'+
  '      inside v132.24 resource CLUSTERS, where a neighbour still covers the footprint)",\n'+
  '      freedByRemoval>=2);\n'+
  '    check("v114 clearing: …and the refusal is LOCAL to the prize, not regional terrain — open\\n'+
  '      ground within 12-34 of all "+openAround+"/"+piles.length+" piles",openAround===piles.length);');

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");failed.forEach(f=>console.error("  - "+f));process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — stone claim corrected");
