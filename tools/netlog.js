#!/usr/bin/env node
/* REGICIDE PVP — tools/netlog.js — THE FLIGHT-RECORDER READER (v126)
   ------------------------------------------------------------------
   node tools/netlog.js <host.json> <guest.json> [<guest2.json> ...]

   F9 saves one of these per machine. This joins them on the wall clock and walks the
   diagnostic ladder that the handoff spells out by hand, so the next field test is one
   command instead of an afternoon of ad-hoc python.

   WHY IT JOINS ON `t` AND NOT `T`: `t` is Date.now() on every machine, so the three files
   line up directly. `T` is each machine's own match clock, and the whole v126 investigation
   came out of the fact that those clocks do NOT agree — a host at 10–19 fps loses time to
   09-main's dt clamp and its T runs at 0.74–0.85× wall. Joining on T would have hidden the
   bug inside the very field it corrupted.

   It reads both log formats. `logfmt:2` (v126+) carries `win` — the window each row actually
   measured — plus `simR` on host rows and `age` on guest rows. Format 1 (v98–v125) has none of
   those: its rows are spaced by SIM seconds, so every rate in them is inflated by 1/simR, up
   to 2× in the worst seconds. When it sees a format-1 file it derives the true window from
   consecutive `t` values and CORRECTS the rates, then says so — the uncorrected numbers are
   what made a 10-fps host read as 20.                                                       */

const fs=require("fs");
const args=process.argv.slice(2);
if(!args.length){console.error("usage: node tools/netlog.js <host.json> <guest.json> [...]");process.exit(2);}

const files=args.map(f=>{
  let d;try{d=JSON.parse(fs.readFileSync(f,"utf8"));}
  catch(e){console.error("cannot read "+f+": "+e.message);process.exit(2);}
  return {path:f,meta:d.meta||{},rows:d.rows||[],events:d.events||[]};
});
const host=files.find(f=>(f.meta.role||"")==="host");
const guests=files.filter(f=>(f.meta.role||"")==="guest");
if(!host)console.warn("! no host log among the inputs — host-side questions will be unanswerable\n");

// ---------- helpers ----------
const r1=v=>Math.round(v*10)/10;
function stat(a){
  const v=a.filter(x=>typeof x==="number"&&isFinite(x)).sort((x,y)=>x-y);
  if(!v.length)return null;
  const at=p=>v[Math.min(v.length-1,Math.floor(v.length*p))];
  return {n:v.length,min:v[0],p10:at(0.10),med:at(0.5),p90:at(0.90),max:v[v.length-1],
    mean:r1(v.reduce((s,x)=>s+x,0)/v.length)};
}
const show=(label,s,unit)=>console.log("    "+label.padEnd(12)+(s?
  ("min "+r1(s.min)+"  p10 "+r1(s.p10)+"  med "+r1(s.med)+"  p90 "+r1(s.p90)+"  max "+r1(s.max)+
   "  (mean "+s.mean+(unit?" "+unit:"")+", n="+s.n+")"):"—"));
// the true window a row measured: `win` when the log carries it, else the wall gap to the row
// before (which is what a format-1 log's "one second" really was)
function windows(rows){
  return rows.map((r,i)=>{
    if(typeof r.win==="number"&&r.win>200)return r.win;
    if(i===0)return 1000;
    const g=r.t-rows[i-1].t;
    return (g>200&&g<10000)?g:1000;
  });
}
const pct=(a,b)=>b?Math.round(100*a/b)+"%":"—";
function bar(frac){const n=Math.max(0,Math.min(20,Math.round(frac*20)));return "█".repeat(n)+"·".repeat(20-n);}

console.log("=".repeat(78));
console.log("REGICIDE NET LOG — "+files.length+" file(s)");
console.log("=".repeat(78));
for(const f of files){
  const m=f.meta;
  console.log((m.role||"?").toUpperCase().padEnd(6)+" "+(m.name||"?"));
  console.log("       build "+(m.ver||"?")+"  proto "+(m.proto||"?")+"  logfmt "+(m.logfmt||1)+
    "  snapHz "+(m.snapHz||"?")+(m.mirrorEvery?("  mirrorEvery "+m.mirrorEvery):"")+
    "  rows "+f.rows.length+"  events "+f.events.length);
  console.log("       saved "+(m.saved||"?"));
  if((m.logfmt||1)<2)console.log("       ! format 1: rows are spaced by SIM seconds. Rates below are CORRECTED to the wall gap.");
}

// ---------- 0. THE CLOCK. Everything else is downstream of this. ----------
console.log("\n"+"-".repeat(78));
console.log("0. THE CLOCK  — is the match clock keeping up with the wall clock?");
console.log("-".repeat(78));
console.log("   09-main clamps the sim step to 0.05s. A host slower than 20 fps has frames longer");
console.log("   than that, and the excess is DELETED from the match clock rather than carried. The");
console.log("   ratio below is the fraction of real time the sim is actually advancing.");
for(const f of files){
  const rows=f.rows; if(rows.length<3)continue;
  const spanW=(rows[rows.length-1].t-rows[0].t)/1000, spanT=rows[rows.length-1].T-rows[0].T;
  const per=[];
  for(let i=1;i<rows.length;i++){
    const w=(rows[i].t-rows[i-1].t)/1000;
    if(w>0.3&&w<5)per.push((rows[i].T-rows[i-1].T)/w);
  }
  const s=stat(per);
  const overall=spanW>0?spanT/spanW:1;
  console.log("\n   "+(f.meta.role||"?")+" "+(f.meta.name||"?"));
  console.log("     overall  T advanced "+r1(spanT)+"s across "+r1(spanW)+"s of wall time  →  ratio "+
    (Math.round(overall*1000)/1000)+"   "+bar(overall));
  if(overall<0.97)console.log("     ⚠ LOST "+r1(spanW-spanT)+"s of match time. Guest-side freshness maths that compares");
  if(overall<0.97)console.log("       a sim clock against a wall clock will drift by "+r1((1-overall)*1000)+"ms per second.");
  show("per-second",s);
  if(f.meta.role==="host"){
    const byFps={};
    for(let i=1;i<rows.length;i++){
      const w=(rows[i].t-rows[i-1].t)/1000; if(!(w>0.3&&w<5))continue;
      const realFps=rows[i].fps/w, k=Math.min(60,Math.max(5,Math.round(realFps/5)*5));
      (byFps[k]=byFps[k]||[]).push((rows[i].T-rows[i-1].T)/w);
    }
    const keys=Object.keys(byFps).map(Number).sort((a,b)=>a-b);
    if(keys.length>1){
      console.log("     ratio by REAL fps (the clamp bites hardest exactly where the host is slowest):");
      for(const k of keys){const st=stat(byFps[k]);console.log("       ~"+String(k).padStart(2)+" fps → "+r1(st.mean)+"   n="+st.n);}
    }
  }
}

// ---------- host health ----------
if(host){
  const rows=host.rows, wins=windows(rows);
  console.log("\n"+"-".repeat(78));
  console.log("1. THE HOST  — could it render, and could it send?");
  console.log("-".repeat(78));
  const fmt=host.meta.logfmt||1;
  const realFps=rows.map((r,i)=>r.fps/(wins[i]/1000));
  show("fps LOGGED",stat(rows.map(r=>r.fps)));
  if(fmt<2)show("fps REAL",stat(realFps));
  show("units",stat(rows.map(r=>r.units)));
  show("buildings",stat(rows.map(r=>r.blds)));
  const names=new Set();rows.forEach(r=>Object.keys(r.g||{}).forEach(n=>names.add(n)));
  const snapHz=host.meta.snapHz||15;
  for(const n of names){
    const idx=[];rows.forEach((r,i)=>{if(r.g&&r.g[n])idx.push(i);});
    const g=idx.map(i=>rows[i].g[n]);
    console.log("\n   → "+n+"  ("+g.length+" sampled seconds)");
    show("ping",stat(g.map(x=>x.ping)),"ms");
    show("sent LOGGED",stat(g.map(x=>x.sent)),"/win");
    if(fmt<2)show("sent REAL",stat(idx.map(i=>rows[i].g[n].sent/(wins[i]/1000))),"/s");
    show("buf",stat(g.map(x=>x.buf)),"B");
    show("inputAge",stat(g.map(x=>x.inAge)),"ms");
    const skF=g.reduce((s,x)=>s+(x.skipF||0),0), skR=g.reduce((s,x)=>s+(x.skipR||0),0);
    const anySkip=g.filter(x=>x.skipF||x.skipR).length;
    const bufMax=host.meta.bufFast||16384;
    const choked=g.filter(x=>x.buf>=bufMax).length;
    const frozen=g.filter(x=>x.inAge>600).length;
    const relay=g.filter(x=>!x.fast).length;
    console.log("      skipped: "+skF+" fast + "+skR+" reliable, across "+anySkip+" seconds ("+pct(anySkip,g.length)+")");
    console.log("      send buffer at/over "+bufMax+"B: "+choked+" seconds ("+pct(choked,g.length)+")");
    console.log("      input age over 600ms (body frozen host-side): "+frozen+" seconds ("+pct(frozen,g.length)+")");
    console.log("      on the reliable relay: "+relay+" seconds ("+pct(relay,g.length)+")");
    // a buffer that never MOVES is a dead channel, not a busy one
    let wedge=0,run=0;
    for(let k=1;k<g.length;k++){
      if(g[k].buf>=bufMax&&g[k].buf===g[k-1].buf){run++;if(run>wedge)wedge=run;}else run=0;
    }
    if(wedge>=3)console.log("      ⚠ WEDGED LANE: buffer identical for "+(wedge+1)+" consecutive samples — that channel");
    if(wedge>=3)console.log("        was dead while still reporting open. v126 LANE_WEDGE_MS drops it; before that the");
    if(wedge>=3)console.log("        host skipped against it for ever.");
  }
}

// ---------- guests ----------
console.log("\n"+"-".repeat(78));
console.log("2. THE GUESTS  — did it arrive, and was it usable?");
console.log("-".repeat(78));
for(const gf of guests){
  const rows=gf.rows, wins=windows(rows), fmt=gf.meta.logfmt||1;
  console.log("\n   → "+(gf.meta.name||"?")+"  ("+rows.length+" rows, logfmt "+fmt+")");
  show("fps",stat(rows.map(r=>r.fps)));
  show("ping",stat(rows.map(r=>r.ping).filter(x=>x>0)),"ms");
  show("snaps",stat(rows.map(r=>r.snaps)),"/win");
  if(fmt<2)show("snaps REAL",stat(rows.map((r,i)=>r.snaps/(wins[i]/1000))),"/s");
  show("KB/s",stat(rows.map(r=>r.kb)));
  show("gapAvg",stat(rows.map(r=>r.gapAvg)),"ms");
  if(rows.some(r=>typeof r.age==="number")){
    show("snap age",stat(rows.map(r=>r.age)),"ms");
    show("age worst",stat(rows.map(r=>r.ageMax)),"ms");
  }
  const tot=k=>rows.reduce((s,r)=>s+(r[k]||0),0);
  const snaps=tot("snaps"),dup=tot("dup"),stale=tot("stale"),qgap=tot("qgap"),leash=tot("leash");
  console.log("      arrivals: "+snaps+" applied · "+dup+" discarded as duplicate ("+pct(dup,snaps+dup)+" of all arrivals)");
  console.log("      sequence holes: "+qgap+"   authority refused as stale: "+stale+" ("+pct(stale,snaps)+" of applied)");
  console.log("      leash yanks: "+leash+"   on the fast lane: "+pct(rows.filter(r=>r.fast).length,rows.length)+" of seconds");
  if(snaps&&stale/snaps>0.25){
    console.log("      ⚠ "+pct(stale,snaps)+" of snapshots were denied positional authority. If the host's clock ratio in");
    console.log("        section 0 is below ~0.97 and this log is format 1, this is the v126 clock bug: the guest");
    console.log("        advanced its own reference at 1.0× against a host sim clock running slower, so the lag it");
    console.log("        measured was manufactured by the frame-rate gap, not by the network. The body then ran on");
    console.log("        dead reckoning with no correction from the host at all.");
  }
  if(snaps+dup&&dup/(snaps+dup)>0.10){
    console.log("      ⚠ "+pct(dup,snaps+dup)+" of arrivals thrown away. Before v126 the reliable lane mirrored every 4th");
    console.log("        snap (3.75Hz) alongside a healthy fast lane; applySnap discards those on `q<=lastQ`.");
    console.log("        MIRROR_EVERY drops that to 1Hz.");
  }
  const ev={};gf.events.forEach(e=>ev[e.k]=(ev[e.k]||0)+1);
  const kinds=Object.keys(ev).sort();
  if(kinds.length)console.log("      events: "+kinds.map(k=>k+" ×"+ev[k]).join(" · "));
  if((ev.redial||0)>=5){
    console.log("      ⚠ "+ev.redial+" redials. Before v126 there was no guard against two dials in flight (the 1200ms");
    console.log("        redial and the 5s retry did not know about each other) and the host never closed the lane");
    console.log("        each new dial replaced, so both ends accumulated orphaned channels.");
  }
}

// ---------- the join ----------
if(host&&guests.length){
  console.log("\n"+"-".repeat(78));
  console.log("3. THE JOIN  — the host said it sent, the guest said it got. Do they agree?");
  console.log("-".repeat(78));
  console.log("   Matched on wall-clock `t` within ±700ms. A gap here localises the fault: sent high +");
  console.log("   received low is the network; both low is the host; received fine + stale high is the");
  console.log("   apply path.");
  const hRows=host.rows, hWin=windows(hRows);
  for(const gf of guests){
    const name=gf.meta.name;
    const gRows=gf.rows, gWin=windows(gRows);
    let pairs=0,sentSum=0,gotSum=0,hi=0;
    for(let i=0;i<gRows.length;i++){
      while(hi<hRows.length-1&&hRows[hi].t<gRows[i].t-700)hi++;
      const h=hRows[hi];
      if(Math.abs(h.t-gRows[i].t)>700)continue;
      const hg=h.g&&h.g[name]; if(!hg)continue;
      pairs++;
      sentSum+=hg.sent/(hWin[hi]/1000);
      gotSum+=gRows[i].snaps/(gWin[i]/1000);
    }
    if(!pairs){console.log("\n   → "+name+": no overlapping seconds (do the two files come from the same session?)");continue;}
    const sentR=sentSum/pairs, gotR=gotSum/pairs;
    console.log("\n   → "+name+"  ("+pairs+" matched seconds)");
    console.log("      host sent  "+r1(sentR)+" /s   (target "+(host.meta.snapHz||15)+")");
    console.log("      guest got  "+r1(gotR)+" /s   → "+pct(Math.round(gotR*100),Math.round(sentR*100))+" of what was sent");
    const loss=sentR>0?1-gotR/sentR:0;
    if(loss>0.15)console.log("      ⚠ "+Math.round(loss*100)+"% did not arrive — that share is the network or the mirror being discarded.");
    else if(sentR<(host.meta.snapHz||15)*0.9)console.log("      the loss is small; the shortfall is on the HOST side (it never sent "+(host.meta.snapHz||15)+"/s).");
  }
  // two guests in one session is the useful part
  if(guests.length>1){
    console.log("\n   TWO GUESTS, ONE HOST: if one is clean and one is not, the host is not the cause.");
    for(const gf of guests){
      const rows=gf.rows,snaps=rows.reduce((s,r)=>s+(r.snaps||0),0),stale=rows.reduce((s,r)=>s+(r.stale||0),0);
      console.log("     "+String(gf.meta.name).padEnd(18)+" stale "+pct(stale,snaps).padStart(4)+
        "   fastlane "+pct(rows.filter(r=>r.fast).length,rows.length).padStart(4)+
        "   redials "+String(gf.events.filter(e=>e.k==="redial").length).padStart(3)+
        "   ping med "+String((stat(rows.map(r=>r.ping).filter(x=>x>0))||{med:"—"}).med).padStart(5)+"ms");
    }
    console.log("     (a guest who stalls MORE but goes stale LESS is the signature of the clock bug, not of");
    console.log("      a better connection: a stalled feed freezes the guest's reference and re-syncs it.)");
  }
}
console.log("\n"+"=".repeat(78));
