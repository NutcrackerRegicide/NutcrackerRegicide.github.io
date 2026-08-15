#!/usr/bin/env node
/* patch-buff-rings-net.js — v132.39: the rings have to reach a guest, or they are a host feature.
 *
 * ── THE PROBLEM, WHICH IS THE DUAL-SITE TRAP AGAIN ──────────────────────────────────────────
 * Two independent reasons a guest could draw nothing:
 *   1. BUFFS ARE NOT SYNCED PER UNIT. The `bff` message sets player.buffs and nothing else — a
 *      guest has never known what buffs any OTHER unit holds, because until now nothing on screen
 *      depended on it.
 *   2. auraBuffTick IS HOST-ONLY. It runs from the host unit loop in 09-main.js:748 (statusTick),
 *      and that is deliberate: it deals damage and heals, which a guest does not own. So even the
 *      guest's OWN _auraA/_auraE/_stillT are never computed locally.
 * Between them, a guest would see an empty field while the host saw six rings.
 *
 * ── THE FIX: SHIP THE DISPLAY STATE, NOT THE BUFFS ──────────────────────────────────────────
 * One row per HOLDER: [id, mask, allies, enemies, still%, kinId, stewId]. Seven small integers.
 * Holders are `isHuman` only — players, not the 485-unit army — so a full lobby is eight rows, at
 * the 5 Hz cadence the scoreboard already uses. A ring pulses; it does not need 20 Hz.
 *   Shipping the derived state rather than the buffs is also what keeps ONE drawing path: the
 *   host computes these fields, the wire replicates them, and buffFxTick reads them without ever
 *   asking which machine it is on. That is the dedicated-server shape for free.
 *
 * ⚠ THE EMPTY LIST MUST STILL BE SENT, ONCE. If nobody holds one of the six, the naive version
 * skips the field to save bytes — and every guest keeps the last rows it received forever, so the
 * ring outlives the buff. NET._arLast makes the transition from "some" to "none" send exactly one
 * empty array, and then go quiet.
 *
 * ⚠ AND THE GUEST CLEARS BEFORE IT APPLIES. A holder who dropped the buff sends no row at all —
 * it does not send a row saying zero. So anything not named in the list must go dark, or dropping
 * Sanctuary leaves its ring on the ground until you pick it up again.
 *
 * PROTO 40 → 41: a new snapshot field is new wire vocabulary.
 */
const fs=require("fs"),path=require("path");
const F=path.join(__dirname,"..","js","10-net.js");
let s=fs.readFileSync(F,"utf8");
let failed=[];
function sub(name,from,to){
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
}

sub("PROTO 41",
`  PROTO:40,             // v132.36 five proc/charge ids — the forge now speaks all 60, which`,
`  PROTO:41,             // v132.39 the aura-ring rows (s.ar) — new snapshot vocabulary. Was:
                        // v132.36 five proc/charge ids — the forge now speaks all 60, which`);

sub("host ships the aura rows",
`    for(const k in NET.remotes){const rr=NET.remotes[k];if(rr.unit)s.sc.push([rr.name,Math.round(rr.unit.score||0),rr.unit.team,rr.unit.id,rr.unit.lvl||0]);}
  }`,
`    for(const k in NET.remotes){const rr=NET.remotes[k];if(rr.unit)s.sc.push([rr.name,Math.round(rr.unit.score||0),rr.unit.team,rr.unit.id,rr.unit.lvl||0]);}
    // v132.39 THE AURA RINGS. Holders only, and holders are isHuman — a full lobby is eight rows.
    const _ar=[];
    const _arRow=(u)=>{ if(u&&u.alive&&(u._fxMask|0))_ar.push(
      [u.id,u._fxMask|0,u._auraA|0,u._auraE|0,Math.round((u._fxStill||0)*100),u._fxKin|0,u._fxStw|0]); };
    _arRow(player);
    for(const k in NET.remotes){const rr=NET.remotes[k];if(rr.unit)_arRow(rr.unit);}
    // ⚠ send the EMPTY list once. Skipping it to save bytes leaves every guest holding the last
    // rows forever, and the ring outlives the buff that drew it.
    if(_ar.length||NET._arLast)s.ar=_ar;
    NET._arLast=_ar.length;
  }`);

sub("count the rows in the bandwidth stat",
`  s.bs=ub.byteLength+(s.bb?s.bb.byteLength:0)+(s.sc?s.sc.length*22:0)+(s.fx?s.fx.length*10:0)+`,
`  s.bs=ub.byteLength+(s.bb?s.bb.byteLength:0)+(s.sc?s.sc.length*22:0)+(s.fx?s.fx.length*10:0)+
    (s.ar?s.ar.length*16:0)+ // v132.39: seven small ints a row — netlog stays honest`);

sub("guest applies the aura rows",
`  if(s.sc){NET.scores=s.sc;syncNameTags(s.sc);}`,
`  if(s.sc){NET.scores=s.sc;syncNameTags(s.sc);}
  if(s.ar){ // v132.39 the aura rings — see patch-buff-rings-net.js
    // ⚠ CLEAR FIRST. A unit that dropped the buff sends no row at all rather than a row of zeros,
    // so anything absent from this list has to go dark or its ring stays on the ground.
    for(const u of units)if(u._fxMask)u._fxMask=0;
    for(const r of s.ar){
      const u=NET.unitById(r[0]); if(!u)continue;
      u._fxMask=r[1]|0; u._auraA=r[2]|0; u._auraE=r[3]|0;
      u._fxStill=(r[4]|0)/100; u._fxKin=r[5]|0; u._fxStw=r[6]|0;
    }
  }`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched js/10-net.js — the rings reach guests. PROTO 41.");
