#!/usr/bin/env node
/* nodehash.js — REBUILT for v132.28. The original was lost in the container wipe.
 *
 * WHAT IT IS FOR (invariant #3): world gen runs under a seeded Math.random window
 * (js/02-world.js:204 .. :2416) and `nodes[]` is indexed POSITIONALLY by the netcode. Anything
 * that changes the NUMBER of Math.random() draws inside that window moves every node on the
 * wire, even if the change looks purely cosmetic. This is the tool that says whether that
 * happened. `res` holding while `all` moves is the signature of a change downstream of
 * placeNodes.
 *
 * ⚠ THE OLD DIGESTS DO NOT CARRY OVER. The handoff records v132.26/.27 as
 *      all=27c3c30b9234448b · res=fc5de53990586a44
 *   but those came from the original tool's own hash construction, which is gone. A different
 *   construction over identical data yields a different digest, so comparing this tool's output
 *   against those two strings would be meaningless — and, worse, would look like a moved world.
 *   THE COUNTS still carry over and are checked here: 743 nodes, 674 wood.
 *
 * So the real test this version is DIFFERENTIAL, and it is stronger than a stored constant:
 *   ROOT=<pristine tree> node tools/nodehash.js
 *   ROOT=<patched tree>  node tools/nodehash.js
 * and compare. The pristine tree is the untouched staging copy of John's disk. Two trees, one
 * algorithm, same run — nothing to misremember. Record the new digests in the handoff as the
 * v132.28 baseline for future sessions.
 *
 * Usage: [ROOT=/path/to/tree] node tools/nodehash.js
 */
const fs=require("fs"),path=require("path"),crypto=require("crypto");
const ROOT=process.env.ROOT?path.resolve(process.env.ROOT):path.join(__dirname,"..");

global.window=global;
const THREE=require(path.join(__dirname,"..","node_modules","three"));
global.THREE=THREE;
function mkEl(){return{style:{},classList:{toggle(){},add(){},remove(){}},innerHTML:"",textContent:"",
  dataset:{},children:[],firstChild:null,addEventListener(){},appendChild(){},removeChild(){},
  querySelector:()=>mkEl(),querySelectorAll:()=>[],
  getContext:()=>new Proxy({},{get:(t,k)=>(typeof t[k]!=="undefined")?t[k]:()=>{}}),width:0,height:0};}
const elems={};
global.document={getElementById:id=>elems[id]||(elems[id]=mkEl()),createElement:()=>mkEl(),
  querySelector:()=>mkEl(),querySelectorAll:()=>[],addEventListener(){},body:{appendChild(){}},
  exitPointerLock(){},pointerLockElement:null};
global.addEventListener=()=>{};
global.innerWidth=1280;global.innerHeight=720;global.devicePixelRatio=1;
global.location={reload(){}};
global.atob=s=>Buffer.from(s,"base64").toString("binary");
global.requestAnimationFrame=()=>{};
THREE.WebGLRenderer=function(){return{setSize(){},setPixelRatio(){},render(){},
  shadowMap:{},domElement:mkEl()}};
try{(0,eval)(fs.readFileSync(path.join(ROOT,"assets/anims.js"),"utf8"));}catch(e){}

const order=["00-data","01-engine","02-world","03-buildings","04-units","05-combat",
  "06-input","07-ai","08-ui","09-main","10-net","11-audio","12-touch","13-deskui"];
let bundle=order.map(f=>fs.readFileSync(path.join(ROOT,"js",f+".js"),"utf8")).join("\n");
bundle+="\n;global.__N={nodes,TREE_STANDS,CREEP_SITES,BAZAAR_SITES};";
try{(0,eval)(bundle);}catch(e){console.error("LOAD FAIL:",e.message);process.exit(1);}

const N=global.__N.nodes;
// canonical, order-preserving: index is the thing the wire cares about, so it is IN the digest.
const fx=v=>(Math.round(v*1e4)/1e4).toFixed(4);
const line=(n,i)=>[i,n.type,fx(n.x),fx(n.z),fx(n.y||0),n.amount].join(",");
const h=s=>crypto.createHash("sha256").update(s).digest("hex").slice(0,16);

const all=h(N.map(line).join("\n"));
// the finite prizes only — wood is 90% of the array and drowns out a moved gold pile
const res=h(N.map((n,i)=>({n,i})).filter(o=>o.n.type!=="wood").map(o=>line(o.n,o.i)).join("\n"));

const wood=N.filter(n=>n.type==="wood").length;
console.log("ROOT      ",ROOT);
console.log("nodes     ",N.length,"("+wood+" wood)");
console.log("all       ",all);
console.log("res       ",res);
console.log("stands    ",global.__N.TREE_STANDS?global.__N.TREE_STANDS.length:"?");
const okCount=(N.length===743&&wood===674);
console.log("counts    ",okCount?"OK — 743 / 674 as recorded at v132.26/.27":
  "⚠ MOVED — expected 743 nodes / 674 wood");
process.exit(okCount?0:1);
