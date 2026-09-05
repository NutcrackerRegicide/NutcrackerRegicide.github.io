#!/usr/bin/env node
/* patch-smoketest-ambient-v134.js — v134.8: TWO BENCHES STOP MEASURING THE NEIGHBOURHOOD.
 *
 * WHAT HAPPENED. v134.8 rotates farm barns. Placement is unaffected (validFor reads radii, never
 * rot) so every field lands on exactly the ground it landed on before — but the COLLIDER moves, so
 * bodies path differently around it, so the twenty-minute campaign that runs before most of this
 * file diverges. On the four seeds the suite is run against, v134.7 is clean on all four; with the
 * rotation in, three assertions went red across three of them:
 *
 *   default   the charge RAZES the building in its path (hp 183)
 *             the line HOLDS the far ground (0/3 within 16 of the mark)
 *   42        the line HOLDS the far ground (1/3)   ·   G cancels the standing charge
 *             hostAct buff: the offered pick is granted (stack 0)
 *   1         the pack savages an intruder standing in the camp (-0 hp)
 *   777       clean
 *   3         v132.26 relief: a band MID-CAPTURE is not relieved (found on a wider sweep)
 *
 * AND WHY IT IS NOT THE ROTATION. Measured, not assumed. A probe over every building within a
 * 120x80 box around the charge lane finds exactly ONE in both variants — the red shack the bench
 * puts there itself. Nothing was blocking anybody. What differed was the live bodies: with the
 * rotation in, this seed's drifted campaign parks four red halberdiers and two musketeers at
 * (-71..-75, -93), on top of the charge start at (-64..-58, -96). The chargers engage them —
 * engageNearest at 16, which is what an ATTACK-move is for — and chase them 78 units past the mark
 * to the enemy base, holding chargeTo the whole way. Frame by frame:
 *
 *   rot 0    t0 -64,-96   t100 -40,-97   t200 -32,-94   t300 -6,-92   t400 20,-91   [holds, shack dead at 202]
 *   rotated  t0 -64,-96   t100 -58,-98   t200 -42,-101  t300 -16,-98  t400 11,-98 … t800 103,-102
 *
 * The bench never staged the emptiness it depends on. It has been paid for once already — v134.5
 * had to freeze D.nextThink here because the new want-list started dealing these three into bands
 * mid-charge — and this is the same lesson one layer out: the war room was frozen, the war was not.
 * The creep bench is the same shape: it calls campNewWave on the FIRST camp and then sends an
 * intruder into the NORTH one, which on seed 1 the drifted campaign had wiped, so "the pack
 * savages an intruder" measured an empty pocket and read -0 hp.
 *
 * The buff bench is the third of the shape and the plainest: hostAct's buff branch begins with
 * nearestBuilt(team,"blacksmith", …, bSurf+4.6) — "Stand at the Blacksmith to trade XP for steel"
 * — and the bench stood its chooser at a hardcoded (-118,60) and trusted the campaign to have put
 * a forge there. On seed 42 under the v134.8 economy it had not, so a bench about VALIDATION
 * reported that a legal pick was refused.
 *
 * None of these claims is about the campaign. "A charge razes what is in its path and holds the far
 * ground", "a creep pack mauls an intruder", "the host grants an offered pick and denies a bogus
 * one" are statements about the charge, the pack and hostAct, so all three benches now stage what
 * they assert: the charge SCOUTS a clear corridor the way the mill-layout bench already scouts
 * clear ground for its ring, the pack gets a fresh wave the way the wave-size check already does,
 * and the chooser stands at a forge that is known to be there. Nothing is weakened — the charge
 * still has to raze and still has to hold 2 of 3 within 16, the pack still has to take 100 hp off,
 * the bogus pick still has to be denied — and the scout REPORTS the lane it found, so a bench that
 * quietly stopped finding clear ground is visible rather than silently passing somewhere easier.
 */
const fs=require("fs"),path=require("path");
const R=path.join(__dirname,"..");
const S=path.join(R,"tools","smoketest.js");
let s=fs.readFileSync(S,"utf8");
let failed=[];
const sub=(name,from,to)=>{
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
};

// ---------------------------------------------------------------------------
// 1. THE CHARGE SCOUTS ITS LANE.
// ---------------------------------------------------------------------------
sub("the charge lane is scouted",
`  const pl=units.find(u=>u.isPlayer);
  const ox=pl.root.position.x,oz=pl.root.position.z;
  pl.alive=true; pl.root.position.set(-60,0,-90); // open southern ground
  check("F with no rally raises no army (orderCharge refuses)",G.orderCharge(pl,-Math.PI/2)===0||units.every(v=>!v.rally));
  const troop=[];
  for(let i=0;i<3;i++){const s=G.makeUnit(0,"clubman",-64+i*3,-96,{name:"Charger"+i,bot:{role:"citizen"}});
    s.rally=true; s.spread=(i-1)*3; s.hp=s.maxHp=5000; troop.push(s);} // hardy: stray armies must not decide this test
  const shack=G.makeBuilding(1,"house",-25,-90,true); // a red shack squats in the charge lane`,
`  const pl=units.find(u=>u.isPlayer);
  const ox=pl.root.position.x,oz=pl.root.position.z;
  // v134.8 SCOUT THE LANE, DO NOT ASSUME IT. This was a hardcoded (-60,-90) "open southern
  // ground", and it was open on the seeds anyone happened to run. A charge is an ATTACK-move:
  // engageNearest(16) is checked before the mark, so one enemy patrol standing near the start
  // drags all three chargers away and the bench reports that a charge does not raze or hold —
  // which is a statement about the neighbourhood, not about the charge. Measured on the v134.8
  // campaign, seed 0x5E1F: six red soldiers at (-71..-75,-93) against a start of (-64..-58,-96),
  // and the line chased them 78 units past its own mark. Clearance is generous because the
  // corridor is 85 long and the world keeps moving for 23 sim-seconds after the scout runs.
  const CLEAR_MIN=26, CD=G.CHARGE_DIST;
  const segD=(px,pz,ax,az,bx,bz)=>{ // point to segment, the only geometry this needs
    const vx=bx-ax,vz=bz-az, L2=vx*vx+vz*vz||1;
    let t=((px-ax)*vx+(pz-az)*vz)/L2; t=t<0?0:(t>1?1:t);
    return Math.hypot(px-(ax+vx*t),pz-(az+vz*t));
  };
  // The EMPTIEST corridor on the map, not the first one over a threshold — so the bench degrades by
  // reporting a number instead of by falling off a cliff, and so a busier world (v134.8 put the
  // enemy marshal on NORMAL, which fields a bigger army) moves the lane rather than losing it.
  let lane=null;
  for(let lz=-135;lz<=135;lz+=15)for(let lx=-190;lx<=110;lx+=20){
    const ax=lx-8, bx=lx+CD+8;
    if(Math.abs(bx)>G.MAP.x-12||Math.abs(ax)>G.MAP.x-12)continue;
    let ground=true;
    for(let k=0;k<=20&&ground;k++)if(!G.walkable(ax+(bx-ax)*k/20,lz))ground=false; // …and it is ground
    if(!ground)continue;
    let m=1e9;
    for(const u of units){ if(!u.alive||u.isPlayer)continue;
      m=Math.min(m,segD(u.root.position.x,u.root.position.z,ax,lz,bx,lz)); if(m<=0)break; }
    if(m>0)for(const b of buildings){ if(!b.alive)continue;
      m=Math.min(m,segD(b.x,b.z,ax,lz,bx,lz)-G.bSurf(b.def)); if(m<=0)break; }
    if(m>0)for(const C of G.CREEP_SITES) m=Math.min(m,segD(C.x,C.z,ax,lz,bx,lz)-C.r);
    if(!lane||m>lane.m)lane={x:lx,z:lz,m};
  }
  if(!lane)lane={x:-60,z:-90,m:-1}; // the old fixed lane, and the check below says so
  check("the charge bench fights on the emptiest corridor on the map ("+lane.x+","+lane.z+
    ", nearest anything "+lane.m.toFixed(1)+" against a floor of "+CLEAR_MIN+")",lane.m>=CLEAR_MIN);
  const LX=lane.x, LZ=lane.z;
  pl.alive=true; pl.root.position.set(LX,0,LZ);
  check("F with no rally raises no army (orderCharge refuses)",G.orderCharge(pl,-Math.PI/2)===0||units.every(v=>!v.rally));
  const troop=[];
  for(let i=0;i<3;i++){const s=G.makeUnit(0,"clubman",LX-4+i*3,LZ-6,{name:"Charger"+i,bot:{role:"citizen"}});
    s.rally=true; s.spread=(i-1)*3; s.hp=s.maxHp=5000; troop.push(s);} // hardy: stray armies must not decide this test
  const shack=G.makeBuilding(1,"house",LX+35,LZ,true); // a red shack squats in the charge lane`);

// ---------------------------------------------------------------------------
// 2. …and every hardcoded coordinate downstream of it moves with the lane.
// ---------------------------------------------------------------------------
sub("the mark moves with the lane",
`  const n=G.orderCharge(pl,-Math.PI/2); // gaze due EAST: fx=-sin(-π/2)=1
  check("the horn sounds: "+n+" rallied soldiers take a charge order east",
    n>=3&&troop.every(v=>v.chargeTo&&Math.abs(v.chargeTo.x-25)<1&&Math.abs(v.chargeTo.z+90)<1));`,
`  const n=G.orderCharge(pl,-Math.PI/2); // gaze due EAST: fx=-sin(-π/2)=1
  const MX=LX+CD, MZ=LZ; // the mark: CHARGE_DIST down the gaze, and the scout proved it walkable
  check("the horn sounds: "+n+" rallied soldiers take a charge order east ("+MX.toFixed(0)+","+
    MZ.toFixed(0)+")",
    n>=3&&troop.every(v=>v.chargeTo&&Math.abs(v.chargeTo.x-MX)<1&&Math.abs(v.chargeTo.z-MZ)<1));`);

sub("the far ground moves with the lane",
`  const held=troop.filter(v=>v.alive&&Math.hypot(v.root.position.x-25,v.root.position.z+90)<16).length;`,
`  const held=troop.filter(v=>v.alive&&Math.hypot(v.root.position.x-MX,v.root.position.z-MZ)<16).length;`);

// ---------------------------------------------------------------------------
// 3. THE PACK THE INTRUDER WALKS INTO IS A PACK.
// ---------------------------------------------------------------------------
sub("the north camp musters before the intruder arrives",
`  const north=CS.find(s=>s.x===0&&s.z>0);
  const intruder=G.makeUnit(0,"clubman",0,MAPh.z-2,{name:"Intruder",bot:{role:"citizen"}});`,
`  const north=CS.find(s=>s.x===0&&s.z>0);
  // v134.8: MUSTER IT FIRST. The wave-size check three lines up calls campNewWave on the FIRST
  // camp and this test walks into the NORTH one, which a passing army is free to have wiped —
  // \`waiting\` with an empty pack — twenty minutes of campaign earlier. On SMOKE_SEED=1 under the
  // v134.8 economy it had been, and "the pack savages an intruder" measured an empty pocket and
  // reported -0 hp. The claim is about the pack, so the pack is staged.
  G.campNewWave(north);
  const intruder=G.makeUnit(0,"clubman",0,MAPh.z-2,{name:"Intruder",bot:{role:"citizen"}});`);

// ---------------------------------------------------------------------------
// 4. THE CHOOSER STANDS AT A FORGE.
// ---------------------------------------------------------------------------
sub("the buff chooser stands at a real forge",
`{const bu=global.__G.makeUnit(0,"clubman",-118,60,{name:"Chooser",bot:null}); bu.remote="smith-peer";`,
`// v134.8: AT the forge, wherever the campaign put it. hostAct's buff branch refuses any pick from
// a body that is not within bSurf(blacksmith)+4.6 of a BUILT blacksmith — "Stand at the Blacksmith
// to trade XP for steel" — and this bench stood its chooser on a hardcoded (-118,60) and hoped.
// On SMOKE_SEED=42 with the v134.8 economy blue's forge was not there, and a bench about
// VALIDATION reported that a legal pick had been refused. If the town has no forge at all, stage
// one and take it away again.
{const _G=global.__G;
 const _forge=_G.buildings.find(b=>b.alive&&b.built&&b.team===0&&b.type==="blacksmith")||null;
 const _tmp=_forge?null:_G.makeBuilding(0,"blacksmith",-118,60,true);
 const _fg=_forge||_tmp;
 const bu=_G.makeUnit(0,"clubman",_fg.x+_G.bSurf(_G.BLD.blacksmith)+2,_fg.z,{name:"Chooser",bot:null}); bu.remote="smith-peer";`);

sub("the staged forge is retired",
`   denied&&global.__G.buffSt(bu,off[1])===1&&bu.xp===1);
 bu.alive=false;}`,
`   denied&&global.__G.buffSt(bu,off[1])===1&&bu.xp===1);
 bu.alive=false; if(_tmp)_tmp.alive=false;}`);

// ---------------------------------------------------------------------------
// 5. THE BAND MID-CAPTURE IS POSTED TO A SQUARE IT IS ACTUALLY TAKING.
// ---------------------------------------------------------------------------
sub("every square is up for grabs while the relief rule is tested",
`      const _bzOwn=G2.neutralMarkets.map(m=>m.owner);
      if(!G2.neutralMarkets.some(m=>m.owner!==team)&&G2.neutralMarkets.length)
        G2.neutralMarkets[0].owner=1-team;`,
`      const _bzOwn=G2.neutralMarkets.map(m=>m.owner);
      // v134.8: EVERY square unheld, not merely one of them. The exemption under test is
      // \`_taking\`, and _taking is false on a square the team ALREADY OWNS however far along its
      // capture bar is — an owned square is covered by the separate v134.5 _guard rule instead,
      // which only pins ONE band. bandHoldPoint has dealt owned squares into the pool since
      // v134.5 (want.concat(mine)), so which square this band drew depended on how many hold
      // bands the campaign happened to have: on SMOKE_SEED=3 it drew one blue already held, was
      // relieved into a camp mission, and a gate about capture reported on the deal. Making the
      // whole board contested is the staging the sentence describes.
      for(const m of G2.neutralMarkets)m.owner=1-team;`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(S,s);
console.log("patch-smoketest-ambient-v134: OK");
