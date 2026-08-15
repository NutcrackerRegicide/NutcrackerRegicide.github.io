#!/usr/bin/env node
/* patch-buffs-public.js — v132.40: a guest learns what EVERY player is carrying.
 *
 * ── WHAT WAS TRUE BEFORE ────────────────────────────────────────────────────────────────────
 * syncBuffs() sends {t:"bff"} to exactly ONE connection — the owner of the unit. So every client
 * knew its own sixty-buff loadout and nothing about anyone else's. Nothing on screen depended on
 * it, so nothing was visibly broken; but it means a guest cannot tell a fully-forged opponent
 * from a fresh one, cannot show what an ally is running, and cannot draw any effect that depends
 * on a holding rather than on an event. Every persistent buff look in the FX plan — King's Guard's
 * rim, Yeoman's silhouette, Captain's banner, Desperation's haze — is blocked on this.
 *
 * ── HOW IT SHIPS ────────────────────────────────────────────────────────────────────────────
 * On FULL snapshots only, which is once a second at SNAP_HZ 15. Buffs change when somebody picks
 * a piece at the forge or dies; nothing about that is sub-second critical, and riding the full
 * snapshot buys three things an event message would each need code for:
 *     · SELF-HEALING — a dropped packet costs a second, not a permanently wrong client
 *     · NO JOIN CASE — a guest that just arrived gets the whole set on the next full snap
 *     · NO LEAVE CASE — hostRelease wipes a deserter's buffs and the next full snap says so
 * One path, three edge cases that never have to be written.
 *
 * ── INDEXED, NOT NAMED ──────────────────────────────────────────────────────────────────────
 * A row is [unitId, [idx,stacks, idx,stacks, …]] where idx is the position in BUFFS. Sending
 * {"dmg":3,"hp":5,…} instead would be roughly 150 bytes a player against about 40. BUFFS order is
 * fixed for a given PROTO — that is what PROTO is for — and the same reasoning already governs
 * the binary building rows.
 *
 * ⚠ THE LIST IS COMPLETE, NOT SPARSE. Every human is listed, including one holding nothing, and
 * the guest clears any unit it finds carrying buffs that the list does not mention. A sparse list
 * cannot express "this player now has none" — the same empty-list trap as the v132.39 ring rows,
 * and it would leave a dead player's loadout on screen for the rest of the match.
 *
 * ⚠ AND ONLY HUMANS EVER HOLD ONE. useBlacksmith and smithPick are reachable only for the local
 * player and for a remote's unit, so bots have no buffs to send. isHuman is the complete set, not
 * a convenient subset.
 *
 * ⚠ THE v132.39 RING MASK STAYS. It looks redundant now — a guest could derive it from these
 * buffs — but the ring rows ride the 5 Hz scoreboard branch and this rides the 1 Hz full snap, so
 * deriving it would make every ring up to a second late to appear. Two channels, different
 * freshness, one authority: the host computes both from the same buffs in the same tick.
 *
 * PROTO 41 → 42.
 */
const fs=require("fs"),path=require("path");
let failed=[];
function mk(box){return function(name,from,to){
  const n=box.o.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  box.o=box.o.split(from).join(to);};}
const P={net:path.join(__dirname,"..","js","10-net.js"),
         ui:path.join(__dirname,"..","js","08-ui.js")};
const n={o:fs.readFileSync(P.net,"utf8")}, u={o:fs.readFileSync(P.ui,"utf8")};
const subN=mk(n), subU=mk(u);

subN("PROTO 42",
`  PROTO:41,             // v132.39 the aura-ring rows (s.ar) — new snapshot vocabulary. Was:`,
`  PROTO:42,             // v132.40 public buff rows (s.bfa) — every client learns every player's
                        // loadout, not just its own. Was:
                        // v132.39 the aura-ring rows (s.ar) — new snapshot vocabulary. Was:`);

subN("host ships every player's loadout",
`    // ⚠ send the EMPTY list once. Skipping it to save bytes leaves every guest holding the last
    // rows forever, and the ring outlives the buff that drew it.
    if(_ar.length||NET._arLast)s.ar=_ar;
    NET._arLast=_ar.length;
  }`,
`    // ⚠ send the EMPTY list once. Skipping it to save bytes leaves every guest holding the last
    // rows forever, and the ring outlives the buff that drew it.
    if(_ar.length||NET._arLast)s.ar=_ar;
    NET._arLast=_ar.length;
  }
  // v132.40 EVERY PLAYER'S LOADOUT, on FULL snaps only (~1 Hz). Indexed into BUFFS rather than
  // named: about 40 bytes a player against 150. The list is COMPLETE — a human holding nothing
  // still gets a row — because a sparse list cannot say "this one has none", and the guest below
  // relies on that to clear a deserter's.
  if(full&&typeof BUFFS!=="undefined"){
    if(!NET._bfIdx){NET._bfIdx={};BUFFS.forEach((b,i)=>{NET._bfIdx[b.id]=i;});}
    const _bfa=[];
    const _bfRow=(x)=>{ if(!x||!x.alive)return;
      const packed=[]; const bb=x.buffs||{};
      for(const k in bb){const i=NET._bfIdx[k]; if(i!==undefined&&bb[k]>0)packed.push(i,bb[k]|0);}
      _bfa.push([x.id,packed]); };
    _bfRow(player);
    for(const k in NET.remotes){const rr=NET.remotes[k];if(rr.unit)_bfRow(rr.unit);}
    s.bfa=_bfa;
  }`);

subN("count it in the bandwidth stat",
`    (s.ar?s.ar.length*16:0)+ // v132.39: seven small ints a row — netlog stays honest`,
`    (s.ar?s.ar.length*16:0)+ // v132.39: seven small ints a row — netlog stays honest
    (s.bfa?s.bfa.reduce((a,r)=>a+8+r[1].length*3,0):0)+ // v132.40: the loadouts, on full snaps`);

subN("guest applies the loadouts",
`  if(s.ar){ // v132.39 the aura rings — see patch-buff-rings-net.js`,
`  if(s.bfa){ // v132.40 every player's loadout — see patch-buffs-public.js
    if(!NET._bfIdx&&typeof BUFFS!=="undefined"){NET._bfIdx={};BUFFS.forEach((b,i)=>{NET._bfIdx[b.id]=i;});}
    const named=new Set();
    for(const row of s.bfa){
      const un=NET.unitById(row[0]); if(!un)continue;
      named.add(un.id);
      const b={}; const p=row[1]||[];
      for(let i=0;i+1<p.length;i+=2){const d=BUFFS[p[i]]; if(d)b[d.id]=p[i+1];}
      un.buffs=b;
      if(typeof applyBuffStats==="function")applyBuffStats(un); // keep derived stats honest —
    }                                                          // the host still owns hp/maxHp
    // ⚠ anything CARRYING buffs but absent from a complete list has lost them: a deserter whose
    // body went back to the AI, or a player who left. A sparse list could not say this.
    for(const un of units)
      if(un.buffs&&!named.has(un.id)){for(const _k in un.buffs){un.buffs={};break;}}
  }
  if(s.ar){ // v132.39 the aura rings — see patch-buff-rings-net.js`);

// ---------------- the scoreboard reads it, host and guest alike ----------------
subU("scoreboard shows the loadout",
`      (list.length?list.map((r,i)=>
        "<div class='scrow'><span>"+(i+1)+". "+r[0]+(r[4]?" <i class='sclvl'>⭐"+r[4]+"</i>":"")+"</span><b>"+r[1]+"</b></div>").join("")`,
`      (list.length?list.map((r,i)=>
        "<div class='scrow'><span>"+(i+1)+". "+r[0]+(r[4]?" <i class='sclvl'>⭐"+r[4]+"</i>":"")+
        _scBuffs(r[3])+"</span><b>"+r[1]+"</b></div>").join("")`);

subU("the loadout chip",
`function showScoreboard(on){`,
`// v132.40: what that player is carrying. Reads u.buffs by unit id, which now means the same
// thing on a host and on a guest — see patch-buffs-public.js. Before that a guest knew only its
// own loadout, so this could not have been written.
function _scBuffs(id){
  if(typeof units==="undefined"||id===undefined)return "";
  const u=units.find(x=>x.id===id);
  if(!u||!u.buffs)return "";
  const held=[];
  for(const k in u.buffs)if(u.buffs[k]>0){
    const d=(typeof BUFF_BY_ID!=="undefined")?BUFF_BY_ID[k]:null;
    held.push((d?d.name:k)+(u.buffs[k]>1?" ×"+u.buffs[k]:""));
  }
  if(!held.length)return "";
  // the count in the row, the full list on hover — sixty possible pieces will not fit inline
  return " <i class='scbuff' title='"+held.join(" · ").replace(/'/g,"&#39;")+"'>⚒"+held.length+"</i>";
}
function showScoreboard(on){`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(P.net,n.o); fs.writeFileSync(P.ui,u.o);
console.log("patched — every client learns every player's loadout. PROTO 42.");
