---
id: reference-env-vars-actually-read-by-the-code-calendar-api-url-default
type: reference
scope: project
title: Env vars actually read by the code: CALENDAR_API_URL (default localhost:8080), ALLOWED_ORIGIN (Socket.IO CORS, default '*'), PORT (default 3000), MAX_ROOM_SIZE (default 8, undocumented in README)
triggers: ["variables de entorno del servicio meets","meets env vars","CALENDAR_API_URL ALLOWED_ORIGIN PORT"]
anchors: [{"path":"server.js","symbol":"CALENDAR_API_URL"}]
asserted: 2026-08-02
invalidated: null
superseded_by: null
confidence: medium
pin: false
source: init
---
README.md documents CALENDAR_API_URL, ALLOWED_ORIGIN, and PORT with their
defaults (verified against server.js -- matches exactly: CALENDAR_API_URL
defaults to http://localhost:8080, ALLOWED_ORIGIN to "*" used directly as
Socket.IO's cors.origin, PORT to 3000). MAX_ROOM_SIZE (default 8) is read
directly in server.js but is NOT mentioned in README.md at all -- a real gap
between the doc and the actual configurable surface.
