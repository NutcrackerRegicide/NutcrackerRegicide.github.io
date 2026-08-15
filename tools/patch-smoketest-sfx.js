#!/usr/bin/env node
/* patch-smoketest-sfx.js — gate the registry, not the file size.
 *
 * ── THE BUG THESE ASSERTIONS EXIST TO CATCH ─────────────────────────────────────────────────
 * I embedded twelve OGGs into SND_DATA, wired twelve Sound.play calls, ran every existing gate
 * green, and had shipped twelve SILENT buffs. SND_DATA is the payload; DEFS is the registry, and
 * BOTH of the audio manager's paths key on DEFS:
 *     loadAll()  iterates `for(const k in DEFS)` — an unregistered key is never decoded
 *     resolve()  returns null when DEFS[name] is undefined — play() bails before touching a buffer
 * Nothing throws. Nothing logs. The bank just gets bigger and the game stays quiet. That is the
 * exact shape of a gate-passing dead feature, so the gate has to be on the RELATIONSHIP between
 * the two tables, not on either one alone.
 *
 * ── THE INVARIANT: DEFS ≡ SND_DATA, BOTH DIRECTIONS ─────────────────────────────────────────
 * Each direction catches a different real mistake:
 *   embedded but unregistered  → the silent-buff bug above
 *   registered but not embedded → falls through to `fetch(DIR+k+".ogg")`, which is gated on
 *                                 location.protocol!=="file:". Works in dev over http, silent
 *                                 from file:// and silent for anyone the service worker is
 *                                 serving offline. A worse bug than the first, because it plays
 *                                 fine on the machine where you test it.
 *
 * ── AND EVERY CALL SITE RESOLVES ────────────────────────────────────────────────────────────
 * Scanned from source, because a typo'd key ("stunhitt") is not a syntax error and would sail
 * through the equality gate above. The scan is checked for NON-VACUITY — a regex that quietly
 * stops matching would otherwise turn this into an assertion about the empty set.
 *   `__chorus` is excluded: it is a sentinel the net handler branches on before ever calling
 *   play(), not a key.
 *
 * ── AND JOHN'S RULE, WRITTEN DOWN AS A TEST ─────────────────────────────────────────────────
 * "We need to avoid sound reuse." Twelve procs, twelve distinct keys, none of them a key the
 * game already plays somewhere else. That is now an assertion instead of an intention.
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

sub("def count + the registry gates",
'  check("v110 audio: 139 sound defs registered (79 SFX + 58 vocals + 2 wolf)",Object.keys(A._defs).length===139);',
'  check("v132.37 audio: 151 sound defs registered (79 SFX + 58 vocals + 2 wolf + 12 buff cues)",\n'+
'    Object.keys(A._defs).length===151);\n'+
'  // ---- v132.37: THE REGISTRY GATE. DEFS is what loadAll() and resolve() key on; SND_DATA is\n'+
'  // only the payload. A key in one and not the other is a sound that never makes a noise, and\n'+
'  // nothing anywhere throws or logs. Both directions, because they are different bugs. ----\n'+
'  {\n'+
'    const sndSrc=fs.readFileSync(path.join(ROOT,"js","audio-data.js"),"utf8");\n'+
'    const embedded=new Set([...sndSrc.matchAll(/"([A-Za-z0-9_]+)":"/g)].map(m=>m[1]));\n'+
'    const defs=Object.keys(A._defs);\n'+
'    const unregistered=[...embedded].filter(k=>!A._defs[k]);\n'+
'    const unembedded=defs.filter(k=>!embedded.has(k));\n'+
'    check("v132.37 audio: every EMBEDDED sound is registered in DEFS — an unregistered key is "+\n'+
'      "never decoded by loadAll() and resolve() returns null for it, so it is 20KB of silence "+\n'+
'      "("+embedded.size+" embedded"+(unregistered.length?", ORPHANED: "+unregistered.join(","):"")+")",\n'+
'      embedded.size>=151&&unregistered.length===0);\n'+
'    check("v132.37 audio: …and every REGISTERED sound is embedded — the fallback is fetch(), "+\n'+
'      "which is disabled on file:// and useless to an offline service-worker client, so this "+\n'+
'      "one plays on the dev machine and nowhere else"+\n'+
'      (unembedded.length?" [MISSING AUDIO: "+unembedded.join(",")+"]":""),unembedded.length===0);\n'+
'    // ---- every call site in the game resolves through the same predicate play() uses ----\n'+
'    const CHORUS="__chorus";   // a net sentinel the handler branches on, never a key\n'+
'    let playKeys=new Set(), sfxKeys=[], netKeys=new Set(), sites=0;\n'+
'    for(const f of fs.readdirSync(path.join(ROOT,"js"))){\n'+
'      if(!/^\\d\\d-.*\\.js$/.test(f))continue;\n'+
'      const t=fs.readFileSync(path.join(ROOT,"js",f),"utf8");\n'+
'      for(const m of t.matchAll(/Sound\\.play\\(\\s*"([A-Za-z0-9_]+)"/g)){playKeys.add(m[1]);sites++;}\n'+
'      for(const m of t.matchAll(/_sfxAt\\(\\s*"([A-Za-z0-9_]+)"/g)){sfxKeys.push(m[1]);sites++;}\n'+
'      for(const m of t.matchAll(/\\{t:"snd",k:"([A-Za-z0-9_]+)"/g))if(m[1]!==CHORUS)netKeys.add(m[1]);\n'+
'    }\n'+
'    const allRefs=[...new Set([...playKeys,...sfxKeys,...netKeys])];\n'+
'    const dead=allRefs.filter(k=>A._resolve(k)===null);\n'+
'    check("v132.37 audio: the scan actually found the call sites — a regex that stopped "+\n'+
'      "matching would make the next assertion a claim about the empty set ("+sites+" literal "+\n'+
'      "play sites, "+allRefs.length+" distinct keys)",sites>=60&&allRefs.length>=40);\n'+
'    check("v132.37 audio: EVERY key the game asks for resolves — a typo\'d key is not a syntax "+\n'+
'      "error, it is a cue that silently never fires"+(dead.length?" [DEAD: "+dead.join(",")+"]":""),\n'+
'      dead.length===0);\n'+
'    // ---- John\'s rule, as a test: no reuse ----\n'+
'    const reused=sfxKeys.filter(k=>playKeys.has(k));\n'+
'    check("v132.37 audio: the twelve buff cues are TWELVE — "+sfxKeys.length+" proc sites, "+\n'+
'      new Set(sfxKeys).size+" distinct files",sfxKeys.length===12&&new Set(sfxKeys).size===12);\n'+
'    check("v132.37 audio: …and not one of them reuses a sound the game already plays "+\n'+
'      "(John: \\"we need to avoid sound reuse\\")"+(reused.length?" [REUSED: "+reused.join(",")+"]":""),\n'+
'      reused.length===0);\n'+
'    // ---- the twelve are spatial, on the sfx bus, and throttled ----\n'+
'    const CUES=[...new Set(sfxKeys)];\n'+
'    const notSpatial=CUES.filter(k=>!A._defs[k]||A._defs[k][1]!==1||A._defs[k][0]!==0||A._defs[k][2]!==0);\n'+
'    check("v132.37 audio: every cue is a one-shot on the sfx bus with 3D placement — each call "+\n'+
'      "site passes {x,z} and a 2D cue would ignore it"+(notSpatial.length?" ["+notSpatial.join(",")+"]":""),\n'+
'      notSpatial.length===0);\n'+
'    const unthrottled=CUES.filter(k=>!(A._throttle[k]>0));\n'+
'    check("v132.37 audio: every cue has a category throttle — the per-unit clocks in combat bound "+\n'+
'      "ONE unit; forty units in one melee are bounded only here"+\n'+
'      (unthrottled.length?" ["+unthrottled.join(",")+"]":""),unthrottled.length===0);\n'+
'  }');

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — the audio registry gate");
