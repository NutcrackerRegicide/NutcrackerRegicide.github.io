# REGICIDE — Network Topology: P2P vs Dedicated vs Hybrid Relay

**Written August 2026 against `v128.5`.** Every number here is measured in this repo, not estimated.
Companion to `claude/REGICIDE-NETCODE-GAP-ANALYSIS.md`.

---

# 0. THE MEASUREMENT THAT DECIDES IT

`node tools/headless.js [ticks] [--render]` — new. It boots the real game exactly as the smoketest
does (all 14 scripts, real world gen, real AI, real combat, `WebGLRenderer` stubbed to a no-op),
leaves the menu via `NET.uiSolo`, warms the world for **5 simulated minutes** until the AI has
actually built a town, then times steady-state ticks.

```
units 136   buildings 50   ticks sampled 1800

per tick   mean 2.56   med 2.29   p90 3.10   p99 5.83   max 129.97  ms
30Hz budget is 33.33 ms  →  headroom at p99: 82.5%  (5.7x)
ticks over budget: 1 / 1800
```

**The entire 136-unit REGICIDE simulation costs 2.56 ms per tick with nothing on screen.** That is
**~8% of one core at 30 Hz.** A €4/month Hetzner box carries it several times over.

Two conclusions follow immediately, and they cut in opposite directions:

1. **A dedicated server is cheap and entirely feasible.** The simulation was never the problem.
2. **A dedicated server will not make anyone's frame rate better.** The host's 17 fps is not the
   sim — it is 4,000+ draw calls. Move the sim to a server and every client still renders 136
   units at 33.4 draw calls each. Jorunn was a *guest* in the field test and still ran at 18 fps.
   **The unit rigid-cluster merge is required in every topology.** Nothing here replaces it.

---

# 1. WHAT WE HAVE BEEN CODING

**P2P, host-authoritative, over PeerJS** — and it is worth being precise, because it is already
partly a hybrid:

| piece | who provides it today |
|---|---|
| Simulation authority | **one player's browser tab**, which is also rendering the game |
| Signalling / peer discovery | PeerJS's **public broker** (a server, just not yours) |
| NAT traversal | public STUN, and TURN relay when direct fails (`docs/TURN-SERVER-GUIDE.md`) |
| Room listing | the "HALL" — a registry hosted by **whichever peer holds `HALL_ID`** |
| Content delivery | GitHub Pages, static, free |

So there is no such thing as "no server" here — there is a server you do not control, for the two
jobs P2P cannot do itself. Everything the field test found flows from the first row of that table:

- `simR` **0.779** — the authority's match clock loses 22% of wall time to the dt clamp, because
  the authority is rendering at 17 fps.
- The 39-second freezes: the authority's uplink and frame rate are a *player's*, not a server's.
- No host migration. The `HALL_ID` registry has no election. When the host leaves, the match dies.
- The host has **zero latency** and everyone else pays. Lag compensation (v128.5) narrows that
  but cannot remove it.
- Anyone can read the whole authoritative simulation, because it is running in their browser.

---

# 2. THE THREE OPTIONS

## Option 1 — Pure P2P (today)

**Keep** if the goal is "a thing my friends and I play sometimes, that costs nothing and lives
forever on a static host."

| | |
|---|---|
| Cost | **£0.** Static Pages, no ops, no domain, no cert, no uptime to babysit |
| Offline / solo | works completely |
| Authority quality | **whatever the host's laptop is doing** |
| Host leaves | match over |
| Cheating | trivially possible; the authority is on a player's machine |
| Ceiling | roughly what you have now |

## Option 2 — Hybrid P2P + room relay

A small always-on service that does **signalling, room listing and TURN** — but the simulation
still runs on a player's machine.

| | |
|---|---|
| Cost | ~€4–5/month, plus a domain |
| Fixes | the unelected hall registry; NAT failures; the dependency on PeerJS's public broker; join reliability |
| Does NOT fix | `simR`, the host's frame rate, host migration, cheating, the host's latency advantage |
| Effort | **small** — this is mostly configuration and a ~200-line room service |

**This is a strict improvement on today at low cost and low risk, and it is independent of Option
3** — a relay you stand up now is still useful if you later move the authority onto it.

## Option 3 — Dedicated headless authority

The server owns the simulation. Clients render and send input. This is what your blueprint asks
for, and the measurement above says it fits comfortably.

| | |
|---|---|
| Cost | ~€4–5/month + domain + TLS. One box runs several concurrent matches at 8% core each |
| Fixes | **`simR` becomes 1.0 and stays there** — a server never renders, never hits the dt clamp |
| | the freeze class of bug: the authority's uplink is a datacentre's, not a bedroom's |
| | host leaves → nothing happens; the match continues |
| | everyone has the same latency to authority; the host's free ride ends |
| | cheating gets meaningfully harder — the sim is not on a player's machine |
| Does NOT fix | **anyone's frame rate.** Still 4,000+ draw calls per client |
| | solo/offline play, which must keep the current in-browser path |
| New burden | uptime, TLS renewal, a second deploy target, and matches now cost money to run |

### The TLS detail that bites first

The client is served from GitHub Pages over **HTTPS**, and a page on `https://` may not open a
plain `ws://` socket. A public dedicated server therefore needs `wss://`, which needs a domain and
a certificate (Let's Encrypt or Cloudflare in front). **Local development is unaffected** — serve
the client from `http://localhost` alongside `ws://localhost:3000` and there is no mixed-content
problem at all. Plan for the cert before the cloud step, not after.

---

# 3. THE FINDING THAT CHANGES THE COST OF OPTION 3

**REGICIDE's simulation already runs headless in Node. Today. Unmodified.**

`tools/smoketest.js` has been doing it for 29 versions, and `tools/headless.js` now does it as a
benchmark. What it takes is not a rewrite:

- `require('three')` — used for **maths and the scene graph**, never for drawing;
- `THREE.WebGLRenderer` stubbed to `{setSize(){},render(){},…}` — **7 lines**;
- ~25 lines of DOM stubs (`document.getElementById`, `addEventListener`, …);
- `clock.getDelta = () => 1/30` — **the fixed-rate tick loop your blueprint asks for already
  exists**, and the whole test suite runs on it.

So the honest cost of a dedicated authority is a transport layer, a tick loop that already exists,
and unpicking the "the host is a player" assumptions in `10-net.js`. That is a project measured in
days, not a rewrite.

## Where I would push back on the blueprint: "ZERO Three.js on the server"

That constraint is stated as if THREE were a graphical dependency. **In Node it is not** — no
window, no DOM, no GL context, no GPU. It is a maths library with a scene graph attached.

Meeting the constraint literally means replacing `u.root.position` — a `THREE.Object3D` — with a
plain numeric store, everywhere. The gap analysis established there is **no sim/visual split
anywhere in this codebase**: `u.root.position` is simultaneously the collision state, the
combat-range state, the AOI centre, the wire payload and the drawn mesh, and it is read that way
by `04-units`, `05-combat`, `07-ai`, `03-buildings`, `09-main` and `10-net`. Removing it is the
single largest refactor available in this project.

What it buys, measured: **nothing on performance.** The sim is 2.56 ms/tick *with* THREE. What it
costs: weeks, and a very high chance of introducing exactly the class of divergence bug this
netcode has spent five versions killing.

**Recommendation: keep `three` as a server dependency.** The constraint that actually matters —
"no renderer, no DOM, runs under `node server.js`, uploads to a VPS unchanged" — is already met.
If the dependency is ever genuinely in the way, extract the state layer *then*, behind the
measurement that says so.

---

# 4. RECOMMENDATION

**For this game, as it actually is: Option 3 is the right destination, and Option 2 is worth
doing on the way — but neither is the next thing to do.**

The sequencing matters more than the choice:

1. **Field-test v128.5 first.** The freeze fix, the peer reaper and lag compensation have never
   been played. If the freeze is gone, the case for urgency on a dedicated server weakens
   considerably; if it is not, the diagnosis moves. Either way, that is one evening and £0.
2. **Then the unit rigid-cluster merge.** 2,086 → ~660 draw calls. It is the largest measured
   lever in the project, **every topology needs it**, and it is the only thing here that makes the
   game feel better on the hardware your friends actually own.
3. **Then the dedicated server**, if the game is still worth the ops burden by that point — and
   build the room service (Option 2) as its first component, since a dedicated authority needs
   matchmaking and TLS anyway.

The argument for doing the server *first* is that it permanently removes an entire class of bug —
everything downstream of "the authority is a laptop rendering a game." That is a real argument and
`simR 0.779` is its evidence. The argument against is that it costs money and ops forever, fixes
zero frames per second, and the thing that would most improve a playtest tomorrow is 660 draw
calls instead of 2,086.

## One thing to settle before any of it

**The asset licence.** 75 of 139 sounds carry `2021 Epic Stock Media (Empire Game) — All Rights
Reserved` in their Vorbis comments, in a public repo, embedded as base64 in `js/audio-data.js`.
Standing up paid infrastructure to distribute that is a strictly worse position than shipping it
from a free static host. This has been the top of the watch list for four versions and remains
unread.

---

# 5. IF AND WHEN OPTION 3 GETS BUILT

The shape, given what is already here:

```
REGICIDE PVP GAME/
  js/            ← unchanged client (Three.js, DOM, input)
  sim/           ← EXTRACTED from js/: 00-data, 02-world, 03-buildings,
                   04-units(state half), 05-combat, 07-ai, 09-main(tickBody)
                   …loaded by BOTH the browser and the server
  server/
    server.js    ← process.env.PORT || 3000, `ws`, no DOM, no renderer
    loop.js      ← process.hrtime.bigint() fixed 30Hz, catch-up clamped
    stubs.js     ← the 30 lines tools/headless.js already proves are enough
  tools/
    headless.js  ← already exists: the tick-cost benchmark
    botspawn.js  ← N headless clients against a local server for load
```

The transport is the easy part. The real work, in order:

1. **Decide what `sim/` is** and make the browser load the same files — one codec, one simulation,
   the rule this codebase already lives by (`packRows`/`readSnapRows` are one decoder for exactly
   this reason).
2. **Unpick "the host is a player" from `10-net.js`.** `NET.mode==="host"` currently implies a
   local `player`, a camera, a HUD and `hostAdmit` handing out a body from `units`. A server has
   no player. This is the actual porting work.
3. **Keep the P2P path alive** for solo and for LAN-style play with no server, or the game stops
   working the moment the box is down or the bill lapses.
4. **`botspawn.js`**, which is worth building early — 90 headless clients is the only way to know
   whether the 8%-of-a-core figure survives contact with 90 sockets and 90 AOI passes.

`tools/headless.js` is the first piece of that and it is already in the repo.
