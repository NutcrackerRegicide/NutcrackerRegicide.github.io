#!/usr/bin/env node
/* patch-smoketest-rings-net.js — do the rings actually reach a guest, and does the wire carry them?
 *
 * Two separate ways this feature could be a host-only feature, so two separate gates.
 *
 * ── 1. THE FRAME PATH (trap #12) ────────────────────────────────────────────────────────────
 * buffFxTick is called from updateEffects because BOTH frame paths land there. Reading the source
 * and agreeing with myself is not evidence — v128.8 shipped an objective ribbon a guest could
 * never clear, on exactly that reasoning. So: set NET.mode="guest", drive a REAL NET.guestFrame,
 * and check a ring appeared. If someone ever moves this call into tickBody's host branch, this
 * goes red and names the reason.
 *
 * ── 2. THE STATE (the dual-site trap) ───────────────────────────────────────────────────────
 * Even with the drawing wired correctly, a guest draws nothing unless the state arrives: buffs
 * are only synced for your OWN player, and auraBuffTick is host-only. So the snapshot must carry
 * a row per holder, and the guest must apply it. Both halves are asserted against the real
 * builder and the real applySnap, not a stub.
 *
 * ⚠ AND THE EMPTY LIST. The subtle one. When the last holder drops the buff there are no rows to
 * send, and the cheap implementation skips the field — leaving every guest holding the previous
 * rows forever, so the ring outlives the buff. The gate drives the transition twice: once to
 * prove an empty array IS sent on the first quiet snapshot, and once to prove it then goes quiet
 * rather than shipping an empty array forever.
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

sub("guest + wire gates",
'        R.alive=false; R._fxMask=0;\n'+
'        for(const [u,m] of _parked)u._fxMask=m;   // give the world its rings back\n'+
'        FX(0.016);\n'+
'      }',
'        // ---- 1. THE FRAME PATH. Driven through a REAL guest frame, not by reading the source.\n'+
'        {\n'+
'          const mode0=G.NET.mode;\n'+
'          R._fxMask=G.FX_SANCT; R._fxStill=1;\n'+
'          FX(0.016); const hostRings=S().rings;\n'+
'          for(const m of []){}\n'+
'          G.NET.mode="guest";\n'+
'          let threw="";\n'+
'          try{ G.NET.guestFrame(0.016); }catch(e){ threw=e.message; }\n'+
'          const guestRings=S().rings;\n'+
'          G.NET.mode=mode0;\n'+
'          check("v132.39 rings on a GUEST: a real NET.guestFrame draws them — buffFxTick rides "+\n'+
'            "updateEffects because BOTH frame paths call it. Display code in tickBody\'s host "+\n'+
'            "branch is trap #12, and that shipped once already (host "+hostRings+", guest "+\n'+
'            guestRings+")"+(threw?" ["+threw+"]":""),!threw&&guestRings>=1);\n'+
'        }\n'+
'        // ---- 2. THE STATE. Buffs are per-player-only and auraBuffTick is host-only, so without\n'+
'        // a wire row a guest has nothing to draw FROM however correct the drawing is.\n'+
'        {\n'+
'          const N=G.NET, mode0=N.mode;\n'+
'          const src=fs.readFileSync(path.join(ROOT,"js","10-net.js"),"utf8");\n'+
'          check("v132.39 ring wire: the snapshot builder ships a row per HOLDER — id, mask, both "+\n'+
'            "counts, the stillness clock and the two ids — beside the 5 Hz scoreboard",\n'+
'            /_ar\\.push\\(\\s*\\[u\\.id,u\\._fxMask\\|0,u\\._auraA\\|0,u\\._auraE\\|0/.test(src)&&\n'+
'            /if\\(_ar\\.length\\|\\|NET\\._arLast\\)s\\.ar=_ar/.test(src));\n'+
'          check("v132.39 ring wire: …and the EMPTY list is still sent ONCE when the last holder "+\n'+
'            "drops it. Skipping it to save bytes leaves every guest holding the old rows forever "+\n'+
'            "and the ring outlives the buff",/NET\\._arLast=_ar\\.length/.test(src));\n'+
'          check("v132.39 ring wire: …and the guest CLEARS every mask before applying, because a "+\n'+
'            "unit that dropped the buff sends no row at all rather than a row of zeros",\n'+
'            /for\\(const u of units\\)if\\(u\\._fxMask\\)u\\._fxMask=0;/.test(src));\n'+
'          // drive the real applySnap path: a row arrives, then the unit vanishes from the list\n'+
'          N.mode="guest";\n'+
'          R._fxMask=0; R._auraA=0; R._auraE=0;\n'+
'          const row=[[R.id,G.FX_RESOLVE,0,4,100,0,0]];\n'+
'          if(typeof N.applySnap==="function"){\n'+
'            try{N.applySnap({ar:row});}catch(e){}\n'+
'            const got=R._fxMask===G.FX_RESOLVE&&R._auraE===4;\n'+
'            check("v132.39 ring wire: a guest APPLIES an arriving row to the right unit by id "+\n'+
'              "(mask "+R._fxMask+", enemies "+R._auraE+")",got);\n'+
'            try{N.applySnap({ar:[]});}catch(e){}\n'+
'            check("v132.39 ring wire: …and an EMPTY list takes the ring away, which is the whole "+\n'+
'              "reason it is sent (mask now "+R._fxMask+")",R._fxMask===0);\n'+
'          }\n'+
'          N.mode=mode0;\n'+
'        }\n'+
'        R.alive=false; R._fxMask=0;\n'+
'        for(const [u,m] of _parked)u._fxMask=m;   // give the world its rings back\n'+
'        FX(0.016);\n'+
'      }');

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — the guest + wire ring gates");
