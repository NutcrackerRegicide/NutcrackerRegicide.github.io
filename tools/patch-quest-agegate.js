#!/usr/bin/env node
/* patch-quest-agegate.js — v132.28 spine, layer 2: the board deals only what your age allows.
 *
 * questDraft (09-main.js:389) rolled from the WHOLE table, so the Stone Age could post
 * "Build a Castle" — an objective the player cannot begin for two ages. Every quest now
 * carries `age` (layer 1); filter on it.
 *
 * Two details worth stating, because both are load-bearing:
 *
 *  1. `teamAge` is an ARRAY, not a function — `const teamAge=[0,0,0]` at 00-data.js:751,
 *     index [2] being the ageless wilds. Reading it as teamAge(team) would silently throw
 *     inside a host tick.
 *
 *  2. The cache guard was `u.questDraft.length===3`. With a filtered bag that is a live bug:
 *     the moment fewer than three quests are available the trio can only ever be short, the
 *     guard never matches, and questDraft RE-ROLLS THE BOARD ON EVERY CALL — the posting would
 *     change under the player between frames, and the "trio stands until you choose" contract
 *     (v99) breaks. Guard on non-empty instead. The age-0 pool is 18, so a short board is not
 *     reachable today; it becomes reachable the moment anyone raises a quest's age, which is
 *     exactly the kind of delayed trap this codebase has paid for before.
 *
 * The standing trio deliberately survives an age-up: you drew it fairly, it stands until taken.
 * No wire change — the draft is already shipped as three indices in `qdraft`.
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

sub("questDraft age filter",
`function questDraft(u){ // roll, or recall, the standing trio
  if(u.questDraft&&u.questDraft.length===3)return u.questDraft;
  const bag=QUESTS.map((q,i)=>i), picks=[];
  while(picks.length<3&&bag.length)picks.push(bag.splice((Math.random()*bag.length)|0,1)[0]);
  u.questDraft=picks;
  return picks;
}`,
`function questDraft(u){ // roll, or recall, the standing trio
  // v132.28: guard on NON-EMPTY, not on ===3. Once the bag is age-filtered a short board is
  // possible, and a ===3 guard would re-roll the trio on every call — the posting would shift
  // under the player and the v99 "the trio STANDS until you choose" contract would be gone.
  if(u.questDraft&&u.questDraft.length)return u.questDraft;
  // v132.28: deal only what this team's age has unlocked. teamAge is an ARRAY (00-data.js:751).
  const age=Math.max(0,Math.min(5,(typeof teamAge!=="undefined"&&teamAge[u.team])||0));
  let bag=[];
  for(let i=0;i<QUESTS.length;i++)if((QUESTS[i].age||0)<=age)bag.push(i);
  if(!bag.length)for(let i=0;i<QUESTS.length;i++)bag.push(i); // never hand back an empty board
  const picks=[];
  while(picks.length<3&&bag.length)picks.push(bag.splice((Math.random()*bag.length)|0,1)[0]);
  u.questDraft=picks;
  return picks;
}`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched js/09-main.js — questDraft is age-gated");
