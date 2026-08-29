#!/usr/bin/env node
/* patch-vetwire-v134.js — v134.2, part two: a veteran bot on every screen, and a mark you can read.
 *
 * Two problems, one of which would have made the whole feature invisible and the other of which
 * would have silently DELETED it on a guest.
 *
 * 1. THE GUEST WIPES BOT LOADOUTS. s.bfa is a COMPLETE list by contract — the guest's own comment
 *    says so — and it ends with a sweep that clears u.buffs on anything carrying buffs but absent
 *    from the list. The producer only ever rowed `player` and NET.remotes, so every full snap (~1Hz)
 *    a guest would erase every veteran bot's loadout, recompute its stats from a bare class table,
 *    and disagree with the host about how hard it hits for the next second. Widening the producer is
 *    not an optimisation here, it is the difference between the feature working and the feature
 *    being a desync. The consumer already handles it correctly once the producer is honest.
 *
 *    ROWS ONLY FOR HOLDERS. A hundred bots holding nothing would be a hundred empty rows a second
 *    for no information. The completeness contract survives because the sweep only clears units
 *    that HAVE buffs, and any bot that has some is in the list by construction.
 *
 * 2. YOU CANNOT SEE IT. John: "no [aura] but you do need to be able to somehow tell a bot is higher
 *    level." Players already wear ⭐LV over their heads; a veteran bot wears the same mark, because
 *    inventing a second vocabulary for the same fact is how a HUD stops being readable. Not through
 *    s.sc — that is the SCOREBOARD, a roll of players, and a hundred bots do not belong on it — so
 *    bot levels ride their own compact field.
 *
 *    ⚠ syncNameTags is called ONLY from the net layer (10-net.js:883 and :2049). In SOLO there are
 *    no snapshots and it never runs, so a tag driven from there alone would appear in multiplayer
 *    and nowhere else. The tagger is driven from renderFrame instead — trap #12: renderFrame and
 *    updateEffects are what ALL frame paths call, host, guest and solo alike — and syncNameTags is
 *    taught not to strip a tag it does not own.
 */
const fs=require("fs"),path=require("path");
const R=path.join(__dirname,"..");
const FILES={"js/10-net.js":null,"js/04-units.js":null,"js/09-main.js":null};
for(const k in FILES)FILES[k]=fs.readFileSync(path.join(R,k),"utf8");
let failed=[];
function sub(file,name,from,to){
  const n=FILES[file].split(from).length-1;
  if(n!==1){failed.push(file+" · "+name+" (matched "+n+" times, need exactly 1)");return;}
  FILES[file]=FILES[file].split(from).join(to);
}

// ---------------------------------------------------------------------------
// 1. The loadout wire learns about veterans.
// ---------------------------------------------------------------------------
sub("js/10-net.js","s.bfa rows every holder",
`    _bfRow(player);
    for(const k in NET.remotes){const rr=NET.remotes[k];if(rr.unit)_bfRow(rr.unit);}
    s.bfa=_bfa;`,
`    _bfRow(player);
    for(const k in NET.remotes){const rr=NET.remotes[k];if(rr.unit)_bfRow(rr.unit);}
    // v134.2 …AND EVERY VETERAN NPC. This list is COMPLETE by contract — the consumer clears
    // u.buffs on anything carrying buffs and absent from it — so with the producer rowing players
    // alone, a guest erased every bot's loadout on every full snap and then recomputed its stats
    // from a bare class table. That is not a missing feature, it is a live disagreement about how
    // hard a unit hits. Only HOLDERS get a row: a hundred bots carrying nothing would be a hundred
    // empty rows a second, and the sweep only ever clears units that have something to lose.
    const _seen={}; for(const r of _bfa)_seen[r[0]]=1;
    for(const u of units)
      if(u.alive&&!_seen[u.id]&&u.buffs&&Object.keys(u.buffs).length)_bfRow(u);
    s.bfa=_bfa;
    // v134.2 THE VETERANS' LEVELS, for the star over their heads. NOT s.sc: that is the scoreboard,
    // a roll of players, and it is built from player+remotes for good reasons. Two numbers a
    // veteran, on full snaps only, and quiet entirely in a match where no bot has earned one.
    const _lv=[];
    for(const u of units)if(u.alive&&u.bot&&!u.isPlayer&&!u.remote&&(u.lvl||0)>0)_lv.push([u.id,u.lvl|0]);
    if(_lv.length||NET._lvLast)s.lv=_lv;   // …and ONE empty list when the last of them falls, or a
    NET._lvLast=_lv.length;                // guest keeps the star over a body that lost the level`);

sub("js/10-net.js","the guest applies veteran levels",
`  if(s.bfa){ // v132.40 every player's loadout — see patch-buffs-public.js`,
`  if(s.lv){ // v134.2 veteran NPC levels — the star over the head, and nothing else reads it
    const named=new Set();
    for(const row of s.lv){const un=NET.unitById(row[0]); if(!un)continue; named.add(un.id); un.lvl=row[1]|0;}
    // the same clear-first rule s.ar and s.bfa live by: an empty list has to be able to say "none"
    for(const un of units)if(un.bot&&(un.lvl||0)>0&&!named.has(un.id)&&un!==player&&!un.remote)un.lvl=0;
  }
  if(s.bfa){ // v132.40 every player's loadout — see patch-buffs-public.js`);

sub("js/10-net.js","PROTO",
`  PROTO:46,             // v132.46 the damage-number message (dnum). Was:`,
`  PROTO:47,             // v134.2 veteran NPCs: s.bfa now rows every buff HOLDER rather than every
                        // player, and s.lv carries their levels for the nametag star. Was:
                        // v132.46 the damage-number message (dnum). Was:`);

// ---------------------------------------------------------------------------
// 2. The mark itself.
// ---------------------------------------------------------------------------
sub("js/04-units.js","syncNameTags leaves veteran tags alone",
`  for(const u of units){
    if(want[u.id]!==undefined&&u!==player)setNameTag(u,want[u.id]);
    else if(u._tag)clearNameTag(u);
  }
}`,
`  for(const u of units){
    if(want[u.id]!==undefined&&u!==player)setNameTag(u,want[u.id]);
    // v134.2: …but do not strip a tag this function does not own. vetTagTick owns the veteran
    // stars, runs on every frame path (this one runs only when a snapshot arrives, i.e. never in
    // solo), and the two would otherwise take the tag off each other frame by frame.
    else if(u._tag&&!u._vtag)clearNameTag(u);
  }
}
// ---- v134.2 THE VETERAN'S STAR ----
// John's ruling was "no aura for bots, but you need to be able to tell one is higher level". This is
// the mark players already wear (04-units.js has put "name ⭐N" over a player's head since v87), so
// it means the same thing whoever is carrying it rather than inventing a second vocabulary.
//
// Driven from renderFrame, NOT from the snapshot: syncNameTags is called only by the net layer, so
// a solo match — the common case, and the one this feature exists for — would never have shown it.
// On a host u.lvl is authoritative; on a guest the s.lv rows have already written it.
//
// Throttled, because this walks the roster and touches the DOM/scene through setNameTag: a level
// changes a few times a minute at most, and re-labelling a hundred bodies every frame to say the
// same thing is how a display feature becomes a frame-rate bug.
let _vetT=0;
const VET_TAG_EVERY=0.5;
function vetTagTick(dt){
  _vetT-=dt||0; if(_vetT>0)return; _vetT=VET_TAG_EVERY;
  for(const u of units){
    const want=(u.alive&&u.bot&&!u.isPlayer&&!u.remote&&(u.lvl||0)>0)?("⭐"+u.lvl):null;
    if(want){ if(u._vtagN!==want){setNameTag(u,want);u._vtag=true;u._vtagN=want;} }
    else if(u._vtag){ clearNameTag(u); u._vtag=false; u._vtagN=null; }
  }
}`);

sub("js/09-main.js","renderFrame drives the star",
`function renderFrame(dt){`,
`function renderFrame(dt){
  // v134.2 the veteran's star. HERE, and not in tickBody's host branch, for trap #12's reason:
  // renderFrame is what every frame path calls — host, guest and solo — and a display driver hung
  // off the host branch is a display that does not exist for two thirds of the players.
  if(typeof vetTagTick==="function")vetTagTick(dt);`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
for(const k in FILES)fs.writeFileSync(path.join(R,k),FILES[k]);
console.log("patch-vetwire-v134: OK — "+Object.keys(FILES).join(", ")+" written");
