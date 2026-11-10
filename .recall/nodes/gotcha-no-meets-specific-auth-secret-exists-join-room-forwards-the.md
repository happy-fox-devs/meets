---
id: gotcha-no-meets-specific-auth-secret-exists-join-room-forwards-the
type: gotcha
scope: project
title: No meets-specific auth secret exists -- join-room forwards the caller's real NestWorks session JWT as-is to the calendar backend's authorize endpoint, which is the sole real auth check
triggers: ["autenticacion de la sala","room authentication","jwt secret","como se autoriza una llamada","how is a call session authorized"]
anchors: [{"path":"server.js","symbol":"join-room"}]
asserted: 2026-08-02
invalidated: null
superseded_by: null
confidence: medium
pin: false
source: init
---
On `join-room(roomId, userId, token)`, server.js does
`fetch(\`${CALENDAR_API_URL}/api/v1/academic/meets/authorize?roomId=...\`, {headers:{Authorization:\`Bearer ${token}\`}})`
(CALENDAR_API_URL defaults to http://localhost:8080) and only admits the socket
if the response is ok and `data.authorized` is true; `userName` for display is
taken from `data.userName` in that same response, never trusted from the client.
There is no JWT verification, signing key, or session store in this repo at
all -- the calendar (Spring Boot) backend's normal Spring Security auth is the
entire trust boundary. Verified against README.md, which states this
explicitly and matches the code exactly.
