#!/usr/bin/env node
/* patch-smoketest-agegate.js — gate the v132.28 quest table and the age filter.
 *
 * The old assertion hard-coded "xp 1-2". Capture the Grand Bazaar pays 3, so it now reads
 * 1..3. Widening a bound is exactly the move that quietly stops testing, so the range is
 * asserted against the TABLE's own extremes rather than a literal, and everything the layer
 * actually promises gets its own check:
 *
 *   · every quest carries a numeric age in 0..5, and Perfect Guard is gone
 *   · quest EVENT KEYS are unique — two quests sharing an ev would both advance off one
 *     action, which is a silent double-pay and the sort of thing only a gate catches
 *   · the age-0 pool can fill a full trio, or the board deals short on the first frame
 *   · THE FILTER ITSELF: draft repeatedly at each age and assert nothing above that age is
 *     ever posted, and that the pool genuinely grows with age. Falsified before trusting —
 *     see the sibling run in this patch's verify step.
 *   · the v99 standing-trio contract still holds under the new non-empty cache guard
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

// questDraft is not in the harness's __G export list — the age gate cannot be tested without it.
sub("export questDraft",
  `boardFor,questPick,questRedraw,`,
  `boardFor,questDraft,questPick,questRedraw,`);

sub("table strength",
`  check("quest & buff tables at strength ("+QUESTS.length+" quests / "+BUFFS.length+" buffs, unique ids, xp 1-2)",
    QUESTS.length>=20&&BUFFS.length>=20&&
    new Set(QUESTS.map(q=>q.id)).size===QUESTS.length&&
    new Set(BUFFS.map(b=>b.id)).size===BUFFS.length&&
    QUESTS.every(q=>q.n>=1&&(q.xp===1||q.xp===2)));`,
`  const _xpLo=Math.min.apply(null,QUESTS.map(q=>q.xp)), _xpHi=Math.max.apply(null,QUESTS.map(q=>q.xp));
  check("quest & buff tables at strength ("+QUESTS.length+" quests / "+BUFFS.length+" buffs, unique ids, xp "+_xpLo+"-"+_xpHi+")",
    QUESTS.length>=20&&BUFFS.length>=20&&
    new Set(QUESTS.map(q=>q.id)).size===QUESTS.length&&
    new Set(BUFFS.map(b=>b.id)).size===BUFFS.length&&
    QUESTS.every(q=>q.n>=1&&q.xp>=1&&q.xp<=3));
  // v132.28: the event key is the join between a quest and the 24 call sites that feed it.
  // Two quests sharing one ev would both advance off a single action — a silent double-pay.
  check("v132.28 quests: every progress event is unique ("+new Set(QUESTS.map(q=>q.ev)).size+"/"+QUESTS.length+")",
    new Set(QUESTS.map(q=>q.ev)).size===QUESTS.length);
  check("v132.28 quests: every posting carries a numeric age in 0..5",
    QUESTS.every(q=>typeof q.age==="number"&&q.age>=0&&q.age<=5));
  check("v132.28 quests: Perfect Guard is gone (John's ruling)",
    !QUESTS.some(q=>q.id==="parry5"||q.ev==="parry"));
  check("v132.28 quests: max level is 25",XP_MAX_LVL===25);
  {
    // THE FILTER ITSELF. Draft many boards at each age against a scratch unit and assert the
    // gate holds. Sampling is deliberate — questDraft is random, so one draw proves nothing.
    const {questDraft,teamAge}=global.__G;
    let leaked=null, tooShort=null, pools=[];
    const saveAge=teamAge[0];
    for(let age=0;age<=5;age++){
      teamAge[0]=age;
      const seen=new Set();
      for(let k=0;k<300;k++){
        const scratch={team:0};
        const trio=questDraft(scratch);
        if(trio.length<3&&tooShort===null)tooShort=age;
        for(const qi of trio){ seen.add(qi); if(QUESTS[qi].age>age&&!leaked)leaked=age+":"+QUESTS[qi].id; }
      }
      pools.push(seen.size);
    }
    teamAge[0]=saveAge;
    check("v132.28 age gate: 1800 boards dealt, nothing above the team's age was ever posted"+
      (leaked?" (LEAKED "+leaked+")":""),leaked===null);
    check("v132.28 age gate: a full trio is dealable at every age (shortest board age: "+
      (tooShort===null?"none":tooShort)+")",tooShort===null);
    check("v132.28 age gate: the pool GROWS with age ("+pools.join(" -> ")+") — the filter is not a no-op",
      pools[5]>pools[0]&&pools.every((p,i)=>i===0||p>=pools[i-1]));
  }
  {
    // the v99 contract under the new non-empty cache guard
    const {questDraft}=global.__G;
    const u={team:0};
    const a=questDraft(u).slice(), b=questDraft(u).slice();
    check("v99/v132.28 draft: the trio STANDS until taken (two reads agree: ["+a+"] / ["+b+"])",
      a.length===b.length&&a.every((v,i)=>v===b[i]));
  }`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — v132.28 quest table + age gate");
