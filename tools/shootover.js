#!/usr/bin/env node
/* v132.17 — CAN YOU SHOOT FROM A WALL, AND OVER ONE?
   -------------------------------------------------
   node tools/shootover.js

   John: "for the enlightenment walls i can climb them but cant shoot over them, my projectile does
   not appear."

   THE SUSPECT, read out of updateProjectiles:

       if(!done)for(const b of buildings){
         if(!b.alive||b.def.flat)continue;
         if(b!==p.ignoreB&&segDist2(_px,_pz, p.m.position.x,p.m.position.z, b.x,b.z)
                            < Math.pow(b.def.rBlock*0.8,2)) { ...done=true }

   That is a CIRCLE IN PLAN with no height term anywhere in it. A wall's rBlock defaults to its r of
   5.5, so anything within 4.4 of a wall segment's CENTRE stops a shot — at any altitude, including
   an arrow already above the parapet. Two consequences, and John reported the first:

     · standing on a deck you are inside your own wall's circle, so the arrow dies on the frame it
       is born and never appears;
     · and an arrow crossing ANY wall line dies, however high it is flying, so no one can shoot over
       a wall from the ground either.

   This drives both, with the real fireAimedShot, the real updateProjectiles and a real body:

     FROM THE DECK   stand on an age-5 terreplein, aim level, loose. The shot has to exist a frame
                     later and travel.
     OVER IT         stand back on the ground, aim over the wall at a target beyond it. The arrow
                     has to clear the crest and keep going.
     AND STILL STOP  aim FLAT at the wall from ground level. That arrow must still die on the
                     stonework — a fix that lets everything through is not a fix, it deletes walls.

   The crest heights are measured here rather than assumed, because whatever the fix keys off has to
   be the height the wall actually is.                                                             */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
(async()=>{
  const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}catch(e){r.writeHead(404);r.end();}}).listen(8307);
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await b.newPage({viewport:{width:400,height:300}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message));
  await page.goto("http://localhost:8307/index.html",{waitUntil:"load",timeout:90000});
  await page.waitForFunction(()=>typeof fireAimedShot==="function"&&typeof updateProjectiles==="function",null,{timeout:45000});
  await page.evaluate(()=>{try{inMenu=false;}catch(e){} try{gameOver=false;}catch(e){} window.requestAnimationFrame=()=>0;});
  await page.waitForTimeout(300);

  const out=await page.evaluate(()=>{
    const WX=0, WZ=40;
    for(const t of buildings.slice())t.alive=false;
    for(const u of units.slice()){u.alive=false;u.root.visible=false;}
    const R={};

    // ---- the crest of every wall form, measured -------------------------------------------------
    R.crest=[];
    for(const [type,ages] of [["wood_wall",[2,3,4,5]],["stone_wall",[3,4,5]],["fort_wall",[4,5]],
                              ["wood_gate",[2,3,4,5]],["stone_gate",[3,4,5]],["fort_gate",[4,5]]]){
      for(const age of ages){
        for(const t of buildings.slice())t.alive=false;
        teamAge[0]=age;
        const w=makeBuilding(0,type,WX,WZ,true,0);
        if(!w)continue; w.built=true; w.alive=true;
        scene.updateMatrixWorld(true);
        const rc=new THREE.Raycaster(); rc.far=90; rc.camera=camera;
        let top=-1e9;
        for(let ax=-5;ax<=5;ax+=1)for(let az=-1.2;az<=1.21;az+=0.4){
          rc.set(new THREE.Vector3(WX+ax,60,WZ+az),new THREE.Vector3(0,-1,0));
          const h=rc.intersectObject(w.root,true)[0];
          if(h&&h.point.y>top)top=h.point.y;
        }
        // THE MAX IS THE FLAGPOLE, NOT THE WALL. The age-5 profile reads 4.0 across the terreplein,
        // 5.2 across the parapet and a single 11.0 spike at z=0 — a banner on a pole, one object
        // wide. A blocking height taken from the max would put the roof of every wall above the
        // parapet a man is standing behind. Take a PERCENTILE of the top surface instead: a
        // parapet runs the whole segment, a banner is 2% of it.
        const tops=[], prof=[];
        for(let az=-2.0;az<=2.01;az+=0.5){
          let t2=-1e9;
          for(let ax=-5.5;ax<=5.5;ax+=0.25){
            rc.set(new THREE.Vector3(WX+ax,60,WZ+az),new THREE.Vector3(0,-1,0));
            const h=rc.intersectObject(w.root,true)[0];
            if(h){tops.push(h.point.y); if(h.point.y>t2)t2=h.point.y;}
          }
          prof.push(t2<-1e8?null:+t2.toFixed(1));
        }
        tops.sort((x,y)=>x-y);
        const p90=tops.length?tops[Math.floor(tops.length*0.90)]:0;
        R.crest.push({type,age,top:+top.toFixed(2),p90:+p90.toFixed(2),
          rBlock:+(w.def.rBlock||w.def.r).toFixed(1),prof});
        w.alive=false;
      }
    }

    // ---- the three shots -------------------------------------------------------------------------
    for(const t of buildings.slice())t.alive=false;
    teamAge[0]=5; teamAge[1]=5;
    const made=[];
    for(let i=-1;i<=1;i++){const w=makeBuilding(0,"fort_wall",WX+i*10.9,WZ,true,0);
      if(w){w.built=true;w.alive=true;made.push(w);}}
    if(!made.length)return {err:"makeBuilding refused fort_wall"};
    const deckY=made[1].root.position.y+4.0;

    const shoot=(px,py,pz,aimY)=>{
      for(const p of projectiles.slice()){if(p.m&&p.m.parent)p.m.parent.remove(p.m);}
      projectiles.length=0;
      const u=makeUnit(0,"archer",px,pz,{name:"Probe"});
      u.isPlayer=true; u.root.position.set(px,py,pz); u.atkT=0;
      const wasPlayer=player; player=u;
      // the aim camera: behind the shooter, looking the way he faces
      camera.position.set(px,py+1.7,pz+2);
      camera.lookAt(px,py+1.7+aimY*10,pz-10);
      camera.updateMatrixWorld(true);
      fireAimedShot(1);
      const born=projectiles.length;
      const y0=born?+projectiles[0].m.position.y.toFixed(2):null;
      let frames=0, far=0, maxY=y0||0;
      for(let k=0;k<80&&projectiles.length;k++){
        updateProjectiles(1/60); frames++;
        if(projectiles.length){
          const m=projectiles[0].m;
          far=Math.hypot(m.position.x-px,m.position.z-pz);
          if(m.position.y>maxY)maxY=m.position.y;
        }
      }
      player=wasPlayer;
      u.alive=false; u.root.visible=false; if(u.root.parent)u.root.parent.remove(u.root);
      return {born,y0,frames,far:+far.toFixed(1),maxY:+maxY.toFixed(2)};
    };

    R.deck=shoot(WX,deckY,WZ,0.02);                  // standing ON the wall, aiming level
    R.over=shoot(WX,terrainHeight(WX,WZ+16),WZ+16,0.42); // from the ground, lofted over it
    R.into=shoot(WX,terrainHeight(WX,WZ+16),WZ+16,0.0);  // from the ground, flat AT it
    R.deckY=+deckY.toFixed(2);
    R.wallTop=R.crest.filter(c=>c.type==="fort_wall"&&c.age===5).map(c=>c.top)[0];
    return R;
  });

  if(out.err){console.log("!! "+out.err);await b.close();srv.close();process.exit(1);}
  let bad=0; const F=ok=>{if(!ok)bad++;return ok?"   ok":"   *** FAIL";};
  console.log("\n  THE WALLS, measured — whatever the fix keys off has to be the height they are");
  console.log("    wall            age    max     p90    (max is the banner; p90 is the wall)");
  for(const c of out.crest)console.log("    "+c.type.padEnd(14)+String(c.age).padStart(4)+"   "+
    String(c.top).padStart(5)+"   "+String(c.p90).padStart(5)+
    "   profile z-2..+2: "+c.prof.map(v=>v===null?" - ":String(v)).join(" "));

  console.log("\n  THREE SHOTS at an age-5 curtain (deck "+out.deckY+", crest "+out.wallTop+")");
  console.log("    FROM THE DECK   born "+out.deck.born+" at y="+out.deck.y0+
    ", lived "+out.deck.frames+" frames, flew "+out.deck.far);
  console.log("      the shot exists and travels"+F(out.deck.born===1&&out.deck.far>8));
  console.log("    OVER IT         born "+out.over.born+" at y="+out.over.y0+
    ", lived "+out.over.frames+" frames, flew "+out.over.far+", peaked at "+out.over.maxY);
  console.log("      it clears the wall and keeps going"+F(out.over.born===1&&out.over.far>20));
  console.log("    FLAT INTO IT    born "+out.into.born+" at y="+out.into.y0+
    ", lived "+out.into.frames+" frames, flew "+out.into.far);
  console.log("      it still dies on the stonework"+F(out.into.born===1&&out.into.far<18));

  console.log("\n  "+(bad?bad+" check(s) failed -> FAIL":"you can shoot from a wall, and over one -> PASS")+"\n");
  await b.close(); srv.close(); process.exit(bad?1:0);
})().catch(e=>{console.error("CRASH:",e);process.exit(1);});
