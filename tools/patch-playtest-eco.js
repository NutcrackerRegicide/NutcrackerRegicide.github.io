#!/usr/bin/env node
/* patch-playtest-eco.js — v132.47: John's playtest, item 3. The passive income.
 *
 * ── WHAT IT WAS ─────────────────────────────────────────────────────────────────────────────
 *     const r=(teamAge[t]+1)*step*ecoMul[t];
 *     stock[t].food+=r; stock[t].gold+=r; stock[t].stone+=r; stock[t].wood+=r;
 * Every age granted +1/sec of ALL FOUR resources: 1 each in the Stone Age, rising to 6 each in
 * Enlightenment. Twenty-four resources a second at the top, before a single villager has swung a
 * tool — and that stacks on the bazaar trickle added in v132.27. John: "too much".
 *
 * ── WHAT IT IS NOW ──────────────────────────────────────────────────────────────────────────
 * Nothing, at every age but the last. Reaching ENLIGHTENMENT grants 1 food, 1 wood and 1 gold a
 * second — his words, and note what is NOT in that list: STONE. The old trickle fed all four; the
 * new one deliberately does not, so late-game stone stays something you go and mine.
 *
 * ⚠ THE AI HANDICAP STILL APPLIES. ecoMul is the classic RTS difficulty multiplier — a pure-AI
 * team on HARD runs its economy 20% hot — and dropping it here would have quietly nerfed HARD
 * along with the trickle. It rides the Enlightenment grant exactly as it rode the old one.
 *
 * ⚠ AND FARMS ARE UNTOUCHED. FARM_PASSIVE is a separate line about a building you had to build
 * and place beside a Town Center; it was never part of the age trickle and is not what was too
 * much.
 */
const fs=require("fs"),path=require("path");
const F=path.join(__dirname,"..","js","09-main.js");
let s=fs.readFileSync(F,"utf8");
let failed=[];
function sub(name,from,to){
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
}

sub("the header no longer promises a per-age trickle",
`// team economy trickle: each age grants +1/sec of EVERY resource (Stone=1 … Enlightenment=6),
// plus 0.5 food/sec from every standing farm — worked farms add gathering on top`,
`// team economy trickle. v132.47 (John, playtesting): "the passive resources from age up combined
// with the passive resources from the bazaars is too much. lets remove the passive resources from
// aging up… Except if a team reaches enlightenment age they gain 1 food, wood, and gold per
// second." So: nothing at all until the last age, then one each of three — and NOT stone, which
// stays something you go and mine. Farms are a separate line and are untouched.`);

sub("no trickle until Enlightenment",
`  for(const t of [BLUE,RED]){
    const r=(teamAge[t]+1)*step*ecoMul[t];
    stock[t].food+=r; stock[t].gold+=r; stock[t].stone+=r; stock[t].wood+=r;
  }`,
`  for(const t of [BLUE,RED]){
    // v132.47: ONLY at Enlightenment, and only three of the four. The old line paid
    // (teamAge+1) of every resource at every age — twenty-four a second at the top, on top of the
    // bazaars. ecoMul stays: it is the difficulty handicap, not part of what was too generous.
    if(teamAge[t]>=ENLIGHTENMENT_AGE){
      const r=ENLIGHTEN_TRICKLE*step*ecoMul[t];
      stock[t].food+=r; stock[t].gold+=r; stock[t].wood+=r;   // …and no stone, deliberately
    }
  }`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched js/09-main.js — the age trickle is gone but for Enlightenment");
