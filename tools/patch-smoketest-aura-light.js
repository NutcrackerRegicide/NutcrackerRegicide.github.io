#!/usr/bin/env node
/* v132.50 — the gate for the HUE/BRIGHTNESS split.
   The density curve went superlinear in this same version. Brightness was already on ease=t^2.
   Two back-loaded curves COMPOUND, and the first build of v132.50 photographed a level 16 player
   — two thirds of the way up a twenty-five level ladder — as three dim specks. Splitting the
   ramps fixes it, and this gate is what stops the two from being re-merged by a later tidy-up. */
const fs=require('fs'),path=require('path');
const F=path.join(__dirname,'..','tools/smoketest.js');
const src=fs.readFileSync(F,'utf8');
const ANCHOR=`    drain();
  }`;
const n=src.split(ANCHOR).length-1;
if(n!==1){console.error('ABORT: anchor matched '+n+' times, expected 1');process.exit(1);}
const BLOCK=`    drain();

    // ---- 4. the LIGHT comes up early; the GOLD still arrives late ----
    const lit=lvl=>{const u={lvl:lvl,team:0},c=[0,0,0];G.auraTint(u,c);return c;};
    const peak=c=>Math.max(c[0],c[1],c[2]);
    const c1=lit(1), c13=lit(13), c16=lit(16), c25=lit(G.XP_MAX_LVL);
    const p1=peak(c1), p13=peak(c13), p16=peak(c16), p25=peak(c25);
    const mid=(p1+p25)/2;
    check("v132.50 aura: the LIGHT ramp is front-loaded — level 13 sits at "+p13.toFixed(2)+
      ", ABOVE the "+mid.toFixed(2)+" a straight line gives it, so the middle of a 25-level "+
      "ladder is something you can see. On the old shared ease=t^2 it sat BELOW that line, and "+
      "with the density curve now superlinear too the two compounded into an invisible mid-game",
      p13>mid&&p25>p13&&p13>p1);
    check("v132.50 aura: …and level 16 keeps "+((p16/p25)*100).toFixed(0)+"% of the cap's light "+
      "(was 60% when hue and brightness shared one curve)",p16/p25>0.75);
    // …but the HUE is untouched: gold still arrives late, so the team read survives (§2.5)
    const norm=a=>{const m=Math.max(a[0],a[1],a[2])||1;return [a[0]/m,a[1]/m,a[2]/m];};
    const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
    const tc=G.TEAMCOL[0], team=norm([((tc>>16)&255)/255,((tc>>8)&255)/255,(tc&255)/255]);
    const gd=G.AURA_GOLD, gold=norm([((gd>>16)&255)/255,((gd>>8)&255)/255,(gd&255)/255]);
    const n16=norm(c16);
    check("v132.50 aura: brighter is NOT yellower — at level 16 the hue is still nearer TEAM ("+
      dist(n16,team).toFixed(2)+") than gold ("+dist(n16,gold).toFixed(2)+"), so raising the "+
      "light did not spend the team read the §2.5 palette rule protects",
      dist(n16,team)<dist(n16,gold));
  }`;
fs.writeFileSync(F,src.replace(ANCHOR,BLOCK));
console.log('v132.50 light gates inserted');
