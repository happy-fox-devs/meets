---
id: reference-call-session-url-contract-is-room-roomid-token-jwt-the-room
type: reference
scope: project
title: Call session URL contract is /room/{roomId}?token={JWT} -- the room page decodes the JWT client-side only for display, never as the real auth check
triggers: ["url de la videollamada","call session url format","videoCallUrl contract","how to link into a meets room"]
anchors: [{"path":"src/app/room/[roomId]/page.tsx","symbol":"decodeJwtPayload"}]
asserted: 2026-08-02
invalidated: null
superseded_by: null
confidence: medium
pin: false
source: init
---
roomId comes from the dynamic route segment, the session JWT from the `token`
query param (`useSearchParams().get("token")`). `decodeJwtPayload` just
base64-decodes the JWT payload client-side to pull `fullName` for the on-screen
label -- comment in the file states explicitly this is "for display only", and
the server independently re-verifies the same token's signature via the
calendar backend's authorize() call before admitting the socket. If `token` is
missing entirely, the room page immediately `router.push("/")`. This is the
contract any external app (e.g. the `next` frontend's `videoCallUrl` links)
must produce.
