#!/usr/bin/env node
/* patch-tmods-public.js — v132.43: the other half of "guests should know what other units hold".
 *
 * ── WHAT I DELIVERED, AND WHAT I LEFT ───────────────────────────────────────────────────────
 * v132.40 made every player's BUFFS public. But a unit carries two kinds of thing, and the second
 * one — the timed modifiers: bleed, poison, stun, healblock, speed, flat damage — was still going
 * to exactly ONE connection. tmodSync's own comment says why it was written that way: "ship it to
 * the owner so their PREDICTION matches." That was the right fix for the problem it solved and it
 * left the general one open, in precisely the shape v132.40 later closed for buffs.
 *
 * ── WHAT THIS UNBLOCKS, AND WHAT IT DOES NOT ────────────────────────────────────────────────
 * KILLING FRENZY and BLOODRUSH were explicitly deferred in v132.42 for this reason — both are
 * read off a timed modifier, so on a guest they would have drawn for you and for nobody else.
 *   It does NOT change what a guest can SEE of a stun or a bleed: v132.41 already relays those as
 * events and draws them everywhere. This is about the magnitudes and the clocks, which an event
 * cannot carry.
 *
 * ── THE 5 Hz ROW, AND WHY THE CLOCK IS NOT IN IT TWICE ──────────────────────────────────────
 * [unitId, [kindIdx, mag*100, remaining*100, fade], …] on the scoreboard branch. The remaining
 * time only needs to ARRIVE; between arrivals a guest ticks it down itself — the same reasoning
 * the age-research countdown already uses two fields further up the same builder.
 *
 * ⚠ THE LOCAL PLAYER IS DELIBERATELY EXCLUDED ON THE GUEST SIDE. It already has the private
 * {t:"tmd"} channel, which arrives immediately rather than at 5 Hz, and that immediacy is what
 * made guest prediction match the host in v132.33. Overwriting it here would replace a
 * fixed-drift path with a stepped one, five times a second, to no benefit — the values are
 * identical because both come from the same host in the same tick.
 *
 * ⚠ COMPLETE, NOT SPARSE. Every human gets a row, including one with nothing on it, so a guest
 * can tell "cleared" from "not mentioned". Third time this trap has come up — the ring rows and
 * the loadouts both needed the same thing — and it is the same fix each time.
 *
 * PROTO 43 → 44.
 */
const fs=require("fs"),path=require("path");
let failed=[];
function mk(box){return function(name,from,to){
  const n=box.o.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  box.o=box.o.split(from).join(to);};}
const P={net:path.join(__dirname,"..","js","10-net.js"),
         comb:path.join(__dirname,"..","js","05-combat.js")};
const n={o:fs.readFileSync(P.net,"utf8")}, c={o:fs.readFileSync(P.comb,"utf8")};
const subN=mk(n), subC=mk(c);

subC("the wire vocabulary for kinds",
`const TMOD_LOW=0.25;   // the SURVIVAL INSTINCT line`,
`const TMOD_LOW=0.25;   // the SURVIVAL INSTINCT line
// v132.43: the kinds, in a FIXED order, because the wire ships an index rather than a name.
// Appending is safe; reordering is a PROTO change. Same contract as the BUFFS index in v132.40.
const TMOD_KINDS=["bleed","poison","stun","healblock","spdmul","dmgflat"];`);

subN("PROTO 44",
`  PROTO:43,             // v132.41 the batched set-piece channel (s.vfx). Was:`,
`  PROTO:44,             // v132.43 public timed modifiers (s.tm) — the other half of "a client
                        // knows what other units are carrying". Was:
                        // v132.41 the batched set-piece channel (s.vfx). Was:`);

subN("host ships them",
`    NET._arLast=_ar.length;
  }`,
`    NET._arLast=_ar.length;
    // v132.43 EVERY PLAYER'S TIMED MODIFIERS, on this same 5 Hz branch. The remaining time only
    // needs to ARRIVE — a guest ticks it down itself between arrivals, the same way the
    // age-research countdown two fields up already works.
    if(typeof TMOD_KINDS!=="undefined"){
      const _tm=[];
      const _tmRow=(x)=>{ if(!x||!x.alive)return;
        const packed=[]; const a=x._tmods||[];
        for(const e of a){ const i=TMOD_KINDS.indexOf(e.k); if(i<0)continue;
          packed.push(i,Math.round(e.mag*100),Math.round(Math.max(0,e.t)*100),e.fade?1:0); }
        _tm.push([x.id,packed]); };
      _tmRow(player);
      for(const k in NET.remotes){const rr=NET.remotes[k];if(rr.unit)_tmRow(rr.unit);}
      s.tm=_tm;   // COMPLETE, not sparse — a human with nothing on them still gets a row, or a
    }             // guest cannot tell "cleared" from "not mentioned"
  }`);

subN("count it",
`    (s.vfx?s.vfx.length*12:0)+ // v132.41: five small ints a set-piece`,
`    (s.vfx?s.vfx.length*12:0)+ // v132.41: five small ints a set-piece
    (s.tm?s.tm.reduce((a,r)=>a+8+r[1].length*3,0):0)+ // v132.43: the timed modifiers`);

subN("guest applies them",
`  if(s.bfa){ // v132.40 every player's loadout — see patch-buffs-public.js`,
`  if(s.tm&&typeof TMOD_KINDS!=="undefined"){ // v132.43 — see patch-tmods-public.js
    for(const row of s.tm){
      const un=NET.unitById(row[0]); if(!un)continue;
      // ⚠ NOT the local player. It already has the private {t:"tmd"} channel, which arrives at
      // once rather than at 5 Hz — and that immediacy is exactly what made guest prediction match
      // the host in v132.33. Replacing it with a stepped 5 Hz overwrite would undo that for no
      // gain: the values are identical, both computed by the same host in the same tick.
      if(un===player)continue;
      const p=row[1]||[], list=[];
      for(let i=0;i+3<p.length;i+=4){
        const k=TMOD_KINDS[p[i]]; if(!k)continue;
        const t=p[i+2]/100;
        list.push({k:k,mag:p[i+1]/100,t:t,dur:Math.max(0.001,t),fade:!!p[i+3]});
      }
      un._tmods=list.length?list:null;
    }
  }
  if(s.bfa){ // v132.40 every player's loadout — see patch-buffs-public.js`);

// the guest has to tick REMOTE humans down between arrivals, or a fading modifier sits at full
// magnitude for the 200ms until the next row. It already ticks its own; this is the same call for
// the handful of other humans, and it costs a loop over at most eight units.
subN("guest ticks remote humans too",
`  if(typeof tmodTick==="function"&&typeof player!=="undefined"&&player)tmodTick(player,dt);`,
`  if(typeof tmodTick==="function"&&typeof player!=="undefined"&&player)tmodTick(player,dt);
  // v132.43: …and the other humans, whose modifiers now arrive at 5 Hz. Without this a FADING
  // modifier holds full magnitude for the 200ms between rows, which is the whole duration of some
  // of them. isHuman keeps it to a handful; the 480-unit army is untouched.
  if(typeof tmodTick==="function"&&typeof isHuman==="function")
    for(const u of units)if(u!==player&&u._tmods&&isHuman(u))tmodTick(u,dt);`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(P.net,n.o); fs.writeFileSync(P.comb,c.o);
console.log("patched — timed modifiers are public. PROTO 44.");
