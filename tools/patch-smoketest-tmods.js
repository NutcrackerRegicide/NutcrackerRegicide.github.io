#!/usr/bin/env node
/* patch-smoketest-tmods.js — gate public timed modifiers, and park the pool's THIRD tenant.
 *
 * ── THE THING I WROTE DOWN TWO PATCHES AGO, HAPPENING ───────────────────────────────────────
 * patch-smoketest-rings-fix4.js ends: "a shared pool quietly widens what those gates are
 * measuring. Worth remembering before a third one moves in." KILLING FRENZY is the third one. It
 * draws chevrons from a timed modifier alone, and the v132.42 look block parks other units' buffs
 * but not their _tmods — so five real chevrons were on screen when the gates ran.
 *   Parked. But the note stands: every tenant added to a shared pool is a silent widening of
 * every gate that counts it, and the fix is always the same because the cause always is.
 *
 * ── AND THE NEW CLAIMS ──────────────────────────────────────────────────────────────────────
 *   THE ROW CARRIES MAGNITUDE AND CLOCK. An event can say "bleeding started"; only this can say
 *     "bleeding, 4 of 20 seconds left, at this magnitude". That is the whole reason it exists.
 *   COMPLETE, NOT SPARSE. A human with nothing on them is still listed. Third time.
 *   THE LOCAL PLAYER IS LEFT ALONE. It has the private immediate channel that made guest
 *     prediction match the host in v132.33, and a 5 Hz overwrite would step on it. Asserted by
 *     giving the guest's own player a modifier the wire never mentions and checking it survives.
 *   THE TWO EFFECTS TRACK THEIR MODIFIER, and the chevrons COUNT — one per +2, so the stack is
 *     readable rather than merely present.
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

sub("PROTO 44 (wire)",
  'check("v132.41 wire: PROTO is 43 — the batched set-piece channel (s.vfx)",NET.PROTO===43);',
  'check("v132.41/43 wire: PROTO is 44 — the set-piece channel and public timed modifiers",\n'+
  '    NET.PROTO===44);');
sub("PROTO 44 (payload)","G.NET.PROTO===43&&Array.isArray(w.ares)","G.NET.PROTO===44&&Array.isArray(w.ares)");
sub("PROTO 44 (label)",
  '"v115/v132.41 net: PROTO 43 (the set-piece channel) and `ares` still rides both payloads"',
  '"v115/v132.43 net: PROTO 44 (public timed modifiers) and `ares` still rides both payloads"');

sub("park the third tenant",
'        const _pk=[];\n'+
'        for(const u of G.units)if(u.buffs&&Object.keys(u.buffs).length){_pk.push([u,u.buffs]);u.buffs={};}',
'        // ⚠ PARK _tmods TOO, as of v132.43. KILLING FRENZY draws chevrons from a timed modifier\n'+
'        // alone — the pool\'s THIRD tenant, and the note at the end of\n'+
'        // tools/patch-smoketest-rings-fix4.js said to expect exactly this.\n'+
'        const _pk=[], _pkT=[];\n'+
'        for(const u of G.units){\n'+
'          if(u.buffs&&Object.keys(u.buffs).length){_pk.push([u,u.buffs]);u.buffs={};}\n'+
'          if(u._tmods){_pkT.push([u,u._tmods]);u._tmods=null;}\n'+
'        }');

sub("restore it",
'        }finally{ for(const [u,b] of _pk)u.buffs=b; FX(0.016); }',
'        }finally{ for(const [u,b] of _pk)u.buffs=b;\n'+
'                  for(const [u,t2] of _pkT)u._tmods=t2; FX(0.016); }');

sub("the tmod gates",
'      // ---- v132.42: THE PERSISTENT LOOKS ----',
'      // ---- v132.43: PUBLIC TIMED MODIFIERS ----\n'+
'      {\n'+
'        const N=G.NET, mode0=N.mode, P=G.getPlayer(), q0=N.lastQ, t0=P._tmods;\n'+
'        const other=G.units.find(u=>u.alive&&u!==P&&G.isHuman(u));\n'+
'        try{\n'+
'          N.mode="host";\n'+
'          const pack3=()=>{const o=[];for(let i=0;i<3;i++)o.push(N.packSnap());return o;};\n'+
'          if(other){\n'+
'            other._tmods=[{k:"bleed",mag:1,t:12.5,dur:20,fade:false},\n'+
'                          {k:"spdmul",mag:0.5,t:1.25,dur:2,fade:true}];\n'+
'            const A=pack3().filter(x=>x.tm);\n'+
'            const row=A.length?(A[0].tm||[]).find(r=>r[0]===other.id):null;\n'+
'            check("v132.43 tmods: the row carries the MAGNITUDE and the CLOCK — an event can say "+\n'+
'              "\'bleeding started\', only this can say \'bleeding, 12.5s left, at this strength\' "+\n'+
'              "("+(row?JSON.stringify(row[1]):"no row")+")",\n'+
'              !!row&&row[1].length===8&&row[1][2]===1250&&row[1][7]===1);\n'+
'            // …and it round-trips onto the right unit\n'+
'            other._tmods=null;\n'+
'            N.mode="guest";\n'+
'            if(A.length){\n'+
'              A[0].q=N.lastQ+1; N.applySnap(A[0]);\n'+
'              const got=other._tmods||[];\n'+
'              const bleed=got.find(e=>e.k==="bleed"), spd=got.find(e=>e.k==="spdmul");\n'+
'              check("v132.43 tmods: …and a GUEST rebuilds them on the right unit, magnitudes and "+\n'+
'                "clocks intact ("+got.length+" kinds, bleed t="+(bleed?bleed.t:"—")+", spdmul "+\n'+
'                "fade="+(spd?spd.fade:"—")+")",\n'+
'                got.length===2&&!!bleed&&Math.abs(bleed.t-12.5)<0.02&&!!spd&&spd.fade===true);\n'+
'            }\n'+
'            // COMPLETE, not sparse\n'+
'            N.mode="host"; other._tmods=null;\n'+
'            const B=pack3().filter(x=>x.tm);\n'+
'            const row2=B.length?(B[0].tm||[]).find(r=>r[0]===other.id):null;\n'+
'            check("v132.43 tmods: a human with NOTHING on them is still listed — a sparse list "+\n'+
'              "cannot say \'cleared\', third time this trap has come up ("+\n'+
'              (row2?"listed, "+row2[1].length+" entries":"MISSING")+")",\n'+
'              !!row2&&row2[1].length===0);\n'+
'            // THE LOCAL PLAYER IS LEFT ALONE — it has the private immediate channel\n'+
'            N.mode="guest";\n'+
'            P._tmods=[{k:"stun",mag:1,t:9,dur:9,fade:false}];\n'+
'            if(B.length){ B[0].q=N.lastQ+1; N.applySnap(B[0]); }\n'+
'            check("v132.43 tmods: the guest\'s OWN player is left to its private channel — that "+\n'+
'              "arrives at once rather than at 5 Hz, and the immediacy is what made guest "+\n'+
'              "prediction match the host in v132.33 (own stun survived: "+\n'+
'              (!!(P._tmods&&P._tmods.length))+")",!!(P._tmods&&P._tmods.length===1));\n'+
'          }\n'+
'        }finally{ N.mode=mode0; P._tmods=t0; N.lastQ=q0; if(other)other._tmods=null; }\n'+
'      }\n'+
'      // ---- v132.43: THE TWO EFFECTS IT UNBLOCKED ----\n'+
'      {\n'+
'        const S=G.buffFxStats, FX=G.buffFxTick;\n'+
'        const _p=[],_pt=[];\n'+
'        for(const u of G.units){\n'+
'          if(u.buffs&&Object.keys(u.buffs).length){_p.push([u,u.buffs]);u.buffs={};}\n'+
'          if(u._tmods){_pt.push([u,u._tmods]);u._tmods=null;}\n'+
'        }\n'+
'        try{\n'+
'          const K=mkB(0,{}); K.buffs={}; K._tmods=null;\n'+
'          FX(0.016);\n'+
'          const base=S().lookVis;\n'+
'          K._tmods=[{k:"dmgflat",mag:4,t:5,dur:7,fade:false}];   // +4 = two kills\n'+
'          FX(0.016); const two=S().lookVis-base;\n'+
'          K._tmods=[{k:"dmgflat",mag:10,t:5,dur:7,fade:false}];  // +10 = the cap\n'+
'          FX(0.016); const five=S().lookVis-base;\n'+
'          check("v132.43 KILLING FRENZY: the chevrons COUNT the stack — +4 draws "+two+", +10 "+\n'+
'            "draws "+five+". Neither the stack nor its seven-second window has ever been visible; "+\n'+
'            "this shows the first directly and the second by winking out",two===2&&five===5);\n'+
'          K._tmods=null; FX(0.016);\n'+
'          check("v132.43 KILLING FRENZY: …and they go when the modifier does ("+\n'+
'            (S().lookVis-base)+")",S().lookVis-base===0);\n'+
'          K.alive=false;\n'+
'        }finally{ for(const [u,b] of _p)u.buffs=b; for(const [u,t2] of _pt)u._tmods=t2; FX(0.016); }\n'+
'      }\n'+
'      // ---- v132.42: THE PERSISTENT LOOKS ----');

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — the tmod gates");
