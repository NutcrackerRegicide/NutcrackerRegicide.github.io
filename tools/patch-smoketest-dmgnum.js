#!/usr/bin/env node
/* patch-smoketest-dmgnum.js — gate the number against the damage the game actually applied.
 *
 * ── THE ONLY ASSERTION THAT MATTERS ─────────────────────────────────────────────────────────
 * "A number was drawn" is worth nothing. A number that disagrees with the wound is worse than no
 * number, because the whole reason John asked for this is to find out whether sixty buffs are
 * doing anything — and a display that lies about that is a display that will send someone
 * rebalancing the wrong thing. So the gate drives a REAL dealDamage, measures the hp that
 * actually left the victim, and requires the figure on screen to be that.
 *
 * ── AND THE FOUR WAYS IT COULD STILL BE WRONG ───────────────────────────────────────────────
 *   A CRIT MUST READ DIFFERENTLY — it doubles the damage, so a player who cannot tell a crit from
 *     a lucky roll learns nothing from the number.
 *   SUB-1 MUST BANK — SEARING PRESENCE calls dealDamage with 0.25 four times a second. Without
 *     banking that is "0" four times a second per burning enemy, which is worse than silence.
 *   ONLY THE ATTACKER SEES IT — every other display effect this session had to be broadcast; this
 *     one must NOT be, or a 485-unit battle puts everyone's damage on everyone's screen.
 *   AND THE CACHE IS CAPPED — a texture per distinct value is fine for the narrow band a match
 *     uses and must not grow without bound over a long one.
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

sub("export the number surface",
  'RING_MIN,RING_TIGHTEN,getPlayer:()=>player,fxTick,fxStats,fxTex,vfxPlay,isHuman,',
  'RING_MIN,RING_TIGHTEN,getPlayer:()=>player,fxTick,fxStats,fxTex,vfxPlay,isHuman,dmgNum,dnumStats,');

sub("the damage-number gates",
'      // ---- v132.45: does it LOOK like a knife? ----',
'      // ---- v132.46: THE DAMAGE NUMBER ----\n'+
'      {\n'+
'        const D=G.dnumStats;\n'+
'        const P=G.getPlayer(), b0=P.buffs;\n'+
'        try{\n'+
'          const foe=mkB(1,{}); foe.hp=foe.maxHp=4000; foe._dnumBank=0;\n'+
'          // THE FIGURE MUST BE THE WOUND. Driven through a real dealDamage with a real loadout,\n'+
'          // so every multiplier has had its say before the reading is taken.\n'+
'          P.buffs={dmg:5}; P.alive=true;                    // HONED EDGE x5 = +25%\n'+
'          const h0=foe.hp;\n'+
'          G.dealDamage(P,foe,40);\n'+
'          const applied=h0-foe.hp, shown=D().last;\n'+
'          check("v132.46 damage number: the figure on screen IS the wound — "+\n'+
'            applied.toFixed(2)+" HP left the victim and the number read "+(shown?shown.n:"none")+\n'+
'            ". A number that disagrees is worse than no number, because it sends you rebalancing "+\n'+
'            "the wrong thing",\n'+
'            !!shown&&shown.id===foe.id&&shown.n===Math.floor(applied));\n'+
'          check("v132.46 damage number: …and it is not the RAW figure — HONED EDGE x5 turned a "+\n'+
'            "40 into "+applied.toFixed(1)+", which is the whole reason for showing it",\n'+
'            applied>40.5);\n'+
'          // SUB-1 BANKS. Searing Presence deals 0.25, four times a second.\n'+
'          foe._dnumBank=0; foe.hp=foe.maxHp;\n'+
'          const made0=D().made;\n'+
'          let drew=0;\n'+
'          for(let i=0;i<3;i++)if(G.dmgNum(foe,0.25,false))drew++;\n'+
'          check("v132.46 damage number: three 0.25 burns draw NOTHING yet ("+drew+") — without "+\n'+
'            "banking, SEARING PRESENCE paints a \'0\' four times a second on every burning enemy",\n'+
'            drew===0);\n'+
'          const fourth=G.dmgNum(foe,0.25,false);\n'+
'          check("v132.46 damage number: …and the fourth emits ONE honest 1 ("+\n'+
'            (D().last?D().last.n:"none")+")",fourth===true&&D().last.n===1);\n'+
'          // A CRIT READS DIFFERENTLY\n'+
'          const c0=D().cached;\n'+
'          G.dmgNum(foe,50,false); const asPlain=D().cached;\n'+
'          G.dmgNum(foe,50,true);  const asCrit=D().cached;\n'+
'          check("v132.46 damage number: a CRIT is its own glyph, not the same one bigger — it "+\n'+
'            "doubles the damage, and a player who cannot tell a crit from a lucky roll learns "+\n'+
'            "nothing from the number (cache "+c0+" → "+asPlain+" → "+asCrit+")",\n'+
'            asPlain===c0+1&&asCrit===asPlain+1&&D().last.crit===true);\n'+
'          // ONLY THE ATTACKER. This is the one display effect that must NOT be broadcast.\n'+
'          const bot=mkB(0,{}); bot.remote=null; bot.isPlayer=false;\n'+
'          const before=D().made;\n'+
'          G.dealDamage(bot,foe,30);\n'+
'          check("v132.46 damage number: a blow struck by somebody ELSE draws nothing on your "+\n'+
'            "screen — every other effect this session had to be broadcast; this one must not be, "+\n'+
'            "or a 485-unit battle puts everyone\'s damage on everyone\'s display ("+before+" → "+\n'+
'            D().made+")",D().made===before);\n'+
'          foe.alive=false; bot.alive=false;\n'+
'        }finally{ P.buffs=b0; }\n'+
'      }\n'+
'      // ---- v132.45: does it LOOK like a knife? ----');

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — the damage-number gates");
