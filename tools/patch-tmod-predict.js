#!/usr/bin/env node
/* patch-tmod-predict.js — v132.33: a guest predicts its own timed modifiers.
 *
 * ── THE RULE THIS RESTORES ──────────────────────────────────────────────────────────────────
 * 10-net.js's `bff` handler carries the comment "OUR blacksmith buffs — prediction needs the real
 * speed". That rule was set deliberately: anything affecting how fast the player's own body moves
 * must reach the guest, or its local prediction diverges from the host's truth. v132.32's timed
 * modifiers quietly broke it — they were host-only state feeding a speed multiplier the guest
 * could not see.
 *
 * ── WHAT IT WAS COSTING ─────────────────────────────────────────────────────────────────────
 * Measured against the v128.5 reconciliation: the guest free-runs inside a deadzone (3.2u at
 * ~83ms, widening with lag to a cap of 18u, hard snap at 25u) and past it is pulled home at
 * ~4.5×excess per second. Every drift rate here is slower than that, so the error SETTLES rather
 * than running away — 3.4u to 3.9u at good ping against a 3.2u deadzone that exists anyway. So
 * the magnitude was small: a fifth to two-thirds of a unit. What was not small is the KIND of
 * error: the player crossed from "free-running, never corrected" to "continuously dragged", and
 * LONG STRIDER is a STATE, so a guest holding it lived there for the whole match.
 *
 * ── WHY THE FIX IS SMALL ────────────────────────────────────────────────────────────────────
 * The guest already runs the same `moveUnit`, and the tmod multiplier is inside it. The logic was
 * never missing — only the DATA. So this ships the data and ticks the clock.
 *
 * ── ONE DOOR, AGAIN ─────────────────────────────────────────────────────────────────────────
 * The send lives INSIDE tmodAdd rather than at its five call sites. A call site that forgets to
 * sync is exactly the bug being fixed, and there will be more call sites in batches C-E.
 *
 * ── DEDICATED SERVERS ───────────────────────────────────────────────────────────────────────
 * This is deliberately shaped for the headless authority `tools/headless.js` was written to cost
 * out. The state lives on the unit and is driven by `driveRemote`/the sim, never by a local
 * player; the sync targets `u.remote` and so works identically whether the authority happens to
 * be playing or not. On a dedicated server EVERY player is a remote, so every player gets it —
 * which is precisely why the host-side twin sites matter and why they are kept in step.
 */
const fs=require("fs"),path=require("path");
let failed=[];
function mk(box){
  return function sub(name,from,to){
    const n=box.o.split(from).length-1;
    if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
    box.o=box.o.split(from).join(to);
  };
}
const P={combat:path.join(__dirname,"..","js","05-combat.js"),
         net:path.join(__dirname,"..","js","10-net.js")};
const c={o:fs.readFileSync(P.combat,"utf8")}, n={o:fs.readFileSync(P.net,"utf8")};
const subC=mk(c), subN=mk(n);

// ---------------- the send, inside the one door ----------------
subC("tmodAdd syncs",
`function tmodAdd(u,k,mag,dur,fade,cap){
  if(!u)return;
  if(!u._tmods)u._tmods=[];
  for(const e of u._tmods){
    if(e.k!==k)continue;
    e.mag=cap?Math.min(cap,e.mag+mag):Math.max(e.mag,mag);   // accumulate to a cap, or refresh
    e.t=dur; e.dur=dur; e.fade=!!fade;
    return;
  }
  u._tmods.push({k:k,mag:mag,t:dur,dur:dur,fade:!!fade});
}`,
`function tmodAdd(u,k,mag,dur,fade,cap){
  if(!u)return;
  if(!u._tmods)u._tmods=[];
  for(const e of u._tmods){
    if(e.k!==k)continue;
    e.mag=cap?Math.min(cap,e.mag+mag):Math.max(e.mag,mag);   // accumulate to a cap, or refresh
    e.t=dur; e.dur=dur; e.fade=!!fade;
    tmodSync(u,k,mag,dur,fade,cap);
    return;
  }
  u._tmods.push({k:k,mag:mag,t:dur,dur:dur,fade:!!fade});
  tmodSync(u,k,mag,dur,fade,cap);
}
// v132.33: ship it to the owner so their PREDICTION matches. The send lives in tmodAdd and not at
// its call sites — a call site that forgets to sync is the exact bug this fixes, and batches C-E
// will add more of them. Guests and solo play fall straight through the mode check.
function tmodSync(u,k,mag,dur,fade,cap){
  if(typeof NET==="undefined"||NET.mode!=="host"||!u||!u.remote)return;
  const r=NET.remotes[u.remote]; if(!r||!r.conn)return;
  try{r.conn.send({t:"tmd",k:k,m:mag,d:dur,f:fade?1:0,c:cap||0});}catch(_){}
}
function tmodSyncClear(u){
  if(typeof NET==="undefined"||NET.mode!=="host"||!u||!u.remote)return;
  const r=NET.remotes[u.remote]; if(!r||!r.conn)return;
  try{r.conn.send({t:"tmd",clr:1});}catch(_){}
}`);

// the death wipe must reach the guest too, or a dead player keeps a speed buff on their own screen
subC("clear on death reaches the owner",
`    u._tmods=null; u._lowLatch=false; // v132.32: and the timed modifiers die with the body`,
`    u._tmods=null; u._lowLatch=false; // v132.32: and the timed modifiers die with the body
    if(typeof tmodSyncClear==="function")tmodSyncClear(u); // …on the owner's screen as well as here`);

// ---------------- the guest receives, and ticks ----------------
subN("guest tmd handler",
`  if(d.t==="bff"){ // v87: OUR blacksmith buffs — prediction needs the real speed`,
`  if(d.t==="tmd"){ // v132.33: OUR timed modifiers — prediction needs the real speed, same rule
    if(d.clr){if(typeof player!=="undefined"&&player){player._tmods=null;player._lowLatch=false;}return;}
    if(typeof tmodAdd==="function"&&typeof player!=="undefined"&&player)
      tmodAdd(player,d.k,d.m,d.d,!!d.f,d.c||0);
    return;
  }
  if(d.t==="bff"){ // v87: OUR blacksmith buffs — prediction needs the real speed`);

subN("guest ticks its own tmods",
`  updateEffects(dt);
  updateProjectiles(dt); // pure theatre — damage is host-only`,
`  // v132.33: the guest expires its OWN timed modifiers. Without this the clock never runs on
  // their side and a 2-second buff would last until the next one replaced it.
  if(typeof tmodTick==="function"&&typeof player!=="undefined"&&player)tmodTick(player,dt);
  updateEffects(dt);
  updateProjectiles(dt); // pure theatre — damage is host-only`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(P.combat,c.o); fs.writeFileSync(P.net,n.o);
console.log("patched — a guest now predicts its own timed modifiers");
