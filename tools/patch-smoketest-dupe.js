#!/usr/bin/env node
/* patch-smoketest-dupe.js — replace the gate that lied.
 *
 * ── THE GATE THAT PASSED WHILE ITS OWN CLAIM WAS FALSE ──────────────────────────────────────
 * v132.37 shipped this assertion:
 *     "…and not one of them reuses a sound the game already plays (John: no sound reuse)"
 * It compared KEYS. It was green. And seven of the twelve cues were the same recording the game
 * already played: bleedhit WAS gore1 (1.000), wardblock WAS arrowhit1 (1.000), stunhit WAS hit1
 * (0.992), and four more. Different files on disk, different keys, byte-different OGGs after
 * re-encoding — identical audio. A player does not hear a key.
 *   The key check stays, because a literal duplicate key is still a mistake worth catching. What
 * follows it is the assertion that actually means what the sentence says.
 *
 * ── WHY A FROZEN MANIFEST AND NOT A LIVE SCREEN ─────────────────────────────────────────────
 * The honest measurement is 155 OGG decodes and 11,935 FFT comparisons — minutes, not seconds, and
 * it would dominate a suite that currently runs in ninety. So tools/sfxdupe.js --freeze does the
 * work and records the verdict, and these assertions check that the verdict is about THIS audio:
 *   1. the manifest names exactly the keys audio-data.js contains — no more, no fewer
 *   2. every key's content hash matches, so swapping a sound without re-screening goes red rather
 *      than inheriting the old sound's clean bill of health. This is the assertion that makes the
 *      whole scheme honest; without it the manifest is a stale rubber stamp.
 *   3. no pair scored above threshold except the ones argued for in the tool's ALLOWED list
 *
 * ⚠ A MANIFEST THAT DOES NOT EXIST MUST FAIL, NOT SKIP. A missing file is the state after someone
 * deletes it to make a red go away, so it is treated as the loudest possible red.
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

sub("def count",
'  check("v132.37 audio: 151 sound defs registered (79 SFX + 58 vocals + 2 wolf + 12 buff cues)",\n'+
'    Object.keys(A._defs).length===151);',
'  check("v132.38 audio: 155 sound defs registered (79 SFX + 58 vocals + 2 wolf + 16 buff cues)",\n'+
'    Object.keys(A._defs).length===155);');

sub("cue count",
'    check("v132.37 audio: the twelve buff cues are TWELVE — "+sfxKeys.length+" proc sites, "+\n'+
'      new Set(sfxKeys).size+" distinct files",sfxKeys.length===12&&new Set(sfxKeys).size===12);',
'    check("v132.38 audio: the buff cues are SIXTEEN — "+sfxKeys.length+" proc sites, "+\n'+
'      new Set(sfxKeys).size+" distinct keys",sfxKeys.length===16&&new Set(sfxKeys).size===16);');

sub("the waveform gate",
'    check("v132.37 audio: …and not one of them reuses a sound the game already plays "+\n'+
'      "(John: \\"we need to avoid sound reuse\\")"+(reused.length?" [REUSED: "+reused.join(",")+"]":""),\n'+
'      reused.length===0);',
'    check("v132.38 audio: …and no two of them share a KEY with an existing play site"+\n'+
'      (reused.length?" [REUSED: "+reused.join(",")+"]":""),reused.length===0);\n'+
'    // ---- v132.38: THE SAME CLAIM, ABOUT THE AUDIO. The key check above is what shipped in\n'+
'    // v132.37 under the name "no sound reuse". It was green while SEVEN of the twelve cues were\n'+
'    // the same recording the game already played under another key. A player hears waveforms. ----\n'+
'    {\n'+
'      let man=null,err="";\n'+
'      try{man=JSON.parse(fs.readFileSync(path.join(ROOT,"tools","sfx-screen.json"),"utf8"));}\n'+
'      catch(e){err=e.message;}\n'+
'      check("v132.38 no-reuse: the waveform screen exists — a MISSING manifest is the state after "+\n'+
'        "someone deletes it to silence a red, so it fails loudly rather than skipping"+\n'+
'        (man?"":" ["+err+"]"),!!man&&!!man.keys);\n'+
'      if(man&&man.keys){\n'+
'        const crypto=require("crypto");\n'+
'        const live={};\n'+
'        for(const m of sndSrc.matchAll(/"([A-Za-z0-9_]+)":"([A-Za-z0-9+\\/=]*)"/g))\n'+
'          live[m[1]]=crypto.createHash("sha256").update(m[2]).digest("hex").slice(0,16);\n'+
'        const lk=Object.keys(live).sort(), mk=Object.keys(man.keys).sort();\n'+
'        const missing=lk.filter(k=>!man.keys[k]), extra=mk.filter(k=>!live[k]);\n'+
'        check("v132.38 no-reuse: the screen covers exactly the sounds in the bank ("+lk.length+\n'+
'          " embedded, "+mk.length+" screened)"+(missing.length?" [UNSCREENED: "+missing.join(",")+"]":"")+\n'+
'          (extra.length?" [STALE: "+extra.join(",")+"]":""),\n'+
'          missing.length===0&&extra.length===0);\n'+
'        const drift=lk.filter(k=>man.keys[k]&&man.keys[k]!==live[k]);\n'+
'        check("v132.38 no-reuse: …and every hash matches, so the verdict is about THIS audio — "+\n'+
'          "swap a sound without re-running `node tools/sfxdupe.js --freeze` and this goes red "+\n'+
'          "instead of inheriting the old sound\'s clean bill of health"+\n'+
'          (drift.length?" [CHANGED SINCE SCREENING: "+drift.join(",")+"]":""),drift.length===0);\n'+
'        const over=man.over||[];\n'+
'        check("v132.38 no-reuse: NO TWO CUES ARE THE SAME SOUND — all "+\n'+
'          (lk.length*(lk.length-1)/2).toLocaleString("en-US")+" pairs compared by envelope and "+\n'+
'          "spectrum, threshold "+man.threshold+", "+(man.allowed||[]).length+" pairs argued for "+\n'+
'          "in writing (one actor\'s two death cries)"+\n'+
'          (over.length?" [COLLIDES: "+over.map(o=>o.a+"~"+o.b+" "+o.s).join(", ")+"]":""),\n'+
'          over.length===0);\n'+
'      }\n'+
'    }');

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — the no-reuse gate now measures audio");
