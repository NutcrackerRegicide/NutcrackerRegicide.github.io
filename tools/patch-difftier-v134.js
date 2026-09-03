#!/usr/bin/env node
/* patch-difftier-v134.js — v134.7: NORMAL is a door you can open.
 *
 * John: "Was blue on 'normal' difficulty tier? If so can you make this a selectable difficulty
 * tier? Right now the only two choices are easy or hard."
 *
 * He was, and that is the whole point of the question. diffFor() hands "normal" to any team holding
 * a human — so his own bots have been playing at a tier the menu could not select for the enemy,
 * in every game anyone has ever played. AI_DIFF has carried the row since v94; only the two buttons
 * were missing.
 *
 * WHAT EACH TIER COSTS THE ENEMY, from AI_DIFF itself — the think clock is the one that matters,
 * because every band decision, hold posting, tower and yoke runs off it:
 *
 *                think   train   raids            reserve   kills/level   counters your army
 *     easy       2.2s    x1.6    x1.6 rarer,x0.6    x1.5         6              no
 *     normal     1.0s    x1.0    x1.0               x1.0         3              no
 *     hard       0.6s    x0.7    x0.75 more often   x0.8         1              YES
 *
 * ⚠ THE DEFAULT IS STILL EASY, deliberately and not by omission. The AI_DIFF note says why: "a
 * default match should not get harder because a feature landed." Making NORMAL selectable does not
 * change what a first-time player meets; it means John can now play his own bots' tier against him,
 * which is the match he has actually been half-playing all along.
 *
 * The two rows — the solo dial and the host dial — stay mirrored, as they were: one setting, three
 * doors, painted in both places. The picker replaces the two pickPair calls that bound them.
 */
const fs=require("fs"),path=require("path");
const R=path.join(__dirname,"..");
const N=path.join(R,"js","10-net.js"), H=path.join(R,"index.html");
let n=fs.readFileSync(N,"utf8"), h=fs.readFileSync(H,"utf8");
let sw=fs.readFileSync(path.join(R,"sw.js"),"utf8");
let failed=[];
function mk(get,set){return function(name,from,to){
  const s=get(); const c=s.split(from).length-1;
  if(c!==1){failed.push(name+" (matched "+c+" times, need exactly 1)");return;}
  set(s.split(from).join(to));
};}
const subN=mk(()=>n,v=>n=v), subH=mk(()=>h,v=>h=v);

subH("the solo dial gets its middle door",
`    <button class="pick on" id="sdEasy" type="button">🌱 EASY</button>
    <button class="pick" id="sdHard" type="button">🔥 HARD</button>`,
`    <button class="pick on" id="sdEasy" type="button">🌱 EASY</button>
    <button class="pick" id="sdNormal" type="button">⚔ NORMAL</button>
    <button class="pick" id="sdHard" type="button">🔥 HARD</button>`);

subH("…and so does the host dial",
`      <button class="pick on" id="hdEasy" type="button">🌱 EASY</button>
      <button class="pick" id="hdHard" type="button">🔥 HARD</button>`,
`      <button class="pick on" id="hdEasy" type="button">🌱 EASY</button>
      <button class="pick" id="hdNormal" type="button">⚔ NORMAL</button>
      <button class="pick" id="hdHard" type="button">🔥 HARD</button>`);

subN("three doors, painted in both rooms",
`  pickPair("sdEasy","sdHard",v=>{aiDifficulty=v?"easy":"hard";
    // the two dials mirror each other — one setting, two doors
    if(el("hdEasy")&&el("hdHard")){el("hdEasy").classList.toggle("on",v);el("hdHard").classList.toggle("on",!v);}});
  pickPair("hdEasy","hdHard",v=>{aiDifficulty=v?"easy":"hard";
    if(el("sdEasy")&&el("sdHard")){el("sdEasy").classList.toggle("on",v);el("sdHard").classList.toggle("on",!v);}});`,
`  // v134.7 THREE DOORS, NOT TWO — and the pair of dials still mirror each other, one setting shown
  // in both rooms. NORMAL was always in AI_DIFF and was always what a team holding a HUMAN plays at
  // (diffFor), so until now the one tier a player could not choose for the enemy was the tier his
  // own bots were on. Written as one loop over both rows rather than three more pickPair calls:
  // pickPair paints exactly two buttons and a third would leave the odd one lit.
  {
    const TIERS=["easy","normal","hard"];
    const ROWS=[["sdEasy","sdNormal","sdHard"],["hdEasy","hdNormal","hdHard"]];
    const paint=(tier)=>{for(const row of ROWS)for(let i=0;i<row.length;i++){
      const b=el(row[i]); if(b)b.classList.toggle("on",TIERS[i]===tier);}};
    for(const row of ROWS)for(let i=0;i<row.length;i++){
      const b=el(row[i]); if(!b)continue;
      const tier=TIERS[i];
      b.onclick=()=>{aiDifficulty=tier;paint(tier);};
    }
    paint(aiDifficulty);   // …and the lit button is whatever the dial actually says on load
  }`);

// ---------------------------------------------------------------------------
// The version pair. INVARIANT #4 — a smoketest gate enforces it.
// ---------------------------------------------------------------------------
{
  const a1=`const VERSION="v134.6";`, b1=`const VERSION="v134.7";`;
  const a2=`<p class="verstamp">v134.6 — TOWERS ON THE SQUARES</p>`,
        b2=`<p class="verstamp">v134.7 — THE MIDDLE DOOR</p>`;
  if(sw.split(a1).length-1!==1)failed.push("sw.js VERSION (need exactly 1)");
  else sw=sw.split(a1).join(b1);
  if(h.split(a2).length-1!==1)failed.push("index.html verstamp (need exactly 1)");
  else h=h.split(a2).join(b2);
}

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(N,n); fs.writeFileSync(H,h);
fs.writeFileSync(path.join(R,"sw.js"),sw);
console.log("patch-difftier-v134: OK");
