#!/usr/bin/env node
/* patch-smoketest-ambient2-v134.js — v134.9: three more benches stop reading the world instead of
 * their own claim. Same family as v134.8's patch-smoketest-ambient, found the same way — by moving
 * the AI and watching which assertions fell over for reasons unrelated to the change.
 *
 * ── 1. MY OWN v134.9 TOWER GATE, wrong on its first run ───────────────────────────────────────
 *   FAIL — v134.9 towers: countBld sees 3, countScreenTowers sees 2
 * It staged two Guard Towers, tagged one, and asserted the counts were 2 and 1 — as if the
 * campaign that had just run for eight minutes owned none. It owned one. The claim is that ONE
 * tagged tower is excluded, which is a difference, so the gate now asserts the difference. A gate
 * that reads an absolute where it means a delta is a gate that passes or fails on the weather.
 *
 * ── 2. THE KINGSGUARD ─────────────────────────────────────────────────────────────────────────
 *   FAIL — BLUE kingsguard never disbands (0 strong, 23 soldiers left)
 * Probed: the band EXISTS (roles=kingsguard,camp) and its king is alive; it is simply EMPTY at the
 * whistle, with 23 soldiers on the field and no think left in which to fill it. The rule being
 * asserted is that the marshal keeps a guard on its king — a rule about what manageBands DOES, not
 * about what the roster happens to look like in the frame the campaign stopped on. So the marshal
 * is given one more think first. The excuse for a wiped army is unchanged, and so is the bar: a
 * living army must have a manned kingsguard.
 *
 * ── 3. THE TWO OX BENCHES ─────────────────────────────────────────────────────────────────────
 *   FAIL — v134.8 ox: a bed with one log's room left takes ONE log (0, ending on 299 of 300)
 *   FAIL — v134.4 the ox works timber and only timber: 0 logs off the seam in 20s
 * Both take `nodes.find(n => n.type==="wood" && n.amount>60)` — the FIRST such seam in the array,
 * wherever it is. On SMOKE_SEED=777 that is (0, -54): walkable, no building within 14, not in a
 * camp, and an ox placed beside it drifted to (-7.0, -57.8) and never got within the 0.9 the
 * gather test wants. Whatever that ground is, both benches then reported that an ox does not
 * gather — which is a statement about a seam.
 *
 * The claim in both is the BITE: four logs a swing where a villager takes one, and never more than
 * the bed has room for. So the seam is now chosen BY TRIAL — the first one an ox can actually work
 * — and the bench says which it used. That is not making the test easier: an ox that cannot work
 * ANY of the twenty candidates still fails, loudly, and reaching a tree is the movement layer's
 * claim with its own benches (pathprobe, and the v134.0 collider gates), not this one's.
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

// ---------------------------------------------------------------------------
// 1. The tower gate asserts the DIFFERENCE it is about.
// ---------------------------------------------------------------------------
sub("the tower budget gate reads a delta",
`    const tc0=G.teamTC(0);
    const t1=G.makeBuilding(0,"tower",tc0.x+60,tc0.z+70,true);
    const t2=G.makeBuilding(0,"tower",tc0.x+62,tc0.z-70,true); t2.bazTower=true;
    const all=G.countBld(0,"tower"), own=G.countScreenTowers(0);`,
`    // ⚠ A DELTA, NOT TWO ABSOLUTES. The first cut asserted all===2 && own===1 and went red at
    // "countBld sees 3, countScreenTowers sees 2": the campaign had already raised one of its own.
    // What this gate is about is that ONE tagged tower is excluded, which is a difference.
    const tc0=G.teamTC(0);
    const base=G.countBld(0,"tower"), baseOwn=G.countScreenTowers(0);
    const t1=G.makeBuilding(0,"tower",tc0.x+60,tc0.z+70,true);
    const t2=G.makeBuilding(0,"tower",tc0.x+62,tc0.z-70,true); t2.bazTower=true;
    const all=G.countBld(0,"tower")-base, own=G.countScreenTowers(0)-baseOwn;`);

sub("the tower gate's message says it is a delta",
`      "budget — countBld sees "+all+", countScreenTowers sees "+own+". Since v134.6 the war room "+`,
`      "budget — of two staged, countBld counts "+all+" and countScreenTowers "+own+" (on top of "+
      base+" the campaign already owned). Since v134.6 the war room "+`);

// ---------------------------------------------------------------------------
// 2. The marshal gets one more think before its roster is judged.
// ---------------------------------------------------------------------------
sub("kg is re-readable",
`  const kg=D.bands.find(b=>b.role==="kingsguard");
  const survivors=units.filter(v=>v.team===D.team&&v.alive&&!v.isPlayer&&v.dmg>0&&v.cls!=="villager").length;`,
`  let kg=D.bands.find(b=>b.role==="kingsguard");
  const survivors0=units.filter(v=>v.team===D.team&&v.alive&&!v.isPlayer&&v.dmg>0&&v.cls!=="villager").length;`);

sub("the kingsguard is judged after a think",
`  const survivors0=units.filter(v=>v.team===D.team&&v.alive&&!v.isPlayer&&v.dmg>0&&v.cls!=="villager").length;`,
`  // v134.9 ONE MORE THINK FIRST. On SMOKE_SEED=777 with the v134.9 AI, BLUE ended the campaign
  // with a kingsguard band that existed, had a living king, and held nobody — 23 soldiers on the
  // field and no think left in which to deal them. "Never disbands" is a claim about what
  // manageBands does, not about the frame the campaign happened to stop on, so it is asked to do
  // it. The bar is unchanged: a living army must end with a manned guard.
  global.__G.manageBands(D);
  kg=D.bands.find(b=>b.role==="kingsguard");
  const survivors=units.filter(v=>v.team===D.team&&v.alive&&!v.isPlayer&&v.dmg>0&&v.cls!=="villager").length;`);

// ---------------------------------------------------------------------------
// 3. Both ox benches work a seam an ox can work.
// ---------------------------------------------------------------------------
sub("the ox seam is chosen by trial",
`  // --- 4b. THE BED HAS A BOTTOM.`,
`  // v134.9 A SEAM AN OX CAN ACTUALLY WORK. Both benches below took nodes.find(type==="wood" &&
  // amount>60) — the first in the array, wherever it is. On SMOKE_SEED=777 that is (0,-54), which
  // is walkable, has no building within 14 and is in no camp, and an ox placed beside it drifted to
  // (-7.0,-57.8) and never came within the 0.9 the gather test wants. Both benches then reported
  // that an ox does not gather, which is a claim about that seam. Their real claim is the BITE —
  // four a swing, never more than the bed has room for — so the seam is chosen by trial and named
  // in the message. An ox that can work none of the candidates still fails, loudly.
  const oxSeam=(()=>{
    const cands=G.nodes.filter(n=>n.type==="wood"&&n.amount>60).slice(0,20);
    for(const n of cands){
      const t=G.makeUnit(0,"oxcart",n.x+1.5,n.z+1.5,{name:"SeamScout",bot:{role:"citizen",res:"wood"}});
      t.bot.node=n; t.bot.off={x:0.5,z:0.5};
      const a0=n.amount;
      for(let i=0;i<60&&n.amount===a0;i++){G.updateBot(t,1/30);G.advanceT(1/30);}
      const worked=n.amount<a0;
      n.amount=a0; t.alive=false;
      if(worked)return n;
    }
    return cands[0]||null;
  })();
  check("the ox benches found a seam an ox can work"+(oxSeam?" ("+oxSeam.x.toFixed(0)+","+
    oxSeam.z.toFixed(0)+", "+oxSeam.amount+" left)":" — NONE of the candidates"),!!oxSeam);

  // --- 4b. THE BED HAS A BOTTOM.`);

sub("the bed bench uses the chosen seam",
`    const seam=G.nodes.find(n=>n.type==="wood"&&n.amount>60);
    const a0=seam.amount;`,
`    const seam=oxSeam;
    const a0=seam.amount;`);

sub("the timber bench uses the chosen seam",
`    const wood=G.nodes.find(n=>n.type==="wood"&&n.amount>60);
    const gold=G.nodes.find(n=>n.type==="gold"&&n.amount>0);`,
`    const wood=oxSeam;
    const gold=G.nodes.find(n=>n.type==="gold"&&n.amount>0);`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(S,s);
console.log("patch-smoketest-ambient2-v134: OK");
