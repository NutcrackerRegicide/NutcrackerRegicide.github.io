#!/usr/bin/env node
/* dmgshot.js — draw the damage numbers the way the game draws them, to a PNG.
 *
 * v132.44 shipped a "knife" that was a square and 702 assertions did not notice, because no
 * assertion is about appearance. This is the same instrument for the same class of claim: the
 * numbers either read at a glance or they do not, and only an eye settles that.
 *
 * It runs the SHIPPED _dnumTexFor out of js/05-combat.js against a real canvas, so what comes out
 * is what the game builds — not a reimplementation that could be prettier than the original.
 *
 * Usage: node tools/dmgshot.js   →  _fx/dmgnum.png
 */
const fs=require("fs"),path=require("path"),cp=require("child_process");
const ROOT=path.join(__dirname,"..");
let createCanvas=null;
try{ createCanvas=require("canvas").createCanvas; }
catch(e){ console.error("needs the `canvas` package: npm i canvas"); process.exit(1); }

const src=fs.readFileSync(path.join(ROOT,"js","05-combat.js"),"utf8");
const a=src.indexOf("const DNUM_CACHE="), b=src.indexOf("\n}",src.indexOf("function _dnumTexFor("))+2;
if(a<0||b<2){console.error("could not find _dnumTexFor");process.exit(1);}
const body=src.slice(a,b);
// stand in for the browser + three.js surfaces the shipped function touches
const made=[];
const THREE={CanvasTexture:function(c){this.image=c;made.push(c);},LinearFilter:1};
const document={createElement:()=>createCanvas(128,64)};
const out={};
new Function("THREE","document","out",body+"\nout.f=_dnumTexFor;")(THREE,document,out);

const SAMPLES=[[7,false],[12,false],[23,false],[48,false],[136,false],
               [24,true],[96,true],[272,true]];
const CW=128,CH=64,COLS=4,PAD=6;
const W=COLS*(CW+PAD)+PAD, H=Math.ceil(SAMPLES.length/COLS)*(CH+PAD)+PAD;
const sheet=createCanvas(W,H), g=sheet.getContext("2d");
g.fillStyle="#171922"; g.fillRect(0,0,W,H);
SAMPLES.forEach(([n,crit],i)=>{
  out.f(n,crit);
  const c=made[made.length-1];
  const x=PAD+(i%COLS)*(CW+PAD), y=PAD+Math.floor(i/COLS)*(CH+PAD);
  g.fillStyle=crit?"#241d10":"#1e2130"; g.fillRect(x,y,CW,CH);
  g.drawImage(c,x,y);
});
fs.mkdirSync(path.join(ROOT,"_fx"),{recursive:true});
const png=path.join(ROOT,"_fx","dmgnum.png");
fs.writeFileSync(png,sheet.toBuffer("image/png"));
console.log("normal: "+SAMPLES.filter(s=>!s[1]).map(s=>s[0]).join(", "));
console.log("crit  : "+SAMPLES.filter(s=>s[1]).map(s=>s[0]).join(", "));
console.log("wrote "+png+"  ("+W+"x"+H+")");
