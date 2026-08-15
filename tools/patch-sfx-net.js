#!/usr/bin/env node
/* patch-sfx-net.js — v132.37: put the buff cues ON THE WIRE, which is also the dedicated-server fix.
 *
 * ── THE PROBLEM, WHICH IS JOHN'S DEDICATED-SERVER QUESTION IN DISGUISE ──────────────────────
 * Ten of the twelve cues fire from code that only ever runs on the host:
 *     dealDamage()     returns early on guests — "host owns all damage" (05-combat.js:633)
 *     auraBuffTick()   and knifeTick() are driven from the host unit loop
 * So a GUEST — which is most players in a PvP match — heard two of the twelve. That is the same
 * shape as the dual-site trap in the handoff, and 05-combat.js already documents the older half
 * of it: "(host/solo only — dealDamage returns early on guests; their impacts ride swings &
 * deaths)". Impacts get away with it because a guest's swing and death cues cover for them. A
 * bleed proc has nothing covering for it. It is simply missing.
 *
 * AND IT GETS WORSE ON A SERVER. On a dedicated server there is no local player at all — every
 * player is a remote. A cue that is only ever played locally is a cue that NOBODY hears, and the
 * whole sound bank goes quiet the day the host stops being a player. That is not a future
 * problem to note in a handoff; it is the reason to fix this now rather than later.
 *
 * ── THE FIX: ONE PATH, PLAY LOCALLY *AND* BROADCAST ─────────────────────────────────────────
 * _sfxAt now does both, so there is no second site to forget. On a listening host that is a local
 * play plus a broadcast; on a headless server `typeof Sound==="undefined"` makes the local play a
 * no-op and the broadcast is the only path — which is exactly right, and needs no server-specific
 * branch. The guest handler for {t:"snd"} already exists, is generic over the key, and distance-
 * culls on receipt via gainForDist, so a cue from a fight across the map costs a guest nothing.
 *
 * ── WHY A HOST-SIDE THROTTLE, GIVEN THE CLIENT ALREADY HAS ONE ──────────────────────────────
 * The client's category throttle protects a client's EARS. It does nothing for the wire, because
 * the message is already sent by the time it applies. Forty units bleeding in one melee is forty
 * messages a second for a cue the receiver will drop thirty-five of.
 *   The windows here are HALF the client's, deliberately. Equal windows would mean the host's own
 *   ears decide what guests may hear; half means guests receive a slightly denser stream than the
 *   host plays and their own throttle — evaluated at THEIR position, against THEIR listener —
 *   thins it. The host is a relay here, not an authority on what sounds good.
 *
 * ⚠ THE TWO EXPLICIT BROADCASTS COME OUT. wardblock and guardblock were hand-broadcast in
 * patch-buff-sounds.js. Leaving them would double-send now that the helper does it.
 *
 * ⚠ T CAN GO BACKWARDS between matches. A stale forward stamp would mute a cue until the clock
 * caught up, so a negative delta is treated as "ready" rather than "not yet".
 */
const fs=require("fs"),path=require("path");
const F=path.join(__dirname,"..","js","05-combat.js");
let s=fs.readFileSync(F,"utf8");
let failed=[];
function sub(name,from,to){
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
}

sub("the relay helper",
'// v132.37: every triggered buff has its own cue. Positional, so the existing panner places it.\n'+
'const _sfxAt=(k,u)=>{if(typeof Sound!=="undefined"&&u&&u.root)Sound.play(k,{x:u.root.position.x,z:u.root.position.z});};',
'// v132.37: every triggered buff has its own cue. Positional, so the existing panner places it.\n'+
'// ONE path for all twelve: play it here, and put it on the wire. Ten of the twelve fire from\n'+
'// host-only code (dealDamage bails on guests; auraBuffTick and knifeTick run in the host loop),\n'+
'// so without the broadcast a guest hears almost none of them — and a DEDICATED SERVER, which has\n'+
'// no local player at all, would play the whole set to an empty room.\n'+
'// Half the client-side category window: the host relays a slightly denser stream than it plays,\n'+
'// and each guest thins it with its own throttle, judged at its own position. See js/11-audio.js.\n'+
'const SFX_NET={bleedhit:0.10,venomhit:0.10,gashcut:0.10,stunhit:0.075,shrugoff:0.125,sear:0.30,\n'+
'  knifethrow:0.075,volleyshot:0.06,wardblock:0.06,guardblock:0.06,sanctuary:0.45,quakeslam:0.125};\n'+
'const _sfxLast={};\n'+
'const _sfxAt=(k,u)=>{\n'+
'  if(!u||!u.root)return;\n'+
'  const x=u.root.position.x, z=u.root.position.z;\n'+
'  if(typeof Sound!=="undefined")Sound.play(k,{x,z});          // silent on a headless server\n'+
'  if(typeof NET!=="undefined"&&NET.mode==="host"&&NET.bcast&&typeof T!=="undefined"){\n'+
'    const d=T-(_sfxLast[k]!==undefined?_sfxLast[k]:-1e9);     // d<0 = the clock restarted\n'+
'    if(d<0||d>=(SFX_NET[k]||0)){_sfxLast[k]=T;NET.bcast({t:"snd",k,x,z});}\n'+
'  }\n'+
'};');

sub("drop the hand-rolled ward broadcast",
'        _sfxAt("wardblock",victim);\n'+
'        // broadcast, for the same reason a parry is: the archer whose shot was stopped should\n'+
'        // hear it, and on their screen it happened to somebody else.\n'+
'        if(typeof NET!=="undefined"&&NET.mode==="host")\n'+
'          NET.bcast({t:"snd",k:"wardblock",x:victim.root.position.x,z:victim.root.position.z});\n',
'        _sfxAt("wardblock",victim);   // v132.37: _sfxAt relays it — the archer whose shot was\n'+
'                                      // stopped should hear it, and on their screen it happened\n'+
'                                      // to somebody else. (Was hand-broadcast here; that would\n'+
'                                      // double-send now.)\n');

sub("drop the hand-rolled guard broadcast",
'        _sfxAt("guardblock",victim);\n'+
'        if(typeof NET!=="undefined"&&NET.mode==="host")\n'+
'          NET.bcast({t:"snd",k:"guardblock",x:victim.root.position.x,z:victim.root.position.z});\n',
'        _sfxAt("guardblock",victim);  // v132.37: relayed by _sfxAt, as above\n');

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched js/05-combat.js — the twelve cues now reach guests, and a dedicated server");
