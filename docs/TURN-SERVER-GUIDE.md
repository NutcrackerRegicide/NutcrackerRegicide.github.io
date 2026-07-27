# REGICIDE — TURN Server Setup Guide (v97+)

## What this fixes (and what it doesn't — read this first)

WebRTC tries to connect two players **directly** (peer-to-peer). When both routers cooperate, you get the ⚡ fast lane — that's what you and your brother already have, so **a TURN server will NOT make your brother games faster**. Your building-lag spikes are a data-volume problem (addressed by the v97 diet), not a connection problem.

What TURN fixes: some router/NAT combinations ("symmetric NAT" — common on phone hotspots, campus networks, some ISPs) make direct P2P **impossible**. Those pairs either never connect or live on 🐢 forever. A TURN server is a relay of last resort: WebRTC automatically routes through it ONLY when direct fails. Once strangers start joining your public halls, some of them will need it. Think of it as insurance for THE HALL.

Cost: ~$5/month VPS. Bandwidth: a relayed game runs ~10-40 KB/s per guest — even a cheap VPS's traffic allowance covers hundreds of hours.

## Step 1 — Rent a VPS

Any provider works: DigitalOcean, Vultr, Hetzner, Linode. Pick:
- Cheapest plan (1 vCPU / 1GB RAM is plenty)
- OS: **Ubuntu 24.04 LTS**
- Region: roughly between you and the people you play with (central US if unsure)

Note the server's public IP address — call it `YOUR.VPS.IP` below.

## Step 2 — Install coturn

SSH in (`ssh root@YOUR.VPS.IP`) and run:

```bash
apt update && apt install -y coturn
```

Enable the service:

```bash
sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn 2>/dev/null || echo 'TURNSERVER_ENABLED=1' > /etc/default/coturn
```

## Step 3 — Configure coturn

Replace `/etc/turnserver.conf` with exactly this (pick your own long random password for `YOUR-SECRET`):

```
listening-port=3478
external-ip=YOUR.VPS.IP
realm=regicide
lt-cred-mech
user=regicide:YOUR-SECRET
min-port=49160
max-port=49200
fingerprint
no-multicast-peers
no-cli
no-tlsv1
no-tlsv1_1
```

## Step 4 — Open the firewall

If the VPS has ufw (Ubuntu default):

```bash
ufw allow 22/tcp
ufw allow 3478/udp
ufw allow 3478/tcp
ufw allow 49160:49200/udp
ufw enable
```

(Also check the provider's own cloud-firewall panel if it has one — same ports.)

## Step 5 — Start it

```bash
systemctl enable coturn
systemctl restart coturn
systemctl status coturn   # should say "active (running)"
```

## Step 6 — Test it

Open https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/ in Chrome:
1. Remove any existing servers in the list.
2. Add: URI `turn:YOUR.VPS.IP:3478`, username `regicide`, password `YOUR-SECRET`.
3. Click "Gather candidates".
4. You want a row whose Type is **relay**. If you see it, the TURN server works.

## Step 7 — Point the game at it

In `js/10-net.js`, near the top (just under `HALL_ID`), find:

```js
NET.TURN=null; // e.g. {urls:"turn:YOUR.VPS.IP:3478",username:"regicide",credential:"YOUR-SECRET"}
```

and change it to:

```js
NET.TURN={urls:"turn:YOUR.VPS.IP:3478",username:"regicide",credential:"YOUR-SECRET"};
```

That's the whole game-side change — every connection (host, join, hall, browser) already routes through `NET.peerOpts()`, which adds the TURN entry automatically. Publish to Netlify as usual; everyone hard-refreshes. No PROTO bump needed (connection config, not wire format).

## How to verify in-game

A pair that used to sit on 🐢 (or fail to connect) should now connect — they may STILL show 🐢-like ping (relays add a hop; expect +30-80ms), but snapshots flow steadily and the "Waiting for the host…" stalls disappear. Pairs that connected ⚡ before will keep connecting ⚡ — WebRTC only uses the relay when it must.

## Upkeep

- The secret is in plain text in your shipped JS — fine for a hobby game, but anyone can read it and use your relay. If the bandwidth bill ever looks odd, change `YOUR-SECRET` in both places.
- `apt upgrade` now and then; coturn needs no other care.
- To retire it: set `NET.TURN=null` and cancel the VPS.
