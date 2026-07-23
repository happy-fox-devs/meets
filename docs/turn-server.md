# TURN server — not configured

## Why this matters

`src/app/room/[roomId]/page.tsx` hardcodes STUN-only ICE servers in two places
(`createPeer` ~line 549, `addPeer` ~line 598):

```js
iceServers: [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478" },
],
```

STUN lets two peers discover their public IP/port so they can connect
directly. It does **not** help when a direct connection is impossible —
symmetric NAT, corporate firewalls, some mobile carriers/VPNs. In those
cases WebRTC needs a TURN server to relay media between peers. Without one,
those participants fail to connect with no clear error, which is very
likely the single biggest real-world reliability gap in this app today.

## Options

### 1. Managed TURN (Twilio Network Traversal Service)
- Already have a Twilio STUN entry above, so there's an existing account
  relationship to build on.
- Pay-per-GB relayed, no server to run/patch.
- Fetch short-lived credentials server-side (Twilio issues time-limited
  username/credential pairs), pass them to the client per session instead of
  static credentials.
- Twilio docs: Network Traversal Service (NTS) API.

### 2. Managed TURN (Cloudflare Calls / Cloudflare TURN)
- Similar per-GB pricing, no server to run.
- If already on Cloudflare for anything else, one less vendor.

### 3. Self-hosted (coturn)
- Full control, cost is just the VM, but you own patching, scaling, and
  DDoS/abuse exposure on a relay server (open to the internet by design).
- Needs a public IP + open UDP port range + TLS cert for TURNS.
- Makes sense once relay bandwidth at scale would cost more than a small VM,
  not before.

**Recommendation for a first pass**: managed (Twilio or Cloudflare) — no
infra to operate, and this app's call volume almost certainly doesn't justify
self-hosting yet. Revisit self-hosted only if relay bandwidth costs become
significant.

## What changes once a provider is picked

1. Env var(s) for the provider's credentials (e.g. `TWILIO_ACCOUNT_SID` /
   `TWILIO_AUTH_TOKEN`, or a static TURN URL + user/pass for coturn).
2. A small server-side endpoint (or reuse `server.js`) that mints short-lived
   ICE server credentials per room-join, returned alongside the existing
   `/api/v1/academic/meets/authorize` call — TURN credentials are usually
   time-limited (HMAC-based, expire in minutes/hours) rather than a static
   secret shipped to the client.
3. Replace the two hardcoded `iceServers` arrays in
   `src/app/room/[roomId]/page.tsx` with the servers returned by that
   endpoint (STUN entries can stay as a fallback; TURN gets appended).

Not implemented here — needs a provider choice and credentials, which is a
product/infra decision, not a code change.
