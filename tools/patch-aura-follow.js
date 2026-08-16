#!/usr/bin/env node
/* v132.50 — THE AURA FOLLOWS THE BODY, AND THE CAP IS A DIFFERENT SHAPE.
   John, playtesting v132.49:
     "The player level aura still 'lingers' too long. It leaves a glowing trail behind me long
      after I've left an area. It should not leave a trail as such. The emphasis on the aura also
      does not change much from lvl 1 to 25 and needs to be more significant."
   Two faults, and only one of them was a number.
   1) THE TRAIL IS STRUCTURAL. auraEmit took a world POSITION; the mote then belonged to the
      world. A moving player therefore PAINTS A LINE by construction, and v132.47's fix (life
      1.45s -> 0.55s) could only make the line shorter, never absent. Motes now store an OFFSET
      from their owner plus the owner itself, and the world position is rebuilt from the owner
      every frame. Trail length at any walking speed: zero.
   2) THE EMPHASIS IS A SHAPE PROBLEM. Level 1 and level 25 differed in density and hue and in
      NOTHING ELSE - same radius, same climb, same life. The cap was a busier small puff. Radius,
      climb and life now ride the same superlinear curve as the rate.
   Because (1) removes the smear, (2) is free to make the life LONGER again at the cap.
*/
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
const rd=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const wr=(f,s)=>fs.writeFileSync(path.join(ROOT,f),s);
let edits=0;
function sub(file,find,repl,label){
  const src=rd(file);
  const n=src.split(find).length-1;
  if(n!==1){console.error('ABORT ['+label+'] matched '+n+' times, expected 1');process.exit(1);}
  wr(file,src.replace(find,repl)); edits++;
  console.log('  ok  '+label);
}

/* ---------- 1. the dials ---------- */
sub('js/00-data.js',
`      AURA_RATE_LO=2.6,    // motes/sec at level 1
      AURA_RATE_HI=34.0,   // motes/sec at the cap`,
`      // v132.50 (John, playtesting again): "It leaves a glowing trail behind me long after I've
      // left an area... The emphasis on the aura also does not change much from lvl 1 to 25."
      // THE TRAIL was structural, not a duration: a mote was emitted at a world POSITION, so a
      // walking player painted a line BY CONSTRUCTION and v132.47's shorter life could only
      // shorten the line. Motes now carry an offset from their owner and are re-anchored to it
      // every frame (05-combat.js auraTick), so the cloud travels WITH the body. That is what
      // frees the life to grow again below - a long-lived mote is only a smear if it is left.
      // THE EMPHASIS was a shape problem: level 1 and the cap differed in DENSITY and HUE alone,
      // same radius, same climb, same life, so the cap was a busier version of the same puff.
      // All four dials now ride one superlinear curve.
      AURA_RATE_LO=1.4,    // motes/sec at level 1 (was 2.6 - start sparser so the climb reads)
      AURA_RATE_HI=54.0,   // motes/sec at the cap (was 34.0)
      AURA_CURVE=1.35,     // superlinear: the low levels stay quiet and the last third earns the
                           // spectacle. t^1.35 puts level 13 at 0.40 of the ramp, not 0.52.
      AURA_R_LO=0.34,      // emission radius, level 1 -> cap   (was a flat 0.78)
      AURA_R_HI=1.15,
      AURA_RISE_LO=0.75,   // units/sec climbed, level 1 -> cap (was a flat 0.90)
      AURA_RISE_HI=2.40,
      AURA_LIFE_LO=0.40,   // seconds a mote lives, level 1 -> cap (was a flat 0.55). The cap is
      AURA_LIFE_HI=1.05,   // safe ONLY because motes now follow the body - see above.`,
'00-data: level-scaled dials + AURA_CURVE');

sub('js/00-data.js',
`      AURA_LIFE=0.55,      // seconds a mote lives (was 1.45)
      AURA_RISE=0.90,      // units/sec it climbs (was 1.55) — half a unit travelled, not 2.2
      AURA_R=0.78,         // emission radius around the unit
`,
``,
'00-data: retire the three flat constants');

/* ---------- 2. the pool gains an owner and an offset ---------- */
sub('js/05-combat.js',
`let _auraLife=null,_auraVel=null,_auraNext=0,_auraLive=0,_auraBase=null;`,
`let _auraLife=null,_auraVel=null,_auraNext=0,_auraLive=0,_auraBase=null;
let _auraOff=null,_auraOwn=null,_auraL0=null;   // v132.50: offset-from-owner, owner, birth-life`,
'05-combat: pool declarations');

sub('js/05-combat.js',
`  _auraPos=new Float32Array(AURA_MAX*3);
  _auraCol=new Float32Array(AURA_MAX*3);`,
`  _auraPos=new Float32Array(AURA_MAX*3);
  _auraOff=new Float32Array(AURA_MAX*3);    // v132.50: position RELATIVE to the owner
  _auraOwn=new Array(AURA_MAX).fill(null);  // ...and which unit that is
  _auraL0 =new Float32Array(AURA_MAX);      // birth-life; the fade curve needs it now that life
                                            // varies per mote with the owner's level
  _auraCol=new Float32Array(AURA_MAX*3);`,
'05-combat: auraInit allocates the offset arrays');

/* ---------- 3. emit takes the UNIT, not a position ---------- */
sub('js/05-combat.js',
`function auraEmit(x,y,z,r,g,b){
  auraInit();
  // claim the next slot round-robin. A full pool overwrites the OLDEST mote, which is the one
  // closest to fading anyway — so the ceiling degrades gracefully instead of dropping new work.
  const i=_auraNext; _auraNext=(_auraNext+1)%AURA_MAX;
  if(_auraLife[i]<=0)_auraLive++;
  const a=Math.random()*Math.PI*2, rr=Math.sqrt(Math.random())*AURA_R;
  _auraPos[i*3]=x+Math.cos(a)*rr; _auraPos[i*3+1]=y+Math.random()*0.5; _auraPos[i*3+2]=z+Math.sin(a)*rr;
  _auraVel[i*3]=(Math.random()-0.5)*0.35;
  _auraVel[i*3+1]=AURA_RISE*(0.75+Math.random()*0.5);
  _auraVel[i*3+2]=(Math.random()-0.5)*0.35;
  _auraBase[i*3]=r; _auraBase[i*3+1]=g; _auraBase[i*3+2]=b;
  _auraCol[i*3]=r; _auraCol[i*3+1]=g; _auraCol[i*3+2]=b;
  _auraLife[i]=AURA_LIFE;
}`,
`function auraEmit(u,yOff,rad,rise,life,r,g,b){
  auraInit();
  // claim the next slot round-robin. A full pool overwrites the OLDEST mote, which is the one
  // closest to fading anyway — so the ceiling degrades gracefully instead of dropping new work.
  const i=_auraNext; _auraNext=(_auraNext+1)%AURA_MAX;
  if(_auraLife[i]<=0)_auraLive++;
  const a=Math.random()*Math.PI*2, rr=Math.sqrt(Math.random())*rad;
  // v132.50: the mote is born as an OFFSET. It never learns a world position of its own; the
  // world position below is a derived value, recomputed from the owner on every single frame.
  _auraOwn[i]=u;
  _auraOff[i*3]=Math.cos(a)*rr;
  _auraOff[i*3+1]=yOff+Math.random()*0.5;
  _auraOff[i*3+2]=Math.sin(a)*rr;
  _auraPos[i*3]  =u.root.position.x+_auraOff[i*3];
  _auraPos[i*3+1]=u.root.position.y+_auraOff[i*3+1];
  _auraPos[i*3+2]=u.root.position.z+_auraOff[i*3+2];
  _auraVel[i*3]=(Math.random()-0.5)*0.35;
  _auraVel[i*3+1]=rise*(0.75+Math.random()*0.5);
  _auraVel[i*3+2]=(Math.random()-0.5)*0.35;
  _auraBase[i*3]=r; _auraBase[i*3+1]=g; _auraBase[i*3+2]=b;
  _auraCol[i*3]=r; _auraCol[i*3+1]=g; _auraCol[i*3+2]=b;
  _auraLife[i]=life; _auraL0[i]=life;
}`,
'05-combat: auraEmit(u, yOff, rad, rise, life, rgb)');

/* ---------- 4. the advance loop re-anchors to the owner ---------- */
sub('js/05-combat.js',
`      if(_auraLife[i]<=0){ _auraCol[i*3]=0;_auraCol[i*3+1]=0;_auraCol[i*3+2]=0; _auraLive--; continue; }
      _auraPos[i*3]+=_auraVel[i*3]*dt;
      _auraPos[i*3+1]+=_auraVel[i*3+1]*dt;
      _auraPos[i*3+2]+=_auraVel[i*3+2]*dt;`,
`      if(_auraLife[i]<=0){ _auraCol[i*3]=0;_auraCol[i*3+1]=0;_auraCol[i*3+2]=0;
        _auraOwn[i]=null; _auraLive--; continue; }
      // v132.50 THE DRIFT PLAYS OUT IN THE OFFSET and the world position is REBUILT from the
      // owner every frame. This IS the no-trail fix: however fast the body moves the cloud
      // arrives with it, because the cloud has no world position of its own to be left behind at.
      _auraOff[i*3]+=_auraVel[i*3]*dt;
      _auraOff[i*3+1]+=_auraVel[i*3+1]*dt;
      _auraOff[i*3+2]+=_auraVel[i*3+2]*dt;
      const own=_auraOwn[i];
      if(own&&own.alive&&own.root){
        _auraPos[i*3]  =own.root.position.x+_auraOff[i*3];
        _auraPos[i*3+1]=own.root.position.y+_auraOff[i*3+1];
        _auraPos[i*3+2]=own.root.position.z+_auraOff[i*3+2];
      }else{
        // the owner died mid-flight. Let the last motes finish where they are rather than snap
        // to the origin — and a corpse does not walk, so nothing here can smear.
        _auraOwn[i]=null;
        _auraPos[i*3]+=_auraVel[i*3]*dt;
        _auraPos[i*3+1]+=_auraVel[i*3+1]*dt;
        _auraPos[i*3+2]+=_auraVel[i*3+2]*dt;
      }`,
'05-combat: auraTick re-anchors every mote to its owner');

sub('js/05-combat.js',
`      const f=Math.pow(_auraLife[i]/AURA_LIFE,0.55);`,
`      const f=Math.pow(_auraLife[i]/(_auraL0[i]||1),0.55);   // v132.50: life is per-mote now`,
'05-combat: fade against the mote own birth-life');

/* ---------- 5. one curve drives all four dials ---------- */
sub('js/05-combat.js',
`    const rate=(AURA_RATE_LO+(AURA_RATE_HI-AURA_RATE_LO)*t)*near;
    u._auraAcc=(u._auraAcc||0)+rate*dt;
    let n=Math.floor(u._auraAcc); if(n<=0)continue;
    if(n>6)n=6;                            // one unit cannot monopolise the pool in a long frame
    u._auraAcc-=n;
    for(let k=0;k<n;k++)
      auraEmit(u.root.position.x,u.root.position.y+0.35,u.root.position.z,_auraRGB[0],_auraRGB[1],_auraRGB[2]);`,
`    // v132.50: ONE superlinear curve drives rate, radius, climb and life together, so the cap is
    // a different SHAPE and not merely a busier one. John: "the emphasis does not change much
    // from lvl 1 to 25". Level 1 is a few sparks at the ankles; the cap is a waist-wide column
    // standing two and a half units tall.
    const tc2=Math.pow(t,AURA_CURVE);
    const rate=(AURA_RATE_LO+(AURA_RATE_HI-AURA_RATE_LO)*tc2)*near;
    const rad =AURA_R_LO   +(AURA_R_HI   -AURA_R_LO)   *tc2;
    const rise=AURA_RISE_LO+(AURA_RISE_HI-AURA_RISE_LO)*tc2;
    const life=AURA_LIFE_LO+(AURA_LIFE_HI-AURA_LIFE_LO)*tc2;
    u._auraAcc=(u._auraAcc||0)+rate*dt;
    let n=Math.floor(u._auraAcc); if(n<=0)continue;
    if(n>6)n=6;                            // one unit cannot monopolise the pool in a long frame
    u._auraAcc-=n;
    for(let k=0;k<n;k++)
      auraEmit(u,0.35,rad,rise,life,_auraRGB[0],_auraRGB[1],_auraRGB[2]);`,
'05-combat: rate/radius/climb/life all ride AURA_CURVE');

/* ---------- 6. instruments: what the cloud is ACTUALLY doing ---------- */
sub('js/05-combat.js',
`function auraStats(){return{live:_auraLive,max:AURA_MAX,built:!!_auraPts,
  geo:_auraGeo,mat:_auraMat,pts:_auraPts};}`,
`// v132.50 instruments. auraSpread is the trail measurement and it is deliberately HORIZONTAL:
// the vertical column is the effect John wants, the horizontal smear is the bug he reported.
function auraSpread(){
  if(!_auraPts)return 0;
  let worst=0;
  for(let i=0;i<AURA_MAX;i++){
    if(_auraLife[i]<=0)continue;
    const own=_auraOwn[i]; if(!own||!own.alive||!own.root)continue;
    const d=Math.hypot(_auraPos[i*3]-own.root.position.x,_auraPos[i*3+2]-own.root.position.z);
    if(d>worst)worst=d;
  }
  return worst;
}
function auraShape(u){ // the cloud this one unit is wearing: how many motes, how wide, how tall
  if(!_auraPts)return{n:0,rad:0,top:0};
  let n=0,rad=0,top=0;
  for(let i=0;i<AURA_MAX;i++){
    if(_auraLife[i]<=0||_auraOwn[i]!==u)continue;
    n++;
    const d=Math.hypot(_auraPos[i*3]-u.root.position.x,_auraPos[i*3+2]-u.root.position.z);
    if(d>rad)rad=d;
    const h=_auraPos[i*3+1]-u.root.position.y; if(h>top)top=h;
  }
  return{n:n,rad:rad,top:top};
}
function auraStats(){return{live:_auraLive,max:AURA_MAX,built:!!_auraPts,
  geo:_auraGeo,mat:_auraMat,pts:_auraPts,spread:auraSpread()};}`,
'05-combat: auraSpread + auraShape');

/* ---------- 7. expose the instruments to the harness ---------- */
sub('tools/smoketest.js',
`auraTick,auraStats,auraTint,AURA_MAX,AURA_NEAR,AURA_FAR,`,
`auraTick,auraStats,auraTint,auraSpread,auraShape,AURA_MAX,AURA_NEAR,AURA_FAR,AURA_CURVE,AURA_RATE_LO,AURA_RATE_HI,AURA_R_LO,AURA_R_HI,AURA_RISE_LO,AURA_RISE_HI,AURA_LIFE_LO,AURA_LIFE_HI,`,
'smoketest: export the new instruments');

console.log('v132.50 aura-follow: '+edits+' edits applied');
