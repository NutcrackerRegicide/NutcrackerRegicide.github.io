#!/usr/bin/env node
/* patch-fx-vignette.js — v132.42: SURVIVAL INSTINCT gets the visual I promised and never built.
 *
 * ── OWNING THIS ONE ─────────────────────────────────────────────────────────────────────────
 * v132.38 gave it a sound. v132.41's task list said "plus the Survival Instinct vignette
 * (own-player, local, no wire)" and then shipped eleven set-pieces, none of which was it. The
 * buff has had a cue and no picture for four versions.
 *
 * ── THE ONLY SCREEN-SPACE EFFECT IN THE WHOLE PLAN, AND WHY ─────────────────────────────────
 * Every other effect is in the world, because every other effect is about somebody. This one is
 * about YOU: you have just crossed under a quarter health and the game gave you five seconds of
 * speed to do something with. A red pulse at the edge of the screen is the only thing that
 * reaches you no matter where the camera is pointing, and it is wrong for anything that happens
 * to another unit — which is exactly why nothing else here uses it.
 *
 * ── DRIVEN LOCALLY, AND THAT IS NOT A SHORTCUT ──────────────────────────────────────────────
 * No wire. A guest already knows its own hp (authoritative, every snapshot) and its own buffs
 * (the `bff` message, since long before v132.40), so the crossing can be detected on the client
 * that needs to see it. The host-side `_lowLatch` in dealDamage is what gates the speed BUFF; this
 * is a separate display latch on the same condition, because the host's latch never reaches a
 * guest and a display that waited for it would only ever flash for the host.
 *   ⚠ It LATCHES, and clears at 40% rather than at 25%. Clearing at the same threshold makes a
 *   unit hovering at a quarter health flicker the whole screen every time a heal ticks it over
 *   the line and a blow takes it back under.
 *
 * ⚠ DRIVEN FROM renderFrame. It is the one function all three frame paths call — the same reason
 * the menu bed and the objective-ribbon fade live there. tickBody would work for a host and leave
 * a guest with a buff that never speaks (trap #12).
 */
const fs=require("fs"),path=require("path");
let failed=[];
function mk(box){return function(name,from,to){
  const n=box.o.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  box.o=box.o.split(from).join(to);};}
const P={html:path.join(__dirname,"..","index.html"),
         css:path.join(__dirname,"..","css","style.css"),
         main:path.join(__dirname,"..","js","09-main.js")};
const h={o:fs.readFileSync(P.html,"utf8")}, c={o:fs.readFileSync(P.css,"utf8")},
      m={o:fs.readFileSync(P.main,"utf8")};
const subH=mk(h), subC=mk(c), subM=mk(m);

subH("the overlay element",
`<div id="crosshair"></div>`,
`<div id="crosshair"></div>
<!-- v132.42 SURVIVAL INSTINCT. The only screen-space effect in the game: it is the one thing that
     is about YOU rather than about somebody in the world, so it is the one thing that has to
     reach you wherever the camera is pointing. pointer-events:none — it must never eat a click. -->
<div id="vig"></div>`);

subC("the vignette style",
`  .sclvl{color:#ffd24a;font-style:normal;font-size:11px}`,
`  /* v132.42 SURVIVAL INSTINCT — a red pulse at the edge of the screen when you cross under a
     quarter health. Radial, so the middle of the screen stays clear: it must warn without
     blinding you at the moment you can least afford it. */
  #vig{position:fixed;inset:0;pointer-events:none;z-index:9;opacity:0;
    background:radial-gradient(ellipse at center,
      rgba(180,20,20,0) 42%, rgba(180,20,20,0.30) 78%, rgba(150,12,12,0.62) 100%);
    transition:none}
  .sclvl{color:#ffd24a;font-style:normal;font-size:11px}`);

subM("drive it from the one function every frame path calls",
`function renderFrame(dt){
  tickObjectiveFade();`,
`// v132.42 SURVIVAL INSTINCT. Own player only, no wire: a guest already knows its own hp
// (authoritative every snapshot) and its own buffs, so the crossing is detectable on the client
// that needs to see it. The host's _lowLatch gates the speed BUFF and never reaches a guest.
// ⚠ It clears at 40%, not at 25%. Clearing at the same line makes a player hovering there flash
// the whole screen every time a heal ticks them over it and a blow takes them back under.
let _vigT=0, _vigLatch=false;
function tickVignette(dt){
  const el=(typeof document!=="undefined")?document.getElementById("vig"):null;
  if(!el||typeof player==="undefined"||!player)return;
  const frac=(player.maxHp>0)?Math.max(0,player.hp)/player.maxHp:1;
  const has=(typeof buffSt==="function")&&buffSt(player,"flight")>0;
  if(has&&player.alive&&frac<0.25&&!_vigLatch){_vigLatch=true;_vigT=1.0;}
  if(frac>0.40||!player.alive)_vigLatch=false;
  if(_vigT>0){
    _vigT=Math.max(0,_vigT-dt*1.6);
    el.style.opacity=String((0.55*_vigT*(0.72+0.28*Math.sin(_vigT*17))).toFixed(3));
  }else if(el.style.opacity!=="0")el.style.opacity="0";
}
function renderFrame(dt){
  tickObjectiveFade();
  tickVignette(dt);   // ⚠ HERE, not in tickBody: renderFrame is the one function all three frame
                      // paths call, so a guest sees it too. tickBody is trap #12.`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(P.html,h.o); fs.writeFileSync(P.css,c.o); fs.writeFileSync(P.main,m.o);
console.log("patched — Survival Instinct finally has a picture");
