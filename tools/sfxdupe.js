#!/usr/bin/env node
/* sfxdupe.js — is any sound in the bank the same sound as another one?
 *
 * ── WHY FILENAMES ARE NOT AN ANSWER ─────────────────────────────────────────────────────────
 * John's rule is "avoid sound reuse". The smoketest gate for it compares KEYS: twelve procs, twelve
 * distinct keys, none shared with an existing play site. That catches the obvious mistake and
 * misses the real one — two DIFFERENT keys pointing at the same audio, or at two files from the
 * same take that are indistinguishable in play. A player does not hear a key. They hear a
 * waveform, and if the crit and the parry are the same 600ms of metal, the game reuses a sound no
 * matter what the two variables are called.
 *   This measures the audio. It decodes every entry in SND_DATA and compares all 11,325 pairs.
 *
 * ── THE FINGERPRINT ─────────────────────────────────────────────────────────────────────────
 * Two halves, because either alone has a blind spot:
 *   ENVELOPE (64 bins) — RMS over 64 equal slices of the trimmed signal, peak-normalised. Catches
 *     "same shape": same attack, same decay, same rhythm of hits. Blind to pitch — a sound and the
 *     same sound an octave down score ~1.0.
 *   SPECTRUM (16 bands) — mean magnitude in 16 log-spaced bands from a 1024-point FFT, normalised.
 *     Catches "same colour". Blind to timing — a rising sweep and a falling sweep score ~1.0.
 * The score is the mean of the two cosines, so a pair must be alike in BOTH shape and colour to
 * rank high. Duration is a third gate: two sounds more than 25% apart in length are not the same
 * cue whatever the vectors say, and comparing them at all invites a false alarm.
 *
 * ⚠ THIS IS A SCREEN, NOT A PROOF. A high score means "listen to these two"; it does not by itself
 * mean reuse. Deliberate variant families — swing1..4, hit1..4, the vocal pools — SHOULD score
 * high, because they are the same sound recorded four times, and the game picks between them at
 * random on purpose. Those are reported separately and excluded from the verdict: a variant group
 * is the opposite of reuse.
 *
 * ── --freeze: HOW THIS BECOMES A SMOKETEST GATE ─────────────────────────────────────────────
 * Decoding 155 OGGs and comparing 11,935 pairs takes far too long to run inside the smoketest on
 * every change. So the expensive measurement lives here and writes tools/sfx-screen.json, and the
 * smoketest asserts two cheap things about that file:
 *     · it covers exactly the keys in audio-data.js, with matching content hashes — i.e. the
 *       screen was run against THIS audio, not some earlier bank. Change one sound without
 *       re-screening and the gate goes red rather than quietly vouching for the old waveform.
 *     · no pair scored above the threshold except the ones explicitly allowed below.
 *
 * ── THE ALLOWLIST IS AN ARGUMENT, NOT AN EXEMPTION ──────────────────────────────────────────
 * The vocal pairs that survive the screen are one actor's death cry against the same actor's
 * INTENSE death cry, and his shout. They measure alike because a man screaming twice sounds alike.
 * The game already chooses between them by damage grade, and a player will never A/B them. That
 * is variation within a performance, which is the opposite of two unrelated events sharing one
 * recording — and it is the thing the plain threshold cannot tell apart, so a human decides it
 * once, in writing, here.
 *
 * Usage:  node tools/sfxdupe.js                    screen the embedded bank
 *         node tools/sfxdupe.js --freeze           …and write tools/sfx-screen.json
 *         node tools/sfxdupe.js a.wav b.wav ...    also fingerprint loose files against the bank
 *         THRESH=0.93 node tools/sfxdupe.js        loosen or tighten the screen (default 0.95)
 */
const fs=require("fs"),path=require("path"),cp=require("child_process"),os=require("os");
const ROOT=path.join(__dirname,"..");
const THRESH=parseFloat(process.env.THRESH||"0.95");
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),"sfxdupe-"));
const SR=8000, NBIN=64, NBAND=16, NFFT=1024;

// ---- a small radix-2 FFT (magnitudes only) ----
function fftMag(re){
  const n=re.length, im=new Float64Array(n);
  for(let i=1,j=0;i<n;i++){let b=n>>1;for(;j&b;b>>=1)j^=b;j^=b;
    if(i<j){const t=re[i];re[i]=re[j];re[j]=t;}}
  for(let len=2;len<=n;len<<=1){
    const ang=-2*Math.PI/len, wr=Math.cos(ang), wi=Math.sin(ang);
    for(let i=0;i<n;i+=len){
      let cr=1,ci=0;
      for(let k=0;k<len/2;k++){
        const ur=re[i+k],ui=im[i+k];
        const vr=re[i+k+len/2]*cr-im[i+k+len/2]*ci, vi=re[i+k+len/2]*ci+im[i+k+len/2]*cr;
        re[i+k]=ur+vr; im[i+k]=ui+vi; re[i+k+len/2]=ur-vr; im[i+k+len/2]=ui-vi;
        const nr=cr*wr-ci*wi; ci=cr*wi+ci*wr; cr=nr;
      }
    }
  }
  const m=new Float64Array(n/2);
  for(let i=0;i<n/2;i++)m[i]=Math.hypot(re[i],im[i]);
  return m;
}
function norm(v){let s=0;for(const x of v)s+=x*x;s=Math.sqrt(s)||1;return v.map(x=>x/s);}
function cos(a,b){let d=0;for(let i=0;i<a.length;i++)d+=a[i]*b[i];return d;}

function pcmOf(file){ // → Float32Array mono @ SR
  const out=path.join(TMP,"x.raw");
  cp.execSync(`ffmpeg -loglevel error -y -i ${JSON.stringify(file)} -ac 1 -ar ${SR} -f f32le ${JSON.stringify(out)}`);
  const b=fs.readFileSync(out);
  return new Float32Array(b.buffer,b.byteOffset,b.length/4);
}
function print(pcm){
  // trim leading/trailing silence at −50 dBFS so padding cannot dominate the envelope
  let peak=0; for(const x of pcm)peak=Math.max(peak,Math.abs(x));
  const gate=peak*0.0032;
  let a=0,b=pcm.length-1;
  while(a<b&&Math.abs(pcm[a])<gate)a++;
  while(b>a&&Math.abs(pcm[b])<gate)b--;
  const n=Math.max(1,b-a+1), sec=n/SR;
  const env=new Float64Array(NBIN);
  for(let i=0;i<NBIN;i++){
    const s=a+Math.floor(n*i/NBIN), e=a+Math.floor(n*(i+1)/NBIN);
    let acc=0,c=0; for(let k=s;k<e;k++){acc+=pcm[k]*pcm[k];c++;}
    env[i]=Math.sqrt(acc/(c||1));
  }
  // spectrum: average the magnitude of overlapping 1024-pt Hann frames, then fold to 16 log bands
  const spec=new Float64Array(NFFT/2); let frames=0;
  for(let s=a;s+NFFT<=b;s+=NFFT/2){
    const buf=new Float64Array(NFFT);
    for(let i=0;i<NFFT;i++)buf[i]=pcm[s+i]*(0.5-0.5*Math.cos(2*Math.PI*i/(NFFT-1)));
    const m=fftMag(buf); for(let i=0;i<m.length;i++)spec[i]+=m[i]; frames++;
  }
  if(!frames){const buf=new Float64Array(NFFT);
    for(let i=0;i<Math.min(NFFT,n);i++)buf[i]=pcm[a+i];
    const m=fftMag(buf); for(let i=0;i<m.length;i++)spec[i]=m[i]; frames=1;}
  const band=new Float64Array(NBAND);
  for(let i=0;i<NBAND;i++){
    const lo=Math.floor(Math.pow(spec.length,i/NBAND)), hi=Math.max(lo+1,Math.floor(Math.pow(spec.length,(i+1)/NBAND)));
    let acc=0,c=0; for(let k=lo;k<hi&&k<spec.length;k++){acc+=spec[k]/frames;c++;}
    band[i]=acc/(c||1);
  }
  return {env:norm(Array.from(env)),spec:norm(Array.from(band)),sec};
}
function score(A,B){
  const r=A.sec>B.sec?B.sec/A.sec:A.sec/B.sec;
  if(r<0.75)return {s:0,dur:r};                       // too different in length to be the same cue
  return {s:0.5*cos(A.env,B.env)+0.5*cos(A.spec,B.spec),dur:r};
}
// a deliberate variant family: keys that differ only by a trailing digit (swing1..4, vpain_b1..2)
const fam=(k)=>k.replace(/[0-9]+$/,"");

// ---- fingerprint the embedded bank ----
const src=fs.readFileSync(path.join(ROOT,"js","audio-data.js"),"utf8");
const keys=[...src.matchAll(/"([A-Za-z0-9_]+)":"([A-Za-z0-9+/=]*)"/g)];
console.log("decoding "+keys.length+" embedded sounds…");
const P={};
for(const [,k,b64] of keys){
  const f=path.join(TMP,k+".ogg");
  fs.writeFileSync(f,Buffer.from(b64,"base64"));
  try{P[k]=print(pcmOf(f));}catch(e){console.error("  decode failed:",k,e.message);}
}
const names=Object.keys(P);
let sameFam=0, hits=[];
for(let i=0;i<names.length;i++)for(let j=i+1;j<names.length;j++){
  const a=names[i],b=names[j];
  const {s,dur}=score(P[a],P[b]);
  if(s<THRESH)continue;
  if(fam(a)===fam(b)){sameFam++;continue;}            // a variant pool — the point of it is to differ slightly
  hits.push({a,b,s,dur});
}
hits.sort((x,y)=>y.s-x.s);
console.log("\npairs above "+THRESH+", EXCLUDING deliberate variant families:");
if(!hits.length)console.log("  (none) — no two distinct cues in the bank measure as the same sound");
for(const h of hits)console.log("  "+h.s.toFixed(3)+"  "+h.a.padEnd(14)+h.b.padEnd(14)+
  "(len "+P[h.a].sec.toFixed(2)+"s / "+P[h.b].sec.toFixed(2)+"s)");
console.log("\n"+sameFam+" high-scoring pairs suppressed as variant families (swing1..4 and friends)");

// ---- --freeze: write the manifest the smoketest checks ----
// One voice actor's death cry vs his INTENSE death cry vs his shout. The game picks between them
// by damage grade and a player never hears them side by side. Variation within one performance is
// not two events sharing a recording, and the threshold alone cannot tell those apart.
const ALLOWED=[["vdeath_c2","vdeathi_c1"],["vdeath_d2","vdeathi_d1"],["vdeath_c1","vdeathi_c1"],
               ["vdeath_d2","vshout_d1"],["vdeath_c2","vdeath_d2"],["vdeath_d1","vdeathi_d1"],
               ["vdeath_b2","vshout_b2"],["vdeath_d2","vshout_d2"],["vdeath_d1","vshout_d1"]];
const pk=(a,b)=>[a,b].sort().join("|");
const ALLOWSET=new Set(ALLOWED.map(([a,b])=>pk(a,b)));
if(process.argv.includes("--freeze")){
  const crypto=require("crypto");
  const hashes={};
  for(const [,k,b64] of keys)hashes[k]=crypto.createHash("sha256").update(b64).digest("hex").slice(0,16);
  const over=hits.filter(h=>!ALLOWSET.has(pk(h.a,h.b))).map(h=>({a:h.a,b:h.b,s:+h.s.toFixed(4)}));
  const man={threshold:THRESH,
    note:"Written by tools/sfxdupe.js --freeze. The smoketest asserts this covers the CURRENT "+
         "audio-data.js key-for-key and hash-for-hash, so changing a sound without re-screening "+
         "goes red instead of inheriting an old verdict.",
    keys:hashes,
    allowed:ALLOWED.map(([a,b])=>pk(a,b)),
    over};
  fs.writeFileSync(path.join(__dirname,"sfx-screen.json"),JSON.stringify(man,null,1));
  console.log("\nfroze tools/sfx-screen.json — "+Object.keys(hashes).length+" keys, "+
    ALLOWED.length+" allowed pairs, "+over.length+" unexplained pair"+(over.length===1?"":"s"));
  if(over.length){console.error("⚠ THE FROZEN MANIFEST RECORDS A COLLISION:");
    over.forEach(o=>console.error("   "+o.s+"  "+o.a+" / "+o.b));}
}

// ---- optional: screen loose files against the bank ----
const loose=process.argv.slice(2).filter(x=>x!=="--freeze");
if(loose.length){
  console.log("\nscreening "+loose.length+" candidate file(s) against the bank:");
  for(const f of loose){
    if(!fs.existsSync(f)){console.log("  MISSING "+f);continue;}
    const Q=print(pcmOf(f));
    let best=null;
    for(const k of names){const {s}=score(Q,P[k]); if(!best||s>best.s)best={k,s};}
    const label=path.basename(f).slice(0,44);
    console.log("  "+(best.s>=THRESH?"⚠ COLLIDES":"  clear   ")+"  "+best.s.toFixed(3)+
      "  nearest="+best.k.padEnd(12)+"  "+label);
  }
}
fs.rmSync(TMP,{recursive:true,force:true});
