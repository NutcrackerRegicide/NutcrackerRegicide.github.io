#!/usr/bin/env node
/* v132.50 — the gates for John's two aura complaints.
   Placed immediately after the v132.29 block, which leaves every one of its subjects dead, so
   the pool can be drained to empty before anything here is measured.
   THE DISCIPLINE THAT MATTERS HERE: the first version of the trail gate read "0 live" — the
   runner had been parked outside AURA_FAR of wherever the previous block left the camera, so the
   emitter never ran and the assertion was measuring an empty pool. Every gate below therefore
   asserts the SUBJECT'S OWN mote count first, and the spread instrument is filtered to the
   subject, so neither can be carried by another unit's cloud.
*/
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
const F=path.join(ROOT,'tools/smoketest.js');
const src=fs.readFileSync(F,'utf8');
const ANCHOR=`    zero.alive=false; bot.alive=false;
  }`;
const n=src.split(ANCHOR).length-1;
if(n!==1){console.error('ABORT: anchor matched '+n+' times, expected 1');process.exit(1);}

const BLOCK=ANCHOR+`
  // ---------- v132.50: THE AURA FOLLOWS THE BODY, AND THE CAP IS A DIFFERENT SHAPE ----------
  {
    const G=global.__G, A=G.auraTick, ST=G.auraStats, SH=G.auraShape, SP=G.auraSpread;
    const CX=-40,CZ=40;
    G.camera.position.set(CX,30,CZ);       // the v132.29 clear patch, and the emitter RANGE-GATES
                                           // on the camera: a subject parked away from it emits
                                           // nothing and every gate below would read an empty pool
    const put=(x,z,lvl,tag)=>{
      const u=G.makeUnit(0,"clubman",x,z,{name:"Fol"+tag,bot:{role:"citizen"}});
      u.bot=null; u.remote="fol-"+tag; u.lvl=lvl; u._auraAcc=0; return u;
    };
    const drain=()=>{for(let i=0;i<40;i++)A(0.05);};   // 2.0s, past the longest mote life (1.05s)
    drain();

    // ---- 1. THE TRAIL. John: "It leaves a glowing trail behind me long after I've left an area."
    const run=put(CX-12,CZ,G.XP_MAX_LVL,"run");
    for(let i=0;i<24;i++)A(0.05);                       // 1.2s standing still: fill the cloud
    const held=SH(run);
    let worst=0, walked=0;
    for(let i=0;i<40;i++){                              // 2.0s sprint, 0.6u per frame = 12 u/s —
      run.root.position.x+=0.6; walked+=0.6;            // deliberately faster than any real unit
      A(0.05);
      const s=SP(run); if(s>worst)worst=s;
    }
    const after=SH(run);
    check("v132.50 aura: the cloud FOLLOWS the body — after sprinting "+walked.toFixed(0)+
      " units the worst mote sits "+worst.toFixed(2)+"u behind it ("+after.n+" motes aloft, "+
      held.n+" before the run). On the world-space emitter this number WAS the distance walked "+
      "in one mote lifetime (~12u here), which is what a trail IS — shortening the life could "+
      "only shorten the smear, never remove it",
      held.n>0&&after.n>0&&worst<2.0);
    check("v132.50 aura: …and the gate is not measuring an empty pool — the runner alone carries "+
      after.n+" live motes and the horizontal spread is bounded by the EMISSION RADIUS ("+
      G.AURA_R_HI+"u), not by the walk",after.n>=10&&worst<=G.AURA_R_HI+0.6);
    run.alive=false; drain();

    // ---- 2. THE EMPHASIS. John: "does not change much from lvl 1 to 25 and needs to be more
    //         significant." Measure the cloud each subject is actually WEARING, alone, with the
    //         pool drained between them, and run long enough that both saturate their radius.
    const shapeOf=(lvl,tag)=>{
      const u=put(CX,CZ,lvl,tag);
      let rad=0,top=0,most=0; const e0=ST().emits;
      for(let i=0;i<400;i++){A(0.05); const s=SH(u);    // 20s — level 1 emits ~40 motes, enough
        if(s.rad>rad)rad=s.rad; if(s.top>top)top=s.top; if(s.n>most)most=s.n;}
      const rate=(ST().emits-e0)/20;
      u.alive=false; drain();
      return {rad:rad,top:top,most:most,rate:rate};
    };
    const s1=shapeOf(1,"s1"), s13=shapeOf(13,"s13"), s25=shapeOf(G.XP_MAX_LVL,"s25");
    check("v132.50 aura: level 25 is a different SHAPE, not a busier one — radius "+
      s1.rad.toFixed(2)+"u → "+s25.rad.toFixed(2)+"u (x"+(s25.rad/(s1.rad||1)).toFixed(1)+
      ") and the column stands "+s1.top.toFixed(2)+"u → "+s25.top.toFixed(2)+"u (x"+
      (s25.top/(s1.top||1)).toFixed(1)+"). Before v132.50 both ratios were exactly 1.0: radius, "+
      "climb and life were flat constants and ONLY density and hue moved",
      s1.rad>0&&s1.top>0&&s25.rad/s1.rad>2.5&&s25.top/s1.top>2.5);
    check("v132.50 aura: …and the difference is legible in absolute terms — the cap wears a "+
      "column "+s25.top.toFixed(2)+"u tall, taller than the man; level 1 keeps its "+
      s1.top.toFixed(2)+"u of sparks down at the ankles",s25.top>3.0&&s1.top<1.6);
    check("v132.50 aura: the density climbs x"+(s25.rate/(s1.rate||1)).toFixed(0)+" ("+
      s1.rate.toFixed(1)+"/s → "+s25.rate.toFixed(1)+"/s) on a SUPERLINEAR curve — level 13 emits "+
      s13.rate.toFixed(1)+"/s, BELOW the "+((s1.rate+s25.rate)/2).toFixed(1)+
      "/s a straight line would give it, so the low levels stay quiet and the last third earns it",
      s1.rate>0&&s25.rate/s1.rate>12&&s13.rate<(s1.rate+s25.rate)/2*0.92);
    check("v132.50 aura: the pool still HOLDS with the cap emitting at "+s25.rate.toFixed(0)+
      "/s and living "+G.AURA_LIFE_HI+"s — most motes one unit ever wore at once: "+s25.most+
      " of "+G.AURA_MAX+" slots",s25.most>0&&s25.most<=G.AURA_MAX);

    // ---- 3. the owner dies mid-flight: the motes must not snap to the origin
    const doomed=put(CX,CZ,G.XP_MAX_LVL,"doom");
    for(let i=0;i<20;i++)A(0.05);
    const beforeDeath=ST().live;
    const px=doomed.root.position.x, pz=doomed.root.position.z;
    doomed.alive=false;
    A(0.05);
    const g=ST().geo.attributes.position.array; let stray=0, seen=0;
    for(let i=0;i<G.AURA_MAX;i++){
      const x=g[i*3],z=g[i*3+2];
      if(x===0&&z===0)continue;
      seen++; const d=Math.hypot(x-px,z-pz); if(d>4)stray++;
    }
    check("v132.50 aura: a mote whose owner dies mid-flight finishes where it is — it does NOT "+
      "snap to the world origin ("+beforeDeath+" aloft at the moment of death, "+seen+
      " positions still near the corpse, "+stray+" stray)",beforeDeath>0&&seen>0&&stray===0);
    drain();
  }`;

fs.writeFileSync(F,src.replace(ANCHOR,BLOCK));
console.log('v132.50 smoketest gates: inserted after the v132.29 aura block');
