---
id: gotcha-turn-is-not-configured-anywhere-ice-is-stun-only-google
type: gotcha
scope: project
title: TURN is not configured anywhere -- ICE is STUN-only (Google + Twilio public STUN), so calls fail silently across symmetric NAT/corporate firewalls
triggers: ["turn server","servidor turn no configurado","webrtc no conecta","nat traversal","ice servers stun only"]
anchors: [{"path":"src/app/room/[roomId]/page.tsx","symbol":"createPeer"}]
asserted: 2026-08-02
invalidated: null
superseded_by: null
confidence: medium
pin: false
source: init
---
Confirmed live in code, not just the doc: both `createPeer` (~line 554-564)
and `addPeer` (~line 603-613) hardcode the identical
`iceServers: [{urls:"stun:stun.l.google.com:19302"},{urls:"stun:global.stun.twilio.com:3478"}]`
with no TURN entry and no server-side credential-minting endpoint anywhere in
server.js. docs/turn-server.md documents this exact gap and recommends managed
TURN (Twilio NTS or Cloudflare Calls) as the first-pass fix, plus minting
short-lived TURN credentials alongside the existing authorize() call. As of
this pass it is still entirely unimplemented -- this is the single biggest
real-world reliability gap in the app: participants behind symmetric NAT,
corporate firewalls, or some mobile carriers/VPNs fail to connect with no
clear error shown to them.
