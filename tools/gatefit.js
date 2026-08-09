#!/usr/bin/env node
/* v132.15 — WILL THE ARMY ACTUALLY FIT THROUGH THE GATE?
   ------------------------------------------------------
   node tools/gatefit.js

   John: "keep in mind gate needs to be large enough for the largest units to walk through it
   (oxcarts, trebuchets, cannons, etc)."

   PGAP is 3.4 and has been 3.4 since the gate was built. Nobody has ever put a ruler across it, and
   every other number in the gatehouse — the piers, the lintel span, the vault, the terreplein split
   and the collider's own passage half-width — is derived from it. So this measures, in one run, the
   two things that decide whether the number is right, AND IT MEASURES THEM DIFFERENTLY ON PURPOSE
   because the game has two ideas of how wide a unit is:

     THE COLLIDER'S IDEA is that a unit is a POINT. moveUnit pushes a position out of building
     shapes inflated by 0.7, and that 0.7 is the same for a villager and a trebuchet — nothing in
     the collision path reads the unit's class. So the passage question the SIMULATION answers is
     "does the centreline fit", and the answer is yes for everything, always, which is exactly why
     this has never failed a test.
     THE PLAYER'S IDEA is the model he is looking at. An ox cart is a cart; a trebuchet is a war
     engine with a frame. If the drawn body is wider than the gap between the piers, it drives
     THROUGH the stonework — the simulation is happy and the frame is wrong.

   So: measure every siege and trade model's true width ACROSS its own facing (its yaw matters —
   these are long objects and the width that has to fit is the beam, not the length), measure the
   REAL clear passage by raycasting across the gateway at body height rather than trusting PGAP,
   and print both against each other. Widening is then a number with a reason.

   THE PASSAGE IS MEASURED, NOT READ. PGAP is what the source intends; a raycast across the gateway
   is what the stonework actually leaves — piers get rustication, chamfers and a batter, and any of
   those eat the gap without touching the constant.                                               */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
(async()=>{
  const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}catch(e){r.writeHead(404);r.end();}}).listen(8305);
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await b.newPage({viewport:{width:400,height:300}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message));
  await page.goto("http://localhost:8305/index.html",{waitUntil:"load",timeout:90000});
  await page.waitForFunction(()=>typeof makeUnit==="function"&&typeof makeBuilding==="function",null,{timeout:45000});
  await page.evaluate(()=>{try{inMenu=false;}catch(e){} window.requestAnimationFrame=()=>0;});
  await page.waitForTimeout(300);

  const out=await page.evaluate(()=>{
    for(const t of buildings.slice())t.alive=false;
    // ---- THE UNITS ------------------------------------------------------------------------------
    // Width ACROSS the facing. These are long objects: a trebuchet's length is not what has to pass
    // between two piers, its beam is. Built at yaw 0 and measured on the model's own x extent, which
    // is the across-axis for every rig in 04-units.js (they are built facing +z).
    const KINDS=["clubman","villager","oxcart","batteringram","catapult","trebuchet","cannon","culverin","knight"];
    const units=[];
    let ux=-400;
    for(const k of KINDS){
      if(!CLS[k])continue;
      const u=makeUnit(0,k,ux,0,{name:""});
      if(!u)continue;
      u.facing=0; u.root.rotation.y=0;
      u.root.position.set(ux,0,0);
      scene.updateMatrixWorld(true);
      const box=new THREE.Box3().setFromObject(u.root);
      // WIDTH IN HEIGHT BANDS, because a bounding box is not what passes through a doorway. A
      // trebuchet is 16.8 tall and most of that is a throwing arm swung up in the air; what has to
      // fit between two piers is the slice of the model that is actually at pier height. Walk the
      // vertices and take the x-extent inside each band.
      const bands=[[0,2],[0,4],[0,9.4]], w=bands.map(()=>({lo:1e9,hi:-1e9}));
      const _v=new THREE.Vector3();
      u.root.traverse(o=>{
        if(!o.isMesh||!o.geometry||!o.geometry.attributes||!o.geometry.attributes.position)return;
        const P=o.geometry.attributes.position;
        const step=Math.max(1,Math.floor(P.count/900));
        for(let i=0;i<P.count;i+=step){
          _v.fromBufferAttribute(P,i); o.localToWorld(_v);
          const y=_v.y, x=_v.x-ux;
          for(let bi=0;bi<bands.length;bi++)
            if(y>=bands[bi][0]&&y<=bands[bi][1]){
              if(x<w[bi].lo)w[bi].lo=x; if(x>w[bi].hi)w[bi].hi=x;
            }
        }
      });
      units.push({k,name:CLS[k].name,
        wide:+(box.max.x-box.min.x).toFixed(2),
        long:+(box.max.z-box.min.z).toFixed(2),
        tall:+(box.max.y-box.min.y).toFixed(2),
        w2:w[0].hi>-1e8?+(w[0].hi-w[0].lo).toFixed(2):null,
        w4:w[1].hi>-1e8?+(w[1].hi-w[1].lo).toFixed(2):null,
        w94:w[2].hi>-1e8?+(w[2].hi-w[2].lo).toFixed(2):null});
      ux+=40;
    }

    // ---- THE GATEWAY ----------------------------------------------------------------------------
    // Build one gate of each stone type at each age it can reach, and RAYCAST ACROSS the opening at
    // a few heights. PGAP is the intent; the stonework is the fact.
    const GX=0, GZ=40;
    const gates=[];
    for(const [type,ages] of [["wood_gate",[2,3,4,5]],["stone_gate",[3,4,5]],["fort_gate",[4,5]]]){
      for(const age of ages){
        for(const t of buildings.slice())t.alive=false;
        teamAge[0]=age;
        const g=makeBuilding(0,type,GX,GZ,true,0);
        if(!g){gates.push({type,age,err:"makeBuilding refused"});continue;}
        g.built=true; g.alive=true;
        scene.updateMatrixWorld(true);
        const rc=new THREE.Raycaster(); rc.far=60;
        // TWO TRAPS THIS PROJECT HAS ALREADY PAID FOR ONCE EACH.
        // 1. r128's Sprite.raycast reads raycaster.camera.matrixWorld, and a gate carries sprites
        //    (banners, tags). With no camera set it throws inside three, not in this file.
        rc.camera=camera;
        // 2. FRONT FACES ONLY. The surface that bounds the passage is a pier's INNER face, which
        //    points at the opening — so a ray crossing the gateway meets it from BEHIND and a
        //    FrontSide material never reports it. v131.28 shipped a "clear" report straight through
        //    a stone pier for exactly this reason. Force DoubleSide for the measurement, restore after.
        const _sides=[];
        g.root.traverse(o=>{if(o.material){const m=Array.isArray(o.material)?o.material:[o.material];
          for(const mm of m){_sides.push([mm,mm.side]); mm.side=THREE.DoubleSide;}}});
        // sweep across the gateway from one side, at several heights and depths, and record where
        // the first solid thing is on each side of the centreline.
        // FINE IN DEPTH, AND THAT MATTERS MORE THAN HEIGHT. The first cut sampled three depths
        // (-1.2, 0, +1.2) and stepped straight past the door leaves, which are 0.22-0.24 thick
        // slabs at a single z. It reported the wood gate at a comfortable 8.0 while its oak leaves
        // sit 0.2 apart across the whole opening. A gate's narrowest point is almost always a thin
        // thing at one depth; sweep depth densely or do not claim to have measured it.
        const meas=[];
        for(const y of [0.6,1.4,2.2,3.0,4.2,5.4]){
          for(let dz=-4.0;dz<=4.01;dz+=0.2){
            let leftHit=null,rightHit=null;
            // from far -x toward +x
            rc.set(new THREE.Vector3(GX-30,y,GZ+dz),new THREE.Vector3(1,0,0));
            for(const h of rc.intersectObject(g.root,true)){
              if(h.point.x>GX){continue;}          // only the near (left) pier face
              leftHit=h.point.x;
            }
            rc.set(new THREE.Vector3(GX+30,y,GZ+dz),new THREE.Vector3(-1,0,0));
            for(const h of rc.intersectObject(g.root,true)){
              if(h.point.x<GX)continue;
              rightHit=h.point.x;
            }
            if(leftHit!==null&&rightHit!==null)meas.push({y,dz,gap:+(rightHit-leftHit).toFixed(2)});
          }
        }
        // HEADROOM. Width is only half of "will it walk through" — the passage has a ceiling, and
        // at age 5 that ceiling was a slab at 3.7 against a man 5.43 tall. Shoot straight UP the
        // centreline at several depths and take the LOWEST thing overhead.
        let head=1e9, headAt=null;
        // FROM ABOVE THE THRESHOLD. Shooting up from y=0.05 measured the FLOOR — a drawbridge deck
        // or a sill 0.1 off the ground — and reported every gate as having 0.1 of headroom, which
        // would have been a spectacular thing to act on. Start above anything you walk ON.
        for(let dz=-2.0;dz<=2.01;dz+=0.25){        // inside the gatehouse body: the drawbridge
          rc.set(new THREE.Vector3(GX,1.05,GZ+dz),new THREE.Vector3(0,1,0));
          const h=rc.intersectObject(g.root,true)[0];
          if(h&&h.point.y<head){head=h.point.y;headAt=+dz.toFixed(2);}
        }
        for(const [mm,sd] of _sides)mm.side=sd;
        const gaps=meas.map(m=>m.gap);
        gates.push({type,age,
          n:meas.length,
          min:gaps.length?+Math.min(...gaps).toFixed(2):null,
          max:gaps.length?+Math.max(...gaps).toFixed(2):null,
          atMin:gaps.length?meas[gaps.indexOf(Math.min(...gaps))]:null,
          head:head<1e8?+head.toFixed(2):null,headAt});
        g.alive=false;
      }
    }
    // what the COLLIDER thinks the passage is
    for(const t of buildings.slice())t.alive=false;
    teamAge[0]=5;
    const g5=makeBuilding(0,"fort_gate",GX,GZ,true,0);
    if(g5){g5.built=true;g5.alive=true;}
    const collider=(typeof _gatePassHX==="function"&&g5)?_gatePassHX(g5):null;

    // ---- AND CAN A BODY ACTUALLY GET THROUGH IT, AND ONLY THROUGH IT? --------------------------
    // Geometry that measures open is not the same as a unit that passes. Drive the real moveUnit
    // with the real per-frame height hug, three ways:
    //   ALIGNED    straight at the gateway -> comes out the far side
    //   AT A PIER  offset onto the stonework -> does not
    //   OVER IT    John's bug: "units climb over the gate to get through it". wallFloorAt must
    //              report no floor anywhere on a gate, at any height, or the deck is still there.
    const hug=(u)=>{
      let wf=(typeof wallFloorAt==="function")?wallFloorAt(u.root.position.x,u.root.position.z):null;
      if(wf!==null&&!(u.root.position.y>wf-1.2))wf=null;
      u.root.position.y=(wf!==null)?wf:terrainHeight(u.root.position.x,u.root.position.z);
    };
    const drive=(ox)=>{
      const u=makeUnit(0,"clubman",GX+ox,GZ+14,{name:""});
      u.isPlayer=true; u.spd=6;
      u.root.position.set(GX+ox,terrainHeight(GX+ox,GZ+14),GZ+14);
      let top=u.root.position.y;
      for(let k=0;k<600;k++){moveUnit(u,0,-1,1/60); hug(u);
        if(u.root.position.y>top)top=u.root.position.y;}
      // WHERE IT CAME OUT MATTERS AS MUCH AS WHETHER IT DID. A lone gate has no wall either side,
      // so a body shoved at a pier slides along the wall box, runs off its end at 6.8 and walks
      // AROUND — which the first cut of this scored as "walked through stone". Passing at the
      // gateway is a pass; passing anywhere else is only a failure if it happened ON the stonework.
      const r={through:u.root.position.z<GZ-4,z:+u.root.position.z.toFixed(1),
               x:+(u.root.position.x-GX).toFixed(1),top:+top.toFixed(2)};
      u.alive=false; if(u.root.parent)u.root.parent.remove(u.root);
      return r;
    };
    const walk={aligned:drive(0),pier:drive(5.0)};
    // no floor anywhere on the gate, sampled across its whole footprint
    let deck=0;
    if(g5&&typeof wallFloorAt==="function")
      for(let ax=-8;ax<=8;ax+=0.5)for(let az=-4;az<=4;az+=0.5)
        if(wallFloorAt(GX+ax,GZ+az)!==null)deck++;
    return {units,gates,collider,inflate:0.7,walk,deck};
  });

  console.log("\n  THE UNITS — width ACROSS the facing is what has to fit between two piers");
  console.log("    (a bounding box is not what passes a doorway — the banded widths are the slice");
  console.log("     of the model actually at pier height, and the last one is what must fit)");
  console.log("    unit                  box    tall     <2     <4    <9.4");
  const widest=out.units.reduce((a,c)=>(c.w94||0)>(a.w94||0)?c:a,out.units[0]);
  for(const u of out.units)console.log("    "+u.name.padEnd(20)+String(u.wide).padStart(5)+
    "   "+String(u.tall).padStart(5)+"  "+String(u.w2).padStart(5)+"  "+String(u.w4).padStart(5)+
    "  "+String(u.w94).padStart(5)+(u===widest?"   <- widest at pier height":""));

  console.log("\n  THE GATEWAY — raycast across the opening, not read off PGAP");
  console.log("    gate            age    widest   headroom");
  for(const g of out.gates){
    if(g.err){console.log("    "+g.type.padEnd(14)+String(g.age).padStart(4)+"   "+g.err);continue;}
    console.log("    "+g.type.padEnd(14)+String(g.age).padStart(4)+"   "+
      String(g.min===null?"none":g.min).padStart(6)+"   "+String(g.head===null?"open":g.head).padStart(8)+
      "   "+(g.atMin?"pinch y="+g.atMin.y:""));
  }
  console.log("\n  the collider's own passage half-width at an age-5 fort gate: "+out.collider+
    "   -> a "+(out.collider===null?"?":(out.collider*2).toFixed(1))+"-wide lane for a POINT body");
  console.log("  (moveUnit inflates every building shape by "+out.inflate+
    " and reads no unit class at all, so the simulation");
  console.log("   thinks a trebuchet is exactly as wide as a villager — which is why this has never failed)");

  console.log("\n  A BODY, DRIVEN — geometry that measures open is not a unit that passes");
  console.log("    aligned with the gateway: ends at z="+out.walk.aligned.z+
    (out.walk.aligned.through?"   through it":"   *** STOPPED"));
  console.log("      (came out at x="+out.walk.aligned.x+", the gateway is +-"+out.collider+")");
  const pierOK=!out.walk.pier.through||Math.abs(out.walk.pier.x)<=out.collider+0.4||
               Math.abs(out.walk.pier.x)>=6.79;   // 6.8 IS the wall box half-length: it reached the end and went round
  console.log("    aimed at a pier         : ends at z="+out.walk.pier.z+", x="+out.walk.pier.x+
    (pierOK?(Math.abs(out.walk.pier.x)<=out.collider+0.4?"   slid to the gateway and through"
                                                        :"   slid off the end (no wall beside it)")
           :"   *** WALKED THROUGH THE PIER"));
  console.log("    highest it ever stood   : "+out.walk.aligned.top+
    (out.walk.aligned.top<2?"   never climbed the gate":"   *** CLIMBED IT"));
  console.log("    wallFloorAt reports a floor at "+out.deck+" of 561 points on the gate"+
    (out.deck===0?"   no deck: the gateway is the way through":"   *** the gate is still walkable"));

  const narrowest=out.gates.filter(g=>g.min!==null).reduce((a,c)=>c.min<a.min?c:a,
    out.gates.find(g=>g.min!==null)||{min:1e9});
  console.log("\n  VERDICT");
  console.log("    widest unit drawn : "+widest.name+" at "+widest.wide+" across");
  console.log("    narrowest gateway : "+(narrowest.min===1e9?"?":narrowest.type+" a"+narrowest.age+" at "+narrowest.min));
  const fits=narrowest.min!==1e9&&narrowest.min>widest.w94;
  console.log("    "+(fits?"it fits":"IT DOES NOT FIT — the model is "+
    (widest.w94-narrowest.min).toFixed(2)+" wider than the stonework leaves"));
  console.log("");
  await b.close(); srv.close(); process.exit(0);
})().catch(e=>{console.error("CRASH:",e);process.exit(1);});
