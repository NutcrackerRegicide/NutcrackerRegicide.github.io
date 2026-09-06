#!/usr/bin/env node
/* patch-smoketest-kgcount-v134.js — v134.10: the kingsguard bench counts soldiers the marshal can
 * actually deal.
 *
 *   SMOKE_SEED=42
 *   FAIL — BLUE kingsguard never disbands (0 strong, 4 soldiers left)
 *
 * Probed, after the think v134.9 gave it:
 *
 *   [kg3] BLUE survivors 4 -> clubman/nobot/remote  clubman/nobot/remote  clubman/nobot
 *                             scout/nobot/remote    | bands kingsguard:0
 *
 * All four are BOTLESS, three of them remote. manageBands builds its roster from
 *
 *     if(!v.alive || v.team!==team || !v.bot || v.isKing || v.remote) continue;
 *     if(isWorker(v) || CLS[v.cls].line==="healer") continue;
 *
 * so none of them is dealable and the guard is correctly empty — BLUE has no soldiers left in the
 * sense the rule is about. The bench counted `v.dmg>0 && v.cls!=="villager"`, which sweeps up
 * remote bodies and staged botless ones left standing by earlier benches, and then reported the
 * marshal at fault for not garrisoning them.
 *
 * The excuse clause is the only thing that changes, and it changes to the roster's OWN predicate.
 * A living, dealable army must still end with a manned kingsguard; that bar is untouched. What is
 * fixed is the definition of "living army", which was one the code under test does not share.
 *
 * ⚠ This is the third pass over this one bench in two versions — v134.9 gave it a think, and now
 * its arithmetic. Both were the same mistake in different clothes: asking the world a question in
 * terms manageBands does not use.
 */
const fs=require("fs"),path=require("path");
const R=path.join(__dirname,"..");
const S=path.join(R,"tools","smoketest.js");
let s=fs.readFileSync(S,"utf8");
let failed=[];
const sub=(name,from,to)=>{
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
};

sub("survivors are counted the way the roster counts them",
`  const survivors=units.filter(v=>v.team===D.team&&v.alive&&!v.isPlayer&&v.dmg>0&&v.cls!=="villager").length;`,
`  // v134.10 THE ROSTER'S OWN PREDICATE, not a lookalike. This counted dmg>0 && cls!=="villager",
  // which includes REMOTE bodies and staged botless ones that manageBands skips by construction —
  // so on SMOKE_SEED=42 it read "4 soldiers left" for a BLUE whose four survivors were all
  // botless, three of them remote, and called a correctly empty guard a disbanded one. The bar is
  // unchanged: an army the marshal can deal must end with a manned kingsguard.
  const survivors=units.filter(v=>v.team===D.team&&v.alive&&!v.isPlayer&&v.bot&&!v.remote&&
    !v.isKing&&!global.__G.isWorker(v)&&global.__G.CLS[v.cls].line!=="healer"&&
    v.dmg>0&&v.cls!=="villager").length;`);

sub("…and the message says which population it is",
`  check(who+" kingsguard never disbands ("+(kg?kg.members.length:0)+" strong, "+survivors+" soldiers left)",`,
`  check(who+" kingsguard never disbands ("+(kg?kg.members.length:0)+" strong, "+survivors+
    " DEALABLE soldiers left — botless and remote bodies are not the band system's to garrison)",`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(S,s);
console.log("patch-smoketest-kgcount-v134: OK");
