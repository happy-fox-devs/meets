---
id: convention-signaling-relay-offer-answer-ice-candidate-only-forwards
type: convention
scope: project
title: Signaling relay (offer/answer/ice-candidate) only forwards between two sockets that have both completed join-room and share the same server-tracked room
triggers: ["seguridad del relay de señalización","signaling relay security","secuestro de sesion webrtc","webrtc session hijack"]
anchors: [{"path":"server.js","symbol":"authorizedPeerInSameRoom"}]
asserted: 2026-08-02
invalidated: null
superseded_by: null
confidence: medium
pin: false
source: init
---
`authorizedPeerInSameRoom(socket, targetSocketId)` checks
`socketRooms.get(socket.id)` is set AND equals `socketRooms.get(targetSocketId)`.
socketRooms is only populated after a successful join-room authorize() call.
Every one of offer/answer/ice-candidate calls this guard before relaying;
without it, any connected (even unauthorized or wrong-room) socket could send
a forged SDP offer/answer at a guessed or previously-seen socket.id and inject
itself into another participant's call.
