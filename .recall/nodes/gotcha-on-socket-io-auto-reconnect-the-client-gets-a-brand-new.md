---
id: gotcha-on-socket-io-auto-reconnect-the-client-gets-a-brand-new
type: gotcha
scope: project
title: On socket.io auto-reconnect the client gets a brand-new socket.id, so the room page must hook the Socket's 'connect' event (not Manager's 'reconnect') guarded by hasJoinedRoom to rejoin, or the tab becomes a silent zombie
triggers: ["reconexion de socket.io","socket reconnect stale peers","zombie tab after reconnect"]
anchors: [{"path":"src/app/room/[roomId]/page.tsx","symbol":"hasJoinedRoom"}]
asserted: 2026-08-02
invalidated: null
superseded_by: null
confidence: medium
pin: false
source: init
---
A brief network drop (sleep/wake, WiFi blip) makes socket.io-client
auto-reconnect with a new socket.id; the server already dropped the old room
membership when the old transport closed, and every existing simple-peer
connection was keyed to the old id. The fix hooks `socketRx.on("connect", ...)`
(not the Manager's "reconnect" event) -- comment states this was verified live:
"reconnect" fires BEFORE socket.id is repopulated, same race the initial-join
fix below it depends on. `hasJoinedRoom` no-ops this handler on the very first
connect (owned by the getUserMedia-gated flow instead); on real reconnects it
destroys all peersRef entries, clears peers state, and re-emits join-room.
Without this the tab looks connected but silently exchanges nothing.
