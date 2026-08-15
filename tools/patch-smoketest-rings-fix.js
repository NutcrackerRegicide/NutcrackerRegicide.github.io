#!/usr/bin/env node
/* patch-smoketest-rings-fix.js — six ring gates went red and the game was innocent in all six.
 *
 * ── WHAT ACTUALLY HAPPENED ──────────────────────────────────────────────────────────────────
 * buffFxStats() reports the WHOLE SCENE. By the time these gates run, the campaign above them has
 * been playing for hundreds of simulated seconds and real units are holding real Batch D buffs —
 * so "a unit with no buff draws nothing" measured seven rings that belonged to somebody else, and
 * "Sanctuary grows" read live[0], which was not my probe's ring at all. Every one of those is my
 * test reaching for an absolute in a world that is already full.
 *   Fixed by isolating: every other unit's mask is cleared for the duration of the block and
 * restored afterwards, so the only rings on screen are the ones under test. Same lesson as the
 * frozen-clock and throttle-stamp corrections earlier this session — measure a delta, or clear
 * the state, but never assert an absolute against a world someone else is living in.
 *
 * ── AND THE "NOTHING IS BUILT AT LOAD" GATE CANNOT BE A RUNTIME CHECK AT ALL ────────────────
 * It failed because it was TRUE and then stopped being true: the geometry had already been built,
 * correctly and lazily, by the campaign hundreds of frames earlier. There is no point in the
 * smoketest late enough to place other gates and early enough to observe an unbuilt pool.
 *   So it becomes what it always really was — a claim about the SOURCE:
 *     · _ringGeo is declared null, not initialised to a geometry
 *     · every ring geometry is constructed inside _ringBuild()
 *     · _ringBuild() is called from exactly one place, and that place is buffFxTick
 *   Those three together say "no geometry is minted at load", which is the invariant. The
 *   empirical backstop is `node tools/nodehash.js` — if this were ever violated the world hash
 *   would move, and it has not moved all session.
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

sub("isolate the block and make the load gate static",
'        const S=G.buffFxStats, FX=G.buffFxTick;\n'+
'        // THE SEEDED WINDOW. Seventeen geometries and a material at file scope would each mint a\n'+
'        // uuid — four random draws — inside world gen, and move every tree on the map.\n'+
'        check("v132.39 rings: NOTHING is built at load — the ring geometry is lazy, because a "+\n'+
'          "BufferGeometry minted inside the seeded window costs four random draws and moves the "+\n'+
'          "whole map (invariant #2)",S().built===false);\n'+
'        const R=mkB(0,{}); R._fxMask=0;\n'+
'        FX(0.016);\n'+
'        check("v132.39 rings: …and it builds on FIRST TICK, not never",S().built===true);',
'        const S=G.buffFxStats, FX=G.buffFxTick;\n'+
'        // ⚠ ISOLATE. buffFxStats reports the WHOLE SCENE, and by now the campaign above has real\n'+
'        // units holding real Batch D buffs — so an absolute count here measures somebody else\'s\n'+
'        // rings. Park every other mask, restore at the end.\n'+
'        const _parked=[];\n'+
'        for(const u of G.units)if(u._fxMask){_parked.push([u,u._fxMask]);u._fxMask=0;}\n'+
'        // THE SEEDED WINDOW. This cannot be a runtime check: the geometry was correctly built,\n'+
'        // lazily, hundreds of frames ago, and there is no moment late enough to place a gate and\n'+
'        // early enough to see an unbuilt pool. It is a claim about the SOURCE, so assert that.\n'+
'        {\n'+
'          const src=fs.readFileSync(path.join(ROOT,"js","05-combat.js"),"utf8");\n'+
'          const i=src.indexOf("function _ringBuild(){"), j=src.indexOf("\\n}",i);\n'+
'          const body=(i>=0&&j>i)?src.slice(i,j):"";\n'+
'          const declNull=/let _ringGeo=null/.test(src);\n'+
'          const mkGeo=(src.match(/new THREE\\.RingGeometry\\(0\\.94/g)||[]).length;\n'+
'          const inBuild=(body.match(/new THREE\\.RingGeometry\\(0\\.94/g)||[]).length;\n'+
'          const calls=(src.match(/_ringBuild\\(\\)/g)||[]).length;   // decl + the one call site\n'+
'          const calledFromTick=/function buffFxTick\\(dt\\)\\{[\\s\\S]{0,220}_ringBuild\\(\\)/.test(src);\n'+
'          check("v132.39 rings: NO geometry is minted at LOAD — _ringGeo is declared null, both "+\n'+
'            "ring geometries are built inside _ringBuild() ("+inBuild+" of "+mkGeo+"), and "+\n'+
'            "_ringBuild is called only from buffFxTick. A BufferGeometry constructed inside the "+\n'+
'            "seeded window costs four random draws and moves every tree on the map (invariant #2)",\n'+
'            declNull&&mkGeo===2&&inBuild===2&&calls===2&&calledFromTick);\n'+
'        }\n'+
'        const R=mkB(0,{}); R._fxMask=0;\n'+
'        FX(0.016);\n'+
'        check("v132.39 rings: …and it IS built by the time anything draws",S().built===true);');

sub("restore the parked masks",
'        R.alive=false; R._fxMask=0; FX(0.016);\n'+
'      }',
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
console.log("patched tools/smoketest.js — ring gates isolated");
