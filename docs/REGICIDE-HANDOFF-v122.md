# REGICIDE PVP — Handoff v122 (July 2026)

Upload this file at the start of a new chat (or read it from the "Nutcracker Regicide" project) to continue development. Supersedes all prior handoffs. Covers **v107 THE SCORE & THE 90-SECOND ADVANCE** (recap), **v108 THE AUDIT** (recap), **v109 THE MIX FIX & THE VOICES**, **v110 THE WOLVES**, **v111 THE QUIET FIXES**, **v112 WOLF QUIET + NEW ANTHEMS**, **v113 THE FIELD PASS**, **v114 THE GREAT WOOD**, **v115 THE STANDS**, **v116 THE MOBILE SPIKE**, **v117 TWIN STICK**, **v118 NO WALLS**, **v119 THE ROTATED STAGE**, **v120 THE MOBILE GAME**, **v121 THE HOME-SCREEN PASS**, and this build: **v122 THE LEAK**.

> **PROTO 23 → 24 → 25.** Neither build changes a message format, but both change the generated world, and `nodes` rides the wire as a bare array indexed by generation order. Two clients with different forests agree on the bytes and disagree about which tree index 300 is, so the handshake has to reject the mismatch. **Everyone must run v122.** (v116-v122 are client-side only — PROTO stays 25.) (Rule worth keeping: *any* change to world generation is a PROTO bump, not just a change to the wire format.)

## v122 THE LEAK — why a 45-minute match went white

John, after a long Medieval-era game: *"The screen turned white and the game crashed, sending me
back to main menu."* That is a **GPU memory leak**, and it has been in the game since units could
change class. It affects desktop too — a phone just runs out first.

### The bug
```js
function buildBodyFor(u){
  while(u.body.children.length)u.body.remove(u.body.children[0]);   // <- removed, never DISPOSED
```
Three.js does not free GPU buffers when you `remove()` a mesh. `buildBodyFor` runs on **every class
change, every arm-up, and every respawn as a different unit**, and each run orphaned 25-45
`BufferGeometry` objects. Across ~100 bots dying, re-arming and advancing through six ages, a
30-45 minute match leaks **tens of thousands** of them. iOS hits its memory ceiling, kills the tab,
and the PWA relaunches at the start menu — exactly the white screen and the bounce to the main menu
John saw. `03-buildings.js` has always disposed its geometry on restyle; units never did.

`refreshBar` had the same shape — two `SpriteMaterial`s leaked per class change, on the same path.

### The fix, and the two things it must NOT free
- **Materials are left alone.** They come from `_skinCache` and are shared by every unit wearing
  them; disposing one would blank half the army.
- **Model-backed bodies are exempt.** `SkeletonUtils.clone()` *shares* geometry with the loaded
  glTF, so disposing a clone's buffers would destroy `MODELS[cls]` for every future unit.
  `tryAttachModel` sets `u._modelBody` and `buildBodyFor` checks it.

### The test that would have caught it
Counting is the only honest way — a source diff proves nothing about what actually got freed. The
smoketest monkey-patches `BufferGeometry.prototype.dispose`, builds a unit, counts its geometries,
changes class, and asserts **every one was freed** — then does ten more changes and asserts zero
drift. It reports **45 of 45 freed**.

### Also in v122
- **A lost GL context no longer renders as a silent white void.** `webglcontextlost` is caught and
  swallowed (which lets the browser hand the context back) with a line in the feed either way.
- **The scoreboard is reachable on mobile.** It's a *held* Tab on desktop; a phone has neither a
  Tab key nor a way to hold a menu entry, so the ☰ grid toggles it.
- **The build menus fit.** `#buildmenu` / `#classmenu` / `#smithmenu` / `#scoreboard` are fixed-size
  desktop panels, and the **Defensive** category has the most rows — it ran off the bottom of the
  phone. They're now capped to the stage, centred and scrollable, and `mobilecheck` walks **every**
  build category asserting it fits.

### A harness lesson
The smoketest stubs a minimal `document` and `location`, so 12-touch's "am I in a browser?" guard
was not enough — the whole bundle failed to load with `screen is not defined`. `screen` and
`navigator` are the honest tells and are now part of the guard.

## v121 THE HOME-SCREEN PASS

John played a full game to Enlightenment from the iPhone Home Screen — **43-62 fps, no browser
chrome**. Eight screenshots, five notes. Two of the bugs he found are **desktop bugs**, not mobile.

### 1. `undefined food · 200 gold` — a real bug, everywhere
The train menu built its price as `cost.food+" food"+(cost.gold?" · "+cost.gold+" gold":"")`. It
only ever knew **two of the four resources**. Every siege unit costs gold + **wood** and no food,
so the Siege Workshop read *"undefined food · 200 gold"* and never mentioned the 200 wood — which
is also why "the team stockpile can't afford a Battering Ram" was baffling: the price on screen
was wrong. `costText(cost)` now lists whatever a thing actually costs, and every call site — train
menu, trader, ox cart, age-up on both host and guest — goes through it.

### 2. The same message five times
`msgOnce(text, kind, windowS)` swallows identical text inside a 4-second window. The afford
warning now also names the real price. Desktop benefits too.

### 3. The Dynamic Island — it can't be removed, only respected
The cutout is hardware. What v120 got wrong was asking for `viewport-fit=cover` **without** the
matching safe-area padding, so the HUD ran under it and the age bar read "…E AGE" in every shot.
The twist: `env(safe-area-inset-*)` is in **screen** space and the HUD lives in a **rotated** stage.
`rotate(90deg)` maps stage `(a,b)` → screen `(H-b, a)`, so **screen-top is the stage's LEFT edge** —
exactly where the island lands once the phone is turned; anticlockwise flips it. A hidden probe
element reads the four insets, they're mapped through the rotation into `--sl/--st/--sr/--sb`, and
every anchored HUD panel offsets by them.

### 4. The feed
Two mistakes. v120 set `font-size` on `#feed`, but `.msg` carries its own — so nothing changed.
And `max-width:34vw` is wrong inside a rotated stage: **`vw` still means the viewport**, which is
now the short edge, so it produced a 185px ribbon that wrapped every tutorial hint into six lines.
Now: px widths, entries styled directly, each clamped to two lines, and a `MutationObserver` trims
the feed to **3** without touching the shared `msg()` the desktop build relies on.

### 5. No way to rotate or cancel a foundation
Desktop rotates with **R** and abandons with **Escape**; a phone has neither, so John could line up
a wall and then neither turn it nor back out. While a ghost is on the ground the pad now shows
**↻** and **✕**, the E button steps aside, and the big button reads **PLACE**.

### 6. AIM is a toggle, not a hold
John's call, and right: an archer or a trebuchet needs both thumbs free to steer while the shot is
lined up. AIM latches for ranged and lobbing classes; **BLOCK stays a hold for melee**, because a
block is a moment, not a stance. The latch releases on class change, death or entering placement.

### Tests
`mobilecheck` gained six checks per device plus two source checks — safe-area insets mapped onto
the rotated stage, feed short and clamped, five identical warnings leaving one, AIM latching while
BLOCK doesn't, placement revealing ROTATE/CANCEL with the big button on PLACE, and the foundation
actually turning then cancelling. **23 checks × 3 devices.**

Three harness lessons worth keeping:
- **`getBoundingClientRect()` inside the rotated stage returns the TRANSPOSED box.** A 360×34 feed
  line reported a height of 360. Use `offsetWidth`/`offsetHeight` for layout size. That is the
  second time this has cost a cycle.
- **Don't wall-clock a wait in this sandbox** — software GL runs the page at a few fps, so a fixed
  2.6s wait was a coin toss on whether a gather tick had fired. Poll instead.
- A source-text assertion happily failed on **my own comment**, which quoted the buggy line it was
  documenting. Strip comments before grepping code.

## v120 THE MOBILE GAME

v119's rotated stage worked ("better than expected"), so mobile stops being a spike and becomes a
supported way to play. John's brief, from a round of design questions:
**full game (not a cut-down soldier mode) · auto-gather · auto-attack · true fullscreen.**

### Design decisions he made, and why they shaped the code
| Question | His answer | Consequence |
|---|---|---|
| What is the mobile player? | **Full game, automated basics** | Every desktop hotkey needs a home → the ☰ grid |
| Auto-attack aiming | **Turns the body, never the camera** | Assistance, not possession — the camera is sacred |
| Auto-gather depth | **Chop what you walk up to** | No auto-walking home; you keep positional control |
| Interrupted while chopping | **Stop, fight, resume** | `resumeNode` remembers the tree |
| The big ATTACK button | *"can be removed, but may be needed for aiming the catapult and trebuchet"* | Made it CONTEXTUAL rather than removed — see below |

### AUTO-GATHER and AUTO-ATTACK
Both drive **the same flags a desktop player sets by hand** — `player.facing`, `lmbHeld`, `keys.e` —
rather than calling game functions directly. That is the whole trick: those three ride the
`{t:"input"}` packet, so **a guest's automation is executed by the host** with no new wire format
and no way for the two to disagree about what happened.

- **Gather**: within 3.2 units of a live node, a villager (or the ox, timber only) starts working it.
  Stops with a message when hands are full. On a guest it holds `keys.e`, which is exactly what the
  host's `driveRemote` already reads.
- **Attack**: nearest enemy **unit** within `rng + 0.4` → turn the body, hold fire. **Units only,
  deliberately** — `tryAttack` falls through to buildings when no unit is near, and auto-razing
  whatever you jog past is nobody's idea of help. Buildings stay on the manual button, and there's
  a test that a house in reach survives.
- Auto-fire stands down while **aiming or lobbing**: that shot is the player's to loose.
- A small caption under the crosshair says what the automation is doing (`⚔ engaging`,
  `⛏ gathering`, `hands full — return to the Town Centre`) so it never feels possessed.
- `lmbHeld` is now recomputed once per frame as `manualAtk || autoFire`, so the button and the
  automation can't stamp on each other.

### The contextual big button
John's instinct was right — with attacks automatic the button is dead weight *except* for siege.
It now relabels itself every frame:
- **FIRE** while aiming or lobbing (catapult/trebuchet loose their stone at the mark; a ranged
  unit's aimed shot hits 1.35× harder than its auto-fire)
- **CHARGE** when you have troops rallied — the F warcry, the most impactful thing a player does
- **ATTACK** otherwise, for razing buildings

BLOCK relabels to **AIM** for ranged and lobbing classes, since that's what RMB does for them.

### The ☰ action grid
Ten actions — Build, Class, Rally, Charge, Age Up, Interact, Respawn, Sound, Pixel, Help — as
big tap targets. Each entry **dispatches the key the desktop build already listens for**, so there
is exactly one implementation of every action and nothing can drift between the two platforms.
The grid closes itself whenever a real game menu takes the screen.

### PWA — actual fullscreen on iPhone
iOS Safari will not let a page hide its own URL bar; **Add to Home Screen is the only route**, and
that needs `apple-mobile-web-app-capable`, a status-bar style, an apple-touch-icon and a manifest.
All four are in now, plus `manifest.json` (`display: fullscreen`, `orientation: landscape`) and
generated pixel-art icons at 180/192/512. **John: Share → Add to Home Screen, then launch from the
icon — no browser chrome at all.** Android reads the manifest for the same effect.

### Tests
`mobilecheck` gained six checks per device — auto-gather starts and actually banks wood with zero
input, auto-attack turns the body and damages the target while `camYaw` stays bit-identical, an
enemy interrupts the work, a building in reach is *not* razed, the grid opens/fits/closes — plus
two PWA checks that the manifest is fullscreen-landscape and every icon file it names exists.
**17 checks × 3 devices.**

## v119 THE ROTATED STAGE

John: *"It still won't let me go landscape, can you just default the game to landscape without any notification. Also sensitivity on the right stick needs to be reduced by 50%. Another weird thing — if I click on a netlify link it auto goes to mobile controls, but if I copy/paste the link in Safari or Brave it defaults to PC mouse/keyboard controls."*

### 1. The game rotates itself — asking was always the wrong move
v117 and v118 both *asked* the phone to turn. With rotation lock on, or inside an in-app browser that ignores orientation, that request can never be granted, so the fix isn't a better prompt — it's not needing one. **The game now draws itself sideways.**

Everything the game owns is moved into a `#tstage` div sized to the viewport's **transpose** and rotated 90°. On a 390×844 portrait phone the stage is a 1180×545 landscape battlefield; hold the handset sideways and it reads correctly. No notice, no gate, nothing to dismiss — `#trotate` is gone entirely.

Three things this needed getting right:
- **The viewport width is chosen so `100vh` lands on 1180.** `width = 1180 × (deviceW/deviceH)` ≈ 545 on an iPhone. Without that the rotated stage is either a 390-px sliver or a 2500-px sheet, and the fixed-pixel HUD is wrong at both.
- **The renderer is sized to the STAGE, not the window.** `camera.aspect` is stage w/h — 2.16 in rotated portrait.
- **Touch deltas arrive in SCREEN space and have to be mapped into stage space.** `rotate(90deg) translateY(-100%)` maps stage `(a,b)` → screen `(H-b, a)`, so the inverse delta is `(dy, -dx)`; anticlockwise is `(-dy, dx)`. Hit-testing needs no help — the browser does that through the transform — but a thumb pushed "up the phone" would otherwise walk sideways. The floating stick rings are deliberately kept *outside* the rotated stage and positioned straight from `clientX/clientY`: they're circles, so there's no orientation to get wrong, and it avoids a second coordinate conversion.
- **A ⟲ button flips the rotation direction**, remembered in localStorage. Which way John turns the phone isn't something a script can know when the OS won't report it, so it's one tap rather than a guess. `?rotate=0` opts out.

### 2. Why pasting the URL gave desktop controls
v118 required `(pointer: coarse)` **AND** `(hover: none)`. Safari and Brave — especially with "Request Desktop Website", which is sticky per site — can report a **fine pointer with hover** on a phone. Tapping a link opened an in-app browser that reported honestly; pasting the URL opened a browser that didn't.

Detection is now: **a device with real touch points** (`maxTouchPoints > 0` or `ontouchstart`) **AND any one of** coarse pointer, no hover, a screen under 900 px, or a mobile UA string. OR'd instead of AND'd. `?touch=1` / `?touch=0` still force it either way.

### 3. Right stick halved
`LOOK_RATE_X` 2.9 → **1.45**, `LOOK_RATE_Y` 2.1 → **1.05** rad/sec at full deflection. The sandbox renders at a few fps and caps per-frame `dt`, so frame-rate-based measurement can't verify this — `mobilecheck` asserts the constants at the source instead.

### Tests
`mobilecheck` now runs the full control drive on all three emulated devices (it used to skip portrait behind the gate) and asserts: no rotate notice exists, the stage is landscape whichever way the device is held, the renderer is sized to the stage with aspect > 1, the rotated stage lands near the HUD's design width, and the look constants are halved. The stick drive pushes along the screen axis that maps to stage-up, which is what proves the delta mapping works. **11 checks × 3 devices.**

Note for future work here: `getBoundingClientRect()` on anything inside the stage returns the **transposed on-screen box**. Use `offsetWidth`/`offsetHeight` when you mean layout size — that cost a debugging cycle.

## v118 NO WALLS — the rotate gate was a trap

John on v117: *"now I get a notification to turn my phone sideways but when I do nothing happens."*

**My mistake, and the worst kind.** v117's rotate gate was a *hard* gate — a full-screen panel with no dismiss, shown whenever `innerHeight > innerWidth`, clearing only when the viewport actually reported landscape. If the phone's rotation lock is on, or the page is running inside an in-app browser that refuses to rotate, or the browser never fires `resize`/`orientationchange`, that panel is a wall with no way past it. **The game became unplayable because of a hint.**

The rule this earns: *a UI that gates on a condition the user may not be able to satisfy must always have an escape hatch.* Never assume a device will do what you ask it to.

### Fixes
- **The gate is now a dismissible hint.** Tap it to play in portrait anyway; it also **gives up on its own after 7 seconds** whether or not the phone ever rotates, and never re-latches once dismissed. It can no longer block anything.
- **Orientation is polled twice a second** as a backstop. Some in-app browsers fire neither `resize` nor `orientationchange` reliably, and the whole v117 layout depended on those events firing.
- **Portrait is a real layout now**, not a rejection: a gentler 780-px virtual viewport (against landscape's 1180), the two stick zones split left/right across the lower 42%, the action buttons in a horizontal row at mid-screen, and a smaller minimap. Landscape is still the better way to see a 16:9 battlefield — the hint still says so — but portrait plays.
- **Viewport widening keyed off `innerWidth`, not `screen.width`.** iOS reports `screen.width` as the *portrait* width whichever way the phone is held, so v117's `screen.width<VW` test could leave landscape unwidened on exactly the devices it was meant for.

### Tests
`mobilecheck` gained the assertions that would have caught this: the hint dismisses on tap, never re-latches, and portrait is measurably laid out and playable (canvas fills the viewport, both stick zones present and split). It now runs 11 checks across landscape phone, portrait phone and tablet.

## v117 TWIN STICK — the spike survives contact

John ran v116 on an iPhone. **60 fps, min 48.** That settles the question the spike existed to ask: the phone renders this game fine, and the trees/stands work of v114-v115 costs nothing on real hardware. His three notes, all fixed here.

### 1. The canvas only filled a third of the screen
The real bug, and a good lesson. v116 widened the virtual viewport to shrink the desktop HUD and then called `renderer.setSize()` on the next line — but **a `<meta viewport>` change does not apply synchronously**, so `innerWidth` was still the old 390. The renderer sized itself to the pre-widening viewport and the canvas sat at a third of a 1180-wide layout. The emulated harness never caught it because Playwright applies the viewport instantly.

Now there's a `fit()` that only acts when the size actually changed, wired to `resize`, `orientationchange` and `visualViewport.resize`, plus a retry schedule at 0/50/150/350/700/1200/2000 ms — long enough to outlast iOS Safari's toolbar collapse, which resizes the viewport twice after load. `mobilecheck` asserts the canvas matches the viewport to within 2 px on every device.

### 2. "With twin stick controls there should be at least two sticks"
Correct, and v116 wasn't twin-stick — it had a movement stick and a look-**drag** region, which is a different (worse) thing. There are now two real floating sticks:
- **Left** — movement, still synthesising `keys.w/a/s/d` so the sim and the net packet stay untouched.
- **Right** — camera, and importantly **rate-based**: held deflection turns at 2.9 rad/s in yaw and 2.1 in pitch, integrated per frame. That's what makes it a stick rather than a drag — the camera keeps turning while you hold it and stops dead on release. The harness asserts both halves of that.

Both sticks are **floating** (they appear wherever the thumb lands). The action buttons moved to a vertical column on the right *edge*, and the right stick's zone stops short of them, so a thumb on ATTACK can never also start steering.

### 3. "Should play in wide screen format on phone"
- A **rotate gate**: a full-screen "turn your phone sideways" panel whenever height > width. It's a sibling of the pad, not a child — the start menu is `z-index:60` and a child of the pad's own stacking context could never sit above it.
- A **⛶ fullscreen button** that requests fullscreen and then tries `screen.orientation.lock("landscape")`. iOS Safari supports neither on `<html>`, which is exactly why the rotate gate exists rather than relying on the lock.
- The 1180-px virtual viewport is now applied **only in landscape** — in portrait it would shrink the game to a stamp.

### Also fixed: the pad swallowed menu taps
Raising the pad's `z-index` to sit above the HUD put it above the `z-index:50/60` overlays too, so the sticks intercepted taps meant for the start menu. The pad now sits at **30** — above the HUD, below every overlay — and a `syncPad` loop hides the sticks and buttons entirely whenever `inMenu`, `gameOver`, `menuOpen` or a dead player owns the screen, releasing every latched input on the way. A stick held as a menu opens no longer leaves the player walking into a wall.

### Where the mobile build stands
Working: landscape gate, fullscreen, full-bleed canvas, twin sticks, attack/block/E, the HUD triage, the perf tier, the FPS read-out. `tools/mobilecheck.js` runs 8 checks across three emulated devices (landscape phone, portrait phone, tablet) using real synthetic `TouchEvent`s.

Still not done, and still the expensive half: the responsive CSS pass, and touch access to the build menu, class menu, quest board, blacksmith and the other 18 hotkeys. **Before either of those**, the draw-call finding from v116 stands — 54 nutcrackers cost ~1,800 draw calls against ~380 for the whole forest, and units are the thing to optimise if mobile is taken further.

## v116 THE MOBILE SPIKE

John asked whether the game could be playable on mobile. The answer was "yes, but the cost is a second control scheme, not a port" — so rather than argue it, this build is the **cheapest experiment that settles it**: twin-stick controls, a mobile performance tier and an FPS read-out, with **no** HUD redesign, no menu rework and no hotkey replacement. That is deliberately the expensive half, and it isn't worth doing until the controls prove out on a real handset.

### What the audit found first
- Zero touch handling anywhere in the codebase. Zero `@media` queries in 14.5 KB of CSS, 138 hardcoded pixel values, ~70 fixed-position HUD elements.
- The game is an FPS in disguise: pointer lock, WASD, mouse-look, LMB/RMB, and **21 distinct hotkeys**. Pointer lock does not exist on mobile at all.
- In our favour: it's a URL, not an app; `index.html` already had a proper viewport meta; `setPixelRatio` was already capped at 1; and `applyLOD`'s `lodSkipAnim` — the single most valuable mobile optimisation — already existed.

### `js/12-touch.js` — the whole spike, in one self-contained file
Nothing else in the game references it. **Delete the file and the desktop build behaves identically**; it early-returns unless it detects a coarse pointer with no hover (`?touch=1` forces it on so the layout can be checked on a desktop, `?touch=0` forces it off for a touchscreen laptop, `?gfx=high` keeps the full render path).

- **Movement synthesises `keys.w/a/s/d` from the stick vector.** This is the trick that kept the whole thing cheap: the existing movement code AND the `{t:"input"}` net packet (which already sends w/a/s/d as bits) work completely untouched, so **multiplayer came free**. 8-way rather than analog, which is the right trade for a spike.
- **Looking** writes `camYaw`/`camPitch` under exactly the same clamps as the desktop `mousemove` handler. **Attack/block** set `lmbHeld`/`rmbHeld`, the same flags the mouse sets. **E** is held (gather ticks while it's down) *and* dispatches a synthetic keydown, because several interactions fire on the key edge.
- The stick is **floating** — it appears wherever the thumb lands. On a phone that is the difference between playable and fighting the UI.
- **Pointer lock is declared satisfied** (`mouseLocked=true`) and `canvasEl.requestPointerLock` is stubbed, since nearly every input path gates on that flag.
- **Perf tier**: kills the composer (bloom → grade → vignette = three full-screen passes), disables shadows, drops pixel ratio to 0.7 and pulls the cull line in via a new `setHideD()` (09-main's `HIDE_D` became a `let` with a clamped setter — desktop never calls it).

### The one line that mattered most
Widening the **virtual viewport** to 1180 CSS px. Every HUD panel is sized in fixed pixels for a ~1920 desktop window, so on an 844-px phone the same panels ate 2-3× the proportion of the screen — the objective banner alone covered the battlefield. One `<meta viewport>` rewrite shrinks the entire HUD proportionally. It is a stand-in for the responsive pass, not a replacement, but it took the layout from unreadable to playable. Compare `tools/shot_mobile_phone.png` before and after if you ever doubt it.

### `tools/mobilecheck.js`
Drives the spike in an emulated phone (844×390) and tablet (1180×820) with real synthetic `TouchEvent`s: starts a solo battle through the actual menu, works the stick, swipes to look, presses the pad, and asserts that movement, camera, attack and block all land. 6 checks per device. Run it after touching 12-touch.js.

### THE FINDING THAT MATTERS — it isn't the trees
`tools/perfcheck.js` was made deterministic (it was reporting whatever LOD state the frozen loop left behind — the base vantage swung between 277 and 1504 draw calls run to run). Forcing everything inside the cull radius visible gives the honest worst case:

| vantage | units on screen | draw calls | triangles |
|---|---|---|---|
| deep in the wood | 27 | **117** | 47k |
| on the King's Road | 5 | **377** | 65k |
| in a base, army present | 54 | **1,790** | 105k |

**680 trees cost ~120-380 draw calls. Fifty-four nutcrackers cost ~1,800.** Each unit is a procedural rig of 24-30 separate meshes. If mobile is ever taken seriously, the optimisation target is *unit meshes* — merging each rig the way v114 merged the tree, or an impostor tier at distance — and not scenery. That is worth knowing before anyone spends a week on the HUD.

### What this build deliberately does NOT do
No responsive CSS pass, no touch access to the build menu, class menu, quest board, blacksmith or the other 18 hotkeys, no analog movement, no pinch-zoom, no orientation lock. On a phone you can currently walk, look, fight, block and gather — which is exactly enough to answer "does this feel like anything?"

### Field-test asks — ANSWERED in v117
60 fps / min 48 on John's iPhone. Canvas sizing, twin sticks and landscape all fixed above. Open question that remains: do the stick rates (`LOOK_RATE_X` 2.9, `LOOK_RATE_Y` 2.1 rad/s) feel right in the hand?

## v115 THE STANDS

John, on seeing the v114 tree map: *"did you group trees together in areas creating forests, or are single trees just spaced somewhat evenly?"* — evenly, and he was right to ask. v114 planted a jittered grid, one tree every 11.5 units, with density ramping only by distance from the road. From ground level it read as forest; from above it was **uniform woodland pasture**. No stands to fight through, no meadows to fight in, and wood was underfoot everywhere rather than being somewhere you go.

Replanted from a field of **forest STANDS**:
- **22 stands**, each 23-46 units across. Density falls off from every centre as `1 - (d/r)^3.2`, scaled 1.45 so the cores run solid and only the eaves go ragged, plus a flat **3% lone-tree scatter** so the meadows aren't sterile. Grid step tightened 11.5 → 7.4 so a stand is genuinely thick.
- **Every stand is mirrored through the map centre**, `(x,z) → (-x,-z)` — the same 180° symmetry the two thrones sit on, so neither team can draw the better wood. `stand()` pushes both halves and the smoketest asserts the mirror.
- **Placed with intent, not just scattered**: two *home woods* per team (timber inside everyone's reach, replacing v34's `forest()` clumps), then three stands sitting deliberately **on the v113 flanking lanes** (`LANE_Z = 0, ±46, ±88` in 07-ai.js — keep them in step if those move) so a band swinging wide moves through real cover. The remaining stands fill in wherever they fit, rejected if they overlap an existing one by more than 20%.
- **680 trees** (was 590 on the grid). Draw calls measured 117 in the wood / 377 on the road / 277 in a base — unchanged in practice, because the v114 single-mesh tree is what pays for all of this.

**Measuring "is it actually clustered?"** — nearest-neighbour distance is a bad test here: the planting grid puts a floor under it either way (it only moved 1.5× and the assert failed on a forest that was visibly correct). The right statistic is the **index of dispersion** — quadrat-count variance over mean. A uniform/Poisson scatter sits near 1.0; v115 measures **2.42**. There's a second assert that open ground genuinely survives between stands (15-75% of probe points clear of any tree).

`tools/treemap.js` dumps every tree, node, bazaar and road point to JSON for a top-down plot — that map is what caught the problem, and it will catch the next one. Run it after any world-gen change.

## v114 THE GREAT WOOD

John: *"scale the trees up in relation to the nutcrackers, right now they are too small. The map also needs to be flush with forest if possible (if it doesn't make the game lag)."* Measured first: a nutcracker on foot is **4.43 units**; the v34 tree was **5.5** — a forest you could see over. Now the average tree is **13.3 units, exactly 3× a soldier**, and the map carries **590 trees instead of 90** with no meaningful render cost.

### How it stays cheap
The v34 tree was a `Group` of three meshes, so "flush with forest" meant thousands of draw calls. Every tree is now **one vertex-coloured mesh**:
- `_mergeColored(parts)` merges a trunk cylinder and three canopy cones into a single `BufferGeometry` with a per-vertex colour attribute. (r128 ships `BufferGeometryUtils` as a separate file the game doesn't load, so the merge is by hand — `toNonIndexed()`, `applyMatrix4`, concatenate.)
- **Do not call `computeVertexNormals()` after the merge.** `applyMatrix4` already transforms the normals through the normal matrix, keeping ConeGeometry's smooth shading; recomputing them flat-shades every facet and the whole wood reads as pale mint instead of forest green. That cost a render cycle to spot.
- **8 silhouettes** are built once at world gen (`TREE_GEOS`) with 8 matching stumps (`STUMP_GEOS`), and every tree on the map shares them plus **one** `MeshLambertMaterial({vertexColors:true})`.
- Net effect: 590 trees + all other scenery = **7,850 scene meshes, versus 7,832 before the change** — the single-mesh tree paid for the 500 extra trees outright. Measured draw calls in-scene: 121 deep in the wood, 347 on the King's Road, 278 in a base. `tools/perfcheck.js` reports draw calls / triangles / frame time from three vantage points.
- Felling swaps `mesh.geometry` for the matching stump instead of hiding children, so `depleteNode` is still O(1).

### Scale
`TREE_SCALE` (02-world.js) is the single dial, the way `OXSCALE` is for the cart — it scales the bole, the canopy radius and the tier heights together. At **1.30** the average tree is 13.3 units (range 9.9–17.2 with per-tree jitter). Needle colours were dropped a shade (`0x3f6f33` → `0x355f2b` etc.) because a three-tier canopy catches far more hemisphere light than two smooth cones did and the old hex read washed-out.

### Planting (SUPERSEDED by v115's stands — the clearances below still apply)
A jittered grid at 11.5-unit spacing over the whole map, minus the ground the game actually needs:
- `TREE_CLEAR_BASE=52` around both thrones · `TREE_CLEAR_ROAD=21` along the King's Road · `TREE_CLEAR_BAZAAR=15` on the trade plazas · `TREE_CLEAR_NODE=8` around stone/gold/berries.
- The home woods are deliberately allowed inside the 52 ring — each team needs timber in reach. Only the town-centre yard itself is hard-cleared.
- All of this runs inside the seeded-RNG region of 02-world.js (`Math.random=mulberry32(...)`, restored at EOF), so every machine generates the identical forest and the node array lines up.
- `dist2()` lives in 04-units.js, which loads *after* 02-world.js — separate `<script>` tags don't share hoisting, so world generation uses a local `_d2()`. (Learned the hard way: the first attempt threw at load and silently killed the entire scenic layer.)

### CLEARING THE LAND — the change that made it playable
A flush forest broke building placement outright: `validFor` refused any plot within `r+3` of a live node, so with trees everywhere you could barely build outside your own yard. Three smoketests caught it immediately (mill layout, `findFarmSpot` beside an outlying pit, wall line segments 0/3). The fix is the standard RTS convention:
- **`validFor` no longer treats wood as an obstacle.** Stone, gold and berries still refuse a plot — those are finite prizes, not scrub.
- **`makeBuilding` calls `clearFootprint(b)`**, felling every live tree within `def.r + 2.2` (walls: `+1.6`). It calls the *wrapped* `depleteNode`, so the treefall sound and the `{t:"ndep"}` broadcast come free and guests fell exactly the same node indices — **no new wire format**.
- The **stump ring** left around a woodland outpost is deliberate: that ground was cleared, and it reads that way.

### Tests
8 new v114 asserts: canopy height vs a 4.43-unit soldier (2.5–4×), flush coverage (≥400 trees), one-mesh-per-tree sharing pre-built geometry, clear lanes (0 trees in a TC yard, 0 on the road), wood yields a plot but a stone pile does not, `makeBuilding` fells what it covers and leaves the rest standing, `TREE_SCALE` sane. Two existing tests were re-based to the new rule rather than fudged: the mill-layout scout now ignores wood when looking for clear ground, and the v99 ox-cart test re-derives which tree the ox actually swings at (on a flush map the nearest tree is no longer the one the test picked). Browser check **PASSED** on http and file://.

### Watch list for the field test
- **The wood economy is ~7.5× bigger** — 680 trees × 140 = ~95,000 wood on the map, against ~12,600 before v114. Nothing was rebalanced to match, and this is the single most likely thing to need adjusting after a playtest. Wood may simply stop being a constraint. Dials, in the order I'd reach for them: drop `amount:140` in `makeTree` to ~60-80 (a forest becomes a place you work rather than one tree solving the economy), then thin with `STEP`, then trim the stand count.
- Villagers and AI gatherers will now chop whatever tree is nearest rather than walking to a forest. Realistic, but it makes wood gathering much less of a logistics problem.
- Trees have never blocked movement and still don't, so a dense wood is cover you can see through, not a maze.

## v113 THE FIELD PASS (John's v112 field notes, all seven items)

### Mix
1. **Music trimmed again** — "still feels a little loud compared to other sounds." `MUSTRIM` **0.6 → 0.42** (−4.4 dB → −7.5 dB baked into `el.volume = master × music × MUSTRIM × fade`). Two things stacked to make music hot: the Suno masters run ~4 LU above the Empire foley, AND the v109 double-gain fix made SFX up to 12 dB louder — so the anthem needed to come down twice. Browser check confirms el.volume = 0.134 at defaults (0.8 × 0.4 × 0.42).
2. **Base alarm on a one-minute leash** — under a bombardment the town bell rang every 4 s forever. `THROTTLE.basealarm` **4000 → 60000 ms**, and the host's per-team bcast gate in `damageBuilding` (03-buildings) went **4 s → 60 s** to match. It's a warning again, not a metronome.
3. **Gather foley halved** — chop/farm/mine now fires on every OTHER swing (`player._gsw` alternating flag). Applied on the host player tick (09-main) and the guest gather theatre (10-net). The arm still swings every tick; the axe just isn't miked for all of them. **Build hits keep every strike.**
4. **The silent archer FIXED** — `fireAimedShot` (05-combat) had no `Sound.play` at all: the launch foley lived only in `shootArrow`, the auto/AI path. Manual right-click aim now plays the same key law (bow twang · `gun` musket crack · `cannonfire` powder blast) and the **host broadcasts it positionally**, since a free-aimed shot doesn't ride the snapshot's `_fx` arrow theatre.

### Economy
5. **Farms un-nerfed** — `FARM_PASSIVE` **0.5 → 2/3** (2 food every 3 seconds). v86 halved it from 1/sec and John's field test called that over-cut. Harvest payout untouched. Stats CSV row `farm_passive_food_s` updated; smoketest + the HARD-economy 20%-handicap assert both re-based.

### Models (04-units.js)
6. **THE OX CART, rebuilt at 1.7×** — v99's version was a stack of boxes. Now: the whole rig hangs off one scaled group (**module-level `OXSCALE`, one number that scales the beast, the wain, the load, the wheel roll rate AND the bar/tag heights together — shipped at 2.5, John called it down to 1.7 in the same session**), and the ox shares the destrier's anatomy — barrel + forequarters + hindquarters, a neck-and-head pivot carried LOW and forward (that low skull is what separates an ox silhouette from a horse's), zebu hump, dewlap, cloven hooves, horns that sweep out off the poll and hook up. The wain gained a carved yoke with bows and paired draught chains, a plank bed on a heavy frame, stake rails with iron shoes, flat rope lashings, a woodsman's axe on the rail, a team banner, and **8 logs stacked in a pyramid** (was 6) with pale sawn ends, growing with the haul. Four wheels — big behind, small on the steering axle — with the roll rate corrected for the group scale. Final bounds at 1.7 ≈ **9.3 × 6.2 × 8.3** (a knight on his destrier is 5.8 × 5.8 × 5.9, so the wain still reads as the heaviest thing on the field without dominating it). Health bar and name tag derive from `OXSCALE` via `OX_BAR_Y()` / `OX_TAG_Y()`, so changing the one constant never leaves the bar buried in the load again.
7. **THE MARKET MULE, rebuilt** — the trader's `cart` rig was a grey box donkey. Now a real mule on the same jointed anatomy (dun coat, mealy muzzle and belly, **long ears**, clipped mane), in a proper breast-collar harness with traces, hames and a team saddle-pad, pulling a merchant wagon: plank bed, side boards, corner stakes, a **canvas tilt on four bows**, a lantern, a team pennant, and cargo (amphorae, a spice sack, a gold-lidded chest) that shows only when loaded. Big rear wheels, small steering pair.
- **New animation branch — the DRAUGHT TROT.** Both carts flag `userData.trot` on their legs. A harnessed animal never gallops: diagonal pairs swing together (LF+RH, then RF+LH), knees fold on the recovery, the body rocks a little and the head nods into the collar. The four-beat gallop stays for the destrier only.
- Geometry gotcha worth remembering: half-cylinders and half-toruses need their orientation **baked into the geometry** (`geo.rotateZ(π/2); geo.rotateY(π/2)`), not set on `mesh.rotation` — fighting Euler order produced a wagon tilt facing sideways and a pale rope "pipe" arcing over the whole ox. `tools/cartshot.js` (dev-only, ships in tools/) renders any unit to a PNG from several angles — it caught all three of those bugs that assertions never would have.

### AI (07-ai.js)
8. **THE FLANKING LANES** — "a lot of the fighting happens along the King's Road; both AIs should flank." The road IS the straight line between the two thrones, and every band walked exactly that line. Each band now holds an **approach lane** — a z-corridor it runs down until it's within `LANE_TURNIN` (62) of the objective's x, then it turns in and commits.
   - `LANE_Z=[0,46,-46,88,-88]` — road · near flanks · deep perimeter. MAP.z half-extent is 125 and every creep pocket sits beyond 117, so 88 stays clear of them. `LANE_EDGE=MAP.z-10` clamps the steer.
   - `assignLane(D,bd)` deals the next lane round-robin with a ±9 jitter so bands don't stack; **BLUE and RED start on opposite hands**. Lanes **rotate every 45-80 s**, so a defender can't learn one axis and camp it.
   - Wired into `raidEnemyBase` (the main raid-wave driver), the siege train's approach, the econ band's between-jobs frontier prowl (the frontier is a LINE now, not the midpoint), and the assassin band's long approach to the enemy king. A bandless raider still draws a lane from the table by unit id.
9. **A POSTING IS NOT A CAREER** — "AI units huddled up around the nearest bazaar not doing anything." `bandHoldPoint` parks hold bands on a neutral bazaar when the team owns no castle, and nothing ever released them. A hold band now serves a **tour**: `HOLD_TOUR=45 s`, and once the ground has been quiet for `HOLD_QUIET=18 s` it's relieved and takes whatever mission the army is shortest on (econ / patrol / assassin), drawing a fresh lane on the way out. Contact inside `HOLD_WATCH=48` resets the clock, so a bazaar genuinely under threat is still held. **Only the enemy ARMY counts as contact** — neutral creeps are scenery, and letting a nearby wild camp reset the clock is exactly how a band ends up parked forever.

### Tests
- Smoketest: 16 new v113 asserts (mix trim + alarm leash, alarm holds through 30 s of shelling, aimed-shot cue, farm rate, both cart rigs' jointed trot legs / log stack / hidden cargo, lane sweep-then-turn-in, lane clamp, consecutive bands get different axes, bandless raider still lanes, hold-band relief on a cold field, hold-band NOT relieved under contact, tour dials sane). Harness exports gained `laneTarget/laneFor/assignLane/LANE_*/HOLD_*/bandHoldPoint/buildBodyFor/fireAimedShot/FARM_PASSIVE`; audio exports gained `_throttle/_capped`.
- Browser check: **PASSED** on http AND file:// (139 SFX decode, all 6 anthems, el.volume 0.134 = master×music×MUSTRIM).
- Known flakes unchanged (`v95 work pulse` every run; garden/turtle-wall/market-validator/militia occasionally).

## v112 WOLF QUIET + NEW ANTHEMS
- **Wolf grounds lose the dark-hiss drone** (John: "loud and kind of weird/not fitting" at wolves). `Sound.tick`'s zone check no longer uses `inCampGround` (static, kind-blind) — it walks `campStates` and arms `wildsdrone` only inside NON-wolf grounds (barbarian/viking keep the dread; wolf camps are carried by the v110 howls). Drone gain also trimmed 0.35→0.26 everywhere.
- **Bronze & Iron anthems REPLACED** with John's new takes (`potential sounds\music\Bronze Age Up2.mp3` / `Iron Age Up2.mp3`) → `audio/music/age1.ogg` (11.4 min) / `age2.ogg` (10.2 min), stereo q3, ~−12 LUFS (MUSTRIM absorbs it). Browser check confirms the new durations load (682 s / 610 s).
- **v111 postscript — the music mystery RESOLVED in the field**: John's `audio\music\` on disk held the raw Suno MP3s under their original names, NOT the age0-5.ogg set the game loads (the v111 missing-files warning caught it). The six OGGs are committed to his disk now. Rule of thumb for John: the game needs `audio\music\age0-5.ogg` next to index.html in WHATEVER copy runs; deploy by dragging the project folder, never a bare zip extract.

## v111 THE QUIET FIXES (field-test feedback: "music not working?", villager grunts)
1. **"Music does not seem to be working"** — root cause is DEPLOYMENT, not code: since v108 the game zip EXCLUDES `audio/music/` (the 30 MB delivery cap), so a fresh zip extract or a zip-dragged **Netlify deploy has NO anthem files** — silent music, no error anywhere. Compounding it: John's saved 10% music slider (tuned against the pre-v109 broken mix) → `0.5 master × 0.1 × 0.6 trim = 0.03` even where files exist. Fixes:
   - **Missing-track diagnostic**: the music `<audio>` element now has an `error` listener → `MU.dead=true` + a one-time feed warning "♪ MUSIC FILES NOT FOUND — this copy has no audio/music/ folder…". Verified in a real music-less Chromium build (error lands ~1 s after the arm; don't panic-debug the first 2 ticks).
   - **Proof-of-life**: when an anthem actually starts, the feed shows "♪ <Age> anthem (M adjusts music volume)".
   - **Autoplay-refusal retry**: a rejected `play()` re-arms up to 3 times on later ticks (`MU.tries`); a hard media error never retries (`MU.dead`).
   - **Prefs key v3→v4** (stale broken-mix sliders reset) + **music default 30%→40%**.
   - **DEPLOY RULE for John**: drag the PROJECT FOLDER (which has audio/music/) to Netlify Drop, not a fresh zip extract — or copy audio/music/ into whatever folder gets deployed.
2. **Villager gather grunts REMOVED** (John: they sound like the villagers are being harmed) — the 8% `veffort` on gather ticks is gone on host (09-main) AND guest theatre (10-net). Build-hammer (12%) and garrison-climb (60%) grunts stay.

## v110 THE WOLVES (139 sounds, +2)
John dropped two wolf recordings at `potential sounds\sfx\Wolf SFX\` (Wolf Howl.mp3 7.2s, Wolf Bite.mp3 2.1s). Both ran hot (−14.5/−16.5 LUFS, bite peaking 0 dB) and John asked for them REDUCED → **pre-attenuated −6 dB / −4 dB at conversion** (landing ≈ −21 LUFS, ~5 dB under combat foley) plus modest DEF gains (`wolfhowl` 0.55, `wolfbite` 0.7).
- **`wolfhowl`** — spatial, 6 s category throttle (one howl at a time), deliberately **NOT voice-capped** (atmosphere always lands). Wired in updateCreep for `st.kind==="wolf"` camps: on the hunt a howl every ~10-18 s, at rest a rare idle howl every ~25-60 s per wolf — distance-culled, so it reads as dread when you pass near a wolf camp. Host + `{t:"snd"}` bcast (guests hear it positionally).
- **`wolfbite`** — a wolf-camp creep's melee impact: dealDamage attacker-keying gained a branch (`att.bot.camp.kind==="wolf"` → bite instead of the generic hit). Capped + 300 ms throttle.
- **Human-voice hygiene**: wolf-camp creeps no longer scream like men — v109's pain/death vox now skip `bot.camp.kind==="wolf"` victims on the host; on GUESTS creep replicas carry no `bot`, so the guest death-vox now skips ALL NEUTRAL units (side effect: barbarian death cries are host-audible only — minor, noted). Human growls (vgrowl) now belong to barbarian/viking camps only.

## v109 part 1 — THE MIX FIX (why John's test sounded wrong)
John's field test (master 50 / SFX 50 / music 10): music drowned everything, cannons faint. Two measured causes, both fixed:
1. **v100-era bug: SFX applied bus×master gain TWICE** — once baked into the computed play gain AND once via the live bus/master gain nodes. Sliders were effectively SQUARED for one-shots (50%/50% → −24 dB instead of −12 dB). Loops double-applied the bus slider too. Music (an `<audio>` element outside the graph) applied its volume ONCE — hence "music too loud, cannon quiet." **Fix in 11-audio.js:** `decide`/`decideConcrete` now return BOTH `gain` (full chain — still drives the play/silent DECISION) and `local` (def gain × distance × opts.gain only); `play()` hands the node `dec.local`, `startLoop` hands `d[3]` — the sliders live exclusively on the graph nodes. SFX are now up to 12 dB louder at mid-slider settings; DEF gains unchanged.
2. **Suno masters are hot** (measured ≈ −13.5 LUFS vs −16…−20 for Empire foley) → `MUSTRIM` baked into the anthem volume law (**now 0.42, v113**).

## v109 part 2 — THE VOICES (137 sounds: 79 SFX + 58 human vocals)
From a 24-question interview (6 AskUserQuestion rounds) + the **Gamemaster Audio "Human Vocalizations"** pack John dropped at `potential sounds\sfx\Gamemaster Audio - Human Vocalizations - 24bit 48k\` (NOTE: the WAVs live under a DOUBLED folder of the same name; 1035 files, 7 voices). **Male A is a MODERN soldier voice** (English phrases, mask breathing) — only its wordless grunts are usable; never ship its spoken lines ("go go go" etc — John vetoed).

### Design (John's picks — all implemented)
- **Scope**: death cries + hit/pain reactions + attack shouts + charge war-cries, plus work efforts (garrison/build/gather), civilian voices (mixed male+female), kill-streak growl, creep growls & raid chorus, king's death scream, wounded breathing, block/parry strain. Player = FULL self-voice.
- **Voice identity**: deterministic per unit — soldiers `["b","c","d"][id%3]` (pack Male B/C/D), civilians (line civil/trade) `["a","e","f","g"][id%4]` (Male A grunts + Females A/B/C). Host & guests agree with zero wire bytes. Civilians never war-cry; civilian pain/death is one pool per voice.
- **Deaths**: ~70% of kills cry out (player death ALWAYS), 20% roll the intense variant; LAYERED on the v102 body-drop/gore mix. **King death → `vking` long scream in endGame** beside the regicide sting (2D, uncapped, all clients).
- **Pain**: ~1 in 3 non-lethal hits, graded by damage (<12 mild `vpainm`, <25 `vpain`, else hard `vpainh`) — host-side in dealDamage beside impacts; **guests hear their OWN hits** via an hp-drop hook in applySnap's player row (≥1 hp drop, same 1-in-3 + grading, 2D). Block AND parry add a `veffort` strain grunt.
- **Charges**: `voxChorus(x,z[,n])` — 2-3 distinct soldier voices staggered ~150 ms. Fired in `orderCharge` (covers player F via soundCharge AND AI marshal charges) host-local + `NET.bcast({t:"snd",k:"__chorus",x,z})`; the guest snd handler special-cases `__chorus` → local chorus. Positional, both teams hear charges coming. Viking raid landing adds a 3-voice chorus at the bay + relay.
- **Attack shouts**: ~1 in 4 MELEE-line swings (melee/anticav/royal/cavalry/scoutline gate) in triggerAttackAnim — runs on host AND guest theatre, so parity is free.
- **Efforts**: garrison climb 60%, construction hit 12% (v111: gather grunts removed) — local-flavor randomness, intentionally not synced.
- **Kill-streak growl**: 3 kills inside 8 s by a human → `vgrowl` (host player local; remote killers get a targeted per-guest `{t:"snd",k:"vgrowl"}`). Creeps growl every 6-10 s while hunting (host + bcast, positional).
- **Wounded breathing**: `vbreath` loop (2D, 0.45) starts under 25% HP in `Sound.tick`, stops on heal/death/menu.
- **Mix**: vocals 0.7-0.9 gains, medium density — every vocal category throttled (atk 250 / pain & death 200 / shout 300 / effort 350 / growl 900 ms, PER VOICE since the category is the key-minus-digits) and voice-capped; `vking` bypasses everything.

### Implementation map
- **11-audio.js**: vocal DEFS built by loop right after the literal DEFS (58 keys: `v{atk|painm|pain|painh|death|deathi|shout}_{voice}N`, `vking1`, `veffort1-4`, `vgrowl1-3`, `vbreath` loop); programmatic THROTTLE/CAPPED fill for `v*` cats; `voxVoice/voxKeyFor/vox/voxChorus` (+ exported `_voxVoice/_voxKeyFor`); vbreath in tick. GROUPS folding (strip trailing digits) gives per-voice variant pools — that's why voice ids are LETTERS.
- **05-combat.js**: pain in dealDamage; veffort on block/parry; death vox + kill-streak in killUnit; **v113 aimed-shot cue in fireAimedShot**. **04-units.js**: attack shouts in triggerAttackAnim; **v113 ox/mule rigs + the draught trot**. **09-main.js**: vking in endGame; **v113 gather-cue alternation + FARM_PASSIVE**. **06-input.js**: garrison efforts. **03-buildings.js**: build effort; **v113 base-alarm 60 s gate**. **07-ai.js**: chorus in orderCharge + raid; creep hunt growls; **v113 lanes + hold-band relief**. **10-net.js**: `__chorus` handler, guest death vox, guest self-pain on hp drop, guest theatre efforts (**v113 gather alternation**).
- Converted `-vn -ac 1 -ar 44100 -q:a 4`; **audio-data.js — 139 keys, ~3.9 MB** (regen walks audio/sfx only).

## v107/v108 recaps (still current)
- **v107 THE SCORE**: 6 per-age Suno anthems (`audio/music/age0-5.ogg`, streamed `<audio>`, ~43 MB, NEVER embed), play once per age landing (MYTEAM), ambience ducks to 0.33, anthem fades over the last 15 s of the age-up countdown, music slider live. **THE 90-SECOND ADVANCE**: T pays now, `AGE_RESEARCH_S=90` (stats CSV `age_research_s`), no cancel, HUD countdown bar, AI pays the same toll, `ares` rides snap+world, guests tick display-only. **PROTO 23.**
- **v108 THE AUDIT**: every SFX duration-fingerprinted to its pack source (CSV has ms precision; disambiguate collisions with xcorr — three pack files share 1.692 s). Fixed: spearhit was a horse-filled stables-select (→ Shield_Bash_Knight_2), regicide_lose & cannonhit were both the fiery-treasure-coins sound (→ Dark_1 horn / Cannon_Blast_Heavy_1), hit4 duplicated swinglight1 (→ Sword_Clang_2), 4 files had 27-hour corrupt duration headers (re-encoded). Pack truths: no spears, no predators, no crowd loops in the Empire pack; `Settlement_Select_*` files are ambience-laden building-select beds — never combat foley.

## Workflow / protocol
Browser 50v50 regicide war game, Three.js r128 no-bundler, PeerJS host-authoritative, **NET.PROTO=23**. John at `Desktop\REGICIDE PVP\REGICIDE PVP GAME`; stage sources to `/home/claude/regicide/`; ship a zip EVERY turn (excludes docs/.git/node_modules/"potential sounds"/**audio/music** when the 30 MB delivery cap bites — the v107 music zips remain valid and the device folder holds the tracks); SendUserFile → device_commit_files (**Windows Controlled Folder Access intermittently blocks overwrites of existing files** — when it does, John extracts the zip over the folder; index.html has been the stubborn one). Verify: node --check → npm i three@0.128.0 playwright-core → `node tools/smoketest.js` 2-3× (green = only known flakes) → `node tools/browsercheck.js` after ANY audio change (http + file://) → `node tools/cartshot.js` after ANY model change and `node tools/perfcheck.js` + `node tools/treemap.js` after ANY world-gen change (perfcheck renders PNGs and prints draw calls; treemap dumps the layout for a top-down plot — LOOK at both) → `node tools/mobilecheck.js` after ANY change to 12-touch.js → rm node_modules → zip → verstamp/handoff (project doc + docs/). Known flakes: `v95 work pulse` (every run), plus intermittent garden / turtle curtain wall / sixth market / militia stand-down.
- Next version: **v123**.

## Open threads / watch list
- **v113 FIELD TEST — the seven fixes**: is music finally sitting under the SFX at 0.42? Is one alarm a minute the right cadence (or should a NEW building being struck re-arm it early)? Gather foley at half density? Farms at 2 food/3 s?
- **v113 FIELD TEST — the carts**: `OXSCALE` landed at **1.7** (≈9.3 × 6.2 × 8.3). Still the biggest civilian silhouette on the field; if it wants another nudge it's one constant at the top of 04-units.js and everything — bar height, tag height, wheel roll rate — follows it. Does the mule cart now read as "similar to the horses"?
- **v113 FIELD TEST — the AI**: do attacks visibly arrive from the north/south fields and the perimeter now, or does the turn-in radius (62) pull everyone back onto the road too early? Do bands still pile on bazaars? Are the deep ±88 lanes bumping into creep-camp mouths in practice?
- **MOBILE — what is still not done**: the game's own menus (build, class, quest board, blacksmith) are still desktop-sized DOM panels; the grid *opens* them but they were never laid out for a phone. That's the remaining responsive pass. Also still true: 54 units cost ~1,800 draw calls against ~380 for the whole forest, so units are the optimisation target if mobile is pushed further.
- **NEXT UP — the combat-feel half of the look pass.** The world half landed in v114 (the wood). Still unimplemented: (A) **combat impact** — camera shake on heavy hits/cannon, hit-stop on kills, blood/spark burst directionality, floating damage numbers, weapon trails; (B) **the world** — time-of-day tint + longer shadows, ground decals (blood, craters, scorch), corpses that persist as a battlefield, banners/dust from marching columns; (C) **readability** — outline/rim-light on units, clearer team tint at distance, a proper hit-direction indicator; (D) **death & ragdoll** — the `dieT=0.9` fall is the only death animation; directional knockdown would sell every kill.
- **WOLF FIELD TEST**: are −6/−4 dB cuts enough? Does the idle-howl cadence (25-60 s per wolf) read as atmosphere or annoyance? Only 2 wolf sources — a second howl/growl variant would help if repetition shows.
- **VOICES FIELD TEST**: density (1-in-3 pain / 1-in-4 shouts / 70% deaths), per-voice throttles, chorus timing, whether Male D's "attack groan" reads as attack, breathing loop level.
- **Pack depth unused**: 1035 vocal files shipped 58 — screams, chokes, cries, laughs, female intense sets, breath sets all uncurated.
- Remaining gaps: town crowd walla, pond water zones, guest deposit chime, ui_back, menu-close, start-menu clicks, menu music (Suno).
- Older: netcode stack field test, hall registry election, quest balance, v94 AI playtest, host-can't-play-RED.

## Transcripts
Carry-forward: project doc `claude/REGICIDE-HANDOFF-v122.md`, device `docs/REGICIDE-HANDOFF-v122.md`. Delete older handoffs from the project.
