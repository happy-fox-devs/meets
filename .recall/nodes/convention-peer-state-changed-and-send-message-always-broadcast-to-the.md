---
id: convention-peer-state-changed-and-send-message-always-broadcast-to-the
type: convention
scope: project
title: peer-state-changed and send-message always broadcast to the socket's own server-tracked room, never a client-supplied roomId
triggers: ["spoofing de sala en chat","room spoofing chat","peer-state-changed roomId"]
anchors: [{"path":"server.js","symbol":"peer-state-changed"}]
asserted: 2026-08-02
invalidated: null
superseded_by: null
confidence: medium
pin: false
source: init
---
Both handlers read `const room = socketRooms.get(socket.id)` (the room
established at authorized join-room time) and broadcast to that, ignoring any
roomId/other room field the client might include in the event payload. This
is deliberate per the inline comment -- prevents a caller from spoofing chat
messages or mute/video state into a room it never actually joined.
