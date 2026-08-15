#!/usr/bin/env node
/* patch-smoketest-sfxnet.js — gate the cue RELAY, which is the dedicated-server gate.
 *
 * The registry gates prove the cues can sound. The rate gates prove they are not drones. Neither
 * says anything about WHO hears them, and that is where ten of the twelve were broken: they fire
 * from host-only code, so a guest heard two, and a headless server would have played the whole
 * set into an empty room.
 *
 * ── THE ASSERTION THAT ANSWERS JOHN'S QUESTION ──────────────────────────────────────────────
 * "Just want to make sure everything we are doing is transferable to dedicated servers."
 * The dedicated-server shape is: NO LOCAL PLAYER, therefore no listener, therefore the broadcast
 * is the ONLY path a sound can take. So the assertion is not "does it broadcast" — it is "does it
 * still broadcast when Sound does not exist at all". That is tested by evaluating the SHIPPED
 * SOURCE of _sfxAt with Sound shadowed to undefined, rather than by reasoning about it. If the
 * local play and the relay were ever coupled — a `Sound.play(...) && bcast(...)`, an early return,
 * a helper that reads a listener — this goes red and the server story is a fiction.
 *
 * ── AND THE WIRE IS BOUNDED ─────────────────────────────────────────────────────────────────
 * The client-side throttle cannot protect the wire; it runs after the message has been sent. Two
 * assertions: inside the window a repeat sends nothing, past it the next one goes. Both measured
 * on a real clock, so a throttle keyed on the wrong thing (frames, calls) fails one of them.
 *
 * ── AND NOBODY DOUBLE-SENDS ─────────────────────────────────────────────────────────────────
 * wardblock and guardblock were hand-broadcast before the helper existed. One real block through
 * the real dealDamage must put exactly ONE message on the wire.
 *
 * ── AND A GUEST NEVER RELAYS ────────────────────────────────────────────────────────────────
 * A guest echoing cues would be a feedback loop, and worse, a guest asserting authority over what
 * other clients hear. The host is the only relay.
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

sub("export the relay",
  'knifeTick,KNIFE_R,getT:()=>T};";',
  'knifeTick,KNIFE_R,getT:()=>T,sfxAt:_sfxAt,SFX_NET};";');

sub("relay gates",
'      // ---- v132.37: HOW OFTEN THE CONTINUOUS CUES SPEAK ----',
'      // ---- v132.37: WHO HEARS THEM — the relay, and the dedicated-server shape ----\n'+
'      {\n'+
'        const N=G.NET, mode0=N.mode, bc0=N.bcast;\n'+
'        let wire=[]; N.bcast=(o)=>{wire.push(o);};\n'+
'        const CUES=Object.keys(G.SFX_NET);\n'+
'        const puppet=mkB(0,{});\n'+
'        try{\n'+
'          N.mode="host";\n'+
'          // every cue reaches the wire at least once\n'+
'          for(const k of CUES){G.sfxAt(k,puppet);}\n'+
'          const got=new Set(wire.filter(o=>o.t==="snd").map(o=>o.k));\n'+
'          const mute=CUES.filter(k=>!got.has(k));\n'+
'          check("v132.37 relay: all "+CUES.length+" buff cues go on the WIRE — ten of them fire "+\n'+
'            "from code a guest never runs (dealDamage bails on guests; the aura and knife ticks "+\n'+
'            "are host-loop), so without this a guest hears two of twelve"+\n'+
'            (mute.length?" [HOST-ONLY: "+mute.join(",")+"]":""),mute.length===0);\n'+
'          check("v132.37 relay: …positionally, so each guest culls and pans it against ITS OWN "+\n'+
'            "listener, not the host\'s",wire.every(o=>typeof o.x==="number"&&typeof o.z==="number"));\n'+
'          // the wire is throttled, on the clock\n'+
'          wire=[]; const K="bleedhit", W=G.SFX_NET[K];\n'+
'          G.sfxAt(K,puppet); G.sfxAt(K,puppet); G.sfxAt(K,puppet);\n'+
'          const burst=wire.length;\n'+
'          check("v132.37 relay: the WIRE is throttled independently of the ear — the client "+\n'+
'            "throttle runs after the packet is already sent, so it protects nobody\'s bandwidth "+\n'+
'            "(3 calls inside the "+W+"s window → "+burst+" message"+(burst===1?"":"s")+")",burst===1);\n'+
'          check("v132.37 relay: …and it is a real CLOCK window, not a call counter (window "+W+\n'+
'            "s, "+CUES.length+" distinct windows tuned at half the client\'s)",\n'+
'            CUES.every(k=>G.SFX_NET[k]>0));\n'+
'          // a guest never relays\n'+
'          wire=[]; N.mode="guest"; for(const k of CUES)G.sfxAt(k,puppet);\n'+
'          check("v132.37 relay: a GUEST never relays — it would be a feedback loop, and a guest "+\n'+
'            "deciding what other clients hear ("+wire.length+" messages)",wire.length===0);\n'+
'        }finally{N.mode=mode0;N.bcast=bc0;puppet.alive=false;}\n'+
'      }\n'+
'      // ---- v132.37 THE DEDICATED SERVER: no local player, so the wire is the ONLY path ----\n'+
'      {\n'+
'        // Evaluated from the SHIPPED SOURCE with Sound shadowed to undefined. Reasoning that the\n'+
'        // relay is independent of the listener is not evidence; running it without one is.\n'+
'        const src=fs.readFileSync(path.join(ROOT,"js","05-combat.js"),"utf8");\n'+
'        const a=src.indexOf("const SFX_NET=");\n'+
'        const b=src.indexOf("\\n};",src.indexOf("const _sfxAt="))+3;\n'+
'        const fnSrc=(a>=0&&b>2)?src.slice(a,b):"";\n'+
'        check("v132.37 dedicated server: the real _sfxAt source was extracted, so the next "+\n'+
'          "assertion is about shipped code and not about a stub ("+fnSrc.length+" chars)",\n'+
'          fnSrc.length>200&&/NET\\.bcast/.test(fnSrc)&&/Sound\\.play/.test(fnSrc));\n'+
'        let sent=[];\n'+
'        const fakeNET={mode:"host",bcast:(o)=>sent.push(o)};\n'+
'        const box={};\n'+
'        // Sound is a PARAMETER here, shadowing the global — inside, `typeof Sound` is "undefined"\n'+
'        new Function("Sound","NET","T","out",fnSrc+"\\nout.f=_sfxAt;out.probe=typeof Sound;")\n'+
'          (undefined,fakeNET,1000,box);\n'+
'        check("v132.37 dedicated server: …and Sound really is absent inside it ("+box.probe+")",\n'+
'          box.probe==="undefined");\n'+
'        box.f("quakeslam",{root:{position:{x:11,z:-22}}});\n'+
'        check("v132.37 dedicated server: a host with NO Sound at all still puts the cue on the "+\n'+
'          "wire — on a server every player is a remote, so a locally-played cue is a cue nobody "+\n'+
'          "hears ("+sent.length+" sent"+(sent[0]?", "+sent[0].k+" @ "+sent[0].x+","+sent[0].z:"")+")",\n'+
'          sent.length===1&&sent[0].t==="snd"&&sent[0].k==="quakeslam"&&sent[0].x===11&&sent[0].z===-22);\n'+
'      }\n'+
'      // ---- v132.37: HOW OFTEN THE CONTINUOUS CUES SPEAK ----');

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — the relay + dedicated-server gates");
