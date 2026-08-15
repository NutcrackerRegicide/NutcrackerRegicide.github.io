#!/usr/bin/env node
/* patch-smoketest-buffs-public.js — gate what a guest knows about everyone else.
 *
 * ── THE CLAIM ───────────────────────────────────────────────────────────────────────────────
 * Before v132.40 a client knew its own sixty-buff loadout and nothing about anybody else's. The
 * assertions below are that this is no longer true, and they are written against the REAL
 * snapshot builder and the REAL applySnap, because the failure mode is a field that is built but
 * never applied — or applied to the wrong unit — and either reads as "the feature works" from the
 * host's chair.
 *
 * ── THE THREE THAT MATTER ───────────────────────────────────────────────────────────────────
 *   ROUND TRIP     a loadout set on the host arrives, on the right unit, with the right STACKS.
 *                  Stacks are the part an index-packing bug would silently drop: [idx,stacks]
 *                  pairs mis-strided by one give plausible-looking buffs at wrong counts.
 *   COMPLETENESS   a player holding NOTHING is still listed. A sparse list cannot express "this
 *                  one has none", and the guest below depends on that to clear a deserter's.
 *   THE CLEAR      a unit carrying buffs that a complete list does not mention has lost them.
 *                  Without it, a player who leaves keeps their loadout on every guest's
 *                  scoreboard for the rest of the match.
 *
 * ⚠ Bots are not a gap. useBlacksmith and smithPick are reachable only for the local player and
 * for a remote's unit, so isHuman is the complete set of possible holders, not a subset chosen
 * for convenience — and that is asserted rather than assumed.
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

sub("PROTO 42 (the wire gate)",
  'check("v132.39 wire: PROTO is 41 — the aura-ring rows (s.ar) are new snapshot vocabulary",\n'+
  '    NET.PROTO===41);',
  'check("v132.40 wire: PROTO is 42 — public buff rows (s.bfa), so a client knows every player\'s "+\n'+
  '    "loadout and not only its own",NET.PROTO===42);');
sub("PROTO 42 (the payload gate)","G.NET.PROTO===41&&Array.isArray(w.ares)","G.NET.PROTO===42&&Array.isArray(w.ares)");
sub("PROTO 42 (the payload label)",
  '"v115/v132.39 net: PROTO 41 (the aura rings) and `ares` still rides both payloads"',
  '"v115/v132.40 net: PROTO 42 (public loadouts) and `ares` still rides both payloads"');

// ⚠ SIX spaces, not eight. The anchor sits one nesting level out from the ring gates above it,
// and the exactly-once rule caught the mismatch rather than writing a mangled file.
sub("public loadout gates",
'      // ---- v132.37: WHO HEARS THEM — the relay, and the dedicated-server shape ----',
'      // ---- v132.40: WHAT EVERY PLAYER IS CARRYING ----\n'+
'      {\n'+
'        const N=G.NET, mode0=N.mode, P=G.getPlayer(), q0=N.lastQ, b0=P.buffs;\n'+
'        try{\n'+
'          N.mode="host";\n'+
'          // only humans can hold one — assert that rather than assuming it\n'+
'          const holders=G.units.filter(u=>u.buffs&&Object.keys(u.buffs).length);\n'+
'          const nonHuman=holders.filter(u=>!G.isHuman(u));\n'+
'          check("v132.40 loadouts: every unit carrying buffs is a HUMAN — useBlacksmith and "+\n'+
'            "smithPick are reachable only for the local player and a remote\'s unit, so isHuman "+\n'+
'            "is the complete set of holders, not a convenient subset ("+holders.length+" holding, "+\n'+
'            nonHuman.length+" of them bots)",nonHuman.length===0);\n'+
'          // a full snapshot carries the loadout, with STACKS\n'+
'          P.buffs={dmg:3,hp:5,sanctuary:1};\n'+
'          let full=null;\n'+
'          for(let i=0;i<16&&!full;i++){const sn=N.packSnap(); if(sn.bfa)full=sn;}\n'+
'          const row=full?(full.bfa||[]).find(r=>r[0]===P.id):null;\n'+
'          check("v132.40 loadouts: a FULL snapshot carries every player\'s loadout, indexed into "+\n'+
'            "BUFFS ("+(row?JSON.stringify(row[1]):"no row")+")",\n'+
'            !!row&&row[1].length===6);\n'+
'          // …and it round-trips onto the right unit WITH the stacks\n'+
'          P.buffs={};\n'+
'          N.mode="guest";\n'+
'          if(full){\n'+
'            full.q=N.lastQ+1; N.applySnap(full);\n'+
'            const b=P.buffs||{};\n'+
'            check("v132.40 loadouts: …and a GUEST rebuilds it on the right unit with the right "+\n'+
'              "STACKS — a mis-strided [idx,stacks] pairing gives plausible buffs at wrong counts, "+\n'+
'              "which is the bug that would never look like one ("+JSON.stringify(b)+")",\n'+
'              b.dmg===3&&b.hp===5&&b.sanctuary===1);\n'+
'          }\n'+
'          // COMPLETENESS: a player holding nothing is still listed, and that is what lets the\n'+
'          // guest clear a deserter\n'+
'          N.mode="host"; P.buffs={};\n'+
'          let full2=null;\n'+
'          for(let i=0;i<16&&!full2;i++){const sn=N.packSnap(); if(sn.bfa)full2=sn;}\n'+
'          const row2=full2?(full2.bfa||[]).find(r=>r[0]===P.id):null;\n'+
'          check("v132.40 loadouts: a player holding NOTHING is still listed — a sparse list "+\n'+
'            "cannot say \'this one has none\', which is how a deserter\'s loadout would stay on "+\n'+
'            "every guest\'s scoreboard for the rest of the match ("+\n'+
'            (row2?"listed, "+row2[1].length+" entries":"MISSING")+")",\n'+
'            !!row2&&row2[1].length===0);\n'+
'          // THE CLEAR: a unit carrying buffs but absent from a complete list has lost them\n'+
'          N.mode="guest";\n'+
'          const ghost=G.units.find(u=>u.alive&&!u.isPlayer&&!u.remote);\n'+
'          if(ghost&&full2){\n'+
'            ghost.buffs={dmg:2};\n'+
'            full2.q=N.lastQ+1; N.applySnap(full2);\n'+
'            check("v132.40 loadouts: a unit carrying buffs the complete list never mentions has "+\n'+
'              "LOST them — this is the deserter case, and the body really does go back to the AI "+\n'+
'              "with its loadout wiped ("+JSON.stringify(ghost.buffs)+")",\n'+
'              !ghost.buffs||Object.keys(ghost.buffs).length===0);\n'+
'          }\n'+
'        }finally{ N.mode=mode0; P.buffs=b0; N.lastQ=q0; }\n'+
'      }\n'+
'      // ---- v132.37: WHO HEARS THEM — the relay, and the dedicated-server shape ----');

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — the public loadout gates");
