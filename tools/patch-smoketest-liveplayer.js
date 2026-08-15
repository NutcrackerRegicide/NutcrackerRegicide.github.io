#!/usr/bin/env node
/* patch-smoketest-liveplayer.js — `G.player` is a ghost, and it made six gates lie.
 *
 * ── THE BUG ─────────────────────────────────────────────────────────────────────────────────
 * The harness exports `player` by VALUE when it builds __G, once, at load. The game reassigns the
 * `player` binding — respawn hands the body back and rebinds it — so from that moment on
 * `G.player` points at an object nothing in the game reads or writes any more.
 *   Writing to it is a silent no-op. My wire gates set `G.player._fxMask` and then asked the real
 * snapshot builder why it had shipped nothing, and the honest answer was: because you configured
 * a corpse. The diagnostic that found it took one run and is kept, because this will happen again.
 *
 * ── THE FIX, AND WHY IT IS A GETTER RATHER THAN A ONE-LINE PATCH ────────────────────────────
 * `getPlayer:()=>player` is evaluated at CALL time, so it can never go stale. The stale-by-value
 * export stays where it is — seven other gates use it and most run before any respawn, so
 * rewriting them all would be churn with its own risk — but anything that needs the live object
 * now has a way to ask for it, and the ring gates use it.
 *
 * ⚠ WORTH KNOWING BEYOND THIS PATCH: any gate reading G.player AFTER the campaign has run is
 * reading that ghost. None of them are currently wrong in a way that matters — they mostly assert
 * on fields the respawn preserves — but it is a live trap and it belongs in the handoff.
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

sub("export a LIVE player getter",
  'RING_MIN,RING_TIGHTEN};";',
  'RING_MIN,RING_TIGHTEN,getPlayer:()=>player};";');

sub("bind the wire gates to the live player",
'          const N=G.NET, mode0=N.mode, P=G.player, m0=P._fxMask, q0=N.lastQ;',
'          // ⚠ getPlayer(), not G.player. The by-value export is a ghost after any respawn — see\n'+
'          // tools/patch-smoketest-liveplayer.js. Writing to the ghost is a silent no-op, which\n'+
'          // is how this block came to ask the real builder why it had shipped nothing.\n'+
'          const N=G.NET, mode0=N.mode, P=G.getPlayer(), m0=P._fxMask, q0=N.lastQ;');

sub("the diagnostic now proves the fix rather than the bug",
'            const LIVE=G.units.find(u=>u.isPlayer);\n'+
'            check("v132.39 ring wire: the harness is holding the LIVE player object (same="+\n'+
'              (LIVE===P)+", alive="+(P&&P.alive)+") — G.player is captured once at export and the "+\n'+
'              "game reassigns `player` on respawn, so a stale one would make every wire assertion "+\n'+
'              "below vacuously false",LIVE===P&&P.alive===true);',
'            const LIVE=G.units.find(u=>u.isPlayer);\n'+
'            check("v132.39 ring wire: the harness holds the LIVE player (same="+(LIVE===P)+\n'+
'              ", alive="+(P&&P.alive)+", stale G.player is a different object: "+\n'+
'              (G.player!==P)+") — the by-value export goes stale the moment the game rebinds "+\n'+
'              "`player` on respawn, and writing to the ghost is a silent no-op that makes every "+\n'+
'              "assertion below vacuously false",LIVE===P&&P.alive===true);');

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — a live player getter, and the ring gates use it");
