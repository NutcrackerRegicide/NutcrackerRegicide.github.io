/* REGICIDE PVP — 10-net.js
   Host-authoritative P2P multiplayer over the free PeerJS broker.
   The HOST runs the whole simulation (AI, economy, combat, physics).
   GUESTS are thin clients: they render host snapshots (12 Hz), send their
   inputs (20 Hz), and take over the body of a living Blue bot on admit —
   disconnecting hands the body straight back to the AI. Solo is untouched. */

var NET={
  mode:"solo",          // "solo" | "host" | "guest"
  PROTO:26,             // bumped whenever the wire format changes OR the generated world does.
                        // v127: 25 → 26. The envelope (stock0/stock1/carry/ares) went from
                        // "every snapshot" to "when it changes, plus the 1Hz keyframe". A v126
                        // guest reads s.stock0.f with no guard, so an absent field would write
                        // NaN into the treasury — a MISREAD, which is what this number is for.
                        // `ht` in v126 needed no bump because an old peer simply ignored it.
                        // v107: the 90s age research (`ares` in snaps + world). v114: the map went
                        // flush with forest — `nodes` is indexed by position in a DETERMINISTIC
                        // world build, so a v113 client and a v114 client disagree about which
                        // tree index 300 is. Same bytes, different world: it has to be gated.
                        // v115: the forest was replanted as STANDS (680 trees, not 590) — same
                        // rule, same reason, so the number moves again.
  peer:null,
  conns:[],             // host: every open guest RELIABLE connection
  conn:null,            // guest: the reliable pipe (events, world, acts)
  fast:null,            // guest: the unreliable pipe (inputs up, snapshots down)
  remotes:{},           // host: peerId -> {conn,fast,unit,input,inputAt,oldName,name,rtt}
  myUid:-1,
  snapT:0, inputT:0, _snapN:0, _q:0, lastQ:-1,
  gapAvg:83, lastArr:0,
  roomCode:"",
  SNAP_HZ:15, INPUT_HZ:20, // deltas made snaps small — spend some savings on freshness
  // ---- v95: the netcode overhaul ----
  BUF_FAST_MAX:16384,   // skip a fast-lane snap when >16KB is still unflushed (v97: was 32KB — that's ¼s of queue on a 1Mbps cable uplink; skip EARLY, stay fresh)
  BUF_REL_MAX:16384,    // NEVER queue a snap behind a reliable-lane backlog — that backlog was THE freeze
  AOI_NEAR:60,          // units within 60 of any guest body refresh every snap…
  AOI_FAR_EVERY:4,      // …distant ones every 4th (structural changes — death/class/garrison — always ship at once)
  MIRROR_EVERY:15,      // v126: snaps ALSO sent on the reliable lane while the fast one is healthy — 1Hz liveness, was every 4th (a fifth of the stream, discarded on arrival)
  INPUT_STALE_MS:600,   // a guest whose inputs stop arriving stops walking (no runaway ghosts)
  INPUT_EASE_MS:250,    // v126: …and eases to that stop over this long instead of dropping dead mid-stride
  AUTH_FRESH_S:0.6,     // authority older than this (vs the guest's clock) may not yank the player — backlog ≠ truth
  // ---- v126: THE HONEST AGE CLOCK ----
  // v95 measured snapshot age as (our sim clock) − (the snapshot's sim clock). Both sides
  // advance their sim clock by a dt that 09-main CLAMPS to 0.05 — so a host under load
  // (10–19 fps: frames longer than 50ms) silently deletes the excess and its match clock
  // falls behind wall time (measured: 0.85× over 24 min, 0.74× at 20 fps). The guest, at
  // 60–90 fps, never hits the clamp and runs at 1.0×. lagT therefore grew ~0.15s/s from
  // nothing but the frame-rate gap, crossed AUTH_FRESH_S after ~4s, and stayed there until
  // the >5s bail-out reset it — a sawtooth that denied authority for ~88% of the session
  // (John: 15330 stale / 17288 snaps, and PROVEN by reconstructing the sawtooth from the
  // two clock rates alone). Snapshot age is a WALL-CLOCK question; ask it with a wall clock.
  // `ht` (host performance.now) rides every snap; the guest tracks the running MINIMUM of
  // (arrival − ht) as its zero-delay baseline and calls the excess the age. No clock sync,
  // no absolute offset, immune to whatever the sim clock is doing.
  AGE_FRESH_MS:600,     // a snapshot older than this may not leash-yank the player body
  HOFF_DECAY_MS:20000,  // …and the baseline re-floors this often, so slow drift can't poison it
  EXTRAP_MAX_MS:260,    // v127: a remote body keeps walking its last leg this long past the glide, rather than freezing until the next row (~1 AOI_FAR_EVERY period at SNAP_HZ)
  LANE_WEDGE_MS:2500,   // host: a lane whose bufferedAmount hasn't MOVED this long is dead, not busy
  REDIAL_MS:1200,       // guest: fast lane claims open but nothing has arrived ON IT this long
  DIAL_TIMEOUT_MS:6000, // …and only one dial may be in flight at a time, for this long
  // ---- v128.4: THE RELIABLE LANE WAS THE FREEZE (see bcastFast) ----
  // The v128.2 field logs: a guest spent 35% of his session (144 of 413 seconds, longest
  // run 39s) receiving ZERO bytes, then took the whole backlog at once — 621 snapshots /
  // 528KB in one second, the oldest 40.9s old, 604 of them refused as stale. Across all 20
  // outages the recovery floods delivered 112% of what a 15Hz stream would have pushed:
  // nothing was ever dropped, it was ALL delivered late. The fast lane was down in 139 of
  // those 144 seconds. bufferedAmount read ~800B throughout, because on a reliable ORDERED
  // channel it cannot see head-of-line blocking — the transport keeps accepting sends while
  // the receiver holds everything behind one missing chunk. So BUF_REL_MAX never fired.
  REL_ACK_WINDOW:30,    // …ask the GUEST instead: stop the reliable lane above this many un-applied snaps (~2s at 15Hz)
  REL_FALLBACK_HZ:4,    // …and while the fast lane is down, relay at this rate, not the full SNAP_HZ
  // ---- v128.4: THE HOST NEVER SAW ANYONE LEAVE ----
  // Same logs: one `drop` event for at least three departures. PeerJS reported a lane
  // open:true for 8 minutes after that guest was gone and never fired close or error, so
  // hostDrop — the only reaper — was never called. The abandoned body keeps u.remote set,
  // 07-ai.js:854 returns from updateBot on it, and hostAdmit refuses to recycle it: every
  // un-reaped departure permanently costs its team one unit.
  PEER_DEAD_MS:90000,   // nothing heard on ANY lane this long → reap (4× the worst genuine recovery in the logs: 21.3s)
  PC_DEAD_MS:30000,     // …or the RTCPeerConnection has been "disconnected" this long (Chrome bounces through it on a handover)
  // ---- v128.5: LAG COMPENSATION ----
  // Until now the host resolved a guest's attacks against its OWN present tick while the guest
  // was aiming at a world ~276ms old. Measured consequence at the field-test median ping of
  // 212ms: a fleeing infantryman travels 1.70 units while a broadsword's whole reach is 3.4, so
  // HALF the reach was gone; against a fleeing knight (2.86u) usable reach was 0.54u — you had
  // to stand inside the model. At the p90 of 1294ms no guest could land melee on anything that
  // moved. The error is asymmetric, which is why it read as jank rather than lag: a target
  // CHARGING you is easier to hit than it looks, because latency carries it into reach.
  HIST_SLOTS:24,        // position-history ring depth, shared timestamps
  HIST_MIN_MS:22,       // …don't sample faster than this (24 × 22 = 528ms at any frame rate)
  LAGCOMP_MAX_MS:500,   // hard ceiling on how far anyone may rewind
  LAGCOMP_SLACK_MS:120, // …and nobody may rewind more than their OWN measured rtt plus this
  MELEE_WINDOW_MS:120,  // the swing's active window: a target in reach at ANY point in it is hit
  CATCHUP_STEP_MS:16.7, // fast-forward granularity for a rewound arrow
  estT:null, ping:0, _fx:[],
  // ---- v92: identity + host options + the HALL (serverless server browser) ----
  myName:"Warrior",     // set on the name screen; the host's tag & scoreboard name
  gameMode:"pvp",       // "pvp" | "coop" — co-op admits every joiner to BLUE vs the Red AI
  isPublic:true,        // public halls announce to the hall registry; private ones hide
  password:"",          // private halls demand this in the hello
  hall:{role:"none",peer:null,conn:null,servers:{},hbT:null}, // role: none|registry|client
};
// THE HALL: a well-known PeerJS id acts as the server directory. The first public
// host to claim it BECOMES the registry (serving lists while playing); later hosts
// report to it with heartbeats; browsers query it. No backend, no Netlify involvement.
// If the registry's tab closes, the next heartbeat elects a new one.
var HALL_ID="regicide-hall-v1";
// v97: OPTIONAL TURN relay — the rescue lane for pairs whose routers refuse direct P2P
// (permanent 🐢 or no connection at all — matters most once strangers join via THE HALL).
// Stand up coturn per docs/TURN-SERVER-GUIDE.md, then fill in this ONE line:
NET.TURN=null; // e.g. {urls:"turn:YOUR.VPS.IP:3478",username:"regicide",credential:"YOUR-SECRET"}
// v128.8 THE 5G HOST, and why this line is not optional any more.
// Field report: hosting from a phone on mobile data, nobody could join; the same phone on Wi-Fi
// worked first try. That is not a bug, it is the one thing STUN cannot do. Carriers put phones
// behind CGNAT, which is almost always SYMMETRIC: a different external port is allocated per
// destination, so the address STUN discovers is meaningless to any other peer and no direct
// candidate pair can ever succeed. Home routers are usually cone NAT, where STUN works — hence
// "fine on Wi-Fi, dead on 5G", every time, for every guest. TURN is the only fix, because a relay
// is a fixed address both sides can reach.
// Until one is stood up (docs/TURN-SERVER-GUIDE.md), the least this can do is SAY SO — see
// NET.watchIce below, which used to report a live host as "no answer".
NET.turnCfg=function(){
  if(NET.TURN)return NET.TURN;
  // …and a relay can be tried on a DEVICE without a deploy, the same reasoning as `?ink=`: the
  // person holding the phone that cannot connect is not the person who can edit this file.
  // localStorage.reg_turn = {"urls":"turn:1.2.3.4:3478","username":"u","credential":"p"}
  try{const raw=localStorage.getItem("reg_turn"); if(raw)return JSON.parse(raw);}catch(_){}
  return null;
};
NET.peerOpts=function(){
  const ice=[{urls:"stun:stun.l.google.com:19302"}];
  const t=NET.turnCfg();
  if(t)ice.push(t);
  return {config:{iceServers:ice}};
};
// Is this machine on mobile data? Chrome on Android answers; iOS Safari does not implement the
// API at all, so a null answer means "unknown", never "no".
NET.onCellular=function(){
  try{
    const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
    if(!c)return null;
    if(c.type)return c.type==="cellular";
    if(c.effectiveType&&/^([23]g|slow-2g)$/.test(c.effectiveType))return true;
    return null;
  }catch(_){return null;}
};
// THE HONEST FAILURE. `iceconnectionstatechange` → "failed" is the definitive signal that no
// candidate pair worked, and it is a completely different thing from the broker saying the room
// does not exist. Distinguishing them is the whole point: one means "the host is not there", the
// other means "the host is there and unreachable", and the player can only act on the second.
NET.watchIce=function(conn,who){
  try{
    const pc=conn&&conn.peerConnection;
    if(!pc||pc.__regIce)return;
    pc.__regIce=true;
    pc.addEventListener("iceconnectionstatechange",()=>{
      const s=pc.iceConnectionState;
      if(s==="connected"||s==="completed"){NET._iceOK=true;NET.candKind(pc);}
      if(s!=="failed")return;
      NET.logEvent("ice-failed",who||"");
      if(NET.mode==="guest"||!NET.mode){
        NET.status("⚠ Found the host, but no route to them. If they are hosting on mobile data, "+
          "ask them to host from Wi-Fi — a phone on 5G cannot accept direct connections.");
        msg("No route to the host. Mobile data (5G) blocks direct connections — ask them to host on Wi-Fi.","warn");
      }else{
        msg("A player found this hall but could not reach it. If you are on mobile data, host from Wi-Fi instead.","warn");
      }
    });
  }catch(_){}
};
// Which kind of candidate actually won — host / srflx / relay. This is the number that answers
// "did TURN do anything" in a field log, and it cannot be guessed from anywhere else.
NET.candKind=function(pc){
  try{
    if(!pc.getStats)return;
    pc.getStats().then(rep=>{
      let pair=null;
      rep.forEach(r=>{if(r.type==="candidate-pair"&&(r.selected||r.state==="succeeded")&&!pair)pair=r;});
      if(!pair)return;
      const loc=rep.get&&rep.get(pair.localCandidateId);
      const kind=(loc&&loc.candidateType)||"?";
      if(NET._candKind===kind)return;
      NET._candKind=kind;
      NET.logEvent("ice-"+kind);
    }).catch(()=>{});
  }catch(_){}
};
const CLS_KEYS=Object.keys(CLS), CLS_IDX={};
CLS_KEYS.forEach((k,i)=>CLS_IDX[k]=i);

// ---------- tiny helpers ----------
// ---- v126: ONE CLOCK, AND A SEAM TO DRIVE IT ----
// Every timing decision in the net layer now reads wall time through here. Two reasons.
// (1) HONESTY: the cadence and diagnostic timers used to accumulate the sim `dt`, which
//     09-main clamps to 0.05 — so on a loaded host they ran at 0.74–0.85× and both the send
//     rate and the flight recorder's own "per second" quietly meant "per sim second".
// (2) TESTABILITY: a headless harness drives hostFrame/guestFrame in a tight loop where no
//     real time passes at all, so a bare performance.now() would freeze every timer and the
//     v98 net-log tests would pass or fail on how long the preceding block happened to take
//     (the guest sampler check was doing exactly that). Tests override NET.now with a counter
//     they step by hand — see `NET.now` in tools/smoketest.js — and nothing else has to know.
// Monotonic on purpose: never Date.now() while performance.now() exists, because the age
// measurement in applySnap must not be walked backwards by an NTP correction mid-match.
NET.now=function(){
  return (typeof performance!=="undefined"&&performance.now)?performance.now():Date.now();
};
// ==================== v128.5: THE REWIND STORE ====================
// A ring of past positions so the host can ask "where was this unit when the guest fired?".
//
// TWO DESIGN NOTES WORTH KEEPING.
//
// 1. NOTHING IS EVER MUTATED, SO NOTHING HAS TO BE RESTORED. The usual shape of this system
//    rewinds the live transforms, runs the test and restores them. That leaves a window where a
//    throw mid-check corrupts the world for every other system. Here the history is a separate
//    store and `histAt` writes the answer into two scratch scalars — the live positions are
//    never touched, so there is no restore step and no way to leave the world in the past.
// 2. ALL UNITS SHARE ONE TIMESTAMP RING. They are sampled on the same host frame, so the times
//    are identical for every unit — one Float64Array for the world, one Int16Array pair per
//    unit, allocated once and written in place for ever after. At 136 units × 24 slots that is
//    ~13KB total and ZERO allocation per sample. Positions use the same x*10 Int16 quantization
//    the wire already uses (10cm), because a hit test finer than the snapshot that produced it
//    would be measuring noise.
NET._histT=null;      // Float64Array(HIST_SLOTS) — host wall clock of each slot
NET._histI=-1;        // newest slot
NET._histN=0;         // slots filled so far
NET._rwX=0; NET._rwZ=0; // histAt writes here — scratch, never an object
NET.histReset=function(){NET._histT=null;NET._histI=-1;NET._histN=0;};
NET.histSample=function(now){ // called once per host frame, AFTER the sim has moved everything
  if(typeof units==="undefined")return;
  const S=NET.HIST_SLOTS;
  if(!NET._histT)NET._histT=new Float64Array(S);
  if(NET._histN&&now-NET._histT[NET._histI]<NET.HIST_MIN_MS)return; // a fast host must not spend the ring
  const i=(NET._histI+1)%S;
  NET._histI=i; NET._histT[i]=now;
  if(NET._histN<S)NET._histN++;
  for(let k=0;k<units.length;k++){
    const u=units[k], p=u.root&&u.root.position;
    if(!p)continue;
    const qx=Math.round(p.x*10), qz=Math.round(p.z*10);
    let hx=u._hx;
    if(!hx){ // a unit born mid-ring must not read as standing at the origin in the past
      hx=u._hx=new Int16Array(S); u._hz=new Int16Array(S);
      hx.fill(qx); u._hz.fill(qz);
    }
    hx[i]=qx; u._hz[i]=qz;
  }
};
// Where was `u` at host-clock time `t`? Writes NET._rwX/_rwZ. Returns true if the answer came
// from history, false if it fell back to the present (no ring, or `t` is not in the past).
NET.histAt=function(u,t){
  const p=u&&u.root&&u.root.position;
  const hx=u&&u._hx;
  if(!hx||!NET._histN||!(t>0)){ if(p){NET._rwX=p.x;NET._rwZ=p.z;} return false; }
  const H=NET._histT, S=NET.HIST_SLOTS, N=NET._histN, newest=NET._histI;
  if(t>=H[newest]){ if(p){NET._rwX=p.x;NET._rwZ=p.z;} return false; }
  const hz=u._hz;
  let a=newest;
  for(let k=1;k<N;k++){
    const b=(newest-k+S+S)%S;
    if(H[b]<=t){ // t sits between slot b and slot a — lerp
      const span=H[a]-H[b], f=span>0?(t-H[b])/span:0;
      NET._rwX=(hx[b]+(hx[a]-hx[b])*f)/10;
      NET._rwZ=(hz[b]+(hz[a]-hz[b])*f)/10;
      return true;
    }
    a=b;
  }
  NET._rwX=hx[a]/10; NET._rwZ=hz[a]/10; return true; // older than the whole ring: clamp to the oldest
};
// The host's verdict on how far back a guest may look. NEVER TRUST THE CLAIM: a guest on a 20ms
// link may not ask to shoot into a 500ms-old world. The ceiling is its own measured rtt plus a
// fixed slack, under a hard LAGCOMP_MAX_MS. An old guest that sends no claim gets an estimate
// from rtt alone — roughly right, since the world it renders is about one round trip old.
NET.rewindTime=function(r,claim){
  const now=NET.now();
  const rtt=Math.max(0,(r&&r.rtt)||0);
  const cap=Math.min(NET.LAGCOMP_MAX_MS,rtt+NET.LAGCOMP_SLACK_MS);
  let back=(typeof claim==="number"&&claim>0&&claim<now)?(now-claim):Math.min(NET.LAGCOMP_MAX_MS,rtt);
  if(!(back>0))back=0;
  if(back>cap)back=cap;
  if(r)r._rwMs=Math.round(back); // the flight recorder reports what was actually granted
  return now-back;
};
// Guest side: the host-clock instant of the world we are LOOKING at. `_hOff` is the running
// minimum of (arrival − ht), i.e. clock offset plus best-case transit, so (now − _hOff) is our
// estimate of the host's clock right now; we then step back by the interpolation delay we are
// rendering at. Returns 0 when uncalibrated (a v125 host, or the first moments after joining),
// which the host reads as "no claim" and falls back to its own rtt estimate.
NET.viewTime=function(){
  if(!NET._hasHt||NET._hOff===undefined)return 0;
  return (NET.now()-NET._hOff)-NET.gapAvg;
};
NET.bcast=function(o){for(const c of NET.conns){try{if(c.open)c.send(o);}catch(_){}}};
NET.laneBuf=function(c){ // bytes sitting UNSENT in a lane's pipe — the honest congestion signal
  try{const dc=c&&c.dataChannel;return(dc&&typeof dc.bufferedAmount==="number")?dc.bufferedAmount:0;}
  catch(_){return 0;}
};
NET.bcastFast=function(o){ // unreliable when healthy, never starving — and NEVER queueing behind a backlog.
  // v95 CONGESTION CONTROL: the old code fired snaps into the pipe blind. On a weak
  // uplink the reliable lane buffered SECONDS of stale snapshots; when they finally
  // drained, each one re-armed the guest's leash and dragged them back through the
  // past — the "world frozen, can't walk" freeze. Now a lane only gets a snap when
  // its buffer is close to empty: a choked pipe skips frames and the guest gets the
  // FRESHEST world the moment it drains, not a replay of everything it missed.
  // v126 THE MIRROR WAS COSTING A FIFTH OF THE STREAM. The reliable lane used to carry
  // every 4th snap (3.75Hz) alongside a healthy fast lane. applySnap discards those at
  // `q<=lastQ`, so on a working link they were pure waste — measured at 17% (Petra) and
  // 20% (John) of ALL arrivals thrown away, paid for on the lane that RETRANSMITS, while
  // the host's send buffer sat at ≥16KB for 11–13% of seconds. It is now MIRROR_EVERY
  // (1Hz): enough that a silently-dying fast lane still trickles a world through until the
  // guest redials, cheap enough to stop being the reason the buffer is full.
  const now=NET.now();
  for(const k in NET.remotes){
    const r=NET.remotes[k];
    try{
      const fastUp=r.fast&&r.fast.open;
      if(fastUp){
        const bf=NET.laneBuf(r.fast);
        // a lane that drained enough to accept a snap is alive — clear the wedge watch
        // ENTIRELY (both halves: leaving _wedgeB set would let the next choke land on the
        // same byte count, find _wedgeAt==0, and never start the timer at all)
        if(bf<NET.BUF_FAST_MAX){r.fast.send(o);r.sentF=(r.sentF||0)+1;r._wedgeAt=0;r._wedgeB=-1;}
        else{
          r.skipF=(r.skipF||0)+1;
          // v126 WEDGED-LANE RECOVERY. A DataChannel can report open with a bufferedAmount
          // that never moves again — the pipe is dead, not busy. The old code skipped
          // against it for ever: John's buf sat at EXACTLY 16855 for 11 straight seconds,
          // sent:0, skipF:15/s, while the guest's body froze on stale inputs. The guest has
          // had `redial` for this since v98; the host had nothing. If the buffer has not
          // MOVED in LANE_WEDGE_MS, drop the lane — the reliable relay takes over instantly
          // and the guest's own redial rebuilds the fast one.
          if(bf!==r._wedgeB){r._wedgeB=bf;r._wedgeAt=now;}
          else if(r._wedgeAt&&now-r._wedgeAt>NET.LANE_WEDGE_MS){
            NET.logEvent("lane-wedged",r.name);
            try{r.fast.close();}catch(_){}
            r.fast=null;r._wedgeAt=0;r._wedgeB=-1;
          }
        }
      }else{r._wedgeAt=0;r._wedgeB=-1;}
      const mirror=fastUp&&o.t==="snap"&&(o.q%NET.MIRROR_EVERY)===0;
      if(r.conn&&r.conn.open&&(!(r.fast&&r.fast.open)||mirror)){
        // v128.4 THE FALLBACK WAS THE FREEZE. When the fast lane dies this branch used to
        // relay the FULL SNAP_HZ stream down the reliable, ORDERED lane behind a single
        // guard — laneBuf < BUF_REL_MAX — and that guard is blind. bufferedAmount only
        // counts what the app has queued that the transport has not yet accepted; SCTP
        // happily accepts new sends while it retransmits, so a stalled pipe reads ~800B and
        // the host shovels 15 snaps/second into it. 39 seconds of that is 600 snapshots the
        // guest gets in one lump, all of them stale on arrival. The v95 comment above
        // describes this exact failure and claims an empty buffer proves the pipe is
        // flowing. On this lane it proves nothing.
        //
        // Two honest brakes instead:
        //   1. THE ACK. The guest tells us the last q it APPLIED (`aq` on its input packet,
        //      20Hz, optional, no PROTO bump). in-flight = what we last relayed − what it
        //      applied. That measures DELIVERY, which is the thing that stopped. It works
        //      because the stall is one-directional: through every outage in the logs the
        //      host was still receiving that guest's input at 2–3ms age.
        //   2. THE RATE CAP. Even flowing, the reliable lane is the wrong place for 15Hz.
        //      REL_FALLBACK_HZ keeps a dead fast lane playable instead of catastrophic — a
        //      39s outage now queues at most REL_ACK_WINDOW, not 600.
        // The 1Hz mirror is exempt from the rate cap (it IS the liveness trickle) but not
        // from the ack window: piling onto a guest who is already behind helps nobody.
        const isSnap=o.t==="snap";
        let hold=false;
        if(isSnap){
          if(typeof r.ackQ==="number"&&typeof r._relQ==="number"&&(r._relQ-r.ackQ)>NET.REL_ACK_WINDOW)hold=true;
          else if(!mirror&&r._relAt&&(now-r._relAt)<(1000/NET.REL_FALLBACK_HZ))hold=true;
        }
        if(hold)r.holdR=(r.holdR||0)+1;
        else if(NET.laneBuf(r.conn)<NET.BUF_REL_MAX){
          r.conn.send(o);
          r.sentR=(r.sentR||0)+1; // v128.4: the reliable send was NEVER counted. For 30 versions
          if(isSnap){r._relAt=now;r._relQ=o.q;} // the host log read `sent:0 skipF:0 skipR:0` — idle —
        }                                       // through all 144 of those frozen seconds.
        else r.skipR=(r.skipR||0)+1;
      }
    }catch(_){}
  }
};
// ---- v98 THE NET LOG: a rolling flight recorder for multiplayer sessions ----
// 1 row/second on both host and guest + a small event stream. F9 downloads it as
// JSON; John drops the file into the chat and the numbers do the arguing.
NET.LOG={rows:[],events:[],max:2400};
NET.logEvent=function(k,d){
  try{NET.LOG.events.push({t:Date.now(),T:(typeof T==="number")?r1(T):0,k,d:d===undefined?null:d});
    if(NET.LOG.events.length>400)NET.LOG.events.shift();}catch(_){}
};
NET.logRow=function(row){NET.LOG.rows.push(row);if(NET.LOG.rows.length>NET.LOG.max)NET.LOG.rows.shift();};
// v126: the verstamp in index.html is the ONE place the build names itself — read it, don't
// hardcode a second copy. The v125.1 logs John field-tested with all said ver:"v98", because
// this string was frozen the day the recorder was written. A flight recorder that misreports
// which build produced it is a flight recorder you have to take somebody's word about.
NET.logVer=function(){
  try{const el=document.querySelector(".verstamp");
    if(el&&el.textContent)return el.textContent.trim();}catch(_){}
  return "unknown";
};
NET.saveLog=function(){
  const payload={meta:{game:"REGICIDE",ver:NET.logVer(),logfmt:2,proto:NET.PROTO,role:NET.mode,name:NET.myName,
    room:NET.roomCode||"",saved:new Date().toISOString(),
    ua:(typeof navigator!=="undefined"&&navigator.userAgent)||"",
    snapHz:NET.SNAP_HZ,bufFast:NET.BUF_FAST_MAX,bufRel:NET.BUF_REL_MAX,aoiNear:NET.AOI_NEAR,
    mirrorEvery:NET.MIRROR_EVERY,ageFreshMs:NET.AGE_FRESH_MS,inputStaleMs:NET.INPUT_STALE_MS},
    rows:NET.LOG.rows,events:NET.LOG.events};
  try{
    const blob=new Blob([JSON.stringify(payload)],{type:"application/json"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download="regicide-netlog-"+NET.mode+"-"+(NET.myName||"warrior").replace(/[^a-z0-9]/gi,"")+
      "-"+new Date().toISOString().slice(11,19).replace(/:/g,"")+".json";
    document.body.appendChild(a); a.click();
    setTimeout(()=>{try{URL.revokeObjectURL(a.href);a.remove();}catch(_){}},2000);
    msg("📊 Net log saved — "+NET.LOG.rows.length+"s of data. Send the file to Claude.","gold");
  }catch(_){/* headless or download blocked — the payload still returns for tests */}
  return payload;
};
NET.unitById=function(id){for(const u of units)if(u.id===id)return u;return null;};
NET.bldById=function(id){for(const b of buildings)if(b.id===id)return b;return null;};
function r1(v){return Math.round(v*10)/10;}
function r2(v){return Math.round(v*100)/100;} // v124: the analog move vector — 2dp is ~0.6 degrees
// v128.2: the panel writes into #netmsg, not into itself. It used to do `el.innerHTML=txt`, which
// is fine until the panel owns a button — the next status update deletes it. Falls back to the
// old behaviour if #netmsg is missing, so a stripped index.html still shows the text.
NET.status=function(txt,show){
  const el=document.getElementById("netstatus");
  if(!el)return;
  el.style.display=show===false?"none":"block";
  const msg=document.getElementById("netmsg");
  if(msg)msg.innerHTML=txt; else el.innerHTML=txt;
  NET.applyFold();
};
// Folded or not is a USER decision that has to survive every status refresh (one a second) and
// every reload. Kept out of NET.status's write path entirely so the two cannot fight.
NET.setFold=function(fold){
  NET._fold=!!fold;
  try{localStorage.setItem("reg_netfold",fold?"1":"0");}catch(_){}
  NET.applyFold();
};
NET.applyFold=function(){
  const el=document.getElementById("netstatus"); if(!el)return;
  if(NET._fold===undefined){
    let saved=null; try{saved=localStorage.getItem("reg_netfold");}catch(_){}
    NET._fold=saved==="1";
  }
  el.classList.toggle("netfold",!!NET._fold);
  const chip=document.getElementById("netchip");
  // the chip carries the ping when there is one, so folding costs the number but not the signal
  if(chip)chip.textContent=NET._fold?("⚑"+(NET.ping?" "+Math.round(NET.ping)+"ms":"")):"⚑";
};
(function wireFold(){
  const go=()=>{
    const el=document.getElementById("netstatus"); if(!el)return;
    const btn=document.getElementById("netmin");
    if(btn)btn.addEventListener("click",e=>{e.stopPropagation();NET.setFold(true);});
    // the whole chip is the hit target when folded — a 26px ✕ is fine to close, but re-opening
    // wants the biggest target the collapsed panel can offer
    el.addEventListener("click",()=>{if(NET._fold)NET.setFold(false);});
    NET.applyFold();
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",go); else go();
})();

// ---------- monkeypatched event broadcasts ----------
// Wrapped once at load; they only speak when we are the host, so the guest's
// bnew handler can safely call makeBuilding without echoing it back out.
const _real_makeBuilding=makeBuilding;
makeBuilding=function(team,type,x,z,instant,rot){
  const b=_real_makeBuilding(team,type,x,z,instant,rot);
  if(NET.mode==="host")
    NET.bcast({t:"bnew",id:b.id,team,type,x:r1(x),z:r1(z),rot:rot||0,built:instant?1:0});
  return b;
};
const _real_makeUnit=makeUnit;
makeUnit=function(team,cls,x,z,opts){
  const u=_real_makeUnit(team,cls,x,z,opts);
  if(NET.mode==="host")
    NET.bcast({t:"unew",id:u.id,team,cls,x:r1(x),z:r1(z),name:u.name});
  return u;
};
const _real_shootArrow=shootArrow;
shootArrow=function(att,target){
  _real_shootArrow(att,target);
  // v95: arrow theatre used to ride the RELIABLE lane one message per arrow — in a
  // mass battle that flooded the same pipe the snapshots need (head-of-line blocking).
  // Now shots batch into the next snapshot; a dropped packet drops only cosmetics.
  if(NET.mode==="host"&&NET._fx.length<60)
    NET._fx.push([att.def?-1:att.id,att.def?att.id:-1,target.def?-1:target.id,target.def?target.id:-1]);
};
const _real_depleteNode=depleteNode;
depleteNode=function(n){
  _real_depleteNode(n);
  if(typeof Sound!=="undefined"&&n)Sound.play(n.type==="wood"?"treefall":n.type==="food"?"harvest":"stonecrumble",{x:n.x,z:n.z}); // v104: node exhausted (host/solo)
  if(NET.mode==="host")NET.bcast({t:"ndep",i:nodes.indexOf(n)});
};
const _real_endGame=endGame;
endGame=function(winner,killerName){
  if(NET.mode==="host")NET.bcast({t:"end",w:winner,k:killerName});
  _real_endGame(winner,killerName);
};

// ============================================================ HOST ==========
NET.uiShowHost=function(){ // the HOST button reveals the options row
  const jr=document.getElementById("joinrow"), sl=document.getElementById("serverlist");
  if(jr)jr.style.display="none"; if(sl)sl.style.display="none";
  const hr=document.getElementById("hostrow");
  if(hr)hr.style.display=hr.style.display==="flex"?"none":"flex";
  const bh=document.getElementById("btnhost"),bj=document.getElementById("btnjoin");
  if(bj)bj.classList.remove("on");
  if(bh)bh.classList.toggle("on",!!hr&&hr.style.display==="flex");
  if(hr&&hr.style.display==="flex"&&NET._reveal)NET._reveal(hr); // v124.1
};
NET.uiHost=function(){
  if(typeof Peer==="undefined"){msg("PeerJS failed to load — check your internet connection.","warn");return;}
  if(NET.peer)return;
  if(!NET.isPublic){ // a private hall must have its word set
    NET.password=String((document.getElementById("hostpw")||{value:""}).value||"").slice(0,16);
    if(!NET.password){msg("A PRIVATE hall needs a password — type one, or go PUBLIC.","warn");return;}
  }else NET.password="";
  const abc="abcdefghjkmnpqrstuvwxyz23456789";
  let code="regicide-";for(let i=0;i<4;i++)code+=abc[(Math.random()*abc.length)|0];
  NET.roomCode=code;
  // v128.8: warn BEFORE anyone wastes a minute failing to join. A phone on mobile data sits
  // behind carrier NAT that no amount of STUN can punch through, so hosting from it does not
  // half-work — it fails for everyone, every time. Chrome on Android answers this; iOS Safari
  // does not implement the API, so `null` means unknown and stays silent rather than crying wolf.
  if(NET.onCellular()===true&&!NET.turnCfg()){
    msg("⚠ You are on MOBILE DATA. Players will not be able to join — a phone on 5G cannot accept "+
        "direct connections. Switch to Wi-Fi before opening a hall.","warn");
    NET.logEvent("host-on-cellular");
  }
  NET.status("Opening the gates…");
  const peer=new Peer(code,NET.peerOpts()); NET.peer=peer;
  peer.on("open",()=>{
    NET.mode="host";
    inMenu=false; // the host walks the world while the lobby gathers
    NET.uiHideMenus(); // v128.9: the player is standing on #setupscreen when a hall opens
    NET.lobby();
    NET.hallJoin(); // stand in the hall (or become it) so browsers can find public games
    msg("You are HOSTING a "+(NET.gameMode==="coop"?"CO-OP":"PvP")+" "+(NET.isPublic?"public":"private")+" hall. Room code: "+code,"gold");
  });
  peer.on("error",e=>{
    msg("Host error: "+e.type+" — try again (the code may be taken).","warn");
    NET.status("Broker error: "+e.type);
    NET.peer=null;
  });
  peer.on("connection",c=>{
    if(c.metadata&&c.metadata.ch==="fast"){ // the guest's second, unreliable lane
      const r=NET.remotes[c.peer];
      // v126: CLOSE THE ONE WE ARE REPLACING. `r.fast=c` used to orphan the previous lane —
      // still open, still holding a wedged send buffer, never collected. Petra redialled 38
      // times in 24 minutes, so the host was carrying a drawer full of dead channels for her.
      if(r){
        if(r.fast&&r.fast!==c){try{r.fast.close();}catch(_){}}
        r.fast=c;r._wedgeAt=0;r._wedgeB=-1;
        c.on("data",d=>NET.hostData(r.conn,d));
      }
      // …and only null the slot if the lane closing IS the current one (a late `close` from
      // the channel we just replaced would otherwise kill the fresh lane a moment after it
      // came up — the flap that reads as "the fast lane won't stay up")
      c.on("close",()=>{const rr=NET.remotes[c.peer];if(rr&&rr.fast===c)rr.fast=null;});
      return;
    }
    NET.watchIce(c,"guest"); // v128.8: a host whose guests cannot route to them should be told
    c.on("data",d=>NET.hostData(c,d));
    c.on("close",()=>NET.hostDrop(c));
    c.on("error",()=>NET.hostDrop(c));
  });
};
NET.lobby=function(){
  const n=NET.conns.length;
  let diag=""; // v95: the host sees each guest's health at a glance — lane, ping, backlog
  for(const k in NET.remotes){
    const r=NET.remotes[k]; if(!r.unit)continue;
    const fastUp=r.fast&&r.fast.open;
    const buf=NET.laneBuf(fastUp?r.fast:r.conn);
    const inAge=r.inputAt?Math.round(NET.now()-r.inputAt):-1;
    diag+="<br><span class='netsub'>"+String(r.name).replace(/[<>&]/g,"")+": "+(fastUp?"⚡":"🐢")+
      " · ping "+(r.rtt?r.rtt+"ms":"—")+" · sent "+(r.sentF||0)+"/s"+ // v97: compare with the guest's received/s — the gap IS the diagnosis
      ((r.skipF||r.skipR)?" · skip "+((r.skipF||0)+(r.skipR||0)):"")+
      (buf>2048?" · ⚠ backlog "+Math.round(buf/1024)+"KB":"")+
      (inAge>NET.INPUT_STALE_MS?" · ⚠ inputs stalled":"")+"</span>";
  }
  NET.status("⚑ ROOM CODE <span class='netcode'>"+NET.roomCode+"</span>"+
    "<button class='copybtn' onclick='NET.copyCode(this)'>COPY</button><br>"+
    "<span class='netsub'>"+(NET.gameMode==="coop"?"🤝 CO-OP vs "+(AI_DIFF[aiDifficulty]||AI_DIFF.easy).name.toUpperCase()+" AI":"⚔ PvP")+" · "+
    (NET.isPublic?"🌐 public — listed in the hall":"🔒 private — code + password only")+" · "+
    n+" warrior"+(n===1?"":"s")+" joined · keep this window visible!</span>"+diag);
};
NET.copyCode=function(btn){
  try{navigator.clipboard.writeText(NET.roomCode);btn.textContent="COPIED ✓";
    setTimeout(()=>btn.textContent="COPY",1400);}
  catch(_){btn.textContent=NET.roomCode;}
};
// v128.4 SAY GOODBYE. A guest closing its tab is the commonest departure there is, and it used
// to be silent: the host waited on a PeerJS close event that the v128.2 logs show never came,
// and the abandoned body stood in the field for the rest of the match. `pagehide`, not
// `beforeunload` — iOS Safari does not fire the latter.
addEventListener("pagehide",()=>{
  if(NET.mode!=="guest")return;
  try{if(NET.conn&&NET.conn.open)NET.conn.send({t:"bye"});}catch(_){}
  try{if(NET.fast)NET.fast.close();}catch(_){}
  try{if(NET.conn)NET.conn.close();}catch(_){}
});
// a minimized host window is a frozen world — warn everyone, honestly
document.addEventListener("visibilitychange",()=>{
  if(NET.mode!=="host")return;
  NET.bcast({t:"note",m:document.hidden?"⚠ The host minimized their window — the world is paused!"
                                       :"The host returns — the war resumes.",tone:"warn"});
});
NET.hostData=function(c,d){
  if(!d||!d.t)return;
  if(d.t==="hello"){
    if(d.proto!==NET.PROTO){try{c.send({t:"deny",m:"Version mismatch — everyone must run the same REGICIDE build."});}catch(_){}return;}
    if(NET.password&&String(d.pw||"")!==NET.password){ // v92: private halls demand the word
      try{c.send({t:"deny",m:"Wrong password for this hall."});}catch(_){}return;}
    return NET.hostAdmit(c,String(d.name||"Warrior").slice(0,14),d.team||"auto");
  }
  const r=NET.remotes[c.peer];
  if(!r)return;
  r.seenAt=NET.now(); // v128.4: last time we heard ANYTHING from this peer, on any lane — the reaper's clock
  if(d.t==="bye"){ // v128.4: a guest closing its tab says so. The only departure signal that is instant.
    NET.logEvent("bye",r.name);
    return NET.hostRelease(c.peer,"left");
  }
  if(d.t==="input"){
    // v128.4 THE ACK. Take the highest `aq` we have seen even from an out-of-order packet:
    // it is a monotonic high-water mark of what the guest has APPLIED, not part of the
    // input state, and throwing it away with a stale packet would stall the reliable lane.
    if(typeof d.aq==="number"&&d.aq>(r.ackQ===undefined?-1:r.ackQ))r.ackQ=d.aq;
    if((d.seq||0)>=(r.input&&r.input.seq||0)){r.input=d;r.inputAt=NET.now();}
    return;
  }
  if(d.t==="ping"){ // v95: echo straight back (prefer the fast lane) — the guest measures its RTT
    r.rtt=d.rtt||0; // …and reports the last measurement so the HOST can see each guest's ping too
    const lane=(r.fast&&r.fast.open)?r.fast:r.conn;
    try{if(lane&&lane.open)lane.send({t:"pong",ts:d.ts});}catch(_){}
    return;
  }
  if(d.t==="act")return NET.hostAct(r,d);
};
NET.hostAdmit=function(c,name,pref){
  // pick the team: honor the request, or balance humans on "auto".
  // v92 CO-OP: every joiner fights for BLUE — the Red AI is the enemy.
  if(NET.gameMode==="coop")pref="blue";
  let team=pref==="red"?RED:pref==="blue"?BLUE:null;
  if(team===null){
    let nb=1,nr=0; // the host is blue
    for(const k in NET.remotes){const t=NET.remotes[k].unit&&NET.remotes[k].unit.team;if(t===RED)nr++;else nb++;}
    team=nr<nb?RED:BLUE;
  }
  // v95: joiners take the field as a VILLAGER — prefer a real villager body,
  // then any living bot (re-classed on possession), then a respawning body (respawn is villager anyway).
  let u=null;
  for(const v of units)
    if(v.team===team&&v.bot&&!v.isKing&&!v.isPlayer&&!v.remote&&v.bot.role!=="cart"&&v.alive&&v.cls==="villager"){u=v;break;}
  if(!u)for(const v of units)
    if(v.team===team&&v.bot&&!v.isKing&&!v.isPlayer&&!v.remote&&v.bot.role!=="cart"&&v.alive){u=v;break;}
  if(!u)for(const v of units) // everyone's dead? hand over a respawning body
    if(v.team===team&&v.bot&&!v.isKing&&!v.isPlayer&&!v.remote&&v.bot.role!=="cart"){u=v;break;}
  if(!u){try{c.send({t:"deny",m:"That army is full."});}catch(_){}return;}
  NET.remotes[c.peer]={conn:c,unit:u,input:{},oldName:u.name,name,seenAt:NET.now(),lastET:0};
  u.remote=c.peer; u.rally=false; u.rallyBy=null; u.name=name;
  if(u.alive&&u.cls!=="villager"){setClass(u,"villager");if(u.bot)u.bot.role="citizen";} // fresh boots, fresh hands
  NET.conns.push(c);
  c.send({t:"admit",uid:u.id});
  c.send(NET.packWorld(u.id));
  msg("⚔ "+name+" joins the "+TEAMNAME[u.team]+" army as "+u.name+"!",u.team===BLUE?"blue":"warn");
  NET.logEvent("join",name);
  NET.lobby();
};
// v128.4 RELEASE BY KEY, NOT BY CONNECTION. hostDrop was reachable only from the reliable
// lane's own close/error events, and the v128.2 field log proves PeerJS does not always fire
// them: a peer's lane reported open:true for 8 minutes after the player was gone, with its
// bufferedAmount frozen on the same byte. The reaper below only ever holds a NET.remotes key,
// so the release path has to take one. Everything that used to live in hostDrop lives here.
NET.hostRelease=function(key,why){
  const r=NET.remotes[key];
  if(!r)return false;
  if(r.unit){r.unit.remote=null;r.unit.name=r.oldName; // the AI takes the reins back
    const u=r.unit; u.lvl=0;u.xp=0;u.buffs={};u.quest=null;u.questDraft=null;u.qRerolls=0;u.smithOffer=null; // …but not the deserter's legend
    u.rally=false;u.rallyBy=null; // v128.4: set at admit, never cleared at drop
    if(typeof applyBuffStats==="function")applyBuffStats(u);
    if(typeof releaseWarband==="function")releaseWarband(u); // v95: the deserter's band returns to the King
    if(u.alive&&u.cls==="oxcart")setClass(u,"villager"); // v99: the AI can't drive an ox — hand it a villager's tools
    if(u.bot&&u.alive&&u.cls!=="villager")u.bot.role="citizen";} // …and the marshal re-tasks it this pass, not next
  msg(r.name+" left — "+r.oldName+" fights on (AI).","warn");
  NET.logEvent("drop",r.name+(why?" ("+why+")":""));
  // close both lanes: a zombie reliable lane keeps costing a send attempt 15×/second
  try{if(r.fast)r.fast.close();}catch(_){}
  try{if(r.conn)r.conn.close();}catch(_){}
  NET.conns=NET.conns.filter(x=>x!==r.conn);
  delete NET.remotes[key];
  if(NET.mode==="host")NET.lobby();
  return true;
};
NET.hostDrop=function(c){ // the transport's own verdict, when it bothers to give one
  if(!c)return;
  if(!NET.hostRelease(c.peer,"closed")){
    NET.conns=NET.conns.filter(x=>x!==c);
    if(NET.mode==="host")NET.lobby();
  }
};
// v128.4 THE REAPER. Three independent triggers, cheapest first, all landing on hostRelease:
// the `bye` in hostData (instant, covers a closed tab), the peer-connection verdict here
// (covers falling off Wi-Fi), and a last-heard backstop (covers everything else). Deliberately
// NOT triggered on inputAt/INPUT_STALE_MS or on a wedged lane: the logs contain a 21.3s input
// silence and a 19s frozen buffer that BOTH fully recovered — a screen-locked phone is
// indistinguishable from a departure at those timescales.
NET.reapPeers=function(){
  const now=NET.now();
  for(const k in NET.remotes){
    const r=NET.remotes[k];
    let why="";
    try{
      const pc=r.conn&&r.conn.peerConnection;
      const st=pc&&pc.connectionState;
      if(st==="failed"||st==="closed")why="pc-"+st;
      else if(st==="disconnected"){
        if(!r._pcBadAt)r._pcBadAt=now;
        else if(now-r._pcBadAt>NET.PC_DEAD_MS)why="pc-disconnected";
      }else if(st)r._pcBadAt=0;
    }catch(_){} // no peerConnection field on this PeerJS build → no opinion, fall through to the backstop
    if(!why&&r.seenAt&&now-r.seenAt>NET.PEER_DEAD_MS)why="silent-"+Math.round((now-r.seenAt)/1000)+"s";
    if(why)NET.hostRelease(k,why);
  }
};
// ==================== v92: THE HALL — serverless server browser ====================
NET.hallEntryOwn=function(){ // our own listing (public halls only)
  return {code:NET.roomCode,name:NET.myName,mode:NET.gameMode,
    players:1+NET.conns.length,proto:NET.PROTO,t:(typeof performance!=="undefined"?performance.now():0)};
};
NET.hallData=function(c,d){ // the registry's whole brain — runs on whichever host holds HALL_ID
  if(!d||!d.t)return;
  const now=(typeof performance!=="undefined"?performance.now():0);
  if(d.t==="announce"&&d.s&&d.s.code){d.s.t=now;NET.hall.servers[d.s.code]=d.s;return;}
  if(d.t==="bye"&&d.code){delete NET.hall.servers[d.code];return;}
  if(d.t==="list"){
    const out=[];
    for(const k in NET.hall.servers){
      const s=NET.hall.servers[k];
      if(now-s.t>45000){delete NET.hall.servers[k];continue;} // heartbeats are 20s: two misses = gone
      out.push(s);
    }
    if(NET.mode==="host"&&NET.roomCode&&NET.isPublic)out.push(NET.hallEntryOwn());
    try{c.send({t:"servers",list:out});}catch(_){}
  }
};
NET.hallJoin=function(){ // hosting has begun: claim the hall, or report our game to it
  if(typeof Peer==="undefined")return;
  const tryServe=()=>{ // attempt to BECOME the registry
    if(NET.mode!=="host"||NET.hall.role!=="none")return;
    let hp=null;
    try{hp=new Peer(HALL_ID,NET.peerOpts());}catch(_){return;}
    hp.on("open",()=>{NET.hall.role="registry";NET.hall.peer=hp;});
    hp.on("connection",c=>{c.on("data",d=>NET.hallData(c,d));});
    hp.on("error",()=>{ // the hall already has a keeper (or the broker hiccuped)
      try{hp.destroy();}catch(_){}
      if(NET.hall.role!=="registry"){NET.hall.role="none";tryReport();}
    });
  };
  const tryReport=()=>{ // announce our public game to whoever keeps the hall
    if(NET.mode!=="host"||NET.hall.role!=="none"||!NET.isPublic)return;
    try{
      const c=NET.peer.connect(HALL_ID,{reliable:true});
      c.on("open",()=>{NET.hall.role="client";NET.hall.conn=c;
        try{c.send({t:"announce",s:NET.hallEntryOwn()});}catch(_){}});
      c.on("close",()=>{if(NET.hall.conn===c){NET.hall.role="none";NET.hall.conn=null;}});
      c.on("error",()=>{if(NET.hall.conn===c||NET.hall.role==="none"){NET.hall.role="none";NET.hall.conn=null;}});
    }catch(_){}
  };
  tryServe(); // private hosts still keep the hall for others — they just never list themselves
  NET.hall.hbT=setInterval(()=>{ // heartbeat: refresh our listing; re-elect a fallen hall
    if(NET.mode!=="host"){clearInterval(NET.hall.hbT);return;}
    if(NET.hall.role==="client"&&NET.hall.conn&&NET.hall.conn.open){
      if(NET.isPublic)try{NET.hall.conn.send({t:"announce",s:NET.hallEntryOwn()});}catch(_){}
    }else if(NET.hall.role!=="registry"){NET.hall.role="none";tryServe();}
  },20000);
};
// -------- the browser side: query the hall, paint the rows --------
NET.uiBrowse=function(){
  if(typeof Peer==="undefined"){msg("PeerJS failed to load — check your internet connection.","warn");return;}
  const box=document.getElementById("serverlist");
  box.style.display="block";
  box.innerHTML="<div class='svrow svempty'>🔭 Scanning the realm…</div>";
  let answered=false;
  const finish=list=>{if(answered)return;answered=true;NET.renderServers(list);};
  try{
    if(!NET._browsePeer){
      NET._browsePeer=new Peer(NET.peerOpts());
      NET._browsePeer.on("error",e=>{if(e&&e.type==="peer-unavailable")finish([]);});
    }
    const bp=NET._browsePeer;
    const go=()=>{
      const c=bp.connect(HALL_ID,{reliable:true});
      c.on("open",()=>{try{c.send({t:"list"});}catch(_){}});
      c.on("data",d=>{if(d&&d.t==="servers"){finish(d.list||[]);try{c.close();}catch(_){}}});
      c.on("error",()=>finish([]));
    };
    if(bp.open)go(); else bp.on("open",go);
  }catch(_){finish([]);}
  setTimeout(()=>finish([]),7000); // an empty realm answers with silence
};
NET.renderServers=function(list){
  const box=document.getElementById("serverlist"); if(!box)return;
  box.style.display="block";
  if(!list||!list.length){
    box.innerHTML="<div class='svrow svempty'>No open halls right now — HOST one, or join by code.</div>";
    return;
  }
  let html="";
  for(const s of list){
    const stale=s.proto!==NET.PROTO;
    html+="<div class='svrow"+(stale?" svold":"")+"' data-code='"+String(s.code||"").replace(/[^a-z0-9-]/g,"")+"'>"+
      "<span class='svname'>"+String(s.name||"Warrior").slice(0,14).replace(/[<>&]/g,"")+"'s hall</span>"+
      "<span class='svmeta'>"+(s.mode==="coop"?"🤝 CO-OP":"⚔ PvP")+"</span>"+
      "<span class='svmeta'>"+(s.players|0)+" playing</span>"+
      (stale?"<span class='svmeta'>⚠ other version</span>":"<span class='svmeta'>JOIN ▸</span>")+
      "</div>";
  }
  box.innerHTML=html+"<div class='svrow svempty'>🔭 click BROWSE again to refresh</div>";
  box.querySelectorAll(".svrow[data-code]").forEach(row=>{
    row.onclick=()=>{
      if(row.classList.contains("svold"))return;
      document.getElementById("joincode").value=row.dataset.code;
      NET.uiJoin();
    };
  });
};
// -------- host: drive possessed bodies from their owners' inputs --------
NET.hostFrame=function(dt){
  NET._cFrames=(NET._cFrames||0)+1; // fps for the net log
  NET._tagT=(NET._tagT||0)+dt;
  if(NET._tagT>1){NET._tagT=0;
    const sc=[[NET.myName,0,player.team,player.id,player.lvl||0]];
    for(const k in NET.remotes){const rr=NET.remotes[k];if(rr.unit)sc.push([rr.name,0,rr.unit.team,rr.unit.id,rr.unit.lvl||0]);}
    syncNameTags(sc);
  }
  // v128.5: sample BEFORE driving the guests, so a guest's attack this frame is resolved against
  // the same history every other system saw — and so the newest slot is the end of last frame,
  // never a half-updated world.
  NET.histSample(NET.now());
  for(const k in NET.remotes)NET.driveRemote(NET.remotes[k],dt);
  // ---- v126: THE CADENCE IS WALL TIME, NOT SIM TIME ----
  // Both timers used to accumulate `dt`, which 09-main clamps to 0.05 — so on a host at
  // 10–19 fps they ran at the SIM clock's 0.74–0.85×. Two consequences, both measured in
  // John's logs. (1) SNAP_HZ:15 was really 12.3 snaps per WALL second (p10: 0.0) — and the
  // guest lives in wall time, so that is straight-up lost smoothness. (2) far worse, the
  // "one row per second" flight recorder was one row per SIM second: host rows came up to
  // 2.04s apart, so `fps` and `sent` were inflated by as much as 2× in precisely the seconds
  // worth reading. Logged fps said 21/20/20 (med/p10/min); the truth was 18.8/13.4/9.8.
  // A recorder that flatters the host exactly when the host is the problem is worse than none.
  const wnow=NET.now();
  if(!NET._snapW)NET._snapW=wnow;
  const snapMs=1000/NET.SNAP_HZ;
  if(wnow-NET._snapW>=snapMs){
    // v97's remainder carry, in wall time: advance by whole periods but never bank more than
    // one, so a long stall does not fire a burst of snaps the moment the loop comes back
    NET._snapW=Math.max(NET._snapW+snapMs,wnow-snapMs);
    NET.bcastFast(NET.packSnap());
  }
  if(!NET._diagW)NET._diagW=wnow;
  if(wnow-NET._diagW>=1000){
    const winMs=wnow-NET._diagW; // the window we ACTUALLY measured — logged, so rates are checkable
    NET._diagW=wnow;
    { // v98: one net-log row per second — sample BEFORE the windows reset
      const g={};
      for(const k in NET.remotes){const rr=NET.remotes[k];if(!rr.unit)continue;
        const fu=rr.fast&&rr.fast.open;
        // v128.4: `sent` was sentF — FAST LANE ONLY. The reliable send incremented nothing, so
        // whenever the fast lane was down this row read sent:0 skipF:0 skipR:0 and looked idle
        // while the host was flooding 15Hz into a stalled pipe. That blind spot is why the
        // freeze survived 30 versions of reading these logs. sentR/holdR/lag close it.
        g[rr.name]={ping:rr.rtt||0,sent:rr.sentF||0,sentR:rr.sentR||0,holdR:rr.holdR||0,
          skipF:rr.skipF||0,skipR:rr.skipR||0,
          buf:NET.laneBuf(fu?rr.fast:rr.conn),
          lag:(typeof rr.ackQ==="number"&&typeof rr._relQ==="number")?(rr._relQ-rr.ackQ):-1,
          rw:typeof rr._rwMs==="number"?rr._rwMs:-1, // v128.5: the rewind actually GRANTED, not asked for
          claim:rr.input&&typeof rr.input.at==="number"?1:0, // …and whether this guest stamps at all
          inAge:rr.inputAt?Math.round(NET.now()-rr.inputAt):-1,
          seen:rr.seenAt?Math.round(NET.now()-rr.seenAt):-1,fast:fu?1:0};}
      // v126: `win` is the true window in ms and `simR` is the sim clock's rate against wall
      // time over it. simR is the single number that would have made this whole bug obvious
      // on sight — 0.85 in John's session, 0.74 whenever the host was at 20 fps. Every rate
      // in this row is per `win`, not per second: divide, don't assume.
      const simR=NET._simT0===undefined?1:Math.round(((T-NET._simT0)/(winMs/1000))*100)/100;
      NET._simT0=T;
      NET.logRow({t:Date.now(),T:r1(T),role:"h",fps:NET._cFrames||0,win:Math.round(winMs),simR,
        units:units.length,blds:buildings.length,g});
      NET._cFrames=0;
    }
    NET.reapPeers(); // v128.4: the only place a departure that fired no transport event is caught
    NET.lobby();
    for(const k in NET.remotes){const rr=NET.remotes[k];rr.sentF=0;rr.sentR=0;rr.holdR=0;rr.skipF=0;rr.skipR=0;} // per-second windows
  }
};
NET.note=function(r,m,tone){try{r.conn.send({t:"note",m,tone});}catch(_){}};
NET.driveRemote=function(r,dt){
  const u=r.unit;
  // v95: inputs older than INPUT_STALE_MS are DEAD inputs — when a guest's uplink
  // clogs, their body stops in its tracks instead of ghost-walking on the last keys.
  // ---- v126: the cliff became a ramp, and the ledge moved with the ping ----
  // Both of John's guests spent 13–15% of their seconds past this line (inAge p90 1470ms /
  // 1162ms against a 600ms limit, and their ping p90 was 537ms / 737ms), so a fixed 600ms
  // was calling a normal round trip a dead uplink. The ledge is now whichever is later:
  // 600ms, or 2.5 round trips — a guest cannot be declared silent faster than their own
  // network can speak. Past it, the body EASES to a halt over INPUT_EASE_MS instead of
  // dropping mid-stride: still no ghost-walking (`hold` reaches 0 and stays there), but a
  // 700ms hiccup now reads as a stumble rather than a freeze.
  const ageMs=r.inputAt?(NET.now()-r.inputAt):0;
  const ledge=Math.max(NET.INPUT_STALE_MS,Math.round((r.rtt||0)*2.5));
  const over=r.inputAt?(ageMs-ledge):0;
  const stale=over>=NET.INPUT_EASE_MS;               // fully silent: no input at all
  const hold=over<=0?1:Math.max(0,1-over/NET.INPUT_EASE_MS); // …and the ramp in between
  r._hold=hold;
  const i=(stale?{}:r.input)||{};
  if(!u||!u.alive){r.lastE=!!i.e;return;}
  // stances
  if((u.cls==="catapult"||u.cls==="trebuchet")&&typeof i.lobx==="number"){
    if(u.atkT<=0){
      const dx=i.lobx-u.root.position.x,dz=i.lobz-u.root.position.z,dd=Math.hypot(dx,dz);
      const maxD=u.cls==="trebuchet"?u.rng+8:46; // v97: the SAME reach the aiming UI shows (catapults were clamped 8 short for guests)
      const cl=Math.min(1,maxD/Math.max(1,dd));
      launchLob(u,u.root.position.x+dx*cl,u.root.position.z+dz*cl);
      u.atkT=u.cd;
    }
    i.lobx=undefined;
  }
  // ---- v124 THE DRAW, host-authoritative ----
  // The host watches the guest hold, so the guest can never claim more charge than it actually
  // built. `blk` is what aiming looks like on the wire for a ranged class, and a stale/dropped
  // packet simply stops the clock rather than granting free charge.
  const _lobber=(u.cls==="catapult"||u.cls==="trebuchet");
  const _rangedAim=!!i.blk&&!!u.ranged&&!_lobber;
  if(_rangedAim&&i.atk&&isDrawClass(u.cls)&&u.atkT<=0)r.drawT=(r.drawT||0)+dt;
  // v128.5: only an OBSERVED released trigger clears the draw. `stale` swaps r.input for {} when
  // the uplink dies, and the old `else if(!i.atk)` read that silence as "let go" — so a guest on
  // a lossy link was robbed of charge it was actually holding. No input is not a released one.
  else if(!i.atk&&!stale)r.drawT=0;
  // v128.5 THE REWIND WINDOW for everything this guest does this frame. The claim rides the
  // input packet as `at`; rewindTime clamps it to what this peer's own measured rtt earns.
  const rwT=NET.rewindTime(r,i.at);
  if(i.shot&&typeof i.shot.dx==="number"){
    const d=new THREE.Vector3(i.shot.dx,i.shot.dy,i.shot.dz);
    if(d.lengthSq()>0.0001){
      d.normalize();
      // clamp the CLAIM to the hold the host observed — this is the whole point of the exercise
      const seen=Math.min(1,(r.drawT||0)/DRAW_FULL);
      const lv=isDrawClass(u.cls)?Math.min(Number(i.shot.lv)||0,seen):1;
      fireAimedFor(u,d,lv,rwT); // …and loose it from the world the guest was looking at
      r.drawT=0;
    }
    i.shot=undefined;
  }
  if(u.cls==="dragoon"){
    u.blocking=false;
    if(i.blk&&!r.blkUsed&&(u.ammo||0)>0&&u.atkT<=0){
      // v128.5: 12 was a guest-only PENALTY against the host's and the AI's 15 — a shorter
      // pistol for the laggier player. Same reach for everyone now, picked from rewound
      // positions so the target the guest actually saw is the one that gets shot.
      const t=pistolTarget(u,15,rwT); if(t)pistolShot(u,t);
    }
    r.blkUsed=!!i.blk; // edge-trigger: one shot per press
  }else u.blocking=!!i.blk&&canBlock(u);
  // ---- E TAP: garrison / harvest / trade — mirrors playerInteract ----
  const px0=u.root.position.x, pz0=u.root.position.z;
  // v128.4 A TAP THE PINNED BIT CANNOT HIDE. The mobile auto-gather (12-touch.js autoTick)
  // writes keys.e every animation frame on a guest and runs BEFORE guestFrame, so it owns
  // whatever the uplink samples: with a node in reach `e` is pinned 1 and this rising edge
  // never fires; with no node in reach it is pinned 0 and the USE button's press is erased
  // before it ships. E was the only player action with no discrete message — every other one
  // is a guestAct RPC — which is exactly why only this button broke, and only on a phone.
  // `et` is a monotonic tap count, OPTIONAL on the wire (an old host reads the `e` bit as
  // before, so no PROTO bump); the held bit still drives hold-to-gather untouched.
  const eTap=typeof i.et==="number"&&i.et!==r.lastET;
  if(eTap)r.lastET=i.et;
  if((i.e&&!r.lastE)||eTap){
    r.eUsed=false;
    if(u.garrison){ // climb down
      const b=u.garrison; u.garrison=null; setClassStats(u); u.deckX=u.deckZ=0;
      u.root.position.set(b.x+(b.def.r+1.6),0,b.z);
      u.root.position.y=terrainHeight(u.root.position.x,u.root.position.z);
      NET.note(r,"You climb down from the watch tower.");
      try{r.conn.send({t:"snd",k:"garrison",x:b.x,z:b.z});}catch(_){} // v104: the acting guest hears it
      r.eUsed=true;
    }
    if(!r.eUsed)for(const b of buildings){ // climb up
      if(b.team===u.team&&b.alive&&b.built&&b.type==="watch_tower"&&
         dist2(px0,pz0,b.x,b.z)<Math.pow(b.def.r+2.4,2)&&!CLS[u.cls].mounted&&!isSiege(u.cls)){
        u.garrison=b; u.rng*=1.35; u.gathering=null;
        NET.note(r,"You man the watch tower — loose arrows from on high. E climbs down.","blue");
        try{r.conn.send({t:"snd",k:"garrison",x:b.x,z:b.z});}catch(_){} // v104
        r.eUsed=true;break;
      }
    }
    if(!r.eUsed)for(const b of buildings){ // harvest ripe corn
      if(b.team===u.team&&b.alive&&b.built&&b.type==="farm"&&b.crop>=1&&u.cls==="villager"&&
         dist2(px0,pz0,b.x,b.z)<Math.pow(b.def.r+2.5,2)){
        b.crop=0;
        awardPts(u,20);
        questProgress(u,"harvest");      // REAPER
        questProgress(u,"dep_food",20);  // banked food is banked food
        if(b.cropMesh){b.cropMesh.scale.y=0.15;for(const t of b.tassels)t.visible=false;}
        stock[u.team].food+=20; updateResHud();
        NET.note(r,"Harvested the corn: +20 food, straight to the stockpile.","blue");
        try{r.conn.send({t:"snd",k:"harvest",x:b.x,z:b.z});}catch(_){} // v104
        r.eUsed=true;break;
      }
    }
    if(!r.eUsed&&u.cls==="trader")for(const nm of neutralMarkets){ // load goods
      if(dist2(px0,pz0,nm.x,nm.z)<7*7){
        if(u.tradeLoaded)NET.note(r,"Your cart is already loaded — sell at YOUR Market first.");
        else{u.tradeLoaded=nm;NET.note(r,"Goods loaded! Haul them back to your Market to sell.","blue");try{r.conn.send({t:"snd",k:"bazaarload",x:u.root.position.x,z:u.root.position.z});}catch(_){}} // v104
        r.eUsed=true;break;
      }
    }
    if(!r.eUsed){ // v87 THE TOWN BOARD: the host reads the guest their quest
      const brd=boardFor(u.team);
      if(brd&&dist2(px0,pz0,brd.x,brd.z)<BOARD_REACH*BOARD_REACH){useTownBoard(u);r.eUsed=true;}
    }
    if(!r.eUsed){ // v87 THE BLACKSMITH: the guest's XP is spent host-side, validated by proximity
      const bs=nearestBuilt(u.team,"blacksmith",px0,pz0,BLD.blacksmith.r+2.6);
      if(bs){useBlacksmith(u);r.eUsed=true;}
    }
  }
  r.lastE=!!i.e; if(!i.e)r.eUsed=false;
  // v96 FACING RELAY: the guest's body facing arrives with every input packet.
  // The old leash glided the FEET but never the FACE — a guest circling the host
  // stared one way until an attack happened to reset it. Host-side actions
  // (attack whiff, deck strides) may still override within a frame — exactly as
  // they do on the guest's own screen — and the next packet re-syncs.
  if(typeof i.f==="number"&&isFinite(i.f))u.facing=i.f;
  // ---- garrisoned: walk the deck, rain arrows — same freedom the host player gets ----
  if(u.garrison){
    const gb=u.garrison;
    if(!gb.alive){
      u.garrison=null; setClassStats(u);
      u.root.position.y=terrainHeight(u.root.position.x,u.root.position.z);
      NET.note(r,"The watch tower falls from under you!","warn");
    }else{
      const deck=gb.deck||{y:7.15,r:2.4};
      let gmx=0,gmz=0;
      if(i.w)gmz-=1; if(i.s)gmz+=1; if(i.a)gmx-=1; if(i.d)gmx+=1;
      if(gmx||gmz){
        const dir=new THREE.Vector3(gmx,0,gmz).applyAxisAngle(new THREE.Vector3(0,1,0),i.yaw||0);
        const L=Math.hypot(dir.x,dir.z)||1;
        u.deckX=(u.deckX||0)+dir.x/L*u.spd*dt*0.7;
        u.deckZ=(u.deckZ||0)+dir.z/L*u.spd*dt*0.7;
        const dd=Math.hypot(u.deckX,u.deckZ);
        if(dd>deck.r){u.deckX*=deck.r/dd;u.deckZ*=deck.r/dd;}
        u.facing=Math.atan2(dir.x,dir.z); u.moving=true; u._mv=T; u.walkT+=dt*5;
      }else u.moving=false;
      u.root.position.set(gb.x+(u.deckX||0),gb.root.position.y+deck.y,gb.z+(u.deckZ||0));
      if(i.atk)tryAttack(u);
      return; // no gathering or depositing from up there
    }
  }
  // ---- trader auto-sell at their own Market (4× cart rates) ----
  if(u.cls==="trader"&&u.tradeLoaded){
    const mk=nearestBuilt(u.team,"market",px0,pz0,8);
    if(mk){
      const d=Math.hypot(mk.x-u.tradeLoaded.x,mk.z-u.tradeLoaded.z);
      // v87: 2.5× — the same premium the host player gets (was 4×, a v84 leftover)
      const g=Math.round(2.5*tradeGold(d)*(1+0.10*buffSt(u,"trade"))); // DEEP POCKETS
      awardPts(u,g);
      questTradeSale(u,u.tradeLoaded); // the route quests count the sale
      stock[u.team].gold+=g; updateResHud();
      NET.note(r,"Sold your goods: +"+g+" gold! (trader premium)","blue");
      u.tradeLoaded=null;
    }
  }
  // THE LEASH: the guest already ran this movement through the same collision
  // code — within 6 units, their reported feet ARE the truth. Melee range now
  // matches what they see, and the authority echo cancels the rubber band.
  let trusted=false, moved=false;
  if(typeof i.px==="number"&&!u.garrison){
    let dl=Math.hypot(i.px-u.root.position.x,i.pz-u.root.position.z);
    if(dl>=6&&dl<14){ // stretched leash: adopt the guest's feet ONCE and carry on —
      u.root.position.x=i.px; u.root.position.z=i.pz; dl=0; // never fight a second simulation
    }
    if(dl<6){
      if(dl>0.02){
        const gk=Math.min(1,dt*16); // glide between 20Hz inputs — no 20Hz stepping
        u.root.position.x+=(i.px-u.root.position.x)*gk;
        u.root.position.z+=(i.pz-u.root.position.z)*gk;
        moved=dl>u.spd*dt*0.4;
      }
      trusted=true;
      u.moving=!!(i.w||i.a||i.s||i.d);
      if(u.moving){u._mv=T;u.walkT+=dt*(3.5+(u.spd||3)*0.75);} // stride even without moveUnit
      u._lpx=i.px;u._lpz=i.pz;
    }
  }
  // fallback: outside the leash (or old clients), the host walks the body itself
  let mx=0,mz=0,mag=1;
  // v124: prefer the guest's ANALOG vector when it sent one; fall back to the bits when it did not
  // (a v123 client, or a desktop player on keys). Either way this path only runs outside the leash.
  if(typeof i.mx==="number"&&(i.mx||i.mz)){
    mx=i.mx; mz=i.mz;
    const L=Math.hypot(mx,mz);
    mag=Math.max(0,Math.min(1,L));      // never let a guest claim more than full deflection
  }else{
    if(i.w)mz-=1; if(i.s)mz+=1; if(i.a)mx-=1; if(i.d)mx+=1;
  }
  if(!trusted){
    // v126: `_hold` is the input-staleness ramp — 1 while the inputs are current, sliding to 0
    // across INPUT_EASE_MS once they pass the ledge. It rides `mag`, which already rides dt, so
    // the body decelerates instead of being switched off. At _hold 0 nothing moves at all.
    mag*=(r._hold===undefined?1:r._hold);
    if((mx||mz)&&mag>0.01&&!u.garrison){
      const dir=new THREE.Vector3(mx,0,mz).applyAxisAngle(new THREE.Vector3(0,1,0),i.yaw||0);
      moved=moveUnit(u,dir.x,dir.z,dt*mag*(u.blocking?0.55:1));
    }else u.moving=false;
  }
  // attack: auto-target like the player's primary, whiff included.
  // v124: a drawing archer holding primary is NOT swinging — it is nocking. Without this guard the
  // held atk bit would auto-fire an arrow every cooldown all the way through the draw.
  if(i.atk&&!u.blocking&&!(_rangedAim&&isDrawClass(u.cls))){
    // v128.5: tryAttack's target scans consult the rewind window while this is set. It is a
    // module global rather than a parameter because tryAttack fans out through four different
    // target scans (pistol, bayonet, melee, building) shared with the host player and every AI
    // bot — threading a time through all of them would change signatures the AI also calls.
    setRewind(rwT);
    const hit=tryAttack(u);
    setRewind(0);
    if(!hit&&u.atkT<=0&&u.dmg>0){
      u.atkT=u.cd*0.35; u.swing=0.25;
      u.facing=Math.atan2(-Math.sin(i.yaw||0),-Math.cos(i.yaw||0));
      triggerAttackAnim(u);
    }
  }
  const px=u.root.position.x, pz=u.root.position.z;
  // hold-E: construction first (villager), then gathering — mirrors updatePlayer
  if(i.e&&!moved&&!r.eUsed){
    let site=null,sd=1e12;
    for(const b of buildings){
      if(b.team!==u.team||!b.alive||b.built)continue;
      const reach=b.def.r+2.6; // stand at the 2x footprint's edge and still build — same as the host player
      const d=dist2(px,pz,b.x,b.z);
      if(d<reach*reach&&d<sd){sd=d;site=b;}
    }
    if(site&&u.cls==="villager"){
      u.gathering=null;
      u.buildT=(u.buildT||0)+dt; u.swing=Math.max(u.swing||0,0.12);
      u.facing=Math.atan2(site.x-px,site.z-pz);
      if(u.buildT>0.45){u.buildT=0;addConstructionHit(site,u);}
    }else if(u.cls==="villager"||u.cls==="oxcart"){ // v99: the ox gathers too — timber only
      if(!u.gathering||u.gathering.amount<=0){
        let n=null,nd=3.4*3.4;
        for(const nn of nodes){
          if(nn.amount<=0)continue;
          if(u.cls==="oxcart"&&nn.type!=="wood")continue; // the ox snubs everything but trees
          const d=dist2(px,pz,nn.x,nn.z);
          if(d<nd){nd=d;n=nn;}
        }
        if(n){u.gathering=n;u.gatherT=0;}
      }
      const n=u.gathering;
      if(n){
        u.gatherT+=dt; u.swing=Math.max(u.swing||0,0.12);
        u.facing=Math.atan2(n.x-px,n.z-pz);
        if(u.gatherT>(0.6-0.1*buffSt(u,"gather"))*(n.slow||1)){ // PRACTICED HANDS
          u.gatherT=0;
          const cap=carryCap(u); // DEEP SATCHEL (the ox bed holds 300)
          const total=u.carry.food+u.carry.gold+u.carry.stone+u.carry.wood;
          if(total>=cap)u.gathering=null;
          else{
            const tk=Math.min(u.cls==="oxcart"?4:1,n.amount,cap-u.carry[n.type]); // v99: four swings' worth for the ox
            if(tk>0){n.amount-=tk; u.carry[n.type]+=tk;} // the guest's pack is just as finite
            puff(n.x,1.5+(n.y||0),n.z,n.type==="food"?0xd23c2f:n.type==="gold"?0xe0a92e:n.type==="stone"?0x9aa2ad:0x8a6a3f);
            if(n.amount<=0)depleteNode(n);
          }
        }
      }
    }
  }
  // auto-deposit at TC / Storage Pit / Castle — same radii as the host player
  if(u.carry.food||u.carry.gold||u.carry.stone||u.carry.wood){
    let dep=nearestBuilt(u.team,"castle",px,pz,BLD.castle.r+3.5)||nearestBuilt(u.team,"storage_pit",px,pz,BLD.storage_pit.r+3.5);
    const tc=teamTC(u.team);
    if(!dep&&tc&&dist2(px,pz,tc.x,tc.z)<Math.pow(tc.def.r+3.5,2))dep=tc;
    if(dep){
      awardPts(u,u.carry.food+u.carry.gold+u.carry.stone+u.carry.wood);
      questDeposit(u,u.carry.food,u.carry.gold,u.carry.stone,u.carry.wood); // the collection quests
      stock[u.team].food+=u.carry.food;stock[u.team].gold+=u.carry.gold;
      stock[u.team].stone+=u.carry.stone;stock[u.team].wood+=u.carry.wood;
      u.carry.food=0;u.carry.gold=0;u.carry.stone=0;u.carry.wood=0;
      updateResHud();
    }
  }
};
// -------- host: validated guest actions (team stock pays, host decides) ----
NET.hostAct=function(r,a){
  const u=r.unit, deny=m=>{try{r.conn.send({t:"deny",m});}catch(_){}};
  if(!u||!u.alive)return deny("You are down — wait for your respawn.");
  if(a.act==="resurrect"){
    if(u.cls!=="priest")return deny("Only a priest can raise the dead.");
    const tgt=NET.unitById(a.id);
    if(!tgt||tgt.alive||!tgt.corpse||tgt.team!==u.team)return deny("No fallen ally to raise there.");
    if(isSiege(tgt.cls))return deny("Faith moves flesh, not cold iron — siege engines stay dead.");
    const d=dist2(u.root.position.x,u.root.position.z,tgt.root.position.x,tgt.root.position.z);
    const reach=RES_REACH+2.0; // a little slack for guest/host position drift
    if(d>reach*reach)return deny("Stand over the body to raise it.");
    if(T-(u._resAt||-1e9)<resCdFor(u)-0.3)return deny("Not enough faith yet."); // ZEALOTRY honored host-side
    resurrectUnit(tgt,u);
    return;
  }
  if(a.act==="train"){
    const d=CLS[a.cls];
    // v95: the old check (`!d.cost`) rejected every FREE class — so a guest who armed
    // up could NEVER go back to Villager (cost:null → "Unknown class"). Validate the
    // way the host's own menu does instead: villager and trader always, otherwise the
    // class must be what a training line actually offers at this team's age. That also
    // slams the door on hand-crafted acts training wilds (wolf, vikingboss…).
    const legit=d&&(a.cls==="villager"||a.cls==="trader"||a.cls==="oxcart"||
      Object.keys(LINES).some(l=>lineUnitFor(l,u.team)===a.cls));
    if(!legit)return deny("Unknown class.");
    if(d.cost&&!canAfford(u.team,d.cost))return deny("The team stockpile can't afford a "+d.name+".");
    if(d.cost)pay(u.team,d.cost);
    setClass(u,a.cls); updateResHud();
    if(a.cls!=="villager")questProgress(u,"train"); // MASTER-AT-ARMS
    msg(r.name+(a.cls==="villager"?" returns to the fields as a Villager.":" armed up as a "+d.name+"."),"blue");
    return;
  }
  if(a.act==="build"){
    const d=BLD[a.type]; if(!d)return deny("Unknown building.");
    if(!validFor(a.type,a.x,a.z,u.team))return deny("Can't build there — too close to something.");
    if(!canAfford(u.team,d.cost))return deny("Not enough resources for a "+d.name+".");
    pay(u.team,d.cost);
    const nb=makeBuilding(u.team,a.type,a.x,a.z,false,a.rot||0); nb.qBy=u.id; // quest credit on completion
    updateResHud();
    msg(r.name+" laid a "+d.name+" foundation.","blue");
    return;
  }
  if(a.act==="quest"){ // v99: the guest's pick (or redraw) at the Town Board draft
    const brd=boardFor(u.team);
    if(!brd||dist2(u.root.position.x,u.root.position.z,brd.x,brd.z)>Math.pow(BOARD_REACH+2,2))
      return deny("Stand at the Town Board.");
    if(a.redraw){
      if(!questRedraw(u))return deny("No rerolls banked — gain a level to earn one.");
      try{r.conn.send({t:"qdraft",offer:u.questDraft.slice(),rr:u.qRerolls||0});}catch(_){} // re-lay the fresh trio
      return;
    }
    if(!questPick(u,a.pick|0))return deny("That posting isn't on the board — press E to read it.");
    return;
  }
  if(a.act==="buff"){ // v93: the guest chose one of the three on the smith's table
    const bs=nearestBuilt(u.team,"blacksmith",u.root.position.x,u.root.position.z,BLD.blacksmith.r+4.6); // +2 drift slack
    if(!bs)return deny("Stand at the Blacksmith to trade XP for steel.");
    if((u.xp||0)<1)return deny("No XP to spend — finish Town Board quests.");
    if(!smithPick(u,String(a.pick||"")))return deny("That piece isn't on the table — press E at the forge for the standing offer.");
    return;
  }
  if(a.act==="charge"){ // F: the guest hurls the rallied line down their own gaze
    const n=orderCharge(u,typeof a.yaw==="number"?a.yaw:0);
    if(!n)return deny("No rallied soldiers to charge — press G to rally them first.");
    msg(r.name+" sounds the CHARGE!","warn");
    NET.note(r,"⚔ CHARGE! Your rallied soldiers storm ahead — they'll hold the far ground (G recalls them).","gold");
    return;
  }
  if(a.act==="rally"){ // v89: the same cap-aware horn the host blows (Bannerman honored host-side)
    const res=toggleRallyFor(u);
    if(!res)return deny("No allied soldiers to rally yet.");
    msg(res.on?"⚑ "+r.name+" rallies "+res.n+" soldiers!":r.name+" sends the soldiers home.","blue");
    NET.note(r,res.on?"⚑ "+res.n+" soldiers rally to YOU (cap "+rallyCapFor(u)+" — Bannerman adds more). G recalls · F charges."
                     :"Soldiers return to guard the King.","blue");
    return;
  }
  if(a.act==="gate"){
    const w=NET.bldById(a.wid), d=BLD[a.type];
    if(!w||!w.alive||!w.built||w.team!==u.team||!w.def.wall||w.def.gate)return deny("Aim at one of your BUILT wall segments.");
    if(!d||!d.gate)return deny("That is not a gate.");
    if(!canAfford(u.team,d.cost))return deny("The stockpile can't afford a "+d.name+".");
    pay(u.team,d.cost); placeGateOnWall(w,a.type,u.team); updateResHud();
    msg(r.name+" set a gate into the wall.","blue");
    return;
  }
  if(a.act==="ageup"){
    const tc=teamTC(u.team);
    if(!tc||dist2(u.root.position.x,u.root.position.z,tc.x,tc.z)>12*12)
      return deny("Stand at your Town Center to advance the age (T).");
    const nxt=AGES[teamAge[u.team]+1];
    if(!nxt)return deny("Your civilization is already in the final age.");
    if(ageResT[u.team]>0)return deny("⏳ Your team is already advancing — "+Math.ceil(ageResT[u.team])+"s to go.");
    if(!canAfford(u.team,nxt.cost))return deny(nxt.name+" costs "+costText(nxt.cost)+".");
    startAgeResearch(u.team); // v107: the guest pays now too — the countdown rides every snap
    return;
  }
};
// -------- host: the wire format --------
NET.packWorld=function(uid){
  return {t:"world",uid,T:r1(T),ages:[teamAge[BLUE],teamAge[RED]],
    ares:[r1(ageResT[BLUE]),r1(ageResT[RED])], // v107: a late joiner sees the running countdown
    stock0:{f:Math.floor(stock[BLUE].food),g:Math.floor(stock[BLUE].gold),
            s:Math.floor(stock[BLUE].stone),w:Math.floor(stock[BLUE].wood)},
    stock1:{f:Math.floor(stock[RED].food),g:Math.floor(stock[RED].gold),
            s:Math.floor(stock[RED].stone),w:Math.floor(stock[RED].wood)},
    units:units.map(u=>[u.id,u.cls,u.alive?1:0,r1(u.root.position.x),r1(u.root.position.z),
      r1(u.facing),Math.round(u.hp),Math.round(u.maxHp),u.isPlayer?"Host":u.name,u.team]),
    blds:buildings.map(b=>[b.id,b.team,b.type,r1(b.x),r1(b.z),r1(b.rot||0),
      b.built?1:0,b.progress,Math.round(b.hp),b.alive?1:0,r1(b.crop||0)]),
    nodes:nodes.map(n=>Math.max(0,Math.round(n.amount))),
    camps:campStates.map(s=>[s.chest?s.chestKind:null,s.chestB?s.chestKindB:null])}; // standing chests (both slots) for the late joiner
};
// ---- v95 THE WIRE DIET (v99: +the cargo byte) ----
// Unit rows travel as PACKED BINARY: 18 bytes each in one ArrayBuffer instead of a
// ~45-byte JSON array — PeerJS's BinaryPack ships raw buffers untouched. Layout:
//   u16 id · u8 clsIdx · u8 flags(1 alive|2 moving|4 swing|pulse<<3) ·
//   i16 x*10 · i16 z*10 · i16 facing*100 · i16 hp · i16 maxHp · u8 respawn ·
//   u16 garrisonId+1 · u8 cargo*100 (v99: every client SEES what a cart hauls)
const SNAP_ROW_B=18;
NET.packRows=function(rows){
  const buf=new ArrayBuffer(rows.length*SNAP_ROW_B), dv=new DataView(buf);
  let o=0;
  for(const w of rows){
    dv.setUint16(o,w[0]); dv.setUint8(o+2,w[1]); dv.setUint8(o+3,w[2]);
    dv.setInt16(o+4,w[3]); dv.setInt16(o+6,w[4]); dv.setInt16(o+8,w[5]);
    dv.setInt16(o+10,w[6]); dv.setInt16(o+12,w[7]); dv.setUint8(o+14,w[8]);
    dv.setUint16(o+15,w[9]); dv.setUint8(o+17,w[10]||0); o+=SNAP_ROW_B;
  }
  return buf;
};
NET.readSnapRows=function(s){ // shared by applySnap and the smoketest — one decoder, no drift
  if(!s.ub)return s.units||[];
  let ab=s.ub, off=0, len=0;
  if(ab.buffer){off=ab.byteOffset||0;len=ab.byteLength;ab=ab.buffer;} // some transports hand back a view
  else len=ab.byteLength;
  const dv=new DataView(ab,off,len), n=Math.min(s.un||0,Math.floor(len/SNAP_ROW_B)), out=[];
  for(let i=0;i<n;i++){
    const o=i*SNAP_ROW_B;
    out.push([dv.getUint16(o),dv.getUint8(o+2),dv.getUint8(o+3),dv.getInt16(o+4),dv.getInt16(o+6),
      dv.getInt16(o+8),dv.getInt16(o+10),dv.getInt16(o+12),dv.getUint8(o+14),dv.getUint16(o+15),
      dv.getUint8(o+17)]);
  }
  return out;
};
// v97: building rows go binary too — 8 bytes each (u16 id · u16 hp · u8 flags[1 built|2 alive] ·
// u16 progress · u8 crop*10). During heavy construction the old JSON rows (~28B each, with a FULL
// set every second) were the fattest thing on the wire — the "everyone's building, ping hits 1000"
// spike was the host's uplink drowning in them.
const BLD_ROW_B=8;
NET.packBldRows=function(brows){
  const buf=new ArrayBuffer(brows.length*BLD_ROW_B), dv=new DataView(buf);
  let o=0;
  for(const w of brows){
    dv.setUint16(o,w[0]); dv.setUint16(o+2,Math.max(0,Math.min(65535,w[1])));
    dv.setUint8(o+4,(w[2]?1:0)|(w[4]?2:0));
    dv.setUint16(o+5,Math.max(0,Math.min(65535,Math.round(w[3]||0))));
    dv.setUint8(o+7,Math.max(0,Math.min(250,Math.round((w[5]||0)*10)))); o+=BLD_ROW_B;
  }
  return buf;
};
NET.readBldRows=function(s){ // → [id,hp,built,progress,alive,crop] — the shape applySnap always ate
  if(!s.bb)return s.blds||[];
  let ab=s.bb, off=0, len=0;
  if(ab.buffer){off=ab.byteOffset||0;len=ab.byteLength;ab=ab.buffer;}
  else len=ab.byteLength;
  const dv=new DataView(ab,off,len), n=Math.min(s.bn||0,Math.floor(len/BLD_ROW_B)), out=[];
  for(let i=0;i<n;i++){
    const o=i*BLD_ROW_B, fl=dv.getUint8(o+4);
    out.push([dv.getUint16(o),dv.getUint16(o+2),fl&1,dv.getUint16(o+5),(fl&2)?1:0,dv.getUint8(o+7)/10]);
  }
  return out;
};
NET.packSnap=function(){
  const carry={}, centers=[];
  for(const k in NET.remotes){
    const u=NET.remotes[k].unit;
    if(u){carry[u.id]=[u.carry.food,u.carry.gold,u.carry.stone,u.carry.wood,u.tradeLoaded?1:0];
      if(u.alive)centers.push(u.root.position);} // AOI centers: the guests' own eyes
  }
  NET._snapN++;
  // DELTA ROWS: a unit ships only when its row actually changed since the last SENT copy.
  // Idle crowds cost nothing. Every 15th snap is a full refresh (the fast lane drops packets),
  // and player bodies + kings ride EVERY snap so the authority echo never goes stale.
  // v95 AOI: position-only changes on units far from EVERY guest ship at quarter rate —
  // distant skirmishes glide at 4Hz nobody can tell apart at that range; structural
  // changes (death, class, garrison) always ship immediately, however far.
  const init=!NET._lastRow;
  const full=init||(NET._snapN%15===0);
  const bfull=init||(NET._snapN%45===0); // v97: building drops heal in 3s, not 1 — fulls were pure overhead most seconds
  if(init){NET._lastRow={};NET._lastStruct={};NET._lastBld={};}
  const playerIds={}; playerIds[player.id]=1;
  for(const k in NET.remotes){const rr=NET.remotes[k];if(rr.unit)playerIds[rr.unit.id]=1;}
  const rows=[], NEAR2=NET.AOI_NEAR*NET.AOI_NEAR;
  for(const u of units){
    const p=u.root.position, working=(u.swing>0.05||u.attackAnimT>0);
    const pulse=working?(Math.floor(T*2)&3):0; // v95 WORK PULSE: stationary swings re-announce every 0.5s
    const flags=(u.alive?1:0)|((T-(u._mv||-9)<0.15)?2:0)|(working?4:0)|(pulse<<3);
    const row=[u.id,CLS_IDX[u.cls]||0,flags,
      Math.round(p.x*10),Math.round(p.z*10),
      Math.round(u.facing*100),Math.round(u.hp),Math.round(u.maxHp),
      u.alive?0:Math.ceil(Math.min(99,u.respawnT||0)),u.garrison?u.garrison.id+1:0,
      Math.round(cargoFrac(u)*100)]; // v99: the cargo byte
    const key=row.join(",");
    let ship=full||playerIds[u.id]||u.isKing;
    if(!ship&&NET._lastRow[u.id]!==key){
      ship=true;
      if(centers.length){
        const struct=row[1]+","+(flags&1)+","+row[9]; // class | alive | garrison
        if(NET._lastStruct[u.id]===struct){ // nothing structural — this is motion/anim only
          let near=false;
          for(const c of centers)if(dist2(p.x,p.z,c.x,c.z)<NEAR2){near=true;break;}
          if(!near&&((NET._snapN+u.id)%NET.AOI_FAR_EVERY)!==0)ship=false; // staggered far-rate
        }
      }
    }
    if(ship){rows.push(row);NET._lastRow[u.id]=key;NET._lastStruct[u.id]=row[1]+","+(flags&1)+","+row[9];}
  }
  const ub=NET.packRows(rows);
  // v126 `ht`: the host's OWN monotonic clock at send time, in ms. OPTIONAL and additive, so
  // PROTO stays 25 — a v125 guest ignores the field and keeps using the old estT comparison.
  // It exists because snapshot AGE is a wall-clock question and `T` is a sim clock: 09-main
  // clamps dt to 0.05, so a host at 10–19 fps runs T at 0.74–0.85× and every guest concluded
  // the feed was seconds stale when it was milliseconds fresh. Nothing derives game state from
  // `ht` — it is only ever compared against a LATER value of itself, so the two machines never
  // need a shared clock or an offset estimate.
  const s={t:"snap",q:NET._q++,T:r1(T),
    ht:Math.round(NET.now()),
    ages:[teamAge[BLUE],teamAge[RED]],
    over:gameOver?1:0,
    ub,un:rows.length};
  // ---- v127: THE ENVELOPE GOES ON THE SAME DIET THE ROWS HAVE BEEN ON SINCE v95 ----
  // Unit rows ship only when they change; building rows ship only when they change; and then
  // `stock0`, `stock1`, `carry` and `ares` were re-sent in full FIFTEEN TIMES A SECOND. Measured
  // with PeerJS's own serializer (tools/netprofile.js): 69 B/snap for stock+carry alone, and in
  // a 300-snapshot sample they were byte-identical to the previous snapshot 100% of the time —
  // about 1.0 KB/s per guest of pure repetition, on a host whose send buffer was at or over
  // BUF_FAST_MAX for 11–13% of John's session. `ares` is worse than redundant: the guest already
  // interpolates the countdown locally via tickAgeResearch(dt,false), so 15Hz of authoritative
  // overwrite was fighting its own smoothing.
  //
  // The healing story is the one the rows already use — `full` is the every-15th-snap keyframe,
  // so anything dropped is re-sent within a second. A guest applies only the fields present.
  // THIS IS WHY PROTO WENT TO 26: a v125/v126 guest does `stock[BLUE].food=s.stock0.f` with no
  // guard, so an absent field would write NaN into the treasury rather than being ignored. That
  // is a misread, which is exactly the case the bump rule exists for — and the hall list already
  // refuses a mismatched peer with "⚠ other version" instead of letting it join and break.
  const stockKey=Math.floor(stock[BLUE].food)+","+Math.floor(stock[BLUE].gold)+","+
    Math.floor(stock[BLUE].stone)+","+Math.floor(stock[BLUE].wood)+"|"+
    Math.floor(stock[RED].food)+","+Math.floor(stock[RED].gold)+","+
    Math.floor(stock[RED].stone)+","+Math.floor(stock[RED].wood);
  if(full||NET._lastStock!==stockKey){
    NET._lastStock=stockKey;
    s.stock0={f:Math.floor(stock[BLUE].food),g:Math.floor(stock[BLUE].gold),
              s:Math.floor(stock[BLUE].stone),w:Math.floor(stock[BLUE].wood)};
    s.stock1={f:Math.floor(stock[RED].food),g:Math.floor(stock[RED].gold),
              s:Math.floor(stock[RED].stone),w:Math.floor(stock[RED].wood)};
  }
  const carryKey=JSON.stringify(carry);
  if(full||NET._lastCarry!==carryKey){NET._lastCarry=carryKey;s.carry=carry;}
  // the countdown only needs to ARRIVE; between arrivals the guest ticks it down itself
  if(full||(NET._snapN%Math.max(1,Math.round(NET.SNAP_HZ/2)))===0)
    s.ares=[r1(ageResT[BLUE]),r1(ageResT[RED])]; // v107: the 90s advance countdown, now at ~2Hz
  if(NET._snapN%3===0){ // 5Hz is plenty for scores/levels — tags cache by text anyway
    s.sc=[[NET.myName,Math.round(player.score||0),player.team,player.id,player.lvl||0]];
    for(const k in NET.remotes){const rr=NET.remotes[k];if(rr.unit)s.sc.push([rr.name,Math.round(rr.unit.score||0),rr.unit.team,rr.unit.id,rr.unit.lvl||0]);}
  }
  { // v95: buildings ship as DELTAS — only rows that changed (usually none), full set on refresh.
    // v97: rows are BINARY (8B) and the delta key IS the quantized wire row — sub-quantum
    // wiggles (crop growing 1%, fractional hp decay) no longer re-ship a building.
    const brows=[];
    for(const b of buildings){
      const brow=[b.id,Math.round(b.hp),b.built?1:0,Math.round(b.progress||0),b.alive?1:0,r1(b.crop||0)];
      const bkey=brow.join(",");
      if(bfull||NET._lastBld[b.id]!==bkey){brows.push(brow);NET._lastBld[b.id]=bkey;}
    }
    if(brows.length){s.bb=NET.packBldRows(brows);s.bn=brows.length;}
  }
  if(NET._fx.length)s.fx=NET._fx.splice(0,NET._fx.length); // batched arrow theatre rides the snap
  // wire-size estimate for the guest's KB/s readout. v127: it used to add a flat 140 for the
  // envelope and never counted `carry` at all, which was harmless while every envelope field
  // shipped every snap and actively misleading now that most of them don't. Measured against
  // PeerJS's own serializer (tools/netprofile.js) the fixed part is ~45B; the rest is counted
  // only when actually present. Still an estimate — netprofile is the instrument — but an
  // estimate that moves when the thing it measures moves.
  s.bs=ub.byteLength+(s.bb?s.bb.byteLength:0)+(s.sc?s.sc.length*22:0)+(s.fx?s.fx.length*10:0)+
    (s.stock0?42:0)+(s.carry?14*Object.keys(carry).length:0)+(s.ares?8:0)+45;
  return s;
};

// =========================================================== GUEST ==========
NET.uiJoin=function(){
  if(typeof Peer==="undefined"){msg("PeerJS failed to load — check your internet connection.","warn");return;}
  if(NET.peer)return;
  const code=(document.getElementById("joincode").value||"").trim().toLowerCase();
  NET._code=code;
  const name=NET.myName||"Warrior"; // v92: the name screen already asked
  if(!/^regicide-[a-z0-9]{4}$/.test(code)){msg("That's not a room code — it looks like regicide-abcd.","warn");return;}
  NET.status("Riding to "+code+"…");
  const peer=new Peer(NET.peerOpts()); NET.peer=peer;
  peer.on("error",e=>{msg("Join error: "+e.type,"warn");NET.status("Broker error: "+e.type);NET.peer=null;});
  peer.on("open",()=>{
    const c=peer.connect(code,{reliable:true}); NET.conn=c;
    NET.watchIce(c,"host"); // v128.8: say "unreachable" rather than "not there" — they differ
    c.on("open",()=>c.send({t:"hello",name,proto:NET.PROTO,
      team:(document.getElementById("jointeam")||{value:"auto"}).value,
      pw:String((document.getElementById("joinpw")||{value:""}).value||"").slice(0,16)})); // private halls check the word
    c.on("data",d=>NET.guestData(d));
    c.on("close",()=>{
      NET.status("⚠ CONNECTION LOST — refresh the page to rejoin.");
      msg("Connection to the host was lost. Refresh to rejoin.","warn");
    });
    // v128.8: the old line said "is the host still up?" for EVERY failure, including the common
    // one where the host is perfectly up and simply unroutable. Only claim they are absent when
    // the transport never even got a candidate pair going.
    setTimeout(()=>{
      if(NET.mode==="guest"||NET._admitted)return;
      const iceDead=NET.conn&&NET.conn.peerConnection&&
        /failed|disconnected/.test(NET.conn.peerConnection.iceConnectionState||"");
      NET.status(iceDead
        ? "⚠ Found "+code+" but could not reach them. A host on mobile data (5G) cannot accept direct connections — ask them to host from Wi-Fi."
        : "No answer from "+code+" — is the host still up?");
    },8000);
  });
};
NET.dialFast=function(){ // the unreliable lane: dropped packets never dam the stream
  // ---- v126: ONE DIAL AT A TIME ----
  // There are two callers — the 1200ms redial and the 5s "no fast lane?" retry installed on
  // admit — and neither used to know the other was mid-dial. A redial nulls NET.fast, the
  // retry sees a falsy NET.fast 5s later and dials on top of the still-connecting one, and
  // every extra dial arrives at a host that (before this version) also never closed the lane
  // it replaced. Petra redialled 38 times in 24 minutes with 37 fast-ups and 38 fast-downs:
  // a lane that never settled. A dial in flight now blocks the next one until it opens,
  // errors, or DIAL_TIMEOUT_MS says the attempt is never going to land.
  const now=NET.now();
  if(NET._dialAt&&now-NET._dialAt<NET.DIAL_TIMEOUT_MS)return;
  NET._dialAt=now;
  try{
    const f=NET.peer.connect(NET._code,{reliable:false,metadata:{ch:"fast"}});
    f.on("open",()=>{
      NET._dialAt=0;
      if(NET.fast&&NET.fast!==f){try{NET.fast.close();}catch(_){}} // never keep two
      NET.fast=f;
      // v126: the redial watchdog needs to know when the FAST lane last delivered — not when
      // any lane did. Stamped here so the reliable mirror can never mask a dead fast lane.
      NET._fastAt=NET.now();
    });
    f.on("data",dd=>{
      NET._fastAt=NET.now();
      NET.guestData(dd);
    });
    f.on("close",()=>{NET._dialAt=0;if(NET.fast===f)NET.fast=null;});
    f.on("error",()=>{NET._dialAt=0;if(NET.fast===f)NET.fast=null;});
  }catch(_){NET._dialAt=0;}
};
NET.guestData=function(d){
  if(!d||!d.t)return;
  if(d.t==="admit"){
    NET._admitted=true;NET.myUid=d.uid;
    NET._eTap=0; // v128.4: both ends start the tap counter at 0, so a rejoin in the same page
    NET.dialFast(); // load cannot arrive carrying a count the host reads as an instant interact
    setInterval(()=>{if(NET.mode==="guest"&&(!NET.fast||!NET.fast.open))NET.dialFast();},5000);
    return;
  }
  if(d.t==="world")return NET.applyWorld(d);
  if(d.t==="snap")return NET.applySnap(d);
  if(d.t==="bnew"){
    // call makeBuilding DIRECTLY (the wrapper only broadcasts on the host) and adopt the host's id
    const b=makeBuilding(d.team,d.type,d.x,d.z,!!d.built,d.rot);
    b.id=d.id;
    return;
  }
  if(d.t==="unew"){
    if(!NET.unitById(d.id)){ // carts and any future late spawns
      const u=makeUnit(d.team,d.cls,d.x,d.z,{name:d.name,bot:{role:"net"}});
      u.id=d.id; u.netPX=d.x; u.netPZ=d.z; u.netX=d.x; u.netZ=d.z; u.netF=0; u.netAt=NET.now();
    }
    return;
  }
  if(d.t==="lob"){ // theatre: the same arc the host computed
    const a=NET.unitById(d.uid);
    if(a)launchLob(a,d.tx,d.tz,true);
    return;
  }
  if(d.t==="shot"){ // cosmetic: damage is suppressed on guests, so this is pure theatre
    const att=d.aU>=0?NET.unitById(d.aU):NET.bldById(d.aB);
    const tgt=d.tU>=0?NET.unitById(d.tU):NET.bldById(d.tB);
    if(att&&tgt&&(tgt.def?tgt.alive:tgt.alive))_real_shootArrow(att,tgt);
    return;
  }
  if(d.t==="chest"){ // camp treasure appears (k = "food"|"gold") or vanishes (k = null); s=1 is the shore's second chest
    const st=campStates[d.i];
    if(st){ if(d.k)_chestShow(st,d.k,!!d.s); else _chestHide(st,!!d.s); }
    return;
  }
  if(d.t==="qst"){ // v87: OUR quest/level state, as the host rules it
    if(typeof Sound!=="undefined"&&d.l>(player.lvl||0))Sound.play("alert_quest"); // v100: a level gained = a quest cleared
    player.lvl=d.l; player.xp=d.x;
    player.quest=(d.qi>=0&&QUESTS[d.qi])?{i:d.qi,prog:d.qp}:null;
    updateQuestHud();
    return;
  }
  if(d.t==="smith"){ // v93: the host lays the trio on OUR screen
    player.xp=d.xp;
    if(d.offer&&d.offer.length)openSmithMenu(d.offer);
    return;
  }
  if(d.t==="qdraft"){ // v99: the Town Board's three postings arrive on OUR screen
    NET._qrr=d.rr||0;
    if(d.offer&&d.offer.length)openBoardMenu(d.offer);
    return;
  }
  if(d.t==="bff"){ // v87: OUR blacksmith buffs — prediction needs the real speed
    if(typeof Sound!=="undefined"){const _nb=d.b?Object.keys(d.b).length:0,_ob=player.buffs?Object.keys(player.buffs).length:0;if(_nb>_ob)Sound.play("alert_buff");} // v100: buff gained (silent on death-wipe)
    player.buffs=d.b||{}; player.xp=d.x;
    applyBuffStats(player);
    updateQuestHud(); updatePlayerHud();
    return;
  }
  if(d.t==="pong"){ // v95: our ping, measured on the wire we actually ride
    const rtt=NET.now()-(d.ts||0);
    if(rtt>=0&&rtt<10000)NET.ping=NET.ping?NET.ping*0.6+rtt*0.4:rtt;
    return;
  }
  if(d.t==="note")return msg(d.m,d.tone||"");
  if(d.t==="ndep"){const n=nodes[d.i];if(n){n.amount=0;_real_depleteNode(n);if(typeof Sound!=="undefined")Sound.play(n.type==="wood"?"treefall":n.type==="food"?"harvest":"stonecrumble",{x:n.x,z:n.z});}return;} // v104 guest node-exhaust
  if(d.t==="snd"){ // v103: host-driven global/team sound events (raid, base alarm, allied resurrection)
    if(typeof Sound!=="undefined"&&(d.team===undefined||d.team===MYTEAM)){
      if(d.k==="__chorus"){if(Sound.voxChorus)Sound.voxChorus(d.x,d.z);} // v109: a relayed war-cry chorus
      else Sound.play(d.k,(d.x!==undefined)?{x:d.x,z:d.z}:undefined);
    }
    return;
  }
  if(d.t==="end")return endGame(d.w,d.k);
  if(d.t==="deny")return msg(d.m,"warn");
};
NET.applyWorld=function(w){
  NET.mode="guest";           // freezes the local sim from the very next frame
  NET.myUid=w.uid;
  NET.estT=w.T;               // v95: the guest's clock starts on the host's time
  // v126: forget the previous host's delay floor. `_hOff` is calibrated against ONE machine's
  // performance.now() origin; carrying it into a new session (rejoin, different host) would
  // measure every snapshot against a stranger's clock until the window rolled over.
  NET._hOff=undefined;NET._hOffAt=0;NET._hOffPrev=undefined;NET._hasHt=false;
  NET._ageMs=0;NET._ageMax=0;NET._fastAt=0;
  T=w.T; teamAge[BLUE]=w.ages[0]; teamAge[RED]=w.ages[1];
  if(w.ares){ageResT[BLUE]=w.ares[0];ageResT[RED]=w.ares[1];} // v107: pick up a countdown already running
  stock[BLUE].food=w.stock0.f;stock[BLUE].gold=w.stock0.g;stock[BLUE].stone=w.stock0.s;stock[BLUE].wood=w.stock0.w;
  if(w.stock1){stock[RED].food=w.stock1.f;stock[RED].gold=w.stock1.g;stock[RED].stone=w.stock1.s;stock[RED].wood=w.stock1.w;}
  // ---- units: overwrite our locally-spawned 100 with the host's truth ----
  const wasPlayer=player;
  for(const rec of w.units){
    const [id,cls,alive,x,z,f,hp,maxHp,name,team]=rec;
    let u=NET.unitById(id);
    if(!u){u=makeUnit(team,cls,x,z,{name,bot:{role:"net"}});u.id=id;}
    u.name=name;
    if(u.cls!==cls)setClass(u,cls);
    u.root.position.set(x,terrainHeight(x,z),z);
    u.netPX=x;u.netPZ=z;u.netX=x;u.netZ=z;u.netF=f;u.netAt=NET.now();
    u.authX=x;u.authZ=z;u.facing=f;
    u.hp=hp;u.maxHp=maxHp;setBar(u.bar,u.hp/u.maxHp);
    u.alive=!!alive; u.dieT=0;
    u.root.visible=u.alive; u.body.rotation.x=0;
  }
  // ---- possession: our old "player" becomes just another blue bot ----
  if(wasPlayer){
    wasPlayer.isPlayer=false;
    wasPlayer.ring.material.color.setHex(TEAMCOL[wasPlayer.team]);
    wasPlayer.bar.bg.visible=wasPlayer.bar.fg.visible=true;
  }
  const pu=NET.unitById(NET.myUid);
  pu.isPlayer=true; player=pu;
  MYTEAM=pu.team; // the world is seen through MY team's eyes now
  if(MYTEAM===RED){ // flip the king bars: MY king first
    const l0=document.querySelector("#kb0 .lbl"), l1=document.querySelector("#kb1 .lbl");
    if(l0)l0.textContent="♚ KING OSRIC (SLAY HIM)";
    if(l1)l1.textContent="♔ KING VARGUS (YOUR KING)";
  }
  pu.ring.material.color.setHex(0xffffff);
  pu.bar.bg.visible=pu.bar.fg.visible=false;
  // ---- buildings: raze the local guesswork, rebuild from the host list ----
  for(const b of buildings)scene.remove(b.root);
  buildings.length=0;
  for(const rec of w.blds){
    const [id,team,type,x,z,rot,built,progress,hp,alive,crop]=rec;
    const b=makeBuilding(team,type,x,z,!!built,rot);
    b.id=id; b.hp=hp; b.progress=progress;
    if(!built){b.body.scale.y=0.15+0.85*(progress/b.def.hits);}
    if(typeof crop==="number"&&b.cropMesh){
      b.crop=crop; b.cropMesh.scale.y=0.15+0.85*crop;
      if(crop>=1&&b.tassels)for(const t of b.tassels)t.visible=true;
    }
    if(!alive){b.alive=false;scene.remove(b.root);}
  }
  // ---- nodes ----
  for(let i=0;i<w.nodes.length&&i<nodes.length;i++){
    nodes[i].amount=w.nodes[i];
    if(w.nodes[i]<=0)_real_depleteNode(nodes[i]);
  }
  if(w.camps)for(let i=0;i<w.camps.length&&i<campStates.length;i++){ // standing chests greet the joiner
    const [kA,kB]=w.camps[i]||[null,null];
    if(kA)_chestShow(campStates[i],kA,false); else _chestHide(campStates[i],false);
    if(kB)_chestShow(campStates[i],kB,true);  else _chestHide(campStates[i],true);
  }
  inMenu=false; // the guest steps out of the menu into the host's world
  NET.uiHideMenus(); // v128.9: …and off whichever menu screen they were standing on
  closeMenus();cancelPlacing();
  updateResHud();updateAgeHud();updateKingBars();updatePlayerHud();
  NET.connectedTxt="⚑ CONNECTED — you fight as <b>"+player.name+"</b><br><span class='netsub'>the host runs the war · your body answers instantly</span>";
  NET.lastSnapAt=NET.now();
  NET.status(NET.connectedTxt);
  msg("You've joined the "+TEAMNAME[MYTEAM]+" army as "+player.name+". Slay King "+(MYTEAM===BLUE?"Vargus":"Osric")+"!","gold");
};
NET.applySnap=function(s){
  if(NET.mode!=="guest")return; // world first, then snapshots
  if(typeof s.q==="number"){ // unordered lane: never apply the past
    if(s.q<=NET.lastQ){NET._cDup=(NET._cDup||0)+1;return;} // net log: late/duplicate arrivals
    if(NET.lastQ>=0)NET._cGap=(NET._cGap||0)+Math.min(99,s.q-NET.lastQ-1); // …and sequence holes (loss OR host-side skips — read with the host's sent/s)
    NET.lastQ=s.q;
  }
  const nowP=NET.now();
  if(NET.lastArr)NET.gapAvg=Math.min(1200,Math.max(60,NET.gapAvg*0.8+(nowP-NET.lastArr)*0.2));
  NET.lastArr=nowP;
  // v95 STALE-AUTHORITY GUARD: a snapshot born seconds ago (a draining backlog) still applies
  // its WORLD state — stale truth beats no truth — but it may NOT leash-yank our own body.
  // That yank-to-the-past was the "can look around but can't walk" freeze.
  //
  // ---- v126: MEASURED WITH A WALL CLOCK ----
  // v95 asked the question as (our sim clock) − (the snapshot's sim clock), and both of those
  // advance by a dt that 09-main clamps to 0.05. A host at 10–19 fps loses the excess and its
  // sim clock crawls (0.85× measured over 24 minutes, 0.74× at 20 fps); a guest at 60–90 fps
  // never touches the clamp. lagT therefore grew ~0.15s per second out of pure frame-rate
  // mismatch, tripped AUTH_FRESH_S after ~4s, and only reset when it passed the 5s bail-out —
  // so authority was refused for ~88% of John's session and his body ran on dead reckoning
  // the whole time. `ht` is the host's own monotonic clock, so the age of a snapshot is
  // (arrival − ht) minus the smallest (arrival − ht) we have ever seen, i.e. minus the
  // one-way delay floor. Pure difference of one machine's clock against itself plus one of
  // ours: no sync, no offset estimate, and completely blind to whatever the sim clock does.
  let freshAuth,ageMs=0;
  if(typeof s.ht==="number"){
    NET._hasHt=true;
    const d=nowP-s.ht;                                   // clock-offset PLUS transit, in one number
    // A TWO-BUCKET ROLLING MINIMUM, not a periodic reset. The floor has to expire — the two
    // machines' clocks drift, and a floor set once at join would slowly read as free lateness —
    // but resetting it to whatever single sample happens to land on the tick is worse than not
    // expiring it at all: one unlucky 500ms-delayed packet would become the new definition of
    // "zero delay" and everything for the next window would read 500ms fresher than it is.
    // So: keep the min of THIS window and the min of the LAST one, and use the smaller. The
    // floor can only ever be a value actually observed within the last two windows, and the
    // handover carries the previous window's best case rather than a single fresh sample.
    if(NET._hOff===undefined){NET._hOff=d;NET._hOffPrev=d;NET._hOffAt=nowP;}
    else{
      if(nowP-(NET._hOffAt||0)>NET.HOFF_DECAY_MS){NET._hOffPrev=NET._hOff;NET._hOff=d;NET._hOffAt=nowP;}
      if(d<NET._hOff)NET._hOff=d;
    }
    const floor=Math.min(NET._hOff,NET._hOffPrev===undefined?NET._hOff:NET._hOffPrev);
    ageMs=Math.max(0,d-floor);
    freshAuth=ageMs<NET.AGE_FRESH_MS;
    NET._ageMs=ageMs;
    if(ageMs>(NET._ageMax||0))NET._ageMax=ageMs; // the worst age this second, not just the last
    if(NET.estT===null||typeof NET.estT!=="number")NET.estT=s.T;
  }else{ // a v125 host: no stamp on the wire, so fall back to the old sim-clock comparison
    if(typeof NET.estT!=="number")NET.estT=s.T;
    const lagT=NET.estT-s.T;
    freshAuth=lagT<NET.AUTH_FRESH_S;
    if(lagT>5)NET.estT=s.T;
  }
  if(!freshAuth)NET._cStale=(NET._cStale||0)+1; // net log: backlog snapshots this second
  if(s.T>NET.estT)NET.estT=s.T;
  NET._dSnaps=(NET._dSnaps||0)+1; NET._dBytes=(NET._dBytes||0)+(s.bs||0); // the readout's raw feed
  T=s.T;
  if(teamAge[BLUE]!==s.ages[0]||teamAge[RED]!==s.ages[1]){
    const mineUp=s.ages[MYTEAM]>teamAge[MYTEAM];
    const reB=teamAge[BLUE]!==s.ages[0], reR=teamAge[RED]!==s.ages[1];
    teamAge[BLUE]=s.ages[0];teamAge[RED]=s.ages[1];
    if(reB){restyleBuildings(BLUE,true);restyleUnits(BLUE,true);}
    if(reR){restyleBuildings(RED,true);restyleUnits(RED,true);}
    updateAgeHud();
    if(mineUp)msg("⬆ YOUR TEAM ADVANCES TO THE "+AGES[teamAge[MYTEAM]].name.toUpperCase()+"!","blue");
    if(typeof Sound!=="undefined"&&mineUp)Sound.play("ageup"); // v100: guest age-up fanfare
  }
  if(s.ares){ // v107: the host's advance countdown — authoritative overwrite of the guest's local tick
    const wasSec=Math.ceil(ageResT[MYTEAM]||0);
    ageResT[BLUE]=s.ares[0];ageResT[RED]=s.ares[1];
    if(Math.ceil(ageResT[MYTEAM])!==wasSec)updateAgeHud();
  }
  // v127: the treasury is a DELTA now — absent means unchanged, not zero. The old line read
  // s.stock0.f unguarded, which is precisely why PROTO had to move: an old guest meeting a lean
  // snapshot would have written NaN into the stockpile and every HUD figure downstream of it.
  if(s.stock0){stock[BLUE].food=s.stock0.f;stock[BLUE].gold=s.stock0.g;stock[BLUE].stone=s.stock0.s;stock[BLUE].wood=s.stock0.w;}
  if(s.stock1){stock[RED].food=s.stock1.f;stock[RED].gold=s.stock1.g;stock[RED].stone=s.stock1.s;stock[RED].wood=s.stock1.w;}
  for(const rec of NET.readSnapRows(s)){ // v95: rows arrive as packed binary
    const [id,ci,fl,x10,z10,f100,hp,maxHp,rT,gar1,cg]=rec;
    const cls=CLS_KEYS[ci]||"villager", alive=fl&1, mv=fl&2, sw=fl&4, pulse=(fl>>3)&3, gar=gar1-1;
    const x=x10/10, z=z10/10, f=f100/100;
    const u=NET.unitById(id); if(!u)continue;
    if(u.cls!==cls){setClass(u,cls);if(u===player)msg("You are now a "+CLS[cls].name+"!","blue");}
    if(u!==player)u._cargo=(cg||0)/100; // v99: their cargo through the wire; OUR OWN load computes locally
    if(u===player){ // OUR body: we predict, the host corrects — but only with FRESH truth
      if(freshAuth){u.authX=x;u.authZ=z;u.authAt=nowP;}
    }else{ // everyone else glides from WHERE THEY'RE DRAWN to the new truth —
           // a burst of late snapshots can never teleport them
      // ---- v127: remember the LEG we just walked, so the glide can carry on past its end ----
      // The old glide finished in gapAvg and then clamped, which parked the unit until the next
      // row arrived. Under the AOI far-stagger that is one row every 4th snap (~266ms) against a
      // ~76ms glide: 190ms frozen, every time, on every distant unit — plus one extra freeze per
      // dropped snapshot, and John's guests logged ~1,400 sequence holes each. `netVX`/`netVZ` is
      // the velocity of the leg that just ended, which guestFrame extrapolates along instead of
      // stopping. Derived here rather than shipped: it costs no bytes and it cannot disagree with
      // the positions it was measured from.
      if(typeof u.netX!=="number"||dist2(u.root.position.x,u.root.position.z,x,z)>24*24){
        u.netPX=x;u.netPZ=z; // genuine teleport/respawn: snap
        u.netVX=0;u.netVZ=0;  // …and a teleport has no velocity worth carrying
      }else{
        u.netPX=u.root.position.x;u.netPZ=u.root.position.z;
        const legMs=nowP-(u.netAt||nowP);
        if(legMs>=8&&legMs<=1000){ // ignore duplicate-frame arrivals and post-stall gaps alike
          u.netVX=(x-u.netX)/legMs; u.netVZ=(z-u.netZ)/legMs; // units per ms, from the wire's own numbers
        }else{u.netVX=0;u.netVZ=0;}
      }
      u.netX=x;u.netZ=z;u.netF=f;u.netAt=nowP;
    }
    // v109 THE VOICES: the guest FEELS the hit — host-side impacts/pain never reach us, so a
    // real hp drop on OUR OWN body cries out here (~1 in 3, graded by how hard it landed)
    if(u===player&&alive&&hp>0&&hp<u.hp-1&&typeof Sound!=="undefined"&&Sound.vox&&Math.random()<0.34){
      const _pd=u.hp-hp;
      Sound.vox(_pd<12?"painm":_pd<25?"pain":"painh",u,{});
    }
    u.hp=hp;u.maxHp=maxHp;
    if(u!==player)setBar(u.bar,u.hp/Math.max(1,u.maxHp));
    u.gmv=!!mv; // held between snapshots — animateUnit consumes u.moving every frame
    if(u!==player&&sw){ // own swings are predicted locally — echoes would loop the arm
      // v95 WORK PULSE: a stationary miner/fighter's row used to stop shipping (no delta),
      // so their arm froze mid-swing on guests. The pulse ticks every 0.5s of work —
      // each tick re-triggers the animation and the statue swings again.
      if(u.swing<=0.05||u._pulse!==pulse){u.swing=0.25;triggerAttackAnim(u);}
      u._pulse=pulse;
    }
    if(u.alive&&!alive){ // fell this instant: topple locally
      u.alive=false;u.dieT=0.9;u.corpse=true;
      if(typeof Sound!=="undefined"&&!u.isKing){ // v102: guest death mix parity
        const _dc=CLS[u.cls]||{},_darm=(_dc.line==="cavalry")||((_dc.line==="melee"||_dc.line==="anticav")&&(_dc.tier||0)>=3);
        const _dp={x:u.root.position.x,z:u.root.position.z};
        Sound.play(_darm?(Math.random()<0.3?"gore":"deathheavy"):(Math.random()<0.33?"gore":"death"),_dp);
        // v109 THE VOICES: guest death-cry parity (local roll — flavor needn't match the host's)
        // v110: guests can't see camp kind (no bot on replicas) — NEUTRAL deaths stay voiceless
        // here so wolves never scream like men (barbarian death cries are host-audible only)
        if(Sound.vox&&(u===player||Math.random()<0.7)&&u.team!==NEUTRAL)
          Sound.vox(Math.random()<0.2?"deathi":"death",u,_dp);
      }

      u.bar.bg.visible=u.bar.fg.visible=false;
      u.gathering=null;
      if(u===player){
        document.getElementById("deathoverlay").style.display="flex";
        closeMenus();cancelPlacing();
        if(document.exitPointerLock)document.exitPointerLock();
      }
    }else if(!u.alive&&alive){ // reborn at a spawn point (or raised by a priest)
      u.alive=true;u.dieT=0;u.corpse=false;u.root.visible=true;u.body.rotation.x=0;
      u.root.position.set(x,terrainHeight(x,z),z);
      if(u!==player){u.bar.bg.visible=u.bar.fg.visible=true;setBar(u.bar,1);}
      else{
        document.getElementById("deathoverlay").style.display="none";
        msg("You respawn as a Villager. Re-arm at the Barracks.","blue");
      }
    }
    if(!u.alive)u.respawnT=rT;
    const gWas=u.garrison;
    u.garrison=(gar>=0)?NET.bldById(gar):null; // rendered on the deck in guestFrame (wire is id+1; 0 = none)
    if(gWas!==u.garrison){u.deckX=u.deckZ=0;}
  }
  if(s.fx)for(const f of s.fx){ // v95: batched arrow theatre — damage is host-only, this is the show
    const att=f[0]>=0?NET.unitById(f[0]):NET.bldById(f[1]);
    const tgt=f[2]>=0?NET.unitById(f[2]):NET.bldById(f[3]);
    if(att&&tgt&&(tgt.def?tgt.alive:tgt.alive))_real_shootArrow(att,tgt);
  }
  for(const rec of NET.readBldRows(s)){ // v97: building deltas arrive as packed binary
    const [id,hp,built,progress,alive,crop]=rec;
    const b=NET.bldById(id); if(!b)continue;
    b.hp=hp;
    if(alive&&!b.alive){b.alive=true;scene.add(b.root);} // shouldn't happen, but heal the drift
    if(!alive&&b.alive){b.alive=false;scene.remove(b.root);if(typeof Sound!=="undefined")Sound.play("raze",{x:b.x,z:b.z});} // v102: guest raze parity
    if(built&&!b.built){
      b.built=true;b.progress=progress;b.body.scale.y=1;
      if(typeof Sound!=="undefined")Sound.play("complete",{x:b.x,z:b.z}); // v100: guest completion chime
      b.body.traverse(o=>{if(o.material){o.material.opacity=1;o.material.transparent=false;}});
      if(typeof roadEligible==="function"&&roadEligible(b))markRoadsDirty(b.team); // streets follow the growing town on guests too (coalesced)
    }else if(!built){
      b.progress=progress;b.body.scale.y=0.15+0.85*(progress/b.def.hits);
    }
    if(typeof crop==="number"&&b.cropMesh){
      b.crop=crop;b.cropMesh.scale.y=0.15+0.85*Math.min(1,crop);
      if(b.tassels)for(const t of b.tassels)t.visible=crop>=1;
    }
  }
  if(s.sc){NET.scores=s.sc;syncNameTags(s.sc);}
  if(s.carry&&s.carry[NET.myUid]){
    const c=s.carry[NET.myUid];
    player.carry.food=c[0];player.carry.gold=c[1];player.carry.stone=c[2];player.carry.wood=c[3];
    player.tradeLoaded=c[4]?(player.tradeLoaded||{x:0,z:0}):null;
  }
  if(s.over&&!gameOver){/* end event carries the details; this is the belt to its suspenders */}
  NET.lastSnapAt=NET.now();
  updateResHud();updatePlayerHud();updateKingBars();
};
// -------- guest: the thin frame (predict self, interpolate others) --------
NET.guestFrame=function(dt){
  NET._cFrames=(NET._cFrames||0)+1; // fps for the net log
  // v95: our clock marches between snapshots (frozen while the feed is stale, so a
  // paused host doesn't poison the lag estimate) — applySnap compares arrivals to it.
  // v126: ONLY on the v125-host fallback path. Once `ht` is on the wire, freshness is
  // measured against the host's own clock and this local march is exactly the thing that
  // was wrong — a guest at 60fps advancing estT at 1.0× against a host sim clock at 0.85×
  // manufactured 0.15s of fake lag every second. estT still tracks the newest T it has
  // SEEN (applySnap raises it), it just no longer invents time between snapshots.
  if(typeof NET.estT==="number"&&!NET._stale&&!NET._hasHt)NET.estT+=dt;
  for(const u of units){
    if(!u.alive){
      if(u.dieT>0){ // same topple as the host sim
        u.dieT-=dt;
        const fF=1-Math.max(0,u.dieT)/0.9;
        const gy=terrainHeight(u.root.position.x,u.root.position.z);
        u.body.rotation.x=-fF*Math.PI/2;
        u.root.position.y=gy-fF*0.3;
        if(u.dieT<=0){
          if(u.corpse){u.body.rotation.x=-Math.PI/2;u.root.position.y=gy;} // lie in state on the guest too
          else{u.root.visible=false;u.body.rotation.x=0;u.root.position.y=gy;}
        }
      }
      if(u===player){
        u.respawnT=Math.max(0,(u.respawnT||0)-dt);
        document.getElementById("deathtimer").textContent=Math.ceil(u.respawnT);
      }
      continue;
    }
    if(u!==player&&typeof u.netX==="number"){
      // glide from the drawn position to the newest truth over one smoothed
      // arrival interval — packet bursts stretch the glide instead of snapping it
      const since=NET.now()-(u.netAt||0);
      const a=Math.min(1,since/NET.gapAvg);
      u.root.position.x=u.netPX+(u.netX-u.netPX)*a;
      u.root.position.z=u.netPZ+(u.netZ-u.netPZ)*a;
      // ---- v127: CARRY ON WALKING instead of standing still waiting for the next row ----
      // `a` clamps at 1, so the old code reached the truth in gapAvg and then FROZE the unit
      // until the next row landed. A far unit ships every AOI_FAR_EVERY-th snap (~266ms at
      // 15Hz) and the glide takes ~76ms: two thirds of that unit's life was spent standing
      // perfectly still, then jerking forward. Every dropped snapshot adds another freeze.
      //
      // So past the end of the glide, keep moving along the leg just walked — but only while
      // the host still says this body is MOVING (bit 2 of the flags byte, held in `gmv`), and
      // only for EXTRAP_MAX_MS, because a unit that stopped or turned must not be flung onward
      // for ever. Overshoot is self-correcting and costs nothing: the next arrival sets netPX
      // to WHEREVER THE UNIT IS DRAWN and glides from there, so a wrong guess is absorbed by
      // the same smoothing that handles a late packet. That property is why this is safe at all.
      if(a>=1&&u.gmv&&(u.netVX||u.netVZ)){
        const ex=Math.min(since-NET.gapAvg,NET.EXTRAP_MAX_MS);
        if(ex>0){u.root.position.x+=u.netVX*ex;u.root.position.z+=u.netVZ*ex;}
      }
      u.facing=u.netF;
    }
    if(u.garrison&&u.garrison.alive){ // sentries walk the deck: snapshot x/z, deck height
      const gd=u.garrison.deck||{y:7.15,r:2.4};
      if(u!==player){ // clamp drift to the platform; height comes from the deck
        const ddx=u.root.position.x-u.garrison.x, ddz=u.root.position.z-u.garrison.z;
        const dl=Math.hypot(ddx,ddz);
        if(dl>gd.r){u.root.position.x=u.garrison.x+ddx/dl*gd.r;u.root.position.z=u.garrison.z+ddz/dl*gd.r;}
        u.root.position.y=u.garrison.root.position.y+gd.y;
      }
    }else if(u.garrison){u.garrison=null;u.deckX=u.deckZ=0;}
    if(u!==player)u.moving=!!u.gmv; // refresh the consumable flag every frame
    if(u.moving&&u!==player)u.walkT+=dt*(3.5+(u.spd||3)*0.75);
    updateUnitCommon(u,dt); // terrain hug + smooth facing + animateUnit
  }
  // ---- PREDICTION-LITE: our own body moves the instant we press a key ----
  // The host stays authoritative; we walk freely inside a small dead zone and
  // get pulled back smoothly only when the host disagrees (collisions, blocks).
  if(player.alive&&player.garrison&&player.garrison.alive){
    const gb=player.garrison, deck=gb.deck||{y:7.15,r:2.4};
    let mx=0,mz=0;
    if(keys.w)mz-=1; if(keys.s)mz+=1; if(keys.a)mx-=1; if(keys.d)mx+=1;
    if(mx||mz){
      const dir=new THREE.Vector3(mx,0,mz).applyAxisAngle(new THREE.Vector3(0,1,0),camYaw);
      const L=Math.hypot(dir.x,dir.z)||1;
      player.deckX=(player.deckX||0)+dir.x/L*player.spd*dt*0.7;
      player.deckZ=(player.deckZ||0)+dir.z/L*player.spd*dt*0.7;
      const dd=Math.hypot(player.deckX,player.deckZ);
      if(dd>deck.r){player.deckX*=deck.r/dd;player.deckZ*=deck.r/dd;}
      player.facing=Math.atan2(dir.x,dir.z); player.moving=true; player.walkT+=dt*5;
    }else player.moving=false;
    player.root.position.set(gb.x+(player.deckX||0),gb.root.position.y+deck.y,gb.z+(player.deckZ||0));
  }
  if(player.alive&&!player.garrison){
    // v128.5 THE THUMBSTICK DIVERGENCE. This was the ONLY one of the three call sites into
    // moveUnit that ignored analog magnitude: the host walks a guest at `dt*mag`, but the guest
    // predicted itself at full `dt`. 12-touch mirrors the stick into w/a/s/d at a 0.38
    // threshold, so a half-deflected thumb predicted DOUBLE the speed the host granted — a
    // permanent divergence the leash then fought every single frame, on every mobile guest.
    // Read the same vector the host is sent (readMove), and fall back to the bits when the
    // shared helper is not present.
    const _mv=(typeof readMove==="function")?readMove():null;
    let mx=0,mz=0,mag=1;
    if(_mv&&typeof moveVec!=="undefined"&&moveVec.analog){mx=_mv.mx;mz=_mv.mz;mag=_mv.mag;}
    else{if(keys.w)mz-=1; if(keys.s)mz+=1; if(keys.a)mx-=1; if(keys.d)mx+=1;}
    if(mx||mz){
      const dir=new THREE.Vector3(mx,0,mz).applyAxisAngle(new THREE.Vector3(0,1,0),camYaw);
      moveUnit(player,dir.x,dir.z,dt*Math.min(1,mag)*(player.blocking?0.55:1));
    }else player.moving=false;
    if(typeof player.authX==="number"&&NET.now()-(player.authAt||0)<600){
      // never let STALE authority yank us — if snapshots pause, prediction free-runs
      const p=player.root.position;
      const ex=player.authX-p.x, ez=player.authZ-p.z, e=Math.hypot(ex,ez);
      // v128.5: …but the widening has to STOP short of the hard-snap radius. gapAvg is clamped
      // to 1200, so the old formula reached 25.5 — above gapAvg≈1173 the soft branch became
      // unreachable (anything over 25 hit the snap first) and the body got no correction at all
      // below 25 units of error. Jorunn's p90 ping in the field test was 1294ms: not theoretical.
      const dead=Math.min(18,3.2+(NET.gapAvg-83)*0.02); // lag widens the leash instead of the rubber band
      if(e>25){p.x=player.authX;p.z=player.authZ;NET._cLeash=(NET._cLeash||0)+1;} // hard desync: snap home (logged)
      else if(e>dead){const f=(e-dead)/e*Math.min(1,dt*4.5);p.x+=ex*f;p.z+=ez*f;}
    }
    // PRIEST: channel/cast runs client-side; the resurrection itself goes through the host
    if(player.cls==="priest")updatePriestChannel(dt,lmbHeld&&mouseLocked&&!placing&&!menuOpen);
    // local attack theatre: swing NOW, the host lands the real blow
    else if(((lmbHeld&&mouseLocked)||keys[" "])&&!placing&&!player.blocking&&player.atkT<=0&&player.dmg>0){
      if(siegeAim)playerPrimary(); // v97: the skill shot — queues the lob; it rides the next input packet
      else{
        player.atkT=player.cd; player.swing=0.25; triggerAttackAnim(player);
        if(!player.moving)player.facing=Math.atan2(-Math.sin(camYaw),-Math.cos(camYaw));
      }
    }
    // v95 GATHER THEATRE: the host does the REAL mining off our held E — but our own
    // body used to stand rigid while it happened (own swings are never echoed back).
    // Swing the pick and puff the node locally; resources stay 100% host-authoritative.
    if((player.cls==="villager"||player.cls==="oxcart")&&keys.e&&!menuOpen&&!placing&&!player.moving){
      const px=player.root.position.x,pz=player.root.position.z;
      let tx,tz,ty=1.6,col=0xd8c9a3,site=null,sd=1e12,found=false;
      if(player.cls==="villager")for(const b of buildings){ // the ox builds nothing
        if(b.team!==player.team||!b.alive||b.built)continue;
        const reach=b.def.r+2.6, d=dist2(px,pz,b.x,b.z);
        if(d<reach*reach&&d<sd){sd=d;site=b;}
      }
      if(site){tx=site.x;tz=site.z;found=true;}
      else{
        let n=null,nd=3.4*3.4;
        for(const nn of nodes){
          if(nn.amount<=0)continue;
          if(player.cls==="oxcart"&&nn.type!=="wood")continue; // timber only, even in the theatre
          const d=dist2(px,pz,nn.x,nn.z);
          if(d<nd){nd=d;n=nn;}
        }
        if(n){tx=n.x;tz=n.z;ty=1.5+(n.y||0);found=true;
          col=n.type==="food"?0xd23c2f:n.type==="gold"?0xe0a92e:n.type==="stone"?0x9aa2ad:0x8a6a3f;}
      }
      if(found){
        player.swing=Math.max(player.swing||0,0.12);
        player.facing=Math.atan2(tx-px,tz-pz);
        player._gfxT=(player._gfxT||0)+dt;
        if(player._gfxT>0.55){player._gfxT=0;puff(tx,ty,tz,col);triggerAttackAnim(player);
          player._gsw=((player._gsw||0)+1)&1; // v113: gather foley on every OTHER swing (build keeps every hit)
          if(typeof Sound!=="undefined"){var _gk=site?"build":(col===0x8a6a3f?"chop":col===0xd23c2f?"farm":"mine");
            if(_gk==="build"||!player._gsw)Sound.play(_gk,{x:tx,z:tz});
            if(_gk==="build"&&Math.random()<0.12)Sound.play("veffort",{x:tx,z:tz});}} // v100: guest gather/build parity (v111: grunts on BUILD only — gather grunts read as harm)
      }
    }
  }
  drainVisualQueue(); // restyle wave + coalesced roads on the guest too
  updateEffects(dt);
  updateProjectiles(dt); // pure theatre — damage is host-only
  if(typeof tickAgeResearch==="function")tickAgeResearch(dt,false); // v107: smooth countdown between snaps (display only)
  // v126: THE "!" OVER THE QUEST BOARD, WHICH A GUEST HAS NEVER SEEN. `tickBoardBang` was
  // called from exactly one place — tickBody's host/solo branch — and a guest returns from
  // tickBody long before reaching it, so `_boardBang` was never even constructed: not hidden,
  // absent. Every other display-only driver made the trip across (drainVisualQueue,
  // updateEffects, updateProjectiles, tickAgeResearch, Sound.tick, updateRoster, drawMinimap);
  // the v99 bang predates all of them and was simply never added. Everything it reads is
  // already true on a guest — `townBoards` comes from local world gen, MYTEAM is set in
  // applyWorld, and player.quest/lvl arrive on the `qst` message — so it just works once called.
  // Placed here to hold the host's relative order (tickAgeResearch → tickBoardBang → Sound).
  if(typeof tickBoardBang==="function")tickBoardBang(dt);
  if(typeof Sound!=="undefined")Sound.tick(dt); // v100: ambience bed + nearby-march on the guest too
  // stale-feed watchdog + the v95 FIELD READOUT (lane · ping · snaps/s · KB/s):
  // one honest line, refreshed each second — next playtest, the numbers do the triage.
  const fastUp=!!(NET.fast&&NET.fast.open);
  // v126: wall clock, for the same reason as the host — `dt` is the CLAMPED sim delta, so this
  // "once a second" ran at the sim clock's rate and every rate in the row below was per sim
  // second. On a guest at 60–90 fps the clamp rarely bites, so guest rows were only ~1–4% off;
  // it is the host side that was up to 2× out. Both are wall-clock now, and both log `win`.
  const gnow=NET.now();
  if(!NET._pingW)NET._pingW=gnow;
  if(gnow-NET._pingW>=1000){
    const winMs=gnow-NET._pingW;
    NET._pingW=gnow;
    const lane=fastUp?NET.fast:(NET.conn&&NET.conn.open?NET.conn:null);
    if(lane)try{lane.send({t:"ping",ts:NET.now(),rtt:Math.round(NET.ping||0)});}catch(_){}
    if(NET.connectedTxt&&!NET._stale){
      NET.status(NET.connectedTxt+"<br><span class='netsub'>"+
        (fastUp?"⚡ fast lane":"🐢 relay lane — retrying the fast lane…")+
        " · ping "+(NET.ping?Math.round(NET.ping)+"ms":"—")+
        " · "+(NET._dSnaps||0)+" snaps/s · "+(((NET._dBytes||0)/1024).toFixed(1))+" KB/s</span>");
    }
    // v98: one net-log row per second — sampled before the windows reset
    // v126 adds `win` (the true window in ms — divide by it, don't assume 1000) and `age`
    // (the measured wall-clock age of the last snapshot, the number `stale` is counting).
    NET.logRow({t:Date.now(),T:r1(typeof T==="number"?T:0),role:"g",fps:NET._cFrames||0,
      win:Math.round(winMs),
      ping:Math.round(NET.ping||0),snaps:NET._dSnaps||0,
      kb:Math.round((NET._dBytes||0)/102.4)/10,gapAvg:Math.round(NET.gapAvg),
      age:Math.round(NET._ageMs||0),ageMax:Math.round(NET._ageMax||0),
      fast:fastUp?1:0,qgap:NET._cGap||0,dup:NET._cDup||0,stale:NET._cStale||0,leash:NET._cLeash||0});
    NET._cFrames=0;NET._cGap=0;NET._cDup=0;NET._cStale=0;NET._cLeash=0;NET._ageMax=0;
    if(NET._logLane!==fastUp){ // lane transitions land in the event stream
      if(NET._logLane!==undefined)NET.logEvent(fastUp?"fast-up":"fast-down");
      NET._logLane=fastUp;
    }
    NET._dSnaps=0;NET._dBytes=0;
  }
  // ---- v126: THE REDIAL WATCHES THE FAST LANE, NOT THE FEED ----
  // The old test was "no snapshot from ANY lane for 1200ms". That is the wrong question twice
  // over. It could not fire while the reliable mirror was still trickling (so a genuinely dead
  // fast lane hid behind the relay), and once MIRROR_EVERY dropped the mirror to 1Hz the same
  // test would have started firing on a healthy link, because a 1000ms mirror period sits
  // inside a 1200ms window. `_fastAt` is stamped in dialFast's own data handler, so this now
  // asks the only question that was ever meant: the fast lane claims open — is anything
  // actually coming down it?
  const pnow=NET.now();
  if(NET.fast&&NET.fast.open&&NET._fastAt&&pnow-NET._fastAt>NET.REDIAL_MS){
    try{NET.fast.close();}catch(_){}
    NET.fast=null;NET._fastAt=0;
    NET.dialFast(); // the lane CLAIMED open while packets died — start over
    NET.logEvent("redial");
  }
  if(NET.lastSnapAt&&NET.now()-NET.lastSnapAt>1500){
    if(!NET._stale){NET._stale=true;NET.logEvent("stall-start");NET.status("⏳ Waiting for the host… (their window may be minimized)");}
  }else if(NET._stale){NET._stale=false;NET._laneShown=undefined;NET.logEvent("stall-end");if(NET.connectedTxt)NET.status(NET.connectedTxt);}
  // local cosmetics: blocking pose + ghost placement preview
  // v97: guests get THE SKILL SHOT too — the old guest frame never computed siegeAim,
  // so a guest catapult's RMB fell through to the archer aim-zoom (nose in the wheels).
  player.blocking=rmbHeld&&canBlock(player)&&!placing&&player.cls!=="dragoon";
  const lobber=player.cls==="catapult"||player.cls==="trebuchet";
  siegeAim=rmbHeld&&lobber&&player.alive&&!placing;
  aiming=rmbHeld&&!!player.ranged&&!lobber;
  document.getElementById("crosshair").classList.toggle("aim",aiming||siegeAim);
  tickDraw(dt); // v124 THE DRAW — the guest looses locally for feel and reports it below
  if(ghost)updateGhostFollow(); // shared: classic follow, wall lines, gate snapping
  // ship our inputs to the host @20 Hz
  NET.inputT+=dt;
  if(NET.inputT>=1/NET.INPUT_HZ){
    const lane=(NET.fast&&NET.fast.open)?NET.fast:(NET.conn&&NET.conn.open?NET.conn:null);
    if(lane){
      NET.inputT=0;
      NET._inSeq=(NET._inSeq||0)+1;
      const _atk=((lmbHeld&&mouseLocked)||keys[" "])?1:0;
      // v128.5: stamp only on a frame that fights — see the `at` field below
      const _vt=(_atk||rmbHeld||NET._pendingShot)?NET.viewTime():0;
      lane.send({t:"input",seq:NET._inSeq,
        w:keys.w?1:0,a:keys.a?1:0,s:keys.s?1:0,d:keys.d?1:0,
        e:keys.e?1:0,atk:((lmbHeld&&mouseLocked)||keys[" "])?1:0,
        blk:rmbHeld?1:0,yaw:r1(camYaw),
        px:r1(player.root.position.x),pz:r1(player.root.position.z),
        f:r1(player.facing), // v96: the host mirrors our TRUE facing, not just our feet
        // v124 ANALOG: mx/mz are OPTIONAL and additive. An old host ignores them and walks us with
        // the w/a/s/d bits above, while px/pz carries our true position either way — so this
        // degrades to the v123 behaviour instead of breaking it. No PROTO bump.
        ...(moveVec.analog?{mx:r2(moveVec.x),mz:r2(moveVec.z)}:{}),
        // v128.4 THE ACK: the last snapshot q we have APPLIED. This is the host's only honest
        // congestion signal for the reliable lane — bufferedAmount cannot see head-of-line
        // blocking, and that is what froze guests for up to 39 seconds at a time. OPTIONAL and
        // additive: an old host ignores it and behaves exactly as v128.3. No PROTO bump.
        ...(NET.lastQ>=0?{aq:NET.lastQ}:{}),
        // v128.4 THE E TAP: a monotonic count of real E presses, so a tap still reaches the
        // host when auto-gather has pinned keys.e. Also optional — see driveRemote.
        ...(NET._eTap?{et:NET._eTap}:{}),
        // v128.5 THE VIEW STAMP: the host-clock instant of the world we were aiming at. Sent
        // ONLY on a frame that swings, blocks or looses — combat is the only thing that needs
        // it, and 9 bytes at 20Hz is not worth paying while walking. ABSOLUTE, not "rewind me
        // N ms", so the input packet's own transit cannot bias it: if this packet takes 300ms
        // to arrive the host still resolves against the instant we actually saw. Optional and
        // additive — an old host ignores it and behaves exactly as v128.4. No PROTO bump.
        ...(_vt>0?{at:Math.round(_vt)}:{}),
        ...(NET._pendingLob?{lobx:r1(NET._pendingLob.x),lobz:r1(NET._pendingLob.z)}:{}),
        ...(NET._pendingShot?{shot:NET._pendingShot}:{})}); // v124 THE DRAW: a loosed arrow
      NET._pendingLob=null;
      NET._pendingShot=null;
    }
  }
  rosterAccum+=dt; if(rosterAccum>0.5){rosterAccum=0;updateRoster();}
  drawMinimap();
};
NET.guestAct=function(a){
  if(NET.conn&&NET.conn.open)NET.conn.send({t:"act",...a});
};

// ========================================================= START MENU =======
// v128.9 THREE SCREENS. 1: your name, on black. 2: three shields — SOLO / CO-OP / PVP. 3: host,
// join and the hall, reached only from the two multiplayer shields. Every id wireMenu binds is
// unchanged; this is a relayout, not a rewrite of the entry points.
NET.MENUS=["namescreen","startmenu","setupscreen"];
NET.uiScreen=function(id){
  for(const m of NET.MENUS){
    const e=document.getElementById(m);
    if(e)e.style.display=(m===id)?"flex":"none";
  }
};
// Leaving the menu for the world has to close ALL of them, not just the one that used to exist.
// uiHost and applyWorld both hid "#startmenu" by name, and after v128.9 the player is standing on
// #setupscreen when a hall opens — so that line would have left the setup screen over the game.
NET.uiHideMenus=function(){ for(const m of NET.MENUS){const e=document.getElementById(m);if(e)e.style.display="none";} };
NET.uiSolo=function(){
  inMenu=false; // the horns sound — the solo war begins NOW
  NET.uiHideMenus();
  msg("The kings are crowned. The war begins.","gold");
};
// The two multiplayer shields. The mode is decided HERE, by which shield was pressed, so the old
// PvP/Co-op pick-pair on the host row is gone — one decision, made once, in the place it is asked.
NET.uiMode=function(mode){
  NET.gameMode=(mode==="coop")?"coop":"pvp";
  const t=document.getElementById("setuptitle");
  if(t)t.textContent=(NET.gameMode==="coop")?"CO-OP vs AI":"PVP";
  const hr=document.getElementById("hostrow"), jr=document.getElementById("joinrow"),
        sl=document.getElementById("serverlist");
  if(hr)hr.style.display="none"; if(jr)jr.style.display="none"; if(sl)sl.style.display="none";
  const bh=document.getElementById("btnhost"), bj=document.getElementById("btnjoin");
  if(bh)bh.classList.remove("on"); if(bj)bj.classList.remove("on");
  NET.uiScreen("setupscreen");
  if(typeof Sound!=="undefined")Sound.play("ui_select");
};
NET.uiShowJoin=function(){
  const bh=document.getElementById("btnhost"),bj=document.getElementById("btnjoin");
  if(bh)bh.classList.remove("on"); if(bj)bj.classList.add("on");
  const hr=document.getElementById("hostrow"); if(hr)hr.style.display="none";
  const jr=document.getElementById("joinrow");
  jr.style.display="flex";
  NET.uiBrowse(); // v92: opening JOIN scans the hall right away — the code box stays for private halls
  if(NET._reveal)NET._reveal(jr); // v124.1
  // v124.1: focusing the code box summons the keyboard over the whole menu on a phone before the
  // player has even decided to type. Let them tap the field themselves.
  if(!document.documentElement.classList.contains("touch-mode"))
    document.getElementById("joincode").focus();
};
NET.uiName=function(){ // the name screen — first thing a warrior does
  const v=String((document.getElementById("playername")||{value:""}).value||"").trim().slice(0,28);
  NET.myName=v||NET.rollName();
  try{localStorage.setItem("regicideName",NET.myName);}catch(_){}
  NET.uiScreen("startmenu");
  NET.showWhoAmI();
  if(typeof player!=="undefined"&&player&&!player.isKing)player.name=NET.myName;
};
// v124: the name gate is gone. Typing on a phone before you have seen the game is a real drop-off
// point, and the name only matters once other people can read it. You are auto-titled in John's
// format — "Alexander the Great" — and can rename yourself from the menu or the action grid.
NET.rollName=function(){
  const i=Math.floor(Math.random()*NAMES.length*EPITHETS.length);
  return NAMES[i%NAMES.length]+" "+EPITHETS[Math.floor(i/NAMES.length)%EPITHETS.length];
};
NET.showWhoAmI=function(){
  const el=document.getElementById("myname");
  if(el)el.textContent=NET.myName||"—";
};
NET.uiRename=function(){
  const v=prompt("Your name, warrior:",NET.myName||"");
  if(v===null)return;
  NET.myName=String(v).trim().slice(0,28)||NET.rollName();
  try{localStorage.setItem("regicideName",NET.myName);}catch(_){}
  NET.showWhoAmI();
  if(typeof player!=="undefined"&&player&&!player.isKing)player.name=NET.myName;
};
NET.uiHowTo=function(show){
  document.getElementById("howto").style.display=show?"flex":"none";
};
(function wireMenu(){
  const el=id=>document.getElementById(id);
  if(el("btnsolo"))el("btnsolo").onclick=NET.uiSolo;
  // v124: multiplayer moves behind one disclosure, so PLAY owns the screen
  // v124.1: a disclosure that pushes itself off the bottom of a phone screen is no disclosure at
  // all. The menu scrolls now, but the row also brings itself into view so nobody has to find out
  // that it scrolls.
  NET._reveal=function(elm){
    if(!elm)return;
    setTimeout(()=>{try{elm.scrollIntoView({block:"nearest",behavior:"smooth"});}catch(_){}},60);
  };
  // v128.9: the two multiplayer shields
  if(el("btncoop"))el("btncoop").onclick=()=>NET.uiMode("coop");
  if(el("btnpvp"))el("btnpvp").onclick=()=>NET.uiMode("pvp");
  if(el("btnsetupback"))el("btnsetupback").onclick=()=>NET.uiScreen("startmenu");
  if(el("btnrename"))el("btnrename").onclick=()=>{NET.uiScreen("namescreen");
    const p=el("playername"); if(p){p.value=NET.myName||"";
      if(!document.documentElement.classList.contains("touch-mode")){p.focus();p.select();}}};
  // v128.9: the die now lives INSIDE the name box on screen 1, so it rolls the FIELD as well as
  // the stored name — otherwise a player would roll a name, see it in the box, and then have the
  // box's own text silently overwrite it on CONTINUE. Same id, same behaviour mobilecheck asserts
  // (#myname changes and still reads "<Name> the <Epithet>"), one more thing kept in step.
  if(el("btnreroll"))el("btnreroll").onclick=()=>{
    NET.myName=NET.rollName();
    try{localStorage.setItem("regicideName",NET.myName);}catch(_){}
    const p=el("playername"); if(p)p.value=NET.myName;
    NET.showWhoAmI();
    if(typeof player!=="undefined"&&player&&!player.isKing)player.name=NET.myName;
    if(typeof Sound!=="undefined")Sound.play("ui_select");
  };
  if(el("btnhost"))el("btnhost").onclick=NET.uiShowHost; // v92: HOST reveals the options row
  if(el("btnhostgo"))el("btnhostgo").onclick=NET.uiHost;
  if(el("btnjoin"))el("btnjoin").onclick=NET.uiShowJoin;
  if(el("btnbrowse"))el("btnbrowse").onclick=NET.uiBrowse;
  if(el("btnhow"))el("btnhow").onclick=()=>NET.uiHowTo(true);
  if(el("btnhowback"))el("btnhowback").onclick=()=>NET.uiHowTo(false);
  if(el("btnjoingo"))el("btnjoingo").onclick=NET.uiJoin;
  if(el("joincode"))el("joincode").addEventListener("keydown",e=>{if(e.key==="Enter")NET.uiJoin();e.stopPropagation();});
  if(el("joinpw"))el("joinpw").addEventListener("keydown",e=>{if(e.key==="Enter")NET.uiJoin();e.stopPropagation();});
  if(el("hostpw"))el("hostpw").addEventListener("keydown",e=>{if(e.key==="Enter")NET.uiHost();e.stopPropagation();});
  // v92: the name screen
  if(el("btnname"))el("btnname").onclick=NET.uiName;
  if(el("playername")){
    el("playername").addEventListener("keydown",e=>{if(e.key==="Enter")NET.uiName();e.stopPropagation();});
    try{const n=localStorage.getItem("regicideName");if(n)el("playername").value=n;}catch(_){}
  }
  // v129.2 THE NAME SCREEN IS A STEP, NOT A GATE — and it shows EVERY launch.
  //
  // v128.9 skipped it for anyone with a stored name, reasoning that a returning player should not
  // be asked twice. That was wrong in practice for a reason the code made invisible: v124's
  // autoName has been WRITING a rolled name to localStorage on every first load since v124, so
  // essentially every existing player is already "returning" and nobody ever saw the screen. What
  // they saw instead was a black flash — the CSS shows #namescreen at parse time, and the skip
  // could not run until all fourteen scripts had loaded. A screen that appears and then leaves on
  // its own reads as a bug, and John reported it as one.
  //
  // v124's original concern — typing a name before you have seen the game is a real drop-off
  // point — is answered by PREFILLING, not by skipping: the box arrives holding a rolled name, so
  // CONTINUE is one tap and nobody has to invent anything. Showing it always is also the honest
  // use of that moment: the game is still pulling ~29 MB behind this screen.
  (function firstRun(){
    let n=null; try{n=localStorage.getItem("regicideName");}catch(_){}
    NET.myName=n||NET.rollName();
    try{localStorage.setItem("regicideName",NET.myName);}catch(_){}
    const p=el("playername"); if(p)p.value=NET.myName;
    NET.showWhoAmI();
    NET.uiScreen("namescreen");
  })();
  // v92: host option toggles
  const pickPair=(idA,idB,set)=>{
    if(!el(idA)||!el(idB))return;
    el(idA).onclick=()=>{el(idA).classList.add("on");el(idB).classList.remove("on");set(true);};
    el(idB).onclick=()=>{el(idB).classList.add("on");el(idA).classList.remove("on");set(false);};
  };
  // NOTE: the hmPvp/hmCoop pair is gone with v128.9 — the shield IS the mode choice. pickPair is
  // guarded on both ids existing, so this simply no longer binds. NET.uiMode sets gameMode.
  pickPair("sdEasy","sdHard",v=>{aiDifficulty=v?"easy":"hard";
    // the two dials mirror each other — one setting, two doors
    if(el("hdEasy")&&el("hdHard")){el("hdEasy").classList.toggle("on",v);el("hdHard").classList.toggle("on",!v);}});
  pickPair("hdEasy","hdHard",v=>{aiDifficulty=v?"easy":"hard";
    if(el("sdEasy")&&el("sdHard")){el("sdEasy").classList.toggle("on",v);el("sdHard").classList.toggle("on",!v);}});
  pickPair("hvPub","hvPriv",v=>{NET.isPublic=v;
    const pw=el("hostpw"); if(pw)pw.style.display=v?"none":"block";
    if(!v&&pw)pw.focus();});
})();
