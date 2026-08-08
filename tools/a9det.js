#!/usr/bin/env node
/* a9det.js — §H A9, THE DETERMINISM SWEEP. The gate that had never once been run.
 * ---------------------------------------------------------------------------------------------
 *   node tools/a9det.js [class,class,…]
 *
 * Renders every class TWICE, in two genuinely separate node processes with two separate chromium
 * launches, and diffs the figure region byte for byte. FAIL on any difference.
 *
 * WHY THIS IS THE ONLY TEST THAT CATCHES THIS CLASS OF BUG: a unit whose appearance came out of
 * Math.random() looks perfectly correct in any single screenshot. Every colour gate passes it.
 * Every silhouette gate passes it. It is only visible when you render the same soldier twice and
 * notice he is not the same soldier — which is exactly what a host and a guest are doing.
 *
 * It found `_blocks()` (01-engine.js), the 2px weave fill behind every uniform, cloth, hide, wood
 * and metal skin in the game: all six melee classes differed run to run, up to 4,507 pixels and 47
 * levels of channel on the clubman, concentrated on the torso — the exact band §H A2 measures ΔE
 * across, so the ladder's own score was not reproducible while it stood.
 *
 * TWO PROCESSES, NOT TWO PASSES IN ONE. `_skinCache` is module-level, so a second call inside one
 * process hands back the FIRST texture and an in-process re-render agrees with itself no matter
 * how random the factory is. The bug is invisible unless the whole VM is torn down between runs.
 *
 * THE STAGE IS CHROMA-KEYED, and that is not decoration. The first cut of this tool shot through
 * `unitshot`'s live world: grass instances, cloud planes and the drifting motes are not part of
 * unit appearance, they moved between runs for their own reasons, and 50,000 of them drowned the
 * ~4,000 pixels that were the actual defect. Anything left in frame is a second surface the diff
 * has to reject. Hide the world; key the background; count what is left. (agecheck.js §H A1/A2
 * established the trick and this is the same stage.)
 *
 * MEASURES WHAT IT DRAWS: composer.render(), never renderer.render() (§G.6).
 */
const cp=require("child_process"),fs=require("fs"),path=require("path"),http=require("http");
const ROOT=path.join(__dirname,"..");
const KEY=[0xB0,0x20,0xC0];                     // magenta: no unit surface is within 90 of it
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
// the six melee classes the critic diffed, plus one per age band and the king. A class that takes
// no skin from texturedMat cannot fail this; one that does can fail it anywhere.
const CLASSES=(process.env.A9_CLASSES||process.argv[2]||
  "clubman,shortsword,broadsword,legionaire,vanguard,musketeer,villager,archer,knight,king");

// ---------------- child: one render pass, one whole VM of its own ----------------
async function shoot(out,port){
  const {chromium}=require("playwright-core");
  fs.mkdirSync(out,{recursive:true});
  const srv=http.createServer((q,r)=>{
    const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}
    catch(e){r.writeHead(404);r.end();}
  }).listen(port);
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await b.newPage({viewport:{width:420,height:560}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message));
  await page.goto("http://localhost:"+port+"/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof units!=="undefined"&&typeof makeUnit==="function",null,{timeout:45000});
  await page.evaluate(k=>{
    for(const el of document.querySelectorAll("body > *:not(canvas)"))el.style.display="none";
    try{inMenu=false;}catch(e){} try{gameOver=false;}catch(e){}
    window.requestAnimationFrame=()=>0;                  // freeze the loop: no animation drift
    for(const c of scene.children)if(!c.isLight)c.visible=false;
    scene.fog=null; scene.background=new THREE.Color((k[0]<<16)|(k[1]<<8)|k[2]);
    window.__stage=(u)=>{
      for(const c of scene.children)if(!c.isLight)c.visible=false;
      u.root.visible=true;
      for(const p of u.root.children)p.visible=false;
      u.body.visible=true;                               // body only: no ring, no health bar
      u.root.position.set(0,0,140); u.facing=0; u.body.rotation.set(0,0,0);
      u.body.rotation.y=-0.6;                            // three-quarter: face AND shoulder line
      const bb=new THREE.Box3().setFromObject(u.body);
      const cy=(bb.min.y+bb.max.y)/2, span=Math.max(bb.max.y-bb.min.y,2.5);
      camera.position.set(0,cy,140+span*1.55); camera.lookAt(0,cy,140);
      camera.updateProjectionMatrix();
      renderer.shadowMap.needsUpdate=true;
      if(typeof composer==="undefined"||!composer)
        throw new Error("no composer — every pixel this tool prints would be void (§G.6)");
      for(let i=0;i<3;i++)composer.render();
      let m=0;const s=new Set();u.body.traverse(o=>{if(o.isMesh){m++;s.add(o.material);}});
      return m+"/"+s.size;
    };
  },KEY);
  for(const cls of CLASSES.split(",")){
    const ok=await page.evaluate(c=>{
      const u=makeUnit(0,c,0,140,{name:"A9",bot:null,isKing:c==="king"});
      return u?window.__stage(u):null;
    },cls);
    if(!ok){console.log("skip "+cls);continue;}
    await page.screenshot({path:path.join(out,cls+".png")});
  }
  await b.close(); srv.close();
}
if(process.env.A9_SHOOT){
  shoot(process.env.A9_SHOOT,+process.env.A9_PORT).then(()=>process.exit(0))
    .catch(e=>{console.error("CRASH:",e);process.exit(1);});
  return;
}

// ---------------- parent: two children, then the diff ----------------
const A=path.join(ROOT,"_a9","A"), B=path.join(ROOT,"_a9","B");
function runChild(out,port){
  const r=cp.spawnSync(process.execPath,[__filename],{cwd:ROOT,encoding:"utf8",maxBuffer:1<<28,
    env:Object.assign({},process.env,{A9_SHOOT:out,A9_PORT:String(port),A9_CLASSES:CLASSES})});
  if(r.status!==0){console.error(r.stdout||"");console.error(r.stderr||"");
    throw new Error("a9 render failed for "+out);}
  if(r.stdout&&r.stdout.trim())console.log(r.stdout.trim());
}
function px(file){
  const raw=cp.execSync(`convert ${JSON.stringify(file)} -depth 8 -colorspace sRGB rgb:-`,{maxBuffer:1<<28});
  const dim=cp.execSync(`identify -format "%w %h" ${JSON.stringify(file)}`,{encoding:"utf8"}).split(" ");
  return {w:+dim[0],h:+dim[1],d:raw};
}
console.log("A9 DETERMINISM SWEEP — "+CLASSES.split(",").length+" classes, two processes\n");
runChild(A,8191); runChild(B,8192);

let worst=0,fails=0,lines=[];
for(const cls of CLASSES.split(",")){
  const fa=path.join(A,cls+".png"), fb=path.join(B,cls+".png");
  if(!fs.existsSync(fa)||!fs.existsSync(fb)){lines.push("  "+cls.padEnd(12)+"MISSING");continue;}
  const P=px(fa),Q=px(fb);
  if(P.w!==Q.w||P.h!==Q.h){lines.push("  "+cls.padEnd(12)+"SIZE MISMATCH");fails++;continue;}
  // the figure region: not-the-key in EITHER run. A difference that moves a silhouette edge shows
  // up in one image and not the other, so the union is the honest region — an intersection would
  // hide precisely the worst case.
  let diff=0,big=0,maxd=0,region=0;
  for(let i=0;i<P.w*P.h;i++){
    const o=i*3;
    const off=(d,x)=>Math.abs(d[x]-KEY[0])+Math.abs(d[x+1]-KEY[1])+Math.abs(d[x+2]-KEY[2])>90;
    if(!off(P.d,o)&&!off(Q.d,o))continue;
    region++;
    const d=Math.max(Math.abs(P.d[o]-Q.d[o]),Math.abs(P.d[o+1]-Q.d[o+1]),Math.abs(P.d[o+2]-Q.d[o+2]));
    if(d>0){diff++;if(d>maxd)maxd=d;if(d>8)big++;}
  }
  if(diff>worst)worst=diff;
  if(diff>0)fails++;
  lines.push("  "+cls.padEnd(12)+(diff?"FAIL":"ok  ")+"  figure "+String(region).padStart(6)+
    " px · differing "+String(diff).padStart(6)+" · >8 "+String(big).padStart(6)+" · max Δ "+maxd);
}
console.log(lines.join("\n"));
console.log("");
if(fails){
  console.log("A9 FAIL — "+fails+" class(es) differ between processes, worst "+worst+" pixels.");
  console.log("Something in unit appearance is drawing from Math.random(). §G.5 / §H A9.");
  console.log("Compare "+A+" and "+B+" to see where.");
  process.exit(1);
}
console.log("A9 PASS — every class is byte-identical across two processes.");
