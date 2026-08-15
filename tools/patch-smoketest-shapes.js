#!/usr/bin/env node
/* patch-smoketest-shapes.js — gate the SHAPES, which means gating shape and not existence.
 *
 * ── THE BUG THAT PROMPTED THIS ──────────────────────────────────────────────────────────────
 * v132.44 shipped a "thrown knife" that was an untextured sprite — a solid camera-facing square —
 * and nothing in a 702-assertion suite noticed, because not one assertion was about appearance.
 * John looked at it and asked. That is the gap: a suite can prove a thing exists, moves, expires,
 * pools and reaches a guest, and still know nothing about whether it looks like what it is called.
 *
 * ── SO THESE ASSERT GEOMETRY, NOT PRESENCE ──────────────────────────────────────────────────
 * "A blade texture exists" is worth nothing — the square existed too. What is checked is that the
 * alpha field has the PROPERTIES of a knife:
 *     · it is WIDEST at the guard and NARROWEST at the tip
 *     · the blade section tapers MONOTONICALLY along its length — a shape that bulges is not a
 *       blade whatever it was named
 *     · there is a grip behind the guard, thinner than it
 * Those three together cannot be satisfied by a square, a triangle, or a blob. And the eye is
 * still the final judge — tools/fxshapes.js renders them, which is how the first cut was caught
 * being a cleaver with a guard nearly as tall as the image.
 *
 * ── AND THAT THE KNIFE ACTUALLY USES IT ─────────────────────────────────────────────────────
 * A texture built and never applied is precisely the failure this session keeps producing in
 * other forms. So the knife's live sprite is inspected: it must carry the blade map, not the
 * default dot, and its rotation must match the bearing it was thrown along.
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

subC("expose the textures and the live maps",
`function fxStats(){return {pos:_fxLive.filter(e=>e.kind==="s").map(e=>({x:e.m.position.x,z:e.m.position.z})),`,
`function fxTex(){return {soft:_texSoft,blade:_texBlade,sliver:_texSliver};}
function fxStats(){return {maps:_fxLive.filter(e=>e.kind==="s").map(e=>({
    blade:e.m.material.map===_texBlade,sliver:e.m.material.map===_texSliver,
    soft:e.m.material.map===_texSoft,rot:e.m.material.rotation})),
  pos:_fxLive.filter(e=>e.kind==="s").map(e=>({x:e.m.position.x,z:e.m.position.z})),`);

subT("export it",
  'RING_MIN,RING_TIGHTEN,getPlayer:()=>player,fxTick,fxStats,vfxPlay,isHuman,',
  'RING_MIN,RING_TIGHTEN,getPlayer:()=>player,fxTick,fxStats,fxTex,vfxPlay,isHuman,');

subT("the shape gates",
'        // v132.44: the knife must TRAVEL, not sit where it was thrown',
'        // ---- v132.45: does it LOOK like a knife? ----\n'+
'        {\n'+
'          const TX=G.fxTex();\n'+
'          const alpha=(t2,u,v)=>{const im=t2.image,w=im.width,h=im.height;\n'+
'            const x=Math.min(w-1,Math.max(0,Math.round(u*(w-1))));\n'+
'            const y=Math.min(h-1,Math.max(0,Math.round(v*(h-1))));\n'+
'            return im.data[(y*w+x)*4+3]/255;};\n'+
'          const width=(t2,u)=>{let n=0;const h=t2.image.height;\n'+
'            for(let i=0;i<h;i++)if(alpha(t2,u,i/(h-1))>0.5)n++; return n/h;};\n'+
'          const B=TX.blade;\n'+
'          check("v132.45 shapes: the blade texture was built ("+(B?B.image.width+"x"+B.image.height:"none")+\n'+
'            ")",!!B&&B.image.width>=32);\n'+
'          if(B){\n'+
'            const wGuard=width(B,0.30), wMid=width(B,0.62), wTip=width(B,0.98), wGrip=width(B,0.12);\n'+
'            // a KNIFE: widest at the guard, narrowest at the tip, a grip thinner than the guard\n'+
'            check("v132.45 shapes: it has the PROPERTIES of a knife — widest at the guard ("+\n'+
'              wGuard.toFixed(2)+"), narrower at mid-blade ("+wMid.toFixed(2)+"), a point at the "+\n'+
'              "tip ("+wTip.toFixed(2)+"), and a grip thinner than the guard ("+wGrip.toFixed(2)+\n'+
'              "). A square satisfies none of these, and the square is what v132.44 shipped",\n'+
'              wGuard>wMid&&wMid>wTip&&wTip<0.10&&wGrip<wGuard&&wGrip>0);\n'+
'            let mono=true, prev=1;\n'+
'            for(let u=0.36;u<=0.99;u+=0.04){const w=width(B,u); if(w>prev+0.02){mono=false;break;} prev=w;}\n'+
'            check("v132.45 shapes: …and the blade tapers MONOTONICALLY from guard to point — a "+\n'+
'              "shape that bulges is not a blade whatever it is named",mono);\n'+
'          }\n'+
'          // and the knife actually USES it, pointed where it is going\n'+
'          settle();\n'+
'          G.vfxPlay([13,500,500,700,500]);            // due east, bearing 0\n'+
'          const mp=G.fxStats().maps;\n'+
'          const lead=mp.length?mp[0]:null;\n'+
'          check("v132.45 shapes: the thrown knife CARRIES the blade map and points along its "+\n'+
'            "bearing (blade="+(lead&&lead.blade)+", rot="+(lead?lead.rot.toFixed(2):"—")+\n'+
'            "). A texture built and never applied is the same bug in a new coat",\n'+
'            !!lead&&lead.blade===true&&Math.abs(lead.rot)<0.01);\n'+
'          const soft=mp.filter(m=>m.soft).length;\n'+
'          check("v132.45 shapes: …and its trail uses the soft dot, not the blade — two more "+\n'+
'            "knives behind the knife would read as three knives ("+soft+" of "+mp.length+")",\n'+
'            soft===mp.length-1);\n'+
'          settle();\n'+
'        }\n'+
'        // v132.44: the knife must TRAVEL, not sit where it was thrown');

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(P.comb,c.o); fs.writeFileSync(P.st,t.o);
console.log("patched — the shape gates");
