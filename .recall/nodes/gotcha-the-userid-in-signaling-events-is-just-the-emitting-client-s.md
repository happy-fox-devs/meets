---
id: gotcha-the-userid-in-signaling-events-is-just-the-emitting-client-s
type: gotcha
scope: project
title: The 'userId' in signaling events is just the emitting client's own socket.id echoed back, not a persistent application user id
triggers: ["userId en signaling","socket id vs user id","identidad de usuario en la llamada","user identity in call"]
anchors: [{"path":"src/app/room/[roomId]/page.tsx","symbol":"emitJoinRoom"}]
asserted: 2026-08-02
invalidated: null
superseded_by: null
confidence: medium
pin: false
source: init
---
Client does `socketRx.emit("join-room", roomId, socketRx.id, token)` -- the
"userId" positional arg is literally its own transient socket.io connection id,
not a database/parent/vendor/student id from the calendar backend. Server
re-broadcasts that same value as the `userId` in "user-connected", and it's
used purely as the local key for peer connections (createPeer(userId, ...)).
The only real identity signal anywhere in the flow is `userName`, which comes
from the server-side authorize() response, not from this field. Don't treat
"userId" fields in this codebase's socket events as a real user identifier.
