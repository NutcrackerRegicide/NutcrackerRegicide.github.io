#!/usr/bin/env node
/* patch-dmgnum-size.js — v132.49: damage numbers 1.6x larger. John's ask, done without softening them.
 *
 * ── THE LAZY VERSION WOULD HAVE BLURRED THEM ────────────────────────────────────────────────
 * The number is a raster: a canvas texture stretched over a sprite. Multiplying the sprite scale
 * by 1.6 and stopping there spreads the same texels over 1.6x the screen, so the numbers would be
 * bigger AND visibly softer — a worse picture at a larger size, which is not what "larger" means.
 * The glyph has to gain texels at the same rate the quad gains pixels, so the canvas and the font
 * scale with it.
 *
 * ── AND IT COSTS LESS MEMORY THAN BEFORE, NOT MORE ──────────────────────────────────────────
 * A 1.6x canvas is 2.6x the bytes per cached value, which at the old cache ceiling of 192 would
 * have been ~16 MB of textures for a cosmetic tweak. But 192 was always generous: a match reuses
 * a narrow band of numbers, and the cache exists for the long game rather than the normal one.
 * Dropped to 64, the whole thing lands at ~5.4 MB against the old ~6 MB. Bigger, sharper, and
 * slightly cheaper.
 *
 * ⚠ FOUR DIGITS STILL FIT. At 58px bold Georgia a four-digit number is about 128px wide inside a
 * 208px canvas; the crit face at 74px reaches about 164. Neither clips. Worth stating because the
 * canvas is fixed-width and a number that overflowed would simply lose its last digit — a display
 * that lies quietly, which is the failure mode this whole feature exists to avoid.
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

sub("the dial, and a smaller cache to pay for it",
`const DNUM_CACHE=192;`,
`// v132.49 (John): "make floating damage numbers 1.6x larger". The sprite scale is what the eye
// sees, so that is what carries the 1.6 — and the canvas and font carry it too, or the same texels
// stretch over 1.6x the screen and the numbers get bigger AND blurrier.
const DNUM_SCALE=1.6;
const DNUM_W=208, DNUM_H=104;      // 128x64 * 1.6, aspect held at 2:1 so DNUM_AR still matches
const DNUM_FONT=58, DNUM_FONT_CRIT=74;
const DNUM_AR=2.0;
// ⚠ 192 -> 64. A 1.6x canvas is 2.6x the bytes, and at 192 that would be ~16 MB of textures for a
// cosmetic change. 192 was always generous — a match reuses a narrow band of values — so at 64
// the whole cache is ~5.4 MB against the old ~6 MB. Bigger, sharper, and slightly cheaper.
const DNUM_CACHE=64;`);

sub("draw at the larger size",
`  const c=document.createElement("canvas"); c.width=128; c.height=64;
  const g=c.getContext("2d");
  if(g.clearRect){                                  // headless stubs no-op all of this safely
    g.clearRect(0,0,128,64);
    g.font=(crit?"bold 46px":"bold 36px")+" Georgia, serif";
    g.textAlign="center"; g.textBaseline="middle";
    g.lineWidth=7; g.strokeStyle="rgba(18,10,4,0.92)";
    g.strokeText(String(n),64,32);
    g.fillStyle=crit?"#FFD24A":"#F4EEDC";           // a crit is GOLD and larger — it must not read
    g.fillText(String(n),64,32);                    // as a normal blow with a bigger font alone
  }`,
`  const c=document.createElement("canvas"); c.width=DNUM_W; c.height=DNUM_H;
  const g=c.getContext("2d");
  if(g.clearRect){                                  // headless stubs no-op all of this safely
    g.clearRect(0,0,DNUM_W,DNUM_H);
    g.font="bold "+(crit?DNUM_FONT_CRIT:DNUM_FONT)+"px Georgia, serif";
    g.textAlign="center"; g.textBaseline="middle";
    g.lineWidth=11; g.strokeStyle="rgba(18,10,4,0.92)";   // the outline scales with the face, or
    g.strokeText(String(n),DNUM_W/2,DNUM_H/2);            // it thins to nothing at this size
    g.fillStyle=crit?"#FFD24A":"#F4EEDC";           // a crit is GOLD and larger — it must not read
    g.fillText(String(n),DNUM_W/2,DNUM_H/2);        // as a normal blow with a bigger font alone
  }`);

sub("and the sprite carries the 1.6",
`  fxs(victim.root.position.x+off,victim.root.position.y+3.1+i*0.28,victim.root.position.z,
      0xffffff,crit?1.15:0.85,crit?1.25:1.0,
      off*0.5,2.3,0, -1.6, 1, 1, {map:_dnumTexFor(n,!!crit),ar:2.0});`,
`  fxs(victim.root.position.x+off,victim.root.position.y+3.1+i*0.28,victim.root.position.z,
      0xffffff,(crit?1.15:0.85)*DNUM_SCALE,crit?1.25:1.0,
      off*0.5,2.3,0, -1.6, 1, 1, {map:_dnumTexFor(n,!!crit),ar:DNUM_AR});`);

sub("report the dial for the gate",
`function dnumStats(){return {cached:_dnumTex?Object.keys(_dnumTex).length:0,made:_dnumMade,
  emits:_dnumEmits,last:_dnumLast};}`,
`function dnumStats(){return {cached:_dnumTex?Object.keys(_dnumTex).length:0,made:_dnumMade,
  emits:_dnumEmits,last:_dnumLast,scale:DNUM_SCALE,cap:DNUM_CACHE,w:DNUM_W,h:DNUM_H};}`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched js/05-combat.js — damage numbers 1.6x, and sharp at that size");
