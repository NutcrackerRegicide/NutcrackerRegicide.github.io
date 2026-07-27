# REGICIDE PVP — Handoff v107 (July 2026)

Upload this file at the start of a new chat (or read it from the "Nutcracker Regicide" project) to continue development. Supersedes all prior handoffs. Written at the close of the audio arc's crown piece: **v107 THE SCORE & THE 90-SECOND ADVANCE**.

## v107 THE SCORE & THE 90-SECOND ADVANCE (79 SFX + 6 music tracks) — **PROTO 22→23**
Two entwined features from a 4+4-question design interview:

### The Score — per-age Suno anthems
- **6 tracks, one per age**, John's own Suno compositions, converted from `Desktop\REGICIDE PVP\potential sounds\music\*.mp3` → **`audio/music/age0.ogg … age5.ogg`** (stereo, vorbis `-q:a 3`, ~43 MB total, durations 6.5–12 min). Map: age0 Stone · age1 Bronze · age2 Iron · age3 Classical · age4 Medieval · age5 Enlightenment.
- **Playback design (John's picks)**: your TEAM's anthem plays **ONCE** at match start (Stone) and once each time YOUR age lands; then **silence until the next age** — the nature ambience swells back. Enemy age-ups are silent (no intel leak). Menu music: **not yet** ("eventually").
- **Ducking**: while an anthem plays, the **ambience bus ducks to a third** (`MUSDUCK=0.33`, ~1 s smooth ramp both ways, `applyDuck`). The ambience slider respects the duck (`setVol` multiplies it in).
- **The 15-second fade**: when your team's 90 s advance enters its **last 15 s**, the still-playing old anthem fades out under the countdown (`musFadeFor(remain)` = remain/15 below 15 s, full otherwise; idle = full). The new anthem starts at full voice when the age lands.
- **Default music volume 30%** (`S.vol.music=0.3`) in case the anthems land loud — **localStorage key bumped `reg_snd_v2`→`reg_snd_v3`** so the default takes for everyone. The **Music slider is LIVE** in the options panel (index.html row un-dimmed, `bind("volmusic","music")`, label span added).
- **Engine choice — streamed `<audio>` elements, NOT decoded WebAudio buffers, NOT base64-embedded**: ~54 min of music would eat hundreds of MB of decoded PCM and bloat audio-data.js by ~57 MB. Media elements stream from `audio/music/` and — unlike `fetch` — **work under `file://`**, so John's double-click solo run gets music too (verified in real Chromium both ways). The element sits OUTSIDE the WebAudio graph: its volume is `master × music × fade` (`musVol`), reapplied live on slider moves and every `Sound.tick`; mute zeroes it (`setMute` touches it directly).
- All music state/logic lives in **11-audio.js** (`MU` state, `musTick(active,dt)` called at the top of `Sound.tick` BEFORE the `S.ready` gate — music needs no decoded buffers). One state machine covers host/solo/guest/match-start/late-join: whenever the game is live and `MU.age !== teamAge[MYTEAM]`, that age's anthem starts once. Inactive (menu/game-over) pauses the element and re-arms (`MU.age=-1`).

### The 90-Second Advance — a real gameplay/balance change (hence PROTO 23)
- **T at the Town Center no longer flips the age instantly.** It **pays the full cost NOW** and arms a **90 s team countdown** (`AGE_RESEARCH_S=90` in 00-data, exported to the stats CSV as `age_research_s`); the age lands when the timer does. **No cancel, not interruptible** (John's pick: simplest & desync-safe). Second T / second guest request while advancing → refused, no double pay.
- **Plumbing**: `ageResT=[0,0,0]` (00-data) · `startAgeResearch(team)` + `tickAgeResearch(dt,authoritative)` + `ageUp` **no longer pays** (08-ui) · host/solo ticks it in tickBody beside economyTick (authoritative → `ageUp(t)` at 0) · `tryAgeUp` (06-input) starts it for BLUE, guests still route `{act:"ageup"}` and the **hostAct handler** starts it server-side (10-net) · **AI directors** use the same `startAgeResearch` — the AI pays and waits the same 90 s (07-ai) · `devAgeUp` stays instant and now grants nothing (ageUp is free).
- **Wire**: snapshots AND the late-joiner world payload carry **`ares:[blue,red]`** (r1-rounded). Guests tick locally between snaps for smoothness (`tickAgeResearch(dt,false)` in guestFrame — display only, never flips the age) and every snap overwrites with host truth. **PROTO 23** — v106 and v107 clients must not mix.
- **HUD**: the agebar shows `⏳ <NEXT AGE> in 47s ▰▰▰▱▱` while advancing (gold fill, refreshed once per second, guest included), and startAgeResearch fires a MYTEAM msg + `ui_confirm`.

## Build/verify protocol (EVERY turn, non-negotiable) — v107 additions
Unchanged from v106 (node --check → npm install three → smoketest 2-3×, green = failing only known flakes + 2 clean runs → rm node_modules → zip excluding `docs/ .git/ node_modules/ "potential sounds/"` → SendUserFile + device sync → verstamp/PROTO/handoff), **plus**:
- **`tools/browsercheck.js` (NEW)** — real-Chromium audio verification the headless smoketest can't do: launches Playwright Chromium (`npm install playwright-core`; executable at `/opt/pw-browsers/chromium-*/chrome-linux/chrome` in the Cowork sandbox), loads the build over **http AND `file://`**, asserts `Sound._state.ready && 79 buffers decoded`, all 6 anthems load+play via `<audio>`, and a fake live-game tick arms the right anthem at `master×music` volume. Run it after ANY audio change. Gotcha it exists to catch: top-level `const/let` game globals are NOT on `window` — use bare lexical names in `page.evaluate`.
- The music OGGs are **streamed, not embedded** — do NOT add them to `js/audio-data.js` (that regen script only walks `audio/sfx/`; keep it that way).
- Smoketest is now ~300 assertions incl. the **v107 section** (pay-now/no-double-pay/lands-at-90/guest-tick-never-flips/`ares` on world+snap/PROTO 23/track map/fade curve/volume law/arming state machine). `__G` gained `startAgeResearch,tickAgeResearch,ageResT,AGE_RESEARCH_S,ageUp,AGES`.

### Known stochastic flakes (do NOT chase) — one NEW entry
All v99-v106 flakes still stand (garden, thrones, far-ground line, militia, the ~12-assert campaign-regicide cascade). **NEW, first seen in v107 (1 run in 12; a 5v5 A/B against v106 showed no frequency shift)**: "the AI directors raise a blacksmith at Iron (0 ever built, ages 5/5)" — campaign-dependent; the 90 s research shifts every AI age later, so in a rare campaign the smith window starves. Same family as the cascade flakes.

## What the game is (delta from v106)
Browser 50v50 third-person medieval war game (see v106 handoff for the full sketch — unchanged). **NET.PROTO=23** (v107: `ares` + the timed advance — a balance change; do not mix v106/v107). Ages now take 90 s of research to land. The game has MUSIC: your team's per-age Suno anthem over the ambience bed.

## User & workflow (John Thompson) — unchanged + music source
- Project at `Desktop\REGICIDE PVP`; Cowork device-folder sync (request folder at session start, stage to `/home/claude/regicide/`, ship zip + device_commit_files every version; zips exclude `docs/`, `.git/`, `node_modules/`, `potential sounds/`).
- **`potential sounds\music\`** holds John's Suno MP3 masters (6 tracks; more may land — he wants menu music "eventually"). Conversion recipe: `ffmpeg -i in.mp3 -vn -ac 2 -ar 44100 -c:a libvorbis -q:a 3 audio/music/ageN.ogg` (the `-vn` guardrail stays mandatory). `potential sounds\sfx\` = the Empire Game pack (618 WAVs + CSV index) for future SFX.
- **The zip grew ~43 MB** (music) → `REGICIDE-PVP-v107.zip` ≈ 48 MB. Netlify Drop handles it; hard-refresh required as ever.
- Balance workflow: `node tools/export_stats.js` — the CSV now carries `age_research_s,90` in the AGES section (latest: `docs/REGICIDE-STATS-v107.csv`).
- Next version: **v108**.

## File map deltas (js/, load order = number order)
- **00-data.js** — +`AGE_RESEARCH_S=90`, +`ageResT=[0,0,0]`.
- **06-input.js** — tryAgeUp → startAgeResearch (+already-advancing msg); devAgeUp instant & free.
- **07-ai.js** — director age-up → startAgeResearch.
- **08-ui.js** — +startAgeResearch, +tickAgeResearch, ageUp pays nothing, updateAgeHud countdown+bar.
- **09-main.js** — tickBody: +tickAgeResearch(dt,true) beside economyTick.
- **10-net.js** — **PROTO 23**; hostAct ageup → startAgeResearch (+guard); `ares` in packSnap + packWorld; applySnap/applyWorld read it; guestFrame ticks display-only.
- **11-audio.js** — THE SCORE block (`MU`, musTick/musTrackFor/musFadeFor/musVol/applyDuck), music default 0.3, prefs key v3, setVol/setMute music-aware, Music slider bound, test surface `_mus/_musTick/_musTrackFor/_musFadeFor/_musVol,MUSFADE_S,MUSDUCK`.
- **audio/music/age0-5.ogg — NEW (streamed, never embedded)**. **audio/sfx** unchanged at 79.
- **index.html** — verstamp v107; Music slider live (value 30).
- **tools/smoketest.js** — v107 section; **tools/browsercheck.js — NEW**; **tools/export_stats.js** — age_research_s row.

## Session log
… v100 THE SOUNDSCAPE · v101 hotfixes · v102 THE COMBAT BATCH · v103 WORLD & ITS EVENTS · v104 WORLD TEXTURE · v105 ARM-UP · v106 PER-LINE ARM-UP · **v107 THE SCORE & THE 90-SECOND ADVANCE — the game gets its music and its first new WAR RULE in the audio arc: six per-age Suno anthems (streamed `<audio>`, music bus live at a 30% default, ambience ducked to a third, played once per age landing), and T at the Town Center now pays up front and takes 90 seconds to land the age (pay-now/no-cancel, HUD countdown bar, AI pays the same toll, `ares` on the wire, guest parity). The old anthem fades out under the last 15 seconds of the countdown. PROTO 22→23. Real-browser audio check tooling added (tools/browsercheck.js).**

## Open threads / watch list
- **MUSIC FIELD TEST PENDING**: does 30% sit right vs SFX/ambience? Is the 0.33 duck deep enough under a 12-minute anthem? Does play-once-then-silence feel right across a long age, or does John end up wanting the "replay after a gap" variant? Fade-in-last-15s audible in practice?
- **90 s advance balance**: is 90 s right at every age? (It's one scalar — `AGE_RESEARCH_S`, or could become per-age `AGES[i].researchS` if John wants a curve.) Watch whether the AI buffer logic (`bufF/bufG`) still paces well now the flip lags the payment.
- **Menu music "eventually"** — John wants a menu theme later; `musTick`'s `active` gate is where it'd hook (play a designated track when `inMenu`).
- **Known audio gaps** (unchanged v101 candidates): no guest deposit chime; ui_back/menu-close; start-menu button clicks. `file://` SFX now fine (embedded) and music fine (streamed) — no gap there.
- **NEW blacksmith flake** (see flakes above) — if it starts showing up more than ~1 in 10, loosen the test or give the campaign section +180 s.
- Everything from v106's list still stands: audio field test (voice-cap/throttle/pan), Suno **menu** track, voip bus, netcode stack field test, hall registry election, quest balance, v94 AI playtest, host-can't-play-RED.

## Transcripts
This handoff is the carry-forward. Project doc `claude/REGICIDE-HANDOFF-v107.md`; device copy `docs/REGICIDE-HANDOFF-v107.md`. Delete the old v106 handoff from the project.
