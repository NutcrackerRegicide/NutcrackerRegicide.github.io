#!/usr/bin/env node
/* patch-sfx-defs.js — v132.37: REGISTER the twelve new cues. Without this they are silent.
 *
 * ── THE BUG THIS FIXES, WHICH I SHIPPED AND CAUGHT ──────────────────────────────────────────
 * tools/sfxadd.js put twelve base64 OGGs into SND_DATA, and patch-buff-sounds.js wired twelve
 * Sound.play calls. Every gate was green and NOT ONE OF THEM WOULD HAVE MADE A NOISE, because
 * SND_DATA is not the registry — DEFS is:
 *     loadAll()  iterates `for(const k in DEFS)` and decodes SND_DATA[k]. A key absent from DEFS
 *                is never decoded, so S.buf[key] never exists.
 *     resolve()  returns null when DEFS[name] is undefined, so play() returns
 *                {play:false,reason:"unknown"} and returns before it ever touches a buffer.
 * Two independent gates, both keyed on DEFS. Embedding audio without registering it is a no-op
 * that leaves the file 350KB heavier and the game exactly as quiet as before.
 *
 * ── THE FOUR NUMBERS ────────────────────────────────────────────────────────────────────────
 * DEFS[k] = [bus, spatial, loop, gain]. All twelve are bus 0 (sfx), spatial 1 (every call site
 * passes {x,z}), loop 0. Only the gain is a judgement, and it is made against what is already in
 * the table: hit 0.9, block 0.85, parry 0.95, swing 0.8. These sit UNDER the blow that carries
 * them, except the three that ARE the moment — the stun, the slam and the two blocks.
 *
 * ── THROTTLE AND CAP ARE NOT DECORATION ─────────────────────────────────────────────────────
 * catOf() strips trailing digits; none of these keys end in one, so category == key and each
 * throttles independently. The per-unit clocks already in 05-combat.js bound how often ONE unit
 * fires a cue; they say nothing about forty units doing it at once in the same melee. The
 * category throttle is the only thing standing between a big fight and a wall of squelch.
 *   CAPPED joins the 24-voice budget: the frequent ones yield to it, the rare ones bypass it,
 *   because a block or a slam that gets dropped for a crowd of bleed ticks is the wrong trade.
 *
 * ⚠ ORDERING. The DEFS entries go in BEFORE the GROUPS pass and before the vocal auto-throttle
 * sweep, both of which walk DEFS. The sweep matches any key starting with "v" that is not "vo",
 * which catches `venomhit` — harmless, since it would set exactly the cap this patch sets and a
 * throttle only if none existed, and this patch sets one explicitly.
 */
const fs=require("fs"),path=require("path");
const F=path.join(__dirname,"..","js","11-audio.js");
let s=fs.readFileSync(F,"utf8");
let failed=[];
function sub(name,from,to){
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
}

sub("DEFS entries",
'  const BUSNAME=["sfx","ambience"];',
'  // ---- v132.37 THE BUFF CUES. Twelve triggered buffs, twelve distinct Epic Stock Media files.\n'+
'  // Registered here or they do not exist: loadAll() and resolve() both key on DEFS, not SND_DATA.\n'+
'  DEFS["bleedhit"]  =[0,1,0,0.70];   // wet squirt — rides UNDER the impact that opened the wound\n'+
'  DEFS["venomhit"]  =[0,1,0,0.70];   // potion bubble\n'+
'  DEFS["gashcut"]   =[0,1,0,0.70];   // dagger slash, on the FIRST application only\n'+
'  DEFS["stunhit"]   =[0,1,0,1.00];   // shield bash — the biggest melee moment in the game, so it\n'+
'                                     // is the loudest of the twelve. It borrowed "hit" before.\n'+
'  DEFS["shrugoff"]  =[0,1,0,0.75];   // plate/chainmail foley — relief, and it needs to be heard\n'+
'  DEFS["sear"]      =[0,1,0,0.60];   // a burn that never stops: the quietest of the twelve\n'+
'  DEFS["knifethrow"]=[0,1,0,0.75];   // woosh\n'+
'  DEFS["volleyshot"]=[0,1,0,0.85];   // bow release — once every ten seconds at best, so it lands\n'+
'  DEFS["wardblock"] =[0,1,0,0.90];   // arrow turned aside — priced like parry (0.95), just under\n'+
'  DEFS["guardblock"]=[0,1,0,0.90];   // blow turned aside\n'+
'  DEFS["sanctuary"] =[0,1,0,0.80];   // harp tone, on the OPENING of the zone\n'+
'  DEFS["quakeslam"] =[0,1,0,1.00];   // ground rumble — a 5% proc that hits everything around you\n'+
'  const BUSNAME=["sfx","ambience"];');

sub("throttles",
'    armup_infantry:300,armup_cavalry:300,armup_civilian:300};',
'    armup_infantry:300,armup_cavalry:300,armup_civilian:300,\n'+
'    // v132.37 the buff cues. The per-unit clocks in 05-combat.js bound ONE unit; forty units in\n'+
'    // one melee are bounded only here. sear is already gated to 2.5s per holder — this stops a\n'+
'    // dozen holders from turning that into a continuous hiss. sanctuary is a near-unique event.\n'+
'    bleedhit:200,venomhit:200,gashcut:200,stunhit:150,shrugoff:250,sear:600,\n'+
'    knifethrow:150,volleyshot:120,wardblock:120,guardblock:120,sanctuary:900,quakeslam:250};');

sub("voice cap",
'    wolfbite:1}; // v110: bites join the cap; the HOWL stays uncapped — atmosphere that always lands',
'    wolfbite:1, // v110: bites join the cap; the HOWL stays uncapped — atmosphere that always lands\n'+
'    // v132.37: the FREQUENT cues yield to the 24-voice budget. The rare ones do not — a block or\n'+
'    // a slam dropped to make room for a crowd of bleed ticks is exactly the wrong trade.\n'+
'    bleedhit:1,venomhit:1,gashcut:1,stunhit:1,knifethrow:1,sear:1};');

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched js/11-audio.js — twelve cues registered (DEFS + throttle + cap)");
