---
id: gotcha-emitjoinroom-is-gated-on-socketrx-connected-because
type: gotcha
scope: project
title: emitJoinRoom is gated on socketRx.connected because getUserMedia() can resolve before the socket.io handshake completes, else join-room fires with userId=undefined
triggers: ["getUserMedia race condition","join-room userId undefined","condicion de carrera socket connect"]
anchors: [{"path":"src/app/room/[roomId]/page.tsx","symbol":"emitJoinRoom"}]
asserted: 2026-08-02
invalidated: null
superseded_by: null
confidence: medium
pin: false
source: init
---
`socketRx.id` is only assigned once the WS handshake completes. If
`getUserMedia()` resolves first (e.g. permission already granted from a prior
visit), emitting join-room immediately would send `userId=undefined`. The code
checks `if (socketRx.connected) emitJoinRoom(); else socketRx.once("connect", emitJoinRoom)`
to guarantee socketRx.id is populated before the first join-room emit.
