---
id: pattern-server-js-custom-express-socket-io-wrapper-around-next-s
type: pattern
scope: project
title: server.js (custom Express+Socket.io wrapper around Next's request handler) is the real entry point, not next start
triggers: ["servidor personalizado","custom server entry point","como arranca la app","how does the app start"]
anchors: [{"path":"server.js","symbol":"app.prepare"}]
asserted: 2026-08-02
invalidated: null
superseded_by: null
confidence: medium
pin: false
source: init
---
`npm run dev`/`npm run start` both run `node server.js`, never `next start`.
server.js creates a plain Express app, wraps it in `http.createServer`, attaches
a `socket.io` Server to that same httpServer, registers a `/health` route BEFORE
the Next.js catch-all, and only then does `server.all(/.*/, (req,res)=>handle(req,res))`
hand everything else to Next's `app.getRequestHandler()`. All WebRTC signaling
(join-room/offer/answer/ice-candidate/etc) lives in the io.on("connection", ...)
block in this same file — there is no separate signaling server or serverless
function.
