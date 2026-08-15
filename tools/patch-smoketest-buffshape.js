#!/usr/bin/env node
/* patch-smoketest-buffshape.js — the forge gates assumed a UNIFORM ×3 ceiling.
 *
 * Three of them went red, correctly, the moment the ceiling became per-buff. Each is rewritten
 * to derive its expectation from `buffMax(id)` rather than from a literal 3, so the gates stay
 * true when John retunes a column in the CSV instead of going red on a data edit. A test that
 * has to be hand-edited every time a number moves eventually gets edited to match whatever the
 * code does, which is how a gate stops being a gate.
 *
 * The stat-sheet check is the interesting one: Stout Heart and Quick Hands now stack to 5, not 3,
 * so the expected HP and cooldown genuinely changed. Deriving them keeps the assertion measuring
 * "the stat sheet agrees with the buff table" instead of "the stat sheet equals these numbers".
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

sub("export buffMax",
  `QUESTS,BUFFS,XP_MAX_LVL,BUFF_MAX_STACK,BOARD_REACH,QUEST_REROLL_MAX,`,
  `QUESTS,BUFFS,XP_MAX_LVL,BUFF_MAX_STACK,BOARD_REACH,QUEST_REROLL_MAX,buffMax,BUFF_BY_ID,`);

sub("FULL is the sum of the ceilings",
  `  const FULL=BUFFS.length*BUFF_MAX_STACK; // every buff to the cap`,
  `  // v132.30: the ceiling is PER BUFF now (1/3/5), so "every buff at its cap" is the SUM of the
  // maxes, not a count times a constant.
  const FULL=BUFFS.reduce((a,b)=>a+global.__G.buffMax(b.id),0); // every buff to its own cap`);

sub("forge-everything assertion",
  `  check(FULL+" XP forges every buff to the ×"+BUFF_MAX_STACK+" cap via chosen trios (stacks "+stacks+", xp left "+qh.xp+")",
    qh.xp===0&&stacks===FULL&&BUFFS.every(b=>buffSt(qh,b.id)===3));`,
  `  check(FULL+" XP forges every buff to its OWN cap via chosen trios ("+BUFFS.length+" buffs, stacks "+
    stacks+"/"+FULL+", xp left "+qh.xp+")",
    qh.xp===0&&stacks===FULL&&BUFFS.every(b=>buffSt(qh,b.id)===global.__G.buffMax(b.id)));
  check("v132.30 forge: the ceilings are genuinely MIXED, not a uniform 3 ("+
    [...new Set(BUFFS.map(b=>global.__G.buffMax(b.id)))].sort().join("/")+") — so the check above "+
    "is not the old uniform-cap test wearing a new name",
    new Set(BUFFS.map(b=>global.__G.buffMax(b.id))).size>=3);`);

sub("thin pool",
  `    q2.buffs={}; for(const b of BUFFS)q2.buffs[b.id]=3;
    q2.buffs[BUFFS[0].id]=2; q2.buffs[BUFFS[1].id]=1; // only two slots left in the whole forge`,
  `    q2.buffs={}; for(const b of BUFFS)q2.buffs[b.id]=global.__G.buffMax(b.id); // every one maxed…
    q2.buffs[BUFFS[0].id]=global.__G.buffMax(BUFFS[0].id)-1;                     // …bar two slots
    q2.buffs[BUFFS[1].id]=global.__G.buffMax(BUFFS[1].id)-1;`);

sub("stat sheet",
  `  check("Stout Heart / Fleet Foot / Quick Hands land on the stat sheet",
    qh.maxHp===Math.round(cb.hp*ageBuff(0)*1.15)&&
    Math.abs(qh.spd-(cb.spd+1.5))<1e-9&&Math.abs(qh.cd-Math.max(0.2,cb.cd-0.3))<1e-9);`,
  `  // derived from the table, not from literals: Stout Heart and Quick Hands stack to 5 now.
  {
    const bm=global.__G.buffMax;
    const wantHp=Math.round(cb.hp*ageBuff(0)*(1+0.05*bm("hp")));
    const wantSpd=cb.spd+0.5*bm("spd");
    const wantCd=Math.max(0.2,cb.cd-0.1*bm("atkspd"));
    check("Stout Heart ×"+bm("hp")+" / Fleet Foot ×"+bm("spd")+" / Quick Hands ×"+bm("atkspd")+
      " land on the stat sheet (hp "+qh.maxHp+"/"+wantHp+", spd "+qh.spd.toFixed(2)+"/"+wantSpd.toFixed(2)+
      ", cd "+qh.cd.toFixed(2)+"/"+wantCd.toFixed(2)+")",
      qh.maxHp===wantHp&&Math.abs(qh.spd-wantSpd)<1e-9&&Math.abs(qh.cd-wantCd)<1e-9);
  }`);

sub("PROTO site 1",
  `  check("v132 wire: PROTO is 34 — the quest table renumbered, and qi/qdraft are positional",NET.PROTO===34);`,
  `  check("v132 wire: PROTO is 35 — the forge speaks eighteen new buff ids a .29 peer cannot name",NET.PROTO===35);`);
sub("PROTO site 2",
  `  check("v115/v132 net: PROTO 34 (the quest table renumbered) and \`ares\` still rides both payloads",
    G.NET.PROTO===34&&`,
  `  check("v115/v132 net: PROTO 35 (the forge speaks new buff ids) and \`ares\` still rides both payloads",
    G.NET.PROTO===35&&`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — per-buff ceilings + PROTO 35");
