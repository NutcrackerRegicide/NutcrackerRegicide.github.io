#!/usr/bin/env node
/* patch-oxcart-v134.js — v134.4: the AI yokes the ox, and "villager" stops meaning "civilian".
 *
 * THE OX CART HAS BEEN IN THE GAME SINCE v99 AND NO AI HAS EVER DRIVEN ONE. The wiring reads like
 * it should work — TRAIN_BUILDINGS lists "storage_pit" with the comment "v99: pits train the Ox
 * Cart" — but linesAt("storage_pit") returns [] because there is no LINES entry for it, so the
 * training pool it feeds never had an ox to draw. 10-net.js:736 even says the quiet part out loud:
 * when a human drops, "the AI can't drive an ox — hand it a villager's tools".
 *
 * ⚠ AND IT IS NOT A LINES ENTRY NOW EITHER. LINES also builds the PLAYER's train menu, which
 * already hardcodes the ox at a pit — an entry there would list it twice and tie the marshal's
 * decision to a random draw from the soldier pool. The Market decides its trade carts with its own
 * rule, its own cap and its own clock; the pit decides its oxen the same way.
 *
 * WHAT THE OX BUYS, from the numbers already in the game: a bot villager takes ONE log per 0.75s
 * and walks home with 20. The ox takes FOUR per swing (carryCap 300, the same four the human ox
 * gets in 09-main.js and driveRemote) — four times the axe and a fifteenth of the walking. It costs
 * 75 food, 75 gold and a body out of the very pool that arms up, so the cap is low (OX_MAX) and the
 * villager floor is high (OX_MIN_VILLS), and it only yokes one when TIMBER IS WHAT IT IS SHORT OF.
 *
 * ------------------------------------------------------------------------------------------------
 * THE HALF OF THIS THAT IS NOT A FEATURE: `isWorker`.
 *
 * Everywhere in 07-ai.js that means "a soldier" is spelled `cls!=="villager"`, and that was exact
 * until v99 put three civilian classes in the trade line. Yoke an ox under those rules and:
 *   · manageBands would deal it into a mission band and march it at the enemy king (the roster
 *     filter excludes villagers, carts by ROLE, and healers — an ox is none of those);
 *   · it would count toward raid-wave strength and toward CAMP_MIN_MIL, so the marshal would send
 *     an army it does not have into the wilds;
 *   · hasProg would let it earn VETERAN LEVELS and blacksmith buffs off camp participation;
 *   · killing one would pay the killer veteran progress, like killing a soldier;
 *   · counterWeights would count it as an enemy unit to build a counter for.
 * This is the same shape as v134.2's isHuman/hasProg split: one honest predicate, applied at every
 * site that meant the thing rather than the shorthand. A trade cart has silently had four of these
 * five bugs since v99 — it is only the ox, which is common and works in the open, that makes them
 * matter.
 *
 * ⚠ ONE VISIBLE CONSEQUENCE: the HUD's villager/soldier split counts trade carts as CIVILIANS now,
 * where they used to sit in the military column. That is a corrected number, not a moved goalpost,
 * but it is a number John will see change.
 */
const fs=require("fs"),path=require("path");
const R=path.join(__dirname,"..");
const A=path.join(R,"js","00-data.js"), B=path.join(R,"js","07-ai.js"), C=path.join(R,"js","05-combat.js");
let a=fs.readFileSync(A,"utf8"), b=fs.readFileSync(B,"utf8"), c=fs.readFileSync(C,"utf8");
let sw=fs.readFileSync(path.join(R,"sw.js"),"utf8");
let ix=fs.readFileSync(path.join(R,"index.html"),"utf8");
let failed=[];
function mk(get,set){return function(name,from,to){
  const s=get(); const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  set(s.split(from).join(to));
};}
const subA=mk(()=>a,v=>a=v), subB=mk(()=>b,v=>b=v), subC=mk(()=>c,v=>c=v);

// ---------------------------------------------------------------------------
// 00-data.js — the predicate, and the one existing rule that has to learn it
// ---------------------------------------------------------------------------
subA("isWorker",
`function hasProg(u){`,
`// ---- v134.4 A CIVILIAN IS NOT A SOLDIER, AND "VILLAGER" STOPPED BEING THE ONLY KIND AT v99 ----
// The trade line is tradecart, trader and oxcart: three classes that carry no weapon, hold no
// posting and belong in no band. Every "cls!==\\"villager\\"" in 07-ai.js meant THIS, and said the
// other thing. ⚠ It is a CLASS test, not a role test: the AI's ox drives on bot.role "citizen"
// because it does a citizen's job, so the role tests that catch a trade cart do not catch it.
function isWorker(u){
  if(!u)return false;
  if(u.cls==="villager")return true;
  return !!(CLS[u.cls]&&CLS[u.cls].line==="trade");
}
function hasProg(u){`);

subA("…and a bot ox earns no veteran levels",
`  const r=u.bot.role;
  if(r==="creep"||r==="cart"||r==="king")return false;
  return u.cls!=="villager";`,
`  const r=u.bot.role;
  if(r==="creep"||r==="cart"||r==="king")return false;
  // v134.4: …and no CIVILIAN does, whatever its role. A yoked ox runs on role "citizen", so the
  // cart test above sails straight past it and it would have earned levels and blacksmith buffs
  // off camp participation — 220 hp of timber wain with a Whetstone on it.
  // ⚠ The isPlayer/remote line above still returns true, so a PERSON driving an ox keeps their
  // level and their loadout, exactly as they do today.
  return !isWorker(u);`);

// ---------------------------------------------------------------------------
// 07-ai.js — the yoke, the ox's working day, and every site that meant "soldier"
// ---------------------------------------------------------------------------
subB("the ox dials",
`function botFindNode(u,res){`,
`// ---- v134.4 THE OX AT THE PIT ----
// OX_MAX: oxen a team will yoke. Two is a deliberate floor-to-ceiling: each one costs a working
//   body as well as 75 food and 75 gold, and a marshal that turns its workforce into carts has
//   traded its army for timber it cannot spend.
// OX_MIN_VILLS: …and it will not take that body from a small workforce.
// OX_WOOD_WANT / OX_WOOD_FULL: only when TIMBER is the shortage, and off again when it is not.
//   ⚠ THESE ARE READ OFF THE ACTUAL CURVE, not guessed. Sampled every minute of a twenty-minute
//   campaign, a team's wood stock runs: 75 at the whistle, 10-25 by minute one (the opening
//   buildings), 500-900 by two, 1500-2700 by four, then a plateau between 2600 and 4600. The first
//   cut of this rule used 800, which is a window that closes at minute two — before the team has a
//   Storage Pit to yoke at or 75 spare gold — and measured ZERO oxen across four campaigns. A
//   threshold has to be picked against the curve the game actually produces.
// OX_MIN_CUTTERS: …and only for a team that is genuinely working timber.
// OX_EVERY: seconds between yokings, so a windfall does not buy the whole team at once.
// OX_WOOD_FULL: …and it UNYOKES when the bed has done its job. Measured on a twenty-minute
//   campaign: two oxen filled the stores to 7205 wood the marshal had nothing to spend on while
//   the same two bodies were not farming or mining. An ox is a worker as well as a cart, and the
//   hysteresis between WANT and FULL is what stops it flipping back and forth every think.
const OX_MAX=2, OX_MIN_VILLS=10, OX_MIN_CUTTERS=3, OX_WOOD_WANT=3000, OX_WOOD_FULL=5000, OX_EVERY=45;
function botFindNode(u,res){`);

subB("the yoke, next to the market's own cart rule",
`  // --- raid waves: the doctrine sets when, how many, and how often ---`,
`  // --- v134.4 the pit yokes an ox when timber is the shortage ---
  // Deliberately shaped like the market's cart rule above rather than like the training pool: a
  // count, a cap and a clock. The ox comes out of idleCitizen — the SAME pool that arms up — which
  // is why OX_MIN_VILLS sits above the training floor rather than at it.
  if(T>(D.oxT||0)&&countBld(team,"storage_pit")>0&&stock[team].wood<OX_WOOD_WANT){
    let oxen=0,vills=0,cutters=0;
    for(const u of units){
      if(!u.alive||u.team!==team||!u.bot||u.isKing)continue;
      if(u.cls==="oxcart")oxen++;
      else if(u.cls==="villager")vills++;
      if(u.bot.node&&u.bot.node.type==="wood")cutters++;
    }
    if(oxen<OX_MAX&&vills>=OX_MIN_VILLS&&cutters>=OX_MIN_CUTTERS&&
       affordKeep(team,CLS.oxcart.cost,P.reserveF,P.reserveG)){
      const c=idleCitizen(team);
      if(c){
        pay(team,CLS.oxcart.cost);
        c.convertTo="oxcart"; c.convertAt="storage_pit"; // the same road a soldier walks to arm up
        D.oxT=T+OX_EVERY;
      }
    }
  }
  // …and the yoke comes OFF when the stores are full. No refund — the 75 gold is spent — but the
  // body goes back to the fields and the mines, which is where a marshal with five thousand wood in
  // the stores and nothing to build needs it. Measured before this rule existed: two oxen filled a
  // team's stores to 14,012 wood by the twentieth minute while that team AGED DOWN relative to the
  // same seed without them — the timber was free and the two bodies were not. It keeps whatever is
  // in the bed: the villager it becomes is over its carry cap on the first frame, so its next act
  // is to walk it home.
  if(T>(D.oxT||0)&&stock[team].wood>OX_WOOD_FULL){
    for(const u of units){
      if(!u.alive||u.team!==team||u.cls!=="oxcart"||!u.bot||u.remote||u.isPlayer)continue;
      // ⚠ NOT WITH A LOADED BED. setClass does not move what is in it, so standing an ox down at
      // 280 logs would leave a villager carrying fourteen times its own cap — and the deposit rule
      // in this file is "no more telepathic deposits", so banking it from wherever it stands is not
      // the answer either. It has an empty bed the instant after every haul; stand it down then.
      if(u.carry.food+u.carry.gold+u.carry.stone+u.carry.wood>0)continue;
      setClass(u,"villager");
      u.bot.res="food"; u.bot.node=null; u.bot.haul=false;
      D.oxT=T+OX_EVERY;
      if(team===BLUE)msg("An ox is unyoked — the stores are full of timber.","blue");
      break;
    }
  }
  // --- raid waves: the doctrine sets when, how many, and how often ---`);

subB("the yoked ox is put on timber, and the message says what happened",
`        setClass(u,u.convertTo);u.convertTo=null;u.convertAt=null;
        if(u.team===BLUE&&Math.random()<0.4&&dist(u,player)<50)
          msg(u.name+" armed up as a "+CLS[u.cls].name+".","blue");`,
`        setClass(u,u.convertTo);u.convertTo=null;u.convertAt=null;
        // v134.4: the ox hauls TIMBER and nothing else — the same rule the human ox plays by
        // (06-input.js:466, "the ox hauls TIMBER, nothing else"). Set here rather than at the
        // decision, because until this frame the body was still a villager working its old face.
        if(u.cls==="oxcart"&&u.bot){u.bot.res="wood";u.bot.node=null;u.bot.haul=false;}
        if(u.team===BLUE&&Math.random()<0.4&&dist(u,player)<50)
          msg(u.cls==="oxcart"?(u.name+" yoked an ox at the Storage Pit.")
                              :(u.name+" armed up as a "+CLS[u.cls].name+"."),"blue");`);

subB("the working day is a WORKER's, not a villager's",
`  if(u.cls==="villager"){
    const threat=nearestEnemyOf(u,9);`,
`  // v134.4: …and the ox works this branch too. Without it a yoked ox falls through to the MILITARY
  // branch below — 220 hp of timber wain trying to find something to hit.
  if(isWorker(u)){
    const threat=nearestEnemyOf(u,9);`);

subB("the ox snubs everything but trees",
`    if(!b.node||b.node.amount<=0){
      b.node=botFindNode(u,b.res);
      if(!b.node){b.res=b.res==="food"?"wood":b.res==="wood"?"gold":b.res==="gold"?"stone":"food";b.node=botFindNode(u,b.res);}
      if(!b.node)return; // the land is bare`,
`    if(!b.node||b.node.amount<=0){
      b.node=botFindNode(u,b.res);
      // v134.4 …BUT THE OX DOES NOT ROTATE. A villager whose seam runs out moves to the next
      // resource; an ox that did would stand at a gold vein it cannot touch (06-input.js and
      // driveRemote both refuse any node but wood), gathering nothing, forever.
      if(!b.node&&u.cls==="oxcart")return; // no timber standing: the wain waits
      if(!b.node){b.res=b.res==="food"?"wood":b.res==="wood"?"gold":b.res==="gold"?"stone":"food";b.node=botFindNode(u,b.res);}
      if(!b.node)return; // the land is bare`);

subB("the bed holds 300, not 20",
`    const ctot=u.carry.food+u.carry.gold+u.carry.stone+u.carry.wood;
    if(b.haul||ctot>=20){`,
`    const ctot=u.carry.food+u.carry.gold+u.carry.stone+u.carry.wood;
    // v134.4: the ox bed takes 300 (carryCap), and the whole point of it is the walking it saves —
    // a wain that trudged home at 20 would be a slower villager that cost 75 gold.
    const _cap=(u.cls==="oxcart")?carryCap(u):20;
    if(b.haul||ctot>=_cap){`);

subB("four logs a swing",
`      if(b.gT>0.75*(b.node.slow||1)){
        b.gT=0;b.node.amount--;
        u.carry[b.node.type]++;`,
`      if(b.gT>0.75*(b.node.slow||1)){
        // v134.4: FOUR at a swing for the ox — the same figure the human ox takes in 09-main.js
        // ("v99: four swings' worth for the ox") and in driveRemote. The swing TIME is unchanged,
        // so the axe is four times the villager's and the arithmetic lives in one place.
        const _tk=Math.min((u.cls==="oxcart")?4:1,b.node.amount);
        b.gT=0;b.node.amount-=_tk;
        u.carry[b.node.type]+=_tk;`);

// ---- and every site that said "villager" when it meant "not a soldier" ----
subB("counterWeights reads the enemy ARMY",
`    if(!e.alive||e.team!==1-team||e.isKing||e.cls==="villager")continue;`,
`    if(!e.alive||e.team!==1-team||e.isKing||isWorker(e))continue; // v134.4: carts are not a line to counter`);

subB("a pit rises where a WORKER is hauling from far",
`      if(!u.alive||u.team!==team||u.cls!=="villager"||!u.bot||!u.bot.node)continue;`,
`      if(!u.alive||u.team!==team||!isWorker(u)||!u.bot||!u.bot.node)continue; // v134.4: the ox counts — it works furthest out`);

subB("the raid wave counts soldiers",
`  const mil=units.filter(u=>u.alive&&u.team===team&&u.bot&&!u.isKing&&u.cls!=="villager");`,
`  const mil=units.filter(u=>u.alive&&u.team===team&&u.bot&&!u.isKing&&!isWorker(u)); // v134.4: an ox is not a raider`);

subB("the charge hurls soldiers",
`  const mil=units.filter(v=>v.alive&&v.team===commander.team&&v.bot&&!v.isKing&&!v.remote&&v.rally&&(v.rallyBy===commander||!v.rallyBy)&&v.cls!=="villager");`,
`  const mil=units.filter(v=>v.alive&&v.team===commander.team&&v.bot&&!v.isKing&&!v.remote&&v.rally&&(v.rallyBy===commander||!v.rallyBy)&&!isWorker(v)); // v134.4`);

subB("an ox far from home is prey",
`    const vil=v.cls==="villager"&&dist2(v.root.position.x,v.root.position.z,TCPOS[et][0],TCPOS[et][1])>26*26;`,
`    const vil=isWorker(v)&&dist2(v.root.position.x,v.root.position.z,TCPOS[et][0],TCPOS[et][1])>26*26; // v134.4: a loaded wain most of all`);

subB("the band prunes to soldiers",
`      v.cls!=="villager"&&v.bot.role!=="cart"&&CLS[v.cls].line!=="healer"&&v.bandRef===bd);`,
`      !isWorker(v)&&CLS[v.cls].line!=="healer"&&v.bandRef===bd); // v134.4: isWorker covers the cart role AND the ox`);

subB("…and the roster never offers one",
`    if(v.cls==="villager"||v.bot.role==="cart"||CLS[v.cls].line==="healer")continue;`,
`    if(isWorker(v)||CLS[v.cls].line==="healer")continue; // v134.4: no wain is dealt into a band`);

subB("the wilds want soldiers, not carts",
`     units.filter(v=>v.alive&&v.team===team&&v.bot&&!v.isKing&&v.cls!=="villager").length>=CAMP_MIN_MIL&&`,
`     units.filter(v=>v.alive&&v.team===team&&v.bot&&!v.isKing&&!isWorker(v)).length>=CAMP_MIN_MIL&& // v134.4`);

subB("a hold band's contact clock ignores civilians",
`          if(!e.alive||e.team===team||e.team===NEUTRAL||e.cls==="villager")continue;`,
`          if(!e.alive||e.team===team||e.team===NEUTRAL||isWorker(e))continue; // v134.4: a passing cart is not contact`);

subB("the levy answers soldiers at the gate",
`      if(!e.alive||e.cls==="villager"||e.isKing)continue;`,
`      if(!e.alive||isWorker(e)||e.isKing)continue; // v134.4: a stray cart does not raise the levy`);

subB("the HUD's split counts civilians as civilians",
`    if(u.team===BLUE){u.cls==="villager"?bv++:bm++;}
    else if(u.team===RED){u.cls==="villager"?rv++:rm++;}`,
`    // v134.4: ⚠ THIS NUMBER CHANGES ON SCREEN. A trade cart has always been counted in the MILITARY
    // column here, and an ox would have been too. Neither carries a weapon.
    if(u.team===BLUE){isWorker(u)?bv++:bm++;}
    else if(u.team===RED){isWorker(u)?rv++:rm++;}`);

// ---------------------------------------------------------------------------
// 05-combat.js — a worker's distress, and what killing one is worth
// ---------------------------------------------------------------------------
subC("an ox under the axe calls for help",
`  if(victim.bot&&(victim.cls==="villager"||victim.bot.role==="cart")&&`,
`  if(victim.bot&&isWorker(victim)&& // v134.4: …and a yoked ox is a worker (role "citizen", trade class)`);

subC("killing a cart is not a soldier's kill",
`       victim.team!==NEUTRAL&&victim.cls!=="villager"&&!(victim.bot&&victim.bot.role==="cart")&&`,
`       victim.team!==NEUTRAL&&!isWorker(victim)&& // v134.4: an ox pays no veteran progress either`);

// ---------------------------------------------------------------------------
// The version pair. INVARIANT #4 — a smoketest gate enforces it.
// ---------------------------------------------------------------------------
{
  const a1=`const VERSION="v134.3";`, b1=`const VERSION="v134.4";`;
  const a2=`<p class="verstamp">v134.3 — THE MARSHAL'S ARMY</p>`,
        b2=`<p class="verstamp">v134.4 — THE OX AT THE PIT</p>`;
  if(sw.split(a1).length-1!==1)failed.push("sw.js VERSION (need exactly 1)");
  else sw=sw.split(a1).join(b1);
  if(ix.split(a2).length-1!==1)failed.push("index.html verstamp (need exactly 1)");
  else ix=ix.split(a2).join(b2);
}

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(A,a); fs.writeFileSync(B,b); fs.writeFileSync(C,c);
fs.writeFileSync(path.join(R,"sw.js"),sw);
fs.writeFileSync(path.join(R,"index.html"),ix);
console.log("patch-oxcart-v134: OK");
