#!/usr/bin/env node
/* v131.29 — HOW MUCH OF THE SEEDED STREAM DID THE OLD BAZAAR SPEND?
   -----------------------------------------------------------------
   node tools/streamdebt.js

   r128 mints a uuid in the constructor of BufferGeometry, Material AND Object3D, and generateUUID
   draws from Math.random(). js/02-world.js builds the world inside a seeded window and the netcode
   indexes nodes[] POSITIONALLY, so the number of objects constructed inside that window is part of
   the wire format — §10.7 spells this out for Math.random() calls and the uuids are the same thing
   one level down. Measured: merging the three bazaars from ~18 meshes each into one took the world
   from 736 nodes to 661.

   So moving the bazaar's geometry below the handback — which is where §G.4 says a merge has to be
   paid for — leaves a DEBT: draws the seeded sequence used to consume and now would not. This
   measures that debt exactly rather than deriving it from minified three.js, by reconstructing the
   old builder's object budget through the same helpers and counting.

   THE OLD BUDGET, read off git HEAD~1's js/02-world.js, per bazaar:
     1 Group
     19 Meshes, each with its own geometry and its own material (mat() has no cache):
       plaza, 4 posts, canopy, trim, 3 crates, rug, rugT, 2 strings, 2 goods, 2 pots, lantern
   That is 58 uuids per bazaar and 174 across the three.                                          */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
(async()=>{
  const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}catch(e){r.writeHead(404);r.end();}}).listen(8261);
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await b.newPage({viewport:{width:300,height:200}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message));
  await page.goto("http://localhost:8261/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof THREE!=="undefined"&&typeof mat==="function",null,{timeout:45000});

  const out=await page.evaluate(()=>{
    const count=fn=>{let n=0;const real=Math.random;
      Math.random=function(){n++;return real.apply(this,arguments);};
      try{fn();}finally{Math.random=real;}
      return n;};
    const perUUID=count(()=>{THREE.MathUtils.generateUUID();});
    const perGeo =count(()=>{new THREE.BoxGeometry(1,1,1);});
    const perMat =count(()=>{mat(0xffffff);});
    const perMesh=count(()=>{const g=new THREE.BoxGeometry(1,1,1),m=mat(0xffffff);new THREE.Mesh(g,m);});
    const perGroup=count(()=>{new THREE.Group();});
    // THE OLD BUILDER, reconstructed part for part through the same helpers it used. Nothing is
    // added to the scene: the cost being measured is CONSTRUCTION, which is where the uuids are.
    const oneBazaar=count(()=>{
      const g=new THREE.Group();
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(4.5,4.8,1.6,10),mat(0xd9c48f)));
      for(let i=0;i<4;i++)g.add(cyl(0.14,0.14,3,0x8a6a3f));
      g.add(cone(4,1.6,0xB4543A,4));
      g.add(cone(4.2,0.4,0xCFB53B,4));
      for(let i=0;i<3;i++)g.add(box(0.8,0.8,0.8,0xb08a5a));
      g.add(box(2.6,0.06,1.7,0x8e1f1f));
      g.add(box(2.7,0.05,0.3,0xe0a92e));
      for(let i=0;i<2;i++){
        g.add(cyl(0.03,0.03,0.7,0x9a8a6a,4));
        g.add(new THREE.Mesh(new THREE.SphereGeometry(0.24,6,5),mat(i?0xc23a3a:0xe0a92e)));
      }
      g.add(cyl(0.35,0.25,0.7,0xa8623a,7));
      g.add(cyl(0.28,0.2,0.55,0x8e4a2a,7));
      g.add(box(0.28,0.36,0.28,0xd9a92e));
    });
    return {perUUID,perGeo,perMat,perMesh,perGroup,oneBazaar};
  });

  console.log("\n  Math.random() draws per construction, measured in the shipped r128:");
  console.log("    generateUUID()          "+out.perUUID);
  console.log("    new BoxGeometry         "+out.perGeo);
  console.log("    mat()  (a Material)     "+out.perMat);
  console.log("    geo + mat + Mesh        "+out.perMesh);
  console.log("    new Group               "+out.perGroup);
  console.log("\n  ONE OLD BAZAAR, reconstructed part for part: "+out.oneBazaar+" draws");
  console.log("  THREE OF THEM — the debt the seeded window is owed: "+(out.oneBazaar*3));
  console.log("\n  Put that number in BAZAAR_STREAM_DEBT (js/02-world.js) and tools/nodehash.js must");
  console.log("  still read all=a0e4532bfa20051c res=2ac1ea6adf9f4553.\n");
  await b.close(); srv.close(); process.exit(0);
})().catch(e=>{console.error("CRASH:",e);process.exit(1);});
