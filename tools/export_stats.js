#!/usr/bin/env node
/* REGICIDE PVP — balance stat exporter (v82)
   Dumps every tunable stat into one sectioned CSV for spreadsheet editing.
   Usage: node tools/export_stats.js > REGICIDE-STATS.csv
   Sections are marked with lines starting ### — edit the VALUE cells, keep ids/columns,
   then hand the file back and the changes get patched into the game data. */
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
// 00-data.js is pure data — evaluate it alone to read the live tables
const sandbox="(function(){"+fs.readFileSync(path.join(ROOT,"js/00-data.js"),"utf8")+
  ";return {CLS,BLD,AGES,AGE_RESEARCH_S,LINES,MAP,TCPOS,CAMPS,CAMP_R,CAMP_AGGRO,CREEP_N,CAMP_RESPAWN,CAMP_CHEST,"+
  "BOSS_R,BOSS_N,BOSS_RESPAWN,BOSS_CHEST,stock,QUESTS,BUFFS,XP_MAX_LVL,BUFF_MAX_STACK,BOARD_REACH,"+
  "PERSONALITIES,AI_DIFF};})()";
const D=eval(sandbox);
// named constants that live in other files — read them straight out of the source
function grab(file,re,fallback){
  const m=fs.readFileSync(path.join(ROOT,"js/"+file),"utf8").match(re);
  return m?m[1]:fallback;
}
const RES_CHARGE=grab("05-combat.js",/const RES_CHARGE=([\d.]+)/,"2");
const RES_CD=grab("05-combat.js",/const RES_CD=([\d.]+)/,"10");
const RES_REACH=grab("05-combat.js",/const RES_REACH=([\d.]+)/,"3.6");
const RES_PTS=grab("05-combat.js",/const RES_PTS=([\d.]+)/,"25");
const CHARGE_DIST=grab("07-ai.js",/const CHARGE_DIST=([\d.]+)/,"85");
const out=[];
const row=(...c)=>out.push(c.map(v=>v===undefined||v===null?"":String(v)).join(","));
const esc=s=>'"'+String(s).replace(/"/g,'""')+'"';

row("### UNITS — one row per class. Edit numbers; leave id/name/line/rig columns alone.");
row("id","name","hp","dmg","spd","rng","cd_s","cost_food","cost_gold","cost_stone","cost_wood",
    "ranged","mounted","bMult_vs_buildings","uMult_vs_units","splash_radius","heal_rng","heal_rate","line","age_unlock","tier");
for(const id in D.CLS){
  const c=D.CLS[id], k=c.cost||{};
  row(id,c.name,c.hp,c.dmg,c.spd,c.rng,c.cd,k.food||0,k.gold||0,k.stone||0,k.wood||0,
      c.ranged?1:0,c.mounted?1:0,c.bMult||"",c.uMult===undefined?"":c.uMult,c.splash||"",
      c.heal?c.heal.rng:"",c.heal?c.heal.rate:"",c.line,c.age,c.tier);
}
row("");
row("### BUILDINGS — build_hits is the build time (hammer swings to finish; ~0.5s a swing).");
row("id","name","hp","radius","build_hits","cost_food","cost_gold","cost_stone","cost_wood",
    "atk_dmg","atk_rng","atk_cd","vision","heal_rng","heal_rate","age_unlock","is_wall","is_gate");
for(const id in D.BLD){
  const b=D.BLD[id], k=b.cost||{}, a=b.atk||{}, h=b.heal||{};
  row(id,b.name,b.hp,b.r,b.hits,k.food||0,k.gold||0,k.stone||0,k.wood||0,
      a.dmg||"",a.rng||"",a.cd||"",b.vision||"",h.rng||"",h.rate||"",b.age||0,b.wall?1:0,b.gate?1:0);
}
row("");
row("### AGES — the cost to advance INTO each age (paid at the Town Center with T).");
row("index","name","cost_food","cost_gold");
D.AGES.forEach((a,i)=>row(i,a.name,a.cost?a.cost.food:0,a.cost?(a.cost.gold||0):0));
row("age_research_s",D.AGE_RESEARCH_S,esc("v107: T pays now, the age lands this many seconds later (00-data AGE_RESEARCH_S)"));
row("");
row("### COMBAT RULES — the rock-paper-scissors wheel and global combat scalars.");
row("key","value","notes");
row("anticav_vs_mounted",3.8,esc("spears vs any mounted unit — scouts die in 3 hits, same-age cavalry in 4"));
row("ranged_vs_anticav",1.8,esc("archers vs the spear line"));
row("melee_vs_ranged",1.8,esc("swords run down archers (sword tiers only; the musket shot is a projectile)"));
row("melee_vs_anticav",1.25,esc("swords push through spear lines (v84)"));
row("melee_vs_siege",2.0,esc("swords DISMANTLE war engines (v84)"));
row("melee_bldg_mult",1.5,esc("sword tiers vs buildings — bMult in UNITS (v84)"));
row("cavalry_vs_ranged",1.8,esc("cavalry line vs archers"));
row("cavalry_vs_melee",1.5,esc("cavalry DOMINATES the sword line (v84)"));
row("cavalry_vs_siege",1.5,esc("and rides down war engines (v84)"));
row("projectile_vs_siege",0.15,esc("arrows & musket balls barely scratch siege engines (v84)"));
row("scout_vs_economy",4.85,esc("scout line vs villagers/traders/carts — trader dies in 3 hits (v84)"));
row("scout_vs_ranged",1.5,esc("scout line vs archers"));
row("scout_trample_farms",4,esc("scout-line damage multiplier vs farms (05-combat tryMeleeAttack)"));
row("ram_bldg_mult","per-unit",esc("see bMult_vs_buildings in UNITS"));
row("age_buff_per_age",0.06,esc("units are +6% hp/dmg per team age (00-data ageBuff)"));
row("enlightenment_bonus",0.15,esc("extra +15% at the final age"));
row("block_damage_mult",0.3,esc("raised shield takes 30% damage (05-combat dealDamage)"));
row("parry_window_s",0.28,esc("block within this window of the hit = parry (negate + stagger)"));
row("parry_stagger_s",1.2,esc("attacker cooldown after being parried"));
row("pistol_ammo",6,esc("dragoon sidearm rounds — NO regen since v84; re-arming reloads"));
row("pistol_dmg",55,esc("per pistol shot"));
row("castle_volley",5,esc("arrows per castle volley, "+0.15+"s apart, then the atk_cd wind-down (v84)"));
row("pistol_rng",15,esc("pistol range, auto and manual (v84)"));
row("bayonet_dmg",D.CLS.musketeer.bayonet?D.CLS.musketeer.bayonet.dmg:"",esc("musketeer melee stab (v84) — carries the sword-line counters"));
row("bayonet_rng",D.CLS.musketeer.bayonet?D.CLS.musketeer.bayonet.rng:"",esc(""));
row("bayonet_cd_s",D.CLS.musketeer.bayonet?D.CLS.musketeer.bayonet.cd:"",esc(""));
row("");
row("### ECONOMY — gathering, hauling, farming, trade.");
row("key","value","notes");
row("carry_cap",20,esc("max carried per resource run (player and bots)"));
row("oxcart_carry",300,esc("the Ox Cart bed — wood only (00-data carryCap, v99)"));
row("oxcart_gather_mult",4,esc("wood per gather tick for the Ox Cart (09-main/10-net, v99)"));
row("cart_plunder","earned value",esc("killing a loaded ox/trade cart pays its cargo to the killer TEAM (05-combat killUnit, v99)"));
row("player_gather_tick_s",0.6,esc("seconds per +1 gathered by the player (09-main)"));
row("bot_gather_tick_s",0.75,esc("seconds per +1 gathered by AI villagers (07-ai)"));
row("crop_ripen_s",45,esc("farm corn regrowth time (09-main economyTick)"));
row("farm_passive_food_s",+(2/3).toFixed(4),esc("passive food/sec per standing farm (09-main FARM_PASSIVE — v113: 2 food per 3s, up from v86's 0.5)"));
row("farm_harvest_food",20,esc("food per ripe-corn harvest"));
row("trade_gold_linear",0.35,esc("cart pay = 0.35*d + 0.002*d^2 (00-data tradeGold)"));
row("trade_gold_quad",0.002,esc("the deep-route premium"));
row("trader_pay_mult",2.5,esc("a human Trader earns 2.5x the cart rate — host AND guest since v87 (guests wrongly got 4x before)"));
row("market_cap",5,esc("markets per team (06-input validFor)"));
row("respawn_base_s",30,esc("death timer = max(10, 30 - 1*houses) (03-buildings respawnDelay, v84)"));
row("respawn_per_house_s",1,esc("each house shortens the wait"));
row("respawn_min_s",10,esc("the floor"));
row("");
row("### CREEP CAMPS & THE VIKING BAY");
row("key","value","notes");
row("camp_radius",D.CAMP_R,esc("normal camp pocket radius (doubled in v82)"));
row("camp_pack_size","4-5",esc("rolled per wave (07-ai)"));
row("camp_respawn_s",D.CAMP_RESPAWN,esc("wipe -> next pack; unclaimed chest swept"));
row("camp_chest",D.CAMP_CHEST,esc("300 food (wolves) or 300 gold (barbarians)"));
row("camp_regen_pct_per_s",8,esc("calm creeps heal 8%/s (07-ai updateCreep)"));
row("camp_aggro_margin",2.5,esc("aggro ring = pocket radius - this"));
row("boss_radius",D.BOSS_R,esc("the Viking bay pocket"));
row("boss_raid_size",D.BOSS_N,esc("1 chieftain + 10 raiders (unit stats in UNITS)"));
row("boss_respawn_s",D.BOSS_RESPAWN,esc("first raid AND the gap between raids"));
row("boss_chest",D.BOSS_CHEST,esc("TWIN chests: this much food AND gold"));
row("");
row("### PRIEST & COMMAND");
row("key","value","notes");
row("resurrect_charge_s",RES_CHARGE,esc("hold LMB this long to channel (05-combat)"));
row("resurrect_cooldown_s",RES_CD,esc("faith between miracles"));
row("resurrect_reach",RES_REACH,esc("how close the body must be"));
row("resurrect_points",RES_PTS,esc("score for a resurrection"));
row("charge_distance",CHARGE_DIST,esc("how far F hurls the rallied line (07-ai)"));
row("");
row("### SCORING");
row("key","value","notes");
row("deposit_pts_per_resource",1,esc("banking pays 1 pt per resource"));
row("kill_pts","victim cost",esc("a kill pays the victim's total cost (see UNITS costs)"));
row("villager_kill_pts",10,esc("flat"));
row("heal_pts_per_hp",1,esc("priests score per HP mended"));
row("regicide_pts",500,esc("the king's head"));
row("");
row("### QUESTING & THE BLACKSMITH (v87) — the meta-progression dials.");
row("key","value","notes");
row("xp_max_level",D.XP_MAX_LVL,esc("max player level; quests stop at the cap (00-data)"));
row("buff_max_stack",D.BUFF_MAX_STACK,esc("copies of one buff a player may hold"));
row("smith_offer_choices",3,esc("the forge deals this many random buffs; the player picks ONE — the trio stands until chosen (09-main smithOffer, v93)"));
row("quest_draft_choices",3,esc("the board POSTS this many quests; the player takes ONE — the trio stands until chosen (09-main questDraft, v99)"));
row("quest_rerolls_per_level",1,esc("board redraws banked per LEVEL gained (09-main completeQuest, v99 — replaced the 60s reroll cd)"));
row("board_reach",D.BOARD_REACH,esc("E range at the Town Board"));
row("quest_score_per_xp",25,esc("scoreboard points per XP a completed quest pays (09-main completeQuest)"));
row("buff_dmg_pct",5,esc("Honed Edge per stack (05-combat dealDamage)"));
row("buff_atkspd_s",0.1,esc("Quick Hands cooldown cut per stack, floor 0.2s (04-units applyBuffStats)"));
row("buff_crit_pct",5,esc("Keen Eye crit chance per stack; crits hit 2x"));
row("buff_shield_pct",5,esc("Raised Shield damage cut per stack"));
row("buff_hp_pct",5,esc("Stout Heart max-HP per stack"));
row("buff_dodge_pct",5,esc("Sixth Sense dodge chance per stack"));
row("buff_spd",0.5,esc("Fleet Foot move speed per stack"));
row("buff_carry",10,esc("Deep Satchel capacity per stack (base 20)"));
row("buff_gather_s",0.1,esc("Practiced Hands gather-tick cut per stack"));
row("buff_builder_hits",1,esc("Master Builder free hits per stack, once per site"));
row("buff_slayer_pct",15,esc("Wild Slayer vs creeps per stack"));
row("buff_captain_pct",1,esc("Captain's Banner ally damage per stack, 12u radius"));
row("buff_leech_hp",1,esc("Bloodthirst HP per landed hit per stack"));
row("buff_regen_hp_s",0.5,esc("Second Skin per stack after 5 quiet seconds"));
row("buff_bounty_pct",10,esc("Bounty Hunter score premium per stack"));
row("buff_zeal_s",1.5,esc("Zealotry resurrect-cooldown cut per stack, floor 3s"));
row("buff_trade_pct",10,esc("Deep Pockets trade payout per stack"));
row("buff_parry_s",0.07,esc("Duelist parry-window widening per stack"));
row("buff_siege_pct",10,esc("Siegewright crewed-siege damage per stack"));
row("buff_wreck_pct",10,esc("Wrecker vs buildings per stack"));
row("rally_cap",5,esc("G rallies this many nearest soldiers (06-input RALLY_CAP, v89)"));
row("buff_rally",1,esc("Bannerman: extra rallied troops per stack"));
row("");
row("### QUEST LIST — n is the target count, xp the levels+XP paid. Edit n/xp; leave id/ev alone.");
row("id","name","desc","ev","n","xp");
for(const q of D.QUESTS)row(q.id,esc(q.name),esc(q.desc),q.ev,q.n,q.xp);
row("");
row("### BUFF LIST — names & text only (the scalars live in the QUESTING section above).");
row("id","name","desc");
for(const b of D.BUFFS)row(b.id,esc(b.name),esc(b.desc));
row("");
row("### AI PERSONALITIES (v94) — one column per doctrine dial. Edit numbers; leave id/name alone.");
{
  const dials=["ageBufF","ageBufG","farmsBase","farmsPerAge","pits","houses","towers","castles","markets","walls",
    "raidAt","raidEvery","raidJit","raidMin","raidFrac","trainMin","trainMax","minVills","reserveF","reserveG",
    "kgBase","econHunters","assassins"];
  row("id","name",...dials);
  for(const id in D.PERSONALITIES){
    const p=D.PERSONALITIES[id];
    row(id,p.name,...dials.map(k=>p[k]));
  }
  row("");
  row("### AI TRAIN WEIGHTS — army mix per doctrine (higher = more of that line).");
  const lines=["melee","anticav","ranged","cavalry","scoutline","rangedsiege","meleesiege"];
  row("id",...lines);
  for(const id in D.PERSONALITIES)row(id,...lines.map(l=>(D.PERSONALITIES[id].trainW||{})[l]??""));
  row("");
  row("### AI DIFFICULTY (v94) — think = seconds between director thoughts; eco = economy multiplier.");
  row("id","think_s","eco_mult","raid_gap_mult","raid_size_mult","train_gap_mult","age_buffer_mult","counters_your_army");
  for(const id in D.AI_DIFF){const d2=D.AI_DIFF[id];
    row(id,d2.think,d2.eco,d2.raidMul,d2.raidFracMul,d2.trainMul,d2.buf,d2.counter?1:0);}
  row("");
}
row("### STARTING STOCK — each team's opening warchest (00-data stock).");
row("food","gold","stone","wood");
row(D.stock[0].food,D.stock[0].gold,D.stock[0].stone,D.stock[0].wood);
fs.writeFileSync(process.argv[2]||"/dev/stdout",out.join("\n")+"\n");
console.error("exported "+out.length+" rows");
