#!/usr/bin/env node
/* v131.27 — THE ONE NUMBER THAT TESTS THE ACTUAL ARGUMENT FOR A SEVENTH HELMET
   ---------------------------------------------------------------------------
   node tools/helmprofile.js

   §H A1b thresholds the crown into a binary mask and fails any pair whose IoU exceeds 0.70, and it
   shoots HEAD-ON — its own comment says so, and gives the reason: "a three-quarter turn foreshortens
   a neck guard into a dome and a transverse crest into a bump."

   That is exactly the axis on which a houndskull is invisible. The whole case for giving the knight
   a seventh shape rather than a seventh paint job is that its visor PROJECTS FORWARD, which no
   other hat in the set does in any amount — and forward projection is precisely what a head-on
   camera collapses to nothing. Run through agecheck.js as a seventh unit on the melee ladder the
   knight scores 0.696 against the great helm — a pass, by 0.004, on the one axis that cannot see
   the thing that was built. (Head-on with the head-cluster masks this file uses it is 0.664, which
   is the same story with the horse taken out of the picture: see below.)

   So this runs A1b's own comparison on the PROFILE. Same binary threshold against a measured chroma
   key, same normalisation to a common mask height, same IoU — one rotation apart. If the beak is
   real, the knight separates here by a distance head-on cannot see; if it is not, this says so
   plainly and the shape needs more work rather than a better photograph.

     node tools/helmprofile.js            profile  — the axis the seventh shape was built for
     node tools/helmprofile.js headon     A1b's own axis, for the comparison

   TWO THINGS THIS DOES THAT agecheck.js's A1b DOES NOT, and both are why its numbers differ:
     · it masks the HEAD CLUSTER ONLY. A1b frames on the figure's bounding box, and the knight is
       mounted — his box is a horse, so he is shot from twice the distance and his hat arrives as a
       90px mask to be compared against a 192px one. Here every subject is shot at one fixed world
       scale with everything outside R.head hidden.
     · the ratios it prints are HEAD + BEARD + HAT, not hat alone. They are not comparable to
       §6.5b's per-hat targets and must not be read as if they were.

   Compared against the hats most at risk of duplication: the vanguard's great helm, which owns the
   same age from the infantry side, the musketeer's shako, which is the other tall one, and the
   Classical and Iron helms below them. */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),cp=require("child_process");
const ROOT=path.join(__dirname,".."), OUT=path.join(ROOT,"_helmprofile");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
const W=420,H=520;
const SUBJECTS=[["knight",4],["vanguard",4],["musketeer",5],["legionaire",3],["broadsword",2]];
const HEADON=process.argv[2]==="headon";

function maskOf(file){
  const raw=cp.execSync(`convert ${JSON.stringify(file)} -depth 8 -colorspace sRGB rgb:-`,{maxBuffer:1<<28});
  // the key is MEASURED off the corner, not assumed: the grade multiplies blue by 0.97 and bloom
  // bleeds the figure outward, so what comes out is not what went in (agecheck.js's note).
  const bg=[raw[0],raw[1],raw[2]];
  const m=new Uint8Array(W*H);
  for(let i=0;i<W*H;i++){
    const d=Math.abs(raw[i*3]-bg[0])+Math.abs(raw[i*3+1]-bg[1])+Math.abs(raw[i*3+2]-bg[2]);
    m[i]=d>90?1:0;
  }
  return m;
}
function crop(m){
  let x0=W,x1=-1,y0=H,y1=-1;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(m[y*W+x]){
    if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;}
  return {x0,x1,y0,y1};
}
// NORMALISE ON HEIGHT ONLY, which is A1b step 3 verbatim: "the hats are compared as SHAPES, and
// scaling both axes independently would turn a tall narrow bucket into a wide flat one and call
// them the same." Resample into a common 128-tall box at each mask's own aspect.
const NH=128;
function norm(m,c){
  const w=c.x1-c.x0+1, h=c.y1-c.y0+1, nw=Math.max(1,Math.round(w*NH/h));
  const o=new Uint8Array(nw*NH);
  for(let y=0;y<NH;y++)for(let x=0;x<nw;x++){
    const sx=c.x0+Math.floor(x*w/nw), sy=c.y0+Math.floor(y*h/NH);
    o[y*nw+x]=m[sy*W+sx];
  }
  return {d:o,w:nw,h:NH};
}
function iou(A,B){
  const w=Math.max(A.w,B.w); let inter=0,uni=0;
  for(let y=0;y<NH;y++)for(let x=0;x<w;x++){
    // align on the mask's own left edge, which is the back of the head in profile — the datum a
    // helmet is actually fitted from
    const a=x<A.w?A.d[y*A.w+x]:0, b=x<B.w?B.d[y*B.w+x]:0;
    if(a&&b)inter++; if(a||b)uni++;
  }
  return uni?inter/uni:0;
}

(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}catch(e){r.writeHead(404);r.end();}}).listen(8236);
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await b.newPage({viewport:{width:W,height:H}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message));
  await page.goto("http://localhost:8236/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof units!=="undefined"&&typeof makeUnit==="function",null,{timeout:45000});
  await page.evaluate(()=>{
    for(const el of document.querySelectorAll("body > *:not(canvas)"))el.style.display="none";
    try{inMenu=false;}catch(e){} window.requestAnimationFrame=()=>0;
    for(const u of units)u.root.visible=false;
    for(const t of worldDeco)t.visible=false;
    for(const bl of buildings)if(bl.body)bl.body.visible=false;
    scene.background=new THREE.Color(0xB020C0);
    for(const c of scene.children)if(!c.isLight&&c!==scene.background)c.visible=false;
    if(typeof scene.fog!=="undefined")scene.fog=null;
  });
  const files=[];
  for(const [cls,age] of SUBJECTS){
    await page.evaluate(({cls,age,yaw})=>{
      if(window.__p){window.__p.alive=false; if(window.__p.root.parent)window.__p.root.parent.remove(window.__p.root);}
      teamAge[0]=age;
      const u=makeUnit(0,cls,0,140,{name:""}); window.__p=u;
      for(const c of scene.children)if(!c.isLight)c.visible=false;
      u.root.visible=true;
      for(const p of u.root.children)p.visible=false;
      u.body.visible=true;
      u.root.position.set(0,0,140);
      // PROFILE, which is the whole point of this file. `node tools/helmprofile.js headon` swings
      // it back to A1b's own axis so the two runs can be set side by side — the same masks, the
      // same normalisation, one rotation apart.
      u.facing=0; u.body.rotation.set(0,yaw,0);
      // >>> SHOW THE HEAD CLUSTER AND NOTHING ELSE. <<< The first run framed on the head but left
      // the rest of the figure drawn, and the knight's mask came back 420px wide in a 420px frame:
      // that is a 5.4-unit couched lance and a horse crossing the shot, not a hat. Every IoU
      // computed from it was a statement about tack. R.head is a merge cluster, so hiding every
      // mesh outside its subtree leaves exactly the skull, beard and helmet.
      const keep=new Set(); u.rig.head.traverse(o=>keep.add(o));
      u.body.traverse(o=>{ if(o.isMesh)o.visible=keep.has(o); });
      // frame it at the SAME world scale for every subject. The knight is horsed; framing on the
      // BODY bounding box would shoot him from twice the distance and hand the comparison a 90px
      // mask to set against a 192px one, which is what the head-on A1b run did.
      const hw=new THREE.Vector3(); u.rig.head.getWorldPosition(hw);
      hw.y+=0.55;
      camera.position.set(hw.x,hw.y,hw.z+3.15);
      camera.lookAt(hw); camera.updateProjectionMatrix();
      renderer.shadowMap.needsUpdate=true; scene.updateMatrixWorld(true);
      if(typeof composer!=="undefined"&&composer)composer.render(); else throw new Error("no composer");
    },{cls,age,yaw:HEADON?0:Math.PI/2});
    await page.waitForTimeout(130);
    const f=path.join(OUT,cls+".png");
    await page.screenshot({path:f}); files.push([cls,f]);
  }
  await b.close(); srv.close();

  const M=files.map(([cls,f])=>{const m=maskOf(f); const c=crop(m);
    return {cls,n:norm(m,c),px:(c.x1-c.x0+1)+"x"+(c.y1-c.y0+1),
            hw:((c.y1-c.y0+1)/(c.x1-c.x0+1)).toFixed(2)};});
  console.log("\n=== "+(HEADON?"HEAD-ON":"PROFILE")+" SILHOUETTE IoU (A1b's comparison, one axis over) — FAIL > 0.70 ===");
  for(const m of M)console.log("  "+m.cls.padEnd(12)+m.px.padStart(9)+"px   h/w="+m.hw+"   normalised w="+m.n.w);
  console.log("");
  let worst=0,wp="";
  for(let i=0;i<M.length;i++)for(let j=i+1;j<M.length;j++){
    const v=iou(M[i].n,M[j].n);
    const tag=(M[i].cls==="knight"||M[j].cls==="knight")?"  <-- knight":"";
    console.log("   "+(M[i].cls+"/"+M[j].cls).padEnd(26)+"IoU "+v.toFixed(3)+(v>0.70?"  *** FAIL":"        ")+tag);
    if(v>worst){worst=v;wp=M[i].cls+"/"+M[j].cls;}
  }
  console.log("\n  worst pair "+wp+" = "+worst.toFixed(3)+(worst<=0.70?"   PASS":"   FAIL"));
  cp.execSync("montage -tile "+files.length+"x1 -geometry "+W+"x"+H+"+3+3 -background '#202024' "+
    files.map(f=>JSON.stringify(f[1])).join(" ")+" "+JSON.stringify(path.join(OUT,"strip.png")));
  console.log("  strip -> _helmprofile/strip.png\n");
  process.exit(0);
})().catch(e=>{console.error("CRASH:",e);process.exit(1);});
