#!/usr/bin/env node
/* v133.0 — JOHN'S BALANCE PASS.
   Thirty-nine changes off his playtest sheet, one retirement, one new buff. Where a change alters
   the SHAPE of a mechanic rather than a number, the reasoning is on the line that changes.
   Four readings were settled with him before any of this was written:
     · Practiced Hands  — 20% per stack, COMPOUNDING (0.8^n), 3x at full rather than today's 6x
     · Serrated Edge    — the buff stacks to 3 AND the bleeds layer on the target
     · Searing Presence — 2 HP/s PER STACK, 6 at full
     · Knife Fighter    — a flat half your damage; stacks buy throw chance, not knife power       */
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
const rd=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const wr=(f,s)=>fs.writeFileSync(path.join(ROOT,f),s);
let n=0;
function sub(file,find,repl,label){
  const src=rd(file); const c=src.split(find).length-1;
  if(c!==1){console.error('ABORT ['+label+'] matched '+c+', expected 1');process.exit(1);}
  wr(file,src.replace(find,repl)); n++; console.log('  ok  '+label);
}

/* ─────────── 1. THE TABLE ─────────── */
const OLD_TABLE=rd('js/00-data.js');
const s0=OLD_TABLE.indexOf('const BUFFS=['), s1=OLD_TABLE.indexOf('];',s0)+2;
if(s0<0||s1<2){console.error('ABORT: BUFFS array not found');process.exit(1);}
const NEW_TABLE=`const BUFFS=[ // random at the Blacksmith, 1 XP each. \`max\` is the per-buff stack ceiling
  // ---- the original twenty-one, rebalanced in v133.0. BOUNTY HUNTER retired here ----
  {id:"dmg",    name:"Honed Edge",       desc:"+7% damage",                                  max:5},
  {id:"atkspd", name:"Quick Hands",      desc:"−10% attack cooldown",                        max:5},
  {id:"crit",   name:"Keen Eye",         desc:"+7% chance of a CRITICAL (2× damage)",        max:3},
  {id:"shield", name:"Raised Shield",    desc:"−7% damage taken",                            max:5},
  {id:"hp",     name:"Stout Heart",      desc:"+10% max HP",                                 max:5},
  {id:"dodge",  name:"Sixth Sense",      desc:"5% chance to dodge any blow",                 max:3},
  {id:"spd",    name:"Fleet Foot",       desc:"+1 move speed",                               max:3},
  {id:"carry",  name:"Deep Satchel",     desc:"+20 carry capacity",                          max:5},
  {id:"gather", name:"Practiced Hands",  desc:"gather 20% faster",                           max:5},
  {id:"builder",name:"Master Builder",   desc:"buildings need fewer hits from you",          max:4},
  {id:"slayer", name:"Wild Slayer",      desc:"+15% damage vs the wilds' creatures",         max:5},
  {id:"captain",name:"Captain's Banner", desc:"+5% damage to allies fighting near you",      max:3},
  {id:"leech",  name:"Bloodthirst",      desc:"heal 7% of the damage you deal",              max:5},
  {id:"regen",  name:"Second Skin",      desc:"+2 HP/s after 5s out of combat",              max:5},
  {id:"zeal",   name:"Zealotry",         desc:"−2s priest resurrect cooldown",               max:3},
  {id:"trade",  name:"Deep Pockets",     desc:"+15% trade-sell payout",                      max:3},
  {id:"parry",  name:"Duelist",          desc:"+0.07s parry window",                         max:3},
  {id:"siege",  name:"Siegewright",      desc:"+15% damage crewing siege engines",           max:3},
  {id:"wreck",  name:"Wrecker",          desc:"+15% damage vs buildings",                    max:3},
  {id:"rally",  name:"Bannerman",        desc:"rally one additional troop",                  max:3},
  // ---- v132.30 BATCH A: eighteen that hook existing code and need no new system ----
  {id:"ambush", name:"First Blood",      desc:"+50% damage to enemies at FULL health",       max:1},
  {id:"trophy", name:"Trophy Hunter",    desc:"+5 max HP with every kill, up to +100",       max:1},
  {id:"cull",   name:"Culler",           desc:"instantly slay wild creatures below 15% HP",  max:1},
  {id:"feast",  name:"Second Wind",      desc:"restore 10% of your HP on a kill",            max:3},
  {id:"fervor", name:"Desperation",      desc:"+1% attack speed per 1% of health missing",   max:1},
  {id:"purse",  name:"Cutpurse",         desc:"pocket 10 gold on a kill",                    max:3},
  {id:"forage", name:"Scavenger",        desc:"pocket 10 food on a kill",                    max:3},
  {id:"mule",   name:"Pack Mule",        desc:"(villager) a fuller load moves faster, to +10%",max:1},
  {id:"thorns", name:"Bramble Mail",     desc:"deal 1 damage back to a melee attacker",      max:3},
  {id:"tribute",name:"Blood Tax",        desc:"gain 1 gold whenever you take damage",        max:1},
  {id:"alchemy",name:"Gilded Harvest",   desc:"mining gold also feeds your team",            max:1},
  {id:"reaping",name:"Rich Soil",        desc:"+20 extra food when you harvest a farm",      max:1},
  {id:"bulwark",name:"Bulwark",          desc:"defensive structures cost you half",          max:1},
  {id:"enginebane",name:"Enginebane",    desc:"(ranged) +50% damage to siege engines",       max:1},
  {id:"woods",  name:"Woodsman",         desc:"+30% damage while fighting in the woods",     max:1},
  {id:"warden", name:"Beast Warden",     desc:"take 10% less damage from the wilds",         max:3},
  {id:"yeoman", name:"Yeoman",           desc:"(villager) double health and double damage",  max:1},
  {id:"kguard", name:"King's Guard",     desc:"+10% damage and −10% damage taken near your King",max:1},
  // ---- v132.32 BATCH B: five that need the timed-modifier system ----
  {id:"frenzy", name:"Killing Frenzy",   desc:"+3 damage per kill, to +15, for 10s",         max:1},
  {id:"surge",  name:"Bloodrush",        desc:"+50% move speed on a kill, fading over 2s",   max:1},
  {id:"flight", name:"Survival Instinct",desc:"+40% move speed for 5s when you drop below 25% HP",max:1},
  {id:"stride", name:"Long Strider",     desc:"+30% move speed while out of combat",         max:1},
  {id:"hunt",   name:"Hunter's Step",    desc:"(melee) +10% move speed for 2s when you land a blow",max:1},
  // ---- v132.34 BATCH C: five that put state on the ENEMY ----
  {id:"bleed",  name:"Serrated Edge",   desc:"15% chance on hit to bleed an enemy — bleeds layer to 60 HP over 20s",max:3},
  {id:"venom",  name:"Venomous",        desc:"15% chance on hit to poison — 10 HP and half speed over 10s",max:1},
  {id:"concuss",name:"Concussive Blow", desc:"(melee) 15% chance on hit to STUN, once every 10s",max:1},
  {id:"gash",   name:"Deep Gash",       desc:"your damage stops an enemy healing for 5s",     max:1},
  {id:"shrug",  name:"Shrug It Off",    desc:"20% chance when struck to shed every debuff",   max:1},
  // ---- v132.35 BATCH D: six that work on everything standing near you ----
  {id:"sanctuary",name:"Sanctuary",     desc:"stand still 3s to open a healing zone — 3% HP a second",max:1},
  {id:"brand",  name:"Searing Presence",desc:"nearby enemies burn for 2 HP a second",         max:3},
  {id:"resolve",name:"Unbowed",         desc:"−5% damage taken for every enemy near you, to −25%",max:1},
  {id:"phalanx",name:"Phalanx",         desc:"+5% damage for every ally beside you, to +20%",  max:1},
  {id:"kinship",name:"Kinship",         desc:"mend 0.5% of max HP a second per soldier of your own kind nearby, to 5%",max:1},
  {id:"steward",name:"Steward",         desc:"(villager) mend nearby friendly buildings, 10 HP a second",max:1},
  // ---- v132.36 BATCH E: procs and charges — the last of John's CSV ----
  {id:"quake",  name:"Earthshaker",     desc:"(melee) 15% chance on hit to slam the ground for area damage",max:1},
  {id:"knives", name:"Knife Fighter",   desc:"15% chance every 2s to hurl a knife for half your damage",max:2},
  {id:"volley", name:"Rapid Volley",    desc:"(ranged) 5% chance to loose THREE shots, once every 10s",max:1},
  {id:"ward",   name:"Arrow Ward",      desc:"block one ranged attack every 24s — 18/12/6/3s as it stacks",max:5},
  {id:"guardup",name:"Iron Guard",      desc:"block one melee attack every 25s — 20/15/10/5s as it stacks",max:5},
  // ---- v133.0 BATCH F ----
  {id:"timber", name:"Timberwright",    desc:"(villager · ox cart) chop timber twice as fast", max:1}
];`;
wr('js/00-data.js',OLD_TABLE.slice(0,s0)+NEW_TABLE+OLD_TABLE.slice(s1));
n++; console.log('  ok  00-data: BUFFS table rewritten (60 → 60: bounty out, timber in)');

/* ─────────── 2. BOUNTY HUNTER RETIRED ─────────── */
sub('js/00-data.js',
`  if(u&&(u.isPlayer||u.remote)&&n>0)u.score=(u.score||0)+n*(1+0.10*buffSt(u,"bounty")); // Bounty Hunter pays a premium`,
`  // v133.0 BOUNTY HUNTER RETIRED. Score is now flat. The id is deliberately still tolerated
  // everywhere else: a player mid-match holds it in u.buffs, syncBuffs puts it on the wire, and
  // BUFF_BY_ID lookups must not throw on it — it simply stops being dealt and stops paying.
  if(u&&(u.isPlayer||u.remote)&&n>0)u.score=(u.score||0)+n;`,
'00-data: awardPts no longer reads bounty');

/* ─────────── 3. CARRY / GATHER / TIMBER ─────────── */
sub('js/00-data.js',
`function carryCap(u){return u&&u.cls==="oxcart"?300:20+10*buffSt(u,"carry");} // Deep Satchel · v99: the ox bed takes 300`,
`function carryCap(u){return u&&u.cls==="oxcart"?300:20+20*buffSt(u,"carry");} // Deep Satchel · v99: the ox bed takes 300
// v133.0 THE SWING CLOCK, in one place, because two frame paths compute it — 09-main for the host
// and 10-net for a guest — and they drifted apart the last time a buff touched gathering.
// PRACTICED HANDS compounds at 20% a stack (John's call): 0.6 → 0.48 / 0.38 / 0.31 / 0.25 / 0.20s,
// a 3x rate at full stack. It was −0.1s flat, which reached 0.1s and a SIX-fold rate.
// TIMBERWRIGHT halves it again, for wood, for the two classes that haul it.
function gatherSwing(u,node){
  let t=0.6*Math.pow(0.8,buffSt(u,"gather"));
  if(node&&node.type==="wood"&&u&&(u.cls==="villager"||u.cls==="oxcart")&&buffSt(u,"timber"))t*=0.5;
  return t*((node&&node.slow)||1);
}`,
'00-data: carryCap +20, gatherSwing() with Timberwright');

sub('js/09-main.js',
`      if(player.gatherT>(0.6-0.1*buffSt(player,"gather"))*(n.slow||1)){ // PRACTICED HANDS swing faster`,
`      if(player.gatherT>gatherSwing(player,n)){ // PRACTICED HANDS · TIMBERWRIGHT — see 00-data.js`,
'09-main: host gather uses gatherSwing');

sub('js/10-net.js',
`        if(u.gatherT>(0.6-0.1*buffSt(u,"gather"))*(n.slow||1)){ // PRACTICED HANDS`,
`        if(u.gatherT>gatherSwing(u,n)){ // PRACTICED HANDS · TIMBERWRIGHT — the SAME function the`,
'10-net: guest gather uses gatherSwing');

/* ─────────── 4. STAT-MODEL BUFFS ─────────── */
sub('js/04-units.js',
`  u.maxHp=Math.round(d.hp*ageBuff(u.team)*(1+0.05*buffSt(u,"hp")))+(u.hpBonus||0); // +TROPHY HUNTER
  u.hp=Math.max(1,Math.round(u.maxHp*frac));
  u.spd=d.spd+0.5*buffSt(u,"spd");
  u.cd=Math.max(0.2,d.cd-0.1*buffSt(u,"atkspd"));`,
`  u.maxHp=Math.round(d.hp*ageBuff(u.team)*(1+0.10*buffSt(u,"hp")))+(u.hpBonus||0); // +TROPHY HUNTER
  u.hp=Math.max(1,Math.round(u.maxHp*frac));
  u.spd=d.spd+1.0*buffSt(u,"spd");
  // v133.0 QUICK HANDS IS A PERCENTAGE NOW. −0.1s flat was a different buff depending on who
  // bought it: worth 10% to a 1.0s clubman and 40% to a 0.25s skirmisher. 10% a stack is the
  // same buff for everyone, and lands in the same place it used to for a 1.0s attacker.
  u.cd=Math.max(0.2,d.cd*(1-0.10*buffSt(u,"atkspd")));`,
'04-units: Stout Heart 10%, Fleet Foot +1, Quick Hands as a percentage');

/* ─────────── 5. DAMAGE-TIME ─────────── */
sub('js/05-combat.js',`    let m=1+0.05*buffSt(attU,"dmg");                               // HONED EDGE`,
                        `    let m=1+0.07*buffSt(attU,"dmg");                               // HONED EDGE`,'05-combat: Honed Edge 7%');
sub('js/05-combat.js',`    if(isSiege(attU.cls))m*=1+0.10*buffSt(attU,"siege");           // SIEGEWRIGHT`,
                        `    if(isSiege(attU.cls))m*=1+0.15*buffSt(attU,"siege");           // SIEGEWRIGHT`,'05-combat: Siegewright 15%');
sub('js/05-combat.js',`    if(buffSt(attU,"woods")&&inTheWoods(attU))m*=1+0.10*buffSt(attU,"woods"); // WOODSMAN`,
                        `    if(buffSt(attU,"woods")&&inTheWoods(attU))m*=1+0.30*buffSt(attU,"woods"); // WOODSMAN`,'05-combat: Woodsman 30%');
sub('js/05-combat.js',`    if(cs&&Math.random()<0.05*cs){`,`    if(cs&&Math.random()<0.07*cs){`,'05-combat: Keen Eye 7%');
sub('js/05-combat.js',`    if(cap)dmg*=1+0.01*cap;`,`    if(cap)dmg*=1+0.05*cap;`,'05-combat: Captain’s Banner 5%');
sub('js/05-combat.js',`    dmg*=1-0.05*buffSt(victim,"shield");                           // RAISED SHIELD (the buff)`,
                        `    dmg*=1-0.07*buffSt(victim,"shield");                           // RAISED SHIELD (the buff)`,'05-combat: Raised Shield 7%');

/* ─────────── 6. THE CHARGES ─────────── */
sub('js/05-combat.js',
`      const wd=buffSt(victim,"ward"), gd=buffSt(victim,"guardup");
      if(rangedBlow&&wd&&T-(victim._wardT||-999)>=30/wd){`,
`      // v133.0 EXPLICIT CADENCE TABLES, John's numbers. 30/stacks was a curve nobody chose: it
      // gave 30/15/10 and could not express "and the last stack is the big one". Both now stack
      // to five and read straight off his sheet.
      const wd=buffSt(victim,"ward"), gd=buffSt(victim,"guardup");
      if(rangedBlow&&wd&&T-(victim._wardT||-999)>=WARD_CD[Math.min(wd,WARD_CD.length)-1]){`,
'05-combat: Arrow Ward cadence table');
sub('js/05-combat.js',
`      if(!rangedBlow&&gd&&att&&att.cls&&T-(victim._guardT||-999)>=30/gd){`,
`      if(!rangedBlow&&gd&&att&&att.cls&&T-(victim._guardT||-999)>=GUARD_CD[Math.min(gd,GUARD_CD.length)-1]){`,
'05-combat: Iron Guard cadence table');
sub('js/00-data.js',
`const XP_MAX_LVL=25, BUFF_MAX_STACK=3, BOARD_REACH=5, QUEST_REROLL_MAX=3;`,
`const XP_MAX_LVL=25, BUFF_MAX_STACK=3, BOARD_REACH=5, QUEST_REROLL_MAX=3;
// v133.0 the charge cooldowns, one entry per stack — John's sheet, not a formula
const WARD_CD =[24,18,12,6,3];   // ARROW WARD  — seconds between blocked ranged attacks
const GUARD_CD=[25,20,15,10,5];  // IRON GUARD  — seconds between blocked melee attacks`,
'00-data: WARD_CD / GUARD_CD');

/* ─────────── 7. ON-HIT STATE ─────────── */
sub('js/05-combat.js',
`    if(bl&&Math.random()<0.05*bl){                      // SERRATED EDGE — 1 HP/s for 20s = 20 HP
      tmodAdd(victim,"bleed",1,20,false); victim._dotBy=attU;`,
`    if(bl&&Math.random()<0.15*bl){                      // SERRATED EDGE — 1 HP/s for 20s = 20 HP
      // v133.0 THE BLEEDS LAYER, to three. The cap is on the MODIFIER, not on a counter: tmodAdd's
      // sixth argument ceilings the summed value, so a fourth proc refreshes the clock without
      // deepening the wound. Three layers over twenty seconds is the 60 HP on John's sheet.
      tmodAdd(victim,"bleed",1,20,false,3); victim._dotBy=attU;`,
'05-combat: Serrated Edge 15% and layering');
sub('js/05-combat.js',`    if(vn&&Math.random()<0.05*vn){                      // VENOMOUS — 10 HP over 10s, and half speed`,
                        `    if(vn&&Math.random()<0.15*vn){                      // VENOMOUS — 10 HP over 10s, and half speed`,'05-combat: Venomous 15%');
sub('js/05-combat.js',`    if(cc&&melee&&T-(attU._stunCd||-999)>=30&&Math.random()<0.05*cc){`,
                        `    if(cc&&melee&&T-(attU._stunCd||-999)>=10&&Math.random()<0.15*cc){`,'05-combat: Concussive Blow 15% / 10s');
sub('js/05-combat.js',`      tmodAdd(victim,"healblock",1,3,false);`,`      tmodAdd(victim,"healblock",1,5,false);`,'05-combat: Deep Gash 5s');
sub('js/05-combat.js',`     Math.random()<0.10*buffSt(victim,"shrug")){`,`     Math.random()<0.20*buffSt(victim,"shrug")){`,'05-combat: Shrug It Off 20%');
sub('js/05-combat.js',`    if(qk&&meleeE&&Math.random()<0.05*qk){                 // EARTHSHAKER — borrows AURA_BR rather`,
                        `    if(qk&&meleeE&&Math.random()<0.15*qk){                 // EARTHSHAKER — borrows AURA_BR rather`,'05-combat: Earthshaker 15%');

/* ─────────── 8. ON-KILL AND LIFESTEAL ─────────── */
sub('js/05-combat.js',
`    const ls=buffSt(attU,"leech");
    if(ls&&attU.hp<attU.maxHp){
      attU.hp=Math.min(attU.maxHp,attU.hp+1*ls);`,
`    // v133.0 BLOODTHIRST DRINKS A SHARE OF THE BLOW, not a flat point. 1 HP a hit was noise on a
    // 40-damage swing and a lifeline on a 3-damage one; 7% a stack scales with what you actually
    // hit for, and reads 35% at full. \`dmg\` here is the figure AFTER every multiplier and both
    // charge blocks, which is the number that landed.
    const ls=buffSt(attU,"leech");
    if(ls&&attU.hp<attU.maxHp){
      attU.hp=Math.min(attU.maxHp,attU.hp+Math.max(0,dmg)*0.07*ls);`,
'05-combat: Bloodthirst is 7% of damage dealt');
sub('js/05-combat.js',`      if(fr)tmodAdd(attU,"dmgflat",2*fr,7,false,10*fr);                // +2 a kill, capped at +10`,
                        `      if(fr)tmodAdd(attU,"dmgflat",3*fr,10,false,15*fr);               // +3 a kill, capped at +15, for 10s`,'05-combat: Killing Frenzy +3/+15/10s');
sub('js/05-combat.js',`        attU.hpBonus=Math.min(100,(attU.hpBonus||0)+1*tr);`,
                        `        attU.hpBonus=Math.min(100,(attU.hpBonus||0)+5*tr);   // v133.0: +5 a kill — 20 kills to the cap`,'05-combat: Trophy Hunter +5');

/* ─────────── 9. THE AURAS ─────────── */
sub('js/05-combat.js',`        dealDamage(u,o,1*brand*step);                    // SEARING PRESENCE`,
                        `        dealDamage(u,o,2*brand*step);                    // SEARING PRESENCE — 2 HP/s a stack`,'05-combat: Searing Presence 2 HP/s');
sub('js/05-combat.js',`      b.hp=Math.min(b.def.hp,b.hp+0.5*stew*step);`,
                        `      b.hp=Math.min(b.def.hp,b.hp+10*stew*step);   // v133.0: 0.5 HP/s mended nothing in a siege`,'05-combat: Steward 10 HP/s');
sub('js/05-combat.js',
`  let allies=0, enemies=0, kinNear=false, kinId=0;`,
`  let allies=0, enemies=0, kinNear=0, kinId=0;   // v133.0 kinNear COUNTS now — see KINSHIP below`,
'05-combat: kinNear becomes a count');
sub('js/05-combat.js',
`      if(kin&&!kinNear&&o.cls===u.cls&&!o.isKing){kinNear=true;kinId=o.id;} // v132.39: WHICH one,
                                                                            // for the thread`,
`      if(kin&&o.cls===u.cls&&!o.isKing){kinNear++;if(!kinId)kinId=o.id;}    // v132.39: WHICH one,
                                                                            // for the thread`,
'05-combat: count every kinsman, keep the first for the ring');
sub('js/05-combat.js',
`  if(kin&&kinNear&&u.hp<u.maxHp){                        // KINSHIP
    u.hp=Math.min(u.maxHp,u.hp+1.0*kin*step);`,
`  if(kin&&kinNear&&u.hp<u.maxHp){                        // KINSHIP
    // v133.0 IT SCALES WITH THE SHIELD WALL. A flat 1 HP/s paid the same whether one kinsman stood
    // with you or ten, which is the opposite of what the buff is about. 0.5% of max HP a second
    // each, ceilinged at 5% — ten of your own kind, and no more to be had for the eleventh.
    u.hp=Math.min(u.maxHp,u.hp+u.maxHp*Math.min(0.05,0.005*kinNear)*kin*step);`,
'05-combat: Kinship scales per kinsman to 5%');

/* ─────────── 10. THE REST ─────────── */
sub('js/05-combat.js',`  if(Math.random()>=0.10*st)return;`,`  if(Math.random()>=0.15*st)return;`,'05-combat: Knife Fighter 15% a stack');
sub('js/05-combat.js',
`  dealDamage(u,best,(u.dmg||5)*0.6*st);`,
`  // v133.0 A FLAT HALF, whatever the stack. Stacks buy throw CHANCE (0.15*st above); letting them
  // buy knife power too meant a two-stack knife hit harder than the hand that threw it.
  dealDamage(u,best,(u.dmg||5)*0.5);`,
'05-combat: knife does half your base damage, flat');
sub('js/05-combat.js',`function resCdFor(u){return Math.max(3,RES_CD-1.5*buffSt(u,"zeal"));} // v87 ZEALOTRY`,
                        `function resCdFor(u){return Math.max(3,RES_CD-2*buffSt(u,"zeal"));} // v87 ZEALOTRY`,'05-combat: Zealotry −2s');
sub('js/09-main.js',`      u.hp=Math.min(u.maxHp,u.hp+0.5*rst*dt);`,`      u.hp=Math.min(u.maxHp,u.hp+2*rst*dt);`,'09-main: Second Skin 2 HP/s');
sub('js/09-main.js',`    if(fv&&u.maxHp>0&&u.hp<u.maxHp)_sw=dt*(1+0.5*fv*(1-u.hp/u.maxHp));`,
                      `    if(fv&&u.maxHp>0&&u.hp<u.maxHp)_sw=dt*(1+1.0*fv*(1-u.hp/u.maxHp));`,'09-main: Desperation 1% per 1% missing');

console.log('v133.0 balance: '+n+' edits applied');
