/* REGICIDE PVP — 08-ui.js */
// ---------- HUD ----------
function msg(text,kind){
  const feed=document.getElementById("feed");
  const el=document.createElement("div");
  el.className="msg"+(kind?" "+kind:"");
  el.textContent=text;
  feed.appendChild(el);
  while(feed.children.length>6)feed.removeChild(feed.firstChild);
  setTimeout(()=>{el.style.transition="opacity 1s";el.style.opacity="0";
    setTimeout(()=>el.remove(),1000);},6000);
}
function showScoreboard(on){
  const el=document.getElementById("scoreboard");
  if(!el)return;
  if(!on){el.style.display="none";return;}
  // host/solo tallies live units; guests read what the snapshot brought
  let rows;
  if(typeof NET!=="undefined"&&NET.mode==="guest"&&NET.scores)rows=NET.scores.slice();
  else{
    rows=[[player.name==="You"?"You":player.name,Math.round(player.score||0),player.team,player.id,player.lvl||0]];
    if(typeof NET!=="undefined")for(const k in NET.remotes){
      const r=NET.remotes[k]; if(r.unit)rows.push([r.name,Math.round(r.unit.score||0),r.unit.team,r.unit.id,r.unit.lvl||0]);
    }
  }
  const col=t=>{
    const list=rows.filter(r=>(r[2]??0)===t).sort((a,b)=>b[1]-a[1]).slice(0,10);
    return "<div class='sccol'><div class='schead "+(t===0?"scblue":"scred")+"'>"+
      (t===0?"⚑ BLUE":"⚑ RED")+"</div>"+
      (list.length?list.map((r,i)=>
        "<div class='scrow'><span>"+(i+1)+". "+r[0]+(r[4]?" <i class='sclvl'>⭐"+r[4]+"</i>":"")+"</span><b>"+r[1]+"</b></div>").join("")
      :"<div class='scrow scempty'>—</div>")+"</div>";
  };
  // v89: the FULL quest text lives here — the feed message scrolls away, TAB never does
  const q=player&&player.quest&&QUESTS[player.quest.i];
  const questLine=q
    ?("📜 <b>"+q.name+"</b> — "+q.desc+" · <b>"+Math.min(player.quest.prog,q.n)+"/"+q.n+"</b>"+
      (q.xp>1?" · pays <b>"+q.xp+" levels & "+q.xp+" XP</b>":"")+
      " &nbsp;·&nbsp; ⭐ LV "+(player.lvl||0)+" · "+(player.xp||0)+" XP unspent")
    :"📜 No active quest — press <b>E</b> at the Town Board by your Town Center"+
      ((player&&(player.xp||0)>0)?" &nbsp;·&nbsp; "+player.xp+" XP waiting at the Blacksmith!":"");
  // v90: the forge's work, spelled out — every active buff with its full text and stacks
  let buffRows="";
  if(player&&player.buffs)for(const B of BUFFS){
    const st=player.buffs[B.id];
    if(st)buffRows+="<div class='scbuff'><b>"+B.name+" ×"+st+"</b> — "+B.desc+"</div>";
  }
  const buffBlock=buffRows
    ?"<div class='scbuffs'><div class='scbuffhead'>🔨 YOUR BUFFS</div>"+buffRows+"</div>"
    :"";
  el.innerHTML="<h3>WAR HONORS</h3><div class='sccols'>"+col(0)+col(1)+"</div>"+
    "<div class='scquest'>"+questLine+"</div>"+buffBlock+
    "<div class='schint'>resources banked · kills & razings at cost · builds ⅓ · heals 1/hp · quests +25/xp · regicide +500</div>";
  el.style.display="block";
}
function updateResHud(){
  document.getElementById("rfood").textContent=Math.floor(stock[MYTEAM].food);
  document.getElementById("rgold").textContent=Math.floor(stock[MYTEAM].gold);
  document.getElementById("rstone").textContent=Math.floor(stock[MYTEAM].stone);
  document.getElementById("rwood").textContent=Math.floor(stock[MYTEAM].wood);
  if(menuOpen)refreshMenuAfford();
}
function updatePlayerHud(){
  document.getElementById("pclass").textContent=CLS[player.cls].name.toUpperCase();
  document.querySelector("#phpbar i").style.width=Math.max(0,player.hp/player.maxHp*100)+"%";
  const LT={melee:"LMB swing · RMB block — beats Ranged units",
    anticav:"Long reach · RMB block · 3× vs ALL cavalry",
    ranged:"LMB auto-shot · hold RMB to AIM a skill shot · beats Anti-Cavalry",
    cavalry:"Fast & heavy · run down Ranged units · fear spears",
    scoutline:"Fastest on the field · spy, harass, escape",
    healer:"You cannot fight — your aura mends nearby allies",
    trade:"E at a neutral bazaar to load · sell at YOUR Market · 4× cart rates",
    meleesiege:"Wheel up to their walls — devastates buildings, feeble vs troops",
    rangedsiege:"Bombard from range · splash on impact · protect me!",
    civil:"E gather · B build · deposit at Town Center or Storage Pit",
    royal:"…how did you become the king?"};
  const c0=CLS[player.cls];
  let tip=(c0.rig==="musket")?"Hold RMB to AIM · devastating shot, slow reload":LT[c0.line];
  if(player.tradeLoaded)tip="GOODS LOADED — get back to your Market and sell!";
  document.getElementById("ptip").textContent=tip;
  const c=player.carry.food+player.carry.gold+player.carry.stone+player.carry.wood;
  const cw=document.getElementById("carry");
  cw.style.display=c>0?"block":"none";
  document.getElementById("carrytxt").textContent=
    (player.carry.food?player.carry.food+" food ":"")+(player.carry.gold?player.carry.gold+" gold ":"")+(player.carry.stone?player.carry.stone+" stone ":"")+(player.carry.wood?player.carry.wood+" wood":"")+(c>=20?" (FULL)":"");
}
// v87: the quest panel — level, XP, the active posting, and the buffs you carry
function updateQuestHud(){
  const el=document.getElementById("questhud"); if(!el||!player)return;
  const lv=document.getElementById("qlvl"), qt=document.getElementById("qtext"), qb=document.getElementById("qbuffs");
  if(lv)lv.textContent="⭐ LV "+(player.lvl||0)+((player.xp||0)>0?" · "+player.xp+" XP to spend!":" · 0 XP");
  const q=player.quest&&QUESTS[player.quest.i];
  if(qt)qt.textContent=q?("📜 "+q.name+": "+Math.min(player.quest.prog,q.n)+"/"+q.n)
                        :"📜 No quest — E at the Town Board";
  if(qb){
    const bl=[];
    if(player.buffs)for(const B of BUFFS)if(player.buffs[B.id])bl.push(B.name+"×"+player.buffs[B.id]);
    qb.textContent=bl.join(" · ");
    qb.style.display=bl.length?"block":"none";
  }
}
function updateKingBars(){
  for(const t of [BLUE,RED]){
    const k=kings[t];
    document.querySelector("#kb"+t+" .bar i").style.width=Math.max(0,k.hp/k.maxHp*100)+"%";
  }
}
const mm=document.getElementById("minimap").getContext("2d");
function drawMinimap(){
  const W=170,H=120;
  mm.fillStyle="#324620";mm.fillRect(0,0,W,H);
  const MX=MAP.x+46,MZ=MAP.z+56; // window widened for the deepened camp hollows and the Viking bay
  const px=x=>Math.max(2,Math.min(W-2,(x+MX)/(MX*2)*W));  // the deepest hollows clamp to the chart's rim
  const pz=z=>Math.max(2,Math.min(H-2,(z+MZ)/(MZ*2)*H));
  mm.fillStyle="#2a3a1c"; // the wilds beyond the border read darker
  mm.fillRect(0,0,px(-MAP.x),H); mm.fillRect(px(MAP.x),0,W-px(MAP.x),H);
  mm.fillRect(0,0,W,pz(-MAP.z)); mm.fillRect(0,pz(MAP.z),W,H-pz(MAP.z));
  if(typeof campStates!=="undefined")for(const st of campStates){ // camp nooks + any standing treasure
    if(st.boss){ // the shore: a wash of sea, a sand crescent, a wreck-brown heart
      mm.fillStyle="#3a6584";mm.fillRect(px(st.x)-14,pz(st.z)+2,28,10);
      mm.fillStyle="#d9c48f";mm.beginPath();mm.arc(px(st.x),pz(st.z),6,0,7);mm.fill();
      mm.fillStyle="#4e3a26";mm.beginPath();mm.arc(px(st.x),pz(st.z),2.4,0,7);mm.fill();
    }else{
      mm.fillStyle="#4a3a26";
      mm.beginPath();mm.arc(px(st.x),pz(st.z),3.4,0,7);mm.fill();
    }
    if(st.chest){mm.fillStyle=st.chestKind==="food"?"#d23c2f":"#ffd24a";
      mm.fillRect(px(st.x)-(st.boss?5:2),pz(st.z)-2,4,4);}
    if(st.chestB){mm.fillStyle=st.chestKindB==="food"?"#d23c2f":"#ffd24a";
      mm.fillRect(px(st.x)+1,pz(st.z)-2,4,4);}
  }
  for(const n of nodes){
    if(n.amount<=0)continue;
    mm.fillStyle=n.type==="food"?"#c0392b":n.type==="gold"?"#e0a92e":n.type==="stone"?"#9aa2ad":"#3f6d2f";
    mm.fillRect(px(n.x)-1.5,pz(n.z)-1.5,3,3);
  }
  mm.fillStyle="#ffd24a";
  for(const m of neutralMarkets){mm.fillRect(px(m.x)-2.5,pz(m.z)-2.5,5,5);
    mm.strokeStyle="#7a5a10";mm.lineWidth=1;mm.strokeRect(px(m.x)-2.5,pz(m.z)-2.5,5,5);}
  if(typeof townBoards!=="undefined"){mm.fillStyle="#f0e6c8"; // the quest boards: parchment specks by each throne
    for(const tb of townBoards)mm.fillRect(px(tb.x)-1.5,pz(tb.z)-1.5,3,3);}
  for(const b of buildings){
    if(!b.alive)continue;
    if(b.team!==BLUE&&!b.fow)continue; // unscouted enemy buildings stay off the map
    mm.fillStyle=b.team===BLUE?"#3d6ef2":"#d94a3d";
    const s=b.type==="towncenter"?7:4;
    mm.fillRect(px(b.x)-s/2,pz(b.z)-s/2,s,s);
  }
  for(const u of units){
    if(!u.alive)continue;
    if(u.team!==BLUE&&!u.fow)continue; // hidden enemies leave no dot
    mm.fillStyle=u.isPlayer?"#ffffff":(u.team===NEUTRAL?"#c9c39a":(u.team===BLUE?"#7ea1ff":"#ff9b90"));
    const s=u.isKing?5:3;
    mm.beginPath();mm.arc(px(u.root.position.x),pz(u.root.position.z),s/2+(u.isKing?1:0),0,7);mm.fill();
    if(u.isKing){mm.strokeStyle="#ffd24a";mm.lineWidth=1.5;mm.stroke();}
  }
}

// ---------- ages ----------
// v107: the cost is paid HERE and the age lands 90s later (tickAgeResearch → ageUp).
// Pay-now / no-cancel: the simplest desync-safe shape — one authoritative countdown per team.
function startAgeResearch(team){
  const nxt=AGES[teamAge[team]+1]; if(!nxt)return false;
  if(ageResT[team]>0)return false;             // already advancing
  pay(team,nxt.cost);
  ageResT[team]=AGE_RESEARCH_S;
  if(team===MYTEAM){
    msg("⏳ ADVANCING TO THE "+nxt.name.toUpperCase()+" — "+Math.round(AGE_RESEARCH_S)+" SECONDS.","blue");
    if(typeof Sound!=="undefined")Sound.play("ui_confirm");
  }
  updateAgeHud();
  return true;
}
// host/solo tick the authoritative countdown (authoritative=true → the age fires at 0);
// guests tick for display smoothness only — snapshots overwrite with the host's truth.
function tickAgeResearch(dt,authoritative){
  if(typeof gameOver!=="undefined"&&gameOver)return;
  for(const t of [BLUE,RED]){
    if(ageResT[t]<=0)continue;
    const before=Math.ceil(ageResT[t]);
    ageResT[t]=Math.max(0,ageResT[t]-dt);
    if(ageResT[t]<=0){
      ageResT[t]=0;
      if(authoritative)ageUp(t);
    }
    if(t===MYTEAM&&Math.ceil(ageResT[t])!==before)updateAgeHud(); // once per second, not per frame
  }
}
function ageUp(team){
  const nxt=AGES[teamAge[team]+1]; if(!nxt)return;
  ageResT[team]=0; teamAge[team]++; // v107: the cost was paid at startAgeResearch
  const tc=teamTC(team);
  if(tc)for(let i=0;i<12;i++)
    puff(tc.x+(Math.random()-0.5)*12,2+Math.random()*7,tc.z+(Math.random()-0.5)*12,0xffe27a);
  msg((team===BLUE?"⬆ YOUR TEAM ADVANCES TO THE ":"⬆ THE RED TEAM ENTERS THE ")+nxt.name.toUpperCase()+"!",
      team===BLUE?"blue":"red");
  restyleBuildings(team,true); // the whole town re-dresses in a quick WAVE — never one big hitch
  restyleUnits(team,true);      // villagers change clothes in the same wave
  if(teamAge[team]===6)
    msg((team===BLUE?"Your":"Their")+" GRAND ARMY forms — Enlightenment troops fight +10% harder.",
        team===BLUE?"blue":"warn");
  updateAgeHud();
  if(typeof Sound!=="undefined"&&team===MYTEAM)Sound.play("ageup"); // v100: triumphant horn on YOUR advance
}
function updateAgeHud(){
  const a=teamAge[MYTEAM], nxt=AGES[a+1];
  let tail;
  if(nxt&&ageResT[MYTEAM]>0){ // v107: the 90s advance — countdown + a small progress bar
    const rem=Math.max(0,ageResT[MYTEAM]), f=1-rem/AGE_RESEARCH_S, n=10, fill=Math.max(0,Math.min(n,Math.round(f*n)));
    tail=" — ⏳ "+nxt.name.toUpperCase()+" in "+Math.ceil(rem)+"s "+
      "<span style='letter-spacing:1px;color:#ffd24a'>"+"▰".repeat(fill)+"</span>"+
      "<span style='letter-spacing:1px;opacity:.35'>"+"▱".repeat(n-fill)+"</span>";
  }else tail=nxt?(" — next: "+costText(nxt.cost)+" (T at Town Center)")
              :" — the final age";
  document.getElementById("agebar").innerHTML="<b>"+AGES[a].name.toUpperCase()+"</b>"+tail;
  if(menuOpen)refreshMenuAfford();
}
