#!/usr/bin/env node
/* patch-dmgnum.js — v132.46: the number that flies off what you just hit.
 *
 * ── WHY THIS IS THE RIGHT REQUEST AT THE RIGHT TIME ─────────────────────────────────────────
 * Sixty buffs now sit between the swing and the wound. HONED EDGE, PHALANX, WOODSMAN, KING'S
 * GUARD, FIRST BLOOD, WILD SLAYER and DESPERATION all multiply; KILLING FRENZY adds flat; KEEN EYE
 * doubles; RAISED SHIELD, UNBOWED, BEAST WARDEN and both blocks subtract on the way in. A player
 * currently has no way to know whether any of it is working. A number settles it.
 *
 * ── IT IS READ AFTER EVERYTHING, NOT COMPUTED ALONGSIDE ─────────────────────────────────────
 * The hook is at `victim.hp-=dmg`, which is the single line where damage becomes real — past every
 * multiplier, past the dodge, past both charge blocks, past the shield. Anything computed earlier
 * would be a number the game did not actually use, which is worse than no number at all.
 *
 * ── SUB-1 HITS ACCUMULATE, OR SEARING PRESENCE PAINTS THE SCREEN WITH ZEROES ────────────────
 * SEARING PRESENCE calls dealDamage with 1*stacks*0.25 four times a second. Rounded, that is "0",
 * four times a second, per burning enemy. So fractional damage banks on the victim and emits once
 * it crosses 1 — which turns a burn into one honest "1" a second instead of a stutter of nothing.
 *
 * ── AND THEY FAN OUT ────────────────────────────────────────────────────────────────────────
 * RAPID VOLLEY lands three blows inside one call. Three numbers at one point is one unreadable
 * number, so each spawn on the same victim inside a short window steps sideways and starts a
 * little higher.
 *
 * ── CANVAS, CACHED BY VALUE ─────────────────────────────────────────────────────────────────
 * _makeTagSprite already draws text this way and notes that the headless stubs no-op it safely,
 * so this is the established path rather than a new one. A texture per DISTINCT VALUE is built
 * once and kept — a match uses a narrow band of numbers, and the cache is capped so a long game
 * with strange values cannot grow it without bound.
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

sub("the number renderer",
`function fxTex(){return {soft:_texSoft,blade:_texBlade,sliver:_texSliver};}`,
`// ---------- v132.46 DAMAGE NUMBERS ----------
// A texture per DISTINCT VALUE, built once and cached. A match uses a narrow band of numbers, so
// the cache stays small; the cap is there for the long game with strange ones, not for the normal
// case. Same canvas path as _makeTagSprite, including its note that the headless stubs no-op it.
const DNUM_CACHE=192;
let _dnumTex=null,_dnumOrder=null,_dnumMade=0;
function _dnumTexFor(n,crit){
  if(!_dnumTex){_dnumTex={};_dnumOrder=[];}
  const key=(crit?"c":"n")+n;
  if(_dnumTex[key])return _dnumTex[key];
  const c=document.createElement("canvas"); c.width=128; c.height=64;
  const g=c.getContext("2d");
  if(g.clearRect){                                  // headless stubs no-op all of this safely
    g.clearRect(0,0,128,64);
    g.font=(crit?"bold 46px":"bold 36px")+" Georgia, serif";
    g.textAlign="center"; g.textBaseline="middle";
    g.lineWidth=7; g.strokeStyle="rgba(18,10,4,0.92)";
    g.strokeText(String(n),64,32);
    g.fillStyle=crit?"#FFD24A":"#F4EEDC";           // a crit is GOLD and larger — it must not read
    g.fillText(String(n),64,32);                    // as a normal blow with a bigger font alone
  }
  const t=new THREE.CanvasTexture(c);
  t.magFilter=THREE.LinearFilter; t.minFilter=THREE.LinearFilter; t.generateMipmaps=false;
  _dnumTex[key]=t; _dnumOrder.push(key); _dnumMade++;
  if(_dnumOrder.length>DNUM_CACHE){                 // evict the oldest, and dispose it properly
    const old=_dnumOrder.shift();
    if(_dnumTex[old]&&_dnumTex[old].dispose)_dnumTex[old].dispose();
    delete _dnumTex[old];
  }
  return t;
}
// ⚠ FRACTIONAL DAMAGE BANKS. SEARING PRESENCE deals 0.25 four times a second; rounded that is a
// "0" four times a second per burning enemy. Banking turns it into one honest "1" a second.
function dmgNum(victim,amount,crit){
  if(!victim||!victim.root||typeof scene==="undefined"||typeof THREE==="undefined")return false;
  victim._dnumBank=(victim._dnumBank||0)+amount;
  if(victim._dnumBank<1)return false;
  const n=Math.floor(victim._dnumBank);
  victim._dnumBank-=n;
  // …and they FAN OUT. Three volley blows at one point is one unreadable number.
  const t=(typeof T!=="undefined")?T:0;
  if(t-(victim._dnumT||-99)>0.45)victim._dnumI=0;
  const i=(victim._dnumI=(victim._dnumI||0)+1)-1;
  victim._dnumT=t;
  const off=(i%3-1)*0.85;
  fxs(victim.root.position.x+off,victim.root.position.y+3.1+i*0.28,victim.root.position.z,
      0xffffff,crit?1.15:0.85,crit?1.25:1.0,
      off*0.5,2.3,0, -1.6, 1, 1, {map:_dnumTexFor(n,!!crit),ar:2.0});
  return true;
}
function dnumStats(){return {cached:_dnumTex?Object.keys(_dnumTex).length:0,made:_dnumMade};}
function fxTex(){return {soft:_texSoft,blade:_texBlade,sliver:_texSliver};}`);

sub("fxs accepts an explicit map",
`  m.material.map=(o.tex==="blade")?_texBlade:(o.tex==="sliver")?_texSliver:_texSoft;`,
`  // o.map is an explicit texture (the damage numbers); o.tex names one of the three shapes
  m.material.map=o.map?o.map:(o.tex==="blade")?_texBlade:(o.tex==="sliver")?_texSliver:_texSoft;`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched js/05-combat.js — the damage-number renderer");
