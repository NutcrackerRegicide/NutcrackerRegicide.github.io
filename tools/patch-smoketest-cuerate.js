#!/usr/bin/env node
/* patch-smoketest-cuerate.js — gate HOW OFTEN the two continuous buffs speak.
 *
 * The registry gates prove the twelve cues can make a noise. They say nothing about how often,
 * and for two of the twelve that is the entire design question:
 *
 *   SANCTUARY  rides auraBuffTick, which scans at 4 Hz for as long as the zone is open. Wired
 *              naively that is four harp tones a second, forever. It is latched on _zoneWasOpen
 *              so it belongs to the MOMENT the zone opens.
 *   SEARING    burns every scan too, so its cue is throttled on the game clock to ~2.5s.
 *
 * Both are the same failure: a cue that is correct in every other respect and is a DRONE in play.
 * You cannot see it in a registry check or a damage assertion — only by counting calls. So these
 * assertions spy on Sound.play and count.
 *
 * ⚠ THE FROZEN CLOCK IS THE POINT, NOT A LIMITATION. The harness drives auraBuffTick directly, so
 * T does not advance. That makes the sear assertion sharp rather than vague: with the clock
 * stopped a correctly-throttled cue fires EXACTLY ONCE no matter how many scans run, and a cue
 * that is not throttled on the clock at all fires on every one of them. The re-arm is then proved
 * separately by winding _searT back by hand.
 *
 * ⚠ The spy is installed on the Sound object the game actually holds (const Sound = IIFE), so
 * _sfxAt's `Sound.play(...)` property lookup finds it. It is restored in a finally.
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

sub("cue-rate gates",
'      // KINSHIP — a soldier of your OWN KIND, not merely any ally',
'      // ---- v132.37: HOW OFTEN THE CONTINUOUS CUES SPEAK ----\n'+
'      {\n'+
'        const A=G.Sound, real=A.play;\n'+
'        const heard={}; A.play=(k)=>{heard[k]=(heard[k]||0)+1;return true;};\n'+
'        try{\n'+
'          // SANCTUARY: one tone per OPENING, not four a second for as long as you stand there\n'+
'          const holy=mkB(0,{sanctuary:1});\n'+
'          holy.moving=false; scan(holy,8);            // 3s to open + 5s of open zone = ~32 scans\n'+
'          check("v132.37 SANCTUARY cue: ONE harp tone for the opening, not one per 4 Hz scan — "+\n'+
'            "eight seconds of standing still produced "+(heard.sanctuary||0)+" (32 scans)",\n'+
'            heard.sanctuary===1);\n'+
'          holy.moving=true; scan(holy,1);             // walking shuts the zone\n'+
'          holy.moving=false; scan(holy,6);            // and standing again re-opens it\n'+
'          check("v132.37 SANCTUARY cue: …and it speaks AGAIN when the zone re-opens, so the latch "+\n'+
'            "is a latch and not a one-shot ("+(heard.sanctuary||0)+" total)",heard.sanctuary===2);\n'+
'          holy.alive=false;\n'+
'          // SEARING: throttled on the game CLOCK. With T frozen a correct throttle yields exactly\n'+
'          // one, and a cue that is not clock-throttled yields one per scan.\n'+
'          const burn=mkB(0,{brand:1});\n'+
'          const foe=mkB(1,{}); foe.root.position.set(burn.root.position.x+2,0,burn.root.position.z);\n'+
'          foe.hp=foe.maxHp*50;                        // deep enough to survive the whole burn\n'+
'          scan(burn,6);                               // 24 scans, clock stopped\n'+
'          check("v132.37 SEARING cue: a continuous burn is a periodic SIZZLE, not a buzz — 24 "+\n'+
'            "scans on a frozen clock produced "+(heard.sear||0)+", not 24",heard.sear===1);\n'+
'          burn._searT=G.getT()-3;                     // wind the clock past the 2.5s window\n'+
'          scan(burn,1);\n'+
'          check("v132.37 SEARING cue: …and it RE-ARMS once the window passes, so it is throttled "+\n'+
'            "and not latched off ("+(heard.sear||0)+" total)",heard.sear===2);\n'+
'          foe.alive=false; burn.alive=false;\n'+
'        }finally{A.play=real;}\n'+
'      }\n'+
'      // KINSHIP — a soldier of your OWN KIND, not merely any ally');

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — cue-rate gates");
