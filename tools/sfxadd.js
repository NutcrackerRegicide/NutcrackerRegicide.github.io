#!/usr/bin/env node
/* sfxadd.js — v132.37: embed new Epic Stock Media cues into js/audio-data.js.
 *
 * The audio bank is `const SND_DATA={ "key":"<base64 ogg vorbis>" , ... }` in js/audio-data.js —
 * 139 sounds, 3.80 MB of base64, median entry ~19 KB. This adds twelve more, encoded to match
 * that budget (mono, 44.1k, libvorbis -q:a 1 lands each one at 17-20 KB) so the cold-load cost
 * moves by ~0.3 MB rather than by a multiple.
 *
 * ⚠ IDEMPOTENT BY KEY. Re-running replaces an existing key rather than appending a duplicate —
 * a second copy would both bloat the file and shadow the first depending on object order.
 *
 * ⚠ EVERY CUE IS ITS OWN FILE. John's instruction was explicitly to avoid reuse, so no key here
 * points at a sound the game already plays, and no two keys point at the same source.
 *
 * Licence: these are Epic Stock Media assets from the Empire Game library John purchased. Their
 * use inside the game is what §1.1/1.2 of the EULA grants. See the handoff for the separate and
 * still-open question of the raw files being downloadable from a PUBLIC repository.
 *
 * ── TWO MODES ───────────────────────────────────────────────────────────────────────────────
 * The MAP below names raw library files by key. `--dir <d>` instead embeds every `<key>.wav` in a
 * directory, which is how the baked composites from tools/sfxmix.js get in: they are not library
 * files and have no catalogue path, they are new audio this project made.
 *
 * ⚠ REPLACING IS THE POINT, NOT A SIDE EFFECT. Seven of the v132.37 keys already exist and hold
 * the un-layered recording that tools/sfxdupe.js caught colliding with `gore1`, `hit1`, `arrowhit1`
 * and friends. Re-running over them with the composites is the fix.
 *
 * Usage: node tools/sfxadd.js                 (library MAP -> js/audio-data.js)
 *        node tools/sfxadd.js --dir /tmp/mix  (every <key>.wav in a directory)
 */
const fs=require("fs"),path=require("path"),cp=require("child_process");
const ROOT=path.join(__dirname,"..");
const SRC="/mnt/user-data/uploads/sfx/Empire_Game_24bit/Empire_Game_24bit/Empire_Game_24bit";
const OGG="/tmp/ogg";

// key -> source wav (relative to SRC). One source per key, no key reused.
const MAP={
  bleedhit  :"Warfare/Empire_Game_Warfare_Blood_Squirt_1_Wet_Squish_Blood_Gore_Impact.wav",
  gashcut   :"Warfare/Empire_Game_Warfare_Dagger_1_Knife_Weapon_Slash_Attack.wav",
  shrugoff  :"Warfare/Empire_Game_Warfare_Armor_Movement_Plate_Chainmail_Knight_Foley.wav",
  sear      :"Warfare/Empire_Game_Warfare_Flame_Shot_Slide_1.wav",
  knifethrow:"Warfare/Empire_Game_Warfare_Throwing_Dagger_Woosh_Knife_Weapon.wav",
  volleyshot:"Warfare/Empire_Game_Warfare_Bow_Release_Ping_Twang.wav",
  wardblock :"Warfare/Empire_Game_Warfare_Arrow_Swoosh_Hit_1_Bow_Stick_Impact.wav",
  guardblock:"Warfare/Empire_Game_Warfare_Metal_Sword_Block_1.wav",
  stunhit   :"Warfare/Empire_Game_Warfare_Shield_Bash_Wood_Metal_Weapon_Impact_Fight_Knight_1.wav",
  venomhit  :"Professions/Empire_Game_Profession_Alchemy_1_Potion_Bubble_Science_Experiment.wav",
  sanctuary :"Professions/Empire_Game_Profession_Enchanting_1_Crafting_Paper_Book_Harp_Tone_Magic.wav",
  quakeslam :"Settlement_Alerts/Empire_Game_Settlement_Alert_Disaster_Earthquake_Nature_Landslide_Ground_Rumble_Destruction.wav"
};

fs.mkdirSync(OGG,{recursive:true});
// --dir <d>: every <key>.wav in d. Otherwise the library MAP above.
const di=process.argv.indexOf("--dir");
const SOURCES={};
if(di>=0){
  const d=process.argv[di+1];
  if(!d||!fs.existsSync(d)){console.error("no such dir:",d);process.exit(1);}
  for(const f of fs.readdirSync(d))if(/\.wav$/i.test(f))SOURCES[f.replace(/\.wav$/i,"")]=path.join(d,f);
  if(!Object.keys(SOURCES).length){console.error("no .wav in",d);process.exit(1);}
}else for(const key in MAP)SOURCES[key]=path.join(SRC,MAP[key]);

const b64={};
for(const key in SOURCES){
  const wav=SOURCES[key];
  if(!fs.existsSync(wav)){console.error("MISSING SOURCE:",wav);process.exit(1);}
  const out=path.join(OGG,key+".ogg");
  cp.execSync('ffmpeg -loglevel error -y -i '+JSON.stringify(wav)+
              ' -ac 1 -ar 44100 -c:a libvorbis -q:a 1 '+JSON.stringify(out));
  b64[key]=fs.readFileSync(out).toString("base64");
}

const F=path.join(ROOT,"js","audio-data.js");
let s=fs.readFileSync(F,"utf8");
const before=s.length;
let added=0,replaced=0;
for(const key in b64){
  const re=new RegExp('"'+key+'":"[A-Za-z0-9+/=]*",?');
  if(re.test(s)){ s=s.replace(re,'"'+key+'":"'+b64[key]+'",'); replaced++; }
  else{ s=s.replace(/^const SND_DATA=\{/, 'const SND_DATA={\n"'+key+'":"'+b64[key]+'",'); added++; }
}
fs.writeFileSync(F,s);
const kb=(n)=>(n/1024).toFixed(0)+"KB";
console.log("added "+added+", replaced "+replaced);
console.log("audio-data.js "+kb(before)+" -> "+kb(s.length)+"  (+"+kb(s.length-before)+")");
for(const k in b64)console.log("  "+k.padEnd(11)+kb(b64[k].length));
