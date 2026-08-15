#!/usr/bin/env node
/* fxshapes.js — render the procedural particle textures to a PNG so a claim about how something
 * LOOKS can be checked by looking at it.
 *
 * v132.44 shipped a "thrown knife" that was an untextured sprite — a solid square — and the patch
 * header called it "a knife you SEE thrown". Nothing in a 700-assertion suite catches that,
 * because no assertion is about appearance. This is the instrument for the class of claim that
 * only an eye can settle.
 *
 * It reads the SHIPPED generator functions out of js/05-combat.js rather than reimplementing
 * them, so what comes out is what the game builds — the same reason the aura screenshots and the
 * cue board decode the real bank instead of the source files.
 *
 * Usage: node tools/fxshapes.js  →  _fx/shapes.png
 */
const fs=require("fs"),path=require("path"),cp=require("child_process");
const ROOT=path.join(__dirname,"..");
const src=fs.readFileSync(path.join(ROOT,"js","05-combat.js"),"utf8");
// pull the real _mkTex + _texBuild out of the shipped file
// ⚠ start at the DECLARATIONS, not at the first function — _texSoft and friends are declared a
// few lines above _mkTex, and slicing from the function alone leaves them undefined.
const a=src.indexOf("let _texSoft=null"), b=src.indexOf("\n}",src.indexOf("function _texBuild("))+2;
if(a<0||b<2){console.error("could not find the texture builders in js/05-combat.js");process.exit(1);}
const body=src.slice(a,b);
const THREE={DataTexture:function(d,w,h){this.image={data:d,width:w,height:h};},RGBAFormat:1};
const out={};
new Function("THREE","out",body+"\n_texBuild();out.soft=_texSoft;out.blade=_texBlade;out.sliver=_texSliver;")
  (THREE,out);
const NAMES=["blade","sliver","soft"];
const PAD=8, SCALE=6;
let W=0,H=0;
for(const n of NAMES){const t=out[n].image; W=Math.max(W,t.width*SCALE); H+=t.height*SCALE+PAD*4;}
W+=PAD*2;
// compose a single RGB canvas: dark background, white shapes, a label strip under each
const buf=Buffer.alloc(W*H*3,18);
let y0=PAD;
for(const n of NAMES){
  const t=out[n].image, tw=t.width, th=t.height;
  for(let y=0;y<th*SCALE;y++)for(let x=0;x<tw*SCALE;x++){
    const sx=(x/SCALE)|0, sy=(y/SCALE)|0;
    const alpha=t.data[(sy*tw+sx)*4+3]/255;
    const px=((y0+y)*W+(PAD+x))*3;
    const v=Math.round(18+(235*alpha));
    buf[px]=v;buf[px+1]=v;buf[px+2]=Math.round(18+(200*alpha));
  }
  y0+=th*SCALE+PAD*4;
}
fs.mkdirSync(path.join(ROOT,"_fx"),{recursive:true});
const ppm=path.join(ROOT,"_fx","shapes.ppm"), png=path.join(ROOT,"_fx","shapes.png");
fs.writeFileSync(ppm,Buffer.concat([Buffer.from(`P6\n${W} ${H}\n255\n`),buf]));
cp.execSync(`ffmpeg -loglevel error -y -i ${JSON.stringify(ppm)} ${JSON.stringify(png)}`);
fs.unlinkSync(ppm);
for(const n of NAMES)console.log("  "+n.padEnd(7)+out[n].image.width+"x"+out[n].image.height);
console.log("\nwrote "+png+"  ("+W+"x"+H+", "+SCALE+"x nearest-neighbour, top to bottom: "+
  NAMES.join(", ")+")");
