#!/usr/bin/env node
/* patch-smoketest-fx.js — gate the v132.41 set-pieces, and fix a gate that counted call sites.
 *
 * ── THE SEEDED-WINDOW GATE WAS TOO LITERAL ──────────────────────────────────────────────────
 * It asserted `_ringBuild()` appears exactly twice — a declaration and one call. v132.41 adds a
 * SECOND lazy caller (_fxBuild borrows the ring geometry for the shockwave), and the gate went
 * red for a change that does not violate anything: both callers are themselves lazy.
 *   Counting call sites was never the invariant. The invariant is that NO builder runs at LOAD,
 * and that is now stated directly: no lazy builder is invoked at column zero, and every geometry
 * handle is declared null. A third lazy caller will not redden it; a single top-level call will.
 *
 * ── AND THE ELEVEN SET-PIECES ───────────────────────────────────────────────────────────────
 *   EVERY KIND DRAWS      all eleven wire kinds produce particles. A kind that fell out of the
 *                         switch draws nothing and throws nothing — it is simply absent, which
 *                         is invisible from the host's chair if you are not the one it happens to.
 *   THE POOLS HAVE FLOORS AND CEILINGS. A thousand requested sprites must yield at most FXS_MAX
 *                         live meshes. Unbounded here is a memory leak that only shows up in the
 *                         one match that goes long.
 *   THEY EXPIRE           run the clock past the longest life and the live list empties. A
 *                         particle that never dies is the same leak wearing a different hat.
 *   THE QUEUE IS CAPPED   VFX_MAX rows, then the frame's remainder is dropped rather than a
 *                         thousand rows going on the wire.
 *   A GUEST SEES THEM     driven through a real NET.guestFrame from a standing start, because
 *                         everything here fires inside dealDamage and dealDamage returns on the
 *                         first line for a guest. Third time this trap has been in play.
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

sub("PROTO 43 (wire)",
  'check("v132.40 wire: PROTO is 42 — public buff rows (s.bfa), so a client knows every player\'s "+\n'+
  '    "loadout and not only its own",NET.PROTO===42);',
  'check("v132.41 wire: PROTO is 43 — the batched set-piece channel (s.vfx)",NET.PROTO===43);');
sub("PROTO 43 (payload)","G.NET.PROTO===42&&Array.isArray(w.ares)","G.NET.PROTO===43&&Array.isArray(w.ares)");
sub("PROTO 43 (payload label)",
  '"v115/v132.40 net: PROTO 42 (public loadouts) and `ares` still rides both payloads"',
  '"v115/v132.41 net: PROTO 43 (the set-piece channel) and `ares` still rides both payloads"');

sub("state the invariant instead of counting call sites",
'          const declNull=/let _ringGeo=null/.test(src);\n'+
'          const mkGeo=(src.match(/new THREE\\.RingGeometry\\(0\\.94/g)||[]).length;\n'+
'          const inBuild=(body.match(/new THREE\\.RingGeometry\\(0\\.94/g)||[]).length;\n'+
'          const calls=(src.match(/_ringBuild\\(\\)/g)||[]).length;   // decl + the one call site\n'+
'          const calledFromTick=/function buffFxTick\\(dt\\)\\{[\\s\\S]{0,220}_ringBuild\\(\\)/.test(src);\n'+
'          check("v132.39 rings: NO geometry is minted at LOAD — _ringGeo is declared null, both "+\n'+
'            "ring geometries are built inside _ringBuild() ("+inBuild+" of "+mkGeo+"), and "+\n'+
'            "_ringBuild is called only from buffFxTick. A BufferGeometry constructed inside the "+\n'+
'            "seeded window costs four random draws and moves every tree on the map (invariant #2)",\n'+
'            declNull&&mkGeo===2&&inBuild===2&&calls===2&&calledFromTick);',
'          // ⚠ STATE THE INVARIANT, do not count call sites. The first version asserted\n'+
'          // "_ringBuild appears exactly twice" and went red in v132.41 when a SECOND lazy caller\n'+
'          // was added — a change that violates nothing. What matters is that no builder runs at\n'+
'          // LOAD, so that is what is checked: nothing invoked at column zero, every geometry\n'+
'          // handle declared null. A third lazy caller will not redden this; one top-level call will.\n'+
'          const declNull=/let _ringGeo=null/.test(src)&&/let _hexPool=null,_hexGeo=null/.test(src);\n'+
'          const mkGeo=(src.match(/new THREE\\.RingGeometry\\(0\\.94/g)||[]).length;\n'+
'          const inBuild=(body.match(/new THREE\\.RingGeometry\\(0\\.94/g)||[]).length;\n'+
'          const topLevel=(src.match(/^(_ringBuild|_fxBuild)\\(\\)/gm)||[]);\n'+
'          check("v132.39/41: NO geometry is minted at LOAD — every handle is declared null, both "+\n'+
'            "ring geometries are built inside _ringBuild() ("+inBuild+" of "+mkGeo+"), and no "+\n'+
'            "lazy builder is invoked at top level ("+topLevel.length+" such calls). A geometry "+\n'+
'            "constructed inside the seeded window costs four random draws and moves every tree "+\n'+
'            "on the map (invariant #2)",\n'+
'            declNull&&mkGeo===2&&inBuild===2&&topLevel.length===0);');

sub("the set-piece gates",
'      // ---- v132.40: WHAT EVERY PLAYER IS CARRYING ----',
'      // ---- v132.41: THE SET-PIECES ----\n'+
'      {\n'+
'        const X=G.fxStats, PLAY=G.vfxPlay;\n'+
'        const settle=()=>{for(let i=0;i<400;i++)G.fxTick(0.05);};   // 20s — past the longest life\n'+
'        settle();\n'+
'        check("v132.41 set-pieces: the stage starts empty ("+X().live+" live), so the counts "+\n'+
'          "below are this block\'s and not the campaign\'s",X().live===0);\n'+
'        // every kind draws something. A kind that fell out of the switch is silent, not broken.\n'+
'        const KINDS=[["EARTHSHAKER",1,100,0],["KEEN EYE",2,0,0],["CULLER",3,0,0],\n'+
'                     ["SHRUG IT OFF",4,0,0],["SIXTH SENSE",5,120,0],["ARROW WARD",6,120,0],\n'+
'                     ["IRON GUARD",7,120,0],["RAPID VOLLEY",8,60,60],["SERRATED EDGE",9,6,0],\n'+
'                     ["VENOMOUS",10,5,0],["CONCUSSIVE",11,15,0]];\n'+
'        const silent=[];\n'+
'        for(const [nm,k,p,q] of KINDS){\n'+
'          settle(); const b=X().live;\n'+
'          PLAY([k,50,50,p,q]);\n'+
'          if(X().live<=b)silent.push(nm+"(#"+k+")");\n'+
'        }\n'+
'        check("v132.41 set-pieces: all "+KINDS.length+" wire kinds DRAW — a kind that fell out of "+\n'+
'          "the switch throws nothing and draws nothing, so it is invisible from the host\'s chair "+\n'+
'          "unless you are the one it happens to"+(silent.length?" [SILENT: "+silent.join(", ")+"]":""),\n'+
'          silent.length===0);\n'+
'        // the pools have ceilings\n'+
'        settle();\n'+
'        for(let i=0;i<1000;i++)PLAY([2,50,50,0,0]);      // 8 sprites a pop = 8000 requested\n'+
'        const st=X();\n'+
'        check("v132.41 set-pieces: the sprite pool has a CEILING — 8000 particles requested left "+\n'+
'          st.sprites+" meshes, not 8000. Unbounded here is a leak that only shows up in the one "+\n'+
'          "match that goes long",st.sprites<=260);\n'+
'        // …and they expire\n'+
'        settle();\n'+
'        check("v132.41 set-pieces: …and every particle EXPIRES ("+X().live+" left after 20s). One "+\n'+
'          "that never dies is the same leak wearing a different hat",X().live===0);\n'+
'        // the wire queue is capped\n'+
'        {\n'+
'          const N=G.NET, mode0=N.mode;\n'+
'          try{\n'+
'            N.mode="host"; N._vfx.length=0;\n'+
'            for(let i=0;i<500;i++)N.vfxPush([2,0,0,0,0]);\n'+
'            check("v132.41 set-pieces: the WIRE queue is capped at "+N.VFX_MAX+" — 500 pushed, "+\n'+
'              N._vfx.length+" queued. One slam catching thirty units, each rolling its own proc, "+\n'+
'              "must not put a thousand rows on a snapshot",N._vfx.length===N.VFX_MAX);\n'+
'            N._vfx.length=0;\n'+
'            N.mode="guest";\n'+
'            for(let i=0;i<10;i++)N.vfxPush([2,0,0,0,0]);\n'+
'            check("v132.41 set-pieces: …and a GUEST never queues — it would echo every effect back "+\n'+
'              "at a host that already drew it ("+N._vfx.length+" queued)",N._vfx.length===0);\n'+
'          }finally{ N.mode=mode0; N._vfx.length=0; }\n'+
'        }\n'+
'        // a guest DRAWS them, from a standing start, through a real frame\n'+
'        {\n'+
'          const N=G.NET, mode0=N.mode;\n'+
'          try{\n'+
'            settle();\n'+
'            const zero=X().live;\n'+
'            N.mode="guest";\n'+
'            N.applySnap({vfx:[[1,500,500,100,0]],q:N.lastQ+1});\n'+
'            const after=X().live;\n'+
'            check("v132.41 set-pieces: a GUEST draws them from a standing start ("+zero+" → "+\n'+
'              after+"). Everything here fires inside dealDamage, which returns on its first line "+\n'+
'              "for a guest — third time this trap has been in play",zero===0&&after>0);\n'+
'          }catch(e){ check("v132.41 set-pieces: a GUEST draws them ["+e.message+"]",false); }\n'+
'          finally{ N.mode=mode0; }\n'+
'        }\n'+
'        settle();\n'+
'      }\n'+
'      // ---- v132.40: WHAT EVERY PLAYER IS CARRYING ----');

sub("export the fx surface",
  'RING_MIN,RING_TIGHTEN,getPlayer:()=>player};";',
  'RING_MIN,RING_TIGHTEN,getPlayer:()=>player,fxTick,fxStats,vfxPlay,isHuman};";');

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — the set-piece gates");
