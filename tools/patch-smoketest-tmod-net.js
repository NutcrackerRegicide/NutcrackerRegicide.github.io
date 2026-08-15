#!/usr/bin/env node
/* patch-smoketest-tmod-net.js — gate the guest's prediction of its own timed modifiers.
 *
 * Three separable failures, three assertions. Any one of them alone leaves prediction wrong:
 *   · THE HOST SENDS. A modifier applied to a remote human must put a `tmd` on that player's
 *     wire — and must NOT be broadcast, because a speed buff is private to its owner.
 *   · THE GUEST APPLIES. Receiving `tmd` must actually reach the same tmodAdd the host ran, so
 *     the two sides compute the same multiplier from the same numbers.
 *   · THE GUEST EXPIRES IT. This is the one that would rot silently: if the guest applies the
 *     modifier but never ticks it, a two-second buff lasts until something replaces it — the
 *     prediction would be wrong in the opposite direction and only in long matches.
 *
 * Plus the death clear, because a corpse that keeps a speed buff on its owner's screen is exactly
 * the sort of thing that survives a playtest unnoticed.
 */
const fs=require("fs"),path=require("path");
const F=path.join(__dirname,"smoketest.js");
let s=fs.readFileSync(F,"utf8");
let failed=[];
function sub(name,from,to){
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
}

sub("export the sync door",
  `tmodAdd,tmodSum,tmodMul,tmodTick,TMOD_OOC,TMOD_LOW,moveUnit};";`,
  `tmodAdd,tmodSum,tmodMul,tmodTick,TMOD_OOC,TMOD_LOW,moveUnit,tmodSync,tmodSyncClear};";`);

sub("tmod net gate",
`    G.NET.mode=_mB;
  }`,
`    // ---- v132.33: the guest predicts its own timed modifiers ----
    {
      const sent=[]; const bcast=[];
      const savedMode=G.NET.mode, savedRemotes=G.NET.remotes;
      G.NET.mode="host";
      const owner=mkB(0,{surge:1}); owner.remote="tmpeer";
      const other=mkB(0,{}); other.remote="otherpeer";
      G.NET.remotes={tmpeer:{unit:owner,conn:{send:(m)=>sent.push(m)}},
                     otherpeer:{unit:other,conn:{send:(m)=>bcast.push(m)}}};
      G.tmodAdd(owner,"spdmul",0.5,2,true);
      const mine=sent.filter(m=>m&&m.t==="tmd");
      check("v132.33 tmod wire: applying a modifier puts a tmd on the OWNER's wire ("+
        mine.length+" sent)",mine.length===1&&mine[0].k==="spdmul"&&
        Math.abs(mine[0].m-0.5)<1e-9&&Math.abs(mine[0].d-2)<1e-9&&mine[0].f===1);
      check("v132.33 tmod wire: …and it is NOT broadcast — a speed buff is private to its owner ("+
        bcast.filter(m=>m&&m.t==="tmd").length+" leaked)",
        bcast.filter(m=>m&&m.t==="tmd").length===0);
      // the guest side: same numbers in, same multiplier out
      const guest={team:0,cls:"clubman",buffs:{},_tmods:null};
      const w=mine[0];
      G.tmodAdd(guest,w.k,w.m,w.d,!!w.f,w.c||0);
      check("v132.33 tmod wire: the guest computes the SAME multiplier the host does ("+
        G.tmodMul(guest,"spdmul").toFixed(3)+"× vs "+G.tmodMul(owner,"spdmul").toFixed(3)+"×)",
        Math.abs(G.tmodMul(guest,"spdmul")-G.tmodMul(owner,"spdmul"))<1e-9);
      // …and the guest must EXPIRE it. Without its own tick a 2s buff would never end.
      G.tmodTick(guest,3);
      check("v132.33 tmod wire: the guest EXPIRES it on its own clock — without this a 2s buff "+
        "runs until something replaces it ("+G.tmodMul(guest,"spdmul").toFixed(2)+"×)",
        Math.abs(G.tmodMul(guest,"spdmul")-1)<1e-9);
      // the death clear reaches the owner
      sent.length=0; G.tmodSyncClear(owner);
      check("v132.33 tmod wire: the death wipe reaches the owner's screen too ("+
        (sent.length&&sent[0].clr?"clear sent":"NOTHING SENT")+")",
        sent.length===1&&sent[0].t==="tmd"&&sent[0].clr===1);
      G.NET.remotes=savedRemotes; G.NET.mode=savedMode;
      owner.alive=false; other.alive=false;
    }
    G.NET.mode=_mB;
  }`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — tmod prediction wire gate");
