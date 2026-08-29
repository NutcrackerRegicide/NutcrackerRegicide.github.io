#!/usr/bin/env node
/* patch-slainby-v134.js — v134.2d: the death screen tells you who killed you and what they carried.
 *
 * John: "when you get killed, you should know what buffs the enemy that killed you had and they
 * should be displayed on the death screen."
 *
 * FOUR THINGS STOOD IN THE WAY, and the third is the one that decided the design.
 *
 * 1. NOTHING ABOUT THE KILLER SURVIVES THE KILL. `killer` is a local in killUnit and `kn` is a
 *    string built from it for the feed; both are gone when the function returns. Grepped: no
 *    lastAtt, no _killer, no slayer (that id is the WILD SLAYER buff). The victim learns nothing.
 *
 * 2. THERE IS NO DEATH MESSAGE AT ALL. The host shows the overlay inside killUnit; a GUEST infers
 *    its own death from a bit flip — the `alive` flag going 1 -> 0 inside a packed snapshot row. No
 *    event, no identity, no attacker. So this needs a new targeted owner-channel message, shaped
 *    exactly like syncBuffs, and PROTO moves again.
 *
 * 3. IT MUST BE FROZEN AT THE KILL, not looked up afterwards. The screen stands for 10-30 seconds
 *    (respawnDelay), s.bfa only refreshes at ~1 Hz, and if the killer dies inside that window its
 *    own death wipe empties u.buffs — so a lookup would show you an empty loadout from a killer who
 *    was fully loaded when they cut you down. The packed array is copied at the moment of the blow.
 *
 * 4. THE KILLER MAY NOT BE A UNIT. killUnit is passed the RAW attacker: a tower or castle carries
 *    .def and no .cls, and "the wilds" is null. Both have to read as themselves rather than as an
 *    empty buff list, and the suite calls killUnit(qh,null) six times — a bare killer.buffs would
 *    have taken all six down.
 *
 * WHAT IT SHOWS (John's pick): name, class and level always — so the screen never looks broken when
 * a bot with nothing kills you — and the loadout underneath when there is one, in the canonical
 * BUFFS order with the same ice-blue the rest of the buff system uses, hidden entirely when empty
 * per the house convention at updateQuestHud.
 */
const fs=require("fs"),path=require("path");
const R=path.join(__dirname,"..");
const FILES={"index.html":null,"css/style.css":null,"js/05-combat.js":null,
             "js/08-ui.js":null,"js/09-main.js":null,"js/10-net.js":null,"sw.js":null};
for(const k in FILES)FILES[k]=fs.readFileSync(path.join(R,k),"utf8");
let failed=[];
function sub(file,name,from,to){
  const n=FILES[file].split(from).length-1;
  if(n!==1){failed.push(file+" · "+name+" (matched "+n+" times, need exactly 1)");return;}
  FILES[file]=FILES[file].split(from).join(to);
}

// ---------------------------------------------------------------------------
// 1. The markup. The endoverlay's id'd <p> is the house pattern for "JS writes this".
// ---------------------------------------------------------------------------
sub("index.html","the slain-by block",
`<div class="overlay" id="deathoverlay">
  <h1>SLAIN</h1>`,
`<div class="overlay" id="deathoverlay">
  <h1>SLAIN</h1>
  <!-- v134.2: who did it, and what they were carrying. Written by renderSlainBy (08-ui.js) and
       hidden when there is nothing to say, the way #qbuffs is. Sits above the standing text
       because it is the part that changes. -->
  <div id="deathby" style="display:none"></div>`);

// ---------------------------------------------------------------------------
// 2. The styling. ⚠ the antique face has OLD-STYLE numerals — anything numeric goes on the sans.
// ---------------------------------------------------------------------------
sub("css/style.css","the slain-by styling",
`  #deathtimer{font-size:34px;color:var(--parch);font-weight:bold}`,
`  #deathtimer{font-size:34px;color:var(--parch);font-weight:bold}
  /* v134.2 WHO KILLED YOU. Ice blue (#9fd8ff) is the buff system's colour everywhere else —
     .scbuffs, .scload, .scbuff b — so a loadout reads as the same thing wherever you meet it. */
  #deathby{max-width:520px;padding:8px 14px;border:1px solid rgba(159,216,255,.28);border-radius:6px;
    background:rgba(159,216,255,.05)}
  .dbywho{font-size:16px;color:#f0e6c8}
  .dbywho b{color:#ffd24a;font-weight:600}
  .dbyhead{font-size:10.5px;letter-spacing:1.5px;color:#9fd8ff;opacity:.8;margin:6px 0 3px}
  .dbylist{display:flex;flex-wrap:wrap;gap:2px 18px;justify-content:center}
  .dbuff{font-size:11.5px;line-height:1.45;color:#d9d2bd}
  .dbuff b{color:#9fd8ff;font-weight:600}
  .dbynone{font-size:12px;color:#9a8f7a;font-style:italic}`);

sub("css/style.css","numerals on the sans",
`.overlay .verstamp,.overlay .netnote,#serverlist,.overlay input,.overlay select,.overlay .optline{`,
`/* v134.2: …and the slain-by block, which is full of "×3" and "LV 7". Same reason as the rest of
   this list — IM Fell's numerals are old-style and a stack count set in them reads as a smudge. */
.overlay .verstamp,.overlay .netnote,#serverlist,.overlay input,.overlay select,.overlay .optline,
#deathby,.dbywho,.dbyhead,.dbylist,.dbuff,.dbynone{`);

// ---------------------------------------------------------------------------
// 3. The capture, at the instant of the blow.
// ---------------------------------------------------------------------------
sub("js/05-combat.js","slainBy is frozen at the kill",
`  const kn=killer? (killer.isPlayer?"You":(killer.def?killer.def.name:killer.name)) : "The wilds";`,
`  const kn=killer? (killer.isPlayer?"You":(killer.def?killer.def.name:killer.name)) : "The wilds";
  // ---- v134.2 WHO KILLED YOU, AND WHAT THEY CARRIED ----
  // FROZEN HERE, not looked up later: the death screen stands for 10-30 seconds, s.bfa refreshes at
  // about 1 Hz, and if the killer dies inside that window its own wipe empties u.buffs — you would
  // be shown an empty loadout by someone who was fully loaded when they cut you down.
  // ⚠ killer may be a BUILDING (a tower or castle carries .def and no .cls) or null ("the wilds"),
  // and the suite calls killUnit(qh,null) six times. Everything below is guarded on that.
  if(hasProg(u)&&typeof BUFFS!=="undefined"){
    const kU=(killer&&!killer.def&&killer.cls)?killer:null;
    const packed=[];
    if(kU&&kU.buffs)for(let i=0;i<BUFFS.length;i++){
      const st=kU.buffs[BUFFS[i].id]|0; if(st>0)packed.push(i,st);   // canonical BUFFS order, so the
    }                                                               // display needs no sort of its own
    u._slain={
      n:killer?(killer.isPlayer?"You":(killer.def?("A "+killer.def.name):(killer.name||"?"))):"The wilds",
      c:kU&&CLS[kU.cls]?CLS[kU.cls].name:(killer&&killer.def?"tower":""),
      l:kU?(kU.lvl||0):0,
      b:packed
    };
    // …and to the owner's own screen, wherever they sit. A guest learns it died from a bit flip in
    // a snapshot row — there is no death event at all — so without this it would never know.
    if(u.remote&&typeof NET!=="undefined"&&NET.mode==="host"){
      const r=NET.remotes[u.remote];
      if(r&&r.conn){try{r.conn.send({t:"slain",s:u._slain});}catch(_){}}
    }
  }`);

sub("js/05-combat.js","the host paints it",
`  if(u.isPlayer){
    document.getElementById("deathoverlay").style.display="flex";
    closeMenus(); cancelPlacing();`,
`  if(u.isPlayer){
    if(typeof renderSlainBy==="function")renderSlainBy(u._slain); // v134.2 — built ONCE, here, not
    document.getElementById("deathoverlay").style.display="flex"; // per frame beside the countdown
    closeMenus(); cancelPlacing();`);

// clear it wherever the overlay comes down, or the next death opens on the last one's killer
sub("js/05-combat.js","respawn clears it",
`  u.cls="villager"; buildBodyFor(u); setClassStats(u);
  // v134.2: this sets cls directly rather than calling setClass, so it needs the revocation of its`,
`  u._slain=null;                       // v134.2: a new life opens on nobody's name
  u.cls="villager"; buildBodyFor(u); setClassStats(u);
  // v134.2: this sets cls directly rather than calling setClass, so it needs the revocation of its`);

// ---------------------------------------------------------------------------
// 4. The display. One place, reached by host, guest and solo alike.
// ---------------------------------------------------------------------------
sub("js/08-ui.js","renderSlainBy",
`function _scBuffs(id){`,
`// ---- v134.2 WHO KILLED YOU ----
// Built ONCE, at the moment the overlay is shown — never per frame beside the countdown, which
// writes #deathtimer thirty times a second for half a minute. Takes the FROZEN record killUnit put
// on the body (or the one the wire delivered to a guest), never a live lookup: see the note there.
//
// The name, class and level always show, so the screen never reads as broken when a bot carrying
// nothing cuts you down — a tower, or the wilds, says so in its own words. The loadout is hidden
// entirely when it is empty, which is the house convention (updateQuestHud does the same with
// #qbuffs) and better than printing "no buffs" at someone who has just died.
function renderSlainBy(info){
  const el=document.getElementById("deathby"); if(!el)return;
  if(!info){el.style.display="none";el.innerHTML="";return;}
  const esc=(t)=>String(t==null?"":t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  let who="<div class='dbywho'>Slain by <b>"+esc(info.n)+"</b>";
  const bits=[];
  if(info.c)bits.push(esc(info.c));
  if(info.l>0)bits.push("LV "+(info.l|0));
  if(bits.length)who+=" <span class='dbynone'>— "+bits.join(" · ")+"</span>";
  who+="</div>";
  let rows="";
  const p=info.b||[];
  if(typeof BUFFS!=="undefined")for(let i=0;i+1<p.length;i+=2){
    const B=BUFFS[p[i]]; if(!B)continue;                       // a retired id must not throw
    rows+="<div class='dbuff'><b>"+esc(B.name)+" ×"+(p[i+1]|0)+"</b> — "+esc(B.desc)+"</div>";
  }
  el.innerHTML=who+(rows?("<div class='dbyhead'>⚒ THEY WERE CARRYING</div>"+
    "<div class='dbylist'>"+rows+"</div>"):"");
  el.style.display="block";
}
function _scBuffs(id){`);

// ---------------------------------------------------------------------------
// 5. The guest: the message, and both places the overlay comes down.
// ---------------------------------------------------------------------------
sub("js/10-net.js","the slain message",
`  if(d.t==="note")return msg(d.m,d.tone||"");`,
`  if(d.t==="slain"){ // v134.2 who killed US, frozen at the blow — a guest has no other way to know
    if(typeof player!=="undefined"&&player)player._slain=d.s||null;
    if(typeof renderSlainBy==="function")renderSlainBy(d.s||null);
    return;
  }
  if(d.t==="note")return msg(d.m,d.tone||"");`);

sub("js/10-net.js","the guest paints it when the bit flips",
`        document.getElementById("deathoverlay").style.display="flex";
        closeMenus();cancelPlacing();`,
`        // v134.2: the record may already have arrived (the message is immediate, this edge waits
        // for a snapshot) or may not have (a lossy channel, or the two crossing). Paint whatever we
        // hold now; the message handler paints again if it lands after this.
        if(typeof renderSlainBy==="function")renderSlainBy(u._slain||null);
        document.getElementById("deathoverlay").style.display="flex";
        closeMenus();cancelPlacing();`);

sub("js/10-net.js","the guest clears it on rebirth",
`        document.getElementById("deathoverlay").style.display="none";
        msg("You respawn as a Villager. Re-arm at the Barracks.","blue");`,
`        document.getElementById("deathoverlay").style.display="none";
        u._slain=null; if(typeof renderSlainBy==="function")renderSlainBy(null); // v134.2
        msg("You respawn as a Villager. Re-arm at the Barracks.","blue");`);

sub("js/10-net.js","PROTO",
`  PROTO:47,             // v134.2 veteran NPCs: s.bfa now rows every buff HOLDER rather than every`,
`  PROTO:48,             // v134.2 the slain-by record (who killed you and what they carried) — a
                        // guest has no death EVENT at all, only an alive bit flipping in a
                        // snapshot, so it needs one. Was:
                        // v134.2 veteran NPCs: s.bfa now rows every buff HOLDER rather than every`);

sub("js/09-main.js","endGame clears it",
`  document.getElementById("deathoverlay").style.display="none";`,
`  document.getElementById("deathoverlay").style.display="none";
  if(typeof renderSlainBy==="function")renderSlainBy(null); // v134.2: the war is over, not your life`);

// ---------------------------------------------------------------------------
// 6. The version pair. INVARIANT #4 — a smoketest gate enforces it.
// ---------------------------------------------------------------------------
sub("sw.js","VERSION",`const VERSION="v134.1";`,`const VERSION="v134.2";`);
sub("index.html","verstamp",
`<p class="verstamp">v134.1 — THE FARM RING</p>`,
`<p class="verstamp">v134.2 — THE VETERANS</p>`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
for(const k in FILES)fs.writeFileSync(path.join(R,k),FILES[k]);
console.log("patch-slainby-v134: OK — "+Object.keys(FILES).join(", ")+" written");
