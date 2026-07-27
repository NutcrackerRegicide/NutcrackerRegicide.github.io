# REGICIDE PVP

A 50v50 medieval war prototype: every player is a single unit in an Age of
Empires-style match. Gather, build, arm up at the Barracks, and slay the
enemy King before yours falls. This build is single-player with 99 AI
"players" standing in for the eventual multiplayer.

## Run it

Double-click `index.html`. That's it — no build step, no server, works
offline (Three.js is vendored in `libs/`).

## Multiplayer (v1 — playtest with friends)

Host-authoritative P2P over the free PeerJS broker. No game server needed —
the broker only does the handshake, then traffic flows browser-to-browser.

**The one requirement: the game must be served over HTTP, not file://.**
Two easy ways:

1. **Netlify Drop** (easiest for Discord friends): go to
   https://app.netlify.com/drop and drag this whole folder in. Share the URL
   it gives you. Everyone opens the same link.
2. **Local**: run `python -m http.server` in this folder, open
   `http://localhost:8000`. (Friends would each do the same with their own
   copy of the folder — the map is seeded, so all copies build identical worlds.)

Then:
- One player clicks **HOST** and pastes the `regicide-xxxx` room code in Discord.
- Friends click **JOIN**, enter a name + the code, and each takes over the
  body of a living Blue soldier. Disconnecting hands the body back to the AI.

**IMPORTANT — version matching:** every player must run the SAME build.
Mismatched builds are refused at the door ("Version mismatch"). When you
update the Netlify site, tell everyone to hard-refresh (Ctrl+Shift+R).

**v1.3 caveats** (known, accepted for the friends playtest):
- Guests predict their OWN movement locally (instant response) and the host
  corrects them only on real disagreement — collisions may cause a soft tug.
  Other soldiers render one snapshot (~85 ms) behind the host, smoothly.
- HOSTS: keep your game window visible! Browsers freeze minimized tabs,
  which pauses the whole world for everyone. Guests see a waiting banner.
- Guests can move, fight, gather, construct, place buildings, change class,
  age up, man watch towers (E), harvest corn (E), run trade goods (E), and
  rally the army (G — soldiers converge on whoever last blew the horn).
- Manual aimed shots (RMB aim) and parry timing remain host-only: with
  ~150 ms of latency a parry window would be a coin flip.
- All guests join Blue. Red is the AI's side until the dedicated-server pass.

## Controls

| Key | Action |
|---|---|
| WASD | Move |
| Mouse drag / wheel | Look / zoom |
| Space or click | Attack (auto-targets nearest) |
| E | Gather / construct / open Barracks |
| B | Build menu (Villager only) |
| R | Change class at your Barracks |
| G | Rally the entire Blue army to you |
| H | Toggle controls panel |

## Project structure

Load order matters — files are numbered and loaded as plain scripts
(no bundler, no ES modules, so `file://` just works):

```
index.html          DOM + HUD skeleton, loads everything in order
css/style.css       All UI styling
libs/three.min.js   Three.js r128, vendored for offline use
js/00-data.js       Tuning knobs: classes, buildings, costs, RPS multipliers, map size
js/01-engine.js     Three.js scene, lights, low-poly mesh helpers
js/02-world.js      Terrain, trees, resource node placement
js/03-buildings.js  Building meshes, construction, damage, Town Centers
js/04-units.js      Unit factory + chunky class models (horse included)
js/05-combat.js     Projectiles, damage/RPS, death & respawn, movement
js/06-input.js      Player input, camera, build/class menus, rally
js/07-ai.js         Team AI directors (economy/training/raids) + bot behaviors
js/08-ui.js         Message feed, HUD, minimap
js/09-main.js       Tutorial hints, win/lose, player update, game loop
```

Most balance work happens in `00-data.js` (stats/costs) and the
`directorThink` function in `07-ai.js` (build order, training pace,
raid timing).

## Suggested first-session Git setup

From a terminal in this folder:

```
git init
git add .
git commit -m "REGICIDE PVP prototype: 50v50 slice"
```

Then create an empty repo on GitHub and:

```
git remote add origin https://github.com/YOURNAME/regicide-pvp.git
git push -u origin main
```

## Roadmap candidates

- Age progression (Stone → Imperial) gating classes and buildings
- Castle with garrison for the King; siege class to crack it
- Fog of war so Scouts matter more
- Dedicated server + client prediction + red-team guests (multiplayer v2)
- Local/king VOIP hierarchy
- Port to a real engine (Unreal/Unity) once the loop is proven —
  this prototype is the design document that plays.
