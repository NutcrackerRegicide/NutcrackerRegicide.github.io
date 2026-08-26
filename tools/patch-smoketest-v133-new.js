#!/usr/bin/env node
/* v133.0 — gates for the mechanics that are NEW rather than renumbered. */
const fs=require('fs'),path=require('path');
const F=path.join(__dirname,'..','tools/smoketest.js');
let n=0;
function sub(find,repl,label){
  const src=fs.readFileSync(F,'utf8'), c=src.split(find).length-1;
  if(c!==1){console.error('ABORT ['+label+'] matched '+c+', expected 1');process.exit(1);}
  fs.writeFileSync(F,src.replace(find,repl)); n++; console.log('  ok  '+label);
}
sub(`  check("v116 touch: the mobile layer is a no-op outside a browser",`,
`  // ---------- v133.0: THE BALANCE PASS — the mechanics that are new, not renumbered ----------
  {
    const G=global.__G;
    // ---- TIMBERWRIGHT, and the swing clock both frame paths now share ----
    const wood={type:"wood",amount:999}, stone={type:"stone",amount:999};
    const vil=G.makeUnit(0,"villager",-70,70,{name:"Chop",bot:{role:"citizen"}});
    vil.bot=null; vil.remote="chop"; vil.buffs={};
    const ox=G.makeUnit(0,"oxcart",-72,70,{name:"Ox",bot:{role:"citizen"}});
    ox.bot=null; ox.remote="ox"; ox.buffs={};
    const clb=G.makeUnit(0,"clubman",-74,70,{name:"Club",bot:{role:"citizen"}});
    clb.bot=null; clb.remote="club"; clb.buffs={};
    const base=G.gatherSwing(vil,wood);
    check("v133.0 gather: the base swing is 0.6s and PRACTICED HANDS compounds 20% a stack — "+
      [0,1,2,3,4,5].map(k=>(vil.buffs={gather:k},G.gatherSwing(vil,wood).toFixed(2))).join(" / ")+
      "s. It was −0.1s flat, which bottomed out at 0.10s and a SIX-fold rate",
      (vil.buffs={gather:0},Math.abs(G.gatherSwing(vil,wood)-0.6)<1e-9)&&
      (vil.buffs={gather:5},Math.abs(G.gatherSwing(vil,wood)-0.6*Math.pow(0.8,5))<1e-9));
    vil.buffs={};
    check("v133.0 TIMBERWRIGHT halves the swing on TIMBER for a villager ("+base.toFixed(2)+
      "s → "+(vil.buffs={timber:1},G.gatherSwing(vil,wood).toFixed(2))+"s) and for an ox cart ("+
      (ox.buffs={timber:1},G.gatherSwing(ox,wood).toFixed(2))+"s)",
      Math.abs(G.gatherSwing(vil,wood)-0.3)<1e-9&&Math.abs(G.gatherSwing(ox,wood)-0.3)<1e-9);
    check("v133.0 TIMBERWRIGHT: …and it is TIMBER only — the same villager mines stone at "+
      G.gatherSwing(vil,stone).toFixed(2)+"s, unchanged",Math.abs(G.gatherSwing(vil,stone)-0.6)<1e-9);
    check("v133.0 TIMBERWRIGHT: …and no other class gets it — a clubman holding it still swings "+
      (clb.buffs={timber:1},G.gatherSwing(clb,wood).toFixed(2))+"s",
      Math.abs(G.gatherSwing(clb,wood)-0.6)<1e-9);
    // the two frame paths must agree, which is the reason the function exists at all
    const hostSrc=fs.readFileSync(path.join(ROOT,"js/09-main.js"),"utf8");
    const netSrc =fs.readFileSync(path.join(ROOT,"js/10-net.js"),"utf8");
    check("v133.0 gather: BOTH frame paths call gatherSwing — the host loop and the guest mirror "+
      "each computed 0.6−0.1×stacks by hand, which is two copies of a balance number waiting to "+
      "drift apart",
      /gatherT>gatherSwing\\(/.test(hostSrc)&&/gatherT>gatherSwing\\(/.test(netSrc)&&
      !/0\\.6-0\\.1\\*buffSt/.test(hostSrc)&&!/0\\.6-0\\.1\\*buffSt/.test(netSrc));
    vil.alive=false; ox.alive=false; clb.alive=false;

    // ---- BOUNTY HUNTER retired ----
    check("v133.0 BOUNTY HUNTER is out of the deck ("+(G.BUFF_BY_ID.bounty?"STILL THERE":"gone")+
      ") — and TIMBERWRIGHT is in ("+(G.BUFF_BY_ID.timber?"present":"MISSING")+")",
      !G.BUFF_BY_ID.bounty&&!!G.BUFF_BY_ID.timber);
    {
      // …and a player who still holds it mid-match must neither crash nor be paid for it
      const holder=G.makeUnit(0,"clubman",-76,70,{name:"Old",bot:{role:"citizen"}});
      holder.bot=null; holder.remote="old"; holder.buffs={bounty:3}; holder.score=0;
      G.awardPts(holder,100);
      check("v133.0 BOUNTY HUNTER: a save still carrying it scores FLAT ("+holder.score+
        " for a 100-point kill, not 130) and nothing throws on the unknown id",holder.score===100);
      holder.alive=false;
    }

    // ---- THE CHARGE CADENCES ----
    check("v133.0 ARROW WARD / IRON GUARD read John's cadence tables, not 30÷stacks — ward "+
      G.WARD_CD.join("/")+"s, guard "+G.GUARD_CD.join("/")+"s across five stacks",
      G.WARD_CD.length===5&&G.GUARD_CD.length===5&&
      G.WARD_CD[0]===24&&G.WARD_CD[4]===3&&G.GUARD_CD[0]===25&&G.GUARD_CD[4]===5&&
      G.buffMax("ward")===5&&G.buffMax("guardup")===5);

    // ---- KINSHIP scales with the shield wall ----
    {
      const KIN=(hp,near)=>Math.min(0.05,0.005*near)*hp;
      check("v133.0 KINSHIP pays per kinsman and ceilings at 5% — on a 200 HP body: "+
        [1,4,10,14].map(k=>k+" near = "+KIN(200,k).toFixed(1)+" HP/s").join(", ")+
        ". A flat 1 HP/s paid the same whether one stood with you or ten",
        Math.abs(KIN(200,1)-1)<1e-9&&Math.abs(KIN(200,10)-10)<1e-9&&Math.abs(KIN(200,14)-10)<1e-9);
      const combatSrc=fs.readFileSync(path.join(ROOT,"js/05-combat.js"),"utf8");
      check("v133.0 KINSHIP: …and the aura pass COUNTS kinsmen rather than latching a boolean — "+
        "the old loop stopped at the first one it found",
        /kinNear\\+\\+/.test(combatSrc)&&/Math\\.min\\(0\\.05,0\\.005\\*kinNear\\)/.test(combatSrc)&&
        !/kinNear=true/.test(combatSrc));
    }

    // ---- SERRATED EDGE layers to three ----
    {
      const v=G.makeUnit(1,"clubman",-78,70,{name:"Bled",bot:{role:"citizen"}});
      v.bot=null; v.remote="bled"; v._tmods=null;
      for(let i=0;i<6;i++)G.tmodAdd(v,"bleed",1,20,false,3);
      const mag=G.tmodSum(v,"bleed");
      check("v133.0 SERRATED EDGE: six procs on one enemy layer to "+mag+
        " HP/s and no further — 3 over twenty seconds is the 60 HP on the sheet, and a seventh "+
        "proc refreshes the clock without deepening the wound",mag===3);
      v.alive=false;
    }
  }
  check("v116 touch: the mobile layer is a no-op outside a browser",`,'smoketest: v133.0 new-mechanic gates');
console.log('v133.0 new gates: '+n+' edits applied');
