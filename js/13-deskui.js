/* REGICIDE PVP — 13-deskui.js — THE ONE BAR ON DESKTOP (v125)

   John, after thirteen rounds of field-testing the phone build: "I would like to take the basis of
   the mobile UI and apply it to the desktop version — move the UI bar to the bottom, put fps
   counter up top etc. button rail only meant for mobile so exclude that."

   So this is 12-touch's layout without the parts that only exist because a phone has no keyboard
   and no mouse. What comes across:
     · ONE strip along the bottom edge, in the same order: crowns and stockpile left, the health
       bar dead centre, key hints / age line / roster / map / help right
     · the gathering caption at the lower centre, carrying the haul as icon + count-of-capacity
     · the draining crown meters with a percentage, instead of two 210px labelled panels
     · the frame read-out as bare lettering at the top centre (desktop had NO counter at all)
     · the feed at the top-left with the active quest pinned above it as a matching line
     · the minimap behind a toggle
     · your team's composition only, and the two-age line — both by John's explicit choice, so the
       phone and the desktop now say the same thing
   What does NOT: the thumb zones, the contextual button rail, the action grid, the forced-landscape
   stage, the frame cap and the battery saver. Those answer problems a desktop does not have.

   WHY A SEPARATE FILE, and not a shared bar used by both.
   The obvious move is to lift the strip out of 12-touch and have the two modes share it. I chose
   not to, for now. 12-touch's strip is 34px tall, sized in a rotated stage, measured against safe
   areas, and validated by ~190 harness assertions that took thirteen rounds to get green. A desktop
   bar is 46px, has no stage, no insets, a real keyboard hint line and a mouse — so a shared
   implementation would be mostly per-mode overrides anyway, and the refactor would put every one of
   those assertions at risk to save duplicated CSS. The duplication is real and it is the price.
   If a THIRD layout ever appears, extract it then — two copies is a smell, three is a bug factory.

   Self-contained the same way 12-touch is: it early-returns on a touchscreen (12-touch has already
   claimed the DOM by then) and on ?ui=classic, so the pre-v125 desktop HUD is one query parameter
   away if any of this turns out wrong in the field. */
(function(){
  // Same browser tell 12-touch uses: the node smoketest loads every js/ file as one bundle with a
  // stubbed document, so `document` alone does not prove we are in a browser.
  if(typeof document==="undefined"||typeof location==="undefined"||
     typeof screen==="undefined"||typeof navigator==="undefined")return;
  // 12-touch runs FIRST and adds touch-mode synchronously if it is taking over. That is the whole
  // handshake between the two files — there is no shared state and no ordering subtlety beyond it.
  if(document.documentElement.classList.contains("touch-mode"))return;
  const q=new URLSearchParams(location.search);
  if(q.get("ui")==="classic")return;      // the escape hatch: the v124 desktop HUD, untouched
  document.documentElement.classList.add("bar-mode");

  // ---------- ONE SOLID BAR ----------
  // Reparent the existing panels into a single strip rather than positioning them to look adjacent.
  // Adjacent boxes drift the moment any of them changes width — which is exactly the bug John hit
  // on the phone in v124.1 — and this way every panel keeps its own updater. Nothing in 08-ui, 07-ai
  // or 10-net has to know the bar exists.
  const bar=document.createElement("div");
  bar.id="dbar";
  const host=document.getElementById("resources");
  if(!host||!host.parentNode)return;
  host.parentNode.insertBefore(bar,host);

  // Two balance groups of equal flex weight either side of the unit panel. This is what puts the
  // health bar on the TRUE centre line: auto margins would centre it in the LEFTOVER space, which
  // slides every time a transient segment appears or goes.
  const gL=document.createElement("div"), gR=document.createElement("div");
  gL.id="dbarL"; gR.id="dbarR";
  bar.appendChild(gL);
  const hud=document.getElementById("playerhud");
  if(hud)bar.appendChild(hud);
  bar.appendChild(gR);

  // The map and help controls are new elements — desktop never had either as a button.
  const mapBtn=document.createElement("div");
  mapBtn.id="dmap"; mapBtn.textContent="🗺"; mapBtn.title="minimap (M)";
  const helpBtn=document.createElement("div");
  helpBtn.id="dhelp"; helpBtn.textContent="?"; helpBtn.title="controls (H)";

  // v124.13a's lesson, brought across: the crowns lead the group and never shrink, resources follow
  // and are allowed to give way. A four-digit stockpile pushed the red crown off the phone screen
  // because the group clips its LAST child, and the same flexbox rule applies at any width.
  for(const id of ["kings","resources"]){
    const el=document.getElementById(id); if(el)gL.appendChild(el);
  }
  // #ptip ("E gather · B build · deposit at Town Center") is lifted OUT of the unit panel and made
  // its own segment. It is genuine desktop copy — a phone drops it because there is no keyboard —
  // but leaving it inside #playerhud made that panel ~460px wide, and the health bar then sat about
  // 100px LEFT of the screen centre while the panel's own midpoint measured dead on. John's v124.11
  // note on the phone was "HP bar should still be in center of screen"; the bar is the thing the eye
  // centres on, not the box around it.
  const tip=document.getElementById("ptip");
  // #carry is NOT in this list, and v125.1 is why: the gathering caption below carries the haul, so a
  // second copy in the strip is width spent saying the same thing in the place you are not looking.
  // 12-touch dropped it from the phone strip in v124.10 for exactly this reason. The element stays in
  // the DOM and 08-ui keeps writing to it — it is just hidden, so nothing else has to know.
  for(const id of ["agebar","roster"]){
    const el=document.getElementById(id); if(el)gR.appendChild(el);
  }
  if(tip)gR.insertBefore(tip,gR.firstChild);
  gR.appendChild(mapBtn);
  gR.appendChild(helpBtn);

  // ---------- THE FRAME READ-OUT ----------
  // Desktop had none at all — #tfps is created by 12-touch, so every frame-rate number John has
  // quoted in thirteen rounds of testing came from his phone. Bare lettering at the top centre, no
  // panel: it is a developer read-out, not a control.
  const fpsEl=document.createElement("div");
  fpsEl.id="dfps"; fpsEl.textContent="--";
  document.body.appendChild(fpsEl);

  // ---------- THE CROWNS ARE THE METERS ----------
  // "♔ KING OSRIC (YOUR KING)" is 210px of text that says the same thing every match. Compress to
  // the glyph and carry the one bit that matters — whose king it is — in its colour.
  // An OBSERVER, not a one-off rewrite, because 10-net relabels both boxes when you join as RED.
  for(const id of ["kb0","kb1"]){
    const lbl=document.querySelector("#"+id+" .lbl");
    if(!lbl)continue;
    const shorten=()=>{
      const t=(lbl.textContent||"").trim();
      // Only re-read ownership from a FULL label. The observer fires on its own rewrite, and on the
      // phone the first version then looked for the word YOUR in the single glyph it had just
      // written, found none, and flipped both crowns to the enemy's on the very next tick.
      if(t.length>2){
        const mine=/YOUR/i.test(t);
        lbl.classList.toggle("mine",mine);
        lbl.classList.toggle("foe",!mine);
      }
      const want=lbl.classList.contains("mine")?"♔":"♚";
      if(t!==want)lbl.textContent=want;
    };
    if(typeof MutationObserver!=="undefined")
      new MutationObserver(shorten).observe(lbl,{childList:true,characterData:true,subtree:true});
    shorten();
  }
  // Read the kings straight off the sim rather than parsing the width updateKingBars just wrote —
  // one less thing to stay in step with, and it works on a guest where the bar is driven from the
  // snapshot rather than from local damage.
  const crowns=[["kb0",0],["kb1",1]].map(([id,t])=>{
    const box=document.getElementById(id);
    if(!box)return null;
    let pct=box.querySelector(".kpct");
    if(!pct){pct=document.createElement("span");pct.className="kpct";box.appendChild(pct);}
    return [box.querySelector(".lbl"),t,pct];
  }).filter(Boolean);
  function drainCrowns(){
    if(typeof kings==="undefined"||!kings)return;
    for(const [el,t,pctEl] of crowns){
      const k=kings[t];
      if(!el||!k)continue;
      const pct=Math.max(0,Math.min(1,(k.hp||0)/(k.maxHp||1)));
      const s=(pct*100).toFixed(1)+"%";
      if(el._hp!==s){
        el._hp=s;
        el.style.setProperty("--hp",s);
        el.classList.toggle("hurt",pct>0&&pct<0.25);
        // round, but never round a LIVING king to 0% — that reads as "already dead"
        const shown=pct>0?Math.max(1,Math.round(pct*100)):0;
        if(pctEl)pctEl.textContent=shown+"%";
      }
    }
  }

  // ---------- THE AGE LINE ----------
  // 09-main calls updateAgeHud() during init, and this file loads AFTER it — so bar-mode was not on
  // <html> yet and the old desktop copy won the first render. This is the same trap 12-touch hit in
  // v124.8. Re-render once now, and again whenever the ages or your own countdown actually change:
  // the countdown ticks every second while advancing and nothing else refreshes it between age-ups.
  let ageSig="";
  function tickAgeLine(){
    if(typeof teamAge==="undefined"||typeof updateAgeHud!=="function")return;
    const foe=(MYTEAM===BLUE)?RED:BLUE;
    const sig=teamAge[MYTEAM]+"/"+teamAge[foe]+"/"+Math.ceil(Math.max(0,ageResT[MYTEAM]||0));
    if(sig===ageSig)return;
    ageSig=sig;
    try{updateAgeHud();}catch(e){}
  }

  // ---------- THE GATHERING CAPTION ----------
  // John: "the gather UI for desktop should be the same as mobile, showing up at lower center of
  // screen with the resource icon and the (0/20)."
  //
  // On the phone this caption is a side effect of AUTO-GATHER — the assist narrates what it is doing
  // — and v124.7 put the haul on it for a reason worth repeating: "when gathering, I can't see how
  // many of each I have gathered, only when I'm full." The bottom strip is the wrong place to watch
  // while your eyes are on the tree. Desktop has no auto-gather, so this is a pure READ-OUT of state
  // the game already keeps; nothing here drives the sim.
  //
  // Two deliberate differences from the phone, both because they are strictly more useful and
  // neither changes what it looks like:
  //   1. It also shows while you are CARRYING but not gathering — the walk back to the Town Centre
  //      is exactly when you want to know what is in the satchel, and it is what #carry did before.
  //      (The phone hides it there, because once your hands are off the tree autoTick has nothing
  //      to narrate.)
  //   2. With an EMPTY satchel it names the node you are working rather than showing nothing, so it
  //      reads "🪵 0/20" and counts up — which is the "(0/20)" John asked for. The phone cannot do
  //      this: its caption is written before it knows which node the assist will pick.
  const ICON={food:"🍖",gold:"🪙",stone:"🪨",wood:"🪵"};
  const autoEl=document.createElement("div");
  autoEl.id="dauto";
  document.body.appendChild(autoEl);
  let autoMsg="";
  function haulText(){
    if(!player||!player.carry)return "";
    const c=player.carry, cap=(typeof carryCap==="function")?carryCap(player):0;
    const held=c.food+c.gold+c.stone+c.wood;
    const bits=[];
    for(const k of ["food","gold","stone","wood"])if(c[k])bits.push([ICON[k],c[k]]);
    // nothing in hand yet: name the node being worked, so the count starts at 0 and climbs
    if(!bits.length){
      const g=player.gathering;
      const t=g&&ICON[g.type];
      return t?t+" 0"+(cap?"/"+cap:""):"";
    }
    // v124.8's rule, kept: "🪵68 (68/300)" said the same number twice. ONE kind — which is almost
    // always — reads as icon + count-of-capacity and nothing else. The running total only earns its
    // place when there are several kinds in the satchel and no single count is the answer.
    return bits.length===1
      ? bits[0][0]+" "+bits[0][1]+(cap?"/"+cap:"")
      : bits.map(b=>b[0]+b[1]).join(" ")+(cap?"  "+held+"/"+cap:"");
  }
  function tickAuto(){
    let m="";
    const live=player&&player.alive&&typeof inMenu!=="undefined"&&!inMenu&&
      !(typeof gameOver!=="undefined"&&gameOver)&&!(typeof menuOpen!=="undefined"&&menuOpen);
    if(live){
      const c=player.carry;
      const held=c?(c.food+c.gold+c.stone+c.wood):0;
      const cap=(typeof carryCap==="function")?carryCap(player):0;
      const full=cap>0&&held>=cap;
      if(player.gathering)   m="⛏ gathering"+(full?" — hands full":"");
      else if(full)          m="hands full — return to the Town Centre";
      else if(held>0)        m="⛏ hauling";
      if(m){const h=haulText(); if(h)m+="  "+h;}
    }
    if(m!==autoMsg){autoMsg=m;autoEl.textContent=m;autoEl.classList.toggle("on",!!m);}
  }

  // ---------- PRIORITY INSIDE THE STRIP ----------
  // On a 1366 laptop the right group runs out of room and flexbox shrinks its members in
  // PROPORTION, which is the wrong rule: the key-hint line ate the space and the age line came out
  // as "STONE vs" with the enemy's age cut off, and the roster as "⛏ 49 ·". Whatever gets sacrificed
  // must be the LEAST important thing, not whatever the algorithm happens to reach. 12-touch answers
  // this by ORDER (the group clips its last child), which works when there is one obvious loser; the
  // desktop group has a clear ranking instead, so state it.
  //
  // The ladder is ordered by how time-critical each thing is, NOT by how much room it saves:
  //   1. the key hints — the same sentence all match; you learn them once
  //   2. the roster — slow-moving, and the scoreboard (Tab) has the full version any time
  // The age line is not in the ladder at all: an age you cannot see is an age you forget to spend on,
  // and the enemy's is the only warning you get.
  // (v125 had the haul in this ladder as a third rung, and on a 1366 laptop it was the rung that got
  // pulled — so the one time it had something to say was the one time it could not fit. v125.1 moves
  // the haul off the strip entirely and onto the caption, which is both what John asked for and the
  // reason this ladder is now short enough to be comfortable.)
  //
  // Measured synchronously — show, measure, decide, all before the browser paints — so there is no
  // flicker. Re-run only when something that could change a width actually changes, because it costs
  // a forced layout: doing it every frame at 60fps for a string that changes twice a match is waste.
  const SACRIFICE=[tip,document.getElementById("roster")].filter(Boolean);
  let fitSig="";
  // NOT scrollWidth. The group is justify-content:flex-end, so its contents overflow to the LEFT —
  // and scrollWidth does not count overflow on the start side, so it reported "fits" while the hint
  // was being sliced off its left edge and the bar showed "...er or Storage Pit". Sum the children
  // and compare to the content box; that is true whichever side the spill lands on.
  function groupOver(){
    let sum=0;
    for(const el of gR.children){
      if(el.offsetParent===null)continue;          // display:none contributes nothing
      sum+=el.offsetWidth;                         // no margins in the strip, so widths are the total
    }
    return sum>gR.clientWidth+1;
  }
  function fitRight(){
    for(const el of SACRIFICE)el.classList.remove("dsqueeze");
    for(const el of SACRIFICE){
      if(!groupOver())break;                       // it fits — stop giving things up
      el.classList.add("dsqueeze");
    }
  }
  function tickFit(){
    const sig=innerWidth+"|"+(tip?tip.textContent:"")+"|"+
      document.getElementById("agebar").textContent+"|"+
      document.getElementById("roster").textContent.length;
    if(sig===fitSig)return;
    fitSig=sig;
    fitRight();
  }
  addEventListener("resize",()=>{fitSig="";});

  (function tickBar(){
    requestAnimationFrame(tickBar);
    drainCrowns();
    tickAgeLine();
    tickAuto();
    tickFit();
  })();

  // ---------- THE MINIMAP, BEHIND A BUTTON ----------
  // John's pick, same as on the phone: maximum clear screen, one click to check the map.
  // M already opens the sound options on the action grid — that is a MOBILE grid entry, so on
  // desktop the key is free. Wired here rather than in 06-input because the whole idea is
  // bar-mode-only: ?ui=classic must still get the always-on map.
  function mapOn(v){document.documentElement.classList.toggle("dmapon",v);}
  mapBtn.addEventListener("click",()=>{
    mapOn(!document.documentElement.classList.contains("dmapon"));
  });
  addEventListener("keydown",e=>{
    if(e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;
    const k=(e.key||"").toLowerCase();
    if(k==="m"){mapOn(!document.documentElement.classList.contains("dmapon"));}
  });

  // ---------- THE CONTROLS ----------
  // The help panel lived in the bottom-right corner, which the strip now owns. It becomes a "?"
  // segment in the bar and opens CENTRED — John's choice. toggleHelp() in 06-input already flips
  // both elements, so reuse it rather than duplicating the state; the CSS below hides the old
  // corner toggle and re-places the panel, and the panel starts CLOSED (it opened by default
  // before, which is fine tucked in a corner and is not fine across the middle of the screen).
  const helpPanel=document.getElementById("help");
  if(helpPanel)helpPanel.style.display="none";
  helpBtn.addEventListener("click",()=>{
    if(typeof toggleHelp==="function")toggleHelp();
  });

  // ---------- CSS ----------
  // Everything is scoped under .bar-mode so ?ui=classic gets the untouched v124 sheet, and so this
  // block can never reach the phone (where html carries touch-mode instead).
  const css=document.createElement("style");
  css.textContent=`
  /* ===== THE STRIP ===== */
  /* Full width, flush to the bottom edge. The background runs to the physical edge and the border
     is on TOP only — an edge-anchored bar with a border all the way round reads as a floating
     panel that happens to be near the bottom. */
  .bar-mode #dbar{position:fixed;left:0;right:0;bottom:0;z-index:12;
    display:flex;align-items:center;overflow:hidden;height:46px;padding:0 6px;
    background:var(--parch);border:0;border-top:3px solid var(--ink);border-radius:0;
    box-shadow:0 -3px 0 rgba(0,0,0,.35), inset 0 0 0 2px var(--parch2);
    color:var(--ink)}
  /* strip the panel chrome off every segment: they are parts of one object now, not seven boxes */
  .bar-mode #dbar>*,.bar-mode #dbarL>*,.bar-mode #dbarR>*{
    position:static!important;transform:none!important;margin:0!important;
    display:flex!important;align-items:center;background:none!important;border:0!important;
    border-radius:0!important;box-shadow:none!important;padding:0 9px!important;
    white-space:nowrap;line-height:1!important;max-width:none!important;min-width:0!important;
    text-align:left!important;color:var(--ink)!important;opacity:1;height:100%}
  /* dividers go BETWEEN segments inside each group, and around the centre panel — not between the
     three top-level boxes, which would draw a rule in the middle of empty space */
  .bar-mode #dbarL>*+*,.bar-mode #dbarR>*+*{border-left:1px solid rgba(43,29,18,.22)!important}
  .bar-mode #dbar>#playerhud{border-left:1px solid rgba(43,29,18,.22)!important;
    border-right:1px solid rgba(43,29,18,.22)!important}
  .bar-mode #dbarL,.bar-mode #dbarR{display:flex;align-items:center;height:100%;
    flex:1 1 0;min-width:0;overflow:hidden}
  .bar-mode #dbarR{justify-content:flex-end}
  /* v124.13a, carried across: kings hold their size, resources give way. The group clips its LAST
     child, so with resources first a four-digit stockpile cut the red crown in half. */
  .bar-mode #dbar #kings{order:0;flex:0 0 auto;gap:9px!important;padding:0 10px!important}
  .bar-mode #dbar #resources{order:1;flex:0 1 auto;min-width:0;overflow:hidden;gap:15px!important;
    font-variant-numeric:tabular-nums}
  .bar-mode #dbar .res{font-size:15px}
  /* flex:0 0 auto on the age line and the roster: they are never shrunk, only the segments named
     in SACRIFICE are ever removed, and they are removed WHOLE rather than clipped to nonsense */
  /* flex:0 0 auto here too, and this matters: with 0 1 auto the hint SHRANK to fit instead of
     overflowing, so fitRight never saw an overflow to react to and the bar showed a hard-cut
     "E gather · B b". A segment that can shrink can never be dropped — the two rules fight. */
  .bar-mode #dbar #ptip  {order:2;flex:0 0 auto}
  .bar-mode #dbar #agebar{order:3;flex:0 0 auto;gap:8px;font-size:12.5px!important}
  .bar-mode #dbar #roster{order:4;flex:0 0 auto;font-size:12.5px!important}
  .bar-mode #carry{display:none!important}   /* the caption below carries the haul now */
  .bar-mode #dbar #dmap  {order:5;flex:0 0 auto}
  .bar-mode #dbar #dhelp {order:6;flex:0 0 auto}
  .bar-mode #dbar .dhidden{display:none!important}
  /* what a narrow window gives up, in order — see the priority note in the JS */
  .bar-mode #dbar .dsqueeze{display:none!important}
  /* the age line, in the two-age form the phone uses */
  .bar-mode #dbar .agemine{font-size:13px;letter-spacing:.5px;font-weight:bold}
  .bar-mode #dbar .agefoe {font-size:13px;letter-spacing:.5px;font-weight:bold;color:#8a3a30}
  .bar-mode #dbar .agevs  {font-size:10.5px;opacity:.5;letter-spacing:1.5px}
  .bar-mode #dbar .agecd  {font-size:12.5px;font-weight:bold;color:#8a6a12;
    background:rgba(224,169,46,.22);padding:3px 7px;border-radius:3px}
  /* the two new buttons: flat until hovered, so they read as part of the parchment */
  .bar-mode #dbar #dmap,.bar-mode #dbar #dhelp{cursor:pointer;justify-content:center;
    font-size:18px;color:var(--ink)!important;opacity:.72;transition:opacity .12s}
  .bar-mode #dbar #dhelp{font:bold 17px/1 "Trebuchet MS",sans-serif}
  .bar-mode #dbar #dmap:hover,.bar-mode #dbar #dhelp:hover{opacity:1}
  .bar-mode.dmapon #dbar #dmap{opacity:1;background:rgba(43,29,18,.12)!important}

  /* ===== THE UNIT PANEL, DEAD CENTRE ===== */
  /* It has to stay a COLUMN inside a row of rows: class name over the bar, with the keyboard hint
     inline beside them. Nothing else may claim the strip's slack or the centre line drifts. */
  /* A GRID, not a flex row, and this is the whole point of it: "1fr auto 1fr" with only two
     children puts the BAR in the middle column and leaves the third empty, so the bar lands on the
     panel's exact midpoint — and since the panel lands on the screen's midpoint, the bar does too.
     A flex row centres the pair, which is a different thing: the class name's width pushes the bar
     off centre by half of it, and no amount of measuring the PANEL would ever show that. */
  .bar-mode #dbar #playerhud{flex:0 0 auto;display:grid!important;
    grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;
    padding:0 14px!important}
  .bar-mode #dbar #pclass{font-size:14px!important;font-weight:bold;letter-spacing:.5px;
    text-align:right;white-space:nowrap}
  .bar-mode #dbar #playerhud .bar{width:300px;height:17px!important;border-width:2px!important;
    border-radius:3px!important;background:#5a4632;margin:0!important}
  /* the key hints stay — this IS a keyboard, which is the whole reason the phone drops them —
     but they ride in the right-hand group now, not inside the centre panel */
  .bar-mode #dbar #ptip{font-size:11px!important;opacity:.6;margin:0!important;white-space:nowrap}

  /* ===== THE CROWNS ARE THE METERS ===== */
  .bar-mode #dbar .kingbox{width:auto!important;padding:0!important;display:flex!important;
    align-items:center;gap:5px;background:none!important;border:0!important;
    box-shadow:none!important;border-radius:0!important}
  /* John's idea, and a better one than a crown beside a bar: fill the GLYPH with its own health.
     background-clip:text paints the gradient through the letterform, so the "sand" drains along
     the crown's silhouette instead of down a rectangle. --hp is written per frame in JS. */
  .bar-mode #dbar .kingbox .lbl{font-size:34px!important;margin:0!important;line-height:1!important;
    letter-spacing:0!important;font-weight:normal!important;
    --hp:100%; --col:#6f86d6;
    background:linear-gradient(to top,var(--col) 0,var(--col) var(--hp),
      #b3a68c var(--hp),#b3a68c 100%);
    -webkit-background-clip:text;background-clip:text;
    color:transparent!important;-webkit-text-fill-color:transparent;
    filter:drop-shadow(0 1px 0 rgba(43,29,18,.55))}
  /* the drained part must CONTRAST with the fill whatever the fill is, or a full crown and an empty
     one look the same at a glance */
  .bar-mode #dbar .kpct{font:bold 12.5px/1 "Trebuchet MS",sans-serif;letter-spacing:0;
    -webkit-text-fill-color:currentColor}
  .bar-mode #dbar #kb0 .kpct{color:#2f57c9}
  .bar-mode #dbar #kb1 .kpct{color:#b4291b}
  .bar-mode #dbar #kb0 .lbl{--col:#6f86d6}
  .bar-mode #dbar #kb1 .lbl{--col:#d05a4c}
  /* under a quarter health the crown pulses — you should not have to read a number to know */
  .bar-mode #dbar .kingbox .lbl.hurt{animation:dcrownpulse 1.15s ease-in-out infinite}
  @keyframes dcrownpulse{0%,100%{filter:drop-shadow(0 1px 0 rgba(43,29,18,.55))}
    50%{filter:drop-shadow(0 0 7px rgba(255,90,60,.95))}}
  .bar-mode #dbar .kingbox .bar{display:none!important}  /* the crown IS the bar now */

  /* ===== THE GATHERING CAPTION ===== */
  /* Lower centre, clear of the strip. Same language as the phone's — a dark wash rather than
     parchment, because it is transient narration over the battlefield and not part of the HUD
     furniture. It has to clear the strip's FULL height: the phone version originally sat at
     bottom:78px and John's field shot came back with "gathering" printed across the word VILLAGER. */
  .bar-mode #dauto{position:fixed;left:50%;bottom:70px;transform:translateX(-50%);
    padding:5px 14px;border-radius:3px;color:#fff;background:rgba(0,0,0,.45);
    font:600 14px/1.2 "Trebuchet MS",Verdana,sans-serif;letter-spacing:.3px;
    z-index:11;pointer-events:none;display:none;white-space:nowrap;
    text-shadow:0 1px 2px rgba(0,0,0,.6)}
  .bar-mode #dauto.on{display:block}

  /* ===== THE TOP OF THE SCREEN ===== */
  /* the frame read-out: bare lettering, deliberately faint, out of everything's way */
  .bar-mode #dfps{position:fixed;left:50%;top:7px;transform:translateX(-50%);z-index:11;
    font:600 12px/1 ui-monospace,monospace;color:#f2ead4;opacity:.5;pointer-events:none;
    text-shadow:0 1px 2px rgba(0,0,0,.7)}
  /* the standing objective drops below it rather than sharing the line */
  .bar-mode #objective{top:26px}
  /* the minimap: hidden until asked for, top-right where it always was */
  .bar-mode #minimapwrap{display:none}
  .bar-mode.dmapon #minimapwrap{display:block}

  /* ===== THE FEED AND THE QUEST, TOP-LEFT ===== */
  /* The strip owns the bottom edge, so the feed swaps to the corner the stockpile just vacated. It
     reads bottom-up in the DOM, so column-reverse keeps the newest line nearest the top edge
     rather than letting it sink away from where you are looking. */
  .bar-mode #feed{left:14px;top:44px;bottom:auto;max-height:42%;max-width:430px}
  /* THE QUEST, PINNED — dressed as a feed line, not a panel. It shares the corner with the feed,
     so looking like a different species of object made that corner read as two competing widgets.
     Same background, same left-border accent (gold: a quest IS the standing objective), same type
     size — it simply never scrolls away. */
  .bar-mode #questhud{position:fixed!important;left:14px!important;top:14px!important;
    bottom:auto!important;min-width:0!important;max-width:430px!important;
    background:rgba(30,22,12,.82)!important;color:#f2e7c8!important;
    border:0!important;border-left:4px solid var(--gold)!important;border-radius:3px!important;
    box-shadow:none!important;padding:5px 10px!important;z-index:11;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  /* ONE line: the level and the posting sit inline instead of stacking */
  .bar-mode #qlvl,.bar-mode #qtext{display:inline!important;font-size:13px!important;
    margin:0!important;color:#f2e7c8!important;font-weight:normal!important}
  .bar-mode #qlvl{color:#e8c53a!important;font-weight:bold!important}
  .bar-mode #qlvl::after{content:" · ";opacity:.45}
  .bar-mode #qbuffs{display:none!important}   /* buffs live on the scoreboard, not the corner */

  /* ===== THE CONTROLS, CENTRED ===== */
  .bar-mode #helptoggle{display:none!important}
  .bar-mode #help{position:fixed;left:50%;top:50%;right:auto;bottom:auto;
    transform:translate(-50%,-50%);z-index:45;padding:18px 26px;font-size:14px;line-height:2}
  `;
  document.head.appendChild(css);

  // 09-main already ran updateAgeHud/updateRoster before bar-mode existed on <html>, so the first
  // paint would otherwise show desktop copy in a strip sized for the compact form.
  try{if(typeof updateAgeHud==="function")updateAgeHud();}catch(e){}
  try{if(typeof updateRoster==="function")updateRoster();}catch(e){}

  // ---------- the read-out ----------
  let fr=0,acc=0,worst=999,n=0,last=0;
  (function tickFps(t){
    requestAnimationFrame(tickFps);
    if(!last){last=t||performance.now();return;}
    const now=t||performance.now();
    const dt=Math.min(0.5,(now-last)/1000); last=now;
    if(dt<=0)return;
    fr++; acc+=dt*1000;
    const fps=1/dt;
    if(dt<0.4&&fps<worst)worst=fps;
    if(acc>=500){
      const avg=fr/(acc/1000);
      // never print the 999 sentinel: dt>=0.4s frames are excluded from the worst-frame tracker (a
      // tab-switch stall is not a hitch), so on a renderer slow enough that EVERY frame is excluded
      // the sentinel would leak straight to the screen as "min 999".
      fpsEl.textContent=Math.round(avg)+" fps (min "+Math.round(Math.min(worst,avg))+")";
      fr=0;acc=0;
      if(++n%20===0)worst=999;   // forget the worst frame every 10s or one hitch marks it for ever
    }
  })();
})();
