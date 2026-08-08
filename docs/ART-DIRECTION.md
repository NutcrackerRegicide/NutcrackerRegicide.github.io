# REGICIDE — ART DIRECTION

**Version:** 1.0 · authored against baseline `v129.4` · renders in `_baseline_v129.4/`
**Status:** This document is the contract. Renders are scored against it. A render that violates a
numbered rule fails, and the rule number is the reason.

---

## 0. THE LOOK, IN ONE PARAGRAPH

REGICIDE is a bright, warm, hand-painted medieval battlefield seen over the shoulder of a wooden
toy soldier. It borrows Age of Empires' discipline — quantised footprints, exaggerated silhouettes,
buildings that announce their age from across the map, team colour as trim rather than paint — and
Valheim's discipline about light — one warm sun, one cool sky bounce, and fog that is a *colour*
rather than a haze, tuned so distant land dissolves into the horizon instead of being clipped off
it. Everything is low-poly, flat-coloured and cel-banded on one shared ramp, so the entire world
reads as a single drawing. The rule that governs every other rule is **value hierarchy**: the
ground is a mid-value stage, the trees are dark masses, the sky is bright, and the units — black
shakos, white beards, saturated team coats, black boots — are the darkest, most saturated, most
contrasty objects in the frame. You should be able to greyscale any screenshot, and the army should
still be the first thing you see.

---

## 1. HONEST VERDICT ON THE BASELINE — what is wrong today

I looked at all six renders in `_baseline_v129.4/`. This is not a stylistic quibble list; these are
structural failures, in order of severity.

**1.1 — THE ENTIRE FRAME IS ONE VALUE.** This is the single biggest problem and everything else is
downstream of it. In `02-town.png` the grass, the trees, the mountains, the town centre canvas and
the units all sit between roughly 45% and 80% screen value. There is no dark anywhere except tree
trunks. Both AoE and Valheim work because dark shapes stamp against light ones; this frame has no
stamp. Squint at `02-town.png` and the fifty units dissolve into the lawn.

**1.2 — THE GROUND IS THE LOUDEST OBJECT IN THE GAME.** A nuclear kelly green at roughly S 0.6 /
L 0.49, covering 50–65% of every frame, at higher saturation than any unit on it. The AoE rule is
terrain saturation 0.30–0.45 and units 0.55–0.75; we are exactly inverted. On top of it sits a
96px `NearestFilter` texture tiled 46×30 across a 534×450 plane — about 0.12 world units per
texel, far under one screen pixel — which is the television static visible across the ground in
every shot, and 195 pale-green decal discs that read as spilled paint.

**1.3 — THE UNITS DO NOT READ AS NUTCRACKERS. THEY READ AS NAKED TODDLERS.** `04-crowd.png` is
damning. Pink egg heads wider than their own torsos, bare pink arms, white briefs, brown boot-dots.
No hat. No coat. No boots. No gold. No black. The greyscale ladder of a current unit is
approximately `0.35 → 0.72 → 0.90 → 0.72 → 0.88 → 0.72 → 0.35` — i.e. one skin tone with two
white spots. The entire nutcracker identity lives in a 64×64 face texture that is invisible past
about 10 world units, and in a mouth-and-beard assembly the torso itself occludes.

**1.4 — NOTHING IS GROUNDED.** One shadow receiver existed in a 3,594-mesh scene until very
recently, and receiving is still not universal. Units, trees and foliage sit *on top of* the picture
rather than *in* it. There is no contact darkening, no ambient occlusion, no dark seam where
anything meets anything.

**1.5 — THE FOREST HAS NO LIGHT ON IT.** `03-forest.png`: ~1,000 trees on `MeshLambertMaterial`,
so the map's dominant object class is the one class not on the toon ramp. The canopies are a single
flat mid-green with no tier separation, no lit/shade split, no darkening toward the base. They are
green stamps, not trees.

**1.6 — THE HORIZON IS A MILK WALL.** `06-wide.png`: a hard pale band eats the distance, the fully
saturated green in front of it does not fade *into* it, and the clouds are grey-green floating
rocks (Lambert, fogged, lit from below by a green hemisphere ground colour). Meanwhile the mountain
ranges the world was built around are almost entirely culled or 100% fogged, so there is no horizon
silhouette at all. Fog far is 182 while the deco cull line is 150 (desktop) and 88 (phone) —
distant trees pop out at 41% opacity on desktop and at *full saturation* on a phone.

**1.7 — THE ROAD IS NOT A ROAD.** 52 discs of radius 2.1–2.9 laid 6.73 units apart cannot touch.
`05-lowsun.png` shows a chain of separate brown puddles.

**1.8 — THE COLOUR PIPELINE IS BROKEN AND THE PALETTE WAS HAND-TUNED AGAINST THE BREAKAGE.**
`renderer.outputEncoding = sRGBEncoding` never executes, because the EffectComposer's render
targets are `LinearEncoding` and r128 takes output encoding from the bound target. Every
sRGB-tagged texture is decoded on sample and never re-encoded; every flat-colour material
round-trips unchanged. Textured surfaces therefore render roughly `c^2.2` darker and more saturated
than untextured ones sitting right next to them. **No hex value in this document means anything
until this is fixed**, which is why fixing it is work item 1 and everything else is judged after it.

**1.9 — ~23,000 PIECES OF FOLIAGE RENDER WHITE.** All three `InstancedMesh` sites call
`setColorAt` against materials with `vertexColors:false`, and r128's `color_fragment` only reads
`vColor` under `USE_COLOR`, which comes only from `material.vertexColors`. Every per-instance tint
is written and discarded. The greens were then repeatedly darkened by hand to fight a brightness
that was never coming from the hex codes.

**1.10 — THE MOUNTAINS ARE BROWN TRIANGLES WITH BLOWN-OUT ICING.** `03-forest.png`. Snow at
`#e8ecf0` lands on the ramp's top cell *and* clears the bloom threshold of 0.92, so every cap
glows. The "haze" range is still cold blue-grey against a warm frame.

---

## 2. THE PALETTE

**This is the most load-bearing section of the document.** Every value here is an *authored sRGB
value that must appear on screen as specified*, which is only true once work item `color-pipeline`
lands (§9.1). A critic may eyedropper a render and compare against these swatches with a tolerance
of **±8 per channel** on large flat areas under full sun.

Where a role has a `lit` / `base` / `shadow` triplet, `base` is the material albedo you author;
`lit` and `shadow` are what the ramp produces at the top and bottom bands and are given so they can
be checked in a render.

### 2.1 Sky and atmosphere

| Role | Hex | Notes |
|---|---|---|
| `sky.zenith` | `#2E6FB8` | Top of the dome. Deeper and less cyan than baseline `#3d94e8`. |
| `sky.mid` | `#6FA6DC` | Blend stop at `y = 0.35` of the dome. |
| `sky.horizon` | `#BFD6E6` | **Must equal `fog.color` exactly.** |
| `fog.color` | `#BFD6E6` | Identical to `sky.horizon`. Non-negotiable — see §4.3. |
| `cloud.lit` | `#FFFFFF` | Flat, unfogged, unlit. |
| `cloud.shade` | `#CFE0EE` | Underside band only. |
| `sun.disc` | `#FFE9A8` | Sprite. Must sit on the actual light vector — see §3.5. |

### 2.2 Terrain

| Role | Hex | Screen value | Notes |
|---|---|---|---|
| `grass.lit` | `#86A63F` | 0.39 | Top ramp band on flat ground under sun. |
| `grass.base` | `#6B8C33` | 0.31 | Authored albedo. |
| `grass.shadow` | `#47601F` | 0.22 | Bottom ramp band / cast shadow. |
| `grass.dry` | `#9A9E4A` | 0.39 | Sparse hue-break patches only, ≤ 12% of ground area. |
| `dirt.base` | `#7A6242` | 0.36 | Slope exposure, camp floors. |
| `dirt.shadow` | `#574433` | 0.28 | |
| `road.base` | `#8A7150` | 0.40 | King's Road. |
| `road.dark` | `#74603F` | 0.34 | Alternating segment. |
| `sand.base` | `#CFB98C` | 0.72 | Beaches, pond rims. |

**Hard constraint:** terrain HSL saturation must stay in **0.30–0.45** and lightness in
**0.30–0.45**. Baseline is roughly S 0.60 / L 0.49 and fails both.

### 2.3 Foliage

| Role | Hex | Screen value |
|---|---|---|
| `conifer.lit` | `#4A7038` | 0.33 |
| `conifer.base` | `#38562A` | 0.26 |
| `conifer.deep` | `#263C1E` | 0.18 |
| `broadleaf.lit` | `#5C8A38` | 0.36 |
| `broadleaf.base` | `#47702C` | 0.29 |
| `bark.base` | `#5A422C` | 0.27 |
| `bark.shadow` | `#3E2D1E` | 0.19 |
| `undergrowth.a` | `#5E8232` | 0.33 |
| `undergrowth.b` | `#4C6E2A` | 0.28 |
| `undergrowth.c` | `#6F9038` | 0.36 |
| `moss` | `#5E7040` | 0.36 |
| `blossom.warm` | `#E8B54A` | 0.66 |
| `blossom.cool` | `#D66E8C` | 0.65 |

**Hard constraint (the silhouette rule):** foliage albedo luminance must sit at **18–36% screen
value** while `fog.color` sits at **80%**. That ~45-point gap is what makes dark trees stamp against
bright haze; it is the whole depth effect, and it is what `03-forest.png` does not have.

### 2.4 Structural materials

| Role | Hex | Notes |
|---|---|---|
| `stone.lit` | `#9A968A` | |
| `stone.base` | `#827E72` | |
| `stone.shadow` | `#5C594F` | |
| `wood.plank` | `#8A6B45` | |
| `wood.shadow` | `#5F4830` | |
| `thatch.base` | `#B99A55` | Age 0–2 roofs. |
| `thatch.shadow` | `#8A7038` | |
| `roof.terracotta` | `#B4543A` | Age 3–4 roofs. Value delta vs `plaster.wall` = 0.29 ✓ |
| `roof.terracotta.dark` | `#7E3624` | |
| `plaster.wall` | `#E0D2B4` | |
| `plaster.shadow` | `#B0A288` | |
| `marble` | `#EDE7DA` | Age 3 only. |
| `roof.copper` | `#4E9E88` | Age 5 only. |
| `roof.slate` | `#5A6068` | Age 5 alternate. |
| `gold.ornament` | `#CFB53B` | |
| `gold.highlight` | `#EBD46A` | |

**Hard constraint:** every roof must differ from its own wall by **≥ 0.25 screen value**. The roof
is the darker of the pair below age 5.

### 2.5 Team colours

Canonical AoE order, four variants each. `TEAMCOL` in `js/00-data.js:11` is currently
`[0x3d6ef2, 0xd94a3d, 0x8a8f7a]`; move it to these.

| Player | Base | Dark (dead / shadow) | Outline (occlusion pass) | Minimap |
|---|---|---|---|---|
| P1 Blue | `#2E5FD8` | `#1B3A82` | `#4E85FF` | `#2E5FD8` |
| P2 Red | `#D62B2B` | `#7F1A1A` | `#FF5C5C` | `#D62B2B` |
| P3 Neutral/Grey | `#9AA0A8` | `#5C6066` | `#C3C8CE` | `#9AA0A8` |

**Team-colour budget:** units **20–30%** of visible surface (coat body, shako plume, shield face).
Buildings **8–15%** (roof eave fascia band + one banner). Never exceed 35% on a unit or 18% on a
building. Team colour is never applied by replacing albedo — see §6.4.

**Team colour must not be inverted.** A blue-team unit currently wears dark red trousers
(`js/04-units.js:809-814`). A blue unit wears blue.

### 2.6 The nutcracker palette — FIXED, NOT NEGOTIABLE

These six pairs are the identity of the game's characters. Only the coat changes per team.

| Role | Base | Shadow | Notes |
|---|---|---|---|
| `nc.black` (hat, boots, belt) | `#252525` | `#131315` | **Never `#000000`.** |
| `nc.coat` (team) | `#2E5FD8` / `#D62B2B` | `#1B3A82` / `#7F1A1A` | The one team-driven band. |
| `nc.gold` (epaulettes, band, buttons) | `#CFB53B` | `#8C6D2B` | Highlight `#EBD46A`. |
| `nc.trouser` | `#EDE7D3` | `#BDB49A` | |
| ~~`nc.beard`~~ | ~~`#F7F3E8`~~ | ~~`#CFC7B6`~~ | **SUPERSEDED by §2.6a — the beard is no longer white.** |
| `nc.face` | `#EFC49A` | `#C2916A` | Cheek dot `#D9584E`, only above 80px. |
| `nc.teeth` | `#FFFFFF` | — | **The only pure white permitted anywhere in the game.** |
| `nc.mouth` | `#1A1210` | — | |
| `nc.eye` | `#14100E` | — | |

### 2.6a ⚠ AMENDMENT v1.2 — THE BEARD IS CARVED WOOD, NOT WHITE, AND IT VARIES PER UNIT

**Owner direction, with reference art at `docs/ref/nutcracker-reference.png`.** Every beard in that
image is *warm carved wood*: chestnut, auburn, dark walnut, and one golden blonde on the Norse
figure. Not one is white. They are voluminous, sculpted into curled locks, and they hang well below
the chin onto the chest — mass, not a bib.

**This amendment also fixes a shipped defect, which is why it supersedes rather than competes.**
`nc.beard #F7F3E8` is luma **0.949**. `UnrealBloomPass` has its high pass at **0.86**, so the beard
self-composites and pegs at `(255,255,247)` — ~6,900 flat pixels per figure, red and green both
clipped, every fold gone. It was 100% of the clipping in the game and it is why the beard read as a
folded paper bib. A warm brown beard sits nowhere near that threshold, so the art direction and the
bug have the same answer.

**BEARD_TONES — variable per unit, exactly like `SKIN_TONES`.**

| | hex | note |
|---|---|---|
| chestnut | `#6B4A2E` | the default read |
| auburn | `#7A4526` | the reference's centre king |
| dark walnut | `#4A3524` | reads almost black at 40px — good, it deepens the ladder |
| golden | `#8A6A34` | the Norse blonde; the lightest permitted |
| iron grey | `#6E665C` | elders, and the King at his oldest ages |

- **Ceiling: no beard tone may exceed luma 0.62**, verified through **`composer.render()`**, never
  `renderer.render()`.
- **Selection must be `u.id`-derived, exactly as `SKIN_TONES` is** (`js/04-units.js`,
  `SKIN_TONES[u.id % SKIN_TONES.length]`). **Never `Math.random()`** — host and guests must render
  the same soldier identically, and unlike a wrong colour a desynced one cannot be seen in a
  screenshot.
- Pair the moustache one step darker than the beard, as a separate bar.

**THE VALUE LADDER STILL HAS TO WORK.** §6.2 wanted the beard as the bright second band. It is not
bright any more, so that band moves to the **face and frontal head plate** (`nc.face`, luma ~0.78)
with the beard reading as a mid-dark mass below it. Re-derive the five-band ladder against that and
require all four adjacent deltas ≥ 0.25. A dark beard under a light face is a *stronger* barcode
than white-on-light was: it puts a second dark near the top, so hat and beard bracket the face.

### 2.7 Ink / outline

| Role | Hex | Notes |
|---|---|---|
| `ink` | `#1E1A16` | Warm near-black. **Not** pure black, not the current `#14180f` green-black. |

Ink opacity 0.85. Ink must fog with the scene (§4.4).

---

## 3. THE LIGHT RIG

Three lights. No more, ever. Any fourth light in the scene graph is a spec violation.

### 3.1 Directional (the sun)

```
color      #FFF1D2
intensity  1.55            (up from 1.15 — see §3.3)
elevation  50°  above horizon
azimuth    135° (upper-left, behind and left of the default camera yaw)
position   sun.position.set(px + 120, 168, pz + 80)   // preserve this vector's direction
castShadow true
```

Elevation 50° is the sweet spot: high enough that roofs and shoulders catch light, low enough that
eaves and shakos throw a readable shadow band. Do not raise it toward noon; do not drop it toward a
sunset rake.

### 3.2 Hemisphere (the sky bounce)

```
skyColor     #A8CCEA
groundColor  #4A6330        (= grass.base darkened 40%, per Valheim's ambient convention)
intensity    0.45           (down from 0.75 — see §3.3)
```

### 3.3 The ratio, and why it changes

In r128 only the **directional** light passes through `getGradientIrradiance`. `HemisphereLight`
lands in `indirectDiffuse` as a smooth, completely unquantised wrap-lambert term. At today's
`hemi 0.75 / sun 1.15`, roughly **33–44% of all light on a lit up-facing surface bypasses the toon
ramp entirely**, which is precisely why the world reads mushy despite having a ramp at all.

Moving to `hemi 0.45 / sun 1.55` holds total energy roughly constant and nearly doubles the ramp's
authority over the image. **This intentionally overrides the "light values are fixed, exposure is
the dial" note at `js/01-engine.js:37-42`.** That note was written when the ramp was the only
suspect; the hemisphere was the actual culprit. The cool-shadow read that the note protects is
preserved by cooling the ramp's bottom band, not by putting the hemisphere back.

### 3.4 Ambient

```
new THREE.AmbientLight(0xFFE8CC, 0.05)      // unchanged — a whisper, keeps pure-shadow faces alive
```

Do not raise it. Ambient is constant and lifts every pixel equally, which is the fastest way to
destroy band edges.

### 3.5 The painted sun must agree with the lighting sun

Today the sprite is nailed to world `(150, 210, 100)` while the light re-parks to
`(player.x+120, 168, player.z+80)` every frame. Walk 400 units and the visible sun swings across
the sky while every shadow in the world points the same direction it always did. **The sprite's
position must be derived from the normalised sun vector each frame**, at dome radius.

### 3.6 Tone mapping and exposure

```
renderer.toneMapping         = THREE.LinearToneMapping    // KEEP. Never ACES. See §10.3.
renderer.toneMappingExposure = 0.62                        // starting point, tune down from 0.78
renderer.outputEncoding      = THREE.sRGBEncoding
composer.renderTarget1.texture.encoding = THREE.sRGBEncoding   // THE FIX
composer.renderTarget2.texture.encoding = THREE.sRGBEncoding   // THE FIX
```

Exposure must drop from 0.78 because the encoding fix brightens every textured surface. **Checkable
rule: across all six `tools/vista.js` shots, no more than 2% of pixels may be clipped to 255 in any
channel, and no more than 0.5% clipped in all three.** Snow caps, plaster walls and the town centre
canvas are the surfaces that will fail this first.

Do **not** also add `GammaCorrectionShader`. That is the other, mutually exclusive fix; doing both
double-gammas the frame.

### 3.7 The toon ramp

r128 samples the gradient map at `u = dotNL * 0.5 + 0.5`, with no colour-space decode. With today's
4 texels and `NearestFilter`, the **entire lit hemisphere collapses onto two cells** (`0xd2` and
`0xff`) — the sun's whole contribution swings only 21%, and the darkest cell requires a surface
more than 120° off the sun. The scene is effectively 2-step, not 4-step. That is the mechanical
reason the world looks flat.

**Spec: 64-texel ramp, four bands, breaks placed where light actually lives.**

| Band | `dotNL` range | Ramp byte (linear) | Resulting screen value |
|---|---|---|---|
| deep shadow | `< -0.15` | `38` | 0.42 |
| shadow | `-0.15 … 0.18` | `75` | 0.58 |
| mid | `0.18 … 0.52` | `146` | 0.78 |
| lit | `> 0.52` | `255` | 1.00 |

Boundary index for a threshold `t` at N=64 is `i = round((t + 1) * 32)` → breaks at index **27, 38,
49**.

Ramp bytes are authored in **linear** space (`byte = 255 · srgb_to_linear(target_screen_value)`)
because the ramp is a multiplier on irradiance and the sRGB encode happens downstream. Using
evenly-spaced bytes (`64/128/191/255`) merges the top two bands after encoding — that is exactly
the failure to avoid.

Mandatory: `minFilter = magFilter = NearestFilter`, `generateMipmaps = false`, **no `encoding`
assignment of any kind**, width a power of two.

### 3.8 Shadows

```
renderer.shadowMap.type       = THREE.BasicShadowMap     // 1 tap, was PCF's 17
sun.shadow.mapSize            = 2048 × 2048              // was 1024
sun.shadow.camera.left/right  = ±52                      // was ±70; tighter now that we can afford it
sun.shadow.camera.top/bottom  = ±52
sun.shadow.camera.near        = 110                      // was r128's default 0.5
sun.shadow.camera.far         = 340
sun.shadow.bias               = -0.0004                  // already correct, do not sweep again blind
sun.shadow.normalBias         = 0.10                     // already correct
renderer.shadowMap.autoUpdate = false                    // refreshed every other frame — KEEP
```

Hard-edged shadows are *on-style* for cel shading; PCF's soft edge actively fights the ramp's hard
terminator. `world-units-per-texel = 104/2048 = 0.051` — inside budget.

The shadow ortho box must be centred on **the view**, not the player: `focus = player + forward*25`,
damped (lerped, never snapped) because the box only refreshes on even frames. Snap the box centre
to texel multiples or it shimmers as the camera pans:

```
texel = (2*R) / mapSize.x;  cx = round(focus.x/texel)*texel;  cz = round(focus.z/texel)*texel;
```

**Everything that stands on the ground receives shadow.** Trees, units, foliage layers, buildings,
draped decals. Nothing being a receiver is why toggling the sun barely changes the frame today.

---

## 4. ATMOSPHERE

### 4.1 Fog type

`THREE.Fog` (linear) — **not** `FogExp2`. Two reasons, both binding: r128's linear fog is actually
a `smoothstep(near, far)`, which gives a clean "edge of the world" band while leaving the entire
near field untouched, which is what an RTS wants; and the ink shader reimplements linear fog with
its own `smoothstep` (`js/01-engine.js:170`), so switching to exponential breaks every outline in
the game.

### 4.2 Fog distances — the rule that fixes both platforms at once

> **`fog.far` must always equal `HIDE_D`, and `fog.near` must equal `HIDE_D × 0.5`.**

Today `fog.far = 182` while `HIDE_D` is 150 on desktop and **88** under the battery saver. At the
desktop cull line the fog factor is only 0.59, so distant trees pop out at 41% opacity; on a phone
it is 0.01, i.e. trees pop in **fully saturated**. Binding the two means `setHideD()` moves the fog
with it and the cull line is invisible on every device, forever.

| Platform | `HIDE_D` | `fog.near` | `fog.far` |
|---|---|---|---|
| Desktop | 150 | 75 | 150 |
| Saver off (mobile) | 105 | 52 | 105 |
| Saver on (mobile) | 88 | 44 | 88 |

`setHideD()` must also write the ink material's `fogNear` / `fogFar` uniforms in the same call, or
outlined meshes fog differently from their own bodies and the mid-field turns into a wire drawing.

### 4.3 Fog colour and the sky must be the same colour

> **`scene.fog.color === sky.horizon === #BFD6E6`, byte for byte.**

This is the composition rule that everything else leans on. If the sky's bottom band and the fog
colour diverge by even a few percent, distant geometry becomes a visible cut-out and the whole
illusion collapses. The sky dome is a raw `ShaderMaterial` that deliberately omits
`<tonemapping_fragment>` and `<encodings_fragment>`, so it writes literal sRGB and matches
`scene.fog.color` exactly. Keep it that way — do **not** "fix" the sky to be tone-mapped; that
would darken the largest region of every frame and break the horizon match.

Sky gradient: `#BFD6E6` at the horizon → `#6FA6DC` at `y=0.35` → `#2E6FB8` at zenith.

### 4.4 Depth banding — stage geometry INTO the fog curve

Valheim's depth comes from where things are placed, not from the fog maths. Every wide shot must
contain three distinct fog-depth bands:

| Band | Distance | Fog factor | Content |
|---|---|---|---|
| Near | 0–40 | ~0 | Subject: units, the building you're at, foreground foliage. Fully saturated. |
| Mid | 60–120 | 0.2–0.6 | Forest mass, other buildings. Desaturating, silhouettes still readable. |
| Horizon | 150+ | > 0.9 | Mountain ridge, reading as a flat silhouette. |

The horizon band **does not exist today** — the mountain rings at 228/250 are either culled by
`worldDeco` or 100% fogged. They must be merged into 2–3 vertex-coloured meshes, exempted from LOD
culling, and given a reduced fog factor (target: 0.82 fogged, so they read as a pale ridge rather
than vanishing). Cost: 3 draw calls for an entire vista.

### 4.5 Clouds

Flat `MeshBasicMaterial`, `fog: false`, `#FFFFFF` top / `#CFE0EE` underside. The cloud field
follows the camera in x/z the way the sky dome does, so the sky is never empty at the map edges.
Merged per group: 8 draw calls, not 32.

### 4.6 Post stack

| Pass | Setting | Notes |
|---|---|---|
| `RenderPass` | — | |
| `UnrealBloomPass` | `Vector2(w*0.5, h*0.5)`, strength **0.30**, radius **0.45**, threshold **0.86** | Half-res. Threshold retuned for the sRGB-encoded RT — at linear encoding 0.92 was keying off snow caps. |
| `grade` (ShaderPass) | saturation **1.12**, warm `×(1.02, 1.00, 0.97)`, vignette `smoothstep(0.62, 0.99) × 0.28` | Saturation drops from 1.30: it was doing sRGB-space work against a linear buffer. **Delete the targeted green lift** `×(0.94, 1.10, 0.90)` — it exists only to compensate for §1.2 and will over-cook the corrected palette. |

Total post cost measured at **+14 draw calls**, independent of scene complexity. This is the one
place where visual quality does not scale with scene content, so buy mood here before buying it in
geometry.

**God rays / sun shafts** are the single highest-value atmospheric effect and are also the most
expensive (60 samples/pixel). They are **deferred behind `?gfx=high`, desktop only, off by
default**. Not required for a passing render.

---

## 5. SILHOUETTE RULES

### 5.1 The pixel sizes we are actually designing for

Phone drawing buffer is **590 × 273** at pixel ratio 0.7 (`js/12-touch.js:142,158,163`). Camera is
`fov 58`, third-person `camDist 18`.

| Object | Distance | Phone px tall | Desktop px tall (1400×760) |
|---|---|---|---|
| Player unit | 18 | **53** | 149 |
| Ally unit in the fight | 40 | **24** | 67 |
| House | 40 | **46** | 127 |
| Town centre | 60 | **61** | 169 |

**So: every unit in the game is between 24 and 53 pixels tall on a phone.** Design at 40px. Anything
that does not survive at 40px is decoration, and decoration is not allowed to cost draw calls.

### 5.2 The 40px test — the binding readability check

Render the object as pure black fill on white at 40px tall.

1. **Silhouette test.** Two objects of different type must be distinguishable as black shapes. Two
   houses may be identical; a house and a barracks may not.
2. **Greyscale test.** Convert the object to greyscale at 40px. The value ladder of §5.4 / §6.2
   must survive.
3. **Feature floor.** Any band, stripe or trim must be at least **0.075 of the object's height**
   (≈ 3px at 40px) or it aliases into mud. Budget a **maximum of three horizontal bands** on a unit.

### 5.3 Unit proportions

Let `H` = total height, sole to hat crown, plume excluded. **`H = 3.90` for a foot unit.** All
values are fractions of `H`.

| Segment | Fraction | World units |
|---|---|---|
| Hat (shako) | 0.24 | 0.94 |
| Head | 0.20 | 0.78 |
| Torso | 0.28 | 1.09 |
| Legs | 0.16 | 0.62 |
| Boots | 0.12 | 0.47 |
| **Total** | **1.00** | **3.90** |

Beard hangs 0.10 H (0.39) below the chin and overlaps the torso; it is not part of the stack.

**Bounding box `H : W : D = 1 : 0.35 : 0.29`.** Width over 0.40 H means it has stopped reading as a
nutcracker.

**THE KEY STATISTIC: hat + head = 0.44 H. Forty-four percent of the figure is above the shoulders.**
Today it is under 0.30 with no hat at all. This single number is why the units don't read.

Widths:

| Part | Fraction of H | World units | Today |
|---|---|---|---|
| Shoulders incl. epaulettes | 0.30 | 1.17 | ~1.04 |
| Torso | 0.22–0.28 | 0.86–1.09 | 1.04 |
| Head | 0.17–0.20 | 0.66–0.78 | **1.16** |
| Legs (Ø) | 0.065 | 0.25 | |
| Boots | 0.09 | 0.35 | |

> **HARD RULE 5.3a: `torsoWidth / headWidth ≥ 1.25`.** Today it is **0.90** — the head is wider
> than the torso, which is why every unit reads as a bobblehead at any building scale. A nutcracker
> is a barrel with a head on it, not a head with a barrel under it.

> **HARD RULE 5.3b: `shoulderWidth ≥ 1.6 × headWidth`**, or the anvil silhouette collapses.

> **HARD RULE 5.3c: arms hang at exactly 0° abduction**, dead vertical, gap to torso 0.005 H. Rigid
> column posture is non-negotiable. Any arm swing away from vertical destroys the nutcracker read
> faster than any colour change. The existing `WOODEN` stop-motion quantisation
> (`js/04-units.js:1707`) is correct and must be kept.

Legs are currently **30% of the figure** with tapered organic limbs and visible knee spheres. Spec
is **16% legs + 12% boots**, straight, with boots wider than the shins so the base reads as a dark
plinth.

### 5.4 HUD headroom — a hard blocker

A foot unit is 3.90 tall; the health bar sits at `y = 4.3` and the name tag at `y = 5.1`. **A shako
puts the crown at ~4.7 and punches through both.** Both constants move with the silhouette:
health bar → **5.3**, name tag → **6.2**. The `OX_BAR_Y` / `OX_TAG_Y` pattern at
`js/04-units.js:37-38` is the established mechanism for exactly this.

### 5.5 Building proportions

| Rule | Spec |
|---|---|
| Footprint | Integer tiles only. House 2×2, Barracks/Farm/Stable 3×3, Town Centre 4×4, Castle 4×4, Wonder 5×5, Tower 1×1, Wall 1×1. (Buildings are 2× world scale — apply against the pre-`BSCALE` footprint.) |
| Building shrink | Mesh occupies **85%** of footprint extent, leaving a 0.15-tile gutter on every side, so a packed town reads as discrete blocks. |
| Roof dominance | Roof is **45–60% of total building height**. The roof is the silhouette carrier, not the wall. |
| Roof pitch | **35–45°**. Below 30° it stops reading as a roof from this camera; above 50° it reads as a spire. |
| Eaves overhang | Roof extends past the wall plane by **14% of footprint width** (18% from age 3). This is the single highest-value readability trick — it casts a hard shadow band that separates roof from wall at 46px. |
| Roof/wall contrast | ≥ **0.25** screen value (§2.4). |
| Top profile | Each building type owns a unique top profile from: gable, hip, dome, conical, stepped, flat-with-parapet, columned-portico, tower. Two types may not share one. |

### 5.6 Unit-to-building scale

Deliberately non-realistic, per AoE. Current ratios are broadly right and should be preserved:

| Building | Height | Unit heights |
|---|---|---|
| House | 7.4 | 1.9 |
| Barracks | 11.7 | 3.0 |
| Town centre | 14.8 | 3.8 |
| Castle / Tower | 22.5 | 5.8 |

A unit at 53% of house height is roughly 2× its realistic relative scale. That is correct and
intended. **Do not "fix" it.**

### 5.7 Age progression must change SILHOUETTE, not texture

Exactly three visual changes per building, per the AoE rule:

- **Age 0–1:** all civs share one generic form. Thatch, bare timber, team colour = one small flag.
- **Age 2:** civ architecture appears. Roof becomes tiled/shingled; team-colour eave band added.
- **Age 3–4:** stone base course 0.3 units tall; eave overhang 14% → 18%; banner poles.
- **Age 5:** only Town Centre, Market and Temple upgrade — roof finial/dome plus gold ornament.

A tier change that is texture-only is invisible at 46px and does not count. **Blacksmith,
watch tower, tower, castle (ages 0–4) and walls currently ignore age entirely** and must be
brought onto this ladder.

---

## 6. THE NUTCRACKER SPEC

### 6.1 Priority order — build in this order, stop when the budget runs out

1. **TALL DARK HAT.** The single largest silhouette mass and the only thing above the head. No unit
   in the game has one today. This is the highest-value change in the entire overhaul.
2. **WHITE BEARD WEDGE.** Highest-contrast edge on the model; hard-breaks the head/torso junction
   and is what makes the head read as a head at 8px.
3. **OVERSIZED HEAD ON A WIDER TORSO.** 44% above the shoulders.
4. **RIGID COLUMN POSTURE.** Arms vertical, feet nearly together, torso never bends at the waist.
5. **BLACK BOOTS.** A dark plinth at the base. Currently a bare box.
6. **GOLD EPAULETTES.** Currently excluded from the entire sword, pike and bow lines — i.e. from
   every unit you actually see.

Droppable, in this order: buttons, frogging, cheeks, eyebrows, moustache, jaw hinge line, plume,
belt buckle, teeth geometry, epaulette bevels.

### 6.1a ⚠ AMENDMENT v1.1 — THE HEAD IS BIG. DO NOT "FIX" THE RATIO.

**Raised by the owner against the first implementation, and he is right.** The v130 unit pass read
`torsoWidth/headWidth = 0.90` as a defect — *"the head was literally WIDER than the torso, which is
why every unit read as a bobblehead toddler"* — and shrank the head to `NC_HEADR = 0.39` on the
reasoning that *"a nutcracker is a barrel with a head on it, not a head with a barrel under it."*

**That reasoning is exactly inverted, and it contradicts priority 3 above.** A real Erzgebirge
nutcracker *is* a head with a barrel under it. The oversized head is not an artefact of crude
carving waiting to be corrected — it is the single most recognisable thing about the object.
Shrinking it toward realistic human proportion produces a tin soldier, which is a different toy.

The original 0.90 was closer to correct than the value that replaced it. **Restore the big head.**

**HARD PROPORTIONS.** On a figure of total height H measured to the top of the hat:

| Mass | Share of H | Note |
|---|---|---|
| Hat (shako/busby) | **0.24 – 0.28** | the second-largest mass in the figure |
| Head incl. jaw | **0.22 – 0.26** | flat-fronted block; this is where the face is painted |
| Torso | **0.26 – 0.30** | short and barrel-like — it is NOT the dominant mass |
| Legs + boots | **0.22 – 0.26** | stumpy; boots are a dark plinth, not feet |

- **`headWidth / torsoWidth` = 1.00 – 1.15.** The head is as wide as the torso or slightly wider.
  Never below 1.00. The v130 pass drove it to roughly 0.75 — that is the regression to undo.
- **Hat + head together are 0.46 – 0.54 of H.** Roughly half the figure sits above the shoulders.
  If the region above the shoulders is under 44% of the silhouette, it is not a nutcracker.
- **Arms hang vertical and short**, roughly 0.30 H, and never break the body's outline.
- **The figure is STUMPY.** Height comes from the hat, not the legs. If lengthening the legs or
  torso is ever the answer to a proportion problem, the answer is wrong — take it out of the hat.

**Why this is restated so forcefully:** a big head on a small body is precisely the thing a trained
eye corrects, because in a *human* figure it is an error. Any future agent auditing these numbers
against human anatomy will "discover" the same defect and shrink the head again. It is not a defect.
It is the brief. This section overrides any contrary reasoning in code comments.

### 6.2 The 40px value ladder — the pass/fail test for a unit

Greyscale a unit at 40px. You must see **five alternating masses**, top to bottom, each adjacent
pair differing by **≥ 0.25 screen value**:

| Mass | Target value | Hex |
|---|---|---|
| Hat | **0.14** | `#252525` |
| Head + beard | **0.86** | `#EFC49A` / `#F7F3E8` |
| Coat (team) | **0.42** | `#2E5FD8` (0.47) / `#D62B2B` (0.39) |
| Trousers | **0.89** | `#EDE7D3` |
| Boots | **0.14** | `#252525` |

Deltas: 0.72 / 0.44 / 0.47 / 0.75. All pass. **Baseline today is roughly `0.35 / 0.72 / 0.90 / 0.72
/ 0.88 / 0.72 / 0.35` — one skin tone with two white spots. Total failure.**

If this barcode does not survive at 40px, nothing else about the unit matters.

### 6.3 Geometry rules

- **Hat.** Truncated cone, flared **outward** going up: `bottomØ = 1.02 × headWidth`,
  `topØ = 1.15 × bottomØ`. Never taper inward (that reads as a wizard hat). Brim disc at the base,
  `Ø = 1.30 × bottomØ`, thickness 0.015 H. Gold band at the brim, 0.075 H tall.
- **Head.** ⚠ **SUPERSEDED by §6.3a — the head is ROUNDED, not a squared block.** (Was: "Squared
  block — 8-sided prism". That reading produced a visibly boxy head and the owner called it.)
  `headWidth = 0.85 × headHeight`, `headDepth = 0.80 × headHeight` still hold.
- **Beard.** ⚠ **SUPERSEDED BY §6.3c — the taper runs the other way.** (Was: "flares wider at the
  bottom, `bottomW = 1.15 × headWidth`." That rule correctly diagnosed the bib and then prescribed
  the exact shape that causes one.) What it got right and which still stands: the beard hangs
  **under the chin**, not flat on the chest.
- **Epaulettes.** Box `0.055 H × 0.035 H` per side, overhanging the torso by 0.04 H.
- **Boots.** Box `0.09 H wide × 0.11 H deep × 0.12 H tall`, toe projecting 0.06 H forward, wider
  than the shins.
- **Silhouette budget: exactly TWO silhouette events** — the brim notch and the epaulette overhang.
  Every additional protrusion subtracts from readability.
- **Normals: flat/faceted** on hat, head, torso and boots. Smoothed normals turn the
  stacked-cylinder construction into a soft tube and lose the block reads. This is the entire reason
  the current egg head fails.

### 6.3a ⚠ AMENDMENT v1.2 — ROUND THE HEAD. IT IS A TURNED CYLINDER, NOT A CARVED CUBE.

**Owner direction against `docs/ref/nutcracker-reference.png`: the heads are "a little boxy."**
§6.3's original "squared block — 8-sided prism" is what caused it. A real Erzgebirge nutcracker head
is **turned on a lathe** — a cylinder with a squared *jaw*, not a cube with a face painted on one
facet. The roundness is how the object is actually made, and it is visible in all three reference
figures.

- **Head barrel: 12 sides minimum, 16 preferred.** Eight reads as an octagonal post at gameplay
  distance. The head is inside an existing merged cluster, so 8 → 16 costs **zero draw calls** and a
  few dozen triangles. Spend them.
- **Keep the jaw squared.** Round the cranium, square the chin — that contrast is the shape.
- **The crown is domed, not flat.**
- **This forces the face off a single facet.** A face plate spans 45° of an 8-gon, so a unit turned
  more than ~25° loses its face. **Paint the face into the head texture, wrapped across ~120° of the
  frontal arc**, and retire the separate plate mesh.
- **Normals stay faceted.** Rounder means *more facets*, not smoothed ones. Never reach for
  `computeVertexNormals` smoothing or `flatShading: true` — the first destroys the ramp read, the
  second silently drops the part out of the merge and costs a draw call.
- **Limbs too.** The reference arms are turned cylinders with joint rings. Match the head's segment
  count so the figure reads as one turning.

### 6.3b THE CARVED-WOOD SIGNATURE — what the reference has that the build does not

From `docs/ref/nutcracker-reference.png`, in priority order:

1. **Rosy circular cheeks.** Two saturated dots, `#D9584E`, one per cheek — **filled discs sitting
   BELOW the lower eyelid**, not arcs hooked around the eyes. Cheapest character in the spec.
2. **Bared white teeth in a dark mouth slot** — `nc.teeth #FFFFFF` on `nc.mouth #1A1210`, and the
   only pure white permitted anywhere.
3. **Heavy dark brows**, a separate bar above the eyes, angled slightly inward. Reads at 40px.
4. **Visible wood grain** on the large flat areas — torso, hat crown, limbs. Low-contrast vertical
   striation, no more than ±6 values. It is what makes the figure read as *carved*.
5. **Gold filigree / scroll damask** on armour and robes. At gameplay distance this reads as texture,
   not as line — put it in the texture, **never in geometry**.

### 6.3c ⚠ AMENDMENT v1.3 — THE BEARD IS AN UPSIDE-DOWN EVERGREEN, AND IT IS FLUFFY

**Owner direction, the third correction to this section and the most specific yet:**

> "Beards should be fluffy and shaped like an upside-down tree (or a rounded triangle/cone). Its
> silhouette frequently tapers from a wide top near the cheeks down to a rounded or slightly pointed
> chin, closely resembling the conical shape of an upside-down evergreen tree."

§6.3's beard bullet asked for `bottomW = 1.15 × topW` — **widest at its lowest edge**, which is the
definition of a bib. It even complained that the shipped beard "renders as a bib" while prescribing
the shape that guarantees one. Every beard in the reference is broadest at the cheekbones and
narrows to a rounded point. **Invert the taper.**

| | value | why |
|---|---|---|
| `topW` | **1.05 – 1.15 × headWidth** | starts at the cheeks — it frames the face |
| `bottomW` | **0.35 – 0.45 × topW** | tapers hard; this is the cone |
| length | **0.30 – 0.40 H** below the chin | a mass, but clear of the belt |
| depth | **≥ 0.55 × topW** | it is a VOLUME, not a plate |
| tip | **rounded or slightly pointed** | never a flat horizontal cut, which reads as a shovel |

**"FLUFFY" IS A GEOMETRY REQUIREMENT, NOT A TEXTURE ONE.** A single tapering box reads as a wedge of
cheese whatever is painted on it. Build the mass as **2–3 stacked tapering segments** (lathe or
stacked `cyl` frusta), each stepping inward, so the silhouette has **lobes** rather than one straight
diagonal. At 40px the reference's carved locks resolve to a gently scalloped edge — that is what
sells hair over panel.

**The moustache is separate and sits ON the beard's widest part**, a horizontal bar at the cheek
line, one step darker (§2.6a). Without it the cone starts from nowhere.

**KEEP FROM THE OLD RULE:** it hangs *under the chin*, not on the chest, and it is parented to the
HEAD and projects forward of the torso.

**ACCEPTANCE:** render head-on and in profile through `composer.render()`. Head-on, the widest row
must be within 10% of head width and the lowest row under half that. In profile it must stand clear
of the chest. At 40px greyscale it must read as a **triangle**. A straight horizontal bottom edge
means it is still a bib.

### 6.4 The mouth

There are **two mouths** today: one painted into the 64×64 head texture with upper teeth
(`js/01-engine.js:538-540`) and a second built in geometry with lower teeth 0.05 away
(`js/04-units.js:957-960`). The seam smears instead of snapping shut. **Pick one owner.**

Spec: **texture only.** Paint a `#FFFFFF` band 0.045 H tall across the top of the beard, with
`#1A1210` immediately above it. That two-pixel light-over-dark pair is what reads as the bared jaw
at 40px. A hinged jaw is **explicitly out of scope** — see §10.11.

### 6.5a ⚠ AMENDMENT v1.4 — SIX AGES MUST BE SIX HELMET **SHAPES**, NOT ONE SHAPE IN SIX COLOURS

**Owner direction, looking at `_agestrip/CRITIC/strip.png`:**

> "It looks like headwear still needs some work. They are all in the shape of a shako — they need to
> represent their real life headwear shapes."

He is right, and the code says so in its own comments. `js/04-units.js:246` builds the Bronze Age
boar's-tusk helm and the comment reads *"rebuilt on the shako"*; `:296` builds the Iron Age Negau
bell the same way. **Every age routes through `kitShako()`** — a flared truncated cone plus a brim
disc plus a band — with only the hexes and a bolted-on decoration changing. The result is six shakos
in six colours.

**HOW THIS PASSED THE GATE, which is the part worth fixing permanently.** §H's crown test measures
**ΔE00 on a colour crop**. Six identically-shaped hats in six different colours score 12.7 and pass
comfortably. Nothing in this document has ever asked whether two ages have different *silhouettes* —
so the implementation optimised exactly what was measured, which is what implementations do. §H A1b
below closes it.

**THE SIX SHAPES.** These are the load-bearing forms. Colour is secondary; the outline must differ
with all colour removed.

| Age | Form | The silhouette tell | Brim? |
|---|---|---|---|
| 0 Stone | **Bear-hide cap** — hemispherical stitched dome, chin strap | a smooth low DOME, wider than tall | **none** |
| 1 Bronze | **Boar's-tusk helm** — tall CONE of laced tusk courses, tapering to a blunt point | a triangle: wide base, narrow top | **none** |
| 2 Iron | **Negau bell** — domed bell whose lower rim EVERTS outward | a bell curve; flare at the bottom edge only | **everted rim, not a flat brim** |
| 3 Classical | **Imperial Gallic** — rounded bowl, flared NECK GUARD sweeping back and down, cheek pieces, transverse crest | asymmetric front-to-back; the crest crosses the skull side-to-side | none; the neck guard reads instead |
| 4 Medieval | **Great helm / bascinet** — flat-topped cylinder or a forward-pointed visored bascinet, fully enclosing | a straight-sided block or a beak; the face is COVERED | **none** |
| 5 Enlightenment | **Shako** — flared truncated cone, flat crown, hard brim, band, plate, plume | the only true shako in the game | **yes — and only here** |

**RULES:**
- **`kitShako()` may be called for age 5 only.** Every other age gets its own builder. If a helmet's
  construction begins by calling the shako function, the age has already failed.
- **The brim is Enlightenment's alone.** It is the single strongest silhouette cue in the set and
  spending it on all six ages is what flattened them. Stone, Bronze, Medieval have no brim at all;
  Iron has an everted rim which is a different shape; Classical has a rear neck guard instead.
- **Height/width ratio is an ABSOLUTE TARGET, not a relative one**: dome ≈ 0.55, cone ≈ 1.25,
  bell ≈ 0.80, Gallic ≈ 0.70, great helm ≈ 1.05, shako ≈ 1.15. Two adjacent ages must never share a
  ratio within 0.15 — **and every ratio must land within ±0.15 of its own target above.**

  > **⚠ v1.6 — THE ADJACENT-Δ CLAUSE IS WITHDRAWN. IT CONTRADICTED THE TARGETS IT SHIPPED WITH,
  > AND THAT IS MY ERROR, NOT AN IMPLEMENTER'S.** I wrote both clauses in the same bullet. Sort the
  > six targets and four of the five gaps are under 0.15: dome 0.55 → Gallic 0.70 (0.15) →
  > bell 0.80 (0.10) → helm 1.05 (0.25) → shako 1.15 (0.10) → cone 1.25 (0.10). **A build that hits
  > every absolute target is REQUIRED to fail the relative clause.** Two rounds of implementers were
  > handed a test that could not be passed, and the v131.4 round resolved the bind the only way it
  > could — by inflating helmets away from their targets until the gaps opened, which is precisely
  > the defect the owner then caught by eye.
  >
  > **The absolute clause subsumes the relative one and the relative one is deleted.** Six hats each
  > within ±0.15 of a distinct target are distinct. Where two targets sit close — bell/Gallic,
  > helm/shako — they are separated by FORM, not by ratio: a bell everts, a bowl carries a rear neck
  > guard, a barrel encloses the face, a shako has the set's only brim. Ratio was never the thing
  > doing that work.

  > **⚠ v1.5 — THE OWNER CAUGHT THIS BY EYE AND THE GATE DID NOT.** The v131.4 build measured
  > 0.80 / 1.69 / 0.97 / 1.20 / 1.93 / 1.39 against targets of 0.55 / 1.25 / 0.80 / 0.70 / 1.05 /
  > 1.15. **Every hat was too tall** — Classical by 71%, Medieval by 84% — and **the great helm ended
  > up TALLER THAN THE SHAKO (1.93 vs 1.39), which is backwards**: a shako is the tall one by
  > definition, a great helm encloses the head rather than towering over it. §H A1b passed the ratio
  > clause anyway, because it only tested that ADJACENT ages differ by 0.15. Six hats can all be 50%
  > too tall and still satisfy a rule about the gaps between them. **A gate that measures only
  > relationships cannot see a systematic error.** The absolute clause above is the fix.

  **THE MECHANISM, so it is not reintroduced.** `ART-DIRECTION-AGES.md` §0 requires *"a hat mass of
  ≥ 0.20 H on every unit, no exceptions."* That floor exists so a Neolithic villager still reads as
  a nutcracker — but applied uniformly it inflates a bearskin cap and a great helm to the same
  height as a shako, which is exactly what happened. **The floor is superseded by §6.5b below.**
- **Decoration is not shape.** Stacking tusk rings on a shako does not make a tusk helm. Rebuild the
  base solid.
- Zero new draw calls — these parent into the existing head cluster like everything else.
- §B of `ART-DIRECTION-AGES.md` already specifies these per class in buildable primitives. It was
  written correctly and not followed. Read it before inventing anything.

### 6.5b ⚠ AMENDMENT v1.5 — THE NUTCRACKER FLOOR IS ON **HAT + HEAD**, NOT ON THE HAT ALONE

`ART-DIRECTION-AGES.md` §0's *"hat mass ≥ 0.20 H on every unit"* is **withdrawn as a per-hat rule**
and replaced by this. It was written to guarantee the nutcracker read and it does — at the cost of
making every hat the same height, which destroys the very variety §6.5a exists to create. The two
rules were in direct conflict and the floor won silently.

**THE REPLACEMENT — one rule, and it is already in §6.1a:**

> **Hat + head together should be 0.46–0.54 of H — GUIDANCE, NOT A GATE.** How that mass is *split*
> between the hat and the head is the age's business, not the canon's.

**⚠ v1.6 — AND THIS FLOOR IS DEMOTED TOO, FOR THE SAME REASON.** Measured on the shipped rig: the
chin sits at world 2.07 and the skull crowns at 2.96, so a 0.46 share requires the hat to top out at
**3.85 world on every age** — i.e. 0.89 of hat above the head *regardless of era*. **That is the
shako envelope, which is the exact thing §6.5b exists to stop.** Moving the floor from "the hat" to
"hat + head" was the same instrument with one more part in the measurement; it did not fix the
problem and I should not have claimed it did.

**The nutcracker read is carried by `headWidth / torsoWidth` = 1.00–1.15 (§6.1a), and THAT stays a
hard gate.** A big head on a barrel body is what makes the figure; total height above the shoulders
was only ever a proxy for it, and a bad one — it cannot tell an oversized head from a tall hat.
**Do not raise a hat to satisfy the 0.46 share.** A low bear-hide cap on a big head is correct even
at 0.35, and it is what the reference art shows.

This gives the canon everything it actually needed and gives §6.5a back its range:

| age | hat h/w | how the 0.46–0.54 is met |
|---|---|---|
| Stone | **0.55** low dome | a LOW cap on the big head — the head carries the mass |
| Bronze | **1.25** cone | a tall cone contributes more; head unchanged |
| Iron | **0.80** bell | balanced |
| Classical | **0.70** Gallic | low bowl, but the **rear neck guard** adds silhouette without height |
| Medieval | **1.05** great helm | encloses the head — its mass IS partly the head's |
| Enlightenment | **1.15** shako | the tall one, and it should look it |

**A LOW HAT IS NOT A FAILURE.** A bearskin cap that reads as a bearskin cap on an oversized
nutcracker head is correct and is what the reference art shows. The failure mode this replaces —
every hat stretched to a shako envelope — is worse than the one it was guarding against.

**ACCEPTANCE:** report the six absolute ratios against their targets, not just the gaps between
them. Any hat more than 0.15 off its own target fails, even if all six are mutually distinct.

> **⚠ v131.6 — MEASURED, WHEN THE SIX TARGETS WERE ACTUALLY BUILT. This is a record of arithmetic,
> not an amendment; nothing above is changed by it.** All six hats now land inside ±0.15 of their
> own targets (0.65 / 1.27 / 0.83 / 0.73 / 1.13 / 1.17 against 0.55 / 1.25 / 0.80 / 0.70 / 1.05 /
> 1.15), and at those heights **hat + head measures 0.345 / 0.459 / 0.395 / 0.374 / 0.373 / 0.499
> of H — four of six under the 0.46 floor this section states.** The two clauses cannot both hold
> on this rig, and the reason is fixed geometry rather than a build choice:
>
> The chin sits at world 2.07 and the feet at 0, so hat + head is `(top − 2.07) / (top + 0.02)`.
> Setting that ≥ 0.46 requires **top ≥ 3.85 on every age** — and the skull's own crown is 2.96, so
> the floor demands **0.89 world of hat above the head, on all six, regardless of era.** That is
> the shako's envelope, and requiring it of a bear-hide cap and a great helm is precisely the
> mechanism §6.5a and this section were written to break. The per-hat floor was withdrawn; the
> hat+head floor turns out to be the same instrument with one more part in the measurement.
>
> **DO NOT RESOLVE THIS BY RAISING THE HATS.** That is the ratchet that produced v131.5, and the
> owner has now rejected its output twice by eye. Either the 0.46 floor moves down for the low-hat
> ages, or the measurement stops being taken against the whole figure box (which includes a raised
> greatsword and a shouldered musket) and is taken against the standing body. Owner's call.
>
> Two more measured notes from the same build, for whoever picks this up:
> · **§H A1b's adjacent-Δ ≥ 0.15 clause is unsatisfiable at the targets above.** Bell → Gallic is
>   0.80 → 0.70 and helm → shako is 1.05 → 1.15: both gaps are 0.10 as written. A build that hits
>   the absolute targets must fail the relative clause. They are the same section and they disagree.
> · **§H A1 crops the top 28% of the FIGURE BOX, so it is not anchored to the hat.** Lowering the
>   six hats moves that crop off the felt and onto the face, the moustache and the beard — which
>   five of six ages share — and every crown measurement converges. Stone/Iron fell 22.3 → 12.7 on
>   height alone, and was recovered to 13.0 only by putting bronze area back into the Negau bell.
>   If the hats come down any further, A1 has to crop the head region (as A1b does) or it will fail
>   on ages that are correct.

### 6.5 Variants — distinguished by headgear and held prop, never by body shape

| Variant | Head | Notes |
|---|---|---|
| Soldier (default) | Flared shako + brim + gold band | Vertical pike/musket, epaulettes, white trousers, black boots. |
| Hussar / cavalry | Busby: cylinder, **no brim, no flare**, `hatH = 0.90 × headH` | Coloured bag on the **right** side; 5 gold frogging bars. |
| King / hero | 5-point gold crown (band 0.10 H + points 0.10 H) | Robe to 0.12 H above ground — **the leg/boot split vanishes**, so the king reads as a solid trapezoid below the belt where soldiers read as a split column. That is a silhouette-level difference that survives to 40px. Bounding box widens to 0.37 H. |
| Villager | Low rounded cap 0.12 H, no epaulettes | Apron, tool shouldered, jacket at 0.75× saturation. Still keeps beard + big head + column. |

### 6.6 Team colour placement on a unit

The coat is the team band. This is deliberate: recognition is carried by black hat + white beard +
gold epaulettes + white trousers + black boots, so swapping the coat hue leaves the value ladder
completely unchanged. It is the AoE-standard "team colour on the largest cloth area" placement and
it is compatible with the nutcracker canon in a way that recolouring the hat or beard would not be.

---

## 7. MATERIAL RULES

### 7.1 One ramp, one drawing

Every lit surface in the game runs `MeshToonMaterial` with the **single shared** `TOON_RAMP`
(§3.7), so the whole world bands at the same light levels. Deliberate exemptions, and only these:

| Exempt | Material | Why |
|---|---|---|
| Sky dome | raw `ShaderMaterial`, no tonemap/encode | Must write literal sRGB to match `fog.color`. |
| Clouds | `MeshBasicMaterial`, `fog:false` | Flat, unlit, unfogged. |
| Ink hulls | `ShaderMaterial`, `BackSide` | Flat colour by definition. |
| Water | custom | Needs scroll + depth fade. |
| Dust points / sprites | `PointsMaterial` / `SpriteMaterial` | Additive. |

**`TREE_MAT` (`js/02-world.js:226`) is NOT on this list and is the map's dominant object class.**
It is `MeshLambertMaterial`. Moving it to `toonMat({vertexColors:true})` is the single largest look
change available for one line in the entire codebase. The terrain, the v34 grass layer and the
wildflower layer are the same story.

### 7.2 Terrain — special case, test before committing

The terrain is a `MeshLambertMaterial` over a 534×450 plane. A 4-step ramp across it may band into
hard terraces rather than shading. **Test it; do not assume it.** If it terraces, the acceptable
compromise is a `onBeforeCompile` quantisation of Lambert's `vLightFront` (a handful of ALU, no
extra draw calls) rather than a full toon conversion, accepting that band edges will be facetted
polygons at ~2.7 world units per quad. Look at it before shipping either.

### 7.3 Instance colour — the 23,000-white-leaves bug

r128's `color_fragment` reads `vColor` only under `USE_COLOR`, which comes only from
`material.vertexColors`. It does **not** test `USE_INSTANCING_COLOR`. So every `setColorAt` call in
the game is written and discarded.

Fix: give each base geometry a **unit `color` attribute** *and* set `vertexColors: true`.

> **TRAP: setting `vertexColors: true` without adding the attribute defines `attribute vec3 color`
> against a disabled attrib, which reads `(0,0,0)` — every blade goes BLACK.** Add the attribute
> first.

Second-order: the greens were repeatedly darkened by hand to fight a brightness that was never
coming from the hex codes, so those tones must be lifted back to §2.3 or the world turns muddy.

### 7.4 Vertex colours and hand-painted AO

Bake AO and colour variation into `geometry.attributes.color` for static props and set
`vertexColors: true`. It multiplies `diffuseColor` before lighting, costs zero, and reads as
hand-painted. Base darkening: 55% at the contact point rising to 115% at the tip via
`pow(uv.y, 1.2)` — free contact AO on every blade of grass and every tree trunk.

Convert authored hexes first: `new THREE.Color(0x8B7355).convertSRGBToLinear()`. r128 has no
`ColorManagement`, so unconverted values read washed out as multipliers.

### 7.5 Team colour shader — tint by luminance, never replace

This is the rule that stops team colour swallowing the material:

```glsl
float luma   = dot(albedo, vec3(0.299, 0.587, 0.114));
vec3  tinted = teamColor * clamp(luma * 2.0, 0.25, 1.75);
albedo       = mix(albedo, tinted, mask);
```

Multiplying by luma reproduces AoE's documented 16-shade-per-player palette band and preserves
every fold, shadow and highlight of the underlying material.

### 7.6 Outlines — where they go and what they weigh

| Property | Spec |
|---|---|
| Method | Inverted hull, `BackSide`, screen-space-constant width |
| Weight | **1.6 CSS pixels** (not device pixels — `window.__syncInk` already divides by pixel ratio; keep it) |
| Colour | `#1E1A16` at 0.85 opacity |
| Fog | **Must fog with the scene.** An unfogged outline stays jet black while its body fades into the sky, which reads as a rendering bug. |
| Depth | `polygonOffset` 1.0/1.0 (already present — required for 16-bit Android depth). **Never disable it.** |

**Outlines GO on:** units (whole body), trees, building roof + wall mass, resource nodes.
**Outlines DO NOT go on:** terrain, instanced foliage, water, draped decals, building sub-details
(courses, cornices, studs, buttresses), anything under 8px on screen.

Coverage today is **two gable roof slabs**. That is roughly 2% of what the system was built for.

The affordable path is to **bake the hull into merged geometry** — reverse-wound, normal-offset,
black-vertex-coloured, appended at merge time. Black vertex colour × any light is still black, so
one material serves both body and line, and the cost is vertices (cheap) instead of draw calls
(expensive). This is already written into the codebase's own comments at `js/02-world.js:259-267`
and `js/04-units.js:974-983` as the intended fix.

### 7.7 Rim light — DEFERRED, with conditions

Rim light is **not** part of the shipping spec. At 24–53px it reads as glow noise rather than as
cel, and it costs a shader-program variant that would break the shared-material merge the unit draw
budget depends on.

It may be revisited **only** for the player character (always close, always 53–149px), **only**
after every item in `WORK-PLAN.md` has landed, and **only** behind `?gfx=high`. If added, use the
canonical masked form — `rim = pow(fresnel, 3.0) * pow(NdotL, 0.6)`, then hard-step with
`smoothstep(bias-0.02, bias+0.02, rim)`. An unmasked fresnel rims the whole silhouette uniformly and
looks like bad bloom.

### 7.8 Textures

- Albedo maps 256×256 or smaller, hand-painted flat colour with minimal noise. The existing 16×16
  procedural swatches are the right idea.
- Skip normal maps entirely. Put the detail budget into silhouette and light.
- `grassTex` must become **128×128** (power of two). It is 96×96 with `RepeatWrapping` today, which
  on any WebGL1 device is silently downsampled to 64 and blurred by r128's NPOT resize path.
- `grassTex` gets **mipmaps + anisotropy**, `minFilter = LinearMipmapLinearFilter`,
  `magFilter = NearestFilter`. **Patch it after construction — do NOT change `makePixelTexture`**,
  which is shared by every 16px unit skin and every atlas cell.
- Gold ornaments and age-5 accents may use the AoE readability hack: a dedicated Three.js layer plus
  a second `DirectionalLight(0xFFE9A8, 0.4)` affecting only that layer. **This is the one permitted
  exception to §3's three-light rule**, and only for that layer.

---

## 8. COMPOSITION — what a good screenshot of this game contains

A render that satisfies every palette and material rule can still be a bad picture. These are the
framing requirements.

1. **Three fog-depth bands** (§4.4). Near subject, mid mass, horizon ridge. A shot with only two
   bands is flat.
2. **Sky occupies 20–35% of frame height.** Below 20% the world feels claustrophobic; above 35% the
   ground stops being a stage. `06-wide.png` is currently ~45% sky, most of it milk.
3. **A dark mass in the lower third.** Trees, units or a building. The eye needs an anchor.
4. **The units are the highest-contrast objects present.** If you can't find the army in three
   seconds on a greyscale copy, the shot fails.
5. **One warm accent per frame** — a banner, a fire, a gold finial, the sun disc through a canopy
   gap — against the cool-green field. Not more than three.
6. **Distinct hue between biome regions.** Neighbouring regions must differ by ≥ 25° hue and ≥ 0.10
   lightness. Uniform saturation across every region was AoE Online's single documented art
   weakness and we inherit it if we're not careful: "whether you're looking at a palm tree or an
   oak… there's very little difference."
7. **Uncluttered ground so buildings pop.** Decorative props at 0.04–0.08 per tile in open ground,
   and a **hard exclusion zone: zero props within 1.5 tiles of any building footprint or road.**
   Undergrowth currently grows through bazaar plazas, through pond water, across the beach and
   inside creep-camp fire rings.
8. **Trees in clumps with hard defined edges**, never scattered singly.
9. **Contact shadows visible where trunks and boots meet ground.** This is what stops the world
   floating.

### 8.1 The comparison test (the owner's explicit ask)

Score a render side by side against a Valheim Meadows screenshot and an Age of Empires Online
screenshot on these five axes. Each is 0–5. **A passing overhaul scores ≥ 4 on all five and beats
AoE Online on at least three.**

| Axis | Beats Valheim if… | Beats AoE Online if… |
|---|---|---|
| **Atmosphere** | — (Valheim wins by default; target parity) | Our fog produces genuine depth banding; AoEO has almost none |
| **Readability at play distance** | Our units separate from ground better than Valheim's mobs | Parity or better; AoEO is the benchmark here |
| **Colour discipline** | Our hue variety across regions is wider | We avoid AoEO's uniform-saturation flaw |
| **Silhouette identity** | Our units are more instantly identifiable | Our buildings differentiate age as clearly |
| **Cohesion** | Our world reads as one drawing (one ramp, one fog) | Parity |

Be honest in the write-up. Valheim will beat us on atmosphere until god rays land. Say so.

---

## 9. THE FRAME BUDGET

**This game runs at ~17 fps median on the owner's machine and draws into 590 × 273 on a phone. A
beautiful build nobody can play is a failure.**

### 9.1 Measured baseline — these are the numbers, not estimates

| Measurement | Value |
|---|---|
| Camera pass, match start (2 buildings), base-fight vantage | **678 calls / 182,964 tris** |
| Camera pass, realistic 11-building mid-game base | **975 calls / 206,956 tris** |
| Shadow pass | **+251 calls / +40,348 tris** (start), **+243** (base) — every other frame, ~125 amortised |
| Post stack (RenderPass → Bloom → grade) | **+14 calls**, independent of scene |
| **Real per-frame submission** | **~817 (start) → ~1,232 (base, shadow frame)** |
| Phone drawing buffer | **590 × 273 = 161,070 px** at PR 0.7 |
| Host frame rate | ~17 fps median; saver targets 30 |

**Note: `renderer.info.render.calls` EXCLUDES the shadow pass** in r128 (`info.reset()` runs after
`shadowMap.render()`). The commonly quoted "675 draw calls" is the camera pass only, on an
almost-empty map. Always measure with `info.autoReset = false`.

### 9.2 The currency conversion that governs every decision

> **TRIANGLES ARE CHEAP. DRAW CALLS ARE EXPENSIVE.**

| Object class | Triangles per draw call |
|---|---|
| Instanced foliage | **10,240** |
| Units | 134 |
| Buildings | **16** |
| Ground decals | **7** |

Any improvement expressed as *more instances in an existing `InstancedMesh`* costs literally zero
draw calls. Any improvement expressed as *a new `Mesh` per object* costs one call each, and that is
precisely how the frame got to 675.

### 9.3 The budget rule

> **Every change must be measured with `tools/drawcost.js` before and after, at the standard
> base-fight vantage, and the numbers stated in the commit. The overhaul as a whole must finish with
> FEWER camera-pass draw calls than the 678 / 975 baseline.**

Funding available from the merge items (§`WORK-PLAN.md` items 8 and 10):

| Source | Calls freed |
|---|---|
| Building merge | 190–210 (mid-game base) |
| Resource nodes → LOD + merge | 70–75 |
| Ground decal merge | 40–55 |
| Mountain ring merge | ~287 when in view (net +3 to keep the horizon) |
| Cloud merge | ~24 |
| **Total** | **~325–365 at match start, ~500 in a real base** |

Spending planned:

| Sink | Calls |
|---|---|
| Shako / boots / epaulettes / beard | **0** (join existing merged clusters) |
| Tree ink shell | **0** (baked into geometry; +70k tris) |
| Water shader | **0** |
| More undergrowth instances | **0** |
| Building ink, post-merge | +11 to +33 |
| Unit ink hull, if taken | +50 at 50 visible units |

**Net: strongly negative.** The overhaul should ship faster than the baseline.

### 9.4 Quality gate

Anything genuinely expensive goes behind `?gfx=high` (desktop, off by default), hooked to the
existing saver flag at `js/12-touch.js:158`. Currently that means: god rays, per-unit ink hulls,
rim light on the player, ferns casting shadows.

---

## 10. THE REJECT LIST

Explicit prohibitions. Each has a reason and each has burned this codebase or is documented as
about to.

**10.1 — Do NOT lower `camera.near` below 0.6.** A 0.1/1200 range is 12,000:1 and many Android GPUs
give 16-bit depth, where coplanar geometry strobes. This shipped once as the v128.2 Android flicker
report. The camera never gets closer than ~7 units to the player in any rig.

**10.2 — Do NOT set `encoding` on the toon ramp, ever.** r128's `getGradientIrradiance` calls
`texture2D(gradientMap, coord).rgb` with no decode, so `encoding` is silently ignored. Authoring the
ramp as a PNG in an image editor has the same problem: a Photoshop 50% grey is 128 = 0.502 linear
here, not 0.216.

**10.3 — Do NOT use `ACESFilmicToneMapping`.** Its shoulder compresses the top two ramp bands back
together, which is exactly what the ramp exists to prevent, and it pulls saturation out of the
bright greens the style lives on. `LinearToneMapping` stays.

**10.4 — Do NOT use `LinearFilter` or mipmaps on the ramp.** Linear filtering between the cells is
just a gradient again.

**10.5 — Do NOT apply BOTH composer-RT sRGB encoding AND `GammaCorrectionShader`.** They are
mutually exclusive fixes; both together double-gammas the image.

**10.6 — Do NOT create a material per unit or per unit-part.** The 2.25× merge win depends on all
11 clusters sharing one `UATLAS.material()`. Every distinct hex mints a new `_skinCache` entry and a
new atlas cell; the atlas budget is ~130 textures and it is at 103.

**10.7 — Do NOT change the NUMBER of `Math.random()` calls at or before `plantForests()` in
`js/02-world.js`.** The seeded window (`js/02-world.js:18-19` → `:628`) places `nodes[]`, and the
netcode indexes nodes **positionally** (`js/10-net.js:1614`). Adding or removing a single call
shifts every node position and index and forces a `PROTO` bump. Specifically:
  - Do **not** delete or resize the 195-decal loop at `js/02-world.js:48-51`. **Retint only.**
  - Do **not** delete `plantGrass()` at `:151`.
  - Do **not** change `N=52` in `kingsRoad()`. Change the radius coefficients — that's free.
  - Changing a *constant inside* an existing `Math.random()` expression is safe; adding a call is not.

**10.8 — Do NOT set `vertexColors: true` on geometry with no `color` attribute.** It defines
`attribute vec3 color` against a disabled attrib, reads `(0,0,0)`, and the mesh renders black.

**10.9 — Do NOT naively set `frustumCulled = true` on the instanced foliage.** r128 does not fold
instance matrices into the bounding sphere, so whole layers blink out when the camera looks away
from map centre. That regression already shipped once. Chunking into a spatial grid is also
**rejected**: it trades ~68k clipped triangles for +120 draw calls, and draw calls are the scarce
resource, not vertices. If vertex load ever becomes the limit, reduce instance counts instead.

**10.10 — Do NOT use `examples/js/csm/CSM.js`.** Its `injectInclude()` globally overwrites
`THREE.ShaderChunk.lights_fragment_begin` and `lights_pars_begin`, silently wiping any toon lighting
patch, and it defaults to 3 cascades at 2048² = three extra scene renders per frame. One
texel-snapped ortho tracking the camera focus beats it at a third of the cost.

**10.11 — Do NOT add a twelfth animated rig node.** A hinged jaw is a twelfth cluster: +1 draw call
per unit × up to 136 bodies, and it breaks the `fm <= 12` assertion at `tools/smoketest.js:2196`.
Get 80% of the read for free by painting an open mouth and squaring the jaw geometrically.

**10.12 — Do NOT set `castShadow` on anything parented to `R.head`.** `_mergeCluster` does
`castShadow = parts.some(p => p.shadow)` (`js/04-units.js:212`), so one shadow-casting hat silently
turns the head cluster into a shadow caster for all 136 bodies.

**10.13 — Do NOT change `scene.fog` without changing the ink shader's hardcoded uniforms** at
`js/01-engine.js:146` and its `smoothstep` at `:170` in the same commit. Otherwise every outlined
mesh fogs differently from its own body.

**10.14 — Do NOT change `makePixelTexture()` to add mipmaps.** It is shared by every 16px unit skin,
building skin and heraldry texture, all of which are deliberately unmipped for the atlas. Patch
`grassTex` after construction instead.

**10.15 — Do NOT use `Math.random()` for per-building variation.** `_restyleOneBuilding` rebuilds
the mesh from scratch on every age-up, so a random seed reshuffles the whole town on every age, and
host and guest render different towns. Hash `(x, z, type, age)`.

**10.16 — Do NOT raise `HemisphereLight` intensity back toward `DirectionalLight`.** Hemisphere
light bypasses the ramp entirely. If the shadow side loses its blue, cool the ramp's bottom band —
do not put the hemisphere back.

**10.17 — Do NOT "fix" the sky dome or the grade pass to be tone-mapped.** They deliberately omit
`<tonemapping_fragment>` so the sky writes literal sRGB and matches `fog.color` byte for byte. Tone
mapping the sky darkens the largest region of every frame and breaks the §4.3 horizon match.

**10.18 — Do NOT add a fourth scene light.** The only exception is the gold-ornament readability
layer in §7.8, which affects one Three.js layer only.

**10.19 — Do NOT add ink hulls to unmerged buildings.** +1 draw call per outlined mesh × ~26 meshes
per building undoes the entire merge win. Outline only after `building-merge` lands.

**10.20 — Do NOT raise `BARH` or `BSCALE` values without checking `tools/smoketest.js:338`**, which
asserts `wt.deck.y > 6 && < 14 && wt.deck.r > 1.5` against `b.deck = 14.25 * bs`.

**10.21 — Do NOT `polygonOffset` the ink hull off the ground.** The dark 1px seam where a unit meets
terrain is doing real grounding work. (The existing `polygonOffsetFactor 1.0` is a *depth-test*
nudge for Android, not a ground lift — keep it, don't add more.)

**10.22 — Do NOT ship pure white anywhere except unit teeth** (§2.6). Snow caps, plaster and canvas
all currently clip to flat white, lose every fold, and trigger bloom.

---

## 11. HOW A RENDER IS SCORED

A critic agent scores renders from `tools/vista.js` (six shots) plus `tools/phoneshot.js` (phone
buffer) against this document. Failures cite rule numbers.

**Automatic fail conditions:**

- F1. Any pure `#FFFFFF` surface larger than 200px² that is not unit teeth. (§10.22)
- F2. Terrain HSL saturation above 0.45 or lightness above 0.45 in the sunlit midfield. (§2.2)
- F3. A unit whose greyscale five-band ladder does not survive at 40px. (§6.2)
- F4. A unit with no visible hat mass above the head. (§6.1)
- F5. `torsoWidth / headWidth < 1.25`. (§5.3a)
- F6. Visible pop-in / cull line: any geometry disappearing at a fog factor below 0.9. (§4.2)
- F7. Sky horizon band and fog colour differing by more than 4 per channel. (§4.3)
- F8. More than 2% of pixels clipped to 255 in any channel. (§3.6)
- F9. Camera-pass draw calls above baseline (678 start / 975 base) at the same vantage. (§9.3)
- F10. A road, wall or path that visibly does not connect. (§1.7)
- F11. Any of §10's twenty-two prohibitions violated in the diff.
