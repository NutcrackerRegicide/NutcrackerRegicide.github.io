#!/usr/bin/env node
/* sfxmix.js — bake COMPOSITE cues, so a shared ingredient stops being a shared sound.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────────────────────
 * tools/sfxdupe.js measured the bank and found that seven of the twelve v132.37 cues are the same
 * recording the game already plays under another key — Blood_Squirt_1 is `gore1`, Arrow_Swoosh_Hit_1
 * is `arrowhit1`, Shield_Bash_Knight_1 is `hit1`, and so on. Different files on disk, different
 * keys, byte-different OGGs, identical audio. The key-level "no reuse" gate passed because it
 * compared names.
 *   John's fix: "if we do have sound reuse combine it with another sound to make it unique."
 * That is what this does. The colliding recording is usually the RIGHT sound for the moment — an
 * arrow really should sound like an arrow — so it stays, and a second element is layered over it
 * that belongs to THIS event and not to the generic one.
 *
 * ── BAKED, NOT PLAYED TWICE ─────────────────────────────────────────────────────────────────
 * The game already layers at runtime (parry + veffort; voxChorus staggers a war-cry). That is
 * fine for two independent things happening at once, and wrong here:
 *     · two voices against the 24-voice cap instead of one, and the cap drops the SECOND one
 *       first, so under load the composite decays into exactly the sound it was meant not to be
 *     · two panners, two distance culls — the layers can separate at the edge of earshot
 *     · setTimeout jitter on the offsets, so the composite is a slightly different sound each time
 * Baking gives one file, one decode, one voice, one panned source, and a waveform that is
 * genuinely new rather than two old ones near each other.
 *
 * ── THE RECIPE FORMAT ───────────────────────────────────────────────────────────────────────
 *   key: [ [file, gain, delayMs, semitones], … ]
 * Layers are mixed with `amix` after each is delayed and (optionally) pitch-shifted. Pitch is done
 * as asetrate+aresample+atempo — a real resample, so it shifts formants too and moves the spectrum
 * rather than just the perceived note. That matters here: the spectral half of the dupe screen is
 * what a pitch-only-in-name shift would fail to move.
 *
 * ⚠ THE OUTPUT IS VERIFIED, NOT ASSUMED. After baking, run:
 *       node tools/sfxdupe.js /tmp/mix/<key>.wav
 *   and it must report `clear` against all 151. A composite that still collides is not done.
 *
 * ⚠ LENGTH IS PART OF THE RECIPE. The chime and orb layers have long decorative tails — mixed
 * raw they produced a 3.6s STUNHIT next to a 0.46s `hit1`, which is not a combat cue, it is a
 * drone with an attack. Every key has a hard cap with a short fade into it, chosen against what
 * the sound it sits beside already costs.
 *
 * ⚠ NORMALISATION IS PEAK, MEASURED, AND LAST. `loudnorm` is programme-material loudness matching
 * and it PUMPS a half-second impact — it works on an integrated window that a transient does not
 * fill. Instead: limit, then measure the true peak with volumedetect and apply one flat gain to
 * land at -1 dBFS. Deterministic, transient-preserving, and it leaves the per-key gains in
 * js/11-audio.js as the only volume control that matters.
 *
 * Usage: node tools/sfxmix.js            bake everything to /tmp/mix
 *        node tools/sfxmix.js bleedhit   bake one
 */
const fs=require("fs"),path=require("path"),cp=require("child_process");
const SRC="/mnt/user-data/uploads/sfx/Empire_Game_24bit/Empire_Game_24bit/Empire_Game_24bit";
const OUT="/tmp/mix";
const W=(p)=>path.join(SRC,p);

// short names for the raw material
const F={
  blood1 :W("Warfare/Empire_Game_Warfare_Blood_Squirt_1_Wet_Squish_Blood_Gore_Impact.wav"),
  blood2 :W("Warfare/Empire_Game_Warfare_Blood_Squirt_2_Wet_Squish_Blood_Gore_Impact.wav"),
  dagger1:W("Warfare/Empire_Game_Warfare_Dagger_1_Knife_Weapon_Slash_Attack.wav"),
  rip    :W("Professions/Empire_Game_Profession_Tailoring_2_Crafting_Rip_Tear_Cloth_Fabric.wav"),
  bash1  :W("Warfare/Empire_Game_Warfare_Shield_Bash_Wood_Metal_Weapon_Impact_Fight_Knight_1.wav"),
  orb3   :W("Settlement_Alerts/Empire_Game_Settlement_Alert_Dark_Subtle_Hit_UI_Menu_Chime_Orb_Touch_3_Metallic_Only.wav"),
  orb1   :W("Settlement_Alerts/Empire_Game_Settlement_Alert_Dark_Subtle_Hit_UI_Menu_Chime_Orb_Touch_1.wav"),
  plate  :W("Warfare/Empire_Game_Warfare_Armor_Movement_Plate_Chainmail_Knight_Foley.wav"),
  leather:W("Warfare/Empire_Game_Warfare_Armor_Movement_Leather_Cloth_Padded_Soldier_Foley.wav"),
  shing  :W("Warfare/Empire_Game_Warfare_Upgrade_Unit_Whooshes_Hit_Shing_1.wav"),
  ping   :W("Warfare/Empire_Game_Warfare_Bow_Release_Ping_Twang.wav"),
  twang2 :W("Warfare/Empire_Game_Warfare_Bow_Release_Twang_Archer_String_2.wav"),
  twang3 :W("Warfare/Empire_Game_Warfare_Bow_Release_Twang_Archer_String_3.wav"),
  arrow1 :W("Warfare/Empire_Game_Warfare_Arrow_Swoosh_Hit_1_Bow_Stick_Impact.wav"),
  block1 :W("Warfare/Empire_Game_Warfare_Metal_Sword_Block_1.wav"),
  clang2 :W("Warfare/Empire_Game_Warfare_Sword_Swoosh_Clang_2_Fight_Knight_Weapon_.wav"),
  clang3 :W("Warfare/Empire_Game_Warfare_Sword_Swoosh_Clang_3_Fight_Knight_Weapon_x2.wav"),
  passby8:W("Warfare/Empire_Game_Warfare_Weapon_Whoosh_Swing_Passby_Sword_Arrow_8_Deep_Slow.wav"),
  wind2  :W("Warfare/Empire_Game_Warfare_Movement_Woosh_Wind_Fly_Transition_2.wav"),
  dagx2  :W("Warfare/Empire_Game_Warfare_Dagger_2_Knife_Weapon_Slash_Attack_x2.wav"),
  bodydrop:W("Warfare/Empire_Game_Warfare_Dead_Body_Drop_1_Cloth_Leather_Impact_Foley_Collapse.wav"),
  jingle :W("Chests_Doors/Empire_Game_Chest_Treasure_Key_Pick_Up_Rustle_Jingle_Collect.wav"),
  coins  :W("Chests_Doors/Empire_Game_Chest_Open_Collect_Loot_Treasure_Coins_Door_Handling_Unlock_1.wav"),
  cshorn :W("Settlement_Selects/Empire_Game_Settlement_Select_Military_Watchtower_Castle_Horn.wav")
};

// key : [ [src, gain, delayMs, semitones], … ]  ·  the comment says what the second layer BUYS
// hard length cap per key, in seconds — measured against the cue each one sits beside
const CAP={bleedhit:0.85,gashcut:0.95,stunhit:1.30,shrugoff:1.05,volleyshot:1.15,wardblock:1.10,
  guardblock:1.00,bighaul:1.60,alert_attack:2.60,dodgeswish:1.00,critstrike:1.00,lastlegs:1.60,cullkill:1.20};

const MIX={
  // ---- the seven that collided with a sound already in the game ----
  bleedhit  :[[F.blood1,1.00,  0, 0],
              [F.blood2,0.62,175,-3]],    // gore1 is ONE wet hit; a bleed is a wound that keeps
                                          // going, so a second, lower pulse follows it
  gashcut   :[[F.dagger1,1.00, 0, 0],
              [F.rip,0.55,     55,-2]],   // swinglight1 is the blade alone. A gash TEARS.
  stunhit   :[[F.bash1,1.00,   0, 0],
              [F.orb3,0.52,    70,-5]],   // hit1 is the bash. The ringing after it is the CONCUSSION.
  shrugoff  :[[F.plate,1.00,   0, 0],
              [F.shing,0.42,   90, 3]],   // deathheavy is armour hitting the ground; a bright shing
                                          // over it turns "he fell" into "it didn't stick"
  volleyshot:[[F.ping,1.00,    0, 0],
              [F.twang2,0.80,115, 1],
              [F.twang3,0.68,232,-1]],    // `block` is one twang. RAPID VOLLEY fires THREE arrows,
                                          // so the cue is three — the sound tells you what happened
  wardblock :[[F.arrow1,1.00,  0, 0],
              [F.orb3,0.48,    60, 2]],   // arrowhit1 is an arrow landing. This one RANG OFF.
  guardblock:[[F.block1,1.00,135,-1],
              [F.clang2,0.72,   0, 0]],   // hit2 is the block. Leading with the swing that got
                                          // turned aside makes it a parry, not an impact — and the
                                          // gap has to be WIDE enough to hear as two events, or the
                                          // screen still reads it as one metal hit (0.941 vs hit4
                                          // at a 90ms gap; the two-part shape is the whole point)
  // ---- four buffs that had no voice at all ----
  dodgeswish:[[F.passby8,1.00, 0,-1],
              [F.leather,0.58, 45, 0]],   // SIXTH SENSE — the blade goes past, and the leather of
                                          // you twisting out of its way
  critstrike:[[F.clang3,1.00,  0, 1],
              [F.shing,0.50,   60, 5]],   // KEEN EYE — the strike, and a bright edge on top of it
  lastlegs  :[[F.wind2,0.90,   0, 2],
              [F.orb1,0.60,    30,-4]],   // SURVIVAL INSTINCT — the adrenaline rush over the dread
  cullkill  :[[F.dagx2,1.00,   0,-1],
              [F.bodydrop,0.72,255,-2]],  // CULLER — two cuts, and it drops
  // ---- a PRE-EXISTING collision, not one of mine: `bighaul`, `cannonhit` and `alert_attack`
  // have been three keys on one recording since v104. A good trade payout has sounded exactly
  // like a cannonball landing on you, which is not a cosmetic complaint — those two events want
  // opposite reactions. cannonhit keeps the recording (it is right for a cannon); the other two
  // become what they are actually about. ----
  bighaul   :[[F.coins,1.00,   0, 1],
              [F.jingle,0.70,  90, 2]],   // money. Not artillery.
  // ONE layer, and that is the honest recipe: alert_attack never needed layering, it needed the
  // right recording. It fires once a match, latched on `victim.warned`, for "YOUR KING IS BADLY
  // WOUNDED" — the most dramatic line the game prints. It was sharing a take with a cannonball.
  alert_attack:[[F.cshorn,1.00,0,-2]]     // the watchtower horn, dropped two semitones into alarm
};

const semi=(n)=>Math.pow(2,n/12);
function bake(key){
  const layers=MIX[key];
  const ins=[], filt=[];
  layers.forEach((L,i)=>{
    const [file,gain,delayMs,st]=L;
    if(!fs.existsSync(file))throw new Error("missing source for "+key+": "+file);
    ins.push("-i",file);
    const r=semi(st||0);
    // asetrate resamples (pitch AND formants move — a real shift, not a note relabel), aresample
    // brings it back to 44.1k, atempo undoes the length change so the delays stay honest
    const pitch=st?`asetrate=44100*${r.toFixed(6)},aresample=44100,atempo=${r.toFixed(6)},`:"";
    filt.push(`[${i}:a]aformat=channel_layouts=mono,aresample=44100,${pitch}`+
              `adelay=${Math.round(delayMs)}|${Math.round(delayMs)},volume=${gain}[a${i}]`);
  });
  const cap=CAP[key]||1.2, fade=Math.min(0.14,cap*0.18);
  filt.push(layers.map((_,i)=>`[a${i}]`).join("")+
    `amix=inputs=${layers.length}:duration=longest:dropout_transition=0:normalize=0,`+
    `alimiter=limit=0.95,atrim=0:${cap.toFixed(3)},`+
    `afade=t=out:st=${(cap-fade).toFixed(3)}:d=${fade.toFixed(3)},aresample=44100[out]`);
  const raw=path.join(OUT,key+".raw.wav"), out=path.join(OUT,key+".wav");
  cp.execSync(["ffmpeg","-loglevel","error","-y",...ins.map(x=>JSON.stringify(x)),
    "-filter_complex",JSON.stringify(filt.join(";")),"-map",'"[out]"',"-ac","1","-ar","44100",
    JSON.stringify(raw)].join(" "));
  // MEASURE the peak, then one flat gain to -1 dBFS. No loudness filter anywhere near a transient.
  const det=cp.execSync(`ffmpeg -loglevel info -i ${JSON.stringify(raw)} -af volumedetect -f null - 2>&1`,
    {shell:"/bin/bash"}).toString();
  const mx=parseFloat((det.match(/max_volume:\s*(-?[\d.]+) dB/)||[])[1]);
  const gain=isFinite(mx)?(-1-mx):0;
  cp.execSync(`ffmpeg -loglevel error -y -i ${JSON.stringify(raw)} -af volume=${gain.toFixed(2)}dB `+
    `-ac 1 -ar 44100 ${JSON.stringify(out)}`);
  fs.unlinkSync(raw);
  return {out,gain};
}

fs.mkdirSync(OUT,{recursive:true});
const only=process.argv[2];
const keys=only?[only]:Object.keys(MIX);
for(const k of keys){
  if(!MIX[k]){console.error("no recipe for "+k);process.exit(1);}
  const {out:o,gain}=bake(k);
  const dur=cp.execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 ${JSON.stringify(o)}`).toString().trim();
  console.log("  "+k.padEnd(12)+MIX[k].length+" layers  "+(+dur).toFixed(2)+"s  cap "+
    (CAP[k]||1.2)+"s  norm "+(gain>=0?"+":"")+gain.toFixed(1)+"dB");
}
console.log("\nbaked "+keys.length+" to "+OUT+" — now SCREEN them:\n  node tools/sfxdupe.js "+
  keys.map(k=>OUT+"/"+k+".wav").join(" "));
