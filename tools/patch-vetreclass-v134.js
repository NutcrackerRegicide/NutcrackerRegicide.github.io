#!/usr/bin/env node
/* patch-vetreclass-v134.js — v134.2b: a villager was walking around carrying blacksmith buffs.
 *
 * Found by the gate that replaced the old human-only loadout assertion, on its first run:
 *
 *   FAIL — v132.40/v134.2 loadouts: every unit carrying buffs passes hasProg (49 holding,
 *          1 of them illegal: villager)
 *
 * THE HOLE. hasProg() answers a question about a unit's CLASS, and a unit's class changes under it.
 * 07-ai.js's levy arms villagers when the Town Center is overwhelmed — `setClass(v,levyCls)` — and
 * stands them down ten quiet seconds later with `setClass(v,"villager")`. In between, the militia
 * fights, kills, and earns. On the way back it kept every piece of it: a farmhand with Honed Edge.
 * The same door is open at 10-net.js:731, where a deserter's ox cart is handed a villager's tools.
 *
 * That is exactly the power the "soldiers only" rule exists to prevent — invisible strength spread
 * across an economy, on bodies nobody is looking at — and it would have shipped, because nothing
 * before this version had any reason to look at a villager's buffs.
 *
 * THE FIX belongs in setClass, which is the one door every re-class passes through, rather than at
 * the two call sites that happen to be visible today. A unit that has just become something
 * hasProg() refuses gives up what only a soldier may hold.
 *
 * ⚠ IT MUST NOT TOUCH A PLAYER. respawnUnit re-classes you to "villager" on every death, and the
 * death wipe in killUnit has already decided what you keep — half your level, as coin. hasProg is
 * TRUE for a player whatever class they are wearing, so the guard reads correctly by construction;
 * this note is here because the next person to edit hasProg needs to know that this line depends on
 * that property of it.
 *
 * Also in here: the two PROTO pins move 46 -> 47. The wire changed (s.bfa rows every holder, s.lv
 * carries veteran levels), and those assertions exist so that a change to the wire cannot be made
 * without saying so out loud.
 */
const fs=require("fs"),path=require("path");
const R=path.join(__dirname,"..");
const FILES={"js/04-units.js":null,"js/05-combat.js":null,"tools/smoketest.js":null};
for(const k in FILES)FILES[k]=fs.readFileSync(path.join(R,k),"utf8");
let failed=[];
function sub(file,name,from,to){
  const n=FILES[file].split(from).length-1;
  if(n!==1){failed.push(file+" · "+name+" (matched "+n+" times, need exactly 1)");return;}
  FILES[file]=FILES[file].split(from).join(to);
}

sub("js/04-units.js","revokeProg, and setClass as its first door",
`function setClass(u,cls){
  u.cls=cls; buildBodyFor(u); setClassStats(u);
  if(cls==="dragoon")u.ammo=6; // a fresh dragoon rides out with a loaded revolver
  u.gathering=null;
  if(u.isPlayer)updatePlayerHud();
}`,
`// ---- v134.2 A CLASS CHANGE CAN REVOKE PROGRESSION ----
// hasProg() asks a question about a unit's CLASS, and a unit's class changes under it. Two doors:
//   · the LEVY (07-ai.js) arms a villager when the Town Center is overwhelmed and stands it down
//     ten quiet seconds later — and in between the militia fights, kills and earns. It used to walk
//     back to the fields still holding the loadout: a farmhand with Honed Edge, which is exactly the
//     invisible power the "soldiers only" rule exists to prevent. (Same door at 10-net.js:731, where
//     a deserter's ox cart is handed a villager's tools.)
//   · RESPAWN. respawnUnit sets u.cls="villager" DIRECTLY rather than through setClass, so a
//     soldier that reached it without passing through killUnit's wipe — anything that clears
//     alive=false by hand, which the harness does in a dozen places and a future feature might —
//     came back a villager with a full loadout intact.
// One function, both doors, because two derivations of the same rule is how they drift apart.
// ⚠ NEVER a player: respawnUnit re-classes YOU to villager on every death and killUnit has already
// decided what you keep — half your level, as coin. hasProg is true for a player whatever class
// they are wearing, so this reads correctly by construction, and that is a property of hasProg
// this function depends on.
function revokeProg(u){
  if(typeof hasProg!=="function"||hasProg(u))return false;
  if(!((u.lvl||0)||(u.xp||0)||(u.buffs&&Object.keys(u.buffs).length)||(u._kills||0)||(u.hpBonus||0)))
    return false;
  u.lvl=0; u.xp=0; u.buffs={}; u._kills=0; u.hpBonus=0;
  u._tmods=null; u._lowLatch=false;      // …and the timed modifiers a soldier was carrying
  if(typeof applyBuffStats==="function")applyBuffStats(u);
  return true;
}
function setClass(u,cls){
  u.cls=cls; buildBodyFor(u); setClassStats(u);
  if(cls==="dragoon")u.ammo=6; // a fresh dragoon rides out with a loaded revolver
  u.gathering=null;
  revokeProg(u);               // v134.2 — see above
  if(u.isPlayer)updatePlayerHud();
}`);

sub("js/05-combat.js","respawn is the other door",
`  u.cls="villager"; buildBodyFor(u); setClassStats(u);
  u.alive=true; u.root.visible=true; u.warned=false;`,
`  u.cls="villager"; buildBodyFor(u); setClassStats(u);
  // v134.2: this sets cls directly rather than calling setClass, so it needs the revocation of its
  // own. A soldier that reached respawn WITHOUT passing through killUnit's wipe — anything that
  // clears alive=false by hand — used to come back a villager holding a veteran's whole loadout.
  if(typeof revokeProg==="function")revokeProg(u);
  u.alive=true; u.root.visible=true; u.warned=false;`);

sub("tools/smoketest.js","PROTO pin (wire)",
`  check("v132.46 wire: PROTO is 46 — the set-piece channel, public timed modifiers, the "+
    "thrown knife and the damage-number message",NET.PROTO===46);`,
`  check("v134.2 wire: PROTO is 47 — the set-piece channel, public timed modifiers, the thrown "+
    "knife, the damage-number message, and now every buff HOLDER in s.bfa plus veteran NPC levels "+
    "in s.lv",NET.PROTO===47);`);

sub("tools/smoketest.js","PROTO pin (ares)",
`  check("v115/v132.46 net: PROTO 46 (the damage number) and \`ares\` still rides both payloads",
    G.NET.PROTO===46&&Array.isArray(w.ares)&&Math.abs(w.ares[0]-42.5)<0.06&&`,
`  check("v115/v134.2 net: PROTO 47 (veteran NPCs on the wire) and \`ares\` still rides both payloads",
    G.NET.PROTO===47&&Array.isArray(w.ares)&&Math.abs(w.ares[0]-42.5)<0.06&&`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
for(const k in FILES)fs.writeFileSync(path.join(R,k),FILES[k]);
console.log("patch-vetreclass-v134: OK — "+Object.keys(FILES).join(", ")+" written");
