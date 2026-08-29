#!/usr/bin/env node
/* patch-vetdial-v134.js — v134.2c: the rate becomes the difficulty setting, and no single fight
 * can mint a monster.
 *
 * MEASURED FIRST, on a real solo campaign (buildings 23/17, ages 1/2 — not the suite's staged one):
 *
 *              levelled bots     top level     buff stacks across the WHOLE army
 *    8 min       1 of 44             2                       2
 *   20 min      10 of 46             2                      10
 *
 * Ten stacks, one per body, at minute twenty, against a player who could be carrying a dozen on one
 * body. Flavour, not a lever. And the reason is structural rather than a tuning miss: forty-five
 * soldiers SHARE the kills, so hardly anyone reaches three, and death takes back what little they
 * get. "Three is better than one" was a judgement about how the rule sounds; per body it is rare
 * either way.
 *
 * SO THE RATE BECOMES THE DIAL (John's call). AI_DIFF already carries think/eco/raid/train/counter
 * per tier and diffFor() already routes a team to the right one — the veterans join that table
 * rather than getting a switch of their own. EASY is deliberately slower than what was measured
 * above, because `aiDifficulty` defaults to "easy" and the default match should not get harder
 * without anyone asking for it; HARD pays a level a kill, which is where the handoff's "biggest
 * single lever available on AI difficulty" actually lives.
 *
 * ⚠ diffFor(team) returns "normal" for any team holding a HUMAN, so bots fighting alongside you in
 * co-op advance at the normal rate whatever the dial says, exactly as their marshal already thinks
 * at the normal clock. That is the existing rule and this inherits it rather than inventing one.
 *
 * AND A CAP ON ANY ONE EVENT. campPayParticipants pays CAMP_XP_BOSS = 15, as BOTH levels and XP —
 * a human who breaks the Viking raid gets a big moment, and that is intended. Handed to an NPC it
 * minted a clubman at level 15 holding fourteen buff pieces from a single fight (the suite measured
 * exactly that). Bots never attack camps today so it cannot happen yet — v134.3 is the version that
 * teaches them to, and the cap goes in NOW, in npcAdvance, where every faucet present and future
 * has to pass through it. The human payout is untouched.
 */
const fs=require("fs"),path=require("path");
const R=path.join(__dirname,"..");
const FILES={"js/00-data.js":null,"js/05-combat.js":null,"js/09-main.js":null};
for(const k in FILES)FILES[k]=fs.readFileSync(path.join(R,k),"utf8");
let failed=[];
function sub(file,name,from,to){
  const n=FILES[file].split(from).length-1;
  if(n!==1){failed.push(file+" · "+name+" (matched "+n+" times, need exactly 1)");return;}
  FILES[file]=FILES[file].split(from).join(to);
}

sub("js/00-data.js","the event cap",
`// John: "a bot gains a level per every 3 soldier enemies killed, not one. One is too frequent."
const NPC_KILLS_PER_LVL=3;`,
`// John: "a bot gains a level per every 3 soldier enemies killed, not one. One is too frequent."
// The per-tier rates live in AI_DIFF.vetKills below; this is the fallback for a team with no
// director and the number the whole feature was measured at.
const NPC_KILLS_PER_LVL=3;
// …AND NO SINGLE FIGHT MINTS A MONSTER. campPayParticipants pays CAMP_XP_BOSS = 15 as both levels
// and XP, which is a fine moment for a player and absurd for an NPC: measured, a clubman that
// helped break the Viking raid came out at level 15 holding fourteen buff pieces. Bots do not fight
// camps yet — v134.3 is the version that teaches them — so this goes in before the faucet opens,
// in npcAdvance, where every present and future source has to pass through it. Humans are unaffected.
const NPC_EVENT_CAP=3;`);

sub("js/00-data.js","vetKills per tier",
`  easy:  {name:"Easy",  think:2.2, eco:1.0, raidMul:1.6,  raidFracMul:0.6, trainMul:1.6, buf:1.5, counter:false},
  normal:{name:"Normal",think:1.0, eco:1.0, raidMul:1.0,  raidFracMul:1.0, trainMul:1.0, buf:1.0, counter:false},
  hard:  {name:"Hard",  think:0.6, eco:1.2, raidMul:0.75, raidFracMul:1.1, trainMul:0.7, buf:0.8, counter:true}`,
`  // v134.2 vetKills: enemy soldiers a bot must kill for a level — and a level is one blacksmith
  // piece, because levels themselves multiply nothing. This is the veterans' whole dial.
  //
  // MEASURED, red army at twenty minutes, four seeds a tier, as buff stacks held across the army:
  //     4 kills:  2 · 1 · 15 · 7   = 25       (top level seen: 2)
  //     3 kills:  3 · 0 · 21 · 4   = 28       (top level seen: 3)
  //     1 kill :  4 · 3 · 34 · 16  = 57       (top level seen: 7)
  // The variance between seeds dwarfs the tier, because whether a war really joins decides almost
  // everything — but the shape is clear, and so is the finding that 4 and 3 were INDISTINGUISHABLE.
  // A dial whose first two settings measure the same is not a dial, so the ladder is 6 : 3 : 1.
  // EASY is deliberately the slowest: aiDifficulty defaults to "easy", and a default match should
  // not get harder because a feature landed — it is still strictly more than v133's nothing.
  easy:  {name:"Easy",  think:2.2, eco:1.0, raidMul:1.6,  raidFracMul:0.6, trainMul:1.6, buf:1.5, counter:false, vetKills:6},
  normal:{name:"Normal",think:1.0, eco:1.0, raidMul:1.0,  raidFracMul:1.0, trainMul:1.0, buf:1.0, counter:false, vetKills:3},
  hard:  {name:"Hard",  think:0.6, eco:1.2, raidMul:0.75, raidFracMul:1.1, trainMul:0.7, buf:0.8, counter:true,  vetKills:1}`);

sub("js/09-main.js","npcAdvance clamps any one event",
`function npcAdvance(u,n){
  const lv0=u.lvl||0;
  u.lvl=Math.min(XP_MAX_LVL,lv0+n);`,
`function npcAdvance(u,n){
  // v134.2 NO SINGLE EVENT MINTS A MONSTER — see NPC_EVENT_CAP. The clamp is HERE and not at the
  // call sites so that a faucet added later cannot forget it: the Viking raid pays 15, and one
  // fight is not allowed to be worth five careers.
  n=Math.min(n,NPC_EVENT_CAP);
  const lv0=u.lvl||0;
  u.lvl=Math.min(XP_MAX_LVL,lv0+n);`);

sub("js/05-combat.js","the kill rate reads the team's difficulty",
`      attU._kills=(attU._kills||0)+1;
      if(attU._kills>=NPC_KILLS_PER_LVL){attU._kills=0;npcAdvance(attU,1);}`,
`      // v134.2 the rate is the DIFFICULTY DIAL. diffFor() is the same routing the marshal's think
      // clock and train tempo already use, so a team holding a human advances at "normal" whatever
      // the solo dial says — the existing rule, inherited rather than reinvented.
      const _dt=(typeof diffFor==="function"&&typeof AI_DIFF!=="undefined")
        ?(AI_DIFF[diffFor(attU.team)]||AI_DIFF.normal):null;
      const _need=(_dt&&_dt.vetKills)||NPC_KILLS_PER_LVL;
      attU._kills=(attU._kills||0)+1;
      if(attU._kills>=_need){attU._kills=0;npcAdvance(attU,1);}`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
for(const k in FILES)fs.writeFileSync(path.join(R,k),FILES[k]);
console.log("patch-vetdial-v134: OK — "+Object.keys(FILES).join(", ")+" written");
