---
id: gotcha-there-is-no-persistence-layer-anywhere-in-this-repo-chat-is
type: gotcha
scope: project
title: There is no persistence layer anywhere in this repo -- chat is relayed in-memory only (never stored) and userNames/socketRooms are plain in-process Maps that don't survive a restart or scale past one instance
triggers: ["sin base de datos en meets","no database in meets repo","chat no se guarda","in-memory state single instance"]
anchors: [{"path":"server.js","symbol":"userNames"}]
asserted: 2026-08-02
invalidated: null
superseded_by: null
confidence: medium
pin: false
source: init
---
No ORM, no DB client, no persistence dependency in package.json at all.
`send-message` -> `receive-message` is relayed straight through
`socket.to(room).emit(...)` with zero chat history storage. `userNames` and
`socketRooms` are plain JS `Map`s scoped to the single Node process -- they
vanish on restart and there is no shared adapter (e.g. Redis) wiring multiple
server instances together, so this cannot horizontally scale past one instance
without adding a Socket.IO adapter and shared state store first.
