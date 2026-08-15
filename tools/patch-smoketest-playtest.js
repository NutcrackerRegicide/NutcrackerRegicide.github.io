#!/usr/bin/env node
/* patch-smoketest-playtest.js — the v132.47 gates, and one gate that was green while the game was broken.
 *
 * ══ THE SANCTUARY GATE WAS TESTING THE FLAG, NOT THE BEHAVIOUR ══════════════════════════════
 * "v132.35 SANCTUARY: no zone while you are MOVING" has been GREEN since v132.35, and the zone has
 * been healing people at a dead run that entire time. The gate set `heal.moving=true` and called
 * auraBuffTick directly — and in that arrangement the flag survives, because nothing consumed it.
 * In the real frame, animateUnit clears u.moving on its first line and runs BEFORE statusTick, so
 * the live code always read false.
 *   The harness proved the mechanism worked when driven by hand and said nothing about whether it
 * worked when driven by the game. That is the same error as "drove tmodTick directly instead of
 * through guestFrame", which cost a vacuous gate earlier this session, and it is why John found
 * this by walking around rather than the suite finding it by running.
 *   It now MOVES THE UNIT. Position is what the fixed code reads, position is what a player
 * changes by pressing W, and no frame ordering can consume it.
 *
 * ══ AND THE TWO ECONOMY GATES ENCODED THE OLD TRICKLE ═══════════════════════════════════════
 * Both wanted (teamAge+1) + farms. The age term is gone below Enlightenment, so both are rewritten
 * against the new rule — and split, so the farm assertion measures farms and the age assertion
 * measures the age. Their previous shape summed two systems into one number, which is why a change
 * to one of them reddened an assertion named after the other.
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

sub("the farm gate measures FARMS",
`  const gained=stock[0].food-f0, want=(teamAge[0]+1)+(2/3)*farms0;
  check("v113 farm passive = 2 food / 3s: +"+gained.toFixed(2)+" food/s, "+farms0+" farms (want "+want.toFixed(2)+")",
    farms0>=1&&Math.abs(gained-want)<1e-6);`,
`  // v132.47: the age trickle is gone below Enlightenment, so this is farms ALONE — which is what
  // an assertion named "farm passive" should always have measured. Summing two systems into one
  // number is why a change to the economy reddened a gate named after farms.
  const age0=(teamAge[0]>=G_ENL)?1:0;
  const gained=stock[0].food-f0, want=age0+(2/3)*farms0;
  check("v113 farm passive = 2 food / 3s: +"+gained.toFixed(2)+" food/s from "+farms0+
    " farms (want "+want.toFixed(2)+(age0?", incl. the Enlightenment 1/s":", no age trickle below "+
    "Enlightenment")+")",farms0>=1&&Math.abs(gained-want)<1e-6);
  check("v132.47 economy: aging up pays NOTHING below Enlightenment — it used to pay (age+1) of "+
    "every resource a second, stacking on the bazaars. John: \\"too much\\" (team age "+teamAge[0]+
    ", age term "+age0+")",teamAge[0]>=G_ENL?age0===1:age0===0);`);

sub("the age constant for the harness",
`{
  const {economyTick}=global.__G;
  global.__G.makeBuilding(0,"farm",120,40,true); // guarantee BLUE owns at least one farm`,
`const G_ENL=global.__G.ENLIGHTENMENT_AGE;
{
  const {economyTick}=global.__G;
  global.__G.makeBuilding(0,"farm",120,40,true); // guarantee BLUE owns at least one farm`);

sub("the difficulty gate",
`  const rWant=((teamAge[1]+1)+(2/3)*rF)*1.2, bWant=(teamAge[0]+1)+(2/3)*bF; // v113 FARM_PASSIVE`,
`  // v132.47: the age term is gone below Enlightenment. ecoMul is UNTOUCHED — it is the difficulty
  // handicap, not part of what was too generous — so this still measures exactly what it names.
  const _a=(t)=>(teamAge[t]>=G_ENL)?1:0;
  const rWant=(_a(1)+(2/3)*rF)*1.2, bWant=_a(0)+(2/3)*bF;`);

sub("SANCTUARY: move the unit, do not set a flag",
`        heal.moving=true; scan(heal,4);
        check("v132.35 SANCTUARY: no zone while you are MOVING ("+f0.toFixed(1)+" → "+
          friend.hp.toFixed(1)+")",Math.abs(friend.hp-f0)<1e-9);
        heal.moving=false; scan(heal,2);            // still under the 3s clock`,
`        // ⚠ v132.47: MOVE IT, do not set a flag. This gate was green from v132.35 while the zone
        // healed people at a dead run, because it set heal.moving=true and drove auraBuffTick by
        // hand — and in that arrangement the flag survives. In the real frame animateUnit consumes
        // u.moving before statusTick ever reads it, so the live code always saw false. The harness
        // proved the mechanism worked when driven by hand and said nothing about the game.
        // John found it by walking. Position is what the fixed code reads and what a player
        // changes by pressing W, and nothing in the frame can consume it.
        for(let i=0;i<80;i++){heal.root.position.x+=0.08; G.auraBuffTick(heal,0.05);}
        check("v132.35/47 SANCTUARY: no zone while you are actually MOVING — measured by position, "+
          "because u.moving is consumed by animateUnit before this ever runs ("+f0.toFixed(1)+" → "+
          friend.hp.toFixed(1)+")",Math.abs(friend.hp-f0)<1e-9);
        scan(heal,2);                               // standing still now, still under the 3s clock`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — the v132.47 gates");
