#!/usr/bin/env node
/* v132.7 SITING — WHERE CAN THREE INTERIOR CREEP CAMPS ACTUALLY GO?
   -----------------------------------------------------------------
   node tools/campsite.js [radius]        (default 16)

   claude/REGICIDE-MAP-REWORK.md §5: "Site the three interior camps AGAINST THE FINISHED ROAD
   LAYOUT so neither road runs through one." The sketch gives intent — one on the centre line north
   of the Grand Bazaar, two flanking to the south — and intent is not coordinates. This is not a
   gate; it is the search that turns the first into the second, and it exists because typing three
   pairs of numbers that look about right is how 01-engine.js ended up flattening the terrain at
   three hand-typed bazaar positions.

   THE SYMMETRY CONVENTION, STATED ONCE BECAUSE THIS WORLD USES TWO OF THEM:
     · TREE_STANDS mirror through the map CENTRE, (x,z) -> (-x,-z).
     · The roads, the thrones and the border camps mirror about x=0, (x,z) -> (-x,z). roadPoint's
       own comment insists on it: "z(t) === z(1-t)".
   A creep camp has to relate to the ROADS, so it takes the roads' convention. Under x -> -x a site
   at (0, z) is its own mirror and a pair at (+-X, z) swaps, so both are exactly as far from one
   throne as from the other — which is the only fairness property that actually has to hold.

   WHAT IT MEASURES AT EVERY CANDIDATE, all of them disqualifying:
     ROADS    distance from the King's Road and both Viking spines. A camp lays a trampled dirt
              disc of radius r-1.5 and the roads are up to 5.86 and 3.22 wide, so overlapping is
              not a near miss, it is one decal drawn through another.
     AGGRO    …but not too far either. The pack's aggro ring is r-2.5, so a camp 30 off a road is
              something you SEE while marching and choose to fight. That is the "contested ground
              you cross" the plan asks for; a camp nobody walks past is scenery with hit points.
     ROOM     thrones (a camp inside a base yard is a joke), bazaar plazas, ponds, the six border
              pockets, and the map border itself.
     LEVEL    the ground under the footprint. The dirt disc is DRAPED, so a site on a slope is not
              broken, but the fire pit, the bone scatter and the palisade arc are all placed at one
              y and a steep site floats them.                                                      */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const R=+(process.argv[2]||11);
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
(async()=>{
  const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}catch(e){r.writeHead(404);r.end();}}).listen(8298);
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await b.newPage({viewport:{width:400,height:300}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message));
  await page.goto("http://localhost:8298/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof units!=="undefined"&&typeof vikingPoint==="function",null,{timeout:45000});
  await page.evaluate(()=>{try{inMenu=false;}catch(e){} window.requestAnimationFrame=()=>0;});
  await page.waitForTimeout(300);

  const out=await page.evaluate((R)=>{
    const DISC=R-1.5;                      // the trampled dirt decal, which is what must not overlap
    const KING_HW=5.9, VIK_HW=3.3;         // measured maxima, tools/vikingroad.js check 6
    const GRASS=6;                         // a strip of lawn you can see between the two surfaces
    // v132.11 THE BINDING CONSTRAINT IS NOT THE DIRT, IT IS THE TREE CLEARANCE. John: "more tucked
    // into heavily wooded areas. for example this camp is pretty much just in the open." Keeping the
    // decals apart (DISC + half-width + 6) is nothing: the ROAD clears trees to 21 and the CAMP
    // clears them to r+4, so a camp any closer than the sum has its clearing WELDED to the road's
    // and the pair render as one continuous bare avenue with the camp as a bulge in it. That is
    // exactly the failure mode the Viking road's own bow was just fixed for (v132.9), one object
    // over. +2 so a band of wood survives between them rather than the two merely touching.
    const KMIN=Math.max(DISC+KING_HW+GRASS,TREE_CLEAR_ROAD+R+4+2);
    const VMIN=Math.max(DISC+VIK_HW+GRASS,TREE_CLEAR_VIKING+R+4+2);
    const SPINE_K=[], SPINE_V=[];
    for(let i=0;i<=400;i++)SPINE_K.push(roadPoint(i/400));
    for(const t of [0,1])for(let i=0;i<=400;i++)SPINE_V.push(vikingPoint(t,i/400));
    const near=(pts,x,z)=>{let m=1e9;for(const p of pts){const dx=x-p.x,dz=z-p.z,d=dx*dx+dz*dz;if(d<m)m=d;}return Math.sqrt(m);};

    const test=(x,z)=>{
      const r={x,z};
      r.dK=near(SPINE_K,x,z); r.dV=near(SPINE_V,x,z);
      r.road=Math.min(r.dK,r.dV);
      if(r.dK<KMIN||r.dV<VMIN)return {...r,why:"road"};
      // thrones: TREE_CLEAR_BASE is 52 and that is the yard a town builds out into
      for(const t of TCPOS)if(Math.hypot(x-t[0],z-t[1])<52+DISC)return {...r,why:"throne"};
      // v132.11 John, playtesting: "i wish the camps closest to the bazaar were a little bit
      // further away from the bazaar". It was plaza + DISC + 4 — 33.7 centre to centre, which put a
      // barbarian camp in the same glance as a team's trade post. 30 of clear ground between the
      // two surfaces instead of 4.
      for(const S of BAZAAR_SITES){const p=S.p();
        if(Math.hypot(x-p.x,z-p.z)<S.plaza+DISC+30)return {...r,why:"bazaar"};}
      // v132.11 …and off the resource clusters. John: "looks like a gold node is in the wolf camp".
      // placeNodes drops the forward gold cluster at x in +-[70,90], z in [-54.5,-29.5] — which is
      // precisely where the old flank camp sat. The nodes are hand-tuned and placed BEFORE anything
      // camp-related in the seeded stream, so they are the fixed thing here and the camp moves.
      for(const n of nodes)if(n.type!=="wood"&&Math.hypot(x-n.x,z-n.z)<DISC+10)return {...r,why:"node"};
      if(typeof PONDS!=="undefined")for(const p of PONDS)
        if(Math.hypot(x-p[0],z-p[1])<p[2]+2.4+DISC)return {...r,why:"pond"};
      // the six border pockets, plus a real gap so the wilds do not merge into one belt
      for(const C of CAMPS)if(Math.hypot(x-C.x,z-C.z)<C.r+R+18)return {...r,why:"camp"};
      // the footprint has to be ON the map, not hanging over the border into the foothills
      if(Math.abs(x)+R>MAP.x-6||Math.abs(z)+R>MAP.z-6)return {...r,why:"border"};
      // walkable and level across the whole disc
      let lo=1e9,hi=-1e9,bad=false;
      for(let ri=0;ri<=4&&!bad;ri++)for(let si=0;si<16;si++){
        const a=si*Math.PI/8, rr=R*ri/4;
        const px=x+Math.cos(a)*rr, pz=z+Math.sin(a)*rr;
        if(typeof walkable==="function"&&!walkable(px,pz)){bad=true;break;}
        const h=terrainHeight(px,pz); if(h<lo)lo=h; if(h>hi)hi=h;
      }
      if(bad)return {...r,why:"unwalkable"};
      r.spread=+(hi-lo).toFixed(2);
      if(r.spread>2.6)return {...r,why:"steep"};
      // how wooded is it ALREADY? Informational: the chosen sites get a stand planted on them
      // (that is what "tucked in" means — the woods are placed on purpose, not hoped for), but a
      // site that is already in cover needs less help and reads better.
      let dens=0;
      if(typeof TREE_STANDS!=="undefined")for(const st2 of TREE_STANDS){
        const dd=Math.hypot(x-st2.x,z-st2.z);
        if(dd<st2.r)dens=Math.max(dens,1-Math.pow(dd/st2.r,3.2));
      }
      r.wood=+Math.min(1,dens*1.45+0.03).toFixed(2);
      r.ok=true; return r;
    };

    // ---- the axis camp: x = 0, its own mirror ---------------------------------------------------
    const axis=[];
    for(let z=-150;z<=150;z+=2){const t=test(0,z); if(t.ok)axis.push(t);}
    // ---- the flanking pair: x > 0, AND ITS MIRROR AT -x -------------------------------------------
    // THE TERRAIN IS NOT MIRROR-SYMMETRIC. The roads, thrones and border camps are, but the height
    // field is noise and noise does not mirror — the ASCII map shows level ground at x=+70..91 on a
    // row where x=+42..63 is refused as steep. A pair validated only on one side is a pair where
    // one team's camp sits in a bowl. Both halves are tested and the WORSE spread is reported.
    const flank=[];
    for(let x=10;x<=210;x+=4)for(let z=-150;z<=150;z+=4){
      const t=test(x,z); if(!t.ok)continue;
      const m=test(-x,z); if(!m.ok){t.mirrorWhy=m.why;continue;}
      t.spreadM=m.spread; t.spreadWorst=Math.max(t.spread,m.spread);
      t.dThrone=[+Math.hypot(x-TCPOS[0][0],z-TCPOS[0][1]).toFixed(0),
                 +Math.hypot(x-TCPOS[1][0],z-TCPOS[1][1]).toFixed(0)];
      t.apart=+(2*x).toFixed(0);
      flank.push(t);
    }
    // reasons the rest were refused, so a wholly empty result is diagnosable
    const why={};
    for(let x=-210;x<=210;x+=10)for(let z=-150;z<=150;z+=10){
      const t=test(x,z); const k=t.ok?"OK":t.why; why[k]=(why[k]||0)+1;
    }
    // a coarse picture of where a camp fits at all
    const rows=[];
    for(let z=140;z>=-140;z-=14){
      let s="";
      for(let x=-210;x<=210;x+=7){
        const t=test(x,z);
        s+= t.ok?"#" : (t.why==="road"?"=" : t.why==="throne"?"T" : t.why==="bazaar"?"B" :
                        t.why==="camp"?"c" : t.why==="pond"?"o" : t.why==="node"?"$" :
                        t.why==="border"?"." : ",");
      }
      rows.push({z,s});
    }
    // ---- REFINE: a fine sweep around the two anchors the coarse scan pointed at ------------------
    // The coarse grid steps 4 units, and "level" is the one criterion that moves fast at that scale
    // — the height field is noise, not a plane. This walks 1-unit steps around each anchor and keeps
    // the site whose WORSE half is flattest, which is the number a mirrored pair is judged on.
    const refine=(ax,az,span)=>{
      let best=null;
      for(let x=ax-span;x<=ax+span;x++)for(let z=az-span;z<=az+span;z++){
        const t=test(x,z); if(!t.ok)continue;
        let worst=t.spread;
        if(x!==0){const m=test(-x,z); if(!m.ok)continue; worst=Math.max(worst,m.spread); t.spreadM=m.spread;}
        t.spreadWorst=+worst.toFixed(2);
        if(!best||t.spreadWorst<best.spreadWorst)best=t;
      }
      return best;
    };
    const picks={axis:refine(0,-60,22),flank:refine(86,70,22)};
    return {axis,flank,why,rows,picks,DISC,KMIN:+KMIN.toFixed(1),VMIN:+VMIN.toFixed(1),
      grand:BAZAAR_SITES.find(s=>s.grand).p()};
  },R);

  console.log("\n  A CAMP OF RADIUS "+R+" (its dirt disc is "+out.DISC+")");
  console.log("  needs "+out.KMIN+" from the King's Road spine and "+out.VMIN+" from a Viking spine.\n");
  console.log("  WHERE IT FITS AT ALL   # fits · = road · T throne · B bazaar · c camp · o pond · $ node · . border\n");
  for(const r of out.rows)console.log("   "+String(r.z).padStart(5)+" |"+r.s);
  console.log("         |"+"-".repeat(61));
  console.log("          -210"+" ".repeat(24)+"0"+" ".repeat(25)+"210\n");

  const show=(list,title,n)=>{
    console.log("  "+title);
    if(!list.length){console.log("    NONE FIT\n");return;}
    // most contested first: the closest a camp may legally sit to the road network
    const s=list.slice().sort((a,b)=>a.road-b.road).slice(0,n);
    console.log("      x       z    to King's   to Viking   nearest    spread   mirror   apart   throne d");
    for(const c of s)console.log("   "+String(c.x).padStart(4)+"  "+String(c.z).padStart(6)+
      "   "+c.dK.toFixed(1).padStart(8)+"   "+c.dV.toFixed(1).padStart(9)+
      "   "+c.road.toFixed(1).padStart(7)+"   "+String(c.spread).padStart(7)+
      "  w"+String(c.wood===undefined?"-":c.wood).padStart(5)+
      "   "+String(c.spreadM===undefined?"-":c.spreadM).padStart(6)+
      "   "+String(c.apart===undefined?"-":c.apart).padStart(5)+
      "   "+(c.dThrone?c.dThrone.join("/"):"-"));
    console.log("");
  };
  console.log("  the Grand Bazaar is at ("+out.grand.x.toFixed(0)+", "+out.grand.z.toFixed(0)+")\n");
  // v132.11 THE SKETCH, RE-READ. Its "up" is the VIKINGS, which in world space is -z, so the lone
  // camp between the Viking arc and the King's Road is at NEGATIVE z and the flanking pair is on the
  // far side of the King's Road at POSITIVE z. John: "facing down kings road toward red base, there
  // should be two new camps on the RIGHT side and one on the LEFT. right now it is the opposite."
  // Blue stands at (-175,0) facing +x with +y up, so right = cross(forward,up) = +z. He is right:
  // v132.7 shipped one camp at +z and the pair at -z, which is the mirror of the brief.
  show(out.axis.filter(c=>c.z<0&&c.z>-110),"THE LONE CAMP (x=0, -z) — between the Kings Road and the Viking arc",10);
  show(out.axis.filter(c=>c.z>out.grand.z),"AXIS at +z, for comparison (this is where v132.7 wrongly put it)",4);
  show(out.flank.filter(c=>c.z>0&&c.apart>=110&&c.spreadWorst<1.9),
    "THE FLANKING PAIR (+-x, +z) — the far side of the Kings Road, both halves level",12);
  show(out.flank.filter(c=>c.z<0&&c.apart>=110),"pairs at -z, for comparison (v132.7 put them here)",4);
  console.log("  REFINED — 1-unit sweep around each anchor, ranked on the WORSE half of the pair");
  for(const k of ["axis","flank"]){
    const c=out.picks[k]; if(!c){console.log("    "+k+": nothing fits");continue;}
    console.log("    "+k.padEnd(6)+" ("+c.x+", "+c.z+")"+(c.x?"  and its mirror ("+(-c.x)+", "+c.z+")":"  (its own mirror)")+
      "   King's "+c.dK.toFixed(1)+"   Viking "+c.dV.toFixed(1)+
      "   spread "+c.spread+(c.spreadM!==undefined?" / "+c.spreadM:""));
  }
  console.log("");
  console.log("  refusal census over a coarse sweep: "+
    Object.entries(out.why).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+" "+v).join(" · ")+"\n");
  await b.close(); srv.close(); process.exit(0);
})().catch(e=>{console.error("CRASH:",e);process.exit(1);});
