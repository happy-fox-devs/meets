---
id: pattern-home-page-src-app-page-tsx-has-no-manual-room-join-ui-at-all
type: pattern
scope: project
title: Home page (src/app/page.tsx) has no manual room-join UI at all -- it is a static dead-end telling users to use the NestWorks app's Join Call link
triggers: ["pagina de inicio sin join","home page no join form","no manual room join"]
anchors: [{"path":"src/app/page.tsx"}]
asserted: 2026-08-02
invalidated: null
superseded_by: null
confidence: medium
pin: false
source: init
---
`src/app/page.tsx` is a static client component (no state, no form) with copy
reading "There's no manual join here anymore. Open your booking or session
from the NestWorks app and use its 'Join Call' link -- it carries a signed,
verified token that authorizes you directly." There is no room-id input field,
no create-room flow, nothing -- the only entry point into a real call is a
pre-built /room/{roomId}?token=... URL from elsewhere (the `next` frontend).
